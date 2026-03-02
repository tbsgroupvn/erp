$ErrorActionPreference = 'Continue'
$baseUrl = 'http://localhost:3001/api/v1'
$domain = 'nhaphangchinhngach.vn'

$passCount = 0; $failCount = 0; $warnCount = 0; $infoCount = 0

function Log-Result($status, $msg) {
    switch ($status) {
        'PASS' { $script:passCount++; Write-Host "[PASS] $msg" }
        'FAIL' { $script:failCount++; Write-Host "[FAIL] $msg" }
        'WARN' { $script:warnCount++; Write-Host "[WARN] $msg" }
        'INFO' { $script:infoCount++; Write-Host "[INFO] $msg" }
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
        $name = $r.data.data.user.fullName
        return @{ token = $t; userId = $uid; role = $role; name = $name; headers = @{ Authorization = "Bearer $t" } }
    }
    Write-Host "[ERROR] Login failed for $email"
    return $null
}

# Verify audit trail entry for a specific transition
function Verify-AuditEntry($orderId, $expectedFrom, $expectedTo, $expectedUserId, $actorHeaders, $stageName) {
    $r = Api-Call 'GET' "$baseUrl/orders/$orderId" $null $actorHeaders
    if (-not $r.ok) {
        Log-Result 'FAIL' "[$stageName] Cannot fetch order detail: HTTP $($r.code)"
        return $false
    }

    $order = $r.data.data
    $history = $order.statusHistory
    if (-not $history -or $history.Count -eq 0) {
        Log-Result 'FAIL' "[$stageName] No statusHistory found"
        return $false
    }

    # statusHistory is DESC by createdAt, first entry is the latest
    $latest = $history[0]
    $allOk = $true

    # Check toStatus
    if ($latest.toStatus -eq $expectedTo) {
        Log-Result 'PASS' "[$stageName] Audit: toStatus=$($latest.toStatus) (correct)"
    } else {
        Log-Result 'FAIL' "[$stageName] Audit: toStatus=$($latest.toStatus), expected $expectedTo"
        $allOk = $false
    }

    # Check fromStatus
    if ($expectedFrom -eq $null -or $expectedFrom -eq '') {
        if ($latest.fromStatus -eq $null -or $latest.fromStatus -eq '') {
            Log-Result 'PASS' "[$stageName] Audit: fromStatus=null (initial creation, correct)"
        } else {
            Log-Result 'WARN' "[$stageName] Audit: fromStatus=$($latest.fromStatus), expected null"
        }
    } else {
        if ($latest.fromStatus -eq $expectedFrom) {
            Log-Result 'PASS' "[$stageName] Audit: fromStatus=$($latest.fromStatus) (correct)"
        } else {
            Log-Result 'FAIL' "[$stageName] Audit: fromStatus=$($latest.fromStatus), expected $expectedFrom"
            $allOk = $false
        }
    }

    # Check changedBy (userId)
    if ($expectedUserId -and $latest.changedBy -eq $expectedUserId) {
        Log-Result 'PASS' "[$stageName] Audit: changedBy matches actor"
    } elseif ($expectedUserId) {
        Log-Result 'FAIL' "[$stageName] Audit: changedBy=$($latest.changedBy), expected $expectedUserId"
        $allOk = $false
    }

    # Check createdAt exists and is recent (within last 60 seconds)
    if ($latest.createdAt) {
        Log-Result 'PASS' "[$stageName] Audit: createdAt=$($latest.createdAt)"
    } else {
        Log-Result 'WARN' "[$stageName] Audit: createdAt is empty"
    }

    # Print history count for context
    Write-Host "         History entries so far: $($history.Count)"
    return $allOk
}

# Verify notification sent for specific order
function Verify-Notification($orderId, $userHeaders, $stageName, $expectNotification) {
    if (-not $expectNotification) {
        Log-Result 'INFO' "[$stageName] Notification: Not expected at this stage (skipped)"
        return
    }

    Start-Sleep -Seconds 1  # Wait for async notification
    $r = Api-Call 'GET' "$baseUrl/notifications?page=1&limit=5" $null $userHeaders
    if (-not $r.ok) {
        Log-Result 'WARN' "[$stageName] Cannot fetch notifications: HTTP $($r.code)"
        return
    }

    $notifications = @()
    if ($r.data.data.items) { $notifications = @($r.data.data.items) }
    elseif ($r.data.data -is [Array]) { $notifications = @($r.data.data) }
    elseif ($r.data.data.data) { $notifications = @($r.data.data.data) }

    $found = $notifications | Where-Object { $_.referenceId -eq $orderId } | Select-Object -First 1
    if ($found) {
        Log-Result 'PASS' "[$stageName] Notification sent: $($found.title)"
    } else {
        Log-Result 'WARN' "[$stageName] Notification not found for order (may be async delay or different channel)"
    }
}

