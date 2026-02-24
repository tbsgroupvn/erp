-- ============================================================================
-- TBS ERP — Order Table Partitioning Strategy
-- ============================================================================
--
-- Purpose: Partition the orders table by year for improved query performance
-- as order volume grows. Orders are retained for 5+ years per Vietnamese tax
-- law (Luat Ke toan 2015, Article 41), so partitioning by year allows
-- efficient queries on recent data while keeping old data accessible.
--
-- This is a MANUAL migration — not managed by Prisma Migrate.
-- Execute this SQL against the production database during a maintenance window.
--
-- Prerequisites:
--   - PostgreSQL 12+ (native partitioning)
--   - pg_cron extension for automated partition creation
--   - Full database backup taken before execution
--
-- Reference: compliance/data-flow-diagram.md — Section 2 (Order Data Flow)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create the partitioned orders table
-- ============================================================================
-- Note: The schema mirrors the Prisma Order model from prisma/schema/order.prisma.
-- Only create this table when ready to migrate — columns must match exactly.

CREATE TABLE IF NOT EXISTS orders_partitioned (
  id              TEXT NOT NULL,
  code            TEXT NOT NULL,
  "customerId"    TEXT,
  "customerName"  TEXT,
  "serviceType"   TEXT,
  status          TEXT NOT NULL DEFAULT 'CREATED',
  "branchId"      TEXT,
  "saleId"        TEXT,
  "totalAmount"   DECIMAL(15,2) DEFAULT 0,
  currency        TEXT DEFAULT 'VND',
  note            TEXT,
  "internalNote"  TEXT,
  metadata        JSONB,
  "isDeleted"     BOOLEAN DEFAULT FALSE,
  "createdBy"     TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, "createdAt")
) PARTITION BY RANGE ("createdAt");

-- Indexes on the partitioned table (inherited by all partitions)
CREATE INDEX IF NOT EXISTS idx_orders_part_code
  ON orders_partitioned (code);

CREATE INDEX IF NOT EXISTS idx_orders_part_customer
  ON orders_partitioned ("customerId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_orders_part_status_created
  ON orders_partitioned (status, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_orders_part_branch_created
  ON orders_partitioned ("branchId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_orders_part_sale
  ON orders_partitioned ("saleId", "createdAt" DESC);

-- ============================================================================
-- STEP 2: Create yearly partitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders_2023 PARTITION OF orders_partitioned
  FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');

CREATE TABLE IF NOT EXISTS orders_2024 PARTITION OF orders_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS orders_2025 PARTITION OF orders_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS orders_2026 PARTITION OF orders_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS orders_2027 PARTITION OF orders_partitioned
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE TABLE IF NOT EXISTS orders_2028 PARTITION OF orders_partitioned
  FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');

-- ============================================================================
-- STEP 3: Auto-partition creation function
-- ============================================================================

CREATE OR REPLACE FUNCTION create_orders_partition()
RETURNS void AS $$
DECLARE
  next_year INT;
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Create partition for next year
  next_year := EXTRACT(YEAR FROM NOW())::INT + 1;
  partition_name := 'orders_' || next_year::TEXT;
  start_date := (next_year || '-01-01')::DATE;
  end_date := ((next_year + 1) || '-01-01')::DATE;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF orders_partitioned FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  ELSE
    RAISE NOTICE 'Partition already exists: %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Schedule automatic partition creation via pg_cron
-- ============================================================================
-- Runs at midnight on December 1st each year to create next year's partition.

SELECT cron.schedule(
  'create_orders_partitions',
  '0 0 1 12 *',
  'SELECT create_orders_partition()'
);

-- ============================================================================
-- STEP 5: Data migration (run during maintenance window)
-- ============================================================================
-- Uncomment and execute these statements to migrate existing data:
--
-- BEGIN;
--   ALTER TABLE orders RENAME TO orders_old;
--   ALTER TABLE orders_partitioned RENAME TO orders;
--   INSERT INTO orders SELECT * FROM orders_old;
--   -- Verify: SELECT count(*) FROM orders_old; SELECT count(*) FROM orders;
-- COMMIT;
--
-- -- After verification: DROP TABLE orders_old;
