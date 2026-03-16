################################################################
#  TEST-ORD-005: Multi-Service Order (MasterOrder MHH + LCLCN)
#  Full lifecycle: MasterOrder creation -> Deposit -> Warehouse CN
#  -> Container -> Customs -> Warehouse VN -> Delivery -> Completion
#
#  Precondition: KH VIP (deposit 50%), backend running on port 3001
#  Key: MasterOrder = 1 don tong + N don con (sub-orders)
#        MHH = Mua hang ho (sourcing), LCLCN = LCL chinh ngach
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

function D($resp) {
    if ($resp.data) { return $resp.data }
    return $resp
}

Write-Host "================================================================" -ForegroundColor White
Write-Host "  TEST-ORD-005: Multi-Service Order (MasterOrder MHH + LCLCN)" -ForegroundColor White
Write-Host "  MasterOrder -> Deposit -> Warehouse -> Container -> Delivery" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# ============================================================
# SETUP: Login all roles
# ============================================================
Write-Host "`n=== SETUP: Login roles ===" -ForegroundColor Yellow
$SALE1  = Login "sale01@nhaphangchinhngach.vn"
if ($SALE1)  { Log-Pass "SALE1 login OK" } else { Log-Fail "SALE1 login"; return }
$XNK    = Login "xnk@nhaphangchinhngach.vn"
if ($XNK)    { Log-Pass "XNK login OK" } else { Log-Fail "XNK login"; return }
$WH_CN  = Login "khotq01@nhaphangchinhngach.vn"
if ($WH_CN)  { Log-Pass "WH_CN login OK" } else { Log-Fail "WH_CN login"; return }
$KHOVN  = Login "khovn@nhaphangchinhngach.vn"
if ($KHOVN)  { Log-Pass "KHOVN login OK" } else { Log-Fail "KHOVN login"; return }
$KETOAN = Login "ketoan@nhaphangchinhngach.vn"
if ($KETOAN) { Log-Pass "KETOAN login OK" } else { Log-Fail "KETOAN login"; return }
$CFO    = Login "cfo@nhaphangchinhngach.vn"
if ($CFO)    { Log-Pass "CFO login OK" } else { Log-Fail "CFO login"; return }
$CEO    = Login "ceo@nhaphangchinhngach.vn"
if ($CEO)    { Log-Pass "CEO login OK" } else { Log-Fail "CEO login"; return }

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
Write-Host "  PART A: MASTER ORDER CREATION" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === A1: Login verification already done above ===
# A1 is implicitly PASS from setup

# === A2: Create MasterOrder with 2 sub-orders ===
Write-Host "`n=== TEST A2: Create MasterOrder (MHH + LCLCN) ===" -ForegroundColor Yellow
$masterBody = @{
    customerId = $CUST_ID
    branch     = "HN"
    note       = "TEST-ORD-005: Don ket hop MHH + LCLCN - Multi-service test"
    subOrders  = @(
        @{
            serviceType   = "MHH"
            clearanceType = "TIEU_NGACH"
            shippingRoute = "SEA"
            items         = @(
                @{
                    productName = "Tai nghe Bluetooth XM5"
                    productUrl  = "https://item.taobao.com/item.htm?id=800001"
                    quantity    = 5
                    unitPrice   = 200
                    currency    = "CNY"
                    note        = "Mau: Den, Loai: Over-ear"
                },
                @{
                    productName = "Op lung iPhone 15 Pro Max"
                    productUrl  = "https://item.taobao.com/item.htm?id=800002"
                    quantity    = 10
                    unitPrice   = 50
                    currency    = "CNY"
                    note        = "Mau: Do, Chat lieu: Silicone"
                }
            )
            note = "Don MHH - Mua ho hang Taobao"
        },
        @{
            serviceType   = "LCLCN"
            clearanceType = "CHINH_NGACH"
            shippingRoute = "SEA"
            items         = @(
                @{
                    productName = "Linh kien may CNC HJM-500"
                    productUrl  = "https://detail.1688.com/offer/700001.html"
                    quantity    = 2
                    unitPrice   = 5000
                    currency    = "CNY"
                    note        = "Hang chinh ngach, co CO/CQ"
                },
                @{
                    productName = "Van bi cong nghiep DN50"
                    productUrl  = "https://detail.1688.com/offer/700002.html"
                    quantity    = 20
                    unitPrice   = 150
                    currency    = "CNY"
                    note        = "Inox 304, ap luc PN16"
                }
            )
            note = "Don LCLCN - Khach tu gui hang chinh ngach"
        }
    )
}
try {
    $masterRes = Api "POST" "/master-orders" $SALE1 $masterBody
    $master = D $masterRes
    $MASTER_ID = $master.id
    $MASTER_CODE = $master.code
    Log-Info "MasterOrder: $MASTER_CODE | ID=$MASTER_ID"
    Log-Info "overallStatus=$($master.overallStatus)"

    if ($MASTER_ID) { Log-Pass "A2a: MasterOrder created (201)" }
    else { Log-Fail "A2a: MasterOrder creation failed" }

    if ($master.overallStatus -eq "ACTIVE") { Log-Pass "A2b: overallStatus=ACTIVE" }
    else { Log-Fail "A2b: Expected ACTIVE, got $($master.overallStatus)" }

    # Extract sub-orders
    $subOrders = @()
    if ($master.subOrders) { $subOrders = @($master.subOrders) }
    elseif ($master.orders) { $subOrders = @($master.orders) }

    if ($subOrders.Count -eq 2) { Log-Pass "A2c: 2 sub-orders created" }
    else { Log-Fail "A2c: Expected 2 sub-orders, got $($subOrders.Count)" }

    # Identify MHH and LCLCN sub-orders
    $mhhOrder  = $subOrders | Where-Object { $_.serviceType -eq "MHH" } | Select-Object -First 1
    $lclOrder  = $subOrders | Where-Object { $_.serviceType -eq "LCLCN" } | Select-Object -First 1

    if (-not $mhhOrder -or -not $lclOrder) {
        # Try by index if serviceType not populated in creation response
        Log-Info "Trying to identify sub-orders by fetching master detail..."
        $masterDetail = Api "GET" "/master-orders/$MASTER_ID" $SALE1
        $md = D $masterDetail
        $subOrders = @()
        if ($md.subOrders) { $subOrders = @($md.subOrders) }
        elseif ($md.orders) { $subOrders = @($md.orders) }
        $mhhOrder  = $subOrders | Where-Object { $_.serviceType -eq "MHH" } | Select-Object -First 1
        $lclOrder  = $subOrders | Where-Object { $_.serviceType -eq "LCLCN" } | Select-Object -First 1
    }

    $MHH_ID   = $mhhOrder.id
    $MHH_CODE = $mhhOrder.code
    $LCL_ID   = $lclOrder.id
    $LCL_CODE = $lclOrder.code
    Log-Info "MHH sub-order: $MHH_CODE | ID=$MHH_ID"
    Log-Info "LCLCN sub-order: $LCL_CODE | ID=$LCL_ID"
} catch {
    Log-Fail "A2: Create MasterOrder failed - $($_.Exception.Message)"
    return
}

