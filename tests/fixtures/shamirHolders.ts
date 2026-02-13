/**
                                                 Table « public.shamir_holders »
     Colonne      |           Type           | Collationnement | NULL-able |                  Par défaut
------------------+--------------------------+-----------------+-----------+-----------------------------------------------
 id               | integer                  |                 | not null  | nextval('shamir_holders_id_seq'::regclass)
 vault_id         | integer                  |                 |           |
 shamir_config_id | integer                  |                 |           |
 nb_shares        | smallint                 |                 | not null  | 1
 created_at       | timestamp with time zone |                 |           | CURRENT_TIMESTAMP(0)
Index :
    "shamir_holders_pkey" PRIMARY KEY, btree (id)
Contraintes de clés étrangères :
    "shamir_holders_shamir_config_id_fkey" FOREIGN KEY (shamir_config_id) REFERENCES shamir_configs(id) ON DELETE CASCADE
    "shamir_holders_vault_id_fkey" FOREIGN KEY (vault_id) REFERENCES users(id) ON DELETE CASCADE
 */

import { db } from '../../src/helpers/db';

export type ShamirHolder = {
  id: number;
  vault_id: number;
  shamir_config_id: number;
  nb_shares: number;
  created_at?: Date;
};

export const holdersConfig1: ShamirHolder[] = [
  {
    id: 1,
    vault_id: 1,
    shamir_config_id: 1,
    nb_shares: 1,
    created_at: new Date('2023-02-10T10:00:00Z'),
  },
];

export const holdersConfig2: ShamirHolder[] = [
  {
    id: 2,
    vault_id: 1,
    shamir_config_id: 2,
    nb_shares: 1,
    created_at: new Date('2023-03-01T14:30:00Z'),
  },
  {
    id: 3,
    vault_id: 2,
    shamir_config_id: 2,
    nb_shares: 1,
    created_at: new Date('2023-03-01T14:30:00Z'),
  },
  {
    id: 4,
    vault_id: 4,
    shamir_config_id: 2,
    nb_shares: 1,
    created_at: new Date('2023-03-01T14:30:00Z'),
  },
  {
    id: 5,
    vault_id: 5,
    shamir_config_id: 2,
    nb_shares: 1,
    created_at: new Date('2023-03-01T14:30:00Z'),
  },
];

export const holdersConfig3: ShamirHolder[] = [
  {
    id: 6,
    vault_id: 1,
    shamir_config_id: 3,
    nb_shares: 1,
    created_at: new Date('2023-03-15T09:00:00Z'),
  },
  {
    id: 7,
    vault_id: 2,
    shamir_config_id: 3,
    nb_shares: 1,
    created_at: new Date('2023-03-15T09:00:00Z'),
  },
  {
    id: 8,
    vault_id: 4,
    shamir_config_id: 3,
    nb_shares: 1,
    created_at: new Date('2023-03-15T09:00:00Z'),
  },
  {
    id: 9,
    vault_id: 5,
    shamir_config_id: 3,
    nb_shares: 1,
    created_at: new Date('2023-03-15T09:00:00Z'),
  },
];

export const addShamirHolders = async (holders: ShamirHolder[]) => {
  for (const holder of holders) {
    const query = holder.id
      ? `INSERT INTO shamir_holders (id, vault_id, shamir_config_id, nb_shares, created_at)
         VALUES ($1, $2, $3, $4, $5)`
      : `INSERT INTO shamir_holders (vault_id, shamir_config_id, nb_shares, created_at)
         VALUES ($1, $2, $3, $4)`;

    const params = holder.id
      ? [holder.id, holder.vault_id, holder.shamir_config_id, holder.nb_shares, holder.created_at]
      : [holder.vault_id, holder.shamir_config_id, holder.nb_shares, holder.created_at];

    await db.query(query, params);
  }
};

export const addShamirHoldersForConfig = async (
  shamirConfigId: number,
  holders: Array<{ vaultId: number; nbShares: number }>,
) => {
  for (const holder of holders) {
    await db.query(
      `INSERT INTO shamir_holders (shamir_config_id, vault_id, nb_shares)
      VALUES ($1, $2, $3)`,
      [shamirConfigId, holder.vaultId, holder.nbShares],
    );
  }
};
