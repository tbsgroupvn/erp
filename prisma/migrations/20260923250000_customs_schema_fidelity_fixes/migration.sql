-- #08 Hải quan — FINAL REVIEW fix-round (23/09/2026), D1 + D2 + D5.
-- Sửa ĐỘ TRUNG THỰC SCHEMA so với prod `sql_nhpcn` (đo lại read-only qua SSH
-- ngay trước khi viết file này, bằng `information_schema.columns` /
-- `information_schema.statistics` — KHÔNG lấy lại số từ plan hay report cũ).
--
-- ════════════════════════════════════════════════════════════════════════
-- 1. RAW `prisma migrate diff` ĐÃ SINH RA GÌ — và vì sao KHÔNG lấy nguyên
-- ════════════════════════════════════════════════════════════════════════
-- Chạy trên shadow DB dùng-một-lần `tbs_shadow_08fix` (tạo mới, dùng xong
-- DROP; KHÔNG bao giờ dựng shadow trên `tbs_test` vì DB đó DÙNG CHUNG giữa
-- các nhánh/phiên). Lệnh:
--
--   npx prisma migrate diff --from-url $DATABASE_URL \
--     --to-schema-datamodel prisma/schema.prisma \
--     --shadow-database-url postgresql://.../tbs_shadow_08fix --script
--
-- Đầu ra thô (ĐỌC HẾT trước khi viết file này):
--
--   ALTER TABLE "tbl_customs_declarations" DROP COLUMN "customs_gate",
--   ADD COLUMN "updated_at" TIMESTAMP(3),
--   DROP COLUMN "hq_precheck_sent_at", ADD COLUMN "hq_precheck_sent_at" TIMESTAMP(3),
--   DROP COLUMN "hq_precheck_ok_at",   ADD COLUMN "hq_precheck_ok_at"   TIMESTAMP(3),
--   DROP COLUMN "created_at",          ADD COLUMN "created_at"          TIMESTAMP(3);
--   ALTER TABLE "tbl_import_goods" DROP COLUMN "procedure_days", ADD COLUMN "procedure_days" INTEGER,
--   DROP COLUMN "approved_at",     ADD COLUMN "approved_at"     TIMESTAMP(3),
--   DROP COLUMN "pending_at",      ADD COLUMN "pending_at"      TIMESTAMP(3),
--   DROP COLUMN "last_cleared_at", ADD COLUMN "last_cleared_at" TIMESTAMP(3);
--   ... (phần ADD COLUMN declaration_id / CREATE INDEX / ADD FOREIGN KEY thì ĐÚNG)
--
-- ⚠⚠⚠ **BẢY CẶP `DROP COLUMN` + `ADD COLUMN` ở trên là BẪY MẤT DỮ LIỆU.**
-- Postgres không có ép ngầm int -> timestamp (hay text -> integer) nên
-- `migrate diff` không thể làm khác; lấy nguyên xi là XOÁ SẠCH cột rồi tạo
-- lại rỗng. Trong đó `tbl_customs_declarations.created_at` có dữ liệu ở
-- **248/248 dòng prod** — đúng một phát mất hết. File này thay TOÀN BỘ 7 cặp
-- đó bằng `ALTER COLUMN ... TYPE ... USING`, giữ y nguyên phần còn lại.
-- (Cùng bẫy đã ghi ở CLAUDE.md và ở migration 20260923220000 cho `closed_at`.)
--
-- ⚠ NGOẠI LỆ CÓ CHỦ Ý — `DROP COLUMN "customs_gate"` là một cú XOÁ THẬT và
-- được giữ lại. Lý do: đo prod 23/09/2026, `tbl_customs_declarations` có
-- ĐÚNG 30 cột và **KHÔNG có cột nào tên `customs_gate`** (cột tên đó nằm ở
-- `tbl_transport_files`, và model `TransportFile` đã có nó). Cột này là cột
-- MA do bản port tự đặt ra; không một cột nguồn nào có thể đổ vào đây, nên
-- xoá nó KHÔNG mất một dòng dữ liệu nào — trong `tbs_test` nó cũng rỗng
-- (bảng này 0 dòng ngoài dữ liệu test tự dọn). Đây là DROP COLUMN DUY NHẤT
-- trong file này.
--
-- ════════════════════════════════════════════════════════════════════════
-- 2. D1 — `updated_at` bị BỎ SÓT, `customs_gate` là cột MA
-- ════════════════════════════════════════════════════════════════════════
-- Đo prod: `updated_at datetime DEFAULT current_timestamp()`, NOT NULL ở
-- **248/248 dòng** (dải 2026-09-02 20:55:08 … 2026-09-20 08:30:03). Model
-- không có field nào map tới nó ⇒ ETL không có chỗ đổ 248 dòng vết audit.
-- Nó lọt lưới vì nghiệm thu chỉ so SỐ LƯỢNG cột (30 model vs 30 prod): cột
-- ma `customs_gate` bù đúng một chỗ cho cột thiếu `updated_at`, nên phép đếm
-- khớp hoàn hảo trong khi hai tập cột KHÁC NHAU. Đây là bẫy `receipt_images`
-- của #07, cộng thêm lớp nguỵ trang.
--
-- ════════════════════════════════════════════════════════════════════════
-- 3. D2 — `tbl_transport_file_items.declaration_id`
-- ════════════════════════════════════════════════════════════════════════
-- Đo prod: `declaration_id int(11) NOT NULL DEFAULT 0`; phân bố
-- `6223 -> 60 dòng`, `6224 -> 40 dòng`, `0 -> 45 dòng`; JOIN sang
-- `tbl_customs_declarations` giải được **100/145 dòng, không sót dòng nào**.
-- Prod cũng có index `idx_tfi_decl (declaration_id)` (non_unique=1) — tái
-- hiện đúng tên index đó ở dưới.
--
-- ⚠ Quy tắc ETL: `NULLIF(declaration_id, 0)` — `0` là sentinel "chưa gắn tờ
-- khai" (45/145 dòng), đúng cách §6.1 migration doc xử lý `quote_item_id`.
--
-- ⚠ FOREIGN KEY: prod (MySQL/InnoDB) KHÔNG có ràng buộc khoá ngoại ở đây,
-- chỉ có index. Bản Postgres có FK (hệ quả của việc khai quan hệ Prisma —
-- cần để `include: { declaration: ... }` chạy được). Đây là SIẾT CHẶT hơn
-- prod, và nó an toàn vì 100/100 dòng có `declaration_id <> 0` đều giải được
-- sang một tờ khai có thật; nhưng ETL PHẢI nạp `tbl_customs_declarations`
-- TRƯỚC `tbl_transport_file_items`, nếu không FK sẽ chặn.
-- `ON DELETE SET NULL` (mặc định Prisma cho quan hệ optional) giữ dòng khai
-- sống khi tờ khai bị xoá — không có đường xoá tờ khai nào trong mã hiện tại.
--
-- ⚠ HỆ QUẢ CHO TEST: FK này khiến `TRUNCATE tbl_customs_declarations ...
-- CASCADE` (trong `test/helpers/customs-db.ts::resetCustoms`) cuốn theo cả
-- `tbl_transport_file_items`. Mọi spec hiện tại đều gọi `resetWarehouse()`
-- rồi mới `resetCustoms()` nên thứ tự vẫn đúng.
--
-- ⚠⚠ `CustomsDeclaration` HIỆN KHÔNG CÓ ĐƯỜNG GHI TỪ ỨNG DỤNG — không nơi
-- nào trong `src/` gọi `customsDeclaration.create/update/upsert`. CỐ Ý: đợt 1
-- chỉ port lõi tính thuế `recalcItemTax`; tạo/sửa tờ khai là ĐỢT 2. Bảng +
-- quan hệ vẫn phải dựng NGAY BÂY GIỜ vì prod đang giữ 248 dòng thật và
-- 100 mối nối thật — bỏ qua đợt này nghĩa là ETL vứt chúng đi. Ghi rõ ở đây,
-- ở `schema.prisma` (đầu model), và ở docs/rewrite-spec/migration/08-haiquan.md
-- mục 7.1 — "bảng không ai ghi" chỉ chấp nhận được khi nó CỐ Ý, ĐƯỢC GHI RÕ
-- và ĐANG CHỞ dữ liệu thật.
--
-- ════════════════════════════════════════════════════════════════════════
-- 4. D5 — 6 cột `datetime` bị mô hình hoá thành `Int` epoch, + procedure_days
-- ════════════════════════════════════════════════════════════════════════
-- `SHOW COLUMNS` prod 23/09/2026 (đo lại, không chép):
--
--   tbl_customs_declarations.created_at           datetime  -- 248/248 CÓ DỮ LIỆU
--   tbl_customs_declarations.hq_precheck_sent_at  datetime  -- 0/248
--   tbl_customs_declarations.hq_precheck_ok_at    datetime  -- 0/248
--   tbl_import_goods.approved_at                  datetime  -- 0/690
--   tbl_import_goods.pending_at                   datetime  -- 0/690
--   tbl_import_goods.last_cleared_at              datetime  -- 0/690
--   tbl_import_goods.procedure_days               int(11)   -- 0/690  (model để String?)
--
-- `schema.prisma` và migration 20260923240000 TỪNG khẳng định rằng ba cột
-- approved_at/pending_at/last_cleared_at "LÀ epoch int" và rằng việc đó "đã
-- được tự kiểm SHOW COLUMNS cho từng cột". Cả hai vế đều SAI. Lời khẳng định
-- đó đã được XOÁ khỏi cả hai file, KHÔNG viết lại một phiên bản mềm hơn —
-- một ghi chú "đã kiểm" mà không hề kiểm còn tệ hơn không có ghi chú, vì nó
-- làm người đọc sau dừng việc đo lại.
--
-- ⚠ ĐỪNG "sửa" các cột datetime CÒN LẠI của ImportGoods: `created_at`,
-- `updated_at`, `last_used_at` đã ĐÚNG là DateTime? từ Task 4 — không đụng.

