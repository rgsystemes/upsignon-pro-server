/**
                                              Table « public.shamir_shares »
      Colonne       |           Type           | Collationnement | NULL-able | Par défaut
--------------------+--------------------------+-----------------+-----------+------------
 vault_id           | integer                  |                 | not null  |
 holder_vault_id    | integer                  |                 | not null  |
 shamir_config_id   | integer                  |                 | not null  |
 closed_shares      | text[]                   |                 | not null  |
 open_shares        | text[]                   |                 |           |
 created_at         | timestamp with time zone |                 |           | CURRENT_TIMESTAMP(0)
 open_at            | timestamp with time zone |                 |           |
Index :
    "shamir_shares_pkey" PRIMARY KEY, btree (vault_id, holder_vault_id, shamir_config_id)
Contraintes de clés étrangères :
    "shamir_shares_holder_vault_id_fkey" FOREIGN KEY (holder_vault_id) REFERENCES users(id) ON DELETE CASCADE
    "shamir_shares_shamir_config_id_fkey" FOREIGN KEY (shamir_config_id) REFERENCES shamir_configs(id)
    "shamir_shares_vault_id_fkey" FOREIGN KEY (vault_id) REFERENCES users(id) ON DELETE CASCADE
 */

import { db } from '../../src/helpers/db';

export type ShamirShare = {
  vault_id: number;
  holder_vault_id: number;
  shamir_config_id: number;
  closed_shares: string[];
  open_shares?: string[] | null;
  created_at?: Date;
  open_at?: Date | null;
};

export const sharesConfig1: ShamirShare[] = [
  {
    vault_id: 1,
    holder_vault_id: 1,
    shamir_config_id: 1,
    closed_shares: ['encryptedShare1ForHolder1'],
    open_shares: null,
    created_at: new Date('2023-02-10T10:30:00Z'),
    open_at: null,
  },
];

export const sharesConfig2: ShamirShare[] = [
  {
    vault_id: 1,
    holder_vault_id: 1,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare1ForHolder1Config2'],
    open_shares: null,
    created_at: new Date('2023-03-01T15:00:00Z'),
    open_at: null,
  },
  {
    vault_id: 1,
    holder_vault_id: 2,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare1ForHolder2Config2'],
    open_shares: null,
    created_at: new Date('2023-03-01T15:00:00Z'),
    open_at: null,
  },
  {
    vault_id: 1,
    holder_vault_id: 4,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare1ForHolder4Config2'],
    open_shares: null,
    created_at: new Date('2023-03-01T15:00:00Z'),
    open_at: null,
  },
  {
    vault_id: 1,
    holder_vault_id: 5,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare1ForHolder5Config2'],
    open_shares: null,
    created_at: new Date('2023-03-01T15:00:00Z'),
    open_at: null,
  },
  {
    vault_id: 2,
    holder_vault_id: 1,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare2ForHolder1Config2'],
    open_shares: null,
    created_at: new Date('2023-03-01T15:05:00Z'),
    open_at: null,
  },
  {
    vault_id: 2,
    holder_vault_id: 2,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare2ForHolder2Config2'],
    open_shares: null,
    created_at: new Date('2023-03-01T15:05:00Z'),
    open_at: null,
  },
  {
    vault_id: 2,
    holder_vault_id: 4,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare2ForHolder4Config2'],
    open_shares: null,
    created_at: new Date('2023-03-01T15:05:00Z'),
    open_at: null,
  },
  {
    vault_id: 2,
    holder_vault_id: 5,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare2ForHolder5Config2'],
    open_shares: null,
    created_at: new Date('2023-03-01T15:05:00Z'),
    open_at: null,
  },
];

export const sharesConfig3: ShamirShare[] = [
  {
    vault_id: 1,
    holder_vault_id: 1,
    shamir_config_id: 3,
    closed_shares: ['encryptedShare1ForHolder1Config3'],
    open_shares: ['openShare1ForHolder1Config3'],
    created_at: new Date('2023-03-15T09:30:00Z'),
    open_at: new Date('2023-03-20T14:00:00Z'),
  },
  {
    vault_id: 1,
    holder_vault_id: 2,
    shamir_config_id: 3,
    closed_shares: ['encryptedShare1ForHolder2Config3'],
    open_shares: ['openShare1ForHolder2Config3'],
    created_at: new Date('2023-03-15T09:30:00Z'),
    open_at: new Date('2023-03-20T14:00:00Z'),
  },
  {
    vault_id: 1,
    holder_vault_id: 4,
    shamir_config_id: 3,
    closed_shares: ['encryptedShare1ForHolder4Config3'],
    open_shares: ['openShare1ForHolder4Config3'],
    created_at: new Date('2023-03-15T09:30:00Z'),
    open_at: new Date('2023-03-20T14:00:00Z'),
  },
  {
    vault_id: 1,
    holder_vault_id: 5,
    shamir_config_id: 3,
    closed_shares: ['encryptedShare1ForHolder5Config3'],
    open_shares: ['openShare1ForHolder5Config3'],
    created_at: new Date('2023-03-15T09:30:00Z'),
    open_at: new Date('2023-03-20T14:00:00Z'),
  },
];

export const closedSharesConfigPending: ShamirShare[] = [
  {
    vault_id: 4,
    holder_vault_id: 1,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare4ForHolder1Config2'],
    open_shares: null,
    created_at: new Date('2024-01-10T10:00:00Z'),
    open_at: null,
  },
  {
    vault_id: 4,
    holder_vault_id: 2,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare4ForHolder2Config2'],
    open_shares: null,
    created_at: new Date('2024-01-10T10:00:00Z'),
    open_at: null,
  },
  {
    vault_id: 4,
    holder_vault_id: 4,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare4ForHolder4Config2'],
    open_shares: null,
    created_at: new Date('2024-01-10T10:00:00Z'),
    open_at: null,
  },
  {
    vault_id: 4,
    holder_vault_id: 5,
    shamir_config_id: 2,
    closed_shares: ['encryptedShare4ForHolder5Config2'],
    open_shares: null,
    created_at: new Date('2024-01-10T10:00:00Z'),
    open_at: null,
  },
];

export const addTestShamirShares = async (shares: ShamirShare[]) => {
  for (const share of shares) {
    await db.query(
      `INSERT INTO shamir_shares
       (vault_id, holder_vault_id, shamir_config_id, closed_shares, open_shares, created_at, open_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        share.vault_id,
        share.holder_vault_id,
        share.shamir_config_id,
        share.closed_shares,
        share.open_shares,
        share.created_at,
        share.open_at,
      ],
    );
  }
};
