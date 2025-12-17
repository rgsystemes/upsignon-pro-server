import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import Joi from 'joi';
import { checkDeviceAuth } from '../../helpers/authorizationChecks';

export const requestShamirRecovery = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuth = await checkDeviceAuth(req);
    if (!deviceAuth.granted) {
      logInfo(req.body?.userEmail, 'requestShamirRecovery fail: device auth not granted');
      res.status(401).end();
      return;
    }
    const { vaultId, deviceId } = deviceAuth;

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
      [vaultId],
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
      [vaultId],
    );
    const configId = configIdRes.rowCount == 1 ? configIdRes.rows[0].id : null;
    if (!configId) {
      logError('requestShamirRecovery Shamir config not found.');
      res.status(403).json({ error: 'shamir_config_not_found' });
      return;
    }

    // extra security
    await db.query('UPDATE shamir_shares SET open_shares=null WHERE vault_id=$1', [vaultId]);

    await db.query(
      `INSERT INTO shamir_recovery_requests (shamir_config_id, device_id, public_key, status, expiry_date) VALUES ($1, $2, $3, 'PENDING', CURRENT_TIMESTAMP(0) + INTERVAL '7 days')`,
      [configId, deviceId, validatedBody.publicKey],
    );
    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'requestShamirRecovery', e);
    res.status(400).end();
    return;
  }
};
