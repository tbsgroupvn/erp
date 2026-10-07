-- AlterTable
ALTER TABLE "tbl_po_receipts" ADD COLUMN     "approved_at" INTEGER,
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "bank_ref" TEXT,
ADD COLUMN     "cdate" INTEGER,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "dot" INTEGER,
ADD COLUMN     "order_id" INTEGER,
ADD COLUMN     "receipt_code" TEXT,
ADD COLUMN     "receipt_date" INTEGER;

-- CreateTable
CREATE TABLE "tbl_purchase_orders" (
    "id" SERIAL NOT NULL,
    "po_code" TEXT NOT NULL,
    "contract_id" INTEGER,
    "contract_no" TEXT,
    "buyer_id" INTEGER,
    "po_date" INTEGER,
    "currency" TEXT,
    "subtotal" DECIMAL(20,2) NOT NULL,
    "vat_amount" DECIMAL(20,2) NOT NULL,
    "total_amount" DECIMAL(20,2) NOT NULL,
    "advance_amount" DECIMAL(20,2) NOT NULL,
    "vat_rate" DECIMAL(6,2),
    "fx_rate_commit" DECIMAL(12,4),
    "payment_terms" TEXT,
    "payment_schedule" TEXT,
    "po_type" TEXT,
    "delivery_place" TEXT,
    "delivery_method" TEXT,
    "delivery_expected" TEXT,
    "delivery_deadline" TEXT,
    "shipping_mode" TEXT,
    "incoterm" TEXT,
    "incoterm_place" TEXT,
    "tax_paid_by" TEXT,
    "status" INTEGER NOT NULL DEFAULT 0,
    "submitted_by" TEXT,
    "submitted_at" INTEGER,
    "leader_by" TEXT,
    "leader_at" INTEGER,
    "tpkd_by" TEXT,
    "tpkd_at" INTEGER,
    "reject_by" TEXT,
    "reject_at" INTEGER,
    "reject_note" TEXT,
    "cancel_by" TEXT,
    "cancel_at" INTEGER,
    "cancel_note" TEXT,
    "cancel_prev_status" INTEGER,
    "payment_guaranteed" INTEGER NOT NULL DEFAULT 0,
    "credit_risk_ok" INTEGER NOT NULL DEFAULT 0,
    "credit_due_days" INTEGER,
    "declares_customs" INTEGER NOT NULL DEFAULT 0,
    "suborder_generated" INTEGER NOT NULL DEFAULT 0,
    "orders_generated" INTEGER NOT NULL DEFAULT 0,
    "assigned_to" TEXT,
    "created_by" TEXT,
    "cdate" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "tbl_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_po_items" (
    "id" SERIAL NOT NULL,
    "po_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "product_name" TEXT,
    "spec" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unit_price" DECIMAL(20,2) NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "vat_rate" DECIMAL(6,4),
    "hs_code" TEXT,
    "origin" TEXT,
    "supplier_cost_rmb" DECIMAL(65,30),
    "currency" TEXT,
    "weight_kg" DECIMAL(65,30),
    "cbm" DECIMAL(14,4),
    "ncc_id" INTEGER,
    "line_kind" TEXT,
    "quote_item_id" INTEGER,

    CONSTRAINT "tbl_po_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_purchase_orders_po_code_key" ON "tbl_purchase_orders"("po_code");

-- CreateIndex
CREATE INDEX "tbl_purchase_orders_status_idx" ON "tbl_purchase_orders"("status");

-- CreateIndex
CREATE INDEX "tbl_po_items_po_id_idx" ON "tbl_po_items"("po_id");

-- CreateIndex
CREATE INDEX "tbl_po_items_quote_item_id_idx" ON "tbl_po_items"("quote_item_id");

