import { isStrictlyLowerVersion } from './appVersionChecker';
import { getNext8am, isMondayWednesdayFriday } from './dateHelper';
import { db } from './db';
import { getEmailConfig, getMailTransporter } from './getMailTransporter';
import { logError } from './logger';
import { inputSanitizer } from './sanitizer';

const minVersionForNotification = '7.11.0';
const endOfSupportDate = '11 mars 2025';
const isActive = false;

export const sendMailForDeviceUpdate = async (): Promise<void> => {
  if (!isActive) return;

  // call perform sync every two days at 8am
  setTimeout(() => {
    sendMailForDeviceUpdateTask();
    setInterval(sendMailForDeviceUpdateTask, 24 * 3600 * 1000);
  }, getNext8am().getTime() - Date.now());
};

const sendMailForDeviceUpdateTask = async (): Promise<void> => {
  try {
    if (!isMondayWednesdayFriday()) {
      return;
    }
    const emailsRes = await db.query(
      "SELECT u.email, d.device_name, d.os_family, d.install_type, d.app_version FROM users AS u RIGHT JOIN user_devices AS d ON d.user_id=u.id WHERE d.authorization_status = 'AUTHORIZED'",
    );
    if (emailsRes == null) return;
    const devicesByEmail: {
      [email: string]: {
        device_name: string;
        os_family: string;
        install_type: string;
        app_version: string;
      }[];
    } = {};
    for (var i = 0; i < emailsRes.rows.length; i++) {
      const d = emailsRes.rows[i];
      if (isStrictlyLowerVersion(d.app_version, minVersionForNotification)) {
        if (!devicesByEmail[d.email]) {
          devicesByEmail[d.email] = [];
        }
        devicesByEmail[d.email].push(d);
      }
    }

    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });
    const allEmails = Object.keys(devicesByEmail);
    for (var i = 0; i < allEmails.length; i++) {
      const email = allEmails[i];

      const outdatedDevices: {
        device_name: string;
        os_family: string;
        install_type: string;
        app_version: string;
      }[] = devicesByEmail[email];
      const safeOutdatedDevices = outdatedDevices.map((d) => {
        return {
          name: inputSanitizer.cleanForHTMLInjections(d.device_name || ''),
          os_family: inputSanitizer.cleanForHTMLInjections(d.os_family || ''),
          install_type: inputSanitizer.cleanForHTMLInjections(d.install_type || ''),
          v: inputSanitizer.cleanForHTMLInjections(d.app_version || ''),
        };
      });
      const safeEmailAddress = inputSanitizer.cleanForHTMLInjections(email);

      let textVersion = `
Mise-à-jour UpSignOn obligatoire
=================================


Bonjour,

\n\n

Afin de vous offrir la meilleur expérience possible d'UpSignOn, nous lançons une campagne de mise-à-jour obligatoire. Tous les appareils doivent passer en version ${minVersionForNotification} avant le ${endOfSupportDate}. Vous recevrez ce message de rappel tous les deux jours jusqu'à ce que tous vos appareils soient à jour.

\n\n

Votre application UpSignOn n'est peut-êre pas à jour sur les appareils suivants :
`;
      for (var d of safeOutdatedDevices) {
        if (d.os_family === 'macos') {
          textVersion += `\n\n

**${d.name}**
-----------------------


- Ouvrez l'application UpSignOn sur votre Mac\n
- Vérifiez le numéro de version en bas de la fenêre.\n
- Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.\n
- Sinon, ouvrez le lien suivant sur votre Mac pour installer la mise-à-jour : [https://apps.apple.com/us/app/upsignon/id1474805603?l=fr](https://apps.apple.com/us/app/upsignon/id1474805603?l=fr)\n
`;
        } else if (d.os_family === 'ios') {
          textVersion += `\n\n

**${d.name}**
-------------------


- Ouvrez l'application UpSignOn sur votre iPhone/iPad\n
- Vérifiez le numéro de version en bas de l'écran.\n
- Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.\n
- Sinon, ouvrez le lien suivant sur votre iPhone/iPad pour installer la mise-à-jour : [https://apps.apple.com/us/app/upsignon/id1474805603?l=fr](https://apps.apple.com/us/app/upsignon/id1474805603?l=fr)\n
`;
        } else if (d.os_family.startsWith('android')) {
          textVersion += `\n\n

**${d.name}**
---------


- Ouvrez l'application UpSignOn sur votre Android\n
- Vérifiez le numéro de version en bas de l'écran.\n
- Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.\n
- Sinon, ouvrez le lien suivant sur votre Android pour installer la mise-à-jour : [https://play.google.com/store/apps/details?id=eu.upsignon&hl=fr&gl=US](https://play.google.com/store/apps/details?id=eu.upsignon&hl=fr&gl=US)\n
`;
        } else if (d.os_family === 'windows' && d.install_type === 'store') {
          textVersion += `\n\n

**${d.name}**
---------------


- Ouvrez l'application UpSignOn sur votre PC\n
- Vérifiez le numéro de version en bas de la fenêtre.\n
- Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.\n
- Sinon, ouvrez le lien suivant sur votre PC pour installer la mise-à-jour : [https://www.microsoft.com/fr-fr/p/upsignon/9n811tstg52w](https://www.microsoft.com/fr-fr/p/upsignon/9n811tstg52w)\n
`;
        } else if (d.os_family === 'windows' && d.install_type === 'msi') {
          textVersion += `\n\n

**${d.name}**
-------------------


- Ouvrez l'application "UpSignOn (msi)" sur votre PC\n
- Vérifiez le numéro de version en bas de la fenêtre.\n
- Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.\n
- Sinon, cliquez sur le lien suivant pour télécharger la dernière version : [https://app.upsignon.eu/downloads/UpSignOn-latest-installer.msi](https://app.upsignon.eu/downloads/UpSignOn-latest-installer.msi)\n
- Enregistrez ce fichier dans votre dossier Téléchargements, puis lancez-le et laissez-vous guider par le système de mise-à-jour.\n
`;
        } else if (d.os_family === 'linux') {
          textVersion += `\n\n

**${d.name}**
---------


- L'installation d'UpSignOn via AppImage est dépréciée sur Linux.\n
- Désormais, l'application est livrée via snapcraft :
- Installez snapd (cf instructions spécifiques à votre OS sur [https://snapcraft.io/upsignon](https://snapcraft.io/upsignon))\n
- Installez le snap upsignon : \`sudo snap install upsignon\`\n
`;
        } else {
          textVersion += `\n\n

**${d.name}**
---------

- Ouvrez l'application UpSignOn sur votre PC.\n
- Vérifiez le numéro de version en bas de la fenêtre.\n
- Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.\n
- Sinon, contactez-nous pour mettre à jour UpSignOn sur cet appareil car le type de cette installation nous est inconnu.\n
`;
        }
      }
      textVersion += `
\n\n

\n\n

**Si vous n'utilisez plus l'un de ces appareils, vous pouvez le supprimer depuis l'onglet "Appareils synchronisés" de votre coffre-fort afin de ne plus recevoir ce message.**

\n\n

\n\n

**Besoin d'aide ?**
===================

N'hésitez pas à m'appeler directement au 06 70 74 32 99 ou à écrire à contact@upsignon.eu.

\n\n

Bonne journée,

Gireg de Kerdanet

UPSIGNON`;

      let htmlVersion = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Campagne de mise-à-jour UpSignOn</title>
  <style type="text/css" emogrify="no">
    #outlook a {
      padding: 0;
    }

    .ExternalClass {
      width: 100%;
    }

    .ExternalClass,
    .ExternalClass p,
    .ExternalClass span,
    .ExternalClass font,
    .ExternalClass td,
    .ExternalClass div {
      line-height: 100%;
    }

    table td {
      border-collapse: collapse;
      mso-line-height-rule: exactly;
    }

    .editable.image {
      font-size: 0 !important;
      line-height: 0 !important;
    }

    .nl2go_preheader {
      display: none !important;
      mso-hide: all !important;
      mso-line-height-rule: exactly;
      visibility: hidden !important;
      line-height: 0px !important;
      font-size: 0px !important;
    }

    body {
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      margin: 0;
      padding: 0;
    }

    img {
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }

    a img {
      border: none;
    }

    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }

    th {
      font-weight: normal;
      text-align: left;
    }

    *[class="gmail-fix"] {
      display: none !important;
    }
  </style>
  <style type="text/css" emogrify="no">
    @media (max-width: 600px) {
      .gmx-killpill {
        content: ' \x03D1';
      }
    }
  </style>
  <style type="text/css" emogrify="no">
    @media (max-width: 600px) {
      .gmx-killpill {
        content: ' \x03D1';
      }

      .r0-o {
        border-style: solid !important;
        margin: 0 auto 0 auto !important;
        width: 320px !important
      }

      .r1-i {
        background-color: #ffffff !important
      }

      .r2-c {
        box-sizing: border-box !important;
        text-align: center !important;
        valign: top !important;
        width: 100% !important
      }

      .r3-o {
        border-style: solid !important;
        margin: 0 auto 0 auto !important;
        width: 100% !important
      }

      .r4-i {
        padding-bottom: 20px !important;
        padding-left: 10px !important;
        padding-right: 10px !important;
        padding-top: 20px !important
      }

      .r5-c {
        box-sizing: border-box !important;
        display: block !important;
        valign: top !important;
        width: 100% !important
      }

      .r6-o {
        border-style: solid !important;
        width: 100% !important
      }

      .r7-o {
        border-style: solid !important;
        margin: 0 auto 0 0 !important;
        width: 100% !important
      }

      .r8-i {
        padding-top: 15px !important;
        text-align: left !important
      }

      .r9-i {
        background-color: #eff2f7 !important;
        padding-bottom: 20px !important;
        padding-left: 15px !important;
        padding-right: 15px !important;
        padding-top: 20px !important
      }

      .r10-i {
        padding-left: 0px !important;
        padding-right: 0px !important
      }

      .r11-c {
        box-sizing: border-box !important;
        text-align: left !important;
        valign: top !important;
        width: 100% !important
      }

      .r12-i {
        color: #3b3f44 !important;
        padding-bottom: 0px !important;
        padding-top: 15px !important;
        text-align: center !important
      }

      .r13-i {
        color: #3b3f44 !important;
        padding-bottom: 0px !important;
        padding-top: 0px !important;
        text-align: center !important
      }

      .r14-i {
        color: #3b3f44 !important;
        padding-bottom: 15px !important;
        padding-top: 15px !important;
        text-align: center !important
      }

      .r15-c {
        box-sizing: border-box !important;
        text-align: center !important;
        width: 100% !important
      }

      .r16-i {
        padding-bottom: 15px !important;
        padding-left: 0px !important;
        padding-right: 0px !important;
        padding-top: 0px !important
      }

      .r17-c {
        box-sizing: border-box !important;
        text-align: center !important;
        valign: top !important;
        width: 129px !important
      }

      .r18-o {
        border-style: solid !important;
        margin: 0 auto 0 auto !important;
        width: 129px !important
      }

      body {
        -webkit-text-size-adjust: none
      }

      .nl2go-responsive-hide {
        display: none
      }

      .nl2go-body-table {
        min-width: unset !important
      }

      .mobshow {
        height: auto !important;
        overflow: visible !important;
        max-height: unset !important;
        visibility: visible !important
      }

      .resp-table {
        display: inline-table !important
      }

      .magic-resp {
        display: table-cell !important
      }
    }
  </style>
  <style type="text/css">
    p,
    h1,
    h2,
    h3,
    h4,
    ol,
    ul,
    li {
      margin: 0;
    }

    .nl2go-default-textstyle {
      color: #3b3f44;
      font-family: Arial;
      font-size: 16px;
      line-height: 1.5;
      word-break: break-word
    }

    .default-button {
      color: #ffffff;
      font-family: arial, helvetica, sans-serif;
      font-size: 16px;
      font-style: normal;
      font-weight: bold;
      line-height: 1.15;
      text-decoration: none;
      word-break: break-word
    }

    a,
    a:link {
      color: #2c5384;
      text-decoration: underline
    }

    .default-heading0 {
      color: #3b3f44;
      font-family: Arial;
      font-size: 16px;
      word-break: break-word
    }

    .default-heading1 {
      color: #1F2D3D;
      font-family: Arial;
      font-size: 36px;
      word-break: break-word
    }

    .default-heading2 {
      color: #1F2D3D;
      font-family: Arial;
      font-size: 32px;
      word-break: break-word
    }

    .default-heading3 {
      color: #1F2D3D;
      font-family: Arial;
      font-size: 24px;
      word-break: break-word
    }

    .default-heading4 {
      color: #1F2D3D;
      font-family: Arial;
      font-size: 18px;
      word-break: break-word
    }

    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: inherit !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }

    .no-show-for-you {
      border: none;
      display: none;
      float: none;
      font-size: 0;
      height: 0;
      line-height: 0;
      max-height: 0;
      mso-hide: all;
      overflow: hidden;
      table-layout: fixed;
      visibility: hidden;
      width: 0;
    }
  </style><!--[if mso]><xml> <o:OfficeDocumentSettings> <o:AllowPNG/> <o:PixelsPerInch>96</o:PixelsPerInch> </o:OfficeDocumentSettings> </xml><![endif]-->
  <style type="text/css">
    a:link {
      color: #2c5384;
      text-decoration: underline;
    }
  </style>