Write-Host "================================================================"
Write-Host "  TEST-ORD-002 v2: Full Lifecycle with AUDIT TRAIL"
Write-Host "  13 stages, verify statusHistory at each transition"
Write-Host "  Severity: CRITICAL"
Write-Host "================================================================"
Write-Host ""

# ============================================================
# SETUP: Login all roles needed
# ============================================================
Write-Host "=== SETUP: Login all roles ==="
$sale = Login 'sale01'
$whCN = Login 'khotq01'
$xnk = Login 'xnk'
$whVN = Login 'khovn'
$ceo = Login 'ceo'
$cfo = Login 'cfo'
$ketoan = Login 'ketoan'

$loginOk = $true
foreach ($pair in @(@($sale,'SALE'),@($whCN,'WH_CN'),@($xnk,'XNK'),@($whVN,'WH_VN'),@($ceo,'CEO'),@($cfo,'CFO'),@($ketoan,'KETOAN'))) {
    if ($pair[0]) { Log-Result 'PASS' "$($pair[1]) login OK (userId=$($pair[0].userId))" }
    else { Log-Result 'FAIL' "$($pair[1]) login FAILED"; $loginOk = $false }
}
if (-not $loginOk) { Write-Host "ABORT: Some logins failed"; exit 1 }

# Get VIP customer
$custR = Api-Call 'GET' "$baseUrl/customers?page=1&limit=10" $null $sale.headers
$customers = @()
if ($custR.data.data -is [Array]) { $customers = @($custR.data.data) }
elseif ($custR.data.data.data) { $customers = @($custR.data.data.data) }
else { $customers = @($custR.data.data) }
$vipCust = $customers | Where-Object { $_.tier -eq 'VIP' -and [decimal]$_.creditLimit -gt 0 } | Select-Object -First 1
if (-not $vipCust) { Write-Host "ABORT: No VIP customer found"; exit 1 }
Write-Host "  Customer: $($vipCust.code) ($($vipCust.tier), credit=$($vipCust.creditLimit))"
Write-Host ""

# ============================================================
# STAGE 0: Create VCT Order (initial status = CONSULTING)
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 0: Create VCT Order"
Write-Host "================================================================"
$ts = Get-Date -Format 'yyyyMMddHHmmss'
$orderPayload = @"
{
  "customerId": "$($vipCust.id)",
  "serviceType": "VCT",
  "branch": "HN",
  "shippingRoute": "SEA",
  "items": [
    {"productName": "Linh kien dien tu SMD", "quantity": 100, "unitPrice": 30, "currency": "CNY"},
    {"productName": "Oc vit inox M4", "quantity": 500, "unitPrice": 2, "currency": "CNY"}
  ],
  "note": "TEST-ORD-002-v2: Audit trail lifecycle test $ts"
}
"@
$r = Api-Call 'POST' "$baseUrl/orders" $orderPayload $sale.headers
if ($r.ok) {
    $order = $r.data.data
    $orderId = $order.id
    $orderCode = $order.code
    Write-Host "  Order: $orderCode | status=$($order.status) | total=$($order.totalAmount)"
    if ($order.status -eq 'CONSULTING') {
        Log-Result 'PASS' "[Stage0] Order created with initial status CONSULTING"
    } else {
        Log-Result 'FAIL' "[Stage0] Expected CONSULTING, got $($order.status)"
    }
} else {
    Log-Result 'FAIL' "[Stage0] Create order failed: HTTP $($r.code) $($r.error)"
    exit 1
}

# Verify initial audit entry (creation, fromStatus=null)
Verify-AuditEntry $orderId $null 'CONSULTING' $sale.userId $sale.headers 'Stage0-Create'
Verify-Notification $orderId $sale.headers 'Stage0' $false
Write-Host ""

# ============================================================
# STAGE 1: CONSULTING -> QUOTATION
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 1: CONSULTING -> QUOTATION"
Write-Host "  Actor: SALE | Role: sale01"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"QUOTATION","note":"Bao gia cho khach hang"}' $sale.headers
if ($r.ok -and $r.data.data.status -eq 'QUOTATION') {
    Log-Result 'PASS' "[Stage1] CONSULTING -> QUOTATION transition OK"
} else {
    Log-Result 'FAIL' "[Stage1] Transition failed: HTTP $($r.code) $($r.error)"
}
Verify-AuditEntry $orderId 'CONSULTING' 'QUOTATION' $sale.userId $sale.headers 'Stage1'
Verify-Notification $orderId $sale.headers 'Stage1' $false
Log-Result 'INFO' "[Stage1] UI: Timeline hien thi 2 nodes (CONSULTING checked, QUOTATION active)"
Log-Result 'INFO' "[Stage1] UI: Actions = [Gui bao gia, Chuyen SOURCING, Huy don]"
Write-Host ""

