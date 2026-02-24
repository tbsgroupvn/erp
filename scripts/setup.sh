#!/usr/bin/env bash
set -euo pipefail

# ============================================
# ERP Self-Hosted Setup Script
# Interactive installer for self-hosted deployment
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
  echo ""
  echo -e "${BLUE}============================================${NC}"
  echo -e "${BLUE}  ERP Self-Hosted Setup${NC}"
  echo -e "${BLUE}============================================${NC}"
  echo ""
}

print_step() {
  echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
  echo -e "${RED}[✗]${NC} $1"
}

generate_secret() {
  openssl rand -hex 64
}

generate_password() {
  openssl rand -base64 32 | tr -d '=/+' | head -c 32
}

# ============================================
# Pre-flight checks
# ============================================
preflight_checks() {
  echo "Checking prerequisites..."
  echo ""

  local has_error=false

  # Docker
  if command -v docker &>/dev/null; then
    print_step "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
  else
    print_error "Docker is not installed. Please install Docker first."
    has_error=true
  fi

  # Docker Compose
  if docker compose version &>/dev/null; then
    print_step "Docker Compose $(docker compose version --short)"
  else
    print_error "Docker Compose is not available. Please install Docker Compose."
    has_error=true
  fi

  # OpenSSL (for secret generation)
  if command -v openssl &>/dev/null; then
    print_step "OpenSSL available"
  else
    print_error "OpenSSL is not installed."
    has_error=true
  fi

  # Check minimum RAM (2GB)
  local total_ram
  if [[ "$(uname)" == "Linux" ]]; then
    total_ram=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
    if [ "$total_ram" -lt 2048 ]; then
      print_warning "Low RAM: ${total_ram}MB detected. Minimum 2GB recommended."
    else
      print_step "RAM: ${total_ram}MB"
    fi
  fi

  # Check disk space (minimum 10GB)
  local free_disk
  free_disk=$(df -BG . | awk 'NR==2 {print $4}' | tr -d 'G')
  if [ "${free_disk:-0}" -lt 10 ]; then
    print_warning "Low disk space: ${free_disk}GB. Minimum 10GB recommended."
  else
    print_step "Disk space: ${free_disk}GB available"
  fi

  echo ""

  if [ "$has_error" = true ]; then
    print_error "Prerequisites check failed. Please fix the issues above."
    exit 1
  fi

  print_step "All prerequisites met!"
}

# ============================================
# Collect information
# ============================================
collect_info() {
  echo ""
  echo -e "${BLUE}--- Company Information ---${NC}"
  echo ""

  read -rp "Company name (e.g., Acme Corp): " COMPANY_NAME
  COMPANY_NAME=${COMPANY_NAME:-"My ERP"}

  read -rp "Company full name (e.g., Acme Corporation LLC): " COMPANY_FULL_NAME
  COMPANY_FULL_NAME=${COMPANY_FULL_NAME:-"$COMPANY_NAME"}

  read -rp "App title for ERP dashboard (e.g., Acme ERP): " APP_TITLE
  APP_TITLE=${APP_TITLE:-"$COMPANY_NAME ERP"}

  read -rp "Customer code prefix (e.g., ACM-KH-): " CUSTOMER_CODE_PREFIX
  CUSTOMER_CODE_PREFIX=${CUSTOMER_CODE_PREFIX:-"ERP-KH-"}

  read -rp "Support email: " SUPPORT_EMAIL
  read -rp "Support phone: " SUPPORT_PHONE
  read -rp "Company address: " COMPANY_ADDRESS

  echo ""
  echo -e "${BLUE}--- Domain Configuration ---${NC}"
  echo ""

  read -rp "Main domain (e.g., example.com): " CMS_DOMAIN
  CMS_DOMAIN=${CMS_DOMAIN:-"localhost"}

  read -rp "ERP subdomain (e.g., erp.example.com) [erp.${CMS_DOMAIN}]: " ERP_DOMAIN
  ERP_DOMAIN=${ERP_DOMAIN:-"erp.${CMS_DOMAIN}"}

  read -rp "API subdomain (e.g., api.example.com) [api.${CMS_DOMAIN}]: " API_DOMAIN
  API_DOMAIN=${API_DOMAIN:-"api.${CMS_DOMAIN}"}

  read -rp "Email domain for seed users (e.g., example.com) [${CMS_DOMAIN}]: " SEED_EMAIL_DOMAIN
  SEED_EMAIL_DOMAIN=${SEED_EMAIL_DOMAIN:-"${CMS_DOMAIN}"}

  echo ""
  echo -e "${BLUE}--- Database Configuration ---${NC}"
  echo ""

  read -rp "PostgreSQL username [erp_user]: " POSTGRES_USER
  POSTGRES_USER=${POSTGRES_USER:-"erp_user"}

  read -rp "PostgreSQL database name [erp_db]: " POSTGRES_DB
  POSTGRES_DB=${POSTGRES_DB:-"erp_db"}

  echo ""
  echo -e "${BLUE}--- SSL Configuration ---${NC}"
  echo ""

  read -rp "Email for Let's Encrypt SSL (required for HTTPS): " SSL_EMAIL
  if [ -z "$SSL_EMAIL" ]; then
    print_warning "No SSL email provided. You'll need to configure SSL manually."
  fi
}

