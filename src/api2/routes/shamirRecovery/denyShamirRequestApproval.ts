import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import Joi from 'joi';
import { isShamirRecoveryRequestRefused } from './_isShamirRecoveryRequestRefused';
import { sendShamirRecoveryRequestDeniedToUser } from '../../../emails/shamir/sendShamirRecoveryRequestDenied';
import { getSupportEmail } from './_supportEmail';

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

    const updatedRow = await db.query(
      `UPDATE shamir_recovery_requests
          SET denied_by = array_append(denied_by, $1)
          WHERE
            status = 'PENDING'
            AND expiry_date > current_timestamp(0)
            AND NOT($1 = ANY(denied_by))
            AND vault_id = $2
            AND $1 IN (
              SELECT holder_vault_id
              FROM shamir_shares
              WHERE vault_id = $2 AND shamir_config_id = $3
            )
          RETURNING id,
            (SELECT email FROM users WHERE id = vault_id) AS email
        `,
      [basicAuth.userId, validatedBody.targetVaultId, validatedBody.shamirConfigId],
    );

    // If the recovery request is now denied, send an email to the user
    if (updatedRow.rows.length !== 0) {
      const updatedReq = updatedRow.rows[0];
      const isRequestRefused = await isShamirRecoveryRequestRefused(updatedReq.id);
      if (isRequestRefused) {
        const supportEmail = await getSupportEmail(validatedBody.targetVaultId);
        const acceptLanguage = req.headers['accept-language'];
        await sendShamirRecoveryRequestDeniedToUser({
          vaultEmail: updatedReq.email,
          supportEmail,
          acceptLanguage,
        });
      }
    }

    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'denyShamirRequestApproval', e);
    res.status(400).end();
    return;
  }
};
