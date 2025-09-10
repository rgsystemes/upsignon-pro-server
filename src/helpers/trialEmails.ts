import Joi from 'joi';
import { getFrenchDayOfWeek, getNext8am, getRemainingDays, isMonday } from './dateHelper';
import { db } from './db';
import env from './env';
import { getEmailConfig, getMailTransporter } from './getMailTransporter';
import { logError } from './logger';
import { inputSanitizer } from './sanitizer';

export const sendTrialEmailReminders = (): void => {
  // this feature is for SAAS tests only
  if (env.API_PUBLIC_HOSTNAME.endsWith('.upsignon.eu')) {
    // this matches pro.upsignon.eu and pro-staging.upsignon.eu
    return;
  }
  // call function every day at 8am
  const nextCronDate = getNext8am();
  setTimeout(() => {
    doSendTrialEmailReminder();
    setInterval(doSendTrialEmailReminder, 24 * 3600 * 1000); // call it every 24 hours
  }, nextCronDate.getTime() - Date.now()); // start the cron at the next 8am
};

const doSendTrialEmailReminder = async (): Promise<void> => {
  try {
    if (isMonday()) {
      // get all trials
      const trialsRes = await db.query(
        "SELECT id, name, settings->'TESTING_EXPIRATION_DATE' as testing_expiration_date, settings->'SALES_REP' as sales_rep FROM banks WHERE settings->>'IS_TESTING' = 'true'",
      );
      const trials = trialsRes.rows.map((t) => {
        return {
          id: t.id,
          name: t.name,
          salesRep: t.sales_rep,
          remainingDays: getRemainingDays(t.testing_expiration_date),
          day: getFrenchDayOfWeek(t.testing_expiration_date),
        };
      });

      // every week, send a reminder to sales rep
      let trialsBySalesRep: {
        [salesRep: string]: { bankName: string; remainingDays: number; day: string }[];
      } = {};
      trials.forEach((t) => {
        if (!trialsBySalesRep[t.salesRep]) {
          trialsBySalesRep[t.salesRep] = [];
        }
        if (t.remainingDays >= 0 && t.remainingDays <= 7) {
          trialsBySalesRep[t.salesRep].push({
            bankName: t.name,
            remainingDays: t.remainingDays,
            day: t.day,
          });
        }
      });
      for (let [salesRep, banks] of Object.entries(trialsBySalesRep)) {
        sendTrialEndingEmailToSalesRep(
          salesRep,
          banks.sort((a, b) => {
            if (a.remainingDays < b.remainingDays) return -1;
            if (a.remainingDays > b.remainingDays) return 1;
            if (a.bankName < b.bankName) return -1;
            return 1;
          }),
        );
      }
    }
  } catch (e) {
    logError('doSendTrialEmailReminder', e);
  }
};

const sendTrialEndingEmailToSalesRep = async (
  salesRep: string,
  banks: { bankName: string; remainingDays: number; day: string }[],
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });
    Joi.assert(salesRep, Joi.string().email());
    const htmlMessage =
      banks.length > 0
        ? `<body>
    <p>Bonjour,</p>
    <p>Voici les banques d'essai dont vous êtes responsables et qui expirent cette semaine :</p>
    <ul>
    ${banks
      .map((b) => {
        return `<li><strong>${inputSanitizer.cleanForHTMLInjections(b.bankName)}</strong> - ${b.remainingDays === 0 ? "Aujourd'hui" : `${inputSanitizer.cleanForHTMLInjections(b.day)} dans ${b.remainingDays} jour(s)`}</li>`;
      })
      .join('')}
    </ul>
    <p>Bonne journée,<br/>UpSignOn</p>
    </body>`
        : `<body>
    <p>Bonjour,</p>
    <p>Aucune banque d'essai dont vous êtes en charge n'arrive à expiration cette semaine !</p>
    <p>Bonne journée,<br/>UpSignOn</p>
    </body>`;
    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: salesRep,
      subject: `Trials UpSignOn PRO qui expirent cette semaine`,
      html: htmlMessage,
    });
  } catch (e) {
    logError('sendTrialEndingEmailToSalesRep', e);
  }
};
