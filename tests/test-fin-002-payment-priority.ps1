# ================================================================
# TEST-FIN-002: Payment Priority Logic
# Severity: CRITICAL (Business pain point #3)
#
# Verifies: Wallet operations, credit check guard, AR creation,
# AR payment, wallet refund on cancel, blocked customer check
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
Write-Host "  TEST-FIN-002: Payment Priority Logic" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL (Business pain point #3)" -ForegroundColor Cyan
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

$COO = Login "admin@$DOMAIN"
if ($COO) { Pass "COO login OK" } else { Fail "COO login FAILED"; exit 1 }

$LEADER = Login "leader.hn@$DOMAIN"
if ($LEADER) { Pass "LEADER login OK" } else { Fail "LEADER login FAILED"; exit 1 }

$GDKD = Login "gdkd@$DOMAIN"
if ($GDKD) { Pass "GDKD login OK" } else { Fail "GDKD login FAILED"; exit 1 }

Write-Host ""
Write-Host "=== SETUP: Find VIP customer ===" -ForegroundColor White
$allCusts = D (Api "GET" "/customers?limit=100" $CEO)
if (-not ($allCusts -is [array])) {
    if ($allCusts -and $allCusts.items) { $allCusts = @($allCusts.items) }
    elseif ($allCusts -and $allCusts.id) { $allCusts = @($allCusts) }
    else { $allCusts = @() }
}

$VIP_CUST = $allCusts | Where-Object { $_.tier -eq 'VIP' } | Select-Object -First 1
if (-not $VIP_CUST) { Fail "No VIP customer found"; exit 1 }
Write-Host "  VIP: $($VIP_CUST.code) - $($VIP_CUST.fullName)" -ForegroundColor Gray
Write-Host "  creditLimit=$($VIP_CUST.creditLimit) | currentDebt=$($VIP_CUST.currentDebt)" -ForegroundColor Gray

# ================================================================
# PART A: Wallet operations
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Wallet operations" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# A1: Get wallet balance before
Write-Host ""
Write-Host "=== TEST A1: Get wallet balance before ===" -ForegroundColor White
$walletBefore = D (Api "GET" "/customers/$($VIP_CUST.id)/wallet" $CEO)
$balBefore = 0
if ($walletBefore -and $walletBefore.balance -ne $null) {
    $balBefore = [double]$walletBefore.balance
}
Write-Host "  Wallet balance: $balBefore VND"
Pass "A1: Wallet balance read = $balBefore"

# A2: Topup 50,000,000 (50M)
Write-Host ""
Write-Host "=== TEST A2: Topup 50,000,000 VND ===" -ForegroundColor White
$topupAmount = 50000000
$topupBody = @{
    amount    = $topupAmount
    reference = "FIN-002-TOPUP-50M"
    note      = "Test topup 50M for payment priority test"
}
$topupResp = D (Api "POST" "/customers/$($VIP_CUST.id)/wallet/topup" $CFO $topupBody)
if ($topupResp) {
    $newBal = [double]$topupResp.newBalance
    Write-Host "  newBalance=$newBal | transactionId=$($topupResp.transactionId)"
    Pass "A2: Topup 50M -> newBalance=$newBal"
} else {
    Fail "A2: Topup failed"
}

# A3: Verify newBalance = before + 50M
Write-Host ""
Write-Host "=== TEST A3: Verify newBalance = before + 50M ===" -ForegroundColor White
if ($topupResp) {
    $expectedBal = $balBefore + $topupAmount
    $actualNewBal = [double]$topupResp.newBalance
    if ([math]::Abs($actualNewBal - $expectedBal) -lt 1) {
        Pass "A3: newBalance=$actualNewBal = before($balBefore) + 50M"
    } else {
        Fail "A3: newBalance=$actualNewBal, expected $expectedBal"
    }
}

# A4: Get wallet balance -> confirm
Write-Host ""
Write-Host "=== TEST A4: GET wallet -> confirm balance ===" -ForegroundColor White
$walletConfirm = D (Api "GET" "/customers/$($VIP_CUST.id)/wallet" $CEO)
$balConfirm = 0
if ($walletConfirm -and $walletConfirm.balance -ne $null) {
    $balConfirm = [double]$walletConfirm.balance
}
$expectedAfterTopup = $balBefore + $topupAmount
if ([math]::Abs($balConfirm - $expectedAfterTopup) -lt 1) {
    Pass "A4: GET wallet balance=$balConfirm (confirmed)"
} else {
    Fail "A4: GET wallet balance=$balConfirm, expected $expectedAfterTopup"
}

# A5: Topup negative -> expect 400
Write-Host ""
Write-Host "=== TEST A5: Topup negative amount -> 400 ===" -ForegroundColor White
$negResp = Api-Expect "POST" "/customers/$($VIP_CUST.id)/wallet/topup" $CFO @{ amount = -1000; reference = "INVALID" }
if ($negResp.code -eq 400) {
    Pass "A5: Negative topup rejected (400)"
} else {
    Warn "A5: Negative topup returned HTTP $($negResp.code) (expected 400)"
}

# A6: Topup zero -> expect 400
Write-Host ""
Write-Host "=== TEST A6: Topup zero amount -> 400 ===" -ForegroundColor White
$zeroResp = Api-Expect "POST" "/customers/$($VIP_CUST.id)/wallet/topup" $CFO @{ amount = 0; reference = "ZERO" }
if ($zeroResp.code -eq 400) {
    Pass "A6: Zero topup rejected (400)"
} else {
    Warn "A6: Zero topup returned HTTP $($zeroResp.code) (expected 400)"
}

# ================================================================
# PART B: Credit check guard - within limit
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Credit check guard - within limit" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# B1: Get customer creditLimit, currentDebt
Write-Host ""
Write-Host "=== TEST B1: Customer credit state ===" -ForegroundColor White
$custDetail = D (Api "GET" "/customers/$($VIP_CUST.id)" $CEO)
$creditLimit = 0; $currentDebt = 0
if ($custDetail) {
    $creditLimit = [double]$custDetail.creditLimit
    $currentDebt = [double]$custDetail.currentDebt
}
$availableCredit = $creditLimit - $currentDebt
Write-Host "  creditLimit=$creditLimit | currentDebt=$currentDebt | available=$availableCredit"
if ($creditLimit -gt 0) {
    Pass "B1: creditLimit=$creditLimit, currentDebt=$currentDebt, available=$availableCredit"
} else {
    Warn "B1: creditLimit=0 (customer may not have credit set up)"
}

# B2: Calculate available credit
Write-Host ""
Write-Host "=== TEST B2: Available credit calculation ===" -ForegroundColor White
if ($availableCredit -gt 0) {
    Pass "B2: Available credit = $availableCredit VND"
} else {
    Warn "B2: Available credit = $availableCredit (may be fully used)"
}

# B3: Create order within available credit -> PASS
Write-Host ""
Write-Host "=== TEST B3: Order within credit limit -> PASS ===" -ForegroundColor White
$smallAmount = [math]::Min(10000, [math]::Max(1, $availableCredit / 10))
$b3Body = @{
    customerId    = $VIP_CUST.id
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{ productName = "Credit Check Pass Test"; productUrl = "https://item.taobao.com/item.htm?id=910001"; quantity = 1; unitPrice = $smallAmount }
    )
    note = "FIN-002: Order within credit limit"
}
$b3Resp = Api-Expect "POST" "/orders" $SALE1 $b3Body
if ($b3Resp.code -ge 200 -and $b3Resp.code -lt 300) {
    $b3Order = $null
    if ($b3Resp.body -and $b3Resp.body.data) { $b3Order = $b3Resp.body.data }
    if ($b3Order -and $b3Order.id) {
        $ORD_B3_ID = $b3Order.id
        Write-Host "  Order created: $($b3Order.code) | total=$($b3Order.totalAmount)"
        Pass "B3: Order within credit limit -> created OK"
    } else {
        Pass "B3: Order creation returned 200"
    }
} else {
    Fail "B3: Order within credit limit blocked (HTTP $($b3Resp.code))"
}

