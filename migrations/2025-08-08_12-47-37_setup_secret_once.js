//2025-08-08_12-47-37_setup_secret_once

exports.up = function (db) {
  return db.query(
    "INSERT INTO settings (key,value) VALUES ('SECRET', to_json(gen_random_uuid()::text))",
  );
};

exports.down = function (db) {
  return db.query("DELETE FROM settings WHERE key='SECRET'");
};
