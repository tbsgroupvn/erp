-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('tra_truoc', 'cong_no');

-- CreateTable
CREATE TABLE "tbl_quotes" (
    "id" SERIAL NOT NULL,
    "quote_code" TEXT NOT NULL,
    "buyer_id" INTEGER,
    "lead_id" INTEGER,
    "prospect_name" TEXT,
    "prospect_phone" TEXT,
    "prospect_tax" TEXT,
    "prospect_address" TEXT,
    "rate_rmb_vnd" DECIMAL(12,4) NOT NULL,
    "rate_usd_vnd" DECIMAL(12,4) NOT NULL,
    "rate_cny_usd" DECIMAL(12,4) NOT NULL,
    "fx_buffer_pct" DECIMAL(6,2) NOT NULL,
    "entrust_fee_pct" DECIMAL(8,6) NOT NULL,
    "deposit_pct" DECIMAL(5,2),
    "margin_pct" DECIMAL(5,2),
    "freight_vn_per_kg" DECIMAL(14,2) NOT NULL,
    "freight_vn_per_cbm" DECIMAL(14,2) NOT NULL,
    "entrust_base" TEXT,
    "deposit_vnd" DECIMAL(20,2),
    "currency_mode" TEXT,
    "vat_base_full" INTEGER NOT NULL DEFAULT 0,
    "vat_excl_service" INTEGER NOT NULL DEFAULT 0,
    "decl_usd_canonical" INTEGER NOT NULL DEFAULT 0,
    "print_explain" INTEGER NOT NULL DEFAULT 0,
    "shipping_mode" TEXT,
    "incoterm" TEXT,
    "incoterm_place" TEXT,
    "declarant" TEXT,
    "payment_mode" "PaymentMode" NOT NULL,
    "status" INTEGER NOT NULL,
    "po_id" INTEGER,
    "approval_status" INTEGER NOT NULL DEFAULT 0,
    "approval_by" TEXT,
    "approval_note" TEXT,
    "approval_at" INTEGER,
    "created_by" TEXT,
    "cdate" INTEGER NOT NULL,

    CONSTRAINT "tbl_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_quote_items" (
    "id" SERIAL NOT NULL,
    "quote_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "product_url" TEXT,
    "image_url" TEXT,
    "origin" TEXT,
    "model" TEXT,
    "hs_code" TEXT,
    "name_vn" TEXT,
    "size" TEXT,
    "material" TEXT,
    "spec_params" TEXT,
    "unit" TEXT,
    "pack_l_cm" DECIMAL(10,2),
    "pack_w_cm" DECIMAL(10,2),
    "pack_h_cm" DECIMAL(10,2),
    "pack_boxes" INTEGER,
    "weight_mode" TEXT,
    "ship_by" TEXT,
    "qty" DECIMAL(14,2) NOT NULL,
    "weight_kg" DECIMAL(14,2) NOT NULL,
    "cbm" DECIMAL(14,2) NOT NULL,
    "unit_price_rmb" DECIMAL(14,4) NOT NULL,
    "domestic_ship_rmb" DECIMAL(14,4) NOT NULL,
    "qc_cost" DECIMAL(14,4) NOT NULL,
    "other_cost" DECIMAL(14,4) NOT NULL,
    "amount_rmb" DECIMAL(14,4) NOT NULL,
    "amount_vnd" DECIMAL(20,2) NOT NULL,
    "ship_to_vn_vnd" DECIMAL(20,2) NOT NULL,
    "import_tax_pct" DECIMAL(6,4) NOT NULL,
    "consumption_tax_pct" DECIMAL(6,4) NOT NULL,
    "antidumping_pct" DECIMAL(6,4) NOT NULL,
    "vat_pct" DECIMAL(6,4) NOT NULL,
    "envtax_amount" DECIMAL(14,2) NOT NULL,
    "import_fee_vnd" DECIMAL(20,2) NOT NULL,
    "consumption_tax_vnd" DECIMAL(20,2) NOT NULL,
    "antidumping_vnd" DECIMAL(20,2) NOT NULL,
    "envtax_vnd" DECIMAL(20,2) NOT NULL,
    "vat_amount" DECIMAL(20,2) NOT NULL,
    "entrust_fee_vnd" DECIMAL(20,2) NOT NULL,
    "fx_buffer_vnd" DECIMAL(20,2) NOT NULL,
    "total_vnd" DECIMAL(20,2) NOT NULL,
    "unit_price_vnd" DECIMAL(20,2) NOT NULL,
    "unit_price_novat_vnd" DECIMAL(20,2) NOT NULL,
    "base_invoice" DECIMAL(20,2) NOT NULL,
    "vat_invoice" DECIMAL(20,2) NOT NULL,
    "customs_declared_usd" DECIMAL(14,4),
    "declared_price_usd" DECIMAL(14,4),
    "import_label_text" TEXT,

    CONSTRAINT "tbl_quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_quote_fees" (
    "id" SERIAL NOT NULL,
    "quote_id" INTEGER NOT NULL,
    "catalog_id" INTEGER,
    "fee_code" TEXT,
    "fee_name" TEXT,
    "leg" TEXT,
    "basis" TEXT,
    "pct_base" TEXT,
    "unit" TEXT,
    "qty" DECIMAL(14,4) NOT NULL,
    "qty2" DECIMAL(14,4),
    "pct" DECIMAL(8,4),
    "unit_price" DECIMAL(18,3) NOT NULL,
    "unit_price_2" DECIMAL(18,3),
    "amount_novat" DECIMAL(18,3) NOT NULL,
    "vat_pct" DECIMAL(6,4) NOT NULL,
    "vat_amount" DECIMAL(18,3) NOT NULL,
    "amount_total" DECIMAL(18,3) NOT NULL,
    "included" INTEGER NOT NULL DEFAULT 1,
    "formula_text" TEXT,
    "explain_text" TEXT,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_quote_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_fee_catalog" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basis" TEXT,
    "default_unit_price" DECIMAL(18,3),
    "is_active" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tbl_fee_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_quotes_quote_code_key" ON "tbl_quotes"("quote_code");

-- CreateIndex
CREATE INDEX "tbl_quotes_buyer_id_idx" ON "tbl_quotes"("buyer_id");

-- CreateIndex
CREATE INDEX "tbl_quotes_created_by_idx" ON "tbl_quotes"("created_by");

-- CreateIndex
CREATE INDEX "tbl_quotes_status_idx" ON "tbl_quotes"("status");

-- CreateIndex
CREATE INDEX "tbl_quote_items_quote_id_idx" ON "tbl_quote_items"("quote_id");

-- CreateIndex
CREATE INDEX "tbl_quote_fees_quote_id_idx" ON "tbl_quote_fees"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_fee_catalog_code_key" ON "tbl_fee_catalog"("code");

-- AddForeignKey
ALTER TABLE "tbl_quote_items" ADD CONSTRAINT "tbl_quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "tbl_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_quote_fees" ADD CONSTRAINT "tbl_quote_fees_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "tbl_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

