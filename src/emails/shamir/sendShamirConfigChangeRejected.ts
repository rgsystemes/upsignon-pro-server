import { buildEmail, getBestLanguage } from 'upsignon-mail';
import { getAdminEmailsForBank } from '../../helpers/getAdminsEmailsForBank';
import { getEmailConfig, getMailTransporter } from '../../helpers/getMailTransporter';
import { logError } from '../../helpers/logger';
import { inputSanitizer } from '../../helpers/sanitizer';

type TShamirConfigChangeRejected = {
  trustedPersonEmails: string[];
  supportEmail: string;
  bankId: number;
  bankName: string;
  currentShamirConfigName: string;
  acceptLanguage: string | undefined;
};
export const sendShamirConfigChangeRejectedToAdminsCCTrustedPersons = async ({
  trustedPersonEmails,
  supportEmail,
  bankId,
  bankName,
  currentShamirConfigName,
  acceptLanguage,
}: TShamirConfigChangeRejected): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeBankName = inputSanitizer.cleanForHTMLInjections(bankName);
    const safeCurrentShamirConfigName =
      inputSanitizer.cleanForHTMLInjections(currentShamirConfigName);
    const safeTrustedPersonEmails = trustedPersonEmails.map(inputSanitizer.cleanForHTMLInjections);
    const safeSupportEmail = inputSanitizer.cleanForHTMLInjections(supportEmail);

    const adminEmails = await getAdminEmailsForBank(bankId);
    if (adminEmails.length === 0) return;

    const { html, text, subject } = await buildEmail({
      templateName: 'configChangeRequestRejected',
      locales: getBestLanguage(acceptLanguage),
      args: {
        bankName: safeBankName,
        currentShamirConfigName: safeCurrentShamirConfigName,
      },
    });

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: adminEmails,
      cc: safeTrustedPersonEmails,
      replyTo: safeSupportEmail,
      subject: subject,
      text: text,
      html: html,
    });
  } catch (e) {
    logError('sendShamirConfigChangeRejectedToAdminsCCTrustedPersons error:', e);
  }
};
