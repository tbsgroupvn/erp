#!/usr/bin/env bash
# ============================================================================
# TBS ERP - VPS Deployment Script
# Target OS : Ubuntu 22.04 LTS
# Usage     : sudo bash deploy-vps.sh --domain erp.example.com \
#                                     --api-domain api.example.com \
#                                     --cms-domain example.com \
#                                     --email admin@example.com
#
# Optional  : --repo-url  <git-url>   (default: skip clone if already present)
#             --project-dir <path>    (default: /opt/erp)
#             --no-ssl                (skip Let's Encrypt, useful for testing)
#             --company-name <name>   (default: "My ERP")
#
# This script is idempotent: safe to re-run on an existing installation.
# ============================================================================
set -euo pipefail
IFS=$'\n\t'

# ----------------------------------------------------------------------------
# Colour helpers
# ----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step()    { echo -e "\n${GREEN}[STEP]${NC} ${BOLD}$*${NC}"; }
info()    { echo -e "  ${BLUE}[INFO]${NC} $*"; }
ok()      { echo -e "  ${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "  ${YELLOW}[WARN]${NC} $*"; }
die()     { echo -e "\n${RED}[FATAL]${NC} $*" >&2; exit 1; }

# ----------------------------------------------------------------------------
# Defaults
# ----------------------------------------------------------------------------
ERP_DOMAIN=""
API_DOMAIN=""
CMS_DOMAIN=""
SSL_EMAIL=""
REPO_URL=""
PROJECT_DIR="/opt/erp"
SKIP_SSL=false
COMPANY_NAME="My ERP"
COMPANY_FULL_NAME=""
COMPOSE_PROJECT_NAME="erp"
POSTGRES_USER="erp_user"
POSTGRES_DB="erp_db"
DEPLOY_USER="erpdeploy"

# ----------------------------------------------------------------------------
# Argument parsing
# ----------------------------------------------------------------------------
usage() {
  cat <<EOF
Usage: sudo bash $0 [OPTIONS]

Required:
  --domain     <erp.example.com>    ERP dashboard domain
  --api-domain <api.example.com>    Backend API domain
  --email      <user@example.com>   Let's Encrypt / admin email

Optional:
  --cms-domain <example.com>        CMS/public website domain (defaults to parent of --domain)
  --repo-url   <https://...>        Git repository URL to clone
  --project-dir <path>              Install path (default: /opt/erp)
  --company-name <name>             Company short name (default: "My ERP")
  --no-ssl                          Skip Let's Encrypt certificate provisioning
  -h, --help                        Show this help

Examples:
  sudo bash deploy-vps.sh --domain erp.tbs.vn --api-domain api.tbs.vn --cms-domain tbs.vn --email ops@tbs.vn
  sudo bash deploy-vps.sh --domain erp.tbs.vn --api-domain api.tbs.vn --email ops@tbs.vn --no-ssl
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain)       ERP_DOMAIN="$2";        shift 2 ;;
      --api-domain)   API_DOMAIN="$2";         shift 2 ;;
      --cms-domain)   CMS_DOMAIN="$2";         shift 2 ;;
      --email)        SSL_EMAIL="$2";           shift 2 ;;
      --repo-url)     REPO_URL="$2";            shift 2 ;;
      --project-dir)  PROJECT_DIR="$2";         shift 2 ;;
      --company-name) COMPANY_NAME="$2";        shift 2 ;;
      --no-ssl)       SKIP_SSL=true;            shift   ;;
      -h|--help)      usage; exit 0 ;;
      *) die "Unknown argument: $1. Run with --help for usage." ;;
    esac
  done

  [[ -z "$ERP_DOMAIN" ]]  && die "--domain is required."
  [[ -z "$API_DOMAIN" ]]  && die "--api-domain is required."
  [[ -z "$SSL_EMAIL" ]]   && die "--email is required."

  # Derive CMS domain from ERP domain parent if not supplied
  if [[ -z "$CMS_DOMAIN" ]]; then
    CMS_DOMAIN="$(echo "$ERP_DOMAIN" | cut -d. -f2-)"
    warn "--cms-domain not specified. Defaulting to: ${CMS_DOMAIN}"
  fi

  COMPANY_FULL_NAME="${COMPANY_FULL_NAME:-$COMPANY_NAME}"
}

