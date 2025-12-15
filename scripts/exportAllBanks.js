const { exportDb } = require('./bankDataExport');
const path = require('path');
const db = require(path.join(__dirname, './dbMigrationConnect'));
const fs = require('fs');

async function exportAllBanks(dbConnection, outputDirectory) {
  const banks = await dbConnection.query('SELECT * FROM banks');
  for (const bank of banks.rows) {
    try {
      console.log(`Exporting bank ${bank.id}...`);
      let data = await exportDb(bank.id, dbConnection);
      data.bank = bank;
      fs.writeFileSync(path.join(outputDirectory, `bank_${bank.id}.json`), JSON.stringify(data));
      await dbConnection.query(
        'UPDATE banks SET redirect_url = $1, stop_this_instance=true WHERE id = $2',
        ['https://pro.upsignon.eu/' + bank.public_id, bank.id],
      );
    } catch (error) {
      console.error(`Error exporting bank ${bank.id}:`, error);
    }
  }
}

async function main() {
  const outputDirectory = path.join(__dirname, '../tmp_exports');
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory);
  }

  await db.connect();
  await exportAllBanks(db, outputDirectory);
  await db.release();
}

if (require.main === module) {
  main();
}
