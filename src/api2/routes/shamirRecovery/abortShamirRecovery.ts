import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError } from '../../../helpers/logger';
import { checkDeviceAuthorizationOnly } from '../../helpers/authorizationChecks';
import { sendRecoveryRequestAbortedUserAlert } from './mailHelpers';

export const abortShamirRecovery = async (req: Request, res: Response): Promise<void> => {
  try {
    const authRes = await checkDeviceAuthorizationOnly(req, res);
    if (authRes == null) {
      return;
    }

    const { user_id, device_primary_id } = authRes;

    await db.query(
      `UPDATE shamir_recovery_requests SET status='ABORTED' WHERE device_id=$1 AND status='PENDING'`,
      [device_primary_id],
    );
    await db.query('UPDATE shamir_shares SET open_shares=null WHERE vault_id=$1', [user_id]);
    const userRes = await db.query('SELECT email FROM users WHERE users.id=$1', [user_id]);
    const deviceRes = await db.query('SELECT device_name FROM user_devices WHERE id=$1', [
      device_primary_id,
    ]);
    await sendRecoveryRequestAbortedUserAlert(userRes.rows[0].email, deviceRes.rows[0].device_name);
    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'abortShamirRecovery', e);
    res.status(400).end();
    return;
  }
};
