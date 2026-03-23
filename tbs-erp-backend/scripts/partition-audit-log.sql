-- =========================================================
-- AuditLog Partitioning Script for TBS ERP
-- =========================================================
-- Prisma model: AuditLog  ->  PostgreSQL table: audit_logs
--
-- Run this during a maintenance window (low traffic period).
-- Estimated downtime: ~seconds for rename; data copy may
-- take minutes depending on existing row count.
--
-- Prerequisites (run once as superuser, outside transaction):
--   CREATE EXTENSION IF NOT EXISTS pg_partman;
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/partition-audit-log.sql
--
-- Assumptions:
--   - PostgreSQL 14+
--   - Running as the database owner or superuser
--   - DATABASE_URL points to the correct database
--
-- Monthly partition naming convention (matches create-partitions.sh):
--   audit_logs_YYYY_MM
-- =========================================================

BEGIN;

-- =========================================================
-- STEP 1: Create the new partitioned parent table
--
-- Column definitions mirror auth.prisma AuditLog model EXACTLY:
--   id         String   @id @default(cuid())       -> TEXT NOT NULL
--   userId     String   @map("user_id")             -> TEXT NOT NULL
--   action     String                               -> TEXT NOT NULL
--   entity     String                               -> TEXT NOT NULL
--   entityId   String?  @map("entity_id")           -> TEXT
--   oldData    Json?    @map("old_data")             -> JSONB
--   newData    Json?    @map("new_data")             -> JSONB
--   ipAddress  String?  @map("ip_address")          -> TEXT
--   userAgent  String?  @map("user_agent")          -> TEXT
--   sessionId  String?  @map("session_id")          -> TEXT
--   createdAt  DateTime @default(now()) @map("created_at") -> TIMESTAMP(3)
--
-- IMPORTANT: createdAt MUST be part of the PRIMARY KEY when
-- using PARTITION BY RANGE on that column.
-- =========================================================

CREATE TABLE audit_logs_partitioned (
  id           TEXT        NOT NULL,
  user_id      TEXT        NOT NULL,
  action       TEXT        NOT NULL,
  entity       TEXT        NOT NULL,
  entity_id    TEXT,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   TEXT,
  user_agent   TEXT,
  session_id   TEXT,
  created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, created_at)          -- partition key must be in PK
) PARTITION BY RANGE (created_at);

-- =========================================================
-- STEP 2: Create monthly partitions
--
-- Coverage: 6 months before current date (2025-09 through
-- 2026-02) + current month (2026-03) + 3 future months
-- (2026-04 through 2026-06) + a DEFAULT catch-all.
--
-- Today's reference date: 2026-03-17
-- Partition names use suffix YYYY_MM to match create-partitions.sh
-- =========================================================

-- --- Past partitions (catch existing data) ---------------

CREATE TABLE audit_logs_2025_09
  PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE audit_logs_2025_10
  PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE audit_logs_2025_11
  PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE audit_logs_2025_12
  PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE audit_logs_2026_01
  PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE audit_logs_2026_02
  PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- --- Current month ----------------------------------------

CREATE TABLE audit_logs_2026_03
  PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- --- Future partitions (pre-created by create-partitions.sh) ---

CREATE TABLE audit_logs_2026_04
  PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE audit_logs_2026_05
  PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE audit_logs_2026_06
  PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- --- Default partition: catches any row outside the ranges above
--     (e.g. very old data imported before 2025-09)
CREATE TABLE audit_logs_default
  PARTITION OF audit_logs_partitioned DEFAULT;

-- =========================================================
-- STEP 3: Create indexes on the partitioned table
--
-- PostgreSQL 11+ propagates these to every child partition
-- automatically (including future ones).
-- Mirrors the @@index directives from auth.prisma:
--   @@index([entity, entityId])
--   @@index([userId, createdAt])
--   @@index([userId])
--   @@index([action])
--   @@index([createdAt])
-- =========================================================

-- entity + entity_id lookup (most common access pattern for audit trails)
CREATE INDEX idx_audit_part_entity
  ON audit_logs_partitioned (entity, entity_id, created_at DESC);

-- user timeline (profile / activity view)
CREATE INDEX idx_audit_part_user_created
  ON audit_logs_partitioned (user_id, created_at DESC);

-- user alone (FK-style lookup)
CREATE INDEX idx_audit_part_user
  ON audit_logs_partitioned (user_id);

