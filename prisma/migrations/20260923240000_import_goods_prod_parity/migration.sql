-- #08 Task 4 fix-round-1 (23/09/2026) — ImportGoods was missing 7 production
-- columns, 4 of them FULLY populated on prod (measured sql_nhpcn.tbl_import_goods,
-- 690 rows):
--
--   status       tinyint(4) NULL DEFAULT 1     -- 690/690, all = 1
--   created_by   varchar(100) NULL             -- 690/690
--   created_at   datetime NULL                 -- 690/690
--   origin       varchar(100) NULL DEFAULT 'CN'-- 429/690
--   updated_by   varchar(100) NULL             -- 58/690
--   updated_at   datetime NULL                 -- 58/690
--   last_used_at datetime NULL                 -- 1/690
--
-- This is the exact #07 trap (receipt_images: 1568/1568 rows of real data,
-- silently dropped because migration acceptance only compared ROW COUNTS,
-- which are blind to missing columns). created_at/updated_at/last_used_at
-- are real `datetime` columns on prod, NOT epoch ints.
--
-- ⚠⚠⚠ RETRACTION added 23/09/2026 by the #08 final-review fix-round (D5).
-- This header previously continued: "several sibling columns on this same
-- model (approvedAt/pendingAt/lastClearedAt) ARE epoch ints, so this was
-- checked column-by-column via SHOW COLUMNS, not pattern-matched from
-- neighbours." Both halves were FALSE. Re-measured on prod: approved_at,
-- pending_at and last_cleared_at are all `datetime`, and the
-- column-by-column check being claimed did not happen. The sentence is
-- deleted rather than softened — an unearned "already verified" note is
-- worse than no note, because the next reader stops checking. The three
-- columns are retyped to timestamp in migration
-- 20260923250000_customs_schema_fidelity_fixes. Nothing in THIS file's SQL
-- changed; only the false claim above was removed.
--
-- Also missing: prod's `uq_goods_key` UNIQUE(goods_key) (measured
-- non_unique=0) and `goods_key varchar(500) NOT NULL` (was nullable here).
-- Without the UNIQUE constraint, ImportGoodsService.upsert() had to
-- findFirst+create/update — a check-then-act race (two concurrent upserts
-- of the same goods_key could both observe "not found" and both insert).
-- upsert() now uses `prisma.importGoods.upsert()` on this real unique key,
-- which Postgres serialises via the unique index itself.
--
-- Taken from `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel
-- prisma/schema.prisma --script` (read in full before writing this file) —
-- the raw diff was ALL additive (7x ADD COLUMN, 1x ALTER COLUMN SET NOT
-- NULL, 1x CREATE UNIQUE INDEX, 2x RENAME INDEX to match prod's idx_hs/
-- idx_name), no DROP+ADD retype trap this time (all 7 new columns are
-- brand new, not existing-column retypes). Two additions beyond the raw
-- diff, both defensive/no-op on tbs_test today but required for
-- correctness against any environment that already has rows:
--   1. A backfill UPDATE before SET NOT NULL, in case a NULL goods_key row
--      exists. Measured tbs_test (shared across branches/sessions) right
--      before writing this file: 0 rows in tbl_import_goods total, so this
--      backfill is a no-op here — but the shared DB can gain rows from a
--      concurrent session before this migration applies, and prod already
--      has NOT NULL+UNIQUE on this column today (verified via SHOW COLUMNS/
--      SHOW INDEX, so applying this to prod later is safe, no existing
--      NULLs or duplicates to reconcile there either).
--   2. Explicit ordering comment: ADD COLUMNs first (fully additive, can't
--      fail), THEN backfill, THEN the NOT NULL constraint, THEN the UNIQUE
--      index — each step only depends on the previous one succeeding.

-- AlterTable: add the 7 columns prod already has, matching prod's types
-- and defaults exactly (status/origin have DEFAULTs on prod; the other 5
-- do not).
ALTER TABLE "tbl_import_goods"
  ADD COLUMN "origin" VARCHAR(100) DEFAULT 'CN',
  ADD COLUMN "status" INTEGER DEFAULT 1,
  ADD COLUMN "created_by" VARCHAR(100),
  ADD COLUMN "created_at" TIMESTAMP(3),
  ADD COLUMN "updated_by" VARCHAR(100),
  ADD COLUMN "updated_at" TIMESTAMP(3),
  ADD COLUMN "last_used_at" TIMESTAMP(3);

-- Defensive backfill BEFORE the NOT NULL constraint below — see note (1)
-- above. No-op on tbs_test today (0 rows measured); protects any future
-- run of this migration against a populated environment.
UPDATE "tbl_import_goods" SET "goods_key" = 'zz-migrated-' || "id"::text WHERE "goods_key" IS NULL;

-- goods_key: restore prod's NOT NULL (must run AFTER the backfill above).
ALTER TABLE "tbl_import_goods" ALTER COLUMN "goods_key" SET NOT NULL;

-- CreateIndex: restore prod's UNIQUE(goods_key) — the real constraint
-- ImportGoodsService.upsert() now upserts on.
CREATE UNIQUE INDEX "uq_goods_key" ON "tbl_import_goods"("goods_key");

-- RenameIndex: cosmetic-but-deliberate — match prod's actual index names
-- (idx_hs on hs_code, idx_name on product_name) so a future SHOW INDEX
-- diff against prod reads as identical, not just equivalent.
ALTER INDEX "tbl_import_goods_hs_code_idx" RENAME TO "idx_hs";
ALTER INDEX "tbl_import_goods_product_name_idx" RENAME TO "idx_name";
