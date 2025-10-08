import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkDeviceAuthorizationOnly } from '../../helpers/authorizationChecks';
import { findShamirConfigId } from './helpers';
import Joi from 'joi';

export const requestShamirRecovery = async (req: Request, res: Response): Promise<void> => {
  try {
    const expectedScheme = Joi.object({
      userEmail: Joi.string().email().lowercase().required(),
      deviceSession: Joi.string().required(),
      deviceId: Joi.string().required(),
    });

    let validatedBody: {
      userEmail: string;
      deviceSession: string;
      deviceId: string;
    };
    try {
      validatedBody = Joi.attempt(req.body, expectedScheme);
    } catch (e) {
      logInfo(req.body?.userEmail, e);
      res.status(403).end();
      return;
    }

    const authRes = await checkDeviceAuthorizationOnly(req, res);
    if (authRes == null) {
      return;
    }
    const { user_id, device_primary_id } = authRes;

    // abort if a previous procedure exists
    const previousRequestsRes = await db.query(
      `SELECT *
      FROM shamir_recovery_requests as srr
      INNER JOIN user_devices as ud ON ud.id = srr.device_id
      INNER JOIN users as u ON u.id = ud.user_id
      WHERE srr.status='PENDING' AND u.id=$1`,
      [user_id],
    );
    if (previousRequestsRes.rowCount != null && previousRequestsRes.rowCount > 0) {
      res.status(403).json({ error: 'shamir_recovery_already_pending' });
      return;
    }
    const configId = await findShamirConfigId(user_id);
    if (!configId) {
      logError('requestShamirRecovery Shamir config not found.');
      res.status(403).end();
      return;
    }

    await db.query(
      `INSERT INTO shamir_recovery_requests (shamir_config_id, device_id, status) VALUES ($1,$2, 'PENDING')
      `,
      [configId, device_primary_id],
    );
    );
    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'requestShamirRecovery', e);
    res.status(400).end();
    return;
  }
};
