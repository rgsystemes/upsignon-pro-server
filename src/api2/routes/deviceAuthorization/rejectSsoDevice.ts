import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { inputSanitizer } from '../../../helpers/sanitizer';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';

// Lets an already-authorized device (A) reject a peer device (B) that is itself already
// AUTHORIZED (identity verified via SSO or email) but still waiting for a password backup
// (see getPendingSsoDevices) — ie. before the device ever actually gains access to the vault.
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const rejectSsoDevice = async (req: any, res: any) => {
  try {
    const deviceIdToReject = inputSanitizer.getString(req.body?.deviceIdToReject);
    if (!deviceIdToReject) {
      logInfo(req.body?.userEmail, 'rejectSsoDevice fail: missing deviceIdToReject');
      return res.status(403).end();
    }

    const basicAuth = await checkBasicAuth2(req);
    if (!basicAuth.granted) {
      logInfo(req.body?.userEmail, 'rejectSsoDevice fail: auth not granted');
      return res.status(401).end();
    }

    const result = await db.query(
      `UPDATE user_devices
       SET device_unique_id=null, authorization_status='REVOKED_BY_USER', device_public_key_2=null,
         encrypted_password_backup_2='', password_backup_public_key=null, revocation_date=$1
       WHERE device_unique_id=$2 AND user_id=$3 AND bank_id=$4
         AND authorization_status='AUTHORIZED' AND password_backup_public_key IS NOT NULL`,
      [new Date().toISOString(), deviceIdToReject, basicAuth.userId, basicAuth.bankIds.internalId],
    );
    // applied=false means another authorized device already approved (or also rejected) this
    // same device in the meantime.
    const applied = (result.rowCount ?? 0) > 0;
    logInfo(req.body?.userEmail, 'rejectSsoDevice OK');
    return res.status(200).json({ applied });
  } catch (e) {
    logError(req.body?.userEmail, 'rejectSsoDevice', e);
    return res.status(400).end();
  }
};
