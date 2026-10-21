// k6 load test: customer order flow against the Ryadom backend.
//
//   winget install k6            (Windows)
//   k6 run tools/k6/order-flow.js
//   k6 run -e BASE_URL=http://localhost:4000/api/v1 -e VUS=50 -e DURATION=1m tools/k6/order-flow.js
//
// Works against the in-memory dev backend (no Postgres/Redis): the SMS mock code is 123456,
// the seeded shop is s-chilonzor-1 with product p-1. Each VU uses its own phone so the
// per-phone 30s send-code cooldown is never hit (send-code + verify run once per VU, on
// its first iteration; the access token is then reused).
//
// NOTE: the API has a global ThrottlerGuard (120 req/min per IP). Running 50 VUs from one
// machine WILL produce 429s and fail the http_req_failed threshold unless the limit is
// raised for the test run (see docs/DEPLOY-NOTES.md).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const SHOP_ID = __ENV.SHOP_ID || 's-chilonzor-1';
const PRODUCT_ID = __ENV.PRODUCT_ID || 'p-1';

export const options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || '1m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:orders_create}': ['p(95)<500'],
    'http_req_duration{name:shops_nearby}': ['p(95)<300'],
  },
};

const orderCreateLatency = new Trend('order_create_latency', true);

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Per-VU state (k6 keeps module scope per VU, so these persist across iterations).
let accessToken = null;

function phoneForVu(vu) {
  // +99890 + 7 digits derived from __VU -> +998900000001, +998900000002, ...
  return '+99890' + String(vu).padStart(7, '0');
}

function authHeaders(extra) {
  return Object.assign({}, JSON_HEADERS, { Authorization: 'Bearer ' + accessToken }, extra || {});
}

function login() {
  const phone = phoneForVu(__VU);

  const sent = http.post(`${BASE_URL}/auth/send-code`, JSON.stringify({ phone }), {
    headers: JSON_HEADERS,
    tags: { name: 'auth_send_code' },
  });
  check(sent, { 'send-code 201/200': (r) => r.status === 201 || r.status === 200 });

  const verified = http.post(`${BASE_URL}/auth/verify`, JSON.stringify({ phone, code: '123456' }), {
    headers: JSON_HEADERS,
    tags: { name: 'auth_verify' },
  });
  const ok = check(verified, {
    'verify 201/200': (r) => r.status === 201 || r.status === 200,
    'verify returns accessToken': (r) => {
      try {
        return typeof r.json('accessToken') === 'string';
      } catch (e) {
        return false;
      }
    },
  });
  if (ok) accessToken = verified.json('accessToken');
}

export default function () {
  if (__ITER === 0 || !accessToken) {
    login();
    if (!accessToken) {
      sleep(1);
      return;
    }
  }

  const nearby = http.get(`${BASE_URL}/shops/nearby?lat=41.2995&lng=69.2401`, {
    headers: authHeaders(),
    tags: { name: 'shops_nearby' },
  });
  check(nearby, { 'nearby 200': (r) => r.status === 200 });

  const products = http.get(`${BASE_URL}/shops/${SHOP_ID}/products`, {
    headers: authHeaders(),
    tags: { name: 'shop_products' },
  });
  check(products, { 'products 200': (r) => r.status === 200 });

  const cart = http.put(
    `${BASE_URL}/cart`,
    JSON.stringify({ shop_id: SHOP_ID, items: [{ product_id: PRODUCT_ID, quantity: 1 }], clearOtherShop: true }),
    { headers: authHeaders(), tags: { name: 'cart_put' } },
  );
  check(cart, { 'cart 200': (r) => r.status === 200 });

  const idempotencyKey = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const order = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify({
      address_text: 'Chilonzor 1, k6 load test',
      lat: 41.2995,
      lng: 69.2401,
      customer_phone: phoneForVu(__VU),
      payment_method: 'cash',
      comment: 'k6',
    }),
    { headers: authHeaders({ 'Idempotency-Key': idempotencyKey }), tags: { name: 'orders_create' } },
  );
  orderCreateLatency.add(order.timings.duration);
  check(order, {
    'order 201': (r) => r.status === 201,
    // 409 OUT_OF_STOCK is expected once the seeded stock is exhausted by the test itself
    'order 201 or out-of-stock 409': (r) => r.status === 201 || r.status === 409,
  });

  const list = http.get(`${BASE_URL}/orders?limit=20`, {
    headers: authHeaders(),
    tags: { name: 'orders_list' },
  });
  check(list, {
    'orders list 200': (r) => r.status === 200,
    'orders list has data[]': (r) => {
      try {
        return Array.isArray(r.json('data'));
      } catch (e) {
        return false;
      }
    },
  });

  sleep(1);
}

export function handleSummary(data) {
  const line = (name) => {
    const m = data.metrics[`http_req_duration{name:${name}}`];
    if (!m) return `${name}: n/a`;
    const v = m.values;
    return `${name}: p95=${v['p(95)'].toFixed(1)}ms avg=${v.avg.toFixed(1)}ms max=${v.max.toFixed(1)}ms`;
  };
  const names = ['auth_send_code', 'auth_verify', 'shops_nearby', 'shop_products', 'cart_put', 'orders_create', 'orders_list'];
  const failed = data.metrics.http_req_failed ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 'n/a';
  const text = [
    '',
    '=== Ryadom order-flow summary ===',
    `requests: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 'n/a'}  failed: ${failed}%`,
    ...names.map(line),
    '',
  ].join('\n');
  return { stdout: text };
}
