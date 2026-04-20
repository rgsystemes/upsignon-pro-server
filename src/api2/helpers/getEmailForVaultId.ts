import { db } from '../../helpers/db';

export const getEmailForVaultId = async (vaultId: number): Promise<string | null> => {
  const res = await db.query('SELECT email FROM users WHERE id=$1', [vaultId]);
  if (res.rows.length === 1) {
    return res.rows[0].email;
  }
  return null;
};
