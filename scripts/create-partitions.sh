#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Auto-create next month partitions for partitioned tables
# Run monthly via cron: 0 0 25 * * /opt/tbs-erp/scripts/create-partitions.sh
# ============================================

COMPOSE_FILE="docker-compose.selfhost.yml"
DB_USER="${POSTGRES_USER:-erp_user}"
DB_NAME="${POSTGRES_DB:-erp_db}"

# Calculate next month boundaries
NEXT_MONTH=$(date -d "+1 month" +%Y-%m-01)
MONTH_AFTER=$(date -d "+2 months" +%Y-%m-01)
PARTITION_SUFFIX=$(date -d "+1 month" +%Y_%m)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating partitions for ${NEXT_MONTH} to ${MONTH_AFTER} (suffix: ${PARTITION_SUFFIX})..."

SQL="
CREATE TABLE IF NOT EXISTS audit_logs_${PARTITION_SUFFIX}
  PARTITION OF audit_logs FOR VALUES FROM ('${NEXT_MONTH}') TO ('${MONTH_AFTER}');
CREATE TABLE IF NOT EXISTS tracking_events_${PARTITION_SUFFIX}
  PARTITION OF tracking_events FOR VALUES FROM ('${NEXT_MONTH}') TO ('${MONTH_AFTER}');
"

docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "$SQL"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Partitions created successfully for ${PARTITION_SUFFIX}"
