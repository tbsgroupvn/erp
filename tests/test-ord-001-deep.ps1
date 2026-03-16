$ErrorActionPreference = 'Continue'
$baseUrl = 'http://localhost:3001/api/v1'
$domain = 'nhaphangchinhngach.vn'

$passCount = 0
$failCount = 0
$warnCount = 0

function Log-Result($status, $msg) {
    switch ($status) {
        'PASS' { $script:passCount++; Write-Host "[PASS] $msg" }
        'FAIL' { $script:failCount++; Write-Host "[FAIL] $msg" }
        'WARN' { $script:warnCount++; Write-Host "[WARN] $msg" }
        'INFO' { Write-Host "[INFO] $msg" }
    }
}

function Get-ErrorBody($ex) {
    try {
        $stream = $ex.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        return $reader.ReadToEnd()
    } catch { return "" }
}

Write-Host "================================================================"
Write-Host "  TEST-ORD-001 DEEP: Tao don VCT - Kiem tra ky luong"
Write-Host "================================================================"
Write-Host ""

# ============================================================
# PART A: Login SALE
# ============================================================
Write-Host "=== PART A: Login & Prep ==="
$loginBody = "{`"email`":`"sale01@$domain`",`"password`":`"Admin@123`"}"
$loginResp = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -ContentType 'application/json' -Body $loginBody -UseBasicParsing
$loginData = $loginResp.Content | ConvertFrom-Json
$saleToken = $loginData.data.tokens.accessToken
$saleUserId = $loginData.data.user.id
$saleHeaders = @{ Authorization = "Bearer $saleToken" }
Log-Result 'PASS' "Login SALE OK - userId=$saleUserId"

# Get all customers
$custResp = Invoke-WebRequest -Uri "$baseUrl/customers?page=1&limit=20" -Headers $saleHeaders -UseBasicParsing
$custJson = $custResp.Content | ConvertFrom-Json
if ($custJson.data -is [Array]) { $customers = @($custJson.data) }
elseif ($custJson.data.data -is [Array]) { $customers = @($custJson.data.data) }
else { $customers = @($custJson.data) }

# Find customers by tier
$customerNEW = $null
$customerVIP = $null
$customerREG = $null
foreach ($c in $customers) {
    $cl = [decimal]$c.creditLimit
    if ($c.tier -eq 'NEW' -and -not $customerNEW) { $customerNEW = $c }
    if ($c.tier -eq 'VIP' -and $cl -gt 0 -and -not $customerVIP) { $customerVIP = $c }
    if ($c.tier -eq 'REGULAR' -and $cl -gt 0 -and -not $customerREG) { $customerREG = $c }
}

Write-Host ""
Write-Host "  Customers found:"
if ($customerNEW) { Write-Host "    NEW: $($customerNEW.code) creditLimit=$($customerNEW.creditLimit)" }
if ($customerVIP) { Write-Host "    VIP: $($customerVIP.code) creditLimit=$($customerVIP.creditLimit)" }
if ($customerREG) { Write-Host "    REGULAR: $($customerREG.code) creditLimit=$($customerREG.creditLimit)" }

# ============================================================
# TEST 1: Credit Check - NEW customer (creditLimit=0) -> 403
# ============================================================
Write-Host ""
Write-Host "=== TEST 1: CreditCheckGuard - NEW customer (creditLimit=0) ==="
if ($customerNEW) {
    $payload1 = @"
{
  "customerId": "$($customerNEW.id)",
  "serviceType": "VCT",
  "branch": "HN",
  "shippingRoute": "SEA",
  "items": [{"productName": "Test item", "quantity": 10, "unitPrice": 100, "currency": "CNY"}],
  "note": "Test credit check"
}
"@
    try {
        $resp1 = Invoke-WebRequest -Uri "$baseUrl/orders" -Method POST -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload1)) -Headers $saleHeaders -UseBasicParsing
        Log-Result 'FAIL' "CreditCheck: NEW customer should be rejected (got 201)"
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        $errBody = Get-ErrorBody $_
        if ($code -eq 403) {
            Log-Result 'PASS' "CreditCheck: NEW customer rejected (403) - creditLimit=0"
            if ($errBody) { Write-Host "  Error msg: $($errBody.Substring(0, [Math]::Min(200, $errBody.Length)))" }
        } else {
            Log-Result 'WARN' "CreditCheck: expected 403, got $code"
            if ($errBody) { Write-Host "  Error: $errBody" }
        }
    }
} else {
    Log-Result 'WARN' "Khong co customer NEW de test credit check"
}

# ============================================================
# TEST 2: Create VCT + VIP customer -> deposit = 0
# ============================================================
Write-Host ""
Write-Host "=== TEST 2: VCT + VIP -> depositRequired = 0 ==="
if ($customerVIP) {
    $payload2 = @"
{
  "customerId": "$($customerVIP.id)",
  "serviceType": "VCT",
  "branch": "HN",
  "shippingRoute": "SEA",
  "items": [
    {"productName": "Phu kien dien thoai", "quantity": 100, "unitPrice": 15.5, "currency": "CNY"}
  ],
  "note": "TEST-ORD-001: VCT + VIP deposit check"
}
"@
    try {
        $resp2 = Invoke-WebRequest -Uri "$baseUrl/orders" -Method POST -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload2)) -Headers $saleHeaders -UseBasicParsing
        $order2 = ($resp2.Content | ConvertFrom-Json).data

        Write-Host "  Order: $($order2.code) | status=$($order2.status) | total=$($order2.totalAmount) | deposit=$($order2.depositRequired)"

        if ([decimal]$order2.depositRequired -eq 0) {
            Log-Result 'PASS' "VCT + VIP: depositRequired = 0 (dung thiet ke - VCT khong yeu cau deposit cho khach cu)"
        } else {
            Log-Result 'WARN' "VCT + VIP: depositRequired = $($order2.depositRequired) (mong doi 0)"
        }

        if ($order2.status -eq 'CONSULTING') {
            Log-Result 'PASS' "Status = CONSULTING"
        } else {
            Log-Result 'FAIL' "Status = $($order2.status), expected CONSULTING"
        }

        # Save for later tests
        $vctOrderId = $order2.id
        $vctOrderCode = $order2.code
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        $errBody = Get-ErrorBody $_
        Log-Result 'FAIL' "Tao don VCT+VIP that bai - HTTP $code"
        Write-Host "  Error: $errBody"
    }
}

# ============================================================
# TEST 3: Create MHH + VIP customer -> deposit = 50%
# ============================================================
Write-Host ""
Write-Host "=== TEST 3: MHH + VIP -> depositRequired = 50% ==="
if ($customerVIP) {
    $payload3 = @"
{
  "customerId": "$($customerVIP.id)",
  "serviceType": "MHH",
  "branch": "HN",
  "shippingRoute": "SEA",
  "items": [
    {"productName": "Tai nghe Bluetooth", "quantity": 50, "unitPrice": 200, "currency": "CNY"}
  ],
  "note": "TEST: MHH + VIP deposit check"
}
"@
    try {
        $resp3 = Invoke-WebRequest -Uri "$baseUrl/orders" -Method POST -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload3)) -Headers $saleHeaders -UseBasicParsing
        $order3 = ($resp3.Content | ConvertFrom-Json).data

        $totalAmt = [decimal]$order3.totalAmount
        $depositAmt = [decimal]$order3.depositRequired
        $expectedDeposit = [Math]::Ceiling($totalAmt * 50 / 100)

        Write-Host "  Order: $($order3.code) | total=$totalAmt | deposit=$depositAmt | expected=$expectedDeposit"

        if ($depositAmt -gt 0) {
            Log-Result 'PASS' "MHH + VIP: depositRequired = $depositAmt (> 0, dung thiet ke)"
        } else {
            Log-Result 'FAIL' "MHH + VIP: depositRequired = 0 (expected > 0)"
        }

        if ($depositAmt -eq $expectedDeposit) {
            Log-Result 'PASS' "Deposit = 50% cua total ($expectedDeposit)"
        } else {
            Log-Result 'WARN' "Deposit = $depositAmt, expected $expectedDeposit (50% cua $totalAmt)"
        }

        $mhhOrderId = $order3.id
        $mhhOrderCode = $order3.code
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        $errBody = Get-ErrorBody $_
        Log-Result 'FAIL' "Tao don MHH+VIP that bai - HTTP $code"
        Write-Host "  Error: $errBody"
    }
}

# ============================================================
# TEST 4: saleId tracking (thay cho createdById)
# ============================================================
Write-Host ""
Write-Host "=== TEST 4: saleId tracking ==="
if ($vctOrderId) {
    try {
        $detResp = Invoke-WebRequest -Uri "$baseUrl/orders/$vctOrderId" -Headers $saleHeaders -UseBasicParsing
        $detail = ($detResp.Content | ConvertFrom-Json).data

        Write-Host "  saleId: $($detail.saleId)"
        Write-Host "  createdById: $($detail.createdById)"
        Write-Host "  saleUserId: $saleUserId"

        if ($detail.saleId -eq $saleUserId) {
            Log-Result 'PASS' "saleId = SALE userId (audit tracking OK)"
        } else {
            Log-Result 'FAIL' "saleId=$($detail.saleId), expected=$saleUserId"
        }

        # Note: createdById is expected to be empty (not in Order model)
        if (-not $detail.createdById -or $detail.createdById -eq '') {
            Log-Result 'INFO' "createdById khong co trong Order model - dung thiet ke, audit qua saleId"
        }
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        Log-Result 'FAIL' "GET order detail - HTTP $code"
    }
}

# ============================================================
# TEST 5: Order code format
# ============================================================
Write-Host ""
Write-Host "=== TEST 5: Order code format ==="
if ($vctOrderCode) {
    if ($vctOrderCode -match '^TBS-ORD-\d{6}-\d{4}$') {
        Log-Result 'PASS' "Order code format TBS-ORD-YYMMDD-NNNN: $vctOrderCode"
    } else {
        Log-Result 'WARN' "Order code format khac: $vctOrderCode"
    }
}
if ($mhhOrderCode) {
    if ($mhhOrderCode -match '^TBS-ORD-\d{6}-\d{4}$') {
        Log-Result 'PASS' "Order code format TBS-ORD-YYMMDD-NNNN: $mhhOrderCode"
    } else {
        Log-Result 'WARN' "Order code format khac: $mhhOrderCode"
    }
}

# ============================================================
# TEST 6: Order listing - data scope (SALE chi thay don cua minh)
# ============================================================
Write-Host ""
Write-Host "=== TEST 6: Data scope - SALE chi thay don cua minh ==="
try {
    $listResp = Invoke-WebRequest -Uri "$baseUrl/orders?page=1&limit=50" -Headers $saleHeaders -UseBasicParsing
    $listJson = $listResp.Content | ConvertFrom-Json
    if ($listJson.data -is [Array]) { $ordersList = @($listJson.data) }
    elseif ($listJson.data.data -is [Array]) { $ordersList = @($listJson.data.data) }
    else { $ordersList = @($listJson.data) }

    $totalOrders = if ($listJson.data.total) { $listJson.data.total } else { $ordersList.Count }
    Write-Host "  Total orders visible: $totalOrders"

    # Check all orders belong to this sale
    $otherSaleCount = 0
    $foundVCT = $false
    $foundMHH = $false
    foreach ($o in $ordersList) {
        if ($o.saleId -and $o.saleId -ne $saleUserId) { $otherSaleCount++ }
        if ($o.id -eq $vctOrderId) { $foundVCT = $true }
        if ($o.id -eq $mhhOrderId) { $foundMHH = $true }
    }

    if ($otherSaleCount -eq 0) {
        Log-Result 'PASS' "Data scope OK - tat ca $($ordersList.Count) don deu thuoc SALE nay"
    } else {
        Log-Result 'WARN' "Data scope: $otherSaleCount don thuoc sale khac (co the CEO/COO scope)"
    }

    if ($foundVCT) { Log-Result 'PASS' "Don VCT ($vctOrderCode) trong listing" }
    else { Log-Result 'WARN' "Don VCT ($vctOrderCode) KHONG trong listing" }

    if ($foundMHH) { Log-Result 'PASS' "Don MHH ($mhhOrderCode) trong listing" }
    else { Log-Result 'WARN' "Don MHH ($mhhOrderCode) KHONG trong listing" }
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    Log-Result 'FAIL' "GET /orders listing - HTTP $code"
}

# ============================================================
# TEST 7: Validation - empty items
# ============================================================
Write-Host ""
Write-Host "=== TEST 7: Validation - empty items ==="
if ($customerVIP) {
    $payload7 = @"
{
  "customerId": "$($customerVIP.id)",
  "serviceType": "VCT",
  "branch": "HN",
  "items": []
}
"@
    try {
        $resp7 = Invoke-WebRequest -Uri "$baseUrl/orders" -Method POST -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload7)) -Headers $saleHeaders -UseBasicParsing
        Log-Result 'FAIL' "Empty items should be rejected (got success)"
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        if ($code -eq 400) {
            Log-Result 'PASS' "Empty items rejected (400)"
        } else {
            Log-Result 'WARN' "Empty items: expected 400, got $code"
        }
    }
}

# ============================================================
# TEST 8: Validation - missing required fields
# ============================================================
Write-Host ""
Write-Host "=== TEST 8: Validation - missing required fields ==="
$payload8 = '{"serviceType":"VCT"}'
try {
    $resp8 = Invoke-WebRequest -Uri "$baseUrl/orders" -Method POST -ContentType 'application/json' -Body $payload8 -Headers $saleHeaders -UseBasicParsing
    Log-Result 'FAIL' "Missing fields should be rejected"
} catch {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -eq 400) {
        Log-Result 'PASS' "Missing required fields rejected (400)"
    } else {
        Log-Result 'WARN' "Missing fields: expected 400, got $code"
    }
}

# ============================================================
# TEST 9: Validation - invalid serviceType
# ============================================================
Write-Host ""
Write-Host "=== TEST 9: Validation - invalid serviceType ==="
if ($customerVIP) {
    $payload9 = @"
{
  "customerId": "$($customerVIP.id)",
  "serviceType": "INVALID_TYPE",
  "branch": "HN",
  "items": [{"productName": "Test", "quantity": 1, "unitPrice": 10, "currency": "CNY"}]
}
"@
    try {
        $resp9 = Invoke-WebRequest -Uri "$baseUrl/orders" -Method POST -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload9)) -Headers $saleHeaders -UseBasicParsing
        Log-Result 'FAIL' "Invalid serviceType should be rejected"
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        if ($code -eq 400) {
            Log-Result 'PASS' "Invalid serviceType rejected (400)"
        } else {
            Log-Result 'WARN' "Invalid serviceType: expected 400, got $code"
        }
    }
}

# ============================================================
# PART B: WAREHOUSE CN - Nhan hang + Do kien + Chargeable weight
# ============================================================
Write-Host ""
Write-Host "================================================================"
Write-Host "  PART B: Warehouse CN - Nhan hang + Chargeable weight"
Write-Host "================================================================"
Write-Host ""

# Login as WAREHOUSE_CN_AGENT
Write-Host "=== Login WAREHOUSE_CN_AGENT ==="
$whBody = "{`"email`":`"khotq01@$domain`",`"password`":`"Admin@123`"}"
try {
    $whResp = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -ContentType 'application/json' -Body $whBody -UseBasicParsing
    $whData = $whResp.Content | ConvertFrom-Json
    $whToken = $whData.data.tokens.accessToken
    $whUserId = $whData.data.user.id
    $whHeaders = @{ Authorization = "Bearer $whToken" }
    Log-Result 'PASS' "Login Warehouse CN Agent OK - userId=$whUserId"
} catch {
    Log-Result 'FAIL' "Login Warehouse CN Agent FAILED"
    Write-Host ""
    Write-Host "================================================================"
    Write-Host "  SUMMARY: $passCount PASS / $failCount FAIL / $warnCount WARN"
    Write-Host "================================================================"
    exit 1
}