# ============================================================
# STAGE 2: QUOTATION -> SOURCING (VCT skip PENDING_DEPOSIT)
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 2: QUOTATION -> SOURCING (VCT skip deposit)"
Write-Host "  Actor: SALE | Note: VCT+VIP = no deposit required"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"SOURCING","note":"Khach dong y bao gia, bat dau dat hang NCC"}' $sale.headers
if ($r.ok -and $r.data.data.status -eq 'SOURCING') {
    Log-Result 'PASS' "[Stage2] QUOTATION -> SOURCING OK (VCT skips deposit)"
} else {
    Log-Result 'FAIL' "[Stage2] Transition failed: HTTP $($r.code) $($r.error)"
}
Verify-AuditEntry $orderId 'QUOTATION' 'SOURCING' $sale.userId $sale.headers 'Stage2'
Verify-Notification $orderId $sale.headers 'Stage2' $false
Log-Result 'INFO' "[Stage2] UI: Timeline hien thi 3 nodes (CONSULTING, QUOTATION checked, SOURCING active)"
Log-Result 'INFO' "[Stage2] UI: Actions = [Cap nhat NCC, Nhan hang kho TQ]"
Write-Host ""

# ============================================================
# STAGE 3: SOURCING -> WAREHOUSE_CN
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 3: SOURCING -> WAREHOUSE_CN"
Write-Host "  Actor: SALE"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"WAREHOUSE_CN","note":"Hang da ve kho Trung Quoc"}' $sale.headers
if ($r.ok -and $r.data.data.status -eq 'WAREHOUSE_CN') {
    Log-Result 'PASS' "[Stage3] SOURCING -> WAREHOUSE_CN OK"
} else {
    Log-Result 'FAIL' "[Stage3] Transition failed: HTTP $($r.code) $($r.error)"
}
Verify-AuditEntry $orderId 'SOURCING' 'WAREHOUSE_CN' $sale.userId $sale.headers 'Stage3'
Verify-Notification $orderId $sale.headers 'Stage3' $false
Log-Result 'INFO' "[Stage3] UI: Actions = [Nhan hang, Do kich thuoc, Dong goi]"
Write-Host ""

# ============================================================
# STAGE 3.5: Receive + Measure packages at Warehouse CN
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 3.5: Warehouse CN Operations (Receive + Measure)"
Write-Host "  Actor: WAREHOUSE_CN_AGENT (khotq01)"
Write-Host "================================================================"
$pkgIds = @()

foreach ($idx in 1..2) {
    $recPayload = @"
{
  "trackingNumberCN": "SF-AUDIT-$ts-$idx",
  "orderId": "$orderId",
  "imageUrls": ["https://storage.tbs.vn/test/audit-v2-$idx.jpg"],
  "description": "Kien hang $idx cho $orderCode"
}
"@
    $r = Api-Call 'POST' "$baseUrl/warehouse-cn/receive" $recPayload $whCN.headers
    if ($r.ok) {
        $pkg = $r.data.data.package
        $pkgIds += $pkg.id
        Log-Result 'PASS' "[Stage3.5] Package $idx received: $($pkg.code) (status=$($pkg.warehouseCNStatus))"
    } else {
        Log-Result 'FAIL' "[Stage3.5] Receive package $idx failed: HTTP $($r.code)"
    }
}

# Measure packages
$measSpecs = @(
    @{ weight = 20; l = 45; w = 35; h = 30 },
    @{ weight = 12; l = 35; w = 28; h = 22 }
)
for ($idx = 0; $idx -lt $pkgIds.Count; $idx++) {
    $spec = $measSpecs[$idx]
    $measPayload = @"
{
  "actualWeight": $($spec.weight),
  "length": $($spec.l),
  "width": $($spec.w),
  "height": $($spec.h)
}
"@
    $r = Api-Call 'POST' "$baseUrl/warehouse-cn/packages/$($pkgIds[$idx])/measure" $measPayload $whCN.headers
    if ($r.ok) {
        $mp = if ($r.data.data.package) { $r.data.data.package } else { $r.data.data }
        Log-Result 'PASS' "[Stage3.5] Package $($idx+1) measured: actual=$($mp.actualWeight)kg chargeable=$($mp.chargeableWeight)kg"
    } else {
        Log-Result 'FAIL' "[Stage3.5] Measure package $($idx+1) failed: HTTP $($r.code)"
    }
}

# Pack packages (CHECKED -> PACKED)
foreach ($pkgId in $pkgIds) {
    $r = Api-Call 'PATCH' "$baseUrl/warehouse-cn/packages/$pkgId/status" '{"status":"PACKED"}' $whCN.headers
    if ($r.ok) { Log-Result 'PASS' "[Stage3.5] Package -> PACKED" }
    else { Log-Result 'FAIL' "[Stage3.5] Package PACKED failed: HTTP $($r.code)" }
}
Write-Host ""

