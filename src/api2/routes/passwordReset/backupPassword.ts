import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { inputSanitizer } from '../../../helpers/sanitizer';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const backupPassword2 = async (req: any, res: any) => {
  try {
    const backups = inputSanitizer.getArrayOfBackups(req.body?.backups);
    if (!backups) {
      logInfo(req.body?.userEmail, 'backupPassword2 fail: missing backups param');
      return res.status(403).end();
    }

    const basicAuth = await checkBasicAuth2(req);
    if (!basicAuth.granted) {
      logInfo(req.body?.userEmail, 'backupPassword2 fail: auth not granted');
      return res.status(401).end();
    }

    const results = await Promise.all(
      backups.map(async (backup) => {
        // Also clears the target device's pending public key: receiving a backup here is the
        // proof that another authorized device just approved it (see getPendingSsoDevices /
        // authorizeSsoDevice). The device is already AUTHORIZED by this point (either via SSO's
        // dedicated authorizeDeviceWithOpenId route, or via the classic email validation code) —
        // this route never authorizes a device by itself.
        const result = await db.query(
          `UPDATE user_devices SET encrypted_password_backup_2=$1, password_backup_public_key=NULL
           WHERE device_unique_id=$2 AND user_id=$3 AND bank_id=$4 AND authorization_status='AUTHORIZED'`,
          [
            backup.encryptedPassword,
            backup.deviceId,
            basicAuth.userId,
            basicAuth.bankIds.internalId,
          ],
        );
        return { deviceId: backup.deviceId, applied: (result.rowCount ?? 0) > 0 };
      }),
    );
    // A backup can fail to apply if the target device was concurrently revoked/rejected by
    // another authorized device in the meantime (see rejectSsoDevice) — the caller needs to know
    // which ones, so it doesn't record a device it never actually managed to back up.
    const unappliedDeviceIds = results.filter((r) => !r.applied).map((r) => r.deviceId);
    logInfo(req.body?.userEmail, 'backupPassword2 OK');
    // Return res
    return res.status(200).json({ unappliedDeviceIds });
  } catch (e) {
    logError(req.body?.userEmail, 'backupPassword2', e);
    return res.status(400).end();
  }
};
