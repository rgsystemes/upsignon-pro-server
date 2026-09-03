import path from 'path';
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.test') });

// Use requires instead of imports because swc will run imports before any other code,
// thus running the dotenv config too late and causing the tests to fail due to missing environment variables.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TestDatabase } = require('./testDatabase');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const libsodium = require('libsodium-wrappers');

export default async function globalSetup() {
  console.log('Setting up test environment...');

  await libsodium.ready;

  const testDb = new TestDatabase();
  await testDb.create();

  (global as any).__TEST_DB__ = testDb;
  (global as any).__TEST_DB_NAME__ = testDb.getDbName();

  console.log(`Test database created: ${testDb.getDbName()}`);
}
