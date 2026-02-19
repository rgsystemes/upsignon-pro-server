import { db } from '../../src/helpers/db';

export type Admin = {
  id: string;
  email: string;
  password_hash: string | null;
  token: string | null;
  token_expires_at: Date | null;
  created_at: Date;
  admin_role: 'superadmin' | 'restricted_superadmin' | 'admin';
  reseller_id: string | null;
};

export type AdminBank = {
  admin_id: string;
  bank_id: number;
};

const basicAdmin1: Admin = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'admin1@bank1.com',
  password_hash: '$2b$10$somehashedpassword',
  token: null,
  token_expires_at: null,
  created_at: new Date('2023-01-01T10:00:00Z'),
  admin_role: 'admin',
  reseller_id: null,
};

const basicAdmin2: Admin = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'admin2@bank1.com',
  password_hash: '$2b$10$somehashedpassword',
  token: null,
  token_expires_at: null,
  created_at: new Date('2023-01-01T10:00:00Z'),
  admin_role: 'admin',
  reseller_id: null,
};

const basicAdmin3: Admin = {
  id: '33333333-3333-3333-3333-333333333333',
  email: 'admin3@bank2.com',
  password_hash: '$2b$10$somehashedpassword',
  token: null,
  token_expires_at: null,
  created_at: new Date('2023-01-01T10:00:00Z'),
  admin_role: 'admin',
  reseller_id: null,
};

const superAdmin1: Admin = {
  id: '99999999-9999-9999-9999-999999999999',
  email: 'superadmin@company.com',
  password_hash: '$2b$10$somehashedpassword',
  token: null,
  token_expires_at: null,
  created_at: new Date('2023-01-01T10:00:00Z'),
  admin_role: 'superadmin',
  reseller_id: null,
};

const superAdmin2: Admin = {
  id: '88888888-8888-8888-8888-888888888888',
  email: 'superadmin2@company.com',
  password_hash: '$2b$10$somehashedpassword',
  token: null,
  token_expires_at: null,
  created_at: new Date('2023-01-01T10:00:00Z'),
  admin_role: 'superadmin',
  reseller_id: null,
};

const restrictedSuperAdmin1: Admin = {
  id: '77777777-7777-7777-7777-777777777777',
  email: 'restricted@company.com',
  password_hash: '$2b$10$somehashedpassword',
  token: null,
  token_expires_at: null,
  created_at: new Date('2023-01-01T10:00:00Z'),
  admin_role: 'restricted_superadmin',
  reseller_id: null,
};

const restrictedSuperAdmin2: Admin = {
  id: '66666666-6666-6666-6666-666666666666',
  email: 'restricted2@company.com',
  password_hash: '$2b$10$somehashedpassword',
  token: null,
  token_expires_at: null,
  created_at: new Date('2023-01-01T10:00:00Z'),
  admin_role: 'restricted_superadmin',
  reseller_id: null,
};

export const allAdmins: Admin[] = [
  basicAdmin1,
  basicAdmin2,
  basicAdmin3,
  superAdmin1,
  superAdmin2,
  restrictedSuperAdmin1,
  restrictedSuperAdmin2,
];
export const superadmins: Admin[] = [superAdmin1, superAdmin2];
export const restrictedSuperadmins: Admin[] = [superAdmin1, superAdmin2];
export const bankAdmins: Admin[] = [superAdmin1, superAdmin2];

const adminBank1: AdminBank = {
  admin_id: basicAdmin1.id,
  bank_id: 1,
};

const adminBank2: AdminBank = {
  admin_id: basicAdmin2.id,
  bank_id: 1,
};

const adminBank3: AdminBank = {
  admin_id: basicAdmin3.id,
  bank_id: 2,
};

export const testAdminBanks: AdminBank[] = [adminBank1, adminBank2, adminBank3];

export const addTestAdmins = async (admins: Admin[]) => {
  for (let a of admins) {
    await db.query(
      `INSERT INTO admins (id, email, password_hash, token, token_expires_at, created_at, admin_role, reseller_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        a.id,
        a.email,
        a.password_hash,
        a.token,
        a.token_expires_at,
        a.created_at,
        a.admin_role,
        a.reseller_id,
      ],
    );
  }
};

export const addTestAdminBanks = async () => {
  for (let ab of testAdminBanks) {
    await db.query(
      `INSERT INTO admin_banks (admin_id, bank_id)
      VALUES ($1, $2)`,
      [ab.admin_id, ab.bank_id],
    );
  }
};
