#!/bin/bash
# ============================================
# TBS ERP - Rollback Script
# ============================================
# Rolls back to the previous blue/green environment.
# Designed for speed: < 2 minutes for a complete rollback.
#
# Usage:
#   ./scripts/rollback.sh               # Auto-detect and rollback
#   ./scripts/rollback.sh --to blue     # Force rollback to specific env
#   ./scripts/rollback.sh --docker      # Docker Compose rollback
#   ./scripts/rollback.sh --k8s         # Kubernetes rollback
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
ROLLBACK_LOG="${STATE_DIR}/rollback.log"
NGINX_UPSTREAM_CONF="/etc/nginx/conf.d/upstream.conf"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Timekeeping
START_TIME=$(date +%s)

# ============================================
# Logging
# ============================================
log_info()  { echo -e "${GREEN}[INFO]${NC}  $(date '+%H:%M:%S') $1" | tee -a "$ROLLBACK_LOG" 2>/dev/null || echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $(date '+%H:%M:%S') $1" | tee -a "$ROLLBACK_LOG" 2>/dev/null || echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1" | tee -a "$ROLLBACK_LOG" 2>/dev/null || echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================
# Parse Arguments
# ============================================
TARGET_ENV=""
ROLLBACK_MODE="docker"  # docker or k8s

for arg in "$@"; do
  case $arg in
    --to)
      shift
      TARGET_ENV="${1:-}"
      if [[ "$TARGET_ENV" != "blue" && "$TARGET_ENV" != "green" ]]; then
        log_error "--to must be 'blue' or 'green'"
        exit 1
      fi
      ;;
    --docker) ROLLBACK_MODE="docker" ;;
    --k8s)    ROLLBACK_MODE="k8s" ;;
    --help)
      echo "Usage: $0 [--to blue|green] [--docker|--k8s]"
      exit 0
      ;;
    blue|green)
      TARGET_ENV="$arg"
      ;;
  esac
done

mkdir -p "$STATE_DIR"
touch "$ROLLBACK_LOG" 2>/dev/null || ROLLBACK_LOG="/dev/null"

# ============================================
# Docker Compose Rollback
# ============================================
rollback_docker() {
  CURRENT_ENV=$(cat "$STATE_FILE" 2>/dev/null || echo "blue")

  if [ -z "$TARGET_ENV" ]; then
    TARGET_ENV=$([[ "$CURRENT_ENV" == "blue" ]] && echo "green" || echo "blue")
  fi

  if [ "$CURRENT_ENV" == "$TARGET_ENV" ]; then
    log_warn "Already on $TARGET_ENV environment. Nothing to rollback."
    exit 0
  fi

  log_info "============================================"
  log_info "ROLLBACK: $CURRENT_ENV -> $TARGET_ENV"
  log_info "============================================"

  # Check if target environment containers are still running
  if docker-compose -f "${PROJECT_ROOT}/docker-compose.${TARGET_ENV}.yml" ps --quiet 2>/dev/null | head -1 | grep -q .; then
    log_info "Target environment ($TARGET_ENV) is still running - performing quick switch"

    # Quick path: just switch nginx
    if [ -f "$NGINX_UPSTREAM_CONF" ]; then
      sed -i "s/backend_${CURRENT_ENV}/backend_${TARGET_ENV}/g" "$NGINX_UPSTREAM_CONF"
      sed -i "s/erp_frontend_${CURRENT_ENV}/erp_frontend_${TARGET_ENV}/g" "$NGINX_UPSTREAM_CONF"
      sed -i "s/cms_frontend_${CURRENT_ENV}/cms_frontend_${TARGET_ENV}/g" "$NGINX_UPSTREAM_CONF"

      if nginx -t 2>&1; then
        nginx -s reload
        echo "$TARGET_ENV" > "$STATE_FILE"
        log_info "Quick rollback complete (nginx switched to $TARGET_ENV)"
      else
        log_error "Nginx config test failed during rollback!"
        # Revert sed changes
        sed -i "s/backend_${TARGET_ENV}/backend_${CURRENT_ENV}/g" "$NGINX_UPSTREAM_CONF"
        sed -i "s/erp_frontend_${TARGET_ENV}/erp_frontend_${CURRENT_ENV}/g" "$NGINX_UPSTREAM_CONF"
        sed -i "s/cms_frontend_${TARGET_ENV}/cms_frontend_${CURRENT_ENV}/g" "$NGINX_UPSTREAM_CONF"
        exit 1
      fi
    else
      log_warn "Nginx upstream config not found. Switching state file only."
      echo "$TARGET_ENV" > "$STATE_FILE"
    fi
  else
    log_warn "Target environment ($TARGET_ENV) is stopped. Restarting..."

    # Full path: restart the old environment
    docker-compose -f "${PROJECT_ROOT}/docker-compose.${TARGET_ENV}.yml" up -d

    # Wait for health (max 60s for rollback speed)
    log_info "Waiting for $TARGET_ENV to become healthy..."
    attempts=0
    while [ $attempts -lt 12 ]; do
      if docker-compose -f "${PROJECT_ROOT}/docker-compose.${TARGET_ENV}.yml" ps 2>/dev/null | grep -q "(healthy)"; then
        log_info "$TARGET_ENV is healthy"
        break
      fi
      attempts=$((attempts + 1))
      sleep 5
    done

    if [ $attempts -ge 12 ]; then
      log_warn "$TARGET_ENV may not be fully healthy yet, but switching anyway for recovery"
    fi

    # Switch nginx
    if [ -f "$NGINX_UPSTREAM_CONF" ]; then
      sed -i "s/backend_${CURRENT_ENV}/backend_${TARGET_ENV}/g" "$NGINX_UPSTREAM_CONF"
      sed -i "s/erp_frontend_${CURRENT_ENV}/erp_frontend_${TARGET_ENV}/g" "$NGINX_UPSTREAM_CONF"
      sed -i "s/cms_frontend_${CURRENT_ENV}/cms_frontend_${TARGET_ENV}/g" "$NGINX_UPSTREAM_CONF"
      nginx -t 2>&1 && nginx -s reload
    fi

    echo "$TARGET_ENV" > "$STATE_FILE"
    log_info "Full rollback complete (restarted $TARGET_ENV)"
  fi

  # Record rollback metadata
  cat > "${STATE_DIR}/last-rollback.json" <<ROLLBACK_EOF
{
  "from": "$CURRENT_ENV",
  "to": "$TARGET_ENV",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reason": "manual_rollback",
  "duration_seconds": $(($(date +%s) - START_TIME)),
  "operator": "${USER:-unknown}"
}
ROLLBACK_EOF

  # Notify
  if [ -n "${SLACK_WEBHOOK:-}" ]; then
    curl -sf -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"ROLLBACK: TBS ERP rolled back from $CURRENT_ENV to $TARGET_ENV in $(($(date +%s) - START_TIME))s\"}" \
      > /dev/null 2>&1 || true
  fi
}

