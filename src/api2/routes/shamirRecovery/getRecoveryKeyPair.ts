import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkDeviceAuth } from '../../helpers/authorizationChecks';
import Joi from 'joi';
import { checkPasswordChallengeV2 } from '../../helpers/passwordChallengev2';

export const getRecoveryKeyPair = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuth = await checkDeviceAuth(req);
    if (!deviceAuth.granted) {
      logInfo(req.body?.userEmail, 'getRecoveryKeyPair fail: device auth not granted');
      res.status(401).json({ error: 'badDeviceSession' });
      return;
    }
    const { vaultId } = deviceAuth;

    const expectedScheme = Joi.object({
      passwordChallengeResponse: Joi.string().required(),
    }).unknown();

    let validatedBody: {
      passwordChallengeResponse: string;
    };
    try {
      validatedBody = Joi.attempt(req.body, expectedScheme);
    } catch (err) {
      logInfo(req.body?.userEmail, err);
      res.status(403).end();
      return;
    }

    const protectedRecoveryKeyResult = await db.query(
      `SELECT protected_recovery_key_pair FROM shamir_recovery_requests WHERE status='PENDING' AND expiry_date > current_timestamp(0) AND vault_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [vaultId],
    );
    if (protectedRecoveryKeyResult.rows.length === 0) {
      res.status(400).end();
      return;
    }
    const protectedRecoveryKey = protectedRecoveryKeyResult.rows[0].protected_recovery_key_pair;

    // Verify the password challenge response
    const { hasPassedPasswordChallenge } = await checkPasswordChallengeV2(
      protectedRecoveryKey,
      validatedBody.passwordChallengeResponse,
    );
    if (!hasPassedPasswordChallenge) {
      res.status(401).end();
      return;
    }

    res.status(200).json({ protectedRecoveryKey });
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'getRecoveryKeyPair', e);
    res.status(400).end();
    return;
  }
};
