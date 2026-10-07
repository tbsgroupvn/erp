-- #06 đợt 2, Task 1 — vá SÓT của chính migration trước (20260924100000).
--
-- Soát lại bằng phép "hai danh sách hiệu" (so THEO TÊN, không đếm số — đúng
-- yêu cầu Step 1 của task-1-brief.md) phát hiện: bản schema.prisma đầu tiên
-- liệt kê đủ 30 cột `createOrdersPerItem` ghi trong COMMENT, nhưng chính
-- `model Order` lại THIẾU 3 field — vat_rate/vat_amount/total_money — dù
-- comment tuyên bố "đủ 30 cột". Đây đúng là bẫy #08 đã cảnh báo (đếm khớp
-- mà tập cột khác nhau) — chỉ khác là ở đây tự phát hiện trước khi tách hai
-- danh sách ra so, không phải bị phát hiện SAU khi đã báo xong.
--
-- tbl_order.vat_rate/vat_amount/total_money đã tồn tại trên tbl_order khi
-- migration này được viết (bảng do CHÍNH migration 20260924100000 tạo, cùng
-- đợt, chưa release cho ai khác) — vá bằng ADD COLUMN THÊM, không phải
-- ALTER COLUMN đổi kiểu, nên không có rủi ro DROP+ADD mất dữ liệu (đúng bẫy
-- CLAUDE.md cảnh báo cho case ĐỔI KIỂU, không áp dụng ở đây).
--
-- Nguyên văn từ `prisma migrate diff --script` (shadow DB
-- tbs_shadow_po_dot2_fix, tạo rồi DROP ngay sau khi đọc SQL):
--
--   ALTER TABLE "tbl_order" ADD COLUMN     "total_money" BIGINT,
--   ADD COLUMN     "vat_amount" BIGINT NOT NULL DEFAULT 0,
--   ADD COLUMN     "vat_rate" DECIMAL(6,4) NOT NULL DEFAULT 0.0000;
--
-- Đo prod xác nhận từng cột (SHOW COLUMNS FROM tbl_order, 24/09/2026):
--   vat_rate    decimal(6,4)   NOT NULL DEFAULT 0.0000
--   vat_amount  bigint(20)     NOT NULL DEFAULT 0
--   total_money bigint(255)    NULL, KHÔNG có default

ALTER TABLE "tbl_order" ADD COLUMN     "total_money" BIGINT,
ADD COLUMN     "vat_amount" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "vat_rate" DECIMAL(6,4) NOT NULL DEFAULT 0.0000;
