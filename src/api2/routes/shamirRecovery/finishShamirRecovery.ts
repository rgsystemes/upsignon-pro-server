import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import { sendRecoveryRequestCompletedUserAlert } from './mailHelpers';

export const finishShamirRecovery = async (req: Request, res: Response): Promise<void> => {
  try {
    const basicAuth = await checkBasicAuth2(req, { returningDeviceId: true });
    if (!basicAuth.granted) {
      logInfo(req.body?.userEmail, 'finishShamirRecovery fail: auth not granted');
      res.status(401).end();
      return;
    }

    await db.query(
      `UPDATE shamir_recovery_requests SET status='COMPLETED', completed_at=current_timestamp(0) WHERE device_id=$1 AND status='PENDING'`,
      [basicAuth.deviceId],
    );
    await db.query('UPDATE shamir_shares SET open_shares=null WHERE vault_id=$1', [
      basicAuth.userId,
    ]);
    const deviceRes = await db.query('SELECT device_name FROM user_devices WHERE id=$1', [
      basicAuth.deviceId,
    ]);
    await sendRecoveryRequestCompletedUserAlert(basicAuth.userEmail, deviceRes.rows[0].device_name);
    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'finishShamirRecovery', e);
    res.status(400).end();
    return;
  }
};
