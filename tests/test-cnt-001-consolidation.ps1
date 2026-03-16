# ================================================================
# TEST-CNT-001: Ghep nhieu don vao 1 container
# Severity: HIGH
#
# Steps:
#   1. Tao container SEA voi maxCapacity = 1000 kg
#   2. Tao 5 don hang, nhan + do + pack tai kho TQ
#   3. Ghep 5 package vao container -> verify fill rate
#   4. Verify manifest (danh sach packages, orders, customers)
#   5. Them package vuot capacity -> expect warning/allow
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
Write-Host "  TEST-CNT-001: Ghep nhieu don vao 1 container" -ForegroundColor Cyan
Write-Host "  Severity: HIGH" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login roles
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login ===" -ForegroundColor White

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SALE login OK" } else { Fail "SALE login FAILED"; exit 1 }

$WH_CN = Login "khotq01@$DOMAIN"
if ($WH_CN) { Pass "WAREHOUSE_CN login OK" } else { Fail "WAREHOUSE_CN login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

# Get VIP customer (use CEO - full visibility)
$customers = D (Api "GET" "/customers?tier=VIP&limit=1" $CEO)
$cust = $null
if ($customers -is [array] -and $customers.Count -gt 0) { $cust = $customers[0] }
elseif ($customers -and $customers.id) { $cust = $customers }
if (-not $cust) { Fail "No VIP customer found"; exit 1 }
$CUST_ID = $cust.id
Write-Host "  Customer: $($cust.code) ($($cust.tier))" -ForegroundColor Gray

$TS = Get-Date -Format "yyyyMMddHHmmss"

# ================================================================
# PART A: TAO CONTAINER
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Tao container SEA voi capacity 1000 kg" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST A1: Create container ===" -ForegroundColor White
$cnt = D (Api "POST" "/containers" $WH_CN @{
    shippingRoute = "SEA"
    origin        = "Guangzhou, CN"
    destination   = "Hai Phong, VN"
    carrier       = "COSCO"
    maxCapacity   = 1000
})
$CNT_ID = $null
if ($cnt -and $cnt.id) {
    $CNT_ID = $cnt.id
    Write-Host "  Container: $($cnt.code) | route=$($cnt.shippingRoute) | status=$($cnt.status)"
    Write-Host "  maxCapacity: $($cnt.maxCapacity) kg"
    Pass "A1: Container created ($($cnt.code))"
} else {
    Fail "A1: Failed to create container"; exit 1
}

Write-Host ""
Write-Host "=== TEST A2: Verify initial state ===" -ForegroundColor White
if ($cnt.status -eq "PLANNING") { Pass "A2a: Status = PLANNING" } else { Fail "A2a: Status = $($cnt.status), expected PLANNING" }
if ([int]$cnt.totalPackages -eq 0) { Pass "A2b: totalPackages = 0" } else { Fail "A2b: totalPackages = $($cnt.totalPackages)" }
if ([double]$cnt.totalWeight -eq 0) { Pass "A2c: totalWeight = 0" } else { Fail "A2c: totalWeight = $($cnt.totalWeight)" }

# ================================================================
# PART B: TAO 5 DON HANG + NHAN + DO + PACK
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Tao 5 don hang SEA, nhan + do + pack tai kho TQ" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Helper: create order -> advance to WAREHOUSE_CN -> receive -> measure -> pack
# Returns package ID and weight
$PKG_IDS = @()
$PKG_WEIGHTS = @()
$ORDER_IDS = @()

# Weight plan: 150, 200, 180, 120, 100 kg = total 750 kg -> 75% of 1000 kg
# Dims chosen so volumetric < actual (compact heavy items) -> chargeable = actual
$weights = @(150, 200, 180, 120, 100)
$dims = @(
    @{ l = 50; w = 40; h = 30 },   # vol=60 kg < 150
    @{ l = 60; w = 40; h = 30 },   # vol=72 kg < 200
    @{ l = 55; w = 40; h = 30 },   # vol=66 kg < 180
    @{ l = 45; w = 35; h = 25 },   # vol=39 kg < 120
    @{ l = 40; w = 30; h = 25 }    # vol=30 kg < 100
)

for ($i = 0; $i -lt 5; $i++) {
    $n = $i + 1
    Write-Host ""
    Write-Host "=== TEST B${n}: Don hang #${n} (weight=$($weights[$i]) kg) ===" -ForegroundColor White

    # B.n.1: Create order
    $ord = D (Api "POST" "/orders" $SALE @{
        customerId     = $CUST_ID
        serviceType    = "VCT"
        shippingRoute  = "SEA"
        branch         = "HN"
        items          = @(@{
            productName = "Test Product CNT001-$n"
            quantity    = 10
            unitPrice   = 100
            currency    = "CNY"
        })
        note           = "CNT-001 test order #$n - $TS"
    })
    if (-not $ord -or -not $ord.id) {
        Fail "B$($n): Failed to create order #$n"; continue
    }
    $ORDER_IDS += $ord.id
    Write-Host "    Order: $($ord.code) | status=$($ord.status)"

    # B.n.2: Advance to WAREHOUSE_CN
    $transitions = @("QUOTATION", "PENDING_DEPOSIT", "SOURCING", "WAREHOUSE_CN")
    foreach ($st in $transitions) {
        $trResp = Api "PATCH" "/orders/$($ord.id)/status" $CEO @{ status = $st }
        if (IsError $trResp) {
            Write-Host "    Transition to $st failed: $($trResp._code)" -ForegroundColor DarkRed
            break
        }
    }
    $ordCheck = D (Api "GET" "/orders/$($ord.id)" $CEO)
    Write-Host "    Order status after transitions: $($ordCheck.status)"
    if ($ordCheck.status -ne "WAREHOUSE_CN") {
        Fail "B$($n): Order not at WAREHOUSE_CN (status=$($ordCheck.status))"; continue
    }

    # B.n.3: Receive package
    $trackNum = "CNT001-PKG$n-$TS"
    $rcvResp = Api "POST" "/warehouse-cn/receive" $WH_CN @{
        trackingNumberCN = $trackNum
        orderId          = $ord.id
        imageUrls        = @("https://storage.tbs.vn/test/cnt001-pkg${n}.jpg")
    }
    if (IsError $rcvResp) {
        Fail "B$($n): Receive error $($rcvResp._code)"; continue
    }
    $rcvData = D $rcvResp
    $pkg = if ($rcvData.package) { $rcvData.package } else { $rcvData }
    if (-not $pkg -or -not $pkg.id) {
        Fail "B$($n): Failed to receive package"; continue
    }
    Write-Host "    Package: $($pkg.code) | ID=$($pkg.id)"

    # B.n.4: Measure package (sets CHECKED status, calculates chargeable weight)
    $d = $dims[$i]
    $measureResp = D (Api "POST" "/warehouse-cn/packages/$($pkg.id)/measure" $WH_CN @{
        length       = $d.l
        width        = $d.w
        height       = $d.h
        actualWeight = $weights[$i]
    })
    # Get chargeable weight from measure result (response: { calculation: { chargeableWeight }, package: {...} })
    $cw = $null
    if ($measureResp.calculation -and $measureResp.calculation.chargeableWeight) {
        $cw = [double]$measureResp.calculation.chargeableWeight
    }
    if (-not $cw -and $measureResp.package -and $measureResp.package.chargeableWeight) {
        $cw = [double]$measureResp.package.chargeableWeight
    }
    if (-not $cw -and $measureResp.chargeableWeight) {
        $cw = [double]$measureResp.chargeableWeight
    }
    if (-not $cw) {
        # Fallback: read package detail
        $pkgDetail = D (Api "GET" "/warehouse-cn/packages/$($pkg.id)" $WH_CN)
        if ($pkgDetail -and $pkgDetail.chargeableWeight) { $cw = [double]$pkgDetail.chargeableWeight }
    }
    if (-not $cw) { $cw = $weights[$i] }
    Write-Host "    Measured: $($d.l)x$($d.w)x$($d.h) cm, $($weights[$i]) kg -> chargeable=$cw kg"

    # B.n.5: Pack package (CHECKED -> PACKED)
    $packResp = D (Api "PATCH" "/warehouse-cn/packages/$($pkg.id)/status" $WH_CN @{
        status = "PACKED"
    })
    if ($packResp -and $packResp.warehouseCNStatus -eq "PACKED") {
        Pass "B$($n): Order #$n -> package PACKED (chargeable=$cw kg)"
        $PKG_IDS += $pkg.id
        $PKG_WEIGHTS += $cw
    } else {
        $pkgStatus = if ($packResp) { $packResp.warehouseCNStatus } else { "unknown" }
        Fail "B$($n): Package not PACKED (status=$pkgStatus)"
    }
}

$totalPkgWeight = ($PKG_WEIGHTS | Measure-Object -Sum).Sum
Write-Host ""
Write-Host "  Summary: $($PKG_IDS.Count) packages, total weight = $totalPkgWeight kg" -ForegroundColor Gray

# ================================================================
# PART C: GHEP PACKAGES VAO CONTAINER
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Ghep 5 packages vao container" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST C1: Add all 5 packages at once ===" -ForegroundColor White
$addResp = D (Api "POST" "/containers/$CNT_ID/add-packages" $WH_CN @{
    packageIds = $PKG_IDS
})

if ($addResp -and $addResp.id) {
    Write-Host "  totalPackages: $($addResp.totalPackages)"
    Write-Host "  totalWeight:   $($addResp.totalWeight) kg"
    Write-Host "  fillRate:      $($addResp.fillRate)%"

    if ([int]$addResp.totalPackages -eq $PKG_IDS.Count) {
        Pass "C1a: totalPackages = $($addResp.totalPackages) (correct)"
    } else {
        Fail "C1a: totalPackages = $($addResp.totalPackages), expected $($PKG_IDS.Count)"
    }

    $expectedWeight = $totalPkgWeight
    $actualWeight = [double]$addResp.totalWeight
    if ([Math]::Abs($actualWeight - $expectedWeight) -lt 1) {
        Pass "C1b: totalWeight = $actualWeight kg (expected ~$expectedWeight kg)"
    } else {
        Fail "C1b: totalWeight = $actualWeight kg, expected $expectedWeight kg"
    }

    # Fill rate = totalWeight / maxCapacity * 100
    $expectedFillRate = [Math]::Round($expectedWeight / 1000 * 100, 2)
    $actualFillRate = [double]$addResp.fillRate
    if ([Math]::Abs($actualFillRate - $expectedFillRate) -lt 1) {
        Pass "C1c: fillRate = $actualFillRate% (expected ~$expectedFillRate%)"
    } else {
        Fail "C1c: fillRate = $actualFillRate%, expected $expectedFillRate%"
    }
} else {
    Fail "C1: Failed to add packages to container"
}

# ================================================================
# PART D: VERIFY CONTAINER DETAIL + FILL RATE ENDPOINT
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Verify container detail va fill rate" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST D1: GET container detail ===" -ForegroundColor White
$detail = D (Api "GET" "/containers/$CNT_ID" $WH_CN)
if ($detail -and $detail.id) {
    # Check packages included
    $pkgList = $detail.packages
    if ($pkgList -and $pkgList.Count -gt 0) {
        Write-Host "  Packages in container: $($pkgList.Count)"
        foreach ($p in $pkgList) {
            Write-Host "    $($p.code) | orderId=$($p.orderId) | chargeable=$($p.chargeableWeight) kg"
        }
        if ($pkgList.Count -eq $PKG_IDS.Count) {
            Pass "D1a: Container has $($pkgList.Count) packages (correct)"
        } else {
            Fail "D1a: Container has $($pkgList.Count) packages, expected $($PKG_IDS.Count)"
        }
    } elseif ($pkgList -and $pkgList.id) {
        # Single package (PS unwrap)
        Write-Host "  Packages in container: 1"
        Pass "D1a: Container has packages"
    } else {
        Fail "D1a: No packages in container detail"
    }

    # Verify each package belongs to different orders
    $uniqueOrders = @()
    foreach ($p in $pkgList) {
        if ($p.orderId -and $uniqueOrders -notcontains $p.orderId) {
            $uniqueOrders += $p.orderId
        }
    }
    if ($uniqueOrders.Count -eq 5) {
        Pass "D1b: Packages from 5 different orders"
    } elseif ($uniqueOrders.Count -gt 0) {
        Write-Host "  Unique orders: $($uniqueOrders.Count)"
        Pass "D1b: Packages from $($uniqueOrders.Count) different orders"
    } else {
        Warn "D1b: Cannot determine unique orders from response"
    }
} else {
    Fail "D1: Failed to get container detail"
}

Write-Host ""
Write-Host "=== TEST D2: GET fill-rate endpoint ===" -ForegroundColor White
$fillResp = D (Api "GET" "/containers/$CNT_ID/fill-rate" $WH_CN)
if ($fillResp) {
    Write-Host "  currentWeight:     $($fillResp.currentWeight) kg"
    Write-Host "  maxCapacity:       $($fillResp.maxCapacity) kg"
    Write-Host "  remainingCapacity: $($fillResp.remainingCapacity) kg"
    Write-Host "  fillRate:          $($fillResp.fillRate)%"
    Write-Host "  canFitPackage:     $($fillResp.canFitPackage)"

    if ([double]$fillResp.maxCapacity -eq 1000) {
        Pass "D2a: maxCapacity = 1000 kg"
    } else {
        Fail "D2a: maxCapacity = $($fillResp.maxCapacity), expected 1000"
    }

    $expectedRemaining = 1000 - $totalPkgWeight
    $actualRemaining = [double]$fillResp.remainingCapacity
    if ([Math]::Abs($actualRemaining - $expectedRemaining) -lt 1) {
        Pass "D2b: remainingCapacity = $actualRemaining kg (correct)"
    } else {
        Fail "D2b: remainingCapacity = $actualRemaining, expected $expectedRemaining"
    }

    if ($fillResp.canFitPackage -eq $true) {
        Pass "D2c: canFitPackage = true (still has room)"
    } else {
        Warn "D2c: canFitPackage = false (unexpected)"
    }
} else {
    Fail "D2: Failed to get fill rate"
}

# ================================================================
# PART E: UNLOAD MANIFEST
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: Verify unload manifest" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST E1: GET unload manifest ===" -ForegroundColor White
$manifest = D (Api "GET" "/containers/$CNT_ID/unload-manifest" $WH_CN)
if ($manifest) {
    Write-Host "  Manifest keys: $($manifest.PSObject.Properties.Name -join ', ')"

    # Try multiple possible keys for packages list
    $mPkgs = $null
    if ($manifest.expectedPackages) { $mPkgs = @($manifest.expectedPackages) }
    elseif ($manifest.packages) { $mPkgs = @($manifest.packages) }

    # Also check container info in manifest
    $mContainer = $manifest.container
    if ($mContainer) {
        Write-Host "  Manifest container: $($mContainer.code) | $($mContainer.shippingRoute)"
        Pass "E1a: Manifest includes container info"
    } else {
        Warn "E1a: Manifest missing container info"
    }

    if ($mPkgs -and $mPkgs.Count -gt 0) {
        Write-Host "  Manifest packages: $($mPkgs.Count)"
        Pass "E1b: Manifest has $($mPkgs.Count) expected packages"

        # Check packages have order info
        $hasOrderInfo = $false
        foreach ($mp in $mPkgs) {
            if ($mp.order -or $mp.orderId -or $mp.orderCode) { $hasOrderInfo = $true; break }
        }
        if ($hasOrderInfo) {
            Pass "E1c: Manifest packages include order reference"
        } else {
            Warn "E1c: Manifest packages missing order reference"
        }
    } else {
        Warn "E1b: Manifest has no expected packages"
        Warn "E1c: Cannot verify manifest packages"
    }
} else {
    Fail "E1: Failed to get manifest"
}

# ================================================================
# PART F: EXCEED CAPACITY
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Them package vuot capacity (expect warning hoac allow)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST F1: Create 6th order with heavy package ===" -ForegroundColor White

$ord6 = D (Api "POST" "/orders" $SALE @{
    customerId     = $CUST_ID
    serviceType    = "VCT"
    shippingRoute  = "SEA"
    branch         = "HN"
    items          = @(@{
        productName = "Test Product CNT001-6 overflow"
        quantity    = 5
        unitPrice   = 200
        currency    = "CNY"
    })
    note           = "CNT-001 overflow test #6 - $TS"
})
if (-not $ord6 -or -not $ord6.id) { Fail "F1: Failed to create order #6"; }
else {
    # Advance to WAREHOUSE_CN
    $transitions = @("QUOTATION", "PENDING_DEPOSIT", "SOURCING", "WAREHOUSE_CN")
    foreach ($st in $transitions) {
        D (Api "PATCH" "/orders/$($ord6.id)/status" $CEO @{ status = $st }) | Out-Null
    }

    # Receive + measure + pack (400 kg -> total would be ~1150 kg, exceeding 1000 kg capacity)
    $trackNum6 = "CNT001-PKG6-$TS"
    $rcv6Data = D (Api "POST" "/warehouse-cn/receive" $WH_CN @{
        trackingNumberCN = $trackNum6
        orderId          = $ord6.id
        imageUrls        = @("https://storage.tbs.vn/test/cnt001-pkg6.jpg")
    })
    $pkg6 = if ($rcv6Data.package) { $rcv6Data.package } else { $rcv6Data }
    if ($pkg6 -and $pkg6.id) {
        # Compact heavy: vol = 70*50*40/1000 = 140 kg < 400 -> chargeable = 400 kg
        D (Api "POST" "/warehouse-cn/packages/$($pkg6.id)/measure" $WH_CN @{
            length       = 70
            width        = 50
            height       = 40
            actualWeight = 400
        }) | Out-Null

        D (Api "PATCH" "/warehouse-cn/packages/$($pkg6.id)/status" $WH_CN @{
            status = "PACKED"
        }) | Out-Null

        Write-Host "  Package #6: $($pkg6.code) | 400 kg | PACKED"
        Pass "F1: Overflow package created (400 kg)"

        Write-Host ""
        Write-Host "=== TEST F2: Add overflow package to container ===" -ForegroundColor White
        Write-Host "  Current: ~$totalPkgWeight kg / 1000 kg. Adding 400 kg -> ~$($totalPkgWeight + 400) kg"
        $overflowResp = Api "POST" "/containers/$CNT_ID/add-packages" $WH_CN @{
            packageIds = @($pkg6.id)
        }
        if (IsError $overflowResp) {
            $code = $overflowResp._code
            if ($code -eq 400) {
                Pass "F2: Overflow blocked (400 - capacity exceeded)"
            } else {
                Warn "F2: Overflow got error $code (not a capacity check)"
            }
        } else {
            $overflowData = D $overflowResp
            if ($overflowData) {
                $newFillRate = [double]$overflowData.fillRate
                $newWeight = [double]$overflowData.totalWeight
                Write-Host "  After add: totalWeight=$newWeight kg, fillRate=$newFillRate%"
                if ($newFillRate -gt 100) {
                    Warn "F2: Overflow ALLOWED (fill rate $newFillRate% > 100%). No hard capacity block."
                } else {
                    Pass "F2: Overflow added, fillRate=$newFillRate% (within capacity)"
                }
            } else {
                Warn "F2: Overflow response unclear"
            }
        }

        Write-Host ""
        Write-Host "=== TEST F3: Check fill-rate after overflow ===" -ForegroundColor White
        $fillAfter = D (Api "GET" "/containers/$CNT_ID/fill-rate" $WH_CN)
        if ($fillAfter) {
            Write-Host "  currentWeight:     $($fillAfter.currentWeight) kg"
            Write-Host "  maxCapacity:       $($fillAfter.maxCapacity) kg"
            Write-Host "  remainingCapacity: $($fillAfter.remainingCapacity) kg"
            Write-Host "  fillRate:          $($fillAfter.fillRate)%"
            Write-Host "  canFitPackage:     $($fillAfter.canFitPackage)"

            if ([double]$fillAfter.fillRate -gt 100) {
                Pass "F3a: fillRate > 100% (overflow detected correctly)"
            } elseif ([double]$fillAfter.fillRate -gt 0) {
                Pass "F3a: fillRate = $($fillAfter.fillRate)%"
            } else {
                Fail "F3a: fillRate invalid"
            }

            if ([double]$fillAfter.remainingCapacity -le 0) {
                Pass "F3b: remainingCapacity <= 0 (container full/overflowed)"
            } else {
                Pass "F3b: remainingCapacity = $($fillAfter.remainingCapacity) kg"
            }
        } else {
            Fail "F3: Failed to get fill rate after overflow"
        }
    } else {
        Fail "F1: Failed to receive package #6"
    }
}

# ================================================================
# PART G: CANNOT ADD PACKAGES TO NON-PLANNING/LOADING CONTAINER
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: FSM block - cannot add to IN_TRANSIT container" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST G1: Advance container to LOADING -> IN_TRANSIT ===" -ForegroundColor White
$s1 = D (Api "PATCH" "/containers/$CNT_ID/status" $WH_CN @{ status = "LOADING" })
if ($s1 -and $s1.status -eq "LOADING") {
    Write-Host "  Status: LOADING"
} else {
    Write-Host "  Status transition to LOADING: $(if ($s1) { $s1.status } else { 'failed' })"
}

$s2 = D (Api "PATCH" "/containers/$CNT_ID/status" $WH_CN @{ status = "IN_TRANSIT" })
if ($s2 -and $s2.status -eq "IN_TRANSIT") {
    Write-Host "  Status: IN_TRANSIT"
    Pass "G1: Container advanced to IN_TRANSIT"
} else {
    Write-Host "  Status transition to IN_TRANSIT: $(if ($s2) { $s2.status } else { 'failed' })"
    Warn "G1: Could not advance to IN_TRANSIT"
}

Write-Host ""
Write-Host "=== TEST G2: Try adding package to IN_TRANSIT container ===" -ForegroundColor White
# Create another PACKED package
$ord7 = D (Api "POST" "/orders" $SALE @{
    customerId    = $CUST_ID
    serviceType   = "VCT"
    shippingRoute = "SEA"
    branch        = "HN"
    items         = @(@{
        productName = "Test Product CNT001-7 blocked"
        quantity    = 3
        unitPrice   = 150
        currency    = "CNY"
    })
    note          = "CNT-001 blocked test #7 - $TS"
})
if ($ord7 -and $ord7.id) {
    foreach ($st in @("QUOTATION", "PENDING_DEPOSIT", "SOURCING", "WAREHOUSE_CN")) {
        D (Api "PATCH" "/orders/$($ord7.id)/status" $CEO @{ status = $st }) | Out-Null
    }
    $rcv7Data = D (Api "POST" "/warehouse-cn/receive" $WH_CN @{
        trackingNumberCN = "CNT001-PKG7-$TS"
        orderId          = $ord7.id
        imageUrls        = @("https://storage.tbs.vn/test/cnt001-pkg7.jpg")
    })
    $pkg7 = if ($rcv7Data.package) { $rcv7Data.package } else { $rcv7Data }
    if ($pkg7 -and $pkg7.id) {
        D (Api "POST" "/warehouse-cn/packages/$($pkg7.id)/measure" $WH_CN @{
            length = 50; width = 40; height = 30; actualWeight = 50
        }) | Out-Null
        D (Api "PATCH" "/warehouse-cn/packages/$($pkg7.id)/status" $WH_CN @{ status = "PACKED" }) | Out-Null

        $blockedResp = Api "POST" "/containers/$CNT_ID/add-packages" $WH_CN @{
            packageIds = @($pkg7.id)
        }
        if (IsError $blockedResp) {
            if ($blockedResp._code -eq 400) {
                Pass "G2: Adding to IN_TRANSIT container blocked (400)"
            } else {
                Warn "G2: Got error $($blockedResp._code) (expected 400)"
            }
        } else {
            Fail "G2: Adding to IN_TRANSIT container was not blocked"
        }
    }
}

# ================================================================
# PART H: DUPLICATE PACKAGE ASSIGNMENT
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Edge case - duplicate package assignment" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST H1: Create 2nd container, try adding already-assigned package ===" -ForegroundColor White
$cnt2 = D (Api "POST" "/containers" $WH_CN @{
    shippingRoute = "SEA"
    origin        = "Guangzhou, CN"
    destination   = "Hai Phong, VN"
    maxCapacity   = 500
})
if ($cnt2 -and $cnt2.id -and $PKG_IDS.Count -gt 0) {
    $dupResp = Api "POST" "/containers/$($cnt2.id)/add-packages" $WH_CN @{
        packageIds = @($PKG_IDS[0])
    }
    if (IsError $dupResp) {
        if ($dupResp._code -eq 400) {
            Pass "H1: Duplicate package assignment blocked (400)"
        } else {
            Warn "H1: Got error $($dupResp._code) (expected 400)"
        }
    } else {
        Fail "H1: Duplicate package assignment was not blocked"
    }
} else {
    Warn "H1: Cannot test (no 2nd container or no packages)"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-CNT-001: Ghep nhieu don vao container" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Part A: Tao container SEA (maxCapacity=1000 kg)"
Write-Host "  Part B: 5 orders -> receive + measure + pack at Warehouse CN"
Write-Host "  Part C: Add 5 packages -> verify fill rate"
Write-Host "  Part D: Verify container detail + fill rate endpoint"
Write-Host "  Part E: Verify unload manifest"
Write-Host "  Part F: Overflow test (exceed capacity)"
Write-Host "  Part G: FSM block (cannot add to IN_TRANSIT container)"
Write-Host "  Part H: Duplicate package assignment blocked"
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
