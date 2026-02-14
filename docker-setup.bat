@echo off
REM ============================================
REM TBS ERP - Docker Setup Script
REM ============================================

echo.
echo ============================================
echo TBS ERP - Docker Setup
echo ============================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    echo Download from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo ✅ Docker is installed
echo.

REM Check if .env file exists
if not exist .env (
    echo 📝 Creating .env file from example...
    copy .env.docker.example .env
    echo ⚠️  Please edit .env file with your production secrets!
    echo    - Change POSTGRES_PASSWORD
    echo    - Change JWT_SECRET
    echo    - Add SENTRY_DSN if using Sentry
    echo.
    pause
)

echo.
echo Select environment:
echo 1. Local Development (docker-compose.yml)
echo 2. Staging (docker-compose.staging.yml)
echo 3. Production (docker-compose.production.yml)
echo.
set /p choice="Enter choice (1-3): "

if "%choice%"=="1" (
    set compose_file=docker-compose.yml
    set env_name=Local Development
) else if "%choice%"=="2" (
    set compose_file=docker-compose.staging.yml
    set env_name=Staging
) else if "%choice%"=="3" (
    set compose_file=docker-compose.production.yml
    set env_name=Production
) else (
    echo ❌ Invalid choice
    pause
    exit /b 1
)

echo.
echo 🚀 Starting %env_name% environment...
echo.

REM Build and start containers
docker-compose -f %compose_file% up -d --build

if %errorlevel% neq 0 (
    echo.
    echo ❌ Failed to start containers
    pause
    exit /b 1
)

echo.
echo ✅ Containers started successfully!
echo.

REM Wait for database to be ready
echo ⏳ Waiting for database to be ready...
timeout /t 10 /nobreak >nul

REM Run database migrations
echo.
echo 📊 Running database migrations...
docker-compose -f %compose_file% exec -T backend npx prisma migrate deploy

if %errorlevel% neq 0 (
    echo.
    echo ⚠️  Migration failed. You may need to run it manually:
    echo    docker-compose -f %compose_file% exec backend npx prisma migrate deploy
    echo.
)

echo.
echo ============================================
echo 🎉 Setup Complete!
echo ============================================
echo.
echo Services:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo   API Docs: http://localhost:3001/api
echo   Health:   http://localhost:3001/health
echo.
echo Useful commands:
echo   View logs:    docker-compose -f %compose_file% logs -f
echo   Stop:         docker-compose -f %compose_file% down
echo   Restart:      docker-compose -f %compose_file% restart
echo   Shell:        docker-compose -f %compose_file% exec backend sh
echo.
pause
