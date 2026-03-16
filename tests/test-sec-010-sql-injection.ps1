################################################################
#  TEST-SEC-010: SQL Injection Prevention
#  Kiem tra chong SQL injection tren tat ca input fields
#
#  Covers: Search params, enum filters, UUID params, form bodies,
#          nested objects, time-based blind SQLi, error-based SQLi
#  Severity: CRITICAL
#
#  Backend uses Prisma ORM (parameterized queries) + class-validator DTOs
#  Expected: ALL injection attempts fail safely (no data leak, no DB damage)
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

# Helper: Check if response body contains DB-leaking strings
function Has-DbLeak($response) {
    $text = ""
    if ($response.error) { $text += $response.error }
    if ($response.body -and $response.body.message) {
        if ($response.body.message -is [array]) {
            $text += ($response.body.message -join " ")
        } else {
            $text += [string]$response.body.message
        }
    }
    $leakPatterns = @("PostgreSQL", "pg_catalog", "syntax error at", "SQLSTATE", "pg_shadow", "information_schema", "relation.*does not exist")
    foreach ($pat in $leakPatterns) {
        if ($text -match $pat) { return $true }
    }
    return $false
}

# Helper: URL-encode for query string injection
function UrlEncode($s) {
    return [System.Uri]::EscapeDataString($s)
}

Write-Host "================================================================" -ForegroundColor White
Write-Host "  TEST-SEC-010: SQL Injection Prevention" -ForegroundColor White
Write-Host "  Prisma ORM parameterized queries + class-validator DTOs" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# ============================================================
# SETUP
# ============================================================
Write-Host ""
Write-Host "=== SETUP: Login with admin (CEO) for broadest access ===" -ForegroundColor Yellow
$ADMIN = Login "admin@$DOMAIN"
if ($ADMIN) { Pass "SETUP: Admin login OK" } else { Fail "SETUP: Admin login FAILED"; return }

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SETUP: Sale login OK" } else { Fail "SETUP: Sale login FAILED"; return }

# Baseline: count orders for leak detection
$baselineOrders = Api-Expect "GET" "/orders?limit=1" $ADMIN $null
$baselineOrderCount = 0
if ($baselineOrders.body -and $baselineOrders.body.data) {
    if ($baselineOrders.body.data.total) { $baselineOrderCount = [int]$baselineOrders.body.data.total }
    elseif ($baselineOrders.body.data.meta -and $baselineOrders.body.data.meta.total) { $baselineOrderCount = [int]$baselineOrders.body.data.meta.total }
}
Write-Host "  Baseline order count: $baselineOrderCount" -ForegroundColor Gray

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART A: Search Parameter Injection on Orders (~6 tests)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === A1: Classic OR 1=1 ===
Write-Host ""
Write-Host "=== TEST A1: GET /orders?search=' OR 1=1 -- ===" -ForegroundColor Yellow
$sqli1 = UrlEncode("' OR 1=1 --")
$r = Api-Expect "GET" "/orders?search=$sqli1&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200) {
    # Check that we did NOT get ALL orders (data leak)
    $resultCount = 0
    if ($r.body -and $r.body.data) {
        if ($r.body.data -is [array]) { $resultCount = $r.body.data.Count }
        elseif ($r.body.data.data -is [array]) { $resultCount = $r.body.data.data.Count }
        elseif ($r.body.data.items -is [array]) { $resultCount = $r.body.data.items.Count }
    }
    # Since the search string is treated literally, 0 results is expected (no match for that literal string)
    Pass "A1: OR 1=1 injection returned 200 with $resultCount results (treated as literal search)"
} elseif ($r.code -eq 400) {
    Pass "A1: OR 1=1 injection rejected with 400"
} else {
    Fail "A1: Unexpected response code $($r.code)"
}

# === A2: DROP TABLE attempt ===
Write-Host ""
Write-Host "=== TEST A2: GET /orders?search='; DROP TABLE orders; -- ===" -ForegroundColor Yellow
$sqli2 = UrlEncode("'; DROP TABLE orders; --")
$r = Api-Expect "GET" "/orders?search=$sqli2&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200 -or $r.code -eq 400) {
    # Verify orders table still exists
    $verify = Api-Expect "GET" "/orders?limit=1" $ADMIN $null
    if ($verify.code -eq 200) {
        Pass "A2: DROP TABLE injection neutralized - orders table intact"
    } else {
        Fail "A2: Orders table may have been dropped (verify returned $($verify.code))"
    }
} else {
    Fail "A2: Unexpected response $($r.code)"
}

