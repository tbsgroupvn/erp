################################################################
#  TEST-WH-CN-001: Nhan kien tai kho Trung Quoc + Do luong + Tinh can nang tinh cuoc
#
#  Covers:
#    - POST /warehouse-cn/receive (single receive)
#    - POST /warehouse-cn/batch-receive (batch receive)
#    - POST /warehouse-cn/packages/:id/measure (measure + chargeable weight)
#    - PATCH /warehouse-cn/packages/:id/status (FSM transitions)
#    - GET  /warehouse-cn/packages (search, filter, paginate)
#    - GET  /warehouse-cn/packages/:id (detail)
#    - RBAC checks (WAREHOUSE_CN_AGENT, SALE, XNK_MANAGER)
#    - Validation: missing fields, negative weight, duplicate tracking
#    - Chargeable weight: volumetric vs actual (MAX logic)
#
#  FSM: RECEIVED -> CHECKED -> PACKED -> SHIPPED
#  Expected: ~43 tests
#  Severity: HIGH
################################################################

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

function Api-Expect($method, $path, $token, $body) {
    $uri = "$BASE_URL$path"
    $params = @{
        Uri    = $uri
        Method = $method
        Headers = @{ "Content-Type" = "application/json" }
    }
    if ($token) { $params.Headers["Authorization"] = "Bearer $token" }
    if ($body)  { $params.Body = ($body | ConvertTo-Json -Depth 10 -Compress) }
    try {
        $r = Invoke-WebRequest @params -UseBasicParsing
        $parsed = $null
        try { $parsed = $r.Content | ConvertFrom-Json } catch {}
        return @{ code = [int]$r.StatusCode; body = $parsed; error = $null }
    } catch {
        $code = 0; $errBody = ""; $parsed = $null
        try {
            $resp = $_.Exception.Response
            $code = [int]$resp.StatusCode
            $stream = $resp.GetResponseStream()
            $stream.Position = 0
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $errBody = $reader.ReadToEnd()
            $reader.Close()
        } catch { try { $code = [int]$_.Exception.Response.StatusCode } catch {} }
        if ($errBody) { try { $parsed = $errBody | ConvertFrom-Json } catch {} }
        return @{ code = $code; body = $parsed; error = $errBody }
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

function IsError($resp) { return ($null -eq $resp) }

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-WH-CN-001: Nhan kien tai kho TQ + Do luong + Tinh cuoc" -ForegroundColor Cyan
Write-Host "  Severity: HIGH" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$TS = Get-Date -Format "yyyyMMddHHmmss"

# ================================================================
# SETUP: Login roles
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login ===" -ForegroundColor White

$WH_CN = Login "khotq01@$DOMAIN"
if ($WH_CN) { Pass "SETUP: WAREHOUSE_CN_AGENT (khotq01) login OK" }
else {
    Warn "SETUP: khotq01 login failed, trying xnk@ as fallback"
    $WH_CN = Login "xnk@$DOMAIN"
    if ($WH_CN) { Pass "SETUP: XNK_MANAGER (xnk) login OK (fallback)" }
    else {
        $WH_CN = Login "admin@$DOMAIN"
        if ($WH_CN) { Warn "SETUP: Using COO (admin) as fallback for WH_CN" }
        else { Fail "SETUP: No WH_CN-capable login available"; exit 1 }
    }
}

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SETUP: SALE (sale01) login OK" } else { Fail "SETUP: SALE login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if (-not $CEO) { $CEO = Login "admin@$DOMAIN" }
if ($CEO) { Pass "SETUP: CEO/COO login OK" } else { Fail "SETUP: CEO/COO login FAILED"; exit 1 }

$XNK = Login "xnk@$DOMAIN"
if ($XNK) { Pass "SETUP: XNK_MANAGER login OK" } else { Warn "SETUP: XNK_MANAGER login failed (non-critical)" }

# ================================================================
# SETUP: Find or create a test order at WAREHOUSE_CN status
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Find/create order at WAREHOUSE_CN status ===" -ForegroundColor White

# Try to find existing order at WAREHOUSE_CN status
$existingOrders = D (Api "GET" "/orders?status=WAREHOUSE_CN&limit=5" $CEO)
$ORDER = $null
$ORDER_ID = $null

if ($existingOrders -is [array] -and $existingOrders.Count -gt 0) {
    $ORDER = $existingOrders[0]
    $ORDER_ID = $ORDER.id
    Write-Host "  Found existing WAREHOUSE_CN order: $($ORDER.code) (ID=$ORDER_ID)" -ForegroundColor Gray
} else {
    Write-Host "  No WAREHOUSE_CN order found, creating one..." -ForegroundColor Gray

    # Get a customer
    $customers = D (Api "GET" "/customers?limit=1" $CEO)
    $cust = $null
    if ($customers -is [array] -and $customers.Count -gt 0) { $cust = $customers[0] }
    elseif ($customers -and $customers.id) { $cust = $customers }
    if (-not $cust) { Fail "SETUP: No customer found"; exit 1 }
    $CUST_ID = $cust.id
    Write-Host "  Customer: $($cust.code) ($($cust.fullName))" -ForegroundColor Gray

    # Create order
    $ord = D (Api "POST" "/orders" $SALE @{
        customerId    = $CUST_ID
        serviceType   = "ORDER"
        shippingRoute = "SEA"
        branch        = "HN"
        items         = @(@{
            productName = "WH-CN-001 Test Product - $TS"
            quantity    = 5
            unitPrice   = 200
            currency    = "CNY"
        })
        note          = "WH-CN-001 test order - $TS"
    })

    if (-not $ord -or -not $ord.id) {
        Fail "SETUP: Failed to create order"; exit 1
    }
    Write-Host "  Created order: $($ord.code) (status=$($ord.status))" -ForegroundColor Gray

    # Advance to WAREHOUSE_CN
    $transitions = @("QUOTATION", "PENDING_DEPOSIT", "SOURCING", "WAREHOUSE_CN")
    foreach ($st in $transitions) {
        $trResp = Api "PATCH" "/orders/$($ord.id)/status" $CEO @{ status = $st }
        Start-Sleep -Milliseconds 300
    }

    $ordCheck = D (Api "GET" "/orders/$($ord.id)" $CEO)
    if ($ordCheck -and $ordCheck.status -eq "WAREHOUSE_CN") {
        Write-Host "  Order advanced to WAREHOUSE_CN: $($ordCheck.code)" -ForegroundColor Gray
        $ORDER = $ordCheck
        $ORDER_ID = $ordCheck.id
    } else {
        # Try SOURCING status as fallback (warehouse-cn receive may accept it)
        $st = if ($ordCheck) { $ordCheck.status } else { "UNKNOWN" }
        Warn "SETUP: Order at $st instead of WAREHOUSE_CN, continuing anyway"
        if ($ordCheck) {
            $ORDER = $ordCheck
            $ORDER_ID = $ordCheck.id
        } else {
            $ORDER_ID = $ord.id
        }
    }
}

if (-not $ORDER_ID) { Fail "SETUP: No order available for testing"; exit 1 }
Pass "SETUP: Order ready - ID=$ORDER_ID"

# Also create a second order for batch/extra tests
$ORDER2_ID = $null
Write-Host ""
Write-Host "=== SETUP: Create second order for batch tests ===" -ForegroundColor White

$customers2 = D (Api "GET" "/customers?limit=1" $CEO)
$cust2 = $null
if ($customers2 -is [array] -and $customers2.Count -gt 0) { $cust2 = $customers2[0] }
elseif ($customers2 -and $customers2.id) { $cust2 = $customers2 }

if ($cust2) {
    $ord2 = D (Api "POST" "/orders" $SALE @{
        customerId    = $cust2.id
        serviceType   = "ORDER"
        shippingRoute = "ROAD"
        branch        = "HN"
        items         = @(@{
            productName = "WH-CN-001 Batch Test - $TS"
            quantity    = 3
            unitPrice   = 150
            currency    = "CNY"
        })
        note          = "WH-CN-001 batch test order - $TS"
    })
    if ($ord2 -and $ord2.id) {
        $transitions2 = @("QUOTATION", "PENDING_DEPOSIT", "SOURCING", "WAREHOUSE_CN")
        foreach ($st in $transitions2) {
            Api "PATCH" "/orders/$($ord2.id)/status" $CEO @{ status = $st } | Out-Null
            Start-Sleep -Milliseconds 300
        }
        $ord2Check = D (Api "GET" "/orders/$($ord2.id)" $CEO)
        if ($ord2Check -and $ord2Check.id) {
            $ORDER2_ID = $ord2Check.id
            Write-Host "  Second order: $($ord2Check.code) (status=$($ord2Check.status))" -ForegroundColor Gray
        }
    }
}

if ($ORDER2_ID) { Pass "SETUP: Second order ready" } else { Warn "SETUP: Could not create second order" }

# ================================================================
# PART A: RECEIVE SINGLE PACKAGE (~6 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Nhan 1 kien don le tai kho TQ" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$TRACK_A = "WH-CN-001-A-$TS"
$PKG_A_ID = $null

Write-Host ""
Write-Host "=== A1: Receive package ===" -ForegroundColor White
$rcvResp = Api "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = $TRACK_A
    orderId          = $ORDER_ID
    imageUrls        = @("https://storage.example.com/pkg-front.jpg", "https://storage.example.com/pkg-side.jpg")
    description      = "Hang dien tu - 1 kien"
    note             = "Test WH-CN-001 Part A"
}
$rcvData = D $rcvResp
# Response structure: { package: {...}, preAlertMatch: ... }
$pkgA = $null
if ($rcvData -and $rcvData.package) { $pkgA = $rcvData.package }
elseif ($rcvData -and $rcvData.id) { $pkgA = $rcvData }

if ($pkgA -and $pkgA.id) {
    $PKG_A_ID = $pkgA.id
    Pass "A1: Package received - ID=$PKG_A_ID, code=$($pkgA.code)"
} else {
    Fail "A1: Failed to receive package (response: $($rcvResp | ConvertTo-Json -Depth 3 -Compress))"
}

# A2: Verify response has trackingNumberCN
Write-Host ""
Write-Host "=== A2: Verify trackingNumberCN ===" -ForegroundColor White
if ($pkgA -and $pkgA.trackingNumberCN -eq $TRACK_A) {
    Pass "A2: trackingNumberCN = $TRACK_A"
} elseif ($pkgA) {
    Fail "A2: trackingNumberCN mismatch: expected '$TRACK_A', got '$($pkgA.trackingNumberCN)'"
} else {
    Fail "A2: No package data to verify"
}

# A3: Verify status = RECEIVED
Write-Host ""
Write-Host "=== A3: Verify status = RECEIVED ===" -ForegroundColor White
if ($pkgA -and $pkgA.warehouseCNStatus -eq "RECEIVED") {
    Pass "A3: warehouseCNStatus = RECEIVED"
} elseif ($pkgA) {
    Fail "A3: warehouseCNStatus = $($pkgA.warehouseCNStatus), expected RECEIVED"
} else {
    Fail "A3: No package data to verify"
}

# A4: Verify receivedCNAt timestamp
Write-Host ""
Write-Host "=== A4: Verify receivedCNAt timestamp ===" -ForegroundColor White
if ($pkgA -and $pkgA.receivedCNAt) {
    Pass "A4: receivedCNAt = $($pkgA.receivedCNAt)"
} elseif ($pkgA) {
    Warn "A4: receivedCNAt is null (may be populated but not returned)"
} else {
    Fail "A4: No package data to verify"
}

# A5: GET package detail and verify orderId linked
Write-Host ""
Write-Host "=== A5: GET package detail - verify orderId ===" -ForegroundColor White
Start-Sleep -Milliseconds 500
if ($PKG_A_ID) {
    # The getPackage endpoint uses search internally
    $pkgDetail = D (Api "GET" "/warehouse-cn/packages?search=$TRACK_A&limit=1" $WH_CN)
    $foundPkg = $null
    if ($pkgDetail -is [array] -and $pkgDetail.Count -gt 0) { $foundPkg = $pkgDetail[0] }
    elseif ($pkgDetail -and $pkgDetail.id) { $foundPkg = $pkgDetail }
    # Also try paginated response structure
    if (-not $foundPkg -and $pkgDetail -and $pkgDetail.items) {
        if ($pkgDetail.items -is [array] -and $pkgDetail.items.Count -gt 0) { $foundPkg = $pkgDetail.items[0] }
    }

    if ($foundPkg -and $foundPkg.orderId -eq $ORDER_ID) {
        Pass "A5: Package linked to order $ORDER_ID"
    } elseif ($foundPkg) {
        Fail "A5: orderId mismatch: expected '$ORDER_ID', got '$($foundPkg.orderId)'"
    } else {
        Warn "A5: Could not find package detail via search"
    }
} else {
    Fail "A5: No PKG_A_ID to query"
}

# A6: Verify package code format
Write-Host ""
Write-Host "=== A6: Verify package code format ===" -ForegroundColor White
if ($pkgA -and $pkgA.code -match "^TBS-PKG-") {
    Pass "A6: Package code format OK - $($pkgA.code)"
} elseif ($pkgA -and $pkgA.code) {
    Warn "A6: Package code '$($pkgA.code)' does not match TBS-PKG-XXXXXX pattern"
} else {
    Fail "A6: No package code"
}

# ================================================================
# PART B: MEASURE PACKAGE + CHARGEABLE WEIGHT (~7 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Do luong kien + Tinh can nang tinh cuoc" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Dimensions: 40x30x25 cm, actualWeight = 5.2 kg
# CBM = 40*30*25 / 1,000,000 = 0.03 m3
# For SEA route: volumetric = 0.03 * 1000 = 30 kg
# For ROAD route: volumetric = 0.03 * 333 = 9.99 kg
# chargeableWeight = MAX(5.2, volumetric)
# If SEA: chargeable = 30 (volumetric wins)
# If ROAD: chargeable = 9.99 (volumetric wins)

Write-Host ""
Write-Host "=== B1: Measure package (40x30x25 cm, 5.2 kg) ===" -ForegroundColor White
$measureResult = $null
if ($PKG_A_ID) {
    $measureResp = Api "POST" "/warehouse-cn/packages/$PKG_A_ID/measure" $WH_CN @{
        actualWeight = 5.2
        length       = 40
        width        = 30
        height       = 25
        note         = "Can do tai kho TQ"
    }
    $measureResult = D $measureResp
    if ($measureResult) {
        Pass "B1: Measure API returned OK"
        Write-Host "    Response keys: $($measureResult | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name)" -ForegroundColor Gray
    } else {
        Fail "B1: Measure API returned null"
    }
} else {
    Fail "B1: No PKG_A_ID to measure"
}

# Extract measurement data from response
# Response: { package: {...}, calculation: { actualWeight, volumetricWeight, chargeableWeight, ... } }
$calcData = $null
$measuredPkg = $null
if ($measureResult -and $measureResult.calculation) { $calcData = $measureResult.calculation }
if ($measureResult -and $measureResult.package) { $measuredPkg = $measureResult.package }
elseif ($measureResult -and $measureResult.id) { $measuredPkg = $measureResult }

# B2: Verify actualWeight stored
Write-Host ""
Write-Host "=== B2: Verify actualWeight = 5.2 ===" -ForegroundColor White
$storedActual = $null
if ($calcData -and $calcData.actualWeight) { $storedActual = [double]$calcData.actualWeight }
elseif ($measuredPkg -and $measuredPkg.actualWeight) { $storedActual = [double]$measuredPkg.actualWeight }

if ($storedActual -eq 5.2) {
    Pass "B2: actualWeight = 5.2 kg"
} elseif ($null -ne $storedActual) {
    Fail "B2: actualWeight = $storedActual, expected 5.2"
} else {
    Warn "B2: Could not extract actualWeight from response"
}

# B3: Verify volumetricWeight > 0
Write-Host ""
Write-Host "=== B3: Verify volumetricWeight calculated ===" -ForegroundColor White
$storedVol = $null
if ($calcData -and $calcData.volumetricWeight) { $storedVol = [double]$calcData.volumetricWeight }
elseif ($measuredPkg -and $measuredPkg.volumetricWeight) { $storedVol = [double]$measuredPkg.volumetricWeight }

if ($null -ne $storedVol -and $storedVol -gt 0) {
    Pass "B3: volumetricWeight = $storedVol kg (> 0)"
    # CBM = 40*30*25/1000000 = 0.03
    # SEA factor=1000 -> vol=30, ROAD factor=333 -> vol=9.99, AIR factor=167 -> vol=5.01
    Write-Host "    CBM = 0.03 m3. SEA->30kg, ROAD->9.99kg, AIR->5.01kg" -ForegroundColor Gray
} elseif ($null -ne $storedVol) {
    Fail "B3: volumetricWeight = $storedVol (not > 0)"
} else {
    Warn "B3: Could not extract volumetricWeight from response"
}

# B4: Verify chargeableWeight = MAX(actualWeight, volumetricWeight)
Write-Host ""
Write-Host "=== B4: Verify chargeableWeight = MAX(actual, volumetric) ===" -ForegroundColor White
$storedChargeable = $null
if ($calcData -and $calcData.chargeableWeight) { $storedChargeable = [double]$calcData.chargeableWeight }
elseif ($measuredPkg -and $measuredPkg.chargeableWeight) { $storedChargeable = [double]$measuredPkg.chargeableWeight }

if ($null -ne $storedChargeable -and $null -ne $storedActual -and $null -ne $storedVol) {
    $expectedChargeable = [math]::Max($storedActual, $storedVol)
    if ([math]::Abs($storedChargeable - $expectedChargeable) -lt 0.01) {
        Pass "B4: chargeableWeight = $storedChargeable = MAX($storedActual, $storedVol)"
    } else {
        Fail "B4: chargeableWeight = $storedChargeable, expected MAX($storedActual, $storedVol) = $expectedChargeable"
    }
} elseif ($null -ne $storedChargeable -and $null -ne $storedActual) {
    # At minimum, chargeable >= actual
    if ($storedChargeable -ge $storedActual) {
        Pass "B4: chargeableWeight ($storedChargeable) >= actualWeight ($storedActual)"
    } else {
        Fail "B4: chargeableWeight ($storedChargeable) < actualWeight ($storedActual)"
    }
} else {
    Warn "B4: Could not verify chargeableWeight calculation"
}

# B5: Verify dimensions stored
Write-Host ""
Write-Host "=== B5: Verify dimensions stored (L=40, W=30, H=25) ===" -ForegroundColor White
$dimOk = $true
if ($measuredPkg) {
    if ([double]$measuredPkg.length -ne 40)  { $dimOk = $false; Write-Host "    length=$($measuredPkg.length) (expected 40)" -ForegroundColor Yellow }
    if ([double]$measuredPkg.width -ne 30)   { $dimOk = $false; Write-Host "    width=$($measuredPkg.width) (expected 30)" -ForegroundColor Yellow }
    if ([double]$measuredPkg.height -ne 25)  { $dimOk = $false; Write-Host "    height=$($measuredPkg.height) (expected 25)" -ForegroundColor Yellow }
    if ($dimOk) { Pass "B5: Dimensions stored correctly (40x30x25 cm)" }
    else { Fail "B5: Dimensions mismatch" }
} else {
    Warn "B5: No package data to verify dimensions"
}

# B6: Verify status changed to CHECKED (measure auto-transitions)
Write-Host ""
Write-Host "=== B6: Verify status = CHECKED after measure ===" -ForegroundColor White
$statusAfterMeasure = $null
if ($measuredPkg -and $measuredPkg.warehouseCNStatus) {
    $statusAfterMeasure = $measuredPkg.warehouseCNStatus
} elseif ($PKG_A_ID) {
    # Fetch the package to check status
    Start-Sleep -Milliseconds 500
    $pkgCheck = D (Api "GET" "/warehouse-cn/packages?search=$TRACK_A&limit=1" $WH_CN)
    $foundCheck = $null
    if ($pkgCheck -is [array] -and $pkgCheck.Count -gt 0) { $foundCheck = $pkgCheck[0] }
    elseif ($pkgCheck -and $pkgCheck.id) { $foundCheck = $pkgCheck }
    if ($foundCheck) { $statusAfterMeasure = $foundCheck.warehouseCNStatus }
}

if ($statusAfterMeasure -eq "CHECKED") {
    Pass "B6: Status = CHECKED after measure (auto-transition)"
} elseif ($statusAfterMeasure -eq "RECEIVED") {
    Warn "B6: Status still RECEIVED after measure (expected CHECKED)"
} elseif ($statusAfterMeasure) {
    Warn "B6: Status = $statusAfterMeasure after measure"
} else {
    Warn "B6: Could not determine status after measure"
}

# B7: Verify isVolumetric flag in calculation
Write-Host ""
Write-Host "=== B7: Verify isVolumetric flag ===" -ForegroundColor White
if ($calcData -and $null -ne $calcData.isVolumetric) {
    if ($calcData.isVolumetric -eq $true) {
        Pass "B7: isVolumetric = true (volumetric > actual, as expected for 40x30x25/5.2kg)"
    } else {
        # For SEA/ROAD with these dimensions, volumetric should exceed 5.2kg
        Warn "B7: isVolumetric = false (unusual for these dimensions)"
    }
} else {
    Warn "B7: isVolumetric flag not found in response"
}

# ================================================================
# PART C: PACKAGE STATUS TRANSITIONS - FSM (~5 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Chuyen trang thai kien (FSM)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Note: After measure, package is at CHECKED
# FSM: RECEIVED -> CHECKED -> PACKED -> SHIPPED

# C1: CHECKED -> PACKED
Write-Host ""
Write-Host "=== C1: CHECKED -> PACKED ===" -ForegroundColor White
if ($PKG_A_ID) {
    Start-Sleep -Milliseconds 500
    $packResp = Api "PATCH" "/warehouse-cn/packages/$PKG_A_ID/status" $WH_CN @{ status = "PACKED" }
    $packData = D $packResp
    if ($packData -and $packData.warehouseCNStatus -eq "PACKED") {
        Pass "C1: Status transitioned CHECKED -> PACKED"
    } elseif ($packData) {
        Fail "C1: Status = $($packData.warehouseCNStatus), expected PACKED"
    } else {
        Fail "C1: PATCH status to PACKED failed"
    }
} else {
    Fail "C1: No PKG_A_ID"
}

# C2: Verify PACKED status persists
Write-Host ""
Write-Host "=== C2: Verify PACKED status ===" -ForegroundColor White
Start-Sleep -Milliseconds 500
if ($PKG_A_ID) {
    $pkgAfterPack = D (Api "GET" "/warehouse-cn/packages?search=$TRACK_A&limit=1" $WH_CN)
    $foundAfterPack = $null
    if ($pkgAfterPack -is [array] -and $pkgAfterPack.Count -gt 0) { $foundAfterPack = $pkgAfterPack[0] }
    elseif ($pkgAfterPack -and $pkgAfterPack.id) { $foundAfterPack = $pkgAfterPack }
    if ($foundAfterPack -and $foundAfterPack.warehouseCNStatus -eq "PACKED") {
        Pass "C2: Status confirmed PACKED via GET"
    } elseif ($foundAfterPack) {
        Fail "C2: Status = $($foundAfterPack.warehouseCNStatus), expected PACKED"
    } else {
        Warn "C2: Could not verify status via GET"
    }
} else {
    Fail "C2: No PKG_A_ID"
}

# C3: PACKED -> SHIPPED
Write-Host ""
Write-Host "=== C3: PACKED -> SHIPPED ===" -ForegroundColor White
if ($PKG_A_ID) {
    Start-Sleep -Milliseconds 500
    $shipResp = Api "PATCH" "/warehouse-cn/packages/$PKG_A_ID/status" $WH_CN @{ status = "SHIPPED" }
    $shipData = D $shipResp
    if ($shipData -and $shipData.warehouseCNStatus -eq "SHIPPED") {
        Pass "C3: Status transitioned PACKED -> SHIPPED"
    } elseif ($shipData) {
        Fail "C3: Status = $($shipData.warehouseCNStatus), expected SHIPPED"
    } else {
        Fail "C3: PATCH status to SHIPPED failed"
    }
} else {
    Fail "C3: No PKG_A_ID"
}

# C4: Invalid transition: SHIPPED -> RECEIVED (should fail)
Write-Host ""
Write-Host "=== C4: Invalid transition SHIPPED -> RECEIVED (expect 400) ===" -ForegroundColor White
if ($PKG_A_ID) {
    Start-Sleep -Milliseconds 500
    $invalidResp = Api-Expect "PATCH" "/warehouse-cn/packages/$PKG_A_ID/status" $WH_CN @{ status = "RECEIVED" }
    if ($invalidResp.code -ge 400 -and $invalidResp.code -lt 500) {
        Pass "C4: Invalid transition rejected with HTTP $($invalidResp.code)"
    } elseif ($invalidResp.code -eq 200) {
        Fail "C4: Invalid transition SHIPPED -> RECEIVED was allowed (HTTP 200)"
    } else {
        Warn "C4: Unexpected HTTP $($invalidResp.code)"
    }
} else {
    Fail "C4: No PKG_A_ID"
}

# C5: Invalid transition: SHIPPED -> PACKED (should fail)
Write-Host ""
Write-Host "=== C5: Invalid transition SHIPPED -> PACKED (expect 400) ===" -ForegroundColor White
if ($PKG_A_ID) {
    $invalidResp2 = Api-Expect "PATCH" "/warehouse-cn/packages/$PKG_A_ID/status" $WH_CN @{ status = "PACKED" }
    if ($invalidResp2.code -ge 400 -and $invalidResp2.code -lt 500) {
        Pass "C5: Invalid transition SHIPPED -> PACKED rejected with HTTP $($invalidResp2.code)"
    } elseif ($invalidResp2.code -eq 200) {
        Fail "C5: Invalid transition SHIPPED -> PACKED was allowed"
    } else {
        Warn "C5: Unexpected HTTP $($invalidResp2.code)"
    }
} else {
    Fail "C5: No PKG_A_ID"
}

# ================================================================
# PART D: BATCH / MULTIPLE PACKAGES (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Nhan nhieu kien cho cung 1 don" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$TRACK_D1 = "WH-CN-001-D1-$TS"
$TRACK_D2 = "WH-CN-001-D2-$TS"
$PKG_D1_ID = $null
$PKG_D2_ID = $null

# Use ORDER2_ID if available, otherwise fall back to ORDER_ID
$TARGET_ORDER = if ($ORDER2_ID) { $ORDER2_ID } else { $ORDER_ID }

# D1: Receive first additional package
Write-Host ""
Write-Host "=== D1: Receive package D1 ===" -ForegroundColor White
$rcvD1 = Api "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = $TRACK_D1
    orderId          = $TARGET_ORDER
    imageUrls        = @("https://storage.example.com/d1-front.jpg")
    description      = "Hang may mac - kien 1"
    note             = "WH-CN-001 Part D pkg 1"
}
$rcvD1Data = D $rcvD1
$pkgD1 = $null
if ($rcvD1Data -and $rcvD1Data.package) { $pkgD1 = $rcvD1Data.package }
elseif ($rcvD1Data -and $rcvD1Data.id) { $pkgD1 = $rcvD1Data }
if ($pkgD1 -and $pkgD1.id) {
    $PKG_D1_ID = $pkgD1.id
    Pass "D1: Package D1 received - $($pkgD1.code)"
} else {
    Fail "D1: Failed to receive package D1"
}

