import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkDeviceAuth } from '../../helpers/authorizationChecks';
import { isShamirRecoveryRequestRefused } from './_isShamirRecoveryRequestRefused';

/**
 * Returns the status of the shamir recovery request for the authenticated user
 * Possible status values are:
 * - not_setup: the user has not set up shamir recovery
 * - no_pending_recovery_request: the user has set up shamir recovery but has no pending recovery request
 * - pending: the user has a pending recovery request that is waiting for more shares to be opened
 * - refused: the user had a pending recovery request that was refused by at least one trusted person
 * - ready: the user has a pending recovery request that has enough shares opened and is ready for recovery
 * @param req 
 * @param res 
 * @returns 
 */
export const getShamirStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuth = await checkDeviceAuth(req);
    if (!deviceAuth.granted) {
      logInfo(req.body?.userEmail, 'getShamirStatus fail: device auth not granted');
      res.status(401).json({ error: 'badDeviceSession' });
      return;
    }
    const { vaultId } = deviceAuth;

    const setupResult = await db.query(
      `SELECT
      sc.support_email
      FROM shamir_configs as sc
      INNER JOIN shamir_shares as ss
        ON ss.shamir_config_id = sc.id
      WHERE
        ss.vault_id=$1
      GROUP BY sc.id
      LIMIT 1
      `,
      [vaultId],
    );

    if (setupResult.rows.length === 0) {
      res.status(200).json({ status: 'not_setup' });
      return;
    }
    const supportEmail = setupResult.rows[0].support_email;

    const requestRes = await db.query(
      `SELECT
        srr.id,
        sc.min_shares,
        srr.created_at,
        srr.expiry_date,
        srr.expiry_date <= current_timestamp(0) as is_expired,
        COALESCE(ARRAY_AGG(ss.open_shares) FILTER (WHERE ss.open_shares IS NOT NULL), '{}') as open_shares
      FROM shamir_configs AS sc
      INNER JOIN shamir_recovery_requests AS srr
        ON srr.shamir_config_id=sc.id
      INNER JOIN shamir_shares AS ss
        ON srr.vault_id=ss.vault_id
        AND ss.holder_vault_id != srr.vault_id
      WHERE
        srr.status='PENDING'
        AND srr.vault_id=$1
      GROUP BY srr.id, sc.id
      ORDER BY srr.created_at DESC LIMIT 1`,
      [vaultId],
    );
    const recoveryRequest = requestRes.rows[0];
    if (!recoveryRequest) {
      res.status(200).json({ status: 'no_pending_recovery_request' });
      return;
    }

    const minShares = recoveryRequest.min_shares;

    const totalOpenShares = recoveryRequest.open_shares.reduce(
      (acc: number, val: string[]) => acc + (val.length || 0),
      0,
    );

    if (totalOpenShares < minShares) {
      const isRequestRefused = await isShamirRecoveryRequestRefused(recoveryRequest.id);
      res.status(200).json({
        status: isRequestRefused ? 'refused' : 'pending',
        supportEmail,
        createdAt: recoveryRequest.created_at,
        expiryDate: recoveryRequest.expiry_date,
      });
      return;
    }
    res.status(200).json({
      status: 'ready',
      openShares: recoveryRequest.open_shares.reduce(
        (acc: string[], val: string[]) => [...acc, ...(val || [])],
        [],
      ),
      supportEmail,
      createdAt: recoveryRequest.created_at,
      expiryDate: recoveryRequest.expiry_date,
    });
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'getShamirStatus', e);
    res.status(400).end();
    return;
  }
};
