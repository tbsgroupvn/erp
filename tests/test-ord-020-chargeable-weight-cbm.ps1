# ================================================================
# TEST-ORD-020: Tinh chargeable weight - CBM > Actual Weight
# Severity: CRITICAL
#
# Scenario: 1 kien, 100x80x60 cm, 20kg, duong bien (SEA)
# CBM = 1.0 x 0.8 x 0.6 = 0.48 CBM
# CBM to KG (SEA, 1 CBM = 1000 kg): 0.48 x 1000 = 480 kg
# Chargeable = MAX(20, 480) = 480 kg
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
Write-Host "  TEST-ORD-020: Chargeable Weight - CBM > Actual Weight" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login ===" -ForegroundColor White

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SALE login OK" } else { Fail "SALE login FAILED"; exit 1 }

$WAREHOUSE_CN = Login "khotq01@$DOMAIN"
if ($WAREHOUSE_CN) { Pass "WAREHOUSE_CN login OK" } else { Fail "WAREHOUSE_CN login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

# Get VIP customer (has credit limit) - use CEO token for full visibility
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
Write-Host "  Customer: $($cust.code) ($($cust.tier)) - $($cust.fullName)" -ForegroundColor Gray

# ================================================================
# PART A: TAO DON HANG DUONG BIEN + NHAN HANG TAI KHO TQ
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Tao don hang duong bien + nhan kien tai kho TQ" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# A1: Create order with SEA route
Write-Host ""
Write-Host "=== TEST A1: Tao don hang SEA route ===" -ForegroundColor White
$orderBody = @{
    customerId    = $CUST_ID
    serviceType   = "VCT"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{ productName = "Heavy but large item"; productUrl = "https://item.taobao.com/item.htm?id=900001"; quantity = 1; unitPrice = 500 }
    )
    note = "Test chargeable weight CBM vs actual"
}
$orderResp = Api "POST" "/orders" $SALE $orderBody
$order = D $orderResp
if ($order -and $order.id) {
    $ORD_ID = $order.id
    $ORD_CODE = $order.code
    Write-Host "  Order: $ORD_CODE | route=$($order.shippingRoute) | status=$($order.status)"
    Pass "A1: SEA order created ($ORD_CODE)"
} else {
    Fail "A1: Failed to create SEA order"
    exit 1
}

# A2: Advance to WAREHOUSE_CN (so we can receive package)
Write-Host ""
Write-Host "=== TEST A2: Advance to WAREHOUSE_CN ===" -ForegroundColor White
Api "PATCH" "/orders/$ORD_ID/status" $SALE @{ status = "QUOTATION" } | Out-Null
Api "PATCH" "/orders/$ORD_ID/status" $SALE @{ status = "SOURCING" } | Out-Null
Api "PATCH" "/orders/$ORD_ID/status" $SALE @{ status = "WAREHOUSE_CN" } | Out-Null
$orderCheck = D (Api "GET" "/orders/$ORD_ID" $SALE)
if ($orderCheck.status -eq "WAREHOUSE_CN") {
    Pass "A2: Order at WAREHOUSE_CN"
} else {
    Fail "A2: Expected WAREHOUSE_CN, got $($orderCheck.status)"
    exit 1
}

# A3: Receive package at Warehouse CN
Write-Host ""
Write-Host "=== TEST A3: Receive package at Warehouse CN ===" -ForegroundColor White
$trackingCN = "TEST-CW-$(Get-Date -Format 'yyyyMMddHHmmss')"
$receiveBody = @{
    trackingNumberCN = $trackingCN
    orderId          = $ORD_ID
    imageUrls        = @("https://placeholder.test/pkg-cw-test.jpg")
    note             = "Package for chargeable weight test"
}
$receiveResp = D (Api "POST" "/warehouse-cn/receive" $WAREHOUSE_CN $receiveBody)
$PKG_ID = $null
if ($receiveResp -and $receiveResp.id) {
    $PKG_ID = $receiveResp.id
    Write-Host "  Package: $($receiveResp.code) | ID=$PKG_ID | status=$($receiveResp.warehouseCNStatus)"
    Pass "A3: Package received ($trackingCN)"
} elseif ($receiveResp -and $receiveResp.package -and $receiveResp.package.id) {
    $PKG_ID = $receiveResp.package.id
    Write-Host "  Package: $($receiveResp.package.code) | ID=$PKG_ID"
    Pass "A3: Package received ($trackingCN)"
} else {
    Fail "A3: Failed to receive package"
    exit 1
}