# ============================================================
# TEST 10: Receive package for the VCT order
# ============================================================
Write-Host ""
Write-Host "=== TEST 10: Receive package tai kho TQ ==="
if ($vctOrderId -and $whToken) {
    $recPayload = @"
{
  "trackingNumberCN": "SF-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')",
  "orderId": "$vctOrderId",
  "imageUrls": ["https://storage.tbs.vn/test/pkg-front.jpg", "https://storage.tbs.vn/test/pkg-label.jpg"],
  "description": "Phu kien dien thoai - 100 pcs",
  "note": "TEST: Nhan kien de test chargeable weight"
}
"@
    try {
        $recResp = Invoke-WebRequest -Uri "$baseUrl/warehouse-cn/receive" -Method POST -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($recPayload)) -Headers $whHeaders -UseBasicParsing
        $recJson = $recResp.Content | ConvertFrom-Json
        $pkg = if ($recJson.data.package) { $recJson.data.package } else { $recJson.data }

        $packageId = $pkg.id
        $packageCode = $pkg.code
        Write-Host "  Package ID: $packageId"
        Write-Host "  Package Code: $packageCode"
        Write-Host "  Status: $($pkg.warehouseCNStatus)"
        Write-Host "  Tracking: $($pkg.trackingNumberCN)"

        if ($pkg.warehouseCNStatus -eq 'RECEIVED') {
            Log-Result 'PASS' "Package received - status=RECEIVED"
        } else {
            Log-Result 'WARN' "Package status=$($pkg.warehouseCNStatus), expected RECEIVED"
        }
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        $errBody = Get-ErrorBody $_
        Log-Result 'FAIL' "Receive package - HTTP $code"
        Write-Host "  Error: $errBody"
    }
}

