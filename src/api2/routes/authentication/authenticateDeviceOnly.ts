import { Request, Response } from 'express';
import Joi from 'joi';
import { getBankIds } from '../../helpers/bankUUID';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkDeviceRequestAuthorizationV2 } from '../../helpers/deviceChallengev2';
import { SessionStore } from '../../../helpers/sessionStore';

export const authenticateDeviceOnly = async (req: Request, res: Response): Promise<void> => {
  try {
    const joiRes = Joi.object({
      userEmail: Joi.string().email().lowercase().required(),
      deviceId: Joi.string().required(),
      deviceChallengeResponse: Joi.string().required(),
    }).validate(req.body);

    if (joiRes.error) {
      res.status(403).json({ error: joiRes.error.details });
      return;
    }
    const bankIds = await getBankIds(req);

    const safeBody = joiRes.value;

    // Request DB
    const deviceRes = await db.query(
      `SELECT
      user_devices.id AS id,
      users.id AS userid,
      user_devices.device_public_key_2 AS device_public_key_2,
      user_devices.session_auth_challenge AS session_auth_challenge,
      user_devices.session_auth_challenge_exp_time AS session_auth_challenge_exp_time
      FROM user_devices
      INNER JOIN users ON user_devices.user_id = users.id
      WHERE
      users.email=$1
      AND user_devices.device_unique_id = $2
      AND user_devices.authorization_status='AUTHORIZED'
      AND (users.deactivated IS NULL OR users.deactivated = false)
      AND user_devices.bank_id=$3
      LIMIT 1`,
      [safeBody.userEmail, safeBody.deviceId, bankIds.internalId],
    );

    if (!deviceRes || deviceRes.rowCount === 0) {
      logInfo(safeBody.userEmail, `authenticateDeviceOnly fail: no such authorized device`);
      res.status(401).end();
      return;
    }

    const isDeviceAuthorized = await checkDeviceRequestAuthorizationV2(
      safeBody.deviceChallengeResponse,
      deviceRes.rows[0].id,
      deviceRes.rows[0].session_auth_challenge_exp_time,
      deviceRes.rows[0].session_auth_challenge,
      deviceRes.rows[0].device_public_key_2,
    );
    if (!isDeviceAuthorized) {
      logInfo(safeBody.userEmail, `authenticateDeviceOnly fail: device auth failed`);
      res.status(401).end();
      return;
    }
    const deviceOnlySession = await SessionStore.createSession({
      userEmail: safeBody.userEmail,
      deviceUniqueId: safeBody.deviceId,
      bankId: bankIds.internalId,
      deviceOnly: true,
    });
    res.status(200).json({
      deviceOnlySession,
    });
  } catch (e) {
    logError('authenticateDeviceOnly', e);
    res.status(400).end();
  }
};
