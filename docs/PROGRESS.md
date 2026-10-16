# Implementation Progress & Milestone Tracker

Tracking implementation milestones defined in Section 16 of the Technical Specification.

> **2026-10-16 rebuild note**: the project was brought in line with a stricter
> product spec, phase by phase (Phase A: backend hardening, Phase B: OpenAPI/Dart
> contract, Phase C/D: Flutter rewrite, Phase E: admin approval UI). Two decisions
> from that rebuild changed the milestones below: the order status machine is now
> strictly 4-state (no `preparing`), and **the mobile apps were migrated from
> Expo/React Native to Flutter** — the old `apps/mobile` Expo app has been removed
> now that `apps/mobile_client` and `apps/mobile_store` cover its core flows.

- [x] **M0: Setup** — Monorepo configuration with pnpm workspaces, Docker Compose (API, PostgreSQL + PostGIS, Redis), lint & format config, GitHub Actions CI workflow, `.env.example`, README, and docs.
- [x] **M1: Backend Foundation** — Prisma database schema, spatial migrations, seed data (Tashkent, initial categories, demo shop, seller, customer, products), authentication (SMS mock with 123456, login/password, JWT refresh, role guards), and OpenAPI (Swagger) documentation.
  - [x] *Phase A hardening*: persisted/revocable refresh tokens, hardcoded demo-password backdoor removed.
- [x] **M2: Catalog and Nearby Search** — Seller product & shop endpoints, image upload pipeline, admin shop onboarding, category management, PostGIS spatial nearby query (`ST_DWithin` <= 3000m).
  - [x] *Phase A hardening*: the `UploadsModule` (imported but missing on disk — caused by an overly broad `.gitignore` pattern) is implemented; self-service shop registration (`POST /shops/register` → pending) + admin approve/block/unblock, additive alongside admin-creates-shop.
- [x] **M3: Orders & Realtime** — Shopping cart management, transactional order creation with stock reservation/restoration, order state machine with transitions & audit history, Socket.IO gateway, and push notification dispatcher.
  - [x] *Phase A hardening*: status machine collapsed to 4 states; the 5-minute "flag only" escalation poller replaced with a real BullMQ-backed 10-minute hard auto-cancel; push notifications migrated from Expo Push to FCM with multi-device support (`DeviceToken` table); `Idempotency-Key` support on order creation.
- [~] **M4: Customer App (Flutter, `apps/mobile_client`)** — Core flow done: splash/language, SMS OTP login, GPS-based address detection + reverse geocoding, nearby shop list/search, shop detail + single-shop cart, checkout (address details, cash payment, comment), live order tracking (polling), order history, profile/logout.
  - Known gaps: no drag-pin map address picker (GPS-detect only), no saved-addresses list, no promo code field in checkout, no reorder action, Socket.IO realtime not wired (polling only), FCM push code present but untested without a real Firebase project.
- [~] **M5: Shopkeeper App (Flutter, `apps/mobile_store`)** — Core flow done: login, forced password change on first sign-in, orders board (New/In-Progress/Completed tabs, accept/reject/advance, loud alert + vibration on new orders, live 10-minute acceptance countdown, cash-received confirmation), product CRUD with photo upload, shop profile (logo, hours, open toggle), stats (today/week/month).
  - Known gaps: same Socket.IO/FCM gaps as M4; no map picker for shop location.
- [x] **M6: Admin Panel (Next.js)** — Dashboard, orders, shops (incl. pending-approval queue for self-registered shops — Phase E), categories, promo codes, users.
- [ ] **M7: Hardening & Release** — End-to-end integration tests, test coverage verification, error tracking integration, performance optimization, production Docker Compose & deployment guide, Play Store/App Store submission.
  - [x] *Phase A*: unit tests for the new auth/orders behavior (23 passing); CI gates on tests (no more `|| true`); a real e2e job (Postgres+PostGIS + Redis services) covering the full order lifecycle, auto-cancel and idempotency.
  - [x] *Flutter*: both apps verified via `flutter analyze` (0 issues) and `flutter test` on every build step in this environment; not yet added to CI, and no Android/iOS native build has been verified anywhere (no SDK/device in this environment).
  - [ ] Still open: Flutter CI job, Android/iOS release builds, app store submission, production deploy.