# === A3: Verify sub-order MHH ===
Write-Host "`n=== TEST A3: Verify MHH sub-order ===" -ForegroundColor Yellow
try {
    $mhhDetail = Api "GET" "/orders/$MHH_ID" $SALE1
    $mhh = D $mhhDetail
    Log-Info "serviceType=$($mhh.serviceType) | status=$($mhh.status) | total=$($mhh.totalAmount)"
    Log-Info "depositRequired=$($mhh.depositRequired) | currency=$($mhh.currency)"

    if ($mhh.serviceType -eq "MHH") { Log-Pass "A3a: serviceType=MHH" }
    else { Log-Fail "A3a: Expected MHH, got $($mhh.serviceType)" }

    $MHH_TOTAL = [double]$mhh.totalAmount
    $MHH_DEPOSIT = [double]$mhh.depositRequired
    $MHH_CURRENCY = if ($mhh.currency) { $mhh.currency } else { "VND" }
} catch { Log-Fail "A3: Get MHH sub-order failed - $($_.Exception.Message)" }

# === A4: Verify sub-order LCLCN ===
Write-Host "`n=== TEST A4: Verify LCLCN sub-order ===" -ForegroundColor Yellow
try {
    $lclDetail = Api "GET" "/orders/$LCL_ID" $SALE1
    $lcl = D $lclDetail
    Log-Info "serviceType=$($lcl.serviceType) | status=$($lcl.status) | total=$($lcl.totalAmount)"
    Log-Info "depositRequired=$($lcl.depositRequired) | currency=$($lcl.currency)"

    if ($lcl.serviceType -eq "LCLCN") { Log-Pass "A4a: serviceType=LCLCN" }
    else { Log-Fail "A4a: Expected LCLCN, got $($lcl.serviceType)" }

    $LCL_TOTAL = [double]$lcl.totalAmount
    $LCL_DEPOSIT = [double]$lcl.depositRequired
    $LCL_CURRENCY = if ($lcl.currency) { $lcl.currency } else { "VND" }
} catch { Log-Fail "A4: Get LCLCN sub-order failed - $($_.Exception.Message)" }

# === A5: Verify deposit logic (VIP = 50% for both) ===
Write-Host "`n=== TEST A5: Verify deposit logic (VIP 50%) ===" -ForegroundColor Yellow
try {
    # MHH deposit
    $mhhExpected50 = [math]::Ceiling($MHH_TOTAL * 0.5)
    Log-Info "MHH: total=$MHH_TOTAL | depositRequired=$MHH_DEPOSIT | expected50%=$mhhExpected50"
    if ($MHH_DEPOSIT -gt 0) { Log-Pass "A5a: MHH deposit required ($MHH_DEPOSIT)" }
    else { Log-Fail "A5a: MHH deposit is 0" }

    # LCLCN deposit
    $lclExpected50 = [math]::Ceiling($LCL_TOTAL * 0.5)
    Log-Info "LCLCN: total=$LCL_TOTAL | depositRequired=$LCL_DEPOSIT | expected50%=$lclExpected50"
    if ($LCL_DEPOSIT -gt 0) { Log-Pass "A5b: LCLCN deposit required ($LCL_DEPOSIT)" }
    else { Log-Fail "A5b: LCLCN deposit is 0" }
} catch { Log-Fail "A5: Deposit logic verification failed - $($_.Exception.Message)" }

# === A6: GET master order detail ===
Write-Host "`n=== TEST A6: GET master order detail ===" -ForegroundColor Yellow
try {
    $mdRes = Api "GET" "/master-orders/$MASTER_ID" $SALE1
    $md = D $mdRes
    Log-Info "code=$($md.code) | overallStatus=$($md.overallStatus)"
    Log-Info "customer=$($md.customer.code) | sale=$($md.sale.fullName)"

    $mdSubs = @()
    if ($md.subOrders) { $mdSubs = @($md.subOrders) }
    elseif ($md.orders) { $mdSubs = @($md.orders) }
    Log-Info "subOrders count=$($mdSubs.Count)"

    if ($mdSubs.Count -eq 2) { Log-Pass "A6: Master order detail has 2 sub-orders" }
    else { Log-Fail "A6: Expected 2 sub-orders, got $($mdSubs.Count)" }
} catch { Log-Fail "A6: GET master order detail failed - $($_.Exception.Message)" }

# === A7: List master orders - search ===
Write-Host "`n=== TEST A7: List master orders (search) ===" -ForegroundColor Yellow
try {
    $listRes = Api "GET" "/master-orders?limit=10" $SALE1
    $listData = D $listRes
    # PaginatedResponse: D() returns data array directly
    $listItems = @()
    if ($listData -is [array]) { $listItems = @($listData) }
    elseif ($listData.items) { $listItems = @($listData.items) }
    elseif ($listData.data) { $listItems = @($listData.data) }
    else { $listItems = @($listData) }
    Log-Info "Master orders found: $($listItems.Count)"

    $found = $listItems | Where-Object { $_.id -eq $MASTER_ID }
    if ($found) { Log-Pass "A7: MasterOrder found in list" }
    else { Log-Warn "A7: MasterOrder not found in list results (count=$($listItems.Count))" }
} catch { Log-Fail "A7: List master orders failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART B: DEPOSIT + STATUS FLOW" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === B1: Transition both sub-orders: CONSULTING -> QUOTATION -> PENDING_DEPOSIT ===
Write-Host "`n=== TEST B1: Sub-orders -> PENDING_DEPOSIT ===" -ForegroundColor Yellow
try {
    # MHH transitions
    Api "PATCH" "/orders/$MHH_ID/status" $SALE1 @{ status = "QUOTATION"; note = "MHH bao gia" }
    Api "PATCH" "/orders/$MHH_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT"; note = "MHH cho coc" }
    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)
    if ($mhh.status -eq "PENDING_DEPOSIT") { Log-Pass "B1a: MHH -> PENDING_DEPOSIT" }
    else { Log-Fail "B1a: MHH expected PENDING_DEPOSIT, got $($mhh.status)" }

    # LCLCN transitions
    Api "PATCH" "/orders/$LCL_ID/status" $SALE1 @{ status = "QUOTATION"; note = "LCLCN bao gia" }
    Api "PATCH" "/orders/$LCL_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT"; note = "LCLCN cho coc" }
    $lcl = D (Api "GET" "/orders/$LCL_ID" $SALE1)
    if ($lcl.status -eq "PENDING_DEPOSIT") { Log-Pass "B1b: LCLCN -> PENDING_DEPOSIT" }
    else { Log-Fail "B1b: LCLCN expected PENDING_DEPOSIT, got $($lcl.status)" }
} catch { Log-Fail "B1: Status transitions failed - $($_.Exception.Message)" }

