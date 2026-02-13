/**
                                              Table « public.shamir_configs »
      Colonne      |           Type           | Collationnement | NULL-able |                 Par défaut
-------------------+--------------------------+-----------------+-----------+--------------------------------------------
 id                | integer                  |                 | not null  | nextval('shamir_configs_id_seq'::regclass)
 name              | character varying(100)   |                 | not null  |
 min_shares        | smallint                 |                 | not null  | 1
 is_active         | boolean                  |                 | not null  | false
 support_email     | character varying(100)   |                 |           |
 creator_email     | character varying(100)   |                 |           |
 bank_id           | integer                  |                 |           |
 created_at        | timestamp with time zone |                 |           | CURRENT_TIMESTAMP(0)
 change            | text                     |                 |           |
 change_signatures | jsonb                    |                 |           |
Index :
    "shamir_configs_pkey" PRIMARY KEY, btree (id)
Contraintes de clés étrangères :
    "shamir_configs_bank_id_fkey" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
Référencé par :
    TABLE "shamir_holders" CONSTRAINT "shamir_holders_shamir_config_id_fkey" FOREIGN KEY (shamir_config_id) REFERENCES shamir_configs(id) ON DELETE CASCADE
    TABLE "shamir_recovery_requests" CONSTRAINT "shamir_recovery_requests_shamir_config_id_fkey" FOREIGN KEY (shamir_config_id) REFERENCES shamir_configs(id) ON DELETE CASCADE
    TABLE "shamir_shares" CONSTRAINT "shamir_shares_shamir_config_id_fkey" FOREIGN KEY (shamir_config_id) REFERENCES shamir_configs(id)

 */

import { db } from '../../src/helpers/db';

export type ShamirConfig = {
  id: number;
  name: string;
  min_shares: number;
  is_active: boolean;
  support_email: string | null;
  creator_email: string | null;
  bank_id: number | null;
  created_at: Date;
  change: string | null;
  change_signatures: Record<string, any> | null;
};

export type EnhancedShamirConfig = {
  id: number;
  name: string;
  minShares: number;
  isActive: boolean;
  supportEmail: string | null;
  creatorEmail: string | null;
  bankPublicId: string;
  createdAt: Date | string;
  change: string | null;
  changeSignatures: Array<{
    holderVaultId: number;
    signedAt: string;
    approved: boolean;
    signature: string;
  }>;
  holders: Array<{
    id: number;
    email: string | null;
    sharingPublicKey: string | null;
    signingPublicKey: string | null;
    nbShares: number;
  }>;
  needsUpdate: boolean;
};

const configFootprint1 = {
  configId: 1,
  configName: 'Shamir 1',
  bankPublicId: '6333b2b6-2598-4a31-a263-e1897b29d5f5',
  createdAt: '2023-02-10T10:00:00Z',
  minShares: 1,
  supportEmail: 'support@testbank1.com',
  creatorEmail: 'admin@testbank1.com',
  shareholders: [
    {
      vaultId: 1,
      vaultEmail: 'user1@testbank1.com',
      vaultBankPublicId: '6333b2b6-2598-4a31-a263-e1897b29d5f5',
      vaultSigningPubKey: 'Oo9Do/g8Wak201deG8C902+a7VIEDzgZu6YFyuxqMCs=',
      nbShares: 1,
    },
  ],
};

const configFootprint2 = {
  configId: 2,
  configName: 'Shamir 2',
  bankPublicId: '6333b2b6-2598-4a31-a263-e1897b29d5f5',
  createdAt: '2023-03-01T14:30:00Z',
  minShares: 3,
  supportEmail: 'security@testbank1.com',
  creatorEmail: 'admin@testbank1.com',
  shareholders: [
    {
      vaultId: 1,
      vaultEmail: 'user1@testbank1.com',
      vaultBankPublicId: '6333b2b6-2598-4a31-a263-e1897b29d5f5',
      vaultSigningPubKey: 'Oo9Do/g8Wak201deG8C902+a7VIEDzgZu6YFyuxqMCs=',
      nbShares: 1,
    },
    {
      vaultId: 2,
      vaultEmail: 'user2@testbank1.com',
      vaultBankPublicId: '6333b2b6-2598-4a31-a263-e1897b29d5f5',
      vaultSigningPubKey: 'Arf/cbVfjXekFHgrJnpFf07xN8UFSjOjNDaZ/seWS1k=',
      nbShares: 1,
    },
    {
      vaultId: 4,
      vaultEmail: 'user1@testbank2.com',
      vaultBankPublicId: '98073dee-c66b-4bce-b385-1b66bc76e7fc',
      vaultSigningPubKey: 'iFB2t1w6HfzUawFQDvvT6QvfDZm/gdVMhu7zLEi4kLs=',
      nbShares: 1,
    },
    {
      vaultId: 5,
      vaultEmail: 'user2@testbank2.com',
      vaultBankPublicId: '98073dee-c66b-4bce-b385-1b66bc76e7fc',
      vaultSigningPubKey: 'Z1fm5BxZSXb6oW9zPVHbIgVQnHfWMKS6gf4I6kx4HAE=',
      nbShares: 1,
    },
  ],
};

