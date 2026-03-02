import { sendShamirRecoveryRequestExpiredToUser } from '../../../emails/shamir/sendShamirRecoveryRequestExpired';
import { getSupportEmail } from './_supportEmail';
import { db } from '../../../helpers/db';
import { logError } from '../../../helpers/logger';
import { getNext8am } from '../../../helpers/dateHelper';

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
    // 1. Get all expired shamir recovery requests still marked as PENDING
    const expiredRequestsRes = await db.query(
      `SELECT srr.id, srr.vault_id, u.email as vault_email, has_expiry_mail_been_sent
       FROM shamir_recovery_requests srr
       INNER JOIN users u ON u.id = srr.vault_id
       WHERE srr.status = 'PENDING' AND srr.expiry_date < CURRENT_TIMESTAMP(0)`,
    );
    if (expiredRequestsRes.rowCount === 0) return;

    // 2. For each expired request, clear open_shares and send email
    for (const req of expiredRequestsRes.rows) {
      if (req.has_expiry_mail_been_sent) continue;

      // Clear open_shares for this vault
      await db.query(`UPDATE shamir_shares SET open_shares = NULL WHERE vault_id = $1`, [
        req.vault_id,
      ]);
      await db.query(
        `UPDATE shamir_recovery_requests SET has_expiry_mail_been_sent = true WHERE id = $1`,
        [req.id],
      );
      // Get support email
      const supportEmail = await getSupportEmail(req.vault_id);
      // Send expiration email to the user
      await sendShamirRecoveryRequestExpiredToUser({
        vaultEmail: req.vault_email,
        supportEmail,
        acceptLanguage: undefined,
      });
    }
  } catch (e) {
    logError('cleanUpExpiredShamirRecoveryRequests', e);
  }
};
