import { db } from '../../../helpers/db';
import env from '../../../helpers/env';
import { logError, logInfo } from '../../../helpers/logger';
import { getBankIds } from '../../helpers/bankUUID';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const getBankConfig = async (req: any, res: any): Promise<void> => {
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
      return res.status(400).end();
    }
    logInfo(req.body?.userEmail, 'getBankConfig OK');
    return res.status(200).json({
      newUrl:
        bankRes.rows[0].redirect_url ||
        (bankIds.usesDeprecatedIntId
          ? `https://${env.API_PUBLIC_HOSTNAME}/${bankIds.publicId}`
          : null),
      bankName: bankRes.rows[0].name,
      preventUpdatePopup: bankRes.rows[0]?.settings?.PREVENT_UPDATE_POPUP || false,
      ssoConfigs: bankRes.rows[0]?.sso_configs,
    });
  } catch (e) {
    logError('getBankConfig', e);
    return res.status(400).end();
  }
};
