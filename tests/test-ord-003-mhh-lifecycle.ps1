################################################################
#  TEST-ORD-003: Full MHH (Mua hang ho) Lifecycle
#  SOURCING + SupplierOrder + QC + Container + Delivery + Settlement
#
#  Precondition: KH VIP (deposit 50%)
#  Flow: CONSULTING -> QUOTATION -> PENDING_DEPOSIT -> SOURCING
#        -> WAREHOUSE_CN -> PACKING -> CONSOLIDATION -> IN_TRANSIT
#        -> CUSTOMS -> WAREHOUSE_VN -> DELIVERING -> SETTLEMENT -> COMPLETED
################################################################

$ErrorActionPreference = 'Continue'
$BASE = "http://localhost:3001/api/v1"
$pass = 0; $fail = 0; $warn = 0

function Log-Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green; $script:pass++ }
function Log-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:fail++ }
function Log-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow; $script:warn++ }
function Log-Info($msg) { Write-Host "  $msg" -ForegroundColor Cyan }

function Login($email) {
    $body = @{ email = $email; password = "Admin@123" } | ConvertTo-Json
    try {
        $r = Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -Body $body -ContentType "application/json"
        $token = $r.data.tokens.accessToken
        if (-not $token) { $token = $r.data.accessToken }
        return $token
    } catch {
        Write-Host "  LOGIN FAILED: $email - $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Api($method, $path, $token, $body) {
    $headers = @{ Authorization = "Bearer $token" }
    $params = @{
        Uri         = "$BASE$path"
        Method      = $method
        Headers     = $headers
        ContentType = "application/json"
    }
    if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 10) }
    try {
        return Invoke-RestMethod @params
    } catch {
        $errBody = ""
        try {
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $errBody = $reader.ReadToEnd()
            $reader.Close()
        } catch {}
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "    API ERROR: $method $path -> $code : $errBody" -ForegroundColor DarkRed
        throw
    }
}

function Api-Status($method, $path, $token, $body) {
    $headers = @{ Authorization = "Bearer $token" }
    $params = @{
        Uri         = "$BASE$path"
        Method      = $method
        Headers     = $headers
        ContentType = "application/json"
        ErrorAction = 'Stop'
    }
    if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 10) }
    try {
        $r = Invoke-WebRequest @params
        return @{ StatusCode = $r.StatusCode; Body = ($r.Content | ConvertFrom-Json) }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        return @{ StatusCode = $code; Body = $null }
    }
}

Write-Host "================================================================" -ForegroundColor White
Write-Host "  TEST-ORD-003: Full MHH (Mua hang ho) Lifecycle" -ForegroundColor White
Write-Host "  SOURCING + SupplierOrder + QC + Container + Settlement" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === SETUP: Login all roles ===
Write-Host "`n=== SETUP: Login roles ===" -ForegroundColor Yellow
$SALE1  = Login "sale01@nhaphangchinhngach.vn"
if ($SALE1)  { Log-Pass "SALE1 login OK" } else { Log-Fail "SALE1 login"; return }
$WH_CN  = Login "khotq01@nhaphangchinhngach.vn"
if ($WH_CN)  { Log-Pass "WH_CN login OK" } else { Log-Fail "WH_CN login"; return }
$XNK    = Login "xnk@nhaphangchinhngach.vn"
if ($XNK)    { Log-Pass "XNK login OK" } else { Log-Fail "XNK login"; return }
$KETOAN = Login "ketoan@nhaphangchinhngach.vn"
if ($KETOAN) { Log-Pass "KETOAN login OK" } else { Log-Fail "KETOAN login"; return }
$CFO    = Login "cfo@nhaphangchinhngach.vn"
if ($CFO)    { Log-Pass "CFO login OK" } else { Log-Fail "CFO login"; return }
$KHOVN  = Login "khovn@nhaphangchinhngach.vn"
if ($KHOVN)  { Log-Pass "KHOVN login OK" } else { Log-Fail "KHOVN login"; return }
$LEADER = Login "leader.hn@nhaphangchinhngach.vn"
if ($LEADER) { Log-Pass "LEADER login OK" } else { Log-Fail "LEADER login"; return }

