//2025-12-02_14-14-24_shamir

exports.up = async function (db) {
  await db.query('BEGIN');
  await db.query(
    `CREATE TABLE IF NOT EXISTS shamir_configs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        min_shares SMALLINT NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT false,
        support_email VARCHAR(100),
        creator_email VARCHAR(100),
        bank_id INTEGER REFERENCES banks(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp(0),
        change TEXT,
        change_signatures JSONB
    )`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS shamir_holders (
        id SERIAL PRIMARY KEY,
        vault_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        shamir_config_id INTEGER REFERENCES shamir_configs(id) ON DELETE CASCADE,
        nb_shares SMALLINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp(0)
    )`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS shamir_shares (
        vault_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        holder_vault_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        shamir_config_id INTEGER REFERENCES shamir_configs(id),
        closed_shares TEXT[] NOT NULL,
        open_shares TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp(0),
        open_at TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY(vault_id, holder_vault_id, shamir_config_id)
    )`,
  );
  await db.query(`CREATE TYPE shamir_status AS ENUM ('PENDING', 'ABORTED', 'COMPLETED')`);
  await db.query(
    `CREATE TABLE IF NOT EXISTS shamir_recovery_requests (
        id SERIAL PRIMARY KEY,
        device_id INTEGER REFERENCES user_devices(id) ON DELETE CASCADE,
        public_key TEXT,
        shamir_config_id INTEGER REFERENCES shamir_configs(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP(0),
        completed_at TIMESTAMP WITH TIME ZONE,
        status shamir_status,
        expiry_date TIMESTAMP WITH TIME ZONE
    )`,
  );
  await db.query('COMMIT');
};

exports.down = async function (db) {
  await db.query('BEGIN');
  await db.query('DROP TABLE IF EXISTS shamir_recovery_requests');
  await db.query('DROP TABLE IF EXISTS shamir_shares');
  await db.query('DROP TABLE IF EXISTS shamir_holders');
  await db.query('DROP TABLE IF EXISTS shamir_configs');
  await db.query('DROP TYPE IF EXISTS shamir_status');
  await db.query('COMMIT');
};
