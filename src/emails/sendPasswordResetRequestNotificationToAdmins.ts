import { getAdminEmailsForBank } from '../helpers/getAdminsEmailsForBank';
import { getEmailConfig, getMailTransporter } from '../helpers/getMailTransporter';
import { logError } from '../helpers/logger';
import { inputSanitizer } from '../helpers/sanitizer';
import { buildEmail, getBestLanguage } from 'upsignon-mail';

export const sendPasswordResetRequestNotificationToAdmins = async (
  emailAddress: string,
  bankId: number,
  acceptLanguage: string,
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeEmailAddress = inputSanitizer.cleanForHTMLInjections(emailAddress);

    const adminEmails = await getAdminEmailsForBank(bankId);
    if (adminEmails.length === 0) return;

    const { html, text, subject } = await buildEmail({
      templateName: 'masterPasswordResetAdminApproval',
      locales: getBestLanguage(acceptLanguage),
      args: {
        emailUser: safeEmailAddress,
      },
    });

    transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: adminEmails,
      subject: subject,
      text: text,
      html: html,
    });
  } catch (e) {
    logError('ERROR sending password reset admin notification email:', e);
  }
};