# ----------------------------------------------------------------------------
# Guard: must run as root
# ----------------------------------------------------------------------------
check_root() {
  if [[ "$EUID" -ne 0 ]]; then
    die "This script must be run as root. Use: sudo bash $0 $*"
  fi
}

# ----------------------------------------------------------------------------
# Guard: Ubuntu 22.04
# ----------------------------------------------------------------------------
check_os() {
  step "Checking operating system"
  if [[ ! -f /etc/os-release ]]; then
    die "/etc/os-release not found. This script requires Ubuntu 22.04."
  fi
  # shellcheck source=/dev/null
  source /etc/os-release
  if [[ "$ID" != "ubuntu" || "$VERSION_ID" != "22.04" ]]; then
    warn "Detected ${PRETTY_NAME}. This script targets Ubuntu 22.04 — continuing anyway."
  else
    ok "Ubuntu 22.04 LTS detected."
  fi
}

# ----------------------------------------------------------------------------
# Check hardware minimums
# ----------------------------------------------------------------------------
check_hardware() {
  step "Checking hardware resources"

  local ram_mb
  ram_mb=$(awk '/MemTotal/ { printf "%d", $2/1024 }' /proc/meminfo)
  if [[ "$ram_mb" -lt 3072 ]]; then
    warn "Available RAM: ${ram_mb}MB. Minimum recommended: 4096MB. The system may OOM during builds."
  else
    ok "RAM: ${ram_mb}MB"
  fi

  local disk_gb
  disk_gb=$(df -BG "$PROJECT_DIR" 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'G' || df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')
  if [[ "${disk_gb:-0}" -lt 20 ]]; then
    warn "Free disk: ${disk_gb}GB. Minimum recommended: 20GB."
  else
    ok "Free disk: ${disk_gb}GB"
  fi
}

# ----------------------------------------------------------------------------
# System update + base packages
# ----------------------------------------------------------------------------
install_base_packages() {
  step "Updating system and installing base packages"
  export DEBIAN_FRONTEND=noninteractive

  apt-get update -qq
  apt-get upgrade -y -qq
  apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ufw \
    git \
    openssl \
    pwgen \
    jq \
    unzip \
    htop \
    nano \
    fail2ban \
    logrotate \
    cron \
    tzdata
  ok "Base packages installed."
}

# ----------------------------------------------------------------------------
# Docker Engine + Docker Compose plugin
# ----------------------------------------------------------------------------
install_docker() {
  step "Installing Docker Engine"

  if command -v docker &>/dev/null; then
    local ver
    ver=$(docker --version | awk '{print $3}' | tr -d ',')
    ok "Docker already installed: ${ver}"
  else
    # Official Docker install script (verified SHA recommended for production;
    # for air-gapped use replace with manual apt repo setup)
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq \
      docker-ce \
      docker-ce-cli \
      containerd.io \
      docker-buildx-plugin \
      docker-compose-plugin

    systemctl enable --now docker
    ok "Docker Engine installed."
  fi

  # Verify compose plugin
  if ! docker compose version &>/dev/null; then
    die "Docker Compose plugin not available. Check Docker installation."
  fi
  ok "Docker Compose plugin: $(docker compose version --short)"
}

# ----------------------------------------------------------------------------
# Firewall (UFW) — allow only 22, 80, 443
# ----------------------------------------------------------------------------
configure_firewall() {
  step "Configuring UFW firewall"

  ufw --force reset  > /dev/null 2>&1
  ufw default deny incoming > /dev/null
  ufw default allow outgoing > /dev/null
  ufw allow 22/tcp  comment 'SSH'   > /dev/null
  ufw allow 80/tcp  comment 'HTTP'  > /dev/null
  ufw allow 443/tcp comment 'HTTPS' > /dev/null
  ufw --force enable > /dev/null

  ok "Firewall active. Allowed ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)."
  ufw status numbered
}

# ----------------------------------------------------------------------------
# Fail2ban basic config
# ----------------------------------------------------------------------------
configure_fail2ban() {
  step "Configuring fail2ban"
  systemctl enable --now fail2ban > /dev/null 2>&1 || true

  if [[ ! -f /etc/fail2ban/jail.local ]]; then
    cat > /etc/fail2ban/jail.local <<'FAIL2BAN'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
FAIL2BAN
    systemctl restart fail2ban > /dev/null 2>&1 || true
    ok "fail2ban configured."
  else
    ok "fail2ban already configured."
  fi
}

# ----------------------------------------------------------------------------
# Create deploy user (non-root, added to docker group)
# ----------------------------------------------------------------------------
create_deploy_user() {
  step "Creating deploy user: ${DEPLOY_USER}"

  if id "$DEPLOY_USER" &>/dev/null; then
    ok "User '${DEPLOY_USER}' already exists."
  else
    useradd --system --create-home --shell /bin/bash \
      --comment "ERP Deploy User" "$DEPLOY_USER"
    ok "User '${DEPLOY_USER}' created."
  fi

  # Add to docker group so it can run docker commands without sudo
  usermod -aG docker "$DEPLOY_USER"
  ok "'${DEPLOY_USER}' added to docker group."
}

# ----------------------------------------------------------------------------
# Clone or update project
# ----------------------------------------------------------------------------
setup_project_dir() {
  step "Setting up project directory: ${PROJECT_DIR}"

  mkdir -p "$PROJECT_DIR"

  if [[ -n "$REPO_URL" ]]; then
    if [[ -d "${PROJECT_DIR}/.git" ]]; then
      info "Git repository already exists. Pulling latest changes..."
      git -C "$PROJECT_DIR" pull --ff-only || warn "git pull failed (local changes?). Using existing code."
    else
      info "Cloning repository..."
      git clone "$REPO_URL" "$PROJECT_DIR"
      ok "Repository cloned."
    fi
  else
    if [[ ! -f "${PROJECT_DIR}/docker-compose.selfhost.yml" ]]; then
      die "No --repo-url provided and ${PROJECT_DIR}/docker-compose.selfhost.yml not found. Copy the project files to ${PROJECT_DIR} first."
    fi
    ok "Project files already present at ${PROJECT_DIR}."
  fi

  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$PROJECT_DIR"
  ok "Ownership set to ${DEPLOY_USER}."
}

# ----------------------------------------------------------------------------
# Generate .env if not already present
# Idempotent: never overwrites an existing .env to preserve secrets
# ----------------------------------------------------------------------------
generate_secrets() {
  step "Generating environment file"

  local env_file="${PROJECT_DIR}/.env"

  if [[ -f "$env_file" ]]; then
    ok ".env already exists — skipping secret generation (delete it to regenerate)."
    # Still export the variables so later steps can use them
    # shellcheck source=/dev/null
    set -o allexport; source "$env_file"; set +o allexport
    return
  fi

  info "Generating cryptographically secure secrets..."

  local POSTGRES_PASSWORD JWT_SECRET JWT_REFRESH_SECRET
  local FIELD_ENCRYPTION_KEY TWO_FA_ENCRYPTION_KEY TWO_FA_ENCRYPTION_SALT
  local REDIS_PASSWORD

  POSTGRES_PASSWORD="$(openssl rand -base64 32 | tr -d '=/+' | head -c 40)"
  REDIS_PASSWORD="$(openssl rand -base64 32 | tr -d '=/+' | head -c 40)"
  JWT_SECRET="$(openssl rand -hex 64)"
  JWT_REFRESH_SECRET="$(openssl rand -hex 64)"
  FIELD_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  TWO_FA_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  TWO_FA_ENCRYPTION_SALT="$(openssl rand -hex 16)"

  # Derive seed email domain from CMS_DOMAIN
  local SEED_EMAIL_DOMAIN="$CMS_DOMAIN"

  cat > "$env_file" <<EOF
# ============================================================================
# TBS ERP - Production Environment
# Generated by deploy-vps.sh on $(date -Iseconds)
# KEEP THIS FILE SECRET — never commit to git
# ============================================================================

# --- Project ---
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}

# --- Company Branding ---
COMPANY_NAME=${COMPANY_NAME}
COMPANY_FULL_NAME=${COMPANY_FULL_NAME}
APP_TITLE=${COMPANY_NAME} ERP
APP_DESCRIPTION=Enterprise Resource Planning System
CMS_TITLE=${COMPANY_NAME} CMS
CMS_DESCRIPTION=Content Management System
CUSTOMER_CODE_PREFIX=ERP-KH-
SUPPORT_EMAIL=${SSL_EMAIL}
SUPPORT_PHONE=
COMPANY_ADDRESS=
COMPANY_TAX_CODE=
AUTH_COOKIE=erp-auth
SEED_EMAIL_DOMAIN=${SEED_EMAIL_DOMAIN}

# --- Domains ---
CMS_DOMAIN=${CMS_DOMAIN}
ERP_DOMAIN=${ERP_DOMAIN}
API_DOMAIN=${API_DOMAIN}

# --- Database ---
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}

