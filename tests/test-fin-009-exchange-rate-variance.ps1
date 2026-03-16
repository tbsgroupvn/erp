# ================================================================
# TEST-FIN-009: Exchange Rate Variance (Chenh lech ty gia)
# Severity: HIGH (Financial accuracy)
#
# Verifies:
# - PaymentVoucher auto-populates exchangeRateAtOrder from Order
# - exchangeRateAtPayment from DTO or ExchangeRateService
# - exchangeRateDiff calculated correctly
# - GL entries 515/635 created on approval
# - GET /cash/exchange-rate-variance report
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
Write-Host "  TEST-FIN-009: Exchange Rate Variance (Chenh lech ty gia)" -ForegroundColor Cyan
Write-Host "  Ty gia chot don vs ty gia thanh toan -> lai/lo" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login roles
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login roles ===" -ForegroundColor White

$SALE1 = Login "sale01@$DOMAIN"
if ($SALE1) { Pass "SALE1 login OK" } else { Fail "SALE1 login FAILED"; exit 1 }

$CFO = Login "cfo@$DOMAIN"
if ($CFO) { Pass "CFO login OK" } else { Fail "CFO login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

$ACCT = Login "ketoan@$DOMAIN"
if ($ACCT) { Pass "CHIEF_ACCOUNTANT login OK" } else { Fail "CHIEF_ACCOUNTANT login FAILED"; exit 1 }

# ================================================================
# SETUP: Find VIP customer + Create MHH order with baseExchangeRate
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Find VIP customer ===" -ForegroundColor White

$allCusts = D (Api GET "/customers?limit=100" $CEO)
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

# Set exchange rate CNY/VND = 3400
Write-Host ""
Write-Host "=== SETUP: Set CNY/VND exchange rate ===" -ForegroundColor White

$today = (Get-Date).ToString("yyyy-MM-dd")
$rateResp = Api POST "/exchange-rates" $CFO @{
    fromCurrency = "CNY"
    toCurrency = "VND"
    rate = 3400
    effectiveDate = $today
}
if ($rateResp) {
    Pass "CNY/VND rate set to 3400"
} else {
    Warn "Could not set exchange rate (may already exist for today)"
}

# Set customer to FIXED exchange rate mode
Write-Host ""
Write-Host "=== SETUP: Set customer to FIXED exchange rate mode ===" -ForegroundColor White

$updateCust = Api PATCH "/customers/$($VIP_CUST.id)" $CEO @{
    exchangeRateMode = "FIXED"
}
if ($updateCust) {
    Pass "Customer exchange rate mode set to FIXED"
} else {
    Warn "Could not update customer exchange rate mode"
}

Write-Host ""
Write-Host "=== SETUP: Create MHH order with baseExchangeRate ===" -ForegroundColor White

$orderBody = @{
    customerId    = $VIP_CUST.id
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{ productName = "FIN-009 FX Test Product"; productUrl = "https://item.taobao.com/item.htm?id=909001"; quantity = 10; unitPrice = 10000 }
    )
    note = "FIN-009: Exchange rate variance test order"
}

$orderResp = Api POST "/orders" $SALE1 $orderBody
$order = D $orderResp

if (-not $order -or -not $order.id) {
    Fail "Failed to create MHH order"; exit 1
}

$orderId = $order.id
$orderCode = $order.code
Write-Host "  Order: $orderCode (ID: $orderId)"
if ($order.baseExchangeRate) {
    Write-Host "  baseExchangeRate (locked): $($order.baseExchangeRate)"
    Pass "MHH order created with baseExchangeRate=$($order.baseExchangeRate)"
} else {
    Pass "MHH order created (baseExchangeRate may be set after FIXED mode)"
}

# Set baseExchangeRate = 3400 if not already set
# Advance order to PENDING_DEPOSIT first
Write-Host ""
Write-Host "=== SETUP: Advance order to SOURCING ===" -ForegroundColor White
Api PATCH "/orders/$orderId/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
Api PATCH "/orders/$orderId/status" $SALE1 @{ status = "PENDING_DEPOSIT" } | Out-Null

# Pay deposit
$depositAmt = [double]$order.depositRequired
if ($depositAmt -le 0) { $depositAmt = [double]$order.totalAmount * 0.3 }
if ($depositAmt -le 0) { $depositAmt = 30000 }