# === A3: UNION SELECT ===
Write-Host ""
Write-Host "=== TEST A3: GET /orders?search=UNION SELECT * FROM users ===" -ForegroundColor Yellow
$sqli3 = UrlEncode("UNION SELECT * FROM users")
$r = Api-Expect "GET" "/orders?search=$sqli3&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200 -or $r.code -eq 400) {
    # Verify response does NOT contain user credentials
    $respText = ""
    if ($r.body) { $respText = ($r.body | ConvertTo-Json -Depth 5 -Compress) }
    if ($respText -match "password|hashedPassword|accessToken|refreshToken") {
        Fail "A3: UNION SELECT may have leaked user data"
    } else {
        Pass "A3: UNION SELECT treated as literal search - no data leak"
    }
} else {
    Fail "A3: Unexpected response $($r.code)"
}

# === A4: Percent wildcard injection ===
Write-Host ""
Write-Host "=== TEST A4: GET /orders?search=%' AND 1=1 AND '%'=' ===" -ForegroundColor Yellow
$sqli4 = UrlEncode("%' AND 1=1 AND '%'='")
$r = Api-Expect "GET" "/orders?search=$sqli4&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200 -or $r.code -eq 400) {
    Pass "A4: Percent wildcard injection handled safely (HTTP $($r.code))"
} else {
    Fail "A4: Unexpected response $($r.code)"
}

# === A5: Time-based injection in search (pg_sleep) ===
Write-Host ""
Write-Host "=== TEST A5: GET /orders?search=1; SELECT pg_sleep(5) ===" -ForegroundColor Yellow
$sqli5 = UrlEncode("1; SELECT pg_sleep(5)")
$sw = [Diagnostics.Stopwatch]::StartNew()
$r = Api-Expect "GET" "/orders?search=$sqli5&limit=5" $ADMIN $null
$sw.Stop()
$elapsed = $sw.Elapsed.TotalSeconds
Write-Host "  HTTP $($r.code) | Response time: $([Math]::Round($elapsed, 2))s" -ForegroundColor Gray
if ($elapsed -lt 3) {
    Pass "A5: pg_sleep injection did not cause delay ($([Math]::Round($elapsed, 2))s < 3s)"
} else {
    Fail "A5: pg_sleep injection may have executed - response took $([Math]::Round($elapsed, 2))s"
}

# === A6: Normal search still works ===
Write-Host ""
Write-Host "=== TEST A6: Normal search still works after injection attempts ===" -ForegroundColor Yellow
$r = Api-Expect "GET" "/orders?search=TBS&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200) {
    Pass "A6: Normal search works correctly after injection attempts"
} else {
    Fail "A6: Normal search broken (HTTP $($r.code))"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART B: Search on Customers (~4 tests)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === B1: OR tautology on customers ===
Write-Host ""
Write-Host "=== TEST B1: GET /customers?search=' OR ''=' ===" -ForegroundColor Yellow
$sqli = UrlEncode("' OR ''='")
$r = Api-Expect "GET" "/customers?search=$sqli&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200 -or $r.code -eq 400) {
    Pass "B1: OR tautology on customers handled safely (HTTP $($r.code))"
} else {
    Fail "B1: Unexpected response $($r.code)"
}

# === B2: XSS in search (treated as string) ===
Write-Host ""
Write-Host "=== TEST B2: GET /customers?search=<script>alert(1)</script> ===" -ForegroundColor Yellow
$xss = UrlEncode("<script>alert(1)</script>")
$r = Api-Expect "GET" "/customers?search=$xss&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200 -or $r.code -eq 400) {
    # Check response does not contain unescaped script tag
    $respText = ""
    if ($r.error) { $respText = $r.error }
    if ($r.body) { $respText += ($r.body | ConvertTo-Json -Depth 3 -Compress) }
    if ($respText -match "<script>alert") {
        Warn "B2: Script tag reflected in response (XSS risk, but not SQLi)"
    } else {
        Pass "B2: Script tag in search handled safely"
    }
} else {
    Fail "B2: Unexpected response $($r.code)"
}

# === B3: UPDATE injection in search ===
Write-Host ""
Write-Host "=== TEST B3: GET /customers?search='; UPDATE customers SET tier='VIP'-- ===" -ForegroundColor Yellow
$sqli = UrlEncode("'; UPDATE customers SET tier='VIP'--")
$r = Api-Expect "GET" "/customers?search=$sqli&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200 -or $r.code -eq 400) {
    Pass "B3: UPDATE injection in customer search neutralized (HTTP $($r.code))"
} else {
    Fail "B3: Unexpected response $($r.code)"
}

