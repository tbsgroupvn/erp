-- Review cuối #06 (whole-branch review, 23/09/2026) — F2 + F3.
-- Hand-written thay vì dùng nguyên si SQL do `prisma migrate diff` sinh ra:
-- diff tool chọn DROP COLUMN + ADD COLUMN cho 3 cột đổi sang DATE (không có
-- cast ngầm INTEGER/TEXT -> DATE nên nó né bằng cách xoá-rồi-tạo-lại). Bản
-- tay này dùng ALTER COLUMN ... TYPE ... USING tường minh để KHÔNG DROP cột
-- nào — xem báo cáo review (.superpowers/sdd/2026-09-23-06-po-plan/
-- fix-f2f3f6f8-report.md) mục "migration SQL summary".
--
-- Ba bảng PO (tbl_purchase_orders/tbl_po_items/tbl_po_receipts) đang RỖNG
-- trên tbs_test tại thời điểm viết migration này — nhánh feat/po chưa từng
-- chạy ETL dữ liệu thật vào Postgres, dữ liệu thật nạp qua quy trình riêng ở
-- docs/rewrite-spec/migration/06-po.md (ngoài git repo này). Vì vậy USING ở
-- dưới không có hàng nào thật sự bị quy đổi lúc chạy migration này — viết
-- tường minh để đúng NGỮ NGHĨA cho lần chạy sau này (nếu migration folder
-- này từng được áp lên một bản đã có dữ liệu), không phải vì cần thiết ngay
-- bây giờ.

-- ===== F2 — cột prod có dữ liệu thật, chưa có home trong bản port đầu ======
ALTER TABLE "tbl_po_items"
  ADD COLUMN "suborder_id" INTEGER,
  ADD COLUMN "notes" TEXT;

ALTER TABLE "tbl_po_receipts"
  ADD COLUMN "note" VARCHAR(500);

ALTER TABLE "tbl_purchase_orders"
  ADD COLUMN "buyer_contact" TEXT,
  ADD COLUMN "buyer_contact_phone" TEXT,
  ADD COLUMN "seller_contact" TEXT,
  ADD COLUMN "seller_contact_phone" TEXT,
  ADD COLUMN "seller_rep" TEXT,
  ADD COLUMN "documents" TEXT,
  ADD COLUMN "sent_to_customer_at" INTEGER,
  ADD COLUMN "guaranteed_by" TEXT,
  ADD COLUMN "guaranteed_at" INTEGER,
  ADD COLUMN "guarantee_note" TEXT,
  ADD COLUMN "credit_risk_at" INTEGER,
  ADD COLUMN "credit_risk_by" TEXT,
  ADD COLUMN "dossier_closed_at" INTEGER;

-- ===== F3 — 3 cột DATE đúng kiểu (po_date/delivery_deadline/receipt_date) ===
-- po_date/receipt_date đang là INTEGER (epoch giây, quy ước nowSec() của repo
-- này) trên Postgres — quy đổi sang DATE bằng to_timestamp(...)::date, NULL
-- giữ NULL (KHÔNG suy ra 1970-01-01 hay bất kỳ epoch tính toán nào — đúng luật
-- "zero-date/NULL -> NULL" ghi trong comment schema.prisma + migration doc).
ALTER TABLE "tbl_purchase_orders"
  ALTER COLUMN "po_date" TYPE DATE USING (
    CASE WHEN "po_date" IS NULL THEN NULL ELSE to_timestamp("po_date")::date END
  );

ALTER TABLE "tbl_po_receipts"
  ALTER COLUMN "receipt_date" TYPE DATE USING (
    CASE WHEN "receipt_date" IS NULL THEN NULL ELSE to_timestamp("receipt_date")::date END
  );

-- delivery_deadline đang là TEXT tự do trên Postgres (cột port ban đầu chưa
-- từng nhận dữ liệu thật ở nhánh này — khác Quote.deliveryDeadline, model
-- KHÁC, vẫn giữ String vì đo được prod lưu chữ tự do "15 ngày kể từ..." ở đó).
-- Không có định dạng ngày thống nhất để quy đổi tự động an toàn từ text tự
-- do -> ép NULL, đúng nghĩa "đổi kiểu, không suy diễn nội dung cũ".
ALTER TABLE "tbl_purchase_orders"
  ALTER COLUMN "delivery_deadline" TYPE DATE USING (NULL::date);
