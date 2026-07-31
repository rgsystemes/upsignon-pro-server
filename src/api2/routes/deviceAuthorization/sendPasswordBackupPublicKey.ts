import { Request, Response } from 'express';
import Joi from 'joi';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkDeviceAuth } from '../../helpers/authorizationChecks';
import { usesPasswordlessUnlockForEmail } from '../authentication/usesPasswordlessUnlock';

// Lets an already-AUTHORIZED device (re)send its password backup public key once proven
// authentic via a deviceOnlySession. This is needed for SSO device pairing.
export const sendPasswordBackupPublicKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuth = await checkDeviceAuth(req);
    if (!deviceAuth.granted) {
      logInfo(req.body?.userEmail, 'sendPasswordBackupPublicKey fail: device auth not granted');
      res.status(401).json({ error: 'badDeviceSession' });
      return;
    }

    const joiRes = Joi.object({
      devicePasswordBackupPublicKey: Joi.string().required(),
    })
      .unknown(true)
      .validate(req.body);
    if (joiRes.error) {
      res.status(400).json({ error: joiRes.error.details });
      return;
    }
    const { devicePasswordBackupPublicKey } = joiRes.value;

    const usesPasswordless = await usesPasswordlessUnlockForEmail(
      deviceAuth.vaultEmail,
      deviceAuth.bankIds.internalId,
    );
    if (!usesPasswordless) {
      logInfo(req.body?.userEmail, 'sendPasswordBackupPublicKey OK (not passwordless, ignored)');
      res.status(200).end();
      return;
    }

    // No-op if a key is already stored or a backup was already approved for this device: this
    // only ever fills in a key that was withheld while pending an admin check.
    await db.query(
      `UPDATE user_devices SET password_backup_public_key=$1
        WHERE id=$2 AND authorization_status='AUTHORIZED' AND password_backup_public_key IS NULL
          AND (encrypted_password_backup_2 IS NULL OR encrypted_password_backup_2 = '')`,
      [devicePasswordBackupPublicKey, deviceAuth.deviceId],
    );
    logInfo(req.body?.userEmail, 'sendPasswordBackupPublicKey OK');
    res.status(200).end();
  } catch (e) {
    logError(req.body?.userEmail, 'sendPasswordBackupPublicKey', e);
    res.status(400).end();
  }
};
