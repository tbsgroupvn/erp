/**
 * TBS ERP - Stress Test
 *
 * Gradually ramps up load to find the system's breaking point.
 * Tests how the system handles increasing concurrent users.
 *
 * Stages:
 * 1. Warm-up: 0 -> 20 VUs over 2 minutes
 * 2. Normal load: 20 -> 50 VUs over 5 minutes
 * 3. Peak load: 50 -> 100 VUs over 2 minutes
 * 4. Sustain peak: 100 VUs for 5 minutes
 * 5. Ramp down: 100 -> 0 VUs over 2 minutes
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging-api.tbslogistics.com tests/load/stress.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginErrors = new Counter('login_errors');
const apiLatency = new Trend('api_latency', true);

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'test@tbs.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Test1234!';

export const options = {
  stages: [
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '5m', target: 50 },   // Normal load
    { duration: '2m', target: 100 },  // Peak load
    { duration: '5m', target: 100 },  // Sustain peak
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
    login_errors: ['count<10'],
  },
};

// Shared token (re-authenticated periodically)
let cachedToken = null;
let tokenExpiry = 0;

function getToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' },
    },
  );

  if (loginRes.status !== 200 && loginRes.status !== 201) {
    loginErrors.add(1);
    return null;
  }

  try {
    const body = loginRes.json();
    cachedToken = body.data?.accessToken || body.accessToken;
    tokenExpiry = now + 10 * 60 * 1000; // Cache for 10 minutes
    return cachedToken;
  } catch {
    loginErrors.add(1);
    return null;
  }
}

export default function () {
  const token = getToken();
  if (!token) {
    sleep(1);
    return;
  }

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // Randomly select an API action to simulate realistic traffic mix
  const actions = [
    { weight: 30, fn: () => getDashboard(authHeaders) },
    { weight: 25, fn: () => getOrders(authHeaders) },
    { weight: 15, fn: () => getFinanceStats(authHeaders) },
    { weight: 10, fn: () => getWarehouseStats(authHeaders) },
    { weight: 10, fn: () => getProfile(authHeaders) },
    { weight: 10, fn: () => getNotifications(authHeaders) },
  ];

  // Weighted random selection
  const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const action of actions) {
    rand -= action.weight;
    if (rand <= 0) {
      action.fn();
      break;
    }
  }

  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s think time
}

function getDashboard(authHeaders) {
  group('Dashboard', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/dashboard/overview`,
      { ...authHeaders, tags: { name: 'dashboard_overview' } },
    );
    apiLatency.add(res.timings.duration);
    check(res, { 'dashboard 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
}

function getOrders(authHeaders) {
  group('Orders', () => {
    const page = Math.floor(Math.random() * 5) + 1;
    const res = http.get(
      `${BASE_URL}/api/v1/orders?page=${page}&limit=20`,
      { ...authHeaders, tags: { name: 'orders_list' } },
    );
    apiLatency.add(res.timings.duration);
    check(res, { 'orders 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
}

function getFinanceStats(authHeaders) {
  group('Finance', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/dashboard/finance`,
      { ...authHeaders, tags: { name: 'finance_stats' } },
    );
    apiLatency.add(res.timings.duration);
    check(res, { 'finance 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
}

function getWarehouseStats(authHeaders) {
  group('Warehouse', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/dashboard/warehouse`,
      { ...authHeaders, tags: { name: 'warehouse_stats' } },
    );
    apiLatency.add(res.timings.duration);
    check(res, { 'warehouse 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
}

function getProfile(authHeaders) {
  group('Profile', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/auth/profile`,
      { ...authHeaders, tags: { name: 'profile' } },
    );
    apiLatency.add(res.timings.duration);
    check(res, { 'profile 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
}

function getNotifications(authHeaders) {
  group('Notifications', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/notifications?page=1&limit=10`,
      { ...authHeaders, tags: { name: 'notifications' } },
    );
    apiLatency.add(res.timings.duration);
    check(res, { 'notifications 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
}
