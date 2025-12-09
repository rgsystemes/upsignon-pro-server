import { db } from '../../../helpers/db';
import { isExpired } from '../../../helpers/dateHelper';
import { logError, logInfo } from '../../../helpers/logger';
import {
  checkDeviceRequestAuthorizationV2,
  createDeviceChallengeV2,
} from '../../helpers/deviceChallengev2';
import { inputSanitizer } from '../../../helpers/sanitizer';
import libsodium from 'libsodium-wrappers';
import { sendDeviceRequestAdminEmail } from '../../../helpers/sendDeviceRequestEmail';
import { getBankIds } from '../../helpers/bankUUID';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const checkDevice2 = async (req: any, res: any) => {
  try {
    const bankIds = await getBankIds(req);

    // Get params
    const userEmail = inputSanitizer.getLowerCaseString(req.body?.userEmail);
    const deviceId = inputSanitizer.getString(req.body?.deviceId);
    const deviceChallengeResponse = inputSanitizer.getString(req.body?.deviceChallengeResponse);
    const deviceValidationCode = inputSanitizer.getString(req.body?.deviceValidationCode);

    // Check params
    if (!userEmail) {
      logInfo(req.body?.userEmail, 'checkDevice2 fail: missing userEmail');
      return res.status(403).end();
    }
    if (!deviceId) {
      logInfo(req.body?.userEmail, 'checkDevice2 fail: missing deviceId');
      return res.status(403).end();
    }
    if (!deviceValidationCode) {
      logInfo(req.body?.userEmail, 'checkDevice2 fail: missing deviceValidationCode');
      return res.status(403).end();
    }

    // Request DB
    const dbRes = await db.query(
      `SELECT
        ud.id AS id,
        users.id AS user_id,
        users.deactivated AS deactivated,
        ud.authorization_code AS authorization_code,
        ud.authorization_status AS authorization_status,
        ud.auth_code_expiration_date AS auth_code_expiration_date,
        ud.device_public_key_2 AS device_public_key_2,
        ud.session_auth_challenge AS session_auth_challenge,
        ud.session_auth_challenge_exp_time AS session_auth_challenge_exp_time,
        COUNT(ud2.id) AS device_count,
        banks.settings AS bank_settings
      FROM user_devices AS ud
      INNER JOIN users ON ud.user_id = users.id
      INNER JOIN banks ON banks.id = users.bank_id
      LEFT JOIN user_devices AS ud2
        ON ud2.user_id=users.id AND
          (ud2.authorization_status = 'AUTHORIZED' OR
            ud2.authorization_status = 'PENDING' OR
            ud2.authorization_status = 'USER_VERIFIED_PENDING_ADMIN_CHECK'
          )
      WHERE
        users.email=$1
        AND ud.device_unique_id = $2
        AND ud.authorization_status != 'REVOKED_BY_ADMIN'
        AND ud.authorization_status != 'REVOKED_BY_USER'
        AND users.bank_id=$3
      GROUP BY ud.id, users.id, banks.id
      `,
      [userEmail, deviceId, bankIds.internalId],
    );

    if (!dbRes || dbRes.rowCount === 0 || dbRes.rows[0].deactivated) {
      logInfo(req.body?.userEmail, 'checkDevice2 fail: device deleted');
      return res.status(403).json({ error: 'revoked' });
    }

    if (
      dbRes.rows[0].authorization_status === 'AUTHORIZED' ||
      dbRes.rows[0].authorization_status === 'USER_VERIFIED_PENDING_ADMIN_CHECK'
    ) {
      logInfo(req.body?.userEmail, 'checkDevice2 OK (already authorized)');
      return res.status(200).end();
    }
    if (!deviceChallengeResponse) {
      const deviceChallenge = await createDeviceChallengeV2(dbRes.rows[0].id);
      logInfo(req.body?.userEmail, 'checkDevice2 fail: sending deviceChallenge');
      return res.status(401).json({ deviceChallenge });
    }

    const isDeviceAuthorized = await checkDeviceRequestAuthorizationV2(
      deviceChallengeResponse,
      dbRes.rows[0].id,
      dbRes.rows[0].session_auth_challenge_exp_time,
      dbRes.rows[0].session_auth_challenge,
      dbRes.rows[0].device_public_key_2,
    );
    if (!isDeviceAuthorized) {
      logInfo(req.body?.userEmail, 'checkDevice2 fail: device authentication failed');
      return res.status(401).end();
    }

    const deviceValidationCodeBuffer = Buffer.from(deviceValidationCode, 'utf-8');
    const expectedAuthCodeBuffer = Buffer.from(dbRes.rows[0].authorization_code, 'utf-8');
    let codeMatch = false;
    try {
      codeMatch = libsodium.memcmp(deviceValidationCodeBuffer, expectedAuthCodeBuffer);
    } catch (e) {}
    if (!codeMatch) {
      logInfo(req.body?.userEmail, 'checkDevice2 fail: bad code');
      return res.status(403).json({ error: 'bad_code' });
    }
    if (isExpired(dbRes.rows[0].auth_code_expiration_date)) {
      logInfo(req.body?.userEmail, 'checkDevice2 fail: code expired');
      return res.status(403).json({ error: 'expired_code' });
    }

    let nextAuthorizationStatus = 'AUTHORIZED';
    let requireAdminCheck = false;
    if (
      dbRes.rows[0]?.device_count != null &&
      Number.parseInt(dbRes.rows[0].device_count, 10) > 1 &&
      dbRes.rows[0].bank_settings != null &&
      dbRes.rows[0].bank_settings?.REQUIRE_ADMIN_CHECK_FOR_SECOND_DEVICE
    ) {
      nextAuthorizationStatus = 'USER_VERIFIED_PENDING_ADMIN_CHECK';
      requireAdminCheck = true;
    }

    if (requireAdminCheck) {
      await sendDeviceRequestAdminEmail(userEmail, bankIds.internalId);
      logInfo(
        req.body?.userEmail,
        'checkDevice OK (waiting for admin check - email sent to admin)',
      );
      // NB : this does not prevent the user from completing his device authorization.
      // the user will be blocked when trying to fetch data
    }
    await db.query(
      'UPDATE user_devices SET (authorization_status, authorization_code, auth_code_expiration_date) = ($1, null, null) WHERE id=$2',
      [nextAuthorizationStatus, dbRes.rows[0].id],
    );
    logInfo(req.body?.userEmail, 'checkDevice2 OK');
    return res.status(200).end();
  } catch (e) {
    logError(req.body?.userEmail, 'checkDevice2', e);
    return res.status(400).end();
  }
};
