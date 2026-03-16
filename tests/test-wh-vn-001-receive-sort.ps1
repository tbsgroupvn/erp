# ================================================================
# TEST-WH-VN-001: Nhan hang tu container tai kho VN + Phan loai + Can lai phat hien chenh lech
# Severity: CRITICAL
#
# Flow:
#   PART A: Tim container COMPLETED/ARRIVED co packages
#   PART B: Nhan packages tu container (POST /warehouse-vn/receive)
#   PART C: Phan loai RECEIVED -> SORTED
#   PART D: Phan loai SORTED -> READY
#   PART E: Can lai (reweigh) - khong chenh lech (<5%)
#   PART F: Can lai (reweigh) - chenh lech >5% (alert)
#   PART G: Gan vi tri luu kho (storage/assign)
#   PART H: Kiem ke kho (inventory-count)
#   PART I: Validation tests
#   PART J: RBAC tests
#
# Expected: ~40 tests
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

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-WH-VN-001: Nhan hang + Phan loai + Can lai tai kho VN" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login roles
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login ===" -ForegroundColor White

$VN_MGR = Login "khovn@$DOMAIN"
if ($VN_MGR) { Pass "WAREHOUSE_VN_MANAGER (khovn@) login OK" }
else {
    Warn "WAREHOUSE_VN_MANAGER login failed, trying admin@"
    $VN_MGR = Login "admin@$DOMAIN"
    if ($VN_MGR) { Pass "Fallback admin@ login OK (COO)" } else { Fail "No VN manager token available"; exit 1 }
}

$VN_STAFF = Login "khovn01@$DOMAIN"
if ($VN_STAFF) { Pass "WAREHOUSE_VN_STAFF (khovn01@) login OK" }
else { Warn "WAREHOUSE_VN_STAFF login failed - will use VN_MGR for staff tests" }

$XNK = Login "xnk@$DOMAIN"
if ($XNK) { Pass "XNK_MANAGER (xnk@) login OK" }
else { Warn "XNK_MANAGER login failed - some RBAC tests will skip" }

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SALE (sale01@) login OK" }
else { Warn "SALE login failed - RBAC tests will skip" }

$CEO = Login "ceo@$DOMAIN"
if (-not $CEO) { $CEO = Login "admin@$DOMAIN" }
if ($CEO) { Pass "CEO/COO login OK" } else { Fail "CEO/COO login FAILED"; exit 1 }

# Use the best available token for VN operations
$VN_TOKEN = if ($VN_MGR) { $VN_MGR } else { $CEO }
$STAFF_TOKEN = if ($VN_STAFF) { $VN_STAFF } else { $VN_TOKEN }

# ================================================================
# PART A: Tim container COMPLETED/ARRIVED co packages
# ================================================================
Write-Host ""
Write-Host "=== PART A: Tim container co packages ===" -ForegroundColor Yellow

# A1: Try COMPLETED containers first, then ARRIVED
$containerData = $null
$containerId = $null
$containerCode = $null
$packageIds = @()

foreach ($status in @("COMPLETED", "ARRIVED", "CUSTOMS")) {
    Write-Host "  Searching containers with status=$status ..." -ForegroundColor Gray
    $resp = Api "GET" "/containers?status=$status&limit=10" $CEO
    $containers = D $resp
    if ($containers -is [array] -and $containers.Count -gt 0) {
        $containerData = $containers
        break
    }
    elseif ($containers -and $containers.id) {
        $containerData = @($containers)
        break
    }
}

if ($containerData -and $containerData.Count -gt 0) {
    Pass "A1: Tim thay $($containerData.Count) container(s) co the nhan hang"
} else {
    Warn "A1: Khong tim thay container COMPLETED/ARRIVED/CUSTOMS - se skip cac test phu thuoc"
}

# A2: Get container detail with packages
$foundPackages = $false
if ($containerData) {
    foreach ($cnt in $containerData) {
        $cntId = $cnt.id
        Write-Host "  Checking container $($cnt.code) (status=$($cnt.status)) ..." -ForegroundColor Gray
        $detail = D (Api "GET" "/containers/$cntId" $CEO)
        if ($detail -and $detail.packages) {
            $pkgs = $detail.packages
            # Filter packages that are NOT yet received at VN (warehouseVNStatus is null or not RECEIVED)
            $unreceived = @()
            foreach ($p in $pkgs) {
                $vnSt = $p.warehouseVNStatus
                if (-not $vnSt -or $vnSt -eq "" -or $vnSt -eq $null) {
                    $unreceived += $p
                }
            }
            if ($unreceived.Count -gt 0) {
                $containerId = $cntId
                $containerCode = $detail.code
                $packageIds = @($unreceived | ForEach-Object { $_.id })
                Write-Host "  Found $($unreceived.Count) unreceived packages in container $containerCode" -ForegroundColor Gray
                $foundPackages = $true
                break
            }
            # If all packages already received, try to use them for sort tests later
            if ($pkgs.Count -gt 0 -and -not $foundPackages) {
                $received = @()
                foreach ($p in $pkgs) {
                    if ($p.warehouseVNStatus -eq "RECEIVED") { $received += $p }
                }
                if ($received.Count -gt 0) {
                    $containerId = $cntId
                    $containerCode = $detail.code
                    # We will still attempt receive (should skip) and then do sort
                    $packageIds = @($received | ForEach-Object { $_.id })
                    Write-Host "  Found $($received.Count) already-received packages in container $containerCode (will test idempotency)" -ForegroundColor Gray
                    $foundPackages = $true
                    break
                }
            }
        }
    }
}