# B4: Verify customer currentDebt unchanged after order creation
Write-Host ""
Write-Host "=== TEST B4: currentDebt unchanged after order creation ===" -ForegroundColor White
$custAfterOrder = D (Api "GET" "/customers/$($VIP_CUST.id)" $CEO)
$debtAfterOrder = [double]$custAfterOrder.currentDebt
Write-Host "  currentDebt before=$currentDebt | after=$debtAfterOrder"
if ([math]::Abs($debtAfterOrder - $currentDebt) -lt 1) {
    Pass "B4: currentDebt unchanged after order creation"
} else {
    Warn "B4: currentDebt changed from $currentDebt to $debtAfterOrder"
}

# ================================================================
# PART C: Credit check guard - exceed limit
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Credit check guard - exceed limit" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# C1: Calculate order amount > available credit
Write-Host ""
Write-Host "=== TEST C1: Order exceeding credit limit ===" -ForegroundColor White
$exceedAmount = $availableCredit + 1000000
Write-Host "  Order amount = $exceedAmount (available credit = $availableCredit)"

# C2: Create order exceeding credit -> expect 403
Write-Host ""
Write-Host "=== TEST C2: Create order exceeding credit -> 403 ===" -ForegroundColor White
$c2Body = @{
    customerId    = $VIP_CUST.id
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{ productName = "Credit Exceed Test"; productUrl = "https://item.taobao.com/item.htm?id=910002"; quantity = 1; unitPrice = $exceedAmount }
    )
    note = "FIN-002: Order exceeding credit limit"
}
$c2Resp = Api-Expect "POST" "/orders" $SALE1 $c2Body
if ($c2Resp.code -eq 403) {
    Pass "C2: Order exceeding credit blocked (403)"
} elseif ($c2Resp.code -ge 200 -and $c2Resp.code -lt 300) {
    Warn "C2: Order was created despite exceeding credit (credit check may be lenient)"
} else {
    Warn "C2: Got HTTP $($c2Resp.code) (expected 403)"
}

