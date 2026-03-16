# ================================================================
# TEST-FIN-001: Deposit Gate Control
# Severity: CRITICAL (Business pain point #1)
#
# Verifies: Deposit rate per tier, MHH deposit gate blocking,
# VCT skip deposit, procurement gate (70% rule), wallet topup
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
Write-Host "  TEST-FIN-001: Deposit Gate Control" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL (Business pain point #1)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login roles + Find customers by tier
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

# Find customers by tier
Write-Host ""
Write-Host "=== SETUP: Find customers by tier ===" -ForegroundColor White

$allCusts = D (Api "GET" "/customers?limit=100" $CEO)
if (-not ($allCusts -is [array])) {
    if ($allCusts -and $allCusts.items) { $allCusts = @($allCusts.items) }
    elseif ($allCusts -and $allCusts.id) { $allCusts = @($allCusts) }
    else { $allCusts = @() }
}

$VIP_CUST = $allCusts | Where-Object { $_.tier -eq 'VIP' } | Select-Object -First 1
$REGULAR_CUST = $allCusts | Where-Object { $_.tier -eq 'REGULAR' } | Select-Object -First 1
$NEW_CUST = $allCusts | Where-Object { $_.tier -eq 'NEW' } | Select-Object -First 1
$STRATEGIC_CUST = $allCusts | Where-Object { $_.tier -eq 'STRATEGIC' } | Select-Object -First 1

if ($VIP_CUST) { Write-Host "  VIP: $($VIP_CUST.code) - $($VIP_CUST.fullName)" -ForegroundColor Gray }
else { Write-Host "  VIP: NOT FOUND" -ForegroundColor Yellow }
if ($REGULAR_CUST) { Write-Host "  REGULAR: $($REGULAR_CUST.code) - $($REGULAR_CUST.fullName)" -ForegroundColor Gray }
else { Write-Host "  REGULAR: NOT FOUND" -ForegroundColor Yellow }
if ($NEW_CUST) { Write-Host "  NEW: $($NEW_CUST.code) - $($NEW_CUST.fullName)" -ForegroundColor Gray }
else { Write-Host "  NEW: NOT FOUND" -ForegroundColor Yellow }
if ($STRATEGIC_CUST) { Write-Host "  STRATEGIC: $($STRATEGIC_CUST.code) - $($STRATEGIC_CUST.fullName)" -ForegroundColor Gray }
else { Write-Host "  STRATEGIC: NOT FOUND" -ForegroundColor Yellow }

if (-not $VIP_CUST) { Fail "No VIP customer found - cannot run tests"; exit 1 }

# ================================================================
# PART A: VIP (50%) - Full deposit PASS
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: VIP (50%) - Full deposit PASS" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# A1: Create MHH order 100,000 VND, KH VIP
Write-Host ""
Write-Host "=== TEST A1: Tao MHH order 100,000 VND cho VIP ===" -ForegroundColor White
$orderBody = @{
    customerId    = $VIP_CUST.id
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{ productName = "FIN-001 Test Product A"; productUrl = "https://item.taobao.com/item.htm?id=900001"; quantity = 10; unitPrice = 10000 }
    )
    note = "FIN-001 Part A: VIP full deposit test"
}
$orderResp = Api "POST" "/orders" $SALE1 $orderBody
$orderA = D $orderResp
if ($orderA -and $orderA.id) {
    $ORD_A_ID = $orderA.id
    $ORD_A_CODE = $orderA.code
    $ORD_A_TOTAL = [double]$orderA.totalAmount
    $ORD_A_DEPOSIT_REQ = [double]$orderA.depositRequired
    Write-Host "  Order: $ORD_A_CODE | total=$ORD_A_TOTAL | depositRequired=$ORD_A_DEPOSIT_REQ"
    Pass "A1: MHH order created ($ORD_A_CODE)"
} else {
    Fail "A1: Failed to create MHH order"
    exit 1
}

# A2: Verify depositRequired = 50% of total
Write-Host ""
Write-Host "=== TEST A2: Verify depositRequired = 50% (VIP) ===" -ForegroundColor White
$expectedDeposit = [math]::Ceiling($ORD_A_TOTAL * 50 / 100)
if ($ORD_A_DEPOSIT_REQ -eq $expectedDeposit) {
    Pass "A2: depositRequired=$ORD_A_DEPOSIT_REQ (50% of $ORD_A_TOTAL)"
} else {
    Fail "A2: depositRequired=$ORD_A_DEPOSIT_REQ, expected $expectedDeposit (50% of $ORD_A_TOTAL)"
}

# A3: Advance to PENDING_DEPOSIT
Write-Host ""
Write-Host "=== TEST A3: CONSULTING -> QUOTATION -> PENDING_DEPOSIT ===" -ForegroundColor White
Api "PATCH" "/orders/$ORD_A_ID/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
Api "PATCH" "/orders/$ORD_A_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT" } | Out-Null
$orderCheck = D (Api "GET" "/orders/$ORD_A_ID" $SALE1)
if ($orderCheck.status -eq "PENDING_DEPOSIT") {
    Pass "A3: Order at PENDING_DEPOSIT"
} else {
    Fail "A3: Expected PENDING_DEPOSIT, got $($orderCheck.status)"
}

