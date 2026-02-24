import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

/**
 * Soak test - sustained load over extended period.
 * Purpose: Find memory leaks, connection pool exhaustion, etc.
 */
export const options = {
  stages: [
    { duration: '2m', target: 50 },    // Ramp up
    { duration: '30m', target: 50 },   // Sustained load for 30 minutes
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;

export default function () {
  const res = http.get(`${API_URL}/health`);
  check(res, { 'health OK': (r) => r.status === 200 });
  errorRate.add(res.status !== 200);
  sleep(1);
}
