#!/bin/bash
# ============================================
# TBS ERP - PostgreSQL Backup Script
# ============================================
#
# Daily PostgreSQL backup with rotation and optional S3 upload.
#
# Usage: ./scripts/backup.sh [daily|weekly|monthly]
#
# Environment variables:
#   POSTGRES_HOST     - Database host (default: postgres)
#   POSTGRES_DB       - Database name (default: tbs_erp)
#   POSTGRES_USER     - Database user (default: postgres)
#   PGPASSWORD        - Database password (must be set)
#   BACKUP_DIR        - Backup directory (default: /backups)
#   S3_BUCKET         - S3 bucket for remote backup (optional)
#   S3_ENDPOINT       - S3-compatible endpoint URL (optional)
#
# Retention policy:
#   daily   - kept for 7 days
#   weekly  - kept for 4 weeks
#   monthly - kept for 12 months
# ============================================

set -euo pipefail

# ── Configuration ──
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_NAME="${POSTGRES_DB:-tbs_erp}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_TYPE="${1:-daily}"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')] [backup]"

# Retention policy (number of backups to keep)
DAILY_KEEP=7
WEEKLY_KEEP=4
MONTHLY_KEEP=12

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

cleanup_on_error() {
  local file="$1"
  if [ -f "$file" ]; then
    rm -f "$file"
    log_warn "Cleaned up incomplete backup: $file"
  fi
}

validate_inputs() {
  case "$BACKUP_TYPE" in
    daily|weekly|monthly) ;;
    *)
      log_error "Invalid backup type: $BACKUP_TYPE. Must be daily, weekly, or monthly."
      exit 1
      ;;
  esac

  if [ -z "${PGPASSWORD:-}" ]; then
    log_error "PGPASSWORD environment variable is not set."
    exit 1
  fi
}

ensure_backup_dir() {
  mkdir -p "$BACKUP_DIR"
  if [ ! -w "$BACKUP_DIR" ]; then
    log_error "Backup directory $BACKUP_DIR is not writable."
    exit 1
  fi
}

check_disk_space() {
  # Require at least 1GB free space
  local available_kb
  available_kb=$(df "$BACKUP_DIR" | tail -1 | awk '{print $4}')
  local min_kb=1048576  # 1GB in KB

  if [ "$available_kb" -lt "$min_kb" ]; then
    log_error "Insufficient disk space. Available: ${available_kb}KB, Required: ${min_kb}KB"
    exit 1
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

create_backup() {
  local backup_file="${BACKUP_DIR}/${BACKUP_TYPE}_${DB_NAME}_${TIMESTAMP}.dump"
  local compressed_file="${backup_file}.gz"

  log_info "Starting ${BACKUP_TYPE} backup of database '${DB_NAME}' from ${DB_HOST}:${DB_PORT}..."

  # Set trap to clean up on failure
  trap "cleanup_on_error '$backup_file'; cleanup_on_error '$compressed_file'" ERR

  # Create the backup using custom format (supports parallel restore)
  pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -Fc \
    --no-owner \
    --no-privileges \
    -f "$backup_file"

  if [ ! -f "$backup_file" ]; then
    log_error "Backup file was not created."
    exit 1
  fi

  local raw_size
  raw_size=$(du -h "$backup_file" | cut -f1)
  log_info "Backup created: ${raw_size} (uncompressed custom format)"

  # Compress the backup
  gzip -f "$backup_file"

  if [ ! -f "$compressed_file" ]; then
    log_error "Compressed backup file was not created."
    exit 1
  fi

  local compressed_size
  compressed_size=$(du -h "$compressed_file" | cut -f1)
  log_info "Compressed backup: ${compressed_size}"

  # Generate checksum for integrity verification
  local checksum_file="${compressed_file}.sha256"
  sha256sum "$compressed_file" > "$checksum_file"
  log_info "Checksum saved: ${checksum_file}"

  # Reset trap
  trap - ERR

  echo "$compressed_file"
}

rotate_backups() {
  log_info "Rotating old ${BACKUP_TYPE} backups..."

  local keep_count
  case "$BACKUP_TYPE" in
    daily)   keep_count=$DAILY_KEEP ;;
    weekly)  keep_count=$WEEKLY_KEEP ;;
    monthly) keep_count=$MONTHLY_KEEP ;;
  esac

  # Find and sort backups by modification time (newest first)
  local backup_count
  backup_count=$(find "$BACKUP_DIR" -name "${BACKUP_TYPE}_${DB_NAME}_*.dump.gz" -type f | wc -l)

  if [ "$backup_count" -gt "$keep_count" ]; then
    local to_delete=$((backup_count - keep_count))
    log_info "Removing $to_delete old ${BACKUP_TYPE} backup(s) (keeping $keep_count)..."

    # Delete oldest backups (and their checksums)
    find "$BACKUP_DIR" -name "${BACKUP_TYPE}_${DB_NAME}_*.dump.gz" -type f \
      | sort \
      | head -n "$to_delete" \
      | while read -r old_backup; do
          rm -f "$old_backup" "${old_backup}.sha256"
          log_info "Deleted old backup: $(basename "$old_backup")"
        done
  else
    log_info "No old backups to rotate ($backup_count <= $keep_count)."
  fi
}

upload_to_s3() {
  local backup_file="$1"

  if [ -z "${S3_BUCKET:-}" ]; then
    return 0
  fi

  log_info "Uploading backup to S3: s3://${S3_BUCKET}/..."

  # Check if aws CLI is available; if not, try to use wget/curl as fallback
  if ! command -v aws > /dev/null 2>&1; then
    log_warn "AWS CLI not available. Skipping S3 upload. Install aws-cli to enable remote backups."
    return 0
  fi

  local s3_path="s3://${S3_BUCKET}/backups/${BACKUP_TYPE}/$(basename "$backup_file")"
  local s3_args=""

  if [ -n "${S3_ENDPOINT:-}" ]; then
    s3_args="--endpoint-url ${S3_ENDPOINT}"
  fi

  # shellcheck disable=SC2086
  if aws s3 cp "$backup_file" "$s3_path" $s3_args; then
    log_info "Backup uploaded to S3: ${s3_path}"

    # Also upload checksum
    local checksum_file="${backup_file}.sha256"
    if [ -f "$checksum_file" ]; then
      # shellcheck disable=SC2086
      aws s3 cp "$checksum_file" "${s3_path}.sha256" $s3_args
    fi
  else
    log_error "Failed to upload backup to S3."
    # Don't exit -- local backup is still valid
  fi
}

# ── Main ──

main() {
  log_info "============================================"
  log_info "TBS ERP Backup - ${BACKUP_TYPE}"
  log_info "============================================"

  validate_inputs
  ensure_backup_dir
  check_disk_space
  wait_for_db

  local backup_file
  backup_file=$(create_backup)

  rotate_backups
  upload_to_s3 "$backup_file"

  log_info "============================================"
  log_info "Backup completed successfully: $(basename "$backup_file")"
  log_info "============================================"
}

main "$@"