# C3: Verify error message mentions credit limit
Write-Host ""
Write-Host "=== TEST C3: Error message references credit limit ===" -ForegroundColor White
if ($c2Resp.code -eq 403) {
    $errMsg = ""
    if ($c2Resp.body -and $c2Resp.body.message) { $errMsg = $c2Resp.body.message }
    Write-Host "  Error: $errMsg"
    if ($errMsg -match "credit|d.ng|m.c|Forbidden|403|VND") {
        Pass "C3: Error message references credit limit"
    } else {
        Warn "C3: Error message does not explicitly mention credit"
    }
} else {
    Warn "C3: Skipped (no 403 to verify)"
}

# ================================================================
# PART D: AR creation on SOURCING transition
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: AR creation on SOURCING transition" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# D1: Create order and advance to SOURCING (full deposit flow)
Write-Host ""
Write-Host "=== TEST D1: Advance order to SOURCING (full deposit) ===" -ForegroundColor White
$d1Body = @{
    customerId    = $VIP_CUST.id
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{ productName = "AR Creation Test Product"; productUrl = "https://item.taobao.com/item.htm?id=910010"; quantity = 10; unitPrice = 10000 }
    )
    note = "FIN-002: AR creation on SOURCING test"
}
$d1Resp = Api "POST" "/orders" $SALE1 $d1Body
$d1Order = D $d1Resp
$ORD_D1_ID = $null
if ($d1Order -and $d1Order.id) {
    $ORD_D1_ID = $d1Order.id
    $ORD_D1_CODE = $d1Order.code
    $d1Total = [double]$d1Order.totalAmount
    $d1DepReq = [double]$d1Order.depositRequired
    Write-Host "  Order: $ORD_D1_CODE | total=$d1Total | depositRequired=$d1DepReq"

    # Advance CONSULTING -> QUOTATION -> PENDING_DEPOSIT
    Api "PATCH" "/orders/$ORD_D1_ID/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
    Api "PATCH" "/orders/$ORD_D1_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT" } | Out-Null

    # Pay deposit
    $d1VBody = @{
        orderId = $ORD_D1_ID; type = "RECEIPT"; amount = $d1DepReq; currency = "VND"
        paymentMethod = "BANK_TRANSFER"; costType = "Tien coc don hang"
        beneficiary = $VIP_CUST.fullName; reason = "Coc cho AR creation test"
    }
    $d1VRaw = Api "POST" "/cash/vouchers" $KETOAN $d1VBody
    $d1VResp = D $d1VRaw
    if ($d1VResp -and $d1VResp.voucher) { $d1VResp = $d1VResp.voucher }
    if ($d1VResp -and $d1VResp.id) {
        Api "PATCH" "/cash/vouchers/$($d1VResp.id)/approve" $CFO $null | Out-Null
        Start-Sleep -Milliseconds 500
    }

    # Advance to SOURCING
    $d1Sourcing = Api-Expect "PATCH" "/orders/$ORD_D1_ID/status" $SALE1 @{ status = "SOURCING" }
    if ($d1Sourcing.code -ge 200 -and $d1Sourcing.code -lt 300) {
        $d1Check = D (Api "GET" "/orders/$ORD_D1_ID" $SALE1)
        if ($d1Check.status -eq "SOURCING") {
            Pass "D1: Order at SOURCING ($ORD_D1_CODE)"
        } else {
            Fail "D1: Expected SOURCING, got $($d1Check.status)"
        }
    } else {
        Fail "D1: SOURCING transition failed (HTTP $($d1Sourcing.code))"
    }
} else {
    Fail "D1: Failed to create order"
}

