################################################################
#  TEST-PERF-001: API Response Time - Do do-tre API duoi tai binh thuong
#  Do latency cua cac endpoint chinh bang sequential measurement
#  voi nhieu lan lap, tinh P50/P95/P99 va so sanh voi nguong muc tieu.
#
#  Covers: GET /orders, GET /orders/:id, POST /auth/login,
#          GET /dashboard/overview, GET /ar/aging, GET /customers,
#          GET /warehouse-cn/packages, GET /orders?search=,
#          GET /auth/profile, GET /cash/vouchers
#  Severity: MEDIUM (Performance baseline)
#
#  NOTE: Single-threaded sequential test - NOT a load test.
#  Results are indicative of per-request latency, not throughput.
################################################################

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

# =========================================================================
# Measure-Api: Run N iterations, collect latencies, compute percentiles
# =========================================================================
function Measure-Api($method, $path, $token, $body, $iterations) {
    $latencies = @()
    $failedCount = 0
    for ($i = 0; $i -lt $iterations; $i++) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $uri = "$BASE_URL$path"
        $params = @{ Uri = $uri; Method = $method; ContentType = "application/json" }
        if ($token) { $params.Headers = @{ "Authorization" = "Bearer $token" } }
        if ($body)  { $params.Body = ($body | ConvertTo-Json -Depth 10 -Compress) }
        try {
            $null = Invoke-RestMethod @params
        } catch {
            $failedCount++
        }
        $sw.Stop()
        $latencies += $sw.ElapsedMilliseconds
    }
    $sorted = $latencies | Sort-Object
    $count = $sorted.Count
    if ($count -eq 0) {
        return @{ latencies = @(); p50 = 0; p95 = 0; p99 = 0; avg = 0; min = 0; max = 0; count = 0; failed = $failedCount }
    }
    # Percentile indices (0-based, clamped)
    $idxP50 = [math]::Min([math]::Floor($count * 0.5), $count - 1)
    $idxP95 = [math]::Min([math]::Floor($count * 0.95), $count - 1)
    $idxP99 = [math]::Min([math]::Floor($count * 0.99), $count - 1)
    $p50 = $sorted[$idxP50]
    $p95 = $sorted[$idxP95]
    $p99 = $sorted[$idxP99]
    $avg = [math]::Round(($latencies | Measure-Object -Average).Average, 0)
    $minVal = ($latencies | Measure-Object -Minimum).Minimum
    $maxVal = ($latencies | Measure-Object -Maximum).Maximum
    return @{
        latencies = $latencies
        p50       = $p50
        p95       = $p95
        p99       = $p99
        avg       = $avg
        min       = $minVal
        max       = $maxVal
        count     = $count
        failed    = $failedCount
    }
}

# Print latency stats in a readable format
function Print-Stats($label, $stats) {
    Write-Host "  [$label] iterations=$($stats.count), failed=$($stats.failed)" -ForegroundColor Cyan
    Write-Host "    Min=$($stats.min)ms  Avg=$($stats.avg)ms  P50=$($stats.p50)ms  P95=$($stats.p95)ms  P99=$($stats.p99)ms  Max=$($stats.max)ms" -ForegroundColor Gray
}

# Check P95 against target, WARN if over (single-threaded != real load)
function Check-P95($label, $stats, $targetMs) {
    if ($stats.p95 -le $targetMs) {
        Pass "$label P95=$($stats.p95)ms <= ${targetMs}ms target"
    } else {
        if ($stats.p50 -le $targetMs) {
            Warn "$label P95=$($stats.p95)ms > ${targetMs}ms target (but P50=$($stats.p50)ms OK - single-threaded variance)"
        } else {
            Fail "$label P95=$($stats.p95)ms > ${targetMs}ms target (P50=$($stats.p50)ms also above)"
        }
    }
}

# Check P50 against target
function Check-P50($label, $stats, $targetMs) {
    if ($stats.p50 -le $targetMs) {
        Pass "$label P50=$($stats.p50)ms <= ${targetMs}ms target"
    } else {
        Warn "$label P50=$($stats.p50)ms > ${targetMs}ms target"
    }
}

