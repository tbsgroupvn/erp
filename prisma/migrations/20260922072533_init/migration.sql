-- CreateTable
CREATE TABLE "tbl_wallet" (
    "id" BIGSERIAL NOT NULL,
    "cus_id" TEXT NOT NULL,
    "total" BIGINT NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tbl_wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_wallet_detail" (
    "id" BIGSERIAL NOT NULL,
    "type" INTEGER NOT NULL,
    "account_type" TEXT NOT NULL DEFAULT 'cty',
    "cus_id" TEXT NOT NULL,
    "oid" INTEGER,
    "money" BIGINT NOT NULL,
    "pay_info" TEXT,
    "pay_from" TEXT,
    "note" TEXT,
    "cdate" INTEGER NOT NULL,
    "author" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "po_id" INTEGER,
    "settled" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_wallet_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_gl_account" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_code" TEXT,
    "nature" TEXT NOT NULL,
    "is_leaf" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "require_partner" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tbl_gl_account_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "tbl_gl_entry" (
    "id" SERIAL NOT NULL,
    "entry_no" TEXT NOT NULL,
    "entry_date" INTEGER NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" INTEGER NOT NULL,
    "description" TEXT,
    "total_debit" DECIMAL(20,2) NOT NULL,
    "total_credit" DECIMAL(20,2) NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "reversal_of" INTEGER,
    "created_by" TEXT,
    "cdate" INTEGER NOT NULL,

    CONSTRAINT "tbl_gl_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_gl_line" (
    "id" SERIAL NOT NULL,
    "entry_id" INTEGER NOT NULL,
    "line_no" INTEGER NOT NULL,
    "account_code" TEXT NOT NULL,
    "debit" DECIMAL(20,2) NOT NULL,
    "credit" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "amount_ccy" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "fx_rate" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "cus_id" TEXT,
    "order_id" INTEGER,
    "note" TEXT,

    CONSTRAINT "tbl_gl_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_gl_mapping" (
    "id" SERIAL NOT NULL,
    "biz_type" TEXT NOT NULL,
    "biz_label" TEXT NOT NULL,
    "debit_account" TEXT NOT NULL,
    "credit_account" TEXT NOT NULL,
    "money_side" TEXT NOT NULL DEFAULT '',
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tbl_gl_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_mh_tygia" (
    "id" SERIAL NOT NULL,
    "loai" TEXT NOT NULL,
    "hang_khach" TEXT NOT NULL DEFAULT 'MAC_DINH',
    "ty_gia" DECIMAL(18,4) NOT NULL,
    "hieu_luc_tu" INTEGER NOT NULL,
    "hieu_luc_den" INTEGER,
    "nguoi_tao" TEXT,
    "created_at" INTEGER NOT NULL,

    CONSTRAINT "tbl_mh_tygia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_po_receipts" (
    "id" SERIAL NOT NULL,
    "po_id" INTEGER,
    "customer_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "alloc_request_id" INTEGER,

    CONSTRAINT "tbl_po_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_wallet_cus_id_key" ON "tbl_wallet"("cus_id");

-- CreateIndex
CREATE INDEX "tbl_wallet_detail_cus_id_idx" ON "tbl_wallet_detail"("cus_id");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_gl_entry_source_type_source_id_key" ON "tbl_gl_entry"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_gl_mapping_biz_type_key" ON "tbl_gl_mapping"("biz_type");

-- AddForeignKey
ALTER TABLE "tbl_gl_line" ADD CONSTRAINT "tbl_gl_line_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "tbl_gl_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