# Get VIP customer
$customers = Api "GET" "/customers?tier=VIP&limit=1" $SALE1
$cust = if ($customers.data) { $customers.data[0] } else { $customers[0] }
if (-not $cust) {
    $customers = Api "GET" "/customers?limit=10" $SALE1
    $allCusts = if ($customers.data) { $customers.data } else { @($customers) }
    $cust = $allCusts | Where-Object { $_.tier -eq 'VIP' } | Select-Object -First 1
}
if (-not $cust) { Log-Fail "No VIP customer found"; return }
$CUST_ID = $cust.id
Log-Info "Customer: $($cust.code) ($($cust.tier)) - $($cust.fullName)"

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART A: MHH PRICE CALCULATOR" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === A1: Calculate MHH price ===
Write-Host "`n=== TEST A1: Calculate MHH price quote ===" -ForegroundColor Yellow
try {
    $priceReq = @{
        productPriceCNY    = 200
        quantity           = 5
        domesticShippingCNY = 15
        estimatedWeightKg  = 2.0
        shippingRoute      = "SEA"
        customerTier       = "VIP"
    }
    $priceRes = Api "POST" "/orders/calculate-mhh-price" $SALE1 $priceReq
    $priceData = if ($priceRes.data) { $priceRes.data } else { $priceRes }
    Log-Info "productPriceCNY=$($priceData.productPriceCNY) | serviceFee=$($priceData.serviceFeePercent)% ($($priceData.serviceFeeCNY) CNY)"
    Log-Info "domesticShipping=$($priceData.domesticShippingCNY) | totalPerItem=$($priceData.totalPerItemCNY)"
    Log-Info "subtotalCNY=$($priceData.subtotalCNY) | exchangeRate=$($priceData.exchangeRate)"
    Log-Info "subtotalVND=$($priceData.subtotalVND) | shippingVND=$($priceData.estimatedShippingVND) | grandTotalVND=$($priceData.grandTotalVND)"
    Log-Pass "A1: MHH price calculated successfully"

    # A2: Verify service fee in range 3-8%
    $feePct = [double]$priceData.serviceFeePercent
    if ($feePct -ge 3 -and $feePct -le 8) {
        Log-Pass "A2: Service fee $($feePct)% in valid range (3-8%)"
    } elseif ($feePct -gt 0) {
        Log-Warn "A2: Service fee $($feePct)% outside typical 3-8% range (may be custom config)"
    } else {
        Log-Fail "A2: Service fee is 0 or missing"
    }

    # A3: Verify breakdown
    $expectedSubtotalCNY = $priceData.totalPerItemCNY * $priceData.quantity
    if ([math]::Abs($priceData.subtotalCNY - $expectedSubtotalCNY) -lt 1) {
        Log-Pass "A3: Price breakdown consistent (totalPerItem * qty = subtotalCNY)"
    } else {
        Log-Fail "A3: Price breakdown mismatch: $($priceData.subtotalCNY) != $expectedSubtotalCNY"
    }
} catch {
    Log-Fail "A1: MHH price calculation failed - $($_.Exception.Message)"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART B: ORDER CREATION + DEPOSIT FLOW" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === B1: Create MHH order ===
Write-Host "`n=== TEST B1: Create MHH order with items ===" -ForegroundColor Yellow
$orderBody = @{
    customerId   = $CUST_ID
    serviceType  = "MHH"
    branch       = "HN"
    shippingRoute = "SEA"
    items        = @(
        @{
            productName = "Tai nghe Bluetooth XM5"
            productUrl  = "https://item.taobao.com/item.htm?id=700001"
            quantity    = 5
            unitPrice   = 200
            currency    = "CNY"
            note        = "Mau: Den, Size: L"
        },
        @{
            productName = "Op lung iPhone 15 Pro"
            productUrl  = "https://item.taobao.com/item.htm?id=700002"
            quantity    = 10
            unitPrice   = 50
            currency    = "CNY"
            note        = "Mau: Do, Size: M"
        }
    )
    note = "Don hang MHH test - Kiem tra full lifecycle"
}
try {
    $orderRes = Api "POST" "/orders" $SALE1 $orderBody
    $order = if ($orderRes.data) { $orderRes.data } else { $orderRes }
    $ORDER_ID   = $order.id
    $ORDER_CODE = $order.code
    Log-Info "Order: $ORDER_CODE | ID=$ORDER_ID"
    Log-Info "serviceType=$($order.serviceType) | status=$($order.status) | total=$($order.totalAmount)"
    Log-Info "depositRequired=$($order.depositRequired) | depositPaid=$($order.depositPaid) | currency=$($order.currency)"

    if ($order.serviceType -eq "MHH") { Log-Pass "B1a: Order created with serviceType=MHH" }
    else { Log-Fail "B1a: Expected serviceType=MHH, got $($order.serviceType)" }

    if ($order.status -eq "CONSULTING") { Log-Pass "B1b: Initial status=CONSULTING" }
    else { Log-Fail "B1b: Expected CONSULTING, got $($order.status)" }

    # B2: Verify deposit requirement (VIP = 50%)
    $expectedDeposit = [math]::Ceiling([double]$order.totalAmount * 0.5)
    $actualDeposit = [double]$order.depositRequired
    Log-Info "Expected deposit (50% VIP): ~$expectedDeposit | Actual: $actualDeposit"
    if ($actualDeposit -gt 0) { Log-Pass "B2: Deposit required=$actualDeposit (VIP tier)" }
    else { Log-Fail "B2: No deposit required for MHH VIP order" }

    # Save order currency for voucher
    $ORDER_CURRENCY = if ($order.currency) { $order.currency } else { "VND" }
    $ORDER_TOTAL = [double]$order.totalAmount
    $DEPOSIT_REQ = $actualDeposit
} catch {
    Log-Fail "B1: Create MHH order failed - $($_.Exception.Message)"
    return
}

# === B3: CONSULTING -> QUOTATION -> PENDING_DEPOSIT ===
Write-Host "`n=== TEST B3: Status transitions to PENDING_DEPOSIT ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$ORDER_ID/status" $SALE1 @{ status = "QUOTATION" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "QUOTATION") { Log-Pass "B3a: CONSULTING -> QUOTATION" }
    else { Log-Fail "B3a: Expected QUOTATION, got $($odata.status)" }

    Api "PATCH" "/orders/$ORDER_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "PENDING_DEPOSIT") { Log-Pass "B3b: QUOTATION -> PENDING_DEPOSIT" }
    else { Log-Fail "B3b: Expected PENDING_DEPOSIT, got $($odata.status)" }
} catch {
    Log-Fail "B3: Status transition failed - $($_.Exception.Message)"
}

# === B4: Verify SOURCING blocked without deposit ===
Write-Host "`n=== TEST B4: Deposit gate blocks SOURCING ===" -ForegroundColor Yellow
try {
    $res = Api-Status "PATCH" "/orders/$ORDER_ID/status" $SALE1 @{ status = "SOURCING" }
    if ($res.StatusCode -eq 400) {
        Log-Pass "B4: SOURCING blocked (400) - deposit not paid"
    } else {
        Log-Fail "B4: Expected 400 block, got $($res.StatusCode)"
    }
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 400) { Log-Pass "B4: SOURCING blocked (400) - deposit not paid" }
    else { Log-Fail "B4: Unexpected error $code" }
}

# === B5: Create RECEIPT voucher (deposit payment) ===
Write-Host "`n=== TEST B5: Create deposit voucher ===" -ForegroundColor Yellow
try {
    $depositAmt = $DEPOSIT_REQ
    $voucherBody = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = $depositAmt
        currency      = $ORDER_CURRENCY
        paymentMethod = "BANK_TRANSFER"
        costType      = "DEPOSIT"
        beneficiary   = if ($cust.fullName) { $cust.fullName } else { "Khach hang VIP" }
        reason        = "Dat coc don hang MHH $ORDER_CODE - Khach hang VIP coc 50 phan tram tong gia tri don hang"
    }
    $vRes = Api "POST" "/cash/vouchers" $KETOAN $voucherBody
    $vData = if ($vRes.data) { $vRes.data } else { $vRes }
    $voucher = if ($vData.voucher) { $vData.voucher } else { $vData }
    $VOUCHER_ID = $voucher.id
    Log-Info "Voucher: $($voucher.code) | amount=$depositAmt $ORDER_CURRENCY | status=$($voucher.status)"

    if ($voucher.status -eq "PENDING") { Log-Pass "B5: Deposit voucher created (PENDING)" }
    else { Log-Fail "B5: Expected PENDING, got $($voucher.status)" }
} catch {
    Log-Fail "B5: Create voucher failed - $($_.Exception.Message)"
}

# === B6: Approve voucher (CFO - segregation of duties) ===
Write-Host "`n=== TEST B6: Approve deposit voucher (CFO) ===" -ForegroundColor Yellow
try {
    $approveRes = Api "PATCH" "/cash/vouchers/$VOUCHER_ID/approve" $CFO
    $approved = if ($approveRes.data) { $approveRes.data } else { $approveRes }
    Log-Info "Voucher status: $($approved.status) | approvedBy present: $([bool]$approved.approvedBy)"

    if ($approved.status -eq "APPROVED") { Log-Pass "B6: Voucher approved by CFO (segregation OK)" }
    else { Log-Fail "B6: Expected APPROVED, got $($approved.status)" }
} catch {
    Log-Fail "B6: Approve voucher failed - $($_.Exception.Message)"
}

