import libsodium from 'libsodium-wrappers';
import { fromBase64, toBase64 } from './base64Convert';

export const createPasswordChallengeV2 = (
  encryptedDataString: string,
): {
  dataFormat: string;
  pwdChallengeBase64: string;
  pwdDerivationSaltBase64: string;
  derivationAlgorithm: string;
  cpuCost: number;
  memoryCost: number;
} => {
  if (encryptedDataString.startsWith('formatP002-')) {
    // data = 'formatP002-derivationAlgoName-derivationCpuCost-derivationMemoryCost-derivationSalt-passwordChallenge-passwordChallengeExpectedResponse-nonce-cipherText'
    const parts = encryptedDataString.split('-');

    return {
      pwdChallengeBase64: parts[5],
      dataFormat: 'formatP002',
      pwdDerivationSaltBase64: parts[4],
      derivationAlgorithm: parts[1],
      cpuCost: parseInt(parts[2]),
      memoryCost: parseInt(parts[3]),
    };
  } else if (encryptedDataString.startsWith('formatP003-')) {
    // data = 'formatP003-derivationAlgoName-derivationCpuCost-derivationMemoryCost-derivationSalt-passwordChallenge-passwordChallengeExpectedResponse-nonce-cipherText'
    const parts = encryptedDataString.split('-');

    return {
      pwdChallengeBase64: parts[5],
      dataFormat: 'formatP003',
      pwdDerivationSaltBase64: parts[4],
      derivationAlgorithm: parts[1],
      cpuCost: parseInt(parts[2]),
      memoryCost: parseInt(parts[3]),
    };
  }
  throw Error('Calling createPasswordChallengeV2 with a data format that is not formatP002-');
};

export const shouldResetPasswordErrorCount = (
  last_password_challenge_submission_date: Date | null,
): boolean => {
  if (last_password_challenge_submission_date == null) return false;
  // return true if the last failed attempt is more than 1 hour old.
  return Date.now() - last_password_challenge_submission_date.getTime() > 3600 * 1000;
};
export const getPasswordUnblockDate = (
  last_password_challenge_submission_date: Date | null,
  password_error_count: number,
): Date | null => {
  if (last_password_challenge_submission_date == null) return null;
  const MAX_FREE_TRIALS = 3;

  // Wait one minute for first next trial after 3, two more minutes for second next trial etc.
  // This is exponential on purpose.
  const minutesToWait = Math.max(0, password_error_count - MAX_FREE_TRIALS + 1);

  if (minutesToWait === 0) return null;

  const blockedUntil = new Date();
  blockedUntil.setTime(
    last_password_challenge_submission_date.getTime() + minutesToWait * 60 * 1000,
  );
  return blockedUntil;
};

export const checkPasswordChallengeV2 = async (
  encryptedData: string,
  passwordChallengeResponse: string,
): Promise<{ hasPassedPasswordChallenge: boolean }> => {
  if (!encryptedData.startsWith('formatP002-') && !encryptedData.startsWith('formatP003-')) {
    throw Error(
      'Calling checkPasswordChallengeV2 with a data format that is not formatP002- nor formatP003-',
    );
  }
  // data = 'formatP003-derivationAlgoName-derivationCpuCost-derivationMemoryCost-derivationSalt-passwordChallenge-passwordChallengeExpectedResponse-nonce-cipherText'

  const parts = encryptedData.split('-');
  const hashedPwdChallengeResponse = libsodium.crypto_generichash(
    libsodium.crypto_generichash_BYTES,
    fromBase64(passwordChallengeResponse),
  );

  let hasPassedPasswordChallenge = libsodium.memcmp(
    fromBase64(parts[6]),
    hashedPwdChallengeResponse,
  );

  return { hasPassedPasswordChallenge };
};

export const hashPasswordChallengeResultForSecureStorageV2 = (
  encryptedDataString: string,
): string => {
  if (
    !encryptedDataString.startsWith('formatP002-') &&
    !encryptedDataString.startsWith('formatP003-')
  ) {
    throw Error(
      'Calling hashPasswordChallengeResultForSecureStorageV2 with a data format that is not formatP002- nor formatP003-',
    );
  }
  // data = 'formatP003-derivationAlgoName-derivationCpuCost-derivationMemoryCost-derivationSalt-passwordChallenge-passwordChallengeExpectedResponse-nonce-cipherText'

  const parts = encryptedDataString.split('-');
  parts[6] = toBase64(
    libsodium.crypto_generichash(libsodium.crypto_generichash_BYTES, fromBase64(parts[6])),
  );
  return parts.join('-');
};
