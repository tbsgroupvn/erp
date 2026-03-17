/**
 * Global setup for Playwright E2E tests.
 *
 * This file runs once before all test projects. Use it for:
 *   - Seeding test data into the database
 *   - Verifying backend/frontend services are healthy
 *   - Any one-time environment preparation
 *
 * Currently minimal — extend as needed.
 */

async function globalSetup() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const apiBase = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

  // Verify frontend is reachable
  try {
    const frontendResp = await fetch(baseUrl, { method: 'HEAD' });
    if (!frontendResp.ok) {
      console.warn(
        `[global-setup] Frontend at ${baseUrl} responded with ${frontendResp.status}`,
      );
    }
  } catch (err) {
    console.error(
      `[global-setup] Cannot reach frontend at ${baseUrl}. Is it running?`,
    );
    throw err;
  }

  // Verify backend API is reachable
  try {
    const healthResp = await fetch(`${apiBase}/health/live`);
    if (!healthResp.ok) {
      console.warn(
        `[global-setup] Backend health check returned ${healthResp.status}`,
      );
    }
  } catch (err) {
    console.error(
      `[global-setup] Cannot reach backend at ${apiBase}. Is it running?`,
    );
    throw err;
  }

  console.log('[global-setup] Frontend and backend are reachable. Ready to test.');
}

export default globalSetup;
