/**
 * Global test setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test_user:test_password@localhost:5432/test_db';

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Mock console.error to reduce noise in test output
// Remove this if you need to see error logs during testing
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