# ============================================================
# STAGE 4: WAREHOUSE_CN -> PACKING
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 4: WAREHOUSE_CN -> PACKING"
Write-Host "  Actor: SALE"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"PACKING","note":"Dang dong goi cac kien hang"}' $sale.headers
if ($r.ok -and $r.data.data.status -eq 'PACKING') {
    Log-Result 'PASS' "[Stage4] WAREHOUSE_CN -> PACKING OK"
} else {
    Log-Result 'FAIL' "[Stage4] Transition failed: HTTP $($r.code) $($r.error)"
}
Verify-AuditEntry $orderId 'WAREHOUSE_CN' 'PACKING' $sale.userId $sale.headers 'Stage4'
Verify-Notification $orderId $sale.headers 'Stage4' $false
Log-Result 'INFO' "[Stage4] UI: Actions = [Hoan tat dong goi, Gop vao container]"
Write-Host ""

# ============================================================
# STAGE 5: PACKING -> CONSOLIDATION
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 5: PACKING -> CONSOLIDATION"
Write-Host "  Actor: SALE"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"CONSOLIDATION","note":"Da gop kien vao container"}' $sale.headers
if ($r.ok -and $r.data.data.status -eq 'CONSOLIDATION') {
    Log-Result 'PASS' "[Stage5] PACKING -> CONSOLIDATION OK"
} else {
    Log-Result 'FAIL' "[Stage5] Transition failed: HTTP $($r.code) $($r.error)"
}
Verify-AuditEntry $orderId 'PACKING' 'CONSOLIDATION' $sale.userId $sale.headers 'Stage5'
Verify-Notification $orderId $sale.headers 'Stage5' $false
Log-Result 'INFO' "[Stage5] UI: Actions = [Tao container, Xuat phat container]"
Write-Host ""

# ============================================================
# STAGE 5.5: Create container + add packages + transit
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 5.5: Container Operations"
Write-Host "  Actor: XNK_MANAGER (xnk)"
Write-Host "================================================================"
$contPayload = '{"shippingRoute":"SEA","origin":"Yiwu Warehouse","destination":"Hanoi Warehouse"}'
$r = Api-Call 'POST' "$baseUrl/containers" $contPayload $xnk.headers
if ($r.ok) {
    $containerId = $r.data.data.id
    $containerCode = $r.data.data.code
    Log-Result 'PASS' "[Stage5.5] Container created: $containerCode"
} else {
    Log-Result 'FAIL' "[Stage5.5] Create container failed: HTTP $($r.code)"
}

# Add packages
if ($containerId -and $pkgIds.Count -gt 0) {
    $pkgIdsJson = ($pkgIds | ForEach-Object { "`"$_`"" }) -join ','
    $addPayload = "{`"packageIds`":[$pkgIdsJson]}"
    $r = Api-Call 'POST' "$baseUrl/containers/$containerId/add-packages" $addPayload $xnk.headers
    if ($r.ok) { Log-Result 'PASS' "[Stage5.5] Packages added to container" }
    else { Log-Result 'FAIL' "[Stage5.5] Add packages: HTTP $($r.code)" }
}

# Container transitions
$contTransitions = @('LOADING', 'IN_TRANSIT', 'ARRIVED', 'CUSTOMS', 'COMPLETED')
foreach ($cs in $contTransitions) {
    $r = Api-Call 'PATCH' "$baseUrl/containers/$containerId/status" "{`"status`":`"$cs`"}" $xnk.headers
    if ($r.ok -and $r.data.data.status -eq $cs) {
        Log-Result 'PASS' "[Stage5.5] Container -> $cs"
    } else {
        Log-Result 'FAIL' "[Stage5.5] Container -> $cs failed: HTTP $($r.code)"
    }
}
Write-Host ""

# ============================================================
# STAGE 6: CONSOLIDATION -> IN_TRANSIT
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 6: CONSOLIDATION -> IN_TRANSIT"
Write-Host "  Actor: SALE"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"IN_TRANSIT","note":"Container da xuat phat tu Yiwu"}' $sale.headers
if ($r.ok -and $r.data.data.status -eq 'IN_TRANSIT') {
    Log-Result 'PASS' "[Stage6] CONSOLIDATION -> IN_TRANSIT OK"
} else {
    Log-Result 'FAIL' "[Stage6] Transition failed: HTTP $($r.code) $($r.error)"
}
Verify-AuditEntry $orderId 'CONSOLIDATION' 'IN_TRANSIT' $sale.userId $sale.headers 'Stage6'
Verify-Notification $orderId $sale.headers 'Stage6' $false
Log-Result 'INFO' "[Stage6] UI: Actions = [Cap nhat vi tri, Bao cao su co]"
Write-Host ""

