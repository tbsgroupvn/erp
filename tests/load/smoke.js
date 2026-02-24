/**
 * TBS ERP - Smoke Test
 *
 * Basic functionality verification with minimal load.
 * Run after every deployment to ensure core features work.
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging-api.tbslogistics.com tests/load/smoke.js
 *   k6 run --env BASE_URL=http://localhost:3000 tests/load/smoke.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginDuration = new Trend('login_duration', true);
const dashboardDuration = new Trend('dashboard_duration', true);
const errorRate = new Rate('errors');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'test@tbs.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Test1234!';

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    login_duration: ['p(95)<1000'],
    dashboard_duration: ['p(95)<2000'],
  },
};

export default function () {
  let token;

  group('Health Check', () => {
    const healthRes = http.get(`${BASE_URL}/api/v1/health`);
    check(healthRes, {
      'health check returns 200': (r) => r.status === 200,
      'health status is ok': (r) => {
        try {
          const body = r.json();
          return body.status === 'ok';
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
  });

  group('Authentication', () => {
    const loginRes = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    loginDuration.add(loginRes.timings.duration);

    const loginOk = check(loginRes, {
      'login returns 200 or 201': (r) => r.status === 200 || r.status === 201,
      'login returns access token': (r) => {
        try {
          const body = r.json();
          return !!(body.data?.accessToken || body.accessToken);
        } catch {
          return false;
        }
      },
    });

    if (!loginOk) {
      errorRate.add(1);
      return;
    }

    try {
      const body = loginRes.json();
      token = body.data?.accessToken || body.accessToken;
    } catch {
      errorRate.add(1);
      return;
    }
  });

  if (!token) return;

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  group('Dashboard', () => {
    const dashRes = http.get(
      `${BASE_URL}/api/v1/dashboard/overview`,
      authHeaders,
    );

    dashboardDuration.add(dashRes.timings.duration);

    check(dashRes, {
      'dashboard returns 200': (r) => r.status === 200,
      'dashboard has data': (r) => {
        try {
          const body = r.json();
          return body.data !== undefined || body.totalOrders !== undefined;
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
  });

  group('Orders List', () => {
    const ordersRes = http.get(
      `${BASE_URL}/api/v1/orders?page=1&limit=10`,
      authHeaders,
    );

    check(ordersRes, {
      'orders list returns 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  group('Profile', () => {
    const profileRes = http.get(
      `${BASE_URL}/api/v1/auth/profile`,
      authHeaders,
    );

    check(profileRes, {
      'profile returns 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);
}
