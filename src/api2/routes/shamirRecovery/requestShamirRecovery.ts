import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { authenticateDeviceWithChallenge } from '../../helpers/authorizationChecks';
import Joi from 'joi';

export const requestShamirRecovery = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuthRes = await authenticateDeviceWithChallenge(req, res, 'requestShamirRecovery');
    if (deviceAuthRes == null) {
      return;
    }

    const expectedScheme = Joi.object({
      publicKey: Joi.string().required(),
    }).unknown();

    let validatedBody: {
      publicKey: string;
    };
    try {
      validatedBody = Joi.attempt(req.body, expectedScheme);
    } catch (err) {
      logInfo(req.body?.userEmail, err);
      res.status(403).end();
      return;
    }

    // abort if a previous procedure exists
    const previousRequestsRes = await db.query(
      `SELECT COUNT(srr.id) as count
      FROM shamir_recovery_requests as srr
      INNER JOIN user_devices as ud ON ud.id = srr.device_id
      INNER JOIN users as u ON u.id = ud.user_id
      WHERE srr.status = 'PENDING' AND u.id = $1 AND srr.expiry_date > current_timestamp(0)`,
      [deviceAuthRes.vaultId],
    );
    if (previousRequestsRes.rows[0].count > 0) {
      res.status(403).json({ error: 'shamir_recovery_already_pending' });
      return;
    }
    const configIdRes = await db.query(
      `SELECT sc.id as id
    FROM shamir_configs as sc
    INNER JOIN shamir_holders as sr ON sr.shamir_config_id = sc.id
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

    // extra security
    await db.query('UPDATE shamir_shares SET open_shares=null WHERE vault_id=$1', [
      deviceAuthRes.vaultId,
    ]);

    await db.query(
      `INSERT INTO shamir_recovery_requests (shamir_config_id, device_id, public_key, status, expiry_date) VALUES ($1, $2, $3, 'PENDING', CURRENT_TIMESTAMP(0) + INTERVAL '7 days')`,
      [configId, deviceAuthRes.devicePrimaryId, validatedBody.publicKey],
    );
    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'requestShamirRecovery', e);
    res.status(400).end();
    return;
  }
};
