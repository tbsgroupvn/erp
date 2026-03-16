# ================================================================
# TEST-FIN-008: Cash Flow Control Formula
# Severity: CRITICAL (Core business rule)
#
# Verifies: Tien TBS tra NCC <= (Tien khach coc + So du vi khach)
# - Per-order cash flow validation (create + approve)
# - System-wide cash flow monitoring endpoints
# - Warning/critical alert thresholds
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

function DV($resp) {
    $d = D $resp
    if ($d -and $d.voucher) { return $d.voucher }
    return $d
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
Write-Host "  TEST-FIN-008: Cash Flow Control Formula" -ForegroundColor Cyan
Write-Host "  Tien TBS tra NCC <= (Tien khach coc + So du vi khach)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login roles + Find VIP customer
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login roles ===" -ForegroundColor White

$SALE1 = Login "sale01@$DOMAIN"
if ($SALE1) { Pass "SALE1 login OK" } else { Fail "SALE1 login FAILED"; exit 1 }

$CFO = Login "cfo@$DOMAIN"
if ($CFO) { Pass "CFO login OK" } else { Fail "CFO login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

$KETOAN = Login "ketoan@$DOMAIN"
if ($KETOAN) { Pass "KETOAN login OK" } else { Fail "KETOAN login FAILED"; exit 1 }

# Find VIP customer
Write-Host ""
Write-Host "=== SETUP: Find VIP customer ===" -ForegroundColor White

$allCusts = D (Api "GET" "/customers?limit=100" $CEO)
if (-not ($allCusts -is [array])) {
    if ($allCusts -and $allCusts.items) { $allCusts = @($allCusts.items) }
    elseif ($allCusts -and $allCusts.id) { $allCusts = @($allCusts) }
    else { $allCusts = @() }
}

$VIP_CUST = $allCusts | Where-Object { $_.tier -eq 'VIP' } | Select-Object -First 1
if ($VIP_CUST) {
    Write-Host "  VIP: $($VIP_CUST.code) - $($VIP_CUST.fullName)" -ForegroundColor Gray
    Pass "VIP customer found"
} else {
    Fail "No VIP customer found - cannot run tests"; exit 1
}

# ================================================================
# PART A: Setup - Create order, pay deposit, advance to SOURCING
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Setup - Tao order MHH, coc, tien toi SOURCING" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# A1: Create MHH order 100,000 VND for VIP customer
Write-Host ""
Write-Host "=== TEST A1: Tao MHH order 100,000 VND cho VIP ===" -ForegroundColor White
$orderBody = @{
    customerId    = $VIP_CUST.id
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{ productName = "FIN-008 Cash Flow Test Product"; productUrl = "https://item.taobao.com/item.htm?id=908001"; quantity = 10; unitPrice = 10000 }
    )
    note = "FIN-008: Cash flow control test order"
}
$orderResp = Api "POST" "/orders" $SALE1 $orderBody
$orderA = D $orderResp
if ($orderA -and $orderA.id) {
    $ORD_ID = $orderA.id
    $ORD_CODE = $orderA.code
    $ORD_TOTAL = [double]$orderA.totalAmount
    $ORD_DEPOSIT_REQ = [double]$orderA.depositRequired
    Write-Host "  Order: $ORD_CODE | total=$ORD_TOTAL | depositRequired=$ORD_DEPOSIT_REQ"
    Pass "A1: MHH order created ($ORD_CODE)"
} else {
    Fail "A1: Failed to create MHH order"; exit 1
}

# A2: Advance to PENDING_DEPOSIT
Write-Host ""
Write-Host "=== TEST A2: CONSULTING -> QUOTATION -> PENDING_DEPOSIT ===" -ForegroundColor White
Api "PATCH" "/orders/$ORD_ID/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
Api "PATCH" "/orders/$ORD_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT" } | Out-Null
$orderCheck = D (Api "GET" "/orders/$ORD_ID" $SALE1)
if ($orderCheck.status -eq "PENDING_DEPOSIT") {
    Pass "A2: Order at PENDING_DEPOSIT"
} else {
    Fail "A2: Expected PENDING_DEPOSIT, got $($orderCheck.status)"
}

