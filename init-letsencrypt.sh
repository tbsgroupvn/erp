#!/bin/bash
# ============================================
# TBS ERP - Let's Encrypt SSL Certificate Setup
# Run this once on first deployment
# Based on: https://github.com/wmnnd/nginx-certbot
# ============================================

set -e

# Load environment
if [ -f .env ]; then
  source .env
fi

# Configuration
DOMAINS=(nhaphangchinhngach.vn www.nhaphangchinhngach.vn erp.nhaphangchinhngach.vn api.nhaphangchinhngach.vn)
EMAIL="${CERTBOT_EMAIL:-admin@nhaphangchinhngach.vn}"
STAGING=${STAGING:-0}  # Set to 1 for testing (avoids rate limits)
RSA_KEY_SIZE=4096
DATA_PATH="./certbot"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================
# Step 1: Create dummy certificates
# ============================================
log_info "Creating dummy certificates for nginx to start..."

CERT_PATH="/etc/letsencrypt/live/nhaphangchinhngach.vn"

docker compose run --rm --entrypoint "\
  mkdir -p $CERT_PATH" certbot

docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
    -keyout '$CERT_PATH/privkey.pem' \
    -out '$CERT_PATH/fullchain.pem' \
    -subj '/CN=localhost'" certbot

log_info "Dummy certificates created"

# ============================================
# Step 2: Start nginx with dummy certificates
# ============================================
log_info "Starting nginx with dummy certificates..."
docker compose up -d nginx
sleep 5

# ============================================
# Step 3: Delete dummy certificates
# ============================================
log_info "Removing dummy certificates..."
docker compose run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/nhaphangchinhngach.vn && \
  rm -rf /etc/letsencrypt/archive/nhaphangchinhngach.vn && \
  rm -rf /etc/letsencrypt/renewal/nhaphangchinhngach.vn.conf" certbot

# ============================================
# Step 4: Request real certificates
# ============================================
log_info "Requesting SSL certificates from Let's Encrypt..."

# Build domain arguments
DOMAIN_ARGS=""
for domain in "${DOMAINS[@]}"; do
  DOMAIN_ARGS="$DOMAIN_ARGS -d $domain"
done

# Select staging or production
if [ "$STAGING" != "0" ]; then
  STAGING_ARG="--staging"
  log_warn "Using STAGING environment (certificates won't be trusted)"
else
  STAGING_ARG=""
fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    --email $EMAIL \
    $DOMAIN_ARGS \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

# ============================================
# Step 5: Reload nginx with real certificates
# ============================================
log_info "Reloading nginx with real SSL certificates..."
docker compose exec nginx nginx -s reload

echo ""
log_info "============================================"
log_info "SSL certificates installed successfully!"
log_info "============================================"
log_info "Certificates will auto-renew via certbot container."
log_info ""
log_info "To test renewal: docker compose run --rm certbot renew --dry-run"
log_info "To force renewal: docker compose run --rm certbot renew --force-renewal"
