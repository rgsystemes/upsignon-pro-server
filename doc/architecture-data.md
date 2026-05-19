---
tags: [architecture, data, postgresql, documentation]
type: référence-technique
created: 2026-05-19
source: analyse statique du code source (migrations, ORM queries, env config, workflows)
---

# Architecture Data — UpSignOn PRO Server

| Élément | Valeur |
|---------|--------|
| **BU** | Septeo IT Solutions / RG Systèmes |
| **Produit** | UpSignOn PRO Server (gestionnaire de mots de passe entreprise) |
| **Version** | 2.11.0 |
| **Sources utilisées** | Code source (migrations SQL, requêtes `pg`, env.ts, workflows GitHub Actions) |
| **Environnement** | Production on-premise + SaaS (`*.upsignon.eu`) |
| **Date de l'analyse** | 2026-05-19 |
| **Note** | Aucun dump de schéma ni accès runtime — l'analyse est basée exclusivement sur le code |

---

## Vue d'ensemble

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Base de données principale | PostgreSQL | Stockage persistant de toutes les données métier |
| Sessions applicatives | PostgreSQL (tables `device_sessions`, `admin_sessions`) | Sessions utilisateur et admin, stockées en base |
| Sauvegardes | Filesystem local (`DB_BACKUP_DIR`) | Dumps quotidiens/hebdomadaires/mensuels PostgreSQL |
| Email (transit) | Nodemailer / Postfix local ou SMTP externe | Envoi de codes d'autorisation, notifications — pas de stockage propre |
| Microsoft Entra ID (externe, persistant) | Azure AD via `upsignon-ms-entra` | Source autoritaire pour les habilitations utilisateur (stocke les assignments) |
| Serveur de statut UpSignOn (externe, persistant) | `app.upsignon.eu` | Réception des métriques serveur, activation des licences |
| Serveur de licences (transit) | `upsignon-perso-server` → `upsignon-adv-dashboard` | Distribution des licences — pull/push |
| Proxy HTTP (transit) | Configurable via `HTTP_PROXY` | Transit réseau sortant uniquement |
| CI/CD (transit) | GitHub Actions → Ansible (`eel-ops`) | Build et déploiement Docker on-premise — pas de stockage de données métier |
| Process Manager | PM2 (`ecosystem.config.js`) | Supervision applicative — pas de persistance de données |

---

## 1. PostgreSQL — Base de données principale

### 1.1 Domaine : Multi-tenancy & Organisation

#### `banks`
Entité racine du multi-tenant — représente une organisation cliente.
(id SMALLSERIAL PK, name TEXT, settings JSON, created_at TIMESTAMPTZ, stop_this_instance BOOLEAN, public_id UUID UNIQUE, redirect_url TEXT, ms_entra_config JSON, reseller_id UUID FK→resellers)

> Anciennement `groups` — renommée en juillet 2025.

#### `resellers`
Revendeurs regroupant plusieurs banks.
(id UUID PK, name VARCHAR(255) UNIQUE, created_at TIMESTAMPTZ)

> Module récent : juillet 2025.

#### `admin_banks`
Table de jonction — Association admins↔banks (PK composite admin_id, bank_id ; FK CASCADE des deux côtés).

> Anciennement `admin_groups`.

---

### 1.2 Domaine : Utilisateurs & Appareils

#### `users`
Coffre-fort utilisateur — contient les données chiffrées côté client.
(id SERIAL PK, email VARCHAR(64), bank_id SMALLINT FK→banks CASCADE, encrypted_data_2 TEXT, sharing_public_key TEXT, sharing_public_key_2 TEXT, deactivated BOOLEAN, ms_entra_id UUID, settings_override JSONB, allowed_to_export BOOLEAN, allowed_offline_desktop BOOLEAN, allowed_offline_mobile BOOLEAN, nb_accounts INT, nb_codes INT, nb_accounts_strong/medium/weak INT, nb_accounts_with_duplicated_password INT, nb_accounts_with_no_password INT, nb_accounts_red/orange/green INT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)

- UNIQUE(email, bank_id)
- Contrainte lowercase sur email.
- Champ `encrypted_data` (v1) remplacé par `encrypted_data_2` (oct. 2023, migration de clés).