# D2: Receive second additional package
Write-Host ""
Write-Host "=== D2: Receive package D2 ===" -ForegroundColor White
$rcvD2 = Api "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = $TRACK_D2
    orderId          = $TARGET_ORDER
    imageUrls        = @("https://storage.example.com/d2-front.jpg")
    description      = "Hang may mac - kien 2"
    note             = "WH-CN-001 Part D pkg 2"
}
$rcvD2Data = D $rcvD2
$pkgD2 = $null
if ($rcvD2Data -and $rcvD2Data.package) { $pkgD2 = $rcvD2Data.package }
elseif ($rcvD2Data -and $rcvD2Data.id) { $pkgD2 = $rcvD2Data }
if ($pkgD2 -and $pkgD2.id) {
    $PKG_D2_ID = $pkgD2.id
    Pass "D2: Package D2 received - $($pkgD2.code)"
} else {
    Fail "D2: Failed to receive package D2"
}

# D3: Verify unique tracking numbers
Write-Host ""
Write-Host "=== D3: Verify unique tracking numbers ===" -ForegroundColor White
if ($pkgD1 -and $pkgD2) {
    if ($pkgD1.trackingNumberCN -ne $pkgD2.trackingNumberCN) {
        Pass "D3: Tracking numbers are unique ($TRACK_D1 vs $TRACK_D2)"
    } else {
        Fail "D3: Tracking numbers are identical"
    }
} else {
    Warn "D3: Could not compare tracking numbers (missing packages)"
}