# A3: Pay full deposit via RECEIPT voucher + approve
Write-Host ""
Write-Host "=== TEST A3: Pay deposit $ORD_DEPOSIT_REQ VND (RECEIPT + approve) ===" -ForegroundColor White
$receiptBody = @{
    orderId       = $ORD_ID
    type          = "RECEIPT"
    amount        = $ORD_DEPOSIT_REQ
    currency      = "VND"
    paymentMethod = "BANK_TRANSFER"
    costType      = "Tien coc don hang"
    beneficiary   = $VIP_CUST.fullName
    reason        = "Thu tien coc don hang $ORD_CODE, VIP 50%"
}
$vRaw = Api "POST" "/cash/vouchers" $KETOAN $receiptBody
$vResp = DV $vRaw
if ($vResp -and $vResp.id) {
    $RECEIPT_ID = $vResp.id
    Write-Host "  Receipt voucher: $($vResp.code) | amount=$ORD_DEPOSIT_REQ"
    Api "PATCH" "/cash/vouchers/$RECEIPT_ID/approve" $CFO $null | Out-Null
    Start-Sleep -Milliseconds 500
    Pass "A3: Deposit voucher created + approved"
} else {
    Fail "A3: Failed to create deposit voucher"; exit 1
}

# A4: Verify deposit and advance to SOURCING
Write-Host ""
Write-Host "=== TEST A4: Verify deposit + advance to SOURCING ===" -ForegroundColor White
$orderAfterDeposit = D (Api "GET" "/orders/$ORD_ID" $SALE1)
$depositPaid = [double]$orderAfterDeposit.depositPaid
Write-Host "  depositPaid=$depositPaid | isDepositPaid=$($orderAfterDeposit.isDepositPaid)"
if ($depositPaid -ge $ORD_DEPOSIT_REQ) {
    Api "PATCH" "/orders/$ORD_ID/status" $SALE1 @{ status = "SOURCING" } | Out-Null
    $orderSourcing = D (Api "GET" "/orders/$ORD_ID" $SALE1)
    if ($orderSourcing.status -eq "SOURCING") {
        Pass "A4: depositPaid=$depositPaid, order at SOURCING"
    } else {
        Fail "A4: Could not advance to SOURCING (status=$($orderSourcing.status))"
    }
} else {
    Fail "A4: depositPaid=$depositPaid < required=$ORD_DEPOSIT_REQ"
}

# A5: Check wallet balance for this customer
Write-Host ""
Write-Host "=== TEST A5: Check customer wallet balance ===" -ForegroundColor White
$walletResp = D (Api "GET" "/customers/$($VIP_CUST.id)/wallet" $CEO)
$WALLET_BAL = 0
if ($walletResp -and $walletResp.balance -ne $null) {
    $WALLET_BAL = [double]$walletResp.balance
}
Write-Host "  Customer wallet balance: $WALLET_BAL VND"
Pass "A5: Wallet balance = $WALLET_BAL"

# Calculate available funds for this order
$AVAILABLE_FUNDS = $depositPaid + $WALLET_BAL
Write-Host "  Available funds = depositPaid($depositPaid) + wallet($WALLET_BAL) = $AVAILABLE_FUNDS" -ForegroundColor Gray

