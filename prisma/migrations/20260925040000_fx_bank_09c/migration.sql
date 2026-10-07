-- #09c L1 — FX transfer + bank cash book (model-only). Đặc tả 09c-fx-ngan-hang.md §2/§9/§12.
-- Q-BANK-1/2: index THƯỜNG chép prod (KHÔNG UNIQUE một phần) — chốt trong plan header.

-- CreateEnum
CREATE TYPE "BankChiMatchMethod" AS ENUM ('auto', 'manual');

-- CreateTable
CREATE TABLE "tbl_fx_transfers" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "from_tk" VARCHAR(10) NOT NULL,
    "to_tk" VARCHAR(10) NOT NULL,
    "from_currency" VARCHAR(5) NOT NULL DEFAULT 'VND',
    "to_currency" VARCHAR(5) NOT NULL DEFAULT 'VND',
    "amount_out" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "amount_in" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "rate" DECIMAL(15,6) NOT NULL DEFAULT 1,
    "rate_system" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fee_currency" VARCHAR(10),
    "fee_percent" DECIMAL(6,3),
    "po_id" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "approval_request_id" INTEGER NOT NULL DEFAULT 0,
    "created_by" VARCHAR(50) NOT NULL DEFAULT '',
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "approved_by" VARCHAR(50) NOT NULL DEFAULT '',
    "approved_at" INTEGER NOT NULL DEFAULT 0,
    "reversed_by" VARCHAR(50) NOT NULL DEFAULT '',
    "reversed_at" INTEGER NOT NULL DEFAULT 0,
    "reverse_of" INTEGER NOT NULL DEFAULT 0,
    "bank_tran_id" BIGINT NOT NULL DEFAULT 0,
    "agent_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "agent_tk" VARCHAR(10) NOT NULL DEFAULT '',
    "agent_amount" DECIMAL(18,5) NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_fx_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_fx_adjustments" (
    "id" SERIAL NOT NULL,
    "fx_id" INTEGER NOT NULL,
    "request_id" INTEGER NOT NULL DEFAULT 0,
    "old_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "old_out" DECIMAL(20,5) NOT NULL DEFAULT 0,
    "old_in" DECIMAL(20,5) NOT NULL DEFAULT 0,
    "old_fee" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "old_fee_cur" VARCHAR(3),
    "new_rate" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "new_out" DECIMAL(20,5) NOT NULL DEFAULT 0,
    "new_in" DECIMAL(20,5) NOT NULL DEFAULT 0,
    "new_fee" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "new_fee_cur" VARCHAR(3),
    "delta_out" DECIMAL(20,5) NOT NULL DEFAULT 0,
    "delta_in" DECIMAL(20,5) NOT NULL DEFAULT 0,
    "delta_fee" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "hist_ids" VARCHAR(255),
    "reason" VARCHAR(255) NOT NULL,
    "cuser" VARCHAR(50) NOT NULL,
    "cdate" INTEGER NOT NULL,

    CONSTRAINT "tbl_fx_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_fx_fee_rates" (
    "id" SERIAL NOT NULL,
    "from_cur" VARCHAR(3) NOT NULL,
    "to_cur" VARCHAR(3) NOT NULL,
    "fee_percent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "updated_by" VARCHAR(50),
    "updated_at" INTEGER,

    CONSTRAINT "tbl_fx_fee_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_account_changelog" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL DEFAULT 0,
    "account_code" VARCHAR(10) NOT NULL DEFAULT '',
    "action" VARCHAR(30) NOT NULL DEFAULT '',
    "changes" TEXT,
    "user_id" INTEGER NOT NULL DEFAULT 0,
    "user_name" VARCHAR(80) NOT NULL DEFAULT '',
    "created_at" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_account_changelog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_bank_transaction" (
    "id" BIGSERIAL NOT NULL,
    "bankid" VARCHAR(10) NOT NULL,
    "bank_name" VARCHAR(50),
    "bank_account" VARCHAR(20),
    "tran_type" VARCHAR(1),
    "tran_amount" BIGINT,
    "tran_time" BIGINT,
    "tran_mess" TEXT,
    "origin_mess" TEXT,
    "cus_id" VARCHAR(50),
    "type" VARCHAR(3) DEFAULT '1',
    "cdate" INTEGER,
    "mdate" INTEGER,
    "status" VARCHAR(3) DEFAULT 'no',
    "confirm" VARCHAR(3) DEFAULT 'no',
    "tk_code" VARCHAR(10) NOT NULL DEFAULT '',

    CONSTRAINT "tbl_bank_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_bank_transaction_detail" (
    "id" BIGSERIAL NOT NULL,
    "tran_id" BIGINT,
    "type" VARCHAR(3),
    "money" BIGINT,
    "cus_id" VARCHAR(50),
    "pay_info" VARCHAR(100),
    "note" VARCHAR(255),
    "author" VARCHAR(50),
    "cdate" INTEGER,
    "mdate" INTEGER,
    "confirm" VARCHAR(3) DEFAULT 'no',
    "po_id" INTEGER NOT NULL DEFAULT 0,
    "wallet_stream" VARCHAR(10),

    CONSTRAINT "tbl_bank_transaction_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_bank_chi_match" (
    "id" SERIAL NOT NULL,
    "bank_tx_id" BIGINT NOT NULL,
    "request_id" INTEGER NOT NULL,
    "method" "BankChiMatchMethod" NOT NULL DEFAULT 'manual',
    "matched_by" VARCHAR(50) NOT NULL,
    "matched_at" INTEGER NOT NULL,
    "unmatched_at" INTEGER,
    "unmatched_by" VARCHAR(50),
    "note" VARCHAR(255) NOT NULL DEFAULT '',

    CONSTRAINT "tbl_bank_chi_match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_bank_reconcile_link" (
    "id" SERIAL NOT NULL,
    "bank_tran_id" BIGINT NOT NULL,
    "doc_module" VARCHAR(20) NOT NULL DEFAULT '',
    "doc_id" INTEGER NOT NULL DEFAULT 0,
    "match_type" VARCHAR(10) NOT NULL DEFAULT 'manual',
    "note" VARCHAR(255) NOT NULL DEFAULT '',
    "cuser" VARCHAR(50) NOT NULL DEFAULT '',
    "cdate" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_bank_reconcile_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_fx_transfers_code_key" ON "tbl_fx_transfers"("code");

-- CreateIndex
CREATE INDEX "idx_approval" ON "tbl_fx_transfers"("approval_request_id");

-- CreateIndex
CREATE INDEX "idx_fx_created" ON "tbl_fx_transfers"("created_at");

-- CreateIndex
CREATE INDEX "idx_from_tk" ON "tbl_fx_transfers"("from_tk");

-- CreateIndex
CREATE INDEX "idx_to_tk" ON "tbl_fx_transfers"("to_tk");

-- CreateIndex
CREATE INDEX "idx_status" ON "tbl_fx_transfers"("status");

-- CreateIndex
CREATE INDEX "idx_fx" ON "tbl_fx_adjustments"("fx_id");

-- CreateIndex
CREATE INDEX "idx_req" ON "tbl_fx_adjustments"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_pair" ON "tbl_fx_fee_rates"("from_cur", "to_cur");

-- CreateIndex
CREATE INDEX "idx_account" ON "tbl_account_changelog"("account_code");

-- CreateIndex
CREATE INDEX "idx_changelog_created" ON "tbl_account_changelog"("created_at");

-- CreateIndex
CREATE INDEX "idx_confirm" ON "tbl_bank_transaction"("confirm");

-- CreateIndex
CREATE INDEX "idx_cus_id" ON "tbl_bank_transaction"("cus_id");

-- CreateIndex
CREATE INDEX "tbl_bank_transaction_bankid_idx" ON "tbl_bank_transaction"("bankid");

-- CreateIndex
CREATE INDEX "tbl_bank_transaction_tk_code_tran_type_idx" ON "tbl_bank_transaction"("tk_code", "tran_type");

-- CreateIndex
CREATE INDEX "tbl_bank_transaction_detail_tran_id_idx" ON "tbl_bank_transaction_detail"("tran_id");

-- CreateIndex
CREATE INDEX "idx_request" ON "tbl_bank_chi_match"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_banktx_active" ON "tbl_bank_chi_match"("bank_tx_id", "unmatched_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_bank" ON "tbl_bank_reconcile_link"("bank_tran_id");

-- CreateIndex
CREATE INDEX "idx_doc" ON "tbl_bank_reconcile_link"("doc_module", "doc_id");

