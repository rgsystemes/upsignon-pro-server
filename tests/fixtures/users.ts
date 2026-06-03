/**
                                                      Table « public.users »
               Colonne                |           Type           | Collationnement | NULL-able |            Par défaut
--------------------------------------+--------------------------+-----------------+-----------+-----------------------------------
 id                                   | integer                  |                 | not null  | nextval('users_id_seq'::regclass)
 email                                | character varying(64)    |                 |           |
 created_at                           | timestamp with time zone |                 |           | CURRENT_TIMESTAMP(0)
 updated_at                           | timestamp with time zone |                 |           | CURRENT_TIMESTAMP(0)
 bank_id                              | smallint                 |                 | not null  |
 nb_accounts                          | integer                  |                 |           | 0
 nb_codes                             | integer                  |                 |           | 0
 nb_accounts_strong                   | integer                  |                 |           | 0
 nb_accounts_medium                   | integer                  |                 |           | 0
 nb_accounts_weak                     | integer                  |                 |           | 0
 nb_accounts_with_duplicated_password | integer                  |                 |           | 0
 nb_accounts_with_no_password         | integer                  |                 |           | 0
 nb_accounts_red                      | integer                  |                 |           | 0
 nb_accounts_orange                   | integer                  |                 |           | 0
 nb_accounts_green                    | integer                  |                 |           | 0
 allowed_to_export                    | boolean                  |                 |           |
 encrypted_data_2                     | text                     |                 |           |
 sharing_public_key_2                 | text                     |                 |       sharingKeys.key .public|
 allowed_offline_desktop              | boolean                  |                 |           |
 allowed_offline_mobile               | boolean                  |                 |           |
 settings_override                    | jsonb                    |                 |           | '{}'::jsonb
 ms_entra_id                          | uuid                     |                 |           |
 deactivated                          | boolean                  |                 |           |
 signing_public_key                   | text                     |                 |       signingKeys.key .public|
Index :
    "users_pkey" PRIMARY KEY, btree (id)
    "users_email_group_key" UNIQUE CONSTRAINT, btree (email, bank_id)
Contraintes de vérification :
    "users_email_lowercase_constraint" CHECK (email::text = lower(email::text))
Contraintes de clés étrangères :
    "fk_users_group" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
Référencé par :
    TABLE "user_devices" CONSTRAINT "fk_user_id" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "changed_emails" CONSTRAINT "fk_user_id" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "shamir_holders" CONSTRAINT "shamir_holders_vault_id_fkey" FOREIGN KEY (vault_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "shamir_shares" CONSTRAINT "shamir_shares_holder_vault_id_fkey" FOREIGN KEY (holder_vault_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "shamir_shares" CONSTRAINT "shamir_shares_vault_id_fkey" FOREIGN KEY (vault_id) REFERENCES users(id) ON DELETE CASCADE
    TABLE "shared_vault_recipients" CONSTRAINT "shared_vault_recipients_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
 */

import { db } from '../../src/helpers/db';

export type User = {
  id: number;
  email: string | null;
  created_at: Date;
  updated_at: Date;
  bank_id: number;
  nb_accounts: number;
  nb_codes: number;
  nb_accounts_strong: number;
  nb_accounts_medium: number;
  nb_accounts_weak: number;
  nb_accounts_with_duplicated_password: number;
  nb_accounts_with_no_password: number;
  nb_accounts_red: number;
  nb_accounts_orange: number;
  nb_accounts_green: number;
  allowed_to_export: boolean | null;
  encrypted_data_2: string | null;
  sharing_public_key_2: string | null;
  allowed_offline_desktop: boolean | null;
  allowed_offline_mobile: boolean | null;
  settings_override: Record<string, any>;
  ms_entra_id: string | null;
  deactivated: boolean | null;
  signing_public_key: string | null;
};

