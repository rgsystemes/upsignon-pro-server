//2025-07-31_14-12-56_table_reseller

exports.up = async function (db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS resellers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP(0)
    )
  `);

  const banksWithReseller = await db.query(`
  SELECT id, settings->>'RESELLER' as reseller_name
  FROM banks
  WHERE settings->>'RESELLER' IS NOT NULL
  AND settings->>'RESELLER' != ''
  `);

  const resellerMap = new Map();
  for (const bank of banksWithReseller.rows) {
    if (bank.reseller_name && !resellerMap.has(bank.reseller_name)) {
      // on conflict, do update so the id can be returned
      const result = await db.query(
        'INSERT INTO resellers (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
        [bank.reseller_name],
      );
      resellerMap.set(bank.reseller_name, result.rows[0].id);
    }
  }

  await db.query(
    'ALTER TABLE admins ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES resellers(id)',
  );
  await db.query(
    'ALTER TABLE banks ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES resellers(id)',
  );
  // (yes, DO NOT use ON DELETE CASCADE)

  for (const bank of banksWithReseller.rows) {
    if (bank.reseller_name && resellerMap.has(bank.reseller_name)) {
      await db.query('UPDATE banks SET reseller_id = $1 WHERE id = $2', [
        resellerMap.get(bank.reseller_name),
        bank.id,
      ]);
    }
  }
  await db.query('ALTER TABLE banks ALTER COLUMN settings TYPE jsonb');

  await db.query(`
    UPDATE banks
    SET settings = settings - 'RESELLER'
    WHERE settings->>'RESELLER' IS NOT NULL
  `);
};

exports.down = async function (db) {
  const banksWithReseller = await db.query(`
    SELECT banks.id, reseller.name as reseller_name
    FROM banks
    JOIN resellers ON banks.reseller_id = resellers.id
    WHERE banks.reseller_id IS NOT NULL
  `);

  for (const bank of banksWithReseller.rows) {
    // merge settings with object containing RESELLER
    await db.query(
      `
      UPDATE banks
      SET settings = COALESCE(settings, '{}'::json) || $1::json
      WHERE id = $2
    `,
      [JSON.stringify({ RESELLER: bank.reseller_name }), bank.id],
    );
  }

  await db.query('ALTER TABLE admins DROP COLUMN IF EXISTS reseller_id');
  await db.query('ALTER TABLE banks DROP COLUMN IF EXISTS reseller_id');
  await db.query('DROP TABLE IF EXISTS resellers');
};