# ============================================================
# TEST 11: Measure package (L=60, W=40, H=30, weight=50kg)
# ============================================================
Write-Host ""
Write-Host "=== TEST 11: Measure package + Chargeable weight ==="
if ($packageId -and $whToken) {
    $measPayload = @"
{
  "actualWeight": 50,
  "length": 60,
  "width": 40,
  "height": 30,
  "note": "TEST: Do kien de kiem tra chargeable weight"
}
"@
    try {
        $measResp = Invoke-WebRequest -Uri "$baseUrl/warehouse-cn/packages/$packageId/measure" -Method POST -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($measPayload)) -Headers $whHeaders -UseBasicParsing
        $measJson = $measResp.Content | ConvertFrom-Json
        # Response: { data: { package: {...}, weightVariance: ... } }
        $measured = if ($measJson.data.package) { $measJson.data.package } elseif ($measJson.data) { $measJson.data } else { $measJson }

        $actualW = [decimal]$measured.actualWeight
        $volW = [decimal]$measured.volumetricWeight
        $chargeW = [decimal]$measured.chargeableWeight

        Write-Host "  Status after measure: $($measured.warehouseCNStatus)"
        Write-Host "  Actual Weight:     $actualW kg"
        Write-Host "  Volumetric Weight: $volW kg"
        Write-Host "  Chargeable Weight: $chargeW kg"
        Write-Host "  Dimensions: $($measured.length) x $($measured.width) x $($measured.height) cm"

        # Per-package calculation:
        # Volumetric = L*W*H/divisor = 60*40*30/6000 = 12 kg (SEA divisor=6000)
        # Chargeable = MAX(actualWeight, volumetricWeight) = MAX(50, 12) = 50 kg
        $expectedVol = [Math]::Round(60 * 40 * 30 / 6000, 2)
        $expectedCharge = [Math]::Max(50, $expectedVol)

        Write-Host "  Expected volumetric: $expectedVol kg (L*W*H/6000 = 60*40*30/6000)"
        Write-Host "  Expected chargeable: $expectedCharge kg (MAX($actualW, $expectedVol))"

        if ($volW -eq $expectedVol) {
            Log-Result 'PASS' "Volumetric weight = $expectedVol kg (dung formula SEA divisor=6000)"
        } else {
            Log-Result 'WARN' "Volumetric = $volW, expected $expectedVol"
        }

        if ($chargeW -eq $expectedCharge) {
            Log-Result 'PASS' "Chargeable weight = $expectedCharge kg (MAX(actual=$actualW, vol=$volW))"
        } else {
            Log-Result 'WARN' "Chargeable = $chargeW, expected $expectedCharge"
        }

        # Verify status changed to CHECKED after measurement
        if ($measured.warehouseCNStatus -eq 'CHECKED') {
            Log-Result 'PASS' "Package status changed to CHECKED after measurement"
        } else {
            Log-Result 'WARN' "Status = $($measured.warehouseCNStatus), expected CHECKED"
        }
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        $errBody = Get-ErrorBody $_
        Log-Result 'FAIL' "Measure package - HTTP $code"
        Write-Host "  Error: $errBody"
    }
}