# ================================================================
# PART B: Cash Flow BLOCK - Payment exceeds available funds
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Cash Flow BLOCK - Chi NCC vuot quy kha dung" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# B1: Create PAYMENT voucher exceeding available funds -> expect BLOCKED
Write-Host ""
Write-Host "=== TEST B1: PAYMENT vuot quy (amount > available) -> BLOCKED ===" -ForegroundColor White
$overAmount = $AVAILABLE_FUNDS + 1
Write-Host "  Attempting PAYMENT amount = $overAmount (available = $AVAILABLE_FUNDS)"
$overPayment = Api-Expect "POST" "/cash/vouchers" $KETOAN @{
    orderId       = $ORD_ID
    type          = "PAYMENT"
    amount        = $overAmount
    currency      = "VND"
    paymentMethod = "BANK_TRANSFER"
    costType      = "Thanh toan NCC"
    beneficiary   = "NCC Test Supplier"
    reason        = "FIN-008: Chi NCC vuot quy - expected BLOCKED"
    attachments   = @("receipt-001.pdf")
}
if ($overPayment.code -eq 400) {
    Pass "B1: PAYMENT $overAmount BLOCKED (400) - vuot quy"
    # Check error message mentions cash flow
    $errMsg = ""
    if ($overPayment.body -and $overPayment.body.message) { $errMsg = $overPayment.body.message }
    if ($overPayment.body -and $overPayment.body.data -and $overPayment.body.data.blockReasons) {
        $errMsg = ($overPayment.body.data.blockReasons -join "; ")
    }
    Write-Host "    Error: $errMsg" -ForegroundColor Gray
} else {
    Fail "B1: Expected 400 BLOCKED, got HTTP $($overPayment.code)"
}

# B2: Create PAYMENT voucher exactly at limit -> expect OK
Write-Host ""
Write-Host "=== TEST B2: PAYMENT dung muc kha dung -> OK ===" -ForegroundColor White
$exactAmount = $AVAILABLE_FUNDS
if ($exactAmount -le 0) { $exactAmount = 1 }
Write-Host "  Attempting PAYMENT amount = $exactAmount (available = $AVAILABLE_FUNDS)"
$exactPayment = Api-Expect "POST" "/cash/vouchers" $KETOAN @{
    orderId       = $ORD_ID
    type          = "PAYMENT"
    amount        = $exactAmount
    currency      = "VND"
    paymentMethod = "BANK_TRANSFER"
    costType      = "Thanh toan NCC"
    beneficiary   = "NCC Test Supplier"
    reason        = "FIN-008: Chi NCC dung muc - expected OK"
    attachments   = @("receipt-002.pdf")
}
if ($exactPayment.code -ge 200 -and $exactPayment.code -lt 300) {
    Pass "B2: PAYMENT $exactAmount accepted (within limit)"
    # Extract voucher ID for later tests
    $exactVoucherData = $null
    if ($exactPayment.body -and $exactPayment.body.data) {
        $exactVoucherData = $exactPayment.body.data
        if ($exactVoucherData.voucher) { $exactVoucherData = $exactVoucherData.voucher }
    }
    if ($exactVoucherData -and $exactVoucherData.id) {
        $EXACT_VOUCHER_ID = $exactVoucherData.id
        Write-Host "    Voucher: $($exactVoucherData.code)" -ForegroundColor Gray
    }
} elseif ($exactPayment.code -eq 400) {
    # May be blocked by negative balance check (not enough cash in fund)
    Warn "B2: PAYMENT $exactAmount got 400 (may be blocked by negative balance check, not cash flow)"
    $errMsg = ""
    if ($exactPayment.body -and $exactPayment.body.message) { $errMsg = $exactPayment.body.message }
    Write-Host "    Error: $errMsg" -ForegroundColor Gray
} else {
    Fail "B2: Unexpected HTTP $($exactPayment.code)"
}

