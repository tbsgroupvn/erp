-- #08 fix-round-1 (23/09/2026) — tygia resolver for CustomsDeclarationService.recalcItemTax
--
-- HAND-WRITTEN, not taken verbatim from `prisma migrate diff`. The raw diff
-- (generated against a throwaway shadow DB, read in full before writing this
-- file) emitted for the `closed_at` retype:
--
--   ALTER TABLE "tbl_transport_files" ADD COLUMN "usd_rate_closed" DECIMAL(12,4),
--   DROP COLUMN "closed_at",
--   ADD COLUMN "closed_at" TIMESTAMP(3);
--
-- DROP COLUMN + ADD COLUMN would DESTROY any data already in `closed_at` —
-- Postgres has no implicit int->timestamp cast, so `migrate diff` cannot do
-- better on its own. Measured `tbs_test` before writing this: 0 rows in
-- `tbl_transport_files`, so nothing to lose here, but prod's real
-- `tbl_transport_files.closed_at` is a live `datetime` column and any future
-- environment this migration runs against may have real data — so this file
-- uses ALTER COLUMN ... TYPE ... USING to_timestamp(...) instead, exactly
-- the trap flagged in CLAUDE.md ("#06: tool sinh DROP+ADD").
--
-- No code/test anywhere reads or writes TransportFile.closedAt today
-- (verified: `grep -rn closedAt src/ test/` only matches the UNRELATED
-- PackageIssue.closedAt column) — so this retype has no call sites to
-- update.

-- AlterTable: TransportFile — add usd_rate_closed (rung #1 of the tygia
-- resolver ladder), retype closed_at from epoch-int to real timestamp.
ALTER TABLE "tbl_transport_files" ADD COLUMN "usd_rate_closed" DECIMAL(12,4);
ALTER TABLE "tbl_transport_files"
  ALTER COLUMN "closed_at" TYPE TIMESTAMP(3) USING to_timestamp("closed_at")::timestamp(3);

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('CNY', 'USD');

-- CreateTable: tbl_exchange_rates — treasury FX table read by
-- tbs_decl_usd_rate()'s getRate(currency, date). Distinct from
-- tbl_mh_tygia/MhRate (wallet/mua-hộ FX, different shape, different owner).
CREATE TABLE "tbl_exchange_rates" (
    "id" SERIAL NOT NULL,
    "currency" "Currency" NOT NULL,
    "rate_vnd" DECIMAL(12,2) NOT NULL,
    "rate_date" DATE NOT NULL,
    "created_by" TEXT NOT NULL DEFAULT '',
    "cdate" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tbl_exchange_rates_currency_rate_date_idx" ON "tbl_exchange_rates"("currency", "rate_date");