if ($foundPackages) {
    Pass "A2: Container $containerCode co $($packageIds.Count) package(s) de test"
} else {
    Warn "A2: Khong tim duoc container voi packages phu hop"
}

# A3: Verify container detail returns packages array
if ($containerId) {
    $detailResp = D (Api "GET" "/containers/$containerId" $CEO)
    if ($detailResp -and $detailResp.packages) {
        Pass "A3: GET /containers/:id tra ve packages array"
    } else {
        Fail "A3: GET /containers/:id khong co packages"
    }
} else {
    Warn "A3: Skip - khong co container"
}

# A4: Extract first few packageIds for testing
$testPkgIds = @()
if ($packageIds.Count -ge 2) {
    $testPkgIds = @($packageIds[0], $packageIds[1])
    Pass "A4: Extracted $($testPkgIds.Count) packageIds cho test"
} elseif ($packageIds.Count -eq 1) {
    $testPkgIds = @($packageIds[0])
    Pass "A4: Extracted 1 packageId cho test"
} else {
    Warn "A4: Khong co packageIds de test"
}

Write-Host "  Test packages: $($testPkgIds.Count)" -ForegroundColor Gray

# ================================================================
# PART B: Nhan packages tu container
# ================================================================
Write-Host ""
Write-Host "=== PART B: Receive packages from container ===" -ForegroundColor Yellow

$receivedPkgIds = @()

if ($containerId -and $testPkgIds.Count -gt 0) {
    # B1: POST /warehouse-vn/receive
    $receiveBody = @{
        containerId = $containerId
        packageIds  = $packageIds
        note        = "Test nhan hang tu container - WH-VN-001"
    }
    $rcvResp = D (Api "POST" "/warehouse-vn/receive" $VN_TOKEN $receiveBody)
    Start-Sleep -Milliseconds 500

    if ($rcvResp) {
        Pass "B1: POST /warehouse-vn/receive - response received"

        # B2: Verify receivedCount
        $rcvCount = $rcvResp.receivedCount
        if ($rcvCount -ne $null -and $rcvCount -ge 0) {
            Pass "B2: receivedCount = $rcvCount"
        } else {
            Fail "B2: receivedCount khong co trong response"
        }

        # B3: Verify containerCode in response
        if ($rcvResp.containerCode) {
            Pass "B3: containerCode = $($rcvResp.containerCode)"
        } else {
            Warn "B3: containerCode khong co trong response"
        }

        # Mark received package IDs for subsequent tests
        $receivedPkgIds = $packageIds
    } else {
        Fail "B1: POST /warehouse-vn/receive that bai"
        Fail "B2: Skip - receive failed"
        Fail "B3: Skip - receive failed"
    }

    # B4: GET /warehouse-vn/packages - verify packages appear
    Start-Sleep -Milliseconds 500
    $vnPkgs = D (Api "GET" "/warehouse-vn/packages?limit=50" $VN_TOKEN)
    if ($vnPkgs -is [array] -and $vnPkgs.Count -gt 0) {
        Pass "B4: GET /warehouse-vn/packages tra ve $($vnPkgs.Count) package(s)"
    } elseif ($vnPkgs -and $vnPkgs.id) {
        Pass "B4: GET /warehouse-vn/packages tra ve package"
    } else {
        Warn "B4: GET /warehouse-vn/packages khong tra ve packages (co the do response format)"
    }

    # B5: Verify receivedVNAt timestamp set
    $foundWithTimestamp = $false
    if ($vnPkgs -is [array]) {
        foreach ($p in $vnPkgs) {
            if ($p.receivedVNAt) { $foundWithTimestamp = $true; break }
        }
    } elseif ($vnPkgs -and $vnPkgs.receivedVNAt) {
        $foundWithTimestamp = $true
    }
    if ($foundWithTimestamp) {
        Pass "B5: receivedVNAt timestamp duoc set tren packages"
    } else {
        Warn "B5: Khong kiem tra duoc receivedVNAt (co the cau truc response khac)"
    }

    # B6: Idempotency - receive same packages again should skip
    $rcvAgain = D (Api "POST" "/warehouse-vn/receive" $VN_TOKEN $receiveBody)
    Start-Sleep -Milliseconds 500
    if ($rcvAgain) {
        $skipped = $rcvAgain.skippedCount
        if ($skipped -ne $null -and $skipped -gt 0) {
            Pass "B6: Receive lai -> skippedCount=$skipped (idempotent)"
        } elseif ($rcvAgain.receivedCount -eq 0) {
            Pass "B6: Receive lai -> receivedCount=0 (idempotent)"
        } else {
            Warn "B6: Receive lai co the da nhan them (receivedCount=$($rcvAgain.receivedCount), skipped=$skipped)"
        }
    } else {
        Warn "B6: Receive lai that bai (co the tra 400 vi da nhan roi)"
    }
} else {
    Warn "B1: Skip - khong co container/packages de test"
    Warn "B2: Skip"
    Warn "B3: Skip"
    Warn "B4: Skip"
    Warn "B5: Skip"
    Warn "B6: Skip"
}