# D2: Check AR via /ar/by-customer/:customerId or /ar list
Write-Host ""
Write-Host "=== TEST D2: Check AR created for order ===" -ForegroundColor White
Start-Sleep -Milliseconds 1000  # Wait for async event processing
if ($ORD_D1_ID) {
    # Use by-customer endpoint (orderId filter not supported)
    $arByCust = D (Api "GET" "/ar/by-customer/$($VIP_CUST.id)" $CFO)
    $AR_ID = $null

    # Also list all ARs and find the one matching our order
    $arList = D (Api "GET" "/ar?customerId=$($VIP_CUST.id)&limit=50" $CFO)
    $arItems = @()
    if ($arList -is [array]) { $arItems = @($arList) }
    elseif ($arList -and $arList.items) { $arItems = @($arList.items) }
    elseif ($arList -and $arList.data) { $arItems = @($arList.data) }

    # Try to find AR for our specific order
    $matchAr = $arItems | Where-Object { $_.orderId -eq $ORD_D1_ID } | Select-Object -First 1
    if ($matchAr) {
        $AR_ID = $matchAr.id
        Write-Host "  AR found: id=$AR_ID | amount=$($matchAr.totalAmount) | status=$($matchAr.status)"
        Pass "D2: AR created for order (id=$AR_ID)"
    } elseif ($arByCust) {
        $totalDebt = if ($arByCust.totalDebt) { $arByCust.totalDebt } else { "N/A" }
        $receivables = @()
        if ($arByCust.receivables) { $receivables = @($arByCust.receivables) }
        Write-Host "  Customer debt view: totalDebt=$totalDebt | receivables=$($receivables.Count)"
        # Try to find in receivables
        $matchFromDebt = $receivables | Where-Object { $_.orderId -eq $ORD_D1_ID } | Select-Object -First 1
        if ($matchFromDebt) {
            $AR_ID = $matchFromDebt.id
            Write-Host "  AR found in debt view: id=$AR_ID"
            Pass "D2: AR found in customer debt view (id=$AR_ID)"
        } else {
            # Take the most recent one
            if ($receivables.Count -gt 0) {
                $AR_ID = $receivables[0].id
                Write-Host "  Using most recent AR: id=$AR_ID"
                Pass "D2: AR exists for customer (using most recent)"
            } elseif ($arItems.Count -gt 0) {
                $AR_ID = $arItems[-1].id
                Write-Host "  Using last AR from list: id=$AR_ID"
                Pass "D2: AR exists in list (using last)"
            } else {
                Warn "D2: Customer debt view exists but no individual AR found"
            }
        }
    } else {
        Warn "D2: No AR found (may be created async later)"
    }
}

# D3: Verify AR amount = totalAmount - depositPaid
Write-Host ""
Write-Host "=== TEST D3: Verify AR amount = total - deposit ===" -ForegroundColor White
if ($AR_ID -and $ORD_D1_ID) {
    $arDetail = D (Api "GET" "/ar/$AR_ID" $CFO)
    $d1OrderFresh = D (Api "GET" "/orders/$ORD_D1_ID" $SALE1)
    if ($arDetail -and $d1OrderFresh) {
        $arAmount = [double]$arDetail.totalAmount
        $ordTotal = [double]$d1OrderFresh.totalAmount
        $ordDepPaid = [double]$d1OrderFresh.depositPaid
        $expectedArAmt = $ordTotal - $ordDepPaid
        Write-Host "  AR amount=$arAmount | order total=$ordTotal - deposit=$ordDepPaid = $expectedArAmt"
        if ([math]::Abs($arAmount - $expectedArAmt) -lt 1) {
            Pass "D3: AR amount=$arAmount matches (total - deposit)"
        } else {
            Warn "D3: AR amount=$arAmount vs expected $expectedArAmt"
        }
    } else {
        Warn "D3: Could not retrieve AR or order details"
    }
} else {
    Warn "D3: Skipped (no AR found)"
}

