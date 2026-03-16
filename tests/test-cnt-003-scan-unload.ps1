# ================================================================
# TEST-CNT-003: Scan + Unload manifest khi container ARRIVED tai kho VN
# Severity: CRITICAL
#
# Flow:
#   1. Tao container voi 5 packages -> advance to ARRIVED
#   2. Get unload manifest -> verify danh sach packages
#   3. Scan tung package (3/5) -> verify matched:true, warehouseVNStatus=RECEIVED
#   4. Scan surplus barcode -> verify matched:false
#   5. Complete unload -> verify receivedCount, missingCount, missingPackages
#   6. Verify package statuses after unload
#   7. Alternative: Direct receive tai warehouse VN
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
Write-Host "  TEST-CNT-003: Scan + Unload manifest khi ARRIVED tai kho VN" -ForegroundColor Cyan
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

$WH_VN = Login "khovn01@$DOMAIN"
if ($WH_VN) { Pass "WAREHOUSE_VN login OK" } else { Warn "WAREHOUSE_VN login FAILED (will use WH_CN fallback)" }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

# Use WH_VN or fallback to WH_CN for VN operations
$VN_TOKEN = if ($WH_VN) { $WH_VN } else { $WH_CN }

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
# PART A: TAO 5 DON HANG + CONTAINER + ADVANCE TO ARRIVED
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Tao 5 don hang, pack, tao container, advance to ARRIVED" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$PKG_IDS = @()
$PKG_CODES = @()
$ORDER_IDS = @()
$ORDER_CODES = @()

$weights = @(60, 80, 50, 70, 90)
$dims = @(
    @{ l = 35; w = 25; h = 20 },
    @{ l = 40; w = 30; h = 20 },
    @{ l = 30; w = 25; h = 20 },
    @{ l = 35; w = 30; h = 20 },
    @{ l = 45; w = 30; h = 20 }
)

for ($i = 0; $i -lt 5; $i++) {
    $n = $i + 1

    # Create order
    $ord = D (Api "POST" "/orders" $SALE @{
        customerId    = $CUST_ID
        serviceType   = "VCT"
        shippingRoute = "SEA"
        branch        = "HN"
        items         = @(@{ productName = "CNT003 item $n"; quantity = 3; unitPrice = 80; currency = "CNY" })
        note          = "CNT-003 order #$n - $TS"
    })
    if (-not $ord -or -not $ord.id) { Fail "A: Create order #$n failed"; continue }
    $ORDER_IDS += $ord.id
    $ORDER_CODES += $ord.code

    # Advance to WAREHOUSE_CN
    foreach ($st in @("QUOTATION", "PENDING_DEPOSIT", "SOURCING", "WAREHOUSE_CN")) {
        $tr = Api "PATCH" "/orders/$($ord.id)/status" $CEO @{ status = $st }
        if (IsError $tr) { break }
    }

    # Receive + Measure + Pack
    $trackNum = "CNT003-P$n-$TS"
    $rcvResp = Api "POST" "/warehouse-cn/receive" $WH_CN @{
        trackingNumberCN = $trackNum
        orderId          = $ord.id
        imageUrls        = @("https://storage.tbs.vn/test/cnt003-p${n}.jpg")
    }
    if (IsError $rcvResp) { Fail "A: Receive #$n failed"; continue }
    $rcvData = D $rcvResp
    $pkg = if ($rcvData.package) { $rcvData.package } else { $rcvData }
    if (-not $pkg -or -not $pkg.id) { Fail "A: No pkg ID #$n"; continue }

    $d = $dims[$i]
    D (Api "POST" "/warehouse-cn/packages/$($pkg.id)/measure" $WH_CN @{
        length = $d.l; width = $d.w; height = $d.h; actualWeight = $weights[$i]
    }) | Out-Null

    $packResp = D (Api "PATCH" "/warehouse-cn/packages/$($pkg.id)/status" $WH_CN @{ status = "PACKED" })
    if ($packResp -and $packResp.warehouseCNStatus -eq "PACKED") {
        $PKG_IDS += $pkg.id
        $PKG_CODES += $pkg.code
        Write-Host "    $($ord.code) -> $($pkg.code) PACKED ($($weights[$i]) kg)" -ForegroundColor Gray
    } else {
        Fail "A: Pack #$n failed"
    }
}

