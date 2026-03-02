import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkDeviceAuth } from '../../helpers/authorizationChecks';
import { sendShamirRecoveryRequestCancelledToTrustedPersons } from '../../../emails/shamir/sendShamirRecoveryRequestCancelled';
import { getSupportEmail } from './_supportEmail';
import { getShareholdersEmailsForVault } from './_trustedPersonsEmails';

export const abortShamirRecovery = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuth = await checkDeviceAuth(req);
    if (!deviceAuth.granted) {
      logInfo(req.body?.userEmail, 'abortShamirRecovery fail: device auth not granted');
      res.status(401).json({ error: 'badDeviceSession' });
      return;
    }
    const { vaultId } = deviceAuth;

    await db.query(
      `UPDATE shamir_recovery_requests SET status='ABORTED' WHERE vault_id=$1 AND status='PENDING'`,
      [vaultId],
    );
    await db.query('UPDATE shamir_shares SET open_shares=null WHERE vault_id=$1', [vaultId]);

    // send an email to trustedPersons
    const acceptLanguage = req.headers['accept-language'];
    const supportEmail = await getSupportEmail(vaultId);
    const holdersEmails = await getShareholdersEmailsForVault(vaultId);
    await sendShamirRecoveryRequestCancelledToTrustedPersons({
      vaultEmail: req.body?.userEmail,
      trustedPersonEmails: holdersEmails,
      supportEmail,
      acceptLanguage,
    });
    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'abortShamirRecovery', e);
    res.status(400).end();
    return;
  }
};
