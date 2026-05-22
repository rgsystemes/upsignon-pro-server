import { db } from '../../../helpers/db';
import { checkDeviceChallengeV2 } from '../../helpers/deviceChallengev2';
import { logError, logInfo } from '../../../helpers/logger';
import { hashPasswordChallengeResultForSecureStorageV2 } from '../../helpers/passwordChallengev2';
import { inputSanitizer } from '../../../helpers/sanitizer';
import { SessionStore } from '../../../helpers/sessionStore';
import { getDefaultSettingOrUserOverride } from '../../../helpers/getDefaultSettingOrUserOverride';
import { getBankIds } from '../../helpers/bankUUID';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const addNewData2 = async (req: any, res: any): Promise<void> => {
  try {
    const sharingPublicKey = inputSanitizer.getString(req.body?.sharingPublicKey);
    const signingPublicKey = inputSanitizer.getString(req.body?.signingPublicKey);
    const deviceChallengeResponse = inputSanitizer.getString(req.body?.deviceChallengeResponse);
    const newEncryptedData = inputSanitizer.getString(req.body?.newEncryptedData);
    const deviceUId = inputSanitizer.getString(req.body?.deviceId);
    const userEmail = inputSanitizer.getLowerCaseString(req.body?.userEmail);
    const bankIds = await getBankIds(req);

    // 0 - Check params
    if (
      !newEncryptedData ||
      !deviceChallengeResponse ||
      !sharingPublicKey ||
      !userEmail ||
      !deviceUId
    ) {
      logInfo(req.body?.userEmail, 'addNewData2 fail: some missing parameter');
      return res.status(403).end();
    }

    const selectRes = await db.query(
      `SELECT
        char_length(u.encrypted_data_2) > 0 AS has_existing_data,
        u.id AS uid,
        ud.id AS did,
        ud.device_public_key_2 AS device_public_key_2,
        ud.session_auth_challenge AS session_auth_challenge,
        ud.session_auth_challenge_exp_time AS session_auth_challenge_exp_time
      FROM user_devices AS ud
      INNER JOIN users AS u ON ud.user_id = u.id
      WHERE
        u.email=$1
        AND ud.device_unique_id = $2
        AND ud.authorization_status='AUTHORIZED'
        AND u.bank_id=$3
        `,
      [userEmail, deviceUId, bankIds.internalId],
    );
    // 1 - check that user data is indeed empty
    if (
      !selectRes ||
      selectRes.rowCount === 0 ||
      selectRes.rows[0].has_existing_data ||
      !selectRes.rows[0].device_public_key_2 ||
      !selectRes.rows[0].session_auth_challenge
    ) {
      logInfo(req.body?.userEmail, 'addNewData2 fail: conflict');
      return res.status(403).json({ error: 'conflict' });
    }

    // 2 - check that the session auth challenge has not expired
    if (
      !selectRes.rows[0].session_auth_challenge_exp_time ||
      !selectRes.rows[0].session_auth_challenge ||
      selectRes.rows[0].session_auth_challenge_exp_time.getTime() < Date.now()
    ) {
      logInfo(req.body?.userEmail, 'addNewData2 fail: auth challenge expired');
      return res.status(403).json({ error: 'expired' });
    }

    // 3 - check Device challenge
    const hasPassedDeviceChallenge = await checkDeviceChallengeV2(
      selectRes.rows[0].session_auth_challenge,
      deviceChallengeResponse,
      selectRes.rows[0].device_public_key_2,
    );

    if (!hasPassedDeviceChallenge) {
      logInfo(req.body?.userEmail, 'addNewData2 fail: device authentication failed');
      return res.status(401).end();
    }

    const newEncryptedDataWithPasswordChallengeSecured =
      hashPasswordChallengeResultForSecureStorageV2(newEncryptedData);
    // 4 - Do the update
    const updateRes = await db.query(
      'UPDATE users SET (encrypted_data_2, updated_at, sharing_public_key_2, signing_public_key)=($1, CURRENT_TIMESTAMP(0), $2, $3) WHERE users.email=$4 AND users.bank_id=$5 RETURNING updated_at',
      [
        newEncryptedDataWithPasswordChallengeSecured,
        sharingPublicKey,
        signingPublicKey,
        userEmail,
        bankIds.internalId,
      ],
    );
    if (updateRes.rowCount === 0) {
      logInfo(req.body?.userEmail, 'addNewData2 fail: database update failed');
      // CONFLICT
      return res.status(403).end();
    }

    await db.query('UPDATE user_devices SET last_sync_date=$1 WHERE id=$2 AND bank_id=$3', [
      new Date().toISOString(),
      selectRes.rows[0].did,
      bankIds.internalId,
    ]);

    const settingsRes = await db.query(
      'SELECT os_family, device_type, settings FROM user_devices INNER JOIN banks ON banks.id=user_devices.bank_id WHERE user_devices.device_unique_id=$1 AND banks.id=$2',
      [deviceUId, bankIds.internalId],
    );

    const resultSettings = getDefaultSettingOrUserOverride(
      settingsRes.rows[0].settings,
      null,
      settingsRes.rows[0].os_family || settingsRes.rows[0].device_type, // fallback to device_type which used to be where we stored os_family
    );

    // Set Session
    const deviceSession = await SessionStore.createSession({
      bankId: bankIds.internalId,
      deviceUniqueId: deviceUId,
      userEmail,
    });
    logInfo(req.body?.userEmail, 'addNewData2 OK');
    return res.status(200).json({
      lastUpdatedAt: updateRes.rows[0].updated_at,
      deviceSession,
      allowedOffline: resultSettings?.allowed_offline,
      allowedToExport: resultSettings?.allowed_to_export,
      defaultAutolockDelay: resultSettings?.defaultAutolockDelay,
      maxAutolockDelay: resultSettings?.maxAutolockDelay,
    });
  } catch (e) {
    logError(req.body?.userEmail, 'addNewData2', e);
    return res.status(400).end();
  }
};
