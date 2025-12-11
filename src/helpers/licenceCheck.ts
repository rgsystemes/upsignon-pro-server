import { db } from './db';

const licenceValidityCondition =
  '((el.is_monthly=true AND el.to_be_renewed != false) OR (el.valid_from <= current_timestamp(0) AND current_timestamp(0) < el.valid_until))';

export const hasAvailableLicence = async (bankId: number): Promise<boolean> => {
  // ### TRY FIRST WITH BANK LICENCES
  const banks = await db.query(
    `SELECT
      b.id,
      b.reseller_id,
      COALESCE((SELECT COUNT(1) FROM users WHERE users.bank_id=b.id)::int, 0) as used_vaults,
      COALESCE((SELECT
        SUM(il.nb_licences)
        FROM internal_licences AS il
        INNER JOIN external_licences AS el ON il.external_licences_id=el.ext_id
        WHERE il.bank_id=b.id
        AND ${licenceValidityCondition})::int, 0) as internal_licences,
      COALESCE((SELECT
        SUM(el.nb_licences)
        FROM external_licences AS el
        WHERE el.bank_id=b.id
        AND ${licenceValidityCondition})::int, 0) as external_licences
    FROM banks as b`,
  );

  const remainingLicencesByBank: {
    [bankId: number]: {
      remainingBankLicence: number;
      resellerId: string | null;
      vaultsNotCoveredByBankLicences: number;
      vaultsNotCoveredByResellerPoolLicences: number;
      vaultsNotCoveredBySuperadminLicences: number;
    };
  } = {};

  banks.rows.forEach((b) => {
    // start consuming bank specific licences
    const bankLicences = b.internal_licences + b.external_licences;
    const vaultsNotCoveredByBankLicences =
      b.used_vaults <= bankLicences ? 0 : b.used_vaults - bankLicences;
    remainingLicencesByBank[b.id] = {
      remainingBankLicence: bankLicences - b.used_vaults + vaultsNotCoveredByBankLicences,
      resellerId: b.reseller_id,
      vaultsNotCoveredByBankLicences,
      vaultsNotCoveredByResellerPoolLicences: vaultsNotCoveredByBankLicences,
      vaultsNotCoveredBySuperadminLicences: vaultsNotCoveredByBankLicences,
    };
  });
  if (remainingLicencesByBank[bankId].remainingBankLicence > 0) return true;

  // ### THEN TRY RESELLER LICENCES
  const bankResellerId = remainingLicencesByBank[bankId].resellerId;
  const resellers = await db.query(
    `SELECT
      r.id,
      (COALESCE(SUM(el.nb_licences), 0) - COALESCE(SUM(il.nb_licences), 0))::int AS nb_licences
    FROM resellers AS r
    INNER JOIN external_licences AS el ON r.id=el.reseller_id
    LEFT JOIN internal_licences AS il ON il.external_licences_id = el.ext_id
    WHERE el.reseller_id IS NOT NULL AND el.bank_id IS NULL
    AND ${licenceValidityCondition}
    GROUP BY r.id
    `,
  );
  // initialize reseller pools
  const remainingResellerPoolLicences: { [resellerId: string]: number } = {};
  resellers.rows.forEach((r) => {
    remainingResellerPoolLicences[r.id] = r.nb_licences;
  });

  banks.rows.forEach((b) => {
    if (remainingLicencesByBank[b.id].vaultsNotCoveredByBankLicences === 0) return;

    // then consume reseller pool licences
    if (b.reseller_id) {
      const remainingResellerL = remainingResellerPoolLicences[b.reseller_id];
      const vaultsNotCoveredByResellerPoolLicences =
        remainingLicencesByBank[b.id].vaultsNotCoveredByBankLicences <= remainingResellerL
          ? 0
          : remainingLicencesByBank[b.id].vaultsNotCoveredByBankLicences - remainingResellerL;
      remainingLicencesByBank[b.id] = {
        ...remainingLicencesByBank[b.id],
        vaultsNotCoveredByResellerPoolLicences,
        vaultsNotCoveredBySuperadminLicences: vaultsNotCoveredByResellerPoolLicences,
      };
      remainingResellerPoolLicences[b.reseller_id] =
        remainingResellerL -
        remainingLicencesByBank[b.id].vaultsNotCoveredByBankLicences +
        remainingLicencesByBank[b.id].vaultsNotCoveredByResellerPoolLicences;
    }
  });
  if (bankResellerId != null && remainingResellerPoolLicences[bankResellerId] > 0) return true;

  // ### FINALLY USE SUPERADMIN POOL LICENCES (on prem case)
  const superadminPoolLicences = await db.query(
    `SELECT
      COALESCE(SUM(el.nb_licences), 0)::int AS nb_licences
    FROM external_licences AS el
    WHERE el.reseller_id IS NULL AND el.bank_id IS NULL
    AND ${licenceValidityCondition}
    `,
  );

  // initialize superadmin pool
  let remainingSuperadminPoolLicences = superadminPoolLicences.rows[0].nb_licences;

  banks.rows.forEach((b) => {
    // then consume superadmin pool licences
    const vaultsNotCoveredBySuperadminLicences =
      remainingLicencesByBank[b.id].vaultsNotCoveredByResellerPoolLicences <=
      remainingSuperadminPoolLicences
        ? 0
        : remainingLicencesByBank[b.id].vaultsNotCoveredByResellerPoolLicences -
          remainingSuperadminPoolLicences;
    remainingLicencesByBank[b.id] = {
      ...remainingLicencesByBank[b.id],
      vaultsNotCoveredBySuperadminLicences,
    };
    remainingSuperadminPoolLicences =
      remainingSuperadminPoolLicences -
      remainingLicencesByBank[b.id].vaultsNotCoveredByResellerPoolLicences +
      remainingLicencesByBank[b.id].vaultsNotCoveredBySuperadminLicences;
  });

  return remainingSuperadminPoolLicences > 0;
};
