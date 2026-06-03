import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import {
  checkDeviceRequestAuthorizationV2,
  createDeviceChallengeV2,
} from '../../helpers/deviceChallengev2';
import { inputSanitizer } from '../../../helpers/sanitizer';
import { SessionStore } from '../../../helpers/sessionStore';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import { getBankIds } from '../../helpers/bankUUID';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const revokeDevice = async (req: any, res: any) => {
  try {
    const deviceSession = inputSanitizer.getString(req.body?.deviceSession);
    const deviceId = inputSanitizer.getString(req.body?.deviceId);
    const deviceToDelete = inputSanitizer.getString(req.body?.deviceToDelete) || deviceId;

    const bankIds = await getBankIds(req);
    let userId = null;

    // DEVICE CAN REVOKE ITSELF WITHOUT FULL SESSION
    if (deviceId === deviceToDelete) {
      // Get params
      const userEmail = inputSanitizer.getLowerCaseString(req.body?.userEmail);
      if (!userEmail) {
        logInfo(req.body?.userEmail, 'revokeDevice self fail: missing user email');
        return res.status(403).end();
      }

      if (!deviceId) {
        logInfo(req.body?.userEmail, 'revokeDevice self fail: missing deviceId');
        return res.status(403).end();
      }
      const deviceChallengeResponse = inputSanitizer.getString(req.body?.deviceChallengeResponse);

      // Request DB
      const dbRes = await db.query(
        'SELECT ' +
          'ud.id AS id, ' +
          'users.id AS uid, ' +
          'ud.device_public_key_2 AS device_public_key_2, ' +
          'ud.session_auth_challenge AS session_auth_challenge, ' +
          'ud.session_auth_challenge_exp_time AS session_auth_challenge_exp_time ' +
          'FROM user_devices AS ud ' +
          'INNER JOIN users ON ud.user_id = users.id ' +
          'WHERE ' +
          'users.email=$1 ' +
          'AND ud.device_unique_id = $2 ' +
          'AND users.bank_id=$3',
        [userEmail, deviceId, bankIds.internalId],
      );

      if (!dbRes || dbRes.rowCount === 0) {
        logInfo(req.body?.userEmail, 'revokeDevice self fail: no such authorized device found');
        return res.status(401).end();
      }

      // you can revoke a device by having an authenticated deviceSession or by providing device authentication
      let isSessionAuthenticated = false;
      if (deviceSession) {
        isSessionAuthenticated = await SessionStore.checkSession(
          deviceSession,
          {
            userEmail,
            deviceUniqueId: deviceId,
            bankId: bankIds.internalId,
          },
          { deviceOnlyAuthAllowed: false },
        );
      }
      if (!deviceSession || !isSessionAuthenticated) {
        if (!deviceChallengeResponse) {
          const deviceChallenge = await createDeviceChallengeV2(dbRes.rows[0].id);
          logInfo(req.body?.userEmail, 'revokeDevice self fail: sending device challenge');
          return res.status(403).json({ deviceChallenge });
        }
        const isDeviceAuthorized = await checkDeviceRequestAuthorizationV2(
          deviceChallengeResponse,
          dbRes.rows[0].id,
          dbRes.rows[0].session_auth_challenge_exp_time,
          dbRes.rows[0].session_auth_challenge,
          dbRes.rows[0].device_public_key_2,
        );
        if (!isDeviceAuthorized) {
          logInfo(req.body?.userEmail, 'revokeDevice self fail: device not authenticated');
          return res.status(401).end();
        }
      }

      userId = dbRes.rows[0].uid;
    } else {
      // DEVICE CAN ONLY REVOKE OTHER DEVICES WITH FULL SESSION
      const basicAuth = await checkBasicAuth2(req);
      if (!basicAuth.granted) {
        logInfo(req.body?.userEmail, 'revokeDevice fail: auth not granted');
        return res.status(401).end();
      }
      userId = basicAuth.userId;
    }

    await db.query(
      "UPDATE user_devices SET device_unique_id=null, authorization_status='REVOKED_BY_USER', device_public_key_2=null, encrypted_password_backup_2='', revocation_date=$1 WHERE device_unique_id=$2 AND user_id=$3 AND bank_id=$4",
      [new Date().toISOString(), deviceToDelete, userId, bankIds.internalId],
    );
    logInfo(req.body?.userEmail, 'revokeDevice OK');
    // Return res
    return res.status(204).end();
  } catch (e) {
    logError(req.body?.userEmail, 'revokeDevice', e);
    return res.status(400).end();
  }
};
