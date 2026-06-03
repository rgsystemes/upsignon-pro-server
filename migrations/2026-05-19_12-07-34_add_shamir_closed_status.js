//2026-05-19_12-07-34_add_shamir_closed_status

exports.up = function (db) {
  return db.query("ALTER TYPE shamir_status ADD VALUE 'CLOSED'");
};

exports.down = function (db) {
  return db.query("ALTER TYPE shamir_status DROP VALUE 'CLOSED'");
};
