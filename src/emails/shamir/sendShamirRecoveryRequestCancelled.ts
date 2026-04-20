import { buildEmail, getBestLanguage } from 'upsignon-mail';
import { getEmailConfig, getMailTransporter } from '../../helpers/getMailTransporter';
import { logError } from '../../helpers/logger';
import { inputSanitizer } from '../../helpers/sanitizer';

type TShamirRecoveryRequestCancelled = {
  vaultEmail: string;
  trustedPersonEmails: string[];
  supportEmail: string;
  acceptLanguage: string | undefined;
};
export const sendShamirRecoveryRequestCancelledToTrustedPersons = async ({
  vaultEmail,
  trustedPersonEmails,
  supportEmail,
  acceptLanguage,
}: TShamirRecoveryRequestCancelled): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    const safeVaultEmail = inputSanitizer.cleanForHTMLInjections(vaultEmail);
    const safeTrustedPersonEmails = trustedPersonEmails.map(inputSanitizer.cleanForHTMLInjections);
    const safeSupportEmail = inputSanitizer.cleanForHTMLInjections(supportEmail);

    const { html, text, subject } = await buildEmail({
      templateName: 'recoveryRequestCancelled',
      locales: getBestLanguage(acceptLanguage),
      args: { vaultEmail: safeVaultEmail },
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
    logError('sendShamirRecoveryRequestCancelledToTrustedPersons error:', e);
  }
};
