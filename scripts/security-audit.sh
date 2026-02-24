#!/bin/bash
# TBS ERP - Automated Security Audit Script
# Usage: ./scripts/security-audit.sh
# Run periodically or before external audits

set -euo pipefail

REPORT_DIR="/tmp/tbs-security-audit-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$REPORT_DIR"

echo "=========================================="
echo "  TBS ERP Security Audit Report"
echo "  Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "=========================================="
echo ""

PASS=0
WARN=0
FAIL=0

check_pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
check_warn() { echo "  [WARN] $1"; WARN=$((WARN + 1)); }
check_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }

# 1. SSL Certificate Check
echo "1. SSL Certificates"
echo "-------------------"
for domain in api.tbslogistics.com app.tbslogistics.com nhaphangchinhngach.vn; do
  expiry=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "UNKNOWN")
  if [ "$expiry" = "UNKNOWN" ]; then
    check_warn "$domain: Unable to check certificate"
  else
    days_left=$(( ($(date -d "$expiry" +%s 2>/dev/null || echo 0) - $(date +%s)) / 86400 ))
    if [ "$days_left" -gt 30 ]; then
      check_pass "$domain: Certificate valid for $days_left days"
    elif [ "$days_left" -gt 7 ]; then
      check_warn "$domain: Certificate expires in $days_left days"
    else
      check_fail "$domain: Certificate expires in $days_left days!"
    fi
  fi
done
echo ""

# 2. Exposed Ports
echo "2. Exposed Ports"
echo "----------------"
exposed_ports=$(docker ps --format '{{.Names}}: {{.Ports}}' 2>/dev/null || echo "Docker not available")
echo "  $exposed_ports"
# Check that only nginx exposes ports 80/443
nginx_only=$(docker ps --format '{{.Names}}:{{.Ports}}' 2>/dev/null | grep -v "nginx" | grep "0.0.0.0:" || true)
if [ -z "$nginx_only" ]; then
  check_pass "Only Nginx exposes ports to host"
else
  check_fail "Non-Nginx services exposed: $nginx_only"
fi
echo ""

# 3. Database Security
echo "3. Database Security"
echo "--------------------"
if command -v psql &>/dev/null; then
  # Check for superuser connections
  superusers=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE usename = 'postgres'" 2>/dev/null || echo "N/A")
  echo "  Active superuser connections: $superusers"

  # Check for idle in transaction
  idle_tx=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction'" 2>/dev/null || echo "N/A")
  if [ "$idle_tx" != "N/A" ] && [ "$idle_tx" -gt 5 ]; then
    check_warn "Idle in transaction connections: $idle_tx"
  else
    check_pass "Idle in transaction connections: $idle_tx"
  fi

  # Check replication status
  repl_status=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_replication" 2>/dev/null || echo "N/A")
  echo "  Active replication connections: $repl_status"
else
  check_warn "psql not available - skipping database checks"
fi
echo ""

# 4. Dependency Vulnerabilities
echo "4. Dependency Audit"
echo "-------------------"
if [ -d "/app/tbs-erp-backend" ]; then
  backend_audit=$(cd /app/tbs-erp-backend && npm audit --production --json 2>/dev/null | grep -o '"critical":[0-9]*' | head -1 || echo "N/A")
  echo "  Backend: $backend_audit"
elif [ -d "tbs-erp-backend" ]; then
  backend_vulns=$(cd tbs-erp-backend && npm audit --production 2>/dev/null | tail -1 || echo "Unable to audit")
  echo "  Backend: $backend_vulns"
else
  check_warn "Backend directory not found"
fi
echo ""

# 5. Docker Image Security
echo "5. Container Security"
echo "---------------------"
if command -v trivy &>/dev/null; then
  for image in tbs-erp-backend tbs-erp-frontend tbs-cms-frontend; do
    critical=$(trivy image --severity CRITICAL --format json "ghcr.io/tbs-logistics/$image:latest" 2>/dev/null | grep -c '"Severity": "CRITICAL"' || echo "0")
    if [ "$critical" -gt 0 ]; then
      check_fail "$image: $critical CRITICAL vulnerabilities"
    else
      check_pass "$image: No CRITICAL vulnerabilities"
    fi
  done
else
  check_warn "Trivy not installed - skipping container scans"
fi
echo ""

