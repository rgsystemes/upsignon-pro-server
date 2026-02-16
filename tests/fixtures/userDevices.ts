/**
Table « public.user_devices »
                 Colonne                 |           Type           | Collationnement | NULL-able |                Par défaut
-----------------------------------------+--------------------------+-----------------+-----------+------------------------------------------
 id                                      | integer                  |                 | not null  | nextval('user_devices_id_seq'::regclass)
 user_id                                 | integer                  |                 |           |
 device_name                             | character varying(64)    |                 |           |
 device_unique_id                        | uuid                     |                 |           |
 authorization_status                    | character varying(64)    |                 |           |
 authorization_code                      | character varying        |                 |           |
 auth_code_expiration_date               | timestamp with time zone |                 |           |
 created_at                              | timestamp with time zone |                 |           | CURRENT_TIMESTAMP(0)
 device_type                             | text                     |                 |           |
 os_version                              | character varying(64)    |                 |           |
 revocation_date                         | timestamp with time zone |                 |           |
 app_version                             | character varying(20)    |                 |           |
 bank_id                                 | smallint                 |                 | not null  |
 session_auth_challenge                  | text                     |                 |           |
 session_auth_challenge_exp_time         | timestamp with time zone |                 |           |
 password_challenge_error_count          | integer                  |                 |           | 0
 last_password_challenge_submission_date | timestamp with time zone |                 |           |
 encrypted_password_backup_2             | text                     |                 |           |
 device_public_key_2                     | text                     |                 |           |
 last_sync_date                          | timestamp with time zone |                 |           |
 install_type                            | text                     |                 |           |
 os_family                               | text                     |                 |           |
 use_safe_browser_setup                  | boolean                  |                 |           |
 enrollment_method                       | character varying        |                 |           | 'email'::character varying
 */

import { db } from '../../src/helpers/db';

export type UserDevice = {
  id: number;
  user_id?: number;
  device_name?: string;
  device_unique_id?: string;
  authorization_status?: string;
  authorization_code?: string;
  auth_code_expiration_date?: Date;
  created_at?: Date;
  device_type?: string;
  os_version?: string;
  revocation_date?: Date;
  app_version?: string;
  bank_id: number;
  session_auth_challenge?: string;
  session_auth_challenge_exp_time?: Date;
  password_challenge_error_count?: number;
  last_password_challenge_submission_date?: Date;
  encrypted_password_backup_2?: string;
  device_public_key_2?: string;
  last_sync_date?: Date;
  install_type?: string;
  os_family?: string;
  use_safe_browser_setup?: boolean;
  enrollment_method?: string;
};

export const device1: UserDevice = {
  id: 1,
  user_id: 1,
  device_name: 'iPhone 15',
  device_unique_id: '550e8400-e29b-41d4-a716-446655440001',
  authorization_status: 'AUTHORIZED',
  created_at: new Date('2024-01-15'),
  device_type: 'PHONE',
  os_version: '17.2',
  app_version: '1.0.0',
  bank_id: 1,
  password_challenge_error_count: 0,
  device_public_key_2: 'publicKey1',
  last_sync_date: new Date('2024-02-10'),
  install_type: 'app_store',
  os_family: 'iOS',
  use_safe_browser_setup: true,
  enrollment_method: 'email',
};

export const device2: UserDevice = {
  id: 2,
  user_id: 2,
  device_name: 'MacBook Pro',
  device_unique_id: '550e8400-e29b-41d4-a716-446655440002',
  authorization_status: 'AUTHORIZED',
  created_at: new Date('2024-01-20'),
  device_type: 'DESKTOP',
  os_version: '14.3',
  app_version: '1.0.1',
  bank_id: 1,
  password_challenge_error_count: 0,
  device_public_key_2: 'publicKey2',
  last_sync_date: new Date('2024-02-09'),
  install_type: 'direct_download',
  os_family: 'macOS',
  use_safe_browser_setup: false,
  enrollment_method: 'email',
};