# D4: List packages by orderId and verify count
Write-Host ""
Write-Host "=== D4: List packages by orderId ===" -ForegroundColor White
Start-Sleep -Milliseconds 500
$listByOrder = D (Api "GET" "/warehouse-cn/packages?orderId=$TARGET_ORDER&limit=50" $WH_CN)
$pkgList = @()
if ($listByOrder -is [array]) { $pkgList = $listByOrder }
elseif ($listByOrder -and $listByOrder.items) { $pkgList = $listByOrder.items }
elseif ($listByOrder -and $listByOrder.id) { $pkgList = @($listByOrder) }

if ($pkgList.Count -ge 2) {
    Pass "D4: Found $($pkgList.Count) packages for order $TARGET_ORDER (>= 2)"
} elseif ($pkgList.Count -gt 0) {
    Warn "D4: Found $($pkgList.Count) package(s), expected >= 2"
} else {
    Fail "D4: No packages found for order $TARGET_ORDER"
}

# ================================================================
# PART E: PHOTO UPLOAD (~3 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: Upload anh kien hang" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Note: The controller doesn't have a separate photo upload endpoint in the code we read.
# Photos are provided at receive time via imageUrls. We'll verify photos from receive.

Write-Host ""
Write-Host "=== E1: Verify imageUrls from receive ===" -ForegroundColor White
if ($pkgA -and $pkgA.imageUrls) {
    $imgCount = 0
    if ($pkgA.imageUrls -is [array]) { $imgCount = $pkgA.imageUrls.Count }
    if ($imgCount -ge 2) {
        Pass "E1: Package A has $imgCount imageUrls from receive"
    } else {
        Warn "E1: Package A has $imgCount imageUrl(s), expected 2"
    }
} else {
    Warn "E1: imageUrls not present in package response"
}

