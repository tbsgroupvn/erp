import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// API configuration
// ---------------------------------------------------------------------------
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

// ---------------------------------------------------------------------------
// Types for test data
// ---------------------------------------------------------------------------
export interface TestOrder {
  id: string;
  orderCode: string;
}

export interface TestCustomer {
  id: string;
  code: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Helper: obtain a bearer token via the login API
// ---------------------------------------------------------------------------
async function getAuthToken(request: APIRequestContext): Promise<string> {
  const email = process.env.SALE_EMAIL || 'sale@nhaphangchinhngach.vn';
  const password = process.env.SALE_PASSWORD || 'Test@123456';

  const response = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }

  const body = await response.json();
  return body.data.tokens.accessToken;
}

// ---------------------------------------------------------------------------
// Custom fixtures
// ---------------------------------------------------------------------------
type Fixtures = {
  /** Page authenticated as SALE role. */
  salePage: Page;

  /** Page authenticated as CEO role. */
  ceoPage: Page;

  /** Page authenticated as ACCOUNTANT role. */
  accountantPage: Page;

  /** Pre-configured API request context with auth header, pointed at backend. */
  apiContext: APIRequestContext;

  /** Creates a test order via API, yields it, then cleans up. */
  testOrder: TestOrder;

  /** Creates a test customer via API, yields it, then cleans up. */
  testCustomer: TestCustomer;
};

export const test = base.extend<Fixtures>({
  // ------------------------------------------------------------------
  // salePage — browser context with SALE storageState
  // ------------------------------------------------------------------
  salePage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: '.auth/sale.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // ------------------------------------------------------------------
  // ceoPage — browser context with CEO storageState
  // ------------------------------------------------------------------
  ceoPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: '.auth/ceo.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // ------------------------------------------------------------------
  // accountantPage — browser context with ACCOUNTANT storageState
  // ------------------------------------------------------------------
  accountantPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: '.auth/accountant.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // ------------------------------------------------------------------
  // apiContext — API request context with Bearer token
  // ------------------------------------------------------------------
  apiContext: async ({ playwright }, use) => {
    const requestContext = await playwright.request.newContext({
      baseURL: API_BASE,
    });

    const token = await getAuthToken(requestContext);

    // Create a new context with the auth header baked in
    const authenticatedContext = await playwright.request.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    await use(authenticatedContext);

    await authenticatedContext.dispose();
    await requestContext.dispose();
  },

  // ------------------------------------------------------------------
  // testOrder — create a test order, yield it, clean up after
  // ------------------------------------------------------------------
  testOrder: async ({ apiContext }, use) => {
    const timestamp = Date.now();

    const response = await apiContext.post('/orders', {
      data: {
        notes: `[E2E] Test order ${timestamp}`,
        serviceType: 'ORDER',
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create test order: ${response.status()} ${await response.text()}`);
    }

    const body = await response.json();
    const order: TestOrder = {
      id: body.data.id,
      orderCode: body.data.orderCode,
    };

    await use(order);

    // Cleanup: soft-delete the test order
    try {
      await apiContext.delete(`/orders/${order.id}`);
    } catch {
      // Best-effort cleanup; don't fail the test
    }
  },

  // ------------------------------------------------------------------
  // testCustomer — create a test customer, yield it, clean up after
  // ------------------------------------------------------------------
  testCustomer: async ({ apiContext }, use) => {
    const timestamp = Date.now();

    const response = await apiContext.post('/customers', {
      data: {
        name: `E2E Customer ${timestamp}`,
        phone: `09${String(timestamp).slice(-8)}`,
        email: `e2e-${timestamp}@test.local`,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create test customer: ${response.status()} ${await response.text()}`);
    }

    const body = await response.json();
    const customer: TestCustomer = {
      id: body.data.id,
      code: body.data.code || body.data.customerCode,
      name: body.data.name,
    };

    await use(customer);

    // Cleanup: soft-delete the test customer
    try {
      await apiContext.delete(`/customers/${customer.id}`);
    } catch {
      // Best-effort cleanup; don't fail the test
    }
  },
});

export { expect };