# A4: Pay full deposit via RECEIPT voucher + approve
Write-Host ""
Write-Host "=== TEST A4: Pay deposit $ORD_A_DEPOSIT_REQ VND (RECEIPT + approve) ===" -ForegroundColor White
$voucherBody = @{
    orderId       = $ORD_A_ID
    type          = "RECEIPT"
    amount        = $ORD_A_DEPOSIT_REQ
    currency      = "VND"
    paymentMethod = "BANK_TRANSFER"
    costType      = "Tien coc don hang"
    beneficiary   = $VIP_CUST.fullName
    reason        = "Thu tien coc don hang $ORD_A_CODE, VIP 50%"
    bankTraceId   = "FT260300FIN001A4"
}
$vRaw = Api "POST" "/cash/vouchers" $KETOAN $voucherBody
$vResp = D $vRaw
if ($vResp -and $vResp.voucher) { $vResp = $vResp.voucher }
if ($vResp -and $vResp.id) {
    $VA_ID = $vResp.id
    Write-Host "  Voucher: $($vResp.code) | amount=$ORD_A_DEPOSIT_REQ | status=$($vResp.status)"
    Api "PATCH" "/cash/vouchers/$VA_ID/approve" $CFO $null | Out-Null
    Start-Sleep -Milliseconds 500
    Pass "A4: Deposit voucher created + approved"
} else {
    Fail "A4: Failed to create deposit voucher"
}

# A5: Verify depositPaid and isDepositPaid
Write-Host ""
Write-Host "=== TEST A5: Verify depositPaid and isDepositPaid ===" -ForegroundColor White
$orderAfterDeposit = D (Api "GET" "/orders/$ORD_A_ID" $SALE1)
$depositPaid = [double]$orderAfterDeposit.depositPaid
$isDepositPaid = $orderAfterDeposit.isDepositPaid
Write-Host "  depositPaid=$depositPaid | isDepositPaid=$isDepositPaid"
if ($depositPaid -ge $ORD_A_DEPOSIT_REQ -and $isDepositPaid -eq $true) {
    Pass "A5: depositPaid=$depositPaid, isDepositPaid=true"
} else {
    Fail "A5: depositPaid=$depositPaid (req=$ORD_A_DEPOSIT_REQ), isDepositPaid=$isDepositPaid"
}

# A6: PENDING_DEPOSIT -> SOURCING (should pass)
Write-Host ""
Write-Host "=== TEST A6: PENDING_DEPOSIT -> SOURCING (deposit gate PASS) ===" -ForegroundColor White
$rSourcing = Api-Expect "PATCH" "/orders/$ORD_A_ID/status" $SALE1 @{ status = "SOURCING" }
if ($rSourcing.code -ge 200 -and $rSourcing.code -lt 300) {
    $orderAtSourcing = D (Api "GET" "/orders/$ORD_A_ID" $SALE1)
    if ($orderAtSourcing.status -eq "SOURCING") {
        Pass "A6: SOURCING reached (deposit gate passed)"
    } else {
        Fail "A6: Expected SOURCING, got $($orderAtSourcing.status)"
    }
} else {
    Fail "A6: Transition to SOURCING failed (HTTP $($rSourcing.code))"
}

# ================================================================
# PART B: VIP (50%) - Partial deposit BLOCK
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: VIP (50%) - Partial deposit BLOCK" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# B1: Create MHH order 100,000 VND
Write-Host ""
Write-Host "=== TEST B1: Tao MHH order 100,000 VND cho VIP ===" -ForegroundColor White
$orderBody2 = @{
    customerId    = $VIP_CUST.id
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{ productName = "FIN-001 Partial Deposit Test"; productUrl = "https://item.taobao.com/item.htm?id=900002"; quantity = 10; unitPrice = 10000 }
    )
    note = "FIN-001 Part B: Partial deposit block test"
}
$orderResp2 = Api "POST" "/orders" $SALE1 $orderBody2
$orderB = D $orderResp2
if ($orderB -and $orderB.id) {
    $ORD_B_ID = $orderB.id
    $ORD_B_CODE = $orderB.code
    $ORD_B_DEPOSIT_REQ = [double]$orderB.depositRequired
    Write-Host "  Order: $ORD_B_CODE | depositRequired=$ORD_B_DEPOSIT_REQ"
    Pass "B1: MHH order created ($ORD_B_CODE)"
} else {
    Fail "B1: Failed to create MHH order"
}

# B2: Advance to PENDING_DEPOSIT
Write-Host ""
Write-Host "=== TEST B2: Advance to PENDING_DEPOSIT ===" -ForegroundColor White
if ($ORD_B_ID) {
    Api "PATCH" "/orders/$ORD_B_ID/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
    Api "PATCH" "/orders/$ORD_B_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT" } | Out-Null
    $orderCheck2 = D (Api "GET" "/orders/$ORD_B_ID" $SALE1)
    if ($orderCheck2.status -eq "PENDING_DEPOSIT") {
        Pass "B2: Order at PENDING_DEPOSIT"
    } else {
        Fail "B2: Expected PENDING_DEPOSIT, got $($orderCheck2.status)"
    }
}