# --- Redis ---
REDIS_PASSWORD=${REDIS_PASSWORD}

# --- JWT (auto-generated, keep secret!) ---
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=7d

# --- Encryption (auto-generated, keep secret!) ---
FIELD_ENCRYPTION_KEY=${FIELD_ENCRYPTION_KEY}
TWO_FA_ENCRYPTION_KEY=${TWO_FA_ENCRYPTION_KEY}
TWO_FA_ENCRYPTION_SALT=${TWO_FA_ENCRYPTION_SALT}

# --- Logging ---
LOG_LEVEL=info

# --- Demo mode ---
DEMO_MODE=false

# --- Queue workers ---
ORDER_QUEUE_CONCURRENCY=3
NOTIFICATION_QUEUE_CONCURRENCY=5
FINANCE_QUEUE_CONCURRENCY=2
WAREHOUSE_QUEUE_CONCURRENCY=3
INTEGRATION_QUEUE_CONCURRENCY=2
REPORT_QUEUE_CONCURRENCY=1
BATCH_QUEUE_CONCURRENCY=2
QUEUE_RATE_LIMIT_MAX=100
QUEUE_RATE_LIMIT_DURATION_MS=10000
QUEUE_STALLED_INTERVAL_MS=30000
QUEUE_MAX_STALLED_COUNT=2

