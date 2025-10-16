import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError } from '../../../helpers/logger';
import { authenticateDeviceWithChallenge } from '../../helpers/authorizationChecks';

export const retrieveOpenShamirShares = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceAuthRes = await authenticateDeviceWithChallenge(
      req,
      res,
      'retrieveOpenShamirShares',
    );
    if (deviceAuthRes == null) {
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
        AND srr.device_id=$1`,
      [deviceAuthRes.devicePrimaryId],
    );
    const minShares = configRes.rows[0]?.min_shares;
    if (!minShares) {
      res.status(401).json({ error: 'no_pending_recovery_request' });
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
        AND srr.device_id=$1
        AND ss.holder_vault_id != $2`,
      [deviceAuthRes.devicePrimaryId, deviceAuthRes.vaultId],
    );
    if (recoveryRequestRes.rows.length == 0) {
      res.status(401).json({ error: 'no_pending_recovery_request' });
      return;
    }

    const totalOpenShares = recoveryRequestRes.rows.reduce(
      (acc, val) => acc + (val.open_shares?.length || 0),
      0,
    );

    if (totalOpenShares < minShares) {
      res.status(200).json({
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
      openShares: recoveryRequestRes.rows.reduce(
        (acc, val) => [...acc, ...acc(val.open_shares || [])],
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
