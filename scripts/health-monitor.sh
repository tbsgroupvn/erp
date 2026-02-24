#!/bin/bash
# ============================================
# TBS ERP - Continuous Health Monitor with Auto-Rollback
# ============================================
# Run as a background process after deployment.
# Continuously checks health endpoints and triggers automatic
# rollback after N consecutive failures.
#
# Usage:
#   ./scripts/health-monitor.sh &                    # Background
#   ./scripts/health-monitor.sh --daemon              # Daemonize
#   ./scripts/health-monitor.sh --threshold 5         # Custom threshold
#   ./scripts/health-monitor.sh --interval 15         # Custom interval
#
# Environment Variables:
#   SLACK_WEBHOOK        - Slack webhook for alerts
#   HEALTH_URL           - Override default health URL
#   TBS_STATE_DIR        - State directory (default: /opt/tbs-erp)
# ============================================

set -euo pipefail

# ============================================
# Configuration
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${TBS_STATE_DIR:-/opt/tbs-erp}"
MONITOR_PID_FILE="${STATE_DIR}/health-monitor.pid"
MONITOR_LOG="${STATE_DIR}/health-monitor.log"

# Health check targets
BACKEND_HEALTH_URL="${HEALTH_URL:-http://localhost/api/v1/health/ready}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-http://localhost/}"

# Thresholds
FAIL_THRESHOLD=3
CHECK_INTERVAL=30
RECOVERY_COOLDOWN=300  # 5 minutes after rollback before monitoring again
MAX_ROLLBACKS_PER_HOUR=2

# State
FAIL_COUNT=0
ROLLBACK_COUNT=0
LAST_ROLLBACK_TIME=0
DAEMONIZE=false

# Colors (only for terminal output)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ============================================
# Logging
# ============================================
mkdir -p "$STATE_DIR"
touch "$MONITOR_LOG" 2>/dev/null || MONITOR_LOG="/dev/null"

log_info()  { echo -e "$(date '+%Y-%m-%d %H:%M:%S') [INFO]  $1" >> "$MONITOR_LOG"; echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "$(date '+%Y-%m-%d %H:%M:%S') [WARN]  $1" >> "$MONITOR_LOG"; echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$MONITOR_LOG"; echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================
# Parse Arguments
# ============================================
while [[ $# -gt 0 ]]; do
  case $1 in
    --threshold)
      FAIL_THRESHOLD="$2"
      shift 2
      ;;
    --interval)
      CHECK_INTERVAL="$2"
      shift 2
      ;;
    --daemon)
      DAEMONIZE=true
      shift
      ;;
    --stop)
      if [ -f "$MONITOR_PID_FILE" ]; then
        PID=$(cat "$MONITOR_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
          kill "$PID"
          rm -f "$MONITOR_PID_FILE"
          echo "Health monitor stopped (PID: $PID)"
        else
          echo "Health monitor not running (stale PID file)"
          rm -f "$MONITOR_PID_FILE"
        fi
      else
        echo "Health monitor not running (no PID file)"
      fi
      exit 0
      ;;
    --status)
      if [ -f "$MONITOR_PID_FILE" ]; then
        PID=$(cat "$MONITOR_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
          echo "Health monitor is running (PID: $PID)"
          echo "Log: $MONITOR_LOG"
          tail -5 "$MONITOR_LOG" 2>/dev/null || true
        else
          echo "Health monitor is NOT running (stale PID)"
        fi
      else
        echo "Health monitor is NOT running"
      fi
      exit 0
      ;;
    --help)
      echo "Usage: $0 [--threshold N] [--interval N] [--daemon] [--stop] [--status]"
      echo ""
      echo "Options:"
      echo "  --threshold N   Consecutive failures before rollback (default: 3)"
      echo "  --interval N    Seconds between health checks (default: 30)"
      echo "  --daemon        Run as background daemon"
      echo "  --stop          Stop running health monitor"
      echo "  --status        Check if monitor is running"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ============================================
# Notification Helper
# ============================================
send_alert() {
  local severity="$1"
  local message="$2"

  # Slack
  if [ -n "${SLACK_WEBHOOK:-}" ]; then
    local emoji=""
    case $severity in
      critical) emoji="[CRITICAL]" ;;
      warning)  emoji="[WARNING]" ;;
      info)     emoji="[INFO]" ;;
    esac

    curl -sf -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"${emoji} TBS ERP Health Monitor: ${message}\"}" \
      > /dev/null 2>&1 || true
  fi
}

