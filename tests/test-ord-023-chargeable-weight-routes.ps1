# ================================================================
# TEST-ORD-023: Chargeable weight voi he so quy doi khac nhau theo route
# Severity: CRITICAL
#
# Cung 1 kien 100x80x60 cm, 20 kg:
#   SEA:  1 CBM = 1000 kg -> 0.48 x 1000 = 480 kg -> chargeable = 480
#   ROAD: 1 CBM = 333 kg  -> 0.48 x 333  = 159.84 kg -> chargeable = 159.84
#   AIR:  1 CBM = 167 kg  -> 0.48 x 167  = 80.16 kg -> chargeable = 80.16
# ================================================================

$ErrorActionPreference = 'Continue'
$BASE_URL = "http://localhost:3001/api/v1"
$DOMAIN = "nhaphangchinhngach.vn"

$passCount = 0
$failCount = 0
$warnCount = 0

function Api($method, $path, $token, $body) {
    $uri = "$BASE_URL$path"
    $params = @{ Uri = $uri; Method = $method; ContentType = "application/json" }
    if ($token) { $params.Headers = @{ "Authorization" = "Bearer $token" } }
    if ($body)  { $params.Body = ($body | ConvertTo-Json -Depth 10 -Compress) }
    try {
        return Invoke-RestMethod @params
    } catch {
        $code = 0; $errBody = ""
        try {
            $resp = $_.Exception.Response
            $code = [int]$resp.StatusCode
            $stream = $resp.GetResponseStream()
            $stream.Position = 0
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $errBody = $reader.ReadToEnd()
            $reader.Close()
        } catch { try { $code = [int]$_.Exception.Response.StatusCode } catch {} }
        Write-Host "    API ERROR: $method $path -> $code : $errBody" -ForegroundColor DarkRed
        return $null
    }
}

function D($resp) {
    if ($resp -and $resp.data) { return $resp.data }
    return $resp
}

