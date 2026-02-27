import { buildEmail, getBestLanguage } from 'upsignon-mail';
import { getEmailConfig, getMailTransporter } from '../../helpers/getMailTransporter';
import { logError } from '../../helpers/logger';
import { inputSanitizer } from '../../helpers/sanitizer';

type TShamirRecoveryRequestAwaitingApproval = {
  trustedPersonEmails: string[];
  bankName: string;
  vaultEmail: string;
  expiryDate: Date;
  requestDate: Date;
  deviceName: string;
  deviceType: string;
  supportEmail: string;
  acceptLanguage: string;
};
export const sendShamirRecoveryRequestAwaitingApproval = async ({
  trustedPersonEmails,
  bankName,
  vaultEmail,
  expiryDate,
  requestDate,
  deviceName,
  deviceType,
  supportEmail,
  acceptLanguage,
}: TShamirRecoveryRequestAwaitingApproval): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeBankName = inputSanitizer.cleanForHTMLInjections(bankName);
    const safeVaultEmail = inputSanitizer.cleanForHTMLInjections(vaultEmail);
    const safeDeviceName = inputSanitizer.cleanForHTMLInjections(deviceName);
    const safeDeviceType = inputSanitizer.cleanForHTMLInjections(deviceType);
    const safeTrustedPersonEmails = trustedPersonEmails.map(inputSanitizer.cleanForHTMLInjections);
    const safeSupportEmail = inputSanitizer.cleanForHTMLInjections(supportEmail);

    const { html, text, subject } = await buildEmail({
      templateName: 'recoveryRequestAwaitingApproval',
      locales: getBestLanguage(acceptLanguage),
      args: {
        // bankName: safeBankName,
        vaultEmail: safeVaultEmail,
        expiryDate,
        requestDate,
        deviceName: safeDeviceName,
        deviceType: safeDeviceType,
      },
    });

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: safeTrustedPersonEmails,
      replyTo: safeSupportEmail,
      subject: subject,
      text: text,
      html: html,
    });
  } catch (e) {
    logError('sendShamirRecoveryRequestAwaitingApproval error:', e);
  }
};