</head>

<body bgcolor="#ffffff" text="#3b3f44" link="#2c5384" yahoo="fix" style="background-color: #ffffff;">
  <table cellpadding="0" border="0" cellspacing="0" style=" mso-hide: all; display: none;">
    <tbody>
      <tr>
        <td>IMPORTANT ! mise-à-jour UpSignOn obligatoire</td>
      </tr>
    </tbody>
  </table>
  <table cellspacing="0" cellpadding="0" border="0" role="presentation" class="nl2go-body-table" width="100%" style="background-color: #ffffff; width: 100%;">
    <tbody>
      <tr>
        <td>
          <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="600" align="center" class="r0-o" style="table-layout: fixed; width: 600px;">
            <tbody>
              <tr>
                <td valign="top" class="r1-i" style="background-color: #ffffff;">
                  <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="center" class="r3-o" style="table-layout: fixed; width: 100%;">
                    <tbody>
                      <tr>
                        <td class="r4-i" style="padding-bottom: 20px; padding-top: 20px;">
                          <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation">
                            <tbody>
                              <tr>
                                <th width="100%" valign="top" class="r5-c" style="font-weight: normal;">
                                  <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="58" align="center" class="r3-o" style="table-layout: fixed; width: 58px;">
                                    <tbody>
                                      <tr>
                                        <td style="font-size: 0px; line-height: 0px;"> <img src="https://upsignon.eu/_next/static/media/logo-round.06c97b20.svg" width="58" border="0" style="display: block; width: 100%;"></td>
                                      </tr>
                                    </tbody>
                                  </table>
                                  <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="left" class="r7-o" style="table-layout: fixed; width: 100%;">
                                    <tbody>
                                      <tr>
                                        <td align="left" valign="top" class="r8-i nl2go-default-textstyle" style="color: #3b3f44; font-family: Arial; font-size: 16px; line-height: 1.5; word-break: break-word; padding-top: 15px; text-align: left;">
                                          <div>
                                            <h1 class="default-heading1" style="margin: 0; color: #1f2d3d; font-family: Arial; font-size: 36px; word-break: break-word;">Mise-à-jour UpSignOn obligatoire</h1>
                                          </div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                  <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="left" class="r7-o" style="table-layout: fixed; width: 100%;">
                                    <tbody>
                                      <tr>
                                        <td align="left" valign="top" class="r8-i nl2go-default-textstyle" style="color: #3b3f44; font-family: Arial; font-size: 16px; line-height: 1.5; word-break: break-word; padding-top: 15px; text-align: left; word-wrap: break-word;">
                                          <div>
                                            <p style="margin: 0;">Bonjour,</p>
                                            <p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;">Afin de vous offrir la meilleur expérience possible d'UpSignOn, nous lançons une campagne de mise-à-jour obligatoire. Tous les appareils doivent passer en version ${minVersionForNotification} avant le ${endOfSupportDate}. Vous recevrez ce message de rappel tous les deux jours jusqu'à ce que tous vos appareils soient à jour.</p>
                                            <p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;">Votre application UpSignOn n'est peut-êre pas à jour sur les appareils suivants :</p>
                                            `;
      for (var d of safeOutdatedDevices) {
        if (d.os_family === 'macos') {
          htmlVersion += `<p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;"><span style="font-size: 20px;"><strong>${d.name}</strong></span></p>
                                            <ul style="margin: 0;">
                                              <li style="margin: 0;">Ouvrez l'application UpSignOn sur votre Mac.</li>
                                              <li style="margin: 0;">Vérifiez le numéro de version en bas de la fenêre.</li>
                                              <li style="margin: 0;">Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.</li>
                                              <li style="margin: 0;">Sinon, ouvrez le lien suivant sur votre Mac pour installer la mise-à-jour : <a href="https://apps.apple.com/us/app/upsignon/id1474805603?l=fr" style="color: #2c5384; text-decoration: underline;">https://apps.apple.com/us/app/upsignon/id1474805603?l=fr</a></li>
                                            </ul>
    `;
        } else if (d.os_family === 'ios') {
          htmlVersion += `<p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;"><span style="font-size: 20px;"><strong>${d.name}</strong></span></p>
                                            <ul style="margin: 0;">
                                              <li style="margin: 0;">Ouvrez l'application UpSignOn sur votre iPhone/iPad.</li>
                                              <li style="margin: 0;">Vérifiez le numéro de version en bas de l'écran.</li>
                                              <li style="margin: 0;">Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.</li>
                                              <li style="margin: 0;">Sinon, ouvrez le lien suivant sur votre iPhone/iPad pour installer la mise-à-jour : <a href="https://apps.apple.com/us/app/upsignon/id1474805603?l=fr" style="color: #2c5384; text-decoration: underline;">https://apps.apple.com/us/app/upsignon/id1474805603?l=fr</a></li>
                                            </ul>`;
        } else if (d.os_family === 'android') {
          htmlVersion += `<p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;"><span style="font-size: 20px;"><strong>${d.name}</strong></span></p>
                                            <ul style="margin: 0;">
                                              <li style="margin: 0;">Ouvrez l'application UpSignOn sur votre Android.</li>
                                              <li style="margin: 0;">Vérifiez le numéro de version en bas de l'écran.</li>
                                              <li style="margin: 0;">Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.</li>
                                              <li style="margin: 0;">Sinon, ouvrez le lien suivant sur votre Android pour installer la mise-à-jour : <a href="https://play.google.com/store/apps/details?id=eu.upsignon&amp;hl=fr&amp;gl=US" style="color: #2c5384; text-decoration: underline;">https://play.google.com/store/apps/details?id=eu.upsignon&amp;hl=fr&amp;gl=US</a></li>
                                            </ul>`;
        } else if (d.os_family === 'windows' && d.install_type === 'store') {
          htmlVersion += `<p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;"><span style="font-size: 20px;"><strong>${d.name}</strong></span></p>
                                            <ul style="margin: 0;">
                                              <li style="margin: 0;">Ouvrez l'application UpSignOn sur votre PC.</li>
                                              <li style="margin: 0;">Vérifiez le numéro de version en bas de la fenêtre.</li>
                                              <li style="margin: 0;">Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.</li>
                                              <li style="margin: 0;">Sinon, ouvrez le lien suivant sur votre PC pour installer la mise-à-jour : <a href="https://www.microsoft.com/fr-fr/p/upsignon/9n811tstg52w" style="color: #2c5384; text-decoration: underline;">https://www.microsoft.com/fr-fr/p/upsignon/9n811tstg52w</a></li>
                                            </ul>`;
        } else if (d.os_family === 'windows' && d.install_type === 'msi') {
          htmlVersion += `<p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;"><span style="font-size: 20px;"><strong>${d.name}</strong></span></p>
                                            <ul style="margin: 0;">
                                              <li style="margin: 0;">Ouvrez l'application "UpSignOn (msi)" sur votre PC</li>
                                              <li style="margin: 0;">Vérifiez le numéro de version en bas de la fenêtre.</li>
                                              <li style="margin: 0;">Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.</li>
                                              <li style="margin: 0;">Sinon, cliquez sur le lien suivant pour télécharger la dernière version : <a download href="https://app.upsignon.eu/downloads/UpSignOn-latest-installer.msi" style="color: #2c5384; text-decoration: underline;">https://app.upsignon.eu/downloads/UpSignOn-latest-installer.msi</a></li>
                                              <li style="margin: 0;">Enregistrez ce fichier dans votre dossier Téléchargements, puis lancez-le et laissez-vous guider par le système de mise-à-jour.</li>
                                            </ul>`;
        } else if (d.os_family === 'linux') {
          htmlVersion += `<p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;"><span style="font-size: 20px;"><strong>${d.name}</strong></span></p>
                                            <ul style="margin: 0;">
                                              <li style="margin: 0;">L'installation d'UpSignOn via AppImage est dépréciée sur Linux.</li>
                                              <li style="margin: 0;">Désormais, l'application est livrée via snapcraft :<ul style="margin: 0;">
                                                  <li style="margin: 0;">Installez snapd (cf instructions spécifiques à votre OS sur <a href="https://snapcraft.io/upsignon" target="_blank" style="color: #2c5384; text-decoration: underline;">https://snapcraft.io/upsignon</a>)</li>
                                                  <li style="margin: 0;">Installez le snap upsignon : \`sudo snap install upsignon\`</li>
                                                </ul>
                                              </li>
                                            </ul>`;
        } else {
          htmlVersion += `<p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;"><span style="font-size: 20px;"><strong>${d.name}</strong></span></p>
                                            <ul style="margin: 0;">
                                              <li style="margin: 0;">Ouvrez l'application UpSignOn sur votre PC</li>
                                              <li style="margin: 0;">Vérifiez le numéro de version en bas de la fenêtre.</li>
                                              <li style="margin: 0;">Il se peut que le numéro de version soit déjà ${minVersionForNotification}. Dans ce cas, vous n'avez rien de plus à faire.</li>
                                              <li style="margin: 0;">Sinon, Sinon, contactez-nous pour mettre à jour UpSignOn sur cet appareil car le type de cette installation nous est inconnu.</li>
                                            </ul>`;
        }
      }
      htmlVersion += `<p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;"><span style="color: #b00020;"><strong>Si vous n'utilisez plus l'un de ces appareils, vous pouvez le supprimer depuis l'onglet "Appareils synchronisés" de votre coffre-fort afin de ne plus recevoir ce message.</strong></span></p>
                                            <p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;"><span style="font-size: 32px;"><strong>Besoin d'aide ?</strong></span></p>
                                            <p style="margin: 0;">N'hésitez pas à m'appeler directement au 06 70 74 32 99 ou à écrire à contact@upsignon.eu.</p>
                                            <p style="margin: 0;">&nbsp;</p>
                                            <p style="margin: 0;">Bonne journée,</p>
                                            <p style="margin: 0;">Gireg de Kerdanet</p>
                                            <p style="margin: 0;">UPSIGNON</p>
                                            <p style="margin: 0;">&nbsp;</p>
                                          </div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </th>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>

</html>
`;

      await transporter.sendMail({
        from: `"UpSignOn" <${emailConfig.EMAIL_SENDING_ADDRESS}>`,
        to: safeEmailAddress,
        replyTo: 'contact@upsignon.eu',
        subject: 'Application UpSignOn obsolète',
        text: textVersion,
        html: htmlVersion,
      });
    }
  } catch (e: any) {
    // if there is an error, we stop everything since the results are no longer guaranted
    logError('sendMailForDeviceUpdateTask', e);
  }
};