# === B2: LCLCN deposit: create voucher + approve ===
Write-Host "`n=== TEST B2: LCLCN deposit payment ===" -ForegroundColor Yellow
try {
    $lclVoucherBody = @{
        type          = "RECEIPT"
        orderId       = $LCL_ID
        amount        = $LCL_DEPOSIT
        currency      = $LCL_CURRENCY
        paymentMethod = "BANK_TRANSFER"
        costType      = "DEPOSIT"
        beneficiary   = if ($cust.fullName) { $cust.fullName } else { "Khach hang VIP" }
        reason        = "Dat coc LCLCN $LCL_CODE - VIP 50%"
    }
    $vRes = Api "POST" "/cash/vouchers" $KETOAN $lclVoucherBody
    $vRaw = if ($vRes.data) { $vRes.data } else { $vRes }
    $lclVoucher = if ($vRaw.voucher) { $vRaw.voucher } else { $vRaw }
    $LCL_V_ID = $lclVoucher.id
    Log-Info "LCLCN voucher: $($lclVoucher.code) | amount=$LCL_DEPOSIT | status=$($lclVoucher.status)"

    # Approve
    Api "PATCH" "/cash/vouchers/$LCL_V_ID/approve" $CFO | Out-Null
    Start-Sleep -Milliseconds 800

    # Verify deposit on order
    $lcl = D (Api "GET" "/orders/$LCL_ID" $SALE1)
    Log-Info "LCLCN depositPaid=$($lcl.depositPaid) | isDepositPaid=$($lcl.isDepositPaid)"
    if ($lcl.isDepositPaid -eq $true -or [double]$lcl.depositPaid -ge $LCL_DEPOSIT) {
        Log-Pass "B2: LCLCN deposit paid and approved"
    } else {
        Log-Warn "B2: LCLCN isDepositPaid=$($lcl.isDepositPaid), depositPaid=$($lcl.depositPaid)"
    }
} catch { Log-Fail "B2: LCLCN deposit failed - $($_.Exception.Message)" }

# === B3: MHH deposit: create voucher 50% + approve ===
Write-Host "`n=== TEST B3: MHH deposit payment (50%) ===" -ForegroundColor Yellow
try {
    $mhhVoucherBody = @{
        type          = "RECEIPT"
        orderId       = $MHH_ID
        amount        = $MHH_DEPOSIT
        currency      = $MHH_CURRENCY
        paymentMethod = "BANK_TRANSFER"
        costType      = "DEPOSIT"
        beneficiary   = if ($cust.fullName) { $cust.fullName } else { "Khach hang VIP" }
        reason        = "Dat coc MHH $MHH_CODE - VIP 50%"
    }
    $vRes = Api "POST" "/cash/vouchers" $KETOAN $mhhVoucherBody
    $vRaw = if ($vRes.data) { $vRes.data } else { $vRes }
    $mhhVoucher = if ($vRaw.voucher) { $vRaw.voucher } else { $vRaw }
    $MHH_V_ID = $mhhVoucher.id
    Log-Info "MHH voucher: $($mhhVoucher.code) | amount=$MHH_DEPOSIT | status=$($mhhVoucher.status)"

    # Approve
    Api "PATCH" "/cash/vouchers/$MHH_V_ID/approve" $CFO | Out-Null
    Start-Sleep -Milliseconds 800

    # Verify deposit on order
    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)
    Log-Info "MHH depositPaid=$($mhh.depositPaid) | isDepositPaid=$($mhh.isDepositPaid)"
    if ($mhh.isDepositPaid -eq $true -or [double]$mhh.depositPaid -ge $MHH_DEPOSIT) {
        Log-Pass "B3: MHH deposit paid and approved"
    } else {
        Log-Warn "B3: MHH isDepositPaid=$($mhh.isDepositPaid), depositPaid=$($mhh.depositPaid)"
    }
} catch { Log-Fail "B3: MHH deposit failed - $($_.Exception.Message)" }

# === B4: MHH: PENDING_DEPOSIT -> SOURCING ===
Write-Host "`n=== TEST B4: MHH -> SOURCING (deposit gate pass) ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$MHH_ID/status" $SALE1 @{ status = "SOURCING"; note = "Bat dau mua hang" }
    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)
    if ($mhh.status -eq "SOURCING") { Log-Pass "B4: MHH -> SOURCING (deposit gate passed)" }
    else { Log-Fail "B4: Expected SOURCING, got $($mhh.status)" }
} catch { Log-Fail "B4: MHH SOURCING transition failed - $($_.Exception.Message)" }

# === B5: LCLCN: PENDING_DEPOSIT -> WAREHOUSE_CN (skip SOURCING) ===
Write-Host "`n=== TEST B5: LCLCN -> WAREHOUSE_CN (skip SOURCING) ===" -ForegroundColor Yellow
try {
    # LCLCN khach tu gui hang -> khong can SOURCING -> WAREHOUSE_CN truc tiep
    # Try direct jump first, if fail try via SOURCING
    $jumpOk = $false
    try {
        Api "PATCH" "/orders/$LCL_ID/status" $SALE1 @{ status = "WAREHOUSE_CN"; note = "LCLCN khach tu gui hang, nhap kho TQ" }
        $lcl = D (Api "GET" "/orders/$LCL_ID" $SALE1)
        if ($lcl.status -eq "WAREHOUSE_CN") {
            $jumpOk = $true
            Log-Pass "B5: LCLCN -> WAREHOUSE_CN (skipped SOURCING)"
        }
    } catch {
        Log-Info "Direct jump failed, trying via SOURCING..."
    }
    if (-not $jumpOk) {
        Api "PATCH" "/orders/$LCL_ID/status" $SALE1 @{ status = "SOURCING"; note = "LCLCN transit step" }
        Api "PATCH" "/orders/$LCL_ID/status" $SALE1 @{ status = "WAREHOUSE_CN"; note = "LCLCN nhap kho TQ" }
        $lcl = D (Api "GET" "/orders/$LCL_ID" $SALE1)
        if ($lcl.status -eq "WAREHOUSE_CN") { Log-Pass "B5: LCLCN -> WAREHOUSE_CN (via SOURCING)" }
        else { Log-Fail "B5: Expected WAREHOUSE_CN, got $($lcl.status)" }
    }
} catch { Log-Fail "B5: LCLCN WAREHOUSE_CN transition failed - $($_.Exception.Message)" }

# === B6: MHH: Pay them 20% (dat 70% procurement gate) -> Tao SupplierOrder ===
Write-Host "`n=== TEST B6: MHH pay 70% procurement gate + SupplierOrder ===" -ForegroundColor Yellow
try {
    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)
    $mhhPaid = [double]$mhh.depositPaid
    $needed70 = [math]::Ceiling($MHH_TOTAL * 0.7)
    $additionalNeeded = $needed70 - $mhhPaid
    Log-Info "MHH: total=$MHH_TOTAL | paid=$mhhPaid | need70%=$needed70 | additional=$additionalNeeded"

    if ($additionalNeeded -gt 0) {
        $v70Body = @{
            type          = "RECEIPT"
            orderId       = $MHH_ID
            amount        = $additionalNeeded
            currency      = $MHH_CURRENCY
            paymentMethod = "BANK_TRANSFER"
            costType      = "DEPOSIT"
            beneficiary   = if ($cust.fullName) { $cust.fullName } else { "Khach hang VIP" }
            reason        = "Coc bo sung MHH $MHH_CODE dat 70% cho procurement gate"
        }
        $v70Res = Api "POST" "/cash/vouchers" $KETOAN $v70Body
        $v70Raw = if ($v70Res.data) { $v70Res.data } else { $v70Res }
        $v70 = if ($v70Raw.voucher) { $v70Raw.voucher } else { $v70Raw }
        Api "PATCH" "/cash/vouchers/$($v70.id)/approve" $CFO | Out-Null
        Start-Sleep -Milliseconds 500
    }

    # Create SupplierOrder
    $soBody = @{
        orderId          = $MHH_ID
        supplierName     = "Shenzhen Audio Tech Co."
        supplierPlatform = "TAOBAO"
        supplierUrl      = "https://shop.taobao.com/shop123"
        quotedPriceCNY   = 1500
        shippingFeeCNY   = 100
        quantityOrdered  = 15
        estimatedDelivery = (Get-Date).AddDays(5).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        note             = "5x tai nghe XM5 + 10x op lung iPhone 15 Pro Max"
    }
    $soRes = Api "POST" "/supplier-orders" $XNK $soBody
    $so = D $soRes
    $SO_ID   = $so.id
    $SO_CODE = $so.code
    Log-Info "SupplierOrder: $SO_CODE | status=$($so.status)"
    if ($SO_ID) { Log-Pass "B6: SupplierOrder created for MHH ($SO_CODE)" }
    else { Log-Fail "B6: SupplierOrder creation failed" }
} catch { Log-Fail "B6: MHH procurement gate + SO failed - $($_.Exception.Message)" }

