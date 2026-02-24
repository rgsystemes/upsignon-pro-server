# Testing Quick Start Guide

## Prerequisites

Ensure you have:

1. Node.js 20+ installed
2. PostgreSQL installed and running
3. Yarn package manager

## Installation

```bash
# Install dependencies (includes test dependencies)
yarn install
```

## Database Setup

### Option 1: Use Docker (Recommended)

```bash
# Start PostgreSQL in Docker
docker-compose -f docker-compose.test.yml up -d

# Verify it's running
docker-compose -f docker-compose.test.yml ps
```

### Option 2: Use Local PostgreSQL

Ensure PostgreSQL is running on localhost:5432 with:

- User: `postgres`
- Password: `postgres`

```bash
# On macOS (Homebrew)
brew services start postgresql

# On Linux
sudo systemctl start postgresql
```

## Running Tests

### First time setup

```bash
# Build TypeScript
yarn build
```

### Run all tests

```bash
yarn test
```

# Watch mode (re-runs on file changes)

yarn test:watch

````

### Run with coverage

```bash
yarn test:coverage

# View coverage report in browser
open coverage/lcov-report/index.html
````

## Expected Output

Successful test run should show:

```
Test Suites: 12 passed, 12 total
Tests:       X passed, X total
Snapshots:   0 total
Time:        XX.XXs
```

## Troubleshooting

### "ECONNREFUSED" or "Connection refused"

- PostgreSQL is not running
- Solution: Start PostgreSQL (see Database Setup)

### "database already exists"

- Previous test run didn't clean up
- Solution: `psql -U postgres -c "DROP DATABASE IF EXISTS upsignon_test_*"`

### Tests timing out

- Slow machine or database
- Solution: Increase timeout in `jest.config.js`: `testTimeout: 60000`

### Permission denied errors

- PostgreSQL user doesn't have permissions
- Solution: Ensure postgres user can create/drop databases

## Next Steps

- Read [tests/README.md](tests/README.md) for detailed documentation
- Explore test files in `tests/integration/shamirRecovery/`
- Write your own tests using the helper functions

## Continuous Integration

Tests automatically run on GitHub Actions for:

- All pushes to `master` or `production`
- All pull requests

View results in the "Actions" tab of your GitHub repository.
