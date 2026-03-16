<#
.SYNOPSIS
    TBS ERP v3.0 - One-click startup script
.DESCRIPTION
    Start/stop/manage the ERP dev environment with Docker.
.USAGE
    .\start.ps1            # Start (build + up + migrate + seed + open browser)
    .\start.ps1 stop       # Stop all containers
    .\start.ps1 restart    # Stop + Start
    .\start.ps1 status     # Show container table
    .\start.ps1 logs       # Tail backend logs
    .\start.ps1 seed       # Re-run prisma seed
    .\start.ps1 reset      # Remove volumes + restart fresh
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'seed', 'reset')]
    [string]$Command = 'start'
)

# ============================================
# CONFIG
# ============================================
$COMPOSE_FILE = Join-Path $PSScriptRoot 'docker-compose.dev.yml'
$BACKEND_DIR  = Join-Path $PSScriptRoot 'tbs-erp-backend'
$ENV_FILE     = Join-Path $BACKEND_DIR '.env'
$ENV_EXAMPLE  = Join-Path $BACKEND_DIR '.env.example'
$PROJECT_NAME = 'tbs-dev'

$PORTS = @{
    'PostgreSQL' = 5433
    'Redis'      = 6379
    'Backend'    = 3001
    'Frontend'   = 3000
}

