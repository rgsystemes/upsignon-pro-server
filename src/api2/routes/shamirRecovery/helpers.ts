import { db } from '../../../helpers/db';

export const findShamirConfigId = async (userId: number): Promise<number | null> => {
  const configIdRes = await db.query(
    `SELECT sc.id as id
    FROM shamir_configs as sc
    INNER JOIN shamir_holders as sr ON sr.shamir_config_id=sc.id
    INNER JOIN shamir_shares as ss ON ss.holder_vault_id = sr.vault_id
    INNER JOIN users as u ON u.id = ss.vault_id
    WHERE u.id=$1
    LIMIT 1
    `,
    [userId],
  );
  return configIdRes.rowCount == 1 ? configIdRes.rows[0].id : null;
};
