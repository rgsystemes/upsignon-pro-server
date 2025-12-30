![UpsignOn](logo.png)

# UpsignOn by Septeo

## Configuration minimale requise

Pour assurer de bonnes performances de la stack, la machine doit disposer au **minimum** des ressources suivantes :

* **vCPU :** 4
* **RAM :** 8 Go
* **Stockage :** 50 Go SSD

## Tableau des flux

| Source                         | Destination   | Protocole / Port      | Description                                                     |
|--------------------------------|-------------- |-----------------------|-----------------------------------------------------------------|
| Internet                       | Traefik       | TCP 443               | Applications uniquement en HTTPS                                |
| Traefik                        | Server        | TCP 3000 (Par défaut) | UpsignOn Server                                                 |
| Traefik                        | Dashboard     | TCP 3001 (Par défaut) | UpsignOn Dashboard                                              |
| Server & Dashboard & DB backup | PostgreSQL    | TCP 5432              | Connexion à la base de données                                  |
| Traefik                        | Let’s Encrypt | TCP 443               | Génération et renouvellement automatique des certificats TLS    |

## Configuration DNS

Avant la mise en service, veuillez configurer le(s) enregistrement(s) DNS de type **A** de votre domaine vers l’adresse IP de votre machine. Vous pouvez choisir soit :
* **Un enregistrement unique** pour accéder aux applications **UpsignOn server** et **UpsignOn dashboard** de type :
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

## Récupération du projet

Lors de la première installation, clonez le dépôt Git à l’aide de la commande suivante :
```bash
git clone https://github.com/rgsystemes/upsignon-pro-server.git
```

## Certificats SSL

L’application prend en charge l’utilisation de certificats SSL afin de sécuriser les communications.  
Les clients peuvent soit utiliser des certificats générés automatiquement via **Let’s Encrypt**, soit fournir leurs **certificats personnalisés** (certificat et clé privée).  
Pour **Let'Encrypt**, aucune action n'est requise de votre part.  
En ce qui concerne les **certificats personnalisés**, plusieurs règles sont à respecter :
* Les fichiers doivent être placés dans le dossier [certs](certs).
* Le certificat et la clé privée doivent porter **le même nom**.
* Les extensions doivent être respectivement `.crt` pour le certificat et `.key` pour la clé privée. Exemple : 
  * `upsignonpro.crt`
  * `upsignonpro.key`

## Configuration des variables d'environnement

L’application s’appuie sur un fichier [.env](.env) pour charger ses variables de configuration. Avant de lancer le script de démarrage, assurez-vous d’avoir correctement défini les variables nécessaires dans ce fichier.

### Base de données

| Variable            | Valeur par défaut | Description                                                                                                                    |
|---------------------|-------------------|--------------------------------------------------------------------------------------------------------------------------------|
| DB_PASSWORD         | ✗                 | Mot de passe pour la base de données                                                                                           |
| DB_BACKUP_FREQUENCY | `1d`              | Fréquence des sauvegardes de la base de données. Utilisez `s` pour secondes, `m` pour minutes, `h` pour heures, `d` pour jours |
| MAX_DB_BACKUPS      | `7`               | Nombre maximum de sauvegardes à conserver                                                                                      |
| DB_BACKUPS_PATH     | `./backup`        | Répertoire où les sauvegardes seront stockées                                                                                  |

### Application

| Variable                  | Valeur par défaut           | Description                                                                                                 |
|---------------------------|-----------------------------|-------------------------------------------------------------------------------------------------------------|
| SESSION_SECRET            | ✗                           | Chaîne de caractères aléatoire générée automatiquement par le script `init.sh`                              |
| SERVER_DOMAIN             | `server-uso.example.com`    | URL pour accéder à l’application **UpsignOn Server**                                                        |
| DASHBOARD_DOMAIN          | `dashboard-uso.example.com` | URL pour accéder à l’application **UpsignOn Dashboard**                                                     |
| DASHBOARD_URL_PATH_PREFIX | `/`                         | Préfixe d’URL sous lequel l’application **UpsignOn Dashboard** est accessible (exemple : `/`, `/dashboard`) |
| SERVER_PORT               | `3000`                      | Port utilisé par l’application **UpsignOn Server**                                                          |
| DASHBOARD_PORT            | `3001`                      | Port utilisé par l’application **UpsignOn Dashboard**                                                       |
| ACCESS_ALLOWED_IPS        | `0.0.0.0/0,::/0`            | Liste des adresses IP autorisées à accéder aux services (toutes autorisées par défaut)                      |
| HTTP_PROXY                | ✗                           | Variable optionnelle pour définir le proxy HTTP. **Format :** `http://user:pass@host:port`                  |

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

## Mise en route de l'application UpsignOn