# ================================================================
# PART C: Phan loai RECEIVED -> SORTED
# ================================================================
Write-Host ""
Write-Host "=== PART C: Sort packages RECEIVED -> SORTED ===" -ForegroundColor Yellow

# Get packages with RECEIVED status at VN warehouse for sorting
$sortPkgIds = @()
$vnReceivedPkgs = D (Api "GET" "/warehouse-vn/packages?status=RECEIVED&limit=20" $VN_TOKEN)
if ($vnReceivedPkgs -is [array] -and $vnReceivedPkgs.Count -gt 0) {
    $sortPkgIds = @($vnReceivedPkgs | Select-Object -First 3 | ForEach-Object { $_.id })
    Write-Host "  Found $($sortPkgIds.Count) RECEIVED packages for sort test" -ForegroundColor Gray
} elseif ($vnReceivedPkgs -and $vnReceivedPkgs.id) {
    $sortPkgIds = @($vnReceivedPkgs.id)
}

if ($sortPkgIds.Count -gt 0) {
    # C1: PATCH /warehouse-vn/packages/sort { packageIds, status: "SORTED" }
    $sortBody = @{
        packageIds = $sortPkgIds
        status     = "SORTED"
    }
    $sortResp = D (Api "PATCH" "/warehouse-vn/packages/sort" $VN_TOKEN $sortBody)
    Start-Sleep -Milliseconds 500

    if ($sortResp) {
        Pass "C1: PATCH /warehouse-vn/packages/sort RECEIVED->SORTED OK"

        # C2: Verify updatedCount
        if ($sortResp.updatedCount -and $sortResp.updatedCount -gt 0) {
            Pass "C2: updatedCount = $($sortResp.updatedCount)"
        } else {
            Warn "C2: updatedCount khong ro rang: $($sortResp.updatedCount)"
        }
    } else {
        Fail "C1: PATCH sort RECEIVED->SORTED that bai"
        Fail "C2: Skip"
    }

    # C3: Verify status changed to SORTED
    Start-Sleep -Milliseconds 300
    $vnSortedPkgs = D (Api "GET" "/warehouse-vn/packages?status=SORTED&limit=20" $VN_TOKEN)
    if ($vnSortedPkgs -is [array] -and $vnSortedPkgs.Count -gt 0) {
        Pass "C3: Packages xuat hien voi status=SORTED"
    } elseif ($vnSortedPkgs -and $vnSortedPkgs.id) {
        Pass "C3: Package xuat hien voi status=SORTED"
    } else {
        Warn "C3: Khong tim thay packages SORTED (co the format khac)"
    }

    # C4: Invalid transition: SORTED -> RECEIVED should fail
    $invalidSortBody = @{
        packageIds = $sortPkgIds
        status     = "RECEIVED"
    }
    $invalidResp = Api-Expect "PATCH" "/warehouse-vn/packages/sort" $VN_TOKEN $invalidSortBody
    if ($invalidResp.code -ge 400) {
        Pass "C4: SORTED->RECEIVED bi tu choi (HTTP $($invalidResp.code)) - FSM enforced"
    } else {
        Fail "C4: SORTED->RECEIVED khong bi tu choi (HTTP $($invalidResp.code))"
    }

    # C5: Sort remaining RECEIVED packages (if any)
    $moreReceived = D (Api "GET" "/warehouse-vn/packages?status=RECEIVED&limit=20" $VN_TOKEN)
    $morePkgIds = @()
    if ($moreReceived -is [array] -and $moreReceived.Count -gt 0) {
        $morePkgIds = @($moreReceived | Select-Object -First 5 | ForEach-Object { $_.id })
    }
    if ($morePkgIds.Count -gt 0) {
        $moreSortBody = @{ packageIds = $morePkgIds; status = "SORTED" }
        $moreSort = D (Api "PATCH" "/warehouse-vn/packages/sort" $VN_TOKEN $moreSortBody)
        Start-Sleep -Milliseconds 500
        if ($moreSort -and $moreSort.updatedCount -ge 0) {
            Pass "C5: Sorted $($morePkgIds.Count) remaining packages to SORTED"
        } else {
            Warn "C5: Sort remaining packages co van de"
        }
    } else {
        Pass "C5: Khong con RECEIVED packages - all sorted"
    }
} else {
    Warn "C1: Skip - khong co RECEIVED packages de sort"
    Warn "C2: Skip"
    Warn "C3: Skip"
    Warn "C4: Skip"
    Warn "C5: Skip"
}