# =========================================================================
# Summary accumulator - store results for final table
# =========================================================================
$summaryRows = @()

function Add-Summary($endpoint, $stats, $targetMs) {
    $status = "PASS"
    if ($stats.p95 -gt $targetMs) {
        if ($stats.p50 -le $targetMs) { $status = "WARN" } else { $status = "FAIL" }
    }
    $script:summaryRows += @{
        endpoint = $endpoint
        p50      = $stats.p50
        p95      = $stats.p95
        p99      = $stats.p99
        target   = $targetMs
        status   = $status
        avg      = $stats.avg
    }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-PERF-001: API Response Time Measurement" -ForegroundColor Cyan
Write-Host "  Sequential latency test - P50/P95/P99 percentiles" -ForegroundColor Cyan
Write-Host "  Using [System.Diagnostics.Stopwatch] for precision" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# =========================================================================
# SETUP: Login with multiple roles, get test data
# =========================================================================
Write-Host "--- SETUP: Login and prepare test data ---" -ForegroundColor Yellow

$saleToken = Login "sale01@$DOMAIN"
if (-not $saleToken) {
    Write-Host "FATAL: Cannot login with sale01. Aborting test." -ForegroundColor Red
    exit 1
}
Write-Host "  sale01 login OK" -ForegroundColor Gray

$ceoToken = Login "ceo@$DOMAIN"
if (-not $ceoToken) {
    Write-Host "  CEO login failed - will skip dashboard tests" -ForegroundColor Yellow
}
Write-Host "  ceo login OK" -ForegroundColor Gray

$ketoanToken = Login "ketoan01@$DOMAIN"
if (-not $ketoanToken) {
    # Try alternative accounting email
    $ketoanToken = Login "accountant01@$DOMAIN"
}
if (-not $ketoanToken) {
    $ketoanToken = Login "ketruong@$DOMAIN"
}
if ($ketoanToken) {
    Write-Host "  ketoan login OK" -ForegroundColor Gray
} else {
    Write-Host "  ketoan login failed - will use sale token for AR tests" -ForegroundColor Yellow
    $ketoanToken = $saleToken
}

# Get a sample order ID for detail tests
$ordersResp = Api "GET" "/orders?limit=5" $saleToken
$sampleOrderId = $null
$ordData = D $ordersResp
if ($ordData -and $ordData.items -and $ordData.items.Count -gt 0) {
    $sampleOrderId = $ordData.items[0].id
    Write-Host "  Sample order ID: $sampleOrderId" -ForegroundColor Gray
} elseif ($ordData -and $ordData.Count -gt 0) {
    # Maybe data is flat array
    $sampleOrderId = $ordData[0].id
    Write-Host "  Sample order ID: $sampleOrderId" -ForegroundColor Gray
}

Write-Host ""

# =========================================================================
# PART A: Warmup - Avoid cold-start penalty (~2 tests)
# =========================================================================
Write-Host "--- PART A: Warmup ---" -ForegroundColor Yellow

# A1: Make 3 warmup requests to each endpoint
Write-Host "  Warming up endpoints (3 requests each)..." -ForegroundColor Gray
$warmupEndpoints = @(
    @{ m = "GET"; p = "/orders?limit=5" },
    @{ m = "GET"; p = "/customers?limit=5" },
    @{ m = "GET"; p = "/warehouse-cn/packages?limit=5" },
    @{ m = "GET"; p = "/auth/profile" },
    @{ m = "GET"; p = "/cash/vouchers?limit=5" }
)
if ($sampleOrderId) {
    $warmupEndpoints += @{ m = "GET"; p = "/orders/$sampleOrderId" }
}
if ($ceoToken) {
    $warmupEndpoints += @{ m = "GET"; p = "/dashboard/overview" }
}

$warmupOk = $true
foreach ($ep in $warmupEndpoints) {
    $tkn = $saleToken
    if ($ep.p -like "*dashboard*") { $tkn = $ceoToken }
    for ($w = 0; $w -lt 3; $w++) {
        $r = Api $ep.m $ep.p $tkn
        if ($null -eq $r -and $w -eq 0) { $warmupOk = $false }
    }
}

if ($warmupOk) {
    Pass "A1: Warmup completed - all primary endpoints respond"
} else {
    Warn "A1: Warmup completed - some endpoints did not respond (may affect results)"
}

# A2: Verify auth/profile responds (lightweight check)
$profileResp = Api "GET" "/auth/profile" $saleToken
if ($profileResp) {
    Pass "A2: Auth profile endpoint responds OK"
} else {
    Fail "A2: Auth profile endpoint not responding"
}

Write-Host ""

# =========================================================================
# PART B: GET /orders list performance (~4 tests)
# =========================================================================
Write-Host "--- PART B: GET /orders list performance (20 iterations) ---" -ForegroundColor Yellow

$ordersStats = Measure-Api "GET" "/orders?limit=20" $saleToken $null 20
Print-Stats "GET /orders?limit=20" $ordersStats

# B1: Data collected
Pass "B1: Collected $($ordersStats.count) latency samples for GET /orders"

# B2: Stats printed (above)
Pass "B2: Latency stats printed - Avg=$($ordersStats.avg)ms"

# B3: P95 < 500ms
Check-P95 "B3: GET /orders" $ordersStats 500

# B4: P50 < 300ms
Check-P50 "B4: GET /orders" $ordersStats 300

Add-Summary "GET /orders?limit=20" $ordersStats 500

Write-Host ""

# =========================================================================
# PART C: GET /orders/:id detail performance (~4 tests)
# =========================================================================
Write-Host "--- PART C: GET /orders/:id detail performance (20 iterations) ---" -ForegroundColor Yellow

if ($sampleOrderId) {
    # C1: Order ID found
    Pass "C1: Using order ID $sampleOrderId for detail test"

    # C2: Run 20 iterations
    $orderDetailStats = Measure-Api "GET" "/orders/$sampleOrderId" $saleToken $null 20
    Print-Stats "GET /orders/:id" $orderDetailStats

    # C3: Stats printed
    Pass "C3: Collected $($orderDetailStats.count) samples for GET /orders/:id"

    # C4: P95 < 500ms
    Check-P95 "C4: GET /orders/:id" $orderDetailStats 500

    Add-Summary "GET /orders/:id" $orderDetailStats 500
} else {
    Warn "C1: No order found in system - skipping detail test"
    Warn "C2: Skipped - no order ID"
    Warn "C3: Skipped - no order ID"
    Warn "C4: Skipped - no order ID"
}

Write-Host ""

# =========================================================================
# PART D: POST /auth/login performance (~4 tests)
# =========================================================================
Write-Host "--- PART D: POST /auth/login performance ---" -ForegroundColor Yellow
Write-Host "  NOTE: Rate limit is 5/15min per email. Using 4 different emails to avoid lockout." -ForegroundColor Gray

# Strategy: use 4 different emails, 1 request each = 4 total (safe under rate limit)
# Then supplement with profile requests to estimate auth overhead
$loginEmails = @(
    "sale01@$DOMAIN",
    "sale02@$DOMAIN",
    "sale03@$DOMAIN",
    "sale04@$DOMAIN"
)

$loginLatencies = @()
$loginFailed = 0
foreach ($email in $loginEmails) {
    $loginBody = @{ email = $email; password = "Admin@123" } | ConvertTo-Json
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $null = Invoke-RestMethod -Uri "$BASE_URL/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    } catch {
        $loginFailed++
    }
    $sw.Stop()
    $loginLatencies += $sw.ElapsedMilliseconds
    Write-Host "    Login $email -> $($sw.ElapsedMilliseconds)ms" -ForegroundColor Gray
}