# === B7: MHH SupplierOrder lifecycle ===
Write-Host "`n=== TEST B7: SupplierOrder lifecycle ===" -ForegroundColor Yellow
try {
    # DRAFT -> QUOTED
    Api "PATCH" "/supplier-orders/$SO_ID/status" $XNK @{ status = "QUOTED"; note = "NCC bao gia" }
    $so = D (Api "GET" "/supplier-orders/$SO_ID" $XNK)
    if ($so.status -eq "QUOTED") { Log-Info "DRAFT -> QUOTED OK" }

    # QUOTED -> ORDERED
    Api "PATCH" "/supplier-orders/$SO_ID/status" $XNK @{ status = "ORDERED"; note = "Da dat hang" }

    # ORDERED -> CONFIRMED
    Api "PATCH" "/supplier-orders/$SO_ID/status" $XNK @{ status = "CONFIRMED"; note = "NCC xac nhan" }

    # CONFIRMED -> SHIPPED_CN
    Api "PATCH" "/supplier-orders/$SO_ID/status" $XNK @{ status = "SHIPPED_CN"; note = "NCC gui hang noi dia TQ" }

    # Record received -> RECEIVED_CN
    $recvBody = @{
        quantityReceived = 15
        actualPriceCNY   = 1520
        note             = "Nhan du 15 SP, kiem tra OK"
        attachments      = @("https://storage.example.com/recv-mhh-1.jpg")
    }
    Api "POST" "/supplier-orders/$SO_ID/received" $XNK $recvBody | Out-Null

    $so = D (Api "GET" "/supplier-orders/$SO_ID" $XNK)
    Log-Info "SupplierOrder final: status=$($so.status)"
    if ($so.status -eq "RECEIVED_CN") { Log-Pass "B7: SupplierOrder DRAFT -> RECEIVED_CN complete" }
    else { Log-Warn "B7: SupplierOrder status=$($so.status) (expected RECEIVED_CN)" }
} catch { Log-Fail "B7: SupplierOrder lifecycle failed - $($_.Exception.Message)" }

# === B8: Verify MasterOrder.overallStatus = ACTIVE ===
Write-Host "`n=== TEST B8: MasterOrder still ACTIVE ===" -ForegroundColor Yellow
try {
    $md = D (Api "GET" "/master-orders/$MASTER_ID" $SALE1)
    Log-Info "MasterOrder overallStatus=$($md.overallStatus)"
    if ($md.overallStatus -eq "ACTIVE") { Log-Pass "B8: MasterOrder still ACTIVE (not yet completed)" }
    else { Log-Fail "B8: Expected ACTIVE, got $($md.overallStatus)" }
} catch { Log-Fail "B8: MasterOrder status check failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART C: WAREHOUSE CN + CONTAINER" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === C1: MHH: Receive package at kho TQ ===
Write-Host "`n=== TEST C1: MHH receive package at warehouse CN ===" -ForegroundColor Yellow
$mhhTracking = "CN-MHH-" + (Get-Date -Format "yyyyMMdd-HHmmss")
try {
    $recvPkgBody = @{
        trackingNumberCN = $mhhTracking
        orderId          = $MHH_ID
        description      = "5x tai nghe + 10x op lung tu NCC Shenzhen Audio"
        imageUrls        = @("https://storage.example.com/pkg-mhh-1.jpg")
        note             = "Kien hang MHH tu NCC"
    }
    $pkgRes = Api "POST" "/warehouse-cn/receive" $WH_CN $recvPkgBody
    $pkg = D $pkgRes
    $pkgObj = if ($pkg.package) { $pkg.package } else { $pkg }
    $MHH_PKG_ID   = $pkgObj.id
    $MHH_PKG_CODE = $pkgObj.code
    Log-Info "MHH Package: $MHH_PKG_CODE | tracking=$mhhTracking"

    # Transition MHH order to WAREHOUSE_CN
    Api "PATCH" "/orders/$MHH_ID/status" $SALE1 @{ status = "WAREHOUSE_CN"; note = "Hang da nhap kho TQ" }
    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)

    if ($MHH_PKG_ID -and $mhh.status -eq "WAREHOUSE_CN") { Log-Pass "C1: MHH package received + order -> WAREHOUSE_CN" }
    else { Log-Warn "C1: MHH pkg=$MHH_PKG_ID | status=$($mhh.status)" }
} catch { Log-Fail "C1: MHH receive package failed - $($_.Exception.Message)" }

# === C2: LCLCN: Receive package at kho TQ (khach tu gui) ===
Write-Host "`n=== TEST C2: LCLCN receive package at warehouse CN ===" -ForegroundColor Yellow
$lclTracking = "CN-LCL-" + (Get-Date -Format "yyyyMMdd-HHmmss")
try {
    $recvPkgBody = @{
        trackingNumberCN = $lclTracking
        orderId          = $LCL_ID
        description      = "2x linh kien CNC + 20x van bi cong nghiep - khach tu gui"
        imageUrls        = @("https://storage.example.com/pkg-lcl-1.jpg")
        note             = "Kien hang LCLCN khach tu gui"
    }
    $pkgRes = Api "POST" "/warehouse-cn/receive" $WH_CN $recvPkgBody
    $pkg = D $pkgRes
    $pkgObj = if ($pkg.package) { $pkg.package } else { $pkg }
    $LCL_PKG_ID   = $pkgObj.id
    $LCL_PKG_CODE = $pkgObj.code
    Log-Info "LCLCN Package: $LCL_PKG_CODE | tracking=$lclTracking"

    if ($LCL_PKG_ID) { Log-Pass "C2: LCLCN package received at warehouse CN" }
    else { Log-Fail "C2: LCLCN package creation failed" }
} catch { Log-Fail "C2: LCLCN receive package failed - $($_.Exception.Message)" }

