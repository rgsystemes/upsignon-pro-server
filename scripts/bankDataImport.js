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
        allowed_offline_desktop,
        settings_override,
        ms_entra_id,
        deactivated
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id`,
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
        u.settings_override,
        u.ms_entra_id,
        u.deactivated,
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

    // Update shamir related data with new user IDs
    if (data.shamir_holders) {
      data.shamir_holders = data.shamir_holders.map((row) => {
        if (row.vault_id === u.id) {
          return {
            ...row,
            newVaultId: newId,
          };
        } else {
          return row;
        }
      });
    }

    if (data.shamir_shares) {
      data.shamir_shares = data.shamir_shares.map((row) => {
        if (row.vault_id === u.id) {
          return {
            ...row,
            newVaultId: newId,
          };
        } else if (row.holder_vault_id === u.id) {
          return {
            ...row,
            newHolderVaultId: newId,
          };
        } else {
          return row;
        }
      });
    }
    data.changed_emails = data.changed_emails.map((row) => {
      if (row.user_id === u.id) {
        return {
          ...row,
          newUserId: newId,
        };
      } else {
        return row;
      }
    });

    // Update shamir related data with new user IDs
    if (data.shamir_holders) {
      data.shamir_holders = data.shamir_holders.map((row) => {
        if (row.vault_id === u.id) {
          return {
            ...row,
            newVaultId: newId,
          };
        } else {
          return row;
        }
      });
    }

    if (data.shamir_shares) {
      data.shamir_shares = data.shamir_shares.map((row) => {
        if (row.vault_id === u.id) {
          return {
            ...row,
            newVaultId: newId,
          };
        } else if (row.holder_vault_id === u.id) {
          return {
            ...row,
            newHolderVaultId: newId,
          };
        } else {
          return row;
        }
      });
    }
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
        content_details,
        nb_accounts_medium,
        nb_accounts_weak
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
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
        sv.nb_accounts_medium,
        sv.nb_accounts_weak,
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
    const insertedRes = await dbConnection.query(
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
          os_family,
          use_safe_browser_setup,
          enrollment_method
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id`,
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
        ud.use_safe_browser_setup,
        ud.enrollment_method,
      ],
    );
    const newDeviceId = insertedRes.rows[0].id;
    if (data.shamir_recovery_requests) {
      data.shamir_recovery_requests = data.shamir_recovery_requests.map((row) => {
        if (row.device_id === ud.id) {
          return {
            ...row,
            newDeviceId: newDeviceId,
          };
        } else {
          return row;
        }
      });
    }
  }

  // BANK SSO CONFIG
  for (var i = 0; i < data.bank_sso_config.length; i++) {
    const row = data.bank_sso_config[i];
    await dbConnection.query(
      'INSERT INTO bank_sso_config (bank_id, openid_configuration_url, client_id) VALUES ($1,$2,$3)',
      [bankId, row.openid_configuration_url, row.client_id],
    );
  }

  // CHANGED EMAILS
  for (var i = 0; i < data.changed_emails.length; i++) {
    const row = data.changed_emails[i];
    await dbConnection.query(
      'INSERT INTO changed_emails (old_email, new_email, user_id, aware_devices, created_at, bank_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [row.old_email, row.new_email, row.newUserId, row.aware_devices, row.created_at, bankId],
    );
  }

  // DATA STATS
  // let's drop this import since the curve will change from before due to potential missing refrences for deleted users and shared_vaults
  // for (var i = 0; i < data.data_stats.length; i++) {
  //   const row = data.data_stats[i];
  //   await dbConnection.query(
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

  // SHAMIR CONFIGS
  if (data.shamir_configs) {
    for (var i = 0; i < data.shamir_configs.length; i++) {
      const sc = data.shamir_configs[i];
      const insertedConfig = await dbConnection.query(
        'INSERT INTO shamir_configs (name, min_shares, is_active, bank_id, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [sc.name, sc.min_shares, sc.is_active, bankId, sc.created_at],
      );
      const newConfigId = insertedConfig.rows[0].id;

      // Update mappings for shamir_holders and shamir_shares
      if (data.shamir_holders) {
        data.shamir_holders = data.shamir_holders.map((row) => {
          if (row.shamir_config_id === sc.id) {
            return {
              ...row,
              newShamirConfigId: newConfigId,
            };
          } else {
            return row;
          }
        });
      }

      if (data.shamir_shares) {
        data.shamir_shares = data.shamir_shares.map((row) => {
          if (row.shamir_config_id === sc.id) {
            return {
              ...row,
              newShamirConfigId: newConfigId,
            };
          } else {
            return row;
          }
        });
      }

      if (data.shamir_recovery_requests) {
        data.shamir_recovery_requests = data.shamir_recovery_requests.map((row) => {
          if (row.shamir_config_id === sc.id) {
            return {
              ...row,
              newShamirConfigId: newConfigId,
            };
          } else {
            return row;
          }
        });
      }
    }
  }

  // SHAMIR HOLDERS
  if (data.shamir_holders) {
    for (var i = 0; i < data.shamir_holders.length; i++) {
      const sh = data.shamir_holders[i];
      const insertedHolder = await dbConnection.query(
        'INSERT INTO shamir_holders (vault_id, shamir_config_id, nb_shares, created_at) VALUES ($1,$2,$3,$4) RETURNING id',
        [sh.newVaultId, sh.newShamirConfigId, sh.nb_shares, sh.created_at],
      );
    }
  }

  // SHAMIR SHARES
  if (data.shamir_shares) {
    for (var i = 0; i < data.shamir_shares.length; i++) {
      const ss = data.shamir_shares[i];
      await dbConnection.query(
        'INSERT INTO shamir_shares (vault_id, holder_vault_id, shamir_config_id, closed_shares, open_shares, created_at, open_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [
          ss.newVaultId,
          ss.newHolderVaultId,
          ss.newShamirConfigId,
          ss.closed_shares,
          ss.open_shares,
          ss.created_at,
          ss.open_at,
        ],
      );
    }
  }

  // SHAMIR RECOVERY REQUESTS
  if (data.shamir_recovery_requests) {
    for (var i = 0; i < data.shamir_recovery_requests.length; i++) {
      const srr = data.shamir_recovery_requests[i];
      await dbConnection.query(
        'INSERT INTO shamir_recovery_requests (device_id, shamir_config_id, created_at, completed_at, status) VALUES ($1,$2,$3,$4,$5)',
        [srr.newDeviceId, srr.newShamirConfigId, srr.created_at, srr.completed_at, srr.status],
      );
    }
  }
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
