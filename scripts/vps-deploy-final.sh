#!/bin/bash
# Deploy cuối cùng - rebuild toàn bộ và start
set -e
cd /opt/erp

echo "=== [1/6] Pull code mới nhất ==="
git pull origin review/codebase-fixes-2026-03-16

echo "=== [2/6] Ensure .env has APP_ENV ==="
grep -q "APP_ENV" .env && echo "OK" || echo 'APP_ENV=production' >> .env

echo "=== [3/6] Start DB services ==="
docker compose -f docker-compose.ip.yml up -d postgres redis
echo "Waiting 30s for DB..."
sleep 30

echo "=== [4/6] Build + Start backend (WITH --build) ==="
docker compose -f docker-compose.ip.yml up -d --build backend
echo "Waiting 60s for backend startup..."
sleep 60

echo "=== Backend logs (last 20 lines): ==="
docker compose -f docker-compose.ip.yml logs backend --tail=20

echo "=== [5/6] Build + Start frontend, CMS, nginx ==="
docker compose -f docker-compose.ip.yml up -d --build frontend cms nginx
echo "Waiting 30s..."
sleep 30

echo "=== [6/6] Final status ==="
docker compose -f docker-compose.ip.yml ps
echo ""
echo "=== Health checks ==="
echo -n "Backend: "
curl -sf http://localhost:3000/api/v1/health 2>/dev/null | head -c 200 || echo "NOT READY"
echo ""
echo "DONE. Access: http://185.111.159.216"
