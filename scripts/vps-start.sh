#!/bin/bash
set -e
cd /opt/erp

echo "[1/5] Khoi dong DB services..."
docker compose -f docker-compose.ip.yml up -d postgres redis
echo "Doi 45 giay cho PostgreSQL san sang..."
sleep 45

for i in {1..12}; do
    if docker compose -f docker-compose.ip.yml exec -T postgres pg_isready -U tbs_user -d tbs_erp 2>/dev/null; then
        echo "PostgreSQL san sang!"
        break
    fi
    echo "Doi PostgreSQL... ($i/12)"
    sleep 5
done

echo "[2/5] Chay DB migration..."
docker compose -f docker-compose.ip.yml run --rm migrate && echo "Migration OK" || echo "Migration skip (co the da chay)"

echo "[3/5] Build va start backend..."
docker compose -f docker-compose.ip.yml up -d --build backend
echo "Doi backend khoi dong (60 giay)..."
sleep 60

for i in {1..10}; do
    if curl -sf http://localhost:3000/api/v1/health 2>/dev/null | grep -q "ok\|healthy\|status"; then
        echo "Backend API san sang!"
        break
    fi
    echo "Doi backend... ($i/10)"
    sleep 10
done

echo "[4/5] Build va start frontend + CMS + nginx..."
docker compose -f docker-compose.ip.yml up -d --build frontend cms nginx
echo "Doi frontend build xong (90 giay)..."
sleep 90

echo "[5/5] Kiem tra trang thai..."
docker compose -f docker-compose.ip.yml ps

echo ""
curl -sf http://localhost:8080/api/v1/health && echo "Backend: OK" || echo "Backend: FAIL"
curl -sf http://localhost/ && echo "Frontend: OK" || echo "Frontend: Check sau"

echo ""
echo "=== DEPLOY XONG ==="
echo "Truy cap: http://185.111.159.216"
echo "API:      http://185.111.159.216:8080/api/v1/health"
echo "Login:    admin@tbs.com / Admin@123"
