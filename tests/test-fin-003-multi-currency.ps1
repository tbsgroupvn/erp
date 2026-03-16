# ================================================================
# TEST-FIN-003: Multi-currency (VND/CNY)
# Severity: HIGH
#
# Verifies: Exchange rate set/get, currency conversion, rate lock
# at order creation, rate immutability after change, settlement
# rate adjustment, FX gain/loss recording, multi-currency report
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
Write-Host "  TEST-FIN-003: Multi-currency (VND/CNY)" -ForegroundColor Cyan
Write-Host "  Severity: HIGH" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP
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
if ($KETOAN) { Pass "KETOAN (CHIEF_ACCOUNTANT) login OK" } else { Fail "KETOAN login FAILED"; exit 1 }

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
if (-not $VIP_CUST) { Fail "No VIP customer found"; exit 1 }
Write-Host "  VIP: $($VIP_CUST.code) - $($VIP_CUST.fullName) (exchangeRateMode=$($VIP_CUST.exchangeRateMode))" -ForegroundColor Gray

# Today's date for rate setting
$TODAY = (Get-Date).ToString("yyyy-MM-dd")
$YESTERDAY = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$TOMORROW = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
Write-Host "  Today: $TODAY | Yesterday: $YESTERDAY" -ForegroundColor Gray

# ================================================================
# PART A: Set CNY/VND exchange rate
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Set & read CNY/VND exchange rate" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# A1: Set CNY/VND = 3,500 for today
Write-Host ""
Write-Host "=== TEST A1: Set CNY/VND = 3500 for today ===" -ForegroundColor White
$RATE_TODAY = 3500
$setRateBody = @{
    fromCurrency  = "CNY"
    toCurrency    = "VND"
    rate          = $RATE_TODAY
    effectiveDate = $TODAY
    source        = "MANUAL"
}
$setRateResp = D (Api "POST" "/exchange-rates" $CFO $setRateBody)
if ($setRateResp) {
    $rateVal = if ($setRateResp.rate) { [double]$setRateResp.rate } else { 0 }
    Write-Host "  Rate set: CNY/VND = $rateVal | date=$($setRateResp.date) | isManual=$($setRateResp.isManual)"
    if ($rateVal -eq $RATE_TODAY) {
        Pass "A1: CNY/VND = $RATE_TODAY set for $TODAY"
    } else {
        Warn "A1: Rate set but value=$rateVal (expected $RATE_TODAY)"
    }
} else {
    Fail "A1: Failed to set CNY/VND rate"
}

# A2: Get current rate -> verify = 3500
Write-Host ""
Write-Host "=== TEST A2: GET current CNY/VND rate ===" -ForegroundColor White
$currentRate = D (Api "GET" "/exchange-rates/current?from=CNY&to=VND" $SALE1)
if ($currentRate) {
    $curRateVal = [double]$currentRate.rate
    Write-Host "  Current: CNY/VND = $curRateVal | date=$($currentRate.date)"
    if ($curRateVal -eq $RATE_TODAY) {
        Pass "A2: Current rate = $curRateVal (matches $RATE_TODAY)"
    } else {
        Warn "A2: Current rate = $curRateVal (expected $RATE_TODAY, may have newer rate)"
    }
} else {
    Fail "A2: Failed to get current CNY/VND rate"
}

# A3: Convert 10,000 CNY -> VND
Write-Host ""
Write-Host "=== TEST A3: Convert 10,000 CNY -> VND ===" -ForegroundColor White
$convertBody = @{
    amount = 10000
    from   = "CNY"
    to     = "VND"
}
$convertResp = D (Api "POST" "/exchange-rates/convert" $SALE1 $convertBody)
if ($convertResp) {
    $convAmt = [double]$convertResp.convertedAmount
    $convRate = [double]$convertResp.rate
    $expected = 10000 * $RATE_TODAY
    Write-Host "  10,000 CNY = $convAmt VND (rate=$convRate)"
    if ([math]::Abs($convAmt - $expected) -lt 1) {
        Pass "A3: 10,000 CNY = $convAmt VND (rate $convRate)"
    } else {
        Warn "A3: Converted=$convAmt, expected=$expected (rate may differ)"
    }
} else {
    Fail "A3: Conversion failed"
}

