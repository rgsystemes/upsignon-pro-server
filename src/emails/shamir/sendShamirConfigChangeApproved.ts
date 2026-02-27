import { buildEmail, getBestLanguage } from 'upsignon-mail';
import { getAdminEmailsForBank } from '../../helpers/getAdminsEmailsForBank';
import { getEmailConfig, getMailTransporter } from '../../helpers/getMailTransporter';
import { logError } from '../../helpers/logger';
import { inputSanitizer } from '../../helpers/sanitizer';

type TShamirConfigChangeApproved = {
  trustedPersonEmails: string[];
  supportEmail: string;
  bankId: number;
  bankName: string;
  shamirConfigName: string;
  nbApprovers: number;
  acceptLanguage: string;
};
export const sendShamirConfigChangeApproved = async ({
  trustedPersonEmails,
  supportEmail,
  bankId,
  bankName,
  shamirConfigName,
  nbApprovers,
  acceptLanguage,
}: TShamirConfigChangeApproved): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeBankName = inputSanitizer.cleanForHTMLInjections(bankName);
    const safeShamirConfigName = inputSanitizer.cleanForHTMLInjections(shamirConfigName);
    const safeTrustedPersonEmails = trustedPersonEmails.map(inputSanitizer.cleanForHTMLInjections);
    const safeSupportEmail = inputSanitizer.cleanForHTMLInjections(supportEmail);

    const adminEmails = await getAdminEmailsForBank(bankId);
    if (adminEmails.length === 0) return;

    const { html, text, subject } = await buildEmail({
      templateName: 'configChangeRequestApproved',
      locales: getBestLanguage(acceptLanguage),
      args: {
        shamirConfigName: safeShamirConfigName,
        nbApprovers: nbApprovers,
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
    logError('sendShamirConfigChangeApproved error:', e);
  }
};