-- action filter (security review: all DELETE actions, etc.)
CREATE INDEX idx_audit_part_action
  ON audit_logs_partitioned (action);

-- time-range scans (archival, reporting)
CREATE INDEX idx_audit_part_created
  ON audit_logs_partitioned (created_at DESC);

-- =========================================================
-- STEP 4: Migrate existing data into the partitioned table
--
-- Uses INSERT ... SELECT rather than COPY so that:
--   - It runs inside the same transaction (can be rolled back)
--   - Rows land in the correct child partition automatically
--   - Rows with created_at < 2025-09 land in audit_logs_default
--
-- For very large tables (>50M rows) consider running this
-- step outside the transaction in batches:
--   INSERT INTO audit_logs_partitioned
--     SELECT * FROM audit_logs WHERE created_at >= 'YYYY-MM-01'
--     AND created_at < 'YYYY-MM+1-01';
-- =========================================================

INSERT INTO audit_logs_partitioned (
  id, user_id, action, entity, entity_id,
  old_data, new_data, ip_address, user_agent, session_id, created_at
)
SELECT
  id, user_id, action, entity, entity_id,
  old_data, new_data, ip_address, user_agent, session_id, created_at
FROM audit_logs;

-- =========================================================
-- STEP 5: Atomic table swap
--
-- Rename old non-partitioned table out of the way, then
-- rename the new partitioned table into its place.
-- Both renames happen inside the same transaction, so
-- no window exists where "audit_logs" is missing.
-- =========================================================

ALTER TABLE audit_logs            RENAME TO audit_logs_old;
ALTER TABLE audit_logs_partitioned RENAME TO audit_logs;

-- Drop the FK constraint on user_id from the old table so
-- it does not block the DROP TABLE below, if desired.
-- The new partitioned table intentionally has NO FK to users
-- because PostgreSQL does not support FK references FROM or
-- TO partitioned tables (until PG 15 with limitations).
-- The application layer still enforces referential integrity.

-- =========================================================
-- STEP 6: Row-count verification (runs inside transaction,
-- will ROLLBACK everything if counts do not match)
-- =========================================================

DO $$
DECLARE
  old_count   BIGINT;
  new_count   BIGINT;
BEGIN
  SELECT COUNT(*) INTO old_count FROM audit_logs_old;
  SELECT COUNT(*) INTO new_count FROM audit_logs;

  IF old_count <> new_count THEN
    RAISE EXCEPTION
      'Row count mismatch: audit_logs_old=% vs audit_logs(partitioned)=%. ROLLING BACK.',
      old_count, new_count;
  END IF;

  RAISE NOTICE 'Row count verified: % rows migrated successfully.', new_count;
END;
$$;

COMMIT;

-- =========================================================
-- POST-MIGRATION (run after verifying data is intact)
-- =========================================================

-- Show partition sizes for confirmation
SELECT
  child.relname                                                      AS partition,
  pg_size_pretty(pg_total_relation_size(child.oid))                 AS total_size,
  pg_size_pretty(pg_relation_size(child.oid))                       AS data_size,
  (SELECT COUNT(*) FROM pg_inherits i WHERE i.inhrelid = child.oid) AS sub_partitions
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
WHERE parent.relname = 'audit_logs'
ORDER BY child.relname;

-- Once satisfied, drop the old non-partitioned table:
--   DROP TABLE audit_logs_old;
-- (Do this manually after confirming the application works.)


-- =========================================================
-- OPTION A — pg_partman (recommended for auto-partition)
-- =========================================================
-- Run AFTER the migration completes, outside a transaction.
--
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_partman;
--
-- SELECT partman.create_parent(
--   p_parent_table  := 'public.audit_logs',
--   p_control       := 'created_at',
--   p_type          := 'range',
--   p_interval      := '1 month',
--   p_premake       := 3,          -- pre-create 3 future partitions
--   p_start_partition := '2025-09-01'
-- );
--
-- Then add to pg_partman maintenance schedule (runs via cron
-- or pg_cron extension):
--   SELECT partman.run_maintenance();
--
-- =========================================================
-- OPTION B — Manual cron (scripts/create-partitions.sh)
-- =========================================================
-- The existing create-partitions.sh script already handles
-- audit_logs partition creation on the 25th of each month.
-- No additional setup needed for Option B.
-- See: scripts/crontab-maintenance.txt for the cron entry.
-- =========================================================