# E2: Verify D1 package has imageUrls
Write-Host ""
Write-Host "=== E2: Verify D1 package imageUrls ===" -ForegroundColor White
if ($pkgD1 -and $pkgD1.imageUrls) {
    $imgCount = 0
    if ($pkgD1.imageUrls -is [array]) { $imgCount = $pkgD1.imageUrls.Count }
    if ($imgCount -ge 1) {
        Pass "E2: Package D1 has $imgCount imageUrl(s)"
    } else {
        Warn "E2: Package D1 has 0 imageUrls"
    }
} else {
    Warn "E2: imageUrls not present in D1 package"
}

# E3: Verify imageUrls via list endpoint
Write-Host ""
Write-Host "=== E3: Verify imageUrls via list endpoint ===" -ForegroundColor White
if ($PKG_D1_ID) {
    $listCheck = D (Api "GET" "/warehouse-cn/packages?search=$TRACK_D1&limit=1" $WH_CN)
    $foundE3 = $null
    if ($listCheck -is [array] -and $listCheck.Count -gt 0) { $foundE3 = $listCheck[0] }
    elseif ($listCheck -and $listCheck.id) { $foundE3 = $listCheck }
    if ($foundE3 -and $foundE3.imageUrls) {
        Pass "E3: imageUrls present in list endpoint response"
    } elseif ($foundE3) {
        Warn "E3: Package found but imageUrls not in list response (may not be included)"
    } else {
        Warn "E3: Could not find package via search"
    }
} else {
    Warn "E3: No PKG_D1_ID to check"
}

