#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Create next month's audit_logs partition
#
# Run via cron on the 25th of each month:
#   0 0 25 * * cd /opt/tbs-erp && ./tbs-erp-backend/scripts/create-audit-partition.sh >> /var/log/erp-partitions.log 2>&1
#
# Can also be invoked manually:
#   DATABASE_URL="postgres://user:pass@host:5432/db" ./create-audit-partition.sh
#
# Environment variables:
#   DATABASE_URL  — full PostgreSQL connection string (required)
#                   OR set POSTGRES_USER / POSTGRES_DB / POSTGRES_HOST
#                   and the script will build the URL from compose.
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.selfhost.yml"
DB_USER="${POSTGRES_USER:-erp_user}"
DB_NAME="${POSTGRES_DB:-erp_db}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# ---- Compute partition date boundaries -------------------------
# GNU date is required (-d flag). On macOS use: brew install coreutils
NEXT_MONTH_START=$(date -d "+1 month" +%Y-%m-01)
MONTH_AFTER_START=$(date -d "+2 months" +%Y-%m-01)
# Suffix matches create-partitions.sh convention: YYYY_MM
PARTITION_SUFFIX=$(date -d "+1 month" +%Y_%m)
PARTITION_NAME="audit_logs_${PARTITION_SUFFIX}"

log "Preparing partition: ${PARTITION_NAME}"
log "  Range: ${NEXT_MONTH_START} <= created_at < ${MONTH_AFTER_START}"

SQL="
CREATE TABLE IF NOT EXISTS ${PARTITION_NAME}
  PARTITION OF audit_logs
  FOR VALUES FROM ('${NEXT_MONTH_START}') TO ('${MONTH_AFTER_START}');
"

# ---- Execute against database ----------------------------------
if [[ -n "${DATABASE_URL:-}" ]]; then
  # Direct psql connection via DATABASE_URL
  log "Connecting via DATABASE_URL..."
  psql "${DATABASE_URL}" -c "${SQL}"
else
  # Fall back to docker compose exec (production selfhost setup)
  log "Connecting via docker compose (${COMPOSE_FILE})..."
  docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    psql -U "${DB_USER}" -d "${DB_NAME}" -c "${SQL}"
fi

log "Partition ${PARTITION_NAME} created (or already existed)."

# ---- Optional: also create the same period for tracking_events -
# Uncomment if tracking_events is also partitioned (see create-partitions.sh).
# TRACKING_PARTITION="tracking_events_${PARTITION_SUFFIX}"
# SQL_TRACKING="
# CREATE TABLE IF NOT EXISTS ${TRACKING_PARTITION}
#   PARTITION OF tracking_events
#   FOR VALUES FROM ('${NEXT_MONTH_START}') TO ('${MONTH_AFTER_START}');
# "
# if [[ -n "${DATABASE_URL:-}" ]]; then
#   psql "${DATABASE_URL}" -c "${SQL_TRACKING}"
# else
#   docker compose -f "${COMPOSE_FILE}" exec -T postgres \
#     psql -U "${DB_USER}" -d "${DB_NAME}" -c "${SQL_TRACKING}"
# fi
# log "Partition ${TRACKING_PARTITION} created (or already existed)."
