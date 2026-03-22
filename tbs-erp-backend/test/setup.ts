/**
 * Global test setup file
 * Runs before all tests
 */

// ─── Test-only credential constants ──────────────────────────────────────────
// These values are used exclusively in test fixtures and never in production.
// Override via environment variables in CI to avoid scanner false-positives.
export const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Test@2024!'; // nosec: test fixture, not a production credential
export const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Admin@123456'; // nosec: test fixture, not a production credential

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only'; // nosec: test-only JWT secret, never used in production
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only'; // nosec: test-only JWT secret, never used in production
process.env.DATABASE_URL = 'postgresql://test_user:test_password@localhost:5432/test_db'; // nosec: test-only DB URL, never used in production

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Mock console.error to reduce noise in test output
// Remove this if you need to see error logs during testing
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
