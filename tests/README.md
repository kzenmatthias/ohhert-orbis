# Testing Infrastructure

This document describes the comprehensive testing infrastructure for the Orbis screenshot manager application.

## Overview

The testing infrastructure includes:

- **Unit Tests**: Testing individual functions and components in isolation
- **API Tests**: Testing API endpoints with Supertest
- **End-to-End Tests**: Testing complete user workflows with Playwright
- **Test Database**: Isolated SQLite database for testing
- **Test Utilities**: Helper functions and mocks for testing

## Test Structure

```
tests/
├── api/                    # API endpoint tests
├── e2e/                    # End-to-end tests
├── unit/                   # Unit tests
├── utils/                  # Test utilities and helpers
├── setup/                  # Test configuration
└── README.md              # This file
```

## Running Tests

### All Tests
```bash
npm run test:all           # Run all tests (unit, API, and E2E)
npm run test:runner all    # Alternative using test runner script
```

### Unit Tests
```bash
npm test                   # Run unit tests
npm run test:unit          # Run only unit tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
```

### API Tests
```bash
npm run test:api           # Run API endpoint tests
```

### End-to-End Tests
```bash
npm run test:e2e           # Run E2E tests headless
npm run test:e2e:headed    # Run E2E tests with browser UI
npm run test:e2e:ui        # Run E2E tests with Playwright UI
```

### Test Runner Script
```bash
npm run test:runner unit     # Run unit tests
npm run test:runner api      # Run API tests
npm run test:runner e2e      # Run E2E tests
npm run test:runner coverage # Run tests with coverage
npm run test:runner watch    # Run tests in watch mode
npm run test:runner all      # Run all tests
```

## Test Configuration

### Jest Configuration
- **File**: `jest.config.js`
- **Setup**: `jest.setup.js`
- **Environment**: Node.js environment for API testing
- **Coverage**: Configured to collect coverage from app/, lib/, and components/
- **Timeout**: 10 seconds for async operations

### Playwright Configuration
- **File**: `playwright.config.ts`
- **Test Directory**: `tests/e2e/`
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Base URL**: http://localhost:3000
- **Global Setup/Teardown**: Database and environment setup

### Test Database
- **Type**: SQLite in-memory database
- **Location**: `:memory:` for unit tests, temporary file for E2E tests
- **Schema**: Matches production database schema
- **Utilities**: Helper functions for creating test data

## Test Utilities

### TestDatabase Class
```typescript
import { TestDatabase } from '../utils/test-db';

const testDb = new TestDatabase();
const target = testDb.createTestTarget({ name: 'Test Target' });
const url = testDb.createTestUrl(target.id!, { name: 'Homepage', url: 'https://example.com' });
```

### API Testing Helpers
```typescript
import { createNextRequest, parseResponseBody } from '../utils/api-helpers';

const request = createNextRequest('POST', '/api/targets', { name: 'Test' });
const response = await POST(request);
const data = await parseResponseBody(response);
```

### Mock Utilities
```typescript
import { mockPlaywright, mockFileSystem } from '../utils/api-helpers';

const { mockPage, mockBrowser } = mockPlaywright();
const fileSystem = mockFileSystem();
```

## Writing Tests

### Unit Tests
```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestDatabase } from '../utils/test-db';

describe('Database Operations', () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = new TestDatabase();
  });

  afterEach(() => {
    testDb.close();
  });

  it('should create a target', () => {
    const target = testDb.createTestTarget({ name: 'Test Target' });
    expect(target.id).toBeDefined();
    expect(target.name).toBe('Test Target');
  });
});
```

### API Tests
```typescript
import { describe, it, expect, jest } from '@jest/globals';
import { createNextRequest, parseResponseBody } from '../utils/api-helpers';

describe('/api/targets', () => {
  it('should return all targets', async () => {
    const { GET } = require('@/app/api/targets/route');
    const request = createNextRequest('GET', '/api/targets');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await parseResponseBody(response);
    expect(Array.isArray(data)).toBe(true);
  });
});
```

### E2E Tests
```typescript
import { test, expect } from '@playwright/test';

test('should create a new target', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="add-target-button"]');
  await page.fill('[data-testid="target-name-input"]', 'Test Target');
  await page.click('[data-testid="save-target-button"]');
  
  await expect(page.locator('text=Test Target')).toBeVisible();
});
```

## Test Data

### Test Configuration
The `tests/setup/test-config.ts` file contains:
- Common test data patterns
- Environment configuration
- Test utilities and helpers
- Validation functions

### Environment Variables
Test-specific environment variables:
```bash
NODE_ENV=test
DATABASE_PATH=:memory:
SCREENSHOTS_DIR=screenshots/test
TEST_USERNAME=testuser
TEST_PASSWORD=testpass123
```

## Continuous Integration

### GitHub Actions
The `.github/workflows/test.yml` workflow runs:
1. Unit and API tests with coverage
2. E2E tests across multiple browsers
3. Linting and type checking
4. Artifact upload for failed tests

### Coverage Reports
- **Format**: LCOV, HTML, and text
- **Directory**: `coverage/`
- **Threshold**: Configurable in Jest config
- **Upload**: Codecov integration in CI

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Keep tests focused and isolated
- Use beforeEach/afterEach for setup/cleanup

### Test Data
- Use test utilities for consistent data creation
- Clean up test data after each test
- Use meaningful test data that reflects real usage
- Avoid hardcoded values where possible

### Mocking
- Mock external dependencies (Playwright, file system)
- Use Jest mocks for module mocking
- Keep mocks simple and focused
- Reset mocks between tests

### Assertions
- Use specific assertions (toBe vs toEqual)
- Test both success and error cases
- Verify side effects (database changes, file creation)
- Use async/await for asynchronous operations

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure test database is properly initialized
   - Check that database is closed after tests
   - Verify environment variables are set

2. **Playwright Browser Issues**
   - Run `npx playwright install` to install browsers
   - Check that dev server is running for E2E tests
   - Verify test selectors match actual elements

3. **Mock Issues**
   - Clear mocks between tests with `jest.clearAllMocks()`
   - Ensure mocks are properly configured
   - Check mock return values match expected types

4. **Timeout Issues**
   - Increase timeout values in configuration
   - Use proper async/await patterns
   - Check for hanging promises or connections

### Debug Mode
```bash
# Run tests with debug output
DEBUG=* npm test

# Run Playwright tests with debug
npm run test:e2e -- --debug

# Run specific test file
npm test -- tests/unit/db.test.ts
```

## Performance

### Test Execution Speed
- Unit tests: < 5 seconds
- API tests: < 10 seconds  
- E2E tests: < 2 minutes
- Full test suite: < 3 minutes

### Optimization Tips
- Use in-memory database for unit tests
- Parallel test execution where possible
- Mock external dependencies
- Use test data factories for consistent setup