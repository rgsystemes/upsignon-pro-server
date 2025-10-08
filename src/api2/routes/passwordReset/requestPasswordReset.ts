import { db } from '../../../helpers/db';
import { getExpirationDate, isExpired } from '../../../helpers/dateHelper';
import { sendPasswordResetRequestEmail } from '../../../helpers/sendPasswordResetRequestEmail';
import { logError, logInfo } from '../../../helpers/logger';
import {
  checkDeviceRequestAuthorizationV2,
  createDeviceChallengeV2,
} from '../../helpers/deviceChallengev2';
import { getRandomString } from '../../../helpers/randomString';
import { sendPasswordResetRequestNotificationToAdmins } from '../../../helpers/sendPasswordResetRequestNotificationToAdmins';
import { getBankIds } from '../../helpers/bankUUID';
import Joi from 'joi';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const requestPasswordReset2 = async (req: any, res: any) => {
  try {
    const bankIds = await getBankIds(req);

    const joiRes = Joi.object({
      userEmail: Joi.string().email().lowercase().required(),
      deviceId: Joi.string().required(),
      deviceChallengeResponse: Joi.string(),
    }).validate(req.body);

    if (joiRes.error) {
      return res.status(400).json({ error: joiRes.error.details });
    }
    const safeBody = joiRes.value;

    // Request DB
    const authDbRes = await db.query(
      `SELECT
        users.id AS uid,
        users.deactivated AS deactivated,
        user_devices.id AS did,
        user_devices.device_name AS device_name,
        user_devices.os_version AS os_version,
        user_devices.device_public_key_2 AS device_public_key_2,
        user_devices.session_auth_challenge AS session_auth_challenge,
        user_devices.session_auth_challenge_exp_time AS session_auth_challenge_exp_time
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

    if (!authDbRes || authDbRes.rowCount === 0 || authDbRes.rows[0].deactivated) {
      logInfo(req.body?.userEmail, 'requestPasswordReset2 fail: no such authorized device');
      return res.status(401).end();
    }
    if (!safeBody.deviceChallengeResponse) {
      const deviceChallenge = await createDeviceChallengeV2(authDbRes.rows[0].did);
      logInfo(req.body?.userEmail, 'requestPasswordReset2 fail: sending device challenge');
      return res.status(403).json({ deviceChallenge });
    }
    const isDeviceAuthorized = await checkDeviceRequestAuthorizationV2(
      safeBody.deviceChallengeResponse,
      authDbRes.rows[0].did,
      authDbRes.rows[0].session_auth_challenge_exp_time,
      authDbRes.rows[0].session_auth_challenge,
      authDbRes.rows[0].device_public_key_2,
    );
    if (!isDeviceAuthorized) {
      logInfo(req.body?.userEmail, 'requestPasswordReset2 fail: device auth failed');
      return res.status(401).end();
    }

    // Request DB
    const dbRes = await db.query(
      `SELECT
        password_reset_request.id AS reset_request_id,
        password_reset_request.status AS reset_status,
        password_reset_request.reset_token_expiration_date AS reset_token_expiration_date
      FROM password_reset_request
      WHERE
        password_reset_request.device_id=$1
        AND password_reset_request.bank_id=$2
        AND password_reset_request.status != 'COMPLETED'
      ORDER BY password_reset_request.created_at DESC
      LIMIT 1`,
      [authDbRes.rows[0].did, bankIds.internalId],
    );

    const resetRequest = dbRes.rows[0];

    const settingRes = await db.query(
      `SELECT settings->>'DISABLE_MANUAL_VALIDATION_FOR_PASSWORD_FORGOTTEN' AS value FROM banks WHERE id=$1`,
      [bankIds.internalId],
    );
    if (settingRes.rows[0]?.value === 'true' || settingRes.rows[0]?.value === true) {
      // MANUAL VALIDATION IS DISABLED
      const expirationDate = getExpirationDate();
      const randomAuthorizationCode = getRandomString(8);
      if (!resetRequest) {
        await db.query(
          `INSERT INTO password_reset_request
              (device_id, status, reset_token, reset_token_expiration_date, bank_id, granted_by)
            VALUES ($1,'ADMIN_AUTHORIZED',$2,$3, $4, 'configuration')
          `,
          [authDbRes.rows[0].did, randomAuthorizationCode, expirationDate, bankIds.internalId],
        );
      } else {
        await db.query(
          `UPDATE password_reset_request SET
            created_at=CURRENT_TIMESTAMP(0),
            status='ADMIN_AUTHORIZED',
            reset_token=$1,
            reset_token_expiration_date=$2,
            granted_by='configuration'
          WHERE id=$3 AND bank_id=$4`,
          [
            randomAuthorizationCode,
            expirationDate,
            resetRequest.reset_request_id,
            bankIds.internalId,
          ],
        );
      }
      await sendPasswordResetRequestEmail(
        safeBody.userEmail,
        authDbRes.rows[0].device_name,
        randomAuthorizationCode,
        expirationDate,
      );
      logInfo(req.body?.userEmail, 'requestPasswordReset2 OK (reset mail sent)');
      return res.status(200).json({ resetStatus: 'mail_sent' });
    } else {
      // MANUAL VALIDATION IS ENABLED
      if (!resetRequest) {
        await db.query(
          `INSERT INTO password_reset_request
              (device_id, status, bank_id)
            VALUES
              ($1, 'PENDING_ADMIN_CHECK', $2)
          `,
          [authDbRes.rows[0].did, bankIds.internalId],
        );
        logInfo(req.body?.userEmail, 'requestPasswordReset2 OK (reset request created)');
        await sendPasswordResetRequestNotificationToAdmins(safeBody.userEmail, bankIds.internalId);
        return res.status(200).json({ resetStatus: 'pending_admin_check' });
      }

      const isRequestExpired =
        resetRequest.reset_token_expiration_date &&
        isExpired(resetRequest.reset_token_expiration_date);

      if (isRequestExpired || !resetRequest.reset_token_expiration_date) {
        await db.query(
          `UPDATE password_reset_request SET created_at=CURRENT_TIMESTAMP(0), status='PENDING_ADMIN_CHECK', granted_by=null, reset_token=null, reset_token_expiration_date=null WHERE id=$1 AND bank_id=$2`,
          [resetRequest.reset_request_id, bankIds.internalId],
        );
        logInfo(req.body?.userEmail, 'requestPasswordReset2 OK (reset request updated)');
        await sendPasswordResetRequestNotificationToAdmins(safeBody.userEmail, bankIds.internalId);
        return res.status(200).json({ resetStatus: 'pending_admin_check' });
      }

      if (resetRequest.reset_status === 'PENDING_ADMIN_CHECK') {
        logInfo(req.body?.userEmail, 'requestPasswordReset2 OK (reset request still pending)');
        return res.status(200).json({ resetStatus: 'pending_admin_check' });
      }

      if (resetRequest.reset_status === 'ADMIN_AUTHORIZED') {
        logInfo(req.body?.userEmail, 'requestPasswordReset2 OK (mail sent)');
        return res.status(200).json({ resetStatus: 'mail_sent' });
      }
    }
    logError(req.body?.userEmail, 'requestPasswordReset fail: unmet conditions');
    res.status(400).end();
  } catch (e) {
    logError(req.body?.userEmail, 'requestPasswordReset', e);
    res.status(400).end();
  }
};
