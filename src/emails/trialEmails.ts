import Joi from 'joi';
import { getNext8am, getRemainingDays, isMonday } from '../helpers/dateHelper';
import { db } from '../helpers/db';
import env from '../helpers/env';
import { getEmailConfig, getMailTransporter } from '../helpers/getMailTransporter';
import { logError, logInfo } from '../helpers/logger';
import { inputSanitizer } from '../helpers/sanitizer';
import { buildEmail } from 'upsignon-mail';

type TrialLine = {
  id: string;
  name: string;
  reseller: string;
  nbUsers: number;
  createdAt: string;
  remainingDays: number;
};
type SalesTrials = {
  sales: string;
  expired: TrialLine[];
  next7Days: TrialLine[];
  next14Days: TrialLine[];
};

const septeoItSolutionsSalesGroupEmail = 'gpRG-Sales@septeogroup.onmicrosoft.com';

export const sendTrialEmailReminders = (): void => {
  // this feature is for SAAS tests only
  if (env.API_PUBLIC_HOSTNAME != 'pro.upsignon.eu') {
    return;
  }
  // call function every day at 8am
  const nextCronDate = getNext8am();
  setTimeout(() => {
    doSendTrialEmailReminderOnMondays();
    setInterval(doSendTrialEmailReminderOnMondays, 24 * 3600 * 1000); // call it every 24 hours
  }, nextCronDate.getTime() - Date.now()); // start the cron at the next 8am
};

const doSendTrialEmailReminderOnMondays = async () => {
  if (isMonday()) {
    await doSendTrialEmailReminder();
  }
};

const doSendTrialEmailReminder = async (): Promise<void> => {
  try {
    logInfo('doSendTrialEmailReminder');
    // get all trials
    const trialsRes = await db.query(
      `SELECT
          banks.id,
          banks.name,
          banks.settings->'SALES_REP' as sales_rep,
          banks.settings->'TESTING_EXPIRATION_DATE' as testing_expiration_date,
          banks.created_at,
          COUNT(users.*) as nb_users,
          resellers.name as reseller_name
        FROM banks
        LEFT JOIN users ON users.bank_id=banks.id
        LEFT JOIN resellers ON resellers.id=banks.reseller_id
        WHERE banks.settings->>'IS_TESTING' = 'true'
        GROUP BY banks.id, resellers.id
        ORDER BY testing_expiration_date ASC`,
    );
    const trials = trialsRes.rows.map((t) => {
      return {
        salesRep: inputSanitizer.cleanForHTMLInjections(t.sales_rep),
        id: t.id,
        name: inputSanitizer.cleanForHTMLInjections(t.name),
        reseller: inputSanitizer.cleanForHTMLInjections(t.reseller_name),
        nbUsers: t.nb_users,
        createdAt: t.created_at,
        remainingDays: getRemainingDays(t.testing_expiration_date),
      };
    });

    // every week, send a reminder to sales rep
    let trialsBySalesRep: {
      [salesRep: string]: SalesTrials;
    } = {};
    trials.forEach((t) => {
      if (!trialsBySalesRep[t.salesRep]) {
        trialsBySalesRep[t.salesRep] = {
          sales: t.salesRep,
          expired: [],
          next7Days: [],
          next14Days: [],
        };
      }
      if (t.remainingDays <= 0) {
        trialsBySalesRep[t.salesRep].expired.push({
          id: t.id,
          name: t.name,
          reseller: t.reseller,
          nbUsers: t.nbUsers,
          createdAt: t.createdAt,
          remainingDays: t.remainingDays,
        });
      }
      if (t.remainingDays > 0 && t.remainingDays <= 7) {
        trialsBySalesRep[t.salesRep].next7Days.push({
          id: t.id,
          name: t.name,
          reseller: t.reseller,
          nbUsers: t.nbUsers,
          createdAt: t.createdAt,
          remainingDays: t.remainingDays,
        });
      }
      if (t.remainingDays > 7 && t.remainingDays <= 14) {
        trialsBySalesRep[t.salesRep].next14Days.push({
          id: t.id,
          name: t.name,
          reseller: t.reseller,
          nbUsers: t.nbUsers,
          createdAt: t.createdAt,
          remainingDays: t.remainingDays,
        });
      }
    });
    await sendTrialEndingEmailToSalesRep(
      septeoItSolutionsSalesGroupEmail,
      Object.values(trialsBySalesRep),
    );
  } catch (e) {
    logError('doSendTrialEmailReminder', e);
  }
};

const sendTrialEndingEmailToSalesRep = async (
  salesEmail: string,
  contentbySales: SalesTrials[],
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });
    Joi.assert(salesEmail, Joi.string().email());

    const { html, text, subject } = await buildEmail({
      templateName: 'trialExpiration',
      locales: 'fr',
      args: {
        salesTrials: contentbySales,
      },
    });

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: salesEmail,
      subject: subject,
      html: html,
      text: text,
    });
  } catch (e) {
    logError('sendTrialEndingEmailToSalesRep', e);
  }
};