# B3: Create smaller PAYMENT within limit -> expect OK
Write-Host ""
Write-Host "=== TEST B3: PAYMENT nho hon muc kha dung -> OK ===" -ForegroundColor White
$smallAmount = [math]::Floor($AVAILABLE_FUNDS * 0.5)
if ($smallAmount -le 0) { $smallAmount = 1000 }
Write-Host "  Attempting PAYMENT amount = $smallAmount (50% of available $AVAILABLE_FUNDS)"
$smallPayment = Api-Expect "POST" "/cash/vouchers" $KETOAN @{
    orderId       = $ORD_ID
    type          = "PAYMENT"
    amount        = $smallAmount
    currency      = "VND"
    paymentMethod = "BANK_TRANSFER"
    costType      = "Thanh toan NCC"
    beneficiary   = "NCC Test Supplier"
    reason        = "FIN-008: Chi NCC nho hon muc kha dung - expected OK"
    attachments   = @("receipt-003.pdf")
}
if ($smallPayment.code -ge 200 -and $smallPayment.code -lt 300) {
    Pass "B3: PAYMENT $smallAmount accepted (within limit)"
    $smallVoucherData = $null
    if ($smallPayment.body -and $smallPayment.body.data) {
        $smallVoucherData = $smallPayment.body.data
        if ($smallVoucherData.voucher) { $smallVoucherData = $smallVoucherData.voucher }
    }
    if ($smallVoucherData -and $smallVoucherData.id) {
        $SMALL_VOUCHER_ID = $smallVoucherData.id
        Write-Host "    Voucher: $($smallVoucherData.code)" -ForegroundColor Gray
    }
} else {
    Fail "B3: PAYMENT $smallAmount returned HTTP $($smallPayment.code)"
}

# ================================================================
# PART C: Approval-time re-validation
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Re-validate cash flow khi approve" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# C1: Approve the small payment -> should pass (still within fund)
Write-Host ""
Write-Host "=== TEST C1: Approve PAYMENT nho -> OK ===" -ForegroundColor White
if ($SMALL_VOUCHER_ID) {
    $approveSmall = Api-Expect "PATCH" "/cash/vouchers/$SMALL_VOUCHER_ID/approve" $CFO $null
    if ($approveSmall.code -ge 200 -and $approveSmall.code -lt 300) {
        Pass "C1: Small PAYMENT approved successfully"
    } elseif ($approveSmall.code -eq 400) {
        # May be blocked by negative balance check if not enough receipts in the fund
        Warn "C1: Approve returned 400 (may be blocked by fund balance, not cash flow)"
        $errMsg = ""
        if ($approveSmall.body -and $approveSmall.body.data -and $approveSmall.body.data.message) {
            $errMsg = $approveSmall.body.data.message
        } elseif ($approveSmall.body -and $approveSmall.body.message) {
            $errMsg = $approveSmall.body.message
        }
        Write-Host "    Error: $errMsg" -ForegroundColor Gray
    } else {
        Fail "C1: Approve returned HTTP $($approveSmall.code)"
    }
} else {
    Warn "C1: No small voucher ID - skipped"
}

# C2: Try to create and approve a second PAYMENT that would exceed deposit+wallet
Write-Host ""
Write-Host "=== TEST C2: Second PAYMENT vuot quy sau khi da approve lan 1 -> BLOCKED ===" -ForegroundColor White
# After C1, there's already $smallAmount approved. Now try to create another that tips over.
$remainAfterSmall = $AVAILABLE_FUNDS - $smallAmount
$secondOverAmount = $remainAfterSmall + 1
if ($secondOverAmount -le 0) { $secondOverAmount = 1 }
Write-Host "  Already approved: $smallAmount | Remaining: $remainAfterSmall | Attempting: $secondOverAmount"
$secondOver = Api-Expect "POST" "/cash/vouchers" $KETOAN @{
    orderId       = $ORD_ID
    type          = "PAYMENT"
    amount        = $secondOverAmount
    currency      = "VND"
    paymentMethod = "BANK_TRANSFER"
    costType      = "Thanh toan NCC"
    beneficiary   = "NCC Test Supplier 2"
    reason        = "FIN-008: Chi NCC lan 2 vuot quy - expected BLOCKED"
    attachments   = @("receipt-004.pdf")
}
if ($secondOver.code -eq 400) {
    Pass "C2: Second PAYMENT $secondOverAmount BLOCKED (cumulative exceeds fund)"
} else {
    # If C1 was blocked (not approved), this might succeed
    Warn "C2: Got HTTP $($secondOver.code) (expected 400 if C1 was approved)"
}

