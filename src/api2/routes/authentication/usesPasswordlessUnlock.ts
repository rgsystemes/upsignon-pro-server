import { Request, Response } from 'express';
import Joi from 'joi';
import { getBankIds } from '../../helpers/bankUUID';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';

export const usesPasswordlessUnlock = async (req: Request, res: Response): Promise<void> => {
  try {
    const joiRes = Joi.object({ userEmail: Joi.string().email().lowercase().required() }).validate(
      req.body,
    );
    if (joiRes.error) {
      res.status(400).json({ error: joiRes.error.details });
      return;
    }
    const email = joiRes.value.userEmail;
    const bankIds = await getBankIds(req);
    const usesPasswordless = await usesPasswordlessUnlockForEmail(email, bankIds.internalId);
    if (usesPasswordless === null) {
      res.status(404).end();
      return;
    }

    res.status(200).json({
      usesPasswordlessUnlock: usesPasswordless,
    });
    return;
  } catch (e) {
    logError('usesPasswordlessUnlock', e);
    res.status(400).end();
    return;
  }
};

export const usesPasswordlessUnlockForEmail = async (
  email: string,
  bankId: number,
): Promise<boolean | null> => {
  const bankRes = await db.query(
    `SELECT
        b.ms_entra_vaults_use_passwordless_auth,
        EXISTS (SELECT 1 FROM bank_sso_config WHERE bank_id = b.id) AS sso_configured
      FROM banks AS b
      WHERE b.id = $1`,
    [bankId],
  );
  if (bankRes.rowCount === 0) {
    logInfo(email, 'usesPasswordlessUnlock fail: bad bank');
    return null;
  }

  const userRes = await db.query(
    `SELECT deactivated, ms_entra_id FROM users WHERE email = $1 AND bank_id = $2`,
    [email, bankId],
  );
  if ((userRes.rowCount ?? 0) === 0 || userRes.rows[0].deactivated) {
    logInfo(email, 'usesPasswordlessUnlock fail: email not found or deactivated');
    return null;
  }

  const msEntraPasswordless =
    bankRes.rows[0].sso_configured &&
    bankRes.rows[0].ms_entra_vaults_use_passwordless_auth &&
    (userRes.rowCount ?? 0) > 0 &&
    userRes.rows[0].ms_entra_id != null;

  const patternRes = await db.query(
    `SELECT 1 FROM allowed_emails
       WHERE bank_id = $1
       AND uses_passwordless_auth = true
       AND (
         (LEFT(pattern, 2) != '*@' AND pattern = $2) OR
         (LEFT(pattern, 2) = '*@' AND SPLIT_PART($2, '@', 2) = SUBSTRING(pattern FROM 3))
       )
       LIMIT 1`,
    [bankId, email],
  );
  const patternPasswordless = (patternRes.rowCount ?? 0) > 0;
  const usesPasswordlessUnlock = msEntraPasswordless || patternPasswordless;
  return usesPasswordlessUnlock;
};
