#!/bin/bash
# ============================================
# TBS ERP - PostgreSQL Replication Setup
# This script runs on the primary to create
# the replication user and configure slots.
# ============================================

set -e

echo "=== Setting up PostgreSQL replication ==="

# Create replication user if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'replicator') THEN
            CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '${REPLICATION_PASSWORD}';
            RAISE NOTICE 'Replication user "replicator" created.';
        ELSE
            ALTER ROLE replicator WITH PASSWORD '${REPLICATION_PASSWORD}';
            RAISE NOTICE 'Replication user "replicator" password updated.';
        END IF;
    END
    \$\$;
EOSQL

# Create replication slot if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_slot_1')
        THEN pg_create_physical_replication_slot('replica_slot_1')
        ELSE NULL
    END;
EOSQL

echo "=== Replication setup complete ==="
