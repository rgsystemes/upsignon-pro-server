> IMPORTANT : AMÉLIORATION CONTINUE\
> Afin de vous proposer la meilleure documentation possible, nous vous serions très reconnaissant de nous faire part de toutes remarques, erreurs, et ommissions que vous détecteriez dans ce qui suit. contact@upsignon.eu

> Note sur le vocabulaire :\
> Dans cette documentation, un serveur désigne un processus qui écoute sur un port. Nous parlons de machine ou de VM pour désigner le conteneur hardware + système d'exploitation sur lequel s'exécutent ces processus.

# 0 - Schéma d'architecture

Vous allez devoir installer une base de données PostgreSQL et deux "serveurs" applicatifs (comprendre programmes nodeJS qui écoutent sur des ports localhost), soit 3 processus. Notez que ces 3 processus peuvent être éxecutés sur des machines différentes si vous le souhaitez.

![](/doc/integrationSchemeGeneral.png)

## Architecture type 1 (Architecture standard, la plus simple, recommandée)

Nous recommandons cette architecture pour simplifier l'installation et la maintenance.

![](/doc/integrationScheme1.png)

## Architecture type 2 également possible

Ce type d'architecture sera notamment adapté pour les cas où vous voulez ajouter une couche de protection supplémentaire sur le serveur d'administration en le rendant accessible uniquement depuis votre réseau d'entreprise interne afin de limiter la surface d'attaque possible.

Notez cependant que le serveur UpSignOn PRO doit rester accessible depuis n'importe où pour que le client lourd puisse s'y connecter.
![](/doc/integrationScheme2.png)

## Ressources nécessaires estimées par machine

Machine pour les serveurs NodeJS

- OS : Debian 12 (ou 11) (sans interface graphique)
- CPU : 2vcore
- RAM : 2Go
- HD ou SSD 15Go :compter environ 3Go pour le système d'exploitation, les packages d'installation et le code + 6Go de logs par machine maximum. Soit, pour l'architecture type 1, 15Go de HD/SSD (hors base de données) et dans l'architecture type 2, 2 fois 9 Go de HD/SSD.

Machine pour le serveur de base de données (si architecture type 2)

- votre OS de prédilection (sans interface graphique)
- CPU: 2vcore
- RAM 512Mo minimum
- HD ou SD : compter environ 200ko par utilisateur, soit 100mo pour 500 utilisateurs.

## Tableau des flux

| Origine                              | Destination                                                       | PORT             |
| ------------------------------------ | ----------------------------------------------------------------- | ---------------- |
| Let's Encrypt (optionnel)            | Machine du serveur UpSignOn PRO                                   | 80               |
| Let's Encrypt (optionnel)            | Machine du serveur d'administration                               | 80               |
| Serveur UpSignOn PRO                 | Base de données                                                   | 5432             |
| Serveur UpSignOn PRO                 | app.upsignon.eu                                                   | 443              |
| Serveur UpSignOn PRO                 | internet (pour l'installation, les mises à jour, Microsoft Entra) | 443              |
| Serveur UpSignOn PRO via Postfix     | internet (pour l'envoi de mails)                                  | 25 ou 587 ou 465 |
| Serveur d'administration             | Base de données                                                   | 5432             |
| Serveur d'administration via Postfix | internet (pour l'envoi de mails)                                  | 25 ou 587 ou 465 |
| Serveur d'administration             | internet (pour l'installation, les mises à jour, Microsoft Entra) | 443              |
| Navigateur                           | Serveur d'administration                                          | 443              |
| Client lourd (application UpSignOn)  | Serveur UpSignOn PRO                                              | 443              |
| Client lourd (application UpSignOn)  | app.upsignon.eu                                                   | 443              |
| Client lourd (application UpSignOn)  | \*.sentry.io                                                      | 443              |

# 1 - Avant de commencer l'installation

## Choisissez et déclarez-nous vos urls

Choisissez les urls sur lequelles seront accessibles les deux serveurs. Nous vous recommandons de choisir le sous-domaine 'upsignonpro' afin d'éviter les erreurs d'installation et pour rester exactement conforme à cette documenation.

