import { db } from '../../../helpers/db';
import { isExpired } from '../../../helpers/dateHelper';
import { logError, logInfo } from '../../../helpers/logger';
import {
  checkDeviceRequestAuthorizationV2,
  createDeviceChallengeV2,
} from '../../helpers/deviceChallengev2';
import libsodium from 'libsodium-wrappers';
import { getBankIds } from '../../helpers/bankUUID';
import Joi from 'joi';
import { SessionStore } from '../../../helpers/sessionStore';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const getPasswordBackup2 = async (req: any, res: any) => {
  try {
    const bankIds = await getBankIds(req);

    const joiRes = Joi.object({
      userEmail: Joi.string().email().lowercase().required(),
      deviceId: Joi.string().required(),
      deviceChallengeResponse: Joi.string(),
      resetToken: Joi.string(),
      openidSession: Joi.string(),
    })
      .or('resetToken', 'openidSession')
      .validate(req.body);

    if (joiRes.error) {
      return res.status(403).json({ error: joiRes.error.details });
    }
    const safeBody = joiRes.value;

    // Request DB
    const deviceRes = await db.query(
      `SELECT
        user_devices.id AS id,
        users.id AS userid,
        user_devices.device_public_key_2 AS device_public_key_2,
        user_devices.session_auth_challenge AS session_auth_challenge,
        user_devices.session_auth_challenge_exp_time AS session_auth_challenge_exp_time,
        user_devices.encrypted_password_backup_2 AS encrypted_password_backup_2
      FROM user_devices
        INNER JOIN users ON user_devices.user_id = users.id
      WHERE
        users.email=$1
        AND user_devices.device_unique_id = $2
        AND user_devices.authorization_status='AUTHORIZED'
        AND user_devices.bank_id=$3
      LIMIT 1`,
      [safeBody.userEmail, safeBody.deviceId, bankIds.internalId],
    );

    if (!deviceRes || deviceRes.rowCount === 0) {
      logInfo(safeBody.userEmail, 'getPasswordBackup2 fail: no such authorized device');
      return res.status(401).end();
    }

    if (!safeBody.deviceChallengeResponse) {
      const deviceChallenge = await createDeviceChallengeV2(deviceRes.rows[0].id);
      logInfo(safeBody.userEmail, 'getPasswordBackup2 fail: sending device challenge');
      return res.status(403).json({ deviceChallenge });
    }
    const isDeviceAuthorized = await checkDeviceRequestAuthorizationV2(
      safeBody.deviceChallengeResponse,
      deviceRes.rows[0].id,
      deviceRes.rows[0].session_auth_challenge_exp_time,
      deviceRes.rows[0].session_auth_challenge,
      deviceRes.rows[0].device_public_key_2,
    );
    if (!isDeviceAuthorized) {
      logInfo(safeBody.userEmail, 'getPasswordBackup2 fail: device auth failed');
      return res.status(401).end();
    }

    let resetRequest;

    // if using openid session
    if (safeBody.openidSession) {
      // validate it
      const isOpenidSessionOK = await SessionStore.checkOpenIdSession(safeBody.openidSession, {
        userEmail: safeBody.userEmail,
        bankId: bankIds.internalId,
      });
      if (!isOpenidSessionOK) {
        logInfo(safeBody.userEmail, 'requestDeviceAccess2 fail: invalid openidSession');
        return res.status(401).end();
      }
    } else {
      const existingRequestRes = await db.query(
        `SELECT
          password_reset_request.id AS reset_request_id,
          password_reset_request.status AS reset_status,
          password_reset_request.reset_token AS reset_token,
          password_reset_request.reset_token_expiration_date AS reset_token_expiration_date
        FROM user_devices
          LEFT JOIN password_reset_request ON user_devices.id = password_reset_request.device_id
        WHERE
          user_devices.device_unique_id=$1
          AND user_devices.bank_id=$2
          AND password_reset_request.status != 'COMPLETED'
        LIMIT 1`,
        [safeBody.deviceId, bankIds.internalId],
      );

      resetRequest = existingRequestRes.rows[0];
      if (!resetRequest) {
        logInfo(safeBody.userEmail, 'getPasswordBackup2 fail: no reset request found');
        return res.status(401).json({ error: 'no_request' });
      }
      if (resetRequest.reset_status !== 'ADMIN_AUTHORIZED') {
        logInfo(safeBody.userEmail, 'getPasswordBackup2 fail: reset request not admin authorized');
        return res.status(401).json({ error: 'not_admin_authorized' });
      }

      const expectedToken = Buffer.from(resetRequest.reset_token, 'utf-8');
      const inputToken = Buffer.from(safeBody.resetToken, 'utf-8');
      let tokenMatch = false;
      try {
        tokenMatch = libsodium.memcmp(expectedToken, inputToken);
      } catch (e) {}
      if (!tokenMatch) {
        logInfo(safeBody.userEmail, 'getPasswordBackup2 fail: bad token');
        return res.status(401).json({ error: 'bad_token' });
      } else if (isExpired(resetRequest.reset_token_expiration_date)) {
        logInfo(safeBody.userEmail, 'getPasswordBackup2 fail: token expired');
        return res.status(401).json({ error: 'expired' });
      }
    }

    if (!deviceRes.rows[0].encrypted_password_backup_2) {
      logInfo(safeBody.userEmail, 'getPasswordBackup2 fail: backup not setup');
      return res.status(403).json({ error: 'backup_not_setup' });
    }

    if (safeBody.openidSession) {
      // create password reset request for the record
      await db.query(
        `INSERT INTO password_reset_request (device_id, status, bank_id, granted_by)
        VALUES ($1,'COMPLETED',$2, 'SSO authentication')`,
        [deviceRes.rows[0].id, bankIds.internalId],
      );
    } else {
      // update status for reset request
      await db.query(
        `UPDATE password_reset_request SET status='COMPLETED', reset_token=null WHERE id=$1 AND bank_id=$2`,
        [resetRequest.reset_request_id, bankIds.internalId],
      );
    }
    await db.query(
      'UPDATE user_devices SET password_challenge_error_count=0, last_password_challenge_submission_date=null WHERE device_unique_id=$1 AND bank_id=$2',
      [safeBody.deviceId, bankIds.internalId],
    );
    logInfo(safeBody.userEmail, 'getPasswordBackup2 OK');
    // Return res
    return res
      .status(200)
      .json({ encryptedPasswordBackup: deviceRes.rows[0].encrypted_password_backup_2 });
  } catch (e) {
    logError(req.body?.userEmail, 'getPasswordBackup', e);
    res.status(400).end();
  }
};
