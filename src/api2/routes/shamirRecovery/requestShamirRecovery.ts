import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError } from '../../../helpers/logger';
import { authenticateDeviceWithChallenge } from '../../helpers/authorizationChecks';

export const requestShamirRecovery = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuthRes = await authenticateDeviceWithChallenge(req, res, 'requestShamirRecovery');
    if (deviceAuthRes == null) {
      return;
    }

    // abort if a previous procedure exists
    const previousRequestsRes = await db.query(
      `SELECT *
      FROM shamir_recovery_requests as srr
      INNER JOIN user_devices as ud ON ud.id = srr.device_id
      INNER JOIN users as u ON u.id = ud.user_id
      WHERE srr.status='PENDING' AND u.id=$1`,
      [deviceAuthRes.vaultId],
    );
    if (previousRequestsRes.rowCount != null && previousRequestsRes.rowCount > 0) {
      res.status(403).json({ error: 'shamir_recovery_already_pending' });
      return;
    }
    const configIdRes = await db.query(
      `SELECT sc.id as id
    FROM shamir_configs as sc
    INNER JOIN shamir_holders as sr ON sr.shamir_config_id=sc.id
    INNER JOIN shamir_shares as ss ON ss.holder_vault_id = sr.vault_id
    INNER JOIN users as u ON u.id = ss.vault_id
    WHERE u.id=$1
    LIMIT 1
    `,
      [deviceAuthRes.vaultId],
    );
    const configId = configIdRes.rowCount == 1 ? configIdRes.rows[0].id : null;
    if (!configId) {
      logError('requestShamirRecovery Shamir config not found.');
      res.status(403).json({ error: 'shamir_config_not_found' });
      return;
    }

    await db.query(
      `INSERT INTO shamir_recovery_requests (shamir_config_id, device_id, status) VALUES ($1,$2, 'PENDING')
      `,
      [configId, deviceAuthRes.devicePrimaryId],
    );
    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'requestShamirRecovery', e);
    res.status(400).end();
    return;
  }
};