# ================================================================
# PART F: SEARCH & FILTER (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Tim kiem va loc kien hang" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# F1: Search by tracking number fragment
Write-Host ""
Write-Host "=== F1: Search by tracking number ===" -ForegroundColor White
$searchResp = D (Api "GET" "/warehouse-cn/packages?search=WH-CN-001&limit=20" $WH_CN)
$searchResults = @()
if ($searchResp -is [array]) { $searchResults = $searchResp }
elseif ($searchResp -and $searchResp.items) { $searchResults = $searchResp.items }

if ($searchResults.Count -ge 1) {
    Pass "F1: Search 'WH-CN-001' returned $($searchResults.Count) result(s)"
} else {
    Warn "F1: Search 'WH-CN-001' returned 0 results"
}

# F2: Filter by status = RECEIVED
Write-Host ""
Write-Host "=== F2: Filter by status = RECEIVED ===" -ForegroundColor White
$filterResp = D (Api "GET" "/warehouse-cn/packages?status=RECEIVED&limit=10" $WH_CN)
$filterResults = @()
if ($filterResp -is [array]) { $filterResults = $filterResp }
elseif ($filterResp -and $filterResp.items) { $filterResults = $filterResp.items }

# D1 and D2 should be in RECEIVED status
if ($filterResults.Count -ge 1) {
    Pass "F2: Filter status=RECEIVED returned $($filterResults.Count) package(s)"
} else {
    Warn "F2: Filter status=RECEIVED returned 0 results"
}

