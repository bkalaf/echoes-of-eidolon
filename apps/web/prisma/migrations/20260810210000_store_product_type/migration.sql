CREATE TYPE "StoreProductType" AS ENUM ('POSTER', 'MUG', 'HOODIE');

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "StoreProduct") THEN
    RAISE EXCEPTION 'StoreProduct.productType requires explicit owner mapping for existing rows';
  END IF;
END $$;

ALTER TABLE "StoreProduct" ADD COLUMN "productType" "StoreProductType" NOT NULL;
CREATE UNIQUE INDEX "StoreProduct_productType_key" ON "StoreProduct"("productType");
