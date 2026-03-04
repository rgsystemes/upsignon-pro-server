import { Request, Response } from 'express';
import { db } from '../../../helpers/db';
import { logError, logInfo } from '../../../helpers/logger';
import { checkBasicAuth2 } from '../../helpers/authorizationChecks';
import {
  ShamirChange,
  ShamirChangeSignature,
  ShamirConfigHistoryForBank,
  ShamirConfigWithHolders,
} from './types';

export const retrieveShamirConfigChangeToApprove = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // 0 - Check authentication
    const basicAuth = await checkBasicAuth2(req, { returningDeviceId: true });
    if (!basicAuth.granted) {
      logInfo(req.body?.userEmail, 'retrieveShamirConfigChangeToApprove fail: auth not granted');
      res.status(401).end();
      return;
    }

    // 1 - Get all configs (with shareholders) for banks where the user is a shareholder of at least one shamir config
    const allShamirConfigsForHolder = await db.query(
      `SELECT
        b.id as bank_id,
        b.public_id,
        b.name as bank_name,
        (SELECT COALESCE(json_agg(
            json_build_object(
              'id', sc1.id,
              'name', sc1.name,
              'minShares', sc1.min_shares,
              'isActive', sc1.is_active,
              'supportEmail', sc1.support_email,
              'creatorEmail', sc1.creator_email,
              'createdAt', sc1.created_at,
              'change', sc1.change,
              'changeSignatures', COALESCE(sc1.change_signatures, '[]'),
              'activeHolders', (
                SELECT COALESCE(json_agg(json_build_object(
                  'vaultId', sh1.vault_id,
                  'nbShares', sh1.nb_shares,
                  'publicSigningKey', u.signing_public_key
                )), '[]')
                FROM shamir_holders sh1
                INNER JOIN users u ON u.id = sh1.vault_id
                WHERE sh1.shamir_config_id = sc1.id
              )
            ) ORDER BY sc1.created_at ASC
          ), '[]')
          FROM shamir_configs sc1
          WHERE sc1.bank_id = b.id
        ) as all_configs
      FROM shamir_configs sc
      INNER JOIN banks b ON sc.bank_id = b.id
      INNER JOIN shamir_holders sh ON sc.id = sh.shamir_config_id
      WHERE
        sh.vault_id=$1
      GROUP BY b.id
      ORDER BY b.id
      `,
      [basicAuth.userId],
    );

    // 2 - Filter config changes that the user needs to approve
    // - 2a - first shamir config for the bank: the shareholders of that config need to approve
    // - 2b - shamir config change for the bank: the shareholders of the previous config need to approve
    //   To avoid confusion, we do not ask the user to sign changes that are already overriden
    let changesToBeSigned: {
      bankPublicId: string;
      bankName: string;
      shamirConfigHistory: ShamirConfigWithHolders[];
    }[] = [];

    allShamirConfigsForHolder.rows.forEach((scfh: ShamirConfigHistoryForBank) => {
      if (scfh.all_configs.length <= 1) {
        // 0 should not happen
        // 1 means it's the first config, no need to approve it
        return;
      }

      // 2b - case of shamir config change for the bank
      const penultimateConfig = scfh.all_configs[scfh.all_configs.length - 2];
      // Check the user is a shareholder of this penultimate config.
      if (!penultimateConfig.activeHolders.find((h) => h.vaultId === basicAuth.userId)) {
        // The user is not a shareholder of this config. He has no entitlement to sign the change.
        return;
      }

      // Check the user has signed the change
      const ultimateConfig = scfh.all_configs[scfh.all_configs.length - 1];
      const changeSignatures = ultimateConfig.changeSignatures;
      const hasSigned = changeSignatures.some((cs: ShamirChangeSignature) => {
        return cs.holderVaultId === basicAuth.userId;
      });
      if (!hasSigned) {
        changesToBeSigned.push({
          bankPublicId: scfh.public_id,
          bankName: scfh.bank_name,
          shamirConfigHistory: scfh.all_configs,
        });
      }
    });

    // 3 - Get the bank names for all shareholder's banks
    const allBankIds: string[] = [];
    changesToBeSigned.forEach(async (c) => {
      c.shamirConfigHistory.forEach(async (h) => {
        const change = JSON.parse(h.change) as ShamirChange;
        change.previousShamirConfig?.shareholders.forEach((s) => {
          if (!allBankIds.includes(s.vaultBankPublicId)) {
            allBankIds.push(s.vaultBankPublicId);
          }
        });
        change.thisShamirConfig.shareholders.forEach((s) => {
          if (!allBankIds.includes(s.vaultBankPublicId)) {
            allBankIds.push(s.vaultBankPublicId);
          }
        });
      });
    });

    const bankNamesRes = await db.query(
      'SELECT name, public_id FROM banks WHERE public_id = ANY($1)',
      [allBankIds],
    );
    const allBanksMap: { [publicId: string]: string } = {};
    for (let i = 0; i < bankNamesRes.rows.length; i++) {
      const b = bankNamesRes.rows[i];
      allBanksMap[b.public_id] = b.name;
    }

    res.status(200).json({ changesToBeSigned, allBanksMap });
    return;
  } catch (e) {
    logError(req.body?.userEmail, 'retrieveShamirConfigChangeToApprove', e);
    res.status(400).end();
    return;
  }
};