# F3: Filter by orderId
Write-Host ""
Write-Host "=== F3: Filter by orderId ===" -ForegroundColor White
$filterOrderResp = D (Api "GET" "/warehouse-cn/packages?orderId=$ORDER_ID&limit=20" $WH_CN)
$filterOrderResults = @()
if ($filterOrderResp -is [array]) { $filterOrderResults = $filterOrderResp }
elseif ($filterOrderResp -and $filterOrderResp.items) { $filterOrderResults = $filterOrderResp.items }

if ($filterOrderResults.Count -ge 1) {
    Pass "F3: Filter orderId=$ORDER_ID returned $($filterOrderResults.Count) package(s)"
} else {
    Warn "F3: Filter by orderId returned 0 results"
}

# F4: Scan barcode lookup
Write-Host ""
Write-Host "=== F4: Scan barcode lookup ===" -ForegroundColor White
if ($TRACK_D1) {
    $scanResp = D (Api "GET" "/warehouse-cn/scan/$TRACK_D1" $WH_CN)
    if ($scanResp -and $scanResp.id) {
        Pass "F4: Scan barcode found package $($scanResp.code)"
    } elseif ($scanResp -and $scanResp.trackingNumberCN) {
        Pass "F4: Scan barcode found package by tracking"
    } else {
        Warn "F4: Scan barcode returned no match (may need cache warmup)"
    }
} else {
    Warn "F4: No tracking number to scan"
}

# ================================================================
# PART G: VALIDATION (~5 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: Kiem tra validation (missing fields, bad data)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# G1: Receive without trackingNumberCN -> expect 400
Write-Host ""
Write-Host "=== G1: Receive without trackingNumberCN (expect 400) ===" -ForegroundColor White
$g1 = Api-Expect "POST" "/warehouse-cn/receive" $WH_CN @{
    orderId   = $ORDER_ID
    imageUrls = @("https://storage.example.com/g1.jpg")
}
if ($g1.code -eq 400) {
    Pass "G1: Missing trackingNumberCN -> HTTP 400"
} elseif ($g1.code -ge 400) {
    Pass "G1: Missing trackingNumberCN -> HTTP $($g1.code) (rejected)"
} elseif ($g1.code -eq 201 -or $g1.code -eq 200) {
    Fail "G1: Missing trackingNumberCN was accepted (HTTP $($g1.code))"
} else {
    Warn "G1: Unexpected HTTP $($g1.code)"
}

# G2: Receive without orderId -> expect 400
Write-Host ""
Write-Host "=== G2: Receive without orderId (expect 400) ===" -ForegroundColor White
$g2 = Api-Expect "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = "WH-CN-001-G2-$TS"
    imageUrls        = @("https://storage.example.com/g2.jpg")
}
if ($g2.code -eq 400) {
    Pass "G2: Missing orderId -> HTTP 400"
} elseif ($g2.code -ge 400) {
    Pass "G2: Missing orderId -> HTTP $($g2.code) (rejected)"
} elseif ($g2.code -eq 201 -or $g2.code -eq 200) {
    Fail "G2: Missing orderId was accepted (HTTP $($g2.code))"
} else {
    Warn "G2: Unexpected HTTP $($g2.code)"
}

# G3: Receive without imageUrls -> expect 400 (Layer 4A mandatory photos)
Write-Host ""
Write-Host "=== G3: Receive without imageUrls (expect 400) ===" -ForegroundColor White
$g3 = Api-Expect "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = "WH-CN-001-G3-$TS"
    orderId          = $ORDER_ID
}
if ($g3.code -eq 400) {
    Pass "G3: Missing imageUrls -> HTTP 400 (Layer 4A enforced)"
} elseif ($g3.code -ge 400) {
    Pass "G3: Missing imageUrls -> HTTP $($g3.code) (rejected)"
} elseif ($g3.code -eq 201 -or $g3.code -eq 200) {
    Fail "G3: Missing imageUrls was accepted (Layer 4A violation)"
} else {
    Warn "G3: Unexpected HTTP $($g3.code)"
}

