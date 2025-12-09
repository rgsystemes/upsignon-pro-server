//2025-10-23_12-00-12_password_challenge_exponential_backoff

exports.up = async function (db) {
  await db.query(
    'ALTER TABLE user_devices RENAME COLUMN password_challenge_blocked_until TO last_password_challenge_submission_date',
  );
  await db.query('UPDATE user_devices SET last_password_challenge_submission_date = null');
};
exports.down = function (db) {
  return db.query(
    'ALTER TABLE user_devices RENAME COLUMN last_password_challenge_submission_date TO password_challenge_blocked_until',
  );
};