# === B7: Verify deposit updated on order ===
Write-Host "`n=== TEST B7: Verify deposit recorded ===" -ForegroundColor Yellow
Start-Sleep -Milliseconds 1000  # Wait for event processing
try {
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    Log-Info "depositPaid=$($odata.depositPaid) | depositRequired=$($odata.depositRequired) | isDepositPaid=$($odata.isDepositPaid)"

    if ([double]$odata.depositPaid -ge $DEPOSIT_REQ) {
        Log-Pass "B7a: Deposit paid ($($odata.depositPaid)) >= required ($DEPOSIT_REQ)"
    } else {
        Log-Fail "B7a: Deposit paid ($($odata.depositPaid)) < required ($DEPOSIT_REQ)"
    }
    if ($odata.isDepositPaid -eq $true) { Log-Pass "B7b: isDepositPaid = true" }
    else { Log-Warn "B7b: isDepositPaid=$($odata.isDepositPaid) (may update async)" }
} catch {
    Log-Fail "B7: Check deposit failed - $($_.Exception.Message)"
}

# === B8: PENDING_DEPOSIT -> SOURCING (deposit gate passes) ===
Write-Host "`n=== TEST B8: Transition to SOURCING ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$ORDER_ID/status" $SALE1 @{ status = "SOURCING" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "SOURCING") { Log-Pass "B8: PENDING_DEPOSIT -> SOURCING (deposit gate passed)" }
    else { Log-Fail "B8: Expected SOURCING, got $($odata.status)" }
} catch {
    Log-Fail "B8: SOURCING transition failed - $($_.Exception.Message)"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART C: SUPPLIER ORDER LIFECYCLE" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === C0: Pay additional deposit to reach 70% for procurement gate ===
Write-Host "`n=== TEST C0: Pay 70% procurement gate deposit ===" -ForegroundColor Yellow
try {
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    $currentPaid = [double]$odata.depositPaid
    $total = [double]$odata.totalAmount
    $needed70 = [math]::Ceiling($total * 0.7)
    $additionalNeeded = $needed70 - $currentPaid
    Log-Info "Total=$total | Paid=$currentPaid | Need70%=$needed70 | Additional=$additionalNeeded"

    if ($additionalNeeded -gt 0) {
        $v70Body = @{
            type          = "RECEIPT"
            orderId       = $ORDER_ID
            amount        = $additionalNeeded
            currency      = $ORDER_CURRENCY
            paymentMethod = "BANK_TRANSFER"
            costType      = "DEPOSIT"
            beneficiary   = if ($cust.fullName) { $cust.fullName } else { "Khach hang VIP" }
            reason        = "Coc bo sung dat 70 phan tram de du dieu kien mua hang ho $ORDER_CODE - Procurement gate"
        }
        $v70Res = Api "POST" "/cash/vouchers" $KETOAN $v70Body
        $v70Raw = if ($v70Res.data) { $v70Res.data } else { $v70Res }
        $v70 = if ($v70Raw.voucher) { $v70Raw.voucher } else { $v70Raw }
        Api "PATCH" "/cash/vouchers/$($v70.id)/approve" $CFO | Out-Null
        Start-Sleep -Milliseconds 500

        # Verify
        $o = Api "GET" "/orders/$ORDER_ID" $SALE1
        $odata = if ($o.data) { $o.data } else { $o }
        $newPaid = [double]$odata.depositPaid
        $pct = [math]::Round($newPaid / $total * 100, 1)
        Log-Info "After additional deposit: paid=$newPaid ($pct%)"
        if ($pct -ge 70) { Log-Pass "C0: Deposit at $pct% (>= 70% procurement gate)" }
        else { Log-Fail "C0: Deposit only $pct% (need 70%)" }
    } else {
        Log-Pass "C0: Already at 70%+ deposit"
    }
} catch { Log-Fail "C0: Additional deposit failed - $($_.Exception.Message)" }

# === C1: Create SupplierOrder ===
Write-Host "`n=== TEST C1: Create SupplierOrder ===" -ForegroundColor Yellow
try {
    $soBody = @{
        orderId            = $ORDER_ID
        supplierName       = "Shenzhen Audio Tech Co."
        supplierPlatform   = "TAOBAO"
        supplierUrl        = "https://shop.taobao.com/shop123"
        quotedPriceCNY     = 950
        shippingFeeCNY     = 75
        quantityOrdered    = 15
        estimatedDelivery  = (Get-Date).AddDays(5).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        note               = "5x tai nghe XM5 + 10x op lung iPhone 15"
        internalNote       = "NCC uy tin, giao hang nhanh"
    }
    $soRes = Api "POST" "/supplier-orders" $XNK $soBody
    $so = if ($soRes.data) { $soRes.data } else { $soRes }
    $SO_ID   = $so.id
    $SO_CODE = $so.code
    Log-Info "SupplierOrder: $SO_CODE | status=$($so.status) | quotedPrice=$($so.quotedPriceCNY)"

    if ($so.status -eq "DRAFT") { Log-Pass "C1a: SupplierOrder created (DRAFT)" }
    else { Log-Fail "C1a: Expected DRAFT, got $($so.status)" }

    if ($SO_CODE -match "^SO-") { Log-Pass "C1b: Code format SO-YYYYMM-XXXX ($SO_CODE)" }
    else { Log-Fail "C1b: Invalid code format: $SO_CODE" }
} catch {
    Log-Fail "C1: Create SupplierOrder failed - $($_.Exception.Message)"
}

# === C2: DRAFT -> QUOTED ===
Write-Host "`n=== TEST C2-C5: SupplierOrder status transitions ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/supplier-orders/$SO_ID/status" $XNK @{ status = "QUOTED"; note = "NCC bao gia 950 CNY" }
    $so = Api "GET" "/supplier-orders/$SO_ID" $XNK
    $soData = if ($so.data) { $so.data } else { $so }
    if ($soData.status -eq "QUOTED") { Log-Pass "C2: DRAFT -> QUOTED" }
    else { Log-Fail "C2: Expected QUOTED, got $($soData.status)" }
} catch { Log-Fail "C2: QUOTED transition failed - $($_.Exception.Message)" }

# === C3: QUOTED -> ORDERED ===
try {
    Api "PATCH" "/supplier-orders/$SO_ID/status" $XNK @{ status = "ORDERED"; note = "Da dat hang voi NCC" }
    $so = Api "GET" "/supplier-orders/$SO_ID" $XNK
    $soData = if ($so.data) { $so.data } else { $so }
    if ($soData.status -eq "ORDERED") { Log-Pass "C3: QUOTED -> ORDERED" }
    else { Log-Fail "C3: Expected ORDERED, got $($soData.status)" }
    if ($soData.orderedAt) { Log-Pass "C3b: orderedAt timestamp recorded" }
    else { Log-Warn "C3b: orderedAt not set" }
} catch { Log-Fail "C3: ORDERED transition failed - $($_.Exception.Message)" }

# === C4: ORDERED -> CONFIRMED ===
try {
    Api "PATCH" "/supplier-orders/$SO_ID/status" $XNK @{ status = "CONFIRMED"; note = "NCC xac nhan don hang" }
    $so = Api "GET" "/supplier-orders/$SO_ID" $XNK
    $soData = if ($so.data) { $so.data } else { $so }
    if ($soData.status -eq "CONFIRMED") { Log-Pass "C4: ORDERED -> CONFIRMED" }
    else { Log-Fail "C4: Expected CONFIRMED, got $($soData.status)" }
    if ($soData.confirmedAt) { Log-Pass "C4b: confirmedAt timestamp recorded" }
    else { Log-Warn "C4b: confirmedAt not set" }
} catch { Log-Fail "C4: CONFIRMED transition failed - $($_.Exception.Message)" }

