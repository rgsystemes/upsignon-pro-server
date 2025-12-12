import { getNext8am } from '../../../helpers/dateHelper';
import { db } from '../../../helpers/db';
import { logError } from '../../../helpers/logger';

export const cleanUpExpiredShamirRecoveryRequestsDaily = async (): Promise<void> => {
  cleanUpExpiredShamirRecoveryRequests();

  // call perform sync everyday at 8am
  const nextSyncDate = getNext8am();
  setTimeout(() => {
    cleanUpExpiredShamirRecoveryRequests();
    setInterval(cleanUpExpiredShamirRecoveryRequests, 24 * 3600 * 1000); // call it every 24 hours
  }, nextSyncDate.getTime() - Date.now()); // start the cron at the next 8am
};

const cleanUpExpiredShamirRecoveryRequests = async () => {
  try {
    await db.query(
      `UPDATE shamir_shares
      SET open_shares = NULL
      WHERE
        open_shares IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM shamir_recovery_requests srr
          INNER JOIN user_devices AS ud ON ud.id = srr.device_id
          INNER JOIN users AS u ON u.id = ud.user_id
          WHERE
          shamir_shares.vault_id = u.id
          AND srr.status = 'PENDING'
          AND srr.expiry_date >= CURRENT_TIMESTAMP(0)
        )`,
      [],
    );
  } catch (e) {
    logError('cleanUpExpiredShamirRecoveryRequests', e);
  }
};
