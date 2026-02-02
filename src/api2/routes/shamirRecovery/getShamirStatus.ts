import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkDeviceAuth } from '../../helpers/authorizationChecks';
import { isShamirRecoveryRequestRefused } from './_isShamirRecoveryRequestRefused';

export const getShamirStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuth = await checkDeviceAuth(req);
    if (!deviceAuth.granted) {
      logInfo(req.body?.userEmail, 'getShamirStatus fail: device auth not granted');
      res.status(401).end();
      return;
    }
    const { vaultId, deviceId } = deviceAuth;

    const setupResult = await db.query(
      `SELECT
      support_email
      FROM shamir_shares
      INNER JOIN shamir_configs as sc
        ON sc.id=shamir_shares.shamir_config_id
      WHERE
        vault_id=$1
      GROUP BY sc.id
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
      INNER JOIN user_devices AS ud
        ON srr.device_id=ud.id
      INNER JOIN shamir_shares AS ss
        ON ud.user_id=ss.vault_id
        AND ss.holder_vault_id != $2
      WHERE
        srr.status='PENDING'
        AND srr.device_id=$1
      GROUP BY srr.id, sc.id
      ORDER BY srr.created_at DESC LIMIT 1`,
      [deviceId, vaultId],
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
