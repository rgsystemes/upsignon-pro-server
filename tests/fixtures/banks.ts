/** TABLE banks
       Colonne       |           Type           | Collationnement | NULL-able |             Par défaut
--------------------+--------------------------+-----------------+-----------+------------------------------------
 id                 | smallint                 |                 | not null  | nextval('groups_id_seq'::regclass)
 name               | text                     |                 |           |
 settings           | jsonb                    |                 |           |
 created_at         | timestamp with time zone |                 |           | CURRENT_TIMESTAMP(0)
 ms_entra_config    | json                     |                 |           |
 redirect_url       | text                     |                 |           |
 stop_this_instance | boolean                  |                 |           |
 public_id          | uuid                     |                 | not null  | gen_random_uuid()
 reseller_id        | uuid                     |                 |           |
Index :
    "groups_pkey" PRIMARY KEY, btree (id)
    "groups_public_id_key" UNIQUE CONSTRAINT, btree (public_id)
Contraintes de clés étrangères :
    "banks_reseller_id_fkey" FOREIGN KEY (reseller_id) REFERENCES resellers(id)
Référencé par :
    TABLE "external_licences" CONSTRAINT "external_licences_bank_id_fkey" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "allowed_emails" CONSTRAINT "fk_allowed_email_group" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "bank_sso_config" CONSTRAINT "fk_bank_id" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "changed_emails" CONSTRAINT "fk_changed_email_group" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "admin_banks" CONSTRAINT "fk_group_id" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "password_reset_request" CONSTRAINT "fk_password_reset_request_group" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "url_list" CONSTRAINT "fk_url_list_group" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "user_devices" CONSTRAINT "fk_user_devices_group" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "users" CONSTRAINT "fk_users_group" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "internal_licences" CONSTRAINT "internal_licences_bank_id_fkey" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "shamir_configs" CONSTRAINT "shamir_configs_bank_id_fkey" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "shared_vault_recipients" CONSTRAINT "shared_vault_recipients_group_id_fkey" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
    TABLE "shared_vaults" CONSTRAINT "shared_vaults_group_id_fkey" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
 */

import { db } from '../../src/helpers/db';

export type Bank = {
  id: number;
  name: string | null;
  settings: Record<string, any> | null;
  created_at: Date;
  ms_entra_config: any | null;
  redirect_url: string | null;
  stop_this_instance: boolean | null;
  public_id: string;
  reseller_id: string | null;
};

const basicBank1: Bank = {
  id: 1,
  name: 'Bank 1',
  settings: null,
  created_at: new Date('2023-01-15T10:00:00Z'),
  ms_entra_config: null,
  redirect_url: null,
  stop_this_instance: null,
  public_id: '6333b2b6-2598-4a31-a263-e1897b29d5f5',
  reseller_id: null,
};
const basicBank2: Bank = {
  id: 2,
  name: 'Bank 2',
  settings: null,
  created_at: new Date('2023-01-15T10:00:00Z'),
  ms_entra_config: null,
  redirect_url: null,
  stop_this_instance: null,
  public_id: '98073dee-c66b-4bce-b385-1b66bc76e7fc',
  reseller_id: null,
};

export const testBanks: Bank[] = [basicBank1, basicBank2];

export const addTestBanks = async () => {
  for (let b of testBanks) {
    await db.query(
      `INSERT INTO banks (id, name, settings, created_at, ms_entra_config, redirect_url, stop_this_instance, public_id, reseller_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        b.id,
        b.name,
        b.settings,
        b.created_at,
        b.ms_entra_config,
        b.redirect_url,
        b.stop_this_instance,
        b.public_id,
        b.reseller_id,
      ],
    );
  }
};
