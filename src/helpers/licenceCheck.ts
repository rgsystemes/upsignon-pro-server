import { db } from './db';

const licenceValidityCondition =
  '((el.is_monthly=true AND el.to_be_renewed != false) OR (el.valid_from <= current_timestamp(0) AND current_timestamp(0) < el.valid_until))';

export const hasAvailableLicence = async (bankId: number): Promise<boolean> => {
  const banks = await db.query(
    `SELECT
      b.id,
      b.reseller_id,
      (SELECT COUNT(1) FROM users WHERE users.bank_id=b.id) as used_vaults,
      (SELECT
        SUM(il.nb_licences)
        FROM internal_licences AS il
        INNER JOIN external_licences AS el ON il.external_licences_id=el.ext_id
        WHERE il.bank_id=b.id
        AND ${licenceValidityCondition}) as internal_licences,
      (SELECT
        SUM(el.nb_licences)
        FROM external_licences AS el
        WHERE el.bank_id=b.id
        AND ${licenceValidityCondition}) as external_licences
    FROM banks as b`,
  );

  const remainingLicencesByBank: {
    [bankId: number]: {
      bankLicences: number;
      resellerId: string | null;
      vaultsNotCoveredByBankLicences: number;
      vaultsNotCoveredByResellerPoolLicences: number;
      vaultsNotCoveredBySuperadminLicences: number;
    };
  } = {};

  banks.rows.forEach((b) => {
    // start consuming bank specific licences
    remainingLicencesByBank[b.id] = {
      bankLicences:
        (Number.parseInt(b.internal_licences) || 0) + (Number.parseInt(b.external_licences) || 0),
      resellerId: b.reseller_id,
      vaultsNotCoveredByBankLicences: 0,
      vaultsNotCoveredByResellerPoolLicences: 0,
      vaultsNotCoveredBySuperadminLicences: 0,
    };
    const usedVaults = Number.parseInt(b.used_vaults) || 0;
    if (usedVaults <= remainingLicencesByBank[b.id].bankLicences) {
      remainingLicencesByBank[b.id].bankLicences =
        remainingLicencesByBank[b.id].bankLicences - usedVaults;
      return;
    }
    const vaultsNotCoveredByBankLicences = usedVaults - remainingLicencesByBank[b.id].bankLicences;
    remainingLicencesByBank[b.id] = {
      ...remainingLicencesByBank[b.id],
      vaultsNotCoveredByBankLicences,
    };
  });
  if (remainingLicencesByBank[bankId].vaultsNotCoveredByBankLicences === 0) return true;

  const resellers = await db.query(
    `SELECT
      r.id,
      SUM(el.nb_licences) AS nb_licences
    FROM resellers AS r
    INNER JOIN external_licences AS el ON r.id=el.reseller_id
    WHERE el.uses_pool=true AND el.bank_id IS NULL
    AND ${licenceValidityCondition}
    GROUP BY r.id
    `,
  );
  const superadminPoolLicences = await db.query(
    `SELECT
      SUM(el.nb_licences) AS nb_licences
    FROM external_licences AS el
    WHERE el.uses_pool=true AND el.reseller_id IS NULL AND el.bank_id IS NULL
    AND ${licenceValidityCondition}
    `,
  );

  // initialize superadmin pool
  let remainingSuperadminPoolLicences =
    Number.parseInt(superadminPoolLicences.rows[0].nb_licences) || 0;

  // initialize reseller pools
  const remainingResellerPoolLicences: { [resellerId: string]: number } = {};
  resellers.rows.forEach((r) => {
    remainingResellerPoolLicences[r.id] = Number.parseInt(r.nb_licences) || 0;
  });

  banks.rows.forEach((b) => {
    // then consume reseller pool licences
    let vaultsNotCoveredByResellerPoolLicences =
      remainingLicencesByBank[b.id].vaultsNotCoveredByBankLicences;
    if (b.reseller_id && remainingResellerPoolLicences[b.reseller_id]) {
      if (
        remainingLicencesByBank[b.id].vaultsNotCoveredByBankLicences <=
        remainingResellerPoolLicences[b.reseller_id]
      ) {
        remainingResellerPoolLicences[b.reseller_id] -=
          remainingLicencesByBank[b.id].vaultsNotCoveredByBankLicences;
        return;
      }

      vaultsNotCoveredByResellerPoolLicences =
        remainingLicencesByBank[b.id].vaultsNotCoveredByBankLicences -
        remainingResellerPoolLicences[b.reseller_id];
      remainingLicencesByBank[b.id] = {
        ...remainingLicencesByBank[b.id],
        vaultsNotCoveredByResellerPoolLicences,
      };
      remainingResellerPoolLicences[b.reseller_id] = 0;
    }

    // then consume superadmin pool licences
    if (vaultsNotCoveredByResellerPoolLicences <= remainingSuperadminPoolLicences) {
      remainingSuperadminPoolLicences -= vaultsNotCoveredByResellerPoolLicences;
      return;
    }

    const vaultsNotCoveredBySuperadminLicences =
      vaultsNotCoveredByResellerPoolLicences - remainingSuperadminPoolLicences;

    remainingSuperadminPoolLicences = 0;
    remainingLicencesByBank[b.id] = {
      ...remainingLicencesByBank[b.id],
      vaultsNotCoveredBySuperadminLicences,
    };
  });

  // now return the number of available
  let resellerId = remainingLicencesByBank[bankId].resellerId;
  if (resellerId && remainingResellerPoolLicences[resellerId] > 0) return true;
  if (remainingSuperadminPoolLicences > 0) return true;
  return false;
};
