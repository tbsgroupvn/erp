#!/bin/bash
# ============================================
# TBS ERP - PostgreSQL Replica Setup
# This script initializes the replica by
# taking a base backup from the primary.
# ============================================

set -e

echo "=== Setting up PostgreSQL Replica ==="

# Check if data directory is already initialized
if [ -s "/var/lib/postgresql/data/PG_VERSION" ]; then
    echo "Data directory already initialized, skipping base backup."
    exit 0
fi

echo "Waiting for primary to be ready..."
until pg_isready -h postgres -p 5432 -U "${POSTGRES_USER}"; do
    echo "Primary not ready yet, waiting..."
    sleep 2
done

echo "Taking base backup from primary..."
PGPASSWORD="${REPLICATION_PASSWORD}" pg_basebackup \
    -h postgres \
    -p 5432 \
    -U replicator \
    -D /var/lib/postgresql/data \
    -Fp \
    -Xs \
    -P \
    -R \
    -S replica_slot_1

# Configure standby settings (PostgreSQL 12+ uses standby.signal)
touch /var/lib/postgresql/data/standby.signal

# Append replication settings to postgresql.auto.conf
cat >> /var/lib/postgresql/data/postgresql.auto.conf <<EOF

# Replication settings (auto-configured by setup-replica.sh)
primary_conninfo = 'host=postgres port=5432 user=replicator password=${REPLICATION_PASSWORD} application_name=replica1'
primary_slot_name = 'replica_slot_1'
hot_standby = on
hot_standby_feedback = on
EOF

echo "=== Replica setup complete ==="
