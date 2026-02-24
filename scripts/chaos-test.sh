#!/bin/bash
# ============================================
# TBS ERP - Chaos Engineering Test Runner
# ============================================
# Orchestrates chaos experiments in the staging environment.
# Verifies system health before/during/after experiments,
# monitors metrics, and generates a report.
#
# Usage:
#   ./scripts/chaos-test.sh                          # Run all experiments
#   ./scripts/chaos-test.sh --experiment pod-kill     # Run specific experiment
#   ./scripts/chaos-test.sh --dry-run                 # Preview without applying
#   ./scripts/chaos-test.sh --report                  # View last report
#
# Prerequisites:
#   - kubectl configured with staging cluster access
#   - Chaos Mesh installed in the cluster
#   - Prometheus available for metrics
#
# SAFETY:
#   - Only runs in staging namespace (hardcoded protection)
#   - Verifies system health before starting
#   - Aborts if system is already unhealthy
#   - Automatically cleans up experiments on failure
# ============================================

set -euo pipefail

# ============================================
# Configuration
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CHAOS_DIR="${PROJECT_ROOT}/k8s/chaos"
STATE_DIR="${TBS_STATE_DIR:-/opt/tbs-erp}"
REPORT_DIR="${STATE_DIR}/chaos-reports"

# SAFETY: Hardcode staging namespace
NAMESPACE="tbs-erp-staging"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://prometheus.tbs-erp-staging.svc.cluster.local:9090}"

# Experiment configuration
EXPERIMENT_TIMEOUT=600  # Max 10 minutes per experiment
HEALTH_WAIT_AFTER=120   # Wait 2 minutes after experiment for recovery
HEALTH_CHECK_INTERVAL=10

# Flags
DRY_RUN=false
SPECIFIC_EXPERIMENT=""
VIEW_REPORT=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================
# Logging
# ============================================
mkdir -p "$REPORT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${REPORT_DIR}/chaos_report_${TIMESTAMP}.txt"

log_info()  { echo -e "${GREEN}[INFO]${NC}  $(date '+%H:%M:%S') $1" | tee -a "$REPORT_FILE"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $(date '+%H:%M:%S') $1" | tee -a "$REPORT_FILE"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1" | tee -a "$REPORT_FILE"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $(date '+%H:%M:%S') $1" | tee -a "$REPORT_FILE"; }
log_result(){ echo -e "${CYAN}[RESULT]${NC} $(date '+%H:%M:%S') $1" | tee -a "$REPORT_FILE"; }

# ============================================
# Parse Arguments
# ============================================
while [[ $# -gt 0 ]]; do
  case $1 in
    --experiment)
      SPECIFIC_EXPERIMENT="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --report)
      VIEW_REPORT=true
      shift
      ;;
    --clean)
      log_info "Cleaning up all chaos experiments in $NAMESPACE..."
      kubectl delete networkchaos --all -n "$NAMESPACE" 2>/dev/null || true
      kubectl delete podchaos --all -n "$NAMESPACE" 2>/dev/null || true
      kubectl delete stresschaos --all -n "$NAMESPACE" 2>/dev/null || true
      kubectl delete iochaos --all -n "$NAMESPACE" 2>/dev/null || true
      kubectl delete dnschaos --all -n "$NAMESPACE" 2>/dev/null || true
      log_info "Cleanup complete"
      exit 0
      ;;
    --help)
      echo "Usage: $0 [--experiment <name>] [--dry-run] [--report] [--clean]"
      echo ""
      echo "Experiments:"
      echo "  network-delay     Network latency injection"
      echo "  pod-kill          Random pod termination"
      echo "  stress-test       CPU/memory stress"
      echo "  io-fault          Disk I/O delays and errors"
      echo "  dns-error         DNS resolution failures"
      echo ""
      echo "Options:"
      echo "  --experiment <n>  Run a specific experiment"
      echo "  --dry-run         Preview experiment without applying"
      echo "  --report          View the last chaos report"
      echo "  --clean           Remove all active chaos experiments"
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# View last report
if [ "$VIEW_REPORT" = true ]; then
  LAST_REPORT=$(ls -t "$REPORT_DIR"/chaos_report_*.txt 2>/dev/null | head -1)
  if [ -n "$LAST_REPORT" ]; then
    cat "$LAST_REPORT"
  else
    echo "No chaos reports found in $REPORT_DIR"
  fi
  exit 0
fi

# ============================================
# Safety Check: Ensure we're targeting staging
# ============================================
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "unknown")
log_info "Kubernetes context: $CURRENT_CONTEXT"
log_info "Target namespace: $NAMESPACE"

