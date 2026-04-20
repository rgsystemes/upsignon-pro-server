import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import Joi from 'joi';
import { isShamirRecoveryRequestApproved } from './_isShamirRecoveryRequestApproved';
import { sendShamirRecoveryRequestReadyToUser } from '../../../emails/shamir/sendShamirRecoveryRequestReady';
import { getSupportEmail } from './_supportEmail';
import { getEmailForVaultId } from '../../helpers/getEmailForVaultId';

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

    const basicAuth = await checkBasicAuth2(req);
    if (!basicAuth.granted) {
      logInfo(req.body?.userEmail, 'openShamirShares fail: auth not granted');
      res.status(401).end();
      return;
    }

    const verifyRecoveryRequests = await db.query(
      `SELECT id
      FROM shamir_recovery_requests
      WHERE
        shamir_config_id=$1
        AND vault_id=$2
        AND status='PENDING'
        AND expiry_date > current_timestamp(0)`,
      [validatedBody.shamirConfigId, validatedBody.targetVaultId],
    );
    if (verifyRecoveryRequests.rowCount == null || verifyRecoveryRequests.rowCount == 0) {
      res.status(403).json({ error: 'no_pending_recovery_request' });
      return;
    }

    const wasAlreadyApproved = await isShamirRecoveryRequestApproved(validatedBody.targetVaultId);
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
    await db.query(
      `UPDATE shamir_recovery_requests
          SET approved_by = CASE
            WHEN approved_by IS NULL THEN ARRAY[$1]
            WHEN NOT ($1 = ANY(approved_by)) THEN array_append(approved_by, $1)
            ELSE approved_by
          END
        WHERE id = $2
        `,
      [basicAuth.userId, verifyRecoveryRequests.rows[0].id],
    );

    // If the request is now approved, send an email to the user
    const isApproved = await isShamirRecoveryRequestApproved(validatedBody.targetVaultId);
    if (isApproved && !wasAlreadyApproved) {
      const supportEmail = await getSupportEmail(validatedBody.targetVaultId);
      const acceptLanguage = req.headers['accept-language'];
      const vaultEmail = await getEmailForVaultId(validatedBody.targetVaultId);
      if (vaultEmail) {
        await sendShamirRecoveryRequestReadyToUser({
          vaultEmail,
          supportEmail,
          acceptLanguage,
        });
      }
    }
    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'openShamirShares', e);
    res.status(400).end();
    return;
  }
};
