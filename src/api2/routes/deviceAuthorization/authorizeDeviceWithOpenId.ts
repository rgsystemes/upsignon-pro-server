import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import {
  BANK_SETTINGS,
  USER_SETTINGS_OVERRIDE,
} from '../../../helpers/getDefaultSettingOrUserOverride';
import { isAllowedOnPlatform } from '../../../helpers/isAllowedOnPlatform';
import { getEmailAuthorizationStatus } from '../../helpers/emailAuthorization';
import { getBankIds } from '../../helpers/bankUUID';
import Joi from 'joi';
import { SessionStore } from '../../../helpers/sessionStore';
import { hasAvailableLicence } from '../../../helpers/licenceCheck';
import { Request, Response } from 'express';
import { usesPasswordlessUnlockForEmail } from '../authentication/usesPasswordlessUnlock';
import { sendDeviceRequestAdminEmail } from '../../../emails/sendDeviceRequestEmail';

// Authorizes a device purely on the strength of a valid OpenID session (SSO), regardless of
// whether this vault's master password is known to the user (passwordless/SSO vaults) or not.
// The device's public key is only ever sent here, once SSO succeeded — never up front.
//
// Being AUTHORIZED here only proves this device's identity (SSO + a freshly generated signing
// key) — it does NOT by itself grant access to the vault's actual data: on a passwordless vault
// that still requires either another already-authorized device to push a master password backup
// (see backup-password / getPendingSsoDevices) or a completed Shamir emergency recovery.
//
// If the bank has REQUIRE_ADMIN_CHECK_FOR_SECOND_DEVICE enabled and this is not the user's first
// device (see checkDevice2 for the equivalent email-flow gate), the device is left in
// USER_VERIFIED_PENDING_ADMIN_CHECK instead of AUTHORIZED. In that case its password backup
// public key is NOT stored: on a passwordless vault, a peer must never be able to discover and
// approve this device (see getPendingSsoDevices) before an admin has validated it.
export const authorizeDeviceWithOpenId = async (req: Request, res: Response) => {
  try {
    const bankIds = await getBankIds(req);

    const joiRes = Joi.object({
      userEmail: Joi.string().email().lowercase().required(),
      deviceId: Joi.string().required(),
      devicePublicKey: Joi.string().required(),
      deviceName: Joi.string().required(),
      deviceType: Joi.string(),
      osFamily: Joi.string().required(),
      osNameAndVersion: Joi.string().required(),
      installType: Joi.string().required(),
      appVersion: Joi.string().required(),
      openidSession: Joi.string().required(),
      devicePasswordBackupPublicKey: Joi.string(),
    }).validate(req.body);

    if (joiRes.error) {
      return res.status(400).json({ error: joiRes.error.details });
    }
    const safeBody = joiRes.value;

    const isOpenidSessionOK = await SessionStore.checkOpenIdSession(safeBody.openidSession, {
      userEmail: safeBody.userEmail,
      bankId: bankIds.internalId,
    });
    if (!isOpenidSessionOK) {
      logInfo(safeBody.userEmail, 'authorizeDeviceWithOpenId fail: invalid openidSession');
      return res.status(401).end();
    }

    let userRes = await db.query(
      `SELECT
        users.id AS id,
        users.deactivated AS deactivated,
        users.settings_override AS settings_override,
        users.encrypted_data_2 AS encrypted_data_2,
        banks.settings AS bank_settings
      FROM users INNER JOIN banks ON banks.id = users.bank_id
      WHERE users.email=$1 AND users.bank_id=$2`,
      [safeBody.userEmail, bankIds.internalId],
    );
    // whether this user's vault already has data (ie. this is not the first, vault-creation
    // device) — only an additional device on an already-created passwordless vault needs its
    // backup public key tracked, so a peer can discover and approve it.
    const hasVaultData = userRes.rowCount !== 0 && !!userRes.rows[0].encrypted_data_2;
    if (userRes.rows[0]?.deactivated) {
      return res.status(403).json({ error: 'user_deactivated' });
    }
    if (userRes.rowCount === 0) {
      const emailAuthStatusResponse = await getEmailAuthorizationStatus(
        safeBody.userEmail,
        bankIds.internalId,
      );
      if (emailAuthStatusResponse.status === 'UNAUTHORIZED') {
        logInfo(safeBody.userEmail, 'authorizeDeviceWithOpenId fail: email address not allowed');
        return res.status(403).json({ error: 'email_address_not_allowed' });
      }
      if (!(await hasAvailableLicence(bankIds.internalId))) {
        return res.status(403).json({ error: 'no_more_licence' });
      }
      userRes = await db.query(
        'INSERT INTO users (email, ms_entra_id, bank_id) VALUES ($1,$2,$3) RETURNING id',
        [safeBody.userEmail, emailAuthStatusResponse.msEntraId, bankIds.internalId],
      );
    }
    const userId = userRes.rows[0].id;

    const deviceRes = await db.query(
      'SELECT id FROM user_devices WHERE user_id=$1 AND device_unique_id=$2 AND bank_id=$3',
      [userId, safeBody.deviceId, bankIds.internalId],
    );
    const deviceInDb = deviceRes.rows[0];

    // Same admin-check gate as the email-based flow (see checkDevice2): if this bank requires it
    // and the user already has at least one other active device, this device is left pending
    // instead of being authorized outright.
    const otherActiveDevicesRes = await db.query(
      `SELECT COUNT(*) AS device_count FROM user_devices
        WHERE user_id=$1 AND bank_id=$2 AND device_unique_id != $3
          AND (authorization_status = 'AUTHORIZED' OR authorization_status = 'PENDING' OR
            authorization_status = 'USER_VERIFIED_PENDING_ADMIN_CHECK')`,
      [userId, bankIds.internalId, safeBody.deviceId],
    );
    const isAdditionalDevice =
      Number.parseInt(otherActiveDevicesRes.rows[0].device_count, 10) >= 1;
    const requiresAdminCheck =
      isAdditionalDevice && !!userRes.rows[0].bank_settings?.REQUIRE_ADMIN_CHECK_FOR_SECOND_DEVICE;
    const nextAuthorizationStatus = requiresAdminCheck
      ? 'USER_VERIFIED_PENDING_ADMIN_CHECK'
      : 'AUTHORIZED';

    // Only an additional device on an already-created passwordless vault needs its backup
    // public key stored, so a peer can discover it via getPendingSsoDevices and push it a master
    // password backup. On a non-passwordless vault, for the very first (vault-creation) device,
    // or while still pending an admin check, there is no such need (or it would be unsafe).
    const usesPasswordless = await usesPasswordlessUnlockForEmail(
      safeBody.userEmail,
      bankIds.internalId,
    );
    const passwordBackupPublicKeyToStore =
      hasVaultData && usesPasswordless && nextAuthorizationStatus === 'AUTHORIZED'
        ? safeBody.devicePasswordBackupPublicKey
        : null;

    if (!deviceInDb) {
      const userAllowedOnPlatform = isAllowedOnPlatform(
        safeBody.osFamily + safeBody.osNameAndVersion + safeBody.deviceType,
        userRes.rows[0].bank_settings as BANK_SETTINGS,
        userRes.rows[0].settings_override as USER_SETTINGS_OVERRIDE,
      );
      if (!userAllowedOnPlatform) {
        logInfo(
          safeBody.userEmail,
          `authorizeDeviceWithOpenId KO (not allowed on platform ${safeBody.osFamily})`,
        );
        return res.status(403).json({ error: 'os_not_allowed' });
      }
      await db.query(
        "INSERT INTO user_devices (user_id, device_name, device_type, install_type, os_family, os_version, app_version, device_unique_id, device_public_key_2, authorization_status, bank_id, enrollment_method, password_backup_public_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SSO',$12)",
        [
          userId,
          safeBody.deviceName,
          safeBody.deviceType,
          safeBody.installType,
          safeBody.osFamily,
          safeBody.osNameAndVersion,
          safeBody.appVersion,
          safeBody.deviceId,
          safeBody.devicePublicKey,
          nextAuthorizationStatus,
          bankIds.internalId,
          passwordBackupPublicKeyToStore,
        ],
      );
    } else {
      await db.query(
        "UPDATE user_devices SET (device_name, device_type, install_type, os_family, os_version, app_version, device_unique_id, device_public_key_2, authorization_status, enrollment_method, password_backup_public_key) = ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SSO',$10) WHERE id=$11",
        [
          safeBody.deviceName,
          safeBody.deviceType,
          safeBody.installType,
          safeBody.osFamily,
          safeBody.osNameAndVersion,
          safeBody.appVersion,
          safeBody.deviceId,
          safeBody.devicePublicKey,
          nextAuthorizationStatus,
          passwordBackupPublicKeyToStore,
          deviceInDb.id,
        ],
      );
    }

    if (requiresAdminCheck) {
      await sendDeviceRequestAdminEmail(safeBody.userEmail, bankIds.internalId);
      logInfo(safeBody.userEmail, 'authorizeDeviceWithOpenId OK (waiting for admin check)');
    } else {
      logInfo(safeBody.userEmail, 'authorizeDeviceWithOpenId OK');
    }
    return res.status(200).json({ authorizationStatus: nextAuthorizationStatus });
  } catch (e) {
    logError(req.body?.userEmail, 'authorizeDeviceWithOpenId', e);
    return res.status(400).end();
  }
};
