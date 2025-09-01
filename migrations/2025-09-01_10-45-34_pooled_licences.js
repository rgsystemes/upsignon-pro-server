//2025-09-01_10-45-34_pooled_licences

exports.up = async function (db) {
  await db.query(`ALTER TABLE external_licences ADD COLUMN uses_pool BOOLEAN DEFAULT false`);
};

exports.down = async function (db) {
  await db.query(`ALTER TABLE external_licences DROP COLUMN uses_pool`);
};