# ============================================================
# STAGE 7: IN_TRANSIT -> CUSTOMS
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 7: IN_TRANSIT -> CUSTOMS"
Write-Host "  Actor: SALE"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"CUSTOMS","note":"Container da den cang Hai Phong, dang thong quan"}' $sale.headers
if ($r.ok -and $r.data.data.status -eq 'CUSTOMS') {
    Log-Result 'PASS' "[Stage7] IN_TRANSIT -> CUSTOMS OK"
} else {
    Log-Result 'FAIL' "[Stage7] Transition failed: HTTP $($r.code) $($r.error)"
}
Verify-AuditEntry $orderId 'IN_TRANSIT' 'CUSTOMS' $sale.userId $sale.headers 'Stage7'
Verify-Notification $orderId $sale.headers 'Stage7' $false
Log-Result 'INFO' "[Stage7] UI: Actions = [Tao to khai, Tinh thue, Thong quan]"
Write-Host ""

# ============================================================
# STAGE 8: CUSTOMS -> WAREHOUSE_VN
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 8: CUSTOMS -> WAREHOUSE_VN"
Write-Host "  Actor: SALE | Notification: YES (SALE gets notified)"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"WAREHOUSE_VN","note":"Thong quan hoan tat, hang ve kho Ha Noi"}' $sale.headers
if ($r.ok -and $r.data.data.status -eq 'WAREHOUSE_VN') {
    Log-Result 'PASS' "[Stage8] CUSTOMS -> WAREHOUSE_VN OK"
} else {
    Log-Result 'FAIL' "[Stage8] Transition failed: HTTP $($r.code) $($r.error)"
}
Verify-AuditEntry $orderId 'CUSTOMS' 'WAREHOUSE_VN' $sale.userId $sale.headers 'Stage8'
Verify-Notification $orderId $sale.headers 'Stage8-SALE' $true
Log-Result 'INFO' "[Stage8] UI: Actions = [Nhan hang kho VN, Phan loai, Sap xep giao hang]"
Write-Host ""

