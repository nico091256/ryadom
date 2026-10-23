-- Admin list / dashboard indexes (audit finding #22) and the pg_trgm extension
-- the admin search boxes rely on. IF NOT EXISTS keeps the migration safe on
-- databases that were synced with `prisma db push`.
--
-- Declared in prisma/schema.prisma (model Order): orders_created_at_idx,
-- orders_needs_attention_created_at_idx.
--
-- NOT declarable in schema.prisma (hand-written, see the comment blocks above
-- `model Order` / `model User`): the three GIN trigram indexes below. Prisma
-- cannot model GIN + gin_trgm_ops, so `prisma migrate diff` will propose
-- dropping them; never accept such a DROP.

-- Extensions (postgis is created in 0_init; both are also listed in the datasource block)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Order: dashboard 30-day series + "orders today" (created_at >= ...),
-- admin list default sort (created_at DESC) and needs_attention-first ordering.
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders"("created_at");
CREATE INDEX IF NOT EXISTS "orders_needs_attention_created_at_idx" ON "orders"("needs_attention", "created_at");

-- Trigram indexes for the `contains` (ILIKE '%q%') searches in AdminService.getOrders / getUsers.
CREATE INDEX IF NOT EXISTS "orders_customer_phone_trgm_idx" ON "orders" USING GIN ("customer_phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_phone_trgm_idx" ON "users" USING GIN ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_name_trgm_idx" ON "users" USING GIN ("name" gin_trgm_ops);