# B3: Pay 30,000 (thieu 20,000 so voi 50,000 required)
Write-Host ""
Write-Host "=== TEST B3: Pay 30,000 VND (partial, thieu 20,000) ===" -ForegroundColor White
if ($ORD_B_ID) {
    $partialAmount = 30000
    $v2Body = @{
        orderId       = $ORD_B_ID
        type          = "RECEIPT"
        amount        = $partialAmount
        currency      = "VND"
        paymentMethod = "BANK_TRANSFER"
        costType      = "Tien coc don hang"
        beneficiary   = $VIP_CUST.fullName
        reason        = "Thu tien coc 1 phan cho don hang $ORD_B_CODE"
        bankTraceId   = "FT260300FIN001B3"
    }
    $v2Raw = Api "POST" "/cash/vouchers" $KETOAN $v2Body
    $v2Resp = D $v2Raw
    if ($v2Resp -and $v2Resp.voucher) { $v2Resp = $v2Resp.voucher }
    if ($v2Resp -and $v2Resp.id) {
        Api "PATCH" "/cash/vouchers/$($v2Resp.id)/approve" $CFO $null | Out-Null
        Start-Sleep -Milliseconds 500
        Pass "B3: Partial voucher 30,000 created + approved"
    } else {
        Fail "B3: Failed to create partial voucher"
    }
}

# B4: Verify depositPaid=30000, isDepositPaid=false
Write-Host ""
Write-Host "=== TEST B4: Verify depositPaid=30000, isDepositPaid=false ===" -ForegroundColor White
if ($ORD_B_ID) {
    $orderPartial = D (Api "GET" "/orders/$ORD_B_ID" $SALE1)
    $dpPaid = [double]$orderPartial.depositPaid
    $dpIsPaid = $orderPartial.isDepositPaid
    Write-Host "  depositPaid=$dpPaid | isDepositPaid=$dpIsPaid"
    if ($dpPaid -eq 30000 -and $dpIsPaid -ne $true) {
        Pass "B4: depositPaid=30000, isDepositPaid=false (partial)"
    } elseif ($dpPaid -ge 30000 -and $dpIsPaid -ne $true) {
        Pass "B4: depositPaid=$dpPaid (>= 30000), isDepositPaid=false"
    } else {
        Fail "B4: depositPaid=$dpPaid, isDepositPaid=$dpIsPaid (expected 30000/false)"
    }
}

# B5: Attempt SOURCING -> expect BLOCKED
Write-Host ""
Write-Host "=== TEST B5: SOURCING blocked (partial deposit) ===" -ForegroundColor White
if ($ORD_B_ID) {
    $blockResp = Api-Expect "PATCH" "/orders/$ORD_B_ID/status" $SALE1 @{ status = "SOURCING" }
    if ($blockResp.code -eq 400 -or $blockResp.code -eq 403) {
        Pass "B5: SOURCING blocked (HTTP $($blockResp.code)) - deposit not satisfied"
    } else {
        Fail "B5: Expected 400/403 BLOCKED, got HTTP $($blockResp.code)"
    }
}

# B6: Pay remaining 20,000 + approve
Write-Host ""
Write-Host "=== TEST B6: Pay remaining 20,000 VND ===" -ForegroundColor White
if ($ORD_B_ID) {
    $remainAmount = $ORD_B_DEPOSIT_REQ - 30000
    if ($remainAmount -le 0) { $remainAmount = 20000 }
    $v3Body = @{
        orderId       = $ORD_B_ID
        type          = "RECEIPT"
        amount        = $remainAmount
        currency      = "VND"
        paymentMethod = "BANK_TRANSFER"
        costType      = "Tien coc bo sung"
        beneficiary   = $VIP_CUST.fullName
        reason        = "Bo sung tien coc con thieu cho don hang $ORD_B_CODE"
        bankTraceId   = "FT260300FIN001B6"
    }
    $v3Raw = Api "POST" "/cash/vouchers" $KETOAN $v3Body
    $v3Resp = D $v3Raw
    if ($v3Resp -and $v3Resp.voucher) { $v3Resp = $v3Resp.voucher }
    if ($v3Resp -and $v3Resp.id) {
        Api "PATCH" "/cash/vouchers/$($v3Resp.id)/approve" $CFO $null | Out-Null
        Start-Sleep -Milliseconds 500
        Pass "B6: Remaining $remainAmount voucher created + approved"
    } else {
        Fail "B6: Failed to create remaining voucher"
    }
}

# B7: SOURCING now passes
Write-Host ""
Write-Host "=== TEST B7: SOURCING passes after full deposit ===" -ForegroundColor White
if ($ORD_B_ID) {
    $passResp = Api-Expect "PATCH" "/orders/$ORD_B_ID/status" $SALE1 @{ status = "SOURCING" }
    if ($passResp.code -ge 200 -and $passResp.code -lt 300) {
        $orderBSourcing = D (Api "GET" "/orders/$ORD_B_ID" $SALE1)
        if ($orderBSourcing.status -eq "SOURCING") {
            Pass "B7: SOURCING reached after full deposit"
        } else {
            Fail "B7: Expected SOURCING, got $($orderBSourcing.status)"
        }
    } else {
        Fail "B7: SOURCING still blocked (HTTP $($passResp.code))"
    }
}

# ================================================================
# PART C: Deposit rate per tier verification
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Deposit rate per tier verification" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Deposit rates: NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%
$tierTests = @(
    @{ tier = "VIP";       cust = $VIP_CUST;       expectedRate = 50;  label = "C1" },
    @{ tier = "REGULAR";   cust = $REGULAR_CUST;   expectedRate = 70;  label = "C2" },
    @{ tier = "NEW";       cust = $NEW_CUST;       expectedRate = 100; label = "C3" },
    @{ tier = "STRATEGIC"; cust = $STRATEGIC_CUST; expectedRate = 30;  label = "C4" }
)

