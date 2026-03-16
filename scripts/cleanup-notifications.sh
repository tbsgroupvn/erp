#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Clean up old notifications
# - Read notifications older than 30 days: deleted
# - All notifications older than 90 days: deleted regardless of read status
# Run daily via cron: 0 2 * * * /opt/tbs-erp/scripts/cleanup-notifications.sh
# ============================================

COMPOSE_FILE="docker-compose.selfhost.yml"
DB_USER="${POSTGRES_USER:-erp_user}"
DB_NAME="${POSTGRES_DB:-erp_db}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning old notifications..."

SQL="
BEGIN;

-- Delete read notifications older than 30 days
DELETE FROM notifications
WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';

-- Delete all notifications older than 90 days regardless of read status
DELETE FROM notifications
WHERE created_at < NOW() - INTERVAL '90 days';

COMMIT;
"

RESULT=$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "$SQL" 2>&1)
echo "$RESULT"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Notification cleanup completed."