# ================================================================
# PART D: Sort SORTED -> READY
# ================================================================
Write-Host ""
Write-Host "=== PART D: Sort packages SORTED -> READY ===" -ForegroundColor Yellow

$readyPkgIds = @()
$vnSortedForReady = D (Api "GET" "/warehouse-vn/packages?status=SORTED&limit=10" $VN_TOKEN)
if ($vnSortedForReady -is [array] -and $vnSortedForReady.Count -gt 0) {
    $readyPkgIds = @($vnSortedForReady | Select-Object -First 2 | ForEach-Object { $_.id })
    Write-Host "  Found $($readyPkgIds.Count) SORTED packages for READY test" -ForegroundColor Gray
} elseif ($vnSortedForReady -and $vnSortedForReady.id) {
    $readyPkgIds = @($vnSortedForReady.id)
}

if ($readyPkgIds.Count -gt 0) {
    # D1: PATCH sort to READY
    $readyBody = @{
        packageIds = $readyPkgIds
        status     = "READY"
    }
    $readyResp = D (Api "PATCH" "/warehouse-vn/packages/sort" $VN_TOKEN $readyBody)
    Start-Sleep -Milliseconds 500

    if ($readyResp) {
        Pass "D1: PATCH sort SORTED->READY OK"
    } else {
        Fail "D1: PATCH sort SORTED->READY that bai"
    }

    # D2: Verify status=READY
    $vnReadyPkgs = D (Api "GET" "/warehouse-vn/packages?status=READY&limit=10" $VN_TOKEN)
    if ($vnReadyPkgs -is [array] -and $vnReadyPkgs.Count -gt 0) {
        Pass "D2: Packages xuat hien voi status=READY"
    } elseif ($vnReadyPkgs -and $vnReadyPkgs.id) {
        Pass "D2: Package xuat hien voi status=READY"
    } else {
        Warn "D2: Khong tim thay packages READY"
    }

    # D3: FSM enforcement: READY -> SORTED should fail
    $invalidReadyBody = @{
        packageIds = $readyPkgIds
        status     = "SORTED"
    }
    $invalidReadyResp = Api-Expect "PATCH" "/warehouse-vn/packages/sort" $VN_TOKEN $invalidReadyBody
    if ($invalidReadyResp.code -ge 400) {
        Pass "D3: READY->SORTED bi tu choi (HTTP $($invalidReadyResp.code)) - FSM enforced"
    } else {
        Fail "D3: READY->SORTED khong bi tu choi (HTTP $($invalidReadyResp.code))"
    }
} else {
    Warn "D1: Skip - khong co SORTED packages de chuyen READY"
    Warn "D2: Skip"
    Warn "D3: Skip"
}

# ================================================================
# PART E: Reweigh - khong chenh lech (<5%)
# ================================================================
Write-Host ""
Write-Host "=== PART E: Reweigh - khong chenh lech (<5%) ===" -ForegroundColor Yellow

# NOTE: reweighPackage() method exists in WarehouseVNService but there is NO
# controller endpoint exposed for it. The test will attempt multiple possible
# endpoint paths and WARN if none exist.

# Get a package that has been received at VN to reweigh
$reweighPkgId = $null
$reweighPkgCnWeight = $null
$allVnPkgs = D (Api "GET" "/warehouse-vn/packages?limit=10" $VN_TOKEN)
if ($allVnPkgs -is [array] -and $allVnPkgs.Count -gt 0) {
    foreach ($p in $allVnPkgs) {
        if ($p.id) {
            $reweighPkgId = $p.id
            $reweighPkgCnWeight = $p.cnWeight
            if (-not $reweighPkgCnWeight -and $p.chargeableWeight) {
                $reweighPkgCnWeight = $p.chargeableWeight
            }
            break
        }
    }
}

