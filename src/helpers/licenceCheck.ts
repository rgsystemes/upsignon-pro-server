import { db } from './db';

export const hasAvailableLicence = async (bankId: number): Promise<boolean> => {
  const internalLicences = await db.query(
    `SELECT
    il.nb_licences
    FROM internal_licences AS il
    LEFT JOIN external_licences AS el ON el.external_licences_id=il.ext_id
    WHERE il.bank_id=$1
    AND ((el.is_monthly=true AND el.to_be_renewed != false) OR (el.valid_from <= current_timestamp(0) AND current_timestamp(0) < el.valid_until))
    `,
    [bankId],
  );
  const externalLicences = await db.query(
    `SELECT
    el.nb_licences
    LEFT JOIN external_licences AS el
    WHERE el.bank_id=$1
    AND ((el.is_monthly=true AND el.to_be_renewed != false) OR (el.valid_from <= current_timestamp(0) AND current_timestamp(0) < el.valid_until))
    `,
    [bankId],
  );
  const vaultsRes = await db.query('SELECT count(1) as nb_vaults FROM users WHERE group_id=$1', [
    bankId,
  ]);
  let bankSpecificNbLicences = 0;
  if (internalLicences.rows.length > 0) {
    for (let i = 0; i < internalLicences.rows.length; i++) {
      bankSpecificNbLicences += internalLicences.rows[i].nb_licences;
    }
  }
  if (externalLicences.rows.length > 0) {
    for (let i = 0; i < externalLicences.rows.length; i++) {
      bankSpecificNbLicences += externalLicences.rows[i].nb_licences;
    }
  }
  return bankSpecificNbLicences > vaultsRes.rows[0].nb_vaults;
};