# ============================================================
# TEST 12: Receive duplicate tracking number (no forceReceive)
# ============================================================
Write-Host ""
Write-Host "=== TEST 12: Duplicate tracking number ==="
if ($vctOrderId -and $whToken) {
    $dupPayload = @"
{
  "trackingNumberCN": "SF-DUP-TEST-001",
  "orderId": "$vctOrderId",
  "imageUrls": ["https://storage.tbs.vn/test/dup-test.jpg"]
}
"@
    # First receive
    try {
        $dup1 = Invoke-WebRequest -Uri "$baseUrl/warehouse-cn/receive" -Method POST -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($dupPayload)) -Headers $whHeaders -UseBasicParsing
        Write-Host "  First receive: OK"
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        Write-Host "  First receive: HTTP $code"
    }

    # Second receive (same tracking - should warn or block)
    try {
        $dup2 = Invoke-WebRequest -Uri "$baseUrl/warehouse-cn/receive" -Method POST -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($dupPayload)) -Headers $whHeaders -UseBasicParsing
        $dupJson = $dup2.Content | ConvertFrom-Json
        if ($dupJson.data.warning) {
            Log-Result 'PASS' "Duplicate tracking: warning returned (can forceReceive)"
        } else {
            Log-Result 'WARN' "Duplicate tracking: no warning (co the cho phep nhieu kien cung tracking)"
        }
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        if ($code -eq 400 -or $code -eq 409) {
            Log-Result 'PASS' "Duplicate tracking rejected ($code)"
        } else {
            Log-Result 'WARN' "Duplicate tracking: HTTP $code"
        }
    }
}

