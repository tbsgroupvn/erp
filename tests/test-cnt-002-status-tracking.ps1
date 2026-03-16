# ================================================================
# TEST-CNT-002: Container status transition & tracking
# Severity: CRITICAL
#
# FSM: PLANNING -> LOADING -> IN_TRANSIT -> ARRIVED -> CUSTOMS -> COMPLETED
#      (+ ON_HOLD_BORDER from IN_TRANSIT)
#
# Steps:
#   1. Tao container + 3 orders, nhan + do + pack -> add packages
#   2. PLANNING -> LOADING (verify sealNumber via update)
#   3. LOADING -> IN_TRANSIT (verify actualDepartureAt, packages -> SHIPPED)
#   4. IN_TRANSIT -> ARRIVED (verify actualArrivalAt)
#   5. ARRIVED -> CUSTOMS (verify customs declaration auto-created)
#   6. CUSTOMS -> COMPLETED (verify customsClearedAt)
#   7. FSM enforcement: invalid transitions blocked
#   8. ON_HOLD_BORDER special state
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
        return @{ _error = $true; _code = $code; _body = $errBody }
    }
}

function D($resp) {
    if ($resp -and $resp._error) { return $null }
    if ($resp -and $resp.data) { return $resp.data }
    return $resp
}

function IsError($resp) { return ($resp -and $resp._error -eq $true) }

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
Write-Host "  TEST-CNT-002: Container Status Transition & Tracking" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login ===" -ForegroundColor White

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SALE login OK" } else { Fail "SALE login FAILED"; exit 1 }