Dans le cas de l'architecture type 1, vos urls seront:

- https://upsignonpro.votre-domaine.fr
- https://upsignonpro.votre-domaine.fr/admin

Dans le cas de l'architecture type 2, vous aurez probablement 2 sous-domaines, donc vos urls seront par exemple

- https://upsignonpro.votre-domaine.fr
- https://upsignonpro-admin.votre-domaine.fr

Nous devons déclarer vos urls dans notre base de données pour qu'elles soit autorisées. Envoyez-nous les deux urls que vous aurez choisies, chemin compris, par email (giregk@upsignon.eu) **avant** de commencer l'installation pour ne pas perdre de temps.

## Machine virtuelle dédiée

Nous recommandons l'utilisation d'une machine virtuelle dédiée à UpSigOn PRO. Ne réutilisez pas une machine sur laquelle vous faites déjà tourner d'autres services. La réutilisation d'une VM augmente les risques de compromission et les risques de conflits d'installation et de configuration.

## Configuration DNS

- Ajouter un enregistrement A ou AAAA pour lier votre sous-domaine à l'adresse IP de votre machine.
- D'autres enregistrements seront potentiellement ajoutés par la suite
  - CAA
  - SPF, DKIM, DMARC

# 2 - Installation préalables

En tant que root

```
apt-get update
apt-get install -y postgresql
apt-get install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
apt-get install -y git
adduser upsignonpro
```

## Installation de la base de données

Connectez-vous en tant qu'utilisateur postgres à la base de données PostgreSQL :

```bash
root@localhost:~# su - postgres
postgres@localhost:~$ psql
```

Configurez le rôle upsignonpro pour la base de données

```
postgres=# CREATE ROLE upsignonpro WITH LOGIN;
```

Ajoutez ensuite un mot de passe au role upsignonpro, puis sortez de l'invite de commande PSQL. NB, par la suite ce mot de passe sera associé à la variable d'environnement DB_PASS. (NB, vous pouvez utiliser la commande `openssl rand -hex 20` pour générer un mot de passe fort aléatoire).

```
postgres=# \password upsignonpro;
postgres=# quit
```

