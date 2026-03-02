import { db } from '../../../helpers/db';

export const isShamirRecoveryRequestApproved = async (vaultId: number) => {
  // Get the latest pending recovery request for this vault
  const requestRes = await db.query(
    `SELECT
			SUM(ARRAY_LENGTH(COALESCE(ss.open_shares, '{}'::text[]), 1)) >= sc.min_shares AS approved
		FROM shamir_configs AS sc
		INNER JOIN shamir_recovery_requests AS srr
			ON srr.shamir_config_id=sc.id
		INNER JOIN shamir_shares AS ss
			ON srr.vault_id=ss.vault_id
			AND ss.holder_vault_id != srr.vault_id
		WHERE
			srr.status='PENDING'
			AND srr.vault_id=$1
      AND ss.open_shares IS NOT NULL
		GROUP BY srr.id, sc.id
		ORDER BY srr.created_at DESC LIMIT 1`,
    [vaultId],
  );
  const recoveryRequest = requestRes.rows[0];
  if (!recoveryRequest) return false;
  return recoveryRequest.approved;
};
