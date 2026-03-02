import { septeoSupportEmail } from '../../../emails/constants';
import { db } from '../../../helpers/db';

/**
 * Get the support email associated with a shamir recovery request for a vault
 * @param vaultId
 * @returns The support email as a string, or null if not found.
 */
export async function getSupportEmail(vaultId: number): Promise<string> {
  const res = await db.query(
    `SELECT sc.support_email
     FROM shamir_configs sc
     INNER JOIN shamir_recovery_requests srr ON sc.id = srr.shamir_config_id
     WHERE srr.vault_id = $1`,
    [vaultId],
  );
  if (res.rowCount === 0) return septeoSupportEmail;
  return res.rows[0].support_email || septeoSupportEmail;
}
