#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Clean up AR aging snapshots older than N days
# Keeps the first snapshot of each month per customer for historical reference.
# Run monthly via cron: 0 4 1 * * /opt/tbs-erp/scripts/cleanup-aging-snapshots.sh
# Usage: ./cleanup-aging-snapshots.sh [retention_days]
#   retention_days: number of days to keep (default: 90)
# ============================================

COMPOSE_FILE="docker-compose.selfhost.yml"
DB_USER="${POSTGRES_USER:-erp_user}"
DB_NAME="${POSTGRES_DB:-erp_db}"
RETENTION_DAYS=${1:-90}

CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning AR aging snapshots older than ${CUTOFF_DATE} (${RETENTION_DAYS} days retention)..."
echo "Keeping first snapshot of each month per customer for historical reference..."

SQL="
BEGIN;

-- Delete daily snapshots older than retention period,
-- but keep the first snapshot of each month per customer
DELETE FROM ar_aging_snapshots
WHERE snapshot_date < '${CUTOFF_DATE}'
  AND id NOT IN (
    SELECT DISTINCT ON (customer_id, date_trunc('month', snapshot_date))
      id
    FROM ar_aging_snapshots
    WHERE snapshot_date < '${CUTOFF_DATE}'
    ORDER BY customer_id, date_trunc('month', snapshot_date), snapshot_date ASC
  );

COMMIT;
"

RESULT=$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "$SQL" 2>&1)
echo "$RESULT"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleanup completed."