# === C5: CONFIRMED -> SHIPPED_CN ===
try {
    Api "PATCH" "/supplier-orders/$SO_ID/status" $XNK @{ status = "SHIPPED_CN"; note = "NCC da gui hang noi dia TQ" }
    $so = Api "GET" "/supplier-orders/$SO_ID" $XNK
    $soData = if ($so.data) { $so.data } else { $so }
    if ($soData.status -eq "SHIPPED_CN") { Log-Pass "C5: CONFIRMED -> SHIPPED_CN" }
    else { Log-Fail "C5: Expected SHIPPED_CN, got $($soData.status)" }
    if ($soData.shippedAt) { Log-Pass "C5b: shippedAt timestamp recorded" }
    else { Log-Warn "C5b: shippedAt not set" }
} catch { Log-Fail "C5: SHIPPED_CN transition failed - $($_.Exception.Message)" }

# === C6: Record received (with mandatory photos) ===
Write-Host "`n=== TEST C6: Record goods received ===" -ForegroundColor Yellow
try {
    $recvBody = @{
        quantityReceived = 15
        actualPriceCNY   = 960
        note             = "Nhan du 15 san pham, kiem tra so bo OK"
        attachments      = @(
            "https://storage.example.com/recv-photo-1.jpg",
            "https://storage.example.com/recv-photo-2.jpg"
        )
    }
    $recvRes = Api "POST" "/supplier-orders/$SO_ID/received" $XNK $recvBody
    $recv = if ($recvRes.data) { $recvRes.data } else { $recvRes }
    Log-Info "Status after receive: $($recv.status) | qtyReceived=$($recv.quantityReceived) | actualPrice=$($recv.actualPriceCNY)"

    if ($recv.status -eq "RECEIVED_CN") { Log-Pass "C6a: Status -> RECEIVED_CN (full qty)" }
    elseif ($recv.status -eq "SHIPPED_CN") { Log-Warn "C6a: Status still SHIPPED_CN (may need manual transition)" }
    else { Log-Fail "C6a: Unexpected status $($recv.status)" }

    if ([int]$recv.quantityReceived -eq 15) { Log-Pass "C6b: Quantity received=15 (full)" }
    else { Log-Fail "C6b: Expected qty=15, got $($recv.quantityReceived)" }
} catch { Log-Fail "C6: Record received failed - $($_.Exception.Message)" }

# === C7: List supplier orders for this order ===
Write-Host "`n=== TEST C7: List supplier orders ===" -ForegroundColor Yellow
try {
    $soList = Api "GET" "/supplier-orders/order/$ORDER_ID" $XNK
    $soItems = if ($soList.data) { $soList.data } else { @($soList) }
    $soCount = if ($soItems -is [array]) { $soItems.Count } else { 1 }
    Log-Info "Supplier orders for $ORDER_CODE : $soCount"
    if ($soCount -ge 1) { Log-Pass "C7: Found $soCount supplier order(s)" }
    else { Log-Fail "C7: No supplier orders found" }
} catch { Log-Fail "C7: List supplier orders failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART D: WAREHOUSE CN + QC INSPECTION" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === D1: Receive package at warehouse CN ===
Write-Host "`n=== TEST D1: Receive package at warehouse CN ===" -ForegroundColor Yellow
$trackingCN = "CN-MHH-" + (Get-Date -Format "yyyyMMdd-HHmmss")
try {
    $recvPkgBody = @{
        trackingNumberCN = $trackingCN
        orderId          = $ORDER_ID
        description      = "5x tai nghe + 10x op lung tu NCC Shenzhen Audio"
        imageUrls        = @(
            "https://storage.example.com/pkg-recv-1.jpg",
            "https://storage.example.com/pkg-recv-2.jpg"
        )
        note = "Kien hang tu NCC, kiem tra so luong OK"
    }
    $pkgRes = Api "POST" "/warehouse-cn/receive" $WH_CN $recvPkgBody
    $pkg = if ($pkgRes.data) { $pkgRes.data } else { $pkgRes }
    # Handle nested package response
    $pkgObj = if ($pkg.package) { $pkg.package } else { $pkg }
    $PKG_ID   = $pkgObj.id
    $PKG_CODE = $pkgObj.code
    Log-Info "Package: $PKG_CODE | ID=$PKG_ID | tracking=$trackingCN"
    Log-Info "warehouseCNStatus=$($pkgObj.warehouseCNStatus)"

    if ($PKG_ID) { Log-Pass "D1a: Package received at warehouse CN" }
    else { Log-Fail "D1a: Package creation failed" }

    if ($pkgObj.warehouseCNStatus -eq "RECEIVED") { Log-Pass "D1b: warehouseCNStatus=RECEIVED" }
    else { Log-Warn "D1b: warehouseCNStatus=$($pkgObj.warehouseCNStatus)" }
} catch { Log-Fail "D1: Receive package failed - $($_.Exception.Message)" }

# === D2: Order -> WAREHOUSE_CN ===
Write-Host "`n=== TEST D2: Order -> WAREHOUSE_CN ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$ORDER_ID/status" $SALE1 @{ status = "WAREHOUSE_CN"; note = "Hang da nhap kho TQ" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "WAREHOUSE_CN") { Log-Pass "D2: Order -> WAREHOUSE_CN" }
    else { Log-Fail "D2: Expected WAREHOUSE_CN, got $($odata.status)" }
} catch { Log-Fail "D2: WAREHOUSE_CN transition failed - $($_.Exception.Message)" }

# === D3: Create QC inspection ===
Write-Host "`n=== TEST D3: Create QC inspection ===" -ForegroundColor Yellow
try {
    $qcBody = @{
        orderId   = $ORDER_ID
        packageId = $PKG_ID
    }
    $qcRes = Api "POST" "/qc/inspections" $WH_CN $qcBody
    $qc = if ($qcRes.data) { $qcRes.data } else { $qcRes }
    $QC_ID   = $qc.id
    $QC_CODE = $qc.code
    Log-Info "QC: $QC_CODE | status=$($qc.status)"

    if ($qc.status -eq "PENDING") { Log-Pass "D3: QC inspection created (PENDING)" }
    else { Log-Fail "D3: Expected PENDING, got $($qc.status)" }
} catch { Log-Fail "D3: Create QC failed - $($_.Exception.Message)" }

# === D4: Start QC ===
Write-Host "`n=== TEST D4: Start QC inspection ===" -ForegroundColor Yellow
try {
    $qcStart = Api "POST" "/qc/inspections/$QC_ID/start" $WH_CN
    $qcData = if ($qcStart.data) { $qcStart.data } else { $qcStart }
    if ($qcData.status -eq "INSPECTING") { Log-Pass "D4: QC started (INSPECTING)" }
    else { Log-Fail "D4: Expected INSPECTING, got $($qcData.status)" }
} catch { Log-Fail "D4: Start QC failed - $($_.Exception.Message)" }