-- ════════════════════════════════════════════════════════════════════════
-- D1 — CustomsDeclaration: xoá cột MA, thêm cột BỊ SÓT
-- ════════════════════════════════════════════════════════════════════════
-- DROP COLUMN DUY NHẤT trong file này, và là DROP CÓ CHỦ Ý: không có cột
-- nguồn nào trên prod mang tên này (xem mục 1).
ALTER TABLE "tbl_customs_declarations" DROP COLUMN "customs_gate";

ALTER TABLE "tbl_customs_declarations" ADD COLUMN "updated_at" TIMESTAMP(3);

-- ════════════════════════════════════════════════════════════════════════
-- D5 — retype epoch-int -> timestamp. ALTER ... USING, KHÔNG DROP+ADD.
-- `to_timestamp(NULL)` = NULL nên dòng rỗng đi qua nguyên vẹn; dòng có số
-- được diễn giải như epoch giây (đúng ý nghĩa mà kiểu Int? cũ mang).
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE "tbl_customs_declarations"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING to_timestamp("created_at")::timestamp(3);
ALTER TABLE "tbl_customs_declarations"
  ALTER COLUMN "hq_precheck_sent_at" TYPE TIMESTAMP(3) USING to_timestamp("hq_precheck_sent_at")::timestamp(3);