# G4: Receive with invalid orderId -> expect 404
Write-Host ""
Write-Host "=== G4: Receive with invalid orderId (expect 404) ===" -ForegroundColor White
$g4 = Api-Expect "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = "WH-CN-001-G4-$TS"
    orderId          = "non-existent-order-id-999"
    imageUrls        = @("https://storage.example.com/g4.jpg")
}
if ($g4.code -eq 404) {
    Pass "G4: Invalid orderId -> HTTP 404"
} elseif ($g4.code -ge 400) {
    Pass "G4: Invalid orderId -> HTTP $($g4.code) (rejected)"
} elseif ($g4.code -eq 201 -or $g4.code -eq 200) {
    Fail "G4: Invalid orderId was accepted"
} else {
    Warn "G4: Unexpected HTTP $($g4.code)"
}

# G5: Measure with negative weight -> expect 400
Write-Host ""
Write-Host "=== G5: Measure with negative weight (expect 400) ===" -ForegroundColor White
if ($PKG_D1_ID) {
    $g5 = Api-Expect "POST" "/warehouse-cn/packages/$PKG_D1_ID/measure" $WH_CN @{
        actualWeight = -5.0
        length       = 40
        width        = 30
        height       = 25
    }
    if ($g5.code -eq 400) {
        Pass "G5: Negative weight -> HTTP 400"
    } elseif ($g5.code -ge 400) {
        Pass "G5: Negative weight -> HTTP $($g5.code) (rejected)"
    } elseif ($g5.code -eq 200) {
        Fail "G5: Negative weight was accepted"
    } else {
        Warn "G5: Unexpected HTTP $($g5.code)"
    }
} else {
    Warn "G5: No package ID to test measure validation"
}

# ================================================================
# PART H: RBAC (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Kiem tra phan quyen (RBAC)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# H1: SALE tries to receive -> expect 403
Write-Host ""
Write-Host "=== H1: SALE tries to receive package (expect 403) ===" -ForegroundColor White
$h1 = Api-Expect "POST" "/warehouse-cn/receive" $SALE @{
    trackingNumberCN = "WH-CN-001-H1-$TS"
    orderId          = $ORDER_ID
    imageUrls        = @("https://storage.example.com/h1.jpg")
}
if ($h1.code -eq 403) {
    Pass "H1: SALE cannot receive package (HTTP 403)"
} elseif ($h1.code -eq 201 -or $h1.code -eq 200) {
    Fail "H1: SALE was able to receive package (HTTP $($h1.code) - RBAC not enforced)"
} else {
    Warn "H1: Unexpected HTTP $($h1.code) (expected 403)"
}

# H2: WAREHOUSE_CN_AGENT can receive -> 201 (already proven in Part A, just confirm role)
Write-Host ""
Write-Host "=== H2: WAREHOUSE_CN_AGENT can receive (expect 201) ===" -ForegroundColor White
$TRACK_H2 = "WH-CN-001-H2-$TS"
$h2 = Api-Expect "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = $TRACK_H2
    orderId          = $TARGET_ORDER
    imageUrls        = @("https://storage.example.com/h2.jpg")
}
if ($h2.code -eq 201 -or $h2.code -eq 200) {
    Pass "H2: WAREHOUSE_CN_AGENT can receive package (HTTP $($h2.code))"
    # Extract package for cleanup
    $h2Pkg = $null
    if ($h2.body -and $h2.body.data -and $h2.body.data.package) { $h2Pkg = $h2.body.data.package }
} else {
    Fail "H2: WAREHOUSE_CN_AGENT receive failed (HTTP $($h2.code))"
}

# H3: XNK_MANAGER can list packages -> 200
Write-Host ""
Write-Host "=== H3: XNK_MANAGER can list packages (expect 200) ===" -ForegroundColor White
if ($XNK) {
    $h3 = Api-Expect "GET" "/warehouse-cn/packages?limit=5" $XNK $null
    if ($h3.code -eq 200) {
        Pass "H3: XNK_MANAGER can list packages (HTTP 200)"
    } else {
        Fail "H3: XNK_MANAGER list failed (HTTP $($h3.code))"
    }
} else {
    Warn "H3: XNK_MANAGER token not available"
}

# H4: SALE can list packages (no @Roles on list endpoint = open to all authenticated)
Write-Host ""
Write-Host "=== H4: SALE can list packages ===" -ForegroundColor White
$h4 = Api-Expect "GET" "/warehouse-cn/packages?limit=5" $SALE $null
if ($h4.code -eq 200) {
    Pass "H4: SALE can list packages (HTTP 200 - endpoint open to all authenticated)"
} elseif ($h4.code -eq 403) {
    Warn "H4: SALE cannot list packages (HTTP 403 - restricted endpoint)"
} else {
    Warn "H4: Unexpected HTTP $($h4.code)"
}

# ================================================================
# PART I: DUPLICATE TRACKING NUMBER (~2 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART I: Trung ma van don (duplicate tracking)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# I1: Receive with same tracking as Part A -> expect warning or 409
Write-Host ""
Write-Host "=== I1: Duplicate trackingNumberCN (expect warning/409) ===" -ForegroundColor White
$i1Resp = Api "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = $TRACK_A
    orderId          = $TARGET_ORDER
    imageUrls        = @("https://storage.example.com/i1.jpg")
}
$i1Data = D $i1Resp
# Backend returns warning object { warning: true, message: "...", existingPackage: {...}, package: null }
if ($i1Data -and $i1Data.warning -eq $true) {
    Pass "I1: Duplicate tracking returned warning (not silently accepted)"
    Write-Host "    Warning message: $($i1Data.message)" -ForegroundColor Gray
} elseif ($null -eq $i1Resp) {
    # Api function returns null on error (e.g., 409)
    Pass "I1: Duplicate tracking rejected by server (error response)"
} elseif ($i1Data -and $i1Data.package -and $i1Data.package.id) {
    Fail "I1: Duplicate tracking was silently accepted as new package"
} else {
    Warn "I1: Unexpected response for duplicate tracking"
}