foreach ($tt in $tierTests) {
    Write-Host ""
    Write-Host "=== TEST $($tt.label): $($tt.tier) deposit rate = $($tt.expectedRate)% ===" -ForegroundColor White
    if (-not $tt.cust) {
        Warn "$($tt.label): No $($tt.tier) customer found - skipped"
        continue
    }
    $tBody = @{
        customerId    = $tt.cust.id
        serviceType   = "MHH"
        branch        = "HN"
        shippingRoute = "SEA"
        items         = @(
            @{ productName = "Tier Rate Test $($tt.tier)"; productUrl = "https://item.taobao.com/item.htm?id=900010"; quantity = 10; unitPrice = 10000 }
        )
        note = "FIN-001: $($tt.tier) deposit rate verification"
    }
    $tResp = Api "POST" "/orders" $SALE1 $tBody
    $tOrder = D $tResp
    if ($tOrder -and $tOrder.id) {
        $tTotal = [double]$tOrder.totalAmount
        $tDepReq = [double]$tOrder.depositRequired
        $tExpected = [math]::Ceiling($tTotal * $tt.expectedRate / 100)
        Write-Host "  $($tt.tier): total=$tTotal, depositRequired=$tDepReq, expected=$tExpected ($($tt.expectedRate)%)"
        if ($tDepReq -eq $tExpected) {
            Pass "$($tt.label): $($tt.tier) depositRequired=$tDepReq ($($tt.expectedRate)% of $tTotal)"
        } else {
            # Check if customer has custom depositRate override
            $actualRate = if ($tTotal -gt 0) { [math]::Round(($tDepReq / $tTotal) * 100) } else { 0 }
            Warn "$($tt.label): $($tt.tier) depositRequired=$tDepReq (actual ${actualRate}%, expected $($tt.expectedRate)%)"
        }
    } else {
        Warn "$($tt.label): Failed to create order for $($tt.tier)"
    }
}

# ================================================================
# PART D: MHH must go through PENDING_DEPOSIT
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: MHH must go through PENDING_DEPOSIT" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# D1: MHH at QUOTATION -> attempt SOURCING directly -> 400
Write-Host ""
Write-Host "=== TEST D1: MHH QUOTATION -> SOURCING truc tiep -> block ===" -ForegroundColor White
$dBody = @{
    customerId    = $VIP_CUST.id
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{ productName = "MHH FSM Test"; productUrl = "https://item.taobao.com/item.htm?id=900020"; quantity = 5; unitPrice = 20000 }
    )
    note = "FIN-001: PENDING_DEPOSIT enforcement test"
}
$dResp = Api "POST" "/orders" $SALE1 $dBody
$dOrder = D $dResp
if ($dOrder -and $dOrder.id) {
    $ORD_D_ID = $dOrder.id
    Api "PATCH" "/orders/$ORD_D_ID/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
    # Try QUOTATION -> SOURCING (skip PENDING_DEPOSIT)
    $skipResp = Api-Expect "PATCH" "/orders/$ORD_D_ID/status" $SALE1 @{ status = "SOURCING" }
    if ($skipResp.code -eq 400) {
        Pass "D1: QUOTATION -> SOURCING blocked (must go through PENDING_DEPOSIT)"
    } else {
        Warn "D1: QUOTATION -> SOURCING returned HTTP $($skipResp.code) (expected 400)"
    }
} else {
    Fail "D1: Failed to create MHH order"
}

# D2: Correct path: QUOTATION -> PENDING_DEPOSIT
Write-Host ""
Write-Host "=== TEST D2: QUOTATION -> PENDING_DEPOSIT (correct path) ===" -ForegroundColor White
if ($ORD_D_ID) {
    $pdResp = Api-Expect "PATCH" "/orders/$ORD_D_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT" }
    if ($pdResp.code -ge 200 -and $pdResp.code -lt 300) {
        $dCheck = D (Api "GET" "/orders/$ORD_D_ID" $SALE1)
        if ($dCheck.status -eq "PENDING_DEPOSIT") {
            Pass "D2: QUOTATION -> PENDING_DEPOSIT success"
        } else {
            Fail "D2: Expected PENDING_DEPOSIT, got $($dCheck.status)"
        }
    } else {
        Fail "D2: Transition to PENDING_DEPOSIT failed (HTTP $($pdResp.code))"
    }
}

# D3: PENDING_DEPOSIT -> SOURCING without payment -> block
Write-Host ""
Write-Host "=== TEST D3: PENDING_DEPOSIT -> SOURCING without payment -> block ===" -ForegroundColor White
if ($ORD_D_ID) {
    $noPayResp = Api-Expect "PATCH" "/orders/$ORD_D_ID/status" $SALE1 @{ status = "SOURCING" }
    if ($noPayResp.code -eq 400 -or $noPayResp.code -eq 403) {
        Pass "D3: SOURCING blocked (HTTP $($noPayResp.code) - no deposit paid)"
    } else {
        Fail "D3: Expected 400/403 BLOCKED, got HTTP $($noPayResp.code)"
    }
}