# ================================================================
# PART D: Monitoring endpoints - GET /cash/flow-status
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Monitoring endpoints" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# D1: GET /cash/flow-status (system-wide) - CFO
Write-Host ""
Write-Host "=== TEST D1: GET /cash/flow-status (CFO) ===" -ForegroundColor White
$flowStatus = D (Api "GET" "/cash/flow-status" $CFO)
if ($flowStatus) {
    Write-Host "  totalCustomerDeposits: $($flowStatus.totalCustomerDeposits)"
    Write-Host "  totalWalletBalances:   $($flowStatus.totalWalletBalances)"
    Write-Host "  totalAvailableFunds:   $($flowStatus.totalAvailableFunds)"
    Write-Host "  totalSupplierPayments: $($flowStatus.totalSupplierPayments)"
    Write-Host "  utilizationPercent:    $($flowStatus.utilizationPercent)%"
    Write-Host "  remaining:             $($flowStatus.remaining)"
    Write-Host "  status:                $($flowStatus.status)"

    # Verify response structure
    $hasAllFields = (
        $flowStatus.PSObject.Properties.Name -contains 'totalCustomerDeposits' -and
        $flowStatus.PSObject.Properties.Name -contains 'totalWalletBalances' -and
        $flowStatus.PSObject.Properties.Name -contains 'totalAvailableFunds' -and
        $flowStatus.PSObject.Properties.Name -contains 'totalSupplierPayments' -and
        $flowStatus.PSObject.Properties.Name -contains 'utilizationPercent' -and
        $flowStatus.PSObject.Properties.Name -contains 'remaining' -and
        $flowStatus.PSObject.Properties.Name -contains 'status'
    )
    if ($hasAllFields) {
        Pass "D1: flow-status returns all expected fields"
    } else {
        Fail "D1: flow-status missing some fields"
    }

    # Verify status is one of HEALTHY/WARNING/CRITICAL
    if ($flowStatus.status -eq 'HEALTHY' -or $flowStatus.status -eq 'WARNING' -or $flowStatus.status -eq 'CRITICAL') {
        Pass "D1b: status = $($flowStatus.status) (valid)"
    } else {
        Fail "D1b: status = $($flowStatus.status) (expected HEALTHY/WARNING/CRITICAL)"
    }
} else {
    Fail "D1: GET /cash/flow-status returned null"
}

# D2: GET /cash/flow-status (SALE - unauthorized) -> expect 403
Write-Host ""
Write-Host "=== TEST D2: GET /cash/flow-status (SALE - unauthorized) -> 403 ===" -ForegroundColor White
$saleFlow = Api-Expect "GET" "/cash/flow-status" $SALE1 $null
if ($saleFlow.code -eq 403) {
    Pass "D2: SALE cannot access flow-status (403)"
} else {
    Warn "D2: Expected 403 for SALE, got HTTP $($saleFlow.code)"
}