# 6. Log Sanitization Check
echo "6. Log Sanitization"
echo "--------------------"
if [ -f "/var/log/nginx/access.log" ]; then
  password_in_logs=$(grep -ci "password\|secret\|token" /var/log/nginx/access.log 2>/dev/null | head -1 || echo "0")
  if [ "$password_in_logs" -gt 0 ]; then
    check_warn "Potential sensitive data in Nginx logs: $password_in_logs occurrences"
  else
    check_pass "No obvious sensitive data in Nginx logs"
  fi
else
  echo "  Nginx logs not accessible"
fi
echo ""

# 7. Active Sessions
echo "7. Active Sessions"
echo "------------------"
if command -v psql &>/dev/null && [ -n "${DATABASE_URL:-}" ]; then
  session_count=$(psql "$DATABASE_URL" -t -c 'SELECT count(*) FROM "Session" WHERE "expiresAt" > NOW()' 2>/dev/null || echo "N/A")
  echo "  Active sessions: $session_count"

  old_sessions=$(psql "$DATABASE_URL" -t -c 'SELECT count(*) FROM "Session" WHERE "expiresAt" < NOW() - interval '\''30 days'\''' 2>/dev/null || echo "N/A")
  if [ "$old_sessions" != "N/A" ] && [ "$old_sessions" -gt 0 ]; then
    check_warn "Expired sessions not cleaned: $old_sessions"
  fi
fi
echo ""

# 8. Backup Status
echo "8. Backup Status"
echo "----------------"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
if [ -d "$BACKUP_DIR" ]; then
  latest_backup=$(ls -t "$BACKUP_DIR"/daily_*.dump.gz 2>/dev/null | head -1 || echo "NONE")
  if [ "$latest_backup" = "NONE" ]; then
    check_fail "No daily backups found!"
  else
    backup_age=$(( ($(date +%s) - $(stat -c %Y "$latest_backup" 2>/dev/null || echo 0)) / 3600 ))
    if [ "$backup_age" -lt 25 ]; then
      check_pass "Latest backup: $latest_backup ($backup_age hours ago)"
    else
      check_fail "Latest backup is $backup_age hours old!"
    fi
  fi
else
  check_warn "Backup directory not found: $BACKUP_DIR"
fi
echo ""

# 9. Security Headers Check
echo "9. Security Headers"
echo "--------------------"
for url in "https://api.tbslogistics.com/api/v1/health" "https://app.tbslogistics.com"; do
  headers=$(curl -sI "$url" 2>/dev/null || echo "UNREACHABLE")
  if echo "$headers" | grep -qi "strict-transport-security"; then
    check_pass "$url: HSTS present"
  else
    check_warn "$url: HSTS missing"
  fi
  if echo "$headers" | grep -qi "x-content-type-options"; then
    check_pass "$url: X-Content-Type-Options present"
  else
    check_warn "$url: X-Content-Type-Options missing"
  fi
done
echo ""

# 10. Environment Variables
echo "10. Environment Check"
echo "---------------------"
[ -n "${JWT_SECRET:-}" ] && check_pass "JWT_SECRET is set" || check_fail "JWT_SECRET not set"
[ -n "${JWT_REFRESH_SECRET:-}" ] && check_pass "JWT_REFRESH_SECRET is set" || check_fail "JWT_REFRESH_SECRET not set"
[ -n "${FIELD_ENCRYPTION_KEY:-}" ] && check_pass "FIELD_ENCRYPTION_KEY is set" || check_warn "FIELD_ENCRYPTION_KEY not set"
[ -n "${TWO_FA_ENCRYPTION_KEY:-}" ] && check_pass "TWO_FA_ENCRYPTION_KEY is set" || check_warn "TWO_FA_ENCRYPTION_KEY not set"
[ -n "${SENTRY_DSN:-}" ] && check_pass "SENTRY_DSN is set" || check_warn "SENTRY_DSN not set"
echo ""

# Summary
echo "=========================================="
echo "  AUDIT SUMMARY"
echo "=========================================="
echo "  PASS: $PASS"
echo "  WARN: $WARN"
echo "  FAIL: $FAIL"
echo "  TOTAL: $((PASS + WARN + FAIL))"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  STATUS: FAILED - $FAIL critical issues found"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo "  STATUS: WARNING - $WARN issues need attention"
  exit 0
else
  echo "  STATUS: PASSED - All checks passed"
  exit 0
fi
