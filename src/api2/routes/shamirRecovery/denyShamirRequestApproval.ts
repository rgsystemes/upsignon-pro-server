import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import Joi from 'joi';

export const denyShamirRequestApproval = async (req: Request, res: Response): Promise<void> => {
  try {
    const expectedScheme = Joi.object({
      userEmail: Joi.string().email().required(),
      deviceSession: Joi.string().required(),
      deviceId: Joi.string().required(),
      targetVaultId: Joi.number().required(),
      shamirConfigId: Joi.number().required(),
    });

    let validatedBody: {
      userEmail: string;
      deviceSession: string;
      deviceId: string;
      targetVaultId: number;
      shamirConfigId: number;
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
      logInfo(req.body?.userEmail, 'denyShamirRequestApproval fail: auth not granted');
      res.status(401).end();
      return;
    }

    await db.query(
      `UPDATE shamir_recovery_requests
        SET denied_by=array_append(denied_by, $1)
      FROM user_devices
      INNER JOIN shamir_shares
        ON shamir_shares.vault_id=user_devices.user_id
      WHERE
        shamir_recovery_requests.device_id=user_devices.id
        AND shamir_recovery_requests.status='PENDING'
        AND shamir_recovery_requests.expiry_date > current_timestamp(0)
        AND NOT($1 = ANY(shamir_recovery_requests.denied_by))
        AND shamir_shares.holder_vault_id=$1
        AND shamir_shares.vault_id=$2
        AND shamir_shares.shamir_config_id=$3
      `,
      [basicAuth.userId, validatedBody.targetVaultId, validatedBody.shamirConfigId],
    );

    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'denyShamirRequestApproval', e);
    res.status(400).end();
    return;
  }
};
