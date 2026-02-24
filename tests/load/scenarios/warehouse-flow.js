/**
 * TBS ERP - Warehouse Flow Scenario
 *
 * Simulates the logistics pipeline:
 * 1. View warehouse CN (China) inventory
 * 2. View shipment tracking
 * 3. View warehouse VN (Vietnam) inventory
 * 4. View delivery pipeline dashboard
 *
 * Tests the warehouse-heavy read operations that power
 * the operations team's daily workflow.
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging-api.tbslogistics.com tests/load/scenarios/warehouse-flow.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const warehouseCNDuration = new Trend('warehouse_cn_duration', true);
const warehouseVNDuration = new Trend('warehouse_vn_duration', true);
const trackingDuration = new Trend('tracking_duration', true);
const pipelineDuration = new Trend('pipeline_duration', true);

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'test@tbs.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Test1234!';

export const options = {
  scenarios: {
    warehouse_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 20 },
        { duration: '2m', target: 20 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    warehouse_cn_duration: ['p(95)<2000'],
    warehouse_vn_duration: ['p(95)<2000'],
    tracking_duration: ['p(95)<1500'],
    pipeline_duration: ['p(95)<2500'],
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

  // Step 1: Warehouse CN Inventory
  group('1. Warehouse CN', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/warehouse-cn?page=1&limit=20`,
      { headers: { ...headers }, tags: { name: 'warehouse_cn' } },
    );

    warehouseCNDuration.add(res.timings.duration);

    check(res, {
      'warehouse CN 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  // Step 2: Tracking/Shipments
  group('2. Tracking', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/tracking?page=1&limit=20`,
      { headers: { ...headers }, tags: { name: 'tracking_list' } },
    );

    trackingDuration.add(res.timings.duration);

    check(res, {
      'tracking 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  // Step 3: Warehouse VN Inventory
  group('3. Warehouse VN', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/warehouse-vn?page=1&limit=20`,
      { headers: { ...headers }, tags: { name: 'warehouse_vn' } },
    );

    warehouseVNDuration.add(res.timings.duration);

    check(res, {
      'warehouse VN 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  // Step 4: Pipeline Dashboard
  group('4. Pipeline Dashboard', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/dashboard/warehouse`,
      { headers: { ...headers }, tags: { name: 'pipeline_dashboard' } },
    );

    pipelineDuration.add(res.timings.duration);

    check(res, {
      'pipeline 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(2);
}
