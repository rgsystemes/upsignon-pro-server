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

    // add orders to easily compare configurations
    const shamirConfigsRes = await db.query(
      `SELECT
        sc.id as id,
        sc.name as name,
        sc.min_shares as min_shares,
        ARRAY_AGG(
          json_build_object(
            'id', sh.id,
            'email', hu.email,
            'pub_key', hu.sharing_public_key_2,
            'nb_shares', sh.nb_shares
          )
        ) as holders,
        (COUNT(ss.*) = 0 OR COUNT(ss.*) FILTER(WHERE closed_shares IS NULL) > 0 OR SUM(ARRAY_LENGTH(ss.closed_shares, 1)) < SUM(sh.nb_shares)) AS needs_update
      FROM shamir_configs AS sc
      INNER JOIN users AS u ON u.id=$1 AND u.bank_id=sc.bank_id
      LEFT JOIN shamir_holders AS sh ON sh.shamir_config_id=sc.id
      LEFT JOIN users AS hu ON hu.id=sh.vault_id
      LEFT JOIN shamir_shares AS ss ON ss.shamir_config_id=sc.id AND ss.vault_id=u.id AND ss.holder_vault_id=sh.vault_id
      WHERE sc.is_active = true
      GROUP BY sc.id
      ORDER BY sc.id
      `,
      [authRes.userId],
    );
    res.status(200).json(shamirConfigsRes.rows);
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'getShamirConfigs', e);
    res.status(400).end();
    return;
  }
};
