/**
 * TBS ERP - Soak Test (Endurance Test)
 *
 * Runs moderate load over an extended period to detect:
 * - Memory leaks
 * - Connection pool exhaustion
 * - Cache key buildup
 * - Database connection leaks
 * - Log file growth issues
 * - Gradual performance degradation
 *
 * Duration: 1 hour at 50 VUs
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging-api.tbslogistics.com tests/load/soak.js
 *
 * Monitor during test:
 *   - Grafana dashboard for memory/CPU trends
 *   - Prometheus metrics for gradual degradation
 *   - Docker stats for container resource usage
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency', true);
const iterationDuration = new Trend('iteration_duration', true);

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'test@tbs.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Test1234!';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '56m', target: 50 },   // Sustain 50 VUs for ~1 hour
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    http_req_failed: ['rate<0.02'],
    errors: ['rate<0.02'],
    // Ensure latency doesn't degrade over time
    api_latency: ['p(95)<2000'],
  },
};

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
    return null;
  }

  try {
    const body = loginRes.json();
    cachedToken = body.data?.accessToken || body.accessToken;
    tokenExpiry = now + 10 * 60 * 1000;
    return cachedToken;
  } catch {
    return null;
  }
}

export default function () {
  const iterStart = Date.now();
  const token = getToken();

  if (!token) {
    sleep(2);
    return;
  }

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // Simulate a complete user session with multiple page navigations
  const actions = [
    () => viewDashboard(authHeaders),
    () => browseOrders(authHeaders),
    () => viewFinance(authHeaders),
    () => checkNotifications(authHeaders),
    () => viewWarehouse(authHeaders),
  ];

  // Execute 2-3 random actions per iteration (simulates user browsing)
  const numActions = Math.floor(Math.random() * 2) + 2;
  for (let i = 0; i < numActions; i++) {
    const action = actions[Math.floor(Math.random() * actions.length)];
    action();
    sleep(Math.random() * 3 + 1); // 1-4s think time between pages
  }

  iterationDuration.add(Date.now() - iterStart);
}

function viewDashboard(authHeaders) {
  group('Dashboard', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/dashboard/overview`,
      { ...authHeaders, tags: { name: 'dashboard_overview' } },
    );
    apiLatency.add(res.timings.duration);
    check(res, { 'dashboard 200': (r) => r.status === 200 }) || errorRate.add(1);

    // Also load order stats and finance stats
    const statsRes = http.get(
      `${BASE_URL}/api/v1/dashboard/orders`,
      { ...authHeaders, tags: { name: 'dashboard_orders' } },
    );
    apiLatency.add(statsRes.timings.duration);
    check(statsRes, { 'order stats 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
}

function browseOrders(authHeaders) {
  group('Orders', () => {
    // Browse multiple pages
    const page = Math.floor(Math.random() * 10) + 1;
    const res = http.get(
      `${BASE_URL}/api/v1/orders?page=${page}&limit=20`,
      { ...authHeaders, tags: { name: 'orders_list' } },
    );
    apiLatency.add(res.timings.duration);
    check(res, { 'orders 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
}

function viewFinance(authHeaders) {
  group('Finance', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/dashboard/finance`,
      { ...authHeaders, tags: { name: 'finance_stats' } },
    );
    apiLatency.add(res.timings.duration);
    check(res, { 'finance 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
}

function checkNotifications(authHeaders) {
  group('Notifications', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/notifications?page=1&limit=10`,
      { ...authHeaders, tags: { name: 'notifications' } },
    );
    apiLatency.add(res.timings.duration);
    check(res, { 'notifications 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
}

function viewWarehouse(authHeaders) {
  group('Warehouse', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/dashboard/warehouse`,
      { ...authHeaders, tags: { name: 'warehouse_stats' } },
    );
    apiLatency.add(res.timings.duration);
    check(res, { 'warehouse 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
}
