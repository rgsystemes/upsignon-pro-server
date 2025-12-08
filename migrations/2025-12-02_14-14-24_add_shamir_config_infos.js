//2025-12-02_14-14-24_add_shamir_config_infos

exports.up = async function (db) {
  await db.query('ALTER TABLE shamir_configs DROP COLUMN IF EXISTS is_active');
  await db.query(`ALTER TABLE shamir_configs
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS support_email VARCHAR(100),
    ADD COLUMN IF NOT EXISTS creator_email VARCHAR(100),
    ADD COLUMN IF NOT EXISTS change TEXT,
    ADD COLUMN IF NOT EXISTS change_signatures JSONB`);
  await db.query(`ALTER TABLE shamir_recovery_requests
    ADD COLUMN expiry_date TIMESTAMP WITH TIMEZONE`);
};

exports.down = async function (db) {
  await db.query(`ALTER TABLE shamir_configs
    DROP COLUMN IF EXISTS is_active,
    DROP COLUMN IF EXISTS support_email,
    DROP COLUMN IF EXISTS creator_email,
    DROP COLUMN IF EXISTS change_signature`);
  await db.query(`ALTER TABLE shamir_configs ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true`);
  await db.query('ALTER TABLE shamir_recovery_requests DROP COLUMN expiry_date');
};
