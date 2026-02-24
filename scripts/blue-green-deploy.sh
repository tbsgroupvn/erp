#!/bin/bash
# ============================================
# TBS ERP - Blue/Green Deployment for Docker Compose
# ============================================
# Maintains two environments: blue and green
# Switches traffic via Nginx upstream after health check
#
# Usage:
#   ./scripts/blue-green-deploy.sh [--force] [--skip-old-teardown]
#
# The script is idempotent: safe to run multiple times.
# ============================================

set -euo pipefail

# ============================================
# Configuration
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STATE_DIR="${TBS_STATE_DIR:-/opt/tbs-erp}"
STATE_FILE="${STATE_DIR}/current-env"
DEPLOY_LOG="${STATE_DIR}/deploy.log"
NGINX_UPSTREAM_CONF="/etc/nginx/conf.d/upstream.conf"

# Port mapping: blue backend=3010, green backend=3020
BLUE_BACKEND_PORT=3010
GREEN_BACKEND_PORT=3020
BLUE_FRONTEND_PORT=3011
GREEN_FRONTEND_PORT=3021

# Health check settings
HEALTH_MAX_ATTEMPTS=24
HEALTH_INTERVAL=5
SMOKE_TEST_TIMEOUT=10

# Flags
FORCE_DEPLOY=false
SKIP_OLD_TEARDOWN=false
OLD_ENV_TEARDOWN_DELAY=600  # 10 minutes

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# Logging
# ============================================
log_info()  { echo -e "${GREEN}[INFO]${NC}  $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$DEPLOY_LOG" 2>/dev/null || echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$DEPLOY_LOG" 2>/dev/null || echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$DEPLOY_LOG" 2>/dev/null || echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$DEPLOY_LOG" 2>/dev/null || echo -e "${BLUE}[STEP]${NC} $1"; }

# ============================================
# Parse Arguments
# ============================================
for arg in "$@"; do
  case $arg in
    --force) FORCE_DEPLOY=true ;;
    --skip-old-teardown) SKIP_OLD_TEARDOWN=true ;;
    --help)
      echo "Usage: $0 [--force] [--skip-old-teardown]"
      echo ""
      echo "Options:"
      echo "  --force              Force deployment even if health checks on current env pass"
      echo "  --skip-old-teardown  Keep old environment running indefinitely"
      echo ""
      echo "Environment Variables:"
      echo "  TBS_STATE_DIR        State directory (default: /opt/tbs-erp)"
      echo "  SLACK_WEBHOOK        Slack webhook URL for notifications"
      exit 0
      ;;
    *)
      log_error "Unknown option: $arg"
      exit 1
      ;;
  esac
done

# ============================================
# Pre-flight Checks
# ============================================
log_step "Running pre-flight checks..."

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Ensure deploy log is writable
touch "$DEPLOY_LOG" 2>/dev/null || DEPLOY_LOG="/dev/null"

# Check required tools
for cmd in docker curl sed nginx; do
  if ! command -v "$cmd" &>/dev/null; then
    log_error "Required command not found: $cmd"
    exit 1
  fi
done

# Check compose files exist
for env in blue green; do
  if [ ! -f "${PROJECT_ROOT}/docker-compose.${env}.yml" ]; then
    log_error "Missing compose file: docker-compose.${env}.yml"
    exit 1
  fi
done

# ============================================
# Determine Current and New Environment
# ============================================
CURRENT_ENV=$(cat "$STATE_FILE" 2>/dev/null || echo "blue")
NEW_ENV=$([[ "$CURRENT_ENV" == "blue" ]] && echo "green" || echo "blue")

if [[ "$NEW_ENV" == "blue" ]]; then
  NEW_BACKEND_PORT=$BLUE_BACKEND_PORT
  NEW_FRONTEND_PORT=$BLUE_FRONTEND_PORT
else
  NEW_BACKEND_PORT=$GREEN_BACKEND_PORT
  NEW_FRONTEND_PORT=$GREEN_FRONTEND_PORT
fi

log_info "============================================"
log_info "Blue/Green Deployment"
log_info "  Current active: $CURRENT_ENV"
log_info "  Deploying to:   $NEW_ENV"
log_info "  Backend port:   $NEW_BACKEND_PORT"
log_info "  Frontend port:  $NEW_FRONTEND_PORT"
log_info "============================================"

