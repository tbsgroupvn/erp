-- #06 đợt 2 (24/09/2026) — Task 1: hai bảng MỚI hoàn toàn, `PoSuborder`
-- (tbl_po_suborders) và `Order` (tbl_order, phạm vi order_type=1).
--
-- ════════════════════════════════════════════════════════════════════════
-- 1. Quy trình đo + sinh diff (đúng luật CLAUDE.md — tbs_test DÙNG CHUNG,
--    không bao giờ migrate dev/reset/db push trên nó)
-- ════════════════════════════════════════════════════════════════════════
-- a) Đo prod `sql_nhpcn` qua SSH read-only 24/09/2026:
--      SHOW COLUMNS FROM tbl_po_suborders   -- 13/13 cột
--      SHOW COLUMNS FROM tbl_order          -- 68/68 cột (information_schema
--                                              xác nhận COUNT=68)
--    So THEO TÊN, không đếm số — xem task-1-report.md phần "hai danh sách
--    hiệu" để tránh đúng bẫy #08 (một cột ma bù một cột thiếu, đếm vẫn khớp).
-- b) Tạo shadow DB DÙNG MỘT LẦN (không phải tbs_test):
--      CREATE DATABASE tbs_shadow_po_dot2;
-- c) npx prisma migrate diff --from-url $TBS_TEST \
--      --to-schema-datamodel prisma/schema.prisma \
--      --shadow-database-url postgresql://.../tbs_shadow_po_dot2 --script
-- d) ĐỌC HẾT SQL sinh ra (dán nguyên văn bên dưới) — đây là HAI BẢNG MỚI
--    HOÀN TOÀN, không có ALTER/DROP COLUMN nào trên bảng đã tồn tại, nên
--    KHÔNG dính bẫy "DROP COLUMN + ADD COLUMN đổi kiểu = xoá dữ liệu" đã ăn
--    #06 đợt 1 / #08. Lấy nguyên xi là AN TOÀN ở đợt này.
-- e) DROP DATABASE tbs_shadow_po_dot2; (đã dọn, không còn shadow sống sót)
--
-- ════════════════════════════════════════════════════════════════════════
-- 2. Phạm vi CỐ Ý hẹp của `tbl_order` — đọc trước khi thêm cột vào bảng này
-- ════════════════════════════════════════════════════════════════════════
-- prod `tbl_order` có 68 cột / 48.057 dòng, nhưng đợt này CHỈ phục vụ đường
-- order_type=1 (1.259/48.057 — sinh từ PO qua `createOrdersPerItem`,
-- libs/cls.po.php:481-548, đo trực tiếp trên file prod). Bảng Postgres này
-- chỉ có 31 cột (30 cột hàm trên ghi khi INSERT + `id`) — KHÔNG phải 68.
-- 37 cột còn lại (đơn thủ công order_type=0, COGS, khiếu nại, kho vận đơn
-- cũ…) NGOÀI PHẠM VI, liệt kê đủ trong comment tại `model Order` của
-- schema.prisma. Mở bảng này rộng ra là việc của đợt sau, không phải đợt
-- này — thêm cột không đo lại từng cột là lặp đúng bẫy đã cảnh báo ở trên.
--
-- ════════════════════════════════════════════════════════════════════════
-- 3. Cột thời gian — đo TỪNG cột, không suy theo hàng xóm (bẫy #08)
-- ════════════════════════════════════════════════════════════════════════
-- tbl_po_suborders.cdate: int(11) — epoch giây. tbl_order.cdate/mdate:
-- int(11) — epoch giây (PHP time()). Cả ba đo riêng qua SHOW COLUMNS, không
-- suy vì đứng cạnh cột datetime khác. tbl_po_suborders.sub_date: DATE thật
-- (không phải epoch) — theo luật zero-date '0000-00-00' ⇒ NULL như
-- PurchaseOrder.poDate (#06 đợt 1, F3), KHÔNG dựng epoch/ngày tính toán.
-- tbl_order.cogs_locked_at (datetime thật, đo riêng) KHÔNG nằm trong 31 cột
-- ở đây — nó thuộc 37 cột ngoài phạm vi, không phải bị nhầm với cdate/mdate.
--
-- ════════════════════════════════════════════════════════════════════════
-- 4. SQL — nguyên văn từ `prisma migrate diff --script` bước (c), không sửa
-- ════════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "OrderCurrency" AS ENUM ('CNY', 'USD');

-- CreateTable
CREATE TABLE "tbl_po_suborders" (
    "id" SERIAL NOT NULL,
    "po_id" INTEGER DEFAULT 0,
    "sub_code" VARCHAR(40),
    "title" TEXT,
    "sub_date" DATE,
    "status" INTEGER DEFAULT 0,
    "subtotal" DECIMAL(18,2) DEFAULT 0.00,
    "total_items" INTEGER DEFAULT 0,
    "sort_order" INTEGER DEFAULT 0,
    "notes" VARCHAR(500),
    "created_by" VARCHAR(50),
    "cdate" INTEGER DEFAULT 0,
    "order_id" INTEGER DEFAULT 0,

    CONSTRAINT "tbl_po_suborders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_order" (
    "id" BIGSERIAL NOT NULL,
    "oid" VARCHAR(100),
    "shop" TEXT,
    "sku" TEXT,
    "cus_id" VARCHAR(100),
    "cus_info" TEXT,
    "pro_id" TEXT,
    "pro_info" TEXT,
    "detail_info" TEXT,
    "code_order" TEXT,
    "price_cyn" DECIMAL(65,4),
    "fee_ship" DECIMAL(65,3) DEFAULT 0.000,
    "price_vn" BIGINT,
    "rate_sell" INTEGER DEFAULT 3500,
    "quan" DECIMAL(14,2),
    "cdate" INTEGER,
    "mdate" INTEGER,
    "saler" VARCHAR(50),
    "store" VARCHAR(50),
    "notes" TEXT,
    "order_type" INTEGER DEFAULT 0,
    "isactive" INTEGER DEFAULT 0,
    "po_id" INTEGER DEFAULT 0,
    "po_suborder_id" INTEGER DEFAULT 0,
    "po_item_id" INTEGER NOT NULL DEFAULT 0,
    "supplier_cost_rmb" DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    "currency" "OrderCurrency" NOT NULL DEFAULT 'CNY',
    "ncc_id" INTEGER DEFAULT 0,

    CONSTRAINT "tbl_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tbl_po_suborders_po_id_idx" ON "tbl_po_suborders"("po_id");

-- CreateIndex
CREATE INDEX "tbl_order_cus_id_idx" ON "tbl_order"("cus_id");

-- CreateIndex
CREATE INDEX "tbl_order_code_order_idx" ON "tbl_order"("code_order");

-- CreateIndex
CREATE INDEX "tbl_order_po_id_idx" ON "tbl_order"("po_id");

-- CreateIndex
CREATE INDEX "tbl_order_po_suborder_id_idx" ON "tbl_order"("po_suborder_id");

-- CreateIndex
CREATE INDEX "tbl_order_po_item_id_idx" ON "tbl_order"("po_item_id");
