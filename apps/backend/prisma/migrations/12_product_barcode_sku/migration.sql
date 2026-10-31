-- Scanner / POS identifiers. The barcode is unique per shop (the same EAN is sold by many shops);
-- NULLs are not compared by the unique index, so products without a barcode never collide.
ALTER TABLE "products" ADD COLUMN "barcode" TEXT;
ALTER TABLE "products" ADD COLUMN "sku" TEXT;

CREATE UNIQUE INDEX "products_shop_id_barcode_key" ON "products"("shop_id", "barcode");
