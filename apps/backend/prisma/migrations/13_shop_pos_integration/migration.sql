-- POS (cash-register) integration: per-shop API key for /pos/*, the vendor type and an
-- optional webhook that receives new orders. A NULL key means the integration is off.
ALTER TABLE "shops" ADD COLUMN "pos_api_key" TEXT;
ALTER TABLE "shops" ADD COLUMN "pos_type" TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE "shops" ADD COLUMN "pos_webhook_url" TEXT;

CREATE UNIQUE INDEX "shops_pos_api_key_key" ON "shops"("pos_api_key");