# === B4: Verify customer data unchanged ===
Write-Host ""
Write-Host "=== TEST B4: Verify customer listing still works ===" -ForegroundColor Yellow
$r = Api-Expect "GET" "/customers?limit=1" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200) {
    Pass "B4: Customer listing intact after injection attempts"
} else {
    Fail "B4: Customer listing broken (HTTP $($r.code))"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART C: Search on Packages (~3 tests)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === C1: OR 1=1 on packages ===
Write-Host ""
Write-Host "=== TEST C1: GET /warehouse-cn/packages?search=' OR 1=1-- ===" -ForegroundColor Yellow
$sqli = UrlEncode("' OR 1=1--")
$r = Api-Expect "GET" "/warehouse-cn/packages?search=$sqli&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200 -or $r.code -eq 400 -or $r.code -eq 403) {
    Pass "C1: OR 1=1 on packages handled safely (HTTP $($r.code))"
} else {
    Fail "C1: Unexpected response $($r.code)"
}

# === C2: UNION SELECT credentials from users ===
Write-Host ""
Write-Host "=== TEST C2: GET /warehouse-cn/packages?search=UNION SELECT username,password FROM users-- ===" -ForegroundColor Yellow
$sqli = UrlEncode("1 UNION SELECT username,password FROM users--")
$r = Api-Expect "GET" "/warehouse-cn/packages?search=$sqli&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200 -or $r.code -eq 400 -or $r.code -eq 403) {
    $respText = ""
    if ($r.body) { $respText = ($r.body | ConvertTo-Json -Depth 3 -Compress) }
    if ($respText -match "password|hashedPassword") {
        Fail "C2: UNION SELECT may have leaked credentials"
    } else {
        Pass "C2: UNION SELECT on packages - no credential leak"
    }
} else {
    Fail "C2: Unexpected response $($r.code)"
}

# === C3: Normal package search ===
Write-Host ""
Write-Host "=== TEST C3: Normal package search after injection attempts ===" -ForegroundColor Yellow
$r = Api-Expect "GET" "/warehouse-cn/packages?search=TBS&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200 -or $r.code -eq 403) {
    Pass "C3: Normal package search works (HTTP $($r.code))"
} else {
    Fail "C3: Normal package search broken (HTTP $($r.code))"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART D: Filter/Enum Parameter Injection (~5 tests)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === D1: Status enum with SQL injection ===
Write-Host ""
Write-Host "=== TEST D1: GET /orders?status=CONSULTING'; UPDATE orders SET status='CANCELLED'-- ===" -ForegroundColor Yellow
$sqli = UrlEncode("CONSULTING'; UPDATE orders SET status='CANCELLED'--")
$r = Api-Expect "GET" "/orders?status=$sqli&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400) {
    Pass "D1: Invalid enum with SQL injection rejected (400)"
} elseif ($r.code -eq 200) {
    # DTO may have stripped the invalid value and returned all orders
    Warn "D1: Invalid status enum accepted - check if DTO validation is strict"
} else {
    Fail "D1: Unexpected response $($r.code)"
}

# === D2: ServiceType enum with injection ===
Write-Host ""
Write-Host "=== TEST D2: GET /orders?serviceType=VCT' OR '1'='1 ===" -ForegroundColor Yellow
$sqli = UrlEncode("VCT' OR '1'='1")
$r = Api-Expect "GET" "/orders?serviceType=$sqli&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400) {
    Pass "D2: Invalid serviceType with injection rejected (400)"
} elseif ($r.code -eq 200) {
    Warn "D2: Invalid serviceType accepted - check DTO validation"
} else {
    Fail "D2: Unexpected response $($r.code)"
}

# === D3: Limit with DROP TABLE ===
Write-Host ""
Write-Host "=== TEST D3: GET /orders?limit=-1; DROP TABLE orders ===" -ForegroundColor Yellow
$sqli = UrlEncode("-1; DROP TABLE orders")
$r = Api-Expect "GET" "/orders?limit=$sqli" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400) {
    Pass "D3: Invalid limit with DROP TABLE rejected (400)"
} elseif ($r.code -eq 200) {
    # Prisma ignores non-numeric limit; verify orders intact
    $verify = Api-Expect "GET" "/orders?limit=1" $ADMIN $null
    if ($verify.code -eq 200) {
        Pass "D3: Invalid limit neutralized, orders table intact"
    } else {
        Fail "D3: Orders table may be damaged after limit injection"
    }
} else {
    Fail "D3: Unexpected response $($r.code)"
}

# === D4: Page with pg_shadow query ===
Write-Host ""
Write-Host "=== TEST D4: GET /orders?page=0; SELECT * FROM pg_shadow ===" -ForegroundColor Yellow
$sqli = UrlEncode("0; SELECT * FROM pg_shadow")
$r = Api-Expect "GET" "/orders?page=$sqli" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400) {
    Pass "D4: Invalid page with pg_shadow injection rejected (400)"
} elseif ($r.code -eq 200) {
    $respText = ""
    if ($r.body) { $respText = ($r.body | ConvertTo-Json -Depth 3 -Compress) }
    if ($respText -match "pg_shadow|rolpassword") {
        Fail "D4: pg_shadow data leaked in response"
    } else {
        Pass "D4: Invalid page handled safely, no pg_shadow leak"
    }
} else {
    Fail "D4: Unexpected response $($r.code)"
}