# --- Database pool ---
DATABASE_POOL_SIZE=20

# --- Email (SMTP) — fill in to enable email notifications ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=noreply@${CMS_DOMAIN}
SMTP_FROM_NAME=${COMPANY_NAME}

# --- Jitsi Video Call (leave blank to use public meet.jit.si) ---
JITSI_DOMAIN=meet.jit.si
JITSI_APP_ID=
JITSI_SECRET=

# --- Anthropic AI (optional) ---
ANTHROPIC_API_KEY=

# --- Sentry (optional) ---
SENTRY_DSN=
EOF

  chmod 600 "$env_file"
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "$env_file"
  ok ".env generated with secure credentials."

  # Export for the rest of this script
  # shellcheck source=/dev/null
  set -o allexport; source "$env_file"; set +o allexport
}

# ----------------------------------------------------------------------------
# Generate PgBouncer userlist (MD5 password hash)
# Format: "md5" + md5(password + username)
# Must be regenerated whenever POSTGRES_PASSWORD changes
# ----------------------------------------------------------------------------
generate_pgbouncer_userlist() {
  step "Generating PgBouncer userlist"

  local config_dir="${PROJECT_DIR}/tbs-erp-backend/config"
  local userlist="${config_dir}/pgbouncer-userlist.txt"

  # Load .env if variables not in environment
  if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    # shellcheck source=/dev/null
    set -o allexport; source "${PROJECT_DIR}/.env"; set +o allexport
  fi

  local pg_user="${POSTGRES_USER:-erp_user}"
  local pg_pass="${POSTGRES_PASSWORD}"

  # PgBouncer MD5 format: md5( password || username )
  local hash
  hash="md5$(printf '%s%s' "${pg_pass}" "${pg_user}" | md5sum | cut -d' ' -f1)"

  mkdir -p "$config_dir"
  cat > "$userlist" <<EOF
; PgBouncer userlist — auto-generated by deploy-vps.sh on $(date -Iseconds)
; auth_type = md5  ->  stored as md5(password + username)
; Regenerate if POSTGRES_PASSWORD changes.
"${pg_user}" "${hash}"
EOF

  chmod 640 "$userlist"
  chown root:"${DEPLOY_USER}" "$userlist"
  ok "PgBouncer userlist generated."
}

