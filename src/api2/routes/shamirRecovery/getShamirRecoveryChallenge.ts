import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkDeviceAuth } from '../../helpers/authorizationChecks';
import { createPasswordChallengeV2 } from '../../helpers/passwordChallengev2';

export const getShamirRecoveryChallenge = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuth = await checkDeviceAuth(req);
    if (!deviceAuth.granted) {
      logInfo(req.body?.userEmail, 'getShamirRecoveryChallenge fail: device auth not granted');
      res.status(401).json({ error: 'badDeviceSession' });
      return;
    }
    const { vaultId } = deviceAuth;
    const protectedRecoveryKeyResult = await db.query(
      `SELECT protected_recovery_key_pair FROM shamir_recovery_requests WHERE status='PENDING' AND expiry_date > current_timestamp(0) AND vault_id=$1 ORDER BY created_at LIMIT 1`,
      [vaultId],
    );
    if (protectedRecoveryKeyResult.rows.length === 0) {
      res.status(400).end();
      return;
    }
    const protectedRecoveryKey = protectedRecoveryKeyResult.rows[0].protected_recovery_key_pair;
    const passwordChallenge = createPasswordChallengeV2(protectedRecoveryKey);

    res.status(200).json({
      passwordChallenge: passwordChallenge.pwdChallengeBase64,
      passwordDerivationSalt: passwordChallenge.pwdDerivationSaltBase64,
      dataFormat: passwordChallenge.dataFormat,
      derivationAlgorithm: passwordChallenge.derivationAlgorithm,
      cpuCost: passwordChallenge.cpuCost,
      memoryCost: passwordChallenge.memoryCost,
    });
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'getShamirRecoveryChallenge', e);
    res.status(400).end();
    return;
  }
};
