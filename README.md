# Ryadom

A full-stack mobile marketplace and delivery platform for neighbourhood shops in Uzbekistan (starting in Tashkent). Customers discover hyper-local shops within a 3 km radius, place orders with free delivery, and track order fulfillment in real time. Shopkeepers manage their store catalog, receive audible order notifications, and deliver orders personally to customers.

---

## 🏗 Repository Architecture

The backend, admin panel, and shared TypeScript package are a **pnpm monorepo**. The two mobile apps are separate **Flutter** projects (own native Android/iOS/web platform folders) that share Dart business logic via `packages/shared_dart`, not part of the pnpm workspace:

```text
├── apps/
│   ├── backend/              # NestJS Backend API (REST, WebSocket Socket.IO, Swagger, BullMQ) — pnpm
│   ├── admin/                # Next.js 14 + Tailwind CSS Admin Web Panel — pnpm
│   ├── mobile_client/        # Flutter customer app (browse, order, track) — standalone Flutter project
│   └── mobile_store/         # Flutter shopkeeper app (fulfill orders, catalog) — standalone Flutter project
├── packages/
│   ├── shared/                # Shared TypeScript interfaces, enums, DTOs, constants (api + admin) — pnpm
│   └── shared_dart/           # Dart port of the same business logic (both Flutter apps)
├── docs/
│   ├── ASSUMPTIONS.md  # Key architectural decisions & assumptions
│   ├── PROGRESS.md     # Milestone tracking (M0 through M7)
│   └── openapi.json    # Exported OpenAPI spec (pnpm --filter @localshop/backend export:openapi)
├── docker-compose.yml  # Docker environment for backend, PostgreSQL + PostGIS, and Redis
└── pnpm-workspace.yaml # pnpm workspace configuration (apps/backend, apps/admin, packages/shared only)
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

#### Start a Mobile App (Flutter)
Each Flutter app is a standalone project (not part of the pnpm workspace):
```bash
cd apps/mobile_client   # or apps/mobile_store
flutter pub get
flutter run --dart-define=API_BASE_URL=http://<your-lan-ip>:4000/api/v1
```
Omit `--dart-define` to use the dev defaults (Android emulator alias / localhost). Both apps declare a path dependency on `packages/shared_dart` — no separate install step needed for it.

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