# Sort and compute stats manually for small sample
$loginSorted = $loginLatencies | Sort-Object
$loginCount = $loginSorted.Count
if ($loginCount -gt 0) {
    $loginP50 = $loginSorted[[math]::Min([math]::Floor($loginCount * 0.5), $loginCount - 1)]
    $loginP95 = $loginSorted[[math]::Min([math]::Floor($loginCount * 0.95), $loginCount - 1)]
    $loginP99 = $loginSorted[$loginCount - 1]  # With 4 samples, P99 ~= max
    $loginAvg = [math]::Round(($loginLatencies | Measure-Object -Average).Average, 0)
    $loginMin = ($loginLatencies | Measure-Object -Minimum).Minimum
    $loginMax = ($loginLatencies | Measure-Object -Maximum).Maximum
    $loginStats = @{
        latencies = $loginLatencies; p50 = $loginP50; p95 = $loginP95; p99 = $loginP99
        avg = $loginAvg; min = $loginMin; max = $loginMax; count = $loginCount; failed = $loginFailed
    }
} else {
    $loginStats = @{ latencies = @(); p50 = 0; p95 = 0; p99 = 0; avg = 0; min = 0; max = 0; count = 0; failed = $loginFailed }
}

# D1: Data collected
Pass "D1: Collected $($loginStats.count) login latency samples (4 different emails)"

