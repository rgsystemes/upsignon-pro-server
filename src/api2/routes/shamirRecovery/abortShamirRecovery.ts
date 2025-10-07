import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError } from '../../../helpers/logger';
import { authenticateDeviceWithChallenge } from '../../helpers/authorizationChecks';

export const abortShamirRecovery = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuthRes = await authenticateDeviceWithChallenge(req, res, 'abortShamirRecovery');
    if (deviceAuthRes == null) {
      return;
    }

    await db.query(
      `UPDATE shamir_recovery_requests SET status='ABORTED' WHERE device_id=$1 AND status='PENDING'`,
      [deviceAuthRes.devicePrimaryId],
    );
    await db.query('UPDATE shamir_shares SET open_shares=null WHERE vault_id=$1', [
      deviceAuthRes.vaultId,
    ]);

    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'abortShamirRecovery', e);
    res.status(400).end();
    return;
  }
};
