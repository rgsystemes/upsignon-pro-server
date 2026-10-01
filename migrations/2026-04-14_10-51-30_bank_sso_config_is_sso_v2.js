//2026-04-14_10-51-30_bank_sso_config_is_sso_v2

exports.up = function (db) {
  return db.query(
    'ALTER TABLE bank_sso_config ADD COLUMN IF NOT EXISTS is_sso_v2 BOOLEAN NOT NULL DEFAULT FALSE',
  );
};

exports.down = function (db) {
  return db.query('ALTER TABLE bank_sso_config DROP COLUMN IF EXISTS is_sso_v2');
};