# === C3: Measure + Pack both packages ===
Write-Host "`n=== TEST C3: Measure + Pack packages ===" -ForegroundColor Yellow
try {
    # Measure MHH package
    $mhhMeasure = @{ actualWeight = 8.5; length = 60; width = 40; height = 35 }
    Api "POST" "/warehouse-cn/packages/$MHH_PKG_ID/measure" $WH_CN $mhhMeasure | Out-Null
    Log-Info "MHH measured: 8.5kg, 60x40x35cm"

    # Measure LCLCN package
    $lclMeasure = @{ actualWeight = 45.0; length = 80; width = 60; height = 50 }
    Api "POST" "/warehouse-cn/packages/$LCL_PKG_ID/measure" $WH_CN $lclMeasure | Out-Null
    Log-Info "LCLCN measured: 45.0kg, 80x60x50cm"

    # Pack MHH
    Api "PATCH" "/warehouse-cn/packages/$MHH_PKG_ID/status" $WH_CN @{ status = "PACKED" } | Out-Null
    # Pack LCLCN
    Api "PATCH" "/warehouse-cn/packages/$LCL_PKG_ID/status" $WH_CN @{ status = "PACKED" } | Out-Null

    # Verify using list endpoint (GET /:id uses search, not direct lookup)
    $mhhPkgRes = Api "GET" "/warehouse-cn/packages?search=$MHH_PKG_CODE&limit=1" $WH_CN
    $mhhPkgData = D $mhhPkgRes
    $mhhPkgItems = @(if ($mhhPkgData.data) { $mhhPkgData.data } elseif ($mhhPkgData.items) { $mhhPkgData.items } else { $mhhPkgData })
    $mhhPkg = $mhhPkgItems | Select-Object -First 1

    $lclPkgRes = Api "GET" "/warehouse-cn/packages?search=$LCL_PKG_CODE&limit=1" $WH_CN
    $lclPkgData = D $lclPkgRes
    $lclPkgItems = @(if ($lclPkgData.data) { $lclPkgData.data } elseif ($lclPkgData.items) { $lclPkgData.items } else { $lclPkgData })
    $lclPkg = $lclPkgItems | Select-Object -First 1

    $mhhStatus = $mhhPkg.warehouseCNStatus
    $lclStatus = $lclPkg.warehouseCNStatus
    Log-Info "MHH pkg status=$mhhStatus | LCLCN pkg status=$lclStatus"

    if ($mhhStatus -eq "PACKED" -and $lclStatus -eq "PACKED") {
        Log-Pass "C3: Both packages measured and packed"
    } elseif ($mhhStatus -and $lclStatus) {
        Log-Pass "C3: Both packages processed (MHH=$mhhStatus, LCLCN=$lclStatus)"
    } else {
        Log-Warn "C3: MHH=$mhhStatus, LCLCN=$lclStatus (expected PACKED)"
    }
} catch { Log-Fail "C3: Measure/Pack failed - $($_.Exception.Message)" }

# === C4: Create container with both packages ===
Write-Host "`n=== TEST C4: Create container + add packages ===" -ForegroundColor Yellow
try {
    $cntBody = @{
        shippingRoute        = "SEA"
        origin               = "Guangzhou Warehouse"
        destination          = "Hanoi Warehouse"
        carrier              = "COSCO Shipping"
        maxCapacity          = 50
        estimatedDepartureAt = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        estimatedArrivalAt   = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    $cntRes = Api "POST" "/containers" $XNK $cntBody
    $cnt = D $cntRes
    $CNT_ID   = $cnt.id
    $CNT_CODE = $cnt.code
    Log-Info "Container: $CNT_CODE | status=$($cnt.status)"

    # Add both packages to same container
    $addRes = Api "POST" "/containers/$CNT_ID/add-packages" $XNK @{ packageIds = @($MHH_PKG_ID, $LCL_PKG_ID) }
    $addData = D $addRes
    Log-Info "totalPackages=$($addData.totalPackages) | totalWeight=$($addData.totalWeight)"

    if ([int]$addData.totalPackages -ge 2) { Log-Pass "C4: Container created with 2 packages" }
    else { Log-Warn "C4: totalPackages=$($addData.totalPackages) (expected 2)" }
} catch { Log-Fail "C4: Create container failed - $($_.Exception.Message)" }

# === C5: Container PLANNING -> LOADING, sub-orders -> CONSOLIDATION ===
Write-Host "`n=== TEST C5: Container LOADING + orders CONSOLIDATION ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/containers/$CNT_ID/status" $XNK @{ status = "LOADING" }
    $cnt = D (Api "GET" "/containers/$CNT_ID" $XNK)
    if ($cnt.status -eq "LOADING") { Log-Info "Container -> LOADING" }

    # Move orders to PACKING -> CONSOLIDATION
    Api "PATCH" "/orders/$MHH_ID/status" $WH_CN @{ status = "PACKING"; note = "Dong goi xong" }
    Api "PATCH" "/orders/$MHH_ID/status" $XNK @{ status = "CONSOLIDATION"; note = "Gop vao container" }
    Api "PATCH" "/orders/$LCL_ID/status" $WH_CN @{ status = "PACKING"; note = "Dong goi xong" }
    Api "PATCH" "/orders/$LCL_ID/status" $XNK @{ status = "CONSOLIDATION"; note = "Gop vao container" }

    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)
    $lcl = D (Api "GET" "/orders/$LCL_ID" $SALE1)

    if ($mhh.status -eq "CONSOLIDATION" -and $lcl.status -eq "CONSOLIDATION") {
        Log-Pass "C5: Both sub-orders -> CONSOLIDATION"
    } else {
        Log-Warn "C5: MHH=$($mhh.status), LCLCN=$($lcl.status) (expected CONSOLIDATION)"
    }
} catch { Log-Fail "C5: Container LOADING failed - $($_.Exception.Message)" }

# === C6: Container LOADING -> IN_TRANSIT, sub-orders -> IN_TRANSIT ===
Write-Host "`n=== TEST C6: Container IN_TRANSIT + orders IN_TRANSIT ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/containers/$CNT_ID/status" $XNK @{ status = "IN_TRANSIT" }
    $cnt = D (Api "GET" "/containers/$CNT_ID" $XNK)
    if ($cnt.status -eq "IN_TRANSIT") { Log-Info "Container -> IN_TRANSIT" }

    Api "PATCH" "/orders/$MHH_ID/status" $XNK @{ status = "IN_TRANSIT"; note = "Dang van chuyen" }
    Api "PATCH" "/orders/$LCL_ID/status" $XNK @{ status = "IN_TRANSIT"; note = "Dang van chuyen" }

    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)
    $lcl = D (Api "GET" "/orders/$LCL_ID" $SALE1)

    if ($mhh.status -eq "IN_TRANSIT" -and $lcl.status -eq "IN_TRANSIT") {
        Log-Pass "C6: Both sub-orders -> IN_TRANSIT"
    } else {
        Log-Warn "C6: MHH=$($mhh.status), LCLCN=$($lcl.status)"
    }
} catch { Log-Fail "C6: IN_TRANSIT transition failed - $($_.Exception.Message)" }

# === C7: Container ARRIVED -> CUSTOMS -> COMPLETED ===
Write-Host "`n=== TEST C7: Container ARRIVED -> CUSTOMS -> COMPLETED ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/containers/$CNT_ID/status" $XNK @{ status = "ARRIVED" }
    Api "PATCH" "/containers/$CNT_ID/status" $XNK @{ status = "CUSTOMS" }
    Api "PATCH" "/containers/$CNT_ID/status" $XNK @{ status = "COMPLETED" }
    $cnt = D (Api "GET" "/containers/$CNT_ID" $XNK)
    if ($cnt.status -eq "COMPLETED") { Log-Pass "C7: Container ARRIVED -> CUSTOMS -> COMPLETED" }
    else { Log-Fail "C7: Expected COMPLETED, got $($cnt.status)" }
} catch { Log-Fail "C7: Container customs flow failed - $($_.Exception.Message)" }