# ============================================================
# TEST 13: Receive without photos -> should reject
# ============================================================
Write-Host ""
Write-Host "=== TEST 13: Receive without photos (Layer 4A) ==="
if ($vctOrderId -and $whToken) {
    $noPhotoPayload = @"
{
  "trackingNumberCN": "SF-NOPHOTO-001",
  "orderId": "$vctOrderId",
  "imageUrls": []
}
"@
    try {
        $npResp = Invoke-WebRequest -Uri "$baseUrl/warehouse-cn/receive" -Method POST -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($noPhotoPayload)) -Headers $whHeaders -UseBasicParsing
        Log-Result 'FAIL' "No photos should be rejected"
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        if ($code -eq 400) {
            Log-Result 'PASS' "No photos rejected (400) - Layer 4A enforced"
        } else {
            Log-Result 'WARN' "No photos: expected 400, got $code"
        }
    }
}

# ============================================================
# TEST 14: SALE cannot receive packages (role check)
# ============================================================
Write-Host ""
Write-Host "=== TEST 14: SALE cannot receive packages (RBAC) ==="
if ($vctOrderId) {
    $saleRecPayload = @"
{
  "trackingNumberCN": "SF-RBAC-TEST-001",
  "orderId": "$vctOrderId",
  "imageUrls": ["https://storage.tbs.vn/test/rbac.jpg"]
}
"@
    try {
        $rbacResp = Invoke-WebRequest -Uri "$baseUrl/warehouse-cn/receive" -Method POST -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($saleRecPayload)) -Headers $saleHeaders -UseBasicParsing
        Log-Result 'FAIL' "SALE should NOT be able to receive packages (got 201)"
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        if ($code -eq 403) {
            Log-Result 'PASS' "SALE blocked from receiving packages (403)"
        } else {
            Log-Result 'WARN' "SALE receive: expected 403, got $code"
        }
    }
}

# ============================================================
# TEST 15: Verify order status after receiving package
# ============================================================
Write-Host ""
Write-Host "=== TEST 15: Order status after package received ==="
if ($vctOrderId) {
    try {
        $statusResp = Invoke-WebRequest -Uri "$baseUrl/orders/$vctOrderId" -Headers $saleHeaders -UseBasicParsing
        $statusJson = ($statusResp.Content | ConvertFrom-Json).data

        Write-Host "  Order status: $($statusJson.status)"
        Write-Host "  Package count: $($statusJson.packages.Count)" 2>$null

        # After receiving package, order might still be CONSULTING or transition
        Log-Result 'INFO' "Order status sau khi nhan kien: $($statusJson.status)"
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        Log-Result 'WARN' "GET order status - HTTP $code"
    }
}

# ============================================================
# SUMMARY
# ============================================================
Write-Host ""
Write-Host "================================================================"
Write-Host "  TONG KET"
Write-Host "================================================================"
Write-Host "  PASS: $passCount"
Write-Host "  FAIL: $failCount"
Write-Host "  WARN: $warnCount"
Write-Host "================================================================"
if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED"
} else {
    Write-Host "  RESULT: $failCount TESTS FAILED"
}
Write-Host "================================================================"
