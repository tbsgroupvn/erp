$ErrorActionPreference = 'Continue'
$baseUrl = 'http://localhost:3001/api/v1'
$domain = 'nhaphangchinhngach.vn'

$passCount = 0; $failCount = 0; $warnCount = 0

function Log-Result($status, $msg) {
    switch ($status) {
        'PASS' { $script:passCount++; Write-Host "[PASS] $msg" }
        'FAIL' { $script:failCount++; Write-Host "[FAIL] $msg" }
        'WARN' { $script:warnCount++; Write-Host "[WARN] $msg" }
        'INFO' { Write-Host "[INFO] $msg" }
    }
}

function Api-Call($method, $url, $body, $hdrs) {
    try {
        $params = @{ Uri = $url; Method = $method; Headers = $hdrs; UseBasicParsing = $true }
        if ($body) {
            $params.ContentType = 'application/json'
            $params.Body = [System.Text.Encoding]::UTF8.GetBytes($body)
        }
        $resp = Invoke-WebRequest @params
        return @{ ok = $true; code = $resp.StatusCode; data = ($resp.Content | ConvertFrom-Json) }
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        $errBody = ""
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errBody = $reader.ReadToEnd()
        } catch {}
        return @{ ok = $false; code = $code; error = $errBody }
    }
}

