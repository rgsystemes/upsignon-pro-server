import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError } from '../../../helpers/logger';
import { checkDeviceAuthorizationOnly } from '../../helpers/authorizationChecks';

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

    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'abortShamirRecovery', e);
    res.status(400).end();
    return;
  }
};
