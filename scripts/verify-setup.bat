@echo off
REM ============================================
REM TBS ERP - Setup Verification Script
REM ============================================

echo.
echo ========================================
echo TBS ERP - Setup Verification
echo ========================================
echo.

REM Check backend structure
echo [1/5] Checking backend structure...
cd /d "%~dp0..\tbs-erp-backend"

if exist "src\modules\order\guards\credit-check.guard.ts" (
    echo   ✓ CreditCheckGuard found
) else (
    echo   ✗ CreditCheckGuard NOT found
    goto :error
)

if exist "src\modules\migration\migrate-legacy-ar.script.ts" (
    echo   ✓ Migration script found
) else (
    echo   ✗ Migration script NOT found
    goto :error
)

if exist "src\modules\commission\services\commission-calculator.service.ts" (
    echo   ✓ Commission calculator found
) else (
    echo   ✗ Commission calculator NOT found
    goto :error
)

if exist "prisma\seeds\commission-rules.seed.ts" (
    echo   ✓ Commission rules seed found
) else (
    echo   ✗ Commission rules seed NOT found
    goto :error
)

echo.
echo [2/5] Checking frontend structure...
cd /d "%~dp0..\tbs-erp-frontend"

if exist "src\components\finance\PaymentAllocationForm.tsx" (
    echo   ✓ PaymentAllocationForm found
) else (
    echo   ✗ PaymentAllocationForm NOT found
    goto :error
)

if exist "src\components\sales\SalesDashboard.tsx" (
    echo   ✓ SalesDashboard found
) else (
    echo   ✗ SalesDashboard NOT found
    goto :error
)

echo.
echo [3/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ✗ Node.js NOT installed
    goto :error
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo   ✓ Node.js installed: %NODE_VERSION%
)

echo.
echo [4/5] Checking npm packages (backend)...
cd /d "%~dp0..\tbs-erp-backend"
if exist "node_modules" (
    echo   ✓ Backend dependencies installed
) else (
    echo   ⚠ Backend dependencies NOT installed
    echo   → Run: npm install
)

echo.
echo [5/5] Checking npm packages (frontend)...
cd /d "%~dp0..\tbs-erp-frontend"
if exist "node_modules" (
    echo   ✓ Frontend dependencies installed
) else (
    echo   ⚠ Frontend dependencies NOT installed
    echo   → Run: npm install
)

echo.
echo ========================================
echo ✓ All checks passed!
echo ========================================
echo.
echo Next steps:
echo   1. Review NEXT_STEPS_CHECKLIST.md
echo   2. Run backend tests: cd tbs-erp-backend ^&^& npm test
echo   3. Build frontend: cd tbs-erp-frontend ^&^& npm run build
echo.
pause
exit /b 0

:error
echo.
echo ========================================
echo ✗ Verification failed!
echo ========================================
echo.
echo Please check the error messages above.
echo.
pause
exit /b 1
