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

# Step 3: Restart services
echo ""
echo "Step 3: Restarting services..."
docker compose -f "$COMPOSE_FILE" up -d
print_step "Services restarted"

# Step 4: Run migrations
echo ""
echo "Step 4: Running database migrations..."

echo "Waiting for backend to be ready..."
retries=30
while [ $retries -gt 0 ]; do
  if docker compose -f "$COMPOSE_FILE" exec -T backend wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health 2>/dev/null; then
    break
  fi
  retries=$((retries - 1))
  sleep 5
done

if [ $retries -eq 0 ]; then
  print_warning "Backend health check timed out. Run migrations manually:"
  echo "  docker compose -f $COMPOSE_FILE exec backend npx prisma migrate deploy"
else
  docker compose -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy
  print_step "Migrations applied"
fi

# Step 5: Health check
echo ""
echo "Step 5: Running health check..."

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
