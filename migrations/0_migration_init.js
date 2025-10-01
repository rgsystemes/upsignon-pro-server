exports.up = async function (db) {
  await db.query(
    'CREATE TABLE IF NOT EXISTS migrations (name varchar(255) NOT NULL, migration_time timestamp with time zone DEFAULT current_timestamp(0))',
  );
  await db.query(
    'CREATE TABLE IF NOT EXISTS admin_sessions (session_id VARCHAR PRIMARY KEY, session_data JSONB NOT NULL, expiration_time TIMESTAMP(0) NOT NULL)',
  );
};

exports.down = async function (db) {
  await db.query('DROP TABLE migrations');
  await db.query('DROP TABLE admin_sessions');
};
