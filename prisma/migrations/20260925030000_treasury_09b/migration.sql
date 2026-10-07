-- CreateEnum
CREATE TYPE "FundCurrency" AS ENUM ('VND', 'CNY', 'USD');

-- CreateEnum
CREATE TYPE "FundGroup" AS ENUM ('bank', 'store');

-- CreateTable
CREATE TABLE "tbl_accounts" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "subname" VARCHAR(150) NOT NULL DEFAULT '',
    "currency" "FundCurrency" NOT NULL DEFAULT 'VND',
    "acc_group" "FundGroup" NOT NULL DEFAULT 'bank',
    "has_gout" SMALLINT NOT NULL DEFAULT 0,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" SMALLINT NOT NULL DEFAULT 1,
    "note" VARCHAR(255) NOT NULL DEFAULT '',
    "opening_balance" DECIMAL(20,5) NOT NULL DEFAULT 0,
    "stk" VARCHAR(30) NOT NULL DEFAULT '',
    "bank_code" VARCHAR(30) NOT NULL DEFAULT '',
    "wallet_stream" VARCHAR(10) NOT NULL DEFAULT 'cty',
    "custom_label" VARCHAR(50) NOT NULL DEFAULT '',
    "cdate" INTEGER NOT NULL DEFAULT 0,
    "mdate" INTEGER NOT NULL DEFAULT 0,
    "owner_uid" INTEGER DEFAULT 0,
    "gl_account" VARCHAR(20) NOT NULL DEFAULT '',
    "quy_doi_sang" VARCHAR(10) NOT NULL DEFAULT '',

    CONSTRAINT "tbl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_account_histories" (
    "id" SERIAL NOT NULL,
    "tk_code" VARCHAR(50),
    "type" VARCHAR(50),
    "bank_info" VARCHAR(50),
    "gout" VARCHAR(255),
    "wallet_detail_id" INTEGER,
    "cus_id" VARCHAR(50),
    "cdate" INTEGER,
    "cuser" VARCHAR(50),
    "money" DECIMAL(20,5),
    "rate" DECIMAL(18,6),
    "approve_user" VARCHAR(50),
    "approve_date" INTEGER,
    "note" VARCHAR(255),
    "status" SMALLINT DEFAULT 0,
    "tran_id" BIGINT,
    "trandetail_id" BIGINT,
    "source_module" VARCHAR(20) NOT NULL DEFAULT '',
    "source_id" INTEGER NOT NULL DEFAULT 0,
    "reversal_of" INTEGER NOT NULL DEFAULT 0,
    "reversal_code" VARCHAR(20) NOT NULL DEFAULT '',
    "reversal_reason" VARCHAR(255) NOT NULL DEFAULT '',
    "ref_request_id" INTEGER NOT NULL DEFAULT 0,
    "po_id" INTEGER NOT NULL DEFAULT 0,
    "container_id" INTEGER NOT NULL DEFAULT 0,
    "order_code" VARCHAR(50) NOT NULL DEFAULT '',

    CONSTRAINT "tbl_account_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_accounts_code_key" ON "tbl_accounts"("code");

-- CreateIndex
CREATE INDEX "ix_source" ON "tbl_account_histories"("source_module", "source_id");

-- CreateIndex
CREATE INDEX "tbl_account_histories_tk_code_status_idx" ON "tbl_account_histories"("tk_code", "status");

-- CreateIndex
CREATE INDEX "tbl_account_histories_reversal_of_idx" ON "tbl_account_histories"("reversal_of");

-- CreateIndex
CREATE INDEX "tbl_account_histories_ref_request_id_idx" ON "tbl_account_histories"("ref_request_id");

-- CreateIndex
CREATE INDEX "tbl_account_histories_tran_id_idx" ON "tbl_account_histories"("tran_id");

-- CreateIndex
CREATE INDEX "tbl_account_histories_wallet_detail_id_idx" ON "tbl_account_histories"("wallet_detail_id");

-- CreateIndex
CREATE INDEX "tbl_account_histories_cus_id_idx" ON "tbl_account_histories"("cus_id");

-- CreateIndex
CREATE INDEX "tbl_account_histories_po_id_idx" ON "tbl_account_histories"("po_id");

-- CreateIndex
CREATE INDEX "tbl_account_histories_container_id_idx" ON "tbl_account_histories"("container_id");

-- CreateIndex
CREATE INDEX "tbl_account_histories_order_code_idx" ON "tbl_account_histories"("order_code");