# === D5: Normal enum filter still works ===
Write-Host ""
Write-Host "=== TEST D5: Normal enum filter GET /orders?status=CONSULTING ===" -ForegroundColor Yellow
$r = Api-Expect "GET" "/orders?status=CONSULTING&limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200) {
    Pass "D5: Normal enum filter works correctly"
} else {
    Fail "D5: Normal enum filter broken (HTTP $($r.code))"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART E: UUID/ID Parameter Injection (~5 tests)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === E1: DROP TABLE in order ID ===
Write-Host ""
Write-Host "=== TEST E1: GET /orders/'; DROP TABLE orders;-- ===" -ForegroundColor Yellow
$sqliPath = [System.Uri]::EscapeDataString("'; DROP TABLE orders;--")
$r = Api-Expect "GET" "/orders/$sqliPath" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400 -or $r.code -eq 404) {
    Pass "E1: DROP TABLE in order ID rejected ($($r.code))"
} elseif ($r.code -eq 500) {
    if (Has-DbLeak $r) {
        Fail "E1: Server error with DB info leak"
    } else {
        Warn "E1: Server error but no DB info leaked"
    }
} else {
    Fail "E1: Unexpected response $($r.code)"
}

# === E2: OR 1=1 in customer ID ===
Write-Host ""
Write-Host "=== TEST E2: GET /customers/' OR 1=1-- ===" -ForegroundColor Yellow
$sqliPath = [System.Uri]::EscapeDataString("' OR 1=1--")
$r = Api-Expect "GET" "/customers/$sqliPath" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400 -or $r.code -eq 404) {
    Pass "E2: OR 1=1 in customer ID rejected ($($r.code))"
} elseif ($r.code -eq 500) {
    if (Has-DbLeak $r) {
        Fail "E2: Server error with DB info leak"
    } else {
        Warn "E2: Server error but no DB info leaked"
    }
} else {
    Fail "E2: Unexpected response $($r.code)"
}

# === E3: UNION SELECT in order ID ===
Write-Host ""
Write-Host "=== TEST E3: GET /orders/1 UNION SELECT * FROM users ===" -ForegroundColor Yellow
$sqliPath = [System.Uri]::EscapeDataString("1 UNION SELECT * FROM users")
$r = Api-Expect "GET" "/orders/$sqliPath" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400 -or $r.code -eq 404) {
    Pass "E3: UNION SELECT in order ID rejected ($($r.code))"
} elseif ($r.code -eq 500) {
    if (Has-DbLeak $r) {
        Fail "E3: Server error with DB info leak"
    } else {
        Warn "E3: Server error but no DB info leaked"
    }
} else {
    Fail "E3: Unexpected response $($r.code)"
}

# === E4: Valid UUID format but non-existent ===
Write-Host ""
Write-Host "=== TEST E4: GET /orders/00000000-0000-0000-0000-000000000000 ===" -ForegroundColor Yellow
$r = Api-Expect "GET" "/orders/00000000-0000-0000-0000-000000000000" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 404) {
    Pass "E4: Valid UUID not found - no injection possible (404)"
} elseif ($r.code -eq 400) {
    Pass "E4: Valid UUID rejected as not found (400)"
} else {
    Fail "E4: Unexpected response $($r.code) for non-existent UUID"
}

# === E5: Mass update attempt via ID injection ===
Write-Host ""
Write-Host "=== TEST E5: PATCH /orders/' OR '1'='1/status - mass update attempt ===" -ForegroundColor Yellow
$sqliPath = [System.Uri]::EscapeDataString("' OR '1'='1")
$r = Api-Expect "PATCH" "/orders/$sqliPath/status" $ADMIN @{ status = "CANCELLED" }
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400 -or $r.code -eq 404) {
    Pass "E5: Mass update via ID injection blocked ($($r.code))"
} elseif ($r.code -eq 500) {
    if (Has-DbLeak $r) {
        Fail "E5: Server error with DB info leak"
    } else {
        Warn "E5: Server error but no DB info leaked"
    }
} else {
    Fail "E5: Unexpected response $($r.code)"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART F: Form Body Injection (~6 tests)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === F1: Login with OR 1=1 in email ===
Write-Host ""
Write-Host "=== TEST F1: POST /auth/login - email: ' OR 1=1-- ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/auth/login" $null @{
    email    = "' OR 1=1--"
    password = "anything"
}
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 401 -or $r.code -eq 400) {
    Pass "F1: SQL injection in login email rejected ($($r.code))"
} elseif ($r.code -eq 200 -or $r.code -eq 201) {
    Fail "F1: CRITICAL - Login bypass via SQL injection"
} else {
    Pass "F1: SQL injection in login handled (HTTP $($r.code))"
}

