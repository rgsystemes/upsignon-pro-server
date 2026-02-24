import { getAdminEmailsForBank } from '../helpers/getAdminsEmailsForBank';
import { getEmailConfig, getMailTransporter } from '../helpers/getMailTransporter';
import { logError } from '../helpers/logger';
import { inputSanitizer } from '../helpers/sanitizer';
import { buildEmail } from 'upsignon-mail';
import { septeoSupportEmail } from './constants';

type TShamirSecurityAlertInput = {
  bankId: number;
  brokenShamirChain: string;
  bankName: string;
  bankUrl: string;
};
export const sendShamirSecurityAlertToAdmins = async ({
  bankId,
  brokenShamirChain,
  bankName,
  bankUrl,
}: TShamirSecurityAlertInput): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeBrokenShamirChain = inputSanitizer.cleanForHTMLInjections(brokenShamirChain);
    const safeBankName = inputSanitizer.cleanForHTMLInjections(bankName);
    const safeBankUrl = inputSanitizer.cleanForHTMLInjections(bankUrl);

    const adminEmails = await getAdminEmailsForBank(bankId, true);
    if (adminEmails.length === 0) return;

    const { html, text, subject } = await buildEmail({
      templateName: 'shamirSecurityAlert',
      // do not translate this alert since it's going to be sent only once
      // and we don't want the pirate to be able to choose the langage in which it is sent.
      locales: 'fr',
      args: {
        bankName: safeBankName,
        bankUrl: safeBankUrl,
      },
    });

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: adminEmails,
      cc: septeoSupportEmail,
      replyTo: septeoSupportEmail,
      subject: subject,
      text: text,
      html: html,
      priority: 'high',
      attachments: [
        {
          filename: 'compromisedShamirConfigChain.json',
          contentDisposition: 'attachment',
          content: safeBrokenShamirChain,
        },
      ],
    });
  } catch (e) {
    logError('sendShamirSecurityAlertToAdmins error:', e);
  }
};
