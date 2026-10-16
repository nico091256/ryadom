-- Customer ratings for delivered orders (1–5 stars + optional comment), one per order.
CREATE TABLE "order_reviews" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_reviews_order_id_key" ON "order_reviews"("order_id");
CREATE INDEX "order_reviews_customer_id_idx" ON "order_reviews"("customer_id");

ALTER TABLE "order_reviews"
    ADD CONSTRAINT "order_reviews_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_reviews"
    ADD CONSTRAINT "order_reviews_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
