# Local Shop Delivery Platform (v2)

A full-stack mobile marketplace and delivery platform for neighbourhood shops in Uzbekistan (starting in Tashkent). Customers discover hyper-local shops within a 3 km radius, place orders with free delivery, and track order fulfillment in real time. Shopkeepers manage their store catalog, receive audible order notifications, and deliver orders personally to customers.

---

## 🏗 Repository Architecture

This project is organized as a high-performance **pnpm monorepo**:

```text
├── apps/
│   ├── api/            # NestJS Backend API (REST, WebSocket Socket.IO, Swagger, BullMQ)
│   ├── mobile/         # React Native + Expo App (Expo Router, Customer + Shopkeeper roles)
│   └── admin/          # Next.js 14 + Tailwind CSS Admin Web Panel
├── packages/
│   └── shared/         # Shared TypeScript interfaces, enums, DTOs, and constants
├── docs/
│   ├── ASSUMPTIONS.md  # Key architectural decisions & assumptions
│   ├── PROGRESS.md     # Milestone tracking (M0 through M7)
│   └── API_NOTES.md    # Detailed API endpoint & WebSocket specs
├── docker-compose.yml  # Docker environment for API, PostgreSQL + PostGIS, and Redis
└── pnpm-workspace.yaml # Monorepo workspace configuration
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
pnpm --filter @localshop/api db:migrate

# Seed Database with Tashkent, Categories, Demo Shop, and Users
pnpm --filter @localshop/api db:seed
```

### 5. Running the Applications

#### Start NestJS Backend API (Port 4000)
```bash
pnpm dev:api
```
Swagger API documentation will be available at: `http://localhost:4000/docs`

#### Start Admin Web Panel (Port 3000)
```bash
pnpm dev:admin
```
Access the admin portal at: `http://localhost:3000`

#### Start Mobile App (Expo)
```bash
pnpm dev:mobile
```
Press `a` for Android Emulator, `i` for iOS Simulator, or scan the QR code using Expo Go.

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
2. **`accepted`** -> Seller confirms order within 5 minutes. (If 5 min lapses, flagged `needs_attention` for Admin).
3. **`preparing`** -> Seller is packing the order.
4. **`on_the_way`** -> Seller is delivering the order to customer's address.
5. **`delivered`** -> Seller hands order to customer and confirms cash payment received.
6. **`cancelled`** -> Can be cancelled from `new` (customer or seller), or `accepted`/`preparing` (seller with reason). Reserved stock is immediately restored.

---

## 🌐 Localization & Multi-Language
- Supported languages: **Uzbek (`uz`)**, **Russian (`ru`)**, **English (`en`)**.
- Currency format: Uzbek so'm (`45 000 so'm`).
- Stored currency: Integer **tiyin** (1 UZS = 100 tiyin).
