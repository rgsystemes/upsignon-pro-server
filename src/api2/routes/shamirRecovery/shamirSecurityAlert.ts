import { Request, Response } from 'express';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import Joi from 'joi';
import { db } from '../../../helpers/db';
import { sendShamirSecurityAlertToAdmins } from '../../../emails/shamir/sendShamirSecurityAlertToAdmins';

/// Sends a security alert to all bank admins and superadmins
///
/// - requires an authenticated user
/// - sends an email alert only once
/// - always logs a warning
/// - sets the flag has_sent_shamir_security_alert to true on the bank
export const shamirSecurityAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    // 0 - basic auth
    const basicAuth = await checkBasicAuth2(req, { returningDeviceId: true });
    if (!basicAuth.granted) {
      logInfo(req.body?.userEmail, 'shamirSecurityAlert fail: auth not granted');
      res.status(401).end();
      return;
    }

    const expectedBody = Joi.object({
      brokenShamirChain: Joi.string().required(),
      bankName: Joi.string().required(),
      bankUrl: Joi.string().uri().required(),
    }).unknown();

    let safeBody: {
      brokenShamirChain: string;
      bankName: string;
      bankUrl: string;
    };
    try {
      safeBody = Joi.attempt(req.body, expectedBody);
    } catch (err) {
      logInfo(req.body?.userEmail, err);
      res.status(403).end();
      return;
    }
    logInfo(`SHAMIR SECURITY ALERT FOR BANK ${basicAuth.bankIds.internalId}`);

    const currentBankState = await db.query(
      "SELECT (last_shamir_security_alert_send_date IS NOT NULL AND last_shamir_security_alert_send_date >= current_timestamp(0) - interval '1 day') AS mail_sent_today FROM banks WHERE id=$1",
      [basicAuth.bankIds.internalId],
    );

    const hasAlreadySentSecurityAlertToday = currentBankState.rows[0].mail_sent_today;
    if (!hasAlreadySentSecurityAlertToday) {
      await sendShamirSecurityAlertToAdmins({
        bankId: basicAuth.bankIds.internalId,
        brokenShamirChain: safeBody.brokenShamirChain,
        bankName: safeBody.bankName,
        bankUrl: safeBody.bankUrl,
      });
      await db.query(
        'UPDATE banks SET last_shamir_security_alert_send_date = current_timestamp(0) WHERE id=$1',
        [basicAuth.bankIds.internalId],
      );
    }

    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'shamirSecurityAlert', e);
    res.status(400).end();
    return;
  }
};