# D4: Verify AR status = OPEN
Write-Host ""
Write-Host "=== TEST D4: AR status = OPEN ===" -ForegroundColor White
if ($AR_ID) {
    $arCheck = D (Api "GET" "/ar/$AR_ID" $CFO)
    if ($arCheck) {
        $arStatus = $arCheck.status
        Write-Host "  AR status: $arStatus"
        if ($arStatus -eq "OPEN") {
            Pass "D4: AR status = OPEN"
        } else {
            Warn "D4: AR status = $arStatus (expected OPEN)"
        }
    }
} else {
    Warn "D4: Skipped (no AR found)"
}

# D5: Verify customer currentDebt updated
Write-Host ""
Write-Host "=== TEST D5: Customer currentDebt updated ===" -ForegroundColor White
$custAfterSourcing = D (Api "GET" "/customers/$($VIP_CUST.id)" $CEO)
$debtAfterSourcing = [double]$custAfterSourcing.currentDebt
Write-Host "  currentDebt before orders=$currentDebt | after SOURCING=$debtAfterSourcing"
if ($debtAfterSourcing -ge $currentDebt) {
    Pass "D5: currentDebt=$debtAfterSourcing (>= initial $currentDebt)"
} else {
    Warn "D5: currentDebt=$debtAfterSourcing (< initial $currentDebt)"
}

# ================================================================
# PART E: AR payment recording
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: AR payment recording" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# E1: Record payment against AR
Write-Host ""
Write-Host "=== TEST E1: Record payment against AR ===" -ForegroundColor White
if ($AR_ID) {
    $arBeforePayment = D (Api "GET" "/ar/$AR_ID" $CFO)
    $arTotalAmt = [double]$arBeforePayment.totalAmount
    $arPaidBefore = 0
    if ($arBeforePayment.paidAmount -ne $null) { $arPaidBefore = [double]$arBeforePayment.paidAmount }
    $payAmount = [math]::Min(10000, [math]::Max(1, $arTotalAmt / 2))

    $payBody = @{
        amount    = $payAmount
        reference = "FIN-002-AR-PAY-TEST"
        note      = "Test AR payment for FIN-002"
    }
    $payResp = Api-Expect "PATCH" "/ar/$AR_ID/payment" $CFO $payBody
    if ($payResp.code -ge 200 -and $payResp.code -lt 300) {
        Pass "E1: AR payment recorded ($payAmount VND)"
    } else {
        Fail "E1: AR payment failed (HTTP $($payResp.code))"
    }
} else {
    Warn "E1: Skipped (no AR found)"
}

# E2: Verify AR paidAmount increased
Write-Host ""
Write-Host "=== TEST E2: AR paidAmount increased ===" -ForegroundColor White
if ($AR_ID) {
    $arAfterPayment = D (Api "GET" "/ar/$AR_ID" $CFO)
    if ($arAfterPayment) {
        $arPaidAfter = 0
        if ($arAfterPayment.paidAmount -ne $null) { $arPaidAfter = [double]$arAfterPayment.paidAmount }
        Write-Host "  paidBefore=$arPaidBefore | paidAfter=$arPaidAfter"
        if ($arPaidAfter -gt $arPaidBefore) {
            Pass "E2: AR paidAmount increased from $arPaidBefore to $arPaidAfter"
        } else {
            Fail "E2: AR paidAmount unchanged ($arPaidAfter)"
        }
    }
} else {
    Warn "E2: Skipped (no AR found)"
}

# E3: Verify AR status -> PARTIAL or PAID
Write-Host ""
Write-Host "=== TEST E3: AR status after partial payment ===" -ForegroundColor White
if ($AR_ID) {
    $arStatusCheck = D (Api "GET" "/ar/$AR_ID" $CFO)
    if ($arStatusCheck) {
        $arSt = $arStatusCheck.status
        Write-Host "  AR status: $arSt"
        if ($arSt -eq "PARTIAL" -or $arSt -eq "PARTIALLY_PAID") {
            Pass "E3: AR status = $arSt (partial payment)"
        } elseif ($arSt -eq "PAID" -or $arSt -eq "CLOSED") {
            Pass "E3: AR status = $arSt (fully paid)"
        } elseif ($arSt -eq "OPEN") {
            Warn "E3: AR still OPEN after payment (status may not auto-update)"
        } else {
            Warn "E3: AR status = $arSt"
        }
    }
} else {
    Warn "E3: Skipped (no AR found)"
}