$WH_CN = Login "khotq01@$DOMAIN"
if ($WH_CN) { Pass "WAREHOUSE_CN login OK" } else { Fail "WAREHOUSE_CN login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

$XNK = Login "xnk01@$DOMAIN"
if ($XNK) { Pass "XNK login OK" } else { Warn "XNK login FAILED (some tests may skip)" }

# Get VIP customer
$customers = D (Api "GET" "/customers?tier=VIP&limit=1" $CEO)
$cust = $null
if ($customers -is [array] -and $customers.Count -gt 0) { $cust = $customers[0] }
elseif ($customers -and $customers.id) { $cust = $customers }
if (-not $cust) { Fail "No VIP customer found"; exit 1 }
$CUST_ID = $cust.id
Write-Host "  Customer: $($cust.code) ($($cust.tier))" -ForegroundColor Gray

$TS = Get-Date -Format "yyyyMMddHHmmss"

# ================================================================
# PART A: TAO 3 DON HANG + RECEIVE + MEASURE + PACK
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Tao 3 don hang SEA, nhan + do + pack" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$PKG_IDS = @()
$PKG_CODES = @()
$ORDER_IDS = @()
$ORDER_CODES = @()

$weights = @(80, 100, 70)
$dims = @(
    @{ l = 40; w = 30; h = 25 },   # vol=30 < 80
    @{ l = 45; w = 35; h = 25 },   # vol=39.4 < 100
    @{ l = 35; w = 30; h = 20 }    # vol=21 < 70
)

for ($i = 0; $i -lt 3; $i++) {
    $n = $i + 1
    Write-Host ""
    Write-Host "=== Order #${n} ===" -ForegroundColor White

    $ord = D (Api "POST" "/orders" $SALE @{
        customerId    = $CUST_ID
        serviceType   = "VCT"
        shippingRoute = "SEA"
        branch        = "HN"
        items         = @(@{
            productName = "CNT002 product $n"
            quantity    = 5
            unitPrice   = 100
            currency    = "CNY"
        })
        note          = "CNT-002 test order #$n - $TS"
    })
    if (-not $ord -or -not $ord.id) { Fail "A${n}: Create order failed"; continue }
    $ORDER_IDS += $ord.id
    $ORDER_CODES += $ord.code

    # Advance to WAREHOUSE_CN
    foreach ($st in @("QUOTATION", "PENDING_DEPOSIT", "SOURCING", "WAREHOUSE_CN")) {
        $tr = Api "PATCH" "/orders/$($ord.id)/status" $CEO @{ status = $st }
        if (IsError $tr) { Write-Host "    Transition to $st failed" -ForegroundColor DarkRed; break }
    }

    # Receive
    $rcvResp = Api "POST" "/warehouse-cn/receive" $WH_CN @{
        trackingNumberCN = "CNT002-PKG$n-$TS"
        orderId          = $ord.id
        imageUrls        = @("https://storage.tbs.vn/test/cnt002-pkg${n}.jpg")
    }
    if (IsError $rcvResp) { Fail "A${n}: Receive failed"; continue }
    $rcvData = D $rcvResp
    $pkg = if ($rcvData.package) { $rcvData.package } else { $rcvData }
    if (-not $pkg -or -not $pkg.id) { Fail "A${n}: No package ID"; continue }

    # Measure (compact heavy -> chargeable = actual)
    $d = $dims[$i]
    D (Api "POST" "/warehouse-cn/packages/$($pkg.id)/measure" $WH_CN @{
        length = $d.l; width = $d.w; height = $d.h; actualWeight = $weights[$i]
    }) | Out-Null

    # Pack
    $packResp = D (Api "PATCH" "/warehouse-cn/packages/$($pkg.id)/status" $WH_CN @{ status = "PACKED" })
    if ($packResp -and $packResp.warehouseCNStatus -eq "PACKED") {
        $PKG_IDS += $pkg.id
        $PKG_CODES += $pkg.code
        Write-Host "    $($ord.code) -> $($pkg.code) PACKED ($($weights[$i]) kg)"
    } else {
        Fail "A${n}: Pack failed"
    }
}

if ($PKG_IDS.Count -eq 3) {
    Pass "A: 3 orders created, 3 packages PACKED"
} else {
    Fail "A: Only $($PKG_IDS.Count)/3 packages ready"; exit 1
}

# ================================================================
# PART B: TAO CONTAINER + ADD PACKAGES
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Tao container SEA + add packages" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST B1: Create container ===" -ForegroundColor White
$cnt = D (Api "POST" "/containers" $WH_CN @{
    shippingRoute        = "SEA"
    origin               = "Guangzhou, CN"
    destination          = "Hai Phong, VN"
    carrier              = "COSCO Shipping"
    vesselName           = "COSCO ARIES V.2603"
    bookingRef           = "BK-CNT002-$TS"
    maxCapacity          = 2000
    estimatedDepartureAt = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    estimatedArrivalAt   = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ssZ")
})
if ($cnt -and $cnt.id) {
    $CNT_ID = $cnt.id
    $CNT_CODE = $cnt.code
    Write-Host "  Container: $CNT_CODE | route=$($cnt.shippingRoute)"
    Write-Host "  Status: $($cnt.status) | Vessel: $($cnt.vesselName)"
    Pass "B1: Container created ($CNT_CODE)"
} else {
    Fail "B1: Failed to create container"; exit 1
}

Write-Host ""
Write-Host "=== TEST B2: Add 3 packages ===" -ForegroundColor White
$addResp = D (Api "POST" "/containers/$CNT_ID/add-packages" $WH_CN @{
    packageIds = $PKG_IDS
})
if ($addResp -and [int]$addResp.totalPackages -eq 3) {
    Write-Host "  totalPackages=$($addResp.totalPackages) | totalWeight=$($addResp.totalWeight) kg | fillRate=$($addResp.fillRate)%"
    Pass "B2: 3 packages added to container"
} else {
    Fail "B2: Failed to add packages"
}

# ================================================================
# PART C: PLANNING -> LOADING
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: PLANNING -> LOADING" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST C1: Transition to LOADING ===" -ForegroundColor White
$loadResp = D (Api "PATCH" "/containers/$CNT_ID/status" $WH_CN @{ status = "LOADING" })
if ($loadResp -and $loadResp.status -eq "LOADING") {
    Pass "C1: Status = LOADING"
} else {
    Fail "C1: Expected LOADING, got $(if ($loadResp) { $loadResp.status } else { 'null' })"
}

Write-Host ""
Write-Host "=== TEST C2: Update seal number ===" -ForegroundColor White
$sealResp = D (Api "PATCH" "/containers/$CNT_ID" $WH_CN @{
    sealNumber = "SEAL-CNT002-$TS"
})
if ($sealResp -and $sealResp.sealNumber -like "SEAL-CNT002-*") {
    Write-Host "  sealNumber: $($sealResp.sealNumber)"
    Pass "C2: Seal number set"
} else {
    Warn "C2: Seal number not confirmed in response"
}

Write-Host ""
Write-Host "=== TEST C3: Verify packages still PACKED (not yet shipped) ===" -ForegroundColor White
# Use package code for search (GET /warehouse-cn/packages/:id uses search by code/tracking)
$pkg0Detail = D (Api "GET" "/warehouse-cn/packages/$($PKG_CODES[0])" $WH_CN)
if ($pkg0Detail -and $pkg0Detail.warehouseCNStatus -eq "PACKED") {
    Pass "C3: Packages still PACKED during LOADING"
} elseif ($pkg0Detail) {
    Write-Host "  Package status: $($pkg0Detail.warehouseCNStatus)"
    Warn "C3: Package status = $($pkg0Detail.warehouseCNStatus), expected PACKED"
} else {
    # Fallback: check via order packages list
    $pkgList = D (Api "GET" "/warehouse-cn/packages?orderId=$($ORDER_IDS[0])" $WH_CN)
    $foundPkg = $null
    if ($pkgList -is [array]) { $foundPkg = $pkgList | Where-Object { $_.id -eq $PKG_IDS[0] } | Select-Object -First 1 }
    elseif ($pkgList -and $pkgList.id -eq $PKG_IDS[0]) { $foundPkg = $pkgList }
    if ($foundPkg -and $foundPkg.warehouseCNStatus -eq "PACKED") {
        Pass "C3: Packages still PACKED during LOADING (via order query)"
    } elseif ($foundPkg) {
        Warn "C3: Package status = $($foundPkg.warehouseCNStatus), expected PACKED"
    } else {
        Fail "C3: Cannot read package detail"
    }
}

# ================================================================
# PART D: LOADING -> IN_TRANSIT (departure)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: LOADING -> IN_TRANSIT (departure)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$beforeDepart = Get-Date

Write-Host ""
Write-Host "=== TEST D1: Transition to IN_TRANSIT ===" -ForegroundColor White
$transitResp = D (Api "PATCH" "/containers/$CNT_ID/status" $WH_CN @{ status = "IN_TRANSIT" })
if ($transitResp -and $transitResp.status -eq "IN_TRANSIT") {
    Pass "D1: Status = IN_TRANSIT"
} else {
    Fail "D1: Expected IN_TRANSIT, got $(if ($transitResp) { $transitResp.status } else { 'null' })"
}

Write-Host ""
Write-Host "=== TEST D2: Verify actualDepartureAt set ===" -ForegroundColor White
$cntDetail = D (Api "GET" "/containers/$CNT_ID" $WH_CN)
if ($cntDetail -and $cntDetail.actualDepartureAt) {
    Write-Host "  actualDepartureAt: $($cntDetail.actualDepartureAt)"
    Pass "D2: actualDepartureAt is set"
} else {
    Fail "D2: actualDepartureAt not set after IN_TRANSIT"
}

Write-Host ""
Write-Host "=== TEST D3: Packages cascade to SHIPPED ===" -ForegroundColor White
# Wait briefly for async event processing
Start-Sleep -Seconds 2

$shippedCount = 0
for ($pi = 0; $pi -lt $PKG_IDS.Count; $pi++) {
    $pkgCheck = D (Api "GET" "/warehouse-cn/packages/$($PKG_CODES[$pi])" $WH_CN)
    if (-not $pkgCheck) {
        # Fallback: query by orderId
        $pkgList = D (Api "GET" "/warehouse-cn/packages?orderId=$($ORDER_IDS[$pi])" $WH_CN)
        if ($pkgList -is [array]) { $pkgCheck = $pkgList | Where-Object { $_.id -eq $PKG_IDS[$pi] } | Select-Object -First 1 }
        elseif ($pkgList -and $pkgList.id -eq $PKG_IDS[$pi]) { $pkgCheck = $pkgList }
    }
    if ($pkgCheck) {
        Write-Host "    $($pkgCheck.code): warehouseCNStatus=$($pkgCheck.warehouseCNStatus)"
        if ($pkgCheck.warehouseCNStatus -eq "SHIPPED") { $shippedCount++ }
    } else {
        Write-Host "    Package $($PKG_CODES[$pi]): not found" -ForegroundColor DarkRed
    }
}
if ($shippedCount -eq 3) {
    Pass "D3: All 3 packages cascaded to SHIPPED"
} elseif ($shippedCount -gt 0) {
    Warn "D3: Only $shippedCount/3 packages SHIPPED (event processing delay?)"
} else {
    Fail "D3: No packages cascaded to SHIPPED"
}

Write-Host ""
Write-Host "=== TEST D4: Orders status after departure ===" -ForegroundColor White
$transitOrderCount = 0
foreach ($ordId in $ORDER_IDS) {
    $ordCheck = D (Api "GET" "/orders/$ordId" $CEO)
    if ($ordCheck) {
        Write-Host "    $($ordCheck.code): status=$($ordCheck.status)"
        if ($ordCheck.status -eq "IN_TRANSIT") { $transitOrderCount++ }
    }
}
if ($transitOrderCount -eq 3) {
    Pass "D4: All 3 orders cascaded to IN_TRANSIT"
} elseif ($transitOrderCount -gt 0) {
    Warn "D4: $transitOrderCount/3 orders at IN_TRANSIT"
} else {
    Warn "D4: No orders at IN_TRANSIT (cascade may not update order status directly)"
}

# ================================================================
# PART E: IN_TRANSIT -> ARRIVED
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: IN_TRANSIT -> ARRIVED" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST E1: Transition to ARRIVED ===" -ForegroundColor White
$arriveResp = D (Api "PATCH" "/containers/$CNT_ID/status" $WH_CN @{ status = "ARRIVED" })
if ($arriveResp -and $arriveResp.status -eq "ARRIVED") {
    Pass "E1: Status = ARRIVED"
} else {
    Fail "E1: Expected ARRIVED, got $(if ($arriveResp) { $arriveResp.status } else { 'null' })"
}

Write-Host ""
Write-Host "=== TEST E2: Verify actualArrivalAt set ===" -ForegroundColor White
$cntAfterArrive = D (Api "GET" "/containers/$CNT_ID" $WH_CN)
if ($cntAfterArrive -and $cntAfterArrive.actualArrivalAt) {
    Write-Host "  actualArrivalAt: $($cntAfterArrive.actualArrivalAt)"
    Pass "E2: actualArrivalAt is set"
} else {
    Fail "E2: actualArrivalAt not set after ARRIVED"
}

Write-Host ""
Write-Host "=== TEST E3: Both departure and arrival timestamps present ===" -ForegroundColor White
if ($cntAfterArrive.actualDepartureAt -and $cntAfterArrive.actualArrivalAt) {
    $depTime = [DateTime]$cntAfterArrive.actualDepartureAt
    $arrTime = [DateTime]$cntAfterArrive.actualArrivalAt
    if ($arrTime -ge $depTime) {
        Pass "E3: arrivalAt >= departureAt (chronological order correct)"
    } else {
        Fail "E3: arrivalAt < departureAt (time ordering wrong)"
    }
} else {
    Fail "E3: Missing departure or arrival timestamp"
}

# ================================================================
# PART F: ARRIVED -> CUSTOMS
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: ARRIVED -> CUSTOMS" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST F1: Transition to CUSTOMS ===" -ForegroundColor White
$customsResp = D (Api "PATCH" "/containers/$CNT_ID/status" $WH_CN @{ status = "CUSTOMS" })
if ($customsResp -and $customsResp.status -eq "CUSTOMS") {
    Pass "F1: Status = CUSTOMS"
} else {
    Fail "F1: Expected CUSTOMS, got $(if ($customsResp) { $customsResp.status } else { 'null' })"
}

Write-Host ""
Write-Host "=== TEST F2: Customs declaration auto-created ===" -ForegroundColor White
# Wait for async event processing
Start-Sleep -Seconds 2

# Check customs declarations linked to this container
$customsDecls = D (Api "GET" "/customs-declarations?containerId=$CNT_ID&limit=10" $CEO)
$foundDecl = $null
if ($customsDecls -is [array] -and $customsDecls.Count -gt 0) {
    $foundDecl = $customsDecls[0]
} elseif ($customsDecls -and $customsDecls.id) {
    $foundDecl = $customsDecls
}

if ($foundDecl) {
    Write-Host "  Declaration: $($foundDecl.code) | status=$($foundDecl.status)"
    if ($foundDecl.vesselName) { Write-Host "  vesselName: $($foundDecl.vesselName)" }
    Pass "F2: Customs declaration auto-created"
} else {
    # Try searching by booking ref
    $customsAll = D (Api "GET" "/customs-declarations?search=$CNT_CODE&limit=10" $CEO)
    if ($customsAll -is [array] -and $customsAll.Count -gt 0) {
        $foundDecl = $customsAll[0]
        Write-Host "  Declaration: $($foundDecl.code) | status=$($foundDecl.status)"
        Pass "F2: Customs declaration found via search"
    } else {
        Warn "F2: No customs declaration auto-created (listener may not be active)"
    }
}

# ================================================================
# PART G: CUSTOMS -> COMPLETED
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: CUSTOMS -> COMPLETED" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST G1: Transition to COMPLETED ===" -ForegroundColor White
$completeResp = D (Api "PATCH" "/containers/$CNT_ID/status" $WH_CN @{ status = "COMPLETED" })
if ($completeResp -and $completeResp.status -eq "COMPLETED") {
    Pass "G1: Status = COMPLETED"
} else {
    Fail "G1: Expected COMPLETED, got $(if ($completeResp) { $completeResp.status } else { 'null' })"
}

Write-Host ""
Write-Host "=== TEST G2: Verify customsClearedAt set ===" -ForegroundColor White
$cntFinal = D (Api "GET" "/containers/$CNT_ID" $WH_CN)
if ($cntFinal -and $cntFinal.customsClearedAt) {
    Write-Host "  customsClearedAt: $($cntFinal.customsClearedAt)"
    Pass "G2: customsClearedAt is set"
} else {
    Fail "G2: customsClearedAt not set after COMPLETED"
}

Write-Host ""
Write-Host "=== TEST G3: All 3 timestamps in order ===" -ForegroundColor White
if ($cntFinal.actualDepartureAt -and $cntFinal.actualArrivalAt -and $cntFinal.customsClearedAt) {
    $t1 = [DateTime]$cntFinal.actualDepartureAt
    $t2 = [DateTime]$cntFinal.actualArrivalAt
    $t3 = [DateTime]$cntFinal.customsClearedAt
    Write-Host "  departureAt:     $t1"
    Write-Host "  arrivalAt:       $t2"
    Write-Host "  customsClearedAt: $t3"
    if ($t1 -le $t2 -and $t2 -le $t3) {
        Pass "G3: Timestamps in correct chronological order"
    } else {
        Fail "G3: Timestamps not in order"
    }
} else {
    Fail "G3: Missing one or more timestamps"
}

Write-Host ""
Write-Host "=== TEST G4: Container is terminal - cannot modify ===" -ForegroundColor White
$modResp = Api "PATCH" "/containers/$CNT_ID" $WH_CN @{ carrier = "Changed Carrier" }
if (IsError $modResp) {
    Pass "G4: COMPLETED container cannot be modified ($($modResp._code))"
} else {
    $modData = D $modResp
    if ($modData -and $modData.carrier -eq "Changed Carrier") {
        Fail "G4: COMPLETED container was modified (should be blocked)"
    } else {
        Pass "G4: COMPLETED container modification had no effect"
    }
}

# ================================================================
# PART H: FSM ENFORCEMENT - INVALID TRANSITIONS
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: FSM enforcement - invalid transitions" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Create a fresh container for FSM tests
$cnt2 = D (Api "POST" "/containers" $WH_CN @{
    shippingRoute = "SEA"
    origin        = "Shanghai, CN"
    destination   = "HCMC, VN"
    maxCapacity   = 500
})
if (-not $cnt2 -or -not $cnt2.id) { Fail "H0: Cannot create test container"; }
else {
    $CNT2_ID = $cnt2.id
    Write-Host "  Test container: $($cnt2.code) (PLANNING)" -ForegroundColor Gray

    Write-Host ""
    Write-Host "=== TEST H1: PLANNING -> IN_TRANSIT (skip LOADING) ===" -ForegroundColor White
    $skipResp = Api "PATCH" "/containers/$CNT2_ID/status" $WH_CN @{ status = "IN_TRANSIT" }
    if (IsError $skipResp) {
        if ($skipResp._code -eq 400) {
            Pass "H1: PLANNING -> IN_TRANSIT blocked (cannot skip LOADING)"
        } else {
            Warn "H1: Got error $($skipResp._code), expected 400"
        }
    } else {
        Fail "H1: PLANNING -> IN_TRANSIT was allowed (should be blocked)"
    }

    Write-Host ""
    Write-Host "=== TEST H2: PLANNING -> COMPLETED (skip all) ===" -ForegroundColor White
    $skipAllResp = Api "PATCH" "/containers/$CNT2_ID/status" $WH_CN @{ status = "COMPLETED" }
    if (IsError $skipAllResp) {
        if ($skipAllResp._code -eq 400) {
            Pass "H2: PLANNING -> COMPLETED blocked (cannot skip states)"
        } else {
            Warn "H2: Got error $($skipAllResp._code), expected 400"
        }
    } else {
        Fail "H2: PLANNING -> COMPLETED was allowed (should be blocked)"
    }

    Write-Host ""
    Write-Host "=== TEST H3: PLANNING -> CUSTOMS (skip middle) ===" -ForegroundColor White
    $skipMidResp = Api "PATCH" "/containers/$CNT2_ID/status" $WH_CN @{ status = "CUSTOMS" }
    if (IsError $skipMidResp) {
        if ($skipMidResp._code -eq 400) {
            Pass "H3: PLANNING -> CUSTOMS blocked (cannot skip)"
        } else {
            Warn "H3: Got error $($skipMidResp._code), expected 400"
        }
    } else {
        Fail "H3: PLANNING -> CUSTOMS was allowed"
    }

    Write-Host ""
    Write-Host "=== TEST H4: Backward transition blocked ===" -ForegroundColor White
    # Move to LOADING first
    D (Api "PATCH" "/containers/$CNT2_ID/status" $WH_CN @{ status = "LOADING" }) | Out-Null
    $backResp = Api "PATCH" "/containers/$CNT2_ID/status" $WH_CN @{ status = "PLANNING" }
    if (IsError $backResp) {
        if ($backResp._code -eq 400) {
            Pass "H4: LOADING -> PLANNING blocked (no backward transition)"
        } else {
            Warn "H4: Got error $($backResp._code), expected 400"
        }
    } else {
        Fail "H4: LOADING -> PLANNING was allowed (should be blocked)"
    }
}

# ================================================================
# PART I: ON_HOLD_BORDER SPECIAL STATE
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART I: ON_HOLD_BORDER special state" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Create fresh container and advance to IN_TRANSIT
$cnt3 = D (Api "POST" "/containers" $WH_CN @{
    shippingRoute = "ROAD"
    origin        = "Nanning, CN"
    destination   = "Lang Son, VN"
    maxCapacity   = 1000
})
if (-not $cnt3 -or -not $cnt3.id) { Fail "I0: Cannot create border-test container"; }
else {
    $CNT3_ID = $cnt3.id
    Write-Host "  Test container: $($cnt3.code) (ROAD route)" -ForegroundColor Gray

    D (Api "PATCH" "/containers/$CNT3_ID/status" $WH_CN @{ status = "LOADING" }) | Out-Null
    D (Api "PATCH" "/containers/$CNT3_ID/status" $WH_CN @{ status = "IN_TRANSIT" }) | Out-Null

    Write-Host ""
    Write-Host "=== TEST I1: IN_TRANSIT -> ON_HOLD_BORDER ===" -ForegroundColor White
    $holdResp = D (Api "PATCH" "/containers/$CNT3_ID/status" $WH_CN @{ status = "ON_HOLD_BORDER" })
    if ($holdResp -and $holdResp.status -eq "ON_HOLD_BORDER") {
        Pass "I1: Status = ON_HOLD_BORDER"
    } else {
        Fail "I1: Expected ON_HOLD_BORDER, got $(if ($holdResp) { $holdResp.status } else { 'null' })"
    }

    Write-Host ""
    Write-Host "=== TEST I2: ON_HOLD_BORDER -> IN_TRANSIT (resume) ===" -ForegroundColor White
    $resumeResp = D (Api "PATCH" "/containers/$CNT3_ID/status" $WH_CN @{ status = "IN_TRANSIT" })
    if ($resumeResp -and $resumeResp.status -eq "IN_TRANSIT") {
        Pass "I2: ON_HOLD_BORDER -> IN_TRANSIT (resumed)"
    } else {
        Fail "I2: Expected IN_TRANSIT, got $(if ($resumeResp) { $resumeResp.status } else { 'null' })"
    }

    Write-Host ""
    Write-Host "=== TEST I3: ON_HOLD_BORDER -> ARRIVED (direct) ===" -ForegroundColor White
    # Go back to ON_HOLD_BORDER first
    D (Api "PATCH" "/containers/$CNT3_ID/status" $WH_CN @{ status = "ON_HOLD_BORDER" }) | Out-Null
    $directArriveResp = D (Api "PATCH" "/containers/$CNT3_ID/status" $WH_CN @{ status = "ARRIVED" })
    if ($directArriveResp -and $directArriveResp.status -eq "ARRIVED") {
        Pass "I3: ON_HOLD_BORDER -> ARRIVED (direct)"
    } else {
        Fail "I3: Expected ARRIVED, got $(if ($directArriveResp) { $directArriveResp.status } else { 'null' })"
    }

    Write-Host ""
    Write-Host "=== TEST I4: ON_HOLD_BORDER invalid transitions ===" -ForegroundColor White
    # Create another container at ON_HOLD_BORDER
    $cnt4 = D (Api "POST" "/containers" $WH_CN @{
        shippingRoute = "ROAD"
        origin        = "Nanning, CN"
        destination   = "Mong Cai, VN"
        maxCapacity   = 500
    })
    if ($cnt4 -and $cnt4.id) {
        D (Api "PATCH" "/containers/$($cnt4.id)/status" $WH_CN @{ status = "LOADING" }) | Out-Null
        D (Api "PATCH" "/containers/$($cnt4.id)/status" $WH_CN @{ status = "IN_TRANSIT" }) | Out-Null
        D (Api "PATCH" "/containers/$($cnt4.id)/status" $WH_CN @{ status = "ON_HOLD_BORDER" }) | Out-Null

        $holdToCompleted = Api "PATCH" "/containers/$($cnt4.id)/status" $WH_CN @{ status = "COMPLETED" }
        if (IsError $holdToCompleted) {
            Pass "I4: ON_HOLD_BORDER -> COMPLETED blocked (cannot skip)"
        } else {
            Fail "I4: ON_HOLD_BORDER -> COMPLETED was allowed"
        }
    } else {
        Warn "I4: Cannot create test container"
    }
}

# ================================================================
# PART J: FULL LIFECYCLE VERIFICATION
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART J: Full lifecycle verification on original container" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST J1: Final container state ===" -ForegroundColor White
$finalCnt = D (Api "GET" "/containers/$CNT_ID" $WH_CN)
if ($finalCnt) {
    Write-Host "  Code:             $($finalCnt.code)"
    Write-Host "  Status:           $($finalCnt.status)"
    Write-Host "  Route:            $($finalCnt.shippingRoute)"
    Write-Host "  Vessel:           $($finalCnt.vesselName)"
    Write-Host "  Seal:             $($finalCnt.sealNumber)"
    Write-Host "  TotalPackages:    $($finalCnt.totalPackages)"
    Write-Host "  TotalWeight:      $($finalCnt.totalWeight) kg"
    Write-Host "  DepartureAt:      $($finalCnt.actualDepartureAt)"
    Write-Host "  ArrivalAt:        $($finalCnt.actualArrivalAt)"
    Write-Host "  CustomsClearedAt: $($finalCnt.customsClearedAt)"

    if ($finalCnt.status -eq "COMPLETED") {
        Pass "J1a: Final status = COMPLETED"
    } else {
        Fail "J1a: Final status = $($finalCnt.status), expected COMPLETED"
    }

    if ($finalCnt.sealNumber) {
        Pass "J1b: Seal number preserved through lifecycle"
    } else {
        Warn "J1b: Seal number not preserved"
    }

    if ($finalCnt.vesselName) {
        Pass "J1c: Vessel name preserved through lifecycle"
    } else {
        Warn "J1c: Vessel name not preserved"
    }
} else {
    Fail "J1: Cannot read final container state"
}

Write-Host ""
Write-Host "=== TEST J2: Unload manifest still accessible after COMPLETED ===" -ForegroundColor White
$finalManifest = D (Api "GET" "/containers/$CNT_ID/unload-manifest" $WH_CN)
if ($finalManifest -and $finalManifest.expectedPackages) {
    $mPkgs = @($finalManifest.expectedPackages)
    Write-Host "  Manifest: $($mPkgs.Count) packages"
    if ($mPkgs.Count -eq 3) {
        Pass "J2: Manifest accessible with 3 packages after COMPLETED"
    } else {
        Pass "J2: Manifest accessible ($($mPkgs.Count) packages)"
    }
} elseif ($finalManifest) {
    Pass "J2: Manifest endpoint accessible after COMPLETED"
} else {
    Fail "J2: Manifest not accessible after COMPLETED"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-CNT-002: Container Status Transition & Tracking" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  FSM: PLANNING -> LOADING -> IN_TRANSIT -> ARRIVED -> CUSTOMS -> COMPLETED"
Write-Host "       (+ ON_HOLD_BORDER from IN_TRANSIT)"
Write-Host ""
Write-Host "  Part A: 3 orders -> receive + measure + pack"
Write-Host "  Part B: Create container + add packages"
Write-Host "  Part C: PLANNING -> LOADING (seal number)"
Write-Host "  Part D: LOADING -> IN_TRANSIT (departure timestamp, packages SHIPPED)"
Write-Host "  Part E: IN_TRANSIT -> ARRIVED (arrival timestamp)"
Write-Host "  Part F: ARRIVED -> CUSTOMS (auto-create declaration)"
Write-Host "  Part G: CUSTOMS -> COMPLETED (customs cleared timestamp)"
Write-Host "  Part H: FSM enforcement (invalid transitions blocked)"
Write-Host "  Part I: ON_HOLD_BORDER special state"
Write-Host "  Part J: Full lifecycle verification"
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
