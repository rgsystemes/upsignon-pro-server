// See doc/DBTransferForResellers.md

const { importBank } = require('./bankDataImport');
const path = require('path');
const db = require(path.join(__dirname, './dbMigrationConnect'));
const fs = require('fs');

async function importAllBanks(dbConnection, inputDirectory, resellerId) {
  const files = fs.readdirSync(inputDirectory);
  for (const file of files) {
    try {
      const dataString = fs.readFileSync(path.join(inputDirectory, file));
      const data = JSON.parse(dataString);
      await importBank(data, dbConnection, resellerId);
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
  console.log(
    'Import completed\n=========================\nDO NOT FORGET TO TRANSFER THE LICENCES TOO!\n=========================',
  );
  await db.release();
}

if (require.main === module) {
  main();
}
