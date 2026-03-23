# ============================================
# TBS ERP - VPS Deploy Script (PowerShell)
# Chay: .\scripts\deploy-to-vps.ps1
# ============================================
# Script nay tu dong SSH vao VPS va deploy ERP

$VPS_IP = "185.111.159.216"
$VPS_USER = "root"
$VPS_PASS = "password"
$VPS_REPO = "/opt/erp"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "TBS ERP - Deploy len VPS Contabo" -ForegroundColor Cyan
Write-Host "VPS: $VPS_IP" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Script chay tren VPS (bash heredoc)
$REMOTE_SCRIPT = @'
set -e

REPO_DIR="/opt/erp"
COMPOSE_FILE="docker-compose.ip.yml"
BRANCH="review/codebase-fixes-2026-03-16"

echo ""
echo "=== [1/6] Tao file .env ==="
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
TWO_FA_ENCRYPTION_KEY=b9g4e3c2d5f6a7b8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
TWO_FA_ENCRYPTION_SALT=c0h5f4d3e6a7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3
LOG_LEVEL=info
DATABASE_POOL_SIZE=20
ENVEOF
echo "✓ .env da duoc tao"

echo ""
echo "=== [2/6] Pull code moi nhat ==="
cd "$REPO_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
echo "✓ Code da cap nhat"

echo ""
echo "=== [3/6] Stop containers cu ==="
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || echo "(Khong co container)"

echo ""
echo "=== [4/6] Khoi dong PostgreSQL + Redis ==="
docker compose -f "$COMPOSE_FILE" up -d postgres redis pgbouncer
echo "Doi database san sang (45 giay)..."
sleep 45

echo ""
echo "=== [5/6] Chay DB migration + seed ==="
docker compose -f "$COMPOSE_FILE" run --rm migrate && echo "✓ Migration OK" || echo "WARN: Migration skip"

echo ""
echo "=== [6/6] Build va start tat ca services ==="
echo "(Co the mat 10-20 phut de build images...)"
docker compose -f "$COMPOSE_FILE" up -d --build

echo ""
echo "Doi services san sang (60 giay)..."
sleep 60

echo ""
echo "==========================="
echo "Kiem tra trang thai:"
echo "==========================="
docker compose -f "$COMPOSE_FILE" ps

echo ""
curl -sf http://localhost:8080/api/v1/health && echo "✓ Backend API: OK" || echo "✗ Backend API: FAIL"
curl -sf http://localhost:80 && echo "✓ Frontend: OK" || echo "✗ Frontend: FAIL (co the can them thoi gian)"

echo ""
echo "==========================="
echo "Deploy hoan thanh!"
echo "Truy cap: http://185.111.159.216"
echo "API:      http://185.111.159.216:8080/api/v1/health"
echo "Login:    admin@tbs.com / Admin@123"
echo "==========================="
'@

Write-Host ""
Write-Host "Dang ket noi SSH va chay deploy script..." -ForegroundColor Yellow
Write-Host "Password VPS: $VPS_PASS" -ForegroundColor Gray
Write-Host ""
Write-Host "NOTE: Script se chay trong 15-25 phut (build Docker images)" -ForegroundColor Yellow
Write-Host ""

# Ghi script ra temp file de pipe vao ssh
$tempScript = [System.IO.Path]::GetTempFileName() + ".sh"
[System.IO.File]::WriteAllText($tempScript, $REMOTE_SCRIPT, [System.Text.Encoding]::UTF8)

Write-Host "Chay lenh sau trong terminal de deploy:" -ForegroundColor Green
Write-Host ""
Write-Host "  ssh root@$VPS_IP 'bash -s' < `"$tempScript`"" -ForegroundColor White
Write-Host ""
Write-Host "Hoac chay truc tiep tren VPS bang lenh:" -ForegroundColor Green
Write-Host "  1. ssh root@$VPS_IP" -ForegroundColor White
Write-Host "  2. cd /opt/erp && git pull origin $BRANCH" -ForegroundColor White  
Write-Host "  3. bash scripts/vps-setup.sh" -ForegroundColor White
Write-Host ""

# Thu chay SSH (se can nhap password)
Write-Host "Dang thu ket noi SSH tu dong..." -ForegroundColor Yellow
try {
    $process = Start-Process -FilePath "ssh" `
        -ArgumentList @("-o", "StrictHostKeyChecking=no", "-o", "BatchMode=no", "$VPS_USER@$VPS_IP", "bash -s") `
        -RedirectStandardInput $tempScript `
        -Wait -PassThru -NoNewWindow
    
    if ($process.ExitCode -eq 0) {
        Write-Host "✓ Deploy thanh cong!" -ForegroundColor Green
    } else {
        Write-Host "SSH ket thuc voi ma loi: $($process.ExitCode)" -ForegroundColor Red
        Write-Host "Vui long chay thu cong theo huong dan tren." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Loi SSH: $_" -ForegroundColor Red
    Write-Host "Vui long chay thu cong theo huong dan tren." -ForegroundColor Yellow
}

# Cleanup
Remove-Item $tempScript -ErrorAction SilentlyContinue
