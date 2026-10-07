-- DropIndex
DROP INDEX "tbl_fee_catalog_code_key";

-- AlterTable: tbl_fee_catalog realigned to prod tbl_fee_catalog (F4).
-- Add new columns NULLABLE first, BACKFILL from the old columns (do not
-- assume the table is empty), THEN enforce NOT NULL, THEN drop the old
-- columns — avoids a blind `ADD COLUMN ... NOT NULL` that would fail/lose
-- data on any table that already has rows.
ALTER TABLE "tbl_fee_catalog"
ADD COLUMN     "applies_mode" TEXT,
ADD COLUMN     "default_included" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "default_price" DECIMAL(18,3),
ADD COLUMN     "default_unit" TEXT,
ADD COLUMN     "default_vat_pct" DECIMAL(6,4),
ADD COLUMN     "explain_vn" TEXT,
ADD COLUMN     "fee_code" TEXT,
ADD COLUMN     "isactive" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "leg" TEXT,
ADD COLUMN     "name_en" TEXT,
ADD COLUMN     "name_vn" TEXT,
ADD COLUMN     "pct_base" TEXT,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

UPDATE "tbl_fee_catalog" SET
  "fee_code" = "code",
  "name_vn" = "name",
  "default_price" = "default_unit_price",
  "isactive" = "is_active";

ALTER TABLE "tbl_fee_catalog"
ALTER COLUMN "fee_code" SET NOT NULL,
ALTER COLUMN "name_vn" SET NOT NULL,
DROP COLUMN "code",
DROP COLUMN "default_unit_price",
DROP COLUMN "is_active",
DROP COLUMN "name";

-- AlterTable
ALTER TABLE "tbl_quote_fees" DROP COLUMN "unit_price_2",
ADD COLUMN     "unit_price2" DECIMAL(18,3);

-- AlterTable
ALTER TABLE "tbl_quote_items" ADD COLUMN     "antidumping_expire" DATE,
ADD COLUMN     "detail_auto" VARCHAR(1000),
ALTER COLUMN "cbm" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "amount_rmb" SET DATA TYPE DECIMAL(16,4);

-- AlterTable
ALTER TABLE "tbl_quotes" ADD COLUMN     "delivery_deadline" VARCHAR(255),
ADD COLUMN     "delivery_expected" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_fee_catalog_fee_code_key" ON "tbl_fee_catalog"("fee_code");