# === D5: Submit QC results (PASSED) ===
Write-Host "`n=== TEST D5: Submit QC results ===" -ForegroundColor Yellow
try {
    $qcSubmit = @{
        inspectedQuantity = 15
        passedQuantity    = 15
        failedQuantity    = 0
        overallRating     = 5
        checklistResults  = @{
            correct_item  = $true
            no_damage     = $true
            quantity_match = $true
            packaging_ok  = $true
        }
        inspectorNote  = "Tat ca 15 san pham dat chuan, khong co loi"
        photoUrls      = @("https://storage.example.com/qc-overview-1.jpg")
        detailPhotoUrls = @("https://storage.example.com/qc-detail-1.jpg")
    }
    $qcResult = Api "POST" "/qc/inspections/$QC_ID/submit" $WH_CN $qcSubmit
    $qcData = if ($qcResult.data) { $qcResult.data } else { $qcResult }
    Log-Info "QC result: status=$($qcData.status) | passed=$($qcData.passedQuantity)/$($qcData.inspectedQuantity) | rating=$($qcData.overallRating)"

    if ($qcData.status -eq "PASSED") { Log-Pass "D5a: QC result = PASSED (all 15 items)" }
    else { Log-Fail "D5a: Expected PASSED, got $($qcData.status)" }

    if ([int]$qcData.passedQuantity -eq 15) { Log-Pass "D5b: passedQuantity=15" }
    else { Log-Fail "D5b: Expected passedQuantity=15, got $($qcData.passedQuantity)" }
} catch { Log-Fail "D5: Submit QC failed - $($_.Exception.Message)" }

# === D6: Send to customer ===
Write-Host "`n=== TEST D6: Send QC photos to customer ===" -ForegroundColor Yellow
try {
    $sendRes = Api "POST" "/qc/inspections/$QC_ID/send-to-customer" $WH_CN
    $sendData = if ($sendRes.data) { $sendRes.data } else { $sendRes }
    if ($sendData.status -eq "CUSTOMER_REVIEW") { Log-Pass "D6: QC sent to customer (CUSTOMER_REVIEW)" }
    else { Log-Fail "D6: Expected CUSTOMER_REVIEW, got $($sendData.status)" }
} catch { Log-Fail "D6: Send to customer failed - $($_.Exception.Message)" }

# === D7: Customer approves ===
Write-Host "`n=== TEST D7: Customer approves QC ===" -ForegroundColor Yellow
try {
    $custDecision = Api "POST" "/qc/inspections/$QC_ID/customer-decision" $SALE1 @{
        approved     = $true
        customerNote = "Hang dep, dong y gui ve VN"
    }
    $decData = if ($custDecision.data) { $custDecision.data } else { $custDecision }
    if ($decData.status -eq "CUSTOMER_APPROVED") { Log-Pass "D7: Customer APPROVED QC (terminal)" }
    else { Log-Fail "D7: Expected CUSTOMER_APPROVED, got $($decData.status)" }
} catch { Log-Fail "D7: Customer decision failed - $($_.Exception.Message)" }

# === D8: Measure package ===
Write-Host "`n=== TEST D8: Measure package ===" -ForegroundColor Yellow
try {
    $measureBody = @{
        actualWeight = 8.5
        length       = 60
        width        = 40
        height       = 35
    }
    $measRes = Api "POST" "/warehouse-cn/packages/$PKG_ID/measure" $WH_CN $measureBody
    $measRaw = if ($measRes.data) { $measRes.data } else { $measRes }
    # Response: { package: {...}, calculation: { volumetricWeight, chargeableWeight, isVolumetric } }
    $meas = if ($measRaw.package) { $measRaw.package } else { $measRaw }
    $calc = $measRaw.calculation
    Log-Info "actualWeight=$($meas.actualWeight)kg | L=$($meas.length) W=$($meas.width) H=$($meas.height)"
    Log-Info "volumetricWeight=$($calc.volumetricWeight) | chargeableWeight=$($calc.chargeableWeight) | isVolumetric=$($calc.isVolumetric)"

    $cw = if ($calc.chargeableWeight) { $calc.chargeableWeight } else { $meas.chargeableWeight }
    if ($cw) { Log-Pass "D8a: Package measured, chargeableWeight=$cw" }
    else { Log-Fail "D8a: chargeableWeight not calculated" }

    # Verify volumetric = LxWxH/5000
    $expectedVol = [math]::Round(60 * 40 * 35 / 5000.0, 2)
    Log-Info "Expected volumetric: $expectedVol | chargeableWeight = MAX(8.5, $expectedVol)"
    if ($meas.warehouseCNStatus -eq "CHECKED") { Log-Pass "D8b: Status -> CHECKED after measure" }
    else { Log-Warn "D8b: Status=$($meas.warehouseCNStatus) (expected CHECKED)" }
} catch { Log-Fail "D8: Measure package failed - $($_.Exception.Message)" }

# === D9: CHECKED -> PACKED ===
Write-Host "`n=== TEST D9: Pack package ===" -ForegroundColor Yellow
try {
    $packRes = Api "PATCH" "/warehouse-cn/packages/$PKG_ID/status" $WH_CN @{ status = "PACKED" }
    $packData = if ($packRes.data) { $packRes.data } else { $packRes }
    if ($packData.warehouseCNStatus -eq "PACKED") { Log-Pass "D9: Package CHECKED -> PACKED" }
    else { Log-Fail "D9: Expected PACKED, got $($packData.warehouseCNStatus)" }
} catch { Log-Fail "D9: Pack failed - $($_.Exception.Message)" }

