import Joi from 'joi';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import { Request, Response } from 'express';

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

    try {
      await db.query('BEGIN');
      // remove previous shamir backup
      await db.query('DELETE FROM shamir_shares WHERE vault_id=$1', [basicAuth.userId]);
      for (let i = 0; i < validatedBody.holderShares.length; i++) {
        // EXTRA SECURITY: before storing shamir shares, make sure we are complying with
        // the expected number of shares per holder.
        const checkNbShares = await db.query(
          'SELECT nb_shares FROM shamir_holders WHERE vault_id=$1 AND shamir_config_id=$2',
          [validatedBody.holderShares[i].holderId, validatedBody.shamirConfigId],
        );
        if (
          checkNbShares.rows[0] &&
          checkNbShares.rows[0].nb_shares !== validatedBody.holderShares[i].closedShares.length
        ) {
          throw new Error('upsertShamirBackup: Incorrect closedShares length.');
        }

        await db.query(
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
      await db.query(
        `UPDATE shamir_recovery_requests
        SET status='ABORTED'
        FROM user_devices
        WHERE
          shamir_recovery_requests.device_id=user_devices.id
          AND shamir_recovery_requests.status='PENDING'
          AND user_devices.user_id=$1
          AND shamir_recovery_requests.shamir_config_id=$2`,
        [basicAuth.userId, validatedBody.shamirConfigId],
      );
      await db.query('COMMIT');
    } catch (e) {
      logError(req.body?.userEmail, e);
      await db.query('ROLLBACK');
      res.status(403).json({ error: 'backup_creation_failed' });
      return;
    }

    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'upsertShamirBackup', e);
    res.status(400).end();
    return;
  }
};