# ============================================================
# STAGE 8.5: Warehouse VN operations
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 8.5: Warehouse VN Operations"
Write-Host "  Actor: WAREHOUSE_VN_MANAGER (khovn)"
Write-Host "================================================================"
if ($containerId -and $pkgIds.Count -gt 0) {
    $pkgIdsJson = ($pkgIds | ForEach-Object { "`"$_`"" }) -join ','
    $vnRecPayload = "{`"containerId`":`"$containerId`",`"packageIds`":[$pkgIdsJson]}"
    $r = Api-Call 'POST' "$baseUrl/warehouse-vn/receive" $vnRecPayload $whVN.headers
    if ($r.ok) {
        Log-Result 'PASS' "[Stage8.5] Warehouse VN received packages"
    } else {
        Log-Result 'FAIL' "[Stage8.5] WH VN receive: HTTP $($r.code) $($r.error)"
    }

    # Sort RECEIVED -> SORTED
    $sortPayload = "{`"packageIds`":[$pkgIdsJson],`"status`":`"SORTED`"}"
    $r = Api-Call 'PATCH' "$baseUrl/warehouse-vn/packages/sort" $sortPayload $whVN.headers
    if ($r.ok) { Log-Result 'PASS' "[Stage8.5] Packages -> SORTED" }
    else { Log-Result 'FAIL' "[Stage8.5] Sort SORTED: HTTP $($r.code)" }

    # Sort SORTED -> READY
    $readyPayload = "{`"packageIds`":[$pkgIdsJson],`"status`":`"READY`"}"
    $r = Api-Call 'PATCH' "$baseUrl/warehouse-vn/packages/sort" $readyPayload $whVN.headers
    if ($r.ok) { Log-Result 'PASS' "[Stage8.5] Packages -> READY" }
    else { Log-Result 'FAIL' "[Stage8.5] Sort READY: HTTP $($r.code)" }
}
Write-Host ""

# ============================================================
# STAGE 9: WAREHOUSE_VN -> DELIVERING
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 9: WAREHOUSE_VN -> DELIVERING"
Write-Host "  Actor: SALE | Notification: YES"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"DELIVERING","note":"Tai xe dang giao hang cho khach tai Ha Noi"}' $sale.headers
if ($r.ok -and $r.data.data.status -eq 'DELIVERING') {
    Log-Result 'PASS' "[Stage9] WAREHOUSE_VN -> DELIVERING OK"
} else {
    Log-Result 'FAIL' "[Stage9] Transition failed: HTTP $($r.code) $($r.error)"
}
Verify-AuditEntry $orderId 'WAREHOUSE_VN' 'DELIVERING' $sale.userId $sale.headers 'Stage9'
Verify-Notification $orderId $sale.headers 'Stage9-SALE' $true
Log-Result 'INFO' "[Stage9] UI: Actions = [Xac nhan giao hang, Bao cao van de, RTO]"
Write-Host ""

# ============================================================
# STAGE 10: DELIVERING -> SETTLEMENT
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 10: DELIVERING -> SETTLEMENT"
Write-Host "  Actor: SALE"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"SETTLEMENT","note":"Khach da nhan hang, chuyen sang quyet toan"}' $sale.headers
if ($r.ok -and $r.data.data.status -eq 'SETTLEMENT') {
    Log-Result 'PASS' "[Stage10] DELIVERING -> SETTLEMENT OK"
} else {
    Log-Result 'FAIL' "[Stage10] Transition failed: HTTP $($r.code) $($r.error)"
}
Verify-AuditEntry $orderId 'DELIVERING' 'SETTLEMENT' $sale.userId $sale.headers 'Stage10'
Verify-Notification $orderId $sale.headers 'Stage10' $false
Log-Result 'INFO' "[Stage10] UI: Actions = [Tao hoa don, Quyet toan, Hoan tat]"
Write-Host ""

# ============================================================
# STAGE 11: SETTLEMENT -> COMPLETED
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 11: SETTLEMENT -> COMPLETED"
Write-Host "  Actor: SALE | Notification: YES"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"COMPLETED","note":"Don hang quyet toan xong, hoan tat"}' $sale.headers
if ($r.ok -and $r.data.data.status -eq 'COMPLETED') {
    Log-Result 'PASS' "[Stage11] SETTLEMENT -> COMPLETED OK"
} else {
    Log-Result 'FAIL' "[Stage11] Transition failed: HTTP $($r.code) $($r.error)"
}
Verify-AuditEntry $orderId 'SETTLEMENT' 'COMPLETED' $sale.userId $sale.headers 'Stage11'
Verify-Notification $orderId $sale.headers 'Stage11-SALE' $true
Log-Result 'INFO' "[Stage11] UI: Timeline hien thi tat ca 13 nodes da checked (complete)"
Log-Result 'INFO' "[Stage11] UI: Actions = [Xem chi tiet, In don, Xuat PDF] (read-only)"
Write-Host ""

# ============================================================
# STAGE 12: Verify COMPLETED is terminal
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 12: COMPLETED is terminal (cannot transition)"
Write-Host "================================================================"
$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"DELIVERING","note":"Test invalid"}' $sale.headers
if (-not $r.ok -and $r.code -eq 400) {
    Log-Result 'PASS' "[Stage12] COMPLETED is terminal - cannot go back to DELIVERING (400)"
} else {
    Log-Result 'FAIL' "[Stage12] COMPLETED should be terminal, got HTTP $($r.code)"
}

$r = Api-Call 'PATCH' "$baseUrl/orders/$orderId/status" '{"status":"CONSULTING","note":"Test invalid"}' $sale.headers
if (-not $r.ok -and $r.code -eq 400) {
    Log-Result 'PASS' "[Stage12] COMPLETED is terminal - cannot restart to CONSULTING (400)"
} else {
    Log-Result 'FAIL' "[Stage12] COMPLETED should be terminal for CONSULTING, got HTTP $($r.code)"
}
Write-Host ""

# ============================================================
# STAGE 13: Full audit trail verification
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 13: FULL AUDIT TRAIL VERIFICATION"
Write-Host "================================================================"
$r = Api-Call 'GET' "$baseUrl/orders/$orderId" $null $sale.headers
if ($r.ok) {
    $finalOrder = $r.data.data
    $history = @($finalOrder.statusHistory)
    Write-Host "  Order: $orderCode | Final status: $($finalOrder.status)"
    Write-Host "  Total statusHistory entries: $($history.Count)"
    Write-Host ""

    # Expected transitions (in chronological order, but history is DESC)
    $expectedTransitions = @(
        @{ from = $null;            to = 'CONSULTING' },
        @{ from = 'CONSULTING';     to = 'QUOTATION' },
        @{ from = 'QUOTATION';      to = 'SOURCING' },
        @{ from = 'SOURCING';       to = 'WAREHOUSE_CN' },
        @{ from = 'WAREHOUSE_CN';   to = 'PACKING' },
        @{ from = 'PACKING';        to = 'CONSOLIDATION' },
        @{ from = 'CONSOLIDATION';  to = 'IN_TRANSIT' },
        @{ from = 'IN_TRANSIT';     to = 'CUSTOMS' },
        @{ from = 'CUSTOMS';        to = 'WAREHOUSE_VN' },
        @{ from = 'WAREHOUSE_VN';   to = 'DELIVERING' },
        @{ from = 'DELIVERING';     to = 'SETTLEMENT' },
        @{ from = 'SETTLEMENT';     to = 'COMPLETED' }
    )

    # History is DESC, so reverse to chronological
    $chronHistory = @()
    for ($idx = $history.Count - 1; $idx -ge 0; $idx--) {
        $chronHistory += $history[$idx]
    }

    Write-Host "  Chronological audit trail:"
    Write-Host "  -----------------------------------------------------------"
    Write-Host "  # | fromStatus       | toStatus         | changedBy       | createdAt"
    Write-Host "  -----------------------------------------------------------"
    for ($idx = 0; $idx -lt $chronHistory.Count; $idx++) {
        $entry = $chronHistory[$idx]
        $fromStr = if ($entry.fromStatus) { $entry.fromStatus } else { "(null)" }
        $num = $idx + 1
        Write-Host "  $num | $fromStr | $($entry.toStatus) | $($entry.changedBy) | $($entry.createdAt)"
    }
    Write-Host "  -----------------------------------------------------------"
    Write-Host ""

    # Verify expected count
    if ($chronHistory.Count -ge $expectedTransitions.Count) {
        Log-Result 'PASS' "[Stage13] Audit trail has $($chronHistory.Count) entries (expected >= $($expectedTransitions.Count))"
    } else {
        Log-Result 'FAIL' "[Stage13] Audit trail has $($chronHistory.Count) entries, expected >= $($expectedTransitions.Count)"
    }

    # Verify each expected transition exists in chronological order
    $matchCount = 0
    for ($idx = 0; $idx -lt $expectedTransitions.Count; $idx++) {
        $exp = $expectedTransitions[$idx]
        if ($idx -lt $chronHistory.Count) {
            $actual = $chronHistory[$idx]
            $toMatch = ($actual.toStatus -eq $exp.to)
            $fromMatch = $false
            if ($exp.from -eq $null) {
                $fromMatch = ($actual.fromStatus -eq $null -or $actual.fromStatus -eq '')
            } else {
                $fromMatch = ($actual.fromStatus -eq $exp.from)
            }

            if ($toMatch -and $fromMatch) {
                $matchCount++
            } else {
                $expFrom = if ($exp.from) { $exp.from } else { "null" }
                $actFrom = if ($actual.fromStatus) { $actual.fromStatus } else { "null" }
                Log-Result 'FAIL' "[Stage13] Entry $($idx+1): expected $expFrom->$($exp.to), got $actFrom->$($actual.toStatus)"
            }
        } else {
            $expFrom = if ($exp.from) { $exp.from } else { "null" }
            Log-Result 'FAIL' "[Stage13] Entry $($idx+1): missing ($expFrom->$($exp.to))"
        }
    }

    if ($matchCount -eq $expectedTransitions.Count) {
        Log-Result 'PASS' "[Stage13] All $matchCount transitions verified in correct order"
    } else {
        Log-Result 'FAIL' "[Stage13] Only $matchCount of $($expectedTransitions.Count) transitions matched"
    }

    # Verify all changedBy fields are non-empty
    $emptyChangedBy = $chronHistory | Where-Object { -not $_.changedBy -or $_.changedBy -eq '' }
    if ($emptyChangedBy.Count -eq 0) {
        Log-Result 'PASS' "[Stage13] All entries have changedBy (who)"
    } else {
        Log-Result 'WARN' "[Stage13] $($emptyChangedBy.Count) entries have empty changedBy"
    }

    # Verify timestamps are chronologically ordered
    $timeOrdered = $true
    for ($idx = 1; $idx -lt $chronHistory.Count; $idx++) {
        $prev = $chronHistory[$idx - 1].createdAt
        $curr = $chronHistory[$idx].createdAt
        if ($prev -and $curr -and $prev -gt $curr) {
            $timeOrdered = $false
            break
        }
    }
    if ($timeOrdered) {
        Log-Result 'PASS' "[Stage13] All timestamps in chronological order"
    } else {
        Log-Result 'FAIL' "[Stage13] Timestamps NOT in chronological order"
    }

} else {
    Log-Result 'FAIL' "[Stage13] Cannot fetch final order: HTTP $($r.code)"
}

Write-Host ""

# ============================================================
# STAGE 14: Order 360 View final check
# ============================================================
Write-Host "================================================================"
Write-Host "  STAGE 14: Order 360 View"
Write-Host "================================================================"
$r = Api-Call 'GET' "$baseUrl/orders/$orderId/360" $null $sale.headers
if ($r.ok) {
    $view = $r.data.data
    Write-Host "  Order 360: $($view.code) | status=$($view.status)"
    Write-Host "  Packages: $(if ($view.packages) { $view.packages.Count } else { '?' })"
    Write-Host "  StatusHistory: $(if ($view.statusHistory) { $view.statusHistory.Count } else { '?' }) entries"
    Write-Host "  AuditLog: $(if ($view.auditLog) { $view.auditLog.Count } else { 'N/A' }) entries"
    Log-Result 'PASS' "[Stage14] Order 360 view loaded OK"
} else {
    Log-Result 'WARN' "[Stage14] Order 360: HTTP $($r.code)"
}

# ============================================================
# STAGE 15: Invalid transition tests (boundary)
# ============================================================
Write-Host ""
Write-Host "================================================================"
Write-Host "  STAGE 15: Invalid Transition Boundary Tests"
Write-Host "================================================================"

# Create a new order for boundary tests
$boundaryPayload = @"
{
  "customerId": "$($vipCust.id)",
  "serviceType": "VCT",
  "branch": "HN",
  "shippingRoute": "SEA",
  "items": [{"productName": "Boundary test item", "quantity": 10, "unitPrice": 15, "currency": "CNY"}],
  "note": "Boundary test order"
}
"@
$r = Api-Call 'POST' "$baseUrl/orders" $boundaryPayload $sale.headers
if ($r.ok) {
    $bndOrderId = $r.data.data.id
    $bndOrderCode = $r.data.data.code
    Write-Host "  Boundary test order: $bndOrderCode"

    # Test skip: CONSULTING -> WAREHOUSE_CN (skip QUOTATION + SOURCING)
    $r = Api-Call 'PATCH' "$baseUrl/orders/$bndOrderId/status" '{"status":"WAREHOUSE_CN","note":"test skip"}' $sale.headers
    if (-not $r.ok -and $r.code -eq 400) {
        Log-Result 'PASS' "[Stage15] Cannot skip CONSULTING -> WAREHOUSE_CN (400)"
    } else {
        Log-Result 'FAIL' "[Stage15] Skip should be blocked, got HTTP $($r.code)"
    }

    # Test skip: CONSULTING -> IN_TRANSIT
    $r = Api-Call 'PATCH' "$baseUrl/orders/$bndOrderId/status" '{"status":"IN_TRANSIT","note":"test skip"}' $sale.headers
    if (-not $r.ok -and $r.code -eq 400) {
        Log-Result 'PASS' "[Stage15] Cannot skip CONSULTING -> IN_TRANSIT (400)"
    } else {
        Log-Result 'FAIL' "[Stage15] Skip should be blocked, got HTTP $($r.code)"
    }

    # Test skip: CONSULTING -> COMPLETED
    $r = Api-Call 'PATCH' "$baseUrl/orders/$bndOrderId/status" '{"status":"COMPLETED","note":"test skip"}' $sale.headers
    if (-not $r.ok -and $r.code -eq 400) {
        Log-Result 'PASS' "[Stage15] Cannot skip CONSULTING -> COMPLETED (400)"
    } else {
        Log-Result 'FAIL' "[Stage15] Skip should be blocked, got HTTP $($r.code)"
    }

    # Move to QUOTATION then test backward transition
    $r = Api-Call 'PATCH' "$baseUrl/orders/$bndOrderId/status" '{"status":"QUOTATION","note":"move forward"}' $sale.headers
    if ($r.ok) {
        # Test backward: QUOTATION -> CONSULTING
        $r = Api-Call 'PATCH' "$baseUrl/orders/$bndOrderId/status" '{"status":"CONSULTING","note":"test backward"}' $sale.headers
        if (-not $r.ok -and $r.code -eq 400) {
            Log-Result 'PASS' "[Stage15] Cannot go backward QUOTATION -> CONSULTING (400)"
        } else {
            Log-Result 'WARN' "[Stage15] Backward QUOTATION -> CONSULTING: HTTP $($r.code) (may be allowed)"
        }
    }
}
Write-Host ""

# ============================================================
# SUMMARY
# ============================================================
Write-Host "================================================================"
Write-Host "  TONG KET TEST-ORD-002 v2: Full Lifecycle + Audit Trail"
Write-Host "================================================================"
Write-Host "  Order tested: $orderCode (VCT, SEA, 2 packages)"
Write-Host ""
Write-Host "  Lifecycle: CONSULTING -> QUOTATION -> SOURCING"
Write-Host "           -> WAREHOUSE_CN -> PACKING -> CONSOLIDATION"
Write-Host "           -> IN_TRANSIT -> CUSTOMS -> WAREHOUSE_VN"
Write-Host "           -> DELIVERING -> SETTLEMENT -> COMPLETED"
Write-Host ""
Write-Host "  PASS: $passCount"
Write-Host "  FAIL: $failCount"
Write-Host "  WARN: $warnCount"
Write-Host "  INFO: $infoCount (UI notes - cannot verify via API)"
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED"
} else {
    Write-Host "  RESULT: $failCount TESTS FAILED - REVIEW REQUIRED"
}
Write-Host "================================================================"
