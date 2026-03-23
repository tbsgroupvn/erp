#!/usr/bin/env bash
# ============================================
# Script chay tren VPS - tao .env va deploy
# Chay bang: ssh root@185.111.159.216 'bash -s' < /tmp/vps-setup.sh
# ============================================
set -e

REPO_DIR="/opt/erp"
COMPOSE_FILE="docker-compose.ip.yml"
BRANCH="review/codebase-fixes-2026-03-16"

echo "=== [1/5] Tao file .env ==="
cat > "$REPO_DIR/.env" << 'ENVEOF'
COMPOSE_PROJECT_NAME=tbs-erp
POSTGRES_USER=tbs_user
POSTGRES_PASSWORD=TbsErp2026SecureDB
POSTGRES_DB=tbs_erp
REDIS_PASSWORD=TbsRedis2026Secure
JWT_SECRET=jwtSecretChangeMe64charsAb1234jwtSecretChangeMe64charsAb1234xxxx
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=jwtRefreshChangeMe64chAb1234jwtRefreshChangeMe64chAb1234xxxxxxxx
JWT_REFRESH_EXPIRES_IN=7d
ERP_DOMAIN=185.111.159.216
CMS_DOMAIN=185.111.159.216
API_DOMAIN=185.111.159.216
COMPANY_NAME=TBS Group
COMPANY_FULL_NAME=TBS Group Vietnam
APP_TITLE=TBS ERP
CUSTOMER_CODE_PREFIX=TBS-KH-
SEED_EMAIL_DOMAIN=tbs.com
FIELD_ENCRYPTION_KEY=a8f3d2b1c4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
TWO_FA_ENCRYPTION_KEY=b9g4e3c2d5f6g7b8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
TWO_FA_ENCRYPTION_SALT=c0h5f4d3e6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3
LOG_LEVEL=info
DATABASE_POOL_SIZE=20
ENVEOF
echo "✓ .env da duoc tao"

echo "=== [2/5] Pull code moi nhat ==="
cd "$REPO_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
echo "✓ Code da cap nhat (branch: $BRANCH)"

echo "=== [3/5] Stop containers cu (neu co) ==="
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || echo "(Khong co container nao dang chay)"

echo "=== [4/5] Build va start PostgreSQL + Redis truoc ==="
docker compose -f "$COMPOSE_FILE" build postgres redis 2>&1 | tail -5
docker compose -f "$COMPOSE_FILE" up -d postgres redis
echo "Doi PostgreSQL san sang (40 giay)..."
sleep 40

echo "=== [5/5] Chay DB migration ==="
docker compose -f "$COMPOSE_FILE" run --rm migrate && echo "✓ Migration OK" || echo "WARN: Migration co the da chay roi"

echo ""
echo "Build va start tat ca services... (mat 10-20 phut)"
echo "(Dang build frontend va backend Docker images...)"
docker compose -f "$COMPOSE_FILE" up -d --build 2>&1 | tail -20

echo ""
echo "==========================="
echo "Deploy hoan thanh!"
echo "==========================="
echo "Truy cap: http://185.111.159.216"
echo "API test: curl http://185.111.159.216:8080/api/v1/health"
