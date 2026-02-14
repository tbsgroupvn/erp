@echo off
REM ============================================
REM TBS ERP - Quick Start Script
REM Runs backend + frontend dev servers
REM ============================================

echo.
echo ========================================
echo TBS ERP - Quick Start
echo ========================================
echo.

REM Check if dependencies are installed
cd /d "%~dp0..\tbs-erp-backend"
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ✗ Failed to install backend dependencies
        pause
        exit /b 1
    )
)

cd /d "%~dp0..\tbs-erp-frontend"
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    call npm install recharts lucide-react
    if %errorlevel% neq 0 (
        echo ✗ Failed to install frontend dependencies
        pause
        exit /b 1
    )
)

echo.
echo ✓ Dependencies ready
echo.
echo Starting services...
echo   - Backend:  http://localhost:3001
echo   - Frontend: http://localhost:3000
echo.
echo Press Ctrl+C to stop all services
echo.

REM Start backend in new window
start "TBS ERP Backend" cmd /k "cd /d %~dp0..\tbs-erp-backend && npm run start:dev"

REM Wait 5 seconds for backend to start
timeout /t 5 /nobreak >nul

REM Start frontend in new window
start "TBS ERP Frontend" cmd /k "cd /d %~dp0..\tbs-erp-frontend && npm run dev"

echo.
echo ✓ Services started!
echo.
echo Open in browser:
echo   → http://localhost:3000
echo.
pause
