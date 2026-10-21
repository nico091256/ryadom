# Deploy Notes — performance & observability

Short operational notes for the backend (`apps/backend`). Environment variable
templates live in `.env.example`; this file only explains the *why* and the knobs.

## Database connection pool (Prisma)

Prisma opens `num_cpus * 2 + 1` connections per process by default. With several
API replicas plus BullMQ workers that quickly exceeds Postgres' `max_connections`.
Set the pool size explicitly in `DATABASE_URL`:

```
DATABASE_URL=postgresql://user:pass@host:5432/ryadom?schema=public&connection_limit=10&pool_timeout=10
```

* `connection_limit=10` — per process; keep `replicas * connection_limit` below
  `max_connections - 10` (or put PgBouncer in front and add `&pgbouncer=true`).
* `pool_timeout=10` — seconds a query waits for a free connection before failing
  (default 10). Lower it under heavy load so requests fail fast instead of piling up.
* The order-creation interactive transaction is capped at
  `{ timeout: 5000, maxWait: 2000 }` (`OrdersService.createOrder`), so a stuck
  transaction can hold a connection for at most 5 s.

## Indexes

All `@@index` declarations in `prisma/schema.prisma` are now covered by
migrations `0`–`5` (`5_performance_indexes` adds the compound indexes from the
scaling work and swaps `sms_codes_phone_idx` for `sms_codes_phone_created_at_idx`).
The PostGIS GIST indexes (`shops_geo_gist_idx`, `addresses_geo_gist_idx`) come from
`0_init` and use exactly the expression `ShopsService.findNearby` queries with
(`ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`). Deploy with
`pnpm --filter @localshop/backend prisma:deploy`.

## Metrics (Prometheus)

`GET /api/v1/metrics` (public, throttling skipped) serves prom-client output:
`http_request_duration_seconds{method,route,status_code}` (route = Express
template, e.g. `/api/v1/orders/:id`), `http_requests_total`, `orders_created_total`
and the Node default metrics.

* `METRICS_TOKEN=<random>` — when set the scraper must send
  `Authorization: Bearer <METRICS_TOKEN>`; otherwise the endpoint answers 401.
  Prometheus: `authorization: { type: Bearer, credentials: <token> }` in the scrape job.

## Error tracking (Sentry)

Sentry is initialised only when `SENTRY_DSN` is set (`initSentry(process.env)` in
`main.ts`, before `NestFactory.create`). Optional: `SENTRY_ENVIRONMENT`
(defaults to `NODE_ENV`), `SENTRY_RELEASE`. Traces are sampled at 10 %.
`HttpExceptionFilter` forwards only 5xx responses to Sentry; 4xx are expected
client errors and are not reported.

## Load test (k6)

Script: `tools/k6/order-flow.js` — 50 VUs for 1 minute, each VU logs in once
(SMS mock code `123456`, unique phone per VU), then loops:
`GET /shops/nearby` → `GET /shops/s-chilonzor-1/products` → `PUT /cart` →
`POST /orders` (with `Idempotency-Key`) → `GET /orders?limit=20`.
Thresholds: `p(95) < 300 ms`, failed requests `< 1 %`.

```powershell
winget install --id GrafanaLabs.k6 -e   # one-time, Windows (needs the UAC prompt); or unzip the
                                        # portable k6-vX-windows-amd64.zip from github.com/grafana/k6/releases
# start the backend first with rate limiting OFF (in-memory store is fine):
$env:THROTTLE_DISABLED = 'true'; npx pnpm@12.11.2 --filter @localshop/backend start:dev
k6 run tools/k6/order-flow.js
k6 run -e BASE_URL=https://staging-api.example.uz/api/v1 -e VUS=100 -e DURATION=3m tools/k6/order-flow.js
```

Caveats:

* All limiters (global 120 req/min per IP and the per-route auth windows) key on
  the client IP, so 50 VUs from one machine are indistinguishable from one abusive
  client. `THROTTLE_DISABLED=true` switches them off for the test instance; the
  API refuses to boot with it in production. Never point k6 at production.
* The seeded in-memory shop has finite stock; once it is exhausted `POST /orders`
  returns `409 OUT_OF_STOCK`. The script treats 409 as an expected status so it
  does not count toward `http_req_failed`. Reseed (restart the dev server) between runs.
* Without Redis the `Idempotency-Key` is accepted but not enforced (logged once).

Reference run (2026-10-21, dev laptop, in-memory store, `THROTTLE_DISABLED=true`,
30 VUs / 30 s): 3140 requests, 0 % failed, p95 32 ms overall, `POST /orders`
p95 41 ms. Details and what the first run uncovered: `tools/k6/README.md`.
