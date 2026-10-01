import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { inputSanitizer } from '../../../helpers/sanitizer';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import { applyPasswordBackups } from '../../helpers/passwordBackups';

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

    const transactionalClient = await db.getTransactionClient();
    try {
      await transactionalClient.begin();
      await applyPasswordBackups(
        transactionalClient,
        backups,
        basicAuth.userId,
        basicAuth.bankIds.internalId,
      );
      await transactionalClient.commit();
    } catch (e) {
      try {
        await transactionalClient.rollback();
      } catch (ee) {
        logError(req.body?.userEmail, 'backupPassword2 rollback failed', ee);
      }
      throw e;
    } finally {
      transactionalClient.release();
    }
    logInfo(req.body?.userEmail, 'backupPassword2 OK');
    // Return res
    return res.status(204).end();
  } catch (e) {
    logError(req.body?.userEmail, 'backupPassword2', e);
    return res.status(400).end();
  }
};
