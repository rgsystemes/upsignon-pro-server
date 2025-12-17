import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkDeviceAuth } from '../../helpers/authorizationChecks';

export const getShamirStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuth = await checkDeviceAuth(req);
    if (!deviceAuth.granted) {
      logInfo(req.body?.userEmail, 'abortShamirRecovery fail: device auth not granted');
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

    const configRes = await db.query(
      `SELECT
        sc.min_shares
      FROM shamir_configs AS sc
      INNER JOIN shamir_recovery_requests AS srr
        ON srr.shamir_config_id=sc.id
      WHERE
        srr.status='PENDING'
        AND srr.expiry_date > current_timestamp(0)
        AND srr.device_id=$1`,
      [deviceId],
    );
    const minShares = configRes.rows[0]?.min_shares;
    if (!minShares) {
      res.status(200).json({ status: 'no_pending_recovery_request' });
      return;
    }
    const recoveryRequestRes = await db.query(
      `SELECT
        u.email,
        sh.nb_shares,
        ss.closed_shares,
        ss.open_shares
      FROM shamir_recovery_requests AS srr
      INNER JOIN user_devices AS ud
        ON srr.device_id=ud.id
      INNER JOIN shamir_shares AS ss
        ON ud.user_id=ss.vault_id
      INNER JOIN shamir_holders AS sh
        ON sh.vault_id=ss.holder_vault_id AND sh.shamir_config_id=ss.shamir_config_id
      INNER JOIN users AS u
        ON u.id = sh.vault_id
      WHERE
        srr.status='PENDING'
        AND srr.expiry_date > current_timestamp(0)
        AND srr.device_id=$1
        AND ss.holder_vault_id != $2`,
      [deviceId, vaultId],
    );
    if (recoveryRequestRes.rows.length == 0) {
      res.status(200).json({ status: 'no_pending_recovery_request' });
      return;
    }

    const totalOpenShares = recoveryRequestRes.rows.reduce(
      (acc, val) => acc + (val.open_shares?.length || 0),
      0,
    );

    if (totalOpenShares < minShares) {
      res.status(200).json({
        status: 'pending',
        missingShares: minShares - totalOpenShares,
        nbOpenShares: totalOpenShares,
        holderStatuses: recoveryRequestRes.rows.map((h) => ({
          email: h.email,
          nbShares: h.nb_shares,
          open: h.open_shares?.length === h.nb_shares,
        })),
      });
      return;
    }
    res.status(200).json({
      status: 'ready',
      openShares: recoveryRequestRes.rows.reduce(
        (acc, val) => [...acc, ...(val.open_shares || [])],
        [],
      ),
    });
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'retrieveOpenShamirShares', e);
    res.status(400).end();
    return;
  }
};