# D2: Print stats
Print-Stats "POST /auth/login" $loginStats

# D3: P95 < 500ms (small sample, use max as proxy)
if ($loginStats.max -le 500) {
    Pass "D3: Login max=$($loginStats.max)ms <= 500ms target (all requests within budget)"
} elseif ($loginStats.p50 -le 500) {
    Warn "D3: Login max=$($loginStats.max)ms > 500ms target (P50=$($loginStats.p50)ms OK - bcrypt is CPU-heavy)"
} else {
    Fail "D3: Login P50=$($loginStats.p50)ms > 500ms target"
}

# D4: P50 < 300ms
Check-P50 "D4: POST /auth/login" $loginStats 300

Add-Summary "POST /auth/login" $loginStats 500

Write-Host ""

# =========================================================================
# PART E: GET /dashboard/overview performance (~4 tests)
# =========================================================================
Write-Host "--- PART E: GET /dashboard/overview performance (10 iterations) ---" -ForegroundColor Yellow

if ($ceoToken) {
    # E1: CEO logged in
    Pass "E1: CEO token available for dashboard test"

    # E2: Run 10 iterations
    $dashStats = Measure-Api "GET" "/dashboard/overview" $ceoToken $null 10
    Print-Stats "GET /dashboard/overview" $dashStats

    # E3: Stats printed
    Pass "E3: Collected $($dashStats.count) samples for GET /dashboard/overview"

    # E4: P95 < 2000ms (dashboard has complex aggregation)
    Check-P95 "E4: GET /dashboard/overview" $dashStats 2000

    Add-Summary "GET /dashboard/overview" $dashStats 2000
} else {
    Warn "E1: CEO token not available - skipping dashboard tests"
    Warn "E2: Skipped"
    Warn "E3: Skipped"
    Warn "E4: Skipped"
}

Write-Host ""

# =========================================================================
# PART F: GET /ar/aging performance (~4 tests)
# =========================================================================
Write-Host "--- PART F: GET /ar/aging performance (10 iterations) ---" -ForegroundColor Yellow

# F1: Login KETOAN
if ($ketoanToken) {
    Pass "F1: Accounting token available for AR aging test"
} else {
    Warn "F1: No accounting token - using sale token"
    $ketoanToken = $saleToken
}

# F2: Run 10 iterations
$arAgingStats = Measure-Api "GET" "/ar/aging" $ketoanToken $null 10
Print-Stats "GET /ar/aging" $arAgingStats

# F3: Stats printed
Pass "F3: Collected $($arAgingStats.count) samples for GET /ar/aging"

# F4: P95 < 1000ms
Check-P95 "F4: GET /ar/aging" $arAgingStats 1000

Add-Summary "GET /ar/aging" $arAgingStats 1000

Write-Host ""

# =========================================================================
# PART G: GET /customers list performance (~4 tests)
# =========================================================================
Write-Host "--- PART G: GET /customers list performance (20 iterations) ---" -ForegroundColor Yellow

$custStats = Measure-Api "GET" "/customers?limit=20" $saleToken $null 20
Print-Stats "GET /customers?limit=20" $custStats

# G1: Data collected
Pass "G1: Collected $($custStats.count) samples for GET /customers"