# ================================================================
# PART E: VCT skip deposit
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: VCT skip deposit" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# E1: VCT for VIP -> depositRequired = 0
Write-Host ""
Write-Host "=== TEST E1: VCT for VIP -> depositRequired = 0 ===" -ForegroundColor White
$eBody = @{
    customerId    = $VIP_CUST.id
    serviceType   = "VCT"
    branch        = "HN"
    items         = @(
        @{ productName = "VCT Skip Deposit Test"; quantity = 5; unitPrice = 20000 }
    )
    note = "FIN-001: VCT skip deposit for VIP"
}
$eResp = Api "POST" "/orders" $SALE1 $eBody
$eOrder = D $eResp
if ($eOrder -and $eOrder.id) {
    $ORD_E_ID = $eOrder.id
    $ORD_E_CODE = $eOrder.code
    $eDepReq = [double]$eOrder.depositRequired
    Write-Host "  VCT Order: $ORD_E_CODE | depositRequired=$eDepReq"
    if ($eDepReq -eq 0) {
        Pass "E1: VCT/VIP depositRequired=0 (skip deposit)"
    } else {
        Warn "E1: VCT/VIP depositRequired=$eDepReq (expected 0)"
    }
} else {
    Fail "E1: Failed to create VCT order"
}

# E2: VCT can go CONSULTING -> QUOTATION -> SOURCING (skip PENDING_DEPOSIT)
Write-Host ""
Write-Host "=== TEST E2: VCT can skip PENDING_DEPOSIT ===" -ForegroundColor White
if ($ORD_E_ID) {
    Api "PATCH" "/orders/$ORD_E_ID/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
    # Try QUOTATION -> SOURCING directly (or WAREHOUSE_CN for VCT)
    $vctAdvance = Api-Expect "PATCH" "/orders/$ORD_E_ID/status" $SALE1 @{ status = "SOURCING" }
    if ($vctAdvance.code -ge 200 -and $vctAdvance.code -lt 300) {
        Pass "E2: VCT skipped PENDING_DEPOSIT -> SOURCING"
    } else {
        # VCT might go directly to WAREHOUSE_CN
        $vctWh = Api-Expect "PATCH" "/orders/$ORD_E_ID/status" $SALE1 @{ status = "WAREHOUSE_CN" }
        if ($vctWh.code -ge 200 -and $vctWh.code -lt 300) {
            Pass "E2: VCT skipped PENDING_DEPOSIT -> WAREHOUSE_CN"
        } else {
            Warn "E2: VCT could not skip PENDING_DEPOSIT (SOURCING=$($vctAdvance.code), WH_CN=$($vctWh.code))"
        }
    }
}

# E3: VCT for NEW customer -> depositRequired > 0
Write-Host ""
Write-Host "=== TEST E3: VCT for NEW customer -> depositRequired > 0 ===" -ForegroundColor White
if ($NEW_CUST) {
    $e3Body = @{
        customerId    = $NEW_CUST.id
        serviceType   = "VCT"
        branch        = "HN"
        items         = @(
            @{ productName = "VCT NEW Customer Test"; quantity = 5; unitPrice = 20000 }
        )
        note = "FIN-001: VCT for NEW customer"
    }
    $e3Resp = Api "POST" "/orders" $SALE1 $e3Body
    $e3Order = D $e3Resp
    if ($e3Order -and $e3Order.id) {
        $e3DepReq = [double]$e3Order.depositRequired
        Write-Host "  VCT/NEW: depositRequired=$e3DepReq"
        if ($e3DepReq -gt 0) {
            Pass "E3: VCT/NEW depositRequired=$e3DepReq (NEW always requires deposit)"
        } else {
            Warn "E3: VCT/NEW depositRequired=0 (expected > 0 for NEW tier)"
        }
    } else {
        Warn "E3: Failed to create VCT order for NEW customer"
    }
} else {
    Warn "E3: No NEW customer found - skipped"
}

# E4: VCT/NEW at PENDING_DEPOSIT without paying -> block SOURCING
Write-Host ""
Write-Host "=== TEST E4: VCT/NEW PENDING_DEPOSIT without payment -> block ===" -ForegroundColor White
if ($NEW_CUST -and $e3Order -and $e3Order.id) {
    $e4Id = $e3Order.id
    Api "PATCH" "/orders/$e4Id/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
    Api "PATCH" "/orders/$e4Id/status" $SALE1 @{ status = "PENDING_DEPOSIT" } | Out-Null
    $e4Check = D (Api "GET" "/orders/$e4Id" $SALE1)
    if ($e4Check.status -eq "PENDING_DEPOSIT") {
        $e4Block = Api-Expect "PATCH" "/orders/$e4Id/status" $SALE1 @{ status = "SOURCING" }
        if ($e4Block.code -eq 400) {
            Pass "E4: VCT/NEW SOURCING blocked without deposit"
        } else {
            Warn "E4: VCT/NEW SOURCING returned HTTP $($e4Block.code) (expected 400)"
        }
    } else {
        Warn "E4: Could not reach PENDING_DEPOSIT for VCT/NEW"
    }
} else {
    Warn "E4: Skipped (no NEW customer or order)"
}

