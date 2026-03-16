# ================================================================
# TEST-ORD-021: Tinh chargeable weight - Actual Weight > CBM
# Severity: CRITICAL
#
# Scenario: 1 kien, 30x20x15 cm, 50kg (hang nang, nho)
# CBM = 0.3 x 0.2 x 0.15 = 0.009 CBM
# CBM to KG (SEA, 1 CBM = 1000 kg): 0.009 x 1000 = 9 kg
# Chargeable = MAX(50, 9) = 50 kg
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

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-ORD-021: Chargeable Weight - Actual > CBM" -ForegroundColor Cyan
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

# ================================================================
# PART A: TAO DON + NHAN KIEN
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Tao don SEA + nhan kien tai kho TQ" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST A1: Tao don hang SEA ===" -ForegroundColor White
$order = D (Api "POST" "/orders" $SALE @{
    customerId    = $CUST_ID
    serviceType   = "VCT"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @( @{ productName = "Compact heavy item 50kg"; quantity = 1; unitPrice = 300 } )
    note          = "Test actual weight > CBM"
})
if ($order -and $order.id) {
    $ORD_ID = $order.id
    Write-Host "  Order: $($order.code) | route=$($order.shippingRoute)"
    Pass "A1: SEA order created"
} else {
    Fail "A1: Failed to create order"; exit 1
}

Write-Host ""
Write-Host "=== TEST A2: Advance to WAREHOUSE_CN + receive ===" -ForegroundColor White
Api "PATCH" "/orders/$ORD_ID/status" $SALE @{ status = "QUOTATION" } | Out-Null
Api "PATCH" "/orders/$ORD_ID/status" $SALE @{ status = "SOURCING" } | Out-Null
Api "PATCH" "/orders/$ORD_ID/status" $SALE @{ status = "WAREHOUSE_CN" } | Out-Null

$trackCN = "TEST-021-$(Get-Date -Format 'yyyyMMddHHmmss')"
$recv = D (Api "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = $trackCN
    orderId          = $ORD_ID
    imageUrls        = @("https://placeholder.test/pkg-021.jpg")
})
$PKG_ID = $null
if ($recv -and $recv.id) { $PKG_ID = $recv.id }
elseif ($recv -and $recv.package) { $PKG_ID = $recv.package.id }
if ($PKG_ID) {
    Pass "A2: Package received ($trackCN)"
} else {
    Fail "A2: Failed to receive package"; exit 1
}

# ================================================================
# PART B: MEASURE - ACTUAL > VOLUMETRIC
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Measure 30x20x15 cm, 50 kg (actual > CBM)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST B1: Measure package ===" -ForegroundColor White
Write-Host "  Input: L=30cm, W=20cm, H=15cm, actualWeight=50kg"
Write-Host "  CBM = 0.3 x 0.2 x 0.15 = 0.009 CBM"
Write-Host "  Volumetric (SEA, 1CBM=1000kg): 30*20*15/1000 = 9 kg"
Write-Host "  Chargeable = MAX(50, 9) = 50 kg"

$measureResp = D (Api "POST" "/warehouse-cn/packages/$PKG_ID/measure" $WH_CN @{
    actualWeight = 50
    length       = 30
    width        = 20
    height       = 15
})

if ($measureResp) {
    $calc = $measureResp.calculation
    $pkg  = $measureResp.package

    $volWeight  = 0; $charWeight = 0; $isVol = $null; $divisor = 0
    if ($calc) {
        $volWeight  = [double]$calc.volumetricWeight
        $charWeight = [double]$calc.chargeableWeight
        $isVol      = $calc.isVolumetric
        $divisor    = $calc.volumetricDivisor
    }
    if ($pkg) {
        Write-Host "  DB: actualWeight=$($pkg.actualWeight), volumetricWeight=$($pkg.volumetricWeight), chargeableWeight=$($pkg.chargeableWeight)"
    }

    Write-Host "  Calc: volumetric=$volWeight kg, chargeable=$charWeight kg, divisor=$divisor, isVolumetric=$isVol"

    # B1a: Volumetric = 9 kg
    if ([math]::Abs($volWeight - 9) -lt 0.1) {
        Pass "B1a: Volumetric weight = $volWeight kg (9 kg correct)"
    } else {
        Fail "B1a: Volumetric weight = $volWeight kg (expected 9)"
    }

    # B1b: Chargeable = 50 kg (actual wins)
    if ([math]::Abs($charWeight - 50) -lt 0.1) {
        Pass "B1b: Chargeable weight = $charWeight kg (actual wins, correct)"
    } else {
        Fail "B1b: Chargeable weight = $charWeight kg (expected 50)"
    }

    # B1c: isVolumetric = false (actual > volumetric)
    if ($isVol -eq $false) {
        Pass "B1c: isVolumetric = false (actual weight used)"
    } elseif ($isVol -eq $null) {
        Warn "B1c: isVolumetric not in response"
    } else {
        Fail "B1c: isVolumetric = $isVol (expected false)"
    }

    # B1d: Divisor = 1000 for SEA
    if ($divisor -eq 1000) {
        Pass "B1d: Divisor = 1000 (SEA route correct)"
    } else {
        Fail "B1d: Divisor = $divisor (expected 1000 for SEA)"
    }
} else {
    Fail "B1: Failed to measure package"
}

# ================================================================
# PART C: VERIFY PERSISTED DATA
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Verify persisted data" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST C1: Package data in DB ===" -ForegroundColor White
$pkgList = D (Api "GET" "/warehouse-cn/packages?orderId=$ORD_ID" $WH_CN)
$foundPkg = $null
if ($pkgList -is [array]) {
    $foundPkg = $pkgList | Where-Object { $_.id -eq $PKG_ID } | Select-Object -First 1
} elseif ($pkgList -and $pkgList.id -eq $PKG_ID) {
    $foundPkg = $pkgList
}

if ($foundPkg) {
    $dbActual = [double]$foundPkg.actualWeight
    $dbVol    = [double]$foundPkg.volumetricWeight
    $dbCharge = [double]$foundPkg.chargeableWeight

    Write-Host "  actualWeight=$dbActual, volumetricWeight=$dbVol, chargeableWeight=$dbCharge"

    if ($dbActual -eq 50)  { Pass "C1a: actualWeight = 50 kg persisted" }
    else                   { Fail "C1a: actualWeight = $dbActual (expected 50)" }

    if ([math]::Abs($dbVol - 9) -lt 0.1) { Pass "C1b: volumetricWeight = $dbVol kg persisted" }
    else                                   { Fail "C1b: volumetricWeight = $dbVol (expected 9)" }

    if ([math]::Abs($dbCharge - 50) -lt 0.1) { Pass "C1c: chargeableWeight = $dbCharge kg persisted" }
    else                                       { Fail "C1c: chargeableWeight = $dbCharge (expected 50)" }

    if ($foundPkg.warehouseCNStatus -eq "CHECKED") { Pass "C1d: Status = CHECKED after measure" }
    else { Warn "C1d: Status = $($foundPkg.warehouseCNStatus) (expected CHECKED)" }
} else {
    Fail "C1: Package not found in list"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-ORD-021: Chargeable Weight - Actual > CBM" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Scenario: 30x20x15 cm, 50 kg, SEA route"
Write-Host "  Volumetric = 9 kg | Actual = 50 kg | Chargeable = 50 kg"
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