# ============================================
# Kubernetes Rollback
# ============================================
rollback_k8s() {
  log_info "============================================"
  log_info "Kubernetes Rollback"
  log_info "============================================"

  NAMESPACE="${K8S_NAMESPACE:-tbs-erp}"

  # Check if Argo Rollouts is available
  if kubectl get rollout tbs-backend -n "$NAMESPACE" &>/dev/null; then
    log_info "Argo Rollouts detected. Aborting current rollout..."

    # Abort any in-progress rollout and revert
    kubectl argo rollouts abort tbs-backend -n "$NAMESPACE" 2>/dev/null || true
    kubectl argo rollouts undo tbs-backend -n "$NAMESPACE"

    log_info "Waiting for rollback to complete..."
    kubectl argo rollouts status tbs-backend -n "$NAMESPACE" --timeout 120s

    log_info "Argo Rollout reverted successfully"
  else
    log_info "Standard Deployment detected. Rolling back..."

    # Rollback backend
    kubectl rollout undo deployment/tbs-backend -n "$NAMESPACE"
    kubectl rollout status deployment/tbs-backend -n "$NAMESPACE" --timeout=120s

    # Rollback frontend
    kubectl rollout undo deployment/tbs-erp-frontend -n "$NAMESPACE" 2>/dev/null || true
    kubectl rollout status deployment/tbs-erp-frontend -n "$NAMESPACE" --timeout=120s 2>/dev/null || true

    # Rollback CMS frontend
    kubectl rollout undo deployment/tbs-cms-frontend -n "$NAMESPACE" 2>/dev/null || true
    kubectl rollout status deployment/tbs-cms-frontend -n "$NAMESPACE" --timeout=120s 2>/dev/null || true

    log_info "Kubernetes rollback complete"
  fi

  ELAPSED=$(($(date +%s) - START_TIME))
  log_info "Rollback completed in ${ELAPSED}s"

  if [ -n "${SLACK_WEBHOOK:-}" ]; then
    curl -sf -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"ROLLBACK (K8s): TBS ERP rolled back in ${ELAPSED}s\"}" \
      > /dev/null 2>&1 || true
  fi
}

# ============================================
# Main
# ============================================
case $ROLLBACK_MODE in
  docker) rollback_docker ;;
  k8s)    rollback_k8s ;;
  *)
    log_error "Unknown rollback mode: $ROLLBACK_MODE"
    exit 1
    ;;
esac

TOTAL_TIME=$(($(date +%s) - START_TIME))
log_info "Total rollback time: ${TOTAL_TIME}s"

if [ $TOTAL_TIME -gt 120 ]; then
  log_warn "Rollback took longer than 2 minutes. Investigate delays."
fi
