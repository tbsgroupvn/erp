#!/bin/bash
# ============================================
# TBS ERP - Production Deployment Script
# Usage: ./deploy.sh [--build] [--migrate] [--seed] [--ssl]
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Default flags
DO_BUILD=false
DO_MIGRATE=false
DO_SEED=false
DO_SSL=false
DO_ALL=true

# Parse arguments
for arg in "$@"; do
  DO_ALL=false
  case $arg in
    --build) DO_BUILD=true ;;
    --migrate) DO_MIGRATE=true ;;
    --seed) DO_SEED=true ;;
    --ssl) DO_SSL=true ;;
    --help)
      echo "Usage: ./deploy.sh [--build] [--migrate] [--seed] [--ssl]"
      echo ""
      echo "Options:"
      echo "  --build     Build Docker images"
      echo "  --migrate   Run database migrations"
      echo "  --seed      Seed initial data"
      echo "  --ssl       Setup SSL certificates"
      echo ""
      echo "If no flags are provided, all steps are executed."
      exit 0
      ;;
    *)
      log_error "Unknown option: $arg"
      exit 1
      ;;
  esac
done

if [ "$DO_ALL" = true ]; then
  DO_BUILD=true
  DO_MIGRATE=true
  DO_SSL=true
fi

# ============================================
# Step 1: Check .env file
# ============================================
log_info "Checking environment configuration..."

if [ ! -f .env ]; then
  if [ -f .env.production ]; then
    log_warn ".env not found. Copying from .env.production..."
    cp .env.production .env
    log_warn "IMPORTANT: Edit .env and fill in real passwords/secrets before continuing!"
    log_warn "  - POSTGRES_PASSWORD"
    log_warn "  - JWT_SECRET"
    log_warn "  - JWT_REFRESH_SECRET"
    log_warn "  - CERTBOT_EMAIL"
    exit 1
  else
    log_error "No .env or .env.production found. Cannot proceed."
    exit 1
  fi
fi

# Validate critical env vars
source .env
if [[ "$JWT_SECRET" == *"CHANGE_ME"* ]] || [[ "$POSTGRES_PASSWORD" == *"CHANGE_ME"* ]]; then
  log_error "Please update placeholder values in .env file before deploying!"
  log_error "  - POSTGRES_PASSWORD"
  log_error "  - JWT_SECRET"
  log_error "  - JWT_REFRESH_SECRET"
  exit 1
fi

log_info "Environment configuration OK"

# ============================================
# Step 2: Build Docker images
# ============================================
if [ "$DO_BUILD" = true ]; then
  log_info "Building Docker images..."
  docker compose build --parallel
  log_info "Docker images built successfully"
fi

# ============================================
# Step 3: Start services
# ============================================
log_info "Starting services..."
docker compose up -d postgres redis
log_info "Waiting for database to be ready..."
sleep 10

# ============================================
# Step 4: Run database migrations
# ============================================
if [ "$DO_MIGRATE" = true ]; then
  log_info "Starting backend for migrations..."
  docker compose up -d backend
  log_info "Waiting for backend to start..."
  sleep 15

  log_info "Running Prisma migrations..."
  docker compose exec backend npx prisma migrate deploy
  log_info "Database migrations completed"
fi

# ============================================
# Step 5: Seed initial data (optional)
# ============================================
if [ "$DO_SEED" = true ]; then
  log_info "Seeding initial data..."
  docker compose exec backend npx prisma db seed
  log_info "Database seeded successfully"
fi

# ============================================
# Step 6: Start all services
# ============================================
log_info "Starting all services..."
docker compose up -d
log_info "All services started"

# ============================================
# Step 7: Setup SSL (first time only)
# ============================================
if [ "$DO_SSL" = true ]; then
  if [ ! -d "/etc/letsencrypt/live/${DOMAIN:-nhaphangchinhngach.vn}" ]; then
    log_info "Setting up SSL certificates..."
    bash ./init-letsencrypt.sh
  else
    log_info "SSL certificates already exist, skipping..."
  fi
fi

# ============================================
# Step 8: Health check
# ============================================
log_info "Running health checks..."
sleep 10

check_service() {
  local name=$1
  local url=$2
  if curl -sf --max-time 10 "$url" > /dev/null 2>&1; then
    log_info "$name: OK"
  else
    log_warn "$name: Not responding (may still be starting)"
  fi
}

check_service "Backend API" "http://localhost:${BACKEND_PORT:-3001}/health"
check_service "ERP Frontend" "http://localhost:${FRONTEND_PORT:-3000}"
check_service "CMS Frontend" "http://localhost:${CMS_PORT:-3002}"

echo ""
log_info "============================================"
log_info "Deployment complete!"
log_info "============================================"
echo ""
log_info "Services:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
log_info "URLs (after DNS is configured):"
log_info "  ERP:  https://erp.nhaphangchinhngach.vn"
log_info "  CMS:  https://nhaphangchinhngach.vn"
log_info "  API:  https://api.nhaphangchinhngach.vn"
echo ""
log_info "Useful commands:"
log_info "  docker compose logs -f          # View all logs"
log_info "  docker compose logs -f backend  # View backend logs"
log_info "  docker compose ps               # Service status"
log_info "  docker compose restart nginx    # Restart nginx"
