const path = require('path');
const fs = require('fs');
const db = require(path.join(__dirname, './dbMigrationConnect'));

async function importFunction(data, bankId, dbConnection, resellerId = null) {
  // ADMINS
  for (var i = 0; i < data.admins.length; i++) {
    const row = data.admins[i];
    await dbConnection.query(
      'INSERT INTO admins (id, email, password_hash, created_at, reseller_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [row.id, row.email, row.password_hash, row.created_at, resellerId],
    );
  }

  // ADMIN BANKS
  for (var i = 0; i < data.admin_banks.length; i++) {
    const row = data.admin_banks[i];
    await dbConnection.query('INSERT INTO admin_banks (admin_id, bank_id) VALUES ($1,$2)', [
      row.admin_id,
      bankId,
    ]);
  }

  // ALLOWED EMAILS
  for (var i = 0; i < data.allowed_emails.length; i++) {
    const row = data.allowed_emails[i];
    await dbConnection.query('INSERT INTO allowed_emails (pattern, bank_id) VALUES ($1,$2)', [
      row.pattern,
      bankId,
    ]);
  }

  // USERS
  for (var i = 0; i < data.users.length; i++) {
    const u = data.users[i];
    const insertedUser = await dbConnection.query(
      `INSERT INTO users (
        email,
        created_at,
        updated_at,
        bank_id,
        nb_accounts,
        nb_codes,
        nb_accounts_strong,
        nb_accounts_medium,
        nb_accounts_weak,
        nb_accounts_with_duplicated_password,
        nb_accounts_with_no_password,
        nb_accounts_red,
        nb_accounts_orange,
        nb_accounts_green,
        encrypted_data_2,
        sharing_public_key_2,
        allowed_to_export,
        allowed_offline_mobile,
        allowed_offline_desktop) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [
        u.email,
        u.created_at,
        u.updated_at,
        bankId,
        u.nb_accounts,
        u.nb_codes,
        u.nb_accounts_strong,
        u.nb_accounts_medium,
        u.nb_accounts_weak,
        u.nb_accounts_with_duplicated_password,
        u.nb_accounts_with_no_password,
        u.nb_accounts_red,
        u.nb_accounts_orange,
        u.nb_accounts_green,
        u.encrypted_data_2,
        u.sharing_public_key_2,
        u.allowed_to_export,
        u.allowed_offline_mobile,
        u.allowed_offline_desktop,
      ],
    );
    const newId = insertedUser.rows[0].id;

    // data.data_stats = data.data_stats.map((row) => {
    //   if (row.user_id === u.id) {
    //     return {
    //       ...row,
    //       newUserId: newId,
    //     };
    //   } else {
    //     return row;
    //   }
    // });
    data.shared_vault_recipients = data.shared_vault_recipients.map((row) => {
      if (row.user_id === u.id) {
        return {
          ...row,
          newUserId: newId,
        };
      } else {
        return row;
      }
    });
    data.user_devices = data.user_devices.map((row) => {
      if (row.user_id === u.id) {
        return {
          ...row,
          newUserId: newId,
        };
      } else {
        return row;
      }
    });
  }

  // URL LIST
  for (var i = 0; i < data.url_list.length; i++) {
    const url = data.url_list[i];
    await dbConnection.query(
      'INSERT INTO url_list (displayed_name, signin_url, bank_id, uses_basic_auth) VALUES ($1,$2,$3,$4)',
      [url.displayed_name, url.signin_url, bankId, url.uses_basic_auth],
    );
  }

  // SHARED VAULTS
  for (var i = 0; i < data.shared_vaults.length; i++) {
    const sv = data.shared_vaults[i];
    const insertedVault = await dbConnection.query(
      `INSERT INTO shared_vaults (
        bank_id,
        name,
        encrypted_data,
        last_updated_at,
        created_at,
        nb_accounts,
        nb_codes,
        nb_accounts_strong,
        nb_accounts_with_duplicated_password,
        nb_accounts_with_no_password,
        nb_accounts_red,
        nb_accounts_orange,
        nb_accounts_green,
        content_details
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [
        bankId,
        sv.name,
        sv.encrypted_data,
        sv.last_updated_at,
        sv.created_at,
        sv.nb_accounts,
        sv.nb_codes,
        sv.nb_accounts_strong,
        sv.nb_accounts_with_duplicated_password,
        sv.nb_accounts_with_no_password,
        sv.nb_accounts_red,
        sv.nb_accounts_orange,
        sv.nb_accounts_green,
        sv.content_details,
      ],
    );
    const newId = insertedVault.rows[0].id;
    data.shared_vault_recipients = data.shared_vault_recipients.map((svr) => {
      if (svr.shared_vault_id === sv.id) {
        return {
          ...svr,
          newSharedVaultId: newId,
        };
      } else {
        return svr;
      }
    });
    // data.data_stats = data.data_stats.map((ds) => {
    //   if (ds.shared_vault_id === sv.id) {
    //     return {
    //       ...ds,
    //       newSharedVaultId: newId,
    //     };
    //   } else {
    //     return ds;
    //   }
    // });
  }

  // SHARED VAULT RECIPIENTS
  for (var i = 0; i < data.shared_vault_recipients.length; i++) {
    const svr = data.shared_vault_recipients[i];
    await dbConnection.query(
      'INSERT INTO shared_vault_recipients (shared_vault_id, user_id, encrypted_shared_vault_key, is_manager, access_level, bank_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [
        svr.newSharedVaultId,
        svr.newUserId,
        svr.encrypted_shared_vault_key,
        svr.is_manager,
        svr.access_level,
        bankId,
        svr.created_at,
      ],
    );
  }
  // USER DEVICES
  for (var i = 0; i < data.user_devices.length; i++) {
    const ud = data.user_devices[i];
    await dbConnection.query(
      `INSERT INTO user_devices (
          user_id,
          device_name,
          device_unique_id,
          authorization_status,
          created_at,
          device_type,
          os_version,
          revocation_date,
          app_version,
          bank_id,
          encrypted_password_backup_2,
          device_public_key_2,
          last_sync_date,
          install_type,
          os_family
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        ud.newUserId,
        ud.device_name,
        ud.device_unique_id,
        ud.authorization_status,
        ud.created_at,
        ud.device_type,
        ud.os_version,
        ud.revocation_date,
        ud.app_version,
        bankId,
        ud.encrypted_password_backup_2,
        ud.device_public_key_2,
        ud.last_sync_date,
        ud.install_type,
        ud.os_family,
      ],
    );
  }

  // DATA STATS
  // let's drop this import since the curve will change from before due to potential missing refrences for deleted users and shared_vaults
  // for (var i = 0; i < data.data_stats.length; i++) {
  //   const row = data.data_stats[i];
  //   await db.query(
  //     `INSERT INTO data_stats (
  //       user_id,
  //       date,
  //       nb_accounts,
  //       nb_codes,
  //       nb_accounts_strong,
  //       nb_accounts_medium,
  //       nb_accounts_weak,
  //       nb_accounts_with_duplicated_password,
  //       nb_accounts_with_no_password,
  //       nb_accounts_red,
  //       nb_accounts_orange,
  //       nb_accounts_green,
  //       bank_id,
  //       shared_vault_id
  //     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
  //     [
  //       row.newUserId,
  //       row.date,
  //       row.nb_accounts,
  //       row.nb_codes,
  //       row.nb_accounts_strong,
  //       row.nb_accounts_medium,
  //       row.nb_accounts_weak,
  //       row.nb_accounts_with_duplicated_password,
  //       row.nb_accounts_with_no_password,
  //       row.nb_accounts_red,
  //       row.nb_accounts_orange,
  //       row.nb_accounts_green,
  //       bankId,
  //       row.newSharedVaultId,
  //     ],
  //   );
  // }

}

async function main() {
  const bankId = parseInt(process.argv[2]);
  const filePath = process.argv[3];
  if (typeof bankId !== 'number') {
    console.log('BankId parameter missing.');
    console.log('Usage: node ./scripts/bankDataImport.js 2 path/to/data/file');
    process.exit(1);
  }
  if (!filePath) {
    console.log('File path parameter missing.');
    console.log('Usage: node ./scripts/bankDataImport.js 2 path/to/data/file');
    process.exit(1);
  }

  const dataString = fs.readFileSync(filePath);
  const data = JSON.parse(dataString);

  await db.connect();
  await importFunction(data, bankId, db);
  await db.release();
}

if (require.main === module) {
  main();
}

module.exports = { importFunction };
