-- Performance indexes for POS SKU sync, Telegram chat lookup, and cart joins.
CREATE INDEX IF NOT EXISTS "shops_telegram_chat_id_idx" ON "shops"("telegram_chat_id");
CREATE INDEX IF NOT EXISTS "products_shop_id_sku_idx" ON "products"("shop_id", "sku");
CREATE INDEX IF NOT EXISTS "carts_shop_id_idx" ON "carts"("shop_id");
CREATE INDEX IF NOT EXISTS "cart_items_product_id_idx" ON "cart_items"("product_id");

