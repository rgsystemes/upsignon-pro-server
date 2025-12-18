![upsignon](logo.png)

# Upsignon by Septeo

## Configuration minimale requise

Pour assurer de bonnes performances de la stack, la machine doit disposer au minimum des ressources suivantes :

* **vCPU :** 4
* **RAM :** 8 Go
* **Stockage :** 100 Go SSD
* **Réseau :** Connexion ≥ 1 Gbps

## Tableau des flux

| Source             | Destination   | Protocole / Port      | Description                                       |
|--------------------|-------------- |-----------------------|---------------------------------------------------|
| Internet           | Traefik       | TCP 80 / 443          | Redirection automatique des applications en HTTPS |
| Traefik            | Server        | TCP 3000 (Par défaut) | Upsignon Server                                   |
| Traefik            | Dashboard     | TCP 3001 (Par défaut) | Upsignon Dashboard                                |
| Server & Dashboard | PostgreSQL    | TCP 5432              | Connexion à la base de données                    |
| Traefik            | Let’s Encrypt | TCP 80 / 443          | Renouvellement automatique des certificats TLS    |

## Prérequis d’installation

L'application nécessite les éléments suivants :
* **Git :** Consultez la [documentation officielle](https://git-scm.com/downloads) correspondant à votre système d'exploitation
* **Docker :** Consultez la [documentation officielle](https://docs.docker.com/engine/install) correspondant à votre système d'exploitation

## Configuration DNS

Afin d’anticiper la mise en service des différents services, veuillez préparer les enregistrements DNS de type **A** pour votre domaine, pointant vers l’adresse IP de votre machine :
* Un enregistrement pour accéder à l'application **Upsignon server**.
* Un enregistrement pour accéder à l'application **Upsignon dashboard**.

## Configuration des variables d'environnement

L’application s’appuie sur un fichier [.env](.env) pour charger ses variables de configuration. Avant de lancer le script de démarrage, assurez-vous d’avoir correctement défini les variables nécessaires dans ce fichier.

### PostgreSQL

| Variable            | Valeur par défaut | Description                                                                                                                    |
|---------------------|-------------------|--------------------------------------------------------------------------------------------------------------------------------|
| DB_PASSWORD         | ✗                 | Mot de passe pour la base PostgreSQL                                                                                           |
| DB_BACKUP_FREQUENCY | 1d                | Fréquence des sauvegardes de la base de données. Utilisez `s` pour secondes, `m` pour minutes, `h` pour heures, `d` pour jours |
| MAX_DB_BACKUPS      | 7                 | Nombre maximum de sauvegardes à conserver                                                                                      |
| DB_BACKUPS_PATH     | ./backup          | Répertoire où les sauvegardes seront stockées                                                                                  |

### Application

| Variable         | Valeur par défaut           | Description                                                                            |
|------------------|-----------------------------|----------------------------------------------------------------------------------------|
| SESSION_SECRET   | ✗                           | Chaîne de caractères aléatoire générée par le script `init.sh`                         |
| SERVER_URL       | `server-uso.example.com`    | URL pour accéder à l’application Server                                                |
| DASHBOARD_URL    | `dashboard-uso.example.com` | URL pour accéder à l’application Dashboard                                             |
| SERVER_PORT      | 3000                        | Port utilisé par l’application Server                                                  |
| DASHBOARD_PORT   | 3001                        | Port utilisé par l’application Dashboard                                               |
| HTTP_PROXY       | ✗                           | Variable optionnelle pour définir le proxy HTTP. Format : `http://user:pass@host:port` |
### SMTP

| Variable               | Valeur par défaut | Description                                                                              |
|------------------------|-------------------|------------------------------------------------------------------------------------------|
| SMTP_HOST              | ✗                 | Adresse du serveur SMTP utilisé pour l’envoi des emails                                  |
| SMTP_PORT              | ✗                 | Port du serveur SMTP (souvent 25, 465 ou 587 selon le protocole)                         |
| SMTP_USER              | ✗                 | Nom d’utilisateur ou identifiant pour l’authentification auprès du SMTP                  |
| SMTP_PASSWORD          | ✗                 | Mot de passe associé au compte SMTP pour l’envoi sécurisé des emails                     |
| SMTP_SENDING_USER      | ✗                 | Adresse email qui apparaîtra comme l’expéditeur des messages envoyés                     |
| SMTP_ALLOW_INVALID_CRT | false             | Autorise ou non l’utilisation de certificats SSL/TLS invalides pour le SMTP              |
| LETSENCRYPT_EMAIL      | ✗                 | Adresse email utilisée pour l’enregistrement et la gestion des certificats Let’s Encrypt |


## Démarrage de l'application Upsignon

1. Vérifier que les **enregistrements DNS** ont bien été déclarés.
2. Configurer les **variables d'environnement** dans le fichier `.env`.
3. Exécuter le **script de démarrage** :
```
sudo ./init.sh
```
4. À la fin de l’exécution du script, un **lien vers la console d’administration** sera généré. Ce lien sera valide durant *5 minutes*. Si ce délai est dépassé, veuillez lancer le script `super_admin.sh` situé dans le dossier **scripts** pour regénérer un lien.
5. Dans la console, ouvrez l’onglet **Paramètres**, puis créez une **banque de coffres-forts**. Un e-mail vous sera envoyé : cliquez sur le lien qu’il contient ou scannez le QR code. Vous serez alors redirigé vers la **page de téléchargement de l’application**.
6. **Téléchargez et installez l’application** adaptée à votre système d’exploitation, puis cliquez sur le bouton afin de configurer votre espace depuis l’application.
7. Dans l'application, saisissez votre adresse e-mail. Vous recevrez un email de confirmation contenant un **code**. Saisissez ce code pour **activer ce périphérique**.
8. Définissez un **mot de passe maître** qui vous permettra d’accéder à votre coffre-fort.
9. Par défaut, l’adresse e-mail associée au coffre-fort n’a pas les droits Super Admin. Depuis la console d’administration, vous pouvez attribuer à ce compte **le rôle Super-Admin** ou **ajouter un autre administrateur** (Super-Admin ou non).

## Scripts supplémentaires

* **pg_restore.sh** : Script permettant de restaurer la base de données à partir d’un snapshot sélectionné. Il offre également la possibilité de créer une nouvelle base de données dédiée avant d’y restaurer le snapshot.
* **super_admin.sh** : Script permettant de régénérer un lien vers la console d’administration Super Admin si le précédent (valide 5 minutes) a expiré.

Les scripts doivent être exécutés depuis le répertoire où ils sont stockés.