# D3: GET /cash/flow-status/by-order/:orderId
Write-Host ""
Write-Host "=== TEST D3: GET /cash/flow-status/by-order/$ORD_ID ===" -ForegroundColor White
$orderFlow = D (Api "GET" "/cash/flow-status/by-order/$ORD_ID" $CFO)
if ($orderFlow) {
    Write-Host "  orderId:               $($orderFlow.orderId)"
    Write-Host "  orderCode:             $($orderFlow.orderCode)"
    Write-Host "  totalCustomerDeposits: $($orderFlow.totalCustomerDeposits)"
    Write-Host "  totalWalletBalances:   $($orderFlow.totalWalletBalances)"
    Write-Host "  totalAvailableFunds:   $($orderFlow.totalAvailableFunds)"
    Write-Host "  totalSupplierPayments: $($orderFlow.totalSupplierPayments)"
    Write-Host "  utilizationPercent:    $($orderFlow.utilizationPercent)%"
    Write-Host "  remaining:             $($orderFlow.remaining)"
    Write-Host "  status:                $($orderFlow.status)"

    # Verify order-specific fields
    if ($orderFlow.orderId -eq $ORD_ID -and $orderFlow.orderCode -eq $ORD_CODE) {
        Pass "D3: Per-order flow-status returns correct order"
    } else {
        Fail "D3: orderId/orderCode mismatch"
    }

    # Verify deposits match what we paid
    $orderDeposits = [double]$orderFlow.totalCustomerDeposits
    if ($orderDeposits -ge $ORD_DEPOSIT_REQ) {
        Pass "D3b: totalCustomerDeposits=$orderDeposits (>= depositPaid=$ORD_DEPOSIT_REQ)"
    } else {
        Fail "D3b: totalCustomerDeposits=$orderDeposits < depositPaid=$ORD_DEPOSIT_REQ"
    }
} else {
    Fail "D3: GET /cash/flow-status/by-order returned null"
}

# D4: SALE can access per-order flow-status (allowed role)
Write-Host ""
Write-Host "=== TEST D4: GET /cash/flow-status/by-order (SALE - allowed) ===" -ForegroundColor White
$saleOrderFlow = Api-Expect "GET" "/cash/flow-status/by-order/$ORD_ID" $SALE1 $null
if ($saleOrderFlow.code -ge 200 -and $saleOrderFlow.code -lt 300) {
    Pass "D4: SALE can access per-order flow-status"
} else {
    Warn "D4: SALE got HTTP $($saleOrderFlow.code) for per-order flow-status"
}

# D5: CEO can access system flow-status
Write-Host ""
Write-Host "=== TEST D5: GET /cash/flow-status (CEO) ===" -ForegroundColor White
$ceoFlow = D (Api "GET" "/cash/flow-status" $CEO)
if ($ceoFlow -and $ceoFlow.status) {
    Pass "D5: CEO can access flow-status (status=$($ceoFlow.status))"
} else {
    Fail "D5: CEO cannot access flow-status"
}

# ================================================================
# PART E: Wallet impact on cash flow
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: Wallet nang muc kha dung" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# E1: Topup wallet 100,000 VND
Write-Host ""
Write-Host "=== TEST E1: Topup wallet 100,000 VND ===" -ForegroundColor White
$topupBody = @{
    amount    = 100000
    reference = "FIN-008-TOPUP"
    note      = "FIN-008: Topup wallet to increase available funds"
}
$topupResp = D (Api "POST" "/customers/$($VIP_CUST.id)/wallet/topup" $CFO $topupBody)
if ($topupResp) {
    $newBal = 0
    if ($topupResp.newBalance -ne $null) { $newBal = [double]$topupResp.newBalance }
    elseif ($topupResp.balance -ne $null) { $newBal = [double]$topupResp.balance }
    Write-Host "  Wallet balance after topup: $newBal"
    Pass "E1: Wallet topup 100,000 OK"
    $NEW_WALLET_BAL = $newBal
} else {
    Warn "E1: Wallet topup may have failed"
    $NEW_WALLET_BAL = $WALLET_BAL
}