const configFootprint3 = {
  configId: 3,
  configName: 'Shamir 3',
  bankPublicId: '6333b2b6-2598-4a31-a263-e1897b29d5f5',
  createdAt: '2023-03-15T09:00:00Z',
  minShares: 1,
  supportEmail: 'test@testbank1.com',
  creatorEmail: 'admin@testbank1.com',
  shareholders: [
    {
      vaultId: 1,
      vaultEmail: 'user1@testbank1.com',
      vaultBankPublicId: '6333b2b6-2598-4a31-a263-e1897b29d5f5',
      vaultSigningPubKey: 'Oo9Do/g8Wak201deG8C902+a7VIEDzgZu6YFyuxqMCs=',
      nbShares: 1,
    },
    {
      vaultId: 2,
      vaultEmail: 'user2@testbank1.com',
      vaultBankPublicId: '6333b2b6-2598-4a31-a263-e1897b29d5f5',
      vaultSigningPubKey: 'Arf/cbVfjXekFHgrJnpFf07xN8UFSjOjNDaZ/seWS1k=',
      nbShares: 1,
    },
    {
      vaultId: 4,
      vaultEmail: 'user1@testbank2.com',
      vaultBankPublicId: '98073dee-c66b-4bce-b385-1b66bc76e7fc',
      vaultSigningPubKey: 'iFB2t1w6HfzUawFQDvvT6QvfDZm/gdVMhu7zLEi4kLs=',
      nbShares: 1,
    },
    {
      vaultId: 5,
      vaultEmail: 'user2@testbank2.com',
      vaultBankPublicId: '98073dee-c66b-4bce-b385-1b66bc76e7fc',
      vaultSigningPubKey: 'Z1fm5BxZSXb6oW9zPVHbIgVQnHfWMKS6gf4I6kx4HAE=',
      nbShares: 1,
    },
  ],
};

