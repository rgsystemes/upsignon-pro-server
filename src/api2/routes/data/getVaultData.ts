import { db } from '../../../helpers/db';
import { getDefaultSettingOrUserOverride } from '../../../helpers/getDefaultSettingOrUserOverride';
import { logError, logInfo } from '../../../helpers/logger';
import { inputSanitizer } from '../../../helpers/sanitizer';
import { IS_ACTIVE } from '../../../helpers/serverStatus';
import { SessionStore } from '../../../helpers/sessionStore';
import { getBankIds } from '../../helpers/bankUUID';

/**
 * Returns
 * - 401 or 400
 * - 404 if no user found
 * - 401 with authorizationStatus="PENDING"
 * - 200 with encryptedData
 */

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const getVaultData = async (req: any, res: any): Promise<void> => {
  try {
    if (!IS_ACTIVE) {
      return res.status(403);
    }
    let bankIds;
    try {
      bankIds = await getBankIds(req);
    } catch (e) {
      // bank may have been deleted, we need to send a revoked_by_admin response
      logError(req.body?.userEmail, 'getVaultData', e);
      return res.status(403).json({ error: 'revoked_by_admin' });
    }

    // Get params
    const deviceSession = inputSanitizer.getString(req.body?.deviceSession);
    const userEmail = inputSanitizer.getLowerCaseString(req.body?.userEmail);
    const deviceId = inputSanitizer.getString(req.body?.deviceId);

    // Check params
    if (!userEmail) {
      logInfo(req.body?.userEmail, 'getVaultData fail: missing userEmail');
      return res.status(403).end();
    }
    if (!deviceId) {
      logInfo(req.body?.userEmail, 'getVaultData fail: missing deviceId');
      return res.status(403).end();
    }
    if (!deviceSession) {
      logInfo(req.body?.userEmail, 'getVaultData fail: missing deviceSession');
      return res.status(401).end();
    }

    const isSessionOK = await SessionStore.checkSession(
      deviceSession,
      {
        userEmail,
        deviceUniqueId: deviceId,
        bankId: bankIds.internalId,
      },
      { deviceOnlyAuthAllowed: false },
    );
    if (!isSessionOK) {
      logInfo(req.body?.userEmail, 'getVaultData fail: session not valid');
      return res.status(401).end();
    }

    // Request DB
    const dbRes = await db.query(
      `SELECT
        users.id AS user_id,
        user_devices.id AS device_primary_id,
        user_devices.authorization_status AS authorization_status,
        users.encrypted_data_2 AS encrypted_data_2,
        users.updated_at AS updated_at,
        users.deactivated AS deactivated,
        char_length(user_devices.device_public_key_2) > 0 AS has_device_public_key_2,
        users.allowed_to_export AS allowed_to_export,
        banks.settings AS bank_settings,
        banks.stop_this_instance,
        users.allowed_offline_mobile AS allowed_offline_mobile,
        users.allowed_offline_desktop AS allowed_offline_desktop,
        user_devices.device_type AS device_type,
        user_devices.os_family AS os_family,
        user_devices.encrypted_password_backup_2
      FROM user_devices
      INNER JOIN users ON user_devices.user_id = users.id
      INNER JOIN banks ON banks.id = users.bank_id
      WHERE
        users.email=$1 AND
        user_devices.device_unique_id = $2 AND
        users.bank_id=$3`,
      [userEmail, deviceId, bankIds.internalId],
    );

    if (!dbRes || dbRes.rowCount === 0) {
      // Check if the email address has changed
      const emailChangeRes = await db.query(
        'SELECT user_id, new_email FROM changed_emails WHERE old_email=$1 AND bank_id=$2',
        [userEmail, bankIds.internalId],
      );
      if (emailChangeRes.rowCount === 0) {
        logInfo(req.body?.userEmail, 'getVaultData fail: device deleted');
        return res.status(403).json({ error: 'revoked' });
      } else {
        logInfo(req.body?.userEmail, 'getVaultData fail: email address changed');
        return res.status(403).json({ newEmailAddress: emailChangeRes.rows[0].new_email });
      }
    }
    if (dbRes.rows[0].stop_this_instance) {
      logInfo('instance stopped');
      return res.status(400).end();
    }
    if (dbRes.rows[0].authorization_status === 'REVOKED_BY_USER') {
      logInfo(req.body?.userEmail, 'getVaultData fail: revoked by user');
      return res.status(403).json({ error: 'revoked' });
    }
    if (dbRes.rows[0].authorization_status === 'REVOKED_BY_ADMIN' || dbRes.rows[0].deactivated) {
      logInfo(
        req.body?.userEmail,
        'getVaultData fail: device revoked by admin or user deactivated',
      );
      return res.status(403).json({ error: 'revoked_by_admin' });
    }

    if (dbRes.rows[0].authorization_status !== 'AUTHORIZED') {
      logInfo(req.body?.userEmail, 'getVaultData fail: status', dbRes.rows[0].authorization_status);
      return res.status(403).json({ authorizationStatus: dbRes.rows[0].authorization_status });
    }

    const sharedVaults = await getSharedVaults(dbRes.rows[0].user_id, bankIds.internalId);

    const userResultingSetting = getDefaultSettingOrUserOverride(
      dbRes.rows[0].bank_settings,
      dbRes.rows[0],
      dbRes.rows[0].os_family || dbRes.rows[0].device_type, // fallback to device_type which used to be where we stored os_family
    );

    // Return res
    res.status(200).json({
      encryptedData: dbRes.rows[0].encrypted_data_2,
      lastUpdatedAt: dbRes.rows[0].updated_at,
      allowedToExport: userResultingSetting.allowed_to_export,
      allowedOffline: userResultingSetting.allowed_offline,
      defaultAutolockDelay: userResultingSetting?.defaultAutolockDelay,
      maxAutolockDelay: userResultingSetting?.maxAutolockDelay,
      sharedVaults,
      needsPasswordBackup:
        !dbRes.rows[0].encrypted_password_backup_2 ||
        dbRes.rows[0].encrypted_password_backup_2.length == 512,
    });

    await db.query('UPDATE user_devices SET last_sync_date=$1 WHERE id=$2 AND bank_id=$3', [
      new Date().toISOString(),
      dbRes.rows[0].device_primary_id,
      bankIds.internalId,
    ]);
    // Clean changed_emails table if necessary
    cleanChangedEmails(dbRes.rows[0].user_id, deviceId, bankIds.internalId);
    logInfo(req.body?.userEmail, 'getVaultData OK');
  } catch (e) {
    logError(req.body?.userEmail, 'getVaultData', e);
    return res.status(400).end();
  }
};