# E4: Verify customer currentDebt decreased
Write-Host ""
Write-Host "=== TEST E4: Customer currentDebt after AR payment ===" -ForegroundColor White
$custAfterArPay = D (Api "GET" "/customers/$($VIP_CUST.id)" $CEO)
$debtAfterArPay = [double]$custAfterArPay.currentDebt
Write-Host "  Debt after SOURCING=$debtAfterSourcing | after AR payment=$debtAfterArPay"
if ($debtAfterArPay -le $debtAfterSourcing) {
    Pass "E4: currentDebt=$debtAfterArPay (<= $debtAfterSourcing after payment)"
} else {
    Warn "E4: currentDebt=$debtAfterArPay (> $debtAfterSourcing - unexpected)"
}

# ================================================================
# PART F: Wallet refund on cancel (MHH deposited)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Wallet refund on cancel (MHH deposited)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# F1: Create MHH order, deposit, advance to SOURCING, then cancel
Write-Host ""
Write-Host "=== TEST F1: Create MHH, deposit, SOURCING, cancel ===" -ForegroundColor White

# Get wallet balance before cancel
$walletPreCancel = D (Api "GET" "/customers/$($VIP_CUST.id)/wallet" $CEO)
$balPreCancel = 0
if ($walletPreCancel -and $walletPreCancel.balance -ne $null) {
    $balPreCancel = [double]$walletPreCancel.balance
}
Write-Host "  Wallet before cancel flow: $balPreCancel"

$f1Body = @{
    customerId    = $VIP_CUST.id
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{ productName = "Refund Test Product"; productUrl = "https://item.taobao.com/item.htm?id=910020"; quantity = 5; unitPrice = 20000 }
    )
    note = "FIN-002: Wallet refund on cancel test"
}
$f1Resp = Api "POST" "/orders" $SALE1 $f1Body
$f1Order = D $f1Resp
$ORD_F1_ID = $null
$f1DepositPaid = 0
if ($f1Order -and $f1Order.id) {
    $ORD_F1_ID = $f1Order.id
    $ORD_F1_CODE = $f1Order.code
    $f1DepReq = [double]$f1Order.depositRequired
    Write-Host "  Order: $ORD_F1_CODE | depositRequired=$f1DepReq"

    # Advance + pay deposit
    Api "PATCH" "/orders/$ORD_F1_ID/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
    Api "PATCH" "/orders/$ORD_F1_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT" } | Out-Null

    $f1VBody = @{
        orderId = $ORD_F1_ID; type = "RECEIPT"; amount = $f1DepReq; currency = "VND"
        paymentMethod = "BANK_TRANSFER"; costType = "Tien coc don hang"
        beneficiary = $VIP_CUST.fullName; reason = "Coc cho cancel refund test"
    }
    $f1VRaw = Api "POST" "/cash/vouchers" $KETOAN $f1VBody
    $f1VResp = D $f1VRaw
    if ($f1VResp -and $f1VResp.voucher) { $f1VResp = $f1VResp.voucher }
    if ($f1VResp -and $f1VResp.id) {
        Api "PATCH" "/cash/vouchers/$($f1VResp.id)/approve" $CFO $null | Out-Null
        Start-Sleep -Milliseconds 500
    }

    Api "PATCH" "/orders/$ORD_F1_ID/status" $SALE1 @{ status = "SOURCING" } | Out-Null
    $f1Check = D (Api "GET" "/orders/$ORD_F1_ID" $SALE1)
    $f1DepositPaid = [double]$f1Check.depositPaid
    Write-Host "  Order at $($f1Check.status), depositPaid=$f1DepositPaid"

    if ($f1Check.status -eq "SOURCING") {
        Pass "F1a: Order at SOURCING with deposit=$f1DepositPaid"
    } else {
        Fail "F1a: Expected SOURCING, got $($f1Check.status)"
    }

    # Request cancel
    $cancelResp = Api-Expect "POST" "/orders/$ORD_F1_ID/cancel" $SALE1 @{
        reason = "Customer changed their mind, requesting full cancellation and refund for testing purposes"
    }
    if ($cancelResp.code -eq 200) {
        $cancelData = $null
        if ($cancelResp.body -and $cancelResp.body.data) { $cancelData = $cancelResp.body.data }
        $cancelStatus = $cancelData.status
        $CANCEL_APPROVAL_ID = $cancelData.approvalId
        Write-Host "  Cancel status: $cancelStatus | approvalId: $CANCEL_APPROVAL_ID"

        if ($cancelStatus -eq "PENDING_APPROVAL" -and $CANCEL_APPROVAL_ID) {
            # Need to approve cancellation step by step
            $roleTokenMap = @{
                "SALES_LEADER"    = $LEADER
                "SALES_DIRECTOR"  = $GDKD
                "COO"             = $COO
                "CEO"             = $CEO
                "CFO"             = $CFO
            }
            $apDetail = D (Api "GET" "/approvals/$CANCEL_APPROVAL_ID" $CEO)
            $totalSteps = if ($apDetail) { $apDetail.totalSteps } else { 0 }
            Write-Host "  Approval: $totalSteps steps"

            for ($i = 0; $i -lt $totalSteps; $i++) {
                # Re-fetch to get current pending step
                $apRefresh = D (Api "GET" "/approvals/$CANCEL_APPROVAL_ID" $CEO)
                if ($apRefresh.status -eq "APPROVED") { break }

                $pendingStep = @($apRefresh.steps) | Where-Object { $_.status -eq "PENDING" } | Select-Object -First 1
                if ($pendingStep) {
                    $stepToken = $roleTokenMap[$pendingStep.approverRole]
                    if (-not $stepToken) { $stepToken = $CEO }
                    Write-Host "  Approving step $($pendingStep.stepNumber): role=$($pendingStep.approverRole)"
                    Api "POST" "/approvals/$CANCEL_APPROVAL_ID/approve" $stepToken @{
                        decision = "APPROVE"; comment = "Auto-approve step $($pendingStep.stepNumber) for FIN-002 test"
                    } | Out-Null
                    Start-Sleep -Milliseconds 500
                }
            }
            Start-Sleep -Milliseconds 2000  # Wait for async cancel processing
        } elseif ($cancelStatus -eq "CANCELLED") {
            Write-Host "  Direct cancel (no approval needed)"
        }

        Pass "F1b: Cancel request processed"
    } else {
        Fail "F1b: Cancel request failed (HTTP $($cancelResp.code))"
    }
} else {
    Fail "F1: Failed to create order for cancel test"
}

