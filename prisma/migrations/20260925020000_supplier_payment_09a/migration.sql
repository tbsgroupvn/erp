-- #09a đợt 1 (25/09/2026) — Phiếu thanh toán NCC, Task 1: model + migration ONLY.
-- Chép cột-đối-cột prod tbl_payment/tbl_payment_orders/tbl_payment_log/tbl_payment_source
-- (đo information_schema 24/09/2026, docs/rewrite-spec/09a-thanh-toan-ncc.md §2/§8,
-- docs/rewrite-spec/migration/09a-thanh-toan-ncc.md). 0 DROP — chỉ thêm bảng/enum/index mới,
-- không đụng schema hiện có. Sinh bằng `prisma migrate diff` trên shadow DB scratch riêng
-- (tbs_shadow_09a, tạo và xoá ngay sau khi lấy diff — không đụng tbs_test).

-- CreateEnum
CREATE TYPE "PaymentCurrency" AS ENUM ('CNY', 'USD');

-- CreateEnum
CREATE TYPE "SupplierPaymentLogAction" AS ENUM ('rollback', 'edit', 'delete', 'doc_return', 'doc_resubmit', 'doc_chan_truong');

-- CreateTable
CREATE TABLE "tbl_payment" (
    "id" SERIAL NOT NULL,
    "cdate" INTEGER,
    "mdate" INTEGER,
    "price_cyn" DECIMAL(18,2),
    "currency" "PaymentCurrency" NOT NULL DEFAULT 'CNY',
    "rate_buy" INTEGER,
    "saler" VARCHAR(50),
    "from" VARCHAR(50),
    "source" VARCHAR(50),
    "code_order" VARCHAR(255),
    "order_id" INTEGER,
    "note" VARCHAR(255),
    "note_payment" TEXT,
    "price_payment" DECIMAL(18,2),
    "payment" VARCHAR(3) DEFAULT 'no',
    "pdate" INTEGER,
    "status" VARCHAR(3) DEFAULT 'no',
    "confirm" VARCHAR(3) DEFAULT 'no',
    "po_id" INTEGER NOT NULL DEFAULT 0,
    "pay_type" VARCHAR(20) NOT NULL DEFAULT '',
    "bill_images" TEXT,
    "account_code" VARCHAR(10) NOT NULL DEFAULT '',
    "ncc_receiver" VARCHAR(150) NOT NULL DEFAULT '',
    "ncc_bank_name" VARCHAR(150) NOT NULL DEFAULT '',
    "ncc_bank_account" VARCHAR(80) NOT NULL DEFAULT '',
    "ncc_qr_image" VARCHAR(255) NOT NULL DEFAULT '',
    "ncc_bank_note" VARCHAR(255),
    "ncc_pay_channel" VARCHAR(20) NOT NULL DEFAULT 'bank',
    "ncc_platform_order" VARCHAR(255) NOT NULL DEFAULT '',
    "ncc_invoice_images" TEXT,
    "ncc_packing_list_images" TEXT,
    "kt_note" TEXT,
    "tt_ngoai_kieu" VARCHAR(20) NOT NULL DEFAULT '',

    CONSTRAINT "tbl_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_payment_orders" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "rmb" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "cdate" INTEGER NOT NULL DEFAULT 0,
    "prev_fund" DECIMAL(18,2),
    "prev_rate" DECIMAL(18,2),

    CONSTRAINT "tbl_payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_payment_log" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "action" "SupplierPaymentLogAction" NOT NULL,
    "old_data" TEXT,
    "new_data" TEXT,
    "note" VARCHAR(255),
    "created_by" VARCHAR(50),
    "cdate" INTEGER,

    CONSTRAINT "tbl_payment_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_payment_source" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tk_code" VARCHAR(10),
    "sort_order" INTEGER DEFAULT 0,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_payment_source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tbl_payment_po_id_idx" ON "tbl_payment"("po_id");

-- CreateIndex
CREATE INDEX "tbl_payment_account_code_idx" ON "tbl_payment"("account_code");

-- CreateIndex
CREATE INDEX "tbl_payment_order_id_idx" ON "tbl_payment"("order_id");

-- CreateIndex
CREATE INDEX "tbl_payment_orders_order_id_idx" ON "tbl_payment_orders"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_pay_order" ON "tbl_payment_orders"("payment_id", "order_id");

-- CreateIndex
CREATE INDEX "tbl_payment_log_payment_id_idx" ON "tbl_payment_log"("payment_id");

-- AddForeignKey
ALTER TABLE "tbl_payment_orders" ADD CONSTRAINT "tbl_payment_orders_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "tbl_payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
