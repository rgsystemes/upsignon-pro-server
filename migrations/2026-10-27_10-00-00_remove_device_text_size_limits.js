//2026-10-27_10-00-00_remove_device_text_size_limits

exports.up = function (db) {
  return db.query(
    'ALTER TABLE user_devices ALTER COLUMN device_name TYPE varchar(512), ALTER COLUMN os_version TYPE varchar(512)',
  );
};

exports.down = function (db) {
  return db.query(
    'ALTER TABLE user_devices ALTER COLUMN device_name TYPE varchar(64), ALTER COLUMN os_version TYPE varchar(64)',
  );
};
