import Joi from 'joi';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import { Request, Response } from 'express';
import { getSupportEmail } from './_supportEmail';
import { getShareholdersEmailsForVault } from './_trustedPersonsEmails';
import { sendShamirRecoveryRequestCancelledToTrustedPersons } from '../../../emails/shamir/sendShamirRecoveryRequestCancelled';

export const upsertShamirBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedBodyScheme = Joi.object({
      userEmail: Joi.string().email().required(),
      deviceSession: Joi.string().required(),
      deviceId: Joi.string().required(),
      shamirConfigId: Joi.number().required(),
      holderShares: Joi.array()
        .items(
          Joi.object({
            holderId: Joi.number().required(),
            closedShares: Joi.array().items(Joi.string()).required(),
          }),
        )
        .required(),
    });

    let validatedBody: {
      userEmail: string;
      deviceSession: string;
      deviceId: string;
      shamirConfigId: number;
      holderShares: { holderId: number; closedShares: string[] }[];
    };
    try {
      validatedBody = Joi.attempt(req.body, validatedBodyScheme);
    } catch (err) {
      logInfo(req.body?.userEmail, err);
      res.status(403).end();
      return;
    }

    const basicAuth = await checkBasicAuth2(req);
    if (!basicAuth.granted) {
      logInfo(validatedBody.userEmail, 'upsertShamirBackup fail: auth not granted');
      res.status(401).end();
      return;
    }

    const transactionalClient = await db.getTransactionClient();
    try {
      await transactionalClient.begin();
      // remove previous shamir backup
      await transactionalClient.query('DELETE FROM shamir_shares WHERE vault_id=$1', [
        basicAuth.userId,
      ]);
      for (let i = 0; i < validatedBody.holderShares.length; i++) {
        // EXTRA SECURITY: before storing shamir shares, make sure we are complying with
        // the expected number of shares per holder.
        const checkNbShares = await transactionalClient.query(
          'SELECT nb_shares FROM shamir_holders WHERE vault_id=$1 AND shamir_config_id=$2',
          [validatedBody.holderShares[i].holderId, validatedBody.shamirConfigId],
        );
        if (
          !checkNbShares.rows[0] ||
          checkNbShares.rows[0].nb_shares !== validatedBody.holderShares[i].closedShares.length
        ) {
          throw new Error('upsertShamirBackup: Incorrect closedShares length.');
        }

        await transactionalClient.query(
          `INSERT INTO shamir_shares
          (vault_id, shamir_config_id, holder_vault_id, closed_shares)
          VALUES ($1, $2, $3, $4)
          `,
          [
            basicAuth.userId,
            validatedBody.shamirConfigId,
            validatedBody.holderShares[i].holderId,
            validatedBody.holderShares[i].closedShares,
          ],
        );
      }
      // abort all recovery requests that were pending for this user and config
      const updatedRecoveryRequests = await transactionalClient.query(
        `UPDATE shamir_recovery_requests
        SET status='ABORTED'
        WHERE
          vault_id=$1
          AND status='PENDING'
          AND shamir_config_id=$2
        RETURNING id`,
        [basicAuth.userId, validatedBody.shamirConfigId],
      );
      await transactionalClient.commit();

      if (updatedRecoveryRequests.rows.length > 0) {
        const acceptLanguage = req.headers['accept-language'];
        const supportEmail = await getSupportEmail(basicAuth.userId);
        for (let i = 0; i < updatedRecoveryRequests.rows.length; i++) {
          const holdersEmails = await getShareholdersEmailsForVault(
            basicAuth.userId,
            updatedRecoveryRequests.rows[i].id,
          );
          await sendShamirRecoveryRequestCancelledToTrustedPersons({
            vaultEmail: basicAuth.userEmail,
            trustedPersonEmails: holdersEmails,
            supportEmail,
            acceptLanguage,
          });
        }
      }
    } catch (e) {
      logError(req.body?.userEmail, e);
      await transactionalClient.rollback();
      res.status(403).json({ error: 'backup_creation_failed' });
      return;
    } finally {
      transactionalClient.release();
    }

    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'upsertShamirBackup', e);
    res.status(400).end();
    return;
  }
};