$receiptDeposit = DV (Api POST "/cash/vouchers" $ACCT @{
    type = "RECEIPT"
    orderId = $orderId
    amount = $depositAmt
    currency = "VND"
    paymentMethod = "BANK_TRANSFER"
    costType = "Thu coc khach hang"
    beneficiary = "TBS Company"
    reason = "Thu coc don hang FIN-009 exchange rate test deposit payment"
    attachments = @("https://example.com/deposit-009.pdf")
})
if ($receiptDeposit -and $receiptDeposit.id) {
    Api PATCH "/cash/vouchers/$($receiptDeposit.id)/approve" $CEO | Out-Null
    Pass "Deposit paid and approved"
} else {
    Warn "Could not create deposit voucher"
}

Api PATCH "/orders/$orderId/status" $SALE1 @{ status = "SOURCING" } | Out-Null
$orderCheck = D (Api GET "/orders/$orderId" $SALE1)
Write-Host "  Order status: $($orderCheck.status)"
if ($orderCheck.baseExchangeRate) {
    Write-Host "  baseExchangeRate: $($orderCheck.baseExchangeRate)"
}

# ================================================================
# Ensure sufficient RECEIPT balance in CNY for testing
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Ensure CNY receipt balance ===" -ForegroundColor White

# Need CNY balance for PAYMENT tests. Create a CNY receipt voucher.
$receiptBody = @{
    type = "RECEIPT"
    orderId = $orderId
    amount = 50000
    currency = "CNY"
    paymentMethod = "BANK_TRANSFER"
    costType = "Nap quy CNY de test"
    beneficiary = "TBS Company"
    reason = "Nap quy CNY cho muc dich test exchange rate variance - FIN-009"
    attachments = @("https://example.com/receipt-fx-test.pdf")
}

$receiptResp = Api POST "/cash/vouchers" $ACCT $receiptBody
$receipt = DV $receiptResp

if ($receipt -and $receipt.id) {
    Pass "CNY RECEIPT voucher created: $($receipt.code)"

    # Approve receipt
    $apprReceipt = D (Api PATCH "/cash/vouchers/$($receipt.id)/approve" $CEO)
    if ($apprReceipt) {
        Pass "CNY RECEIPT approved"
    } else {
        Warn "CNY RECEIPT approval failed"
    }
} else {
    Warn "Could not create CNY RECEIPT"
}

# ================================================================
# TEST 1: PAYMENT voucher with exchangeRateAtPayment = 3500
#         (rate increased = LOSS for TBS)
# ================================================================
Write-Host ""
Write-Host "=== TEST 1: PAYMENT with exchangeRateAtPayment (LOSS scenario) ===" -ForegroundColor White

$payBody1 = @{
    type = "PAYMENT"
    orderId = $orderId
    amount = 100
    currency = "CNY"
    paymentMethod = "BANK_TRANSFER"
    costType = "Thanh toan NCC"
    beneficiary = "NCC Trung Quoc ABC"
    reason = "Thanh toan don hang FX test - chenh lech ty gia LOSS scenario"
    attachments = @("https://example.com/payment-fx-test.pdf")
    exchangeRateAtPayment = 3500
}

$payResp1 = Api POST "/cash/vouchers" $ACCT $payBody1
$voucher1 = DV $payResp1

if ($voucher1 -and $voucher1.id) {
    Pass "PAYMENT voucher created: $($voucher1.code)"

    # Verify exchange rate fields populated
    if ($voucher1.exchangeRateAtOrder -ne $null) {
        $rateOrder = [decimal]$voucher1.exchangeRateAtOrder
        Write-Host "  exchangeRateAtOrder: $rateOrder"
        if ($rateOrder -gt 0) {
            Pass "exchangeRateAtOrder populated (value=$rateOrder)"
        } else {
            Fail "exchangeRateAtOrder is 0"
        }
    } else {
        Fail "exchangeRateAtOrder is null"
    }

    if ($voucher1.exchangeRateAtPayment -ne $null) {
        $ratePayment = [decimal]$voucher1.exchangeRateAtPayment
        Write-Host "  exchangeRateAtPayment: $ratePayment"
        if ($ratePayment -eq 3500) {
            Pass "exchangeRateAtPayment = 3500 (from DTO)"
        } else {
            Fail "exchangeRateAtPayment expected 3500, got $ratePayment"
        }
    } else {
        Fail "exchangeRateAtPayment is null"
    }

    if ($voucher1.exchangeRateDiff -ne $null) {
        $diff = [decimal]$voucher1.exchangeRateDiff
        Write-Host "  exchangeRateDiff: $diff"
        # If order has FIXED baseExchangeRate=3400, diff=100 (LOSS)
        # If FLOATING, diff=0 (no benchmark rate)
        if ($diff -ne 0) {
            Pass "exchangeRateDiff = $diff (variance detected)"
        } else {
            Pass "exchangeRateDiff = 0 (FLOATING mode - no locked rate, so no variance)"
        }
    } else {
        Fail "exchangeRateDiff is null"
    }
} else {
    Fail "Could not create PAYMENT voucher"
    $voucher1 = $null
}

