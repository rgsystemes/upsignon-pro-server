import Joi from 'joi';
import { getNext8am, getRemainingDays, isMonday } from './dateHelper';
import { db } from './db';
import env from './env';
import { getEmailConfig, getMailTransporter } from './getMailTransporter';
import { logError, logInfo } from './logger';
import { inputSanitizer } from './sanitizer';

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

const salesDirector = env.IS_PRODUCTION
  ? 'laurent.casse@septeo.com'
  : 'gireg.dekerdanet@septeo.com';

export const sendTrialEmailReminders = (): void => {
  // this feature is for SAAS tests only
  if (env.API_PUBLIC_HOSTNAME.endsWith('.upsignon.eu')) {
    // this matches pro.upsignon.eu and pro-staging.upsignon.eu
    return;
  }
  // call function every day at 8am
  const nextCronDate = getNext8am();
  setTimeout(() => {
    if (isMonday()) {
      doSendTrialEmailReminder();
    }
    setInterval(doSendTrialEmailReminder, 24 * 3600 * 1000); // call it every 24 hours
  }, nextCronDate.getTime() - Date.now()); // start the cron at the next 8am
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
      Object.keys(trialsBySalesRep),
      Object.values(trialsBySalesRep),
    );
  } catch (e) {
    logError('doSendTrialEmailReminder', e);
  }
};

const sendTrialEndingEmailToSalesRep = async (
  sales: string[],
  contentbySales: SalesTrials[],
): Promise<void> => {
  try {
    const emailConfig = await getEmailConfig();
    const transporter = getMailTransporter(emailConfig, { debug: false });
    Joi.assert(sales, Joi.array().items(Joi.string().email()));
    const htmlMessage = `<body>
    <p>Bonjour,</p>
    <img alt="UpSignon logo" loading="lazy" width="200" decoding="async" data-nimg="1" style="color:transparent;" src="https://upsignon.eu/_next/static/media/logo-upsignon-website.a0d265f5.svg">
    <p style="background-color:#1E3758;color:white;padding: 0 5px;">Liste des comptes trial arrivant à expiration</p>

    ${contentbySales
      .map((c) => {
        return `<h3>${c.sales.replaceAll('@septeo.com', '')}</h3>
        ${
          c.expired.length > 0
            ? `<span>Expirés</span>
          ${getTrialsTable(c.expired, true)}
          <br/>
          <br/>`
            : ''
        }
        ${
          c.next7Days.length > 0
            ? `<span>Dans les 7 prochains jours</span>
          ${getTrialsTable(c.next7Days)}
          <br/>
          <br/>`
            : ''
        }
        ${
          c.next14Days.length > 0
            ? `<span>Dans les 14 prochains jours</span>
          ${getTrialsTable(c.next14Days)}
          <br/>
          <br/>`
            : ''
        }
      `;
      })
      .join('')}

    <p>Bonne journée,<br/>UpSignOn</p>
    </body>`;

    await transporter.sendMail({
      from: emailConfig.EMAIL_SENDING_ADDRESS,
      to: sales.indexOf(salesDirector) === -1 ? [...sales, salesDirector] : sales,
      subject: `[SALES] Expiration Trial UpSignon`,
      html: htmlMessage,
    });
  } catch (e) {
    logError('sendTrialEndingEmailToSalesRep', e);
  }
};

const getTrialsTable = (
  trials: {
    id: string;
    name: string;
    reseller: string;
    nbUsers: number;
    createdAt: string;
    remainingDays: number;
  }[],
  expiredCase?: boolean,
): string => {
  return `<table style="border-collapse:collapse;width:100%;border-bottom: 2px solid black;">
    <thead>
      <tr>
        <th style="padding:8px;">ID</th>
        <th style="padding:8px;">Nom de la banque</th>
        <th style="padding:8px;">Nom MSP</th>
        <th style="padding:8px;">Nombre de coffres</th>
        <th style="padding:8px;">Date de création</th>
        <th style="padding:8px;">${expiredCase ? "Jours d'expiration" : 'Jour des tests restants'}</th>
      </tr>
    </thead>
    <tbody>
      ${trials
        .map((t, i) => {
          const rowStyle = i % 2 === 0 ? 'background:#E7E7E7;' : 'background:#fff;';
          return `<tr style="${rowStyle}">
          <td style="padding:8px;text-align:center;">${t.id}</td>
          <td style="padding:8px;text-align:center;">${t.name || ''}</td>
          <td style="padding:8px;text-align:center;">${t.reseller || ''}</td>
          <td style="padding:8px;text-align:center;">${t.nbUsers}</td>
          <td style="padding:8px;text-align:center;">${new Date(t.createdAt).toLocaleDateString('fr')}</td>
          <td style="padding:8px;text-align:center;${expiredCase ? 'color:red;' : ''}">${t.remainingDays}</td>
        </tr>`;
        })
        .join('')}
    </tbody>
  </table>`;
};
