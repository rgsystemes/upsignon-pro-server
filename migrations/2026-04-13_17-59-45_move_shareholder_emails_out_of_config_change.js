//2026-04-13_17-59-45_move_shareholder_emails_out_of_config_change

exports.up = function (db) {
  return db.query(
    'ALTER TABLE shamir_configs ADD COLUMN IF NOT EXISTS shareholder_emails TEXT NOT NULL',
  );
};

exports.down = function (db) {
  return db.query('ALTER TABLE shamir_configs DROP COLUMN IF EXISTS shareholder_emails');
};
