import { buildEmail, getBestLanguage } from 'upsignon-mail';
import { getEmailConfig, getMailTransporter } from '../../helpers/getMailTransporter';
import { logError } from '../../helpers/logger';
import { inputSanitizer } from '../../helpers/sanitizer';

type TShamirRecoveryRequestDenied = {
  vaultEmail: string;
  supportEmail: string;
  acceptLanguage: string;
};
export const sendShamirRecoveryRequestDenied = async ({
  vaultEmail,
  supportEmail,
  acceptLanguage,
}: TShamirRecoveryRequestDenied): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    const safeVaultEmail = inputSanitizer.cleanForHTMLInjections(vaultEmail);
    const safeSupportEmail = inputSanitizer.cleanForHTMLInjections(supportEmail);

    const { html, text, subject } = await buildEmail({
      templateName: 'recoveryRequestDenied',
      locales: getBestLanguage(acceptLanguage),
      args: {},
    });

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: safeVaultEmail,
      replyTo: safeSupportEmail,
      subject: subject,
      text: text,
      html: html,
    });
  } catch (e) {
    logError('sendShamirRecoveryRequestDenied error:', e);
  }
};
