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
        b.name AS bank_name,
        ss.shamir_config_id,
        ss.closed_shares,
        srr.public_key,
        srr.created_at AS requested_at,
        srr.expiry_date AS expiry_date
      FROM shamir_recovery_requests AS srr
      INNER JOIN user_devices AS ud ON ud.id = srr.device_id
      INNER JOIN users AS u ON u.id = ud.user_id
      INNER JOIN banks AS b ON b.id = ud.bank_id
      INNER JOIN shamir_shares AS ss ON ss.vault_id = u.id AND ss.shamir_config_id=srr.shamir_config_id
      INNER JOIN shamir_configs AS sc ON sc.id = srr.shamir_config_id
      INNER JOIN shamir_holders AS sh ON sh.vault_id=ss.holder_vault_id AND sh.shamir_config_id=ss.shamir_config_id
      WHERE
        srr.status='PENDING'
        AND srr.expiry_date > current_timestamp(0)
        AND (ss.open_shares IS NULL OR ARRAY_LENGTH(ss.open_shares, 1) < ARRAY_LENGTH(ss.closed_shares, 1))
        AND ud.authorization_status = 'AUTHORIZED'
        AND ss.holder_vault_id = $1
        AND NOT($1 = ANY(srr.denied_by))
      `,
      [basicAuth.userId],
    );

    const amIShamirTrustedPersonRes = await db.query(
      `SELECT
      (EXISTS(SELECT 1
        FROM shamir_configs as sc
        INNER JOIN shamir_holders as sh ON sh.shamir_config_id = sc.id
        WHERE sc.is_active AND sh.vault_id=$1)) OR
      (EXISTS(SELECT 1
        FROM shamir_shares as ss
        WHERE ss.holder_vault_id=$1)) as is_trusted_person
      `,
      [basicAuth.userId],
    );

    res.status(200).json({
      isShamirTrustedPerson: amIShamirTrustedPersonRes.rows[0].is_trusted_person,
      pendingRecoveryRequests: pendingRecoveryRequestsRes.rows.map((prr) => ({
        userVaultId: prr.user_vault_id,
        email: prr.email,
        deviceName: prr.device_name,
        osFamily: prr.os_family,
        deviceType: prr.device_type,
        devicePublicKey: prr.public_key,
        bankName: prr.bank_name,
        shamirConfigId: prr.shamir_config_id,
        closedShares: prr.closed_shares,
        requestedAt: prr.requested_at,
        expiryDate: prr.expiry_date,
      })),
    });
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'retrieveShamirRecoveriesToApprove', e);
    res.status(400).end();
    return;
  }
};
