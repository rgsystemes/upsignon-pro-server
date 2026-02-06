const path = require('path');
const fs = require('fs');
const db = require(path.join(__dirname, './dbMigrationConnect'));

async function importBanks(filePath, dbConnection, resellerId) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const line of lines) {
        const raw = line.trim();
        if (!raw || raw === 'NULL' || isNaN(parseInt(raw, 10))) {
            console.warn(`Warning: "${raw}" is not a valid integer, skipping.`);
            skippedCount++;
            continue;
        }
        const bankName = parseInt(raw, 10).toString();
        const result = await dbConnection.query(
            `INSERT INTO banks (name, reseller_id)
             SELECT $1, $2
             WHERE NOT EXISTS (SELECT 1 FROM banks WHERE name = $1)
             RETURNING id`,
            [bankName, resellerId],
        );
        if (result.rowCount > 0) {
            console.log(`Inserted bank: ${bankName}`);
            insertedCount++;
        } else {
            console.log(`Bank already exists: ${bankName}`);
            skippedCount++;
        }
    }

    console.log(`\nDone. Inserted: ${insertedCount}, Skipped: ${skippedCount}`);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
    const filePath = process.argv[2];
    const resellerId = process.argv[3];

    if (!filePath) {
        console.log('File path parameter missing.');
        console.log('Usage: node ./scripts/septeoMigration.js path/to/export.csv <resellerId>');
        process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    if (!resellerId || !UUID_REGEX.test(resellerId)) {
        console.log('ResellerId parameter missing or invalid (expected UUID).');
        console.log('Usage: node ./scripts/septeoMigration.js path/to/export.csv <resellerId>');
        process.exit(1);
    }

    await db.connect();
    try {
        await importBanks(filePath, db, resellerId);
    } finally {
        await db.release();
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { importBanks };
