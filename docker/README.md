![upsignon](logo.png)

# Upsignon by Septeo

## Configuration minimale requise

Pour assurer de bonnes performances de la stack, la machine doit disposer au **minimum** des ressources suivantes :

* **vCPU :** 4
* **RAM :** 8 Go
* **Stockage :** 50 Go SSD

## Tableau des flux

| Source                         | Destination   | Protocole / Port      | Description                                                     |
|--------------------------------|-------------- |-----------------------|-----------------------------------------------------------------|
| Internet                       | Traefik       | TCP 443               | Applications uniquement en HTTPS                                |
| Traefik                        | Server        | TCP 3000 (Par défaut) | Upsignon Server                                                 |
| Traefik                        | Dashboard     | TCP 3001 (Par défaut) | Upsignon Dashboard                                              |
| Server & Dashboard & DB backup | PostgreSQL    | TCP 5432              | Connexion à la base de données                                  |
| Traefik                        | Let’s Encrypt | TCP 443               | Génération et renouvellement automatique des certificats TLS    |

## Configuration DNS

Avant la mise en service, veuillez configurer le(s) enregistrement(s) DNS de type **A** de votre domaine vers l’adresse IP de votre machine. Vous pouvez choisir soit :
* **Un enregistrement unique** pour accéder aux applications **Upsignon server** et **Upsignon dashboard** de type :
  * https://upsignonpro.votre-domaine.fr
  * https://upsignonpro.votre-domaine.fr/admin
* **Deux enregistrements distincts**, un pour chaque application, de type :
  * https://upsignonpro.votre-domaine.fr
  * https://upsignonpro-admin.votre-domaine.fr

Nous devons déclarer vos urls dans notre base de données pour qu'elles soit autorisées. Envoyez-nous les deux urls que vous aurez choisies, chemin compris, par email [BS-SEPTEOITSOLUTIONS-Support@septeo.com](mailto:BS-SEPTEOITSOLUTIONS-Support@septeo.com) avant de commencer l'installation pour ne pas perdre de temps.

## Prérequis d’installation

