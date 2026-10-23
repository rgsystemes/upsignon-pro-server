//2026-07-28_14-11-47_sso_passwordless

exports.up = async function (db) {
  await db.query(
    `ALTER TABLE allowed_emails ADD COLUMN IF NOT EXISTS uses_passwordless_auth BOOLEAN NOT NULL DEFAULT FALSE`,
  );
  await db.query(
    `ALTER TABLE banks ADD COLUMN IF NOT EXISTS ms_entra_vaults_use_passwordless_auth BOOLEAN NOT NULL DEFAULT FALSE`,
  );
  await db.query(`ALTER TABLE bank_sso_config DROP COLUMN IF EXISTS is_sso_v2`);
};

exports.down = async function (db) {
  await db.query(`ALTER TABLE allowed_emails DROP COLUMN IF EXISTS uses_passwordless_auth`);
  await db.query(`ALTER TABLE banks DROP COLUMN IF EXISTS ms_entra_vaults_use_passwordless_auth`);
  await db.query(
    `ALTER TABLE bank_sso_config ADD COLUMN IF NOT EXISTS is_sso_v2 BOOLEAN NOT NULL DEFAULT FALSE`,
  );
};
