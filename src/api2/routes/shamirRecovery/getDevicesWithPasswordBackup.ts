import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { Request, Response } from 'express';
import { checkDeviceAuth } from '../../helpers/authorizationChecks';

export const getDevicesWithPasswordBackup = async (req: Request, res: Response) => {
  try {
    const deviceAuth = await checkDeviceAuth(req);
    if (!deviceAuth.granted) {
      logInfo(req.body?.userEmail, 'getDevicesWithPasswordBackup fail: device auth not granted');
      res.status(401).end();
      return;
    }
    const { vaultId, bankIds } = deviceAuth;

    const devicesWithBackupRes = await db.query(
      `SELECT
        device_name,
        device_unique_id,
        device_type,
        os_family
      FROM user_devices
      WHERE
        authorization_status='AUTHORIZED'
        AND encrypted_password_backup_2 IS NOT NULL
        AND encrypted_password_backup_2 != ''
        AND user_id=$1
        AND bank_id=$2`,
      [vaultId, bankIds.internalId],
    );
    logInfo(req.body?.userEmail, 'getDevicesWithPasswordBackup OK');
    res.status(200).json({
      devices: devicesWithBackupRes.rows.map((d) => ({
        name: d.device_name,
        id: d.device_unique_id,
        type: d.device_type,
        osFamily: d.os_family,
      })),
    });
  } catch (e) {
    logError(req.body?.userEmail, 'getDevicesWithPasswordBackup', e);
    return res.status(400).end();
  }
};
