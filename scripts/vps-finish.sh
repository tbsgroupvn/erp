#!/bin/bash
# Script hoàn tất deploy - chỉ cần chạy một lần
set -e
cd /opt/erp

echo "[1] Pull code mới nhất (có APP_ENV fix)..."
git pull origin review/codebase-fixes-2026-03-16

echo "[2] Kiểm tra .env có APP_ENV chưa..."
grep -q "APP_ENV" .env && echo "APP_ENV đã có trong .env" || echo 'APP_ENV=production' >> .env

echo "[3] Restart backend với config mới..."
docker compose -f docker-compose.ip.yml up -d postgres redis
sleep 5
docker compose -f docker-compose.ip.yml up -d backend
echo "Đợi backend khởi động (40 giây)..."
sleep 40

echo "[4] Check backend..."
for i in {1..6}; do
    HEALTH=$(docker compose -f docker-compose.ip.yml exec -T backend wget -qO- http://localhost:3000/api/v1/health 2>/dev/null || echo "")
    if echo "$HEALTH" | grep -qi "ok\|healthy\|status\|{"; then
        echo "✓ Backend healthy!"
        break
    fi
    docker compose -f docker-compose.ip.yml logs backend --tail=3
    echo "Đợi thêm ($i/6)..."
    sleep 10
done

echo "[5] Start frontend + CMS + nginx..."
docker compose -f docker-compose.ip.yml up -d frontend cms nginx
echo "Đợi frontend/CMS khởi động (60 giây)..."
sleep 60

echo "[6] Kết quả cuối:"
docker compose -f docker-compose.ip.yml ps

echo ""
echo "=== HEALTH CHECK ==="
echo -n "Backend API: "
curl -fsS http://localhost:3000/api/v1/health 2>/dev/null && echo " => OK" || echo "=> Còn đang start..."

echo -n "ERP Frontend: "
curl -fsS -o /dev/null -w "%{http_code}" http://localhost:80 2>/dev/null

echo ""
echo "=============================="
echo "🎉 Deploy hoàn tất!"
echo "ERP:  http://185.111.159.216"
echo "API:  http://185.111.159.216:8080/api/v1/health"
echo "Login: admin@tbs.com / Admin@123"
echo "=============================="
