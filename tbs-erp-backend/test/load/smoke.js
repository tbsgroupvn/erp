import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const dashboardDuration = new Trend('dashboard_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 100 },   // Peak at 100 users
    { duration: '1m', target: 50 },    // Ramp down to 50
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],     // Error rate under 5%
    errors: ['rate<0.1'],               // Custom error rate under 10%
    login_duration: ['p(95)<3000'],     // Login under 3s at p95
    dashboard_duration: ['p(95)<5000'], // Dashboard under 5s at p95
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;
// nosec: test-only credential — override via TEST_ADMIN_PASSWORD env var in CI
const TEST_ADMIN_PASSWORD = __ENV.TEST_ADMIN_PASSWORD || 'Admin@123456';

export default function () {
  let authToken;

  group('Authentication', () => {
    const loginRes = http.post(
      `${API_URL}/auth/login`,
      JSON.stringify({
        email: 'admin@tbslogistics.com',
        password: TEST_ADMIN_PASSWORD,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    loginDuration.add(loginRes.timings.duration);

    const success = check(loginRes, {
      'login status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'login has access token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.accessToken;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!success);

    if (loginRes.status === 200 || loginRes.status === 201) {
      try {
        const body = JSON.parse(loginRes.body);
        authToken = body.data.accessToken;
      } catch {}
    }
  });

  if (!authToken) {
    sleep(1);
    return;
  }

  const headers = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  group('Health Check', () => {
    const res = http.get(`${API_URL}/health`, { headers });
    check(res, { 'health check OK': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  });

  group('Dashboard', () => {
    const res = http.get(
      `${API_URL}/dashboard/overview?dateFrom=2025-01-01&dateTo=2025-12-31`,
      { headers },
    );

    dashboardDuration.add(res.timings.duration);

    const success = check(res, {
      'dashboard status OK': (r) => r.status === 200 || r.status === 403,
    });
    errorRate.add(!success);
  });

  group('Orders List', () => {
    const res = http.get(`${API_URL}/orders?page=1&limit=10`, { headers });
    check(res, {
      'orders list OK': (r) => r.status === 200 || r.status === 403,
    });
    errorRate.add(res.status >= 500);
  });

  group('Exchange Rates', () => {
    const res = http.get(`${API_URL}/exchange-rates`, { headers });
    check(res, {
      'exchange rates OK': (r) => r.status === 200 || r.status === 403,
    });
    errorRate.add(res.status >= 500);
  });

  sleep(1);
}