# ================================================================
# PART B: DO KICH THUOC + CAN NANG -> TINH CHARGEABLE WEIGHT
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Measure package - CBM vs Actual Weight" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# B1: Measure with large dimensions, light weight
Write-Host ""
Write-Host "=== TEST B1: Measure 100x80x60 cm, 20kg (SEA route) ===" -ForegroundColor White
Write-Host "  Input: L=100cm, W=80cm, H=60cm, actualWeight=20kg"
Write-Host "  Expected CBM: 1.0 x 0.8 x 0.6 = 0.48 CBM"
Write-Host "  Expected volumetric (SEA, 1CBM=1000kg): 480 kg"
Write-Host "  Expected chargeable: MAX(20, 480) = 480 kg"

$measureBody = @{
    actualWeight = 20
    length       = 100
    width        = 80
    height       = 60
    note         = "CBM test: large dimensions, light weight"
}
$measureResp = D (Api "POST" "/warehouse-cn/packages/$PKG_ID/measure" $WAREHOUSE_CN $measureBody)

if ($measureResp) {
    # Extract calculation result
    $calc = $measureResp.calculation
    $pkg = $measureResp.package
    if (-not $calc -and $measureResp.volumetricWeight) {
        # Maybe flat response
        $calc = $measureResp
    }

    if ($calc) {
        $volWeight = [double]$calc.volumetricWeight
        $charWeight = [double]$calc.chargeableWeight
        $divisor = $calc.volumetricDivisor
        $isVol = $calc.isVolumetric

        Write-Host "  Result:"
        Write-Host "    volumetricWeight = $volWeight kg"
        Write-Host "    chargeableWeight = $charWeight kg"
        Write-Host "    divisor = $divisor"
        Write-Host "    isVolumetric = $isVol"
        Write-Host "    route = $($calc.route)"
    }

    if ($pkg) {
        Write-Host "    package.actualWeight = $($pkg.actualWeight)"
        Write-Host "    package.volumetricWeight = $($pkg.volumetricWeight)"
        Write-Host "    package.chargeableWeight = $($pkg.chargeableWeight)"
        $charWeight = [double]$pkg.chargeableWeight
        $volWeight = [double]$pkg.volumetricWeight
    }

    # B1a: Volumetric weight should be 480 kg (SEA: 1 CBM = 1000 kg)
    # CBM = 100*80*60 / 1,000,000 = 0.48
    # Volumetric = 0.48 * 1000 = 480 kg  (divisor 1000: 480000/1000 = 480)
    if ([math]::Abs($volWeight - 480) -lt 1) {
        Pass "B1a: Volumetric weight = $volWeight kg (correct: 480 kg for SEA)"
    } elseif ([math]::Abs($volWeight - 80) -lt 1) {
        Fail "B1a: Volumetric weight = $volWeight kg (used divisor 6000 instead of 1000 for SEA)"
        Write-Host "    BUG: SEA route should use 1 CBM = 1000 kg (divisor 1000), not divisor 6000" -ForegroundColor Red
    } else {
        Fail "B1a: Volumetric weight = $volWeight kg (expected 480 kg)"
    }

    # B1b: Chargeable weight should be 480 kg
    if ([math]::Abs($charWeight - 480) -lt 1) {
        Pass "B1b: Chargeable weight = $charWeight kg (CBM > actual, correct)"
    } else {
        Fail "B1b: Chargeable weight = $charWeight kg (expected 480 kg)"
    }

    # B1c: isVolumetric should be true
    if ($isVol -eq $true) {
        Pass "B1c: isVolumetric = true (CBM wins over actual weight)"
    } elseif ($isVol -eq $null) {
        Warn "B1c: isVolumetric not returned in response"
    } else {
        Fail "B1c: isVolumetric = $isVol (expected true)"
    }
} else {
    Fail "B1: Failed to measure package"
}

# ================================================================
# PART C: VERIFY PACKAGE DATA IN DB
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Verify package data persisted" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST C1: Get package detail ===" -ForegroundColor White
# List packages for the order
$pkgList = D (Api "GET" "/warehouse-cn/packages?orderId=$ORD_ID" $WAREHOUSE_CN)
$foundPkg = $null
if ($pkgList -is [array]) {
    $foundPkg = $pkgList | Where-Object { $_.id -eq $PKG_ID } | Select-Object -First 1
} elseif ($pkgList -and $pkgList.id -eq $PKG_ID) {
    $foundPkg = $pkgList
}

