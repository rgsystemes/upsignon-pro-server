import { getEmailConfig, getMailTransporter } from '../helpers/getMailTransporter';
import { logError } from '../helpers/logger';
import { inputSanitizer } from '../helpers/sanitizer';
import { buildEmail, getBestLanguage } from 'upsignon-mail';

export const sendPasswordResetRequestEmail = async (
  emailAddress: string,
  deviceName: string,
  requestToken: string,
  expirationDate: string,
  acceptLanguage: string,
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeEmailAddress = inputSanitizer.cleanForHTMLInjections(emailAddress);
    const safeDeviceName = inputSanitizer.cleanForHTMLInjections(deviceName);
    const safeRequestToken = inputSanitizer.cleanForHTMLInjections(requestToken);

    const { html, text, subject } = await buildEmail({
      templateName: 'resetPassword',
      locales: getBestLanguage(acceptLanguage),
      args: {
        deviceName: safeDeviceName,
        code: safeRequestToken,
        expirationDate: expirationDate,
      },
    });

    transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: safeEmailAddress,
      subject: subject,
      text: text,
      html: html,
    });
  } catch (e) {
    logError('ERROR sending password reset email:', e);
  }
};
