#!/usr/bin/env bash
set -euo pipefail

# ============================================
# ERP Self-Hosted Update Script
# Pull latest code, rebuild, migrate, restart
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.selfhost.yml"

print_step() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  ERP Self-Hosted Update${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  print_error ".env file not found. Run setup.sh first."
  exit 1
fi

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
  print_error "${COMPOSE_FILE} not found."
  exit 1
fi

# Step 1: Pull latest code
echo "Step 1: Pulling latest changes..."
if git rev-parse --is-inside-work-tree &>/dev/null; then
  git pull --ff-only || {
    print_warning "git pull failed. You may have local changes. Resolve and re-run."
    exit 1
  }
  print_step "Code updated"
else
  print_warning "Not a git repository. Skipping code pull."
fi

# Step 2: Rebuild images
echo ""
echo "Step 2: Rebuilding Docker images..."
docker compose -f "$COMPOSE_FILE" build
print_step "Images rebuilt"

# Step 3: Backup database before migration
echo ""
echo "Step 3: Backing up database before migration..."
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/backup_$(date +%Y%m%d_%H%M%S).sql"

POSTGRES_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q postgres)
if [ -z "$POSTGRES_CONTAINER" ]; then
  print_error "PostgreSQL container is not running. Cannot create backup."
  exit 1
fi

docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-erp_user}" \
  -d "${POSTGRES_DB:-erp_db}" \
  --no-owner --clean --if-exists \
  > "$BACKUP_FILE" 2>/dev/null

if [ $? -ne 0 ] || [ ! -s "$BACKUP_FILE" ]; then
  rm -f "$BACKUP_FILE"
  print_error "Database backup failed. Aborting update."
  exit 1
fi

print_step "Database backed up to: $BACKUP_FILE"

# Step 4: Run migrations before restarting (uses build stage with devDeps)
echo ""
echo "Step 4: Running database migrations..."
docker compose -f "$COMPOSE_FILE" --profile migrate run --rm migrate sh -c "npx prisma migrate deploy"
print_step "Migrations applied"

# Step 5: Restart services
echo ""
echo "Step 5: Restarting services..."
docker compose -f "$COMPOSE_FILE" up -d
print_step "Services restarted"

# Step 6: Health check
echo ""
echo "Step 6: Running health check..."

sleep 10

all_healthy=true
for service in backend frontend cms; do
  if docker compose -f "$COMPOSE_FILE" ps "$service" | grep -q "healthy"; then
    print_step "$service is healthy"
  else
    status=$(docker compose -f "$COMPOSE_FILE" ps "$service" --format "{{.Status}}" 2>/dev/null || echo "unknown")
    print_warning "$service status: $status"
    all_healthy=false
  fi
done

echo ""
if [ "$all_healthy" = true ]; then
  echo -e "${GREEN}Update completed successfully!${NC}"
else
  echo -e "${YELLOW}Update completed with warnings. Check service health.${NC}"
  echo "  docker compose -f $COMPOSE_FILE ps"
  echo "  docker compose -f $COMPOSE_FILE logs -f"
fi
echo ""
