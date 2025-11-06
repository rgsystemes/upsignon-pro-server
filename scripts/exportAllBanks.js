const { exportDb } = require('./bankDataExport');
const path = require('path');
const db = require(path.join(__dirname, './dbMigrationConnect'));
const fs = require('fs');

async function exportAllBanks(db, outputDirectory) {
    const banks = await db.query('SELECT * FROM banks');
    for (const bank of banks.rows) {
        try {
            console.log(`Exporting bank ${bank.id}...`);
            let data = await exportDb(bank.id, db);
            data.bank = bank;
            fs.writeFileSync(path.join(outputDirectory, `bank_${bank.id}.json`), JSON.stringify(data));
        } catch (error) {
            console.error(`Error exporting bank ${bank.id}:`, error);
        }
    }
}

async function main() {
    const outputDirectory = process.argv[2];

    if (!outputDirectory) {
        console.log('Output directory parameter missing.');
        console.log('Usage: node ./scripts/exportAllBanks.js path/to/output/directory');
        process.exit(1);
    }

    await db.connect();
    await exportAllBanks(db, outputDirectory);
    await db.release();
}

if (require.main === module) {
    main();
}