const sharingKeys = {
  key1: {
    public: 'VO8BJSM+drNdlNm9AkAmQXg6/AHl+xDnskvrbdXilH4=',
    private: 'FwyMSAyuC+a7IQvGWegk08IXS6VYqtZThGZQgBsy+IQ=',
  },
  key2: {
    public: '2CAhQVMbuRulJMyz7nsuNhXDt3kQjzGLOaCnm4v9YhU=',
    private: 'neEj+ouAOFaKczbM3VEjrWT8dNZRBOdtOGQAGp7oxFc=',
  },
  key3: {
    public: '78laDpOxakcGaDSVfOTHz2jx9A3VQ4r+fxUU2UEVSCg=',
    private: 'XvVE5aBJLAXEFIig92SfTX6jkTxBCY1c4YcglBXNxzs=',
  },
  key4: {
    public: 'y8cC9saI397Abt+kdPxx0zG8y4zpzA6JRA4XqAiW93A=',
    private: '+KPfFrgkt9ku9XO9ehwB5qS/ZokLVBY1/jm3X2EPbYk=',
  },
  key5: {
    public: 'fZssSU/bDt+obMKJtqApdO6jbmy0azOtKGtr1H2+QX8=',
    private: 'pXPvoqrRQ3TzMo3ftT8VLWuvBgLksMpt4De4d4d10eg=',
  },
  key6: {
    public: '6hhGvq9fz0Kx1rbVkL6jE6h7ifh9qFJXTHzgrNEPjB4=',
    private: 'LNPJMZtKweXLOK3IWCuFgnljkpvwYlf0h57ndA5P7UU=',
  },
  key7: {
    public: 'xAh3JMBWT0QPCR9EsD9Yn0Nueney/vXhv0nnJjzWhQA=',
    private: 'FThw80bpMeXrOdhOnplEjLIlDhr9H5ClK6o5D4N5QZ0=',
  },
  key8: {
    public: 'qnRcZDgGTzNEte1vkZ4J3b2LwnO+jwwlscK1AAR6RBU=',
    private: '1jtgsw2aX64cVS51Mcs9PZZEcRhSiTfVfpU5uPK1Gzo=',
  },
  key9: {
    public: 'jetlulTMCUpDC1Jj/npU9PP44qltTDg0/i+gLRjedB0=',
    private: 'EJcYZoTW+GZA0DU7OJWUDb0OJGsl/QZ4lPgECAYPqFA=',
  },
  key10: {
    public: 'RgeoxUXR3Gfy10oQFNHko0Oga+nbWenB7JClg7XoIlw=',
    private: 'kuFMkscRlku9JS01iHf6BO95SiaRlk+nXWy5ZQ8RRoU=',
  },
};

