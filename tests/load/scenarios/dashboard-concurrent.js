/**
 * TBS ERP - Dashboard Concurrent Access Scenario
 *
 * Simulates 70 concurrent users viewing the dashboard simultaneously.
 * This is the most common pattern in the ERP: morning standup where
 * all team members open the dashboard at the same time.
 *
 * Tests:
 * - Dashboard cache effectiveness
 * - Database connection pool under concurrent reads
 * - Redis cache hit rates
 * - Response time consistency under parallel load
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging-api.tbslogistics.com tests/load/scenarios/dashboard-concurrent.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const overviewLatency = new Trend('overview_latency', true);
const orderStatsLatency = new Trend('order_stats_latency', true);
const financeStatsLatency = new Trend('finance_stats_latency', true);
const warehouseStatsLatency = new Trend('warehouse_stats_latency', true);
const hrStatsLatency = new Trend('hr_stats_latency', true);

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'test@tbs.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Test1234!';

export const options = {
  scenarios: {
    morning_standup: {
      executor: 'constant-vus',
      vus: 70,
      duration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    http_req_failed: ['rate<0.03'],
    errors: ['rate<0.03'],
    overview_latency: ['p(95)<1500'],
    order_stats_latency: ['p(95)<2000'],
    finance_stats_latency: ['p(95)<2000'],
    warehouse_stats_latency: ['p(95)<1500'],
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

  // Simulate loading the full dashboard page
  // All dashboard widgets load in parallel (like the real frontend does)
  group('Full Dashboard Load', () => {
    const responses = http.batch([
      [
        'GET',
        `${BASE_URL}/api/v1/dashboard/overview`,
        null,
        { headers, tags: { name: 'dashboard_overview' } },
      ],
      [
        'GET',
        `${BASE_URL}/api/v1/dashboard/orders`,
        null,
        { headers, tags: { name: 'dashboard_orders' } },
      ],
      [
        'GET',
        `${BASE_URL}/api/v1/dashboard/finance`,
        null,
        { headers, tags: { name: 'dashboard_finance' } },
      ],
      [
        'GET',
        `${BASE_URL}/api/v1/dashboard/warehouse`,
        null,
        { headers, tags: { name: 'dashboard_warehouse' } },
      ],
      [
        'GET',
        `${BASE_URL}/api/v1/dashboard/hr`,
        null,
        { headers, tags: { name: 'dashboard_hr' } },
      ],
    ]);

    // Record latency per widget
    if (responses[0]) overviewLatency.add(responses[0].timings.duration);
    if (responses[1]) orderStatsLatency.add(responses[1].timings.duration);
    if (responses[2]) financeStatsLatency.add(responses[2].timings.duration);
    if (responses[3]) warehouseStatsLatency.add(responses[3].timings.duration);
    if (responses[4]) hrStatsLatency.add(responses[4].timings.duration);

    // Check all responses
    for (let i = 0; i < responses.length; i++) {
      check(responses[i], {
        [`widget ${i} returns 200`]: (r) => r.status === 200,
      }) || errorRate.add(1);
    }
  });

  // Simulate user staying on dashboard, auto-refreshing every 30s
  sleep(Math.random() * 10 + 5); // 5-15s before next refresh
}
