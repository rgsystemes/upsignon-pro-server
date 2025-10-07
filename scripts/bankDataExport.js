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

const path = require('path');
const db = require(path.join(__dirname, './dbMigrationConnect'));
const fs = require('fs');

async function exportDb() {
  try {
    await db.connect();
    const admins = await db.query('SELECT * FROM admins');
    const admin_banks = await db.query('SELECT * FROM admin_banks WHERE bank_id=$1', [bankId]);
    const allowed_emails = await db.query('SELECT * FROM allowed_emails WHERE bank_id=$1', [
      bankId,
    ]);
    // const data_stats = await db.query('SELECT * FROM data_stats WHERE bank_id=$1', [bankId]);
    // const password_reset_request = await db.query(
    //   'SELECT * FROM password_reset_request WHERE bank_id=$1',
    //   [bankId],
    // );
    const users = await db.query('SELECT * FROM users WHERE bank_id=$1', [bankId]);
    const shared_vault_recipients = await db.query(
      'SELECT * FROM shared_vault_recipients WHERE bank_id=$1',
      [bankId],
    );
    const shared_vaults = await db.query('SELECT * FROM shared_vaults WHERE bank_id=$1', [bankId]);
    const url_list = await db.query('SELECT * FROM url_list WHERE bank_id=$1', [bankId]);
    const user_devices = await db.query('SELECT * FROM user_devices WHERE bank_id=$1', [bankId]);
    const shamir_configs = await db.query('SELECT * FROM shamir_configs WHERE bank_id=$1', [
      bankId,
    ]);
    const shamir_holders = await db.query(
      'SELECT sh.* FROM shamir_holders sh JOIN shamir_configs sc ON sh.shamir_config_id = sc.id WHERE sc.bank_id=$1',
      [bankId],
    );
    const shamir_shares = await db.query(
      'SELECT ss.* FROM shamir_shares ss JOIN shamir_configs sc ON ss.shamir_config_id = sc.id WHERE sc.bank_id=$1',
      [bankId],
    );
    const shamir_recovery_requests = await db.query(
      'SELECT srr.* FROM shamir_recovery_requests srr JOIN user_devices ud ON srr.device_id = ud.id WHERE ud.bank_id=$1',
      [bankId],
    );
    fs.writeFileSync(
      filePath,
      JSON.stringify({
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
        shamir_configs: shamir_configs.rows,
        shamir_holders: shamir_holders.rows,
        shamir_shares: shamir_shares.rows,
        shamir_recovery_requests: shamir_recovery_requests.rows,
      }),
    );
    await db.release();
  } catch (e) {
    console.log(e);
  }
}

exportDb();
