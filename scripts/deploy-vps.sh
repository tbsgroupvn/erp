#!/bin/bash
# ============================================
# TBS ERP - Deploy Script cho Contabo VPS
# Chay tren VPS: bash /opt/erp/scripts/deploy-vps.sh
# ============================================
set -e

REPO_DIR="/opt/erp"
COMPOSE_FILE="docker-compose.ip.yml"
BRANCH="review/codebase-fixes-2026-03-16"

echo "================================"
echo "TBS ERP - VPS Deploy"
echo "================================"

# 1. Pull code moi nhat
echo ""
echo "[1/6] Pull code tu GitHub..."
cd "$REPO_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
echo "✓ Code da duoc cap nhat"

# 2. Kiem tra .env
echo ""
echo "[2/6] Kiem tra .env..."
if [ ! -f "$REPO_DIR/.env" ]; then
    echo "ERROR: File .env chua ton tai!"
    echo "Vui long tao file .env truoc khi chay script nay."
    echo "Xem file .env.vps.example de biet cac bien can thiet."
    exit 1
fi
echo "✓ File .env da ton tai"

# 3. Stop containers cu (neu co)
echo ""
echo "[3/6] Dung containers cu..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans || true
echo "✓ Da dung services"

# 4. Build images
echo ""
echo "[4/6] Build Docker images (co the mat 5-15 phut)..."
docker compose -f "$COMPOSE_FILE" build --no-cache
echo "✓ Build hoan thanh"

# 5. Start database va redis truoc
echo ""
echo "[5/6] Khoi dong PostgreSQL va Redis..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis
echo "Doi PostgreSQL san sang (30 giay)..."
sleep 30

# Kiem tra postgres healthy
echo "Kiem tra PostgreSQL..."
for i in {1..10}; do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${POSTGRES_USER:-tbs_user}" -d "${POSTGRES_DB:-tbs_erp}" &>/dev/null; then
        echo "✓ PostgreSQL san sang"
        break
    fi
    echo "  Doi them... ($i/10)"
    sleep 5
done

# 6. Chay migrations
echo ""
echo "[6/7] Chay database migrations + seed..."
docker compose -f "$COMPOSE_FILE" run --rm migrate || {
    echo "WARN: Migration co the da chay roi (skip)"
}
echo "✓ Migration hoan thanh"

# 7. Start tat ca services
echo ""
echo "[7/7] Khoi dong tat ca services..."
docker compose -f "$COMPOSE_FILE" up -d
echo ""

# Doi services healthy
echo "Doi services khoi dong (co the mat 2-3 phut)..."
sleep 60

echo ""
echo "================================"
echo "Kiem tra trang thai services:"
echo "================================"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "================================"
echo "Test health check:"
echo "================================"
echo -n "Backend API: "
if curl -sf http://localhost:8080/api/v1/health &>/dev/null; then
    echo "✓ OK"
else
    echo "✗ FAIL - Xem logs: docker compose -f $COMPOSE_FILE logs backend"
fi

echo -n "Frontend ERP: "
if curl -sf http://localhost:80 &>/dev/null; then
    echo "✓ OK"
else
    echo "✗ FAIL - Xem logs: docker compose -f $COMPOSE_FILE logs frontend"
fi

echo ""
echo "================================"
echo "🎉 Deploy hoan thanh!"
echo "================================"
echo ""
echo "Truy cap ERP:  http://185.111.159.216"
echo "Truy cap API:  http://185.111.159.216:8080/api/v1/health"
echo "Truy cap CMS:  (chem qua nginx default)"
echo ""
echo "Dang nhap mac dinh:"
echo "  Email: admin@tbs.com"
echo "  Password: Admin@123"
echo ""
echo "QUAN TRONG: Doi mat khau admin ngay sau khi dang nhap!"
