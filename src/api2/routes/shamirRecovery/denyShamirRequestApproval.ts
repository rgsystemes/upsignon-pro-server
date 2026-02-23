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
      `UPDATE shamir_recovery_requests AS srr
        SET denied_by=array_append(denied_by, $1)
      FROM shamir_shares AS ss
      WHERE
        ss.vault_id=srr.vault_id
        AND srr.status='PENDING'
        AND srr.expiry_date > current_timestamp(0)
        AND NOT($1 = ANY(srr.denied_by))
        AND ss.holder_vault_id=$1
        AND ss.vault_id=$2
        AND ss.shamir_config_id=$3
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