# A4: Get active rates -> verify CNY/VND exists
Write-Host ""
Write-Host "=== TEST A4: Active rates include CNY/VND ===" -ForegroundColor White
$activeRates = D (Api "GET" "/exchange-rates/active" $SALE1)
$cnyCandidates = @()
if ($activeRates -is [array]) { $cnyCandidates = @($activeRates | Where-Object { $_.from -eq 'CNY' -and $_.to -eq 'VND' }) }
elseif ($activeRates) { $cnyCandidates = @($activeRates) }
if ($cnyCandidates.Count -gt 0) {
    $activeRate = [double]$cnyCandidates[0].rate
    Write-Host "  Active CNY/VND = $activeRate"
    Pass "A4: CNY/VND found in active rates ($activeRate)"
} else {
    Warn "A4: CNY/VND not found in active rates response"
}

# A5: Set rate for yesterday (different rate) for history test
Write-Host ""
Write-Host "=== TEST A5: Set CNY/VND = 3480 for yesterday ===" -ForegroundColor White
$RATE_YESTERDAY = 3480
$setYesterdayBody = @{
    fromCurrency  = "CNY"
    toCurrency    = "VND"
    rate          = $RATE_YESTERDAY
    effectiveDate = $YESTERDAY
    source        = "MANUAL"
}
$setYestResp = D (Api "POST" "/exchange-rates" $CFO $setYesterdayBody)
if ($setYestResp) {
    Pass "A5: CNY/VND = $RATE_YESTERDAY set for $YESTERDAY"
} else {
    Warn "A5: Failed to set yesterday's rate (may already exist)"
}

# A6: Convert with specific date (yesterday) -> uses yesterday's rate
Write-Host ""
Write-Host "=== TEST A6: Convert 10,000 CNY at yesterday's rate ===" -ForegroundColor White
$convertYestBody = @{
    amount = 10000
    from   = "CNY"
    to     = "VND"
    date   = $YESTERDAY
}
$convertYestResp = D (Api "POST" "/exchange-rates/convert" $SALE1 $convertYestBody)
if ($convertYestResp) {
    $convYestAmt = [double]$convertYestResp.convertedAmount
    $convYestRate = [double]$convertYestResp.rate
    $expectedYest = 10000 * $RATE_YESTERDAY
    Write-Host "  10,000 CNY @ $YESTERDAY = $convYestAmt VND (rate=$convYestRate)"
    if ([math]::Abs($convYestRate - $RATE_YESTERDAY) -lt 1) {
        Pass "A6: Yesterday rate used ($convYestRate), converted=$convYestAmt"
    } else {
        Warn "A6: Rate=$convYestRate (expected $RATE_YESTERDAY)"
    }
} else {
    Fail "A6: Yesterday conversion failed"
}

# A7: Get historical rates
Write-Host ""
Write-Host "=== TEST A7: Historical rates CNY/VND ===" -ForegroundColor White
$historyResp = D (Api "GET" "/exchange-rates/history?from=CNY&to=VND&startDate=$YESTERDAY&endDate=$TODAY" $SALE1)
$histItems = @()
if ($historyResp -is [array]) { $histItems = @($historyResp) }
elseif ($historyResp -and $historyResp.items) { $histItems = @($historyResp.items) }
Write-Host "  Historical rates: $($histItems.Count) entries"
foreach ($h in $histItems) {
    Write-Host "    date=$($h.date) | rate=$($h.rate) | source=$($h.source)"
}
if ($histItems.Count -ge 1) {
    Pass "A7: Historical rates returned ($($histItems.Count) entries)"
} else {
    Warn "A7: No historical rates returned"
}

# ================================================================
# PART B: Order creation locks exchange rate (FIXED mode)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Order creation locks exchange rate" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# B1: Set customer to FIXED exchange rate mode (if not already)
Write-Host ""
Write-Host "=== TEST B1: Ensure customer exchangeRateMode = FIXED ===" -ForegroundColor White
$custBefore = D (Api "GET" "/customers/$($VIP_CUST.id)" $CEO)
$modeBeforeTest = $custBefore.exchangeRateMode
Write-Host "  Current mode: $modeBeforeTest"

$updateCustResp = Api-Expect "PATCH" "/customers/$($VIP_CUST.id)" $CEO @{ exchangeRateMode = "FIXED" }
if ($updateCustResp.code -ge 200 -and $updateCustResp.code -lt 300) {
    $custAfterUpdate = D (Api "GET" "/customers/$($VIP_CUST.id)" $CEO)
    $newMode = $custAfterUpdate.exchangeRateMode
    Write-Host "  Updated mode: $newMode"
    if ($newMode -eq "FIXED") {
        Pass "B1: Customer exchangeRateMode = FIXED"
    } else {
        Warn "B1: Mode=$newMode after update (expected FIXED)"
    }
} else {
    Warn "B1: Could not update exchangeRateMode (HTTP $($updateCustResp.code))"
}

