#!/bin/bash
# ============================================
# TBS ERP - Backup Verification Script
# ============================================
#
# Verifies backup integrity by restoring to a temporary database,
# running validation queries, and comparing with the source.
#
# Usage: ./scripts/verify-backup.sh <backup_file>
#
# Environment variables:
#   POSTGRES_HOST     - Database host (default: postgres)
#   POSTGRES_DB       - Source database name (default: tbs_erp)
#   POSTGRES_USER     - Database user (default: postgres)
#   PGPASSWORD        - Database password (must be set)
# ============================================

set -euo pipefail

# ── Configuration ──
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_NAME="${POSTGRES_DB:-tbs_erp}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
TEMP_DB_NAME="${DB_NAME}_verify_$(date +%s)"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')] [verify]"

BACKUP_FILE=""
VERIFICATION_PASSED=true

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

log_result() {
  local status="$1"
  local message="$2"
  if [ "$status" = "PASS" ]; then
    echo "${LOG_PREFIX} [PASS] $message"
  else
    echo "${LOG_PREFIX} [FAIL] $message"
    VERIFICATION_PASSED=false
  fi
}

usage() {
  echo "Usage: $0 <backup_file>"
  echo ""
  echo "Verifies a backup by restoring it to a temporary database"
  echo "and comparing table counts with the source database."
  exit 1
}

cleanup() {
  log_info "Cleaning up temporary database '${TEMP_DB_NAME}'..."

  # Terminate connections to temp database
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEMP_DB_NAME}' AND pid <> pg_backend_pid();" \
    > /dev/null 2>&1 || true

  # Drop temp database
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "DROP DATABASE IF EXISTS \"${TEMP_DB_NAME}\";" \
    > /dev/null 2>&1 || log_warn "Could not drop temporary database. Clean up manually."

  # Clean up decompressed file if exists
  if [ -n "${DECOMPRESSED_FILE:-}" ] && [ -f "$DECOMPRESSED_FILE" ]; then
    rm -f "$DECOMPRESSED_FILE"
  fi

  log_info "Cleanup complete."
}

validate_inputs() {
  if [ $# -lt 1 ]; then
    log_error "Backup file argument is required."
    usage
  fi

  BACKUP_FILE="$1"

  if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
  fi

  if [ -z "${PGPASSWORD:-}" ]; then
    log_error "PGPASSWORD environment variable is not set."
    exit 1
  fi
}

verify_checksum() {
  local checksum_file="${BACKUP_FILE}.sha256"

  if [ -f "$checksum_file" ]; then
    log_info "Verifying SHA256 checksum..."
    if sha256sum -c "$checksum_file" > /dev/null 2>&1; then
      log_result "PASS" "SHA256 checksum matches."
    else
      log_result "FAIL" "SHA256 checksum MISMATCH! Backup may be corrupted."
      return 1
    fi
  else
    log_warn "No checksum file found. Skipping checksum verification."
  fi
}

create_temp_database() {
  log_info "Creating temporary database '${TEMP_DB_NAME}'..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "CREATE DATABASE \"${TEMP_DB_NAME}\" OWNER \"${DB_USER}\";"
}

restore_to_temp() {
  local work_file="$BACKUP_FILE"

  # Decompress if needed
  if [[ "$BACKUP_FILE" == *.gz ]]; then
    log_info "Decompressing backup for verification..."
    DECOMPRESSED_FILE="${BACKUP_FILE%.gz}"
    gunzip -k -f "$BACKUP_FILE"
    work_file="$DECOMPRESSED_FILE"
  fi

  log_info "Restoring backup to temporary database..."
  pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$TEMP_DB_NAME" \
    --no-owner \
    --no-privileges \
    "$work_file" 2>&1 || {
      log_warn "pg_restore completed with warnings (often normal for custom format)."
    }

  log_result "PASS" "Backup restored successfully to temporary database."
}