export const nonSenseApprovingSignaturesConfig1 = [
  {
    holderVaultId: 1,
    signedAt: '2023-02-11T10:00:00Z',
    approved: true,
    signature:
      'UV2wJHfDxjkH9xi1H/RBHjytWmOKaPNQ92Bg9slZBRhIN7h91vQ4bamSUNeb0G1zKS5plXnfd/NfqaJj+jS2Dw==',
  },
];
export const nonSenseRefusingSignaturesConfig1 = [
  {
    holderVaultId: 1,
    signedAt: '2023-02-11T10:00:00Z',
    approved: false,
    signature:
      'FglhU5vXi1aXTIJfsPk/8Gh9GdJX/4+Uwh7TTLKssk4lc+qBQv+2leq770VK4tl1OYATGZLRef8PU2ymrwuGDA==',
  },
];
export const approvingSignaturesConfig2 = [
  {
    holderVaultId: 1,
    signedAt: '2023-03-02T10:00:00Z',
    approved: true,
    signature:
      'Ly66N8AOIlMCmb73Y3C2szeD83SaIwUZRF792ETWRDxwMdBz+tFl1gmzrMiY2CVpYuMsavopwA3x0IypsoRnDA==',
  },
];
export const unlegitimateApprovingSignaturesConfig2 = [
  {
    holderVaultId: 2,
    signedAt: '2023-03-02T10:00:00Z',
    approved: true,
    signature:
      'Ly66N8AOIlMCmb73Y3C2szeD83SaIwUZRF792ETWRDxwMdBz+tFl1gmzrMiY2CVpYuMsavopwA3x0IypsoRnDA==',
  },
];
export const refusingSignaturesConfig2 = [
  {
    holderVaultId: 1,
    signedAt: '2023-03-02T10:00:00Z',
    approved: false,
    signature:
      '9KVlhXY1R8eb3DBrmdc2IUYM9W9nROK1iNXGXNohCW5Uuwxl/E670ajsvcCPkXEJbEMK8YRTn5MUcKgoIq7KDg==',
  },
];
export const approvingSignaturesConfig3 = [
  {
    holderVaultId: 1,
    signedAt: '2023-03-16T10:00:00Z',
    approved: true,
    signature:
      'zlKE69zxqxSQMqbOAPbgSptQpK9a+HxWtFfiRj5jM8rG+Tg9hfqMYSGLqpmYfhVltxK7nATs977A6hjVz+iDBQ==',
  },
  {
    holderVaultId: 2,
    signedAt: '2023-03-16T10:00:00Z',
    approved: true,
    signature:
      'WM4l2T47TIEdxIKbXE6SwFHHmG/vPuC1CfAiLURGzOT1YlyBR/v+QL0YEIjElY25H7Tdun13zYkPHy5rGM4/Cw==',
  },
  {
    holderVaultId: 4,
    signedAt: '2023-03-16T10:00:00Z',
    approved: true,
    signature:
      'oOt2Rjz8YDL/LFTqDOH97cDoAUAXERjBGixN+Pz0pJabBVmGAj8Boo/LJ/S0P6+uUqpAZggIhlyepKw5qotpAw==',
  },
  {
    holderVaultId: 5,
    signedAt: '2023-03-16T10:00:00Z',
    approved: true,
    signature:
      'dlfLWq1ZV0G3Qnr7L6BxdVxS1TE0AH3cNoWT43/+WKG2+M29pwY3xGlmUWeO96+6j+MPILejyIx8MI94JH87Aw==',
  },
];
export const refusingSignaturesConfig3 = [
  {
    holderVaultId: 1,
    signedAt: '2023-03-16T10:00:00Z',
    approved: false,
    signature:
      'xuj0+NZQcFalslWvdHbt0op1Q8ju49FQp6oYzqig19MQh2ORKyGZNhV4nI0Mb2zZuRsduVOf8c+pwKhN5lDXDQ==',
  },
  {
    holderVaultId: 2,
    signedAt: '2023-03-16T10:00:00Z',
    approved: false,
    signature:
      'Lh3K5rrZe3qMS1sNaHvdzKyMa9MtkAmE3JJmfsNXEs6LH7QYxkhRbJl7VPdbM2alIbYitYyU6wMU5bW7ptcHCA==',
  },
  {
    holderVaultId: 4,
    signedAt: '2023-03-16T10:00:00Z',
    approved: false,
    signature:
      'Y+pPqnI7VFAxWmT3JhwCyXF531giNs02h7JVUfFwSAFBBH1R+719n5l171SZyf9rtu73ySUnYZep9QO3k1H+CQ==',
  },
  {
    holderVaultId: 5,
    signedAt: '2023-03-16T10:00:00Z',
    approved: false,
    signature:
      'Uc0o52I3xdqTx5vj5nQQuM9CK2aKYkCleMgZMDASzpTbeuEHgc5sZowkQ2Y3h/dgJeJPZNNO3G5Cv09ZpZrCCQ==',
  },
];

export const config1Approved: ShamirConfig = {
  id: 1,
  name: 'Shamir 1',
  min_shares: 1,
  is_active: false,
  support_email: 'support@testbank1.com',
  creator_email: 'admin@testbank1.com',
  bank_id: 1,
  created_at: new Date('2023-02-10T10:00:00Z'),
  change: JSON.stringify({
    previousShamirConfig: null,
    thisShamirConfig: configFootprint1,
  }),
  change_signatures: null,
};

export const config2Approved: ShamirConfig = {
  id: 2,
  name: 'Shamir 2',
  min_shares: 3,
  is_active: true,
  support_email: 'security@testbank1.com',
  creator_email: 'admin@testbank1.com',
  bank_id: 1,
  created_at: new Date('2023-03-01T14:30:00Z'),
  change: JSON.stringify({
    previousShamirConfig: configFootprint1,
    thisShamirConfig: configFootprint2,
  }),
  change_signatures: approvingSignaturesConfig2,
};

export const config3Pending: ShamirConfig = {
  id: 3,
  name: 'Shamir 3',
  min_shares: 1,
  is_active: false,
  support_email: 'test@testbank1.com',
  creator_email: 'admin@testbank1.com',
  bank_id: 1,
  created_at: new Date('2023-03-15T09:00:00Z'),
  change: JSON.stringify({
    previousShamirConfig: configFootprint2,
    thisShamirConfig: configFootprint3,
  }),
  change_signatures: [approvingSignaturesConfig3[1], approvingSignaturesConfig3[3]],
};

export const validShamirConfigChain: ShamirConfig[] = [
  config1Approved,
  config2Approved,
  config3Pending,
];

export const addTestShamirConfigs = async (shamirChain: ShamirConfig[]) => {
  for (let sc of shamirChain) {
    await db.query(
      `INSERT INTO shamir_configs (id, name, min_shares, is_active, support_email, creator_email, bank_id, created_at, change, change_signatures)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        sc.id,
        sc.name,
        sc.min_shares,
        sc.is_active,
        sc.support_email,
        sc.creator_email,
        sc.bank_id,
        sc.created_at,
        sc.change,
        sc.change_signatures !== null ? JSON.stringify(sc.change_signatures) : null,
      ],
    );
  }
};