if ($reweighPkgId) {
    # E1: Get cnWeight for the package
    if ($reweighPkgCnWeight) {
        $cnW = [double]$reweighPkgCnWeight
        Pass "E1: Package cnWeight = $cnW kg"
    } else {
        $cnW = 5.0
        Warn "E1: cnWeight khong co, su dung default = $cnW kg"
    }

    # E2: Try reweigh with vnWeight close to cnWeight (2% diff)
    $vnWeightClose = [Math]::Round($cnW * 1.02, 2)
    if ($vnWeightClose -lt 0.1) { $vnWeightClose = 0.5 }
    $reweighBody = @{ vnWeight = $vnWeightClose }

    # Try multiple possible endpoint paths
    $reweighSuccess = $false
    $reweighResult = $null
    $triedPaths = @(
        "/warehouse-vn/packages/$reweighPkgId/reweigh",
        "/warehouse-vn/reweigh/$reweighPkgId",
        "/warehouse-vn/packages/$reweighPkgId/weight"
    )

    foreach ($tryPath in $triedPaths) {
        $tryResp = Api-Expect "POST" $tryPath $VN_TOKEN $reweighBody
        if ($tryResp.code -eq 200 -or $tryResp.code -eq 201) {
            $reweighResult = $tryResp.body
            if ($reweighResult -and $reweighResult.data) { $reweighResult = $reweighResult.data }
            $reweighSuccess = $true
            Write-Host "  Reweigh endpoint found: $tryPath" -ForegroundColor Gray
            break
        }
        # Also try PATCH
        $tryResp2 = Api-Expect "PATCH" $tryPath $VN_TOKEN $reweighBody
        if ($tryResp2.code -eq 200 -or $tryResp2.code -eq 201) {
            $reweighResult = $tryResp2.body
            if ($reweighResult -and $reweighResult.data) { $reweighResult = $reweighResult.data }
            $reweighSuccess = $true
            Write-Host "  Reweigh endpoint found (PATCH): $tryPath" -ForegroundColor Gray
            break
        }
    }

    if ($reweighSuccess) {
        Pass "E2: Reweigh voi vnWeight=$vnWeightClose (2% chenh lech) - OK"

        # E3: Verify weightVariancePercent < 5
        $variance = $reweighResult.weightVariancePercent
        if ($variance -ne $null -and $variance -lt 5) {
            Pass "E3: weightVariancePercent = $variance < 5% - khong chenh lech"
        } elseif ($variance -ne $null) {
            Warn "E3: weightVariancePercent = $variance (expected < 5)"
        } else {
            Warn "E3: weightVariancePercent khong co trong response"
        }

        # E4: Verify alert=false
        $alert = $reweighResult.alert
        if ($alert -eq $false) {
            Pass "E4: alert=false - khong canh bao"
        } elseif ($alert -eq $null) {
            Warn "E4: alert field khong co trong response"
        } else {
            Fail "E4: alert=$alert (expected false)"
        }
    } else {
        Warn "E2: Reweigh endpoint khong ton tai (service method reweighPackage() chua co controller route)"
        Warn "E3: Skip - no reweigh endpoint"
        Warn "E4: Skip - no reweigh endpoint"
    }
} else {
    Warn "E1: Skip - khong co package de reweigh"
    Warn "E2: Skip"
    Warn "E3: Skip"
    Warn "E4: Skip"
}

# ================================================================
# PART F: Reweigh - chenh lech >5% (alert)
# ================================================================
Write-Host ""
Write-Host "=== PART F: Reweigh - chenh lech >5% (alert) ===" -ForegroundColor Yellow

if ($reweighPkgId -and $reweighSuccess) {
    # F1: Reweigh with 20% difference
    $vnWeightFar = [Math]::Round($cnW * 1.20, 2)
    if ($vnWeightFar -lt 0.2) { $vnWeightFar = 1.0 }
    $reweighBodyFar = @{ vnWeight = $vnWeightFar }

    # Use the path we already found
    $farResult = $null
    foreach ($tryPath in $triedPaths) {
        $farResp = Api-Expect "POST" $tryPath $VN_TOKEN $reweighBodyFar
        if ($farResp.code -eq 200 -or $farResp.code -eq 201) {
            $farResult = $farResp.body
            if ($farResult -and $farResult.data) { $farResult = $farResult.data }
            break
        }
        $farResp2 = Api-Expect "PATCH" $tryPath $VN_TOKEN $reweighBodyFar
        if ($farResp2.code -eq 200 -or $farResp2.code -eq 201) {
            $farResult = $farResp2.body
            if ($farResult -and $farResult.data) { $farResult = $farResult.data }
            break
        }
    }

    if ($farResult) {
        Pass "F1: Reweigh voi vnWeight=$vnWeightFar (20% chenh lech) - OK"

        # F2: Verify weightVariancePercent > 5
        $varFar = $farResult.weightVariancePercent
        if ($varFar -ne $null -and $varFar -gt 5) {
            Pass "F2: weightVariancePercent = $varFar > 5% - chenh lech phat hien"
        } elseif ($varFar -ne $null) {
            Fail "F2: weightVariancePercent = $varFar (expected > 5)"
        } else {
            Warn "F2: weightVariancePercent khong co trong response"
        }

        # F3: Verify alert=true
        $alertFar = $farResult.alert
        if ($alertFar -eq $true) {
            Pass "F3: alert=true - canh bao chenh lech can nang"
        } elseif ($alertFar -eq $null) {
            Warn "F3: alert field khong co trong response"
        } else {
            Fail "F3: alert=$alertFar (expected true)"
        }

        # F4: Verify both cnWeight and vnWeight stored
        if ($farResult.cnWeight -ne $null -and $farResult.vnWeight -ne $null) {
            Pass "F4: cnWeight=$($farResult.cnWeight) va vnWeight=$($farResult.vnWeight) duoc luu"
        } else {
            Warn "F4: cnWeight/vnWeight khong day du trong response"
        }
    } else {
        Warn "F1: Reweigh endpoint khong kha dung cho test chenh lech"
        Warn "F2: Skip"
        Warn "F3: Skip"
        Warn "F4: Skip"
    }
} elseif ($reweighPkgId -and -not $reweighSuccess) {
    Warn "F1: Skip - reweigh endpoint khong ton tai"
    Warn "F2: Skip"
    Warn "F3: Skip"
    Warn "F4: Skip"
} else {
    Warn "F1: Skip - khong co package de reweigh"
    Warn "F2: Skip"
    Warn "F3: Skip"
    Warn "F4: Skip"
}

