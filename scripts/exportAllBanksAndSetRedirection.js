// See doc/DBTransferForResellers.md

const { exportDbAndSetRedirection } = require('./bankDataExportAndSetRedirection');
const path = require('path');
const db = require(path.join(__dirname, './dbMigrationConnect'));
const fs = require('fs');

async function exportAllBanks(dbConnection, outputDirectory) {
  const banks = await dbConnection.query('SELECT * FROM banks');
  for (const bank of banks.rows) {
    try {
      let data = await exportDbAndSetRedirection(bank.id, dbConnection);
      fs.writeFileSync(path.join(outputDirectory, `bank_${bank.id}.json`), JSON.stringify(data));
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
