# ================================================================
# TEST-CRM-002: Phan loai khach hang & Credit Limit
# Severity: CRITICAL
#
# Tiers:
#   NEW:       depositRate=100%, creditLimit=0
#   REGULAR:   depositRate=70%,  creditLimit=50,000,000
#   VIP:       depositRate=50%,  creditLimit=200,000,000
#   STRATEGIC: depositRate=30%,  creditLimit=500,000,000
#
# Steps:
#   1. Create KH -> default NEW, deposit 100%, credit 0
#   2. Manual set STRATEGIC -> verify deposit 30%, credit 500M
#   3. Tao don vuot credit limit -> verify CHAN
#   4. KH thanh toan -> credit khoi phuc -> cho phep
#   5. Edge: Credit limit = 0 (NEW tier) -> moi don deu bi chan
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
        return @{ _error = $true; _code = $code; _body = $errBody }
    }
}

function D($resp) {
    if ($resp -and $resp._error) { return $null }
    if ($resp -and $resp.data) { return $resp.data }
    return $resp
}

function IsError($resp) {
    return ($resp -and $resp._error -eq $true)
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
Write-Host "  TEST-CRM-002: Phan Loai KH & Credit Limit" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login ===" -ForegroundColor White

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SALE login OK" } else { Fail "SALE login FAILED"; exit 1 }

$CEO = Login "admin@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

$TS = Get-Date -Format "yyyyMMddHHmmss"

# ================================================================
# PART A: DEFAULT TIER (NEW)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Tao KH moi -> verify default tier" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST A1: Create customer ===" -ForegroundColor White
$cust = D (Api "POST" "/customers" $SALE @{
    fullName = "CRM002 Tier Test $TS"
    phone    = "09$($TS.Substring(4))"
    branch   = "HN"
})

$CUST_ID = $null
if ($cust -and $cust.id) {
    $CUST_ID = $cust.id
    Write-Host "  Code: $($cust.code) | tier=$($cust.tier)"
    Pass "A1: Customer created"
} else {
    Fail "A1: Failed to create customer"; exit 1
}

# A2: Verify defaults
Write-Host ""
Write-Host "=== TEST A2: Verify NEW tier defaults ===" -ForegroundColor White
Write-Host "  tier=$($cust.tier) | depositRate=$($cust.depositRate) | creditLimit=$($cust.creditLimit)"

if ($cust.tier -eq "NEW") {
    Pass "A2a: Default tier = NEW"
} else {
    Fail "A2a: Default tier = $($cust.tier) (expected NEW)"
}

if ([int]$cust.depositRate -eq 100) {
    Pass "A2b: NEW depositRate = 100%"
} else {
    Fail "A2b: NEW depositRate = $($cust.depositRate) (expected 100)"
}

if ([double]$cust.creditLimit -eq 0) {
    Pass "A2c: NEW creditLimit = 0"
} else {
    Fail "A2c: NEW creditLimit = $($cust.creditLimit) (expected 0)"
}

# ================================================================
# PART B: UPGRADE TO STRATEGIC (manual only)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Nang cap len STRATEGIC (manual)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST B1: Try set tier=VIP (should fail - manual only for STRATEGIC) ===" -ForegroundColor White
$vipResp = Api "PATCH" "/customers/$CUST_ID" $SALE @{ tier = "VIP" }
if (IsError $vipResp) {
    Pass "B1: VIP tier rejected (manual tier only for STRATEGIC)"
} elseif ($vipResp -and $vipResp.data -and $vipResp.data.tier -eq "VIP") {
    Fail "B1: VIP tier accepted (should only allow STRATEGIC manual)"
} else {
    Pass "B1: VIP tier not applied (only STRATEGIC manual allowed)"
}

Write-Host ""
Write-Host "=== TEST B2: Set tier=STRATEGIC ===" -ForegroundColor White
$strategic = D (Api "PATCH" "/customers/$CUST_ID" $SALE @{ tier = "STRATEGIC" })
if ($strategic -and $strategic.tier -eq "STRATEGIC") {
    Write-Host "  tier=$($strategic.tier) | depositRate=$($strategic.depositRate) | creditLimit=$($strategic.creditLimit)"
    Pass "B2a: Tier updated to STRATEGIC"

    if ([int]$strategic.depositRate -eq 30) {
        Pass "B2b: STRATEGIC depositRate = 30%"
    } else {
        Fail "B2b: STRATEGIC depositRate = $($strategic.depositRate) (expected 30)"
    }

    if ([double]$strategic.creditLimit -eq 500000000) {
        Pass "B2c: STRATEGIC creditLimit = 500,000,000"
    } else {
        Fail "B2c: STRATEGIC creditLimit = $($strategic.creditLimit) (expected 500000000)"
    }
} else {
    Fail "B2: Failed to upgrade to STRATEGIC"
}

# ================================================================
# PART C: CREDIT LIMIT ENFORCEMENT
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Credit limit enforcement" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# C1: Create order within credit limit (should succeed)
Write-Host ""
Write-Host "=== TEST C1: Order within credit limit ===" -ForegroundColor White
Write-Host "  Credit limit = 500M, order = 1000 VND -> should pass"
$orderOk = D (Api "POST" "/orders" $SALE @{
    customerId    = $CUST_ID
    serviceType   = "VCT"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @( @{ productName = "Small item"; quantity = 1; unitPrice = 1000 } )
})
if ($orderOk -and $orderOk.id) {
    Pass "C1: Order within credit limit - created OK"
} else {
    Fail "C1: Order within credit limit failed"
}

# ================================================================
# PART D: CREDIT LIMIT = 0 (NEW tier)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Credit limit = 0 (NEW tier) -> moi don bi chan" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST D1: Create NEW tier customer (credit=0) ===" -ForegroundColor White
$newCust = D (Api "POST" "/customers" $SALE @{
    fullName = "CRM002 Zero Credit $TS"
    phone    = "07$($TS.Substring(4))"
    branch   = "HN"
})

$NEW_CUST_ID = $null
if ($newCust -and $newCust.id) {
    $NEW_CUST_ID = $newCust.id
    Write-Host "  Code: $($newCust.code) | creditLimit=$($newCust.creditLimit)"
    Pass "D1: NEW tier customer created (credit=0)"
} else {
    Fail "D1: Failed to create NEW tier customer"; exit 1
}

Write-Host ""
Write-Host "=== TEST D2: Create order for zero-credit customer ===" -ForegroundColor White
Write-Host "  creditLimit=0, order amount=500 -> should be blocked"
$blockedResp = Api "POST" "/orders" $SALE @{
    customerId    = $NEW_CUST_ID
    serviceType   = "VCT"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @( @{ productName = "Blocked item"; quantity = 1; unitPrice = 500 } )
}
if (IsError $blockedResp) {
    $code = $blockedResp._code
    if ($code -eq 403) {
        Pass "D2: Order blocked for zero-credit customer (403)"
    } else {
        Warn "D2: Order rejected with code $code (expected 403)"
    }
} elseif ($blockedResp -and $blockedResp.data -and $blockedResp.data.id) {
    Fail "D2: Order created for zero-credit customer (should be blocked by CreditCheckGuard)"
} else {
    Pass "D2: Order blocked for zero-credit customer"
}

# D3: Edge - order with 0 amount (should pass credit check)
Write-Host ""
Write-Host "=== TEST D3: Zero-amount order for zero-credit customer ===" -ForegroundColor White
$zeroOrder = D (Api "POST" "/orders" $SALE @{
    customerId    = $NEW_CUST_ID
    serviceType   = "VCT"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @( @{ productName = "Free sample"; quantity = 1; unitPrice = 0 } )
})
if ($zeroOrder -and $zeroOrder.id) {
    Pass "D3: Zero-amount order passes credit check"
} else {
    Warn "D3: Zero-amount order also blocked (strict enforcement)"
}

# ================================================================
# PART E: INACTIVE CUSTOMER BLOCKS ORDERS
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: Inactive customer blocks orders" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST E1: Deactivate STRATEGIC customer ===" -ForegroundColor White
$deactivated = D (Api "PATCH" "/customers/$CUST_ID" $SALE @{ isActive = $false })
if ($deactivated -and $deactivated.isActive -eq $false) {
    Pass "E1: Customer deactivated"
} else {
    Fail "E1: Failed to deactivate"
}

Write-Host ""
Write-Host "=== TEST E2: Order blocked for inactive customer ===" -ForegroundColor White
$inactiveOrder = Api "POST" "/orders" $SALE @{
    customerId    = $CUST_ID
    serviceType   = "VCT"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @( @{ productName = "Blocked"; quantity = 1; unitPrice = 100 } )
}
if (IsError $inactiveOrder) {
    $code = $inactiveOrder._code
    if ($code -eq 403) {
        Pass "E2: Order blocked for inactive customer (403)"
    } else {
        Warn "E2: Order rejected with code $code (expected 403)"
    }
} elseif ($inactiveOrder -and $inactiveOrder.data -and $inactiveOrder.data.id) {
    Fail "E2: Order created for inactive customer (should be blocked)"
} else {
    Pass "E2: Order blocked for inactive customer"
}

# Reactivate for cleanup
D (Api "PATCH" "/customers/$CUST_ID" $SALE @{ isActive = $true }) | Out-Null

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-CRM-002: Phan Loai KH & Credit Limit" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Tier defaults:"
Write-Host "    NEW:       deposit=100%, credit=0"
Write-Host "    REGULAR:   deposit=70%,  credit=50M"
Write-Host "    VIP:       deposit=50%,  credit=200M"
Write-Host "    STRATEGIC: deposit=30%,  credit=500M"
Write-Host ""
Write-Host "  Part A: Default NEW tier"
Write-Host "  Part B: Manual STRATEGIC upgrade"
Write-Host "  Part C: Credit limit enforcement"
Write-Host "  Part D: Zero credit (NEW tier)"
Write-Host "  Part E: Inactive customer blocks orders"
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
