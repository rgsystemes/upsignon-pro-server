import { db } from '../../../helpers/db';

export async function getBankInfoForConfig(
  configId: number,
): Promise<{ id: number; name: string }> {
  const res = await db.query(
    `SELECT b.id, b.name
     FROM banks b
     INNER JOIN shamir_configs sc ON sc.bank_id = b.id
     WHERE sc.id = $1`,
    [configId],
  );
  return res.rows[0]!;
}
