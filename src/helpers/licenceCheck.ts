import { db } from './db';

export const hasAvailableLicence = async (bankId: number): Promise<boolean> => {
  const licenceRes = await db.query('SELECT nb_licences_sold FROM groups WHERE id=$1', [bankId]);
  const vaultsRes = await db.query('SELECT count(1) as nb_vaults FROM users WHERE group_id=$1', [
    bankId,
  ]);
  if (licenceRes.rows[0].nb_licences_sold === 0) {
    return false;
  }
  return licenceRes.rows[0].nb_licences_sold > vaultsRes.rows[0].nb_vaults;
};