# ============================================
# Generate .env file
# ============================================
generate_env() {
  echo ""
  echo "Generating .env file with secure credentials..."
  echo ""

  local POSTGRES_PASSWORD
  POSTGRES_PASSWORD=$(generate_password)
  local REDIS_PASSWORD
  REDIS_PASSWORD=$(generate_password)
  local JWT_SECRET
  JWT_SECRET=$(generate_secret)
  local JWT_REFRESH_SECRET
  JWT_REFRESH_SECRET=$(generate_secret)

  cat > .env <<EOF
# ============================================
# ERP Self-Hosted Configuration
# Generated by setup.sh on $(date -Iseconds)
# ============================================

# --- Project ---
COMPOSE_PROJECT_NAME=erp

# --- Company Branding ---
COMPANY_NAME=${COMPANY_NAME}
COMPANY_FULL_NAME=${COMPANY_FULL_NAME}
APP_TITLE=${APP_TITLE}
APP_DESCRIPTION=Enterprise Resource Planning System
CMS_TITLE=${COMPANY_NAME} CMS
CMS_DESCRIPTION=Content Management System
CUSTOMER_CODE_PREFIX=${CUSTOMER_CODE_PREFIX}
SUPPORT_EMAIL=${SUPPORT_EMAIL}
SUPPORT_PHONE=${SUPPORT_PHONE}
COMPANY_ADDRESS=${COMPANY_ADDRESS}
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

# --- Misc ---
LOG_LEVEL=info
DEMO_MODE=false
EOF

  chmod 600 .env
  print_step ".env file generated with secure passwords"
}

# ============================================
# Build and start
# ============================================
build_and_start() {
  echo ""
  echo "Building Docker images (this may take a few minutes)..."
  echo ""

  docker compose -f docker-compose.selfhost.yml build

  print_step "Docker images built successfully"

  echo ""
  echo "Starting services..."
  echo ""

  docker compose -f docker-compose.selfhost.yml up -d

  print_step "Services started"
}

# ============================================
# Run database migrations and seed
# ============================================
run_migrations() {
  echo ""
  echo "Running database migrations..."
  echo ""

  local project_name="${COMPOSE_PROJECT_NAME:-erp}"

  # Wait for backend to be healthy
  echo "Waiting for backend to be ready..."
  local retries=30
  while [ $retries -gt 0 ]; do
    if docker compose -f docker-compose.selfhost.yml exec -T backend wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health 2>/dev/null; then
      break
    fi
    retries=$((retries - 1))
    sleep 5
  done

  if [ $retries -eq 0 ]; then
    print_warning "Backend health check timed out. Migrations may need to be run manually."
    return
  fi

  docker compose -f docker-compose.selfhost.yml exec -T backend npx prisma migrate deploy
  print_step "Database migrations applied"

  docker compose -f docker-compose.selfhost.yml exec -T backend npx prisma db seed
  print_step "Database seeded"
}

# ============================================
# Setup SSL
# ============================================
setup_ssl() {
  if [ -z "${SSL_EMAIL:-}" ]; then
    print_warning "Skipping SSL setup (no email provided)"
    return
  fi

  echo ""
  echo "Setting up SSL certificates..."
  echo ""

  local domains="-d ${CMS_DOMAIN} -d www.${CMS_DOMAIN} -d ${ERP_DOMAIN} -d ${API_DOMAIN}"

  docker compose -f docker-compose.selfhost.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${SSL_EMAIL}" \
    --agree-tos \
    --no-eff-email \
    ${domains}

  # Reload nginx to pick up new certs
  docker compose -f docker-compose.selfhost.yml exec nginx nginx -s reload

  print_step "SSL certificates obtained and configured"
}

# ============================================
# Print summary
# ============================================
print_summary() {
  echo ""
  echo -e "${GREEN}============================================${NC}"
  echo -e "${GREEN}  Setup Complete!${NC}"
  echo -e "${GREEN}============================================${NC}"
  echo ""
  echo "Your ERP system is running at:"
  echo ""
  echo -e "  ERP Dashboard:  ${BLUE}https://${ERP_DOMAIN}${NC}"
  echo -e "  CMS Website:    ${BLUE}https://${CMS_DOMAIN}${NC}"
  echo -e "  API:            ${BLUE}https://${API_DOMAIN}${NC}"
  echo ""
  echo "Default admin account:"
  echo -e "  Email:    ${YELLOW}admin@${SEED_EMAIL_DOMAIN}${NC}"
  echo -e "  Password: ${YELLOW}Admin@123${NC}"
  echo ""
  echo -e "${RED}IMPORTANT: Change the default password immediately!${NC}"
  echo ""
  echo "Useful commands:"
  echo "  View logs:     docker compose -f docker-compose.selfhost.yml logs -f"
  echo "  Stop:          docker compose -f docker-compose.selfhost.yml down"
  echo "  Update:        ./scripts/update.sh"
  echo "  Backup:        ./scripts/backup.sh"
  echo ""
}

# ============================================
# Main
# ============================================
main() {
  print_header
  preflight_checks
  collect_info
  generate_env
  build_and_start
  run_migrations
  setup_ssl
  print_summary
}

main "$@"
