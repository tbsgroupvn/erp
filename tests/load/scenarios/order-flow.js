/**
 * TBS ERP - Order Flow Scenario
 *
 * End-to-end order lifecycle simulation:
 * 1. Create order
 * 2. Track order status
 * 3. Update order details
 * 4. Complete order
 *
 * This scenario tests the full order pipeline performance including
 * database writes, event emissions, and cache invalidations.
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging-api.tbslogistics.com tests/load/scenarios/order-flow.js
 */

import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const orderCreateDuration = new Trend('order_create_duration', true);
const orderUpdateDuration = new Trend('order_update_duration', true);
const orderTrackDuration = new Trend('order_track_duration', true);

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'test@tbs.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Test1234!';

export const options = {
  scenarios: {
    order_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 30 },
        { duration: '2m', target: 30 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    order_create_duration: ['p(95)<3000'],
    order_update_duration: ['p(95)<2000'],
    order_track_duration: ['p(95)<1000'],
  },
};

let cachedToken = null;

function authenticate() {
  if (cachedToken) return cachedToken;

  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status !== 200 && loginRes.status !== 201) return null;

  try {
    const body = loginRes.json();
    cachedToken = body.data?.accessToken || body.accessToken;
    return cachedToken;
  } catch {
    return null;
  }
}

export default function () {
  const token = authenticate();
  if (!token) {
    sleep(1);
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  let orderId;

  // Step 1: Create Order
  group('1. Create Order', () => {
    const orderData = {
      customerName: `Load Test Customer ${__VU}-${__ITER}`,
      serviceType: 'SEA_FREIGHT',
      branch: 'HN',
      items: [
        {
          description: `Test Item ${Date.now()}`,
          quantity: Math.floor(Math.random() * 100) + 1,
          unitPrice: Math.floor(Math.random() * 1000000) + 100000,
          weight: Math.random() * 100 + 1,
        },
      ],
      notes: 'Load test order - auto-created',
    };

    const res = http.post(
      `${BASE_URL}/api/v1/orders`,
      JSON.stringify(orderData),
      { headers, tags: { name: 'order_create' } },
    );

    orderCreateDuration.add(res.timings.duration);

    const createOk = check(res, {
      'order created': (r) => r.status === 200 || r.status === 201,
    });

    if (createOk) {
      try {
        const body = res.json();
        orderId = body.data?.id || body.id;
      } catch { /* ignore */ }
    } else {
      errorRate.add(1);
    }
  });

  if (!orderId) {
    sleep(1);
    return;
  }

  sleep(1);

  // Step 2: Track Order
  group('2. Track Order', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/orders/${orderId}`,
      { headers, tags: { name: 'order_track' } },
    );

    orderTrackDuration.add(res.timings.duration);

    check(res, {
      'order tracked': (r) => r.status === 200,
      'order has correct id': (r) => {
        try {
          const body = r.json();
          return (body.data?.id || body.id) === orderId;
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
  });

  sleep(1);

  // Step 3: Update Order
  group('3. Update Order', () => {
    const updateData = {
      notes: `Updated by load test at ${new Date().toISOString()}`,
    };

    const res = http.patch(
      `${BASE_URL}/api/v1/orders/${orderId}`,
      JSON.stringify(updateData),
      { headers, tags: { name: 'order_update' } },
    );

    orderUpdateDuration.add(res.timings.duration);

    check(res, {
      'order updated': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  // Step 4: Verify Updated Order
  group('4. Verify Update', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/orders/${orderId}`,
      { headers, tags: { name: 'order_verify' } },
    );

    check(res, {
      'updated order retrieved': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(2);
}