const signingKeys = {
  key1: {
    public: 'Oo9Do/g8Wak201deG8C902+a7VIEDzgZu6YFyuxqMCs=',
    private:
      'bEdcW4Phq8vPGDTYcbtGx2912MvXVTLvV0u8rRz+xg86j0Oj+DxZqTbTV14bwL3Tb5rtUgQPOBm7pgXK7GowKw==',
  },
  key2: {
    public: 'Arf/cbVfjXekFHgrJnpFf07xN8UFSjOjNDaZ/seWS1k=',
    private:
      'PqV0luUt7B5GVsLyni3tml9ol9WNsd6rTShIePIA2QYCt/9xtV+Nd6QUeCsmekV/TvE3xQVKM6M0Npn+x5ZLWQ==',
  },
  key3: {
    public: 'TjKNbUuVY7Z2bvkBOO6TZchXTp1FsnlClHTwDd6XOJE=',
    private:
      'UWEzLfh/FFsjGF3qU+fiuE7R+tpQy5PYoX8hrd1T8JNOMo1tS5VjtnZu+QE47pNlyFdOnUWyeUKUdPAN3pc4kQ==',
  },
  key4: {
    public: 'iFB2t1w6HfzUawFQDvvT6QvfDZm/gdVMhu7zLEi4kLs=',
    private:
      'DlKCL0HGziQV8E/GWmWX42eVTgHe6pzpcDn3GYhZZ3+IUHa3XDod/NRrAVAO+9PpC98Nmb+B1UyG7vMsSLiQuw==',
  },
  key5: {
    public: 'Z1fm5BxZSXb6oW9zPVHbIgVQnHfWMKS6gf4I6kx4HAE=',
    private:
      'ns+YWhrdEHlMc1WJvCiaFbxS0JEYl6pCpyLR8+AZk7lnV+bkHFlJdvqhb3M9UdsiBVCcd9YwpLqB/gjqTHgcAQ==',
  },
  key6: {
    public: '2hFtfxKaeFPMbDVGo6IIc1fuZCEgqNhHI95PmBh+iJE=',
    private:
      'Eg3YOthUCWZiD4aXcAx3XI3iqpjBdzI2Vfg+vlcM7k/aEW1/Epp4U8xsNUajoghzV+5kISCo2Ecj3k+YGH6IkQ==',
  },
  key7: {
    public: 'HonW3ew5Vkfd19cdOZfaDsWDEtpdlLVbaWdljiJQ+cE=',
    private:
      '4ARigykSvLpr8lgPQt2c/+3QbwpBqOzM8Sz0nGkxhtMeidbd7DlWR93X1x05l9oOxYMS2l2UtVtpZ2WOIlD5wQ==',
  },
  key8: {
    public: 'HH2iHS8sfaGPFAKiYI1zB+BEXZlU7CSpgRSF1dYtPHQ=',
    private:
      'ZgVeaqjS13pLE/leiBVuPjTH4x8XzIuC3thsvAN4L60cfaIdLyx9oY8UAqJgjXMH4ERdmVTsJKmBFIXV1i08dA==',
  },
  key9: {
    public: 'XHP8ydQCdgVnjtaQDg9kYWPVD0S38yb4fI1uKPlyDmw=',
    private:
      'mp32Eu8qAA5rjBWaC+PDWjOc4f5H0Sweez0fv9/doPVcc/zJ1AJ2BWeO1pAOD2RhY9UPRLfzJvh8jW4o+XIObA==',
  },
  key10: {
    public: 'rqXnB5X5INayzxT4gkHfdFE1Xg5X04yFMSsz36/fslI=',
    private:
      'mxrwvJ7qhWs/UdfOXvIoEu6lLFDkZ33As63LIySEELaupecHlfkg1rLPFPiCQd90UTVeDlfTjIUxKzPfr9+yUg==',
  },
};

const basicUser1: User = {
  id: 1,
  email: 'user1@testbank1.com',
  created_at: new Date('2023-02-01T10:00:00Z'),
  updated_at: new Date('2023-02-01T10:00:00Z'),
  bank_id: 1,
  nb_accounts: 5,
  nb_codes: 2,
  nb_accounts_strong: 3,
  nb_accounts_medium: 2,
  nb_accounts_weak: 0,
  nb_accounts_with_duplicated_password: 0,
  nb_accounts_with_no_password: 1,
  nb_accounts_red: 0,
  nb_accounts_orange: 2,
  nb_accounts_green: 3,
  allowed_to_export: true,
  encrypted_data_2: null,
  sharing_public_key_2: sharingKeys.key1.public,
  allowed_offline_desktop: true,
  allowed_offline_mobile: true,
  settings_override: {},
  ms_entra_id: null,
  deactivated: false,
  signing_public_key: signingKeys.key1.public,
};

const basicUser2: User = {
  id: 2,
  email: 'user2@testbank1.com',
  created_at: new Date('2023-02-05T14:30:00Z'),
  updated_at: new Date('2023-02-05T14:30:00Z'),
  bank_id: 1,
  nb_accounts: 12,
  nb_codes: 5,
  nb_accounts_strong: 8,
  nb_accounts_medium: 3,
  nb_accounts_weak: 1,
  nb_accounts_with_duplicated_password: 1,
  nb_accounts_with_no_password: 0,
  nb_accounts_red: 1,
  nb_accounts_orange: 3,
  nb_accounts_green: 8,
  allowed_to_export: false,
  encrypted_data_2: null,
  sharing_public_key_2: sharingKeys.key2.public,
  allowed_offline_desktop: false,
  allowed_offline_mobile: true,
  settings_override: {},
  ms_entra_id: null,
  deactivated: false,
  signing_public_key: signingKeys.key2.public,
};

