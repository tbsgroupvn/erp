-- ============================================================================
-- TBS ERP — AuditLog Table Partitioning Strategy
-- ============================================================================
--
-- Purpose: Partition the audit_logs table by month for improved query
-- performance on the highest-volume table in the system.
--
-- This is a MANUAL migration — not managed by Prisma Migrate.
-- Execute this SQL against the production database during a maintenance window.
--
-- Prerequisites:
--   - PostgreSQL 12+ (native partitioning)
--   - pg_cron extension for automated partition creation
--   - Backup taken before execution
--
-- Rollback: The original audit_logs table is renamed (not dropped) so data
-- can be restored if needed.
--
-- Reference: compliance/data-flow-diagram.md — Section 4 (Audit Log Data Flow)
-- ============================================================================

-- 0. Safety check: ensure pg_cron extension is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- STEP 1: Create the partitioned table with identical schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log_partitioned (
  id          TEXT NOT NULL,
  "userId"    TEXT,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  "entityId"  TEXT,
  "oldData"   JSONB,
  "newData"   JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, "createdAt")
) PARTITION BY RANGE ("createdAt");

-- Indexes on the partitioned table (inherited by all partitions)
CREATE INDEX IF NOT EXISTS idx_audit_part_user_created
  ON audit_log_partitioned ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_audit_part_entity
  ON audit_log_partitioned (entity, "entityId");

CREATE INDEX IF NOT EXISTS idx_audit_part_action_created
  ON audit_log_partitioned (action, "createdAt" DESC);

-- ============================================================================
-- STEP 2: Create monthly partitions for 2024 and 2025
-- ============================================================================

-- 2024 partitions
CREATE TABLE IF NOT EXISTS audit_log_2024_01 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE IF NOT EXISTS audit_log_2024_02 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE IF NOT EXISTS audit_log_2024_03 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE IF NOT EXISTS audit_log_2024_04 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE IF NOT EXISTS audit_log_2024_05 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE IF NOT EXISTS audit_log_2024_06 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE IF NOT EXISTS audit_log_2024_07 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE IF NOT EXISTS audit_log_2024_08 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE IF NOT EXISTS audit_log_2024_09 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE IF NOT EXISTS audit_log_2024_10 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE IF NOT EXISTS audit_log_2024_11 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE IF NOT EXISTS audit_log_2024_12 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- 2025 partitions
CREATE TABLE IF NOT EXISTS audit_log_2025_01 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS audit_log_2025_02 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS audit_log_2025_03 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS audit_log_2025_04 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS audit_log_2025_05 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS audit_log_2025_06 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS audit_log_2025_07 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS audit_log_2025_08 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS audit_log_2025_09 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS audit_log_2025_10 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS audit_log_2025_11 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS audit_log_2025_12 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- 2026 partitions
CREATE TABLE IF NOT EXISTS audit_log_2026_01 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_02 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_03 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_04 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_05 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_06 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_07 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_08 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_09 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_10 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_11 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS audit_log_2026_12 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- ============================================================================
-- STEP 3: Auto-partition creation function
-- ============================================================================
-- Creates the next month's partition automatically. Scheduled to run on the
-- 25th of each month so the partition exists well before it is needed.

CREATE OR REPLACE FUNCTION create_audit_log_partition()
RETURNS void AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Create partition for next month
  partition_date := DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
  partition_name := 'audit_log_' || TO_CHAR(partition_date, 'YYYY_MM');
  start_date := partition_date;
  end_date := partition_date + INTERVAL '1 month';

  -- Only create if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF audit_log_partitioned FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  ELSE
    RAISE NOTICE 'Partition already exists: %', partition_name;
  END IF;

  -- Also create the month after next (safety buffer)
  partition_date := DATE_TRUNC('month', NOW()) + INTERVAL '2 months';
  partition_name := 'audit_log_' || TO_CHAR(partition_date, 'YYYY_MM');
  start_date := partition_date;
  end_date := partition_date + INTERVAL '1 month';

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF audit_log_partitioned FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Schedule automatic partition creation via pg_cron
-- ============================================================================
-- Runs at midnight on the 25th of every month.

SELECT cron.schedule(
  'create_audit_log_partitions',
  '0 0 25 * *',
  'SELECT create_audit_log_partition()'
);

-- ============================================================================
-- STEP 5: Data migration (run during maintenance window)
-- ============================================================================
-- Uncomment and execute these statements to migrate existing data:
--
-- BEGIN;
--   -- Rename the original table
--   ALTER TABLE audit_logs RENAME TO audit_logs_old;
--
--   -- Rename the partitioned table to take its place
--   ALTER TABLE audit_log_partitioned RENAME TO audit_logs;
--
--   -- Copy data from old table to new partitioned table
--   INSERT INTO audit_logs SELECT * FROM audit_logs_old;
--
--   -- Verify row counts match
--   -- SELECT count(*) FROM audit_logs_old;
--   -- SELECT count(*) FROM audit_logs;
--
-- COMMIT;
--
-- -- After verification, drop the old table:
-- -- DROP TABLE audit_logs_old;