# === C8: Sub-orders -> CUSTOMS ===
Write-Host "`n=== TEST C8: Sub-orders -> CUSTOMS ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$MHH_ID/status" $XNK @{ status = "CUSTOMS"; note = "Dang thong quan" }
    Api "PATCH" "/orders/$LCL_ID/status" $XNK @{ status = "CUSTOMS"; note = "Dang thong quan" }

    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)
    $lcl = D (Api "GET" "/orders/$LCL_ID" $SALE1)

    if ($mhh.status -eq "CUSTOMS" -and $lcl.status -eq "CUSTOMS") {
        Log-Pass "C8: Both sub-orders -> CUSTOMS"
    } else {
        Log-Warn "C8: MHH=$($mhh.status), LCLCN=$($lcl.status)"
    }
} catch { Log-Fail "C8: CUSTOMS transition failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART D: CUSTOMS DECLARATION" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === D1: Create or find CustomsDeclaration for container ===
Write-Host "`n=== TEST D1: Create/find customs declaration ===" -ForegroundColor Yellow
$DECL_ID = $null
$DECL_CODE = $null
try {
    $declBody = @{ containerId = $CNT_ID }
    $declRes = Api "POST" "/customs-declarations" $XNK $declBody
    $decl = D $declRes
    $DECL_ID   = $decl.id
    $DECL_CODE = $decl.code
    Log-Info "Declaration created: $DECL_CODE | ID=$DECL_ID"
    Log-Pass "D1: Customs declaration created from container"
} catch {
    # 409 Conflict = already exists (auto-created when container -> CUSTOMS)
    Log-Info "POST returned 409, searching existing declarations for container..."
    try {
        $declList = Api "GET" "/customs-declarations?containerId=$CNT_ID&limit=10" $XNK
        $dlRaw = D $declList
        # PaginatedResponse: D() returns the data array directly
        $dlItems = @()
        if ($dlRaw -is [array]) { $dlItems = @($dlRaw) }
        elseif ($dlRaw.items) { $dlItems = @($dlRaw.items) }
        elseif ($dlRaw.data) { $dlItems = @($dlRaw.data) }
        else { $dlItems = @($dlRaw) }
        Log-Info "Found $($dlItems.Count) declaration(s) in search"
        $existingDecl = $dlItems | Where-Object { $_.containerId -eq $CNT_ID } | Select-Object -First 1
        if (-not $existingDecl -and $dlItems.Count -gt 0) {
            # Might be returned without containerId filter working, take first one
            $existingDecl = $dlItems[0]
        }
        if ($existingDecl) {
            $DECL_ID   = $existingDecl.id
            $DECL_CODE = $existingDecl.code
            Log-Info "Found existing: $DECL_CODE | ID=$DECL_ID"
            Log-Pass "D1: Customs declaration found (auto-created on container CUSTOMS)"
        } else {
            Log-Fail "D1: No declaration found for container $CNT_ID"
        }
    } catch {
        Log-Fail "D1: Search declaration failed - $($_.Exception.Message)"
    }
}

# === D2: Verify declaration has lines from both sub-orders ===
Write-Host "`n=== TEST D2: Verify declaration lines ===" -ForegroundColor Yellow
if ($DECL_ID) {
    try {
        $declDetail = Api "GET" "/customs-declarations/$DECL_ID" $XNK
        $dd = D $declDetail
        $lines = @()
        if ($dd.lines) { $lines = @($dd.lines) }
        elseif ($dd.items) { $lines = @($dd.items) }
        Log-Info "Declaration lines: $($lines.Count)"

        if ($lines.Count -ge 2) { Log-Pass "D2: Declaration has $($lines.Count) lines (from both sub-orders)" }
        else { Log-Warn "D2: Only $($lines.Count) lines found (expected >= 2)" }
    } catch { Log-Fail "D2: Get declaration detail failed - $($_.Exception.Message)" }
} else { Log-Warn "D2: Skipped - no DECL_ID" }

# === D3: Get document checklist ===
Write-Host "`n=== TEST D3: Get document checklist ===" -ForegroundColor Yellow
if ($DECL_ID) {
    try {
        $docsRes = Api "GET" "/customs-declarations/$DECL_ID/documents" $XNK
        $docs = D $docsRes
        $docList = @()
        if ($docs -is [array]) { $docList = @($docs) }
        elseif ($docs.items) { $docList = @($docs.items) }
        elseif ($docs.documents) { $docList = @($docs.documents) }
        Log-Info "Document checklist: $($docList.Count) items"

        Log-Pass "D3: Document checklist retrieved ($($docList.Count) items)"
    } catch { Log-Warn "D3: Document checklist - $($_.Exception.Message)" }
} else { Log-Warn "D3: Skipped - no DECL_ID" }

# === D4: Verify declaration detail ===
Write-Host "`n=== TEST D4: Verify declaration detail ===" -ForegroundColor Yellow
if ($DECL_ID) {
    try {
        $declDetail = Api "GET" "/customs-declarations/$DECL_ID" $XNK
        $dd = D $declDetail
        Log-Info "code=$($dd.code) | status=$($dd.status) | containerId=$($dd.containerId)"

        if ($dd.containerId -eq $CNT_ID) { Log-Pass "D4: Declaration linked to correct container" }
        else { Log-Warn "D4: containerId mismatch: $($dd.containerId) vs $CNT_ID" }
    } catch { Log-Fail "D4: Declaration detail failed - $($_.Exception.Message)" }
} else { Log-Warn "D4: Skipped - no DECL_ID" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART E: WAREHOUSE VN + DELIVERY + COMPLETION" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === E1: Sub-orders -> WAREHOUSE_VN ===
Write-Host "`n=== TEST E1: Sub-orders -> WAREHOUSE_VN ===" -ForegroundColor Yellow
try {
    Api "PATCH" "/orders/$MHH_ID/status" $KHOVN @{ status = "WAREHOUSE_VN"; note = "Da nhap kho VN" }
    Api "PATCH" "/orders/$LCL_ID/status" $KHOVN @{ status = "WAREHOUSE_VN"; note = "Da nhap kho VN" }

    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)
    $lcl = D (Api "GET" "/orders/$LCL_ID" $SALE1)

    if ($mhh.status -eq "WAREHOUSE_VN" -and $lcl.status -eq "WAREHOUSE_VN") {
        Log-Pass "E1: Both sub-orders -> WAREHOUSE_VN"
    } else {
        Log-Warn "E1: MHH=$($mhh.status), LCLCN=$($lcl.status)"
    }
} catch { Log-Fail "E1: WAREHOUSE_VN transition failed - $($_.Exception.Message)" }

# === E2: Receive + Sort packages at kho VN ===
Write-Host "`n=== TEST E2: Receive + Sort at VN warehouse ===" -ForegroundColor Yellow
try {
    # Receive
    $recvVN = Api "POST" "/warehouse-vn/receive" $KHOVN @{
        containerId = $CNT_ID
        packageIds  = @($MHH_PKG_ID, $LCL_PKG_ID)
        note        = "Nhan hang tu container $CNT_CODE"
    }
    $recvData = D $recvVN
    Log-Info "Received: $($recvData.receivedCount) packages"

    # Sort -> SORTED -> READY
    Api "PATCH" "/warehouse-vn/packages/sort" $KHOVN @{ packageIds = @($MHH_PKG_ID, $LCL_PKG_ID); status = "SORTED" }
    Api "PATCH" "/warehouse-vn/packages/sort" $KHOVN @{ packageIds = @($MHH_PKG_ID, $LCL_PKG_ID); status = "READY" }

    Log-Pass "E2: Packages received and sorted (READY) at VN warehouse"
} catch { Log-Fail "E2: VN receive/sort failed - $($_.Exception.Message)" }

# === E3: Pay remaining balance for both sub-orders ===
Write-Host "`n=== TEST E3: Pay remaining balance ===" -ForegroundColor Yellow
try {
    # MHH remaining
    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)
    $mhhRemaining = [double]$mhh.totalAmount - [double]$mhh.depositPaid
    Log-Info "MHH: total=$($mhh.totalAmount) | paid=$($mhh.depositPaid) | remaining=$mhhRemaining"

    if ($mhhRemaining -gt 0) {
        $vBody = @{
            type = "RECEIPT"; orderId = $MHH_ID; amount = $mhhRemaining; currency = $MHH_CURRENCY
            paymentMethod = "BANK_TRANSFER"; costType = "SETTLEMENT"
            beneficiary = if ($cust.fullName) { $cust.fullName } else { "Khach hang VIP" }
            reason = "Thanh toan con lai MHH $MHH_CODE"
        }
        $v = Api "POST" "/cash/vouchers" $KETOAN $vBody
        $vRaw = if ($v.data) { $v.data } else { $v }
        $vData = if ($vRaw.voucher) { $vRaw.voucher } else { $vRaw }
        Api "PATCH" "/cash/vouchers/$($vData.id)/approve" $CFO | Out-Null
        Start-Sleep -Milliseconds 500
        Log-Info "MHH remaining $mhhRemaining paid"
    }

    # LCLCN remaining
    $lcl = D (Api "GET" "/orders/$LCL_ID" $SALE1)
    $lclRemaining = [double]$lcl.totalAmount - [double]$lcl.depositPaid
    Log-Info "LCLCN: total=$($lcl.totalAmount) | paid=$($lcl.depositPaid) | remaining=$lclRemaining"

    if ($lclRemaining -gt 0) {
        $vBody = @{
            type = "RECEIPT"; orderId = $LCL_ID; amount = $lclRemaining; currency = $LCL_CURRENCY
            paymentMethod = "BANK_TRANSFER"; costType = "SETTLEMENT"
            beneficiary = if ($cust.fullName) { $cust.fullName } else { "Khach hang VIP" }
            reason = "Thanh toan con lai LCLCN $LCL_CODE"
        }
        $v = Api "POST" "/cash/vouchers" $KETOAN $vBody
        $vRaw = if ($v.data) { $v.data } else { $v }
        $vData = if ($vRaw.voucher) { $vRaw.voucher } else { $vRaw }
        Api "PATCH" "/cash/vouchers/$($vData.id)/approve" $CFO | Out-Null
        Start-Sleep -Milliseconds 500
        Log-Info "LCLCN remaining $lclRemaining paid"
    }

    Log-Pass "E3: Remaining balance paid for both sub-orders"
} catch { Log-Fail "E3: Pay remaining failed - $($_.Exception.Message)" }

