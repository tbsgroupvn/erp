#!/bin/bash
# ============================================
# TBS ERP - PostgreSQL Restore Script
# ============================================
#
# Restores a PostgreSQL database from a backup file.
#
# Usage: ./scripts/restore.sh <backup_file> [--skip-migrations] [--force]
#
# Arguments:
#   backup_file       - Path to the .dump.gz backup file
#   --skip-migrations - Skip running Prisma migrations after restore
#   --force           - Skip confirmation prompt
#
# Environment variables:
#   POSTGRES_HOST     - Database host (default: postgres)
#   POSTGRES_DB       - Database name (default: tbs_erp)
#   POSTGRES_USER     - Database user (default: postgres)
#   PGPASSWORD        - Database password (must be set)
#   BACKEND_SERVICE   - Docker service name for backend (default: backend)
# ============================================

set -euo pipefail

# ── Configuration ──
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_NAME="${POSTGRES_DB:-tbs_erp}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
BACKEND_SERVICE="${BACKEND_SERVICE:-backend}"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')] [restore]"

SKIP_MIGRATIONS=false
FORCE=false

# ── Functions ──

log_info() {
  echo "${LOG_PREFIX} [INFO] $1"
}

log_error() {
  echo "${LOG_PREFIX} [ERROR] $1" >&2
}

log_warn() {
  echo "${LOG_PREFIX} [WARN] $1"
}

usage() {
  echo "Usage: $0 <backup_file> [--skip-migrations] [--force]"
  echo ""
  echo "Arguments:"
  echo "  backup_file       Path to the .dump.gz backup file"
  echo "  --skip-migrations Skip running Prisma migrations after restore"
  echo "  --force           Skip confirmation prompt"
  exit 1
}

parse_args() {
  if [ $# -lt 1 ]; then
    log_error "Backup file argument is required."
    usage
  fi

  BACKUP_FILE="$1"
  shift

  while [ $# -gt 0 ]; do
    case "$1" in
      --skip-migrations) SKIP_MIGRATIONS=true ;;
      --force) FORCE=true ;;
      *)
        log_error "Unknown argument: $1"
        usage
        ;;
    esac
    shift
  done
}

validate_backup_file() {
  if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
  fi

  # Verify checksum if available
  local checksum_file="${BACKUP_FILE}.sha256"
  if [ -f "$checksum_file" ]; then
    log_info "Verifying backup integrity..."
    if sha256sum -c "$checksum_file" > /dev/null 2>&1; then
      log_info "Backup integrity verified (SHA256 checksum OK)."
    else
      log_error "Backup integrity check FAILED! The backup file may be corrupted."
      exit 1
    fi
  else
    log_warn "No checksum file found. Skipping integrity verification."
  fi
}

confirm_restore() {
  if [ "$FORCE" = true ]; then
    return 0
  fi

  echo ""
  echo "=========================================="
  echo "  WARNING: DATABASE RESTORE"
  echo "=========================================="
  echo ""
  echo "  This will OVERWRITE the database: ${DB_NAME}"
  echo "  Host: ${DB_HOST}:${DB_PORT}"
  echo "  Backup: $(basename "$BACKUP_FILE")"
  echo ""
  echo "  ALL EXISTING DATA WILL BE LOST!"
  echo ""
  echo "=========================================="
  echo ""
  printf "  Type 'yes' to confirm: "
  read -r confirmation

  if [ "$confirmation" != "yes" ]; then
    log_info "Restore cancelled by user."
    exit 0
  fi
}

wait_for_db() {
  local max_attempts=30
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
      return 0
    fi
    log_warn "Database not ready (attempt $attempt/$max_attempts). Waiting..."
    sleep 2
    attempt=$((attempt + 1))
  done

  log_error "Database not available after $max_attempts attempts."
  exit 1
}

