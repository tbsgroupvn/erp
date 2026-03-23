#!/bin/bash
# Script chay trong 1 SSH session duy nhat
cd /opt/erp

echo "=== Check backend logs ==="
docker compose -f docker-compose.ip.yml logs backend --tail=5

echo ""
echo "=== Check services status ==="
docker compose -f docker-compose.ip.yml ps

echo ""
echo "=== Doi backend healthy (toi da 120s) ==="
for i in {1..12}; do
    if curl -sf http://localhost:3000/api/v1/health &>/dev/null; then
        echo "Backend API HEALTHY!"
        break
    fi
    echo "Doi ($i/12)..."
    sleep 10
done

echo ""
echo "=== Start frontend + CMS + nginx (neu chua chay) ==="
docker compose -f docker-compose.ip.yml up -d frontend cms nginx
echo "Doi 60 giay..."
sleep 60

echo ""
echo "=== Ket qua cuoi ==="
docker compose -f docker-compose.ip.yml ps

echo ""
echo "=== Health checks ==="
echo -n "Backend API (port 3000 internal): "
curl -sf http://localhost:3000/api/v1/health && echo "OK" || echo "FAIL"

echo -n "Nginx port 80 (ERP frontend): "
curl -sf http://localhost:80 -L && echo "OK" || echo "FAIL"

echo -n "Nginx port 8080 (API): "
curl -sf http://localhost:8080/api/v1/health && echo "OK" || echo "FAIL"

echo ""
echo "=== VERIFY XONG ==="
echo "Truy cap: http://185.111.159.216"
echo "API: http://185.111.159.216:8080/api/v1/health"
