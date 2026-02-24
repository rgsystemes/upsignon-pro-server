import { TestDatabase } from './testDatabase';
import { Pool } from 'pg';
import { beforeEach } from '@jest/globals';

let testDb: TestDatabase;

export function getTestDb(): TestDatabase {
  if (!testDb) {
    testDb = (global as any).__TEST_DB__;
  }
  return testDb;
}

export function getDbPool(): Pool {
  return getTestDb().getPool();
}

export async function cleanDatabase() {
  await getTestDb().clean();
}

beforeEach(async () => {
  await cleanDatabase();
});
