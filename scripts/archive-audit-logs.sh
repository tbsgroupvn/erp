#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Archive audit logs older than N months to audit_log_archives table
# Run weekly via cron: 0 3 * * 0 /opt/tbs-erp/scripts/archive-audit-logs.sh
# Usage: ./archive-audit-logs.sh [retention_months]
#   retention_months: number of months to keep (default: 6)
# ============================================

COMPOSE_FILE="docker-compose.selfhost.yml"
DB_USER="${POSTGRES_USER:-erp_user}"
DB_NAME="${POSTGRES_DB:-erp_db}"
RETENTION_MONTHS=${1:-6}

CUTOFF_DATE=$(date -d "-${RETENTION_MONTHS} months" +%Y-%m-%d)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Archiving audit logs older than ${CUTOFF_DATE} (${RETENTION_MONTHS} months retention)..."

SQL="
BEGIN;

-- Copy to archive table (skip duplicates)
INSERT INTO audit_log_archives (id, user_id, action, entity, entity_id, old_data, new_data, ip_address, created_at, archived_at)
SELECT id, user_id, action, entity, entity_id, old_data, new_data, ip_address, created_at, NOW()
FROM audit_logs
WHERE created_at < '${CUTOFF_DATE}'
ON CONFLICT (id) DO NOTHING;

-- Delete archived records from partitioned table
DELETE FROM audit_logs WHERE created_at < '${CUTOFF_DATE}';

COMMIT;
"

RESULT=$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "$SQL" 2>&1)
echo "$RESULT"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Archive completed."