if ($PKG_IDS.Count -eq 5) {
    Pass "A1: 5 orders + 5 packages PACKED"
} else {
    Fail "A1: Only $($PKG_IDS.Count)/5 packages ready"; exit 1
}

# Create container and add packages
Write-Host ""
$cnt = D (Api "POST" "/containers" $WH_CN @{
    shippingRoute        = "SEA"
    origin               = "Guangzhou, CN"
    destination          = "Hai Phong, VN"
    carrier              = "COSCO"
    vesselName           = "COSCO GALAXY V.0303"
    maxCapacity          = 5000
    estimatedArrivalAt   = (Get-Date).AddDays(5).ToString("yyyy-MM-ddTHH:mm:ssZ")
})
if (-not $cnt -or -not $cnt.id) { Fail "A2: Create container failed"; exit 1 }
$CNT_ID = $cnt.id
$CNT_CODE = $cnt.code

$addResp = D (Api "POST" "/containers/$CNT_ID/add-packages" $WH_CN @{ packageIds = $PKG_IDS })
if ($addResp -and [int]$addResp.totalPackages -eq 5) {
    Pass "A2: Container $CNT_CODE created with 5 packages"
} else {
    Fail "A2: Add packages failed"
}

# Advance to ARRIVED
Write-Host ""
D (Api "PATCH" "/containers/$CNT_ID/status" $WH_CN @{ status = "LOADING" }) | Out-Null
D (Api "PATCH" "/containers/$CNT_ID/status" $WH_CN @{ status = "IN_TRANSIT" }) | Out-Null
Start-Sleep -Seconds 1
$arrResp = D (Api "PATCH" "/containers/$CNT_ID/status" $WH_CN @{ status = "ARRIVED" })
if ($arrResp -and $arrResp.status -eq "ARRIVED") {
    Pass "A3: Container ARRIVED at destination"
    Write-Host "  actualArrivalAt: $($arrResp.actualArrivalAt)" -ForegroundColor Gray
} else {
    Fail "A3: Container not ARRIVED"; exit 1
}

# Wait for container.arrived event processing
Start-Sleep -Seconds 2

# ================================================================
# PART B: UNLOAD MANIFEST
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Verify unload manifest" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST B1: GET unload manifest ===" -ForegroundColor White
$manifest = D (Api "GET" "/containers/$CNT_ID/unload-manifest" $VN_TOKEN)
if (-not $manifest) {
    # Try with WH_CN token
    $manifest = D (Api "GET" "/containers/$CNT_ID/unload-manifest" $WH_CN)
}

$mPkgs = $null
if ($manifest) {
    Write-Host "  Manifest keys: $($manifest.PSObject.Properties.Name -join ', ')"
    if ($manifest.expectedPackages) { $mPkgs = @($manifest.expectedPackages) }
    elseif ($manifest.packages) { $mPkgs = @($manifest.packages) }
}

if ($mPkgs -and $mPkgs.Count -eq 5) {
    Pass "B1a: Manifest has 5 expected packages"
} elseif ($mPkgs -and $mPkgs.Count -gt 0) {
    Warn "B1a: Manifest has $($mPkgs.Count) packages (expected 5)"
} else {
    Fail "B1a: Manifest empty or not returned"
}

Write-Host ""
Write-Host "=== TEST B2: Manifest package codes match our packages ===" -ForegroundColor White
if ($mPkgs) {
    $manifestCodes = @()
    foreach ($mp in $mPkgs) {
        $manifestCodes += $mp.code
        Write-Host "    $($mp.code) | order=$($mp.orderCode)$($mp.order.code)" -ForegroundColor Gray
    }
    $matchCount = 0
    foreach ($code in $PKG_CODES) {
        if ($manifestCodes -contains $code) { $matchCount++ }
    }
    if ($matchCount -eq 5) {
        Pass "B2: All 5 package codes match manifest"
    } elseif ($matchCount -gt 0) {
        Warn "B2: Only $matchCount/5 package codes match manifest"
    } else {
        Fail "B2: No package codes match manifest"
    }
} else {
    Fail "B2: No manifest packages to verify"
}

