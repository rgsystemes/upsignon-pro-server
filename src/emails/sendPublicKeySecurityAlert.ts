import { buildEmail } from 'upsignon-mail';
import { getEmailConfig, getMailTransporter } from '../helpers/getMailTransporter';
import { logError } from '../helpers/logger';
import { inputSanitizer } from '../helpers/sanitizer';
import { septeoSupportEmail } from './constants';

type TShamirSecurityAlertInput = {
  email: string;
  bankName: string;
  bankUrl: string;
  keyType: 'sharing' | 'signing';
  badKey: string;
};
export const sendPublicKeySecurityAlert = async ({
  email,
  bankName,
  bankUrl,
  keyType,
  badKey,
}: TShamirSecurityAlertInput): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });

    // prevent HTML injections
    const safeEmail = inputSanitizer.cleanForHTMLInjections(email);
    const safeBankName = inputSanitizer.cleanForHTMLInjections(bankName);
    const safeBankUrl = inputSanitizer.cleanForHTMLInjections(bankUrl);

    const { html, text, subject } = await buildEmail({
      templateName: 'vaultPublicKeysSecurityAlert',
      // do not translate this alert since it's going to be sent only once
      // and we don't want the pirate to be able to choose the langage in which it is sent.
      locales: 'fr',
      args: {
        bankName: safeBankName,
        bankUrl: safeBankUrl,
        email: safeEmail,
        keyType,
      },
    });

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: septeoSupportEmail,
      subject: subject,
      text: text,
      html: html,
      priority: 'high',
      attachments: [
        {
          filename: 'badKey.txt',
          contentDisposition: 'attachment',
          content: badKey,
        },
      ],
    });
  } catch (e) {
    logError('sendPublicKeySecurityAlert error:', e);
  }
};
