-- ============================================================
-- Migration: 20260317_performance_indexes
-- Purpose:   Performance indexes identified in the Q1-2026
--            database audit. Covers Order, CRM, Container, and
--            Finance modules.
--
-- IMPORTANT: CREATE INDEX CONCURRENTLY cannot run inside a
-- transaction block. Run this file with:
--   psql -U <user> -d <dbname> -f migration.sql
-- or via the Prisma migration runner in non-transactional mode.
-- Do NOT wrap these statements in BEGIN/COMMIT.
--
-- All indexes use IF NOT EXISTS, making the script safe to
-- re-run (idempotent). The pg_trgm extension is required for
-- GIN trigram indexes; it is created here if not already
-- present.
--
-- Column/table names verified against prisma/schema/*.prisma
-- @@map directives (snake_case). All INCLUDE columns confirmed
-- to exist on their respective tables.
--
-- Reviewed schema files:
--   prisma/schema/order.prisma     (orders, order_items)
--   prisma/schema/crm.prisma       (customers, wallet_transactions)
--   prisma/schema/container.prisma (containers)
--   prisma/schema/warehouse.prisma (packages)
--   prisma/schema/finance.prisma   (account_receivables,
--                                   journal_entry_lines,
--                                   ar_aging_snapshots)
-- ============================================================

-- ============================================================
-- PREREQUISITE: pg_trgm extension for GIN text-search indexes
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- ORDER MODULE
-- ============================================================

-- 1. Covering index for order item aggregates.
--    Eliminates heap fetches when the query only needs
--    quantity, unit_price, total_price for a given order_id.
--    Partial: excludes soft-deleted rows (deleted_at IS NULL).
--    Table: order_items  (schema: prisma/schema/order.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_aggregate
  ON order_items (order_id)
  INCLUDE (quantity, unit_price, total_price)
  WHERE deleted_at IS NULL;

-- 2. Cursor-pagination index for the order listing endpoint.
--    Supports efficient keyset pagination ordered by
--    (created_at DESC, id DESC) without a full table sort.
--    Table: orders  (schema: prisma/schema/order.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_cursor_pagination
  ON orders (created_at DESC, id DESC);

-- 3. Partial index for completed-order reporting queries.
--    Only indexes rows where status = 'COMPLETED', keeping the
--    index small and fast for revenue/completion reports.
--    Table: orders  (schema: prisma/schema/order.prisma)
--    Note: OrderStatus enum confirmed: 'COMPLETED' is valid.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_completed_customer
  ON orders (customer_id, completed_at)
  WHERE status = 'COMPLETED';

-- ------------------------------------------------------------
-- DBA NOTE — Redundant index candidates (commented for safety)
-- Review the indexes below with EXPLAIN ANALYZE before dropping.
-- They may still be used by queries not covered by the new
-- partial and composite indexes above.
--
-- Subsumed by idx_orders_cursor_pagination (composite):
-- DROP INDEX IF EXISTS idx_orders_created_at;           -- orders(created_at) alone
--
-- Subsumed by idx_order_active_status_created and
-- idx_orders_completed_customer partial indexes:
-- DROP INDEX IF EXISTS idx_orders_status;               -- orders(status) alone
-- ------------------------------------------------------------

-- ============================================================
-- CRM MODULE
-- ============================================================

-- 4. GIN trigram index on customer email.
--    Accelerates ILIKE '%...%' and similarity searches on the
--    email column. email is nullable; NULL rows are not indexed
--    by GIN, which is the correct behaviour.
--    Table: customers  (schema: prisma/schema/crm.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email_gin
  ON customers USING gin (email gin_trgm_ops);

-- 5. GIN trigram index on customer code.
--    Accelerates ILIKE prefix/contains searches on the unique
--    customer code (e.g. TBS-KH-000001).
--    Table: customers  (schema: prisma/schema/crm.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_code_gin
  ON customers USING gin (code gin_trgm_ops);

-- 6. Compound B-tree index for filtered customer listing.
--    Supports queries that filter by branch + tier + is_active
--    (e.g. "show all SILVER customers in HN branch that are
--    active"). Column order: branch first (lowest cardinality
--    as leading filter in list pages), then tier, then boolean.
--    Note: branch is nullable (Branch? in schema); NULL values
--    sort last in ascending order, consistent with list UX.
--    Table: customers  (schema: prisma/schema/crm.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_branch_tier_active
  ON customers (branch, tier, is_active);

-- 7. Partial index for sale-assignment queries.
--    Only includes active customers, which is the dominant
--    filter on every sale's customer list. Covers the
--    (sale_id, branch) lookup for active customers.
--    Note: an idx_customers_sale_active already exists in the
--    Prisma schema (@@index([saleId, isActive])). This index
--    adds branch as a second column for more selective queries.
--    Table: customers  (schema: prisma/schema/crm.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_sale_branch_active
  ON customers (sale_id, branch)
  WHERE is_active = true;

-- ============================================================
-- CONTAINER MODULE
-- ============================================================

-- 8. Partial index for ETA (estimated arrival) tracking.
--    Supports "containers arriving soon" queries. Excludes the
--    only terminal state in ContainerStatus: COMPLETED.
--    Schema audit: ContainerStatus enum values are
--    PLANNING | LOADING | IN_TRANSIT | ARRIVED | CUSTOMS |
--    CUSTOMS_HOLD | COMPLETED | ON_HOLD_BORDER.
--    There is no CANCELLED status in this enum, so only
--    COMPLETED is excluded.
--    Column: estimated_arrival_at  (not "eta"; verified from
--    @@map in prisma/schema/container.prisma)
--    Table: containers  (schema: prisma/schema/container.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_eta_active
  ON containers (estimated_arrival_at)
  WHERE status != 'COMPLETED';

-- 9. Covering index for package weight lookups by container.
--    Eliminates heap fetches when aggregating cn_weight,
--    vn_weight, chargeable_weight per container.
--    Note: packages does NOT have a deleted_at column
--    (verified from prisma/schema/warehouse.prisma). The
--    partial predicate is therefore omitted.
--    Columns verified: container_id, cn_weight, vn_weight,
--    chargeable_weight all exist on the packages table.
--    Table: packages  (schema: prisma/schema/warehouse.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_packages_container_weight
  ON packages (container_id)
  INCLUDE (cn_weight, vn_weight, chargeable_weight);

-- 10. Partial index for unassigned packages.
--     Supports queries like "packages not yet loaded into a
--     container, ordered by arrival time".
--     Note: packages has no deleted_at column; the predicate
--     only filters on container_id IS NULL.
--     Table: packages  (schema: prisma/schema/warehouse.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_packages_unassigned
  ON packages (order_id, created_at DESC)
  WHERE container_id IS NULL;

-- 11a. GIN trigram index on container vessel name.
--      Accelerates ILIKE search on vessel_name (nullable).
--      Table: containers  (schema: prisma/schema/container.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_vessel_gin
  ON containers USING gin (vessel_name gin_trgm_ops);

-- 11b. GIN trigram index on container booking reference.
--      Schema audit: the booking reference column is named
--      booking_ref (@@map from bookingRef), NOT booking_number.
--      There is no booking_number column in the containers table.
--      Table: containers  (schema: prisma/schema/container.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_booking_gin
  ON containers USING gin (booking_ref gin_trgm_ops);

-- ============================================================
-- FINANCE MODULE
-- ============================================================

-- 12. Covering index for AR amount lookups by customer + status.
--     Eliminates heap fetches when the finance dashboard reads
--     amount, paid_amount, netted_amount per customer/status.
--     Column names verified from prisma/schema/finance.prisma:
--     customer_id, status, amount, paid_amount, netted_amount.
--     Table: account_receivables  (schema: prisma/schema/finance.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ar_customer_amounts
  ON account_receivables (customer_id, status)
  INCLUDE (amount, paid_amount, netted_amount);

-- 13. Cursor-pagination index for the AR listing endpoint.
--     Supports keyset pagination ordered by (due_date ASC,
--     id ASC). Partial: only includes actionable AR statuses.
--     AccountStatus enum: OPEN | PARTIAL | PAID | OVERDUE |
--     NETTED | CANCELLED.
--     Note: 'PENDING' does not exist in AccountStatus; the
--     actionable statuses are OPEN, PARTIAL, OVERDUE.
--     Table: account_receivables  (schema: prisma/schema/finance.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ar_due_date_cursor
  ON account_receivables (due_date ASC, id ASC)
  WHERE status IN ('OPEN', 'PARTIAL', 'OVERDUE');

-- 14. Covering index for journal entry line amounts.
--     Eliminates heap fetches when GL reports aggregate
--     debit/credit by entry or account.
--     Column name audit: entryId field has no @map directive,
--     so Prisma converts it to snake_case entry_id. Columns
--     debit, credit, account_code are confirmed.
--     Table: journal_entry_lines  (schema: prisma/schema/finance.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_lines_entry_amounts
  ON journal_entry_lines (entry_id)
  INCLUDE (debit, credit, account_code);

-- 15. Composite index for AR aging snapshot queries.
--     Supports "get most recent snapshots at each risk level"
--     and "snapshot history ordered by date".
--     Columns verified: snapshot_date, risk_level.
--     Table: ar_aging_snapshots  (schema: prisma/schema/finance.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ar_aging_snapshots_date
  ON ar_aging_snapshots (snapshot_date DESC, risk_level);

-- 16. Composite index for wallet transaction queries by type
--     and month. Supports "TOPUP transactions for wallet X
--     this month" and similar time-bucketed queries.
--     Columns verified: wallet_id, type, created_at.
--     Table: wallet_transactions  (schema: prisma/schema/crm.prisma)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_type_month
  ON wallet_transactions (wallet_id, type, created_at DESC);