# ----------------------------------------------------------------------------
# Patch pgbouncer.ini to use the correct POSTGRES_DB name from .env
# The compose file uses DATABASE_URL pointing to logical db "tbs_erp" in
# pgbouncer.ini. If the user configured POSTGRES_DB differently we update it.
# ----------------------------------------------------------------------------
patch_pgbouncer_ini() {
  step "Patching PgBouncer configuration"

  local ini_file="${PROJECT_DIR}/tbs-erp-backend/config/pgbouncer.ini"

  if [[ ! -f "$ini_file" ]]; then
    die "pgbouncer.ini not found at ${ini_file}. Ensure project files are present."
  fi

  if [[ -z "${POSTGRES_DB:-}" ]]; then
    # shellcheck source=/dev/null
    set -o allexport; source "${PROJECT_DIR}/.env"; set +o allexport
  fi

  # The logical DB name in the [databases] section must match what the backend
  # DATABASE_URL uses. The compose file hardcodes "tbs_erp" as the logical name
  # and maps it to the real dbname. Update the real dbname if needed.
  sed -i "s|dbname=[^ ]*|dbname=${POSTGRES_DB}|g" "$ini_file"
  ok "pgbouncer.ini patched: dbname=${POSTGRES_DB}"
}

# ----------------------------------------------------------------------------
# Create a self-signed dummy certificate so nginx can start before certbot
# ----------------------------------------------------------------------------
create_dummy_ssl() {
  step "Creating temporary self-signed SSL certificate"

  local vol_name="${COMPOSE_PROJECT_NAME}_certbot_conf"
  local cert_dir="/etc/letsencrypt/live/${CMS_DOMAIN}"

  # Use a temporary Alpine container that mounts the named Docker volume
  docker run --rm \
    -v "${vol_name}:/etc/letsencrypt" \
    alpine:3.19 sh -c "
      apk add --no-cache openssl > /dev/null 2>&1
      mkdir -p '${cert_dir}'
      if [ -f '${cert_dir}/fullchain.pem' ]; then
        echo 'Certificate already exists, skipping.'
      else
        openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
          -keyout '${cert_dir}/privkey.pem' \
          -out '${cert_dir}/fullchain.pem' \
          -subj '/CN=${CMS_DOMAIN}' 2>/dev/null
        echo 'Dummy certificate created.'
      fi
    "

  ok "Temporary SSL certificate ready in volume: ${vol_name}"
}

# ----------------------------------------------------------------------------
# Build Docker images
# ----------------------------------------------------------------------------
build_images() {
  step "Building Docker images (this may take 5-15 minutes on first run)"
  cd "$PROJECT_DIR"

  docker compose -f docker-compose.selfhost.yml build \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    2>&1 | tee /tmp/erp_build.log | tail -20

  ok "Docker images built successfully."
}