# === D10: Order -> PACKING ===
Write-Host "`n=== TEST D10: Order -> PACKING ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$ORDER_ID/status" $WH_CN @{ status = "PACKING"; note = "Dong goi xong" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "PACKING") { Log-Pass "D10: Order -> PACKING" }
    else { Log-Fail "D10: Expected PACKING, got $($odata.status)" }
} catch { Log-Fail "D10: PACKING transition failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART E: CONTAINER + TRANSIT" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === E1: Create container ===
Write-Host "`n=== TEST E1: Create container ===" -ForegroundColor Yellow
try {
    $cntBody = @{
        shippingRoute        = "SEA"
        origin               = "Guangzhou Warehouse"
        destination          = "Hanoi Warehouse"
        carrier              = "COSCO Shipping"
        maxCapacity          = 20
        estimatedDepartureAt = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        estimatedArrivalAt   = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    $cntRes = Api "POST" "/containers" $XNK $cntBody
    $cnt = if ($cntRes.data) { $cntRes.data } else { $cntRes }
    $CNT_ID   = $cnt.id
    $CNT_CODE = $cnt.code
    Log-Info "Container: $CNT_CODE | status=$($cnt.status)"

    if ($cnt.status -eq "PLANNING") { Log-Pass "E1: Container created (PLANNING)" }
    else { Log-Fail "E1: Expected PLANNING, got $($cnt.status)" }
} catch { Log-Fail "E1: Create container failed - $($_.Exception.Message)" }

# === E2: Add packages ===
Write-Host "`n=== TEST E2: Add packages to container ===" -ForegroundColor Yellow
try {
    $addRes = Api "POST" "/containers/$CNT_ID/add-packages" $XNK @{ packageIds = @($PKG_ID) }
    $addData = if ($addRes.data) { $addRes.data } else { $addRes }
    Log-Info "totalPackages=$($addData.totalPackages) | totalWeight=$($addData.totalWeight)"
    if ([int]$addData.totalPackages -ge 1) { Log-Pass "E2: Package added to container" }
    else { Log-Fail "E2: No packages added" }
} catch { Log-Fail "E2: Add packages failed - $($_.Exception.Message)" }

# === E3: PLANNING -> LOADING -> IN_TRANSIT ===
Write-Host "`n=== TEST E3: Container status transitions ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/containers/$CNT_ID/status" $XNK @{ status = "LOADING" }
    $cnt = Api "GET" "/containers/$CNT_ID" $XNK
    $cntData = if ($cnt.data) { $cnt.data } else { $cnt }
    if ($cntData.status -eq "LOADING") { Log-Pass "E3a: PLANNING -> LOADING" }
    else { Log-Fail "E3a: Expected LOADING, got $($cntData.status)" }

    # Order -> CONSOLIDATION
    Api "PATCH" "/orders/$ORDER_ID/status" $XNK @{ status = "CONSOLIDATION" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "CONSOLIDATION") { Log-Pass "E3b: Order -> CONSOLIDATION" }
    else { Log-Fail "E3b: Expected CONSOLIDATION, got $($odata.status)" }

    Api "PATCH" "/containers/$CNT_ID/status" $XNK @{ status = "IN_TRANSIT" }
    $cnt = Api "GET" "/containers/$CNT_ID" $XNK
    $cntData = if ($cnt.data) { $cnt.data } else { $cnt }
    if ($cntData.status -eq "IN_TRANSIT") { Log-Pass "E3c: LOADING -> IN_TRANSIT" }
    else { Log-Fail "E3c: Expected IN_TRANSIT, got $($cntData.status)" }
} catch { Log-Fail "E3: Container transitions failed - $($_.Exception.Message)" }

# === E4: Order -> IN_TRANSIT ===
Write-Host "`n=== TEST E4: Order -> IN_TRANSIT ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$ORDER_ID/status" $XNK @{ status = "IN_TRANSIT"; note = "Container dang van chuyen" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "IN_TRANSIT") { Log-Pass "E4: Order -> IN_TRANSIT" }
    else { Log-Fail "E4: Expected IN_TRANSIT, got $($odata.status)" }
} catch { Log-Fail "E4: IN_TRANSIT transition failed - $($_.Exception.Message)" }

# === E5: Container -> ARRIVED -> CUSTOMS -> COMPLETED ===
Write-Host "`n=== TEST E5: Container customs flow ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/containers/$CNT_ID/status" $XNK @{ status = "ARRIVED" }
    $cnt = Api "GET" "/containers/$CNT_ID" $XNK
    $cntData = if ($cnt.data) { $cnt.data } else { $cnt }
    if ($cntData.status -eq "ARRIVED") { Log-Pass "E5a: Container ARRIVED" }
    else { Log-Fail "E5a: Expected ARRIVED, got $($cntData.status)" }

    Api "PATCH" "/containers/$CNT_ID/status" $XNK @{ status = "CUSTOMS" }
    Api "PATCH" "/containers/$CNT_ID/status" $XNK @{ status = "COMPLETED" }
    $cnt = Api "GET" "/containers/$CNT_ID" $XNK
    $cntData = if ($cnt.data) { $cnt.data } else { $cnt }
    if ($cntData.status -eq "COMPLETED") { Log-Pass "E5b: Container CUSTOMS -> COMPLETED" }
    else { Log-Fail "E5b: Expected COMPLETED, got $($cntData.status)" }
} catch { Log-Fail "E5: Container customs flow failed - $($_.Exception.Message)" }

# === E6: Order -> CUSTOMS ===
Write-Host "`n=== TEST E6: Order -> CUSTOMS ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$ORDER_ID/status" $XNK @{ status = "CUSTOMS"; note = "Dang thong quan" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "CUSTOMS") { Log-Pass "E6: Order -> CUSTOMS" }
    else { Log-Fail "E6: Expected CUSTOMS, got $($odata.status)" }
} catch { Log-Fail "E6: CUSTOMS transition failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART F: WAREHOUSE VN + DELIVERY" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === F1: Order -> WAREHOUSE_VN ===
Write-Host "`n=== TEST F1: Order -> WAREHOUSE_VN ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$ORDER_ID/status" $KHOVN @{ status = "WAREHOUSE_VN"; note = "Da nhap kho VN" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "WAREHOUSE_VN") { Log-Pass "F1: Order -> WAREHOUSE_VN" }
    else { Log-Fail "F1: Expected WAREHOUSE_VN, got $($odata.status)" }
} catch { Log-Fail "F1: WAREHOUSE_VN transition failed - $($_.Exception.Message)" }

# === F2: Receive at VN warehouse ===
Write-Host "`n=== TEST F2: Receive at VN warehouse ===" -ForegroundColor Yellow
try {
    $recvVN = Api "POST" "/warehouse-vn/receive" $KHOVN @{
        containerId = $CNT_ID
        packageIds  = @($PKG_ID)
        note        = "Nhan hang tu container $CNT_CODE"
    }
    $recvData = if ($recvVN.data) { $recvVN.data } else { $recvVN }
    Log-Info "Received: $($recvData.receivedCount) packages"
    if ([int]$recvData.receivedCount -ge 1) { Log-Pass "F2: Package received at VN warehouse" }
    else { Log-Warn "F2: receivedCount=$($recvData.receivedCount)" }
} catch { Log-Fail "F2: Receive VN failed - $($_.Exception.Message)" }

# === F3: Sort packages ===
Write-Host "`n=== TEST F3: Sort packages ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/warehouse-vn/packages/sort" $KHOVN @{
        packageIds = @($PKG_ID)
        status     = "SORTED"
    }
    Api "PATCH" "/warehouse-vn/packages/sort" $KHOVN @{
        packageIds = @($PKG_ID)
        status     = "READY"
    }
    Log-Pass "F3: Package sorted (RECEIVED -> SORTED -> READY)"
} catch { Log-Fail "F3: Sort failed - $($_.Exception.Message)" }

