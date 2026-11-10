//2026-11-10_14-27-48_add-session-index

exports.up = function (db) {
  return db.query(
    "CREATE INDEX IF NOT EXISTS admin_sessions_admin_email_idx ON admin_sessions ((session_data ->> 'adminEmail'))",
  );
};

exports.down = function (db) {
  return db.query('DROP INDEX IF EXISTS admin_sessions_admin_email_idx');
};
