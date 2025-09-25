import { db } from '../../../helpers/db';
import { getExpirationDate, isExpired } from '../../../helpers/dateHelper';
import { sendDeviceRequestEmail } from '../../../helpers/sendDeviceRequestEmail';
import { logError, logInfo } from '../../../helpers/logger';
import { getRandomString } from '../../../helpers/randomString';
import {
  BANK_SETTINGS,
  USER_SETTINGS_OVERRIDE,
} from '../../../helpers/getDefaultSettingOrUserOverride';
import { isAllowedOnPlatform } from '../../../helpers/isAllowedOnPlatform';
import { getEmailAuthorizationStatus } from '../../helpers/emailAuthorization';
import { MicrosoftGraph } from 'upsignon-ms-entra';
import { getBankIds } from '../../helpers/bankUUID';
import Joi from 'joi';
import { SessionStore } from '../../../helpers/sessionStore';

// TESTS
// - if I request access for a user that does not exist, it creates the user and the device request
// - if I request access for an existing user but a new device, it creates the device request
// - if I request access for an existing user and an existing device
//      - if the request is still pending or already accepted, return 401 with status
//      - if the request has expired, generate a new one

// returns
// - 400 if an error occured
// - 400 if the request was malformed
// - 400 with authorizationStatus = "PENDING"|"AUTHORIZED" (with mail resent)
// - 403 with error = email_address_not_allowed
// - 204

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const requestDeviceAccess2 = async (req: any, res: any) => {
  try {
    const bankIds = await getBankIds(req);

    const joiRes = Joi.object({
      userEmail: Joi.string().email().lowercase().required(),
      deviceId: Joi.string().required(),
      devicePublicKey: Joi.string().required(),
      deviceName: Joi.string().required(),
      deviceType: Joi.string(),
      osFamily: Joi.string().required(),
      osNameAndVersion: Joi.string().required(),
      installType: Joi.string().required(),
      appVersion: Joi.string().required(),
      openidSession: Joi.string(),
    }).validate(req.body);

    if (joiRes.error) {
      return res.status(400).json({ error: joiRes.error.details });
    }
    const safeBody = joiRes.value;

    // Request DB
    let userRes = await db.query(
      `SELECT
        users.id AS id,
        users.deactivated AS deactivated,
        users.settings_override AS settings_override,
        banks.settings AS bank_settings
      FROM users INNER JOIN banks ON banks.id = users.bank_id
      WHERE users.email=$1 AND users.bank_id=$2`,
      [safeBody.userEmail, bankIds.internalId],
    );
    if (userRes.rows[0]?.deactivated) {
      return res.status(403).json({ error: 'user_deactivated' });
    }
    if (userRes.rowCount === 0) {
      // make sure email address is allowed
      const userMSEntraId = await MicrosoftGraph.getUserId(bankIds.internalId, safeBody.userEmail);
      const emailAuthStatus = await getEmailAuthorizationStatus(
        safeBody.userEmail,
        userMSEntraId,
        bankIds.internalId,
      );
      if (emailAuthStatus === 'UNAUTHORIZED') {
        logInfo(safeBody.userEmail, 'requestDeviceAccess2 fail: email address not allowed');
        return res.status(403).json({ error: 'email_address_not_allowed' });
      }
      userRes = await db.query(
        'INSERT INTO users (email, ms_entra_id, bank_id) VALUES ($1,$2,$3) RETURNING id',
        [safeBody.userEmail, userMSEntraId, bankIds.internalId],
      );
    }
    const userId = userRes.rows[0].id;

    // CHECK SECOND REQUESTS FOR SAME DEVICE
    const deviceRes = await db.query(
      'SELECT id, authorization_status, authorization_code, auth_code_expiration_date FROM user_devices WHERE user_id=$1 AND device_unique_id=$2 AND bank_id=$3',
      [userId, safeBody.deviceId, bankIds.internalId],
    );
    const deviceInDb = deviceRes.rows[0];
    if (deviceInDb && deviceInDb.authorization_status === 'AUTHORIZED') {
      logInfo(safeBody.userEmail, 'requestDeviceAccess2 OK (device already authorized)');
      return res.status(200).json({ authorizationStatus: 'AUTHORIZED' });
    }

    if (!deviceInDb) {
      // IF DEVICE DOES NOT YET EXIST, CHECK PLATFORM
      const userAllowedOnPlatform = isAllowedOnPlatform(
        safeBody.osFamily + safeBody.osNameAndVersion + safeBody.deviceType,
        userRes.rows[0].bank_settings as BANK_SETTINGS,
        userRes.rows[0].settings_override as USER_SETTINGS_OVERRIDE,
      );
      if (!userAllowedOnPlatform) {
        logInfo(
          safeBody.userEmail,
          `requestDeviceAccess2 KO (not allowed on platform ${safeBody.osFamily})`,
        );
        return res.status(403).json({ error: 'os_not_allowed' });
      }
    }

    // if using openid session, validate it
    let isOpenidAuthenticated = false;
    if (safeBody.openidSession) {
      const isOpenidSessionOK = await SessionStore.checkOpenIdSession(safeBody.openidSession, {
        userEmail: safeBody.userEmail,
        bankId: bankIds.internalId,
      });
      if (!isOpenidSessionOK) {
        logInfo(safeBody.userEmail, 'requestDeviceAccess2 fail: invalid openidSession');
        return res.status(401).end();
      }
      isOpenidAuthenticated = true;
    }

    if (isOpenidAuthenticated) {
      if (!deviceInDb) {
        // CREATE AUTHORIZED DEVICE
        await db.query(
          "INSERT INTO user_devices (user_id, device_name, device_type, install_type, os_family, os_version, app_version, device_unique_id, device_public_key_2, authorization_status, bank_id, enrollment_method) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SSO')",
          [
            userId,
            safeBody.deviceName,
            safeBody.deviceType,
            safeBody.installType,
            safeBody.osFamily,
            safeBody.osNameAndVersion,
            safeBody.appVersion,
            safeBody.deviceId,
            safeBody.devicePublicKey,
            'AUTHORIZED',
            bankIds.internalId,
          ],
        );
      } else {
        // AUTHORIZE EXISTING DEVICE (previously added with email method)
        await db.query(
          "UPDATE user_devices SET (device_name, device_type, install_type, os_family, os_version, app_version, device_unique_id, authorization_status, enrollment_method) = ($1,$2,$3,$4,$5,$6,$7,$8,'SSO') WHERE id=$9",
          [
            safeBody.deviceName,
            safeBody.deviceType,
            safeBody.installType,
            safeBody.osFamily,
            safeBody.osNameAndVersion,
            safeBody.appVersion,
            safeBody.deviceId,
            'AUTHORIZED',
            deviceInDb.id,
          ],
        );
      }
      logInfo(safeBody.userEmail, 'requestDeviceAccess2 authorized with openid session');
      return res.status(200).json({ authorizationStatus: 'AUTHORIZED' });
    } else {
      // RESEND EMAIL IF REQUEST IS STILL PENDING
      if (
        deviceInDb &&
        deviceInDb.authorization_status === 'PENDING' &&
        !isExpired(deviceInDb.auth_code_expiration_date)
      ) {
        // resend email
        await sendDeviceRequestEmail(
          safeBody.userEmail,
          safeBody.deviceName,
          safeBody.deviceType,
          safeBody.osNameAndVersion,
          deviceInDb.authorization_code,
          deviceInDb.auth_code_expiration_date,
        );
        logInfo(safeBody.userEmail, 'requestDeviceAccess2 OK (email resent)');
        return res.status(200).json({ authorizationStatus: 'PENDING' });
      }

      // ELSE UPDATE OR CREATE DEVICE
      const randomAuthorizationCode = getRandomString(8);
      const expirationDate = getExpirationDate();
      const nextDeviceStatus = 'PENDING';
      if (!deviceInDb) {
        await db.query(
          "INSERT INTO user_devices (user_id, device_name, device_type, install_type, os_family, os_version, app_version, device_unique_id, device_public_key_2, authorization_status, authorization_code, auth_code_expiration_date, bank_id, enrollment_method) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'email')",
          [
            userId,
            safeBody.deviceName,
            safeBody.deviceType,
            safeBody.installType,
            safeBody.osFamily,
            safeBody.osNameAndVersion,
            safeBody.appVersion,
            safeBody.deviceId,
            safeBody.devicePublicKey,
            nextDeviceStatus,
            randomAuthorizationCode,
            expirationDate,
            bankIds.internalId,
          ],
        );
      } else {
        // request is pending and expired, let's update it
        await db.query(
          "UPDATE user_devices SET (device_name, authorization_status, authorization_code, auth_code_expiration_date, enrollment_method) = ($1,$2,$3,$4,'email') WHERE user_id=$5 AND device_unique_id=$6 AND bank_id=$7",
          [
            safeBody.deviceName,
            nextDeviceStatus,
            randomAuthorizationCode,
            expirationDate,
            userId,
            safeBody.deviceId,
            bankIds.internalId,
          ],
        );
      }

      // THEN SEND EMAIL
      await sendDeviceRequestEmail(
        safeBody.userEmail,
        safeBody.deviceName,
        safeBody.deviceType,
        safeBody.osNameAndVersion,
        randomAuthorizationCode,
        new Date(expirationDate),
      );

      logInfo(safeBody.userEmail, 'requestDeviceAccess2 OK (email sent with new code)');
      // Return res
      return res.status(200).json({ authorizationStatus: 'MAIL_SENT' });
    }
  } catch (e) {
    logError(req.body?.userEmail, 'requestDeviceAccess', e);
    res.status(400).end();
  }
};