# ============================================
# HELPERS
# ============================================
function Write-Banner {
    param([string]$Text)
    $line = '=' * 44
    Write-Host ""
    Write-Host ([char]0x2554 + $line + [char]0x2557) -ForegroundColor Cyan
    Write-Host ([char]0x2551 + "  $Text".PadRight(44) + [char]0x2551) -ForegroundColor Cyan
    Write-Host ([char]0x255A + $line + [char]0x255D) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Check {
    param([string]$Label, [string]$Status, [string]$Color = 'Green')
    $icon = if ($Color -eq 'Green') { '[OK]' } elseif ($Color -eq 'Yellow') { '[..]' } else { '[!!]' }
    Write-Host "  $icon " -ForegroundColor $Color -NoNewline
    Write-Host "$Label".PadRight(26) -NoNewline
    Write-Host $Status -ForegroundColor $Color
}

function Write-Step {
    param([string]$Label)
    Write-Host "  [>>] " -ForegroundColor Yellow -NoNewline
    Write-Host "$Label" -NoNewline
}

function Write-StepDone {
    param([string]$Duration = '')
    if ($Duration) {
        Write-Host "  done ($Duration)" -ForegroundColor Green
    } else {
        Write-Host "  done" -ForegroundColor Green
    }
}

# Run docker compose via cmd /c to avoid PS 5.1 stderr issues
function Invoke-Compose {
    param([string]$Arguments, [switch]$Silent)
    if ($Silent) {
        cmd /c "docker compose -f `"$COMPOSE_FILE`" -p $PROJECT_NAME $Arguments >nul 2>&1"
    } else {
        cmd /c "docker compose -f `"$COMPOSE_FILE`" -p $PROJECT_NAME $Arguments"
    }
    return $LASTEXITCODE
}

function Test-DockerRunning {
    cmd /c "docker info >nul 2>&1"
    return $LASTEXITCODE -eq 0
}

function Test-PortFree {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return ($null -eq $conn -or $conn.Count -eq 0)
}

function Wait-ForHealthy {
    param(
        [string]$Container,
        [int]$TimeoutSec = 120
    )
    $elapsed = 0
    $interval = 3
    while ($elapsed -lt $TimeoutSec) {
        $health = cmd /c "docker inspect --format={{.State.Health.Status}} $Container 2>nul"
        if ($health -eq 'healthy') {
            return $true
        }
        Start-Sleep -Seconds $interval
        $elapsed += $interval
    }
    return $false
}

function New-RandomSecret {
    param([int]$Length = 64)
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    $secret = -join (1..$Length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    return $secret
}

# ============================================
# COMMANDS
# ============================================
function Start-Erp {
    Write-Banner 'TBS ERP v3.0 - Starting...'

    # 1. Check Docker
    if (-not (Test-DockerRunning)) {
        Write-Check 'Docker Desktop' 'NOT RUNNING' 'Red'
        Write-Host ''
        Write-Host '  Please start Docker Desktop and try again.' -ForegroundColor Red
        exit 1
    }
    Write-Check 'Docker Desktop' 'running'

    # 2. Check ports - if our own dev containers occupy them, stop them first
    $portsInUse = $false
    foreach ($entry in $PORTS.GetEnumerator()) {
        if (-not (Test-PortFree $entry.Value)) { $portsInUse = $true; break }
    }
    if ($portsInUse) {
        Write-Check 'Ports' 'cleaning up previous containers...' 'Yellow'
        Invoke-Compose 'down' -Silent | Out-Null
        # Also stop production compose if running
        $prodCompose = Join-Path $PSScriptRoot 'docker-compose.yml'
        if (Test-Path $prodCompose) {
            cmd /c "docker compose -f `"$prodCompose`" down >nul 2>&1"
        }
        # Wait for WSL/Docker to release ports (up to 15s)
        $waited = 0
        while ($waited -lt 15) {
            Start-Sleep -Seconds 2
            $waited += 2
            $stillBusy = $false
            foreach ($entry in $PORTS.GetEnumerator()) {
                if (-not (Test-PortFree $entry.Value)) { $stillBusy = $true; break }
            }
            if (-not $stillBusy) { break }
        }
    }

    $portBlocked = $false
    foreach ($entry in $PORTS.GetEnumerator()) {
        if (Test-PortFree $entry.Value) {
            Write-Check "Port $($entry.Value) ($($entry.Key))" 'available'
        } else {
            Write-Check "Port $($entry.Value) ($($entry.Key))" 'IN USE' 'Red'
            $portBlocked = $true
        }
    }
    if ($portBlocked) {
        Write-Host ''
        Write-Host '  Ports still in use after cleanup. Check with: netstat -ano | findstr "3000 3001 5433 6379"' -ForegroundColor Red
        exit 1
    }

    # 3. Ensure .env
    if (-not (Test-Path $ENV_FILE)) {
        if (Test-Path $ENV_EXAMPLE) {
            $envContent = Get-Content $ENV_EXAMPLE -Raw
            $envContent = $envContent -replace 'REPLACE_WITH_YOUR_GENERATED_SECRET_128_CHARS_MIN', (New-RandomSecret 128)
            $envContent = $envContent -replace 'REPLACE_WITH_YOUR_GENERATED_REFRESH_SECRET_128_CHARS_MIN', (New-RandomSecret 128)
            $envContent = $envContent -replace 'postgresql://username:password@localhost:5432/dbname\?schema=public', 'postgresql://tbs_user:tbs_password@localhost:5433/tbs_erp?schema=public'
            $envContent = $envContent -replace 'REDIS_PASSWORD=\s*$', 'REDIS_PASSWORD=dev_redis_pass'
            Set-Content -Path $ENV_FILE -Value $envContent -NoNewline
            Write-Check 'Environment (.env)' 'created from template'
        } else {
            Write-Check 'Environment (.env)' 'MISSING (no .env.example)' 'Red'
            exit 1
        }
    } else {
        Write-Check 'Environment (.env)' 'ready'
    }

    Write-Host ''

    # 4. Build images first, then start
    Write-Step 'Building images...'
    $buildStart = Get-Date
    $exitCode = Invoke-Compose 'build' -Silent
    if ($exitCode -ne 0) {
        Write-Host ''
        Write-Host '  Build failed. Run the following to see errors:' -ForegroundColor Red
        Write-Host '  docker compose -f docker-compose.dev.yml build' -ForegroundColor Yellow
        exit 1
    }
    $buildTime = [math]::Round(((Get-Date) - $buildStart).TotalSeconds)
    Write-StepDone "${buildTime}s"

    Write-Step 'Starting containers...'
    $exitCode = Invoke-Compose 'up -d' -Silent
    if ($exitCode -ne 0) {
        Write-Host ''
        Write-Host '  Failed to start. Run: docker compose -f docker-compose.dev.yml up' -ForegroundColor Red
        exit 1
    }
    Write-StepDone

    # 5. Wait for PostgreSQL
    Write-Step 'PostgreSQL...'
    if (Wait-ForHealthy 'tbs_dev_postgres' 60) {
        Write-StepDone
    } else {
        Write-Host '  TIMEOUT' -ForegroundColor Red
        exit 1
    }

    # 6. Wait for Redis
    Write-Step 'Redis...'
    if (Wait-ForHealthy 'tbs_dev_redis' 30) {
        Write-StepDone
    } else {
        Write-Host '  TIMEOUT' -ForegroundColor Red
        exit 1
    }

    # 7. Migrate
    Write-Step 'Database migrating...'
    $exitCode = Invoke-Compose 'exec -T backend npx prisma migrate deploy' -Silent
    if ($exitCode -eq 0) {
        Write-StepDone
    } else {
        Write-Host '  FAILED' -ForegroundColor Red
        Write-Host '  Run manually: docker compose -f docker-compose.dev.yml exec backend npx prisma migrate deploy' -ForegroundColor Yellow
    }

    # 8. Seed
    Write-Step 'Database seeding...'
    $exitCode = Invoke-Compose 'exec -T backend npx prisma db seed' -Silent
    if ($exitCode -eq 0) {
        Write-StepDone
    } else {
        Write-Host '  SKIPPED (may already be seeded)' -ForegroundColor Yellow
    }

    # 9. Wait for Backend
    Write-Step 'Backend...'
    if (Wait-ForHealthy 'tbs_dev_backend' 120) {
        Write-StepDone
    } else {
        Write-Host '  TIMEOUT - check logs with: .\start.ps1 logs' -ForegroundColor Yellow
    }

    # 10. Wait for Frontend
    Write-Step 'Frontend...'
    if (Wait-ForHealthy 'tbs_dev_frontend' 120) {
        Write-StepDone
    } else {
        Write-Host '  TIMEOUT - container may still be starting' -ForegroundColor Yellow
    }

    # 11. Summary
    $line = '=' * 50
    Write-Host ''
    Write-Host ([char]0x2554 + $line + [char]0x2557) -ForegroundColor Green
    Write-Host ([char]0x2551 + '  TBS ERP v3.0 - Ready!'.PadRight(50) + [char]0x2551) -ForegroundColor Green
    Write-Host ([char]0x2560 + $line + [char]0x2563) -ForegroundColor Green
    Write-Host ([char]0x2551 + '  Frontend : http://localhost:3000'.PadRight(50) + [char]0x2551) -ForegroundColor White
    Write-Host ([char]0x2551 + '  API      : http://localhost:3001/api/v1'.PadRight(50) + [char]0x2551) -ForegroundColor White
    Write-Host ([char]0x2551 + '  Swagger  : http://localhost:3001/api/v1/docs'.PadRight(50) + [char]0x2551) -ForegroundColor White
    Write-Host ([char]0x2551 + '  GraphQL  : http://localhost:3001/graphql'.PadRight(50) + [char]0x2551) -ForegroundColor White
    Write-Host ([char]0x2551 + ''.PadRight(50) + [char]0x2551) -ForegroundColor White
    Write-Host ([char]0x2551 + '  Email    : admin@example.com'.PadRight(50) + [char]0x2551) -ForegroundColor Yellow
    Write-Host ([char]0x2551 + '  Password : Admin@123'.PadRight(50) + [char]0x2551) -ForegroundColor Yellow
    Write-Host ([char]0x2560 + $line + [char]0x2563) -ForegroundColor Green
    Write-Host ([char]0x2551 + '  .\start.ps1 stop    - Dung he thong'.PadRight(50) + [char]0x2551) -ForegroundColor DarkGray
    Write-Host ([char]0x2551 + '  .\start.ps1 logs    - Xem log'.PadRight(50) + [char]0x2551) -ForegroundColor DarkGray
    Write-Host ([char]0x2551 + '  .\start.ps1 status  - Trang thai'.PadRight(50) + [char]0x2551) -ForegroundColor DarkGray
    Write-Host ([char]0x255A + $line + [char]0x255D) -ForegroundColor Green
    Write-Host ''

    # 12. Open browser
    Start-Process 'http://localhost:3000'
}

function Stop-Erp {
    Write-Banner 'TBS ERP v3.0 - Stopping...'
    Invoke-Compose 'down' | Out-Null
    Write-Host ''
    Write-Check 'All containers' 'stopped'
    Write-Host ''
}

function Show-Status {
    Write-Banner 'TBS ERP v3.0 - Status'
    Invoke-Compose 'ps -a'
    Write-Host ''
}

function Show-Logs {
    Invoke-Compose 'logs -f --tail=100 backend'
}

function Invoke-Seed {
    Write-Banner 'TBS ERP v3.0 - Seeding...'
    Write-Step 'Running prisma db seed...'
    Write-Host ''
    Invoke-Compose 'exec -T backend npx prisma db seed'
    if ($LASTEXITCODE -eq 0) {
        Write-Host ''
        Write-Check 'Database' 'seeded'
    } else {
        Write-Host ''
        Write-Check 'Seed' 'FAILED' 'Red'
    }
    Write-Host ''
}

function Reset-Erp {
    Write-Banner 'TBS ERP v3.0 - Reset'

    Write-Host '  This will DELETE all data (volumes) and rebuild from scratch.' -ForegroundColor Yellow
    Write-Host ''
    $confirm = Read-Host '  Type "yes" to confirm'
    if ($confirm -ne 'yes') {
        Write-Host '  Cancelled.' -ForegroundColor DarkGray
        return
    }

    Write-Host ''
    Write-Step 'Stopping containers...'
    Invoke-Compose 'down -v' -Silent | Out-Null
    Write-StepDone

    Write-Host ''
    Write-Host '  Volumes removed. Starting fresh...' -ForegroundColor Yellow
    Write-Host ''

    Start-Erp
}

# ============================================
# MAIN
# ============================================
switch ($Command) {
    'start'   { Start-Erp }
    'stop'    { Stop-Erp }
    'restart' { Stop-Erp; Start-Erp }
    'status'  { Show-Status }
    'logs'    { Show-Logs }
    'seed'    { Invoke-Seed }
    'reset'   { Reset-Erp }
}
