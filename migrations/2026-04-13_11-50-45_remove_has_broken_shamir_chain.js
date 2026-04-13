//2026-04-13_11-50-45_remove_has_broken_shamir_chain

exports.up = async function (db) {
  await db.query(
    'ALTER TABLE banks ADD COLUMN IF NOT EXISTS last_shamir_security_alert_send_date TIMESTAMP WITH TIME ZONE',
  );
  await db.query('ALTER TABLE banks DROP COLUMN IF EXISTS has_broken_shamir_chain');
};

exports.down = async function (db) {
  await db.query('ALTER TABLE banks DROP COLUMN IF EXISTS last_shamir_security_alert_send_date');
  await db.query(
    'ALTER TABLE banks ADD COLUMN IF NOT EXISTS has_broken_shamir_chain BOOL NOT NULL DEFAULT false',
  );
};
