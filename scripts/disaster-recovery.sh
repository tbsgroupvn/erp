#!/bin/bash
# ============================================
# TBS ERP - Disaster Recovery Script
# ============================================
#
# Restores the TBS ERP system from a backup.
# This script orchestrates a full disaster recovery including:
#   - Pre-restore safety backup
#   - Database restoration from backup
#   - Redis cache clearing
#   - Service restart and health verification
#
# Run ONLY under supervision of a senior engineer.
#
# Usage:
#   ./scripts/disaster-recovery.sh <backup_file> [environment]
#   ./scripts/disaster-recovery.sh --list                       # List available backups
#
# Arguments:
#   backup_file   - Path to the .dump.gz backup file
#   environment   - staging (default) or production
#
# Environment variables:
#   POSTGRES_USER     - Database user (default: tbs_erp)
#   POSTGRES_DB       - Database name (default: tbs_erp)
#   PGPASSWORD        - Database password (must be set)
#   REDIS_PASSWORD    - Redis password (optional)
#   SLACK_WEBHOOK     - Slack webhook for notifications (optional)
#
# Prerequisites:
#   - Docker and docker-compose must be available
#   - The target environment compose file must exist
#   - Sufficient disk space for pre-restore backup
#
# ============================================

set -euo pipefail

# ── Configuration ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-/backups/tbs-erp}"
LOG_DIR="${LOG_DIR:-/var/log/tbs-erp}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')] [disaster-recovery]"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Timing
START_TIME=$(date +%s)

# ── Logging ──

log_info() {
  echo -e "${GREEN}[INFO]${NC}  ${LOG_PREFIX} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC}  ${LOG_PREFIX} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} ${LOG_PREFIX} $1" >&2
}

log_step() {
  echo -e "${CYAN}${BOLD}$1${NC}"
}

# ── Notification ──

send_notification() {
  local message="$1"
  if [ -n "${SLACK_WEBHOOK:-}" ]; then
    curl -sf -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"[DISASTER RECOVERY] TBS ERP: ${message}\"}" \
      > /dev/null 2>&1 || true
  fi
}

# ── Functions ──

usage() {
  echo "Usage: $0 <backup_file.dump.gz> [staging|production]"
  echo "       $0 --list"
  echo ""
  echo "Arguments:"
  echo "  backup_file   Path to the .dump.gz backup file"
  echo "  environment   Target environment: staging (default) or production"
  echo ""
  echo "Options:"
  echo "  --list        List available backup files"
  echo "  --help        Show this help message"
  exit 1
}