function Login($email) {
    $body = "{`"email`":`"$email@$domain`",`"password`":`"Admin@123`"}"
    $r = Api-Call 'POST' "$baseUrl/auth/login" $body @{}
    if ($r.ok) {
        $t = $r.data.data.tokens.accessToken
        $uid = $r.data.data.user.id
        $role = $r.data.data.user.role
        return @{ token = $t; userId = $uid; role = $role; headers = @{ Authorization = "Bearer $t" } }
    }
    return $null
}

Write-Host "================================================================"
Write-Host "  TEST-ORD-002: Full Order Lifecycle"
Write-Host "  CONSULTING -> QUOTATION -> SOURCING -> WAREHOUSE_CN"
Write-Host "  -> PACKING -> Container -> Warehouse VN -> DELIVERING"
Write-Host "================================================================"
Write-Host ""

# ============================================================
# SETUP: Login all roles
# ============================================================
Write-Host "=== SETUP: Login roles ==="
$sale = Login 'sale01'
$whCN = Login 'khotq01'
$xnk = Login 'xnk'
$whVN = Login 'khovn'
$ceo = Login 'ceo'

if ($sale) { Log-Result 'PASS' "SALE login OK" } else { Log-Result 'FAIL' "SALE login FAILED"; exit 1 }
if ($whCN) { Log-Result 'PASS' "Warehouse CN Agent login OK" } else { Log-Result 'FAIL' "WH CN login FAILED"; exit 1 }
if ($xnk) { Log-Result 'PASS' "XNK Manager login OK" } else { Log-Result 'FAIL' "XNK login FAILED"; exit 1 }
if ($whVN) { Log-Result 'PASS' "Warehouse VN Manager login OK" } else { Log-Result 'FAIL' "WH VN login FAILED"; exit 1 }
if ($ceo) { Log-Result 'PASS' "CEO login OK" } else { Log-Result 'FAIL' "CEO login FAILED"; exit 1 }

# Get VIP customer
$custR = Api-Call 'GET' "$baseUrl/customers?page=1&limit=10" $null $sale.headers
$customers = @($custR.data.data)
$vipCust = $customers | Where-Object { $_.tier -eq 'VIP' -and [decimal]$_.creditLimit -gt 0 } | Select-Object -First 1
Write-Host "  Customer: $($vipCust.code) (VIP, credit=$($vipCust.creditLimit))"

# ============================================================
# TEST 1: Create VCT order
# ============================================================
Write-Host ""
Write-Host "=== TEST 1: Create VCT order ==="
$orderPayload = @"
{
  "customerId": "$($vipCust.id)",
  "serviceType": "VCT",
  "branch": "HN",
  "shippingRoute": "SEA",
  "items": [
    {"productName": "Linh kien may tinh", "quantity": 50, "unitPrice": 25, "currency": "CNY"},
    {"productName": "Day cap USB-C", "quantity": 200, "unitPrice": 5, "currency": "CNY"}
  ],
  "note": "TEST-ORD-002: Full lifecycle test"
}
"@
$r = Api-Call 'POST' "$baseUrl/orders" $orderPayload $sale.headers
if ($r.ok) {
    $order = $r.data.data
    $orderId = $order.id
    $orderCode = $order.code
    Write-Host "  Order: $orderCode | status=$($order.status) | total=$($order.totalAmount)"
    Log-Result 'PASS' "Order created: $orderCode"
} else {
    Log-Result 'FAIL' "Create order failed: HTTP $($r.code) $($r.error)"
    exit 1
}

# ============================================================
# TEST 2: Invalid status transition (CONSULTING -> IN_TRANSIT)
# ============================================================
Write-Host ""
Write-Host "=== TEST 2: Invalid transition CONSULTING -> IN_TRANSIT ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"IN_TRANSIT"}' $sale.headers
if (-not $r.ok -and $r.code -eq 400) {
    Log-Result 'PASS' "Invalid transition rejected (400)"
} else {
    Log-Result 'FAIL' "Expected 400, got $($r.code)"
}

# ============================================================
# TEST 3: CONSULTING -> QUOTATION
# ============================================================
Write-Host ""
Write-Host "=== TEST 3: CONSULTING -> QUOTATION ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"QUOTATION","note":"Bao gia cho khach"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'QUOTATION') { Log-Result 'PASS' "CONSULTING -> QUOTATION OK" }
    else { Log-Result 'FAIL' "Status = $st, expected QUOTATION" }
} else {
    Log-Result 'FAIL' "Transition failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 4: QUOTATION -> SOURCING (VCT skip deposit)
# ============================================================
Write-Host ""
Write-Host "=== TEST 4: QUOTATION -> SOURCING (VCT, skip deposit) ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"SOURCING","note":"Khach dong y, bat dau mua hang"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'SOURCING') { Log-Result 'PASS' "QUOTATION -> SOURCING OK (VCT no deposit)" }
    else { Log-Result 'FAIL' "Status = $st, expected SOURCING" }
} else {
    Log-Result 'FAIL' "Transition failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 5: SOURCING -> WAREHOUSE_CN
# ============================================================
Write-Host ""
Write-Host "=== TEST 5: SOURCING -> WAREHOUSE_CN ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"WAREHOUSE_CN","note":"Hang da ve kho TQ"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'WAREHOUSE_CN') { Log-Result 'PASS' "SOURCING -> WAREHOUSE_CN OK" }
    else { Log-Result 'FAIL' "Status = $st, expected WAREHOUSE_CN" }
} else {
    Log-Result 'FAIL' "Transition failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 6: Receive 2 packages at Warehouse CN
# ============================================================
Write-Host ""
Write-Host "=== TEST 6: Receive packages at Warehouse CN ==="
$ts = Get-Date -Format 'yyyyMMddHHmmss'
$pkgIds = @()

foreach ($i in 1..2) {
    $recPayload = @"
{
  "trackingNumberCN": "SF-LIFE-$ts-$i",
  "orderId": "$orderId",
  "imageUrls": ["https://storage.tbs.vn/test/lifecycle-$i.jpg"],
  "description": "Kien $i cho order $orderCode"
}
"@
    $r = Api-Call 'POST' "$baseUrl/warehouse-cn/receive" $recPayload $whCN.headers
    if ($r.ok) {
        $pkg = $r.data.data.package
        $pkgIds += $pkg.id
        Write-Host "  Package $($i) - $($pkg.code) id=$($pkg.id) status=$($pkg.warehouseCNStatus)"
        Log-Result 'PASS' "Package $i received: $($pkg.code)"
    } else {
        Log-Result 'FAIL' "Receive package $i failed: HTTP $($r.code)"
    }
}

# ============================================================
# TEST 7: Measure packages
# ============================================================
Write-Host ""
Write-Host "=== TEST 7: Measure packages ==="
$measSpecs = @(
    @{ weight = 25; l = 50; w = 40; h = 35 },
    @{ weight = 8; l = 30; w = 25; h = 20 }
)

for ($i = 0; $i -lt $pkgIds.Count; $i++) {
    $spec = $measSpecs[$i]
    $measPayload = @"
{
  "actualWeight": $($spec.weight),
  "length": $($spec.l),
  "width": $($spec.w),
  "height": $($spec.h)
}
"@
    $r = Api-Call 'POST' "$baseUrl/warehouse-cn/packages/$($pkgIds[$i])/measure" $measPayload $whCN.headers
    if ($r.ok) {
        $mp = $r.data.data.package
        Write-Host "  Pkg $($i+1) - actual=$($mp.actualWeight)kg vol=$($mp.volumetricWeight)kg chargeable=$($mp.chargeableWeight)kg status=$($mp.warehouseCNStatus)"
        Log-Result 'PASS' "Package $($i+1) measured (CHECKED)"
    } else {
        Log-Result 'FAIL' "Measure package $($i+1) failed: HTTP $($r.code) $($r.error)"
    }
}

# ============================================================
# TEST 8: Transition packages CHECKED -> PACKED
# ============================================================
Write-Host ""
Write-Host "=== TEST 8: Package status CHECKED -> PACKED ==="
foreach ($pkgId in $pkgIds) {
    $r = Api-Call 'PATCH' "$baseUrl/warehouse-cn/packages/$pkgId/status" '{"status":"PACKED"}' $whCN.headers
    if ($r.ok) {
        $pkgStatus = $r.data.data.warehouseCNStatus
        if ($pkgStatus -eq 'PACKED') {
            Log-Result 'PASS' "Package -> PACKED"
        } else {
            Log-Result 'WARN' "Package status = $pkgStatus, expected PACKED"
        }
    } else {
        Log-Result 'FAIL' "Package status change failed: HTTP $($r.code) $($r.error)"
    }
}

# ============================================================
# TEST 9: Order WAREHOUSE_CN -> PACKING
# ============================================================
Write-Host ""
Write-Host "=== TEST 9: WAREHOUSE_CN -> PACKING ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"PACKING","note":"Dang dong goi"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'PACKING') { Log-Result 'PASS' "WAREHOUSE_CN -> PACKING OK" }
    else { Log-Result 'FAIL' "Status = $st, expected PACKING" }
} else {
    Log-Result 'FAIL' "Transition failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 10: Order PACKING -> CONSOLIDATION
# ============================================================
Write-Host ""
Write-Host "=== TEST 10: PACKING -> CONSOLIDATION ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"CONSOLIDATION","note":"Da gop kien vao container"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'CONSOLIDATION') { Log-Result 'PASS' "PACKING -> CONSOLIDATION OK" }
    else { Log-Result 'FAIL' "Status = $st, expected CONSOLIDATION" }
} else {
    Log-Result 'FAIL' "Transition failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 11: Create container
# ============================================================
Write-Host ""
Write-Host "=== TEST 11: Create container ==="
$contPayload = '{"shippingRoute":"SEA","origin":"Yiwu Warehouse","destination":"Hanoi Warehouse"}'
$r = Api-Call 'POST' "$baseUrl/containers" $contPayload $xnk.headers
if ($r.ok) {
    $container = $r.data.data
    $containerId = $container.id
    $containerCode = $container.code
    Write-Host "  Container: $containerCode | status=$($container.status) | route=$($container.shippingRoute)"
    Log-Result 'PASS' "Container created: $containerCode"
} else {
    Log-Result 'FAIL' "Create container failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 12: Add packages to container
# ============================================================
Write-Host ""
Write-Host "=== TEST 12: Add packages to container ==="
if ($containerId -and $pkgIds.Count -gt 0) {
    $pkgIdsJson = ($pkgIds | ForEach-Object { "`"$_`"" }) -join ','
    $addPayload = "{`"packageIds`":[$pkgIdsJson]}"
    $r = Api-Call 'POST' "$baseUrl/containers/$containerId/add-packages" $addPayload $xnk.headers
    if ($r.ok) {
        Log-Result 'PASS' "Packages added to container"
    } else {
        Log-Result 'FAIL' "Add packages failed: HTTP $($r.code) $($r.error)"
    }
}

# ============================================================
# TEST 13: Container status: PLANNING -> LOADING -> IN_TRANSIT -> ARRIVED
# ============================================================
Write-Host ""
Write-Host "=== TEST 13: Container status transitions ==="
if ($containerId) {
    $containerTransitions = @('LOADING', 'IN_TRANSIT', 'ARRIVED', 'CUSTOMS', 'COMPLETED')
    foreach ($newStatus in $containerTransitions) {
        $r = Api-Call 'PATCH' "$baseUrl/containers/$containerId/status" "{`"status`":`"$newStatus`"}" $xnk.headers
        if ($r.ok) {
            $cs = $r.data.data.status
            if ($cs -eq $newStatus) {
                Log-Result 'PASS' "Container -> $newStatus"
            } else {
                Log-Result 'WARN' "Container status = $cs, expected $newStatus"
            }
        } else {
            Log-Result 'FAIL' "Container -> $newStatus failed: HTTP $($r.code) $($r.error)"
            break
        }
    }
}

