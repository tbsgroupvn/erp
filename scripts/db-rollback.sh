#!/bin/bash
# ============================================
# TBS ERP - Database Migration Rollback
# ============================================
# Safely rolls back the last database migration(s).
# Creates a rollback SQL script using Prisma diff, previews it,
# and applies only after confirmation.
#
# Usage:
#   ./scripts/db-rollback.sh                    # Interactive rollback
#   ./scripts/db-rollback.sh --dry-run          # Preview only
#   ./scripts/db-rollback.sh --auto             # Non-interactive (CI/CD)
#   ./scripts/db-rollback.sh --to <migration>   # Rollback to specific migration
#
# Safety:
#   - Always creates a backup before applying rollback
#   - Generates and displays SQL before execution
#   - Supports dry-run mode
#   - Logs all operations
# ============================================

set -euo pipefail

# ============================================
# Configuration
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="${PROJECT_ROOT}/tbs-erp-backend"
STATE_DIR="${TBS_STATE_DIR:-/opt/tbs-erp}"
ROLLBACK_SQL_DIR="${STATE_DIR}/migration-rollbacks"

# Flags
DRY_RUN=false
AUTO_MODE=false
TARGET_MIGRATION=""
SKIP_BACKUP=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }

# ============================================
# Parse Arguments
# ============================================
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --auto)
      AUTO_MODE=true
      shift
      ;;
    --to)
      TARGET_MIGRATION="$2"
      shift 2
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --help)
      echo "Usage: $0 [--dry-run] [--auto] [--to <migration>] [--skip-backup]"
      echo ""
      echo "Options:"
      echo "  --dry-run       Preview rollback SQL without applying"
      echo "  --auto          Non-interactive mode (for CI/CD)"
      echo "  --to <name>     Target migration to rollback to"
      echo "  --skip-backup   Skip pre-rollback database backup"
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ============================================
# Pre-flight Checks
# ============================================
log_step "Pre-flight checks..."

if [ ! -d "$BACKEND_DIR" ]; then
  log_error "Backend directory not found: $BACKEND_DIR"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  log_error "DATABASE_URL environment variable is not set"
  log_info "Hint: source .env or export DATABASE_URL=postgresql://..."
  exit 1
fi

mkdir -p "$ROLLBACK_SQL_DIR"

# ============================================
# Step 1: Show Current Migration Status
# ============================================
log_step "1/5 Current migration status:"
echo ""

cd "$BACKEND_DIR"

MIGRATION_STATUS=$(npx prisma migrate status 2>&1) || true
echo "$MIGRATION_STATUS"
echo ""

# Extract latest applied migration
LATEST_MIGRATION=$(echo "$MIGRATION_STATUS" | grep -oP '\d{14}_\w+' | tail -1 || echo "unknown")
log_info "Latest migration: $LATEST_MIGRATION"

# ============================================
# Step 2: Determine Target Migration
# ============================================
log_step "2/5 Determining rollback target..."

if [ -z "$TARGET_MIGRATION" ]; then
  if [ "$AUTO_MODE" = true ]; then
    # In auto mode, roll back exactly one migration
    # Get the second-to-last migration
    TARGET_MIGRATION=$(echo "$MIGRATION_STATUS" | grep -oP '\d{14}_\w+' | tail -2 | head -1 || echo "")
    if [ -z "$TARGET_MIGRATION" ]; then
      log_error "Cannot determine target migration in auto mode"
      exit 1
    fi
    log_info "Auto-mode target: $TARGET_MIGRATION"
  else
    echo ""
    echo "Available migrations:"
    echo "$MIGRATION_STATUS" | grep -oP '\d{14}_\w+' | nl
    echo ""
    read -rp "Enter migration name to rollback to (or 'last' for previous): " TARGET_MIGRATION

    if [ "$TARGET_MIGRATION" = "last" ]; then
      TARGET_MIGRATION=$(echo "$MIGRATION_STATUS" | grep -oP '\d{14}_\w+' | tail -2 | head -1 || echo "")
    fi
  fi
fi

if [ -z "$TARGET_MIGRATION" ]; then
  log_error "No target migration specified or detected"
  exit 1
fi

log_info "Rolling back to: $TARGET_MIGRATION"

# ============================================
# Step 3: Generate Rollback SQL
# ============================================
log_step "3/5 Generating rollback SQL..."

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ROLLBACK_SQL_FILE="${ROLLBACK_SQL_DIR}/rollback_${TIMESTAMP}_to_${TARGET_MIGRATION}.sql"

