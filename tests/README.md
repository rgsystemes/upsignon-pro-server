# Testing Guide

## Overview

This project uses Jest for testing with a PostgreSQL ephemeral database strategy. Each test run creates a fresh database, runs migrations, and tears down after completion.

## Prerequisites

- PostgreSQL server running (locally or in Docker)
- Node.js 20+ and Yarn installed
- All dependencies installed: `yarn install`

## Running Tests

### All tests

```bash
yarn test
```

### Watch mode

```bash
yarn test:watch
```

### With coverage

```bash
yarn test:coverage
```

## Test Structure

```
tests/
├── setup/                  # Test infrastructure
│   ├── globalSetup.ts      # Creates test database
│   ├── globalTeardown.ts   # Drops test database
│   ├── testDatabase.ts     # Database lifecycle management
│   └── testHelpers.ts      # Reusable test utilities
├── fixtures/               # Test data templates
│   ├── admins.ts
│   ├── banks.ts
│   ├── shamirConfigs.ts
│   ├── shamirHolders.ts
│   ├── shamirRecoveryRequests.ts
│   ├── shamirShares.ts
│   ├── userDevices.ts
│   └── users.ts
└── integration/            # Integration tests
    ├── helpers/            # Helper function tests
    │   └── getAdminsEmailsForBank.test.ts
    └── shamirRecovery/     # Shamir recovery route tests
        ├── abortShamirRecovery.test.ts
        ├── denyShamirRequestApproval.test.ts
        ├── finishShamirRecovery.test.ts
        ├── getShamirConfigs.test.ts
        ├── getShamirStatus.test.ts
        ├── openShamirShares.test.ts
        ├── requestShamirRecovery.test.ts
        ├── retrieveShamirConfigChangeToApprove.test.ts
        ├── retrieveShamirRecoveriesToApprove.test.ts
        ├── signShamirConfigChange.test.ts
        └── upsertShamirBackup.test.ts
```

## Environment Configuration

Tests use `.env.test` for configuration. Key variables:

```env
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=postgres
```

## Test Database Strategy

1. **Global Setup**: Creates a unique database with timestamp and process ID
2. **Migrations**: Runs all migrations on the fresh database
3. **Before Each Test**: Truncates all tables (except migrations)
4. **Global Teardown**: Drops the test database

This ensures:

- Complete isolation between test runs
- Consistent starting state for each test
- No leftover test data polluting your development database

## Helper Functions

### `createTestUser(email, bankUUID)`

Creates a user with an authorized device for testing.

```typescript
const user = await createTestUser('test@example.com', '1');
// Returns: { userId, deviceId, email, publicKey, devicePublicKey }
```

### `createShamirConfig(userId, threshold, numShares, approverEmails)`

Creates a Shamir secret sharing configuration.

```typescript
const config = await createShamirConfig(userId, 2, 3, [
  'approver1@example.com',
  'approver2@example.com',
  'approver3@example.com',
]);
```

### `getDbPool()`

Gets the PostgreSQL connection pool for direct database queries.

```typescript
const db = getDbPool();
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

## Writing New Tests

### Integration Test Example

```typescript
import request from 'supertest';
import app from '../../../src/server';
import { createTestUser } from '../../setup/testHelpers';

describe('POST /:bankUUID/api2/my-endpoint', () => {
  const bankUUID = '6333b2b6-2598-4a31-a263-e1897b29d5f5';

  it('should handle request successfully', async () => {
    const user = await createTestUser('test@example.com', bankUUID);

    const response = await request(app).post(`/${bankUUID}/api2/my-endpoint`).send({
      userEmail: user.email,
      deviceUniqueId: user.deviceId,
    });

    expect(response.status).toBe(200);
  });
});
```

## CI/CD

Tests run automatically on GitHub Actions for:

- Push to `master` or `production` branches
- Pull requests to `master` or `production` branches

The CI environment:

- Uses PostgreSQL 15 service container
- Runs tests with coverage reporting
- Uploads coverage to Codecov

## Troubleshooting

### "Database already exists"

The test database wasn't properly cleaned up. Manually drop it:

```bash
psql -U postgres -c "DROP DATABASE IF EXISTS upsignon_test_*"
```

### "Connection refused"

Ensure PostgreSQL is running:

```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql

# Start PostgreSQL (Linux)
sudo systemctl start postgresql
```

### Tests timeout

Increase the timeout in `jest.config.js`:

```javascript
testTimeout: 60000; // 60 seconds
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Use the automatic cleanup (beforeEach hook)
3. **Realistic Data**: Use helpers to create realistic test data
4. **Clear Assertions**: Test one thing at a time
5. **Security Tests**: Always test authorization and data isolation
6. **Error Cases**: Test both success and failure scenarios
