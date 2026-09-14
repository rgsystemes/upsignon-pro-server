//2026-09-14_15-00-00_add_archived_to_users

exports.up = function (db) {
  return db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS archived BOOLEAN');
};

exports.down = function (db) {
  return db.query('ALTER TABLE users DROP COLUMN IF EXISTS archived');
};
