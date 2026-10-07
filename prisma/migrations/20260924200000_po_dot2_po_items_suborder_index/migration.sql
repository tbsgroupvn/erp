-- #06 đợt 2, review cuối M-6: index cho tbl_po_items.suborder_id.
-- Prod có KEY `suborder_id` trên cột này (SHOW INDEX, 24/09/2026); schema
-- PoItem đã hứa "khi tính năng sinh đơn con lên nhánh, thêm index cùng lúc".
-- Viết tay từ `prisma migrate diff --from-migrations --to-schema-datamodel`
-- chạy trên shadow DB: diff chỉ gồm đúng lệnh dưới, KHÔNG có DROP nào (kể cả
-- không đụng partial index tbl_order_po_item_dedup của migration 20260924180000).
CREATE INDEX "tbl_po_items_suborder_id_idx" ON "tbl_po_items"("suborder_id");
