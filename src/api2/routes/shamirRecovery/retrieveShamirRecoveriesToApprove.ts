import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';

export const retrieveShamirRecoveriesToApprove = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const basicAuth = await checkBasicAuth2(req, { returningDeviceId: true });
    if (!basicAuth.granted) {
      logInfo(req.body?.userEmail, 'retrieveShamirRecoveriesToApprove fail: auth not granted');
      res.status(401).end();
      return;
    }

    const pendingRecoveryRequestsRes = await db.query(
      `SELECT
        ss.vault_id AS user_vault_id,
        u.email AS email,
        ud.device_name,
        ud.os_family,
        ud.device_type,
        ud.device_public_key_2 AS device_public_key,
        b.name AS bank_name,
        sc.name AS config_name,
        sc.min_shares AS config_min_shares,
        sh.nb_shares,
        ss.shamir_config_id,
        ss.closed_shares,
        srr.created_at AS requested_at
      FROM shamir_recovery_requests AS srr
      INNER JOIN user_devices AS ud ON ud.id = srr.device_id
      INNER JOIN users AS u ON u.id = ud.user_id
      INNER JOIN banks AS b ON b.id = ud.bank_id
      INNER JOIN shamir_shares AS ss ON ss.vault_id = u.id AND ss.shamir_config_id=srr.shamir_config_id
      INNER JOIN shamir_configs AS sc ON sc.id = srr.shamir_config_id
      INNER JOIN shamir_holders AS sh ON sh.vault_id=ss.holder_vault_id AND sh.shamir_config_id=ss.shamir_config_id
      WHERE
        srr.status='PENDING'
        AND ud.authorization_status = 'AUTHORIZED'
        AND ss.holder_vault_id = $1
      `,
      [basicAuth.userId],
    );

    res.status(200).json({
      pendingRecoveryRequests: pendingRecoveryRequestsRes.rows.map((prr) => ({
        userVaultId: prr.user_vault_id,
        email: prr.email,
        deviceName: prr.device_name,
        osFamily: prr.os_family,
        deviceType: prr.device_type,
        devicePublicKey: prr.device_public_key,
        bankName: prr.bank_name,
        configName: prr.config_name,
        configMinShares: prr.config_min_shares,
        nbShares: prr.nb_shares,
        shamirConfigId: prr.shamir_config_id,
        closedShares: prr.closed_shares,
        requestedAt: prr.requested_at,
      })),
    });
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'retrieveShamirRecoveriesToApprove', e);
    res.status(400).end();
    return;
  }
};