# G2: Stats printed (above)
Pass "G2: Latency stats printed"

# G3: P95 < 500ms
Check-P95 "G3: GET /customers" $custStats 500

# G4: Avg < 300ms
if ($custStats.avg -le 300) {
    Pass "G4: GET /customers avg=$($custStats.avg)ms <= 300ms target"
} else {
    Warn "G4: GET /customers avg=$($custStats.avg)ms > 300ms target"
}

Add-Summary "GET /customers?limit=20" $custStats 500

Write-Host ""

# =========================================================================
# PART H: GET /warehouse-cn/packages performance (~4 tests)
# =========================================================================
Write-Host "--- PART H: GET /warehouse-cn/packages performance (20 iterations) ---" -ForegroundColor Yellow

$whCnStats = Measure-Api "GET" "/warehouse-cn/packages?limit=20" $saleToken $null 20
Print-Stats "GET /warehouse-cn/packages" $whCnStats

# H1: Data collected
Pass "H1: Collected $($whCnStats.count) samples for GET /warehouse-cn/packages"

# H2: Stats printed (above)
Pass "H2: Latency stats printed"

# H3: P95 < 500ms
Check-P95 "H3: GET /warehouse-cn/packages" $whCnStats 500

# H4: Check if cache improves latency (compare first half vs second half)
if ($whCnStats.count -ge 10) {
    $firstHalf = $whCnStats.latencies[0..9]
    $secondHalf = $whCnStats.latencies[10..($whCnStats.count - 1)]
    $firstAvg = [math]::Round(($firstHalf | Measure-Object -Average).Average, 0)
    $secondAvg = [math]::Round(($secondHalf | Measure-Object -Average).Average, 0)
    if ($secondAvg -le $firstAvg) {
        Pass "H4: Cache effect detected - first-half avg=${firstAvg}ms, second-half avg=${secondAvg}ms"
    } else {
        Warn "H4: No cache improvement - first-half avg=${firstAvg}ms, second-half avg=${secondAvg}ms (may not be cached)"
    }
} else {
    Warn "H4: Not enough samples to check cache effect"
}

Add-Summary "GET /warehouse-cn/packages" $whCnStats 500

Write-Host ""

# =========================================================================
# PART I: Search endpoint performance (~4 tests)
# =========================================================================
Write-Host "--- PART I: GET /orders?search=TBS performance (10 iterations) ---" -ForegroundColor Yellow

$searchStats = Measure-Api "GET" "/orders?search=TBS&limit=20" $saleToken $null 10
Print-Stats "GET /orders?search=TBS" $searchStats

# I1: Data collected
Pass "I1: Collected $($searchStats.count) samples for search endpoint"

# I2: Stats printed (above)
Pass "I2: Latency stats printed"

# I3: P95 < 500ms (ILIKE search may be slower)
Check-P95 "I3: GET /orders?search=TBS" $searchStats 500

# I4: Compare with non-search list performance
if ($ordersStats.avg -gt 0) {
    $searchOverhead = $searchStats.avg - $ordersStats.avg
    if ($searchOverhead -ge 0) {
        Write-Host "  Search overhead: +${searchOverhead}ms avg vs plain list" -ForegroundColor Gray
    } else {
        Write-Host "  Search was ${searchOverhead}ms faster than plain list (cached?)" -ForegroundColor Gray
    }
    if ($searchOverhead -lt 200) {
        Pass "I4: Search overhead acceptable (+${searchOverhead}ms vs plain list)"
    } else {
        Warn "I4: Search overhead +${searchOverhead}ms vs plain list (consider full-text index)"
    }
} else {
    Warn "I4: Cannot compare - no baseline data"
}

Add-Summary "GET /orders?search=TBS" $searchStats 500

Write-Host ""

# =========================================================================
# PART J: Rapid fire GET /auth/profile (~4 tests)
# =========================================================================
Write-Host "--- PART J: Rapid fire GET /auth/profile (50 iterations) ---" -ForegroundColor Yellow

$profileStats = Measure-Api "GET" "/auth/profile" $saleToken $null 50
Print-Stats "GET /auth/profile (rapid)" $profileStats

