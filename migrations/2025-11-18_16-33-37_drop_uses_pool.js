//2025-11-18_16-33-37_drop_uses_pool

exports.up = function (db) {
  return db.query('ALTER TABLE external_licences DROP COLUMN IF EXISTS uses_pool');
};

exports.down = function (db) {
  return db.query(
    'ALTER TABLE external_licences ADD COLUMN IF NOT EXISTS uses_pool BOOLEAN DEFAULT false',
  );
};