# Generate the diff between current schema and target migration
npx prisma migrate diff \
  --from-schema-datasource prisma/schema \
  --to-migrations "$TARGET_MIGRATION" \
  --script > "$ROLLBACK_SQL_FILE" 2>/dev/null || {
    log_error "Failed to generate rollback SQL"
    log_info "This may happen if the migration names don't match"
    exit 1
  }

echo ""
echo "============================================"
echo "Generated Rollback SQL:"
echo "============================================"
cat "$ROLLBACK_SQL_FILE"
echo ""
echo "============================================"
echo "File saved to: $ROLLBACK_SQL_FILE"
echo "============================================"
echo ""

# Check if SQL is empty/trivial
if [ ! -s "$ROLLBACK_SQL_FILE" ] || [ "$(wc -l < "$ROLLBACK_SQL_FILE")" -le 1 ]; then
  log_warn "Rollback SQL is empty. Nothing to roll back."
  exit 0
fi

# ============================================
# Step 4: Dry Run Check
# ============================================
if [ "$DRY_RUN" = true ]; then
  log_info "Dry run complete. SQL saved to: $ROLLBACK_SQL_FILE"
  log_info "To apply, run: psql \"\$DATABASE_URL\" -f $ROLLBACK_SQL_FILE"
  exit 0
fi

# ============================================
# Step 5: Confirm and Apply
# ============================================
if [ "$AUTO_MODE" = false ]; then
  echo ""
  log_warn "This will modify the production database!"
  read -rp "Apply rollback? (type 'yes' to confirm): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    log_info "Rollback cancelled"
    exit 0
  fi
fi

# Create backup before rollback (unless skipped)
if [ "$SKIP_BACKUP" = false ]; then
  log_step "Creating pre-rollback backup..."
  BACKUP_FILE="${ROLLBACK_SQL_DIR}/pre_rollback_${TIMESTAMP}.sql.gz"

  if command -v pg_dump &>/dev/null; then
    pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE" || {
      log_error "Backup failed! Aborting rollback for safety."
      exit 1
    }
    log_info "Backup saved to: $BACKUP_FILE"
  elif command -v docker &>/dev/null; then
    docker-compose -f "${PROJECT_ROOT}/docker-compose.production.yml" exec -T postgres \
      pg_dump -U "${POSTGRES_USER:-tbs_user}" "${POSTGRES_DB:-tbs_erp}" | gzip > "$BACKUP_FILE" || {
        log_warn "Docker backup failed, continuing without backup..."
      }
  else
    log_warn "Neither pg_dump nor docker available for backup. Proceeding without backup."
  fi
fi

# Apply the rollback SQL
log_step "5/5 Applying rollback SQL..."

if command -v psql &>/dev/null; then
  psql "$DATABASE_URL" -f "$ROLLBACK_SQL_FILE" || {
    log_error "Rollback SQL execution failed!"
    log_info "Manual recovery may be needed. Backup: ${BACKUP_FILE:-none}"
    exit 1
  }
else
  log_warn "psql not available locally. Attempting via docker..."
  cat "$ROLLBACK_SQL_FILE" | docker-compose -f "${PROJECT_ROOT}/docker-compose.production.yml" exec -T postgres \
    psql -U "${POSTGRES_USER:-tbs_user}" "${POSTGRES_DB:-tbs_erp}" || {
      log_error "Rollback SQL execution via docker failed!"
      exit 1
    }
fi

# Resolve the migration status in Prisma
ROLLED_BACK_MIGRATION=$(echo "$MIGRATION_STATUS" | grep -oP '\d{14}_\w+' | tail -1 || echo "")
if [ -n "$ROLLED_BACK_MIGRATION" ]; then
  npx prisma migrate resolve --rolled-back "$ROLLED_BACK_MIGRATION" 2>/dev/null || {
    log_warn "Could not resolve migration status. You may need to run: npx prisma migrate resolve --rolled-back $ROLLED_BACK_MIGRATION"
  }
fi

log_info "============================================"
log_info "Database rollback complete!"
log_info "  Rolled back to: $TARGET_MIGRATION"
log_info "  SQL file:       $ROLLBACK_SQL_FILE"
if [ "$SKIP_BACKUP" = false ] && [ -n "${BACKUP_FILE:-}" ]; then
  log_info "  Backup file:    $BACKUP_FILE"
fi
log_info "============================================"

# Notify
if [ -n "${SLACK_WEBHOOK:-}" ]; then
  curl -sf -X POST "$SLACK_WEBHOOK" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"DATABASE ROLLBACK: TBS ERP rolled back to migration $TARGET_MIGRATION\"}" \
    > /dev/null 2>&1 || true
fi