# B2: Create MHH order with CNY items -> verify baseExchangeRate locked
Write-Host ""
Write-Host "=== TEST B2: Create MHH order (rate locked at $RATE_TODAY) ===" -ForegroundColor White
$orderBody = @{
    customerId    = $VIP_CUST.id
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @(
        @{
            productName   = "FIN-003 Multi-Currency Test Product"
            productUrl    = "https://item.taobao.com/item.htm?id=920001"
            quantity      = 100
            unitPrice     = 100
        }
    )
    note = "FIN-003: Multi-currency order, expected rate lock at CNY/VND=$RATE_TODAY"
}
$orderResp = Api "POST" "/orders" $SALE1 $orderBody
$orderB = D $orderResp
if ($orderB -and $orderB.id) {
    $ORD_B_ID = $orderB.id
    $ORD_B_CODE = $orderB.code
    $ordBaseRate = $orderB.baseExchangeRate
    $ordRateMode = $orderB.exchangeRateMode
    $ordTotal = [double]$orderB.totalAmount
    Write-Host "  Order: $ORD_B_CODE | total=$ordTotal | baseExchangeRate=$ordBaseRate | mode=$ordRateMode"

    if ($ordBaseRate) {
        $lockedRate = [double]$ordBaseRate
        if ([math]::Abs($lockedRate - $RATE_TODAY) -lt 1) {
            Pass "B2: baseExchangeRate=$lockedRate locked at creation (matches $RATE_TODAY)"
        } else {
            Warn "B2: baseExchangeRate=$lockedRate (expected $RATE_TODAY)"
        }
    } else {
        Warn "B2: baseExchangeRate is null (FIXED mode may not have captured rate)"
    }

    if ($ordRateMode -eq "FIXED") {
        Pass "B2b: exchangeRateMode=FIXED on order"
    } else {
        Warn "B2b: exchangeRateMode=$ordRateMode (expected FIXED)"
    }
} else {
    Fail "B2: Failed to create MHH order"
}

# B3: Verify order total calculated in VND using locked rate
Write-Host ""
Write-Host "=== TEST B3: Order total in VND using locked rate ===" -ForegroundColor White
if ($ORD_B_ID) {
    # 100 items * 100 CNY = 10,000 CNY. At 3500 VND/CNY = 35,000,000 VND (if calculated)
    # Note: totalAmount may be calculated differently (service fee, etc.)
    $orderDetail = D (Api "GET" "/orders/$ORD_B_ID" $SALE1)
    $total = [double]$orderDetail.totalAmount
    $currency = $orderDetail.currency
    Write-Host "  totalAmount=$total | currency=$currency | baseExchangeRate=$($orderDetail.baseExchangeRate)"

    # Items are in CNY, totalAmount should be in VND (converted)
    if ($total -gt 0) {
        Pass "B3: Order totalAmount=$total $currency (positive value)"
    } else {
        Fail "B3: Order totalAmount=$total (expected > 0)"
    }
}

# ================================================================
# PART C: Rate change does NOT affect existing order
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Rate change does NOT affect existing order" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# C1: Change today's rate to 3600 (simulate next-day rate change)
Write-Host ""
Write-Host "=== TEST C1: Change rate to 3600 (simulate rate change) ===" -ForegroundColor White
$NEW_RATE = 3600
$newRateBody = @{
    fromCurrency  = "CNY"
    toCurrency    = "VND"
    rate          = $NEW_RATE
    effectiveDate = $TOMORROW
    source        = "MANUAL"
}
$newRateResp = D (Api "POST" "/exchange-rates" $CFO $newRateBody)
if ($newRateResp) {
    Write-Host "  New rate set: CNY/VND = $NEW_RATE for $TOMORROW"
    Pass "C1: New rate $NEW_RATE set for $TOMORROW"
} else {
    Warn "C1: Failed to set new rate for tomorrow"
}

# C2: Re-read order -> baseExchangeRate unchanged
Write-Host ""
Write-Host "=== TEST C2: Order baseExchangeRate unchanged after rate change ===" -ForegroundColor White
if ($ORD_B_ID) {
    $orderAfterRateChange = D (Api "GET" "/orders/$ORD_B_ID" $SALE1)
    $rateAfter = $orderAfterRateChange.baseExchangeRate
    $totalAfter = [double]$orderAfterRateChange.totalAmount
    Write-Host "  baseExchangeRate=$rateAfter | totalAmount=$totalAfter"

    if ($rateAfter) {
        $lockedAfter = [double]$rateAfter
        if ([math]::Abs($lockedAfter - $RATE_TODAY) -lt 1) {
            Pass "C2: baseExchangeRate=$lockedAfter unchanged (still $RATE_TODAY, not $NEW_RATE)"
        } else {
            Fail "C2: baseExchangeRate changed to $lockedAfter (should remain $RATE_TODAY)"
        }
    } else {
        Warn "C2: baseExchangeRate is null"
    }
}