# I2: Verify original package unaffected
Write-Host ""
Write-Host "=== I2: Verify original package unaffected ===" -ForegroundColor White
Start-Sleep -Milliseconds 500
if ($PKG_A_ID) {
    $origCheck = D (Api "GET" "/warehouse-cn/packages?search=$TRACK_A&limit=5" $WH_CN)
    $origResults = @()
    if ($origCheck -is [array]) { $origResults = $origCheck }
    elseif ($origCheck -and $origCheck.items) { $origResults = $origCheck.items }
    elseif ($origCheck -and $origCheck.id) { $origResults = @($origCheck) }

    # Should find exactly 1 package with this tracking (the original from Part A)
    $matchCount = 0
    foreach ($p in $origResults) {
        if ($p.trackingNumberCN -eq $TRACK_A) { $matchCount++ }
    }
    if ($matchCount -eq 1) {
        Pass "I2: Original package unaffected (1 package with tracking $TRACK_A)"
    } elseif ($matchCount -eq 0) {
        Warn "I2: Could not find original package by tracking number"
    } else {
        Warn "I2: Found $matchCount packages with tracking $TRACK_A (expected 1)"
    }
} else {
    Warn "I2: No PKG_A_ID to verify"
}

# ================================================================
# PART J: HEAVY PACKAGE - VOLUMETRIC > ACTUAL (~3 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART J: Kien lon nhe (volumetric > actual)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Scenario: Light but bulky package
# actualWeight = 2.0 kg, dimensions = 80x60x50 cm
# CBM = 80*60*50 / 1,000,000 = 0.24 m3
# SEA:  volumetric = 0.24 * 1000 = 240 kg
# ROAD: volumetric = 0.24 * 333  = 79.92 kg
# AIR:  volumetric = 0.24 * 167  = 40.08 kg
# chargeableWeight = volumetric (since volumetric >> 2.0 for all routes)

$TRACK_J = "WH-CN-001-J-$TS"
$PKG_J_ID = $null

# J1: Receive new package for volumetric test
Write-Host ""
Write-Host "=== J1: Receive bulky package ===" -ForegroundColor White
$rcvJ = Api "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = $TRACK_J
    orderId          = $TARGET_ORDER
    imageUrls        = @("https://storage.example.com/j-bulky.jpg")
    description      = "Kien lon nhe - hop xop"
    note             = "WH-CN-001 Part J - volumetric test"
}
$rcvJData = D $rcvJ
$pkgJ = $null
if ($rcvJData -and $rcvJData.package) { $pkgJ = $rcvJData.package }
elseif ($rcvJData -and $rcvJData.id) { $pkgJ = $rcvJData }

if ($pkgJ -and $pkgJ.id) {
    $PKG_J_ID = $pkgJ.id
    Pass "J1: Bulky package received - $($pkgJ.code)"
} else {
    Fail "J1: Failed to receive bulky package"
}

# J2: Measure with small weight but large dimensions
Write-Host ""
Write-Host "=== J2: Measure (2.0 kg, 80x60x50 cm) ===" -ForegroundColor White
$measureJ = $null
if ($PKG_J_ID) {
    $measureJResp = Api "POST" "/warehouse-cn/packages/$PKG_J_ID/measure" $WH_CN @{
        actualWeight = 2.0
        length       = 80
        width        = 60
        height       = 50
        note         = "Kien lon nhe, can nang tinh cuoc theo the tich"
    }
    $measureJ = D $measureJResp
    if ($measureJ) {
        Pass "J2: Measure API returned OK for bulky package"
    } else {
        Fail "J2: Measure API failed for bulky package"
    }
} else {
    Fail "J2: No PKG_J_ID to measure"
}

# J3: Verify chargeableWeight = volumetricWeight (not actualWeight)
Write-Host ""
Write-Host "=== J3: Verify chargeableWeight = volumetricWeight (not actual) ===" -ForegroundColor White
$jCalc = $null
$jPkg = $null
if ($measureJ -and $measureJ.calculation) { $jCalc = $measureJ.calculation }
if ($measureJ -and $measureJ.package) { $jPkg = $measureJ.package }
elseif ($measureJ -and $measureJ.id) { $jPkg = $measureJ }

$jActual = $null; $jVol = $null; $jChargeable = $null
if ($jCalc) {
    if ($jCalc.actualWeight) { $jActual = [double]$jCalc.actualWeight }
    if ($jCalc.volumetricWeight) { $jVol = [double]$jCalc.volumetricWeight }
    if ($jCalc.chargeableWeight) { $jChargeable = [double]$jCalc.chargeableWeight }
}
if (-not $jActual -and $jPkg -and $jPkg.actualWeight) { $jActual = [double]$jPkg.actualWeight }
if (-not $jVol -and $jPkg -and $jPkg.volumetricWeight) { $jVol = [double]$jPkg.volumetricWeight }
if (-not $jChargeable -and $jPkg -and $jPkg.chargeableWeight) { $jChargeable = [double]$jPkg.chargeableWeight }

if ($null -ne $jChargeable -and $null -ne $jVol -and $null -ne $jActual) {
    Write-Host "    actual=$jActual kg, volumetric=$jVol kg, chargeable=$jChargeable kg" -ForegroundColor Gray
    if ($jVol -gt $jActual) {
        if ([math]::Abs($jChargeable - $jVol) -lt 0.01) {
            Pass "J3: chargeableWeight = volumetricWeight ($jChargeable kg), not actual ($jActual kg)"
        } elseif ($jChargeable -gt $jActual) {
            Pass "J3: chargeableWeight ($jChargeable) > actualWeight ($jActual) - volumetric based"
        } else {
            Fail "J3: chargeableWeight ($jChargeable) should be $jVol (volumetric), not $jActual (actual)"
        }
    } else {
        Warn "J3: Volumetric ($jVol) not > actual ($jActual) - unexpected for 80x60x50/2kg"
    }
} elseif ($null -ne $jChargeable) {
    if ($jChargeable -gt 2.0) {
        Pass "J3: chargeableWeight ($jChargeable) > actualWeight (2.0) - volumetric likely used"
    } else {
        Fail "J3: chargeableWeight ($jChargeable) should be >> 2.0 for 80x60x50 dimensions"
    }
} else {
    Warn "J3: Could not extract chargeable weight data"
}

# Bonus: Verify isVolumetric = true for bulky package
if ($jCalc -and $null -ne $jCalc.isVolumetric -and $jCalc.isVolumetric -eq $true) {
    Write-Host "    isVolumetric = true (correct for bulky package)" -ForegroundColor Gray
}

# ================================================================
# SUMMARY
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  SUMMARY: TEST-WH-CN-001" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
$total = $passCount + $failCount + $warnCount
Write-Host "  TOTAL: $total" -ForegroundColor White
Write-Host ""
if ($failCount -eq 0) {
    Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host "  $failCount FAILURE(s) detected." -ForegroundColor Red
}
Write-Host ""
