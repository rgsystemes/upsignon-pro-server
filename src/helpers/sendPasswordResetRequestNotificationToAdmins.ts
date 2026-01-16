import { getAdminEmailsForBank } from './getAdminsEmailsForBank';
import { getEmailConfig, getMailTransporter } from './getMailTransporter';
import { logError } from './logger';
import { inputSanitizer } from './sanitizer';
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