# ----------------------------------------------------------------------------
# Start infrastructure layer (postgres + redis), wait for health
# ----------------------------------------------------------------------------
start_infrastructure() {
  step "Starting infrastructure: PostgreSQL + Redis"
  cd "$PROJECT_DIR"

  docker compose -f docker-compose.selfhost.yml up -d postgres redis

  info "Waiting for PostgreSQL to be healthy (up to 90 seconds)..."
  local retries=30
  while [[ $retries -gt 0 ]]; do
    if docker compose -f docker-compose.selfhost.yml exec -T postgres \
        pg_isready -U "${POSTGRES_USER:-erp_user}" -d "${POSTGRES_DB:-erp_db}" \
        > /dev/null 2>&1; then
      ok "PostgreSQL is healthy."
      break
    fi
    retries=$((retries - 1))
    sleep 3
  done

  if [[ $retries -eq 0 ]]; then
    die "PostgreSQL did not become healthy in time. Check: docker compose -f docker-compose.selfhost.yml logs postgres"
  fi

  info "Waiting for Redis to be healthy..."
  retries=20
  while [[ $retries -gt 0 ]]; do
    if docker compose -f docker-compose.selfhost.yml exec -T redis \
        redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep -q "PONG"; then
      ok "Redis is healthy."
      break
    fi
    retries=$((retries - 1))
    sleep 3
  done

  if [[ $retries -eq 0 ]]; then
    warn "Redis health check timed out. It may still be starting."
  fi
}

# ----------------------------------------------------------------------------
# Run Prisma migrations and seed
# ----------------------------------------------------------------------------
run_migrations() {
  step "Running database migrations and seed"
  cd "$PROJECT_DIR"

  docker compose -f docker-compose.selfhost.yml \
    --profile migrate run --rm migrate \
    sh -c "npx prisma migrate deploy && npx prisma db seed"

  ok "Migrations applied and database seeded."
}

# ----------------------------------------------------------------------------
# Start all services (nginx starts with dummy cert)
# ----------------------------------------------------------------------------
start_all_services() {
  step "Starting all services"
  cd "$PROJECT_DIR"

  docker compose -f docker-compose.selfhost.yml up -d

  info "Waiting for backend to pass health checks (up to 120 seconds)..."
  local retries=40
  while [[ $retries -gt 0 ]]; do
    local status
    status=$(docker compose -f docker-compose.selfhost.yml ps backend --format json 2>/dev/null \
             | python3 -c "import sys,json; data=json.load(sys.stdin) if sys.stdin.read(1)!='[' else json.load(sys.stdin)[0]; print(data.get('Health',''))" 2>/dev/null || echo "")
    # Fallback: just check the HTTP endpoint directly
    if docker compose -f docker-compose.selfhost.yml exec -T backend \
        wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health \
        > /dev/null 2>&1; then
      ok "Backend API is healthy."
      break
    fi
    retries=$((retries - 1))
    sleep 3
  done

  if [[ $retries -eq 0 ]]; then
    warn "Backend health check timed out. It may still be starting. Check: docker compose -f docker-compose.selfhost.yml logs backend"
  fi
}

# ----------------------------------------------------------------------------
# Request real Let's Encrypt certificates
# ----------------------------------------------------------------------------
setup_ssl() {
  if [[ "$SKIP_SSL" == "true" ]]; then
    warn "SSL setup skipped (--no-ssl flag). Nginx is running with a self-signed certificate."
    return
  fi

  step "Provisioning Let's Encrypt SSL certificates"
  cd "$PROJECT_DIR"

  local vol_name="${COMPOSE_PROJECT_NAME}_certbot_conf"
  local cert_dir="/etc/letsencrypt/live/${CMS_DOMAIN}"

  info "Removing temporary self-signed certificate..."
  docker run --rm -v "${vol_name}:/etc/letsencrypt" alpine:3.19 \
    sh -c "rm -rf '${cert_dir}'" || true

  info "Requesting certificate for: ${CMS_DOMAIN}, www.${CMS_DOMAIN}, ${ERP_DOMAIN}, ${API_DOMAIN}"

  docker compose -f docker-compose.selfhost.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${SSL_EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d "${CMS_DOMAIN}" \
    -d "www.${CMS_DOMAIN}" \
    -d "${ERP_DOMAIN}" \
    -d "${API_DOMAIN}"

  info "Reloading nginx with new certificate..."
  docker compose -f docker-compose.selfhost.yml exec nginx nginx -s reload

  ok "SSL certificates provisioned and nginx reloaded."
}

# ----------------------------------------------------------------------------
# Install systemd service for auto-start on reboot
# ----------------------------------------------------------------------------
install_systemd_service() {
  step "Installing systemd service for auto-start on reboot"

  cat > /etc/systemd/system/erp.service <<UNIT
[Unit]
Description=TBS ERP Docker Compose Application
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/docker compose -f docker-compose.selfhost.yml up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f docker-compose.selfhost.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.selfhost.yml pull && \
           /usr/bin/docker compose -f docker-compose.selfhost.yml up -d --remove-orphans
TimeoutStartSec=300
TimeoutStopSec=120
StandardOutput=journal
StandardError=journal
SyslogIdentifier=erp-compose

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable erp.service
  ok "systemd service 'erp' installed and enabled."
}

# ----------------------------------------------------------------------------
# Install log rotation for nginx container logs
# ----------------------------------------------------------------------------
install_log_rotation() {
  step "Installing log rotation"

  cat > /etc/logrotate.d/erp-nginx <<LOGROTATE
/var/lib/docker/volumes/${COMPOSE_PROJECT_NAME}_nginx_logs/_data/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        docker exec ${COMPOSE_PROJECT_NAME}_nginx nginx -s reopen 2>/dev/null || true
    endscript
}
LOGROTATE

  ok "Log rotation configured (14 days retention)."
}

