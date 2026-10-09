//2026-07-27_10-00-00_add_password_backup_public_key

exports.up = function (db) {
  return db.query(
    'ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS password_backup_public_key TEXT',
  );
};

exports.down = function (db) {
  return db.query('ALTER TABLE user_devices DROP COLUMN IF EXISTS password_backup_public_key');
};
