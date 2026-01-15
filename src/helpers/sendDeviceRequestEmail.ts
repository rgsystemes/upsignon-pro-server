import { getAdminEmailsForBank } from './getAdminsEmailsForBank';
import { getEmailConfig, getMailTransporter } from './getMailTransporter';
import { logError } from './logger';
import { inputSanitizer } from './sanitizer';
import { buildEmail } from 'upsignon-mail';

export const sendDeviceRequestEmail = async (
  emailAddress: string,
  deviceName: null | string,
  deviceType: null | string,
  osNameAndVersion: null | string,
  requestToken: string,
  expirationDate: Date,
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });
    const expDate = expirationDate.toLocaleDateString('fr');
    const expTime = expirationDate.toLocaleTimeString().split(':').slice(0, 2).join(':');

    // prevent HTML injections
    const safeEmailAddress = inputSanitizer.cleanForHTMLInjections(emailAddress);
    const safeDeviceName = inputSanitizer.cleanForHTMLInjections(deviceName || '');
    const safeDeviceType = inputSanitizer.cleanForHTMLInjections(deviceType || '');
    const safeOSNameAndVersion = inputSanitizer.cleanForHTMLInjections(osNameAndVersion || '');
    const safeRequestToken = inputSanitizer.cleanForHTMLInjections(requestToken);

    const { html, text, subject } = await buildEmail({
      templateName: 'newDevice',
      locales: 'fr',
      args: {
        deviceName: safeDeviceName,
        availableCodeDate: `${expDate} ${expTime}`,
        code: safeRequestToken,
        deviceType: safeDeviceType,
        deviceOSAndVersion: safeOSNameAndVersion,
      },
    });

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: safeEmailAddress,
      subject: subject,
      text: text,
      html: html,
    });
  } catch (e) {
    logError('ERROR sending email:', e);
  }
};

export const sendDeviceRequestAdminEmail = async (
  userEmailAddress: string,
  bankId: number,
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    const adminEmails = await getAdminEmailsForBank(bankId);
    if (adminEmails.length === 0) return;

    // prevent HTML injections
    const safeUserEmailAddress = inputSanitizer.cleanForHTMLInjections(userEmailAddress);

    const { html, text, subject } = await buildEmail({
      templateName: 'newDeviceAdminApproval',
      locales: 'fr',
      args: {
        emailUser: safeUserEmailAddress,
      },
    });

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: adminEmails,
      subject: subject,
      text: text,
      html: html,
    });
  } catch (e) {
    logError('ERROR sending email:', e);
  }
};