# ----------------------------------------------------------------------------
# Verify deployment health endpoint
# ----------------------------------------------------------------------------
verify_health() {
  step "Verifying deployment health"

  local api_url
  if [[ "$SKIP_SSL" == "true" ]]; then
    api_url="http://localhost/api/v1/health"
  else
    api_url="https://${API_DOMAIN}/api/v1/health"
  fi

  info "Querying health endpoint: ${api_url}"

  local retries=10
  local http_code=""
  while [[ $retries -gt 0 ]]; do
    http_code=$(curl -sk -o /dev/null -w "%{http_code}" \
      --max-time 10 \
      --connect-timeout 5 \
      "$api_url" 2>/dev/null || echo "000")

    if [[ "$http_code" == "200" ]]; then
      ok "Health endpoint returned HTTP 200."
      break
    fi
    warn "Health check returned HTTP ${http_code} — retrying (${retries} left)..."
    retries=$((retries - 1))
    sleep 6
  done

  if [[ "$http_code" != "200" ]]; then
    warn "Health check did not return 200. The API may still be starting."
    warn "Check manually: curl -k ${api_url}"
  fi
}

# ----------------------------------------------------------------------------
# Set strict file permissions on .env
# ----------------------------------------------------------------------------
lock_env_permissions() {
  step "Locking .env file permissions"
  chmod 600 "${PROJECT_DIR}/.env"
  chown root:root "${PROJECT_DIR}/.env"
  ok ".env permissions: 600 root:root"
}