#### `user_devices`
Appareil enrôlé pour un utilisateur — porte l'état d'autorisation et les données cryptographiques.
(id SERIAL PK, user_id INT FK→users CASCADE, bank_id SMALLINT FK→banks CASCADE, device_unique_id UUID, device_name VARCHAR(64), device_type VARCHAR(32), os_family TEXT, os_version VARCHAR(64), app_version VARCHAR(20), install_type TEXT, authorization_status VARCHAR(64), authorization_code VARCHAR, auth_code_expiration_date TIMESTAMPTZ, revocation_date TIMESTAMP, device_public_key_2 TEXT, encrypted_password_backup_2 TEXT, session_auth_challenge TEXT, session_auth_challenge_exp_time TIMESTAMP, password_challenge_error_count INT, last_password_challenge_submission_date TIMESTAMP, last_sync_date TIMESTAMP, use_safe_browser_setup BOOLEAN, enrollment_method VARCHAR, created_at TIMESTAMPTZ)

- Index composite : (user_id, device_unique_id).
- `device_public_key` (v1) remplacé par `device_public_key_2` (oct. 2023).
- `encrypted_password_backup` remplacé par `encrypted_password_backup_2`.
- `password_challenge_blocked_until` renommé en `last_password_challenge_submission_date` (oct. 2025).
- Champ `enrollment_method` ajouté juillet 2025 (SSO enrollment).

#### `allowed_emails`
Patterns d'emails autorisés à s'inscrire dans une bank.
(id SERIAL PK, pattern VARCHAR(64), bank_id SMALLINT FK→banks CASCADE)

- Contrainte lowercase.

#### `changed_emails`
Suivi des changements d'adresse email — notification aux appareils.
(old_email VARCHAR(64), new_email VARCHAR(64), user_id INT FK→users CASCADE, aware_devices JSON, bank_id SMALLINT FK→banks CASCADE, created_at TIMESTAMPTZ)

- PK composite : (old_email, bank_id).

---

### 1.3 Domaine : Authentification & Sessions

#### `device_sessions`
Sessions temporaires des appareils (1h par défaut, ou durée token OpenID).
(session_id VARCHAR PK, session_data JSON, expiration_time TIMESTAMPTZ)

- Nettoyage automatique toutes les 10 minutes.

#### `admin_sessions`
Sessions administrateur pour le dashboard.
(session_id VARCHAR PK, session_data JSONB, expiration_time TIMESTAMP)

#### `password_reset_request`
Demandes de réinitialisation de mot de passe maître.
(id SERIAL PK, device_id INT FK→user_devices CASCADE, bank_id SMALLINT, status VARCHAR(32), reset_token VARCHAR(8), reset_token_expiration_date TIMESTAMPTZ, granted_by TEXT, created_at TIMESTAMPTZ)

- Statuts : `PENDING_ADMIN_CHECK`, `ADMIN_AUTHORIZED`, `COMPLETED`.

---

### 1.4 Domaine : Coffres partagés (Shared Vaults)

#### `shared_vaults`
Coffre partagé entre plusieurs utilisateurs — données chiffrées.
(id SERIAL PK, bank_id INT FK→banks CASCADE, name TEXT, encrypted_data TEXT, content_details JSON, key_backup TEXT, key_backup_shamir_index INT, nb_accounts INT, nb_codes INT, nb_accounts_strong/medium/weak INT, nb_accounts_with_duplicated_password INT, nb_accounts_with_no_password INT, nb_accounts_red/orange/green INT, last_updated_at TIMESTAMPTZ, created_at TIMESTAMPTZ)

> Module introduit en mai 2023. Remplace l'ancien système `shared_accounts` + `shared_account_users` (supprimé juillet 2024).

#### `shared_vault_recipients`
Table de jonction — association utilisateurs↔coffres partagés avec droits.
(shared_vault_id INT FK→shared_vaults CASCADE, user_id INT FK→users CASCADE, bank_id SMALLINT FK→banks CASCADE, encrypted_shared_vault_key TEXT, is_manager BOOLEAN, access_level VARCHAR(30) DEFAULT 'blind', created_at TIMESTAMPTZ)

- PK composite : (shared_vault_id, user_id).
- `access_level` : 'owner', 'reader', 'blind' (ajouté fév. 2025).

---

### 1.5 Domaine : Statistiques & Audit