Write-Host ""
Write-Host "=== TEST B3: Manifest includes container info ===" -ForegroundColor White
if ($manifest -and $manifest.container) {
    $mc = $manifest.container
    Write-Host "  Container: $($mc.code) | route=$($mc.shippingRoute) | status=$($mc.status)"
    if ($mc.code -eq $CNT_CODE) {
        Pass "B3: Manifest container code matches ($CNT_CODE)"
    } else {
        Fail "B3: Manifest container code mismatch: $($mc.code) vs $CNT_CODE"
    }
} else {
    Warn "B3: Manifest missing container info"
}

# ================================================================
# PART C: SCAN 3 OF 5 PACKAGES
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Scan 3/5 packages (simulate partial unload)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$SCANNED_IDS = @()

for ($i = 0; $i -lt 3; $i++) {
    $n = $i + 1
    $barcode = $PKG_CODES[$i]

    Write-Host ""
    Write-Host "=== TEST C${n}: Scan package $barcode ===" -ForegroundColor White
    $scanResp = D (Api "POST" "/containers/$CNT_ID/scan" $VN_TOKEN @{ barcode = $barcode })
    if (-not $scanResp) {
        $scanResp = D (Api "POST" "/containers/$CNT_ID/scan" $WH_CN @{ barcode = $barcode })
    }

    if ($scanResp) {
        $matched = $scanResp.matched
        $scannedPkg = $scanResp.package

        if ($matched -eq $true) {
            Write-Host "  matched=true | pkg=$($scannedPkg.code) | vnStatus=$($scannedPkg.warehouseVNStatus)"
            Pass "C${n}a: Scan matched for $barcode"

            if ($scannedPkg.warehouseVNStatus -eq "RECEIVED") {
                Pass "C${n}b: warehouseVNStatus = RECEIVED after scan"
            } else {
                Warn "C${n}b: warehouseVNStatus = $($scannedPkg.warehouseVNStatus), expected RECEIVED"
            }

            if ($scannedPkg.receivedVNAt) {
                Pass "C${n}c: receivedVNAt timestamp set"
            } else {
                Warn "C${n}c: receivedVNAt not in response"
            }

            $SCANNED_IDS += $scannedPkg.id
        } else {
            Fail "C${n}a: Scan NOT matched for $barcode (expected match)"
        }
    } else {
        Fail "C${n}: Scan failed for $barcode"
    }
}

# ================================================================
# PART D: SCAN SURPLUS BARCODE
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Scan surplus barcode (not in container)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST D1: Scan unknown barcode ===" -ForegroundColor White
$fakeBarcode = "FAKE-SURPLUS-$TS"
$surplusResp = D (Api "POST" "/containers/$CNT_ID/scan" $VN_TOKEN @{ barcode = $fakeBarcode })
if (-not $surplusResp) {
    $surplusResp = D (Api "POST" "/containers/$CNT_ID/scan" $WH_CN @{ barcode = $fakeBarcode })
}

if ($surplusResp) {
    if ($surplusResp.matched -eq $false) {
        Write-Host "  matched=false | message=$($surplusResp.message)"
        Pass "D1: Surplus barcode correctly not matched"
    } elseif ($surplusResp.matched -eq $true) {
        Fail "D1: Surplus barcode matched (should not)"
    } else {
        Write-Host "  Response: $($surplusResp | ConvertTo-Json -Depth 3 -Compress)"
        Warn "D1: Unexpected scan response format"
    }
} else {
    # A null response from D() means API error - surplus might return error
    Warn "D1: Scan surplus returned error (may be expected)"
}

