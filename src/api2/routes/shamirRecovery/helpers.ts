import { db } from '../../../helpers/db';

export const findShamirHoldersUniqueEmailsForTargetUserId = async (
  targetUserId: number,
  shamirConfigId: number,
): Promise<string[]> => {
  const dbRes = await db.query(
    `SELECT DISTINCT u.email as email
    FROM users as u
    INNER JOIN shamir_shares as ss ON ss.holder_vault_id = sr.id
    WHERE
      ss.vault_id=$1 AND ss.shamir_config_id=$2
    `,
    [targetUserId, shamirConfigId],
  );
  return dbRes.rows.map((a) => a.email);
};

export const isShamirRecoveryReady = async (
  targetVaultId: number,
  shamirConfigId: number,
): Promise<boolean> => {
  const sharesRes = await db.query(
    `SELECT
      SUM(ARRAY_LENGTH(ss.open_shares,1)) >= sc.min_shares AS has_enough_shares
    FROM shamir_shares AS ss
    INNER JOIN shamir_configs AS sc ON sc.id=ss.shamir_config_id
    WHERE
      ss.vault_id=12
      AND ss.shamir_config_id=1
      AND ss.open_shares IS NOT NULL
    GROUP BY sc.id`,
    [targetVaultId, shamirConfigId],
  );
  return sharesRes.rowCount != null && sharesRes.rows[0].has_enough_shares;
};