#### `pwd_stats_evolution`
Métriques quotidiennes agrégées sur la qualité des mots de passe, par bank.
(date TIMESTAMPTZ, bank_id INT, nb_accounts INT, nb_codes INT, nb_accounts_strong/medium/weak INT, nb_accounts_with_duplicated_password INT, nb_accounts_with_no_password INT, nb_accounts_red/orange/green INT)

- PK composite : (date, bank_id).
- Collecte quotidienne à minuit UTC.
- Remplace `data_stats` (supprimée juin 2024).

#### `event_logs`
Piste d'audit des actions utilisateur et admin.
(device_id INT, user_email VARCHAR(64), admin_email VARCHAR(64), event TEXT, bank_id INT, date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)

> Module introduit en mai 2023.

---

### 1.6 Domaine : Licences

#### `external_licences`
Licences fournies par le système central Septeo.
(ext_id INT PK, nb_licences INT, valid_from TIMESTAMPTZ, valid_until TIMESTAMPTZ, is_monthly BOOLEAN, to_be_renewed BOOLEAN, reseller_id UUID FK→resellers CASCADE, bank_id SMALLINT FK→banks CASCADE)

> Module récent : août 2025.

#### `internal_licences`
Allocation des licences externes aux banks.
(id SERIAL PK, external_licences_id INT FK→external_licences CASCADE, nb_licences INT, bank_id SMALLINT FK→banks CASCADE)

- UNIQUE(external_licences_id, bank_id).

---

### 1.7 Domaine : SSO / OpenID

#### `bank_sso_config`
Configuration OpenID Connect par bank.
(id SERIAL PK, bank_id INT FK→banks CASCADE, openid_configuration_url VARCHAR, client_id VARCHAR)

> Module récent : juillet 2025.

---

### 1.8 Domaine : Administration

#### `admins`
Comptes administrateurs du dashboard.
(id UUID PK, email VARCHAR(64), password_hash VARCHAR(60), token UUID, token_expires_at TIMESTAMPTZ, admin_role ENUM('superadmin','restricted_superadmin','admin') DEFAULT 'admin', reseller_id UUID FK→resellers, created_at TIMESTAMPTZ)

- Champs `is_superadmin` et `is_read_only_superadmin` remplacés par `admin_role` (juillet 2025).

---

### 1.9 Domaine : Configuration

#### `settings`
Paramètres clé-valeur globaux.
(key VARCHAR(120) UNIQUE, value JSON)

- Clés connues : `SECRET`, `PRO_SERVER_URL_CONFIG`, `EMAIL_CONFIG`.
- Utilisée comme store de configuration partagé entre instances.

#### `url_list`
URLs de services connus pour l'autocomplétion et l'aide à la saisie.
(id SERIAL PK, displayed_name VARCHAR(64), signin_url TEXT, bank_id SMALLINT FK→banks CASCADE, uses_basic_auth BOOLEAN)

- Champ `password_change_url` supprimé (mai 2023).

---

### 1.10 Infrastructure framework

| Table | Rôle |
|-------|------|
| `migrations` | Suivi des migrations appliquées (name VARCHAR, migration_time TIMESTAMP) |

---

### 1.11 Tables supprimées

| Table | Supprimée | Raison |
|-------|-----------|--------|
| `shared_accounts` | Juillet 2024 | Remplacée par `shared_vaults` |
| `shared_account_users` | Juillet 2024 | Remplacée par `shared_vault_recipients` |
| `shared_folders` | Juillet 2024 | Fonctionnalité intégrée dans shared_vaults |
| `usage_logs` | Décembre 2023 | Remplacée par `last_sync_date` sur `user_devices` |
| `data_stats` | Juin 2024 | Remplacée par `pwd_stats_evolution` |

---

## 2. Filesystem — Sauvegardes

| Élément | Détail |
|---------|--------|
| Répertoire | `DB_BACKUP_DIR` (configurable, ex: `/home/upsignonpro/db_backups/`) |
| Fréquence | Quotidien (jours ouvrés), hebdomadaire, mensuel |
| Rétention quotidienne | `DB_BACKUP_DAYS_TO_KEEP` (défaut : 5 jours) |
| Rétention hebdomadaire | `DB_BACKUP_WEEKS_TO_KEEP` (défaut : 5 semaines) |
| Convention de nommage | `YYYY-MM-DD-daily/`, `YYYY-MM-DD-weekly/`, `YYYY-MM-DD-monthly/` |
| Vérification | Le serveur vérifie l'existence du backup lors du status report |