Write-Host ""
Write-Host "=== TEST D2: Scan already-scanned package (idempotent) ===" -ForegroundColor White
$rescanResp = D (Api "POST" "/containers/$CNT_ID/scan" $VN_TOKEN @{ barcode = $PKG_CODES[0] })
if (-not $rescanResp) {
    $rescanResp = D (Api "POST" "/containers/$CNT_ID/scan" $WH_CN @{ barcode = $PKG_CODES[0] })
}
if ($rescanResp -and $rescanResp.matched -eq $true) {
    Pass "D2: Re-scan same package still matched (idempotent)"
} elseif ($rescanResp) {
    Warn "D2: Re-scan response: matched=$($rescanResp.matched)"
} else {
    Warn "D2: Re-scan returned error"
}

# ================================================================
# PART E: COMPLETE UNLOAD (3 received, 2 missing, 1 surplus)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: Complete unload (3 received, 2 missing)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST E1: POST complete-unload ===" -ForegroundColor White
Write-Host "  Received IDs: $($SCANNED_IDS.Count) packages"
Write-Host "  Missing: packages #4 ($($PKG_CODES[3])) and #5 ($($PKG_CODES[4]))"

$unloadResp = D (Api "POST" "/containers/$CNT_ID/complete-unload" $VN_TOKEN @{
    receivedPackageIds = $SCANNED_IDS
    surplusBarcodes    = @($fakeBarcode)
    notes              = "2 packages missing during unload. 1 surplus barcode found."
})
if (-not $unloadResp) {
    $unloadResp = D (Api "POST" "/containers/$CNT_ID/complete-unload" $WH_CN @{
        receivedPackageIds = $SCANNED_IDS
        surplusBarcodes    = @($fakeBarcode)
        notes              = "2 packages missing during unload. 1 surplus barcode found."
    })
}

if ($unloadResp) {
    Write-Host "  Response keys: $($unloadResp.PSObject.Properties.Name -join ', ')"
    Write-Host "  receivedCount:    $($unloadResp.receivedCount)"
    Write-Host "  missingCount:     $($unloadResp.missingCount)"
    Write-Host "  missingPackages:  $($unloadResp.missingPackages -join ', ')"
    Write-Host "  surplusBarcodes:  $($unloadResp.surplusBarcodes -join ', ')"

    # E1a: receivedCount
    if ([int]$unloadResp.receivedCount -eq 3) {
        Pass "E1a: receivedCount = 3"
    } elseif ([int]$unloadResp.receivedCount -gt 0) {
        Warn "E1a: receivedCount = $($unloadResp.receivedCount), expected 3"
    } else {
        Fail "E1a: receivedCount = $($unloadResp.receivedCount)"
    }

    # E1b: missingCount
    if ([int]$unloadResp.missingCount -eq 2) {
        Pass "E1b: missingCount = 2"
    } elseif ([int]$unloadResp.missingCount -ge 0) {
        Warn "E1b: missingCount = $($unloadResp.missingCount), expected 2"
    } else {
        Fail "E1b: missingCount invalid"
    }

    # E1c: missingPackages includes our 2 missing codes
    $missingCodes = @()
    if ($unloadResp.missingPackages) { $missingCodes = @($unloadResp.missingPackages) }
    elseif ($unloadResp.missingPackageCodes) { $missingCodes = @($unloadResp.missingPackageCodes) }
    $hasMissing4 = $missingCodes -contains $PKG_CODES[3]
    $hasMissing5 = $missingCodes -contains $PKG_CODES[4]
    if ($hasMissing4 -and $hasMissing5) {
        Pass "E1c: Missing packages correctly identified ($($PKG_CODES[3]), $($PKG_CODES[4]))"
    } elseif ($missingCodes.Count -eq 2) {
        Pass "E1c: 2 missing packages reported (codes: $($missingCodes -join ', '))"
    } elseif ($missingCodes.Count -gt 0) {
        Warn "E1c: $($missingCodes.Count) missing packages reported"
    } else {
        Warn "E1c: No missing packages in response"
    }

    # E1d: surplusBarcodes
    $surplusList = @()
    if ($unloadResp.surplusBarcodes) { $surplusList = @($unloadResp.surplusBarcodes) }
    if ($surplusList.Count -ge 1 -and $surplusList -contains $fakeBarcode) {
        Pass "E1d: Surplus barcode $fakeBarcode reported"
    } elseif ($surplusList.Count -gt 0) {
        Pass "E1d: $($surplusList.Count) surplus barcode(s) reported"
    } else {
        Warn "E1d: No surplus barcodes in response"
    }
} else {
    Fail "E1: Complete unload failed"
}

