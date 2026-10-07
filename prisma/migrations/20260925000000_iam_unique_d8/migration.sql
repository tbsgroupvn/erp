-- D8 (docs/rewrite-spec/migration/01-iam.md) — ràng buộc UNIQUE prod có mà Postgres thiếu.
-- Prod sql_nhpcn (information_schema.STATISTICS, 24/09/2026):
--   tbl_user_role  uq_user_role  (user_id, role_id, hieu_luc_tu)
--   tbl_user_perm  uq_user_perm  (user_id, perm_code, loai)
--   tbl_user_scope uq_user_scope (user_id, loai, gia_tri)
--   tbl_user       username  UNIQUE, collation utf8mb3_unicode_ci ⇒ KHÔNG phân biệt hoa-thường
-- Kiểm trước bằng SELECT (24/09/2026): tbs_test 0 dòng vi phạm cả 4 khoá; prod 0 trùng khi LOWER(username).
-- Viết TAY: 3 câu đầu nguyên văn `prisma migrate diff` (shadow DB tbs_shadow_d8, đã đọc); câu thứ 4
-- là chỉ mục BIỂU THỨC Prisma không khai được trong schema.prisma. 0 DROP, 0 ALTER bảng.

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_perm" ON "tbl_user_perm"("user_id", "perm_code", "loai");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_role" ON "tbl_user_role"("user_id", "role_id", "hieu_luc_tu");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_scope" ON "tbl_user_scope"("user_id", "loai", "gia_tri");

-- UNIQUE không phân biệt hoa-thường cho tên đăng nhập (D4/D8). Cũng là chỉ mục mà
-- AuthService.findActiveUser() (`lower(username) = lower($1)`) dùng được.
CREATE UNIQUE INDEX "tbl_user_username_lower_key" ON "tbl_user"(lower("username"));
