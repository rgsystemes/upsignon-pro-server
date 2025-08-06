//2025-08-06_11-35-04_licences

exports.up = async function (db) {
  await db.query('BEGIN');
  await db.query(`CREATE TABLE IF NOT EXISTS external_licences
    (
    ext_id INT UNIQUE,
    nb_licences INT NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE,
    is_monthly BOOLEAN NOT NULL,
    to_be_renewed BOOLEAN NOT NULL,
    reseller_id UUID REFERENCES resellers(id) ON DELETE CASCADE,
    bank_id SMALLINT REFERENCES banks(id) ON DELETE CASCADE
    )`);
  await db.query(`CREATE TABLE IF NOT EXISTS internal_licences
    (
    id INT SERIAL PRIMARY KEY,
    external_licences_id INT NOT NULL REFERENCES external_licences(ext_id) ON DELETE CASCADE,
    nb_licences INT NOT NULL,
    bank_id SMALLINT NOT NULL REFERENCES banks(id) ON DELETE CASCADE
    )`);
  await db.query('ALTER TABlE banks DROP COLUMN IF EXISTS nb_licences_sold');
  await db.query("DELETE FROM settings WHERE key='LICENCES'");
  await db.query('COMMIT');
};

exports.down = async function (db) {
  await db.query('BEGIN');
  await db.query('ALTER TABlE banks ADD COLUMN IF NOT EXISTS nb_licences_sold INTEGER DEFAULT 0');
  await db.query('DROP TABLE IF EXISTS internal_licences');
  await db.query('DROP TABLE IF EXISTS external_licences');
  await db.query('COMMIT');
};
