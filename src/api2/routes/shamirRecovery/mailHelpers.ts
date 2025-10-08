import { getEmailConfig, getMailTransporter } from '../../../helpers/getMailTransporter';
import { logError } from '../../../helpers/logger';
import { inputSanitizer } from '../../../helpers/sanitizer';

export const sendRecoveryRequestUserAlert = async (
  userEmailAddress: string,
  bankName: string,
  deviceName: string,
  osFamily: string,
  osVersion: string,
  deviceType: string,
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeUserEmailAddress = inputSanitizer.cleanForHTMLInjections(userEmailAddress);
    const safeBankName = inputSanitizer.cleanForHTMLInjections(bankName);
    const safeDeviceName = inputSanitizer.cleanForHTMLInjections(deviceName);
    const safeOsFamily = inputSanitizer.cleanForHTMLInjections(osFamily);
    const safeOsVersion = inputSanitizer.cleanForHTMLInjections(osVersion);
    const safeDeviceType = inputSanitizer.cleanForHTMLInjections(deviceType);

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: safeUserEmailAddress,
      subject: 'ALERTE DE SÉCURITÉ UpSignOn !',
      text: `Bonjour,\n\nLa procédure de secours vient d'être activée pour déverrouiller votre coffre-fort UpSignOn PRO dans la banque ${safeBankName} !\n\n
      Si vous n'êtes pas à l'origine de cette demande, veuillez alerter immédiatement vos administrateurs.\n\n
      Cette demande a été générée à partir de l'appareil suivant :\n
      Nom de l'appareil : ${safeDeviceName}\n
      Type d'appareil : ${safeDeviceType}\n
      OS : ${safeOsFamily} - ${safeOsVersion}\n
      \n\nCordialement,\nL'équipe de Septeo IT Solutions`,
      html: `<body>
        <p>Bonjour,</p>
        <p>La procédure de secours vient d'être activée pour déverrouiller votre coffre-fort UpSignOn PRO dans la banque ${safeBankName} !</p>
        <p>Si vous n'êtes pas à l'origine de cette demande, veuillez alerter immédiatement vos administrateurs.</p>
        <p>Cette demande a été générée à partir de l'appareil suivant :</p>
        <ul>
          <li>Nom de l'appareil : ${safeDeviceName}</li>
          <li>Type d'appareil : ${safeDeviceType}</li>
          <li>OS : ${safeOsFamily} - ${safeOsVersion}\n</li>
        </ul>
        <p>Cordialement,<br/>L'équipe de Septeo IT Solutions</p>
        </body>`,
    });
  } catch (e) {
    logError('ERROR in sendRecoveryRequestUserAlert:', e);
  }
};

export const sendRecoveryRequestRecipientNotification = async (
  uniqueAdminEmails: string[],
  targetUserEmail: string,
  bankName: string,
  deviceName: string,
  osFamily: string,
  osVersion: string,
  deviceType: string,
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeUserEmailAddress = inputSanitizer.cleanForHTMLInjections(targetUserEmail);
    const safeBankName = inputSanitizer.cleanForHTMLInjections(bankName);

    const safeUniqueAdminEmails = uniqueAdminEmails.map((e) =>
      inputSanitizer.cleanForHTMLInjections(e),
    );

    const safeDeviceName = inputSanitizer.cleanForHTMLInjections(deviceName);
    const safeOsFamily = inputSanitizer.cleanForHTMLInjections(osFamily);
    const safeOsVersion = inputSanitizer.cleanForHTMLInjections(osVersion);
    const safeDeviceType = inputSanitizer.cleanForHTMLInjections(deviceType);

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: safeUniqueAdminEmails,
      subject: 'ALERTE DE SÉCURITÉ UpSignOn !',
      text: `Bonjour,\n\nLa procédure de secours vient d'être activée pour déverrouiller le coffre-fort UpSignOn PRO de l'utilisateur ${safeUserEmailAddress} dans la banque ${safeBankName} dont vous êtes co-guardien !\n\n
      Cette demande a été générée à partir de l'appareil suivant :\n
      Nom de l'appareil : ${safeDeviceName}\n
      Type d'appareil : ${safeDeviceType}\n
      OS : ${safeOsFamily} - ${safeOsVersion}\n
      \nN'oubliez pas de vérifier physiquement auprès de l'utlisateur la légitimité de cette demande avant de l'approuver.
      \n\nRendez-vous dans l'application pour donner votre accord au déverrouillage de ce coffre-fort.
      \n\nCordialement,\nL'équipe de Septeo IT Solutions`,
      html: `<body>
        <p>Bonjour,</p>
        <p>La procédure de secours vient d'être activée pour déverrouiller le coffre-fort UpSignOn PRO de l'utilisateur ${safeUserEmailAddress} dans la banque ${safeBankName} dont vous êtes co-guardien !</p>
        <p>Cette demande a été générée à partir de l'appareil suivant :</p>
        <ul>
          <li>Nom de l'appareil : ${safeDeviceName}</li>
          <li>Type d'appareil : ${safeDeviceType}</li>
          <li>OS : ${safeOsFamily} - ${safeOsVersion}\n</li>
        </ul>
        <br/>
        <p>N'oubliez pas de vérifier physiquement auprès de l'utlisateur la légitimité de cette demande avant de l'approuver.</p>
        <p>Rendez-vous dans l'application pour donner votre accord au déverrouillage de ce coffre-fort.</p>
        <br/>
        <p>Cordialement,<br/>L'équipe de Septeo IT Solutions</p>
        </body>`,
    });
  } catch (e) {
    logError('ERROR in sendRecoveryRequestAlert:', e);
  }
};

