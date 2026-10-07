-- I2 (review cuối #04) — nhóm quyền CŨ `tbl_user_group` (entity LegacyGroup, 01-iam.md), tối thiểu.
-- Prod (sql_nhpcn, information_schema 24/09/2026): id int(11) NOT NULL · name varchar(50) NOT NULL ·
-- isaccountant tinyint(4) NULL DEFAULT 0 · isactive int(11) NULL DEFAULT 1 (31 dòng; isaccountant=1: chỉ gid 46).
-- Khi nạp dữ liệu: NULL ⇒ mặc định (isaccountant NULL ⇒ false, isactive NULL ⇒ true như DEFAULT prod).
-- Viết TAY từ SQL Prisma sinh (đã đọc): chỉ CREATE TABLE, không DROP/ALTER bảng nào khác.
CREATE TABLE IF NOT EXISTS "tbl_user_group" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "isaccountant" BOOLEAN NOT NULL DEFAULT false,
    "isactive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tbl_user_group_pkey" PRIMARY KEY ("id")
);