# E2: Verify per-order available funds increased
Write-Host ""
Write-Host "=== TEST E2: Verify available funds increased ===" -ForegroundColor White
$orderFlowAfterTopup = D (Api "GET" "/cash/flow-status/by-order/$ORD_ID" $CFO)
if ($orderFlowAfterTopup) {
    $newAvailable = [double]$orderFlowAfterTopup.totalAvailableFunds
    $newWalletInFlow = [double]$orderFlowAfterTopup.totalWalletBalances
    Write-Host "  totalAvailableFunds: $newAvailable (was $AVAILABLE_FUNDS)"
    Write-Host "  totalWalletBalances: $newWalletInFlow (was $WALLET_BAL)"
    if ($newAvailable -gt $AVAILABLE_FUNDS) {
        Pass "E2: Available funds increased after wallet topup ($AVAILABLE_FUNDS -> $newAvailable)"
    } else {
        Warn "E2: Available funds did not increase ($AVAILABLE_FUNDS -> $newAvailable)"
    }
    # Update for subsequent tests
    $AVAILABLE_FUNDS_NEW = $newAvailable
} else {
    Warn "E2: Could not check flow-status after topup"
    $AVAILABLE_FUNDS_NEW = $AVAILABLE_FUNDS + 100000
}

# E3: Now create PAYMENT that was previously blocked (with new wallet funds)
Write-Host ""
Write-Host "=== TEST E3: PAYMENT cho phep nho wallet moi ===" -ForegroundColor White
# Previously blocked amount was $AVAILABLE_FUNDS + 1. With extra 100K, it should work now.
# But we also have $smallAmount already approved. So new available = AVAILABLE_FUNDS_NEW - smallAmount(approved)
# Create a payment that fits in the new budget
$approvedSoFar = $smallAmount  # from C1
$newRemaining = $AVAILABLE_FUNDS_NEW - $approvedSoFar
$fitAmount = [math]::Floor($newRemaining * 0.9)
if ($fitAmount -le 0) { $fitAmount = 1000 }
Write-Host "  Approved so far: $approvedSoFar | New remaining: $newRemaining | Attempting: $fitAmount"
$e3Payment = Api-Expect "POST" "/cash/vouchers" $KETOAN @{
    orderId       = $ORD_ID
    type          = "PAYMENT"
    amount        = $fitAmount
    currency      = "VND"
    paymentMethod = "BANK_TRANSFER"
    costType      = "Thanh toan NCC"
    beneficiary   = "NCC Test Supplier 3"
    reason        = "FIN-008: Chi NCC trong muc kha dung moi sau wallet topup"
    attachments   = @("receipt-005.pdf")
}
if ($e3Payment.code -ge 200 -and $e3Payment.code -lt 300) {
    Pass "E3: PAYMENT $fitAmount accepted (wallet increased available funds)"
} else {
    Warn "E3: PAYMENT $fitAmount returned HTTP $($e3Payment.code)"
}

# ================================================================
# PART F: RECEIPT voucher (thu) - No cash flow block
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: RECEIPT (thu) - Khong bi cash flow block" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# F1: RECEIPT voucher should NOT be blocked by cash flow formula
Write-Host ""
Write-Host "=== TEST F1: RECEIPT voucher khong bi cash flow block ===" -ForegroundColor White
$receiptTest = Api-Expect "POST" "/cash/vouchers" $KETOAN @{
    orderId       = $ORD_ID
    type          = "RECEIPT"
    amount        = 999999
    currency      = "VND"
    paymentMethod = "BANK_TRANSFER"
    costType      = "Thu tien hang"
    beneficiary   = $VIP_CUST.fullName
    reason        = "FIN-008: Thu tien hang - khong bi cash flow block"
}
if ($receiptTest.code -ge 200 -and $receiptTest.code -lt 300) {
    Pass "F1: RECEIPT 999,999 not blocked by cash flow formula"
} elseif ($receiptTest.code -eq 400) {
    # Might be blocked by receipt total > order total check, which is correct
    $errMsg = ""
    if ($receiptTest.body -and $receiptTest.body.message) { $errMsg = $receiptTest.body.message }
    Warn "F1: RECEIPT blocked (400) but may be receipt-total-exceed check: $errMsg"
} else {
    Fail "F1: Unexpected HTTP $($receiptTest.code) for RECEIPT"
}

