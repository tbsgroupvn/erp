#!/bin/bash
# ============================================
# TBS ERP - Automated Backup Schedule Setup
# ============================================
#
# Run this once to configure cron jobs for automated backups.
# This script installs system-level cron jobs that invoke
# the existing backup.sh script on a daily/weekly/monthly basis.
#
# Usage: sudo ./scripts/backup-schedule.sh
#
# Prerequisites:
#   - backup.sh must exist in the same directory
#   - crontab must be available on the system
#   - PGPASSWORD must be set in the environment or cron env
#
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backups/tbs-erp}"
LOG_DIR="${LOG_DIR:-/var/log/tbs-erp}"

# ── Validation ──

if [ ! -f "$SCRIPT_DIR/backup.sh" ]; then
  echo "ERROR: backup.sh not found in $SCRIPT_DIR"
  echo "This script must be located alongside backup.sh."
  exit 1
fi

# Create directories
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly"
mkdir -p "$LOG_DIR"

echo "Setting up TBS ERP automated backup schedule..."
echo ""

# ── Create the backup wrapper script ──
# This wrapper sets up the environment and delegates to the existing backup.sh

cat > "$SCRIPT_DIR/run-backup.sh" << 'WRAPPER_EOF'
#!/bin/bash
set -euo pipefail

BACKUP_TYPE="${1:-daily}"
BACKUP_DIR="${BACKUP_DIR:-/backups/tbs-erp}"
LOG_DIR="${LOG_DIR:-/var/log/tbs-erp}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/backup_${BACKUP_TYPE}_${TIMESTAMP}.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec >> "$LOG_FILE" 2>&1

echo "=== TBS ERP ${BACKUP_TYPE} Backup - $(date) ==="

# Database backup using the existing backup.sh
if [ -f "$SCRIPT_DIR/backup.sh" ]; then
  "$SCRIPT_DIR/backup.sh" "$BACKUP_TYPE"
else
  echo "ERROR: backup.sh not found. Falling back to direct pg_dump..."

  DUMP_FILE="$BACKUP_DIR/${BACKUP_TYPE}/db_${TIMESTAMP}.dump.gz"
  docker exec tbs_erp_postgres pg_dump -U "${POSTGRES_USER:-tbs_erp}" "${POSTGRES_DB:-tbs_erp}" -Fc | gzip > "$DUMP_FILE"
  echo "Database backup: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
fi

# Redis backup
REDIS_FILE="$BACKUP_DIR/${BACKUP_TYPE}/redis_${TIMESTAMP}.rdb"
docker exec tbs_erp_redis redis-cli -a "${REDIS_PASSWORD:-}" BGSAVE 2>/dev/null || true
sleep 5
docker cp tbs_erp_redis:/data/dump.rdb "$REDIS_FILE" 2>/dev/null || echo "Redis backup skipped (no data or container not running)"

# Cleanup old backups based on type
case "$BACKUP_TYPE" in
  daily)   find "$BACKUP_DIR/daily" -name "*.gz" -mtime +7 -delete 2>/dev/null || true ;;
  weekly)  find "$BACKUP_DIR/weekly" -name "*.gz" -mtime +30 -delete 2>/dev/null || true ;;
  monthly) find "$BACKUP_DIR/monthly" -name "*.gz" -mtime +365 -delete 2>/dev/null || true ;;
esac

echo "=== Backup completed at $(date) ==="

# Verify backup integrity
LATEST_DUMP=$(ls -t "$BACKUP_DIR"/${BACKUP_TYPE}_*.dump.gz 2>/dev/null | head -1)
if [ -n "$LATEST_DUMP" ] && [ -f "$LATEST_DUMP" ]; then
  gzip -t "$LATEST_DUMP" && echo "Backup integrity: OK" || echo "WARNING: Backup file may be corrupted!"
fi
WRAPPER_EOF

chmod +x "$SCRIPT_DIR/run-backup.sh"
echo "Created wrapper script: $SCRIPT_DIR/run-backup.sh"

# ── Install cron jobs ──

CRON_FILE="/tmp/tbs-erp-backup-cron"

# Preserve existing crontab entries (if any) that are NOT TBS ERP related
(crontab -l 2>/dev/null || true) | grep -v "# TBS ERP" | grep -v "run-backup.sh" | grep -v "backup.sh.*daily" | grep -v "backup.sh.*weekly" | grep -v "backup.sh.*monthly" > "$CRON_FILE" || true

cat >> "$CRON_FILE" << EOF

# TBS ERP Automated Backups
# Daily at 2:00 AM (keep 7 days)
0 2 * * * ${SCRIPT_DIR}/run-backup.sh daily

# Weekly on Sunday at 3:00 AM (keep 30 days)
0 3 * * 0 ${SCRIPT_DIR}/run-backup.sh weekly

# Monthly on the 1st at 4:00 AM (keep 365 days)
0 4 1 * * ${SCRIPT_DIR}/run-backup.sh monthly
EOF

crontab "$CRON_FILE"
rm -f "$CRON_FILE"

echo ""
echo "============================================"
echo "  Backup schedule installed successfully"
echo "============================================"
echo ""
echo "Schedule:"
echo "  - Daily at 02:00 AM    (retention: 7 days)"
echo "  - Weekly on Sun 03:00  (retention: 30 days)"
echo "  - Monthly on 1st 04:00 (retention: 365 days)"
echo ""
echo "Directories:"
echo "  Backups: $BACKUP_DIR"
echo "  Logs:    $LOG_DIR"
echo ""
echo "To verify, run: crontab -l"
echo "To test manually: $SCRIPT_DIR/run-backup.sh daily"
