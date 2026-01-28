import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkDeviceAuth } from '../../helpers/authorizationChecks';

export const abortShamirRecovery = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuth = await checkDeviceAuth(req);
    if (!deviceAuth.granted) {
      logInfo(req.body?.userEmail, 'abortShamirRecovery fail: device auth not granted');
      res.status(401).end();
      return;
    }
    const { vaultId, deviceId } = deviceAuth;

    await db.query(
      `UPDATE shamir_recovery_requests SET status='ABORTED' WHERE device_id=$1 AND status='PENDING'`,
      [deviceId],
    );
    await db.query('UPDATE shamir_shares SET open_shares=null WHERE vault_id=$1', [vaultId]);

    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'abortShamirRecovery', e);
    res.status(400).end();
    return;
  }
};