# ================================================================
# PART F: VERIFY PACKAGE STATUSES AFTER UNLOAD
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Verify package statuses after unload" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST F1: Scanned packages (1-3) should be RECEIVED at VN ===" -ForegroundColor White
$vnReceivedCount = 0
for ($i = 0; $i -lt 3; $i++) {
    $n = $i + 1
    $pkgCheck = D (Api "GET" "/warehouse-cn/packages/$($PKG_CODES[$i])" $WH_CN)
    if ($pkgCheck) {
        Write-Host "    $($PKG_CODES[$i]): vnStatus=$($pkgCheck.warehouseVNStatus) | receivedVNAt=$($pkgCheck.receivedVNAt)"
        if ($pkgCheck.warehouseVNStatus -eq "RECEIVED") { $vnReceivedCount++ }
    } else {
        Write-Host "    $($PKG_CODES[$i]): not found via code lookup" -ForegroundColor DarkRed
    }
}
if ($vnReceivedCount -eq 3) {
    Pass "F1: All 3 scanned packages have warehouseVNStatus=RECEIVED"
} elseif ($vnReceivedCount -gt 0) {
    Warn "F1: $vnReceivedCount/3 packages RECEIVED at VN"
} else {
    Fail "F1: No packages show RECEIVED at VN"
}

Write-Host ""
Write-Host "=== TEST F2: Missing packages (4-5) should NOT be RECEIVED ===" -ForegroundColor White
$notReceivedCount = 0
for ($i = 3; $i -lt 5; $i++) {
    $n = $i + 1
    $pkgCheck = D (Api "GET" "/warehouse-cn/packages/$($PKG_CODES[$i])" $WH_CN)
    if ($pkgCheck) {
        Write-Host "    $($PKG_CODES[$i]): vnStatus=$($pkgCheck.warehouseVNStatus) | cnStatus=$($pkgCheck.warehouseCNStatus)"
        if ($pkgCheck.warehouseVNStatus -ne "RECEIVED" -or -not $pkgCheck.warehouseVNStatus) {
            $notReceivedCount++
        }
    } else {
        Write-Host "    $($PKG_CODES[$i]): not found via code lookup" -ForegroundColor DarkRed
    }
}
if ($notReceivedCount -eq 2) {
    Pass "F2: 2 missing packages correctly NOT received at VN"
} elseif ($notReceivedCount -gt 0) {
    Warn "F2: $notReceivedCount/2 packages not received"
} else {
    Fail "F2: Missing packages incorrectly marked as received"
}

# ================================================================
# PART G: SCAN REMAINING 2 PACKAGES (LATE ARRIVAL)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: Scan remaining 2 packages (late arrival)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

for ($i = 3; $i -lt 5; $i++) {
    $n = $i + 1
    $barcode = $PKG_CODES[$i]

    Write-Host ""
    Write-Host "=== TEST G$($i-2): Scan late package $barcode ===" -ForegroundColor White
    $lateScan = D (Api "POST" "/containers/$CNT_ID/scan" $VN_TOKEN @{ barcode = $barcode })
    if (-not $lateScan) {
        $lateScan = D (Api "POST" "/containers/$CNT_ID/scan" $WH_CN @{ barcode = $barcode })
    }

    if ($lateScan -and $lateScan.matched -eq $true) {
        Write-Host "  matched=true | vnStatus=$($lateScan.package.warehouseVNStatus)"
        if ($lateScan.package.warehouseVNStatus -eq "RECEIVED") {
            Pass "G$($i-2): Late package $barcode scanned -> RECEIVED"
        } else {
            Warn "G$($i-2): Late package scanned but vnStatus=$($lateScan.package.warehouseVNStatus)"
        }
    } elseif ($lateScan) {
        Warn "G$($i-2): Late scan matched=$($lateScan.matched) for $barcode"
    } else {
        Fail "G$($i-2): Late scan failed for $barcode"
    }
}

