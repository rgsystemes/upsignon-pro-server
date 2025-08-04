import env from './env';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import childProcess from 'child_process';
import { logError } from './logger';

export const sendStatusUpdate = async (): Promise<void> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serverVersion = require('../../package.json').version;
    const nodeVersion = await new Promise((resolve) => {
      childProcess.exec('node --version', (error, stdout) => {
        resolve(stdout?.toString().trim() || 'unknown');
      });
    });
    const licenseCountResult = await db.query('SELECT COUNT(*) FROM users');
    const licenseCount = licenseCountResult.rows[0].count;
    const statsByBank = await getStatsByBank();
    const statsByReseller = await getStatsByReseller();
    const userAppVersionsResult = await db.query(
      `SELECT DISTINCT(app_version) FROM user_devices WHERE authorization_status='AUTHORIZED' ORDER BY app_version DESC`,
    );
    const userAppVersions = JSON.stringify(userAppVersionsResult.rows.map((v) => v.app_version));
    const deviceStats = await db.query(
      'SELECT os_family, device_type, os_version FROM user_devices',
    );
    const stats: { def: string[]; data: number[] } = await getStats();
    const hasDailyBackup = getHasDailyBackup();
    const serverStatus = {
      serverUrl: env.API_PUBLIC_HOSTNAME,
      serverVersion,
      licenseCount,
      userAppVersions,
      securityGraph: JSON.stringify(stats),
      statsByBank,
      statsByReseller,
      hasDailyBackup,
      nodeVersion,
      deviceStats,
    };

    await sendToUpSignOn(serverStatus);
  } catch (e) {
    logError('sendStatusUpdate', e);
  }
};

// NB use ISO string dates because they can be compared alphabetically
const getDaysArray = (startDay: string, endDay: string): string[] => {
  const current = new Date(startDay);
  current.setHours(0, 0, 0, 0); // make sur time date is set in ISO standard
  const end = new Date(endDay);
  const res = [];
  let hasNextDate = true;
  while (hasNextDate) {
    res.push(current.toISOString());
    current.setDate(current.getDate() + 1);
    hasNextDate = current.getTime() < end.getTime();
  }
  return res;
};

const getStats = async (): Promise<{ def: string[]; data: any[] }> => {
  // hypothesis : if a stat exists for a bank for a day, then there exists a stats for other banks for that day too. (The computation succeeds in whole or not at all)
  const rawStats = await db.query(
    `SELECT
      date,
      SUM(nb_accounts) AS nb_accounts,
      SUM(nb_codes) AS nb_codes,
      SUM(nb_accounts_strong) AS nb_accounts_strong,
      SUM(nb_accounts_medium) AS nb_accounts_medium,
      SUM(nb_accounts_weak) AS nb_accounts_weak,
      SUM(nb_accounts_with_duplicated_password) AS nb_accounts_with_duplicated_password,
      SUM(nb_accounts_with_no_password) AS nb_accounts_with_no_password,
      SUM(nb_accounts_red) AS nb_accounts_red,
      SUM(nb_accounts_orange) AS nb_accounts_orange,
      SUM(nb_accounts_green) AS nb_accounts_green
    FROM pwd_stats_evolution GROUP BY date ORDER BY date ASC`,
  );
  if (!rawStats?.rowCount || rawStats.rowCount === 0) {
    return { def: [], data: [] };
  }

  // Then get the continuous list of days
  let days: string[];
  const startDay = rawStats.rows[0].date;
  let endDay = rawStats.rows[rawStats.rowCount - 1].date;
  endDay = new Date(endDay);
  endDay.setDate(endDay.getDate() + 1);
  endDay.setHours(0, 0, 0, 0);
  endDay = endDay.toISOString();
  days = getDaysArray(startDay, endDay).map((d) => d.split('T')[0]);

  let lastStatIndex = 0;
  let lastValueUsed = [
    days[0], // day
    0, // accounts
    0, // codes
    0, // strong
    0, // medium
    0, // weak
    0, // no password
    0, // duplicate
    0, // green
    0, // orange
    0, // red
  ];
  const graph = days.map((d) => {
    const row = rawStats.rows[lastStatIndex];
    if (row && row.date.toISOString().split('T')[0] === d) {
      lastValueUsed = [
        d,
        row.nb_accounts,
        row.nb_codes,
        row.nb_accounts_strong,
        row.nb_accounts_medium,
        row.nb_accounts_weak,
        row.nb_accounts_with_no_password,
        row.nb_accounts_with_duplicated_password,
        row.nb_accounts_green,
        row.nb_accounts_orange,
        row.nb_accounts_red,
      ];
      lastStatIndex++;
    }
    return lastValueUsed;
  });

  return {
    def: ['d', 'n', 'cd', 'st', 'md', 'wk', 'no', 'dp', 'gr', 'or', 'rd'],
    data: graph,
  };
};