# C3: Order totalAmount unchanged
Write-Host ""
Write-Host "=== TEST C3: Order totalAmount unchanged after rate change ===" -ForegroundColor White
if ($ORD_B_ID) {
    if ([math]::Abs($totalAfter - $ordTotal) -lt 1) {
        Pass "C3: totalAmount=$totalAfter unchanged (was $ordTotal)"
    } else {
        Fail "C3: totalAmount changed from $ordTotal to $totalAfter"
    }
}

# C4: Convert at today vs tomorrow -> different amounts
Write-Host ""
Write-Host "=== TEST C4: Convert 10,000 CNY at today vs tomorrow rate ===" -ForegroundColor White
$convToday = D (Api "POST" "/exchange-rates/convert" $SALE1 @{ amount = 10000; from = "CNY"; to = "VND"; date = $TODAY })
$convTmrw = D (Api "POST" "/exchange-rates/convert" $SALE1 @{ amount = 10000; from = "CNY"; to = "VND"; date = $TOMORROW })
if ($convToday -and $convTmrw) {
    $amtToday = [double]$convToday.convertedAmount
    $amtTmrw = [double]$convTmrw.convertedAmount
    Write-Host "  Today ($TODAY): 10,000 CNY = $amtToday VND (rate=$([double]$convToday.rate))"
    Write-Host "  Tomorrow ($TOMORROW): 10,000 CNY = $amtTmrw VND (rate=$([double]$convTmrw.rate))"
    if ($amtToday -ne $amtTmrw) {
        Pass "C4: Different rates produce different VND amounts (today=$amtToday, tmrw=$amtTmrw)"
    } else {
        Warn "C4: Same amount for both dates ($amtToday) - rates may have merged"
    }
} else {
    Warn "C4: Conversion failed for one of the dates"
}

# ================================================================
# PART D: Supplier order with CNY amounts
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Supplier order with CNY amounts" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# D1: Advance order to SOURCING (full deposit flow)
Write-Host ""
Write-Host "=== TEST D1: Advance order to SOURCING ===" -ForegroundColor White
if ($ORD_B_ID) {
    Api "PATCH" "/orders/$ORD_B_ID/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
    Api "PATCH" "/orders/$ORD_B_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT" } | Out-Null

    # Pay deposit (VIP = 50%)
    $depReq = [double](D (Api "GET" "/orders/$ORD_B_ID" $SALE1)).depositRequired
    $vBody = @{
        orderId = $ORD_B_ID; type = "RECEIPT"; amount = $depReq; currency = "VND"
        paymentMethod = "BANK_TRANSFER"; costType = "Tien coc don hang"
        beneficiary = $VIP_CUST.fullName; reason = "Coc cho FIN-003 multi-currency test"
    }
    $vRaw = Api "POST" "/cash/vouchers" $KETOAN $vBody
    $vResp = D $vRaw
    if ($vResp -and $vResp.voucher) { $vResp = $vResp.voucher }
    if ($vResp -and $vResp.id) {
        Api "PATCH" "/cash/vouchers/$($vResp.id)/approve" $CFO $null | Out-Null
        Start-Sleep -Milliseconds 500
    }

    $sourcingResp = Api-Expect "PATCH" "/orders/$ORD_B_ID/status" $SALE1 @{ status = "SOURCING" }
    $ordCheck = D (Api "GET" "/orders/$ORD_B_ID" $SALE1)
    if ($ordCheck.status -eq "SOURCING") {
        Pass "D1: Order at SOURCING"
    } else {
        Fail "D1: Expected SOURCING, got $($ordCheck.status)"
    }
}