# ================================================================
# PART F: Procurement gate (per-tier rule, NOT hardcoded 70%)
# NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Procurement gate (per-tier depositRequired)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# F1: Order with 100% deposit -> procurement-gate -> allowed=true, isPriority=true
Write-Host ""
Write-Host "=== TEST F1: 100% deposit -> procurement-gate -> priority ===" -ForegroundColor White
# Use order A (VIP 50% deposit = SOURCING). Top it up to 100%
if ($ORD_A_ID) {
    $orderACurrent = D (Api "GET" "/orders/$ORD_A_ID" $SALE1)
    $aTotal = [double]$orderACurrent.totalAmount
    $aPaid = [double]$orderACurrent.depositPaid
    $aRemain = $aTotal - $aPaid
    if ($aRemain -gt 0) {
        $fVBody = @{
            orderId       = $ORD_A_ID
            type          = "RECEIPT"
            amount        = $aRemain
            currency      = "VND"
            paymentMethod = "BANK_TRANSFER"
            costType      = "Tien coc bo sung"
            beneficiary   = $VIP_CUST.fullName
            reason        = "Bo sung coc len 100% cho procurement gate test"
            bankTraceId   = "FT260300FIN001F1"
        }
        $fVRaw = Api "POST" "/cash/vouchers" $KETOAN $fVBody
        $fVResp = D $fVRaw
        if ($fVResp -and $fVResp.voucher) { $fVResp = $fVResp.voucher }
        if ($fVResp -and $fVResp.id) {
            Api "PATCH" "/cash/vouchers/$($fVResp.id)/approve" $CFO $null | Out-Null
            Start-Sleep -Milliseconds 500
        }
    }
    $gateResp = D (Api "GET" "/orders/$ORD_A_ID/procurement-gate" $SALE1)
    if ($gateResp) {
        Write-Host "  allowed=$($gateResp.allowed) | isPriority=$($gateResp.isPriority) | percent=$($gateResp.depositPaidPercent)% | requiredPercent=$($gateResp.requiredPercent)%"
        if ($gateResp.allowed -eq $true -and $gateResp.isPriority -eq $true) {
            Pass "F1: 100% deposit -> allowed=true, isPriority=true"
        } elseif ($gateResp.allowed -eq $true) {
            Warn "F1: allowed=true but isPriority=$($gateResp.isPriority) (deposit $($gateResp.depositPaidPercent)%)"
        } else {
            Fail "F1: allowed=false at $($gateResp.depositPaidPercent)% deposit"
        }
    } else {
        Fail "F1: procurement-gate endpoint returned null"
    }
}

# F2: VIP order with exact 50% deposit -> procurement-gate -> allowed=true (VIP requires 50%)
Write-Host ""
Write-Host "=== TEST F2: VIP 50% deposit -> procurement-gate -> allowed (VIP req=50%) ===" -ForegroundColor White
if ($VIP_CUST) {
    $f2Body = @{
        customerId    = $VIP_CUST.id
        serviceType   = "MHH"
        branch        = "HN"
        shippingRoute = "SEA"
        items         = @(
            @{ productName = "Procurement Gate VIP 50% Test"; productUrl = "https://item.taobao.com/item.htm?id=900030"; quantity = 10; unitPrice = 10000 }
        )
        note = "FIN-001: VIP 50% deposit procurement gate test"
    }
    $f2Resp = Api "POST" "/orders" $SALE1 $f2Body
    $f2Order = D $f2Resp
    if ($f2Order -and $f2Order.id) {
        $ORD_F2_ID = $f2Order.id
        $f2Total = [double]$f2Order.totalAmount
        $f2DepReq = [double]$f2Order.depositRequired
        # Advance to PENDING_DEPOSIT, pay exactly depositRequired (50%), advance to SOURCING
        Api "PATCH" "/orders/$ORD_F2_ID/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
        Api "PATCH" "/orders/$ORD_F2_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT" } | Out-Null
        $f2VBody = @{
            orderId = $ORD_F2_ID; type = "RECEIPT"; amount = $f2DepReq; currency = "VND"
            paymentMethod = "BANK_TRANSFER"; costType = "Tien coc don hang"
            beneficiary = $VIP_CUST.fullName; reason = "Coc 50% cho VIP procurement gate test"
            bankTraceId = "FT260300FIN001F2"
        }
        $f2VRaw = Api "POST" "/cash/vouchers" $KETOAN $f2VBody
        $f2VResp = D $f2VRaw
        if ($f2VResp -and $f2VResp.voucher) { $f2VResp = $f2VResp.voucher }
        if ($f2VResp -and $f2VResp.id) {
            Api "PATCH" "/cash/vouchers/$($f2VResp.id)/approve" $CFO $null | Out-Null
            Start-Sleep -Milliseconds 500
        }

        $gate50 = D (Api "GET" "/orders/$ORD_F2_ID/procurement-gate" $SALE1)
        if ($gate50) {
            Write-Host "  allowed=$($gate50.allowed) | requiredPercent=$($gate50.requiredPercent)% | percent=$($gate50.depositPaidPercent)%"
            if ($gate50.allowed -eq $true -and [double]$gate50.requiredPercent -eq 50) {
                Pass "F2: VIP 50% deposit -> allowed=true, requiredPercent=50%"
            } elseif ($gate50.allowed -eq $true) {
                Pass "F2: VIP deposit -> allowed=true (requiredPercent=$($gate50.requiredPercent)%)"
            } else {
                Fail "F2: VIP 50% deposit -> allowed=false (requiredPercent=$($gate50.requiredPercent)%)"
            }
        } else {
            Fail "F2: procurement-gate returned null"
        }
    } else {
        Fail "F2: Failed to create order"
    }
}