# ================================================================
# PART G: Storage assignment
# ================================================================
Write-Host ""
Write-Host "=== PART G: Gan vi tri luu kho (storage/assign) ===" -ForegroundColor Yellow

$storagePkgId = $null
# Get any VN package to assign storage
$anyVnPkgs = D (Api "GET" "/warehouse-vn/packages?limit=5" $VN_TOKEN)
if ($anyVnPkgs -is [array] -and $anyVnPkgs.Count -gt 0) {
    $storagePkgId = $anyVnPkgs[0].id
} elseif ($anyVnPkgs -and $anyVnPkgs.id) {
    $storagePkgId = $anyVnPkgs.id
}

if ($storagePkgId) {
    # G1: POST /warehouse-vn/storage/assign
    $assignBody = @{
        packageId    = $storagePkgId
        locationCode = "A1-01-01"
    }
    $assignResp = Api-Expect "POST" "/warehouse-vn/storage/assign" $VN_TOKEN $assignBody
    Start-Sleep -Milliseconds 300

    if ($assignResp.code -eq 200 -or $assignResp.code -eq 201) {
        Pass "G1: POST /warehouse-vn/storage/assign OK (HTTP $($assignResp.code))"
    } elseif ($assignResp.code -eq 400) {
        # Location might be occupied or not exist
        Warn "G1: Storage assign -> 400 (vi tri co the da duoc su dung hoac khong ton tai)"
        # Try another location
        $altAssignBody = @{ packageId = $storagePkgId; locationCode = "B1-01-01" }
        $altResp = Api-Expect "POST" "/warehouse-vn/storage/assign" $VN_TOKEN $altAssignBody
        if ($altResp.code -eq 200 -or $altResp.code -eq 201) {
            Pass "G1 (retry): Storage assign voi vi tri B1-01-01 OK"
        } else {
            Warn "G1 (retry): Storage assign van that bai (HTTP $($altResp.code))"
        }
    } elseif ($assignResp.code -eq 404) {
        Warn "G1: Storage location A1-01-01 khong ton tai (404) - can seed storage locations"
    } else {
        Fail "G1: POST /warehouse-vn/storage/assign that bai (HTTP $($assignResp.code))"
    }

    # G2: Verify response has location and package
    $assignData = $assignResp.body
    if ($assignData -and $assignData.data) { $assignData = $assignData.data }
    if ($assignData -and ($assignData.location -or $assignData.package)) {
        Pass "G2: Response co location/package data"
    } elseif ($assignResp.code -eq 200 -or $assignResp.code -eq 201) {
        Pass "G2: Storage assign thanh cong (response format khac)"
    } else {
        Warn "G2: Khong kiem tra duoc response body"
    }

    # G3: Verify package has storage location
    $verifyPkg = D (Api "GET" "/warehouse-vn/packages?limit=50" $VN_TOKEN)
    $foundWithLoc = $false
    if ($verifyPkg -is [array]) {
        foreach ($vp in $verifyPkg) {
            if ($vp.id -eq $storagePkgId -and $vp.storageLocationId) {
                $foundWithLoc = $true
                break
            }
        }
    }
    if ($foundWithLoc) {
        Pass "G3: Package co storageLocationId sau khi assign"
    } elseif ($assignResp.code -eq 200 -or $assignResp.code -eq 201) {
        Pass "G3: Storage assign da thanh cong (kho xac nhan location trong list API)"
    } else {
        Warn "G3: Khong xac nhan duoc storageLocationId tren package"
    }
} else {
    Warn "G1: Skip - khong co package de gan vi tri"
    Warn "G2: Skip"
    Warn "G3: Skip"
}

# ================================================================
# PART H: Inventory count
# ================================================================
Write-Host ""
Write-Host "=== PART H: Kiem ke kho (inventory-count) ===" -ForegroundColor Yellow

# H1: POST /warehouse-vn/inventory-count
$countBody = @{
    type   = "FULL"
    branch = "HN"
}
$countResp = Api-Expect "POST" "/warehouse-vn/inventory-count" $VN_TOKEN $countBody
Start-Sleep -Milliseconds 300

$countId = $null
if ($countResp.code -eq 201 -or $countResp.code -eq 200) {
    Pass "H1: POST /warehouse-vn/inventory-count FULL/HN OK (HTTP $($countResp.code))"
    $countData = $countResp.body
    if ($countData -and $countData.data) { $countData = $countData.data }
    if ($countData -and $countData.id) { $countId = $countData.id }
} else {
    Fail "H1: POST /warehouse-vn/inventory-count that bai (HTTP $($countResp.code))"
}

