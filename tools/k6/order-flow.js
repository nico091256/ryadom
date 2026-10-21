// k6 load test: customer order flow against the Ryadom backend.
//
//   winget install k6            (Windows)
//   k6 run tools/k6/order-flow.js
//   k6 run -e BASE_URL=http://localhost:4000/api/v1 -e VUS=50 -e DURATION=1m tools/k6/order-flow.js
//
// Works against the in-memory dev backend (no Postgres/Redis): the SMS mock code is 123456,
// the seeded shop is s-chilonzor-1 with products p-1..p-5 (190 units in total). Each VU
// uses its own phone so the per-phone 30s send-code cooldown is never hit (send-code +
// verify run once per VU, on its first iteration; the access token is then reused).
//
// Stock is finite: once the test has bought everything, PUT /cart answers 400 OUT_OF_STOCK.
// That is correct behaviour, not a failure - the script counts it as `stock_exhausted`,
// skips the order for that iteration and keeps measuring the read endpoints.
//
// NOTE: every rate limiter keys on the client IP, so 50 VUs from one machine look like one
// abusive client. Start the backend under test with THROTTLE_DISABLED=true (refused in
// production) - see docs/DEPLOY-NOTES.md.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const SHOP_ID = __ENV.SHOP_ID || 's-chilonzor-1';
// Comma-separated; VUs are spread across the list so one product is not drained first.
const PRODUCT_IDS = (__ENV.PRODUCT_IDS || 'p-1,p-2,p-3,p-4,p-5').split(',');

// 409 OUT_OF_STOCK on POST /orders is a correct answer once the test itself has drained the
// seeded stock, so it must not count as a failed request.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409));
// PUT /cart answers 400 OUT_OF_STOCK in the same situation (validated before the order).
const CART_EXPECTED = http.expectedStatuses({ min: 200, max: 299 }, 400);

const NAMES = ['auth_send_code', 'auth_verify', 'shops_nearby', 'shop_products', 'cart_put', 'orders_create', 'orders_list'];

export const options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || '1m',
  thresholds: Object.assign(
    {
      http_req_duration: ['p(95)<300'],
      http_req_failed: ['rate<0.01'],
      'http_req_duration{name:orders_create}': ['p(95)<500'],
    },
    // Declaring a threshold per tag is what makes k6 keep a sub-metric per endpoint,
    // so the summary can print p95 for each one.
    ...NAMES.filter((n) => n !== 'orders_create').map((n) => ({ [`http_req_duration{name:${n}}`]: ['p(95)<300'] })),
  ),
};

const orderCreateLatency = new Trend('order_create_latency', true);
const stockExhausted = new Counter('stock_exhausted');
const ordersCreated = new Counter('orders_created');

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

  const productId = PRODUCT_IDS[(__VU + __ITER) % PRODUCT_IDS.length];
  const cart = http.put(
    `${BASE_URL}/cart`,
    JSON.stringify({ shop_id: SHOP_ID, items: [{ product_id: productId, quantity: 1 }], clearOtherShop: true }),
    { headers: authHeaders(), tags: { name: 'cart_put' }, responseCallback: CART_EXPECTED },
  );
  const cartOutOfStock = cart.status === 400 && String(cart.body).indexOf('OUT_OF_STOCK') !== -1;
  check(cart, { 'cart 200 (or 400 OUT_OF_STOCK once drained)': (r) => r.status === 200 || cartOutOfStock });
  if (cart.status !== 200) {
    if (cartOutOfStock) stockExhausted.add(1);
    sleep(1);
    return;
  }

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
  if (order.status === 201) ordersCreated.add(1);
  else if (order.status === 409) stockExhausted.add(1);
  check(order, {
    // 409 OUT_OF_STOCK is expected when two VUs race for the last unit
    'order 201 (or 409 OUT_OF_STOCK once drained)': (r) => r.status === 201 || r.status === 409,
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
  const count = (name) => (data.metrics[name] ? data.metrics[name].values.count : 0);
  const failed = data.metrics.http_req_failed ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 'n/a';
  const all = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : null;
  const checks = [];
  const walk = (group) => {
    (group.checks || []).forEach((c) => checks.push(`${c.name}: ${c.passes} ok / ${c.fails} failed`));
    (group.groups || []).forEach(walk);
  };
  walk(data.root_group);
  const text = [
    '',
    '=== Ryadom order-flow summary ===',
    `requests: ${count('http_reqs')}  failed: ${failed}%  iterations: ${count('iterations')}`,
    `orders created: ${count('orders_created')}  stock exhausted (expected 400/409): ${count('stock_exhausted')}`,
    all ? `all requests: p95=${all['p(95)'].toFixed(1)}ms avg=${all.avg.toFixed(1)}ms max=${all.max.toFixed(1)}ms` : '',
    ...NAMES.map(line),
    'checks:',
    ...checks.map((c) => `  ${c}`),
    '',
  ].join('\n');
  return { stdout: text };
}
