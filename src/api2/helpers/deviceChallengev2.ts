import { db } from '../../helpers/db';
import libsodium from 'libsodium-wrappers';
import { fromBase64, toBase64 } from './base64Convert';
import { logError, logInfo } from '../../helpers/logger';

export const createDeviceChallengeV2 = async (deviceId: Number): Promise<string> => {
  const deviceChallenge = toBase64(libsodium.randombytes_buf(16));
  const updateRes = await db.query(
    "UPDATE user_devices SET session_auth_challenge=$1, session_auth_challenge_exp_time=current_timestamp(0)+interval '3 minutes' WHERE id=$2",
    [deviceChallenge, deviceId],
  );
  if (updateRes.rowCount !== 1) {
    throw new Error('Create device challenge db update error.');
  }
  return deviceChallenge;
};

export const checkDeviceChallengeV2 = async (
  challenge: string,
  challengeResponse: string,
  devicePublicKey: string,
): Promise<boolean> => {
  try {
    const publicKey = fromBase64(devicePublicKey);
    const deviceChallenge = fromBase64(challenge);
    const deviceChallengeResponseBytes = fromBase64(challengeResponse);

    let signedChallenge: Uint8Array;
    try {
      signedChallenge = libsodium.crypto_sign_open(deviceChallengeResponseBytes, publicKey);
    } catch (e) {
      logInfo('Invalid signature.');
      return false;
    }

    if (!libsodium.memcmp(deviceChallenge, signedChallenge)) {
      logInfo('Signature valid but challenge mismatch.');
      return false;
    }
    return true;
  } catch (e) {
    logError('checkDeviceChallengeV2', e);
    return false;
  }
};

export const checkDeviceRequestAuthorizationV2 = async (
  deviceChallengeResponse: string,
  deviceId: string,
  sessionAuthChallengeExpTime: null | Date,
  sessionAuthChallenge: null | string,
  devicePublicKey: string,
): Promise<boolean> => {
  if (!sessionAuthChallenge) {
    return false;
  }
  if (!sessionAuthChallengeExpTime || sessionAuthChallengeExpTime.getTime() < Date.now()) {
    return false;
  }
  const hasPassedDeviceChallenge = await checkDeviceChallengeV2(
    sessionAuthChallenge,
    deviceChallengeResponse,
    devicePublicKey,
  );
  if (!hasPassedDeviceChallenge) {
    return false;
  }

  // if device is authenticated, cleanup db
  await db.query(
    'UPDATE user_devices SET session_auth_challenge=null, session_auth_challenge_exp_time=null WHERE id=$1',
    [deviceId],
  );
  return true;
};