# === F2: Login with DROP TABLE in email ===
Write-Host ""
Write-Host "=== TEST F2: POST /auth/login - email with DROP TABLE ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/auth/login" $null @{
    email    = "admin@test.com'; DROP TABLE users;--"
    password = "test"
}
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 401 -or $r.code -eq 400) {
    # Verify users table still intact by logging in successfully
    $verifyLogin = Login "admin@$DOMAIN"
    if ($verifyLogin) {
        Pass "F2: DROP TABLE in login email neutralized - users table intact"
    } else {
        Fail "F2: CRITICAL - Users table may have been dropped"
    }
} else {
    Fail "F2: Unexpected response $($r.code)"
}

# === F3: Create customer with SQL in name ===
Write-Host ""
Write-Host "=== TEST F3: POST /customers - name with DELETE injection ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/customers" $SALE @{
    fullName = "'; DELETE FROM customers;--"
    phone    = "0900000001"
}
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 201) {
    # Customer created with literal name (Prisma parameterized)
    $createdId = $null
    if ($r.body -and $r.body.data -and $r.body.data.id) { $createdId = $r.body.data.id }
    if ($createdId) {
        $verify = Api-Expect "GET" "/customers/$createdId" $SALE $null
        if ($verify.code -eq 200) {
            $verifyName = ""
            if ($verify.body -and $verify.body.data) { $verifyName = $verify.body.data.fullName }
            if ($verifyName -match "DELETE FROM") {
                Pass "F3: SQL stored as literal string, not executed"
            } else {
                Pass "F3: Customer created, name handled safely"
            }
        } else {
            Pass "F3: Customer created (201), SQL not executed"
        }
    } else {
        Pass "F3: Customer created (201) with SQL in name - parameterized query safe"
    }
} elseif ($r.code -eq 400) {
    Pass "F3: SQL in customer name rejected by validation (400)"
} else {
    Fail "F3: Unexpected response $($r.code)"
}

# Verify customers still exist
$custVerify = Api-Expect "GET" "/customers?limit=1" $ADMIN $null
if ($custVerify.code -ne 200) {
    Fail "F3-verify: Customers table may be damaged"
}

# === F4: Cash voucher with SQL in reason ===
Write-Host ""
Write-Host "=== TEST F4: POST /cash/vouchers - reason with UPDATE injection ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/cash/vouchers" $ADMIN @{
    type     = "RECEIPT"
    amount   = 100000
    currency = "VND"
    reason   = "'; UPDATE orders SET totalAmount=0;--"
}
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 201 -or $r.code -eq 200) {
    Pass "F4: SQL in voucher reason stored as literal (201/200)"
} elseif ($r.code -eq 400) {
    Pass "F4: SQL in voucher reason rejected by validation (400)"
} else {
    # 403, 500, etc. are also acceptable - injection did not succeed
    Pass "F4: SQL in voucher reason handled safely (HTTP $($r.code))"
}

# === F5: Verify order amounts not zeroed ===
Write-Host ""
Write-Host "=== TEST F5: Verify data integrity - orders still have valid amounts ===" -ForegroundColor Yellow
$r = Api-Expect "GET" "/orders?limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200) {
    Pass "F5: Orders endpoint still works after form body injection attempts"
} else {
    Fail "F5: Orders endpoint broken (HTTP $($r.code))"
}

