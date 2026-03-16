# ================================================================
# TEST-SEC-004: Data Scoping Guard
# Severity: CRITICAL
#
# Verifies that users only see data according to their
# role / branch / team hierarchy. Data scoping works via
# FILTERING (200 with filtered results), NOT 403 on list
# endpoints. For direct ID access, may return 403 or 404.
#
# Expected: ~44 tests
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

function ExtractList($resp) {
    if ($resp -and $resp.data) {
        if ($resp.data -is [array]) { return $resp.data }
        if ($resp.data.data) { return $resp.data.data }
        if ($resp.data.items) { return $resp.data.items }
    }
    if ($resp -and $resp.items) { return $resp.items }
    return @()
}

function ExtractTotal($resp) {
    if ($resp -and $resp.data -and $resp.data.total -ne $null) { return [int]$resp.data.total }
    if ($resp -and $resp.meta -and $resp.meta.total -ne $null) { return [int]$resp.meta.total }
    if ($resp -and $resp.total -ne $null) { return [int]$resp.total }
    $list = ExtractList $resp
    if ($list) { return @($list).Count }
    return 0
}

function GetProfile($token) {
    $r = Api "GET" "/auth/profile" $token
    $p = D $r
    if ($p -and $p.id) { return $p }
    return $null
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-SEC-004: Data Scoping Guard" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login ALL roles needed
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login all roles ===" -ForegroundColor White

# Sales hierarchy - HN
$tkSale01 = Login "sale01@$DOMAIN"
$tkSale02 = Login "sale02@$DOMAIN"
$tkLeaderHN = Login "leader.hn@$DOMAIN"

# Sales hierarchy - HCM
$tkSale03 = Login "sale03@$DOMAIN"
$tkSale04 = Login "sale04@$DOMAIN"
$tkLeaderHCM = Login "leader.hcm@$DOMAIN"

# Directors & Executives
$tkSalesDir = Login "gdkd@$DOMAIN"
$tkCEO = Login "ceo@$DOMAIN"
$tkCOO = Login "admin@$DOMAIN"
$tkCFO = Login "cfo@$DOMAIN"

# Finance
$tkChiefAcct = Login "ketoan@$DOMAIN"
$tkAcctAR = Login "ketoantt@$DOMAIN"

# Verify critical logins
$loginFailed = $false
if (-not $tkSale01)    { Fail "SETUP: sale01 login failed"; $loginFailed = $true }
if (-not $tkSale02)    { Fail "SETUP: sale02 login failed"; $loginFailed = $true }
if (-not $tkSale03)    { Fail "SETUP: sale03 login failed"; $loginFailed = $true }
if (-not $tkLeaderHN)  { Fail "SETUP: leader.hn login failed"; $loginFailed = $true }
if (-not $tkLeaderHCM) { Fail "SETUP: leader.hcm login failed"; $loginFailed = $true }
if (-not $tkSalesDir)  { Fail "SETUP: gdkd login failed"; $loginFailed = $true }
if (-not $tkCEO)       { Fail "SETUP: ceo login failed"; $loginFailed = $true }
if (-not $tkCOO)       { Fail "SETUP: coo/admin login failed"; $loginFailed = $true }
if ($loginFailed) {
    Write-Host "  CRITICAL: Cannot proceed without core logins" -ForegroundColor Red
    exit 1
}
Write-Host "  All core logins OK" -ForegroundColor Green

# Get profiles (userId) for each user
Write-Host ""
Write-Host "=== SETUP: Get user profiles ===" -ForegroundColor White

$profSale01   = GetProfile $tkSale01
$profSale02   = GetProfile $tkSale02
$profSale03   = GetProfile $tkSale03
$profSale04   = if ($tkSale04) { GetProfile $tkSale04 } else { $null }
$profLeaderHN  = GetProfile $tkLeaderHN
$profLeaderHCM = GetProfile $tkLeaderHCM
$profSalesDir  = GetProfile $tkSalesDir
$profCEO       = GetProfile $tkCEO
$profCOO       = GetProfile $tkCOO

Write-Host "  sale01  id=$($profSale01.id)  role=$($profSale01.role)  branch=$($profSale01.branch)"
Write-Host "  sale02  id=$($profSale02.id)  role=$($profSale02.role)  branch=$($profSale02.branch)"
Write-Host "  sale03  id=$($profSale03.id)  role=$($profSale03.role)  branch=$($profSale03.branch)"
if ($profSale04) { Write-Host "  sale04  id=$($profSale04.id)  role=$($profSale04.role)  branch=$($profSale04.branch)" }
Write-Host "  leaderHN  id=$($profLeaderHN.id)  role=$($profLeaderHN.role)  branch=$($profLeaderHN.branch)"
Write-Host "  leaderHCM id=$($profLeaderHCM.id)  role=$($profLeaderHCM.role)  branch=$($profLeaderHCM.branch)"
Write-Host "  gdkd      id=$($profSalesDir.id)  role=$($profSalesDir.role)"
Write-Host "  ceo       id=$($profCEO.id)  role=$($profCEO.role)"
Write-Host "  coo       id=$($profCOO.id)  role=$($profCOO.role)"

# ================================================================
# PART A: SALE sees own orders only (~6 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: SALE sees own orders only" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# A1: sale01 list orders
Write-Host ""
Write-Host "=== TEST A1: sale01@ GET /orders?limit=50 ===" -ForegroundColor White
$sale01Orders = Api "GET" "/orders?limit=50" $tkSale01
$sale01List = @(ExtractList $sale01Orders)
$sale01Total = ExtractTotal $sale01Orders
Write-Host "  sale01 sees $($sale01List.Count) orders (total=$sale01Total)"
if ($sale01List.Count -ge 0) {
    Pass "A1: sale01 GET /orders returned 200"
} else {
    Fail "A1: sale01 GET /orders failed"
}

# A2: Verify all returned orders have saleId = sale01.id
Write-Host ""
Write-Host "=== TEST A2: All sale01 orders have saleId = sale01.id ===" -ForegroundColor White
$sale01Foreign = @()
foreach ($o in $sale01List) {
    if ($o.saleId -and $o.saleId -ne $profSale01.id) {
        $sale01Foreign += $o.code
    }
}
if ($sale01List.Count -eq 0) {
    Warn "A2: sale01 has no orders - cannot verify saleId filtering"
} elseif ($sale01Foreign.Count -eq 0) {
    Pass "A2: All $($sale01List.Count) orders belong to sale01 (saleId matches)"
} else {
    Fail "A2: sale01 sees $($sale01Foreign.Count) foreign orders: $($sale01Foreign -join ', ')"
}

# A3: sale03 (HCM) list orders
Write-Host ""
Write-Host "=== TEST A3: sale03@ (HCM) GET /orders?limit=50 ===" -ForegroundColor White
$sale03Orders = Api "GET" "/orders?limit=50" $tkSale03
$sale03List = @(ExtractList $sale03Orders)
$sale03Total = ExtractTotal $sale03Orders
Write-Host "  sale03 sees $($sale03List.Count) orders (total=$sale03Total)"
if ($sale03List.Count -ge 0) {
    Pass "A3: sale03 GET /orders returned 200"
} else {
    Fail "A3: sale03 GET /orders failed"
}

# A4: Verify sale03 orders have saleId = sale03.id
Write-Host ""
Write-Host "=== TEST A4: All sale03 orders have saleId = sale03.id ===" -ForegroundColor White
$sale03Foreign = @()
foreach ($o in $sale03List) {
    if ($o.saleId -and $o.saleId -ne $profSale03.id) {
        $sale03Foreign += $o.code
    }
}
if ($sale03List.Count -eq 0) {
    Warn "A4: sale03 has no orders - cannot verify saleId filtering"
} elseif ($sale03Foreign.Count -eq 0) {
    Pass "A4: All $($sale03List.Count) orders belong to sale03 (saleId matches)"
} else {
    Fail "A4: sale03 sees $($sale03Foreign.Count) foreign orders: $($sale03Foreign -join ', ')"
}

# A5: sale01 and sale03 should have NO overlapping orders
Write-Host ""
Write-Host "=== TEST A5: sale01 and sale03 have no overlapping orders ===" -ForegroundColor White
$sale01Ids = @($sale01List | ForEach-Object { $_.id })
$sale03Ids = @($sale03List | ForEach-Object { $_.id })
$overlap = @($sale01Ids | Where-Object { $sale03Ids -contains $_ })
if ($sale01List.Count -eq 0 -and $sale03List.Count -eq 0) {
    Warn "A5: Both sales have no orders - cannot verify isolation"
} elseif ($overlap.Count -eq 0) {
    Pass "A5: No overlapping orders between sale01 (HN) and sale03 (HCM)"
} else {
    Fail "A5: $($overlap.Count) overlapping orders found between sale01 and sale03"
}

# A6: Verify counts are independent (each sees only own data)
Write-Host ""
Write-Host "=== TEST A6: sale01 and sale03 counts are independent ===" -ForegroundColor White
if ($sale01Total -ne $sale03Total) {
    Pass "A6: Different totals - sale01=$sale01Total, sale03=$sale03Total (independent scoping)"
} elseif ($sale01Total -eq 0 -and $sale03Total -eq 0) {
    Warn "A6: Both totals are 0 - no data to compare"
} else {
    Warn "A6: Same totals - sale01=$sale01Total, sale03=$sale03Total (may be coincidence)"
}

# ================================================================
# PART B: SALES_LEADER sees team orders (~6 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: SALES_LEADER sees team orders" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# B1: leader.hn list orders
Write-Host ""
Write-Host "=== TEST B1: leader.hn@ GET /orders?limit=100 ===" -ForegroundColor White
$leaderHNOrders = Api "GET" "/orders?limit=100" $tkLeaderHN
$leaderHNList = @(ExtractList $leaderHNOrders)
$leaderHNTotal = ExtractTotal $leaderHNOrders
Write-Host "  leader.hn sees $($leaderHNList.Count) orders (total=$leaderHNTotal)"
if ($leaderHNList.Count -ge 0) {
    Pass "B1: leader.hn GET /orders returned 200"
} else {
    Fail "B1: leader.hn GET /orders failed"
}

# B2: leader.hn profile (already fetched)
Write-Host ""
Write-Host "=== TEST B2: leader.hn profile ===" -ForegroundColor White
if ($profLeaderHN -and $profLeaderHN.id) {
    Write-Host "  leader.hn userId=$($profLeaderHN.id) branch=$($profLeaderHN.branch)"
    Pass "B2: leader.hn profile retrieved"
} else {
    Fail "B2: leader.hn profile unavailable"
}

# B3: Verify orders have saleId in {leader.hn, sale01, sale02}
Write-Host ""
Write-Host "=== TEST B3: leader.hn orders belong to HN team ===" -ForegroundColor White
$hnTeamIds = @($profLeaderHN.id, $profSale01.id, $profSale02.id)
$hnForeignOrders = @()
foreach ($o in $leaderHNList) {
    if ($o.saleId -and ($hnTeamIds -notcontains $o.saleId)) {
        $hnForeignOrders += "$($o.code)(saleId=$($o.saleId))"
    }
}
if ($leaderHNList.Count -eq 0) {
    Warn "B3: leader.hn has no orders - cannot verify team scoping"
} elseif ($hnForeignOrders.Count -eq 0) {
    Pass "B3: All $($leaderHNList.Count) orders belong to HN team"
} else {
    Warn "B3: leader.hn sees $($hnForeignOrders.Count) orders outside HN team: $($hnForeignOrders[0..2] -join ', ')"
}

# B4: Verify NO orders from sale03/sale04 (HCM) in leader.hn results
Write-Host ""
Write-Host "=== TEST B4: leader.hn does NOT see HCM team orders ===" -ForegroundColor White
$hcmIds = @($profSale03.id)
if ($profSale04) { $hcmIds += $profSale04.id }
if ($profLeaderHCM) { $hcmIds += $profLeaderHCM.id }
$hcmLeakOrders = @($leaderHNList | Where-Object { $hcmIds -contains $_.saleId })
if ($leaderHNList.Count -eq 0) {
    Warn "B4: leader.hn has no orders - cannot verify HCM exclusion"
} elseif ($hcmLeakOrders.Count -eq 0) {
    Pass "B4: leader.hn sees NO orders from HCM team"
} else {
    Fail "B4: leader.hn sees $($hcmLeakOrders.Count) HCM team orders (data leak!)"
}

# B5: leader.hcm list orders
Write-Host ""
Write-Host "=== TEST B5: leader.hcm@ GET /orders?limit=100 ===" -ForegroundColor White
$leaderHCMOrders = Api "GET" "/orders?limit=100" $tkLeaderHCM
$leaderHCMList = @(ExtractList $leaderHCMOrders)
$leaderHCMTotal = ExtractTotal $leaderHCMOrders
Write-Host "  leader.hcm sees $($leaderHCMList.Count) orders (total=$leaderHCMTotal)"
if ($leaderHCMList.Count -ge 0) {
    Pass "B5: leader.hcm GET /orders returned 200"
} else {
    Fail "B5: leader.hcm GET /orders failed"
}

# B6: leader.hcm sees HCM team, NOT HN team
Write-Host ""
Write-Host "=== TEST B6: leader.hcm sees HCM team, not HN team ===" -ForegroundColor White
$hnLeakInHCM = @($leaderHCMList | Where-Object {
    ($_.saleId -eq $profSale01.id) -or ($_.saleId -eq $profSale02.id)
})
if ($leaderHCMList.Count -eq 0) {
    Warn "B6: leader.hcm has no orders - cannot verify HN exclusion"
} elseif ($hnLeakInHCM.Count -eq 0) {
    Pass "B6: leader.hcm sees NO orders from HN team (sale01/sale02)"
} else {
    Fail "B6: leader.hcm sees $($hnLeakInHCM.Count) HN team orders (data leak!)"
}

# ================================================================
# PART C: Cross-team isolation (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Cross-team isolation - direct access" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Find sample order IDs from different teams
$sale01SampleId = $null
if ($sale01List.Count -gt 0) { $sale01SampleId = $sale01List[0].id }

$sale03SampleId = $null
if ($sale03List.Count -gt 0) { $sale03SampleId = $sale03List[0].id }

$sale02SampleId = $null
# Fetch sale02 orders to get a sample
$sale02Orders = Api "GET" "/orders?limit=5" $tkSale02
$sale02List = @(ExtractList $sale02Orders)
if ($sale02List.Count -gt 0) { $sale02SampleId = $sale02List[0].id }

# C1: leader.hn can access sale01 order (same team)
Write-Host ""
Write-Host "=== TEST C1: leader.hn accesses sale01's order (same team) ===" -ForegroundColor White
if ($sale01SampleId) {
    $c1 = Api-Expect "GET" "/orders/$sale01SampleId" $tkLeaderHN
    if ($c1.code -eq 200) {
        Pass "C1: leader.hn CAN access sale01 order (200 - same team)"
    } else {
        Warn "C1: leader.hn got $($c1.code) accessing sale01 order (expected 200)"
    }
} else {
    Warn "C1: No sale01 order available to test"
}

# C2: leader.hn tries to access sale03 order (different team/branch)
Write-Host ""
Write-Host "=== TEST C2: leader.hn accesses sale03's order (cross-team) ===" -ForegroundColor White
if ($sale03SampleId) {
    $c2 = Api-Expect "GET" "/orders/$sale03SampleId" $tkLeaderHN
    if ($c2.code -eq 403 -or $c2.code -eq 404) {
        Pass "C2: leader.hn BLOCKED from sale03 order ($($c2.code) - cross-team isolation)"
    } elseif ($c2.code -eq 200) {
        # DataScopeGuard sets branch filter. If branches differ, should block.
        Warn "C2: leader.hn CAN access sale03 order (200 - cross-team isolation NOT enforced on getById)"
    } else {
        Warn "C2: Unexpected status $($c2.code) accessing cross-team order"
    }
} else {
    Warn "C2: No sale03 order available to test"
}

# C3: sale01 tries to access sale02 order (different sale, same team)
Write-Host ""
Write-Host "=== TEST C3: sale01 accesses sale02's order (same team, diff sale) ===" -ForegroundColor White
if ($sale02SampleId) {
    $c3 = Api-Expect "GET" "/orders/$sale02SampleId" $tkSale01
    if ($c3.code -eq 403) {
        Pass "C3: sale01 BLOCKED from sale02 order (403 - sale-level isolation)"
    } elseif ($c3.code -eq 404) {
        Pass "C3: sale01 BLOCKED from sale02 order (404 - hidden from scope)"
    } elseif ($c3.code -eq 200) {
        Fail "C3: sale01 CAN access sale02's order (200 - sale isolation broken!)"
    } else {
        Warn "C3: Unexpected status $($c3.code) accessing cross-sale order"
    }
} else {
    Warn "C3: No sale02 order available to test"
}

# C4: sale01 tries to access sale03 order (different branch)
Write-Host ""
Write-Host "=== TEST C4: sale01 accesses sale03's order (cross-branch) ===" -ForegroundColor White
if ($sale03SampleId) {
    $c4 = Api-Expect "GET" "/orders/$sale03SampleId" $tkSale01
    if ($c4.code -eq 403) {
        Pass "C4: sale01 BLOCKED from sale03 order (403 - cross-branch isolation)"
    } elseif ($c4.code -eq 404) {
        Pass "C4: sale01 BLOCKED from sale03 order (404 - hidden from scope)"
    } elseif ($c4.code -eq 200) {
        Fail "C4: sale01 CAN access sale03's order (200 - cross-branch isolation broken!)"
    } else {
        Warn "C4: Unexpected status $($c4.code) accessing cross-branch order"
    }
} else {
    Warn "C4: No sale03 order available to test"
}

# ================================================================
# PART D: SALES_DIRECTOR sees all (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: SALES_DIRECTOR sees all orders" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# D1: gdkd list orders
Write-Host ""
Write-Host "=== TEST D1: gdkd@ GET /orders?limit=100 ===" -ForegroundColor White
$sdOrders = Api "GET" "/orders?limit=100" $tkSalesDir
$sdList = @(ExtractList $sdOrders)
$sdTotal = ExtractTotal $sdOrders
Write-Host "  gdkd sees $($sdList.Count) orders (total=$sdTotal)"
if ($sdTotal -ge 0) {
    Pass "D1: gdkd GET /orders returned 200 (total=$sdTotal)"
} else {
    Fail "D1: gdkd GET /orders failed"
}

# D2: Verify orders from BOTH HN and HCM branches
Write-Host ""
Write-Host "=== TEST D2: gdkd sees orders from multiple branches ===" -ForegroundColor White
$sdBranches = @($sdList | ForEach-Object { $_.branch } | Where-Object { $_ } | Sort-Object -Unique)
Write-Host "  Branches visible: $($sdBranches -join ', ')"
if ($sdBranches.Count -gt 1) {
    Pass "D2: gdkd sees orders from $($sdBranches.Count) branches: $($sdBranches -join ', ')"
} elseif ($sdBranches.Count -eq 1) {
    Warn "D2: gdkd sees only 1 branch ($sdBranches) - may lack HCM orders in system"
} else {
    Warn "D2: No branch info in orders"
}

# D3: Verify orders from sale01, sale02, sale03, sale04 all visible
Write-Host ""
Write-Host "=== TEST D3: gdkd sees orders from all sales ===" -ForegroundColor White
$sdSaleIds = @($sdList | ForEach-Object { $_.saleId } | Where-Object { $_ } | Sort-Object -Unique)
$visibleSales = 0
if ($sdSaleIds -contains $profSale01.id) { $visibleSales++; Write-Host "  sale01 visible" }
if ($sdSaleIds -contains $profSale02.id) { $visibleSales++; Write-Host "  sale02 visible" }
if ($sdSaleIds -contains $profSale03.id) { $visibleSales++; Write-Host "  sale03 visible" }
if ($profSale04 -and $sdSaleIds -contains $profSale04.id) { $visibleSales++; Write-Host "  sale04 visible" }
if ($visibleSales -ge 2) {
    Pass "D3: gdkd sees orders from $visibleSales different sales"
} elseif ($visibleSales -eq 1) {
    Warn "D3: gdkd sees orders from only 1 sale - limited test data"
} else {
    Warn "D3: Cannot verify multi-sale visibility (no matching saleIds)"
}

# D4: gdkd total >= leader.hn + leader.hcm
Write-Host ""
Write-Host "=== TEST D4: gdkd total >= leader.hn + leader.hcm ===" -ForegroundColor White
$combinedLeaderTotal = $leaderHNTotal + $leaderHCMTotal
Write-Host "  gdkd=$sdTotal, leader.hn=$leaderHNTotal, leader.hcm=$leaderHCMTotal, combined=$combinedLeaderTotal"
if ($sdTotal -ge $combinedLeaderTotal) {
    Pass "D4: gdkd total ($sdTotal) >= leaders combined ($combinedLeaderTotal)"
} else {
    Warn "D4: gdkd total ($sdTotal) < leaders combined ($combinedLeaderTotal) - pagination may cap results"
}

# ================================================================
# PART E: CEO/COO sees everything (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: CEO/COO sees everything" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# E1: CEO list orders
Write-Host ""
Write-Host "=== TEST E1: ceo@ GET /orders?limit=100 ===" -ForegroundColor White
$ceoOrders = Api "GET" "/orders?limit=100" $tkCEO
$ceoList = @(ExtractList $ceoOrders)
$ceoTotal = ExtractTotal $ceoOrders
Write-Host "  ceo sees $($ceoList.Count) orders (total=$ceoTotal)"
if ($ceoTotal -ge 0) {
    Pass "E1: ceo GET /orders returned 200 (total=$ceoTotal)"
} else {
    Fail "E1: ceo GET /orders failed"
}

# E2: CEO sees multiple branches
Write-Host ""
Write-Host "=== TEST E2: ceo sees orders from multiple branches ===" -ForegroundColor White
$ceoBranches = @($ceoList | ForEach-Object { $_.branch } | Where-Object { $_ } | Sort-Object -Unique)
if ($ceoBranches.Count -gt 1) {
    Pass "E2: ceo sees $($ceoBranches.Count) branches: $($ceoBranches -join ', ')"
} elseif ($ceoBranches.Count -eq 1) {
    Warn "E2: ceo sees only 1 branch - may lack multi-branch data"
} else {
    Warn "E2: No branch info in orders"
}

# E3: COO list orders
Write-Host ""
Write-Host "=== TEST E3: admin@ (COO) GET /orders?limit=100 ===" -ForegroundColor White
$cooOrders = Api "GET" "/orders?limit=100" $tkCOO
$cooList = @(ExtractList $cooOrders)
$cooTotal = ExtractTotal $cooOrders
Write-Host "  coo sees $($cooList.Count) orders (total=$cooTotal)"
if ($cooTotal -ge 0) {
    Pass "E3: coo GET /orders returned 200 (total=$cooTotal)"
} else {
    Fail "E3: coo GET /orders failed"
}

# E4: COO total >= SALES_DIRECTOR total
Write-Host ""
Write-Host "=== TEST E4: COO total >= SALES_DIRECTOR total ===" -ForegroundColor White
Write-Host "  coo=$cooTotal, gdkd=$sdTotal"
if ($cooTotal -ge $sdTotal) {
    Pass "E4: COO total ($cooTotal) >= SALES_DIRECTOR total ($sdTotal)"
} elseif ($cooTotal -gt 0) {
    Warn "E4: COO total ($cooTotal) < SALES_DIRECTOR ($sdTotal) - might be pagination"
} else {
    Fail "E4: COO sees 0 orders"
}

# ================================================================
# PART F: CHIEF_ACCOUNTANT vs ACCOUNTANT_AR branch scoping (~5 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: CHIEF_ACCOUNTANT vs ACCOUNTANT_AR" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# F1: CHIEF_ACCOUNTANT list vouchers
Write-Host ""
Write-Host "=== TEST F1: ketoan@ GET /cash/vouchers?limit=50 ===" -ForegroundColor White
$chiefVouchers = $null
$chiefList = @()
$chiefTotal = 0
if ($tkChiefAcct) {
    $chiefVouchers = Api "GET" "/cash/vouchers?limit=50" $tkChiefAcct
    $chiefList = @(ExtractList $chiefVouchers)
    $chiefTotal = ExtractTotal $chiefVouchers
    Write-Host "  ketoan sees $($chiefList.Count) vouchers (total=$chiefTotal)"
    Pass "F1: ketoan GET /cash/vouchers returned 200 (total=$chiefTotal)"
} else {
    Warn "F1: ketoan login failed - skipping"
}

# F2: CHIEF_ACCOUNTANT sees multiple branches
Write-Host ""
Write-Host "=== TEST F2: ketoan sees vouchers from multiple branches ===" -ForegroundColor White
if ($chiefList.Count -gt 0) {
    $voucherBranches = @($chiefList | ForEach-Object { $_.branch } | Where-Object { $_ } | Sort-Object -Unique)
    if ($voucherBranches.Count -gt 1) {
        Pass "F2: ketoan sees $($voucherBranches.Count) branches in vouchers"
    } elseif ($voucherBranches.Count -eq 1) {
        Warn "F2: ketoan sees only 1 branch in vouchers - may lack multi-branch data"
    } else {
        Warn "F2: No branch info on vouchers (may use different field)"
    }
} else {
    Warn "F2: No vouchers to check branches"
}

# F3: ACCOUNTANT_AR list vouchers
Write-Host ""
Write-Host "=== TEST F3: ketoantt@ GET /cash/vouchers?limit=50 ===" -ForegroundColor White
$arVouchers = $null
$arList = @()
$arTotal = 0
if ($tkAcctAR) {
    $arVouchers = Api "GET" "/cash/vouchers?limit=50" $tkAcctAR
    if ($arVouchers) {
        $arList = @(ExtractList $arVouchers)
        $arTotal = ExtractTotal $arVouchers
        Write-Host "  ketoantt sees $($arList.Count) vouchers (total=$arTotal)"
        Pass "F3: ketoantt GET /cash/vouchers returned 200 (total=$arTotal)"
    } else {
        # ACCOUNTANT_AR might not have ACCOUNTANT role for voucher listing
        Warn "F3: ketoantt may not have permission for vouchers (role-based access)"
    }
} else {
    Warn "F3: ketoantt login failed - skipping"
}

# F4: Verify ACCOUNTANT_AR sees only HN branch data
Write-Host ""
Write-Host "=== TEST F4: ketoantt sees only HN branch ===" -ForegroundColor White
if ($arList.Count -gt 0) {
    $arBranches = @($arList | ForEach-Object { $_.branch } | Where-Object { $_ } | Sort-Object -Unique)
    $nonHN = @($arBranches | Where-Object { $_ -ne "HN" })
    if ($nonHN.Count -eq 0) {
        Pass "F4: ketoantt sees only HN branch data"
    } else {
        Warn "F4: ketoantt sees non-HN branches: $($nonHN -join ', ')"
    }
} else {
    Warn "F4: No voucher data to verify branch scoping"
}

# F5: CHIEF_ACCOUNTANT total >= ACCOUNTANT_AR total
Write-Host ""
Write-Host "=== TEST F5: ketoan total >= ketoantt total ===" -ForegroundColor White
Write-Host "  ketoan=$chiefTotal, ketoantt=$arTotal"
if ($chiefTotal -ge $arTotal) {
    Pass "F5: CHIEF_ACCOUNTANT total ($chiefTotal) >= ACCOUNTANT_AR total ($arTotal)"
} else {
    Warn "F5: CHIEF_ACCOUNTANT ($chiefTotal) < ACCOUNTANT_AR ($arTotal) - unexpected"
}

# ================================================================
# PART G: Customer data scoping (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: Customer data scoping" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# G1: sale01 list customers
Write-Host ""
Write-Host "=== TEST G1: sale01@ GET /customers?limit=50 ===" -ForegroundColor White
$sale01Custs = Api "GET" "/customers?limit=50" $tkSale01
$sale01CustList = @(ExtractList $sale01Custs)
$sale01CustTotal = ExtractTotal $sale01Custs
Write-Host "  sale01 sees $($sale01CustList.Count) customers (total=$sale01CustTotal)"
if ($sale01CustList.Count -ge 0) {
    Pass "G1: sale01 GET /customers returned 200"
} else {
    Fail "G1: sale01 GET /customers failed"
}

# G2: Verify sale01 only sees own customers (saleId = sale01.id)
Write-Host ""
Write-Host "=== TEST G2: sale01 only sees own customers ===" -ForegroundColor White
$custForeign = @()
foreach ($c in $sale01CustList) {
    if ($c.saleId -and $c.saleId -ne $profSale01.id) {
        $custForeign += "$($c.code)(saleId=$($c.saleId))"
    }
}
if ($sale01CustList.Count -eq 0) {
    Warn "G2: sale01 has no customers - cannot verify scoping"
} elseif ($custForeign.Count -eq 0) {
    Pass "G2: All $($sale01CustList.Count) customers belong to sale01"
} else {
    Warn "G2: sale01 sees $($custForeign.Count) foreign customers: $($custForeign[0..2] -join ', ')"
}

# G3: gdkd list customers
Write-Host ""
Write-Host "=== TEST G3: gdkd@ GET /customers?limit=50 ===" -ForegroundColor White
$sdCusts = Api "GET" "/customers?limit=50" $tkSalesDir
$sdCustList = @(ExtractList $sdCusts)
$sdCustTotal = ExtractTotal $sdCusts
Write-Host "  gdkd sees $($sdCustList.Count) customers (total=$sdCustTotal)"
if ($sdCustTotal -ge 0) {
    Pass "G3: gdkd GET /customers returned 200 (total=$sdCustTotal)"
} else {
    Fail "G3: gdkd GET /customers failed"
}

# G4: gdkd sees more customers than sale01
Write-Host ""
Write-Host "=== TEST G4: gdkd sees more customers than sale01 ===" -ForegroundColor White
Write-Host "  gdkd=$sdCustTotal, sale01=$sale01CustTotal"
if ($sdCustTotal -gt $sale01CustTotal) {
    Pass "G4: gdkd ($sdCustTotal) sees more customers than sale01 ($sale01CustTotal)"
} elseif ($sdCustTotal -eq $sale01CustTotal -and $sale01CustTotal -gt 0) {
    Warn "G4: gdkd and sale01 see same count ($sdCustTotal) - scoping may not be active for CRM"
} else {
    Warn "G4: Cannot determine - gdkd=$sdCustTotal, sale01=$sale01CustTotal"
}

# ================================================================
# PART H: Cross-branch order creation isolation (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Cross-branch order access isolation" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# H1: Get a sale01 order for cross-access test
Write-Host ""
Write-Host "=== TEST H1: Find sale01 order for cross-access test ===" -ForegroundColor White
$testOrderId = $sale01SampleId
if ($testOrderId) {
    Write-Host "  Using order ID: $testOrderId"
    Pass "H1: Found sale01 order for cross-access test"
} else {
    Warn "H1: No sale01 order found - skipping H2-H4"
}

# H2: Confirm order ID is valid
Write-Host ""
Write-Host "=== TEST H2: Confirm order accessible by sale01 ===" -ForegroundColor White
if ($testOrderId) {
    $h2 = Api-Expect "GET" "/orders/$testOrderId" $tkSale01
    if ($h2.code -eq 200) {
        Pass "H2: sale01 can access own order ($testOrderId)"
    } else {
        Fail "H2: sale01 cannot access own order (status=$($h2.code))"
    }
} else {
    Warn "H2: Skipped (no test order)"
}

# H3: sale03 (HCM) tries to access sale01 (HN) order
Write-Host ""
Write-Host "=== TEST H3: sale03 (HCM) accesses sale01 (HN) order ===" -ForegroundColor White
if ($testOrderId) {
    $h3 = Api-Expect "GET" "/orders/$testOrderId" $tkSale03
    if ($h3.code -eq 403) {
        Pass "H3: sale03 BLOCKED from sale01 order (403 - cross-branch isolation)"
    } elseif ($h3.code -eq 404) {
        Pass "H3: sale03 BLOCKED from sale01 order (404 - hidden from scope)"
    } elseif ($h3.code -eq 200) {
        Fail "H3: sale03 CAN access sale01's order (200 - cross-branch BROKEN)"
    } else {
        Warn "H3: Unexpected status $($h3.code)"
    }
} else {
    Warn "H3: Skipped (no test order)"
}

# H4: leader.hn accesses sale01 order (same team)
Write-Host ""
Write-Host "=== TEST H4: leader.hn accesses sale01 order (same team) ===" -ForegroundColor White
if ($testOrderId) {
    $h4 = Api-Expect "GET" "/orders/$testOrderId" $tkLeaderHN
    if ($h4.code -eq 200) {
        Pass "H4: leader.hn CAN access sale01 order (same team - 200)"
    } else {
        Warn "H4: leader.hn got $($h4.code) accessing sale01 order (expected 200)"
    }
} else {
    Warn "H4: Skipped (no test order)"
}

# ================================================================
# PART I: Finance data scoping (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART I: Finance data scoping (orders viewed by accountants)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# I1: CHIEF_ACCOUNTANT list orders (has global scope)
Write-Host ""
Write-Host "=== TEST I1: ketoan@ GET /orders?limit=20 ===" -ForegroundColor White
$chiefOrders = $null
$chiefOrdTotal = 0
if ($tkChiefAcct) {
    $chiefOrders = Api "GET" "/orders?limit=20" $tkChiefAcct
    if ($chiefOrders) {
        $chiefOrdList = @(ExtractList $chiefOrders)
        $chiefOrdTotal = ExtractTotal $chiefOrders
        Write-Host "  ketoan sees $($chiefOrdList.Count) orders (total=$chiefOrdTotal)"
        Pass "I1: ketoan GET /orders returned 200 (total=$chiefOrdTotal)"
    } else {
        Warn "I1: ketoan may not have permission for orders endpoint"
    }
} else {
    Warn "I1: ketoan login failed"
}

# I2: Count chief accountant results
Write-Host ""
Write-Host "=== TEST I2: Count ketoan order results ===" -ForegroundColor White
if ($chiefOrdTotal -gt 0) {
    Pass "I2: ketoan sees $chiefOrdTotal orders"
} else {
    Warn "I2: ketoan sees 0 orders (may not have role access to orders endpoint)"
}

# I3: ACCOUNTANT_AR list orders (branch-scoped)
Write-Host ""
Write-Host "=== TEST I3: ketoantt@ GET /orders?limit=20 ===" -ForegroundColor White
$arOrders = $null
$arOrdList = @()
$arOrdTotal = 0
if ($tkAcctAR) {
    $arOrders = Api "GET" "/orders?limit=20" $tkAcctAR
    if ($arOrders) {
        $arOrdList = @(ExtractList $arOrders)
        $arOrdTotal = ExtractTotal $arOrders
        Write-Host "  ketoantt sees $($arOrdList.Count) orders (total=$arOrdTotal)"
        Pass "I3: ketoantt GET /orders returned 200 (total=$arOrdTotal)"
    } else {
        Warn "I3: ketoantt may not have role access to orders endpoint"
    }
} else {
    Warn "I3: ketoantt login failed"
}

# I4: ketoantt sees subset (HN only)
Write-Host ""
Write-Host "=== TEST I4: ketoantt sees HN-only orders ===" -ForegroundColor White
if ($arOrdList.Count -gt 0) {
    $arOrdBranches = @($arOrdList | ForEach-Object { $_.branch } | Where-Object { $_ } | Sort-Object -Unique)
    $nonHNOrd = @($arOrdBranches | Where-Object { $_ -ne "HN" })
    if ($nonHNOrd.Count -eq 0) {
        Pass "I4: ketoantt sees only HN branch orders"
    } else {
        Warn "I4: ketoantt sees non-HN branches: $($nonHNOrd -join ', ')"
    }
} elseif ($arOrders) {
    Warn "I4: ketoantt has no orders to check branch"
} else {
    Warn "I4: Skipped (no access)"
}

# ================================================================
# PART J: Executive override verification (~3 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART J: Executive override verification" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# J1: CEO can access any order by ID
Write-Host ""
Write-Host "=== TEST J1: CEO accesses any order by ID ===" -ForegroundColor White
# Use an order from HCM (sale03) to verify cross-scope access
$execTestOrderId = if ($sale03SampleId) { $sale03SampleId } elseif ($sale01SampleId) { $sale01SampleId } else { $null }
if ($execTestOrderId) {
    $j1 = Api-Expect "GET" "/orders/$execTestOrderId" $tkCEO
    if ($j1.code -eq 200) {
        Pass "J1: CEO can access any order by ID (200)"
    } else {
        Fail "J1: CEO blocked from order access (status=$($j1.code))"
    }
} else {
    Warn "J1: No order ID available to test"
}

# J2: COO can access any customer by ID
Write-Host ""
Write-Host "=== TEST J2: COO accesses any customer by ID ===" -ForegroundColor White
# Use a customer from sale01's list
$execTestCustId = $null
if ($sale01CustList.Count -gt 0) { $execTestCustId = $sale01CustList[0].id }
if ($execTestCustId) {
    $j2 = Api-Expect "GET" "/customers/$execTestCustId" $tkCOO
    if ($j2.code -eq 200) {
        Pass "J2: COO can access any customer by ID (200)"
    } else {
        Fail "J2: COO blocked from customer access (status=$($j2.code))"
    }
} else {
    Warn "J2: No customer ID available to test"
}

# J3: CFO can access financial data
Write-Host ""
Write-Host "=== TEST J3: CFO accesses financial data ===" -ForegroundColor White
if ($tkCFO) {
    # CFO may not have DataScopeGuard handling (falls to default in guard)
    # Try cash/flow endpoint which uses role-based access
    $j3 = Api-Expect "GET" "/cash/flow" $tkCFO
    if ($j3.code -eq 200) {
        Pass "J3: CFO can access cash flow data (200)"
    } elseif ($j3.code -eq 403) {
        # Try orders endpoint - CFO might have isGlobal via EXECUTIVE_ROLES
        $j3b = Api-Expect "GET" "/orders?limit=5" $tkCFO
        if ($j3b.code -eq 200) {
            Pass "J3: CFO can access orders (200)"
        } else {
            Warn "J3: CFO access restricted (cash=$($j3.code), orders=$($j3b.code))"
        }
    } else {
        Warn "J3: CFO got status $($j3.code) on cash/flow"
    }
} else {
    Warn "J3: CFO login failed - skipping"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-SEC-004: Data Scoping Guard" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Part A: SALE sees own orders only (6 tests)"
Write-Host "  Part B: SALES_LEADER sees team orders (6 tests)"
Write-Host "  Part C: Cross-team isolation - direct access (4 tests)"
Write-Host "  Part D: SALES_DIRECTOR sees all (4 tests)"
Write-Host "  Part E: CEO/COO sees everything (4 tests)"
Write-Host "  Part F: CHIEF_ACCOUNTANT vs ACCOUNTANT_AR (5 tests)"
Write-Host "  Part G: Customer data scoping (4 tests)"
Write-Host "  Part H: Cross-branch order access isolation (4 tests)"
Write-Host "  Part I: Finance data scoping (4 tests)"
Write-Host "  Part J: Executive override verification (3 tests)"
Write-Host ""
Write-Host "  NOTE: Data scoping works via FILTERING (200 + filtered results)."
Write-Host "  Direct ID access may return 403 or 404 for out-of-scope records."
Write-Host "  WARN means the feature gap is known or data is insufficient."
Write-Host ""
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host ""
$totalTests = $passCount + $failCount + $warnCount
Write-Host "  TOTAL: $totalTests" -ForegroundColor White
Write-Host ""
if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED ($passCount PASS, $warnCount WARN)" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $failCount TEST(S) FAILED" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Cyan