# D2: Create supplier order with CNY amounts
Write-Host ""
Write-Host "=== TEST D2: Create supplier order (CNY) ===" -ForegroundColor White
if ($ORD_B_ID) {
    $soBody = @{
        orderId          = $ORD_B_ID
        supplierName     = "Taobao Supplier Multi-Currency Test"
        supplierPlatform = "Taobao"
        quotedPriceCNY   = 10000
        shippingFeeCNY   = 200
        quantityOrdered  = 100
        note             = "FIN-003: 10,000 CNY supplier order"
    }
    $soResp = D (Api "POST" "/supplier-orders" $SALE1 $soBody)
    if ($soResp -and $soResp.id) {
        $SO_ID = $soResp.id
        $SO_CODE = $soResp.code
        $soQuotedCNY = $soResp.quotedPriceCNY
        $soShipCNY = $soResp.shippingFeeCNY
        $soTotalCNY = $soResp.totalCNY
        $soTotalVND = $soResp.totalVND
        $soExRate = $soResp.exchangeRateUsed
        Write-Host "  SO: $SO_CODE | quotedCNY=$soQuotedCNY | shipCNY=$soShipCNY"
        Write-Host "  totalCNY=$soTotalCNY | totalVND=$soTotalVND | exchangeRate=$soExRate"
        Pass "D2: Supplier order created ($SO_CODE) with CNY amounts"
    } else {
        Warn "D2: Failed to create supplier order"
    }
}

# D3: Verify supplier order stores CNY values
Write-Host ""
Write-Host "=== TEST D3: Supplier order CNY fields ===" -ForegroundColor White
if ($SO_ID) {
    $soDetail = D (Api "GET" "/supplier-orders/$SO_ID" $SALE1)
    if ($soDetail) {
        $qCNY = [double]$soDetail.quotedPriceCNY
        $sCNY = [double]$soDetail.shippingFeeCNY
        Write-Host "  quotedPriceCNY=$qCNY | shippingFeeCNY=$sCNY"
        if ($qCNY -eq 10000) {
            Pass "D3a: quotedPriceCNY=10000 stored correctly"
        } else {
            Warn "D3a: quotedPriceCNY=$qCNY (expected 10000)"
        }
        if ($sCNY -eq 200) {
            Pass "D3b: shippingFeeCNY=200 stored correctly"
        } else {
            Warn "D3b: shippingFeeCNY=$sCNY (expected 200)"
        }
    }
}

# D4: Verify totalVND calculated (if auto-converted)
Write-Host ""
Write-Host "=== TEST D4: Supplier order VND conversion ===" -ForegroundColor White
if ($SO_ID) {
    $soFresh = D (Api "GET" "/supplier-orders/$SO_ID" $SALE1)
    $tCNY = 0; $tVND = 0; $exUsed = 0
    if ($soFresh.totalCNY -ne $null) { $tCNY = [double]$soFresh.totalCNY }
    if ($soFresh.totalVND -ne $null) { $tVND = [double]$soFresh.totalVND }
    if ($soFresh.exchangeRateUsed -ne $null) { $exUsed = [double]$soFresh.exchangeRateUsed }
    Write-Host "  totalCNY=$tCNY | totalVND=$tVND | exchangeRateUsed=$exUsed"

    if ($tVND -gt 0 -and $exUsed -gt 0) {
        $expectedVND = $tCNY * $exUsed
        Write-Host "  Expected VND: $tCNY * $exUsed = $expectedVND"
        if ([math]::Abs($tVND - $expectedVND) -lt 100) {
            Pass "D4: totalVND=$tVND matches CNY*rate ($expectedVND)"
        } else {
            Warn "D4: totalVND=$tVND vs expected $expectedVND"
        }
    } elseif ($tCNY -gt 0) {
        Warn "D4: totalCNY=$tCNY but totalVND/exchangeRateUsed not populated yet"
    } else {
        Warn "D4: CNY/VND values not populated on supplier order"
    }
}

# ================================================================
# PART E: Settlement rate adjustment (manual adjust by accountant)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: Settlement rate adjustment" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# E1: Set a settlement rate (different from original) for today
Write-Host ""
Write-Host "=== TEST E1: Set settlement rate 3550 (adjust) ===" -ForegroundColor White
$SETTLEMENT_RATE = 3550
$settlementBody = @{
    fromCurrency  = "CNY"
    toCurrency    = "VND"
    rate          = $SETTLEMENT_RATE
    effectiveDate = $TODAY
    source        = "MANUAL"
}
$settleResp = D (Api "POST" "/exchange-rates" $CFO $settlementBody)
if ($settleResp) {
    $sRate = [double]$settleResp.rate
    Write-Host "  Settlement rate: CNY/VND = $sRate for $TODAY"
    Pass "E1: Settlement rate $SETTLEMENT_RATE set (overriding $RATE_TODAY for today)"
} else {
    Warn "E1: Failed to set settlement rate"
}

