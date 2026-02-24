/**
 * TBS ERP - Finance Flow Scenario
 *
 * End-to-end finance workflow simulation:
 * 1. View finance dashboard
 * 2. List payment vouchers
 * 3. View AR/AP summary
 * 4. Check cash flow
 *
 * Tests the finance module's read-heavy operations
 * which involve complex aggregation queries.
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging-api.tbslogistics.com tests/load/scenarios/finance-flow.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const financeDashDuration = new Trend('finance_dash_duration', true);
const arListDuration = new Trend('ar_list_duration', true);
const apListDuration = new Trend('ap_list_duration', true);

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'test@tbs.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Test1234!';

export const options = {
  scenarios: {
    finance_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 25 },
        { duration: '2m', target: 25 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    finance_dash_duration: ['p(95)<3000'],
    ar_list_duration: ['p(95)<2000'],
    ap_list_duration: ['p(95)<2000'],
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

  // Step 1: Finance Dashboard
  group('1. Finance Dashboard', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/dashboard/finance`,
      { headers: { ...headers }, tags: { name: 'finance_dashboard' } },
    );

    financeDashDuration.add(res.timings.duration);

    check(res, {
      'finance dashboard 200': (r) => r.status === 200,
      'has AR data': (r) => {
        try {
          const body = r.json();
          return body.data?.accountsReceivable !== undefined ||
                 body.accountsReceivable !== undefined;
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
  });

  sleep(1);

  // Step 2: Accounts Receivable List
  group('2. Accounts Receivable', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/accounts-receivable?page=1&limit=20`,
      { headers: { ...headers }, tags: { name: 'ar_list' } },
    );

    arListDuration.add(res.timings.duration);

    check(res, {
      'AR list 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  // Step 3: Accounts Payable List
  group('3. Accounts Payable', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/accounts-payable?page=1&limit=20`,
      { headers: { ...headers }, tags: { name: 'ap_list' } },
    );

    apListDuration.add(res.timings.duration);

    check(res, {
      'AP list 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  // Step 4: Payment Vouchers
  group('4. Payment Vouchers', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/cash/vouchers?page=1&limit=20&status=PENDING`,
      { headers: { ...headers }, tags: { name: 'vouchers_list' } },
    );

    check(res, {
      'vouchers list 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(2);
}