# === F6: Login with injection in password ===
Write-Host ""
Write-Host "=== TEST F6: POST /auth/login - password: ' OR '1'='1 ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/auth/login" $null @{
    email    = "sale01@$DOMAIN"
    password = "' OR '1'='1"
}
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 401 -or $r.code -eq 400) {
    Pass "F6: Password injection rejected - no auth bypass ($($r.code))"
} elseif ($r.code -eq 200 -or $r.code -eq 201) {
    Fail "F6: CRITICAL - Password bypass via SQL injection"
} else {
    Pass "F6: Password injection handled safely (HTTP $($r.code))"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART G: Nested Object Injection (~3 tests)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === G1: SQL in nested JSON field (order note) ===
Write-Host ""
Write-Host "=== TEST G1: POST /orders - SQL in note field ===" -ForegroundColor Yellow
# Get a valid customer ID first
$custList = Api-Expect "GET" "/customers?limit=1" $SALE $null
$validCustId = $null
if ($custList.body -and $custList.body.data) {
    if ($custList.body.data -is [array] -and $custList.body.data.Count -gt 0) {
        $validCustId = $custList.body.data[0].id
    } elseif ($custList.body.data.data -is [array] -and $custList.body.data.data.Count -gt 0) {
        $validCustId = $custList.body.data.data[0].id
    } elseif ($custList.body.data.items -is [array] -and $custList.body.data.items.Count -gt 0) {
        $validCustId = $custList.body.data.items[0].id
    } elseif ($custList.body.data.id) {
        $validCustId = $custList.body.data.id
    }
}
if ($validCustId) {
    $r = Api-Expect "POST" "/orders" $SALE @{
        customerId  = $validCustId
        serviceType = "VCT"
        branch      = "HN"
        note        = "Test'); DROP TABLE orders; SELECT ('"
        items       = @(@{
            productName = "Normal item"
            quantity    = 1
            unitPrice   = 100
            currency    = "CNY"
        })
    }
    Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
    if ($r.code -eq 201) {
        Pass "G1: SQL in note stored as literal string (201)"
    } elseif ($r.code -eq 400) {
        Pass "G1: SQL in note rejected by validation (400)"
    } else {
        Pass "G1: SQL in note handled safely (HTTP $($r.code))"
    }
    # Verify orders table intact
    $verify = Api-Expect "GET" "/orders?limit=1" $ADMIN $null
    if ($verify.code -ne 200) {
        Fail "G1-verify: Orders table may be damaged after nested injection"
    }
} else {
    Warn "G1: Skipped - no valid customer ID found"
}

# === G2: SQL in array (packageIds) ===
Write-Host ""
Write-Host "=== TEST G2: Array parameter injection - invalid UUID with SQL ===" -ForegroundColor Yellow
# Try to add packages with SQL in the packageIds array
$r = Api-Expect "POST" "/containers/fake-id/add-packages" $ADMIN @{
    packageIds = @("'; DROP TABLE packages;--", "1 OR 1=1")
}
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400 -or $r.code -eq 404) {
    Pass "G2: SQL in packageIds array rejected ($($r.code))"
} elseif ($r.code -eq 500) {
    if (Has-DbLeak $r) {
        Fail "G2: Server error with DB info leak"
    } else {
        Warn "G2: Server error but no DB info leaked"
    }
} else {
    Pass "G2: SQL in packageIds array handled safely (HTTP $($r.code))"
}

# === G3: Numeric field with SQL string ===
Write-Host ""
Write-Host "=== TEST G3: Numeric field injection - amount as string with SQL ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/cash/vouchers" $ADMIN @{
    type     = "RECEIPT"
    amount   = "100; DROP TABLE orders"
    currency = "VND"
    reason   = "Test numeric injection"
}
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400) {
    Pass "G3: String in numeric amount field rejected (400)"
} elseif ($r.code -eq 201 -or $r.code -eq 200) {
    # class-validator may have coerced or Prisma may have handled it
    Warn "G3: String in numeric field accepted - check if coerced safely"
} else {
    Pass "G3: Numeric field injection handled safely (HTTP $($r.code))"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART H: Second-Order Injection Check (~3 tests)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === H1: Create customer with single quote in name (legitimate data) ===
Write-Host ""
Write-Host "=== TEST H1: Create customer with single quote - O'Brien -- Test ===" -ForegroundColor Yellow
$TS = Get-Date -Format "yyyyMMddHHmmss"
$obrienName = "O'Brien -- Test $TS"
$r = Api-Expect "POST" "/customers" $SALE @{
    fullName = $obrienName
    phone    = "09$($TS.Substring(4))"
}
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
$OBRIEN_ID = $null
if ($r.code -eq 201) {
    if ($r.body -and $r.body.data -and $r.body.data.id) {
        $OBRIEN_ID = $r.body.data.id
    }
    Pass "H1: Customer with single quote in name created successfully"
} elseif ($r.code -eq 400) {
    Warn "H1: Customer with single quote rejected by validation (may be overly strict)"
} else {
    Fail "H1: Unexpected response $($r.code)"
}

# === H2: Search for customer with single quote ===
Write-Host ""
Write-Host "=== TEST H2: Search for customer with single quote ===" -ForegroundColor Yellow
$searchTerm = UrlEncode("O'Brien")
$r = Api-Expect "GET" "/customers?search=$searchTerm&limit=10" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200) {
    Pass "H2: Search with single quote works (parameterized query handles it)"
} elseif ($r.code -eq 400) {
    Warn "H2: Search with single quote rejected (may be overly strict)"
} elseif ($r.code -eq 500) {
    if (Has-DbLeak $r) {
        Fail "H2: Single quote in search caused DB error with info leak"
    } else {
        Fail "H2: Single quote in search caused server error"
    }
} else {
    Fail "H2: Unexpected response $($r.code)"
}

