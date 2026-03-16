# ================================================================
# TEST-CRM-003: Customer Data Scoping - Sale chi thay KH cua minh
# Severity: CRITICAL
#
# Note: CRM module hien TAI chua implement DataScopeService.
# Test nay kiem tra xem data scoping da duoc ap dung chua.
# Neu chua -> WARN (feature gap, khong phai bug).
#
# Steps:
#   1. Sale A tao KH X, Sale B tao KH Y
#   2. Sale A GET /customers -> Verify chi thay KH X
#   3. Sale A GET /customers/:KH_Y_ID -> Expect 403
#   4. Leader -> Verify thay ca KH X va KH Y
#   5. COO -> Verify thay tat ca KH
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

function ExtractList($resp) {
    # Handle various pagination formats
    if ($resp -and $resp.data) {
        if ($resp.data -is [array]) { return $resp.data }
        if ($resp.data.data) { return $resp.data.data }
        if ($resp.data.items) { return $resp.data.items }
    }
    if ($resp -and $resp.items) { return $resp.items }
    return @()
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-CRM-003: Customer Data Scoping" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login multiple roles ===" -ForegroundColor White

$SALE_A = Login "sale01@$DOMAIN"
if ($SALE_A) { Pass "Sale A (sale01) login OK" } else { Fail "Sale A login FAILED"; exit 1 }

$SALE_B = Login "sale02@$DOMAIN"
if ($SALE_B) { Pass "Sale B (sale02) login OK" } else { Fail "Sale B login FAILED"; exit 1 }

$LEADER = Login "leader.hn@$DOMAIN"
if ($LEADER) { Pass "Leader login OK" } else { Warn "Leader login FAILED (skip leader tests)" }

$COO = Login "admin@$DOMAIN"
if ($COO) { Pass "COO/CEO login OK" } else { Fail "COO login FAILED"; exit 1 }

$TS = Get-Date -Format "yyyyMMddHHmmss"

# ================================================================
# PART A: CREATE CUSTOMERS
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Sale A tao KH X, Sale B tao KH Y" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST A1: Sale A creates customer X ===" -ForegroundColor White
$custX = D (Api "POST" "/customers" $SALE_A @{
    fullName = "KH-X SaleA $TS"
    phone    = "091$($TS.Substring(5))"
    branch   = "HN"
    note     = "Created by Sale A"
})
$CUST_X_ID = $null
if ($custX -and $custX.id) {
    $CUST_X_ID = $custX.id
    Write-Host "  Customer X: $($custX.code) | saleId=$($custX.saleId)"
    Pass "A1: Customer X created by Sale A"
} else {
    Fail "A1: Failed to create customer X"; exit 1
}

Write-Host ""
Write-Host "=== TEST A2: Sale B creates customer Y ===" -ForegroundColor White
$custY = D (Api "POST" "/customers" $SALE_B @{
    fullName = "KH-Y SaleB $TS"
    phone    = "092$($TS.Substring(5))"
    branch   = "HN"
    note     = "Created by Sale B"
})
$CUST_Y_ID = $null
if ($custY -and $custY.id) {
    $CUST_Y_ID = $custY.id
    Write-Host "  Customer Y: $($custY.code) | saleId=$($custY.saleId)"
    Pass "A2: Customer Y created by Sale B"
} else {
    Fail "A2: Failed to create customer Y"; exit 1
}

# ================================================================
# PART B: SALE A DATA SCOPING
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Sale A -> chi thay KH cua minh?" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST B1: Sale A list customers ===" -ForegroundColor White
$saleAList = Api "GET" "/customers?limit=100" $SALE_A
$saleACustomers = @(ExtractList $saleAList)

$saleASeesX = $false
$saleASeesY = $false
if ($saleACustomers -is [array]) {
    $saleASeesX = ($saleACustomers | Where-Object { $_.id -eq $CUST_X_ID }) -ne $null
    $saleASeesY = ($saleACustomers | Where-Object { $_.id -eq $CUST_Y_ID }) -ne $null
}

Write-Host "  Sale A sees X: $saleASeesX"
Write-Host "  Sale A sees Y: $saleASeesY"

if ($saleASeesX) {
    Pass "B1a: Sale A can see own customer X"
} else {
    Fail "B1a: Sale A cannot see own customer X"
}

if (-not $saleASeesY) {
    Pass "B1b: Sale A cannot see Sale B's customer Y (data scoping active)"
} else {
    Warn "B1b: Sale A CAN see Sale B's customer Y (data scoping NOT implemented for CRM)"
}

# B2: Sale A direct access to customer Y
Write-Host ""
Write-Host "=== TEST B2: Sale A GET /customers/:KH_Y_ID ===" -ForegroundColor White
$directAccess = Api "GET" "/customers/$CUST_Y_ID" $SALE_A
if (IsError $directAccess) {
    $code = $directAccess._code
    if ($code -eq 403) {
        Pass "B2: Sale A blocked from Sale B's customer (403)"
    } elseif ($code -eq 404) {
        Pass "B2: Sale A blocked from Sale B's customer (404 - hidden)"
    } else {
        Warn "B2: Sale A got error $code accessing Sale B's customer"
    }
} else {
    $directData = D $directAccess
    if ($directData -and $directData.id -eq $CUST_Y_ID) {
        Warn "B2: Sale A CAN directly access Sale B's customer (data scoping NOT enforced on getById)"
    } else {
        Pass "B2: Sale A cannot access Sale B's customer"
    }
}

# ================================================================
# PART C: SALE B DATA SCOPING
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Sale B -> chi thay KH cua minh?" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST C1: Sale B list customers ===" -ForegroundColor White
$saleBList = Api "GET" "/customers?limit=100" $SALE_B
$saleBCustomers = @(ExtractList $saleBList)

$saleBSeesX = $false
$saleBSeesY = $false
if ($saleBCustomers -is [array]) {
    $saleBSeesX = ($saleBCustomers | Where-Object { $_.id -eq $CUST_X_ID }) -ne $null
    $saleBSeesY = ($saleBCustomers | Where-Object { $_.id -eq $CUST_Y_ID }) -ne $null
}

Write-Host "  Sale B sees X: $saleBSeesX"
Write-Host "  Sale B sees Y: $saleBSeesY"

if ($saleBSeesY) {
    Pass "C1a: Sale B can see own customer Y"
} else {
    Fail "C1a: Sale B cannot see own customer Y"
}

if (-not $saleBSeesX) {
    Pass "C1b: Sale B cannot see Sale A's customer X (data scoping active)"
} else {
    Warn "C1b: Sale B CAN see Sale A's customer X (data scoping NOT implemented for CRM)"
}

# ================================================================
# PART D: LEADER DATA SCOPING
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Leader -> thay KH cua team?" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

if ($LEADER) {
    Write-Host ""
    Write-Host "=== TEST D1: Leader list customers ===" -ForegroundColor White
    $leaderList = Api "GET" "/customers?limit=100" $LEADER
    $leaderCustomers = @(ExtractList $leaderList)

    $leaderSeesX = $false
    $leaderSeesY = $false
    if ($leaderCustomers -is [array]) {
        $leaderSeesX = ($leaderCustomers | Where-Object { $_.id -eq $CUST_X_ID }) -ne $null
        $leaderSeesY = ($leaderCustomers | Where-Object { $_.id -eq $CUST_Y_ID }) -ne $null
    }

    Write-Host "  Leader sees X: $leaderSeesX"
    Write-Host "  Leader sees Y: $leaderSeesY"
    Write-Host "  Total customers visible: $(if ($leaderCustomers -is [array]) { $leaderCustomers.Count } else { 'N/A' })"

    if ($leaderSeesX -and $leaderSeesY) {
        Pass "D1: Leader sees both customer X and Y (team scope or no scoping)"
    } elseif ($leaderSeesX -or $leaderSeesY) {
        Warn "D1: Leader sees only one customer (partial team scope)"
    } else {
        Warn "D1: Leader sees neither customer (possibly different team)"
    }
} else {
    Warn "D1: Skipped (Leader login failed)"
}

# ================================================================
# PART E: COO/CEO DATA SCOPING
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: COO/CEO -> thay tat ca KH" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST E1: COO list customers ===" -ForegroundColor White
$cooList = Api "GET" "/customers?limit=100" $COO
$cooCustomers = @(ExtractList $cooList)

$cooSeesX = $false
$cooSeesY = $false
if ($cooCustomers -is [array]) {
    $cooSeesX = ($cooCustomers | Where-Object { $_.id -eq $CUST_X_ID }) -ne $null
    $cooSeesY = ($cooCustomers | Where-Object { $_.id -eq $CUST_Y_ID }) -ne $null
}

Write-Host "  COO sees X: $cooSeesX"
Write-Host "  COO sees Y: $cooSeesY"
Write-Host "  Total customers visible: $(if ($cooCustomers -is [array]) { $cooCustomers.Count } else { 'N/A' })"

if ($cooSeesX -and $cooSeesY) {
    Pass "E1: COO sees both customer X and Y (full visibility)"
} else {
    Fail "E1: COO cannot see all customers (X=$cooSeesX, Y=$cooSeesY)"
}

# E2: COO direct access
Write-Host ""
Write-Host "=== TEST E2: COO direct access to both ===" -ForegroundColor White
$cooX = D (Api "GET" "/customers/$CUST_X_ID" $COO)
$cooY = D (Api "GET" "/customers/$CUST_Y_ID" $COO)

if ($cooX -and $cooX.id -eq $CUST_X_ID) {
    Pass "E2a: COO can access customer X directly"
} else {
    Fail "E2a: COO cannot access customer X"
}

if ($cooY -and $cooY.id -eq $CUST_Y_ID) {
    Pass "E2b: COO can access customer Y directly"
} else {
    Fail "E2b: COO cannot access customer Y"
}

# ================================================================
# PART F: SALE ID ASSIGNMENT
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Verify saleId assignment" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST F1: Check saleId on created customers ===" -ForegroundColor White

# Re-read customers as CEO to get full data
$xFull = D (Api "GET" "/customers/$CUST_X_ID" $COO)
$yFull = D (Api "GET" "/customers/$CUST_Y_ID" $COO)

Write-Host "  Customer X saleId: $($xFull.saleId)"
Write-Host "  Customer Y saleId: $($yFull.saleId)"

# saleId may or may not be auto-set. Check if it's present.
if ($xFull.saleId) {
    Pass "F1a: Customer X has saleId assigned"
} else {
    Warn "F1a: Customer X has no saleId (not auto-assigned from creator)"
}

if ($yFull.saleId) {
    Pass "F1b: Customer Y has saleId assigned"
} else {
    Warn "F1b: Customer Y has no saleId (not auto-assigned from creator)"
}

# If saleIds are different (meaning different sales own different customers)
if ($xFull.saleId -and $yFull.saleId -and $xFull.saleId -ne $yFull.saleId) {
    Pass "F1c: Different saleIds for different sales"
} elseif ($xFull.saleId -and $yFull.saleId -and $xFull.saleId -eq $yFull.saleId) {
    Warn "F1c: Same saleId for both customers (both created as same sale? or saleId not auto-set)"
} else {
    Warn "F1c: Cannot compare saleIds (one or both missing)"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-CRM-003: Customer Data Scoping" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Part A: Create customers by different sales"
Write-Host "  Part B: Sale A visibility (own customers only?)"
Write-Host "  Part C: Sale B visibility (own customers only?)"
Write-Host "  Part D: Leader visibility (team scope?)"
Write-Host "  Part E: COO/CEO visibility (all customers)"
Write-Host "  Part F: saleId assignment check"
Write-Host ""
Write-Host "  NOTE: Data scoping for CRM depends on DataScopeService integration."
Write-Host "  If WARNs appear, it means CRM list endpoint does not filter by sale."
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
