-- Performance indexes declared in prisma/schema.prisma (commits 781edf3 + 10f1c75)
-- but never migrated. Generated from `prisma migrate diff --from-empty --to-schema-datamodel`
-- and reduced to the CREATE INDEX statements missing from migrations 0-4.
-- IF NOT EXISTS keeps the migration safe on databases that were synced with `prisma db push`.
--
-- Already present (NOT repeated here):
--   0_init  -> orders_shop_id_status_created_at_idx, orders_customer_id_created_at_idx,
--              shops_geo_gist_idx / addresses_geo_gist_idx (GIST on
--              ST_SetSRID(ST_MakePoint("lng","lat"),4326)::geography — the exact expression
--              ShopsService.findNearby uses in ST_DWithin / ST_Distance, so the planner can use it)
--   3_phase_a -> refresh_tokens_user_id_idx, device_tokens_user_id_idx
--   4_order_reviews -> order_reviews_customer_id_idx
-- audit_logs indexes belong to migration 6_audit_log.

-- Address
CREATE INDEX IF NOT EXISTS "addresses_user_id_idx" ON "addresses"("user_id");
CREATE INDEX IF NOT EXISTS "addresses_city_id_idx" ON "addresses"("city_id");

-- Shop
CREATE INDEX IF NOT EXISTS "shops_status_is_active_is_open_idx" ON "shops"("status", "is_active", "is_open");
CREATE INDEX IF NOT EXISTS "shops_owner_id_idx" ON "shops"("owner_id");
CREATE INDEX IF NOT EXISTS "shops_city_id_idx" ON "shops"("city_id");

-- Category
CREATE INDEX IF NOT EXISTS "categories_parent_id_idx" ON "categories"("parent_id");

-- Product
CREATE INDEX IF NOT EXISTS "products_shop_id_is_available_deleted_at_idx" ON "products"("shop_id", "is_available", "deleted_at");
CREATE INDEX IF NOT EXISTS "products_category_id_idx" ON "products"("category_id");

-- OrderItem
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items"("product_id");

-- OrderStatusHistory
CREATE INDEX IF NOT EXISTS "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");
CREATE INDEX IF NOT EXISTS "order_status_history_changed_by_idx" ON "order_status_history"("changed_by");

-- Payment
CREATE INDEX IF NOT EXISTS "payments_order_id_idx" ON "payments"("order_id");
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments"("status");

-- Notification
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- SmsCode: @@index([phone]) was replaced by @@index([phone, created_at])
-- (AuthService.sendCode filters on phone + created_at >= now-30s; verifyCode orders by created_at).
DROP INDEX IF EXISTS "sms_codes_phone_idx";
CREATE INDEX IF NOT EXISTS "sms_codes_phone_created_at_idx" ON "sms_codes"("phone", "created_at");
