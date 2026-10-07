-- #04b (24/09/2026) — "trả về cho người nộp sửa" (CLS_TRAVE), Task 1.
-- Chép cột-đối-cột prod tbl_return_config / tbl_return_fields / tbl_return_state
-- (đo information_schema 24/09/2026, xem docs/rewrite-spec/04b-tra-ve-nguoi-nop-sua.md §7.1/§8.2).
-- 0 DROP — chỉ thêm bảng/enum/index mới, không đụng schema hiện có.

-- CreateEnum
CREATE TYPE "ReturnCheckpointType" AS ENUM ('approval', 'biz');

-- CreateEnum
CREATE TYPE "ReturnEditMode" AS ENUM ('off', 'all', 'whitelist');

-- CreateEnum
CREATE TYPE "ReturnStateValue" AS ENUM ('returned', 'resubmitted');

-- CreateTable
CREATE TABLE "tbl_return_config" (
    "id" SERIAL NOT NULL,
    "checkpoint_type" "ReturnCheckpointType" NOT NULL,
    "checkpoint_ref" VARCHAR(60) NOT NULL,
    "edit_mode" "ReturnEditMode" NOT NULL DEFAULT 'off',
    "require_reason" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" VARCHAR(50) DEFAULT '',
    "updated_at" INTEGER DEFAULT 0,

    CONSTRAINT "tbl_return_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_return_fields" (
    "id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL,
    "field_key" VARCHAR(60) NOT NULL,

    CONSTRAINT "tbl_return_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_return_state" (
    "id" SERIAL NOT NULL,
    "object_type" VARCHAR(30) NOT NULL,
    "object_id" INTEGER NOT NULL,
    "checkpoint_type" "ReturnCheckpointType" NOT NULL,
    "checkpoint_ref" VARCHAR(60) NOT NULL,
    "state" "ReturnStateValue" NOT NULL DEFAULT 'returned',
    "reason" VARCHAR(255) NOT NULL DEFAULT '',
    "round" SMALLINT NOT NULL DEFAULT 1,
    "fields_opened" JSONB NOT NULL,
    "data_before" JSONB,
    "data_after" JSONB,
    "returned_by" VARCHAR(50) NOT NULL,
    "returned_at" INTEGER NOT NULL,
    "resubmitted_at" INTEGER,

    CONSTRAINT "tbl_return_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_return_config_checkpoint_type_checkpoint_ref_key" ON "tbl_return_config"("checkpoint_type", "checkpoint_ref");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_return_fields_config_id_field_key_key" ON "tbl_return_fields"("config_id", "field_key");

-- CreateIndex
CREATE INDEX "tbl_return_state_state_idx" ON "tbl_return_state"("state");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_return_state_object_type_object_id_key" ON "tbl_return_state"("object_type", "object_id");

-- AddForeignKey
ALTER TABLE "tbl_return_fields" ADD CONSTRAINT "tbl_return_fields_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "tbl_return_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
