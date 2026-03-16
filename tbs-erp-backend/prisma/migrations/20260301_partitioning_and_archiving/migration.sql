-- ============================================
-- MIGRATION: Partitioning & Archiving
-- Date: 2026-03-01
-- Description: Partition audit_logs and tracking_events by month
--              for improved query performance and easier data lifecycle management.
-- ============================================

-- ============================================
-- PART 1: AUDIT LOG PARTITIONING (by month)
-- ============================================
-- PostgreSQL cannot partition an existing table in-place.
-- Strategy: rename -> create partitioned -> copy -> drop old.

-- Step 1: Rename existing table
ALTER TABLE audit_logs RENAME TO audit_logs_old;

-- Step 2: Create partitioned table (same structure, without FK for partition compatibility)
CREATE TABLE audit_logs (
  id          TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  session_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Step 3: Create monthly partitions (2025-01 through 2026-12)
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE audit_logs_2025_03 PARTITION OF audit_logs FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE audit_logs_2025_04 PARTITION OF audit_logs FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE audit_logs_2025_05 PARTITION OF audit_logs FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE audit_logs_2025_06 PARTITION OF audit_logs FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE audit_logs_2025_07 PARTITION OF audit_logs FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE audit_logs_2025_08 PARTITION OF audit_logs FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE audit_logs_2025_09 PARTITION OF audit_logs FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE audit_logs_2025_10 PARTITION OF audit_logs FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE audit_logs_2025_11 PARTITION OF audit_logs FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE audit_logs_2025_12 PARTITION OF audit_logs FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE audit_logs_2026_08 PARTITION OF audit_logs FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE audit_logs_2026_09 PARTITION OF audit_logs FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE audit_logs_2026_10 PARTITION OF audit_logs FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE audit_logs_2026_11 PARTITION OF audit_logs FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE audit_logs_2026_12 PARTITION OF audit_logs FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Step 4: Recreate indexes on partitioned table
CREATE INDEX idx_audit_logs_entity_entityid ON audit_logs (entity, entity_id);
CREATE INDEX idx_audit_logs_userid_createdat ON audit_logs (user_id, created_at);
CREATE INDEX idx_audit_logs_userid ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_createdat ON audit_logs (created_at);

-- Step 5: Copy data from old table to new partitioned table
INSERT INTO audit_logs (id, user_id, action, entity, entity_id, old_data, new_data, ip_address, user_agent, session_id, created_at)
SELECT id, user_id, action, entity, entity_id, old_data, new_data, ip_address, user_agent, session_id, created_at
FROM audit_logs_old;

-- Step 6: Drop old table
DROP TABLE audit_logs_old;


-- ============================================
-- PART 2: TRACKING EVENTS PARTITIONING (by month)
-- ============================================

-- Step 1: Rename existing table
ALTER TABLE tracking_events RENAME TO tracking_events_old;

-- Step 2: Create partitioned table
CREATE TABLE tracking_events (
  id               TEXT NOT NULL,
  package_id       TEXT,
  container_id     TEXT,
  tracking_number  TEXT,
  event_type       TEXT NOT NULL,
  location         TEXT,
  description      TEXT,
  carrier          TEXT,
  event_timestamp  TIMESTAMPTZ NOT NULL,
  source           TEXT,
  raw_data         JSONB,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Step 3: Create monthly partitions (2025-01 through 2026-12)
CREATE TABLE tracking_events_2025_01 PARTITION OF tracking_events FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE tracking_events_2025_02 PARTITION OF tracking_events FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE tracking_events_2025_03 PARTITION OF tracking_events FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE tracking_events_2025_04 PARTITION OF tracking_events FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE tracking_events_2025_05 PARTITION OF tracking_events FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE tracking_events_2025_06 PARTITION OF tracking_events FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE tracking_events_2025_07 PARTITION OF tracking_events FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE tracking_events_2025_08 PARTITION OF tracking_events FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE tracking_events_2025_09 PARTITION OF tracking_events FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE tracking_events_2025_10 PARTITION OF tracking_events FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE tracking_events_2025_11 PARTITION OF tracking_events FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE tracking_events_2025_12 PARTITION OF tracking_events FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE tracking_events_2026_01 PARTITION OF tracking_events FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE tracking_events_2026_02 PARTITION OF tracking_events FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE tracking_events_2026_03 PARTITION OF tracking_events FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE tracking_events_2026_04 PARTITION OF tracking_events FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE tracking_events_2026_05 PARTITION OF tracking_events FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE tracking_events_2026_06 PARTITION OF tracking_events FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE tracking_events_2026_07 PARTITION OF tracking_events FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE tracking_events_2026_08 PARTITION OF tracking_events FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE tracking_events_2026_09 PARTITION OF tracking_events FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE tracking_events_2026_10 PARTITION OF tracking_events FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE tracking_events_2026_11 PARTITION OF tracking_events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE tracking_events_2026_12 PARTITION OF tracking_events FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Step 4: Recreate indexes on partitioned table
CREATE INDEX idx_tracking_events_packageid ON tracking_events (package_id);
CREATE INDEX idx_tracking_events_containerid ON tracking_events (container_id);
CREATE INDEX idx_tracking_events_trackingnumber ON tracking_events (tracking_number);
CREATE INDEX idx_tracking_events_eventtimestamp ON tracking_events (event_timestamp);
CREATE INDEX idx_tracking_events_createdat ON tracking_events (created_at);

-- Step 5: Copy data from old table to new partitioned table
INSERT INTO tracking_events (id, package_id, container_id, tracking_number, event_type, location, description, carrier, event_timestamp, source, raw_data, created_by, created_at)
SELECT id, package_id, container_id, tracking_number, event_type, location, description, carrier, event_timestamp, source, raw_data, created_by, created_at
FROM tracking_events_old;

-- Step 6: Drop old table
DROP TABLE tracking_events_old;


-- ============================================
-- PART 3: Ensure audit_log_archives table exists
-- (Should already exist from schema, but safe to verify)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log_archives (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_archives_entity_entityid ON audit_log_archives (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_archives_userid_createdat ON audit_log_archives (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_archives_archivedat ON audit_log_archives (archived_at);