# ============================================================
# TEST 14: Order CONSOLIDATION -> IN_TRANSIT
# ============================================================
Write-Host ""
Write-Host "=== TEST 14: Order CONSOLIDATION -> IN_TRANSIT ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"IN_TRANSIT","note":"Container da xuat phat"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'IN_TRANSIT') { Log-Result 'PASS' "CONSOLIDATION -> IN_TRANSIT OK" }
    else { Log-Result 'FAIL' "Status = $st, expected IN_TRANSIT" }
} else {
    Log-Result 'FAIL' "Transition failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 15: Order IN_TRANSIT -> CUSTOMS
# ============================================================
Write-Host ""
Write-Host "=== TEST 15: IN_TRANSIT -> CUSTOMS ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"CUSTOMS","note":"Container da den cang VN"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'CUSTOMS') { Log-Result 'PASS' "IN_TRANSIT -> CUSTOMS OK" }
    else { Log-Result 'FAIL' "Status = $st, expected CUSTOMS" }
} else {
    Log-Result 'FAIL' "Transition failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 16: Order CUSTOMS -> WAREHOUSE_VN
# ============================================================
Write-Host ""
Write-Host "=== TEST 16: CUSTOMS -> WAREHOUSE_VN ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"WAREHOUSE_VN","note":"Thong quan xong, hang ve kho VN"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'WAREHOUSE_VN') { Log-Result 'PASS' "CUSTOMS -> WAREHOUSE_VN OK" }
    else { Log-Result 'FAIL' "Status = $st, expected WAREHOUSE_VN" }
} else {
    Log-Result 'FAIL' "Transition failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 17: Receive packages at Warehouse VN
# ============================================================
Write-Host ""
Write-Host "=== TEST 17: Receive packages at Warehouse VN ==="
if ($containerId -and $pkgIds.Count -gt 0) {
    $pkgIdsJson = ($pkgIds | ForEach-Object { "`"$_`"" }) -join ','
    $vnRecPayload = "{`"containerId`":`"$containerId`",`"packageIds`":[$pkgIdsJson]}"
    $r = Api-Call 'POST' "$baseUrl/warehouse-vn/receive" $vnRecPayload $whVN.headers
    if ($r.ok) {
        $rcv = $r.data.data
        Write-Host "  Received: $($rcv.receivedCount) packages from container $($rcv.containerCode)"
        Log-Result 'PASS' "Warehouse VN received $($rcv.receivedCount) packages"
    } else {
        Log-Result 'FAIL' "WH VN receive failed: HTTP $($r.code) $($r.error)"
    }
}

# ============================================================
# TEST 18: Sort packages (RECEIVED -> SORTED -> READY)
# ============================================================
Write-Host ""
Write-Host "=== TEST 18: Sort packages at Warehouse VN ==="
if ($pkgIds.Count -gt 0) {
    $pkgIdsJson = ($pkgIds | ForEach-Object { "`"$_`"" }) -join ','
    # RECEIVED -> SORTED
    $sortPayload = "{`"packageIds`":[$pkgIdsJson],`"status`":`"SORTED`"}"
    $r = Api-Call 'PATCH' "$baseUrl/warehouse-vn/packages/sort" $sortPayload $whVN.headers
    if ($r.ok) {
        Log-Result 'PASS' "Packages sorted (SORTED)"
    } else {
        Log-Result 'FAIL' "Sort SORTED failed: HTTP $($r.code) $($r.error)"
    }

    # SORTED -> READY
    $readyPayload = "{`"packageIds`":[$pkgIdsJson],`"status`":`"READY`"}"
    $r = Api-Call 'PATCH' "$baseUrl/warehouse-vn/packages/sort" $readyPayload $whVN.headers
    if ($r.ok) {
        Log-Result 'PASS' "Packages ready (READY)"
    } else {
        Log-Result 'FAIL' "Sort READY failed: HTTP $($r.code) $($r.error)"
    }
}

# ============================================================
# TEST 19: Order WAREHOUSE_VN -> DELIVERING
# ============================================================
Write-Host ""
Write-Host "=== TEST 19: WAREHOUSE_VN -> DELIVERING ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"DELIVERING","note":"Dang giao hang cho khach"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'DELIVERING') { Log-Result 'PASS' "WAREHOUSE_VN -> DELIVERING OK" }
    else { Log-Result 'FAIL' "Status = $st, expected DELIVERING" }
} else {
    Log-Result 'FAIL' "Transition failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 20: Order DELIVERING -> SETTLEMENT
# ============================================================
Write-Host ""
Write-Host "=== TEST 20: DELIVERING -> SETTLEMENT ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"SETTLEMENT","note":"Da giao hang, doi quyet toan"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'SETTLEMENT') { Log-Result 'PASS' "DELIVERING -> SETTLEMENT OK" }
    else { Log-Result 'FAIL' "Status = $st, expected SETTLEMENT" }
} else {
    Log-Result 'FAIL' "Transition failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 21: Order SETTLEMENT -> COMPLETED
# ============================================================
Write-Host ""
Write-Host "=== TEST 21: SETTLEMENT -> COMPLETED ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"COMPLETED","note":"Quyet toan xong, hoan tat"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'COMPLETED') { Log-Result 'PASS' "SETTLEMENT -> COMPLETED OK" }
    else { Log-Result 'FAIL' "Status = $st, expected COMPLETED" }
} else {
    Log-Result 'FAIL' "Transition failed: HTTP $($r.code) $($r.error)"
}

# ============================================================
# TEST 22: COMPLETED is terminal (cannot change)
# ============================================================
Write-Host ""
Write-Host "=== TEST 22: COMPLETED is terminal ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"DELIVERING"}' $sale.headers
if (-not $r.ok -and $r.code -eq 400) {
    Log-Result 'PASS' "COMPLETED is terminal - transition blocked (400)"
} else {
    Log-Result 'FAIL' "COMPLETED should be terminal, got $($r.code)"
}

# ============================================================
# TEST 23: Cancel order test (new order)
# ============================================================
Write-Host ""
Write-Host "=== TEST 23: Cancel order (CONSULTING stage) ==="
$cancelPayload = @"
{
  "customerId": "$($vipCust.id)",
  "serviceType": "VCT",
  "branch": "HN",
  "items": [{"productName": "Test cancel", "quantity": 1, "unitPrice": 10, "currency": "CNY"}]
}
"@
$r = Api-Call 'POST' "$baseUrl/orders" $cancelPayload $sale.headers
if ($r.ok) {
    $cancelOrderId = $r.data.data.id
    $cancelOrderCode = $r.data.data.code
    Write-Host "  Created order for cancel test: $cancelOrderCode"

    $cancelBody = '{"reason":"Khach hang yeu cau huy don vi thay doi nhu cau kinh doanh"}'
    $r = Api-Call 'POST' "$baseUrl/orders/$cancelOrderId/cancel" $cancelBody $sale.headers
    if ($r.ok) {
        $cancelResult = $r.data.data
        $cancelStatus = $cancelResult.status
        Write-Host "  Cancel result status: $cancelStatus"
        if ($cancelStatus -eq 'CANCELLED' -or $cancelStatus -eq 'PENDING_APPROVAL') {
            Log-Result 'PASS' "Cancel order OK - $cancelStatus"
        } else {
            Log-Result 'WARN' "Cancel returned unexpected status: $cancelStatus"
        }
    } else {
        Log-Result 'FAIL' "Cancel failed: HTTP $($r.code) $($r.error)"
    }
}

# ============================================================
# TEST 24: Order 360 view
# ============================================================
Write-Host ""
Write-Host "=== TEST 24: Order 360 view ==="
$r = Api-Call 'GET' "$baseUrl/orders/$orderId/360" $null $sale.headers
if ($r.ok) {
    $view360 = $r.data.data
    Write-Host "  Order: $($view360.code) | status=$($view360.status)"
    Write-Host "  Packages: $($view360.packages.Count)" 2>$null
    Write-Host "  Status history: $($view360.statusHistory.Count) entries" 2>$null
    Log-Result 'PASS' "Order 360 view OK"
} else {
    Log-Result 'WARN' "Order 360 view: HTTP $($r.code)"
}

# ============================================================
# SUMMARY
# ============================================================
Write-Host ""
Write-Host "================================================================"
Write-Host "  TONG KET TEST-ORD-002: Full Lifecycle"
Write-Host "================================================================"
Write-Host "  PASS: $passCount"
Write-Host "  FAIL: $failCount"
Write-Host "  WARN: $warnCount"
Write-Host ""

# Print lifecycle completed
Write-Host "  Lifecycle: CONSULTING -> QUOTATION -> SOURCING"
Write-Host "           -> WAREHOUSE_CN -> PACKING -> CONSOLIDATION"
Write-Host "           -> IN_TRANSIT -> CUSTOMS -> WAREHOUSE_VN"
Write-Host "           -> DELIVERING -> SETTLEMENT -> COMPLETED"
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED"
} else {
    Write-Host "  RESULT: $failCount TESTS FAILED"
}
Write-Host "================================================================"
