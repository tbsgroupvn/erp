-- Defense-in-depth: at most ONE open (hieu_luc_den IS NULL) rate row per (loai, hang_khach).
-- Prisma schema cannot express a partial unique index; enforced here at the DB level.
CREATE UNIQUE INDEX "tbl_mh_tygia_single_open" ON "tbl_mh_tygia" ("loai", "hang_khach") WHERE "hieu_luc_den" IS NULL;
