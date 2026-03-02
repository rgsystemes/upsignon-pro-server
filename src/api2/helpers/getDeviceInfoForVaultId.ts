import { db } from '../../helpers/db';

export const getDeviceInfoForVaultId = async (
  vaultId: number,
): Promise<{ name: string; type: string } | null> => {
  const res = await db.query('SELECT name, type FROM user_devices WHERE user_id=$1', [vaultId]);
  if (res.rows.length === 1) {
    return res.rows[0];
  }
  return null;
};