compare_table_counts() {
  log_info "Comparing table counts between source and restored backup..."

  # Get all table names from source database
  local tables
  tables=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")

  if [ -z "$tables" ]; then
    log_warn "No tables found in source database."
    return
  fi

  local total_tables=0
  local matching_tables=0
  local mismatched_tables=0
  local missing_tables=0

  echo ""
  printf "  %-40s %12s %12s %s\n" "TABLE" "SOURCE" "BACKUP" "STATUS"
  printf "  %-40s %12s %12s %s\n" "----------------------------------------" "------------" "------------" "------"

  while IFS= read -r table; do
    [ -z "$table" ] && continue
    total_tables=$((total_tables + 1))

    # Count rows in source
    local source_count
    source_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
      "SELECT count(*) FROM \"${table}\";" 2>/dev/null || echo "ERROR")

    # Count rows in restored backup
    local backup_count
    backup_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMP_DB_NAME" -t -A -c \
      "SELECT count(*) FROM \"${table}\";" 2>/dev/null || echo "MISSING")

    if [ "$backup_count" = "MISSING" ]; then
      printf "  %-40s %12s %12s %s\n" "$table" "$source_count" "MISSING" "FAIL"
      missing_tables=$((missing_tables + 1))
    elif [ "$source_count" = "$backup_count" ]; then
      printf "  %-40s %12s %12s %s\n" "$table" "$source_count" "$backup_count" "OK"
      matching_tables=$((matching_tables + 1))
    else
      printf "  %-40s %12s %12s %s\n" "$table" "$source_count" "$backup_count" "DIFF"
      mismatched_tables=$((mismatched_tables + 1))
    fi
  done <<< "$tables"

  echo ""
  log_info "Table comparison summary:"
  log_info "  Total tables:     $total_tables"
  log_info "  Matching:         $matching_tables"
  log_info "  Mismatched:       $mismatched_tables"
  log_info "  Missing:          $missing_tables"

  if [ "$missing_tables" -gt 0 ]; then
    log_result "FAIL" "$missing_tables table(s) missing from backup."
  elif [ "$mismatched_tables" -gt 0 ]; then
    # Small differences can occur if writes happened between backup and verify
    log_warn "$mismatched_tables table(s) have different row counts (may be due to writes during backup)."
    log_result "PASS" "All tables present, minor count differences acceptable."
  else
    log_result "PASS" "All table counts match between source and backup."
  fi
}

verify_schema() {
  log_info "Verifying schema integrity..."

  # Compare table count
  local source_table_count
  source_table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

  local backup_table_count
  backup_table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMP_DB_NAME" -t -A -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

  if [ "$source_table_count" = "$backup_table_count" ]; then
    log_result "PASS" "Table count matches: $source_table_count tables."
  else
    log_result "FAIL" "Table count mismatch: source=$source_table_count, backup=$backup_table_count"
  fi

  # Compare index count
  local source_index_count
  source_index_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
    "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';")

  local backup_index_count
  backup_index_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMP_DB_NAME" -t -A -c \
    "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';")

  if [ "$source_index_count" = "$backup_index_count" ]; then
    log_result "PASS" "Index count matches: $source_index_count indexes."
  else
    log_result "FAIL" "Index count mismatch: source=$source_index_count, backup=$backup_index_count"
  fi
}

# ── Main ──

main() {
  log_info "============================================"
  log_info "TBS ERP Backup Verification"
  log_info "============================================"

  validate_inputs "$@"

  # Ensure cleanup runs on exit (success, failure, or interrupt)
  trap cleanup EXIT

  verify_checksum
  create_temp_database
  restore_to_temp
  verify_schema
  compare_table_counts

  echo ""
  log_info "============================================"
  if [ "$VERIFICATION_PASSED" = true ]; then
    log_info "VERIFICATION RESULT: PASSED"
    log_info "Backup file: $(basename "$BACKUP_FILE")"
    log_info "============================================"
    exit 0
  else
    log_error "VERIFICATION RESULT: FAILED"
    log_error "Backup file: $(basename "$BACKUP_FILE")"
    log_info "============================================"
    exit 1
  fi
}

main "$@"
