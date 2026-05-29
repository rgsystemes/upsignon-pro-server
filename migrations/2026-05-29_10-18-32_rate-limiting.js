//2026-05-29_10-18-32_rate-limiting

exports.up = function(db) {
  return db.query("ALTER TABLE admins ADD COLUMN failed_attempts INT NOT NULL DEFAULT 0, ADD COLUMN lockout_until TIMESTAMP WITH TIME ZONE NULL");
}

exports.down = function(db) {
  return db.query("ALTER TABLE admins DROP COLUMN failed_attempts, DROP COLUMN lockout_until");
}