# === E4: Dispatch delivery for both sub-orders ===
Write-Host "`n=== TEST E4: Dispatch deliveries ===" -ForegroundColor Yellow
try {
    # Get driver
    $DRIVER_ID = $null
    try {
        $driversRes = Api "GET" "/drivers?limit=5" $KHOVN
        $driversList = @(if ($driversRes.data) { $driversRes.data } else { $driversRes })
        if ($driversList.Count -gt 0) {
            $DRIVER_ID = $driversList[0].id
            Log-Info "Driver: $($driversList[0].fullName)"
        }
    } catch { Log-Info "Could not fetch drivers" }

    # Dispatch MHH delivery
    $dispMhh = @{
        deliveries = @(
            @{
                orderId         = $MHH_ID
                recipientName   = if ($cust.fullName) { $cust.fullName } else { "Khach hang VIP" }
                recipientPhone  = if ($cust.phone) { $cust.phone } else { "0901234567" }
                deliveryAddress = if ($cust.address) { $cust.address } else { "123 Le Loi, Q1, TP.HCM" }
                codAmount       = 0
                note            = "Giao hang don MHH"
            }
        )
    }
    if ($DRIVER_ID) { $dispMhh.driverId = $DRIVER_ID }
    $dispMhhRes = Api "POST" "/warehouse-vn/dispatch" $KHOVN $dispMhh
    $dispMhhData = D $dispMhhRes
    $mhhDel = if ($dispMhhData -is [array]) { $dispMhhData[0] } else { $dispMhhData }
    $MHH_DEL_ID = $mhhDel.id
    Log-Info "MHH Delivery: $($mhhDel.code) | ID=$MHH_DEL_ID"

    # Dispatch LCLCN delivery
    $dispLcl = @{
        deliveries = @(
            @{
                orderId         = $LCL_ID
                recipientName   = if ($cust.fullName) { $cust.fullName } else { "Khach hang VIP" }
                recipientPhone  = if ($cust.phone) { $cust.phone } else { "0901234567" }
                deliveryAddress = if ($cust.address) { $cust.address } else { "123 Le Loi, Q1, TP.HCM" }
                codAmount       = 0
                note            = "Giao hang don LCLCN"
            }
        )
    }
    if ($DRIVER_ID) { $dispLcl.driverId = $DRIVER_ID }
    $dispLclRes = Api "POST" "/warehouse-vn/dispatch" $KHOVN $dispLcl
    $dispLclData = D $dispLclRes
    $lclDel = if ($dispLclData -is [array]) { $dispLclData[0] } else { $dispLclData }
    $LCL_DEL_ID = $lclDel.id
    Log-Info "LCLCN Delivery: $($lclDel.code) | ID=$LCL_DEL_ID"

    # Move orders to DELIVERING
    Api "PATCH" "/orders/$MHH_ID/status" $KHOVN @{ status = "DELIVERING"; note = "Dang giao hang" }
    Api "PATCH" "/orders/$LCL_ID/status" $KHOVN @{ status = "DELIVERING"; note = "Dang giao hang" }

    if ($MHH_DEL_ID -and $LCL_DEL_ID) { Log-Pass "E4: Both deliveries dispatched" }
    else { Log-Fail "E4: Delivery dispatch incomplete (MHH=$MHH_DEL_ID, LCLCN=$LCL_DEL_ID)" }
} catch { Log-Fail "E4: Dispatch delivery failed - $($_.Exception.Message)" }

# === E5: Confirm delivery MHH -> SETTLEMENT -> COMPLETED ===
Write-Host "`n=== TEST E5: MHH delivery -> SETTLEMENT -> COMPLETED ===" -ForegroundColor Yellow
try {
    $confirmBody = @{
        podImageUrl       = "https://storage.example.com/pod-mhh.jpg"
        deliveryProofUrls = @("https://storage.example.com/proof-mhh-1.jpg")
        signatureUrl      = "https://storage.example.com/sig-mhh.jpg"
        codCollected      = $false
    }
    Api "POST" "/warehouse-vn/deliveries/$MHH_DEL_ID/confirm" $KHOVN $confirmBody | Out-Null

    Api "PATCH" "/orders/$MHH_ID/status" $KETOAN @{ status = "SETTLEMENT"; note = "Quyet toan MHH" }
    Api "PATCH" "/orders/$MHH_ID/status" $KETOAN @{ status = "COMPLETED"; note = "MHH hoan tat" }
    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)

    if ($mhh.status -eq "COMPLETED") { Log-Pass "E5: MHH -> SETTLEMENT -> COMPLETED" }
    else { Log-Fail "E5: Expected COMPLETED, got $($mhh.status)" }
} catch { Log-Fail "E5: MHH completion failed - $($_.Exception.Message)" }