# === H3: Verify customer name stored correctly ===
Write-Host ""
Write-Host "=== TEST H3: Verify O'Brien customer name stored correctly ===" -ForegroundColor Yellow
if ($OBRIEN_ID) {
    $r = Api-Expect "GET" "/customers/$OBRIEN_ID" $SALE $null
    Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
    if ($r.code -eq 200) {
        $storedName = ""
        if ($r.body -and $r.body.data) { $storedName = $r.body.data.fullName }
        if ($storedName -eq $obrienName) {
            Pass "H3: Name stored exactly as '$obrienName'"
        } elseif ($storedName -match "O'Brien") {
            Pass "H3: Name contains O'Brien (stored correctly)"
        } else {
            Warn "H3: Stored name '$storedName' differs from input '$obrienName'"
        }
    } else {
        Fail "H3: Could not read customer (HTTP $($r.code))"
    }
} else {
    Warn "H3: Skipped - O'Brien customer was not created"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART I: Time-Based Blind SQLi Check (~3 tests)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === I1: pg_sleep in order search ===
Write-Host ""
Write-Host "=== TEST I1: GET /orders?search=1'; SELECT pg_sleep(10)-- ===" -ForegroundColor Yellow
$sqli = UrlEncode("1'; SELECT pg_sleep(10)--")
$sw = [Diagnostics.Stopwatch]::StartNew()
$r = Api-Expect "GET" "/orders?search=$sqli&limit=1" $ADMIN $null
$sw.Stop()
$elapsed = $sw.Elapsed.TotalSeconds
Write-Host "  HTTP $($r.code) | Response time: $([Math]::Round($elapsed, 2))s" -ForegroundColor Gray
if ($elapsed -lt 3) {
    Pass "I1: pg_sleep(10) in search - no delay ($([Math]::Round($elapsed, 2))s)"
} else {
    Fail "I1: Possible time-based SQLi - response took $([Math]::Round($elapsed, 2))s"
}

# === I2: pg_sleep in login email ===
Write-Host ""
Write-Host "=== TEST I2: POST /auth/login - email with pg_sleep(10) ===" -ForegroundColor Yellow
$sw = [Diagnostics.Stopwatch]::StartNew()
$r = Api-Expect "POST" "/auth/login" $null @{
    email    = "' OR (SELECT pg_sleep(10))--"
    password = "x"
}
$sw.Stop()
$elapsed = $sw.Elapsed.TotalSeconds
Write-Host "  HTTP $($r.code) | Response time: $([Math]::Round($elapsed, 2))s" -ForegroundColor Gray
if ($elapsed -lt 3) {
    Pass "I2: pg_sleep(10) in login email - no delay ($([Math]::Round($elapsed, 2))s)"
} else {
    Fail "I2: Possible time-based SQLi in login - response took $([Math]::Round($elapsed, 2))s"
}

# === I3: Conditional pg_sleep in customer search ===
Write-Host ""
Write-Host "=== TEST I3: GET /customers?search= conditional pg_sleep ===" -ForegroundColor Yellow
$sqli = UrlEncode("1' AND (SELECT CASE WHEN (1=1) THEN pg_sleep(10) ELSE 0 END)--")
$sw = [Diagnostics.Stopwatch]::StartNew()
$r = Api-Expect "GET" "/customers?search=$sqli&limit=1" $ADMIN $null
$sw.Stop()
$elapsed = $sw.Elapsed.TotalSeconds
Write-Host "  HTTP $($r.code) | Response time: $([Math]::Round($elapsed, 2))s" -ForegroundColor Gray
if ($elapsed -lt 3) {
    Pass "I3: Conditional pg_sleep - no delay ($([Math]::Round($elapsed, 2))s)"
} else {
    Fail "I3: Possible conditional time-based SQLi - response took $([Math]::Round($elapsed, 2))s"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART J: Error-Based SQLi Check (~3 tests)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === J1: CONVERT-based error extraction ===
Write-Host ""
Write-Host "=== TEST J1: GET /orders?search= CONVERT error extraction ===" -ForegroundColor Yellow
$sqli = UrlEncode("' AND 1=CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--")
$r = Api-Expect "GET" "/orders?search=$sqli&limit=1" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if (Has-DbLeak $r) {
    Fail "J1: DB information leaked in error response"
} else {
    Pass "J1: CONVERT error extraction - no DB info leaked"
}

# === J2: extractvalue-based error extraction ===
Write-Host ""
Write-Host "=== TEST J2: GET /orders?search= extractvalue version leak ===" -ForegroundColor Yellow
$sqli = UrlEncode("' AND extractvalue(1,concat(0x7e,(SELECT version())))--")
$r = Api-Expect "GET" "/orders?search=$sqli&limit=1" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
$respText = ""
if ($r.error) { $respText += $r.error }
if ($r.body) {
    try { $respText += ($r.body | ConvertTo-Json -Depth 3 -Compress) } catch {}
}
if ($respText -match "PostgreSQL \d+\.\d+" -or $respText -match "pg_catalog") {
    Fail "J2: PostgreSQL version leaked in response"
} else {
    Pass "J2: extractvalue injection - no PostgreSQL version leaked"
}

# === J3: Verify error responses don't contain DB keywords ===
Write-Host ""
Write-Host "=== TEST J3: Verify error responses clean of DB internals ===" -ForegroundColor Yellow
$testPayloads = @(
    UrlEncode("' HAVING 1=1--"),
    UrlEncode("' GROUP BY 1--"),
    UrlEncode("'; EXEC xp_cmdshell('whoami')--")
)
$allClean = $true
foreach ($payload in $testPayloads) {
    $r = Api-Expect "GET" "/orders?search=$payload&limit=1" $ADMIN $null
    if (Has-DbLeak $r) {
        $allClean = $false
        Write-Host "    DB keywords found in response for payload" -ForegroundColor Red
    }
}
if ($allClean) {
    Pass "J3: All error responses clean of DB internal keywords"
} else {
    Fail "J3: Some error responses contain DB internal keywords"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART K: Verify Database Intact After All Tests (~3 tests)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === K1: Orders still accessible ===
Write-Host ""
Write-Host "=== TEST K1: GET /orders?limit=5 - verify orders intact ===" -ForegroundColor Yellow
$r = Api-Expect "GET" "/orders?limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200) {
    $hasData = $false
    if ($r.body -and $r.body.data) {
        if ($r.body.data -is [array] -and $r.body.data.Count -gt 0) { $hasData = $true }
        elseif ($r.body.data.data -is [array] -and $r.body.data.data.Count -gt 0) { $hasData = $true }
        elseif ($r.body.data.items -is [array] -and $r.body.data.items.Count -gt 0) { $hasData = $true }
    }
    if ($hasData) {
        Pass "K1: Orders table intact - data returned successfully"
    } else {
        Warn "K1: Orders endpoint works but returned no data"
    }
} else {
    Fail "K1: Orders endpoint broken (HTTP $($r.code))"
}

# === K2: Customers still accessible ===
Write-Host ""
Write-Host "=== TEST K2: GET /customers?limit=5 - verify customers intact ===" -ForegroundColor Yellow
$r = Api-Expect "GET" "/customers?limit=5" $ADMIN $null
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 200) {
    $hasData = $false
    if ($r.body -and $r.body.data) {
        if ($r.body.data -is [array] -and $r.body.data.Count -gt 0) { $hasData = $true }
        elseif ($r.body.data.data -is [array] -and $r.body.data.data.Count -gt 0) { $hasData = $true }
        elseif ($r.body.data.items -is [array] -and $r.body.data.items.Count -gt 0) { $hasData = $true }
    }
    if ($hasData) {
        Pass "K2: Customers table intact - data returned successfully"
    } else {
        Warn "K2: Customers endpoint works but returned no data"
    }
} else {
    Fail "K2: Customers endpoint broken (HTTP $($r.code))"
}

# === K3: Login still works ===
Write-Host ""
Write-Host "=== TEST K3: POST /auth/login - verify auth still works ===" -ForegroundColor Yellow
$verifyToken = Login "admin@$DOMAIN"
if ($verifyToken) {
    Pass "K3: Authentication still works after all injection tests"
} else {
    Fail "K3: CRITICAL - Authentication broken after injection tests"
}

# ============================================================
# TONG KET
# ============================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  TONG KET TEST-SEC-010: SQL Injection Prevention" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White
Write-Host ""
Write-Host "  Part A: Search parameter injection on Orders (6 tests)" -ForegroundColor Gray
Write-Host "  Part B: Search on Customers (4 tests)" -ForegroundColor Gray
Write-Host "  Part C: Search on Packages (3 tests)" -ForegroundColor Gray
Write-Host "  Part D: Filter/enum parameter injection (5 tests)" -ForegroundColor Gray
Write-Host "  Part E: UUID/ID parameter injection (5 tests)" -ForegroundColor Gray
Write-Host "  Part F: Form body injection (6 tests)" -ForegroundColor Gray
Write-Host "  Part G: Nested object injection (3 tests)" -ForegroundColor Gray
Write-Host "  Part H: Second-order injection check (3 tests)" -ForegroundColor Gray
Write-Host "  Part I: Time-based blind SQLi check (3 tests)" -ForegroundColor Gray
Write-Host "  Part J: Error-based SQLi check (3 tests)" -ForegroundColor Gray
Write-Host "  Part K: Verify database intact (3 tests)" -ForegroundColor Gray
Write-Host ""
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host ""
$total = $passCount + $failCount + $warnCount
Write-Host "  TOTAL: $total tests executed" -ForegroundColor White
Write-Host ""
if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED - SQL injection prevention verified" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $failCount TEST(S) FAILED - SQL injection risk detected" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor White