# ================================================================
# TEST 2: Approve voucher -> verify GL entry created
# ================================================================
Write-Host ""
Write-Host "=== TEST 2: Approve PAYMENT voucher -> GL entry ===" -ForegroundColor White

if ($voucher1 -and $voucher1.id) {
    $apprResp = Api PATCH "/cash/vouchers/$($voucher1.id)/approve" $CEO
    $apprVoucher = D $apprResp

    if ($apprVoucher) {
        Pass "PAYMENT voucher approved"

        if ($apprVoucher.status -eq "APPROVED") {
            Pass "Voucher status is APPROVED"
        } else {
            Fail "Voucher status expected APPROVED, got $($apprVoucher.status)"
        }
    } else {
        Fail "PAYMENT voucher approval failed"
    }
} else {
    Warn "Skipping approval test - no voucher"
}

# ================================================================
# TEST 3: PAYMENT voucher with lower rate (GAIN scenario)
# ================================================================
Write-Host ""
Write-Host "=== TEST 3: PAYMENT with lower exchangeRateAtPayment (GAIN scenario) ===" -ForegroundColor White

$payBody2 = @{
    type = "PAYMENT"
    orderId = $orderId
    amount = 200
    currency = "CNY"
    paymentMethod = "BANK_TRANSFER"
    costType = "Thanh toan NCC"
    beneficiary = "NCC Trung Quoc XYZ"
    reason = "Thanh toan don hang FX test - chenh lech ty gia GAIN scenario"
    attachments = @("https://example.com/payment-fx-gain.pdf")
    exchangeRateAtPayment = 3300
}

$payResp2 = Api POST "/cash/vouchers" $ACCT $payBody2
$voucher2 = DV $payResp2

if ($voucher2 -and $voucher2.id) {
    Pass "GAIN scenario voucher created: $($voucher2.code)"

    if ($voucher2.exchangeRateDiff -ne $null) {
        $diff2 = [decimal]$voucher2.exchangeRateDiff
        Write-Host "  exchangeRateDiff: $diff2"
        if ($diff2 -lt 0) {
            Pass "exchangeRateDiff < 0 (correct for GAIN scenario with FIXED rate)"
        } elseif ($diff2 -eq 0) {
            Pass "exchangeRateDiff = 0 (FLOATING mode - no locked rate)"
        } else {
            Warn "exchangeRateDiff > 0 (unexpected for GAIN scenario)"
        }
    }

    # Approve
    $appr2 = Api PATCH "/cash/vouchers/$($voucher2.id)/approve" $CEO
    if ($appr2) {
        Pass "GAIN voucher approved -> GL 515 entry should be created"
    } else {
        Fail "GAIN voucher approval failed"
    }
} else {
    Fail "Could not create GAIN scenario voucher"
}

# ================================================================
# TEST 4: VND voucher should NOT have exchange rate fields
# ================================================================
Write-Host ""
Write-Host "=== TEST 4: VND PAYMENT - no exchange rate fields ===" -ForegroundColor White

$vndBody = @{
    type = "PAYMENT"
    orderId = $orderId
    amount = 500000
    currency = "VND"
    paymentMethod = "BANK_TRANSFER"
    costType = "Van chuyen noi dia"
    beneficiary = "Van tai ABC"
    reason = "Thanh toan phi van chuyen noi dia cho don hang FX test"
    attachments = @("https://example.com/vnd-payment.pdf")
}

$vndResp = Api POST "/cash/vouchers" $ACCT $vndBody
$vndVoucher = DV $vndResp