if ($foundPkg) {
    Write-Host "  Package: $($foundPkg.code)"
    Write-Host "    actualWeight = $($foundPkg.actualWeight)"
    Write-Host "    volumetricWeight = $($foundPkg.volumetricWeight)"
    Write-Host "    chargeableWeight = $($foundPkg.chargeableWeight)"
    Write-Host "    length = $($foundPkg.length)"
    Write-Host "    width = $($foundPkg.width)"
    Write-Host "    height = $($foundPkg.height)"
    Write-Host "    warehouseCNStatus = $($foundPkg.warehouseCNStatus)"

    # C1a: actualWeight persisted
    if ([double]$foundPkg.actualWeight -eq 20) {
        Pass "C1a: actualWeight = 20 kg (persisted)"
    } else {
        Fail "C1a: actualWeight = $($foundPkg.actualWeight) (expected 20)"
    }

    # C1b: chargeableWeight persisted
    $persistedCW = [double]$foundPkg.chargeableWeight
    if ([math]::Abs($persistedCW - 480) -lt 1) {
        Pass "C1b: chargeableWeight = $persistedCW kg (persisted correctly)"
    } else {
        Fail "C1b: chargeableWeight = $persistedCW kg (expected 480)"
    }

    # C1c: status advanced to CHECKED
    if ($foundPkg.warehouseCNStatus -eq "CHECKED") {
        Pass "C1c: Package status = CHECKED (after measurement)"
    } else {
        Warn "C1c: Package status = $($foundPkg.warehouseCNStatus) (expected CHECKED)"
    }
} else {
    Warn "C1: Could not find package in list, trying direct get"
    $directPkg = D (Api "GET" "/warehouse-cn/packages/$PKG_ID" $WAREHOUSE_CN)
    if ($directPkg) {
        Write-Host "  chargeableWeight = $($directPkg.chargeableWeight)"
    } else {
        Fail "C1: Could not retrieve package data"
    }
}

# ================================================================
# PART D: EDGE CASES
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Edge cases" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# D1: Actual weight > CBM (compact heavy item)
Write-Host ""
Write-Host "=== TEST D1: Actual > Volumetric (compact heavy, SEA) ===" -ForegroundColor White
# Create another order + package for this test
$order2Body = @{
    customerId    = $CUST_ID
    serviceType   = "VCT"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @( @{ productName = "Small heavy item"; quantity = 1; unitPrice = 300 } )
    note          = "Test actual > volumetric"
}
$order2 = D (Api "POST" "/orders" $SALE $order2Body)
$ORD2_ID = $null
if ($order2 -and $order2.id) {
    $ORD2_ID = $order2.id
    Api "PATCH" "/orders/$ORD2_ID/status" $SALE @{ status = "QUOTATION" } | Out-Null
    Api "PATCH" "/orders/$ORD2_ID/status" $SALE @{ status = "SOURCING" } | Out-Null
    Api "PATCH" "/orders/$ORD2_ID/status" $SALE @{ status = "WAREHOUSE_CN" } | Out-Null

    $trackCN2 = "TEST-CW2-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $recv2 = D (Api "POST" "/warehouse-cn/receive" $WAREHOUSE_CN @{
        trackingNumberCN = $trackCN2; orderId = $ORD2_ID; imageUrls = @("https://placeholder.test/pkg2.jpg")
    })
    $PKG2_ID = $null
    if ($recv2 -and $recv2.id) { $PKG2_ID = $recv2.id }
    elseif ($recv2 -and $recv2.package) { $PKG2_ID = $recv2.package.id }

    if ($PKG2_ID) {
        Write-Host "  Input: L=30cm, W=20cm, H=15cm, actualWeight=50kg"
        # CBM = 0.03 * 0.02 * 0.015 = 0.009 m3 = 9 kg (SEA, /1000)
        # Actually: 30*20*15 = 9000 cm3 / 1000 = 9 kg volumetric
        Write-Host "  Expected volumetric (SEA): 30*20*15/1000 = 9 kg"
        Write-Host "  Expected chargeable: MAX(50, 9) = 50 kg"

        $m2 = D (Api "POST" "/warehouse-cn/packages/$PKG2_ID/measure" $WAREHOUSE_CN @{
            actualWeight = 50; length = 30; width = 20; height = 15
        })
        if ($m2) {
            $cw2 = 0
            if ($m2.calculation) { $cw2 = [double]$m2.calculation.chargeableWeight }
            elseif ($m2.package) { $cw2 = [double]$m2.package.chargeableWeight }
            elseif ($m2.chargeableWeight) { $cw2 = [double]$m2.chargeableWeight }

            Write-Host "  Result: chargeableWeight = $cw2 kg"
            if ([math]::Abs($cw2 - 50) -lt 1) {
                Pass "D1: Actual > volumetric -> chargeable = 50 kg (actual wins)"
            } else {
                Fail "D1: chargeableWeight = $cw2 (expected 50)"
            }
        } else {
            Fail "D1: Failed to measure compact heavy package"
        }
    } else {
        Fail "D1: Failed to create test package"
    }
} else {
    Fail "D1: Failed to create test order"
}

