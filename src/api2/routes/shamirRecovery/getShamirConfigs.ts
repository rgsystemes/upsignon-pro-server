import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';

export const getShamirConfigs = async (req: Request, res: Response): Promise<void> => {
  try {
    const authRes = await checkBasicAuth2(req);
    if (!authRes.granted) {
      logInfo(req.body?.userEmail, 'getShamirConfigs fail: auth not granted');
      res.status(401).end();
      return;
    }

    // - add orders to easily compare configurations
    // - needs_update indicates wether the current shamir shares for a user are up to date with eventual configuration changes.
    //   In particular, it is true when
    //     - the shamir backup has not been created for this particular config (COUNT(ss.*) = 0)
    //     - a new shareholder is added to a configuration (normally forbidden) (COUNT(ss.*) FILTER(WHERE closed_shares IS NULL) > 0)
    //     - the number of shares of a shareholder has been reduced (normally forbidden) (SUM(ARRAY_LENGTH(ss.closed_shares, 1)) < SUM(sh.nb_shares))
    const shamirConfigsRes = await db.query(
      `SELECT
        sc.id,
        sc.name,
        sc.min_shares,
        sc.is_active,
        sc.support_email,
        sc.creator_email,
        b.public_id,
        sc.created_at,
        sc.change,
        COALESCE(sc.change_signatures, '[]'::jsonb) as change_signatures,
        ARRAY_AGG(
          json_build_object(
            'id', sh.vault_id,
            'email', hu.email,
            'sharingPublicKey', hu.sharing_public_key_2,
            'signingPublicKey', hu.signing_public_key,
            'nbShares', sh.nb_shares
          )
        ) as holders,
        (COUNT(ss.*) = 0 OR COUNT(ss.*) FILTER(WHERE closed_shares IS NULL) > 0) AS needs_update
      FROM shamir_configs AS sc
      INNER JOIN banks AS b ON sc.bank_id=b.id
      INNER JOIN users AS u ON u.bank_id=sc.bank_id
      LEFT JOIN shamir_holders AS sh ON sh.shamir_config_id=sc.id
      LEFT JOIN users AS hu ON hu.id=sh.vault_id
      LEFT JOIN shamir_shares AS ss ON ss.shamir_config_id=sc.id AND ss.vault_id=u.id AND ss.holder_vault_id=sh.vault_id
      WHERE u.id=$1
      GROUP BY sc.id, b.id
      ORDER BY sc.created_at ASC
      `,
      [authRes.userId],
    );
    res.status(200).json(
      shamirConfigsRes.rows.map((sc) => ({
        id: sc.id,
        name: sc.name,
        minShares: sc.min_shares,
        isActive: sc.is_active,
        supportEmail: sc.support_email,
        creatorEmail: sc.creator_email,
        bankPublicId: sc.public_id,
        createdAt: sc.created_at,
        change: sc.change,
        changeSignatures: sc.change_signatures,
        holders: sc.holders,
        needsUpdate: sc.needs_update && sc.is_active, // no need to update backups for inactive configurations
      })),
    );
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'getShamirConfigs', e);
    res.status(400).end();
    return;
  }
};
