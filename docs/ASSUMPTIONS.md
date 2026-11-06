# Project Assumptions & Design Decisions

This document records the assumptions and technical decisions made during the development of the Local Shop Delivery Platform, consistent with Technical Specification v2.

## 1. Scope & Roles
- **Customer App (`apps/mobile_client`)**: Flutter application (Android, iOS, and Web) dedicated to customers (`customer` role).
- **Shopkeeper Panel (`apps/store`)**: Next.js web panel dedicated to shopkeepers (`seller` role) working at a counter/desk, with POS and Telegram bot integrations.
- **Admin Panel (`apps/admin`)**: Next.js web panel dedicated to platform administrators (`admin` role).
- **Courier Role**: Out of scope for Phase 1. The shopkeeper personally fulfills and delivers orders.
- **Delivery Pricing**: Delivery is always 100% free for customers in Phase 1. There is no minimum order amount.

## 2. Localization & Multi-Language Support
- Supported languages from day 1: Uzbek (`uz`, Latin script - default), Russian (`ru`), English (`en`).
- All user-facing strings are strictly externalized to localization dictionaries (`i18n`). Hardcoded UI strings are forbidden.
- For catalog data (product names, category names, descriptions), if a translation in the user's selected language is blank, it gracefully falls back: first to Uzbek (`uz`), then to any populated language.

## 3. Financials & Money Storage
- All monetary amounts (prices, order totals, commissions) are stored strictly as integers representing **tiyin** (1 UZS = 100 tiyin). Floating-point storage is strictly forbidden.
- Display formatting conforms to local convention: `45 000 so'm`.
- Phase 1 payment method is **Cash on Delivery**. Online payment integration (Payme, Click) is implemented via a clean `PaymentProvider` abstraction and kept behind feature flag `ONLINE_PAYMENTS_ENABLED=false`.
- Commission rate defaults to 0% until decided by business operations. `commission_rate_percent` and calculated `commission_amount` (in tiyin) are immutably snapshotted onto each order at the moment of creation.

## 4. Geography & Nearby Search
- Launch city: **Tashkent**. The `cities` table is present from day 1 to ensure zero schema changes when onboarding additional regions.
- Nearby shop search queries PostgreSQL + PostGIS with `ST_DWithin` using a spatial GiST index over geography points, constrained to `3000` meters (3 km) radius.
- Yandex Maps and Geocoding APIs power map rendering, pin positioning, and address reverse-geocoding.
- Shops without coordinates are never returned in search. Inactive or closed shops are displayed with a "Closed" indicator and blocked from checkout.

## 5. Order State Machine & Realtime
- 4 lifecycle states: `new` -> `accepted` -> `on_the_way` -> `delivered` (plus `cancelled`).
- Stock quantities (and promo code redemptions) are atomically decremented within the order creation database transaction. If an order is rejected or cancelled, the reserved stock and promo usage are atomically restored.
- If an order stays in `new` state for 10 minutes without being accepted by the seller, a BullMQ delayed job (backed by a per-minute sweep fallback) automatically cancels the order and restores stock.
- Live order status updates broadcast across authenticated Socket.IO rooms (`shop:{shopId}`, `order:{orderId}`, `user:{userId}`), Telegram seller bot notifications, and Firebase Cloud Messaging (FCM) push notifications.
