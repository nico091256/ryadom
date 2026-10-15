-- Phase A backend hardening:
-- 1) Collapse OrderStatus to the 4-state machine (drop 'preparing')
-- 2) Persisted, revocable refresh tokens
-- 3) Multi-device FCM push tokens (replaces users.push_token)
-- 4) Shop onboarding status (self-registration + admin approval)

-- 1) OrderStatus: new, accepted, on_the_way, delivered, cancelled
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM ('new', 'accepted', 'on_the_way', 'delivered', 'cancelled');

-- Remap any existing 'preparing' orders/history to 'accepted' before casting
UPDATE "orders" SET "status" = 'accepted' WHERE "status"::text = 'preparing';
UPDATE "order_status_history" SET "status" = 'accepted' WHERE "status"::text = 'preparing';

ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus" USING ("status"::text::"OrderStatus");
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'new';

ALTER TABLE "order_status_history" ALTER COLUMN "status" TYPE "OrderStatus" USING ("status"::text::"OrderStatus");

DROP TYPE "OrderStatus_old";

-- 2) Persisted, revocable refresh tokens
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_info" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Multi-device push notification tokens (FCM), replacing the single users.push_token column
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'unknown',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "device_tokens" ("id", "user_id", "token", "platform", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "id", "push_token", 'unknown', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users"
WHERE "push_token" IS NOT NULL AND "push_token" <> ''
ON CONFLICT ("token") DO NOTHING;

ALTER TABLE "users" DROP COLUMN "push_token";

-- 4) Shop onboarding status (self-registration + admin approval), orthogonal to is_active/is_open
CREATE TYPE "ShopStatus" AS ENUM ('pending', 'active', 'blocked');
ALTER TABLE "shops" ADD COLUMN "status" "ShopStatus" NOT NULL DEFAULT 'active';