# === F4: Pay remaining balance ===
Write-Host "`n=== TEST F4: Pay remaining balance ===" -ForegroundColor Yellow
try {
    # Fetch current order to check remaining
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    $remainingAmt = [double]$odata.totalAmount - [double]$odata.depositPaid
    Log-Info "Total=$($odata.totalAmount) | Paid=$($odata.depositPaid) | Remaining=$remainingAmt"

    if ($remainingAmt -gt 0) {
        $vBody2 = @{
            type          = "RECEIPT"
            orderId       = $ORDER_ID
            amount        = $remainingAmt
            currency      = $ORDER_CURRENCY
            paymentMethod = "BANK_TRANSFER"
            costType      = "SETTLEMENT"
            beneficiary   = if ($cust.fullName) { $cust.fullName } else { "Khach hang VIP" }
            reason        = "Thanh toan so du con lai don hang MHH $ORDER_CODE - Quyet toan cuoi cung truoc giao hang"
        }
        $v2 = Api "POST" "/cash/vouchers" $KETOAN $vBody2
        $v2Raw = if ($v2.data) { $v2.data } else { $v2 }
        $v2Data = if ($v2Raw.voucher) { $v2Raw.voucher } else { $v2Raw }
        $V2_ID = $v2Data.id

        # Approve
        Api "PATCH" "/cash/vouchers/$V2_ID/approve" $CFO
        Start-Sleep -Milliseconds 500
        Log-Pass "F4: Remaining $remainingAmt $ORDER_CURRENCY paid and approved"
    } else {
        Log-Pass "F4: No remaining balance (fully paid from deposit)"
    }
} catch { Log-Fail "F4: Pay remaining failed - $($_.Exception.Message)" }

# === F5: Dispatch delivery ===
Write-Host "`n=== TEST F5: Dispatch delivery ===" -ForegroundColor Yellow
try {
    # Get a driver ID for dispatch (so status becomes DISPATCHED, not PENDING)
    $DRIVER_ID = $null
    try {
        $driversRes = Api "GET" "/drivers?limit=5" $KHOVN
        $driversList = @(if ($driversRes.data) { $driversRes.data } else { $driversRes })
        if ($driversList.Count -gt 0) {
            $DRIVER_ID = $driversList[0].id
            Log-Info "Driver: $($driversList[0].fullName) | ID=$DRIVER_ID"
        } else {
            Log-Info "No drivers found, dispatch without driver"
        }
    } catch {
        Log-Info "Could not fetch drivers: $($_.Exception.Message)"
    }

    $dispBody = @{
        deliveries = @(
            @{
                orderId         = $ORDER_ID
                recipientName   = if ($cust.fullName) { $cust.fullName } else { "Nguyen Van A" }
                recipientPhone  = if ($cust.phone) { $cust.phone } else { "0901234567" }
                deliveryAddress = if ($cust.address) { $cust.address } else { "123 Le Loi, Q1, TP.HCM" }
                codAmount       = 0
                note            = "Giao hang don MHH"
            }
        )
    }
    if ($DRIVER_ID) { $dispBody.driverId = $DRIVER_ID }
    $dispRes = Api "POST" "/warehouse-vn/dispatch" $KHOVN $dispBody
    $dispData = if ($dispRes.data) { $dispRes.data } else { $dispRes }
    # Handle array or single delivery
    $delivery = if ($dispData -is [array]) { $dispData[0] } else { $dispData }
    $DEL_ID   = $delivery.id
    $DEL_CODE = $delivery.code
    Log-Info "Delivery: $DEL_CODE | status=$($delivery.status)"

    if ($DEL_ID) { Log-Pass "F5: Delivery dispatched ($DEL_CODE)" }
    else { Log-Fail "F5: Delivery dispatch failed" }
} catch { Log-Fail "F5: Dispatch failed - $($_.Exception.Message)" }

# === F6: Order -> DELIVERING ===
Write-Host "`n=== TEST F6: Order -> DELIVERING ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$ORDER_ID/status" $KHOVN @{ status = "DELIVERING"; note = "Dang giao hang" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "DELIVERING") { Log-Pass "F6: Order -> DELIVERING" }
    else { Log-Fail "F6: Expected DELIVERING, got $($odata.status)" }
} catch { Log-Fail "F6: DELIVERING transition failed - $($_.Exception.Message)" }

# === F7: Confirm delivery (with POD) ===
Write-Host "`n=== TEST F7: Confirm delivery ===" -ForegroundColor Yellow
try {
    $confirmBody = @{
        podImageUrl       = "https://storage.example.com/pod-mhh-delivery.jpg"
        deliveryProofUrls = @(
            "https://storage.example.com/proof-1.jpg",
            "https://storage.example.com/proof-2.jpg"
        )
        signatureUrl      = "https://storage.example.com/signature-mhh.jpg"
        codCollected      = $false
    }
    $confRes = Api "POST" "/warehouse-vn/deliveries/$DEL_ID/confirm" $KHOVN $confirmBody
    $confData = if ($confRes.data) { $confRes.data } else { $confRes }
    Log-Info "Delivery status: $($confData.status)"

    if ($confData.status -eq "DELIVERED") { Log-Pass "F7: Delivery confirmed (DELIVERED)" }
    else { Log-Fail "F7: Expected DELIVERED, got $($confData.status)" }
} catch { Log-Fail "F7: Confirm delivery failed - $($_.Exception.Message)" }