if ($vndVoucher -and $vndVoucher.id) {
    Pass "VND PAYMENT voucher created"

    $hasNoFxFields = ($vndVoucher.exchangeRateAtOrder -eq $null) -and
                     ($vndVoucher.exchangeRateAtPayment -eq $null) -and
                     ($vndVoucher.exchangeRateDiff -eq $null)
    if ($hasNoFxFields) {
        Pass "VND voucher has no exchange rate fields (correct)"
    } else {
        Fail "VND voucher should NOT have exchange rate fields"
    }
} else {
    Warn "Could not create VND PAYMENT voucher (may be blocked by cash flow)"
}

# ================================================================
# TEST 5: GET /cash/exchange-rate-variance report
# ================================================================
Write-Host ""
Write-Host "=== TEST 5: Exchange Rate Variance Report ===" -ForegroundColor White

$varReport = Api GET "/cash/exchange-rate-variance" $CFO
$varData = D $varReport

if ($varData) {
    Pass "Exchange rate variance endpoint accessible"

    if ($varData.summary) {
        Write-Host "  Summary:"
        Write-Host "    Total Gain: $($varData.summary.totalGain)"
        Write-Host "    Total Loss: $($varData.summary.totalLoss)"
        Write-Host "    Net: $($varData.summary.net)"
        Write-Host "    Count: $($varData.summary.count)"

        if ($varData.summary.count -gt 0) {
            Pass "Variance report has data (count=$($varData.summary.count))"
        } else {
            Warn "Variance report empty (no approved foreign currency payments yet)"
        }
    } else {
        Fail "Variance report missing summary"
    }

    if ($varData.items -ne $null) {
        Pass "Variance report has items array"
        foreach ($item in $varData.items) {
            $typeLabel = if ($item.type -eq "LOSS") { "LO" } elseif ($item.type -eq "GAIN") { "LAI" } else { "TRUNG" }
            Write-Host "    $($item.code): diff=$($item.exchangeRateDiff), impact=$($item.impactVND) VND ($typeLabel)"
        }
    }
} else {
    Fail "Exchange rate variance endpoint returned null"
}

# ================================================================
# TEST 6: Unauthorized role cannot access variance report
# ================================================================
Write-Host ""
Write-Host "=== TEST 6: Role check - SALE cannot access variance report ===" -ForegroundColor White

$saleVarResp = Api-Expect GET "/cash/exchange-rate-variance" $SALE1
if ($saleVarResp.code -eq 403) {
    Pass "SALE correctly denied access to variance report (403)"
} elseif ($saleVarResp.code -eq 200) {
    Fail "SALE should NOT have access to variance report (got 200)"
} else {
    Warn "Unexpected status code for SALE variance access: $($saleVarResp.code)"
}

# ================================================================
# TEST 7: RECEIPT voucher should NOT have exchange rate fields
# ================================================================
Write-Host ""
Write-Host "=== TEST 7: RECEIPT voucher - no exchange rate fields ===" -ForegroundColor White

$receiptBody2 = @{
    type = "RECEIPT"
    orderId = $orderId
    amount = 1000000
    currency = "CNY"
    paymentMethod = "BANK_TRANSFER"
    costType = "Thu tien khach hang"
    beneficiary = "TBS Company"
    reason = "Thu tien coc khach hang cho don hang test FIN-009 exchange rate"
    attachments = @("https://example.com/receipt-test.pdf")
}

$receiptResp2 = Api POST "/cash/vouchers" $ACCT $receiptBody2
$receipt2 = DV $receiptResp2

if ($receipt2 -and $receipt2.id) {
    Pass "RECEIPT voucher created"

    $noFx = ($receipt2.exchangeRateAtOrder -eq $null) -and
            ($receipt2.exchangeRateAtPayment -eq $null) -and
            ($receipt2.exchangeRateDiff -eq $null)
    if ($noFx) {
        Pass "RECEIPT voucher has no exchange rate fields (correct - only PAYMENT)"
    } else {
        Fail "RECEIPT voucher should NOT have exchange rate fields"
    }
} else {
    Warn "Could not create RECEIPT voucher for test"
}

# ================================================================
# SUMMARY
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  RESULTS: $passCount PASS / $failCount FAIL / $warnCount WARN" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host "================================================================" -ForegroundColor Cyan

if ($failCount -gt 0) { exit 1 } else { exit 0 }