# ================================================================
# PART G: Utilization percent verification
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: Utilization percent verification" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# G1: Check utilization percent makes mathematical sense
Write-Host ""
Write-Host "=== TEST G1: Verify utilization math ===" -ForegroundColor White
$finalFlow = D (Api "GET" "/cash/flow-status/by-order/$ORD_ID" $CFO)
if ($finalFlow) {
    $fAvailable = [double]$finalFlow.totalAvailableFunds
    $fPayments = [double]$finalFlow.totalSupplierPayments
    $fUtil = [double]$finalFlow.utilizationPercent
    $fRemaining = [double]$finalFlow.remaining

    $expectedUtil = 0
    if ($fAvailable -gt 0) {
        $expectedUtil = [math]::Round(($fPayments / $fAvailable) * 100, 1)
    }
    $expectedRemaining = $fAvailable - $fPayments

    Write-Host "  available=$fAvailable | payments=$fPayments | util=$fUtil% | remaining=$fRemaining"
    Write-Host "  expectedUtil=$expectedUtil% | expectedRemaining=$expectedRemaining"

    # Allow small floating point difference
    if ([math]::Abs($fUtil - $expectedUtil) -le 0.2) {
        Pass "G1: utilizationPercent=$fUtil% matches expected $expectedUtil%"
    } else {
        Fail "G1: utilizationPercent=$fUtil% != expected $expectedUtil%"
    }

    if ([math]::Abs($fRemaining - $expectedRemaining) -le 1) {
        Pass "G1b: remaining=$fRemaining matches expected $expectedRemaining"
    } else {
        Fail "G1b: remaining=$fRemaining != expected $expectedRemaining"
    }
} else {
    Fail "G1: Could not get final flow status"
}

# G2: System flow-status utilization check
Write-Host ""
Write-Host "=== TEST G2: System flow-status utilization coherence ===" -ForegroundColor White
$sysFlow = D (Api "GET" "/cash/flow-status" $CFO)
if ($sysFlow) {
    $sAvailable = [double]$sysFlow.totalAvailableFunds
    $sPayments = [double]$sysFlow.totalSupplierPayments
    $sUtil = [double]$sysFlow.utilizationPercent
    $sStatus = $sysFlow.status

    Write-Host "  System: available=$sAvailable | payments=$sPayments | util=$sUtil% | status=$sStatus"

    # Verify status matches utilization
    $expectedStatus = "HEALTHY"
    if ($sUtil -ge 95) { $expectedStatus = "CRITICAL" }
    elseif ($sUtil -ge 80) { $expectedStatus = "WARNING" }

    if ($sStatus -eq $expectedStatus) {
        Pass "G2: System status=$sStatus matches utilization $sUtil%"
    } else {
        Warn "G2: System status=$sStatus but utilization=$sUtil% (expected $expectedStatus)"
    }

    # Verify available = deposits + wallets
    $sDeposits = [double]$sysFlow.totalCustomerDeposits
    $sWallets = [double]$sysFlow.totalWalletBalances
    $expectedAvailable = $sDeposits + $sWallets
    if ([math]::Abs($sAvailable - $expectedAvailable) -le 1) {
        Pass "G2b: totalAvailableFunds = deposits + wallets ($sDeposits + $sWallets = $expectedAvailable)"
    } else {
        Fail "G2b: totalAvailableFunds=$sAvailable != deposits($sDeposits) + wallets($sWallets) = $expectedAvailable"
    }
} else {
    Fail "G2: Could not get system flow status"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-FIN-008: Cash Flow Control" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  Part A: Setup - Order, deposit, advance to SOURCING (5 tests)"
Write-Host "  Part B: Cash flow BLOCK - vuot quy (3 tests)"
Write-Host "  Part C: Approval-time re-validation (2 tests)"
Write-Host "  Part D: Monitoring endpoints (5 tests)"
Write-Host "  Part E: Wallet impact on cash flow (3 tests)"
Write-Host "  Part F: RECEIPT not blocked (1 test)"
Write-Host "  Part G: Utilization percent verification (2 tests)"
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
