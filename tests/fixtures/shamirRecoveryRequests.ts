/**
                                      Table « public.shamir_recovery_requests »
     Colonne      |           Type           | Collationnement | NULL-able |                      Par défaut
------------------+--------------------------+-----------------+-----------+-------------------------------------------------------
 id               | integer                  |                 | not null  | nextval('shamir_recovery_requests_id_seq'::regclass)
 device_id        | integer                  |                 |           |
 public_key       | text                     |                 |           |
 shamir_config_id | integer                  |                 |           |
 created_at       | timestamp with time zone |                 |           | CURRENT_TIMESTAMP(0)
 completed_at     | timestamp with time zone |                 |           |
 status           | shamir_status            |                 |           |
 expiry_date      | timestamp with time zone |                 |           |
 denied_by        | integer[]                |                 |           | '{}'::integer[]
Index :
    "shamir_recovery_requests_pkey" PRIMARY KEY, btree (id)
Contraintes de clés étrangères :
    "shamir_recovery_requests_device_id_fkey" FOREIGN KEY (device_id) REFERENCES user_devices(id) ON DELETE CASCADE
    "shamir_recovery_requests_shamir_config_id_fkey" FOREIGN KEY (shamir_config_id) REFERENCES shamir_configs(id) ON DELETE CASCADE
 */

import { db } from '../../src/helpers/db';

export type ShamirStatus = 'PENDING' | 'ABORTED' | 'COMPLETED';

export type ShamirRecoveryRequest = {
  id: number;
  device_id: number;
  public_key?: string | null;
  shamir_config_id: number;
  created_at?: Date;
  completed_at?: Date | null;
  status: ShamirStatus;
  expiry_date?: Date | null;
  denied_by?: number[];
};

export const pendingRecoveryRequest1: ShamirRecoveryRequest = {
  id: 1,
  device_id: 1,
  public_key: 'tempPublicKey1ForRecovery',
  shamir_config_id: 2,
  created_at: new Date('2024-01-10T10:00:00Z'),
  completed_at: null,
  status: 'PENDING',
  expiry_date: new Date('2024-01-17T10:00:00Z'),
  denied_by: [],
};

export const pendingRecoveryRequest2: ShamirRecoveryRequest = {
  id: 2,
  device_id: 2,
  public_key: 'tempPublicKey2ForRecovery',
  shamir_config_id: 2,
  created_at: new Date('2024-01-12T14:30:00Z'),
  completed_at: null,
  status: 'PENDING',
  expiry_date: new Date('2024-01-19T14:30:00Z'),
  denied_by: [],
};

export const completedRecoveryRequest: ShamirRecoveryRequest = {
  id: 3,
  device_id: 3,
  public_key: 'tempPublicKey3ForRecovery',
  shamir_config_id: 2,
  created_at: new Date('2023-12-20T09:00:00Z'),
  completed_at: new Date('2023-12-22T11:30:00Z'),
  status: 'COMPLETED',
  expiry_date: new Date('2023-12-27T09:00:00Z'),
  denied_by: [],
};

export const abortedRecoveryRequest: ShamirRecoveryRequest = {
  id: 4,
  device_id: 4,
  public_key: 'tempPublicKey4ForRecovery',
  shamir_config_id: 2,
  created_at: new Date('2023-12-15T10:00:00Z'),
  completed_at: null,
  status: 'ABORTED',
  expiry_date: new Date('2023-12-22T10:00:00Z'),
  denied_by: [],
};

export const deniedRecoveryRequest: ShamirRecoveryRequest = {
  id: 1,
  device_id: 1,
  public_key: 'tempPublicKey1ForRecovery',
  shamir_config_id: 2,
  created_at: new Date('2024-01-05T16:00:00Z'),
  completed_at: null,
  status: 'PENDING',
  expiry_date: new Date('2024-01-12T16:00:00Z'),
  denied_by: [2, 5],
};

export const expiredRecoveryRequest: ShamirRecoveryRequest = {
  id: 6,
  device_id: 1,
  public_key: 'tempPublicKey6ForRecovery',
  shamir_config_id: 1,
  created_at: new Date('2023-11-01T08:00:00Z'),
  completed_at: null,
  status: 'PENDING',
  expiry_date: new Date('2023-11-08T08:00:00Z'),
  denied_by: [],
};

export const allRecoveryRequests: ShamirRecoveryRequest[] = [
  pendingRecoveryRequest1,
  pendingRecoveryRequest2,
  completedRecoveryRequest,
  abortedRecoveryRequest,
  deniedRecoveryRequest,
  expiredRecoveryRequest,
];

export const addTestShamirRecoveryRequests = async (requests: ShamirRecoveryRequest[]) => {
  for (const request of requests) {
    await db.query(
      `INSERT INTO shamir_recovery_requests
       (id, device_id, public_key, shamir_config_id, created_at, completed_at, status, expiry_date, denied_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        request.id,
        request.device_id,
        request.public_key,
        request.shamir_config_id,
        request.created_at,
        request.completed_at,
        request.status,
        request.expiry_date,
        request.denied_by,
      ],
    );
  }
};