const sendToUpSignOn = async (status: any) => {
  try {
    const url = env.IS_PRODUCTION
      ? 'https://app.upsignon.eu/pro-status'
      : 'http://localhost:3002/pro-status';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(status),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Sent status');
  } catch (error) {
    logError('sendToUpSignOn', error);
  }
};

const getStatsByBank = async () => {
  const res = await db.query(
    'SELECT banks.id, banks.name, banks.created_at, banks.nb_licences_sold, banks.stop_this_instance, banks.settings, banks.reseller_id, (SELECT COUNT(users.id) FROM users WHERE users.bank_id=banks.id) AS nb_users FROM banks',
  );
  return JSON.stringify(
    res.rows.map((r) => {
      if (r.settings) {
        const rr = {
          ...r,
          isTesting: r.settings?.IS_TESTING || false,
          testingExpirationDate: r.settings?.TESTING_EXPIRATION_DATE || null,
        };
        delete rr.settings;
        return rr;
      } else {
        return r;
      }
    }),
  );
};

const getStatsByReseller = async () => {
  const res = await db.query(`SELECT
      id,
      name,
      (SELECT COUNT(1) FROM users INNER JOIN banks ON banks.id = users.bank_id WHERE banks.reseller_id = resellers.id) as nb_vaults
    FROM resellers`);
  return JSON.stringify(res.rows);
};
const getHasDailyBackup = () => {
  if (!env.DB_BACKUP_DIR) return false;
  const yesterday = new Date();
  if (yesterday.getDay() === 0) {
    // sunday
    yesterday.setDate(yesterday.getDate() - 1);
  }
  if (yesterday.getDay() === 6) {
    // saturday
    yesterday.setDate(yesterday.getDate() - 2);
  }
  yesterday.setDate(yesterday.getDate() - 1);
  const folderNameDaily = `${yesterday.toISOString().split('T')[0]}-daily`;
  const folderNameWeekly = `${yesterday.toISOString().split('T')[0]}-weekly`;
  const folderNameMonthly = `${yesterday.toISOString().split('T')[0]}-monthly`;
  return (
    fs.existsSync(path.join(env.DB_BACKUP_DIR, folderNameDaily)) ||
    fs.existsSync(path.join(env.DB_BACKUP_DIR, folderNameWeekly)) ||
    fs.existsSync(path.join(env.DB_BACKUP_DIR, folderNameMonthly))
  );
};

const fetchActivationStatus = async (): Promise<boolean> => {
  try {
    if (!env.IS_PRODUCTION) {
      return true;
    }

    const response = await fetch('https://app.upsignon.eu/pro-activation-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: env.API_PUBLIC_HOSTNAME }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const resBody = await response.json();
    console.log('Get Activation status');
    return !!resBody.isActive;
  } catch (e) {
    logError('getActivationStatus', e);
    throw e;
  }
};

export let IS_ACTIVE: boolean = false;

const interval = null;

export const getActivationStatus = async () => {
  try {
    IS_ACTIVE = await fetchActivationStatus();
    if (!IS_ACTIVE) {
      console.log('==================== LICENCES DEACTIVATED, please contact our support.');
    }
  } catch (e) {
    IS_ACTIVE = false;
  }
  if (!IS_ACTIVE && interval == null) {
    setInterval(
      async () => {
        try {
          IS_ACTIVE = await fetchActivationStatus();
          if (IS_ACTIVE && interval) {
            clearInterval(interval);
            interval == null;
          }
        } catch (_) {}
      },
      1000 * 60 * 5,
    );
  }
};