L'application nécessite les éléments suivants :
* **Git :** Consultez la [documentation officielle](https://git-scm.com/downloads) correspondant à votre système d'exploitation
* **Docker :** Consultez la [documentation officielle](https://docs.docker.com/engine/install) correspondant à votre système d'exploitation

## Configuration des variables d'environnement

L’application s’appuie sur un fichier [.env](.env) pour charger ses variables de configuration. Avant de lancer le script de démarrage, assurez-vous d’avoir correctement défini les variables nécessaires dans ce fichier.

### Base de données

| Variable            | Valeur par défaut | Description                                                                                                                    |
|---------------------|-------------------|--------------------------------------------------------------------------------------------------------------------------------|
| DB_PASSWORD         | ✗                 | Mot de passe pour la base PostgreSQL                                                                                           |
| DB_BACKUP_FREQUENCY | `1d`              | Fréquence des sauvegardes de la base de données. Utilisez `s` pour secondes, `m` pour minutes, `h` pour heures, `d` pour jours |
| MAX_DB_BACKUPS      | `7`               | Nombre maximum de sauvegardes à conserver                                                                                      |
| DB_BACKUPS_PATH     | `./backup`        | Répertoire où les sauvegardes seront stockées                                                                                  |

### Application

| Variable             | Valeur par défaut           | Description                                                                                                 |
|----------------------|-----------------------------|-------------------------------------------------------------------------------------------------------------|
| SESSION_SECRET       | ✗                           | Chaîne de caractères aléatoire générée par le script `init.sh`                                              |
| SERVER_DOMAIN        | `server-uso.example.com`    | URL pour accéder à l’application **Upsignon Server**                                                        |
| DASHBOARD_DOMAIN     | `dashboard-uso.example.com` | URL pour accéder à l’application **Upsignon Dashboard**                                                     |
| DASHBOARD_PREFIX_URL | `/`                         | Préfixe d’URL sous lequel l’application **Upsignon Dashboard** est accessible (exemple : `/`, `/dashboard`) |
| SERVER_PORT          | `3000`                      | Port utilisé par l’application **Upsignon Server**                                                          |
| DASHBOARD_PORT       | `3001`                      | Port utilisé par l’application **Upsignon Dashboard**                                                       |
| ACCESS_ALLOWED_IPS   | `0.0.0.0/0,::/0`            | Liste des adresses IP autorisées à accéder aux services (toutes autorisées par défaut)                      |
| HTTP_PROXY           | ✗                           | Variable optionnelle pour définir le proxy HTTP. **Format :** `http://user:pass@host:port`                  |

### Envoi d'emails

| Variable               | Valeur par défaut | Description                                                                              |
|------------------------|-------------------|------------------------------------------------------------------------------------------|
| SMTP_HOST              | ✗                 | Adresse du serveur SMTP utilisé pour l’envoi des emails                                  |
| SMTP_PORT              | ✗                 | Port du serveur SMTP (souvent 25, 465 ou 587 selon le protocole)                         |
| SMTP_USER              | ✗                 | Nom d’utilisateur ou identifiant pour l’authentification auprès du SMTP                  |
| SMTP_PASSWORD          | ✗                 | Mot de passe associé au compte SMTP pour l’envoi sécurisé des emails                     |
| SMTP_SENDING_USER      | ✗                 | Adresse email qui apparaîtra comme l’expéditeur des messages envoyés                     |
| SMTP_ALLOW_INVALID_CRT | `false`           | Autorise ou non l’utilisation de certificats SSL/TLS invalides pour le SMTP              |
| LETSENCRYPT_EMAIL      | ✗                 | Adresse email utilisée pour l’enregistrement et la gestion des certificats Let’s Encrypt |


## Mise en route de l'application Upsignon

1. Vérifier que le(s) **enregistrement(s) DNS** ont bien été [déclarés](README.md#configuration-dns).
2. Configurer les **variables d'environnement** dans le fichier [.env](.env).
3. Lancer le [script de démarrage](init.sh) en tant que **root** :
```
./init.sh
```

### Première connexion à la console d'administration

À la fin de l’exécution du script, un **lien en vers la console d’administration** sera généré avec les droits de superadministrateur. Ce lien sera valide durant *5 minutes*. Une fois ce délai dépassé, vous pourrez regénérer un lien de connexion temporaire à la console d'administration en exécutant le script [super_admin.sh](scripts/super_admin.sh) :
```
./scripts/super_admin.sh
```

### Backup de la base de données

Un container docker `uso.pg_backup` est utilisé pour réaliser des backups de votre base de données. [La configuration des backups](README.md#base-de-données) est automatiquement initialisée à partir des variables définies dans le fichier [.env](.env).
Vous pouvez **modifier ces paramètres** à tout moment en modifiant les variables dans le fichier [.env](.env) et redéployer l'application en exécutant :
```
docker compose up -d
```

### Configuration de l'envoi de mails

Lors du premier démarrage de l’application, [la configuration de l'envoi d'email](README.md#envoi-demails) est automatiquement initialisée à partir des variables définies dans le fichier [.env](.env).
Vous pouvez **modifier ces paramètres** à tout moment depuis la console d’administration, dans l’onglet *Paramètres* -> *Paramètres*. Il est également possible de **tester l’envoi d’emails** en renseignant une adresse de destination. Un email test sera alors envoyé afin de valider la configuration de l'envoi d'emails.

### Ajout d'une première banque de coffres-fort

Dans la console d'administration, vous pouvez ajouter votre première banque de coffre-forts :
* Dans l'onglet *Paramètres* -> *Paramètres*, vérifiez 

TO DO
5. Dans la console, ouvrez l’onglet **Paramètres**, puis créez une **banque de coffres-forts**. Un e-mail vous sera envoyé : cliquez sur le lien qu’il contient ou scannez le QR code. Vous serez alors redirigé vers la **page de téléchargement de l’application**.
6. **Téléchargez et installez l’application** adaptée à votre système d’exploitation, puis cliquez sur le bouton afin de configurer votre espace depuis l’application.
7. Dans l'application, saisissez votre adresse e-mail. Vous recevrez un email de confirmation contenant un **code**. Saisissez ce code pour **activer ce périphérique**.
8. Définissez un **mot de passe maître** qui vous permettra d’accéder à votre coffre-fort.
9. Par défaut, l’adresse e-mail associée au coffre-fort n’a pas les droits Super Admin. Depuis la console d’administration, vous pouvez attribuer à ce compte **le rôle Super-Admin** ou **ajouter un autre administrateur** (Super-Admin ou non).

## Scripts supplémentaires

* **pg_restore.sh** : Script permettant de restaurer la base de données à partir d’un snapshot sélectionné. Il offre également la possibilité de créer une nouvelle base de données dédiée avant d’y restaurer le snapshot.