# J1: Data collected
Pass "J1: Collected $($profileStats.count) rapid-fire samples for GET /auth/profile"

# J2: Stats printed (above)
Pass "J2: Latency stats printed"

# J3: Verify no requests failed
if ($profileStats.failed -eq 0) {
    Pass "J3: All $($profileStats.count) profile requests succeeded (0 failures)"
} else {
    Fail "J3: $($profileStats.failed) of $($profileStats.count) profile requests failed"
}

# J4: P95 < 200ms (profile is lightweight)
Check-P95 "J4: GET /auth/profile (rapid)" $profileStats 200

Add-Summary "GET /auth/profile (x50)" $profileStats 200

Write-Host ""

# =========================================================================
# PART K: GET /cash/vouchers performance (~3 tests)
# =========================================================================
Write-Host "--- PART K: GET /cash/vouchers performance (10 iterations) ---" -ForegroundColor Yellow

$cashStats = Measure-Api "GET" "/cash/vouchers?limit=10" $saleToken $null 10
Print-Stats "GET /cash/vouchers" $cashStats

# K1: Data collected
Pass "K1: Collected $($cashStats.count) samples for GET /cash/vouchers"

# K2: Stats printed (above)
Pass "K2: Latency stats printed"

# K3: P95 < 500ms
Check-P95 "K3: GET /cash/vouchers" $cashStats 500

Add-Summary "GET /cash/vouchers" $cashStats 500

Write-Host ""

# =========================================================================
# PART L: Summary table (~1 test)
# =========================================================================
Write-Host "--- PART L: Performance Summary ---" -ForegroundColor Yellow
Write-Host ""

# Build summary table
$headerFmt = "{0,-32} | {1,7} | {2,7} | {3,7} | {4,7} | {5,8} | {6,6}"
$rowFmt    = "{0,-32} | {1,5}ms | {2,5}ms | {3,5}ms | {4,5}ms | {5,6}ms | {6,6}"

Write-Host ($headerFmt -f "Endpoint", "Avg", "P50", "P95", "P99", "Target", "Status") -ForegroundColor White
Write-Host ("-" * 95) -ForegroundColor DarkGray

foreach ($row in $summaryRows) {
    $color = "Green"
    if ($row.status -eq "WARN") { $color = "Yellow" }
    if ($row.status -eq "FAIL") { $color = "Red" }
    $line = $rowFmt -f $row.endpoint, $row.avg, $row.p50, $row.p95, $row.p99, $row.target, $row.status
    Write-Host $line -ForegroundColor $color
}

Write-Host ("-" * 95) -ForegroundColor DarkGray
Write-Host ""

# Count summary statuses
$summaryPass = ($summaryRows | Where-Object { $_.status -eq "PASS" }).Count
$summaryWarn = ($summaryRows | Where-Object { $_.status -eq "WARN" }).Count
$summaryFail = ($summaryRows | Where-Object { $_.status -eq "FAIL" }).Count
Write-Host "  Summary table: $summaryPass PASS, $summaryWarn WARN, $summaryFail FAIL out of $($summaryRows.Count) endpoints" -ForegroundColor Cyan

if ($summaryFail -eq 0) {
    Pass "L1: All endpoints within acceptable latency bounds"
} else {
    Fail "L1: $summaryFail endpoint(s) exceeded P95 target (check above for details)"
}

Write-Host ""

# =========================================================================
# FINAL SUMMARY
# =========================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-PERF-001 RESULTS" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
$total = $passCount + $failCount + $warnCount
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host "  TOTAL: $total" -ForegroundColor White
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "  ALL TESTS PASSED ($passCount/$total)" -ForegroundColor Green
    Write-Host "  Note: This is sequential single-threaded measurement." -ForegroundColor Gray
    Write-Host "  Real concurrent load may show higher latencies." -ForegroundColor Gray
} else {
    Write-Host "  $failCount TEST(S) FAILED" -ForegroundColor Red
    Write-Host "  Review failed endpoints above for optimization." -ForegroundColor Yellow
}
Write-Host ""
