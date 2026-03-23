#!/bin/bash
# Final deploy script - handles all services correctly
set -e
cd /opt/erp

echo "=== [1/5] Pull code ==="
git pull origin review/codebase-fixes-2026-03-16

echo "=== [2/5] Start DB ==="
docker compose -f docker-compose.ip.yml up -d postgres redis
sleep 10

echo "=== [3/5] Rebuild + Start backend ==="
docker compose -f docker-compose.ip.yml up -d --build backend
echo "Wait 90s for backend..."
sleep 90

echo "=== Backend logs ==="
docker compose -f docker-compose.ip.yml logs backend --tail=30

echo "=== [4/5] Start frontend + CMS + nginx ==="
docker compose -f docker-compose.ip.yml up -d frontend cms nginx
echo "Wait 30s..."
sleep 30

echo "=== [5/5] Status ==="
docker compose -f docker-compose.ip.yml ps
echo ""
echo -n "Backend health: "
curl -sf http://localhost:3000/api/v1/health 2>/dev/null | head -c 200 || echo "PENDING"
echo ""
echo "Access: http://185.111.159.216"
