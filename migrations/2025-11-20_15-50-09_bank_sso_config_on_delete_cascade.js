//2025-11-20_15-50-09_bank_sso_config_on_delete_cascade

exports.up = function (db) {
  return db.query(
    'ALTER TABLE bank_sso_config DROP CONSTRAINT fk_bank_id, ADD CONSTRAINT fk_bank_id FOREIGN KEY(bank_id) REFERENCES banks(id) ON DELETE CASCADE',
  );
};

exports.down = function (db) {
  return db.query(
    'ALTER TABLE bank_sso_config DROP CONSTRAINT fk_bank_id, ADD CONSTRAINT fk_bank_id FOREIGN KEY(bank_id) REFERENCES banks(id)',
  );
};
