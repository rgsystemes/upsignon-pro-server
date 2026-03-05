import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import Joi from 'joi';
import { ShamirChange, ShamirChangeSignature, ShamirShareholderFootprint } from './types';
import libsodium from 'libsodium-wrappers';
import { fromBase64 } from '../../helpers/base64Convert';
import { sendShamirConfigChangeApprovedToAdminsCCTrustedPersons } from '../../../emails/shamir/sendShamirConfigChangeApproved';
import { getShareholdersEmailsForConfig } from './_trustedPersonsEmails';
import { getBankInfoForConfig } from './_bankInfoForConfig';
import { sendShamirConfigChangeRejectedToAdminsCCTrustedPersons } from '../../../emails/shamir/sendShamirConfigChangeRejected';

export const signShamirConfigChange = async (req: Request, res: Response): Promise<void> => {
  try {
    // 0 - basic auth
    const basicAuth = await checkBasicAuth2(req, { returningDeviceId: true });
    if (!basicAuth.granted) {
      logInfo(req.body?.userEmail, 'signShamirConfigChange fail: auth not granted');
      res.status(401).end();
      return;
    }

    const expectedBody = Joi.object({
      shamirConfigId: Joi.number().required(),
      signedAt: Joi.string().required(),
      approved: Joi.boolean().required(),
      signature: Joi.string().required(),
    }).unknown();

    let safeBody: {
      shamirConfigId: number;
      signedAt: string;
      approved: boolean;
      signature: string;
    };
    try {
      safeBody = Joi.attempt(req.body, expectedBody);
    } catch (err) {
      logInfo(req.body?.userEmail, err);
      res.status(403).end();
      return;
    }

    // 1 - Check the user is entitled to sign
    const shamirConfigRes = await db.query(
      `SELECT
        sc.change,
        sc.name,
        sc.change_signatures
      FROM shamir_configs sc
      WHERE sc.id = $1
      `,
      [safeBody.shamirConfigId],
    );

    const configToBeSigned = shamirConfigRes.rows[0];

    if (!configToBeSigned) {
      logInfo(req.body?.userEmail, 'Config not found.');
      res.status(403).end();
      return;
    }

    const changeObject: ShamirChange = JSON.parse(configToBeSigned.change);
    if (changeObject.previousShamirConfig == null) {
      logInfo(req.body?.userEmail, 'First configs cannot be signed');
      res.status(403).end();
      return;
    }
    const authorityConfig = changeObject.previousShamirConfig;

    let isLegitimate = !!authorityConfig.shareholders.find(
      (sh) =>
        sh.vaultId === basicAuth.userId && sh.vaultBankPublicId === basicAuth.bankIds.publicId,
    );

    if (!isLegitimate) {
      logInfo(req.body?.userEmail, 'Not legitimate to sign shamir config change.');
      res.status(403).end();
      return;
    }

    // 2 - Check the user has not already signed
    const signatures = configToBeSigned.change_signatures;
    if (
      signatures &&
      signatures.find((s: ShamirChangeSignature) => s.holderVaultId === basicAuth.userId)
    ) {
      logInfo(req.body?.userEmail, 'This holder has already signed this change.');
      res.status(403).json({ error: 'already_signed' });
      return;
    }

    // Check the signature validity
    const shareHolderRes = await db.query('SELECT signing_public_key FROM users WHERE id=$1', [
      basicAuth.userId,
    ]);
    const signingPubKey = fromBase64(shareHolderRes.rows[0].signing_public_key);
    const signedBytes = fromBase64(safeBody.signature);

    const expectedSignedMessage = libsodium.from_string(
      JSON.stringify({
        configChange: configToBeSigned.change,
        shamirConfigId: safeBody.shamirConfigId,
        signedAt: safeBody.signedAt,
        approved: safeBody.approved,
      }),
    );
    const isSignatureVerified = libsodium.crypto_sign_verify_detached(
      signedBytes,
      expectedSignedMessage,
      signingPubKey,
    );

    if (!isSignatureVerified) {
      logInfo(req.body?.userEmail, 'Invalid signature.');
      res.status(403).end();
      return;
    }

    const authorityShareHolders = authorityConfig.shareholders;
    const initialTotalRefusingShares = totalSigningShares({
      authorityShareHolders,
      changeSignatures: signatures,
      approvedValue: false,
    });

    // Store the signature
    const changeSignature: ShamirChangeSignature = {
      holderVaultId: basicAuth.userId,
      signedAt: safeBody.signedAt,
      approved: safeBody.approved,
      signature: safeBody.signature,
    };
    const updateRes = await db.query(
      `UPDATE shamir_configs
      SET change_signatures = COALESCE(change_signatures, '[]'::jsonb) || jsonb_build_array($1::jsonb)
      WHERE id=$2
      RETURNING is_active, change_signatures
    `,
      [changeSignature, safeBody.shamirConfigId],
    );

    const updatedConfig = updateRes.rows[0];
    if (!updatedConfig) {
      logInfo(req.body?.userEmail, `Could not update shamir_config's signature`);
      res.status(403).end();
      return;
    }

    if (!updatedConfig.is_active) {
      const changeSignatures: ShamirChangeSignature[] = updatedConfig.change_signatures;
      // Count the number of approving shares.
      // BEWARE not to count the same shareholder twice !
      // (if someone manually edited the signatures array in db to duplicate a signature several times for instance)
      const totalApprovingShares: number = totalSigningShares({
        authorityShareHolders,
        changeSignatures,
        approvedValue: true,
      });

      const acceptLanguage = req.headers['accept-language'];
      const trustedPersonEmails = await getShareholdersEmailsForConfig(authorityConfig.configId);
      const bankInfo = await getBankInfoForConfig(authorityConfig.configId);
      if (authorityConfig.minShares <= totalApprovingShares) {
        // Deactivate old config.
        await db.query('UPDATE shamir_configs SET is_active=false WHERE id=$1', [
          authorityConfig.configId,
        ]);
        // Activate new config.
        await db.query('UPDATE shamir_configs SET is_active=true WHERE id=$1', [
          safeBody.shamirConfigId,
        ]);

        // send success notification email to admins and shareholders of both configs
        await sendShamirConfigChangeApprovedToAdminsCCTrustedPersons({
          trustedPersonEmails,
          supportEmail: authorityConfig.supportEmail,
          bankId: bankInfo.id,
          bankName: bankInfo.name,
          currentShamirConfigName: authorityConfig.configName,
          nextShamirConfigName: configToBeSigned.name,
          nbApprovers: totalApprovingShares,
          acceptLanguage,
        });
      }

      // in case that signature makes it impossible to ever have the new config approved, notify admins and shareholders
      const totalRefusingShares: number = totalSigningShares({
        authorityShareHolders,
        changeSignatures,
        approvedValue: false,
      });
      const totalAvailableShares = authorityShareHolders.reduce((sum: number, nextShareholder) => {
        return sum + nextShareholder.nbShares;
      }, 0);
      if (
        // now irremediably refused
        authorityConfig.minShares > totalAvailableShares - totalRefusingShares &&
        // previously still approvable
        authorityConfig.minShares <= totalAvailableShares - initialTotalRefusingShares
      ) {
        await sendShamirConfigChangeRejectedToAdminsCCTrustedPersons({
          trustedPersonEmails,
          supportEmail: authorityConfig.supportEmail,
          bankId: bankInfo.id,
          bankName: bankInfo.name,
          currentShamirConfigName: authorityConfig.configName,
          acceptLanguage,
        });
      }
    }

    res.status(200).end();
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'signShamirConfigChange', e);
    res.status(400).end();
    return;
  }
};

const totalSigningShares = ({
  authorityShareHolders,
  changeSignatures,
  approvedValue,
}: {
  authorityShareHolders: ShamirShareholderFootprint[];
  changeSignatures: ShamirChangeSignature[] | null;
  approvedValue: boolean;
}): number => {
  if (!changeSignatures) return 0;
  return authorityShareHolders.reduce((sum: number, nextShareholder) => {
    const signature = changeSignatures.find((s) => s.holderVaultId === nextShareholder.vaultId);
    if (signature && signature.approved == approvedValue) {
      return sum + nextShareholder.nbShares;
    } else {
      return sum;
    }
  }, 0);
};
