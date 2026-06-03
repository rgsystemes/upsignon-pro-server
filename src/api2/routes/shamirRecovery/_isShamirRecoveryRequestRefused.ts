import { db } from '../../../helpers/db';

export const isShamirRecoveryRequestRefused = async (recoveryRequestId: number) => {
  const res = await db.query(
    `SELECT
      (sc.min_shares > COALESCE(SUM(
        CASE
          WHEN sh.vault_id = ANY(srr.denied_by) THEN 0
          ELSE sh.nb_shares
        END
      ), 0)) AS is_refused
    FROM shamir_recovery_requests srr
    INNER JOIN shamir_configs sc ON sc.id = srr.shamir_config_id
    LEFT JOIN shamir_holders sh ON sh.shamir_config_id = srr.shamir_config_id
    WHERE srr.id = $1
    GROUP BY sc.id, srr.id`,
    [recoveryRequestId],
  );

  if (res.rowCount === 0) {
    return false;
  }

  return res.rows[0].is_refused;
};
