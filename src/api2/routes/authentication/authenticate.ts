import { db } from '../../../helpers/db';
import { checkDeviceChallengeV2 } from '../../helpers/deviceChallengev2';
import { logError, logInfo } from '../../../helpers/logger';
import {
  checkPasswordChallengeV2,
  getPasswordUnblockDate,
  shouldResetPasswordErrorCount,
} from '../../helpers/passwordChallengev2';
import { inputSanitizer } from '../../../helpers/sanitizer';
import { SessionStore } from '../../../helpers/sessionStore';
import { getBankIds } from '../../helpers/bankUUID';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const authenticate2 = async (req: any, res: any) => {
  try {
    const deviceUId = inputSanitizer.getString(req.body?.deviceId);
    const passwordChallengeResponse = inputSanitizer.getString(req.body?.passwordChallengeResponse);
    const deviceChallengeResponse = inputSanitizer.getString(req.body?.deviceChallengeResponse);
    const userEmail = inputSanitizer.getLowerCaseString(req.body?.userEmail);
    const bankIds = await getBankIds(req);

    if (!userEmail) {
      logError(req.body?.userEmail, 'authenticate2 fail: userEmail missing');
      return res.status(403).end();
    }
    if (!deviceUId) {
      logError(req.body?.userEmail, 'authenticate2 fail: deviceUID missing');
      return res.status(403).end();
    }
    if (!passwordChallengeResponse) {
      logError(req.body?.userEmail, 'authenticate2 fail: passwordChallengeResponse missing');
      return res.status(403).end();
    }
    if (!deviceChallengeResponse) {
      logError(req.body?.userEmail, 'authenticate2 fail: deviceChallengeResponse missing');
      return res.status(403).end();
    }

    const dbRes = await db.query(
      `SELECT
        u.encrypted_data_2 AS encrypted_data_2,
        u.deactivated AS deactivated,
        ud.id AS did,
        ud.last_password_challenge_submission_date AS last_password_challenge_submission_date,
        ud.password_challenge_error_count AS password_challenge_error_count,
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

    if (!dbRes || dbRes.rowCount === 0 || dbRes.rows[0].deactivated) {
      logInfo(
        req.body?.userEmail,
        'authenticate2 fail: no matching authorized device for this user',
      );
      return res.status(401).end();
    }
    const {
      did,
      device_public_key_2,
      last_password_challenge_submission_date,
      session_auth_challenge_exp_time,
      password_challenge_error_count,
      encrypted_data_2,
      session_auth_challenge,
    } = dbRes.rows[0];

    // 1 - check device uses the new cryptographic authentication mechanism
    if (!device_public_key_2) {
      logInfo(req.body?.userEmail, 'authenticate2 fail: device_public_key_2 not found');
      return res.status(401).end();
    }

    // 2 - check that the user is not temporarily blocked
    let pwdErrorCount = password_challenge_error_count || 0;
    const shouldResetPwdErrorCount = shouldResetPasswordErrorCount(
      last_password_challenge_submission_date,
    );
    if (shouldResetPwdErrorCount) {
      pwdErrorCount = 0;
    }
    let blockedUntilDate = getPasswordUnblockDate(
      last_password_challenge_submission_date,
      pwdErrorCount,
    );

    if (!!blockedUntilDate && blockedUntilDate.getTime() > Date.now()) {
      logInfo(req.body?.userEmail, 'authenticate2 fail: user is still temporarily blocked');
      return res.status(401).json({
        error: 'blocked',
        nextRetryDate: blockedUntilDate.toISOString(),
      });
    }

    // 3 - check that the session auth challenge has not expired
    if (
      !session_auth_challenge_exp_time ||
      !session_auth_challenge ||
      session_auth_challenge_exp_time.getTime() < Date.now()
    ) {
      logInfo(req.body?.userEmail, 'authenticate2 fail: auth challenged has expired');
      return res.status(403).json({ error: 'expired' });
    }

    // 4 - check Password challenge
    const { hasPassedPasswordChallenge } = await checkPasswordChallengeV2(
      encrypted_data_2,
      passwordChallengeResponse,
    );

    // 5 - check Device challenge
    const hasPassedDeviceChallenge = await checkDeviceChallengeV2(
      session_auth_challenge,
      deviceChallengeResponse,
      device_public_key_2,
    );

    const success = hasPassedPasswordChallenge && hasPassedDeviceChallenge;
    if (success) {
      await db.query(
        'UPDATE user_devices SET session_auth_challenge=null, session_auth_challenge_exp_time=null, password_challenge_error_count=0, last_password_challenge_submission_date=null WHERE id=$1',
        [did],
      );
      const deviceSession = await SessionStore.createSession({
        bankId: bankIds.internalId,
        deviceUniqueId: deviceUId,
        userEmail,
      });
      logInfo(req.body?.userEmail, 'authenticate2 OK');
      return res.status(200).json({
        success,
        deviceSession,
      });
    } else {
      if (!hasPassedPasswordChallenge) {
        pwdErrorCount += 1;
        const now = new Date();
        blockedUntilDate = getPasswordUnblockDate(now, pwdErrorCount);
        await db.query(
          'UPDATE user_devices SET password_challenge_error_count=$3, last_password_challenge_submission_date=$4 WHERE id=$1 AND bank_id=$2',
          [did, bankIds.internalId, pwdErrorCount, now.toISOString()],
        );
        if (blockedUntilDate) {
          logInfo(req.body?.userEmail, 'authenticate2 fail: wrong password, user blocked');
          return res.status(401).json({
            error: 'blocked',
            nextRetryDate: blockedUntilDate.toISOString(),
          });
        } else {
          logInfo(req.body?.userEmail, 'authenticate2 fail: password authentication failed');
          return res.status(401).json({ error: 'bad_password' });
        }
      } else {
        logInfo(req.body?.userEmail, 'authenticate2 fail: device authentication failed');
        // this occurs too often
        return res.status(401).json({ error: 'bad_device_challenge_response' });
      }
    }
  } catch (e) {
    logError(req.body?.userEmail, 'authenticate', e);
    return res.status(400).end();
  }
};
