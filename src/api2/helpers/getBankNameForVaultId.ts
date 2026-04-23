import { db } from '../../helpers/db';

export const getBankNameForVaultId = async (vaultId: number): Promise<string | null> => {
  const res = await db.query(
    'SELECT name FROM banks b INNER JOIN users u ON u.bank_id=b.id WHERE u.id=$1',
    [vaultId],
  );
  if (res.rows.length === 1) {
    return res.rows[0].name;
  }
  return null;
};