export const sendRecoveryRequestReadyUserAlert = async (
  userEmailAddress: string,
  deviceName: string,
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeUserEmailAddress = inputSanitizer.cleanForHTMLInjections(userEmailAddress);
    const safeDeviceName = inputSanitizer.cleanForHTMLInjections(deviceName);

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: safeUserEmailAddress,
      subject: 'Vous pouvez terminer la récupération de votre coffre-fort',
      text: `Bonjour,\n\nVous avez obtenu l'accord d'assez de gardiens pour terminer la récupération de votre coffre-fort sur l'appareil ${safeDeviceName}.
      \n\nCordialement,\nL'équipe de Septeo IT Solutions`,
      html: `<body>
        <p>Bonjour,</p>
        <p>Vous avez obtenu l'accord d'assez de gardiens pour terminer la récupération de votre coffre-fort sur l'appareil ${safeDeviceName}.</p>
        <p>Cordialement,<br/>L'équipe de Septeo IT Solutions</p>
        </body>`,
    });
  } catch (e) {
    logError('ERROR in sendRecoveryRequestCompletedUserAlert:', e);
  }
};
export const sendRecoveryRequestCompletedUserAlert = async (
  userEmailAddress: string,
  deviceName: string,
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeUserEmailAddress = inputSanitizer.cleanForHTMLInjections(userEmailAddress);
    const safeDeviceName = inputSanitizer.cleanForHTMLInjections(deviceName);

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: safeUserEmailAddress,
      subject: 'Votre coffre-fort UpSignOn a été déverrouillé !',
      text: `Bonjour,\n\nVotre coffre-fort a été deverrouillé avec succès depuis l'appareil ${safeDeviceName} suite à l'utilisation de la procédure de secours.
      \n\nCordialement,\nL'équipe de Septeo IT Solutions`,
      html: `<body>
        <p>Bonjour,</p>
        <p>Votre coffre-fort a été deverrouillé avec succès depuis l'appareil ${safeDeviceName} suite à l'utilisation de la procédure de secours.</p>
        <p>Cordialement,<br/>L'équipe de Septeo IT Solutions</p>
        </body>`,
    });
  } catch (e) {
    logError('ERROR in sendRecoveryRequestCompletedUserAlert:', e);
  }
};

export const sendRecoveryRequestAbortedUserAlert = async (
  userEmailAddress: string,
  deviceName: string,
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeUserEmailAddress = inputSanitizer.cleanForHTMLInjections(userEmailAddress);
    const safeDeviceName = inputSanitizer.cleanForHTMLInjections(deviceName);

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: safeUserEmailAddress,
      subject: 'Procédure de secours avortée',
      text: `Bonjour,\n\nLa procédure de secours visant à deverrouiller votre coffre-fort, initiée depuis l'appareil ${safeDeviceName}, a été avortée.
      \n\nCordialement,\nL'équipe de Septeo IT Solutions`,
      html: `<body>
        <p>Bonjour,</p>
        <p>La procédure de secours visant à deverrouiller votre coffre-fort, initiée depuis l'appareil ${safeDeviceName}, a été avortée.</p>
        <p>Cordialement,<br/>L'équipe de Septeo IT Solutions</p>
        </body>`,
    });
  } catch (e) {
    logError('ERROR in sendRecoveryRequestCompletedUserAlert:', e);
  }
};