# ============================================
# Health Check Function
# ============================================
check_health() {
  local url="$1"
  local timeout=10
  local http_code

  http_code=$(curl -sf -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")

  if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
    return 0
  else
    return 1
  fi
}

# ============================================
# Auto-Rollback Function
# ============================================
trigger_rollback() {
  local now
  now=$(date +%s)

  # Rate limit rollbacks
  local time_since_last=$((now - LAST_ROLLBACK_TIME))
  if [ $time_since_last -lt $RECOVERY_COOLDOWN ] && [ $LAST_ROLLBACK_TIME -gt 0 ]; then
    log_warn "Rollback cooldown active (${time_since_last}s / ${RECOVERY_COOLDOWN}s). Skipping."
    return 1
  fi

  if [ $ROLLBACK_COUNT -ge $MAX_ROLLBACKS_PER_HOUR ]; then
    log_error "Max rollbacks per hour ($MAX_ROLLBACKS_PER_HOUR) reached. Manual intervention required."
    send_alert "critical" "Max auto-rollbacks reached ($MAX_ROLLBACKS_PER_HOUR/hour). Manual intervention required!"
    return 1
  fi

  log_error "Triggering auto-rollback..."
  send_alert "critical" "Auto-rollback triggered after $FAIL_THRESHOLD consecutive health check failures"

  # Execute rollback
  if "${SCRIPT_DIR}/rollback.sh" 2>&1 | tee -a "$MONITOR_LOG"; then
    log_info "Auto-rollback completed successfully"
    send_alert "info" "Auto-rollback completed successfully"
    ROLLBACK_COUNT=$((ROLLBACK_COUNT + 1))
    LAST_ROLLBACK_TIME=$now
    FAIL_COUNT=0

    # Pause monitoring during cooldown
    log_info "Entering cooldown period (${RECOVERY_COOLDOWN}s)..."
    sleep $RECOVERY_COOLDOWN
    log_info "Cooldown complete. Resuming health monitoring."
    return 0
  else
    log_error "Auto-rollback FAILED!"
    send_alert "critical" "Auto-rollback FAILED! Manual intervention required immediately!"
    return 1
  fi
}

# ============================================
# Daemonize
# ============================================
if [ "$DAEMONIZE" = true ]; then
  # Check if already running
  if [ -f "$MONITOR_PID_FILE" ]; then
    OLD_PID=$(cat "$MONITOR_PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
      echo "Health monitor already running (PID: $OLD_PID). Use --stop first."
      exit 1
    fi
  fi

  # Fork to background
  nohup "$0" --threshold "$FAIL_THRESHOLD" --interval "$CHECK_INTERVAL" >> "$MONITOR_LOG" 2>&1 &
  echo $! > "$MONITOR_PID_FILE"
  echo "Health monitor started (PID: $!, log: $MONITOR_LOG)"
  exit 0
fi

# Write PID for non-daemon mode too
echo $$ > "$MONITOR_PID_FILE"

# ============================================
# Cleanup on exit
# ============================================
cleanup() {
  rm -f "$MONITOR_PID_FILE"
  log_info "Health monitor stopped"
}
trap cleanup EXIT INT TERM

# ============================================
# Main Loop
# ============================================
log_info "============================================"
log_info "Health Monitor Started"
log_info "  Backend URL:   $BACKEND_HEALTH_URL"
log_info "  Threshold:     $FAIL_THRESHOLD consecutive failures"
log_info "  Interval:      ${CHECK_INTERVAL}s"
log_info "  Max rollbacks: $MAX_ROLLBACKS_PER_HOUR per hour"
log_info "============================================"

# Reset rollback counter every hour
HOUR_START=$(date +%s)

while true; do
  # Reset hourly counter
  now=$(date +%s)
  if [ $((now - HOUR_START)) -ge 3600 ]; then
    ROLLBACK_COUNT=0
    HOUR_START=$now
  fi

  # Check backend health
  if check_health "$BACKEND_HEALTH_URL"; then
    if [ $FAIL_COUNT -gt 0 ]; then
      log_info "Health check recovered after $FAIL_COUNT failures"
      FAIL_COUNT=0
    fi
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    log_warn "Health check FAILED ($FAIL_COUNT/$FAIL_THRESHOLD) - $BACKEND_HEALTH_URL"

    if [ $FAIL_COUNT -ge $FAIL_THRESHOLD ]; then
      log_error "Failure threshold reached ($FAIL_COUNT/$FAIL_THRESHOLD)"

      if ! trigger_rollback; then
        log_error "Rollback failed or rate-limited. Continuing monitoring..."
      fi
    fi
  fi

  sleep "$CHECK_INTERVAL"
done
