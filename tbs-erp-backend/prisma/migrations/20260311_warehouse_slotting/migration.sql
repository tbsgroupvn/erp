-- ============================================================
-- Migration: 20260311_warehouse_slotting
-- Mo ta: Them bang storage_bins de quan ly vi tri luu tru kien
--        hang theo phan loai ABC (Warehouse Slotting feature)
-- ============================================================

CREATE TABLE "storage_bins" (
    "id"             TEXT NOT NULL,
    "code"           TEXT NOT NULL,
    "zone"           TEXT NOT NULL,
    "aisle"          TEXT NOT NULL,
    "shelf"          TEXT NOT NULL,
    "position"       TEXT,
    "max_weight"     DECIMAL(10,2),
    "max_volume"     DECIMAL(10,4),
    "current_weight" DECIMAL(10,2)    NOT NULL DEFAULT 0,
    "current_volume" DECIMAL(10,4)    NOT NULL DEFAULT 0,
    "abc_class"      TEXT             NOT NULL DEFAULT 'C',
    "frequency"      INTEGER          NOT NULL DEFAULT 0,
    "is_occupied"    BOOLEAN          NOT NULL DEFAULT false,
    "is_active"      BOOLEAN          NOT NULL DEFAULT true,
    "package_id"     TEXT,
    "warehouse"      TEXT             NOT NULL DEFAULT 'CN',
    "created_at"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "storage_bins_pkey" PRIMARY KEY ("id")
);

-- Unique constraint tren code o hang
CREATE UNIQUE INDEX "storage_bins_code_key" ON "storage_bins"("code");

-- Index tim kiem theo zone (A/B/C)
CREATE INDEX "storage_bins_zone_idx" ON "storage_bins"("zone");

-- Index phan loai ABC de goi y o hang nhanh
CREATE INDEX "storage_bins_abc_class_idx" ON "storage_bins"("abc_class");

-- Index loc o hang trong/da co kien
CREATE INDEX "storage_bins_is_occupied_idx" ON "storage_bins"("is_occupied");

-- Index loc theo kho (CN/VN)
CREATE INDEX "storage_bins_warehouse_idx" ON "storage_bins"("warehouse");

-- Index tra cuu kien hang dang o trong o nao
CREATE INDEX "storage_bins_package_id_idx" ON "storage_bins"("package_id");

-- Them comment mo ta bang
COMMENT ON TABLE "storage_bins" IS 'Quan ly vi tri luu tru kien hang theo phan loai ABC tai kho TQ va kho VN';
COMMENT ON COLUMN "storage_bins"."code"         IS 'Ma o hang, vd: A-01-03 (khu-hang-o)';
COMMENT ON COLUMN "storage_bins"."zone"         IS 'Khu vuc: A (gan cua, tan suat cao), B (trung binh), C (xa cua, tan suat thap)';
COMMENT ON COLUMN "storage_bins"."aisle"        IS 'So hang trong khu vuc (01, 02, ...)';
COMMENT ON COLUMN "storage_bins"."shelf"        IS 'So tang/gia (01, 02, ...)';
COMMENT ON COLUMN "storage_bins"."position"     IS 'Vi tri chi tiet trong tang (tuy chon)';
COMMENT ON COLUMN "storage_bins"."max_weight"   IS 'Trong luong toi da o hang co the chua (kg)';
COMMENT ON COLUMN "storage_bins"."max_volume"   IS 'The tich toi da o hang co the chua (m3)';
COMMENT ON COLUMN "storage_bins"."current_weight" IS 'Trong luong kien hang hien tai dang duoc luu (kg)';
COMMENT ON COLUMN "storage_bins"."current_volume" IS 'The tich kien hang hien tai dang duoc luu (m3)';
COMMENT ON COLUMN "storage_bins"."abc_class"    IS 'Phan loai ABC: A=tan suat cao, B=trung binh, C=thap';
COMMENT ON COLUMN "storage_bins"."frequency"    IS 'So lan xuat/nhap kien trong 30 ngay gan nhat';
COMMENT ON COLUMN "storage_bins"."is_occupied"  IS 'O hang dang co kien (true) hay trong (false)';
COMMENT ON COLUMN "storage_bins"."is_active"    IS 'O hang dang hoat dong (true) hay da vo hieu hoa';
COMMENT ON COLUMN "storage_bins"."package_id"   IS 'ID kien hang dang duoc luu trong o nay';
COMMENT ON COLUMN "storage_bins"."warehouse"    IS 'Kho: CN (Trung Quoc) hoac VN (Viet Nam)';