# D2: AIR route - divisor should be different from SEA
Write-Host ""
Write-Host "=== TEST D2: AIR route volumetric calculation ===" -ForegroundColor White
$order3Body = @{
    customerId    = $CUST_ID
    serviceType   = "VCT"
    branch        = "HN"
    shippingRoute = "AIR"
    items         = @( @{ productName = "Air freight item"; quantity = 1; unitPrice = 800 } )
    note          = "Test AIR volumetric"
}
$order3 = D (Api "POST" "/orders" $SALE $order3Body)
$ORD3_ID = $null
if ($order3 -and $order3.id) {
    $ORD3_ID = $order3.id
    Api "PATCH" "/orders/$ORD3_ID/status" $SALE @{ status = "QUOTATION" } | Out-Null
    Api "PATCH" "/orders/$ORD3_ID/status" $SALE @{ status = "SOURCING" } | Out-Null
    Api "PATCH" "/orders/$ORD3_ID/status" $SALE @{ status = "WAREHOUSE_CN" } | Out-Null

    $trackCN3 = "TEST-CW3-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $recv3 = D (Api "POST" "/warehouse-cn/receive" $WAREHOUSE_CN @{
        trackingNumberCN = $trackCN3; orderId = $ORD3_ID; imageUrls = @("https://placeholder.test/pkg3.jpg")
    })
    $PKG3_ID = $null
    if ($recv3 -and $recv3.id) { $PKG3_ID = $recv3.id }
    elseif ($recv3 -and $recv3.package) { $PKG3_ID = $recv3.package.id }

    if ($PKG3_ID) {
        Write-Host "  Input: L=100cm, W=80cm, H=60cm, actualWeight=20kg (same dims, AIR route)"
        # AIR divisor = 6000: 100*80*60 / 6000 = 80 kg
        Write-Host "  Expected volumetric (AIR, divisor 6000): 480000/6000 = 80 kg"
        Write-Host "  Expected chargeable: MAX(20, 80) = 80 kg"

        $m3 = D (Api "POST" "/warehouse-cn/packages/$PKG3_ID/measure" $WAREHOUSE_CN @{
            actualWeight = 20; length = 100; width = 80; height = 60
        })
        if ($m3) {
            $cw3 = 0; $vw3 = 0
            if ($m3.calculation) {
                $cw3 = [double]$m3.calculation.chargeableWeight
                $vw3 = [double]$m3.calculation.volumetricWeight
            } elseif ($m3.package) {
                $cw3 = [double]$m3.package.chargeableWeight
                $vw3 = [double]$m3.package.volumetricWeight
            }

            Write-Host "  Result: volumetric=$vw3 kg, chargeable=$cw3 kg"
            if ([math]::Abs($vw3 - 80) -lt 1) {
                Pass "D2a: AIR volumetric = $vw3 kg (divisor 6000 correct)"
            } else {
                Fail "D2a: AIR volumetric = $vw3 kg (expected 80)"
            }
            if ([math]::Abs($cw3 - 80) -lt 1) {
                Pass "D2b: AIR chargeable = $cw3 kg"
            } else {
                Fail "D2b: AIR chargeable = $cw3 kg (expected 80)"
            }
        } else {
            Fail "D2: Failed to measure AIR package"
        }
    } else {
        Fail "D2: Failed to create AIR test package"
    }
} else {
    Fail "D2: Failed to create AIR test order"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-ORD-020: Chargeable Weight - CBM > Actual" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  Part A: Tao don SEA + nhan kien tai kho TQ"
Write-Host "  Part B: Measure 100x80x60cm, 20kg -> expect 480kg chargeable"
Write-Host "  Part C: Verify data persisted"
Write-Host "  Part D: Edge cases (actual > vol, AIR route)"
Write-Host ""
Write-Host "  Divisor rules:"
Write-Host "    SEA:  1 CBM = 1000 kg -> divisor = 1000"
Write-Host "    AIR:  1 CBM = 166.67 kg -> divisor = 6000"
Write-Host "    ROAD: 1 CBM = 200 kg -> divisor = 5000"
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
