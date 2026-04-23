import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { inputSanitizer } from '../../../helpers/sanitizer';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import { sendPublicKeySecurityAlert } from '../../../emails/sendPublicKeySecurityAlert';
import { getBankNameForVaultId } from '../../helpers/getBankNameForVaultId';

export const checkPublicKeys2 = async (req: Request, res: Response) => {
  try {
    const sharingPublicKey = inputSanitizer.getString(req.body?.sharingPublicKey);
    const signingPublicKey = inputSanitizer.getString(req.body?.signingPublicKey);
    if (!sharingPublicKey || !signingPublicKey) {
      logInfo(
        req.body?.userEmail,
        'checkPublicKeys2 fail: missing sharingPublicKey or signingPublicKey',
      );
      res.status(403).end();
      return;
    }

    const basicAuth = await checkBasicAuth2(req);
    if (!basicAuth.granted) {
      logInfo(req.body?.userEmail, 'checkPublicKeys2 fail: auth not granted');
      res.status(401).end();
      return;
    }

    let matchesSharingPublicKey = true;
    const userPublicKeysRes = await db.query(
      'SELECT sharing_public_key_2, signing_public_key FROM users WHERE id=$1',
      [basicAuth.userId],
    );
    if (!userPublicKeysRes.rows[0]) {
      res.status(400).end();
      return;
    }

    if (userPublicKeysRes.rows[0].sharing_public_key_2 !== sharingPublicKey) {
      matchesSharingPublicKey = false;
      const message = `---------------\nWARNING! POTENTIAL HACK DETECTED!\nThe sharing public key for user ${basicAuth.userEmail} that was found in the database did not match the public key registered in the user's private space. The database public key was\n\n${userPublicKeysRes.rows[0].sharing_public_key_2}\n\nwhile the user's expected public key was\n\n${sharingPublicKey}\n\nA database request to update the public key for this user with his expected public key will be made right after this message.\nIt is possible that the hacker has been able to read the passwords of all the accounts that are shared with ${basicAuth.userEmail}.\n---------------`;
      logInfo(message);
      logError(req.body?.userEmail, message);
      await db.query('UPDATE users SET sharing_public_key_2 = $1 WHERE email=$2 AND bank_id=$3', [
        sharingPublicKey,
        basicAuth.userEmail,
        basicAuth.bankIds.internalId,
      ]);
      const bankName = await getBankNameForVaultId(basicAuth.userId);
      await sendPublicKeySecurityAlert({
        email: basicAuth.userEmail,
        bankName: bankName!,
        bankUrl: req.originalUrl,
        badKey: userPublicKeysRes.rows[0].sharing_public_key_2,
        keyType: 'sharing',
      });
    }

    let matchesSigningPublicKey = true;
    if (userPublicKeysRes.rows[0].signing_public_key !== signingPublicKey) {
      if (!!userPublicKeysRes.rows[0].signing_public_key) {
        // The signing key has been set before but has changed
        matchesSigningPublicKey = false;
        const message = `---------------\nWARNING! POTENTIAL HACK DETECTED!\nThe signing public key for user ${basicAuth.userEmail} that was found in the database did not match the public key registered in the user's private space. The database public signing key was\n\n${userPublicKeysRes.rows[0].signing_public_key}\n\nwhile the user's expected public key was\n\n${signingPublicKey}\n\nA database request to update the signing key for this user with his expected signing key will be made right after this message.\n---------------`;
        logInfo(message);
        logError(req.body?.userEmail, message);
        const bankName = await getBankNameForVaultId(basicAuth.userId);
        await sendPublicKeySecurityAlert({
          email: basicAuth.userEmail,
          bankName: bankName!,
          bankUrl: req.originalUrl,
          badKey: userPublicKeysRes.rows[0].signing_public_key,
          keyType: 'signing',
        });
      } // else the signing key has never been set before
      await db.query('UPDATE users SET signing_public_key = $1 WHERE email=$2 AND bank_id=$3', [
        signingPublicKey,
        basicAuth.userEmail,
        basicAuth.bankIds.internalId,
      ]);
    }
    // Return res
    logInfo(req.body?.userEmail, 'checkPublicKeys2 OK');
    res.status(200).json({ matchesSharingPublicKey, matchesSigningPublicKey });
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'checkPublicKeys2', e);
    res.status(400).end();
    return;
  }
};