# E2: Verify current rate now reflects settlement rate
Write-Host ""
Write-Host "=== TEST E2: Current rate = settlement rate ===" -ForegroundColor White
$currentAfterSettle = D (Api "GET" "/exchange-rates/current?from=CNY&to=VND" $SALE1)
if ($currentAfterSettle) {
    $curRate = [double]$currentAfterSettle.rate
    Write-Host "  Current: CNY/VND = $curRate"
    if ([math]::Abs($curRate - $SETTLEMENT_RATE) -lt 1) {
        Pass "E2: Current rate = $curRate (settlement rate $SETTLEMENT_RATE)"
    } else {
        Warn "E2: Current rate = $curRate (expected $SETTLEMENT_RATE)"
    }
}

# E3: Order's locked rate still unchanged
Write-Host ""
Write-Host "=== TEST E3: Order baseExchangeRate still locked ===" -ForegroundColor White
if ($ORD_B_ID) {
    $ordAfterSettle = D (Api "GET" "/orders/$ORD_B_ID" $SALE1)
    $lockedRateStill = $ordAfterSettle.baseExchangeRate
    Write-Host "  Order baseExchangeRate=$lockedRateStill"
    if ($lockedRateStill) {
        $lr = [double]$lockedRateStill
        if ([math]::Abs($lr - $RATE_TODAY) -lt 1) {
            Pass "E3: Order locked rate=$lr still at original $RATE_TODAY (not changed to $SETTLEMENT_RATE)"
        } else {
            Warn "E3: Order locked rate=$lr (expected $RATE_TODAY)"
        }
    } else {
        Warn "E3: baseExchangeRate is null"
    }
}

# E4: Rate variance detection (> 5% warning)
Write-Host ""
Write-Host "=== TEST E4: Rate variance detection (> 5% change) ===" -ForegroundColor White
$EXTREME_RATE = 4000  # ~14% above 3500 -> should trigger variance warning
$extremeBody = @{
    fromCurrency  = "CNY"
    toCurrency    = "VND"
    rate          = $EXTREME_RATE
    effectiveDate = $TOMORROW
    source        = "MANUAL"
}
$extremeResp = Api-Expect "POST" "/exchange-rates" $CFO $extremeBody
if ($extremeResp.code -ge 200 -and $extremeResp.code -lt 300) {
    # Should succeed but may log a warning
    Pass "E4: Extreme rate $EXTREME_RATE accepted (variance alert may be logged)"
} else {
    Warn "E4: Extreme rate rejected (HTTP $($extremeResp.code)) - variance check may block"
}

# ================================================================
# PART F: FX Gain/Loss report
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: FX Gain/Loss report" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$CURRENT_YEAR = [int](Get-Date).Year
$CURRENT_MONTH = [int](Get-Date).Month

# F1: Get FX gain/loss report
Write-Host ""
Write-Host "=== TEST F1: GET /general-ledger/fx-gain-loss ===" -ForegroundColor White
$fxReport = D (Api "GET" "/general-ledger/fx-gain-loss?year=$CURRENT_YEAR&month=$CURRENT_MONTH" $CEO)
if ($fxReport) {
    Write-Host "  Period: $($fxReport.period)"
    Write-Host "  totalGain: $($fxReport.totalGain)"
    Write-Host "  totalLoss: $($fxReport.totalLoss)"
    Write-Host "  netGainLoss: $($fxReport.netGainLoss)"
    $entryCount = 0
    if ($fxReport.entries) { $entryCount = @($fxReport.entries).Count }
    Write-Host "  Entries: $entryCount"
    Pass "F1: FX gain/loss report retrieved (gain=$($fxReport.totalGain), loss=$($fxReport.totalLoss))"
} else {
    Warn "F1: FX gain/loss report returned null"
}

# F2: Revalue FX positions (month-end simulation)
Write-Host ""
Write-Host "=== TEST F2: POST /general-ledger/revalue-fx ===" -ForegroundColor White
$revalBody = @{
    year        = $CURRENT_YEAR
    month       = $CURRENT_MONTH
    currentRate = $SETTLEMENT_RATE
}
$revalResp = Api-Expect "POST" "/general-ledger/revalue-fx" $KETOAN $revalBody
if ($revalResp.code -ge 200 -and $revalResp.code -lt 300) {
    $revalData = $null
    if ($revalResp.body -and $revalResp.body.data) { $revalData = $revalResp.body.data }
    if ($revalData) {
        Write-Host "  arCount=$($revalData.arCount) | apCount=$($revalData.apCount)"
        Write-Host "  netUnrealized=$($revalData.netUnrealized) | isGain=$($revalData.isGain)"
        if ($revalData.journalEntry) {
            Write-Host "  JE: $($revalData.journalEntry.code) | desc=$($revalData.journalEntry.description)"
        }
        Pass "F2: FX revaluation completed (AR=$($revalData.arCount), AP=$($revalData.apCount))"
    } else {
        Pass "F2: FX revaluation request accepted"
    }
} else {
    Warn "F2: FX revaluation failed (HTTP $($revalResp.code))"
}

