export default async function globalTeardown() {
  const testDb = (global as any).__TEST_DB__;

  if (testDb) {
    console.log(`Dropping test database: ${testDb.getDbName()}`);
    await testDb.drop();
  }
}
