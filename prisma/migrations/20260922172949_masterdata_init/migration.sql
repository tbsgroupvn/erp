-- CreateEnum
CREATE TYPE "KhoLoai" AS ENUM ('VN', 'TQ');

-- CreateTable
CREATE TABLE "tbl_customer" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "company_name_vn" VARCHAR(255),
    "tax_code" VARCHAR(50),
    "group_code" VARCHAR(50),
    "phone" VARCHAR(50),
    "email" VARCHAR(150),
    "address" TEXT,
    "bank_name" VARCHAR(150),
    "bank_account" VARCHAR(80),
    "username" VARCHAR(50),
    "password" VARCHAR(255),
    "saler" VARCHAR(50),
    "saler_other" TEXT,
    "source" INTEGER NOT NULL DEFAULT 0,
    "is_new" INTEGER NOT NULL DEFAULT 1,
    "credit_limit" BIGINT NOT NULL DEFAULT 0,
    "credit_days" INTEGER NOT NULL DEFAULT 0,
    "credit_at" INTEGER,
    "credit_by" VARCHAR(50),
    "type" INTEGER NOT NULL DEFAULT 1,
    "author" VARCHAR(50),
    "cdate" INTEGER NOT NULL,
    "mdate" INTEGER NOT NULL,
    "isactive" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tbl_customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_customer_group" (
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "author" VARCHAR(50) NOT NULL DEFAULT '',
    "cdate" INTEGER NOT NULL DEFAULT 0,
    "mdate" INTEGER,
    "isactive" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tbl_customer_group_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "tbl_kho" (
    "ma" VARCHAR(24) NOT NULL,
    "ten" VARCHAR(100) NOT NULL,
    "loai" "KhoLoai" NOT NULL DEFAULT 'VN',
    "dia_chi" VARCHAR(255),
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isactive" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tbl_kho_pkey" PRIMARY KEY ("ma")
);

-- CreateTable
CREATE TABLE "tbl_chiphi_group" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(100),
    "name" VARCHAR(100),
    "gl_account_code" VARCHAR(20),
    "status" VARCHAR(3) NOT NULL DEFAULT 'yes',
    "author" VARCHAR(100),
    "cdate" INTEGER,
    "mdate" INTEGER,

    CONSTRAINT "tbl_chiphi_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_crm_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 1,
    "created_at" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_crm_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_ncc" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" VARCHAR(255),
    "region" VARCHAR(100),
    "receiver_name" VARCHAR(150),
    "bank_name" VARCHAR(150),
    "bank_account" VARCHAR(80),
    "sale_username" VARCHAR(50),
    "is_active" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tbl_ncc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_ncc_pay_info" (
    "id" SERIAL NOT NULL,
    "bank_account" VARCHAR(80) NOT NULL,
    "receiver_name" VARCHAR(150) NOT NULL DEFAULT '',
    "bank_name" VARCHAR(150) NOT NULL DEFAULT '',
    "qr_image" VARCHAR(255) NOT NULL DEFAULT '',
    "note" VARCHAR(255) NOT NULL DEFAULT '',
    "times_used" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" INTEGER NOT NULL DEFAULT 0,
    "created_by" VARCHAR(50) NOT NULL DEFAULT '',

    CONSTRAINT "tbl_ncc_pay_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_ncc_vn" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "tax_code" VARCHAR(50),
    "loai_dichvu" VARCHAR(100),
    "bank_name" VARCHAR(150),
    "bank_account" VARCHAR(80),
    "credit_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tbl_ncc_vn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_customer_code_key" ON "tbl_customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_customer_username_key" ON "tbl_customer"("username");

-- CreateIndex
CREATE INDEX "tbl_customer_saler_idx" ON "tbl_customer"("saler");

-- CreateIndex
CREATE INDEX "tbl_ncc_sale_username_idx" ON "tbl_ncc"("sale_username");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_ncc_pay_info_bank_account_key" ON "tbl_ncc_pay_info"("bank_account");