# ============================================
# Step 1: Pull New Images
# ============================================
log_step "1/6 Pulling new images for $NEW_ENV environment..."

docker-compose -f "${PROJECT_ROOT}/docker-compose.${NEW_ENV}.yml" pull 2>&1 | tee -a "$DEPLOY_LOG" || {
  log_error "Failed to pull images for $NEW_ENV"
  exit 1
}

log_info "Images pulled successfully"

# ============================================
# Step 2: Start New Environment
# ============================================
log_step "2/6 Starting $NEW_ENV environment..."

docker-compose -f "${PROJECT_ROOT}/docker-compose.${NEW_ENV}.yml" up -d 2>&1 | tee -a "$DEPLOY_LOG" || {
  log_error "Failed to start $NEW_ENV environment"
  exit 1
}

log_info "$NEW_ENV environment started"

# ============================================
# Step 3: Wait for Health Checks
# ============================================
log_step "3/6 Waiting for health checks (max $((HEALTH_MAX_ATTEMPTS * HEALTH_INTERVAL))s)..."

wait_for_health() {
  local port=$1
  local service_name=$2
  local attempt=0

  while [ $attempt -lt $HEALTH_MAX_ATTEMPTS ]; do
    if curl -sf --max-time 5 "http://localhost:${port}/api/v1/health/ready" > /dev/null 2>&1; then
      log_info "$service_name is healthy (attempt $((attempt + 1)))"
      return 0
    fi
    attempt=$((attempt + 1))
    if [ $((attempt % 4)) -eq 0 ]; then
      log_warn "$service_name not ready yet (attempt $attempt/$HEALTH_MAX_ATTEMPTS)..."
    fi
    sleep $HEALTH_INTERVAL
  done

  log_error "$service_name health check timed out after $((HEALTH_MAX_ATTEMPTS * HEALTH_INTERVAL)) seconds"
  return 1
}

HEALTH_OK=true
if ! wait_for_health "$NEW_BACKEND_PORT" "Backend ($NEW_ENV)"; then
  HEALTH_OK=false
fi

# Also check frontend if health check endpoint exists
if $HEALTH_OK; then
  local_attempt=0
  while [ $local_attempt -lt 12 ]; do
    if curl -sf --max-time 5 "http://localhost:${NEW_FRONTEND_PORT}/" > /dev/null 2>&1; then
      log_info "Frontend ($NEW_ENV) is healthy"
      break
    fi
    local_attempt=$((local_attempt + 1))
    sleep 5
  done
  if [ $local_attempt -ge 12 ]; then
    log_warn "Frontend ($NEW_ENV) health check timed out, but continuing..."
  fi
fi

# ============================================
# Step 4: Run Smoke Tests
# ============================================
log_step "4/6 Running smoke tests against $NEW_ENV..."

run_smoke_tests() {
  local port=$1
  local failures=0

  # Test health endpoint
  if ! curl -sf --max-time "$SMOKE_TEST_TIMEOUT" "http://localhost:${port}/api/v1/health" > /dev/null 2>&1; then
    log_error "Smoke test FAILED: /api/v1/health"
    failures=$((failures + 1))
  else
    log_info "Smoke test PASSED: /api/v1/health"
  fi

  # Test readiness endpoint
  if ! curl -sf --max-time "$SMOKE_TEST_TIMEOUT" "http://localhost:${port}/api/v1/health/ready" > /dev/null 2>&1; then
    log_error "Smoke test FAILED: /api/v1/health/ready"
    failures=$((failures + 1))
  else
    log_info "Smoke test PASSED: /api/v1/health/ready"
  fi

  # Test liveness endpoint
  if ! curl -sf --max-time "$SMOKE_TEST_TIMEOUT" "http://localhost:${port}/api/v1/health/live" > /dev/null 2>&1; then
    log_warn "Smoke test SKIPPED: /api/v1/health/live (endpoint may not exist)"
  else
    log_info "Smoke test PASSED: /api/v1/health/live"
  fi

  return $failures
}

if $HEALTH_OK; then
  if ! run_smoke_tests "$NEW_BACKEND_PORT"; then
    HEALTH_OK=false
  fi
fi

