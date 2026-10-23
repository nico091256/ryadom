# Ryadom

A full-stack mobile marketplace and delivery platform for neighbourhood shops in Uzbekistan (starting in Tashkent). Customers discover hyper-local shops within a 3 km radius, place orders with free delivery, and track order fulfillment in real time. Shopkeepers manage their store catalog, receive audible order notifications, and deliver orders personally to customers.

---

## 🏗 Repository Architecture

Four apps, one per role/surface. The backend, the two web panels and the shared TypeScript package are a **pnpm monorepo**. The customer app is a separate **Flutter** project (own native Android/iOS/web platform folders), not part of the pnpm workspace:

```text
├── apps/
│   ├── backend/              # NestJS Backend API (REST, WebSocket Socket.IO, Swagger, BullMQ) — pnpm
│   ├── admin/                # Platform admin panel — Next.js 14 + Tailwind (port 3000) — pnpm
│   ├── store/                # Shopkeeper (do'konchi) panel — Next.js 14 + Tailwind (port 3001) — pnpm
│   └── mobile_client/        # Customer app (browse, order, track) — standalone Flutter project
├── packages/
│   ├── shared/                # Shared TypeScript interfaces, enums, DTOs, constants (backend + web panels) — pnpm
│   └── shared_dart/           # Dart port of the same business logic (mobile_client)
├── docs/
│   ├── ASSUMPTIONS.md  # Key architectural decisions & assumptions
│   ├── PROGRESS.md     # Milestone tracking (M0 through M7)
│   └── openapi.json    # Exported OpenAPI spec (pnpm --filter @localshop/backend export:openapi)
├── docker-compose.yml  # Docker environment for backend, PostgreSQL + PostGIS, and Redis
└── pnpm-workspace.yaml # pnpm workspace configuration (apps/backend, apps/admin, apps/store, packages/shared)
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20 or higher
- **pnpm**: v9 or higher (`npm install -g pnpm`)
- **Docker & Docker Compose** (for database and redis)

### 1. Environment Setup
Copy the environment template:
```bash
cp .env.example .env
```

### 2. Launch Supporting Services
Run PostgreSQL with PostGIS extension and Redis via Docker Compose:
```bash
docker compose up -d postgres redis
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Database Setup & Seeding
```bash
# Generate Prisma Client & Run Migrations
pnpm --filter @localshop/backend prisma:migrate

# Seed Database with Tashkent, Categories, Demo Shop, and Users
pnpm --filter @localshop/backend db:seed
```

### 5. Running the Applications

#### Start NestJS Backend API (Port 4000)
```bash
pnpm dev:backend
```
Swagger API documentation will be available at: `http://localhost:4000/docs`

#### Start Admin Web Panel (Port 3000)
```bash
pnpm dev:admin
```
Access the admin portal at: `http://localhost:3000`

#### Start Shopkeeper Web Panel (Port 3001)
```bash
pnpm dev:store
```
Shopkeepers sign in at `http://localhost:3001` with the login/password the admin issued them (first login forces a password change).

#### Running without Docker (in-memory dev mode)
If PostgreSQL is not reachable on `localhost:5432` **and** `NODE_ENV` is `development`, `test` or unset, the backend boots with an **in-memory store** seeded with the same demo data (Tashkent, 5 categories, the demo shop + seller, a customer, 5 products, one `new` order, promo code `YANGI10`). Everything below works against it, including Socket.IO realtime; the BullMQ auto-cancel job is skipped (logged) when Redis is absent, and data resets on restart.
```bash
# any free ports work — these avoid clashing with other local projects
PORT=4001 pnpm dev:backend
NEXT_PUBLIC_API_URL=http://localhost:4001/api/v1 pnpm --filter @localshop/store exec next dev -p 3002
NEXT_PUBLIC_API_URL=http://localhost:4001/api/v1 pnpm --filter @localshop/admin exec next dev -p 3000
cd apps/mobile_client && flutter build web --dart-define=API_BASE_URL=http://localhost:4001/api/v1 && npx http-server build/web -p 5173 -c-1
```

#### Start the Customer Mobile App (Flutter)
A standalone Flutter project (not part of the pnpm workspace):
```bash
cd apps/mobile_client
flutter pub get
flutter run --dart-define=API_BASE_URL=http://<your-lan-ip>:4000/api/v1
```
Omit `--dart-define` to use the dev defaults (Android emulator alias / localhost). It declares a path dependency on `packages/shared_dart` — no separate install step needed for it.

---

## 🔑 Default Credentials (Seeded)

- **Admin Account**:
  - Login: `admin`
  - Password: `AdminPassword123!`
- **Shopkeeper Account (Demo Shop: "Chilonzor Oziq-Ovqat")**:
  - Login: `seller_chilonzor`
  - Password: `Shopkeeper123!` (Forces password reset on first login)
- **Customer Phone (SMS Auth)**:
  - Phone: `+998901234567`
  - Mock Verification Code: `123456`

---

## 📋 Order Lifecycle State Machine

1. **`new`** -> Order created by Customer. Stock is reserved atomically. Seller receives instant alert.
2. **`accepted`** -> Seller confirms order. If still `new` after 10 minutes, a BullMQ job auto-cancels it (stock restored).
3. **`on_the_way`** -> Seller is delivering the order to customer's address.
4. **`delivered`** -> Seller hands order to customer and confirms cash payment received.
5. **`cancelled`** -> Can be cancelled from `new` (customer or seller) or `accepted` (seller with reason); not cancellable once `on_the_way`. Reserved stock is immediately restored.

---

## 🌐 Localization & Multi-Language
- Supported languages: **Uzbek (`uz`)**, **Russian (`ru`)**, **English (`en`)**.
- Currency format: Uzbek so'm (`45 000 so'm`).
- Stored currency: Integer **tiyin** (1 UZS = 100 tiyin).