Créez la base de données (NB: cette base de données sera provisionnée dans l'étape suivante)

```bash
postgres@localhost:~$ createdb upsignonpro -O upsignonpro
```

À partir de là, vous devriez pouvoir vous connecter à votre base de données en tant qu'utilisateur 'upsignonpro':

```bash
postgres@localhost:~$ exit
root@localhost:~# su - upsignonpro
upsignonpro@localhost:~$ psql upsignonpro
```

Dans la suite, les variables d'environnement suivantes feront référence à la configuration de la base de données

- DB_USER: nom de l'utilisateur propriétaire de la base de données soit 'upsignonpro'
- DB_PASS: mot de passe d'accès à la base de données (celui du role 'upsignonpro')
- DB_NAME: nom de la base de données, soit 'upsignonpro'
- DB_HOST: nom d'hôte de la machine sur laquelle est servi la base de données ('localhost')
- DB_PORT: port sur lequel est servi la base de données ('5432')

# 3 - Configuration d'un reverse proxy

## Installation de nginx

> REMARQUE IMPORTANTE : si vous avez déjà un reverse proxy par ailleurs dans votre infrastructure, l'installation de nginx et des certificats SSL n'est peut-être pas nécessaire. Dans ce cas, vous devrez adapter ce qui suit à votre cas particulier, notamment en dirigeant les requêtes sur l'url du serveur UpSignOn PRO vers le port 3000 de la machine actuelle et les requêtes sur l'url du serveur d'administration vers le port 3001. Il est également crucial de passer également les paramètres proxy-set-header. Contactez-nous pour en discuter en cas de doute.

> Vous pouvez également utiliser un reverse proxy Apache si vous le souhaitez (cf [utiliser apache](/doc/ApacheConfig.md)).

En tant que **root**,

- installer Nginx (reverse proxy)

  ```bash
  root@localhost:~# apt install nginx
  ```

## Installation d'un certificat Let's Encrypt

**DNS**

Ajouter un enregistremenent DNS CAA pour n'autoriser que Let's Encrypt à émettre un certificat pour votre sous-domaine (non obligatoire, mais recommandé):

- type: CAA
- nom d'hôte: <upsignonpro.votre-domaine.fr>
- valeur: 128 issue "letsencrypt.org"

**Configuration**

NB: Let's Encrypt permet d'obtenir un certificat gratuit renouvellé automatiquement. C'est l'option proposée par défaut dans cette documentation. Vous pouvez également si vous le souhaitez utiliser une autre autorité de certification et gérer les certificats manuellement.

      - les certificats wildcard sont autorisés mais non recommandés car vous devrez partager la clé privée entre plusieurs serveurs ce qui peut augmenter votre risque en cas de compromission de l'une des machines.
      - **LES CERTIFICATS AUTOSIGNÉS NE FONCTIONNERONT PAS** (sauf s'ils sont approuvés par toutes les machines de vos collaborateurs, mais cela reste fortement déconseillé).

- suivez la procédure d'installation de Let's Encrypt: https://certbot.eff.org/instructions?ws=nginx&os=debianbuster (ou https://certbot.eff.org/ si vous êtes sur un autre type de machine)

NB: Let's Encrypt produit ses certificats dans le dossier `/etc/letsencrypt/live/<upsignonpro.votre-domaine.fr>/`

## (Alternative) Installation d'un certificat géré manuellement

- ajoutez vos fichiers de certificats SSL, par exemple dans le dossier /etc/nginx/ssl
  - `root@localhost:~# mkdir /etc/nginx/ssl/`
  - fichier certificat: /etc/nginx/ssl/upsignonpro.cer
    > ATTENTION, il est primordial que ce fichier contienne toute la chaine de certification. Autrement l'application mobile refusera d'exécuter les requêtes vers votre serveur. Vous pouvez tester que c'est bien le cas grâce au site [https://whatsmychaincert.com](https://whatsmychaincert.com)
  - fichier clé privée: /etc/nginx/ssl/upsignonpro.key
  - `root@localhost:~# chmod 400 /etc/nginx/ssl/*`

## Configuration de nginx

- forcez l'utilisation de TLSv1.2 ou TLSv1.3 en éditant le fichier /etc/nginx/nginx.conf et en y modifiant la ligne ssl_protocols

```
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
```

- créez le fichier /etc/nginx/sites-available/upsignonpro et ajoutez-y le contenu suivant:

```
server {
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;

  add_header X-Frame-Options "DENY";
  add_header X-XSS-Protection "1; mode=block";
  add_header X-DNS-Prefetch-Control "off";
  add_header X-Download-Options "noopen";
  add_header X-Content-Type-Options "nosniff";
  add_header X-Permitted-Cross-Domain-Policies "none";

  add_header Strict-Transport-Security 'max-age=15552000; includeSubDomains; preload; always;';

  # TODO
  ssl_certificate /etc/letsencrypt/live/<upsignonpro.votre-domaine.fr>/fullchain.pem; # or /etc/nginx/ssl/upsignonpro.cer;
  ssl_certificate_key /etc/letsencrypt/live/<upsignonpro.votre-domaine.fr>/privkey.pem; # or /etc/nginx/ssl/upsignonpro.key;

  ssl_ciphers 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-DSS-AES128-GCM-SHA256:kEDH+AESGCM:ECDHE-ECDSA-AES128-SHA256:ECDHE-ECDSA-AES128-SHA:ECDHE-ECDSA-AES256-SHA384:ECDHE-ECDSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-DSS-AES256-SHA:DHE-RSA-AES256-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!3DES:!MD5:!PSK';


  listen 443 ssl http2;
  listen [::]:443 ssl http2;

  # TODO
  server_name upsignonpro.votre-domaine.fr;
  proxy_ssl_verify off;

  # TODO: keep this only for architecture 1 or the pro server of architecture 2
  location / {
    proxy_pass http://localhost:3000/;
  }
  # TODO: keep this only for architecture 1
  location /admin/ {
    proxy_pass http://localhost:3001/;
  }
  # TODO: keep this only for the admin server of architecture 2
  location / {
    proxy_pass http://localhost:3001/;
  }
}

```

> attention le '/' final dans 'http://localhost:3000/' et 'http://localhost:3001/' est important.

Puis créeez un lien symbolique vers ce fichier

```
ln -s /etc/nginx/sites-available/upsignonpro /etc/nginx/sites-enabled/upsignonpro
```

Une fois ce fichier créé, redémarrez Nginx

```
systemctl restart nginx
```

# 4 - Installation de Postfix (optionnel)

> Les services UpSignOn ont besoin d'envoyer des emails transactionnels aux utilisateurs pour l'autorisation d'appareils, les procédures de mots de passe oublié, etc. Vous pouvez utiliser une adresse email relaie (à configurer à la fin de l'installation), ou choisir d'envoyer les mails directement depuis votre VM.

Voici la procédure permettant de configurer Postfix pour l'envoi de mails directement depuis la VM.

## Reverse DNS

Configurez le reverse DNS de votre VM pour pointer vers le sous-domaine que vous avez choisi (normalement `upsignonpro.votre-domaine.fr`). Cela se paramètre normalement au niveau de votre fournisseur d'hébergement. Ceci est nécessaire au bon fonctionnement de Postfix pour l'envoi de mails aux utilisateurs (mail d'enrollement d'appareil, mail de mot de passe oublié, etc.).

<!---
Tutorials that helped creating this doc:
- https://netcorecloud.com/tutorials/install-postfix-as-send-only-smtp-server/
- https://scribbble.io/wardpoel/install-and-configure-postfix/
--->

## Configurez le hostname de votre machine

- Modifiez le fichier **/etc/hosts** et remplacez localhost par `upsignonpro.votre-domaine.fr` à la fin de la ligne '127.0.0.1 localhost' c'est-à-dire '127.0.0.1 upsignonpro.votre-domaine.fr'

- Modifiez le fichier **/etc/hostname** et mettez-y `upsignonpro.votre-domaine.fr`

- Redémarrez la machine (`reboot`)

- Vérifiez que la commande `hostnamectl` renvoie bien `upsignonpro.votre-domaine.fr`

## Installation de Postfix

```
sudo apt update
sudo apt install postfix
```

La dernière commande affiche une invite de commande

- choisissez "Internet Site"
- puis saisissez `upsignonpro.votre-domaine.fr`

## Configurez Postfix pour l'envoi de mails uniquement

Modifiez le fichier **/etc/postfix/main.cf**:

- Donnez à myhostname la valeur `upsignonpro.votre-domaine.fr`
- Changez `mydestination = $myhostname, example.com, localhost.com, localhost` en `mydestination = $myhostname, localhost.<votre-domaine.fr>`
- Changez `inet-interfaces = all` en `inet-interfaces = loopback-only`
- Redémarrez Postfix `sudo systemctl restart postfix`

## Envoyez-vous un email de test

```
apt-get install mailutils
echo "Un email envoyé par Postfix" | mail -s "test Postfix" prenom.nom@votre-domaine.fr
```

N'oubliez de vérifier votre dossier spams.

Vous pouvez consulter les logs de Postfix dans **/var/log/mail.log**
Vous pouvez consulter les "mails" machine dans le dossier **/var/mail/**

## Configuration de DKIM

Cette configuration augmente la délivrabilité de vos emails et diminue les chances que les mails envoyés par vos serveurs soient considérés comme spam. Elle est donc fortement recommandée.

- Générez une clé RSA

```
su - upsignonpro
mkdir DKIM
cd DKIM
openssl genrsa -out private.key 1024
openssl rsa -in private.key -pubout -out public.key
```

## Configuration DNS

- Ajouter un enregistrement SPF pour améliorer la délivrabilité des emails. (Des enregistrements DKIM et DMARC seront également ajoutés à la fin de l'installation pour compléter cette configuration).
  - type: TXT
  - nom d'hôte: <upsignonpro.votre-domaine.fr>
  - valeur (en y mettant l'adresse IP de la machine): v=spf1 ip4:XXX.XXX.XXX.XXX -all

- Ajoutez l'enregistrement suivant dans votre configuration DNS
  - type: TXT
  - nom d'hôte: `uso1._domainkey.upsignonpro.votre-domaine.fr`
  - valeur: v=DKIM1;k=rsa;p=DKIM_PUBLIC_KEY

> DKIM_PUBLIC_KEY est le contenu du fichier public.key généré précédemment sans la première et la dernière ligne, et sans retour à la ligne.

NB: "uso1" est une valeur arbitraire qui permet de distinguer plusieurs enregistrement DKIM liés au même (sous-)domaine pour désigner des clés différentes.

- Ajoutez l'enregistrement DMARC suivant dans votre configuration DNS
  - type: TXT
  - nom d'hôte: `_dmarc.upsignonpro.votre-domaine.fr`
  - valeur: v=DMARC1; p=reject; aspf=s; adkim=s;

  Cet enregistrement permet de demander aux serveurs de mails destinataires de totalement refuser les emails pour lesquels la vérification SPF ou la vérification DKIM n'est pas valide, ce qui limite les risques de phishing via le domaine upsignonpro.votre-domaine.fr. Vous pouvez demander plutôt une mise en SPAM en utilisant la valeur `v=DMARC1; p=quarantine; aspf=s; adkim=s;` ou déléguer le choix du comportement à adopter au serveur destinataire en utilisant la valeur `v=DMARC1; p=none;`.

# 5 - Installation des services UpSignOn

## Préparation de l'environnement

En tant qu'utilisateur **upsignonpro**

```bash
root@localhost:~# su - upsignonpro

upsignonpro@localhost:~$ mkdir ~/.npm-global
upsignonpro@localhost:~$ npm config set prefix '~/.npm-global'
upsignonpro@localhost:~$ echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
upsignonpro@localhost:~$ source ~/.bashrc

upsignonpro@localhost:~$ npm install -g pm2
upsignonpro@localhost:~$ npm install -g yarn

upsignonpro@localhost:~$ pm2 install pm2-logrotate
```

Configurer votre proxy si besoin:

```bash
upsignonpro@localhost:~$ git config --global http.proxy http://username:password@host:port

upsignonpro@localhost:~$ git config --global http.sslVerify false

upsignonpro@localhost:~$ git config --global http.proxyAuthMethod 'basic'

upsignonpro@localhost:~$ npm config set proxy http://username:password@host:port

upsignonpro@localhost:~$ yarn config set proxy http://username:password@host:port
```

## Installation du serveur UpSignOn PRO et provisioning de la base de données

En tant qu'utilisateur upsignonpro

```bash
root@localhost:~# su - upsignonpro

upsignonpro@localhost:~$ cd

upsignonpro@localhost:~$ git clone --branch production https://github.com/rgsystemes/upsignon-pro-server.git upsignon-pro-server

upsignonpro@localhost:~$ cd upsignon-pro-server

upsignonpro@localhost:~/upsignon-pro-server$ cp dot-env-template .env
upsignonpro@localhost:~/upsignon-pro-server$ chmod o-rwx .env

upsignonpro@localhost:~/upsignon-pro-server$ openssl rand -hex 30 # ceci génère une chaîne de caractères aléatoires qui peut être copiée dans la variable SESSION_SECRET du fichier .env

```

Éditez ensuite le fichier `.env` pour y définir toutes vos variables d'environnement.

Puis créez lncez le script update.sh

```bash
upsignonpro@localhost:~/upsignon-pro-server$ ./update.sh
```

Vous pouvez vérifier que tout s'est bien passé en vous connectant à votre base de données (`psql upsignonpro`) puis en tapant `\d` pour afficher toutes les tables. Le résultat ne doit pas être vide. (Dans le cas d'une base de données distante, utilisez la commande `psql -h 127.0.0.1 -U upsignonpro -p 5432 upsignonpro`, en remplaçant l'IP par celle de votre base de données)

Si le service upsignon-pro-server s'affiche en statut "Errored", consultez les logs

- upsignon-pro-server/logs
- ~/.pm2/pm2.logs

ou via la commande `pm2 logs` qui affiche directement tous les logs dont pm2 est responsable

Vous pouvez vérifier que la page https://upsignonpro.votre-domaine.fr affiche bien un message de succès.

## Installation du serveur d'administration

En tant qu'utilisateur upsignonpro

```bash
upsignonpro@localhost:~$ cd

upsignonpro@localhost:~$ git clone --branch production https://github.com/rgsystemes/upsignon-pro-dashboard.git

upsignonpro@localhost:~$ cd upsignon-pro-dashboard
```

Vous pouvez voir qu'il y a deux dossiers dans ce projet.

### DOSSIER FRONT

```bash
upsignonpro@localhost:~/upsignon-pro-dashboard/front$ cp ./front/dot-env-template ./front/.env
upsignonpro@localhost:~/upsignon-pro-dashboard/front$ chmod o-rwx ./front/.env
```

Puis éditez le fichier ./front/.env et modifiez la variable PUBLIC_URL avec l'url de votre serveur d'administration, chemin compris.

```bash
upsignonpro@localhost:~/upsignon-pro-dashboard/$ nano ./front/.env
```

### DOSSIER BACK

```bash
upsignonpro@localhost:~/upsignon-pro-dashboard/$ cp ./back/dot-env-template ./back/.env
upsignonpro@localhost:~/upsignon-pro-dashboard/$ chmod o-rwx ./back/.env
upsignonpro@localhost:~/upsignon-pro-dashboard/$ openssl rand -hex 30
```

Cette dernière commande génère une chaîne de caractères aléatoires que vous devez copier dans la variable SESSION_SECRET du fichier ./back/.env

Définissez aussi les autres variables du fichier ./back/.env.

Puis lancez la commande update.sh (cette étape peut prendre plusieurs minutes)

```
upsignonpro@localhost:~/upsignon-pro-dashboard/$ ./update.sh
```

En ouvrant la page https://upsignonpro.votre-domaine.fr/admin/login.html dans votre navigateur, vous devriez voir la page de connexion.

## Configuration du redémarrage automatique des serveurs

Pour configurer le redémarrage automatique des processus pm2 au reboot de la VM, procédez ainsi :

### Serveur UpSignOn PRO

```bash
root@localhost:~# nano /etc/systemd/system/upsignonpro-server.service
```

Dans ce fichier, ajoutez ceci (pensez à bien adapter les chemins si besoin)

```
[Unit]
Description=UpSignOn PRO server
After=network.target remote-fs.target nss-lookup.target

[Service]
Type=forking
RemainAfterExit=1
ExecStart=/home/upsignonpro/.npm-global/bin/pm2 start /home/upsignonpro/upsignon-pro-server/ecosystem.config.js
ExecReload=/home/upsignonpro/.npm-global/bin/pm2 startOrGracefulReload /home/upsignonpro/upsignon-pro-server/ecosystem.config.js --update-env
ExecStop=/home/upsignonpro/.npm-global/bin/pm2 stop /home/upsignonpro/upsignon-pro-server/ecosystem.config.js
User=upsignonpro
WorkingDirectory=/home/upsignonpro/upsignon-pro-server

[Install]
WantedBy=multi-user.target
```

Puis modifiez les droits sur ce fichier et activez-le:

```bash
root@localhost:~# chmod 644 /etc/systemd/system/upsignonpro-server.service
root@localhost:~# systemctl enable upsignonpro-server.service
root@localhost:~# systemctl daemon-reload
```

### Serveur d'administration

```bash
root@localhost:~# nano /etc/systemd/system/upsignonpro-dashboard.service
```

Dans ce fichier, ajoutez ceci (pensez à bien adapter les chemins si besoin)

```
[Unit]
Description=UpSignOn PRO Dashboard server
After=network.target remote-fs.target nss-lookup.target postfix upsignonpro-server.service

[Service]
Type=forking
RemainAfterExit=1
ExecStart=/home/upsignonpro/.npm-global/bin/pm2 start /home/upsignonpro/upsignon-pro-dashboard/back/dashboard.config.js
ExecReload=/home/upsignonpro/.npm-global/bin/pm2 startOrGracefulReload /home/upsignonpro/upsignon-pro-dashboard/back/dashboard.config.js --update-env
ExecStop=/home/upsignonpro/.npm-global/bin/pm2 stop /home/upsignonpro/upsignon-pro-dashboard/back/dashboard.config.js
User=upsignonpro
WorkingDirectory=/home/upsignonpro/upsignon-pro-dashboard/back

[Install]
WantedBy=multi-user.target
```

Puis modifiez les droits sur ce fichier et activez-le:

```bash
root@localhost:~# chmod 644 /etc/systemd/system/upsignonpro-dashboard.service
root@localhost:~# systemctl enable upsignonpro-dashboard.service
root@localhost:~# systemctl daemon-reload
```

### Configuration des mises-à-jour automatiques des serveurs

Pour configurer les mises-à-jour automatiques des serveurs, procédez ainsi :

```bash
# Attention à bien configurer le cron de l'utilisateur upsignonpro et non le cron d'un autre utilisateur !
upsignonpro@localhost:~$ crontab -e
```

Puis ajoutez ces deux taches cron:

```
0 5 * * * /bin/bash -c "cd /home/upsignonpro/upsignon-pro-server && ./update.sh"
5 5 * * * /bin/bash -c "cd /home/upsignonpro/upsignon-pro-dashboard && ./update.sh"
```

Puis relancer le service cron

```bash
root@localhost:~# service cron reload
```

### Backup des bases de données

Nous avons préparé un script de sauvegarde tournante de la base de données. Pour l'utiliser, configurez les variables `DB_BACKUP_*` du fichier .env de upsignon-pro-server puis ajoutez le cron suivant pour l'utilisateur upsignonpro(`crontab -e`)

```
55 23  * * * /bin/bash -c "/home/upsignonpro/upsignon-pro-server/scripts/db-backup-rotated.sh"
```

N'oubliez pas de recharger le service cron

```
/etc/init.d/cron reload
```

Si vous souhaitez utilisez une autre méthode, vous pouvez vous inspirer de https://wiki.postgresql.org/wiki/Automated_Backup_on_Linux

Vous pouvez également faire un backup manuel de la base de données ainsi:

```
# backup
pg_dump -T admin_sessions -T device_sessions -T temporary_admins upsignonpro > dump.sql

# restore
psql -d dbname < dump.sql
```

# 6 - Dernières configurations

## Toute première connexion à la console d'administration

Une fois que tout ce qui précède est en place, et que nous avons autorisé vos urls dans notre système, vous pouvez accéder à votre interface d'administration. Pour cela, positionnez-vous dans le dossier back du serveur d'administration

```bash
root@localhost:~# su - upsignonpro
upsignonpro@localhost:~$ cd ~/upsignon-pro-dashboard/back
```

Puis exécutez la commande suivante

```bash
upsignonpro@localhost:~$ node ./scripts/addSuperAdmin.js
```

Cette commande génère un lien de connexion temporaire en tant que superadmin à votre console d'administration.

## Configuration de l'envoi de mails

Configurez l'envoi des mails dans la page paramètres superadmin si vous n'avez pas activé Postfix (ancienne version de la documentation).

Vérifier la bonne configuration de vos emails en utilisant l'outil de test en ligne gratuit mail-tester.com (attention, vous êtes limité à 3 tests par jour).

## Ajout d'une première banque de coffres-forts

Une fois connecté à votre interface superadmin,

- configurez l'url de votre serveur UpSignOn PRO. L'indicateur du statut doit passer au vert.
- ajoutez une banque
- en cliquant sur le block "Super-Admin" orange, tout en haut à gauche de la page, vous pourrez voir la liste de vos banques. Ouvrez la banque que vous venez de créer, puis naviguez vers la page "Paramètres" de cette banque.
- Vous voyez alors un lien de configuration. Ce lien devra être utilisé par tous vos utilisateurs pour configurer leur application.

## Création de votre coffre-fort UpSignOn PRO

- Ajoutez votre adresse email (ou \*@votre-domaine.fr) à la liste des adresses email autorisées pour cette banque
- installez l'application UpSignOn sur votre poste, puis cliquez sur le lien de configuration / scannez le qr code depuis UpSignOn en cliquant sur "ajouter un espace confidentiel" puis en sélectionnant l'option ESPACE PRO
- si tout est bien configuré, vous devriez pouvoir créer votre espace UpSignOn PRO dans l'application en suivant les instructions

## Configuration de la connexion à la console directement via UpSignOn

Le mot de passe que vous avez utilisé précédemment pour vous connecter était temporaire. Grâce à UpSignOn, vous allez pouvoir vous connecter très simplement à votre console d'administration.

- lorsque votre espace aura été correctement créé, revenez dans votre dashboard d'administration, dans la page super-admin, puis utilisez le formulaire d'ajout d'un administrateur pour ajouter votre adresse email (en vous laissant le rôle Super-Admin). Vous pouvez remettre une adresse email qui existe déjà dans la liste.
- vous devriez alors recevoir un email (vérifiez éventuellement vos spams) qui vous permettra d'importer votre "compte" super-admin dans UpSignOn
- ouvrez le lien que vous aurez reçu par mail puis suivez les instructions dans l'application
- grâce à UpSignOn, vous pouvez maintenant vous connecter en un clic à votre compte super-admin et renouveler votre mot de passe directement depuis l'application

Et voilà. Il ne vous reste plus qu'à configurer UpSignOn via votre dashboard selon vos besoins, à inviter d'autres administrateurs et à diffuser le lien de configuration à tous vos collègues.

# 7 -Remarques finales

## ATTENTION !!! Gardez l'accès root à vos machines !

Ne conservez pas votre mot de passe d'accès à vos machine hébergeant votre serveur UpSignOn PRO dans votre coffre-fort UpSignOn car en cas de problème sur votre serveur, vous ne pourrez plus accéder à votre coffre-fort et vous serez coincés.

Vous pouvez en revanche utiliser un coffre-fort Perso pour stocker certains mots de passe auxquels vous devez pouvoir accéder en mode offline (le coffre-fort perso stocke vos données de façon chiffrée directement sur votre appareil). L'option mode offline pour les coffres-forts PRO sera disponible dans quelques temps.

## Résolution de problèmes

Voir la page dédiée: [/doc/Troubleshooting.md](/doc/Troubleshooting.md).

<!-- ## Note sur les paramètres OpenId

Les paramètres de configuration d'OpenId Connect sont optionnels. S'ils sont présents, l'application exigera une pré-authentification sur le service OpenId Connect désigné avant d'envoyer des requêtes au serveur UpSignOn PRO. Vous pouvez ainsi placer le serveur UpSignOn PRO derrière un NetScaler qui pourra refuser toutes les requêtes envoyées sans token OpenId.

> Notez que le serveur UpSignOn PRO lui-même ne vérifie pas les tokens OpenId qui lui sont passés.

**Trouver votre lien OpenId Connect correspondant à votre installation ADFS, Azure AD ou Azure B2C:**

From the Microsoft documentation: (more details [here](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-client-application-configuration))

- AAD authorities are of the form https://login.microsoftonline.com/\{Enter_the_Tenant_Info_Here\}.
- If your application supports Accounts in one organizational directory, replace "Enter_the_Tenant_Info_Here" value with the Tenant Id or Tenant name (for example, contoso.microsoft.com).
- If your application supports Accounts in any organizational directory, replace "Enter_the_Tenant_Info_Here" value with organizations.
- If your application supports Accounts in any organizational directory and personal Microsoft accounts, replace "Enter_the_Tenant_Info_Here" value with common.
- To restrict support to Personal Microsoft accounts only, replace "Enter_the_Tenant_Info_Here" value with consumers.
- Azure B2C authorities are of the form https://\{instance\}/\{tenant\}/\{policy\}. Each policy is considered its own authority. You will have to set the all of the knownAuthorities at the time of the client application construction.
- ADFS authorities are of the form https://\{instance\}/adfs. -->
