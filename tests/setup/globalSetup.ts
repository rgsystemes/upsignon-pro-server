import path from 'path';
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.test') });

import { TestDatabase } from './testDatabase';
import libsodium from 'libsodium-wrappers';

export default async function globalSetup() {
  console.log('Setting up test environment...');

  await libsodium.ready;

  const testDb = new TestDatabase();
  await testDb.create();

  (global as any).__TEST_DB__ = testDb;
  (global as any).__TEST_DB_NAME__ = testDb.getDbName();

  console.log(`Test database created: ${testDb.getDbName()}`);
}
