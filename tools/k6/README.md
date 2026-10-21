# k6 load tests

`order-flow.js` drives the customer journey end to end: OTP login (once per VU) →
`GET /shops/nearby` → `GET /shops/:id/products` → `PUT /cart` → `POST /orders`
(with `Idempotency-Key`) → `GET /orders?limit=20`.

```powershell
# backend under test, with rate limiting off (refused in production):
$env:THROTTLE_DISABLED = 'true'; npx pnpm@12.11.2 --filter @localshop/backend start:dev

k6 run tools/k6/order-flow.js                                   # 50 VUs, 1 min
k6 run -e VUS=30 -e DURATION=30s tools/k6/order-flow.js
k6 run -e BASE_URL=https://staging-api.example.uz/api/v1 -e SHOP_ID=<uuid> -e PRODUCT_IDS=<uuid>,<uuid> tools/k6/order-flow.js
```

Thresholds: `p(95) < 300 ms` on every endpoint except `POST /orders` (`< 500 ms`),
failed requests `< 1 %`. A drained stock (`400`/`409 OUT_OF_STOCK`) is counted
separately as `stock_exhausted` and is not a failure.

## Reference run — 2026-10-21

Dev laptop, in-memory store (no Postgres/Redis), `THROTTLE_DISABLED=true`,
30 VUs for 30 s, k6 v2.3.0:

| metric | value |
| --- | --- |
| requests | 3140, **0.00 % failed** |
| iterations | 900 (190 orders = the whole seeded stock, 710 stock-exhausted) |
| all requests | p95 32 ms, avg 5.5 ms, max 155 ms |
| `POST /orders` | p95 41 ms, avg 10 ms |
| `GET /shops/nearby` | p95 5.5 ms |
| `GET /shops/:id/products` | p95 6.3 ms |
| `PUT /cart` | p95 10.5 ms |
| `GET /orders` | p95 36 ms |
| `POST /auth/send-code` / `verify` | p95 154 / 140 ms (bcrypt-style work, once per VU) |

What the first run found (and what changed):

* `POST /orders` p95 was **1505 ms**: with Redis offline every order waited the
  full 1.5 s BullMQ timeout before answering. `OrdersService` now checks the
  shared ioredis client's status and skips queue operations immediately while
  Redis is not `ready` (one warning, not one per order).
* 37 % "failed" requests were the test draining the 45 units of `p-1` and then
  receiving `400 OUT_OF_STOCK` from `PUT /cart`. The script now spreads VUs
  over `p-1..p-5`, treats that 400/409 as an expected outcome and reports it.

Numbers against a real Postgres + PostGIS + Redis will be higher (network and
`ST_DWithin`); re-run on staging before launch and record the result here.