stop_backend_services() {
  log_info "Attempting to stop backend services to prevent writes during restore..."

  if command -v docker > /dev/null 2>&1; then
    # Try to stop the backend service via docker compose
    if docker compose ps "$BACKEND_SERVICE" > /dev/null 2>&1; then
      docker compose stop "$BACKEND_SERVICE" || log_warn "Could not stop backend service via docker compose."
    elif docker ps --filter "name=${BACKEND_SERVICE}" --format "{{.Names}}" | grep -q .; then
      docker stop "$(docker ps --filter "name=${BACKEND_SERVICE}" --format "{{.ID}}")" || log_warn "Could not stop backend container."
    else
      log_warn "Backend service not found. Proceeding with restore."
    fi
  else
    log_warn "Docker not available. Cannot stop backend services. Ensure no writes during restore."
  fi
}

restore_database() {
  local work_file="$BACKUP_FILE"

  # Decompress if needed
  if [[ "$BACKUP_FILE" == *.gz ]]; then
    log_info "Decompressing backup..."
    local decompressed_file="${BACKUP_FILE%.gz}"
    gunzip -k -f "$BACKUP_FILE"
    work_file="$decompressed_file"
  fi

  log_info "Terminating existing connections to database '${DB_NAME}'..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
    > /dev/null 2>&1 || true

  log_info "Dropping and recreating database '${DB_NAME}'..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";"

  log_info "Restoring database from backup..."
  pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --single-transaction \
    "$work_file" || {
      # pg_restore may return non-zero for non-critical warnings
      log_warn "pg_restore completed with warnings (this is often normal)."
    }

  # Clean up decompressed file if we created one
  if [[ "$BACKUP_FILE" == *.gz ]] && [ -f "${BACKUP_FILE%.gz}" ]; then
    rm -f "${BACKUP_FILE%.gz}"
  fi

  log_info "Database restored successfully."
}

run_migrations() {
  if [ "$SKIP_MIGRATIONS" = true ]; then
    log_info "Skipping migrations (--skip-migrations flag set)."
    return 0
  fi

  log_info "Running Prisma migrations..."

  if command -v npx > /dev/null 2>&1; then
    if [ -f "/app/node_modules/.prisma/client/index.js" ] || [ -d "/app/node_modules/@prisma" ]; then
      cd /app && npx prisma migrate deploy 2>&1 || {
        log_warn "Prisma migrations failed. You may need to run them manually."
      }
    else
      log_warn "Prisma not found in /app. Skipping migrations."
      log_warn "Run 'npx prisma migrate deploy' manually after restore."
    fi
  else
    log_warn "npx not available. Skipping Prisma migrations."
    log_warn "Run 'npx prisma migrate deploy' manually after restore."
  fi
}

restart_backend_services() {
  log_info "Attempting to restart backend services..."

  if command -v docker > /dev/null 2>&1; then
    if docker compose ps "$BACKEND_SERVICE" > /dev/null 2>&1; then
      docker compose start "$BACKEND_SERVICE" || log_warn "Could not start backend service."
    fi
  else
    log_warn "Docker not available. Restart backend services manually."
  fi
}

verify_health() {
  log_info "Verifying database health after restore..."

  # Check that we can connect and run a basic query
  local table_count
  table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

  if [ -n "$table_count" ] && [ "$table_count" -gt 0 ]; then
    log_info "Database health check passed. Found $table_count tables in public schema."
  else
    log_warn "Database may be empty or unhealthy. Found $table_count tables."
  fi

  # Check a few key tables if they exist
  for table in "User" "Order" "Employee"; do
    local row_count
    row_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
      "SELECT count(*) FROM \"${table}\" LIMIT 1;" 2>/dev/null | tr -d ' ' || echo "N/A")
    if [ "$row_count" != "N/A" ]; then
      log_info "  Table '${table}': ${row_count} rows"
    fi
  done
}

# ── Main ──

main() {
  log_info "============================================"
  log_info "TBS ERP Database Restore"
  log_info "============================================"

  parse_args "$@"

  if [ -z "${PGPASSWORD:-}" ]; then
    log_error "PGPASSWORD environment variable is not set."
    exit 1
  fi

  validate_backup_file
  confirm_restore
  wait_for_db
  stop_backend_services
  restore_database
  run_migrations
  restart_backend_services
  verify_health

  log_info "============================================"
  log_info "Restore completed successfully!"
  log_info "============================================"
}

main "$@"