# ============================================
# Step 5: Switch or Rollback
# ============================================
if $HEALTH_OK; then
  log_step "5/6 Switching traffic from $CURRENT_ENV to $NEW_ENV..."

  # Update nginx upstream configuration
  if [ -f "$NGINX_UPSTREAM_CONF" ]; then
    sed -i "s/backend_${CURRENT_ENV}/backend_${NEW_ENV}/g" "$NGINX_UPSTREAM_CONF"
    sed -i "s/erp_frontend_${CURRENT_ENV}/erp_frontend_${NEW_ENV}/g" "$NGINX_UPSTREAM_CONF"
    sed -i "s/cms_frontend_${CURRENT_ENV}/cms_frontend_${NEW_ENV}/g" "$NGINX_UPSTREAM_CONF"

    # Validate nginx config before reload
    if nginx -t 2>&1; then
      nginx -s reload
      log_info "Nginx configuration reloaded successfully"
    else
      log_error "Nginx configuration test failed! Reverting..."
      sed -i "s/backend_${NEW_ENV}/backend_${CURRENT_ENV}/g" "$NGINX_UPSTREAM_CONF"
      sed -i "s/erp_frontend_${NEW_ENV}/erp_frontend_${CURRENT_ENV}/g" "$NGINX_UPSTREAM_CONF"
      sed -i "s/cms_frontend_${NEW_ENV}/cms_frontend_${CURRENT_ENV}/g" "$NGINX_UPSTREAM_CONF"
      docker-compose -f "${PROJECT_ROOT}/docker-compose.${NEW_ENV}.yml" down
      exit 1
    fi
  else
    log_warn "Nginx upstream config not found at $NGINX_UPSTREAM_CONF, skipping traffic switch"
  fi

  # Record new active environment
  echo "$NEW_ENV" > "$STATE_FILE"
  log_info "Active environment: $NEW_ENV"

  # Record deployment metadata
  cat > "${STATE_DIR}/last-deploy.json" <<DEPLOY_EOF
{
  "environment": "$NEW_ENV",
  "previous": "$CURRENT_ENV",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git_sha": "${GIT_SHA:-unknown}",
  "deployer": "${USER:-unknown}"
}
DEPLOY_EOF

  # ============================================
  # Step 6: Schedule Old Environment Teardown
  # ============================================
  if [ "$SKIP_OLD_TEARDOWN" = false ]; then
    log_step "6/6 Old environment ($CURRENT_ENV) will be stopped in $((OLD_ENV_TEARDOWN_DELAY / 60)) minutes..."
    (
      sleep $OLD_ENV_TEARDOWN_DELAY
      log_info "Stopping old environment: $CURRENT_ENV"
      docker-compose -f "${PROJECT_ROOT}/docker-compose.${CURRENT_ENV}.yml" down 2>/dev/null || true
      log_info "Old environment $CURRENT_ENV stopped"
    ) &
    disown
  else
    log_step "6/6 Skipping old environment teardown (--skip-old-teardown)"
  fi

  # Send success notification
  if [ -n "${SLACK_WEBHOOK:-}" ]; then
    curl -sf -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"Deployment SUCCESS: TBS ERP switched from $CURRENT_ENV to $NEW_ENV (SHA: ${GIT_SHA:-unknown})\"}" \
      > /dev/null 2>&1 || true
  fi

  log_info "============================================"
  log_info "Deployment SUCCESSFUL"
  log_info "  Active environment: $NEW_ENV"
  log_info "  Previous environment: $CURRENT_ENV (still running for quick rollback)"
  log_info "============================================"

else
  # ============================================
  # Deployment Failed - Rollback
  # ============================================
  log_error "============================================"
  log_error "Health checks or smoke tests FAILED!"
  log_error "Rolling back: stopping $NEW_ENV environment..."
  log_error "============================================"

  docker-compose -f "${PROJECT_ROOT}/docker-compose.${NEW_ENV}.yml" down 2>&1 | tee -a "$DEPLOY_LOG" || true

  # Send failure notification
  if [ -n "${SLACK_WEBHOOK:-}" ]; then
    curl -sf -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"Deployment FAILED: TBS ERP $NEW_ENV environment failed health checks. Rolled back to $CURRENT_ENV.\"}" \
      > /dev/null 2>&1 || true
  fi

  log_error "Deployment ABORTED. $CURRENT_ENV remains active."
  exit 1
fi