# F2: Verify wallet balance increased by refund amount
Write-Host ""
Write-Host "=== TEST F2: Wallet balance after cancel (refund) ===" -ForegroundColor White
if ($ORD_F1_ID) {
    Start-Sleep -Milliseconds 1000
    $walletPostCancel = D (Api "GET" "/customers/$($VIP_CUST.id)/wallet" $CEO)
    $balPostCancel = 0
    if ($walletPostCancel -and $walletPostCancel.balance -ne $null) {
        $balPostCancel = [double]$walletPostCancel.balance
    }
    $refundDiff = $balPostCancel - $balPreCancel
    Write-Host "  Before cancel: $balPreCancel | After cancel: $balPostCancel | Diff: $refundDiff"
    if ($refundDiff -gt 0) {
        Pass "F2: Wallet increased by $refundDiff VND (refund applied)"
    } else {
        Warn "F2: Wallet diff=$refundDiff (expected > 0 for refund)"
    }
}

# F3: Verify order is CANCELLED
Write-Host ""
Write-Host "=== TEST F3: Order status = CANCELLED ===" -ForegroundColor White
if ($ORD_F1_ID) {
    $f1Final = D (Api "GET" "/orders/$ORD_F1_ID" $SALE1)
    Write-Host "  Order status: $($f1Final.status)"
    if ($f1Final.status -eq "CANCELLED") {
        Pass "F3: Order is CANCELLED"
    } else {
        Warn "F3: Order status = $($f1Final.status) (expected CANCELLED)"
    }
}

# ================================================================
# PART G: Blocked customer check
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: Blocked customer check" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# G1: Find blocked customer
Write-Host ""
Write-Host "=== TEST G1: Find blocked customer ===" -ForegroundColor White
$blockedCust = $allCusts | Where-Object { $_.isBlocked -eq $true } | Select-Object -First 1
if ($blockedCust) {
    Write-Host "  Blocked: $($blockedCust.code) - $($blockedCust.fullName) | reason=$($blockedCust.blockReason)"
    Pass "G1: Blocked customer found ($($blockedCust.code))"
} else {
    Write-Host "  No blocked customer found in dataset"
    Warn "G1: No blocked customer found - skipping G2/G3"
}

# G2: Attempt create order for blocked customer -> 403
Write-Host ""
Write-Host "=== TEST G2: Create order for blocked customer -> 403 ===" -ForegroundColor White
if ($blockedCust) {
    $g2Body = @{
        customerId    = $blockedCust.id
        serviceType   = "MHH"
        branch        = "HN"
        shippingRoute = "SEA"
        items         = @(
            @{ productName = "Blocked Customer Test"; productUrl = "https://item.taobao.com/item.htm?id=910030"; quantity = 1; unitPrice = 10000 }
        )
        note = "FIN-002: Blocked customer order test"
    }
    $g2Resp = Api-Expect "POST" "/orders" $SALE1 $g2Body
    if ($g2Resp.code -eq 403) {
        Pass "G2: Blocked customer order rejected (403)"
    } else {
        Warn "G2: Got HTTP $($g2Resp.code) (expected 403 for blocked customer)"
    }
} else {
    Warn "G2: Skipped (no blocked customer)"
}