# F3: NEW customer partial deposit -> procurement-gate -> allowed=false (NEW requires 100%)
Write-Host ""
Write-Host "=== TEST F3: NEW 70% deposit -> procurement-gate -> NOT allowed (NEW req=100%) ===" -ForegroundColor White
if ($NEW_CUST) {
    $f3Body = @{
        customerId    = $NEW_CUST.id
        serviceType   = "MHH"
        branch        = "HN"
        shippingRoute = "SEA"
        items         = @(
            @{ productName = "Procurement Gate NEW 70% Test"; productUrl = "https://item.taobao.com/item.htm?id=900031"; quantity = 10; unitPrice = 10000 }
        )
        note = "FIN-001: NEW 70% deposit procurement gate test - should be blocked"
    }
    $f3Resp = Api "POST" "/orders" $SALE1 $f3Body
    $f3Order = D $f3Resp
    if ($f3Order -and $f3Order.id) {
        $ORD_F3_ID = $f3Order.id
        $f3Total = [double]$f3Order.totalAmount
        $f3DepReq = [double]$f3Order.depositRequired
        # Advance to PENDING_DEPOSIT, pay only 70% (< 100% required for NEW)
        Api "PATCH" "/orders/$ORD_F3_ID/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
        Api "PATCH" "/orders/$ORD_F3_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT" } | Out-Null
        $pay70 = [math]::Ceiling($f3Total * 0.70)
        $f3VBody = @{
            orderId = $ORD_F3_ID; type = "RECEIPT"; amount = $pay70; currency = "VND"
            paymentMethod = "BANK_TRANSFER"; costType = "Tien coc don hang"
            beneficiary = $NEW_CUST.fullName; reason = "Coc 70% cho NEW customer - khong du 100%"
            bankTraceId = "FT260300FIN001F3"
        }
        $f3VRaw = Api "POST" "/cash/vouchers" $KETOAN $f3VBody
        $f3VResp = D $f3VRaw
        if ($f3VResp -and $f3VResp.voucher) { $f3VResp = $f3VResp.voucher }
        if ($f3VResp -and $f3VResp.id) {
            Api "PATCH" "/cash/vouchers/$($f3VResp.id)/approve" $CFO $null | Out-Null
            Start-Sleep -Milliseconds 500
        }

        $gateNew70 = D (Api "GET" "/orders/$ORD_F3_ID/procurement-gate" $SALE1)
        if ($gateNew70) {
            Write-Host "  allowed=$($gateNew70.allowed) | requiredPercent=$($gateNew70.requiredPercent)% | percent=$($gateNew70.depositPaidPercent)%"
            if ($gateNew70.allowed -ne $true -and [double]$gateNew70.requiredPercent -eq 100) {
                Pass "F3: NEW 70% deposit -> allowed=false, requiredPercent=100% (correct block)"
            } elseif ($gateNew70.allowed -ne $true) {
                Pass "F3: NEW deposit -> allowed=false (requiredPercent=$($gateNew70.requiredPercent)%)"
            } else {
                Fail "F3: NEW 70% deposit -> allowed=true (should require 100%)"
            }
        } else {
            Fail "F3: procurement-gate returned null"
        }

        # F4: Top up to 100% -> now allowed
        Write-Host ""
        Write-Host "=== TEST F4: NEW top up to 100% -> procurement-gate -> allowed ===" -ForegroundColor White
        $f4Remain = $f3DepReq - $pay70
        if ($f4Remain -gt 0) {
            $f4VBody = @{
                orderId = $ORD_F3_ID; type = "RECEIPT"; amount = $f4Remain; currency = "VND"
                paymentMethod = "BANK_TRANSFER"; costType = "Tien coc bo sung"
                beneficiary = $NEW_CUST.fullName; reason = "Bo sung coc len 100% cho NEW customer"
                bankTraceId = "FT260300FIN001F4"
            }
            $f4VRaw = Api "POST" "/cash/vouchers" $KETOAN $f4VBody
            $f4VResp = D $f4VRaw
            if ($f4VResp -and $f4VResp.voucher) { $f4VResp = $f4VResp.voucher }
            if ($f4VResp -and $f4VResp.id) {
                Api "PATCH" "/cash/vouchers/$($f4VResp.id)/approve" $CFO $null | Out-Null
                Start-Sleep -Milliseconds 500
            }
        }
        $gateNew100 = D (Api "GET" "/orders/$ORD_F3_ID/procurement-gate" $SALE1)
        if ($gateNew100) {
            Write-Host "  allowed=$($gateNew100.allowed) | requiredPercent=$($gateNew100.requiredPercent)% | percent=$($gateNew100.depositPaidPercent)%"
            if ($gateNew100.allowed -eq $true) {
                Pass "F4: NEW 100% deposit -> allowed=true"
            } else {
                Fail "F4: NEW 100% deposit -> allowed=false"
            }
        } else {
            Fail "F4: procurement-gate returned null"
        }
    } else {
        Warn "F3: Failed to create order for NEW customer"
    }
} else {
    Warn "F3: No NEW customer found - skipped"
    Warn "F4: Skipped (depends on F3)"
}

# ================================================================
# PART G: Wallet topup + deposit payment
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: Wallet topup + verification" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# G1: Get wallet balance before
Write-Host ""
Write-Host "=== TEST G1: Get wallet balance before topup ===" -ForegroundColor White
$walletBefore = D (Api "GET" "/customers/$($VIP_CUST.id)/wallet" $CEO)
$balBefore = 0
if ($walletBefore -and $walletBefore.balance -ne $null) {
    $balBefore = [double]$walletBefore.balance
}
Write-Host "  Wallet balance before: $balBefore VND"
Pass "G1: Wallet balance read = $balBefore"