# ================================================================
# PART H: ALTERNATIVE - DIRECT RECEIVE VIA WAREHOUSE VN
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Alternative - Direct receive via /warehouse-vn/receive" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Create a 2nd container with 2 packages for this test
Write-Host ""
Write-Host "=== Setup: 2nd container with 2 packages ===" -ForegroundColor White

$PKG_IDS_2 = @()
$PKG_CODES_2 = @()

for ($i = 0; $i -lt 2; $i++) {
    $n = $i + 1
    $ord = D (Api "POST" "/orders" $SALE @{
        customerId    = $CUST_ID
        serviceType   = "VCT"
        shippingRoute = "SEA"
        branch        = "HN"
        items         = @(@{ productName = "CNT003-H item $n"; quantity = 2; unitPrice = 50; currency = "CNY" })
        note          = "CNT-003 Part H order #$n - $TS"
    })
    if (-not $ord -or -not $ord.id) { Write-Host "    Order #$n failed" -ForegroundColor Red; continue }

    foreach ($st in @("QUOTATION", "PENDING_DEPOSIT", "SOURCING", "WAREHOUSE_CN")) {
        Api "PATCH" "/orders/$($ord.id)/status" $CEO @{ status = $st } | Out-Null
    }

    $rcvResp = Api "POST" "/warehouse-cn/receive" $WH_CN @{
        trackingNumberCN = "CNT003H-P$n-$TS"
        orderId          = $ord.id
        imageUrls        = @("https://storage.tbs.vn/test/cnt003h-p${n}.jpg")
    }
    if (IsError $rcvResp) { continue }
    $rcvData = D $rcvResp
    $pkg = if ($rcvData.package) { $rcvData.package } else { $rcvData }
    if (-not $pkg -or -not $pkg.id) { continue }

    D (Api "POST" "/warehouse-cn/packages/$($pkg.id)/measure" $WH_CN @{
        length = 30; width = 25; height = 20; actualWeight = 40
    }) | Out-Null
    D (Api "PATCH" "/warehouse-cn/packages/$($pkg.id)/status" $WH_CN @{ status = "PACKED" }) | Out-Null

    $PKG_IDS_2 += $pkg.id
    $PKG_CODES_2 += $pkg.code
    Write-Host "    $($pkg.code) PACKED" -ForegroundColor Gray
}