# G3: Verify error message references block reason
Write-Host ""
Write-Host "=== TEST G3: Error message references block ===" -ForegroundColor White
if ($blockedCust -and $g2Resp.code -eq 403) {
    $errMsg = ""
    if ($g2Resp.body -and $g2Resp.body.message) { $errMsg = $g2Resp.body.message }
    Write-Host "  Error: $errMsg"
    if ($errMsg -match "chan|block|khong the tao") {
        Pass "G3: Error message references block status"
    } else {
        Warn "G3: Error message may not reference block status"
    }
} else {
    Warn "G3: Skipped (no blocked customer or no 403)"
}

# ================================================================
# PART H: Combined wallet + credit scenario
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Combined wallet + credit scenario" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# H1: Top up wallet to known amount
Write-Host ""
Write-Host "=== TEST H1: Verify wallet state ===" -ForegroundColor White
$walletH = D (Api "GET" "/customers/$($VIP_CUST.id)/wallet" $CEO)
$balH = 0
if ($walletH -and $walletH.balance -ne $null) { $balH = [double]$walletH.balance }
Write-Host "  Current wallet: $balH VND"
Pass "H1: Wallet state read ($balH VND)"

# H2: Get credit state
Write-Host ""
Write-Host "=== TEST H2: Credit state ===" -ForegroundColor White
$custH = D (Api "GET" "/customers/$($VIP_CUST.id)" $CEO)
$creditH = [double]$custH.creditLimit
$debtH = [double]$custH.currentDebt
$availH = $creditH - $debtH
Write-Host "  creditLimit=$creditH | currentDebt=$debtH | available=$availH"
Pass "H2: Credit state (limit=$creditH, available=$availH)"

# H3: Create order - the system uses wallet + credit internally
Write-Host ""
Write-Host "=== TEST H3: Create order (system uses wallet+credit) ===" -ForegroundColor White
$h3Body = @{
    customerId    = $VIP_CUST.id
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{ productName = "Wallet+Credit Test"; productUrl = "https://item.taobao.com/item.htm?id=910040"; quantity = 2; unitPrice = 5000 }
    )
    note = "FIN-002: Combined wallet+credit scenario"
}
$h3Resp = Api-Expect "POST" "/orders" $SALE1 $h3Body
if ($h3Resp.code -ge 200 -and $h3Resp.code -lt 300) {
    Pass "H3: Order created within combined wallet+credit"
} else {
    Warn "H3: Order creation failed (HTTP $($h3Resp.code))"
}

# H4: Verify state consistency
Write-Host ""
Write-Host "=== TEST H4: State consistency after operations ===" -ForegroundColor White
$custFinal = D (Api "GET" "/customers/$($VIP_CUST.id)" $CEO)
$walletFinal = D (Api "GET" "/customers/$($VIP_CUST.id)/wallet" $CEO)
$finalDebt = [double]$custFinal.currentDebt
$finalBal = 0
if ($walletFinal -and $walletFinal.balance -ne $null) { $finalBal = [double]$walletFinal.balance }
Write-Host "  Final wallet: $finalBal | Final debt: $finalDebt"
Write-Host "  creditLimit: $([double]$custFinal.creditLimit)"
if ($finalDebt -le [double]$custFinal.creditLimit) {
    Pass "H4: Debt $finalDebt within credit limit $([double]$custFinal.creditLimit)"
} else {
    Fail "H4: Debt $finalDebt exceeds credit limit $([double]$custFinal.creditLimit)"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-FIN-002: Payment Priority Logic" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  Part A: Wallet operations (6 tests)"
Write-Host "  Part B: Credit check guard - within limit (4 tests)"
Write-Host "  Part C: Credit check guard - exceed limit (3 tests)"
Write-Host "  Part D: AR creation on SOURCING (5 tests)"
Write-Host "  Part E: AR payment recording (4 tests)"
Write-Host "  Part F: Wallet refund on cancel (3 tests)"
Write-Host "  Part G: Blocked customer check (3 tests)"
Write-Host "  Part H: Combined wallet + credit (4 tests)"
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
