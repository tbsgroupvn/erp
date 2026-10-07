-- #08 fix-round-2 (23/09/2026, Important 2) — ExchangeRate lost prod's
-- UNIQUE(currency, rate_date) constraint (prod: index `uq_cur_date`,
-- non_unique=0, coordinator-verified). Fix-round-1 modelled a plain
-- @@index — without the uniqueness guarantee, duplicate (currency,
-- rate_date) rows are possible, and getRate's
-- `findFirst ... orderBy rateDate desc` (no tiebreaker) becomes
-- nondeterministic on a tie, which makes the resolved exchange rate — and
-- therefore the tax bill — nondeterministic too.
--
-- Taken verbatim from `prisma migrate diff` (read in full before writing
-- this file) — this is a metadata-only index change, not a data-affecting
-- column retype, so no hand-rewrite needed here (unlike the closed_at
-- migration). Verified before applying: `tbs_test`'s tbl_exchange_rates
-- had 0 duplicate (currency, rate_date) pairs at migration time (2 rows
-- total, from ongoing test runs), so DROP+CREATE UNIQUE succeeds without
-- needing a dedupe step first.

-- DropIndex
DROP INDEX "tbl_exchange_rates_currency_rate_date_idx";

-- CreateIndex
CREATE UNIQUE INDEX "tbl_exchange_rates_currency_rate_date_key" ON "tbl_exchange_rates"("currency", "rate_date");