const basicUser3: User = {
  id: 3,
  email: 'user3@testbank1.com',
  created_at: new Date('2023-03-10T09:15:00Z'),
  updated_at: new Date('2023-03-10T09:15:00Z'),
  bank_id: 1,
  nb_accounts: 3,
  nb_codes: 1,
  nb_accounts_strong: 2,
  nb_accounts_medium: 1,
  nb_accounts_weak: 0,
  nb_accounts_with_duplicated_password: 0,
  nb_accounts_with_no_password: 0,
  nb_accounts_red: 0,
  nb_accounts_orange: 1,
  nb_accounts_green: 2,
  allowed_to_export: true,
  encrypted_data_2: null,
  sharing_public_key_2: sharingKeys.key3.public,
  allowed_offline_desktop: true,
  allowed_offline_mobile: false,
  settings_override: {},
  ms_entra_id: null,
  deactivated: false,
  signing_public_key: signingKeys.key3.public,
};

const basicUser4: User = {
  id: 4,
  email: 'user1@testbank2.com',
  created_at: new Date('2023-02-15T11:00:00Z'),
  updated_at: new Date('2023-02-15T11:00:00Z'),
  bank_id: 2,
  nb_accounts: 8,
  nb_codes: 3,
  nb_accounts_strong: 5,
  nb_accounts_medium: 2,
  nb_accounts_weak: 1,
  nb_accounts_with_duplicated_password: 1,
  nb_accounts_with_no_password: 1,
  nb_accounts_red: 1,
  nb_accounts_orange: 2,
  nb_accounts_green: 5,
  allowed_to_export: true,
  encrypted_data_2: null,
  sharing_public_key_2: sharingKeys.key4.public,
  allowed_offline_desktop: true,
  allowed_offline_mobile: true,
  settings_override: {},
  ms_entra_id: null,
  deactivated: false,
  signing_public_key: signingKeys.key4.public,
};

const basicUser5: User = {
  id: 5,
  email: 'user2@testbank2.com',
  created_at: new Date('2023-03-20T16:45:00Z'),
  updated_at: new Date('2023-03-20T16:45:00Z'),
  bank_id: 2,
  nb_accounts: 0,
  nb_codes: 0,
  nb_accounts_strong: 0,
  nb_accounts_medium: 0,
  nb_accounts_weak: 0,
  nb_accounts_with_duplicated_password: 0,
  nb_accounts_with_no_password: 0,
  nb_accounts_red: 0,
  nb_accounts_orange: 0,
  nb_accounts_green: 0,
  allowed_to_export: false,
  encrypted_data_2: null,
  sharing_public_key_2: sharingKeys.key5.public,
  allowed_offline_desktop: false,
  allowed_offline_mobile: false,
  settings_override: {},
  ms_entra_id: null,
  deactivated: false,
  signing_public_key: signingKeys.key5.public,
};

export const testUsers: User[] = [basicUser1, basicUser2, basicUser3, basicUser4, basicUser5];

export const addTestUsers = async () => {
  for (let u of testUsers) {
    await db.query(
      `INSERT INTO users (id, email, created_at, updated_at, bank_id, nb_accounts, nb_codes, nb_accounts_strong, nb_accounts_medium, nb_accounts_weak, nb_accounts_with_duplicated_password, nb_accounts_with_no_password, nb_accounts_red, nb_accounts_orange, nb_accounts_green, allowed_to_export, encrypted_data_2, sharing_public_key_2, allowed_offline_desktop, allowed_offline_mobile, settings_override, ms_entra_id, deactivated, signing_public_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        u.id,
        u.email,
        u.created_at,
        u.updated_at,
        u.bank_id,
        u.nb_accounts,
        u.nb_codes,
        u.nb_accounts_strong,
        u.nb_accounts_medium,
        u.nb_accounts_weak,
        u.nb_accounts_with_duplicated_password,
        u.nb_accounts_with_no_password,
        u.nb_accounts_red,
        u.nb_accounts_orange,
        u.nb_accounts_green,
        u.allowed_to_export,
        u.encrypted_data_2,
        u.sharing_public_key_2,
        u.allowed_offline_desktop,
        u.allowed_offline_mobile,
        u.settings_override,
        u.ms_entra_id,
        u.deactivated,
        u.signing_public_key,
      ],
    );
  }
};
