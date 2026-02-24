/**
 * TBS ERP - Spike Test
 *
 * Tests system behavior under sudden, extreme load.
 * Simulates scenarios like:
 * - Flash sale announcements
 * - All employees logging in at start of business day
 * - Sudden traffic from marketing campaigns
 *
 * Pattern: Normal load -> instant spike to 200 VUs -> sustain -> recover
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging-api.tbslogistics.com tests/load/spike.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const spikeLatency = new Trend('spike_latency', true);
const recoveryLatency = new Trend('recovery_latency', true);

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'test@tbs.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Test1234!';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Baseline: normal load
    { duration: '30s', target: 200 },  // Spike: sudden jump to 200 VUs
    { duration: '3m', target: 200 },   // Sustain spike
    { duration: '30s', target: 10 },   // Recovery: drop back to normal
    { duration: '2m', target: 10 },    // Verify recovery
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    // More lenient thresholds during spike - expect some degradation
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.10'],   // Allow up to 10% errors during spike
    errors: ['rate<0.10'],
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
  const token = getToken();
  if (!token) {
    sleep(0.5);
    return;
  }

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // Simulate typical page load: dashboard + supporting data
  group('Page Load', () => {
    const responses = http.batch([
      ['GET', `${BASE_URL}/api/v1/dashboard/overview`, null, { ...authHeaders, tags: { name: 'dashboard' } }],
      ['GET', `${BASE_URL}/api/v1/orders?page=1&limit=10`, null, { ...authHeaders, tags: { name: 'orders' } }],
      ['GET', `${BASE_URL}/api/v1/notifications?page=1&limit=5`, null, { ...authHeaders, tags: { name: 'notifications' } }],
    ]);

    for (const res of responses) {
      spikeLatency.add(res.timings.duration);
      check(res, {
        'batch request 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    }
  });

  sleep(Math.random() * 1 + 0.2); // 0.2-1.2s think time (aggressive during spike)
}