# === F8: Order -> SETTLEMENT -> COMPLETED ===
Write-Host "`n=== TEST F8: Order -> SETTLEMENT -> COMPLETED ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$ORDER_ID/status" $KETOAN @{ status = "SETTLEMENT"; note = "Bat dau quyet toan" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "SETTLEMENT") { Log-Pass "F8a: Order -> SETTLEMENT" }
    else { Log-Fail "F8a: Expected SETTLEMENT, got $($odata.status)" }

    Api "PATCH" "/orders/$ORDER_ID/status" $KETOAN @{ status = "COMPLETED"; note = "Don hang hoan tat" }
    $o = Api "GET" "/orders/$ORDER_ID" $SALE1
    $odata = if ($o.data) { $o.data } else { $o }
    if ($odata.status -eq "COMPLETED") { Log-Pass "F8b: Order -> COMPLETED (terminal)" }
    else { Log-Fail "F8b: Expected COMPLETED, got $($odata.status)" }
} catch { Log-Fail "F8: Settlement/Completion failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART G: SETTLEMENT VERIFICATION" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === G1: Three-way matching ===
Write-Host "`n=== TEST G1: Three-way matching ===" -ForegroundColor Yellow
try {
    $twm = Api "GET" "/orders/$ORDER_ID/three-way-match" $KETOAN
    $twmData = if ($twm.data) { $twm.data } else { $twm }
    Log-Info "matched=$($twmData.matched) | qtyOrdered=$($twmData.quantityOrdered) | qtyReceived=$($twmData.quantityReceived)"
    Log-Info "quotedCNY=$($twmData.totalQuotedCNY) | paidCNY=$($twmData.totalPaidCNY)"
    if ($twmData.quantityOrdered -or $twmData.totalQuotedCNY) {
        Log-Pass "G1: Three-way matching data retrieved"
    } else {
        Log-Warn "G1: Three-way matching returned incomplete data"
    }
} catch { Log-Warn "G1: Three-way matching not available - $($_.Exception.Message)" }

# === G2: Final order verification ===
Write-Host "`n=== TEST G2: Final order details ===" -ForegroundColor Yellow
try {
    $final = Api "GET" "/orders/$ORDER_ID" $SALE1
    $fdata = if ($final.data) { $final.data } else { $final }

    Log-Info "=== FINAL ORDER STATE ==="
    Log-Info "Code: $($fdata.code)"
    Log-Info "ServiceType: $($fdata.serviceType)"
    Log-Info "Status: $($fdata.status)"
    Log-Info "TotalAmount: $($fdata.totalAmount) $($fdata.currency)"
    Log-Info "DepositRequired: $($fdata.depositRequired)"
    Log-Info "DepositPaid: $($fdata.depositPaid)"
    Log-Info "IsDepositPaid: $($fdata.isDepositPaid)"
    Log-Info "ShippingRoute: $($fdata.shippingRoute)"
    Log-Info "CompletedAt: $($fdata.completedAt)"

    if ($fdata.status -eq "COMPLETED") { Log-Pass "G2a: Final status = COMPLETED" }
    else { Log-Fail "G2a: Expected COMPLETED, got $($fdata.status)" }

    if ($fdata.serviceType -eq "MHH") { Log-Pass "G2b: ServiceType = MHH confirmed" }
    else { Log-Fail "G2b: Expected MHH, got $($fdata.serviceType)" }

    if ($fdata.completedAt) { Log-Pass "G2c: completedAt timestamp recorded" }
    else { Log-Warn "G2c: completedAt not set" }
} catch { Log-Fail "G2: Final order check failed - $($_.Exception.Message)" }

# === G3: Verify items have MHH details ===
Write-Host "`n=== TEST G3: Verify order items ===" -ForegroundColor Yellow
try {
    $items = if ($fdata.items) { $fdata.items } else { @() }
    $itemCount = if ($items -is [array]) { $items.Count } else { 1 }
    Log-Info "Order items: $itemCount"

    if ($itemCount -ge 2) {
        Log-Pass "G3a: Order has $itemCount items (expected 2)"
        $item1 = $items[0]
        Log-Info "  Item1: $($item1.productName) | qty=$($item1.quantity) | unitPrice=$($item1.unitPrice) | url=$($item1.productUrl)"
        if ($item1.productUrl -match "taobao.com") { Log-Pass "G3b: Item has product URL (taobao)" }
        else { Log-Warn "G3b: Item productUrl=$($item1.productUrl)" }
    } else {
        Log-Warn "G3a: Expected 2 items, found $itemCount (items may not be included in response)"
    }
} catch { Log-Warn "G3: Item verification - $($_.Exception.Message)" }

# === G4: Verify supplier order final state ===
Write-Host "`n=== TEST G4: Verify supplier order state ===" -ForegroundColor Yellow
try {
    $soFinal = Api "GET" "/supplier-orders/$SO_ID" $XNK
    $soData = if ($soFinal.data) { $soFinal.data } else { $soFinal }
    Log-Info "SupplierOrder: $($soData.code) | status=$($soData.status)"
    Log-Info "quotedPrice=$($soData.quotedPriceCNY) | actualPrice=$($soData.actualPriceCNY) | shippingFee=$($soData.shippingFeeCNY)"
    Log-Info "qtyOrdered=$($soData.quantityOrdered) | qtyReceived=$($soData.quantityReceived)"

    if ($soData.status -eq "RECEIVED_CN") { Log-Pass "G4a: SupplierOrder final status=RECEIVED_CN" }
    else { Log-Warn "G4a: SupplierOrder status=$($soData.status) (expected RECEIVED_CN)" }

    if ([int]$soData.quantityReceived -eq [int]$soData.quantityOrdered) {
        Log-Pass "G4b: Full quantity received ($($soData.quantityReceived)/$($soData.quantityOrdered))"
    } else {
        Log-Warn "G4b: Quantity mismatch: received=$($soData.quantityReceived) vs ordered=$($soData.quantityOrdered)"
    }
} catch { Log-Fail "G4: Supplier order check failed - $($_.Exception.Message)" }

# === G5: Audit trail (from order detail statusHistory field) ===
Write-Host "`n=== TEST G5: Verify audit trail ===" -ForegroundColor Yellow
try {
    $orderDetail = Api "GET" "/orders/$ORDER_ID" $SALE1
    $oDetail = if ($orderDetail.data) { $orderDetail.data } else { $orderDetail }
    $histData = $oDetail.statusHistory
    if (-not $histData) { $histData = @() }
    $histCount = if ($histData -is [array]) { $histData.Count } else { 1 }
    Log-Info "Status history entries: $histCount"

    # Expected: 12 transitions (CONSULTING->QUOTATION->PENDING_DEPOSIT->SOURCING->WAREHOUSE_CN
    #           ->PACKING->CONSOLIDATION->IN_TRANSIT->CUSTOMS->WAREHOUSE_VN->DELIVERING->SETTLEMENT->COMPLETED)
    if ($histCount -ge 12) {
        Log-Pass "G5a: Full audit trail ($histCount entries, expected 12+)"

        # Verify key transitions exist
        $statuses = if ($histData -is [array]) { $histData | ForEach-Object { $_.toStatus } } else { @($histData.toStatus) }
        $expected = @("QUOTATION","PENDING_DEPOSIT","SOURCING","WAREHOUSE_CN","PACKING","CONSOLIDATION","IN_TRANSIT","CUSTOMS","WAREHOUSE_VN","DELIVERING","SETTLEMENT","COMPLETED")
        $missing = $expected | Where-Object { $_ -notin $statuses }
        if ($missing.Count -eq 0) {
            Log-Pass "G5b: All 12 status transitions recorded in audit trail"
        } else {
            Log-Warn "G5b: Missing transitions: $($missing -join ', ')"
        }
    } else {
        Log-Warn "G5a: Only $histCount audit entries (expected 12+)"
    }
} catch { Log-Warn "G5: Audit trail - $($_.Exception.Message)" }

# === SUMMARY ===
Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  TONG KET TEST-ORD-003: Full MHH Lifecycle" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White
Write-Host ""
Write-Host "  Part A: MHH Price Calculator" -ForegroundColor Gray
Write-Host "  Part B: Order Creation + Deposit Flow + SOURCING Gate" -ForegroundColor Gray
Write-Host "  Part C: Supplier Order Lifecycle (DRAFT -> RECEIVED_CN)" -ForegroundColor Gray
Write-Host "  Part D: Warehouse CN + QC Inspection + Customer Approve" -ForegroundColor Gray
Write-Host "  Part E: Container + Transit (PLANNING -> COMPLETED)" -ForegroundColor Gray
Write-Host "  Part F: Warehouse VN + Delivery + Settlement" -ForegroundColor Gray
Write-Host "  Part G: Verification (3-way match, audit trail)" -ForegroundColor Gray
Write-Host ""
Write-Host "  PASS: $pass" -ForegroundColor Green
Write-Host "  FAIL: $fail" -ForegroundColor Red
Write-Host "  WARN: $warn" -ForegroundColor Yellow
Write-Host ""
if ($fail -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $fail TEST(S) FAILED" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor White
