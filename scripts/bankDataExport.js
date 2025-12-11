const path = require('path');
const db = require(path.join(__dirname, './dbMigrationConnect'));
const fs = require('fs');

async function exportDb(bankId, dbConnection) {
  try {
    const admins = await dbConnection.query('SELECT * FROM admins');
    const admin_banks = await dbConnection.query('SELECT * FROM admin_banks WHERE bank_id=$1', [bankId]);
    const bank_sso_config = await dbConnection.query('SELECT * FROM bank_sso_config WHERE bank_id=$1', [bankId]);
    const changed_emails = await dbConnection.query('SELECT * FROM changed_emails WHERE bank_id=$1', [bankId]);
    const allowed_emails = await dbConnection.query('SELECT * FROM allowed_emails WHERE bank_id=$1', [
      bankId,
    ]);
    // const data_stats = await dbConnection.query('SELECT * FROM data_stats WHERE bank_id=$1', [bankId]);
    // const password_reset_request = await dbConnection.query(
    //   'SELECT * FROM password_reset_request WHERE bank_id=$1',
    //   [bankId],
    // );
    const users = await dbConnection.query('SELECT * FROM users WHERE bank_id=$1', [bankId]);
    const shared_vault_recipients = await dbConnection.query(
      'SELECT * FROM shared_vault_recipients WHERE bank_id=$1',
      [bankId],
    );
    const shared_vaults = await dbConnection.query('SELECT * FROM shared_vaults WHERE bank_id=$1', [bankId]);
    const url_list = await dbConnection.query('SELECT * FROM url_list WHERE bank_id=$1', [bankId]);
    const user_devices = await dbConnection.query('SELECT * FROM user_devices WHERE bank_id=$1', [bankId]);
    const shamir_configs = await dbConnection.query('SELECT * FROM shamir_configs WHERE bank_id=$1', [
      bankId,
    ]);
    const shamir_holders = await dbConnection.query(
      'SELECT sh.* FROM shamir_holders sh INNER JOIN shamir_configs sc ON sh.shamir_config_id = sc.id WHERE sc.bank_id=$1',
      [bankId],
    );
    const shamir_shares = await dbConnection.query(
      'SELECT ss.* FROM shamir_shares ss INNER JOIN shamir_configs sc ON ss.shamir_config_id = sc.id WHERE sc.bank_id=$1',
      [bankId],
    );
    const shamir_recovery_requests = await dbConnection.query(
      'SELECT srr.* FROM shamir_recovery_requests srr INNER JOIN user_devices ud ON srr.device_id = ud.id WHERE ud.bank_id=$1',
      [bankId],
    );
    return {
      admins: admins.rows,
      admin_banks: admin_banks.rows,
      allowed_emails: allowed_emails.rows,
      // data_stats: data_stats.rows,
      // password_reset_request: password_reset_request.rows,
      shared_vault_recipients: shared_vault_recipients.rows,
      shared_vaults: shared_vaults.rows,
      user_devices: user_devices.rows,
      users: users.rows,
      url_list: url_list.rows,
      bank_sso_config: bank_sso_config.rows,
      changed_emails: changed_emails.rows,
      shamir_configs: shamir_configs.rows,
      shamir_holders: shamir_holders.rows,
      shamir_shares: shamir_shares.rows,
      shamir_recovery_requests: shamir_recovery_requests.rows,
    };
  } catch (e) {
    console.log(e);
  }
}

async function main() {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const bankId = parseInt(process.argv[2]);
  const filePath = process.argv[3];

  if (typeof bankId !== 'number') {
    console.log('BankId parameter missing.');
    console.log('Usage: node ./scripts/bankDataExport.js 2 path/to/data/file');
    process.exit(1);
  }
  if (!filePath) {
    console.log('File path parameter missing.');
    console.log('Usage: node ./scripts/bankDataExport.js 2 path/to/data/file');
    process.exit(1);
  }

  await db.connect();
  const data = await exportDb(bankId, db);
  fs.writeFileSync(filePath, JSON.stringify(data));
  await db.release();
}

if (require.main === module) {
  main();
}

module.exports = { exportDb };
