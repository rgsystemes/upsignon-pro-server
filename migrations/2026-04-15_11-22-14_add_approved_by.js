//2026-04-15_11-22-14_add_approved_by

exports.up = function (db) {
  return db.query(
    "ALTER TABLE shamir_recovery_requests ADD COLUMN approved_by INTEGER[] DEFAULT '{}'",
  );
};

exports.down = function (db) {
  return db.query('ALTER TABLE shamir_recovery_requests DROP COLUMN approved_by');
};
