# Migrating to SaaS

1. SaaS server side

- Connect to the SaaS pro dashboard
- Create a reseller
- Copy the reseller id (see the url on the reseller's admin page)

2. On-premise server side

- Connect to the on-premise server
- Stop all processes `pm2 stop all`
- Run `node upsignon-pro-server/scripts/exportAllBanks.js`

3. Move the upsignon-pro-server/scripts/tmp_exports folder to the SaaS server. For example

- `cp upsignonpro@upsignonpro.onprem.com:~/upsignon-pro-server/scripts/tmp_exports pro@pro.upsignon.eu:~/onpremData`
- or using a zip file for mail transfer
  `zip -e onprem.zip upsignon-pro-server/scripts/tmp_exports`
  then on SaaS server
  `unzip onprem.zip`

4. SaaS server side

- run `node upsignon-pro-server/scripts/importAllBanks.js onprem <resellerId>`

5. On-premise server side

- `pm2 start all` to allow all redirections
- `psql upsignonpro`
  - `select JSON_AGG(name), email from admins left join admin_banks as ab on ab.admin_id=admins.id left join banks as b on ab.bank_id=b.id group by email order by email asc;`
  - copy the result to an md file in vscode, then ask copilot to format the table correctly
  - now copy the table to an email that you send to all on-premise superadmins (see model below).

6. Clean up temporary folders and zips to avoid any leak

# Email model

```
Bonjour <XX>,

Suite à la migration de votre serveur, l'accès à la console d'administration doit être recréé dans vos coffres-forts pour tous les admins.

Pour l'instant, vous continuez à accéder à l'ancienne console via votre accès précédent.

Vous n'aurez plus jamais besoin d'accéder à ce dashboard (et au pire il reste la possibilité de passer par le serveur).

Vous avez <N> administrateurs actuellement:

<tableau>

Voici la procédure à suivre

1. Autorisez les emails envoyés par upsignon@rgsystem.com si vous avez un filtre anti-spam
2. Chaque admin supprime son accès à l'ancienne console depuis son coffre-fort.
3. En parallèle, je vais vous inviter sur la nouvelle console. Suivez les instructions du mail pour importer votre accès dans votre coffre-fort.
4. Communiquez auprès des administrateurs de banque pour qu'ils suppriment leur ancien accès
5. Réinvitez-les un par un (leur adresse email est déjà renseignée dans la console, vous n'aurez plus qu'à cliquer sur "renvoyer un email d'invitation") et invitez-les à suivre les instructions du mail qu'ils recevront. (NB, pour les admins associés à plusieurs banques, une seule invitation suffit)

Si besoin, n'hésitez pas à m'appeler.

Bonne journée,
```