ALTER TABLE "tbl_customs_declarations"
  ALTER COLUMN "hq_precheck_ok_at" TYPE TIMESTAMP(3) USING to_timestamp("hq_precheck_ok_at")::timestamp(3);

ALTER TABLE "tbl_import_goods"
  ALTER COLUMN "approved_at" TYPE TIMESTAMP(3) USING to_timestamp("approved_at")::timestamp(3);
ALTER TABLE "tbl_import_goods"
  ALTER COLUMN "pending_at" TYPE TIMESTAMP(3) USING to_timestamp("pending_at")::timestamp(3);
ALTER TABLE "tbl_import_goods"
  ALTER COLUMN "last_cleared_at" TYPE TIMESTAMP(3) USING to_timestamp("last_cleared_at")::timestamp(3);

-- procedure_days: TEXT -> INTEGER. `NULLIF(btrim(...), '')` để chuỗi rỗng
-- (giá trị rất hay gặp ở các cột text kiểu này) thành NULL thay vì nổ
-- "invalid input syntax for type integer". Prod đo 0/690 dòng có giá trị nên
-- trên thực tế đây là chuyển đổi trên cột rỗng.
ALTER TABLE "tbl_import_goods"
  ALTER COLUMN "procedure_days" TYPE INTEGER USING NULLIF(btrim("procedure_days"), '')::integer;

-- ════════════════════════════════════════════════════════════════════════
-- D2 — TransportFileItem.declaration_id + index prod + quan hệ Prisma
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE "tbl_transport_file_items" ADD COLUMN "declaration_id" INTEGER;

-- Tên index lấy ĐÚNG tên trên prod (`idx_tfi_decl`) để một lần SHOW INDEX
-- đối chiếu sau này đọc ra giống hệt, không chỉ tương đương.
CREATE INDEX "idx_tfi_decl" ON "tbl_transport_file_items"("declaration_id");

ALTER TABLE "tbl_transport_file_items"
  ADD CONSTRAINT "tbl_transport_file_items_declaration_id_fkey"
  FOREIGN KEY ("declaration_id") REFERENCES "tbl_customs_declarations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
