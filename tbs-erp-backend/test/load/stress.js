import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

/**
 * Stress test - push the system beyond normal capacity.
 * Purpose: Find the breaking point.
 */
export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp to 100
    { duration: '2m', target: 200 },   // Ramp to 200
    { duration: '2m', target: 500 },   // Ramp to 500 (stress!)
    { duration: '2m', target: 1000 },  // Ramp to 1000 (breaking point?)
    { duration: '2m', target: 0 },     // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(99)<10000'], // Even under stress, p99 < 10s
    errors: ['rate<0.3'],               // Allow up to 30% errors under extreme load
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;

export default function () {
  // Health check endpoint (lightweight, tests infra capacity)
  group('Health Check Under Stress', () => {
    const res = http.get(`${API_URL}/health`);
    const success = check(res, {
      'health OK under stress': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  // Login attempt (tests auth + DB under load)
  group('Login Under Stress', () => {
    const res = http.post(
      `${API_URL}/auth/login`,
      JSON.stringify({
        email: `user${__VU}@tbslogistics.com`,
        password: 'TestPassword123',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    check(res, {
      'login responded': (r) => r.status > 0,
      'no server error': (r) => r.status < 500,
    });
    errorRate.add(res.status >= 500);
  });

  sleep(0.5);
}