function Login($email) {
    $body = @{ email = $email; password = "Admin@123" } | ConvertTo-Json
    try {
        $r = Invoke-RestMethod -Uri "$BASE_URL/auth/login" -Method POST -Body $body -ContentType "application/json"
        $token = $r.data.tokens.accessToken
        if (-not $token) { $token = $r.data.accessToken }
        if (-not $token) { $token = $r.accessToken }
        return $token
    } catch {
        Write-Host "  LOGIN FAILED: $email - $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Pass($msg) { $script:passCount++; Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { $script:failCount++; Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Warn($msg) { $script:warnCount++; Write-Host "[WARN] $msg" -ForegroundColor Yellow }

# Helper: create order -> advance to WAREHOUSE_CN -> receive package -> measure -> return result
function MeasureWithRoute($route, $sale, $whCn, $custId) {
    $ts = Get-Date -Format 'yyyyMMddHHmmssfff'

    # Create order
    $order = D (Api "POST" "/orders" $sale @{
        customerId    = $custId
        serviceType   = "VCT"
        branch        = "HN"
        shippingRoute = $route
        items         = @( @{ productName = "CW test $route"; quantity = 1; unitPrice = 300 } )
        note          = "Chargeable weight route test: $route"
    })
    if (-not $order -or -not $order.id) {
        Write-Host "    Failed to create $route order" -ForegroundColor Red
        return $null
    }
    $ordId = $order.id

    # Advance to WAREHOUSE_CN
    Api "PATCH" "/orders/$ordId/status" $sale @{ status = "QUOTATION" } | Out-Null
    Api "PATCH" "/orders/$ordId/status" $sale @{ status = "SOURCING" } | Out-Null
    Api "PATCH" "/orders/$ordId/status" $sale @{ status = "WAREHOUSE_CN" } | Out-Null

    # Receive package
    $trackCN = "CW-$route-$ts"
    $recv = D (Api "POST" "/warehouse-cn/receive" $whCn @{
        trackingNumberCN = $trackCN
        orderId          = $ordId
        imageUrls        = @("https://placeholder.test/cw-$route.jpg")
    })
    $pkgId = $null
    if ($recv -and $recv.id) { $pkgId = $recv.id }
    elseif ($recv -and $recv.package) { $pkgId = $recv.package.id }
    if (-not $pkgId) {
        Write-Host "    Failed to receive package for $route" -ForegroundColor Red
        return $null
    }

    # Measure: 100x80x60 cm, 20 kg
    $result = D (Api "POST" "/warehouse-cn/packages/$pkgId/measure" $whCn @{
        actualWeight = 20
        length       = 100
        width        = 80
        height       = 60
    })
    return $result
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-ORD-023: Chargeable Weight - He so theo route" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login ===" -ForegroundColor White

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SALE login OK" } else { Fail "SALE login FAILED"; exit 1 }

$WH_CN = Login "khotq01@$DOMAIN"
if ($WH_CN) { Pass "WAREHOUSE_CN login OK" } else { Fail "WAREHOUSE_CN login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

# Get VIP customer (use CEO token for full visibility)
$customers = D (Api "GET" "/customers?tier=VIP&limit=1" $CEO)
$cust = $null
if ($customers -is [array] -and $customers.Count -gt 0) { $cust = $customers[0] }
elseif ($customers -and $customers.id) { $cust = $customers }
if (-not $cust) {
    $allCusts = D (Api "GET" "/customers?limit=50" $CEO)
    if ($allCusts -is [array]) {
        $cust = $allCusts | Where-Object { $_.tier -eq 'VIP' } | Select-Object -First 1
    }
}
if (-not $cust) { Fail "No VIP customer found"; exit 1 }
$CUST_ID = $cust.id
Write-Host "  Customer: $($cust.code) ($($cust.tier))" -ForegroundColor Gray

Write-Host ""
Write-Host "  Test dimensions: 100 x 80 x 60 cm, 20 kg" -ForegroundColor Gray
Write-Host "  CBM = 1.0 x 0.8 x 0.6 = 0.48 CBM" -ForegroundColor Gray

# ================================================================
# PART A: SEA ROUTE (1 CBM = 1000 kg)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: SEA route (1 CBM = 1000 kg)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST A1: Measure 100x80x60, 20kg via SEA ===" -ForegroundColor White
Write-Host "  Expected: volumetric = 0.48 x 1000 = 480 kg"
Write-Host "  Expected: chargeable = MAX(20, 480) = 480 kg"

$seaResult = MeasureWithRoute "SEA" $SALE $WH_CN $CUST_ID
if ($seaResult) {
    $calc = $seaResult.calculation
    $pkg  = $seaResult.package

    $seaVol = 0; $seaCW = 0; $seaFactor = 0
    if ($calc) {
        $seaVol    = [double]$calc.volumetricWeight
        $seaCW     = [double]$calc.chargeableWeight
        $seaFactor = $calc.volumetricDivisor
    }
    if ($pkg) {
        Write-Host "  DB: volumetric=$($pkg.volumetricWeight), chargeable=$($pkg.chargeableWeight)"
    }
    Write-Host "  Calc: volumetric=$seaVol kg, chargeable=$seaCW kg, factor=$seaFactor"

    if ([math]::Abs($seaVol - 480) -lt 0.01) {
        Pass "A1a: SEA volumetric = $seaVol kg (480 correct)"
    } else {
        Fail "A1a: SEA volumetric = $seaVol kg (expected 480)"
    }

    if ([math]::Abs($seaCW - 480) -lt 0.01) {
        Pass "A1b: SEA chargeable = $seaCW kg"
    } else {
        Fail "A1b: SEA chargeable = $seaCW kg (expected 480)"
    }

    if ($seaFactor -eq 1000) {
        Pass "A1c: SEA CBM factor = 1000"
    } else {
        Fail "A1c: SEA factor = $seaFactor (expected 1000)"
    }
} else {
    Fail "A1: SEA measure failed"
}

# ================================================================
# PART B: ROAD ROUTE (1 CBM = 333 kg)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: ROAD route (1 CBM = 333 kg)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST B1: Measure 100x80x60, 20kg via ROAD ===" -ForegroundColor White
Write-Host "  Expected: volumetric = 0.48 x 333 = 159.84 kg"
Write-Host "  Expected: chargeable = MAX(20, 159.84) = 159.84 kg"

$roadResult = MeasureWithRoute "ROAD" $SALE $WH_CN $CUST_ID
if ($roadResult) {
    $calc = $roadResult.calculation
    $pkg  = $roadResult.package

    $roadVol = 0; $roadCW = 0; $roadFactor = 0
    if ($calc) {
        $roadVol    = [double]$calc.volumetricWeight
        $roadCW     = [double]$calc.chargeableWeight
        $roadFactor = $calc.volumetricDivisor
    }
    if ($pkg) {
        Write-Host "  DB: volumetric=$($pkg.volumetricWeight), chargeable=$($pkg.chargeableWeight)"
    }
    Write-Host "  Calc: volumetric=$roadVol kg, chargeable=$roadCW kg, factor=$roadFactor"

    if ([math]::Abs($roadVol - 159.84) -lt 0.01) {
        Pass "B1a: ROAD volumetric = $roadVol kg (159.84 correct)"
    } else {
        Fail "B1a: ROAD volumetric = $roadVol kg (expected 159.84)"
    }

    if ([math]::Abs($roadCW - 159.84) -lt 0.01) {
        Pass "B1b: ROAD chargeable = $roadCW kg"
    } else {
        Fail "B1b: ROAD chargeable = $roadCW kg (expected 159.84)"
    }

    if ($roadFactor -eq 333) {
        Pass "B1c: ROAD CBM factor = 333"
    } else {
        Fail "B1c: ROAD factor = $roadFactor (expected 333)"
    }
} else {
    Fail "B1: ROAD measure failed"
}

# ================================================================
# PART C: AIR ROUTE (1 CBM = 167 kg)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: AIR route (1 CBM = 167 kg)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST C1: Measure 100x80x60, 20kg via AIR ===" -ForegroundColor White
Write-Host "  Expected: volumetric = 0.48 x 167 = 80.16 kg"
Write-Host "  Expected: chargeable = MAX(20, 80.16) = 80.16 kg"

$airResult = MeasureWithRoute "AIR" $SALE $WH_CN $CUST_ID
if ($airResult) {
    $calc = $airResult.calculation
    $pkg  = $airResult.package

    $airVol = 0; $airCW = 0; $airFactor = 0
    if ($calc) {
        $airVol    = [double]$calc.volumetricWeight
        $airCW     = [double]$calc.chargeableWeight
        $airFactor = $calc.volumetricDivisor
    }
    if ($pkg) {
        Write-Host "  DB: volumetric=$($pkg.volumetricWeight), chargeable=$($pkg.chargeableWeight)"
    }
    Write-Host "  Calc: volumetric=$airVol kg, chargeable=$airCW kg, factor=$airFactor"

    if ([math]::Abs($airVol - 80.16) -lt 0.01) {
        Pass "C1a: AIR volumetric = $airVol kg (80.16 correct)"
    } else {
        Fail "C1a: AIR volumetric = $airVol kg (expected 80.16)"
    }

    if ([math]::Abs($airCW - 80.16) -lt 0.01) {
        Pass "C1b: AIR chargeable = $airCW kg"
    } else {
        Fail "C1b: AIR chargeable = $airCW kg (expected 80.16)"
    }

    if ($airFactor -eq 167) {
        Pass "C1c: AIR CBM factor = 167"
    } else {
        Fail "C1c: AIR factor = $airFactor (expected 167)"
    }
} else {
    Fail "C1: AIR measure failed"
}

# ================================================================
# PART D: CROSS-ROUTE COMPARISON
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Cross-route comparison" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST D1: SEA > ROAD > AIR ordering ===" -ForegroundColor White
if ($seaCW -gt 0 -and $roadCW -gt 0 -and $airCW -gt 0) {
    Write-Host "  SEA=$seaCW kg > ROAD=$roadCW kg > AIR=$airCW kg"

    if ($seaCW -gt $roadCW -and $roadCW -gt $airCW) {
        Pass "D1: Route ordering correct: SEA ($seaCW) > ROAD ($roadCW) > AIR ($airCW)"
    } else {
        Fail "D1: Route ordering wrong: SEA=$seaCW, ROAD=$roadCW, AIR=$airCW"
    }
} else {
    Warn "D1: Cannot compare (missing results)"
}

Write-Host ""
Write-Host "=== TEST D2: Ratio validation ===" -ForegroundColor White
if ($seaCW -gt 0 -and $airCW -gt 0) {
    $seaToAirRatio = [math]::Round($seaCW / $airCW, 1)
    Write-Host "  SEA/AIR ratio = $seaToAirRatio (expected ~5.99)"
    # SEA factor 1000 / AIR factor 167 = 5.988
    if ($seaToAirRatio -ge 5.9 -and $seaToAirRatio -le 6.1) {
        Pass "D2: SEA/AIR ratio = $seaToAirRatio (factor 1000/167 correct)"
    } else {
        Fail "D2: SEA/AIR ratio = $seaToAirRatio (expected ~5.99)"
    }
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-ORD-023: Chargeable Weight by Route" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Package: 100 x 80 x 60 cm, 20 kg (CBM = 0.48)" -ForegroundColor White
Write-Host ""
Write-Host "  Route  | Factor     | Volumetric | Chargeable" -ForegroundColor White
Write-Host "  -------|------------|------------|----------" -ForegroundColor White
Write-Host "  SEA    | 1 CBM=1000 | 480.00 kg  | 480.00 kg" -ForegroundColor White
Write-Host "  ROAD   | 1 CBM=333  | 159.84 kg  | 159.84 kg" -ForegroundColor White
Write-Host "  AIR    | 1 CBM=167  | 80.16 kg   | 80.16 kg" -ForegroundColor White
Write-Host ""
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host ""
if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $failCount TEST(S) FAILED" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Cyan
