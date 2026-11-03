import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { getBankIds } from '../../helpers/bankUUID';

export const getBankConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const bankIds = await getBankIds(req);
    const bankRes = await db.query(
      `SELECT
        b.name,
        b.redirect_url,
        b.settings,
        COALESCE(
          json_agg(
            json_build_object(
              'openid_configuration_url', sso.openid_configuration_url,
              'client_id', sso.client_id
            )
          ) FILTER (WHERE sso.id IS NOT NULL),
          '[]'
        ) AS sso_configs
      FROM banks AS b
      LEFT JOIN bank_sso_config AS sso ON sso.bank_id = b.id
      WHERE b.id = $1
      GROUP BY b.id`,
      [bankIds.internalId],
    );
    if (bankRes.rowCount === 0) {
      logInfo(req.body?.userEmail, 'getBankConfig fail: bad bank');
      res.status(400).end();
      return;
    }
    logInfo(req.body?.userEmail, 'getBankConfig OK');
    res.status(200).json({
      newUrl: bankRes.rows[0].redirect_url,
      bankName: bankRes.rows[0].name,
      preventUpdatePopup: bankRes.rows[0]?.settings?.PREVENT_UPDATE_POPUP || false,
      ssoConfigs: bankRes.rows[0]?.sso_configs.length == 0 ? null : bankRes.rows[0]?.sso_configs,
    });
    return;
  } catch (e) {
    logError('getBankConfig', e);
    res.status(400).end();
    return;
  }
};