# ----------------------------------------------------------------------------
# Print deployment summary
# ----------------------------------------------------------------------------
print_summary() {
  # Reload .env to read the credentials we need to display
  # shellcheck source=/dev/null
  set -o allexport
  source "${PROJECT_DIR}/.env"
  set +o allexport

  local erp_url cms_url api_url
  local protocol="https"
  [[ "$SKIP_SSL" == "true" ]] && protocol="http"

  erp_url="${protocol}://${ERP_DOMAIN}"
  cms_url="${protocol}://${CMS_DOMAIN}"
  api_url="${protocol}://${API_DOMAIN}"

  echo ""
  echo -e "${GREEN}${BOLD}============================================================${NC}"
  echo -e "${GREEN}${BOLD}  TBS ERP - Deployment Complete!${NC}"
  echo -e "${GREEN}${BOLD}============================================================${NC}"
  echo ""
  echo -e "  ${CYAN}ERP Dashboard :${NC}  ${BOLD}${erp_url}${NC}"
  echo -e "  ${CYAN}CMS Website   :${NC}  ${BOLD}${cms_url}${NC}"
  echo -e "  ${CYAN}API           :${NC}  ${BOLD}${api_url}/api/v1/health${NC}"
  echo ""
  echo -e "${YELLOW}${BOLD}Default admin credentials (change immediately!):${NC}"
  echo -e "  ${CYAN}Email    :${NC}  admin@${SEED_EMAIL_DOMAIN}"
  echo -e "  ${CYAN}Password :${NC}  Admin@123"
  echo ""
  echo -e "${YELLOW}${BOLD}Generated secrets (stored in ${PROJECT_DIR}/.env):${NC}"
  echo -e "  ${CYAN}DB User     :${NC}  ${POSTGRES_USER}"
  echo -e "  ${CYAN}DB Name     :${NC}  ${POSTGRES_DB}"
  echo -e "  ${CYAN}DB Password :${NC}  ${POSTGRES_PASSWORD}"
  echo -e "  ${CYAN}Redis Pass  :${NC}  ${REDIS_PASSWORD}"
  echo ""
  echo -e "${YELLOW}${BOLD}IMPORTANT NEXT STEPS:${NC}"
  echo -e "  1. Log in and change the default admin password"
  echo -e "  2. Configure SMTP in ${PROJECT_DIR}/.env (SMTP_HOST, SMTP_USER, SMTP_PASS)"
  echo -e "  3. Back up ${PROJECT_DIR}/.env to a secure location"
  echo -e "  4. Run: ${CYAN}./scripts/backup.sh${NC} to create first database backup"
  echo ""
  echo -e "${BOLD}Operations reference:${NC}"
  echo -e "  View logs    : cd ${PROJECT_DIR} && docker compose -f docker-compose.selfhost.yml logs -f"
  echo -e "  Status       : cd ${PROJECT_DIR} && docker compose -f docker-compose.selfhost.yml ps"
  echo -e "  Stop         : cd ${PROJECT_DIR} && docker compose -f docker-compose.selfhost.yml down"
  echo -e "  Update       : cd ${PROJECT_DIR} && sudo bash scripts/update.sh"
  echo -e "  Backup DB    : cd ${PROJECT_DIR} && bash scripts/backup.sh"
  echo -e "  Service mgmt : sudo systemctl [start|stop|restart] erp"
  echo ""
  echo -e "${GREEN}${BOLD}Deployment log saved to: /tmp/erp_deploy_$(date +%Y%m%d).log${NC}"
  echo ""
}

# ----------------------------------------------------------------------------
# Save a timestamped deployment record
# ----------------------------------------------------------------------------
save_deployment_record() {
  local record_file="/tmp/erp_deploy_$(date +%Y%m%d).log"
  {
    echo "============================================================"
    echo "TBS ERP Deployment Record"
    echo "Date         : $(date -Iseconds)"
    echo "Hostname     : $(hostname -f)"
    echo "Project dir  : ${PROJECT_DIR}"
    echo "ERP domain   : ${ERP_DOMAIN}"
    echo "CMS domain   : ${CMS_DOMAIN}"
    echo "API domain   : ${API_DOMAIN}"
    echo "SSL          : $([[ "$SKIP_SSL" == "true" ]] && echo 'disabled' || echo 'enabled')"
    echo "Deploy user  : ${DEPLOY_USER}"
    echo "============================================================"
  } >> "$record_file"
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  parse_args "$@"
  check_root
  check_os
  check_hardware

  echo ""
  echo -e "${BLUE}${BOLD}============================================================${NC}"
  echo -e "${BLUE}${BOLD}  TBS ERP - VPS Deployment${NC}"
  echo -e "${BLUE}${BOLD}  ERP: ${ERP_DOMAIN}  |  API: ${API_DOMAIN}  |  CMS: ${CMS_DOMAIN}${NC}"
  echo -e "${BLUE}${BOLD}============================================================${NC}"

  install_base_packages
  install_docker
  configure_firewall
  configure_fail2ban
  create_deploy_user
  setup_project_dir
  generate_secrets
  generate_pgbouncer_userlist
  patch_pgbouncer_ini
  create_dummy_ssl
  build_images
  start_infrastructure
  run_migrations
  start_all_services
  setup_ssl
  verify_health
  install_systemd_service
  install_log_rotation
  lock_env_permissions
  save_deployment_record
  print_summary
}

main "$@"
