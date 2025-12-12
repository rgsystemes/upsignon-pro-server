//2024-11-04_12-33-18_fix_authentication_date

exports.up = async function (db) {
  await db.query(
    'ALTER TABLE user_devices ALTER session_auth_challenge_exp_time TYPE timestamp with time zone;',
  );
  await db.query(
    'ALTER TABLE user_devices ALTER password_challenge_blocked_until TYPE timestamp with time zone;',
  );
};

exports.down = function (db) {};