if [[ "$NAMESPACE" != *"staging"* ]]; then
  log_error "SAFETY: Chaos experiments can only run in staging namespaces!"
  exit 1
fi

# ============================================
# Helper Functions
# ============================================

# Check system health
check_system_health() {
  local label=$1
  local healthy=true

  # Check pod status
  local unhealthy_pods
  unhealthy_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -v "Running\|Completed" | wc -l)

  if [ "$unhealthy_pods" -gt 0 ]; then
    log_warn "[$label] $unhealthy_pods unhealthy pods detected"
    kubectl get pods -n "$NAMESPACE" --no-headers | grep -v "Running\|Completed" | tee -a "$REPORT_FILE"
    healthy=false
  fi

  # Check backend readiness
  local ready_backends
  ready_backends=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=tbs-backend --no-headers 2>/dev/null | grep "Running" | grep -c "1/1" || echo "0")

  if [ "$ready_backends" -lt 1 ]; then
    log_warn "[$label] Only $ready_backends backend pods are ready"
    healthy=false
  else
    log_info "[$label] $ready_backends backend pods ready"
  fi

  $healthy
}

# Record metrics snapshot
record_metrics() {
  local label=$1
  log_info "[$label] Recording metrics snapshot..."

  # Get pod resource usage
  kubectl top pods -n "$NAMESPACE" 2>/dev/null | tee -a "$REPORT_FILE" || true

  # Get Prometheus metrics if available
  if command -v curl &>/dev/null; then
    # Success rate
    local success_rate
    success_rate=$(curl -sf "${PROMETHEUS_URL}/api/v1/query?query=sum(rate(http_requests_total{namespace=\"${NAMESPACE}\",status_code!~\"5..\"}[5m]))/sum(rate(http_requests_total{namespace=\"${NAMESPACE}\"}[5m]))" 2>/dev/null | grep -oP '"value":\[[\d.]+,"[\d.]+"' | grep -oP '[\d.]+$' || echo "N/A")
    log_info "[$label] Success rate: $success_rate"

    # P99 latency
    local p99_latency
    p99_latency=$(curl -sf "${PROMETHEUS_URL}/api/v1/query?query=histogram_quantile(0.99,sum(rate(http_request_duration_seconds_bucket{namespace=\"${NAMESPACE}\"}[5m]))by(le))" 2>/dev/null | grep -oP '"value":\[[\d.]+,"[\d.]+"' | grep -oP '[\d.]+$' || echo "N/A")
    log_info "[$label] P99 latency: ${p99_latency}s"
  fi
}

# Apply a chaos experiment
run_experiment() {
  local name=$1
  local file=$2
  local start_time

  log_step "============================================"
  log_step "Experiment: $name"
  log_step "File: $file"
  log_step "============================================"

  if [ ! -f "$file" ]; then
    log_error "Experiment file not found: $file"
    return 1
  fi

  # Pre-experiment health check
  log_info "Pre-experiment health check..."
  if ! check_system_health "PRE-$name"; then
    log_error "System is not healthy before experiment. Skipping $name."
    return 1
  fi
  record_metrics "PRE-$name"

  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY RUN] Would apply: kubectl apply -f $file"
    log_info "[DRY RUN] Skipping actual experiment"
    log_result "$name: SKIPPED (dry run)"
    return 0
  fi

  # Apply experiment
  start_time=$(date +%s)
  log_info "Applying chaos experiment..."
  kubectl apply -f "$file" 2>&1 | tee -a "$REPORT_FILE"

  # Monitor during experiment
  log_info "Monitoring system during experiment..."
  local monitor_count=0
  local max_monitors=$((EXPERIMENT_TIMEOUT / HEALTH_CHECK_INTERVAL))

  while [ $monitor_count -lt $max_monitors ]; do
    sleep $HEALTH_CHECK_INTERVAL

    # Check if experiment is still active
    local active_experiments
    active_experiments=$(kubectl get networkchaos,podchaos,stresschaos,iochaos,dnschaos -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)

    if [ "$active_experiments" -eq 0 ]; then
      log_info "Experiment completed (no active chaos resources)"
      break
    fi

    monitor_count=$((monitor_count + 1))

    # Periodic health check during experiment
    if [ $((monitor_count % 3)) -eq 0 ]; then
      check_system_health "DURING-$name" || true
    fi
  done

  # Record metrics during/after experiment
  record_metrics "DURING-$name"

  # Wait for recovery
  log_info "Waiting ${HEALTH_WAIT_AFTER}s for system recovery..."
  sleep $HEALTH_WAIT_AFTER

  # Post-experiment health check
  log_info "Post-experiment health check..."
  local recovered=true
  if ! check_system_health "POST-$name"; then
    log_warn "System has not fully recovered after $name"
    recovered=false

    # Give extra time
    log_info "Waiting additional 60s for recovery..."
    sleep 60
    if check_system_health "POST-$name-EXTENDED"; then
      recovered=true
    fi
  fi
  record_metrics "POST-$name"

  # Clean up experiment resources
  log_info "Cleaning up experiment resources..."
  kubectl delete -f "$file" 2>/dev/null || true

  local elapsed=$(($(date +%s) - start_time))

  if $recovered; then
    log_result "$name: PASSED (recovered in ${elapsed}s)"
    return 0
  else
    log_result "$name: DEGRADED (did not fully recover in ${elapsed}s)"
    return 1
  fi
}

