import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import Joi from 'joi';

export const openShamirShares = async (req: Request, res: Response): Promise<void> => {
  try {
    const expectedScheme = Joi.object({
      userEmail: Joi.string().email().required(),
      deviceSession: Joi.string().required(),
      deviceId: Joi.string().required(),
      targetVaultId: Joi.number().required(),
      shamirConfigId: Joi.number().required(),
      openShares: Joi.array().items(Joi.string()).required(),
    });

    let validatedBody: {
      userEmail: string;
      deviceSession: string;
      deviceId: string;
      targetVaultId: number;
      shamirConfigId: number;
      openShares: string[];
    };
    try {
      validatedBody = Joi.attempt(req.body, expectedScheme);
    } catch (err) {
      logInfo(req.body?.userEmail, err);
      res.status(403).end();
      return;
    }

    const basicAuth = await checkBasicAuth2(req, { returningDeviceId: true });
    if (!basicAuth.granted) {
      logInfo(req.body?.userEmail, 'openShamirShares fail: auth not granted');
      res.status(401).end();
      return;
    }

    const verifyRecoveryRequests = await db.query(
      `SELECT
        device_id
      FROM shamir_recovery_requests
      INNER JOIN user_devices ON user_devices.id=shamir_recovery_requests.device_id
      WHERE
        shamir_config_id=$1
        AND user_devices.user_id=$2
        AND status='PENDING'`,
      [validatedBody.shamirConfigId, validatedBody.targetVaultId],
    );
    if (verifyRecoveryRequests.rowCount == null || verifyRecoveryRequests.rowCount == 0) {
      res.status(403).json({ error: 'no_pending_recovery_request' });
      return;
    }

    await db.query(
      `UPDATE shamir_shares
      SET open_shares=$1, open_at=current_timestamp(0)
      WHERE vault_id=$2 AND holder_vault_id=$3 AND shamir_config_id=$4
      `,
      [
        validatedBody.openShares,
        validatedBody.targetVaultId,
        basicAuth.userId,
        validatedBody.shamirConfigId,
      ],
    );

    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'openShamirShares', e);
    res.status(400).end();
    return;
  }
};