export const device3: UserDevice = {
  id: 3,
  user_id: 3,
  device_name: 'Samsung Galaxy S24',
  device_unique_id: '550e8400-e29b-41d4-a716-446655440003',
  authorization_status: 'PENDING',
  authorization_code: '550e8400-e29b-41d4-a716-446655440999',
  auth_code_expiration_date: new Date('2024-02-15'),
  created_at: new Date('2024-02-10'),
  device_type: 'PHONE',
  os_version: '14.0',
  app_version: '1.0.2',
  bank_id: 1,
  password_challenge_error_count: 0,
  install_type: 'play_store',
  os_family: 'Android',
  use_safe_browser_setup: true,
  enrollment_method: 'email',
};

export const device4: UserDevice = {
  id: 4,
  user_id: 4,
  device_name: 'Windows Desktop',
  device_unique_id: '550e8400-e29b-41d4-a716-446655440004',
  authorization_status: 'AUTHORIZED',
  created_at: new Date('2023-12-01'),
  device_type: 'DESKTOP',
  os_version: '11',
  revocation_date: new Date('2024-01-15'),
  app_version: '0.9.5',
  bank_id: 1,
  password_challenge_error_count: 2,
  last_password_challenge_submission_date: new Date('2024-01-14'),
  encrypted_password_backup_2: 'encryptedBackup4',
  device_public_key_2: 'publicKey4',
  last_sync_date: new Date('2024-01-10'),
  install_type: 'direct_download',
  os_family: 'Windows',
  use_safe_browser_setup: false,
  enrollment_method: 'qr_code',
};

export const device5: UserDevice = {
  id: 5,
  user_id: 5,
  device_name: 'iPad Pro',
  device_unique_id: '550e8400-e29b-41d4-a716-446655440005',
  authorization_status: 'AUTHORIZED',
  created_at: new Date('2024-01-25'),
  device_type: 'TABLET',
  os_version: '17.3',
  app_version: '1.0.2',
  bank_id: 2,
  password_challenge_error_count: 0,
  device_public_key_2: 'publicKey5',
  last_sync_date: new Date('2024-02-10'),
  install_type: 'app_store',
  os_family: 'iOS',
  use_safe_browser_setup: true,
  enrollment_method: 'email',
};

export const testDevices: UserDevice[] = [device1, device2, device3, device4, device5];

export const addTestDevice = async (d: UserDevice) => {
  await db.query(
    `INSERT INTO user_devices (
        id, user_id, device_name, device_unique_id, authorization_status,
        authorization_code, auth_code_expiration_date, created_at, device_type,
        os_version, revocation_date, app_version, bank_id, session_auth_challenge,
        session_auth_challenge_exp_time, password_challenge_error_count,
        last_password_challenge_submission_date, encrypted_password_backup_2,
        device_public_key_2, last_sync_date, install_type, os_family,
        use_safe_browser_setup, enrollment_method
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
    [
      d.id,
      d.user_id,
      d.device_name,
      d.device_unique_id,
      d.authorization_status,
      d.authorization_code,
      d.auth_code_expiration_date,
      d.created_at,
      d.device_type,
      d.os_version,
      d.revocation_date,
      d.app_version,
      d.bank_id,
      d.session_auth_challenge,
      d.session_auth_challenge_exp_time,
      d.password_challenge_error_count,
      d.last_password_challenge_submission_date,
      d.encrypted_password_backup_2,
      d.device_public_key_2,
      d.last_sync_date,
      d.install_type,
      d.os_family,
      d.use_safe_browser_setup,
      d.enrollment_method,
    ],
  );
};
export const addTestDevices = async () => {
  for (let d of testDevices) {
    await addTestDevice(d);
  }
};

export const deviceForUser = (userId: number): UserDevice => {
  return testDevices.find((td) => td.user_id === userId)!;
};