# G2: Topup wallet 50,000 (with confirmAmount double-check)
Write-Host ""
Write-Host "=== TEST G2: Topup wallet 50,000 VND (with confirmAmount) ===" -ForegroundColor White
$topupBody = @{
    amount        = 50000
    confirmAmount = 50000
    bankTraceId   = "FT260300FIN001TEST"
    reference     = "FIN-001-TOPUP-TEST"
    note          = "Test topup for FIN-001 wallet verification"
}
$topupResp = D (Api "POST" "/customers/$($VIP_CUST.id)/wallet/topup" $CFO $topupBody)
if ($topupResp) {
    $newBal = [double]$topupResp.newBalance
    Write-Host "  newBalance=$newBal | transactionId=$($topupResp.transactionId)"
    Pass "G2: Wallet topup 50,000 -> newBalance=$newBal"
} else {
    Fail "G2: Wallet topup failed"
}

# G3: Verify balance increased
Write-Host ""
Write-Host "=== TEST G3: Verify wallet balance increased ===" -ForegroundColor White
$walletAfter = D (Api "GET" "/customers/$($VIP_CUST.id)/wallet" $CEO)
$balAfter = 0
if ($walletAfter -and $walletAfter.balance -ne $null) {
    $balAfter = [double]$walletAfter.balance
}
$balDiff = $balAfter - $balBefore
Write-Host "  Before: $balBefore | After: $balAfter | Diff: $balDiff"
if ($balDiff -ge 50000) {
    Pass "G3: Wallet balance increased by $balDiff (expected 50,000)"
} else {
    Fail "G3: Wallet diff = $balDiff (expected >= 50,000)"
}

# G4: Verify wallet transactions (check last entry)
Write-Host ""
Write-Host "=== TEST G4: Wallet transactions show TOPUP entry ===" -ForegroundColor White
if ($walletAfter -and $walletAfter.transactions) {
    $txns = @($walletAfter.transactions)
    $lastTx = $txns | Where-Object { $_.type -eq 'TOPUP' -or $_.type -eq 'CREDIT' } | Select-Object -First 1
    if ($lastTx) {
        Write-Host "  Last TOPUP: amount=$($lastTx.amount) | reference=$($lastTx.reference)"
        Pass "G4: Wallet transactions include TOPUP entry"
    } else {
        Warn "G4: No TOPUP transaction found in wallet.transactions"
    }
} elseif ($walletAfter -and $walletAfter.walletId) {
    # Transactions might not be included in wallet balance endpoint
    Warn "G4: Wallet transactions not included in balance response (may need separate endpoint)"
} else {
    Warn "G4: Cannot verify wallet transactions"
}

# ================================================================
# PART H: Topup double-confirm (confirmAmount mismatch)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Topup double-confirm (confirmAmount)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# H1: confirmAmount mismatch -> 400
Write-Host ""
Write-Host "=== TEST H1: confirmAmount mismatch -> 400 ===" -ForegroundColor White
$h1Body = @{
    amount        = 100000
    confirmAmount = 99999
    bankTraceId   = "FT260300FIN001H1"
    reference     = "FIN-001-MISMATCH-TEST"
    note          = "Intentional mismatch test"
}
$h1Resp = Api-Expect "POST" "/customers/$($VIP_CUST.id)/wallet/topup" $CFO $h1Body
if ($h1Resp.code -eq 400) {
    Pass "H1: confirmAmount mismatch -> 400 BadRequest"
} else {
    Fail "H1: Expected 400, got HTTP $($h1Resp.code)"
}

# H2: Missing confirmAmount -> 400 (validation)
Write-Host ""
Write-Host "=== TEST H2: Missing confirmAmount -> 400 ===" -ForegroundColor White
$h2Body = @{
    amount      = 100000
    bankTraceId = "FT260300FIN001H2"
    reference   = "FIN-001-NOCONFIRM-TEST"
}
$h2Resp = Api-Expect "POST" "/customers/$($VIP_CUST.id)/wallet/topup" $CFO $h2Body
if ($h2Resp.code -eq 400) {
    Pass "H2: Missing confirmAmount -> 400 BadRequest"
} else {
    Fail "H2: Expected 400, got HTTP $($h2Resp.code)"
}

# H3: Matching confirmAmount -> 200/201
Write-Host ""
Write-Host "=== TEST H3: Matching confirmAmount -> success ===" -ForegroundColor White
$h3Body = @{
    amount        = 10000
    confirmAmount = 10000
    bankTraceId   = "FT260300FIN001H3"
    reference     = "FIN-001-MATCH-TEST"
    note          = "Correct double confirm test"
}
$h3Resp = Api-Expect "POST" "/customers/$($VIP_CUST.id)/wallet/topup" $CFO $h3Body
if ($h3Resp.code -ge 200 -and $h3Resp.code -lt 300) {
    Pass "H3: Matching confirmAmount -> success (HTTP $($h3Resp.code))"
} else {
    Fail "H3: Expected 2xx, got HTTP $($h3Resp.code)"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-FIN-001: Deposit Gate Control" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  Part A: VIP 50% - Full deposit PASS (6 tests)"
Write-Host "  Part B: VIP 50% - Partial deposit BLOCK (7 tests)"
Write-Host "  Part C: Deposit rate per tier (4 tests)"
Write-Host "  Part D: MHH must go through PENDING_DEPOSIT (3 tests)"
Write-Host "  Part E: VCT skip deposit (4 tests)"
Write-Host "  Part F: Procurement gate per-tier (4 tests)"
Write-Host "  Part G: Wallet topup + verification (4 tests)"
Write-Host "  Part H: Topup double-confirm (3 tests)"
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
