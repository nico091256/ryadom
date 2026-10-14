# Implementation Progress & Milestone Tracker

Tracking implementation milestones defined in Section 16 of the Technical Specification:

- [x] **M0: Setup** — Monorepo configuration with pnpm workspaces, Docker Compose (API, PostgreSQL + PostGIS, Redis), lint & format config, GitHub Actions CI workflow, `.env.example`, README, and docs.
- [x] **M1: Backend Foundation** — Prisma database schema, spatial migrations, seed data (Tashkent, initial categories, demo shop, seller, customer, products), authentication (SMS mock with 123456, login/password, JWT refresh, role guards), and OpenAPI (Swagger) documentation.
- [x] **M2: Catalog and Nearby Search** — Seller product & shop endpoints, image upload pipeline, admin shop onboarding, category management, PostGIS spatial nearby query (`ST_DWithin` <= 3000m).
- [x] **M3: Orders & Realtime** — Shopping cart management, transactional order creation with stock reservation/restoration, order state machine with transitions & audit history, 5-minute timeout escalation worker, Socket.IO gateway, and push notification dispatcher.
- [ ] **M4: Customer App (Expo)** — Multi-language interface (uz/ru/en), SMS authentication, Yandex address pin picker & reverse-geocoding, nearby shop list & map, shop details with live stock, single-shop cart, cash checkout, live order tracking timeline, order history & one-tap reorder.
- [ ] **M5: Shopkeeper App (Expo)** — Seller login with forced password change on first sign-in, shop profile & Open/Closed toggle, product CRUD with photo upload & multi-language fallback, order fulfillment tabs (New, In Progress, Completed), loud order alerts (sound & vibration), 5-minute timer countdown, cash receipt confirmation.
- [ ] **M6: Admin Panel (Next.js)** — Secure admin login, shops & shopkeeper onboarding with Yandex Map location picker, global category editor, comprehensive orders monitor with "needs attention" escalation badges, customer/seller user management, operational metrics dashboard.
- [ ] **M7: Hardening & Release** — End-to-end integration tests, test coverage verification, error tracking integration, performance optimization, production Docker Compose & deployment guide.
