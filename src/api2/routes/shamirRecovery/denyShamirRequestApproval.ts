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

    const recoveryRequestRes = await db.query(
      `SELECT srr.id, u.email
        FROM shamir_recovery_requests srr
        INNER JOIN users u ON srr.vault_id=u.id
        INNER JOIN shamir_shares ss
          ON srr.vault_id=ss.vault_id
          AND srr.shamir_config_id=ss.shamir_config_id
        WHERE
          ss.holder_vault_id = $1
          AND srr.vault_id = $2
          AND srr.shamir_config_id = $3
          AND srr.status = 'PENDING'
          AND srr.expiry_date > current_timestamp(0)
          AND NOT($1::integer = ANY(srr.denied_by))
        ORDER BY srr.created_at DESC LIMIT 1`,
      [basicAuth.userId, validatedBody.targetVaultId, validatedBody.shamirConfigId],
    );

    const recReq = recoveryRequestRes.rows[0];
    if (!recReq) {
      // ignore
      res.status(200).end();
      return;
    }

    const wasAlreadyRefused = await isShamirRecoveryRequestRefused(recReq.id);
    await db.query(
      `UPDATE shamir_recovery_requests
          SET denied_by = CASE
            WHEN denied_by IS NULL THEN ARRAY[$1::integer]
            WHEN NOT ($1::integer = ANY(denied_by)) THEN array_append(denied_by, $1::integer)
            ELSE denied_by
          END
        WHERE id = $2
        `,
      [basicAuth.userId, recReq.id],
    );

    // If the recovery request is now denied, send an email to the user
    const isRequestRefused = await isShamirRecoveryRequestRefused(recReq.id);
    if (isRequestRefused && !wasAlreadyRefused) {
      const supportEmail = await getSupportEmail(validatedBody.targetVaultId);
      const acceptLanguage = req.headers['accept-language'];
      await sendShamirRecoveryRequestDeniedToUser({
        vaultEmail: recReq.email,
        supportEmail,
        acceptLanguage,
      });
    }

    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'denyShamirRequestApproval', e);
    res.status(400).end();
    return;
  }
};
