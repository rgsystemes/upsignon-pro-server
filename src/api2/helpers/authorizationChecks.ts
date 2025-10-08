import { Request, Response } from 'express';
import { db } from '../../helpers/db';
import { logInfo } from '../../helpers/logger';
import { inputSanitizer } from '../../helpers/sanitizer';
import { IS_ACTIVE } from '../../helpers/serverStatus';
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
    const isSessionOK = await SessionStore.checkSession(deviceSession, {
      userEmail,
      deviceUniqueId: deviceUId,
      bankId: bankIds.internalId,
    });
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

export const checkDeviceAuthorizationOnly = async (
  req: Request,
  res: Response,
): Promise<{ user_id: number; device_primary_id: number } | null> => {
  // Authenticate device
  if (!IS_ACTIVE) {
    res.status(403);
    return null;
  }

  const expectedScheme = Joi.object({
    deviceSession: Joi.string().required(),
    userEmail: Joi.string().email().lowercase().required(),
    deviceId: Joi.string().required(),
  }).unknown(true);

  let validatedBody: { deviceSession: string; userEmail: string; deviceId: string };
  try {
    validatedBody = Joi.attempt(req.body, expectedScheme);
  } catch (e) {
    logInfo(req.body?.userEmail, e);
    res.status(403).end();
    return null;
  }

  const bankIds = await getBankIds(req);

  const isSessionOK = await SessionStore.checkSession(validatedBody.deviceSession, {
    userEmail: validatedBody.userEmail,
    deviceUniqueId: validatedBody.deviceId,
    bankId: bankIds.internalId,
  });
  if (!isSessionOK) {
    logInfo(req.body?.userEmail, 'checkDeviceAuthorizationOnly fail: session not valid');
    res.status(401).end();
    return null;
  }

  // Request DB
  const dbRes = await db.query(
    `SELECT
        users.id AS user_id,
        user_devices.id AS device_primary_id,
        user_devices.authorization_status AS authorization_status,
        users.deactivated AS deactivated,
        banks.stop_this_instance
      FROM user_devices
      INNER JOIN users ON user_devices.user_id = users.id
      INNER JOIN banks ON banks.id = users.bank_id
      WHERE
        users.email=$1 AND
        user_devices.device_unique_id = $2 AND
        users.bank_id=$3`,
    [validatedBody.userEmail, validatedBody.deviceId, bankIds.internalId],
  );

  if (!dbRes || dbRes.rowCount === 0) {
    logInfo(req.body?.userEmail, 'checkDeviceAuthorizationOnly fail: device deleted');
    res.status(403).json({ error: 'revoked' });
    return null;
  }
  if (dbRes.rows[0].stop_this_instance) {
    logInfo('instance stopped');
    res.status(400).end();
    return null;
  }
  if (dbRes.rows[0].authorization_status === 'REVOKED_BY_USER') {
    logInfo(req.body?.userEmail, 'checkDeviceAuthorizationOnly fail: revoked by user');
    res.status(403).json({ error: 'revoked' });
    return null;
  }
  if (dbRes.rows[0].authorization_status === 'REVOKED_BY_ADMIN' || dbRes.rows[0].deactivated) {
    logInfo(
      req.body?.userEmail,
      'checkDeviceAuthorizationOnly fail: device revoked by admin or user deactivated',
    );
    res.status(403).json({ error: 'revoked_by_admin' });
    return null;
  }

  if (dbRes.rows[0].authorization_status !== 'AUTHORIZED') {
    logInfo(
      req.body?.userEmail,
      'checkDeviceAuthorizationOnly fail: status',
      dbRes.rows[0].authorization_status,
    );
    res.status(403).json({ authorizationStatus: dbRes.rows[0].authorization_status });
    return null;
  }

  return dbRes.rows[0];
};
