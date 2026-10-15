-- Admin-managed promo codes + per-order promo tracking
ALTER TABLE "orders" ADD COLUMN "promo_code" TEXT;
ALTER TABLE "orders" ADD COLUMN "discount_amount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discount_percent" INTEGER NOT NULL,
    "max_discount_tiyin" INTEGER,
    "min_order_tiyin" INTEGER,
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