---

## 3. Services externes — Stockage persistant

### 3.1 Microsoft Entra ID (Azure AD)

| Élément | Détail |
|---------|--------|
| Package | `upsignon-ms-entra` v1.0.4 |
| Données stockées côté Entra | Assignments d'utilisateurs à l'application UpSignOn |
| Synchronisation | Toutes les 12h (1h et 13h UTC) |
| Impact | Désactivation/activation automatique des utilisateurs |
| Configuration | `ms_entra_config` JSON dans la table `banks` |

### 3.2 Serveur de statut UpSignOn (`app.upsignon.eu`)

| Élément | Détail |
|---------|--------|
| Endpoint | `POST /pro-status` |
| Données envoyées | Version serveur, nb coffres, versions app, stats sécurité agrégées, stats par bank/reseller, stats appareils, config SSO |
| Authentification | Secret partagé (table `settings`, clé `SECRET`) |
| Rôle | Monitoring centralisé, vérification d'activation de licence |
| Activation check | `POST /pro-activation-status` (polling toutes les 5min si inactif) |

---

## 4. Services externes — Transit uniquement

### 4.1 Email (Nodemailer / Postfix)

| Élément | Détail |
|---------|--------|
| Modes | Postfix local (sendmail) OU SMTP externe (config en base, table `settings` clé `EMAIL_CONFIG`) |
| DKIM | Optionnel, clé privée sur le filesystem |
| Emails envoyés | Codes d'autorisation d'appareils, notifications de reset, alertes admin |
| Stockage | Aucun — transit pur |

### 4.2 Système de licences (pull/push)

| Élément | Détail |
|---------|--------|
| Push | `upsignon-adv-dashboard` → `POST /licences` (signé cryptographiquement) |
| Pull | `upsignon-pro-server` → `upsignon-perso-server/pull-licences` → `upsignon-adv-dashboard` |
| Stockage local | Tables `external_licences` et `internal_licences` |
| Validation | Signature via `verifySignatureMiddleware` (libsodium) |

### 4.3 CI/CD — GitHub Actions → Ansible

| Élément | Détail |
|---------|--------|
| Trigger | Push sur branche `production` |
| Action | Webhook vers `rgsystemes/eel-ops` pour build Docker on-premise |
| Stockage | Aucun |

---

## 5. Chronologie des modules

| Période | Module |
|---------|--------|
| Février 2021 | Core : users, devices, sessions |
| Mars 2021 | Partage v1 (shared_accounts), stats, settings |
| Octobre 2021 | Multi-tenancy (groups/banks), administration |
| Février 2022 | Shared folders, multi-group admins |
| Mai 2023 | Shared vaults v2, audit trail, per-user config |
| Juin 2024 | pwd_stats_evolution (remplacement data_stats) |
| Juillet 2024 | Suppression legacy sharing (shared_accounts) |
| Juillet 2025 | Renommage groups→banks, SSO OpenID, resellers, admin roles |
| Août 2025 | Système de licences (external/internal) |
| Octobre–Novembre 2025 | Sécurité password challenge, cleanup |

---

## 6. Processus automatiques (background)

| Processus | Fréquence | Action |
|-----------|-----------|--------|
| `aggregateStatsDaily` | Quotidien (minuit UTC) | Agrège les stats utilisateurs/vaults → `pwd_stats_evolution` |
| `syncWithMicrosoftEntra` | Toutes les 12h | Sync habilitations Entra → désactivation utilisateurs |
| `cleanOldRevokedDevices` | Périodique | Supprime les appareils révoqués depuis > 1 mois |
| `cleanOrphanSharedVaults` | Périodique | Supprime les coffres partagés sans destinataire |
| `cleanSessions` | Toutes les 10 min | Purge les sessions expirées (`device_sessions`) |
| `sendStatusUpdate` | Au démarrage + périodique | Envoie les métriques au serveur central |
| `pullLicences` | Au démarrage + périodique | Récupère les licences depuis le dashboard central |
| `getActivationStatus` | Toutes les 5 min (si inactif) | Vérifie l'activation de la licence |