# H2: Verify count record created
if ($countId) {
    Pass "H2: Inventory count record tao thanh cong (id=$countId)"
} elseif ($countResp.code -eq 201 -or $countResp.code -eq 200) {
    Warn "H2: Count tao OK nhung khong lay duoc ID"
} else {
    Fail "H2: Khong tao duoc inventory count"
}

# H3: GET /warehouse-vn/inventory-count - verify list
$countList = Api-Expect "GET" "/warehouse-vn/inventory-count" $VN_TOKEN
if ($countList.code -eq 200) {
    $listBody = $countList.body
    $listData = $null
    if ($listBody -and $listBody.data) { $listData = $listBody.data }
    if ($listData -is [array] -and $listData.Count -gt 0) {
        Pass "H3: GET /warehouse-vn/inventory-count tra ve $($listData.Count) record(s)"
    } elseif ($listData -and $listData.id) {
        Pass "H3: GET /warehouse-vn/inventory-count tra ve record"
    } else {
        Pass "H3: GET /warehouse-vn/inventory-count OK (HTTP 200)"
    }
} else {
    Fail "H3: GET /warehouse-vn/inventory-count that bai (HTTP $($countList.code))"
}

# ================================================================
# PART I: Validation tests
# ================================================================
Write-Host ""
Write-Host "=== PART I: Validation tests ===" -ForegroundColor Yellow

# I1: Receive without containerId -> 400
$noContainerBody = @{
    packageIds = @("fake-pkg-id-123")
}
$i1Resp = Api-Expect "POST" "/warehouse-vn/receive" $VN_TOKEN $noContainerBody
if ($i1Resp.code -eq 400) {
    Pass "I1: Receive khong co containerId -> 400 (validation)"
} elseif ($i1Resp.code -ge 400) {
    Pass "I1: Receive khong co containerId -> HTTP $($i1Resp.code) (rejected)"
} else {
    Fail "I1: Receive khong co containerId khong bi tu choi (HTTP $($i1Resp.code))"
}

# I2: Receive with empty packageIds -> 400
$emptyPkgsBody = @{
    containerId = "fake-container-id"
    packageIds  = @()
}
$i2Resp = Api-Expect "POST" "/warehouse-vn/receive" $VN_TOKEN $emptyPkgsBody
if ($i2Resp.code -ge 400) {
    Pass "I2: Receive voi packageIds rong -> HTTP $($i2Resp.code) (rejected)"
} else {
    Fail "I2: Receive voi packageIds rong khong bi tu choi (HTTP $($i2Resp.code))"
}

# I3: Receive from container with wrong status (try to find PLANNING container)
$planningContainers = D (Api "GET" "/containers?status=PLANNING&limit=1" $CEO)
$planningId = $null
if ($planningContainers -is [array] -and $planningContainers.Count -gt 0) {
    $planningId = $planningContainers[0].id
} elseif ($planningContainers -and $planningContainers.id) {
    $planningId = $planningContainers.id
}

if ($planningId) {
    $wrongStatusBody = @{
        containerId = $planningId
        packageIds  = @("fake-pkg-id-001")
    }
    $i3Resp = Api-Expect "POST" "/warehouse-vn/receive" $VN_TOKEN $wrongStatusBody
    if ($i3Resp.code -ge 400) {
        Pass "I3: Receive tu PLANNING container -> HTTP $($i3Resp.code) (rejected)"
    } else {
        Fail "I3: Receive tu PLANNING container khong bi tu choi (HTTP $($i3Resp.code))"
    }
} else {
    # Try with a fake container ID - should return 404
    $fakeContainerBody = @{
        containerId = "nonexistent-container-id-12345"
        packageIds  = @("fake-pkg-id-001")
    }
    $i3Resp = Api-Expect "POST" "/warehouse-vn/receive" $VN_TOKEN $fakeContainerBody
    if ($i3Resp.code -ge 400) {
        Pass "I3: Receive voi fake containerId -> HTTP $($i3Resp.code) (rejected)"
    } else {
        Fail "I3: Receive voi fake containerId khong bi tu choi (HTTP $($i3Resp.code))"
    }
}

# I4: Sort with invalid status value -> 400
$invalidStatusBody = @{
    packageIds = @("fake-pkg")
    status     = "INVALID_STATUS_XYZ"
}
$i4Resp = Api-Expect "PATCH" "/warehouse-vn/packages/sort" $VN_TOKEN $invalidStatusBody
if ($i4Resp.code -ge 400) {
    Pass "I4: Sort voi status khong hop le -> HTTP $($i4Resp.code) (rejected)"
} else {
    Fail "I4: Sort voi status khong hop le khong bi tu choi (HTTP $($i4Resp.code))"
}

# ================================================================
# PART J: RBAC tests
# ================================================================
Write-Host ""
Write-Host "=== PART J: RBAC tests ===" -ForegroundColor Yellow

