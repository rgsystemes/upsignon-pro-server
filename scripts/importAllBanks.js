// See doc/DBTransferForResellers.md

const { importFunction } = require('./bankDataImport');
const path = require('path');
const db = require(path.join(__dirname, './dbMigrationConnect'));
const fs = require('fs');

async function importAllBanks(dbConnection, inputDirectory, resellerId) {
  const files = fs.readdirSync(inputDirectory);
  for (const file of files) {
    try {
      const dataString = fs.readFileSync(path.join(inputDirectory, file));
      const data = JSON.parse(dataString);
      const bank = data.bank;
      const insertedBank = await dbConnection.query(
        'INSERT INTO banks (name, settings, created_at, ms_entra_config, redirect_url, stop_this_instance, public_id, reseller_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        [
          bank.name,
          bank.settings,
          bank.created_at,
          bank.ms_entra_config,
          bank.redirect_url,
          bank.stop_this_instance,
          bank.public_id,
          resellerId,
        ],
      );
      if (insertedBank.rowCount > 0) {
        const newBankId = insertedBank.rows[0].id;
        console.log(`Import bank ${bank.name} with id ${newBankId}`);
        await importFunction(data, newBankId, dbConnection, resellerId);
      } else {
        throw new Error('Bank not found');
      }
    } catch (error) {
      console.error(`Error importing bank ${file}:`, error);
    }
  }
}

async function main() {
  const inputDirectory = process.argv[2];
  if (!inputDirectory) {
    console.log('Input directory parameter missing.');
    console.log('Usage: node ./scripts/importAllBanks.js path/to/input/directory');
    process.exit(1);
  }
  const resellerId = process.argv[3];
  if (typeof resellerId !== 'string') {
    console.log('Reseller ID parameter missing.');
    console.log('Usage: node ./scripts/importAllBanks.js path/to/input/directory resellerId');
    process.exit(1);
  }
  await db.connect();
  await importAllBanks(db, inputDirectory, resellerId);
  await db.release();
}

if (require.main === module) {
  main();
}