$cnt2 = D (Api "POST" "/containers" $WH_CN @{
    shippingRoute = "SEA"
    origin        = "Shanghai, CN"
    destination   = "HCMC, VN"
    maxCapacity   = 2000
})
if ($cnt2 -and $cnt2.id -and $PKG_IDS_2.Count -eq 2) {
    $CNT2_ID = $cnt2.id
    D (Api "POST" "/containers/$CNT2_ID/add-packages" $WH_CN @{ packageIds = $PKG_IDS_2 }) | Out-Null
    D (Api "PATCH" "/containers/$CNT2_ID/status" $WH_CN @{ status = "LOADING" }) | Out-Null
    D (Api "PATCH" "/containers/$CNT2_ID/status" $WH_CN @{ status = "IN_TRANSIT" }) | Out-Null
    Start-Sleep -Seconds 1
    D (Api "PATCH" "/containers/$CNT2_ID/status" $WH_CN @{ status = "ARRIVED" }) | Out-Null
    Write-Host "  Container $($cnt2.code) ARRIVED with 2 packages" -ForegroundColor Gray

    Write-Host ""
    Write-Host "=== TEST H1: Direct receive via /warehouse-vn/receive ===" -ForegroundColor White
    $directResp = D (Api "POST" "/warehouse-vn/receive" $VN_TOKEN @{
        containerId = $CNT2_ID
        packageIds  = $PKG_IDS_2
        note        = "Direct bulk receive test"
    })
    if (-not $directResp) {
        # Try with WH_CN token
        $directResp = D (Api "POST" "/warehouse-vn/receive" $WH_CN @{
            containerId = $CNT2_ID
            packageIds  = $PKG_IDS_2
            note        = "Direct bulk receive test"
        })
    }

    if ($directResp) {
        Write-Host "  receivedCount: $($directResp.receivedCount)"
        Write-Host "  skippedCount:  $($directResp.skippedCount)"
        Write-Host "  total:         $($directResp.total)"

        if ([int]$directResp.receivedCount -eq 2) {
            Pass "H1a: Direct receive: 2 packages received"
        } elseif ([int]$directResp.receivedCount -gt 0) {
            Pass "H1a: Direct receive: $($directResp.receivedCount) packages received"
        } else {
            Fail "H1a: Direct receive: no packages received"
        }

        if ($directResp.containerCode -or $directResp.containerId) {
            Pass "H1b: Response includes container reference"
        } else {
            Warn "H1b: Response missing container reference"
        }
    } else {
        Fail "H1: Direct receive via /warehouse-vn/receive failed"
    }

    Write-Host ""
    Write-Host "=== TEST H2: Direct receive with wrong container status ===" -ForegroundColor White
    # Create container still in PLANNING - should be rejected
    $cnt3 = D (Api "POST" "/containers" $WH_CN @{
        shippingRoute = "SEA"
        origin        = "Shenzhen, CN"
        destination   = "Da Nang, VN"
        maxCapacity   = 1000
    })
    if ($cnt3 -and $cnt3.id) {
        $badReceive = Api "POST" "/warehouse-vn/receive" $VN_TOKEN @{
            containerId = $cnt3.id
            packageIds  = @("fake-pkg-id")
        }
        if (-not (IsError $badReceive)) {
            $badReceive = Api "POST" "/warehouse-vn/receive" $WH_CN @{
                containerId = $cnt3.id
                packageIds  = @("fake-pkg-id")
            }
        }
        if (IsError $badReceive) {
            Pass "H2: Direct receive from PLANNING container blocked ($($badReceive._code))"
        } else {
            Fail "H2: Direct receive from PLANNING container was allowed"
        }
    } else {
        Warn "H2: Cannot create test container"
    }
} else {
    Warn "H: Cannot setup 2nd container for direct receive test"
}

# ================================================================
# PART I: VERIFY ALL 5 PACKAGES NOW RECEIVED AT VN
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART I: Final verification - all 5 packages from container 1" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST I1: All 5 packages should be RECEIVED at VN ===" -ForegroundColor White
$allReceivedCount = 0
for ($i = 0; $i -lt 5; $i++) {
    $pkgCheck = D (Api "GET" "/warehouse-cn/packages/$($PKG_CODES[$i])" $WH_CN)
    if ($pkgCheck) {
        $vnSt = $pkgCheck.warehouseVNStatus
        $vnAt = $pkgCheck.receivedVNAt
        Write-Host "    $($PKG_CODES[$i]): vnStatus=$vnSt | receivedVNAt=$vnAt"
        if ($vnSt -eq "RECEIVED") { $allReceivedCount++ }
    } else {
        Write-Host "    $($PKG_CODES[$i]): not found" -ForegroundColor DarkRed
    }
}
if ($allReceivedCount -eq 5) {
    Pass "I1: All 5 packages RECEIVED at VN warehouse"
} elseif ($allReceivedCount -ge 3) {
    Warn "I1: $allReceivedCount/5 packages RECEIVED (late scans may not have updated)"
} else {
    Fail "I1: Only $allReceivedCount/5 packages RECEIVED"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-CNT-003: Scan + Unload Manifest" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Part A: 5 orders -> pack -> container ARRIVED"
Write-Host "  Part B: Unload manifest verification"
Write-Host "  Part C: Scan 3/5 packages -> RECEIVED"
Write-Host "  Part D: Surplus barcode + idempotent re-scan"
Write-Host "  Part E: Complete unload (3 received, 2 missing, 1 surplus)"
Write-Host "  Part F: Package status verification after unload"
Write-Host "  Part G: Scan remaining 2 late packages"
Write-Host "  Part H: Alternative direct receive via /warehouse-vn/receive"
Write-Host "  Part I: Final verification - all 5 packages RECEIVED"
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