* Vérifier que le(s) **enregistrement(s) DNS** ont bien été [déclarés](README.md#configuration-dns).
* Configurer les **variables d'environnement** dans le fichier [.env](.env).
* Si vous avez des certificats personnalisés, déposez vos certificats dans le dossier [certs](certs).
* Le script `init.sh` permet d’initialiser et de démarrer automatiquement l’application **UpsignOn Pro** à l’aide de Docker. Il doit impérativement être exécuté avec les droits **root** et nécessite que **Docker soit installé et en cours d’exécution** sur la machine. Lors de l’exécution, le client doit choisir le mode de gestion des certificats TLS en passant l’un des paramètres obligatoires suivants : `-le` pour utiliser **Let’s Encrypt** ou `-certs` pour utiliser des **certificats TLS personnalisés** :
```bash
./init.sh -le # Let's Encrypt
./init.sh -certs # Certificats personnalisés
```

### Première connexion à la console d'administration

À la fin de l’exécution du script, un **lien en vers la console d’administration** sera généré avec les droits de superadministrateur. Ce lien sera valide durant *5 minutes*. Une fois ce délai dépassé, vous pourrez regénérer un lien de connexion temporaire à la console d'administration en exécutant le script [super_admin.sh](scripts/super_admin.sh) :
```bash
./scripts/super_admin.sh
```

### Backup de la base de données

Un container docker `uso.pg_backup` est utilisé pour réaliser des backups de votre base de données. [La configuration des backups](README.md#base-de-données) est automatiquement initialisée à partir des variables définies dans le fichier [.env](.env).  
Vous pouvez **modifier ces paramètres** à tout moment en modifiant les variables dans le fichier [.env](.env) et redéployer l'application en exécutant :
```bash
docker compose -f docker-compose-<le/certs>.yml up -d
```

### Configuration de l'envoi de mails

Lors du premier démarrage de l’application, [la configuration de l'envoi d'email](README.md#envoi-demails) est automatiquement initialisée à partir des variables définies dans le fichier [.env](.env).  
Vous pouvez **modifier ces paramètres** à tout moment depuis la console d’administration, dans l’onglet *Paramètres* -> *Paramètres*. Il est également possible de **tester l’envoi d’emails** en renseignant une adresse de destination. Un email test sera alors envoyé afin de valider la configuration de l'envoi d'emails.

### Ajout d'une première banque de coffres-fort

Dans la console d'administration, vous pouvez ajouter votre première banque de coffre-forts :
* Dans l'onglet *Paramètres* -> *Paramètres*, vérifiez que votre serveur UpsignOn PRO est en cours d'exécution.
* Dans l'onglet *Paramètres* -> *Banques de coffres-fort*, vous pouvez créer votre première banque. En cliquant sur le **bloc Super-Admin orange**, situé en haut à gauche de la page, vous accéderez à la liste de vos banques. Ouvrez la banque que vous venez de créer et naviguez ensuite vers l'onglet *Paramètres* de cette banque.
* Vous voyez alors un **lien de configuration**. Ce lien devra être utilisé par tous vos utilisateurs pour configurer leur application.

### Création de votre coffre-fort UpsignOn PRO

Toujours dans la console d'administration :
* Ouvrez la banque que vous venez de créer et naviguez ensuite dans l'onglet *Paramètres* -> *Autorisations*. Ajoutez **votre adresse email** (ou ***@votre-domaine.fr**) à la liste des adresses email autorisées pour cette banque.
* Installez [l'application UpsignOn](https://upsignon.eu/fr/downloads) sur votre poste.
* Dans l'onglet *Lien de configuration*, cliquez sur le **lien de configuration** ou scannez le **QR code**.
* Si tout est bien configuré, vous devriez pouvoir **créer votre espace UpsignOn PRO** dans l'application en suivant les instructions.

### Configuration de la connexion à la console directement via UpsignOn

Le mot de passe que vous avez utilisé précédemment pour vous connecter était **temporaire**. Grâce à UpsignOn, vous allez pouvoir vous connecter très simplement à votre console d'administration :
* Lorsque votre espace aura été correctement créé, revenez sur la page *Super-Admin* dans votre console d'administration. Dans l'onglet *Paramètres* -> *Administrateurs*, utilisez le **formulaire d'ajout d'un administrateur** pour ajouter votre adresse email (en vous laissant le **rôle Super-Admin**). Vous pouvez remettre une adresse email qui existe déjà dans la liste.
* Vous devriez alors recevoir **un email** (vérifiez éventuellement vos spams) qui vous permettra d'importer votre compte super-admin dans UpsignOn.
* Ouvrez le lien que vous aurez reçu par mail puis **suivez les instructions** dans l'application.

Grâce à UpsignOn, vous pouvez maintenant vous connecter en un clic à votre compte super-admin et renouveler votre mot de passe directement depuis l'application.  
Il ne vous reste plus qu'à configurer UpsignOn via votre dashboard selon vos besoins, à inviter d'autres administrateurs et à diffuser le lien de configuration à tous vos collègues.