export const getSharedVaults = async (
  userId: number,
  bankId: number,
): Promise<
  {
    id: number;
    name: string;
    isManager: boolean;
    accessLevel: boolean;
    encryptedData: string;
    encryptedKey: string;
    lastUpdatedAt: any;
  }[]
> => {
  const sharedVaultsRes = await db.query(
    `SELECT
      sv.id AS id,
      sv.name AS name,
      sv.encrypted_data AS encrypted_data,
      sv.last_updated_at AS last_updated_at,
      svr.is_manager AS is_manager,
      svr.access_level AS access_level,
      svr.encrypted_shared_vault_key AS encrypted_shared_vault_key
    FROM shared_vaults AS sv
    INNER JOIN shared_vault_recipients AS svr
    ON svr.shared_vault_id=sv.id
    WHERE svr.user_id=$1
    AND sv.bank_id=$2`,
    [userId, bankId],
  );
  return sharedVaultsRes.rows.map((s) => ({
    id: s.id,
    name: s.name,
    encryptedData: s.encrypted_data,
    lastUpdatedAt: s.last_updated_at,
    encryptedKey: s.encrypted_shared_vault_key,
    isManager: s.is_manager, // deprecated
    accessLevel: s.access_level,
  }));
};

const cleanChangedEmails = async (userId: number, deviceUniqueId: string, bankId: number) => {
  try {
    const changedEmails = await db.query(
      'SELECT aware_devices FROM changed_emails WHERE user_id = $1 AND bank_id=$2',
      [userId, bankId],
    );
    if (changedEmails.rowCount != null && changedEmails.rowCount > 0) {
      // get all devices for this user
      const devices = await db.query(
        'SELECT id, device_unique_id FROM user_devices WHERE user_id=$1 AND bank_id=$2',
        [userId, bankId],
      );

      let areAllDevicesAware = true;
      devices.rows.forEach(async (d) => {
        if (!changedEmails.rows[0].aware_devices.includes(d.id)) {
          if (d.device_unique_id === deviceUniqueId) {
            // do update all changed_emails for user_id and not only for changed_emails wher old_email = userEmail
            // because this will help make sure the database cleans itself automatically in the end
            await db.query(
              'UPDATE changed_emails SET aware_devices=$1 WHERE user_id=$2 AND bank_id=$3',
              [JSON.stringify([...changedEmails.rows[0].aware_devices, d.id]), userId, bankId],
            );
          } else {
            areAllDevicesAware = false;
          }
        }
      });
      if (areAllDevicesAware) {
        await db.query('DELETE FROM changed_emails WHERE user_id=$1 AND bank_id=$2', [
          userId,
          bankId,
        ]);
      }
    }
  } catch (e) {
    logError('cleanChangedEmails:', e);
  }
};