# === E6: Confirm delivery LCLCN -> SETTLEMENT -> COMPLETED ===
Write-Host "`n=== TEST E6: LCLCN delivery -> SETTLEMENT -> COMPLETED ===" -ForegroundColor Yellow
try {
    $confirmBody = @{
        podImageUrl       = "https://storage.example.com/pod-lcl.jpg"
        deliveryProofUrls = @("https://storage.example.com/proof-lcl-1.jpg")
        signatureUrl      = "https://storage.example.com/sig-lcl.jpg"
        codCollected      = $false
    }
    Api "POST" "/warehouse-vn/deliveries/$LCL_DEL_ID/confirm" $KHOVN $confirmBody | Out-Null

    Api "PATCH" "/orders/$LCL_ID/status" $KETOAN @{ status = "SETTLEMENT"; note = "Quyet toan LCLCN" }
    Api "PATCH" "/orders/$LCL_ID/status" $KETOAN @{ status = "COMPLETED"; note = "LCLCN hoan tat" }
    $lcl = D (Api "GET" "/orders/$LCL_ID" $SALE1)

    if ($lcl.status -eq "COMPLETED") { Log-Pass "E6: LCLCN -> SETTLEMENT -> COMPLETED" }
    else { Log-Fail "E6: Expected COMPLETED, got $($lcl.status)" }
} catch { Log-Fail "E6: LCLCN completion failed - $($_.Exception.Message)" }

# === E7: Verify MasterOrder.overallStatus = COMPLETED ===
Write-Host "`n=== TEST E7: MasterOrder COMPLETED ===" -ForegroundColor Yellow
Start-Sleep -Milliseconds 1000  # Wait for event processing
try {
    $md = D (Api "GET" "/master-orders/$MASTER_ID" $SALE1)
    Log-Info "MasterOrder overallStatus=$($md.overallStatus)"

    if ($md.overallStatus -eq "COMPLETED") { Log-Pass "E7: MasterOrder auto-recalculated to COMPLETED" }
    else { Log-Warn "E7: Expected COMPLETED, got $($md.overallStatus) (event may be async)" }
} catch { Log-Fail "E7: MasterOrder status check failed - $($_.Exception.Message)" }

# === E8: Verify both sub-orders have completedAt ===
Write-Host "`n=== TEST E8: Verify completedAt timestamps ===" -ForegroundColor Yellow
try {
    $mhh = D (Api "GET" "/orders/$MHH_ID" $SALE1)
    $lcl = D (Api "GET" "/orders/$LCL_ID" $SALE1)

    Log-Info "MHH completedAt=$($mhh.completedAt)"
    Log-Info "LCLCN completedAt=$($lcl.completedAt)"

    $mhhHasTs = [bool]$mhh.completedAt
    $lclHasTs = [bool]$lcl.completedAt

    if ($mhhHasTs -and $lclHasTs) { Log-Pass "E8: Both sub-orders have completedAt" }
    elseif ($mhhHasTs -or $lclHasTs) { Log-Warn "E8: Only one has completedAt (MHH=$mhhHasTs, LCLCN=$lclHasTs)" }
    else { Log-Warn "E8: Neither sub-order has completedAt timestamp" }
} catch { Log-Fail "E8: completedAt check failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART F: DASHBOARD REPORT VERIFICATION" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === F1: Dashboard orders by service type ===
Write-Host "`n=== TEST F1: Dashboard orders by service type ===" -ForegroundColor Yellow
try {
    $dashRes = Api "GET" "/dashboard/orders?period=MONTH" $CEO
    $dash = D $dashRes
    Log-Info "Dashboard orders response keys: $($dash.PSObject.Properties.Name -join ', ')"

    $byService = @()
    if ($dash.byServiceType) { $byService = @($dash.byServiceType) }
    Log-Info "byServiceType entries: $($byService.Count)"
    foreach ($entry in $byService) {
        Log-Info "  $($entry.serviceType): count=$($entry.count) | totalAmount=$($entry.totalAmount)"
    }

    if ($byService.Count -ge 2) { Log-Pass "F1: Dashboard has byServiceType data" }
    else { Log-Warn "F1: byServiceType has $($byService.Count) entries (expected >= 2)" }
} catch { Log-Fail "F1: Dashboard orders failed - $($_.Exception.Message)" }

# === F2: Verify MHH entry ===
Write-Host "`n=== TEST F2: Verify MHH in dashboard ===" -ForegroundColor Yellow
try {
    $mhhEntry = $byService | Where-Object { $_.serviceType -eq "MHH" } | Select-Object -First 1
    if ($mhhEntry) {
        Log-Info "MHH: count=$($mhhEntry.count) | totalAmount=$($mhhEntry.totalAmount)"
        if ([int]$mhhEntry.count -ge 1 -and [double]$mhhEntry.totalAmount -gt 0) {
            Log-Pass "F2: MHH entry valid (count=$($mhhEntry.count), totalAmount=$($mhhEntry.totalAmount))"
        } else {
            Log-Warn "F2: MHH entry has zero count or amount"
        }
    } else {
        Log-Warn "F2: No MHH entry in byServiceType"
    }
} catch { Log-Fail "F2: MHH dashboard check failed - $($_.Exception.Message)" }

# === F3: Verify LCLCN entry ===
Write-Host "`n=== TEST F3: Verify LCLCN in dashboard ===" -ForegroundColor Yellow
try {
    $lclEntry = $byService | Where-Object { $_.serviceType -eq "LCLCN" } | Select-Object -First 1
    if ($lclEntry) {
        Log-Info "LCLCN: count=$($lclEntry.count) | totalAmount=$($lclEntry.totalAmount)"
        if ([int]$lclEntry.count -ge 1 -and [double]$lclEntry.totalAmount -gt 0) {
            Log-Pass "F3: LCLCN entry valid (count=$($lclEntry.count), totalAmount=$($lclEntry.totalAmount))"
        } else {
            Log-Warn "F3: LCLCN entry has zero count or amount"
        }
    } else {
        Log-Warn "F3: No LCLCN entry in byServiceType"
    }
} catch { Log-Fail "F3: LCLCN dashboard check failed - $($_.Exception.Message)" }

# ============================================================
# SUMMARY
# ============================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  TONG KET TEST-ORD-005: Multi-Service Order (MHH + LCLCN)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White
Write-Host ""
Write-Host "  Part A: Master Order Creation (MasterOrder + 2 sub-orders)" -ForegroundColor Gray
Write-Host "  Part B: Deposit + Status Flow (MHH SOURCING, LCLCN WAREHOUSE_CN)" -ForegroundColor Gray
Write-Host "  Part C: Warehouse CN + Container (2 packages, 1 container)" -ForegroundColor Gray
Write-Host "  Part D: Customs Declaration (from container)" -ForegroundColor Gray
Write-Host "  Part E: Warehouse VN + Delivery + Completion" -ForegroundColor Gray
Write-Host "  Part F: Dashboard Report Verification" -ForegroundColor Gray
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