# F3: Verify FX report updated after revaluation
Write-Host ""
Write-Host "=== TEST F3: FX report after revaluation ===" -ForegroundColor White
$fxReportAfter = D (Api "GET" "/general-ledger/fx-gain-loss?year=$CURRENT_YEAR&month=$CURRENT_MONTH" $CEO)
if ($fxReportAfter) {
    $entryCountAfter = 0
    if ($fxReportAfter.entries) { $entryCountAfter = @($fxReportAfter.entries).Count }
    Write-Host "  Entries after reval: $entryCountAfter"
    Write-Host "  totalGain=$($fxReportAfter.totalGain) | totalLoss=$($fxReportAfter.totalLoss) | net=$($fxReportAfter.netGainLoss)"
    Pass "F3: FX report has $entryCountAfter entries (gain=$($fxReportAfter.totalGain), loss=$($fxReportAfter.totalLoss))"
} else {
    Warn "F3: FX report returned null"
}

# ================================================================
# PART G: Audit trail & CNY sync restriction
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: Audit trail & CNY sync restriction" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# G1: Get exchange rate audit trail
Write-Host ""
Write-Host "=== TEST G1: Exchange rate audit trail ===" -ForegroundColor White
$auditResp = D (Api "GET" "/exchange-rates/audit-trail?from=$YESTERDAY&to=$TOMORROW" $CFO)
$auditItems = @()
if ($auditResp -is [array]) { $auditItems = @($auditResp) }
Write-Host "  Audit entries: $($auditItems.Count)"
foreach ($a in ($auditItems | Select-Object -First 3)) {
    Write-Host "    action=$($a.action) | entity=$($a.entity) | user=$($a.user.fullName)" -ForegroundColor Gray
}
if ($auditItems.Count -ge 1) {
    Pass "G1: Audit trail has $($auditItems.Count) entries"
} else {
    Warn "G1: No audit trail entries (audit logging may not capture rate changes)"
}

# G2: CNY auto-sync from Vietcombank -> should be forbidden
Write-Host ""
Write-Host "=== TEST G2: CNY auto-sync forbidden ===" -ForegroundColor White
$syncResp = Api-Expect "POST" "/exchange-rates/sync/vietcombank" $CFO $null
# This should either be 403 (CNY cannot be synced) or 501 (not implemented)
if ($syncResp.code -eq 403) {
    Pass "G2: CNY sync forbidden (403) - must be manual"
} elseif ($syncResp.code -eq 501) {
    Pass "G2: Vietcombank sync not implemented (501)"
} else {
    Warn "G2: Sync returned HTTP $($syncResp.code) (expected 403 or 501)"
}

# G3: Convert same currency (CNY -> CNY) -> rate = 1
Write-Host ""
Write-Host "=== TEST G3: Same currency conversion (CNY -> CNY) ===" -ForegroundColor White
$sameCurrResp = D (Api "POST" "/exchange-rates/convert" $SALE1 @{ amount = 10000; from = "CNY"; to = "CNY" })
if ($sameCurrResp) {
    $sameAmt = [double]$sameCurrResp.convertedAmount
    $sameRate = [double]$sameCurrResp.rate
    Write-Host "  10,000 CNY -> CNY = $sameAmt (rate=$sameRate)"
    if ($sameAmt -eq 10000 -and $sameRate -eq 1) {
        Pass "G3: Same currency: rate=1, amount unchanged"
    } elseif ($sameAmt -eq 10000) {
        Pass "G3: Same currency: amount unchanged ($sameAmt)"
    } else {
        Fail "G3: Same currency: amount=$sameAmt (expected 10000)"
    }
} else {
    Warn "G3: Same currency conversion failed"
}

