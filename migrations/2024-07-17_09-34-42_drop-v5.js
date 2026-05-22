//2024-07-17_09-34-42_drop-v5
const { exec } = require('child_process');

exports.up = async function (db) {
  // await new Promise((resolve, reject) => {
  //   const dbName = process.env.DB_NAME;
  //   const dbHost = process.env.DB_HOST;
  //   const dbPwd = process.env.DB_PASS;
  //   const dbUser = process.env.DB_USER;
  //   const dbPort = process.env.DB_PORT;
  //   exec(
  //     `PGPASSWORD=${dbPwd} /usr/bin/pg_dump  -h ${dbHost} -p ${dbPort} -U ${dbUser} ${dbName} > ~/backup_before_v5_deletion.sql`,
  //     (error, stdout, stderr) => {
  //       if (error) {
  //         console.error(`error: ${error.message}`);
  //         reject(error);
  //         return;
  //       }

  //       if (stderr) {
  //         console.error(`stderr: ${stderr}`);
  //         reject(stderr);
  //         return;
  //       }

  //       resolve();
  //     },
  //   );
  // });
  // DELETE vaults that have not migrated
  await db.query('DELETE FROM users WHERE encrypted_data_2 IS NULL');
  await db.query('DROP TABLE shared_account_users');
  await db.query('DROP TABLE shared_accounts');
  await db.query('DROP TABLE shared_folders');
  await db.query(
    'ALTER TABLE user_devices DROP COLUMN IF EXISTS encrypted_password_backup, DROP COLUMN IF EXISTS device_public_key, DROP COLUMN IF EXISTS access_code_hash',
  );
  await db.query(
    'ALTER TABLE users DROP COLUMN IF EXISTS encrypted_data, DROP COLUMN IF EXISTS sharing_public_key',
  );
  await db.query("DELETE FROM user_devices WHERE app_version LIKE 'N/A'");
};

exports.down = function (db) {
  return db.query();
};