# ============================================
# Main Execution
# ============================================
echo "============================================" | tee -a "$REPORT_FILE"
echo "TBS ERP - Chaos Engineering Report"          | tee -a "$REPORT_FILE"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"          | tee -a "$REPORT_FILE"
echo "Namespace: $NAMESPACE"                        | tee -a "$REPORT_FILE"
echo "Context: $CURRENT_CONTEXT"                    | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
echo ""

# Verify Chaos Mesh is installed
if ! kubectl get crd podchaos.chaos-mesh.org &>/dev/null; then
  log_error "Chaos Mesh CRDs not found. Install Chaos Mesh first:"
  log_error "  helm install chaos-mesh chaos-mesh/chaos-mesh -n chaos-mesh --create-namespace"
  exit 1
fi

# Initial system health check
log_step "Initial system health check..."
if ! check_system_health "BASELINE"; then
  log_error "System is not healthy. Fix issues before running chaos experiments."
  exit 1
fi
record_metrics "BASELINE"

# Define experiments
declare -A EXPERIMENTS
EXPERIMENTS["network-delay"]="${CHAOS_DIR}/network-delay.yaml"
EXPERIMENTS["pod-kill"]="${CHAOS_DIR}/pod-kill.yaml"
EXPERIMENTS["stress-test"]="${CHAOS_DIR}/stress-test.yaml"
EXPERIMENTS["io-fault"]="${CHAOS_DIR}/io-fault.yaml"
EXPERIMENTS["dns-error"]="${CHAOS_DIR}/dns-error.yaml"

# Track results
PASSED=0
FAILED=0
SKIPPED=0
TOTAL_START=$(date +%s)

# Run experiments
if [ -n "$SPECIFIC_EXPERIMENT" ]; then
  if [ -z "${EXPERIMENTS[$SPECIFIC_EXPERIMENT]:-}" ]; then
    log_error "Unknown experiment: $SPECIFIC_EXPERIMENT"
    log_info "Available: ${!EXPERIMENTS[*]}"
    exit 1
  fi

  if run_experiment "$SPECIFIC_EXPERIMENT" "${EXPERIMENTS[$SPECIFIC_EXPERIMENT]}"; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
else
  for exp_name in network-delay pod-kill stress-test io-fault dns-error; do
    echo ""
    if run_experiment "$exp_name" "${EXPERIMENTS[$exp_name]}"; then
      PASSED=$((PASSED + 1))
    else
      FAILED=$((FAILED + 1))
    fi
    echo ""
  done
fi

TOTAL_ELAPSED=$(($(date +%s) - TOTAL_START))

# ============================================
# Summary Report
# ============================================
echo "" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
echo "CHAOS ENGINEERING SUMMARY"                    | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
echo "Total experiments: $((PASSED + FAILED + SKIPPED))" | tee -a "$REPORT_FILE"
echo "  Passed:  $PASSED"   | tee -a "$REPORT_FILE"
echo "  Failed:  $FAILED"   | tee -a "$REPORT_FILE"
echo "  Skipped: $SKIPPED"  | tee -a "$REPORT_FILE"
echo "Total time: ${TOTAL_ELAPSED}s" | tee -a "$REPORT_FILE"
echo "Report: $REPORT_FILE" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"

# Notify
if [ -n "${SLACK_WEBHOOK:-}" ]; then
  local status_emoji="[OK]"
  [ $FAILED -gt 0 ] && status_emoji="[ALERT]"

  curl -sf -X POST "$SLACK_WEBHOOK" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"${status_emoji} Chaos Engineering Report: ${PASSED} passed, ${FAILED} failed, ${SKIPPED} skipped (${TOTAL_ELAPSED}s)\"}" \
    > /dev/null 2>&1 || true
fi

# Exit with failure if any experiment failed
[ $FAILED -eq 0 ]
