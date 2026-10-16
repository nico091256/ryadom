-- Apartment details for delivery addresses
ALTER TABLE "addresses" ADD COLUMN "entrance" TEXT;
ALTER TABLE "addresses" ADD COLUMN "floor" TEXT;
ALTER TABLE "addresses" ADD COLUMN "apartment" TEXT;
ALTER TABLE "addresses" ADD COLUMN "door_code" TEXT;