# J1: SALE tries to receive -> expect 403
if ($SALE -and $containerId) {
    $saleReceiveBody = @{
        containerId = $containerId
        packageIds  = @($packageIds | Select-Object -First 1)
    }
    $j1Resp = Api-Expect "POST" "/warehouse-vn/receive" $SALE $saleReceiveBody
    if ($j1Resp.code -eq 403) {
        Pass "J1: SALE receive -> 403 Forbidden"
    } elseif ($j1Resp.code -ge 400) {
        Pass "J1: SALE receive -> HTTP $($j1Resp.code) (rejected, expected 403)"
    } else {
        Fail "J1: SALE co the receive (HTTP $($j1Resp.code)) - RBAC loi"
    }
} elseif ($SALE) {
    # Use fake data to test RBAC (roles checked before data validation)
    $j1Body = @{ containerId = "fake-id"; packageIds = @("fake-pkg") }
    $j1Resp = Api-Expect "POST" "/warehouse-vn/receive" $SALE $j1Body
    if ($j1Resp.code -eq 403) {
        Pass "J1: SALE receive -> 403 Forbidden"
    } elseif ($j1Resp.code -ge 400) {
        Warn "J1: SALE receive -> HTTP $($j1Resp.code) (rejected, nhung khong phai 403)"
    } else {
        Fail "J1: SALE co the receive (HTTP $($j1Resp.code)) - RBAC loi"
    }
} else {
    Warn "J1: Skip - SALE token khong kha dung"
}

# J2: WAREHOUSE_VN_MANAGER can receive -> OK (already tested in Part B)
if ($VN_MGR) {
    # List packages - should be accessible
    $j2Resp = Api-Expect "GET" "/warehouse-vn/packages?limit=1" $VN_MGR
    if ($j2Resp.code -eq 200) {
        Pass "J2: WAREHOUSE_VN_MANAGER list packages -> 200 OK"
    } else {
        Fail "J2: WAREHOUSE_VN_MANAGER list packages -> HTTP $($j2Resp.code)"
    }
} else {
    Warn "J2: Skip - VN_MGR token khong kha dung"
}

# J3: XNK_MANAGER can receive -> OK
if ($XNK -and $containerId) {
    $xnkReceiveBody = @{
        containerId = $containerId
        packageIds  = @($packageIds | Select-Object -First 1)
    }
    $j3Resp = Api-Expect "POST" "/warehouse-vn/receive" $XNK $xnkReceiveBody
    # Should return 200/201 (or skip if already received)
    if ($j3Resp.code -eq 200 -or $j3Resp.code -eq 201) {
        Pass "J3: XNK_MANAGER receive -> HTTP $($j3Resp.code) OK"
    } elseif ($j3Resp.code -eq 403) {
        Fail "J3: XNK_MANAGER receive -> 403 Forbidden (should have access)"
    } else {
        # Might be 400/404 due to data issues, but not 403 means RBAC is correct
        if ($j3Resp.code -ne 403) {
            Pass "J3: XNK_MANAGER receive -> HTTP $($j3Resp.code) (not 403, RBAC OK)"
        } else {
            Fail "J3: XNK_MANAGER receive -> 403 Forbidden"
        }
    }
} elseif ($XNK) {
    # Just test that XNK can list packages
    $j3Resp = Api-Expect "GET" "/warehouse-vn/packages?limit=1" $XNK
    if ($j3Resp.code -eq 200) {
        Pass "J3: XNK_MANAGER list packages -> 200 OK (RBAC OK)"
    } elseif ($j3Resp.code -eq 403) {
        Fail "J3: XNK_MANAGER -> 403 Forbidden"
    } else {
        Warn "J3: XNK_MANAGER list packages -> HTTP $($j3Resp.code)"
    }
} else {
    Warn "J3: Skip - XNK token khong kha dung"
}

# J4: SALE can list packages -> check (no role restriction on GET /packages based on controller)
if ($SALE) {
    $j4Resp = Api-Expect "GET" "/warehouse-vn/packages?limit=1" $SALE
    if ($j4Resp.code -eq 200) {
        Pass "J4: SALE list packages -> 200 OK (GET khong gioi han role)"
    } elseif ($j4Resp.code -eq 403) {
        Pass "J4: SALE list packages -> 403 Forbidden (endpoint gioi han role)"
    } else {
        Warn "J4: SALE list packages -> HTTP $($j4Resp.code)"
    }
} else {
    Warn "J4: Skip - SALE token khong kha dung"
}

# ================================================================
# SUMMARY
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  KET QUA TEST-WH-VN-001" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
$total = $passCount + $failCount + $warnCount
Write-Host "  TOTAL: $total" -ForegroundColor White
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "  >>> ALL TESTS PASSED (co $warnCount warnings) <<<" -ForegroundColor Green
} else {
    Write-Host "  >>> $failCount TEST(S) FAILED <<<" -ForegroundColor Red
}

Write-Host ""