list_backups() {
  echo ""
  echo "Available backups:"
  echo ""
  echo "=== Daily ==="
  ls -lth "$BACKUP_DIR"/daily*/*.dump.gz 2>/dev/null || ls -lth /backups/daily_*.dump.gz 2>/dev/null || echo "  (none found)"
  echo ""
  echo "=== Weekly ==="
  ls -lth "$BACKUP_DIR"/weekly*/*.dump.gz 2>/dev/null || ls -lth /backups/weekly_*.dump.gz 2>/dev/null || echo "  (none found)"
  echo ""
  echo "=== Monthly ==="
  ls -lth "$BACKUP_DIR"/monthly*/*.dump.gz 2>/dev/null || ls -lth /backups/monthly_*.dump.gz 2>/dev/null || echo "  (none found)"
  echo ""
  echo "=== Pre-restore ==="
  ls -lth "$BACKUP_DIR"/pre-restore-*.dump.gz 2>/dev/null || ls -lth /backups/pre-restore-*.dump.gz 2>/dev/null || echo "  (none found)"
  exit 0
}

validate_inputs() {
  if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
  fi

  case "$ENVIRONMENT" in
    staging|production) ;;
    *)
      log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'."
      exit 1
      ;;
  esac

  # Determine the compose file
  if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.production.yml"
  else
    COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.staging.yml"
  fi

  if [ ! -f "$COMPOSE_FILE" ]; then
    log_error "Compose file not found: $COMPOSE_FILE"
    exit 1
  fi
}

confirm_production_restore() {
  if [ "$ENVIRONMENT" != "production" ]; then
    return 0
  fi

  echo ""
  echo -e "${RED}${BOLD}============================================${NC}"
  echo -e "${RED}${BOLD}  WARNING: PRODUCTION DISASTER RECOVERY${NC}"
  echo -e "${RED}${BOLD}============================================${NC}"
  echo ""
  echo "  You are about to restore PRODUCTION data."
  echo "  This will OVERWRITE all current production data."
  echo ""
  echo "  Backup file: $(basename "$BACKUP_FILE")"
  echo "  File size:   $(du -h "$BACKUP_FILE" | cut -f1)"
  echo "  File date:   $(stat -c '%y' "$BACKUP_FILE" 2>/dev/null || stat -f '%Sm' "$BACKUP_FILE" 2>/dev/null || echo 'unknown')"
  echo ""
  echo -e "${RED}${BOLD}============================================${NC}"
  echo ""
  printf "  Type 'RESTORE PRODUCTION' to confirm: "
  read -r CONFIRM
  if [ "$CONFIRM" != "RESTORE PRODUCTION" ]; then
    log_info "Aborted by user."
    exit 1
  fi
  echo ""
}

step_stop_services() {
  log_step "Step 1/6: Stopping application services..."

  docker-compose -f "$COMPOSE_FILE" stop backend erp-frontend cms-frontend 2>/dev/null || \
    docker compose -f "$COMPOSE_FILE" stop backend erp-frontend cms-frontend 2>/dev/null || \
    log_warn "Could not stop services via docker-compose. They may already be down."

  log_info "Application services stopped."
}

step_verify_backup() {
  log_step "Step 2/6: Verifying backup integrity..."

  # Check gzip integrity
  if gzip -t "$BACKUP_FILE" 2>/dev/null; then
    log_info "Backup gzip integrity: OK"
  else
    log_error "Backup file is corrupted or not a valid gzip file!"
    exit 1
  fi

  # Check SHA256 checksum if available
  local checksum_file="${BACKUP_FILE}.sha256"
  if [ -f "$checksum_file" ]; then
    if sha256sum -c "$checksum_file" > /dev/null 2>&1; then
      log_info "Backup SHA256 checksum: OK"
    else
      log_error "Backup SHA256 checksum MISMATCH! The file may have been tampered with."
      exit 1
    fi
  else
    log_warn "No SHA256 checksum file found. Skipping checksum verification."
  fi

  local file_size
  file_size=$(du -h "$BACKUP_FILE" | cut -f1)
  log_info "Backup file size: $file_size"
}

step_pre_restore_backup() {
  log_step "Step 3/6: Creating pre-restore backup..."

  mkdir -p "$BACKUP_DIR"
  PRE_RESTORE_BACKUP="${BACKUP_DIR}/pre-restore-${TIMESTAMP}.dump.gz"

  # Attempt to create a backup of the current state before overwriting
  if docker exec tbs_erp_postgres_prod pg_dump \
    -U "${POSTGRES_USER:-tbs_erp}" \
    "${POSTGRES_DB:-tbs_erp}" \
    -Fc 2>/dev/null | gzip > "$PRE_RESTORE_BACKUP" 2>/dev/null; then
    local pre_size
    pre_size=$(du -h "$PRE_RESTORE_BACKUP" | cut -f1)
    log_info "Pre-restore backup created: $PRE_RESTORE_BACKUP ($pre_size)"
  else
    # Try alternative container names
    if docker exec tbs_erp_postgres pg_dump \
      -U "${POSTGRES_USER:-tbs_erp}" \
      "${POSTGRES_DB:-tbs_erp}" \
      -Fc 2>/dev/null | gzip > "$PRE_RESTORE_BACKUP" 2>/dev/null; then
      log_info "Pre-restore backup created (using tbs_erp_postgres container)"
    else
      log_warn "Pre-restore backup failed (database may be down or inaccessible)"
      log_warn "Proceeding without pre-restore backup."
      rm -f "$PRE_RESTORE_BACKUP"
      PRE_RESTORE_BACKUP="(none - database was unreachable)"
    fi
  fi
}

step_restore_database() {
  log_step "Step 4/6: Restoring database from backup..."

  send_notification "Disaster recovery in progress for ${ENVIRONMENT}. Restoring from $(basename "$BACKUP_FILE")..."

  # Use the existing restore.sh if available for a more thorough restore
  if [ -f "$SCRIPT_DIR/restore.sh" ]; then
    log_info "Using existing restore.sh for database restoration..."
    PGPASSWORD="${PGPASSWORD:-}" "$SCRIPT_DIR/restore.sh" "$BACKUP_FILE" --force --skip-migrations 2>&1 || {
      log_warn "restore.sh exited with warnings. Checking database state..."
    }
  else
    # Fallback: direct pg_restore via docker
    log_info "Performing direct database restore via docker..."

    # Determine container name
    local pg_container="tbs_erp_postgres_prod"
    if ! docker ps --format '{{.Names}}' | grep -q "$pg_container"; then
      pg_container="tbs_erp_postgres"
    fi

    gunzip -c "$BACKUP_FILE" | docker exec -i "$pg_container" pg_restore \
      -U "${POSTGRES_USER:-tbs_erp}" \
      -d "${POSTGRES_DB:-tbs_erp}" \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges 2>/dev/null || {
        log_warn "pg_restore completed with warnings (this is often normal for custom format)."
      }
  fi

  log_info "Database restoration completed."
}

step_clear_cache() {
  log_step "Step 5/6: Clearing Redis cache..."

  # Try multiple container name variants
  local redis_flushed=false
  for container in tbs_erp_redis_prod tbs_erp_redis redis; do
    if docker ps --format '{{.Names}}' | grep -q "$container"; then
      if [ -n "${REDIS_PASSWORD:-}" ]; then
        docker exec "$container" redis-cli -a "$REDIS_PASSWORD" FLUSHALL 2>/dev/null && redis_flushed=true && break
      else
        docker exec "$container" redis-cli FLUSHALL 2>/dev/null && redis_flushed=true && break
      fi
    fi
  done

  if [ "$redis_flushed" = true ]; then
    log_info "Redis cache cleared successfully."
  else
    log_warn "Redis flush skipped (container not found or not accessible)."
  fi
}

step_start_services() {
  log_step "Step 6/6: Starting application services..."

  docker-compose -f "$COMPOSE_FILE" up -d backend erp-frontend cms-frontend 2>/dev/null || \
    docker compose -f "$COMPOSE_FILE" up -d backend erp-frontend cms-frontend 2>/dev/null || {
      log_error "Failed to start services via docker-compose!"
      exit 1
    }

  log_info "Services starting. Running health checks..."

  # Wait for health check
  local MAX_RETRIES=24
  local RETRY=0
  local HEALTH_URL="${HEALTH_URL:-http://localhost/api/v1/health/ready}"

  while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
      log_info "Health check: PASSED"
      return 0
    fi
    RETRY=$((RETRY + 1))
    log_info "Health check attempt $RETRY/$MAX_RETRIES... (waiting 10s)"
    sleep 10
  done

  # Health check failed
  log_error "Health check failed after $((MAX_RETRIES * 10)) seconds!"
  log_error "The system may need manual intervention."
  if [ -f "$PRE_RESTORE_BACKUP" ] && [ "$PRE_RESTORE_BACKUP" != "(none - database was unreachable)" ]; then
    log_error "Pre-restore backup available at: $PRE_RESTORE_BACKUP"
    log_error "To rollback: $0 $PRE_RESTORE_BACKUP $ENVIRONMENT"
  fi
  send_notification "CRITICAL: Health check failed after disaster recovery on ${ENVIRONMENT}. Manual intervention required!"
  return 1
}

# ── Parse Arguments ──

BACKUP_FILE="${1:-}"
ENVIRONMENT="${2:-staging}"

if [ -z "$BACKUP_FILE" ]; then
  usage
fi

case "$BACKUP_FILE" in
  --list) list_backups ;;
  --help) usage ;;
esac

# ── Main ──

main() {
  mkdir -p "$LOG_DIR"

  # Log to file as well
  LOG_FILE="$LOG_DIR/disaster-recovery-${TIMESTAMP}.log"
  exec > >(tee -a "$LOG_FILE") 2>&1

  echo ""
  echo -e "${BOLD}============================================${NC}"
  echo -e "${BOLD}  TBS ERP - DISASTER RECOVERY${NC}"
  echo -e "${BOLD}============================================${NC}"
  echo "  Environment: $ENVIRONMENT"
  echo "  Backup:      $BACKUP_FILE"
  echo "  Time:        $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "  Operator:    ${USER:-unknown}"
  echo "  Log file:    $LOG_FILE"
  echo -e "${BOLD}============================================${NC}"
  echo ""

  validate_inputs
  confirm_production_restore

  send_notification "Disaster recovery STARTED for ${ENVIRONMENT} by ${USER:-unknown}"

  step_stop_services
  step_verify_backup
  step_pre_restore_backup
  step_restore_database
  step_clear_cache

  local health_ok=true
  step_start_services || health_ok=false

  # Calculate elapsed time
  local ELAPSED=$(($(date +%s) - START_TIME))
  local MINUTES=$((ELAPSED / 60))
  local SECONDS=$((ELAPSED % 60))

  echo ""
  echo -e "${BOLD}============================================${NC}"
  if [ "$health_ok" = true ]; then
    echo -e "${GREEN}${BOLD}  DISASTER RECOVERY COMPLETED SUCCESSFULLY${NC}"
  else
    echo -e "${YELLOW}${BOLD}  DISASTER RECOVERY COMPLETED WITH WARNINGS${NC}"
  fi
  echo -e "${BOLD}============================================${NC}"
  echo "  Environment:        $ENVIRONMENT"
  echo "  Restored from:      $(basename "$BACKUP_FILE")"
  echo "  Pre-restore backup: $PRE_RESTORE_BACKUP"
  echo "  Duration:           ${MINUTES}m ${SECONDS}s"
  echo "  Log file:           $LOG_FILE"
  echo "  Time:               $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo -e "${BOLD}============================================${NC}"
  echo ""

  # Record recovery metadata
  mkdir -p "$(dirname "${LOG_DIR}/last-recovery.json")"
  cat > "${LOG_DIR}/last-recovery.json" << RECOVERY_EOF
{
  "environment": "$ENVIRONMENT",
  "backup_file": "$BACKUP_FILE",
  "pre_restore_backup": "$PRE_RESTORE_BACKUP",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date +%Y-%m-%dT%H:%M:%SZ)",
  "duration_seconds": $ELAPSED,
  "operator": "${USER:-unknown}",
  "health_check_passed": $health_ok,
  "log_file": "$LOG_FILE"
}
RECOVERY_EOF

  if [ "$health_ok" = true ]; then
    send_notification "Disaster recovery COMPLETED successfully for ${ENVIRONMENT} in ${MINUTES}m ${SECONDS}s"
  else
    send_notification "Disaster recovery completed with WARNINGS for ${ENVIRONMENT}. Health check did not pass. Manual review required."
  fi

  if [ "$health_ok" = true ]; then
    exit 0
  else
    exit 1
  fi
}

main
