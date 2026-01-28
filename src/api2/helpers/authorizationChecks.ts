import { Request, Response } from 'express';
import { db } from '../../helpers/db';
import { logError, logInfo } from '../../helpers/logger';
import { inputSanitizer } from '../../helpers/sanitizer';
import { SessionStore } from '../../helpers/sessionStore';
import { getBankIds, BankIds } from './bankUUID';
import Joi from 'joi';

export const checkBasicAuth2 = async (
  req: Request,
  options?: {
    returningUserPublicKey?: true;
    returningData?: true;
    returningDeviceId?: true;
    checkIsOwnerForVaultId?: number;
    checkIsEditorForVaultId?: number;
    checkIsRecipientForVaultId?: number;
  },
): Promise<
  | {
      userEmail: string;
      deviceUId: string;
      userId: number;
      sharingPublicKey: null | string;
      encryptedData: null | string;
      deviceId: null | number;
      granted: true;
      bankIds: BankIds;
    }
  | { granted: false }
> => {
  const bankIds = await getBankIds(req);

  const deviceSession = inputSanitizer.getString(req.body?.deviceSession);
  const userEmail = inputSanitizer.getLowerCaseString(req.body?.userEmail);
  const deviceUId = inputSanitizer.getString(req.body?.deviceId);

  if (!userEmail) {
    logInfo(req.body?.userEmail, 'checkBasicAuth2 fail: missing userEmail');
    return { granted: false };
  }
  if (!deviceUId) {
    logInfo(req.body?.userEmail, 'checkBasicAuth2 fail: missing deviceId');
    return { granted: false };
  }
  if (!deviceSession) {
    logInfo(req.body?.userEmail, 'checkBasicAuth2 fail: missing deviceSession');
    return { granted: false };
  }

  if (deviceSession) {
    const isSessionOK = await SessionStore.checkSession(
      deviceSession,
      {
        userEmail,
        deviceUniqueId: deviceUId,
        bankId: bankIds.internalId,
      },
      { deviceOnlyAuthAllowed: false },
    );
    if (!isSessionOK) {
      logInfo(req.body?.userEmail, 'checkBasicAuth2 fail: invalid session');
      return { granted: false };
    }
  }

  const publicKeySelect = options?.returningUserPublicKey
    ? 'u.sharing_public_key_2 AS sharing_public_key_2,'
    : '';
  const dataSelect = options?.returningData ? 'u.encrypted_data_2 AS encrypted_data_2,' : '';
  const deviceIdSelect = options?.returningDeviceId ? 'ud.id AS device_id,' : '';

  const accountManagerOrRecipientJoin =
    options?.checkIsOwnerForVaultId ||
    options?.checkIsRecipientForVaultId ||
    options?.checkIsEditorForVaultId
      ? 'INNER JOIN shared_vault_recipients AS svr ON u.id = svr.user_id'
      : '';
  const accountManagerOrRecipientWhere =
    options?.checkIsRecipientForVaultId ||
    options?.checkIsOwnerForVaultId ||
    options?.checkIsEditorForVaultId
      ? 'AND svr.shared_vault_id=$4'
      : '';
  const accountManagerOrRecipientParam =
    options?.checkIsOwnerForVaultId ||
    options?.checkIsEditorForVaultId ||
    options?.checkIsRecipientForVaultId
      ? [
          options.checkIsOwnerForVaultId ||
            options.checkIsEditorForVaultId ||
            options.checkIsRecipientForVaultId,
        ]
      : [];
  const accountRecipientWhere = options?.checkIsOwnerForVaultId
    ? "AND svr.access_level='owner'"
    : options?.checkIsEditorForVaultId
      ? "AND (svr.access_level='editor' OR svr.access_level='owner')"
      : '';

  const query = `SELECT
  ${publicKeySelect}
  ${dataSelect}
  ${deviceIdSelect}
  u.id AS user_id,
  u.deactivated AS deactivated
FROM user_devices AS ud
INNER JOIN users AS u ON ud.user_id = u.id
${accountManagerOrRecipientJoin}
WHERE
  u.email=$1
  AND ud.device_unique_id = $2
  AND ud.authorization_status='AUTHORIZED'
  AND u.bank_id=$3
  ${accountManagerOrRecipientWhere}
  ${accountRecipientWhere}
  `;
  const params = [userEmail, deviceUId, bankIds.internalId, ...accountManagerOrRecipientParam];
  // Request DB
  const dbRes = await db.query(query, params);

  if (!dbRes || dbRes.rowCount === 0 || dbRes.rows[0].deactivated) {
    logInfo(
      req.body?.userEmail,
      `checkBasicAuth2 fail: (not found) - request = ${query} - params = ${params}`,
    );
    return { granted: false };
  }

  return {
    userEmail,
    deviceUId,
    userId: dbRes.rows[0].user_id,
    sharingPublicKey: dbRes.rows[0].sharing_public_key_2,
    encryptedData: dbRes.rows[0].encrypted_data_2,
    deviceId: dbRes.rows[0].device_id,
    granted: true,
    bankIds,
  };
};

export const checkDeviceAuth = async (
  req: Request,
): Promise<
  | { granted: false }
  | {
      granted: true;
      vaultEmail: string;
      vaultId: number;
      deviceUuid: string;
      deviceId: number;
      bankIds: BankIds;
    }
> => {
  const joiRes = Joi.object({
    userEmail: Joi.string().email().lowercase().required(),
    deviceId: Joi.string().required(),
    deviceOnlySession: Joi.string().required(),
  })
    .unknown(true)
    .validate(req.body);

  if (joiRes.error) {
    logError(joiRes.error);
    return { granted: false };
  }
  const bankIds = await getBankIds(req);

  const { userEmail, deviceId: deviceUuid, deviceOnlySession } = joiRes.value;

  const isSessionOK = await SessionStore.checkSession(
    deviceOnlySession,
    {
      userEmail: userEmail,
      deviceUniqueId: deviceUuid,
      bankId: bankIds.internalId,
    },
    { deviceOnlyAuthAllowed: true },
  );
  if (!isSessionOK) {
    logInfo(req.body?.userEmail, 'checkDeviceAuth fail: invalid session');
    return { granted: false };
  }
  const idsRes = await db.query(
    `SELECT
          user_devices.id AS id,
          users.id AS vaultid
        FROM user_devices
          INNER JOIN users ON user_devices.user_id = users.id
        WHERE
          users.email=$1
          AND (users.deactivated IS NULL OR users.deactivated = false)
          AND user_devices.device_unique_id = $2
          AND user_devices.bank_id=$3
        LIMIT 1`,
    [userEmail, deviceUuid, bankIds.internalId],
  );
  if (idsRes.rows.length === 0) {
    logInfo(req.body?.userEmail, 'checkDeviceAuth fail: device or user not found');
    return { granted: false };
  }
  return {
    granted: true,
    vaultEmail: userEmail,
    vaultId: idsRes.rows[0].vaultid,
    deviceUuid,
    deviceId: idsRes.rows[0].id,
    bankIds,
  };
};
