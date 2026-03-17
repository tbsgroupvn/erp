import type { APIRequestContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// API configuration
// ---------------------------------------------------------------------------
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CreatedOrder {
  id: string;
  orderCode: string;
}

export interface CreatedCustomer {
  id: string;
  code: string;
  name: string;
}

export interface CreatedContainer {
  id: string;
  containerCode: string;
}

// ---------------------------------------------------------------------------
// Auth helper — obtain a Bearer token for API calls
// ---------------------------------------------------------------------------
let cachedToken: string | null = null;

export async function getApiToken(
  apiContext: APIRequestContext,
): Promise<string> {
  if (cachedToken) return cachedToken;

  const email = process.env.SALE_EMAIL || 'sale@nhaphangchinhngach.vn';
  const password = process.env.SALE_PASSWORD || 'Test@123456';

  const response = await apiContext.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(
      `[test-data] Login failed: ${response.status()} ${await response.text()}`,
    );
  }

  const body = await response.json();
  cachedToken = body.data.tokens.accessToken;
  return cachedToken!;
}

// ---------------------------------------------------------------------------
// Create helpers
// ---------------------------------------------------------------------------

/**
 * Create a test order via the backend API.
 *
 * @param apiContext - Playwright APIRequestContext (must already have auth header)
 * @param overrides - Partial order fields to merge into the default payload
 */
export async function createTestOrder(
  apiContext: APIRequestContext,
  overrides?: Record<string, unknown>,
): Promise<CreatedOrder> {
  const timestamp = Date.now();

  const payload = {
    notes: `[E2E] Test order ${timestamp}`,
    serviceType: 'ORDER',
    ...overrides,
  };

  const response = await apiContext.post('/orders', { data: payload });

  if (!response.ok()) {
    throw new Error(
      `[test-data] createTestOrder failed: ${response.status()} ${await response.text()}`,
    );
  }

  const body = await response.json();
  return {
    id: body.data.id,
    orderCode: body.data.orderCode,
  };
}

/**
 * Create a test customer via the backend API.
 *
 * @param apiContext - Playwright APIRequestContext (must already have auth header)
 * @param overrides - Partial customer fields to merge into the default payload
 */
export async function createTestCustomer(
  apiContext: APIRequestContext,
  overrides?: Record<string, unknown>,
): Promise<CreatedCustomer> {
  const timestamp = Date.now();

  const payload = {
    name: `E2E Customer ${timestamp}`,
    phone: `09${String(timestamp).slice(-8)}`,
    email: `e2e-${timestamp}@test.local`,
    ...overrides,
  };

  const response = await apiContext.post('/customers', { data: payload });

  if (!response.ok()) {
    throw new Error(
      `[test-data] createTestCustomer failed: ${response.status()} ${await response.text()}`,
    );
  }

  const body = await response.json();
  return {
    id: body.data.id,
    code: body.data.code || body.data.customerCode,
    name: body.data.name,
  };
}

/**
 * Create a test container via the backend API.
 *
 * @param apiContext - Playwright APIRequestContext (must already have auth header)
 * @param overrides - Partial container fields to merge into the default payload
 */
export async function createTestContainer(
  apiContext: APIRequestContext,
  overrides?: Record<string, unknown>,
): Promise<CreatedContainer> {
  const timestamp = Date.now();

  const payload = {
    notes: `[E2E] Test container ${timestamp}`,
    ...overrides,
  };

  const response = await apiContext.post('/containers', { data: payload });

  if (!response.ok()) {
    throw new Error(
      `[test-data] createTestContainer failed: ${response.status()} ${await response.text()}`,
    );
  }

  const body = await response.json();
  return {
    id: body.data.id,
    containerCode: body.data.containerCode,
  };
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

/**
 * Soft-delete a test order. Failures are silently ignored (best-effort cleanup).
 */
export async function cleanupOrder(
  apiContext: APIRequestContext,
  orderId: string,
): Promise<void> {
  try {
    await apiContext.delete(`/orders/${orderId}`);
  } catch {
    // Best-effort — don't fail tests on cleanup errors
  }
}

/**
 * Soft-delete a test customer. Failures are silently ignored (best-effort cleanup).
 */
export async function cleanupCustomer(
  apiContext: APIRequestContext,
  customerId: string,
): Promise<void> {
  try {
    await apiContext.delete(`/customers/${customerId}`);
  } catch {
    // Best-effort — don't fail tests on cleanup errors
  }
}

/**
 * Soft-delete a test container. Failures are silently ignored (best-effort cleanup).
 */
export async function cleanupContainer(
  apiContext: APIRequestContext,
  containerId: string,
): Promise<void> {
  try {
    await apiContext.delete(`/containers/${containerId}`);
  } catch {
    // Best-effort — don't fail tests on cleanup errors
  }
}
