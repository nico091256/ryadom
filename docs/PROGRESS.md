# Implementation Progress & Milestone Tracker

Tracking implementation milestones defined in Section 16 of the Technical Specification.

> **2026-10-15 rebuild note**: the project is being brought in line with a stricter
> product spec, phase by phase (see the "Phase A/B/C/D..." notes below). Two
> decisions from that rebuild change the milestones below: the order status
> machine is now strictly 4-state (no `preparing`), and **the mobile apps are
> being migrated from Expo/React Native to Flutter** — M4/M5 below describe
> the target Flutter apps, not the existing `apps/mobile` Expo app (kept in
> place as a reference until the Flutter apps reach parity, then removed).

- [x] **M0: Setup** — Monorepo configuration with pnpm workspaces, Docker Compose (API, PostgreSQL + PostGIS, Redis), lint & format config, GitHub Actions CI workflow, `.env.example`, README, and docs.
- [x] **M1: Backend Foundation** — Prisma database schema, spatial migrations, seed data (Tashkent, initial categories, demo shop, seller, customer, products), authentication (SMS mock with 123456, login/password, JWT refresh, role guards), and OpenAPI (Swagger) documentation.
  - [x] *Phase A hardening*: persisted/revocable refresh tokens, hardcoded demo-password backdoor removed.
- [x] **M2: Catalog and Nearby Search** — Seller product & shop endpoints, image upload pipeline, admin shop onboarding, category management, PostGIS spatial nearby query (`ST_DWithin` <= 3000m).
  - [x] *Phase A hardening*: the `UploadsModule` (imported but missing on disk — caused by an overly broad `.gitignore` pattern) is implemented; self-service shop registration (`POST /shops/register` → pending) + admin approve/block/unblock, additive alongside admin-creates-shop.
- [x] **M3: Orders & Realtime** — Shopping cart management, transactional order creation with stock reservation/restoration, order state machine with transitions & audit history, Socket.IO gateway, and push notification dispatcher.
  - [x] *Phase A hardening*: status machine collapsed to 4 states; the 5-minute "flag only" escalation poller replaced with a real BullMQ-backed 10-minute hard auto-cancel; push notifications migrated from Expo Push to FCM with multi-device support (`DeviceToken` table); `Idempotency-Key` support on order creation.
- [ ] **M4: Customer App (Flutter)** *(was Expo; full rewrite in progress — `apps/mobile_client`)* — Multi-language interface (uz/ru/en), SMS authentication, address pin picker & reverse-geocoding, nearby shop list & map, shop details with live stock, single-shop cart, cash checkout, live order tracking timeline, order history & one-tap reorder.
- [ ] **M5: Shopkeeper App (Flutter)** *(was Expo; full rewrite in progress — `apps/mobile_store`)* — Seller login with forced password change on first sign-in, shop profile & Open/Closed toggle, product CRUD with photo upload & multi-language fallback, order fulfillment tabs (New, In Progress, Completed), loud order alerts (sound & vibration), 10-minute timer countdown, cash receipt confirmation.
- [~] **M6: Admin Panel (Next.js)** — Already substantially implemented (dashboard, orders, shops, categories, promo codes, users) ahead of where this tracker previously showed it; remaining: pending-shop-approval queue UI for the new self-registration flow (Phase A backend support already in place).
- [ ] **M7: Hardening & Release** — End-to-end integration tests, test coverage verification, error tracking integration, performance optimization, production Docker Compose & deployment guide.
  - [x] *Phase A hardening*: unit tests for the new auth/orders behavior (23 passing); CI now gates on tests (no more `|| true`); a real e2e job (Postgres+PostGIS + Redis services) covering the full order lifecycle, auto-cancel and idempotency was added.