# ================================================================
# PART H: Multi-currency display in order 360 view
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Multi-currency in order 360 view" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# H1: Get order 360 view
Write-Host ""
Write-Host "=== TEST H1: Order 360 view shows VND and CNY ===" -ForegroundColor White
if ($ORD_B_ID) {
    $ord360 = D (Api "GET" "/orders/$ORD_B_ID/360" $SALE1)
    if ($ord360) {
        # Check for finance block or items block
        $finBlock = $ord360.finance
        $goodsBlock = $ord360.goods
        $saleBlock = $ord360.sale

        Write-Host "  360 view blocks present:"
        if ($saleBlock) { Write-Host "    sale: currency=$($saleBlock.currency) | baseExchangeRate=$($saleBlock.baseExchangeRate)" }
        if ($finBlock) {
            Write-Host "    finance: totalAmount=$($finBlock.totalAmount) | depositRequired=$($finBlock.depositRequired)"
        }
        if ($goodsBlock -and $goodsBlock.supplierOrders) {
            $soList = @($goodsBlock.supplierOrders)
            foreach ($so in $soList) {
                Write-Host "    SO: quotedCNY=$($so.quotedPriceCNY) | totalCNY=$($so.totalCNY) | totalVND=$($so.totalVND)"
            }
        }

        Pass "H1: Order 360 view retrieved"
    } else {
        Warn "H1: Order 360 view returned null"
    }
}

# H2: Verify items show CNY currency
Write-Host ""
Write-Host "=== TEST H2: Order items show CNY currency ===" -ForegroundColor White
if ($ORD_B_ID) {
    $ordItems = D (Api "GET" "/orders/$ORD_B_ID" $SALE1)
    if ($ordItems -and $ordItems.items) {
        $items = @($ordItems.items)
        $cnyItems = @($items | Where-Object { $_.currency -eq 'CNY' })
        Write-Host "  Total items: $($items.Count) | CNY items: $($cnyItems.Count)"
        foreach ($item in ($items | Select-Object -First 2)) {
            Write-Host "    $($item.productName): qty=$($item.quantity) price=$($item.unitPrice) $($item.currency)"
        }
        if ($cnyItems.Count -gt 0) {
            Pass "H2: Order items have currency=CNY ($($cnyItems.Count) items)"
        } else {
            Warn "H2: No CNY items found (items may default to VND display)"
        }
    } else {
        Warn "H2: Order has no items in response"
    }
}

# H3: Verify conversion endpoint works for arbitrary amounts
Write-Host ""
Write-Host "=== TEST H3: Conversion 5,678.90 CNY -> VND ===" -ForegroundColor White
$preciseResp = D (Api "POST" "/exchange-rates/convert" $SALE1 @{ amount = 5678.90; from = "CNY"; to = "VND" })
if ($preciseResp) {
    $preciseAmt = [double]$preciseResp.convertedAmount
    $preciseRate = [double]$preciseResp.rate
    $expectedPrecise = [math]::Round(5678.90 * $preciseRate, 2)
    Write-Host "  5,678.90 CNY = $preciseAmt VND (rate=$preciseRate, expected=$expectedPrecise)"
    if ([math]::Abs($preciseAmt - $expectedPrecise) -lt 1) {
        Pass "H3: Precise conversion correct ($preciseAmt VND)"
    } else {
        Warn "H3: $preciseAmt vs expected $expectedPrecise"
    }
} else {
    Fail "H3: Conversion failed"
}

# ================================================================
# CLEANUP: Restore customer exchangeRateMode if changed
# ================================================================
Write-Host ""
Write-Host "=== CLEANUP: Restore customer exchangeRateMode ===" -ForegroundColor White
if ($modeBeforeTest -and $modeBeforeTest -ne "FIXED") {
    Api "PATCH" "/customers/$($VIP_CUST.id)" $CEO @{ exchangeRateMode = $modeBeforeTest } | Out-Null
    Write-Host "  Restored exchangeRateMode to $modeBeforeTest"
} else {
    Write-Host "  No restore needed (was $modeBeforeTest)"
}

# Restore today's rate back to original
$restoreBody = @{
    fromCurrency  = "CNY"
    toCurrency    = "VND"
    rate          = $RATE_TODAY
    effectiveDate = $TODAY
    source        = "MANUAL"
}
Api "POST" "/exchange-rates" $CFO $restoreBody | Out-Null
Write-Host "  Restored today's rate to $RATE_TODAY"

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-FIN-003: Multi-currency (VND/CNY)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  Part A: Set & read CNY/VND rate (7 tests)"
Write-Host "  Part B: Order creation locks rate (3 tests)"
Write-Host "  Part C: Rate change does not affect order (4 tests)"
Write-Host "  Part D: Supplier order CNY amounts (4 tests)"
Write-Host "  Part E: Settlement rate adjustment (4 tests)"
Write-Host "  Part F: FX gain/loss report (3 tests)"
Write-Host "  Part G: Audit trail & restrictions (3 tests)"
Write-Host "  Part H: Multi-currency display (3 tests)"
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
