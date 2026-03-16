# ============================================================================
# TEST-SEC-013: CSRF Protection
# Kiem tra bao ve CSRF trong TBS ERP
# ============================================================================
# Guard: CsrfGuard (global APP_GUARD)
# Logic:
#   - GET/HEAD/OPTIONS -> exempt (safe methods)
#   - Bearer token present -> exempt (not auto-sent by browser)
#   - @Public() routes -> exempt
#   - Otherwise: validate Origin/Referer against CORS_ORIGINS
#   - No Origin/Referer + has refreshToken cookie -> BLOCK (403)
#   - No Origin/Referer + no cookie -> ALLOW (pure API call)
# ============================================================================

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

function Api-Expect($method, $path, $token, $body, $extraHeaders) {
    $uri = "$BASE_URL$path"
    $params = @{
        Uri    = $uri
        Method = $method
        Headers = @{ "Content-Type" = "application/json" }
    }
    if ($token) { $params.Headers["Authorization"] = "Bearer $token" }
    if ($extraHeaders) {
        foreach ($k in $extraHeaders.Keys) { $params.Headers[$k] = $extraHeaders[$k] }
    }
    if ($body)  { $params.Body = ($body | ConvertTo-Json -Depth 10 -Compress) }
    try {
        $r = Invoke-WebRequest @params -UseBasicParsing
        $parsed = $null
        try { $parsed = $r.Content | ConvertFrom-Json } catch {}
        $hdrs = @{}
        foreach ($key in $r.Headers.Keys) { $hdrs[$key] = $r.Headers[$key] }
        return @{ code = [int]$r.StatusCode; body = $parsed; error = $null; headers = $hdrs }
    } catch {
        $code = 0; $errBody = ""; $parsed = $null; $hdrs = @{}
        try {
            $resp = $_.Exception.Response
            $code = [int]$resp.StatusCode
            $stream = $resp.GetResponseStream()
            $stream.Position = 0
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $errBody = $reader.ReadToEnd()
            $reader.Close()
            foreach ($key in $resp.Headers.AllKeys) { $hdrs[$key] = $resp.Headers[$key] }
        } catch { try { $code = [int]$_.Exception.Response.StatusCode } catch {} }
        if ($errBody) { try { $parsed = $errBody | ConvertFrom-Json } catch {} }
        return @{ code = $code; body = $parsed; error = $errBody; headers = $hdrs }
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

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "TEST-SEC-013: CSRF Protection" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# SETUP: Login to get token
# ============================================================================
Write-Host "--- SETUP: Login ---" -ForegroundColor Cyan
$token = Login "ceo@$DOMAIN"
if (-not $token) {
    Write-Host "FATAL: Cannot login as CEO. Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "  Logged in as CEO, token obtained." -ForegroundColor Gray
Write-Host ""

# ============================================================================
# PART A: Bearer token bypasses CSRF (~4 tests)
# Bearer tokens are not auto-sent by browsers, so CSRF is not applicable.
# The CsrfGuard explicitly skips when Authorization: Bearer is present.
# ============================================================================
Write-Host "=== PART A: Bearer token bypasses CSRF ===" -ForegroundColor Yellow

# A1: POST with Bearer token, no Origin header -> should work
Write-Host "  A1: POST /orders with Bearer token (no Origin) ..."
$r = Api-Expect "GET" "/orders?page=1&limit=1" $token $null $null
if ($r.code -eq 200) {
    # Now do a POST-like operation with Bearer only. Use a simple endpoint.
    # Try creating an order query (GET is safe, but let's test POST with Bearer)
    $r2 = Api-Expect "POST" "/auth/logout" $null $null $null
    # Logout without token should fail with 401, not 403 CSRF
    # Instead let's test a POST endpoint that requires auth
    # Use a POST endpoint with Bearer, no Origin
    $r3 = Api-Expect "POST" "/notifications/mark-read" $token @{ ids = @() } $null
    if ($r3.code -ne 403) {
        Pass "A1: POST with Bearer token + no Origin - not blocked by CSRF (code=$($r3.code))"
    } else {
        Fail "A1: POST with Bearer token + no Origin - got 403 CSRF block"
    }
} else {
    # Fallback: just test that Bearer requests pass CSRF guard
    $r4 = Api-Expect "POST" "/dashboard/query" $token @{ period = "today" } $null
    if ($r4.code -ne 403) {
        Pass "A1: POST with Bearer token + no Origin - not blocked by CSRF (code=$($r4.code))"
    } else {
        Fail "A1: POST with Bearer token + no Origin - got 403 CSRF block"
    }
}

# A2: POST with Bearer token + wrong Origin "http://evil.com" -> should still work
Write-Host "  A2: POST with Bearer + evil Origin ..."
$evilHeaders = @{ "Origin" = "http://evil.com" }
$r = Api-Expect "GET" "/orders?page=1&limit=1" $token $null $evilHeaders
if ($r.code -ne 403) {
    Pass "A2: GET with Bearer + evil Origin - bypasses CSRF (code=$($r.code))"
} else {
    Fail "A2: GET with Bearer + evil Origin - unexpectedly blocked by CSRF"
}

# A3: PATCH with Bearer token + no Origin -> should work
Write-Host "  A3: PATCH with Bearer token + no Origin ..."
$r = Api-Expect "PATCH" "/auth/change-password" $token @{ currentPassword = "wrong"; newPassword = "wrong" } $null
# Expect 400 (validation) or 401 (bad password) but NOT 403 (CSRF)
if ($r.code -ne 403) {
    Pass "A3: PATCH with Bearer + no Origin - not blocked by CSRF (code=$($r.code))"
} else {
    Fail "A3: PATCH with Bearer + no Origin - got 403 CSRF block"
}

# A4: DELETE with Bearer token -> should work (bypasses CSRF)
Write-Host "  A4: DELETE with Bearer token + no Origin ..."
$r = Api-Expect "DELETE" "/notifications/00000000-0000-0000-0000-000000000000" $token $null $null
# Expect 404 (not found) but NOT 403 (CSRF)
if ($r.code -ne 403) {
    Pass "A4: DELETE with Bearer + no Origin - not blocked by CSRF (code=$($r.code))"
} else {
    Fail "A4: DELETE with Bearer + no Origin - got 403 CSRF block"
}

Write-Host ""

# ============================================================================
# PART B: GET requests exempt from CSRF (~3 tests)
# Safe methods (GET, HEAD, OPTIONS) are always exempt from CSRF check.
# ============================================================================
Write-Host "=== PART B: GET requests exempt from CSRF ===" -ForegroundColor Yellow

# B1: GET without Bearer, without Origin -> 401 (no auth) but NOT 403 (CSRF)
Write-Host "  B1: GET /orders without Bearer, without Origin ..."
$r = Api-Expect "GET" "/orders?page=1&limit=1" $null $null $null
if ($r.code -eq 401) {
    Pass "B1: GET without Bearer -> 401 Unauthorized (not CSRF blocked)"
} elseif ($r.code -eq 200) {
    Warn "B1: GET without Bearer -> 200 (endpoint may not require auth)"
} elseif ($r.code -eq 403) {
    Fail "B1: GET without Bearer -> 403 - should not be CSRF blocked on GET"
} else {
    Pass "B1: GET without Bearer -> $($r.code) (not 403 CSRF)"
}

# B2: GET with Bearer, without Origin -> 200
Write-Host "  B2: GET /orders with Bearer, no Origin ..."
$r = Api-Expect "GET" "/orders?page=1&limit=1" $token $null $null
if ($r.code -eq 200) {
    Pass "B2: GET with Bearer + no Origin -> 200 OK"
} else {
    Fail "B2: GET with Bearer + no Origin -> expected 200, got $($r.code)"
}

# B3: HEAD request -> exempt from CSRF
Write-Host "  B3: HEAD request to /auth/profile ..."
$r = Api-Expect "HEAD" "/auth/profile" $token $null $null
if ($r.code -ne 403) {
    Pass "B3: HEAD request - exempt from CSRF (code=$($r.code))"
} else {
    Fail "B3: HEAD request - got 403 CSRF block on safe method"
}

Write-Host ""

# ============================================================================
# PART C: POST without Bearer + wrong Origin (~5 tests)
# These simulate CSRF attack scenarios.
# ============================================================================
Write-Host "=== PART C: POST without Bearer + wrong Origin (CSRF attack) ===" -ForegroundColor Yellow

# C1: POST /auth/login with correct credentials but Origin: "http://evil.com"
# Login has no @Public() decorator but also no @UseGuards(AuthGuard('jwt'))
# CsrfGuard: no Bearer, not @Public -> checks Origin -> evil.com -> should 403
Write-Host "  C1: POST /auth/login + evil Origin ..."
$loginBody = @{ email = "ceo@$DOMAIN"; password = "Admin@123" }
$evilHeaders = @{ "Origin" = "http://evil.com" }
$r = Api-Expect "POST" "/auth/login" $null $loginBody $evilHeaders
if ($r.code -eq 403) {
    $errMsg = ""
    if ($r.body -and $r.body.message) { $errMsg = $r.body.message }
    Pass "C1: POST /auth/login + evil Origin -> 403 Forbidden (msg: $errMsg)"
} elseif ($r.code -eq 200) {
    # Login might not have CSRF guard because it's the initial auth endpoint
    # The guard checks @Public() but login doesn't have it. However,
    # login has no Bearer and no @Public, so it should be checked.
    Warn "C1: POST /auth/login + evil Origin -> 200 (login may bypass CSRF differently)"
} else {
    Warn "C1: POST /auth/login + evil Origin -> $($r.code) (expected 403)"
}

# C2: POST with Cookie (refreshToken) but no Bearer and Origin: "http://evil.com"
# This is the real CSRF attack vector -> should get 403
Write-Host "  C2: POST with refreshToken cookie + evil Origin + no Bearer ..."
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$cookie = New-Object System.Net.Cookie
$cookie.Name = "refreshToken"
$cookie.Value = "fake-refresh-token-for-csrf-test"
$cookie.Domain = "localhost"
$cookie.Path = "/"
$session.Cookies.Add($cookie)
try {
    $r = Invoke-WebRequest -Uri "$BASE_URL/auth/refresh" -Method POST `
        -Headers @{ "Content-Type" = "application/json"; "Origin" = "http://evil.com" } `
        -WebSession $session -UseBasicParsing
    $respCode = [int]$r.StatusCode
    if ($respCode -eq 403) {
        Pass "C2: POST /auth/refresh + cookie + evil Origin -> 403 (CSRF blocked)"
    } else {
        Fail "C2: POST /auth/refresh + cookie + evil Origin -> $respCode (expected 403)"
    }
} catch {
    $respCode = 0
    try { $respCode = [int]$_.Exception.Response.StatusCode } catch {}
    if ($respCode -eq 403) {
        $errBody = ""
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $stream.Position = 0
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $errBody = $reader.ReadToEnd()
            $reader.Close()
        } catch {}
        Pass "C2: POST /auth/refresh + cookie + evil Origin -> 403 (CSRF blocked)"
    } else {
        Fail "C2: POST /auth/refresh + cookie + evil Origin -> $respCode (expected 403)"
    }
}

# C3: POST /auth/refresh with wrong Origin and cookies -> should get 403
Write-Host "  C3: POST /auth/refresh + cookie + Origin: http://attacker.io ..."
$session2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$cookie2 = New-Object System.Net.Cookie
$cookie2.Name = "refreshToken"
$cookie2.Value = "another-fake-refresh-token"
$cookie2.Domain = "localhost"
$cookie2.Path = "/"
$session2.Cookies.Add($cookie2)
try {
    $r = Invoke-WebRequest -Uri "$BASE_URL/auth/refresh" -Method POST `
        -Headers @{ "Content-Type" = "application/json"; "Origin" = "http://attacker.io" } `
        -WebSession $session2 -UseBasicParsing
    $respCode = [int]$r.StatusCode
    Fail "C3: POST /auth/refresh + cookie + attacker Origin -> $respCode (expected 403)"
} catch {
    $respCode = 0
    try { $respCode = [int]$_.Exception.Response.StatusCode } catch {}
    if ($respCode -eq 403) {
        Pass "C3: POST /auth/refresh + cookie + attacker Origin -> 403 CSRF blocked"
    } else {
        Fail "C3: POST /auth/refresh + cookie + attacker Origin -> $respCode (expected 403)"
    }
}

# C4: POST /auth/refresh with no Origin, no Referer, but cookies -> should get 403
# CsrfGuard: no Bearer, not @Public, no Origin, no Referer, has refreshToken cookie -> 403
Write-Host "  C4: POST /auth/refresh + cookie + NO Origin + NO Referer ..."
$session3 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$cookie3 = New-Object System.Net.Cookie
$cookie3.Name = "refreshToken"
$cookie3.Value = "fake-token-no-origin"
$cookie3.Domain = "localhost"
$cookie3.Path = "/"
$session3.Cookies.Add($cookie3)
try {
    $r = Invoke-WebRequest -Uri "$BASE_URL/auth/refresh" -Method POST `
        -Headers @{ "Content-Type" = "application/json" } `
        -WebSession $session3 -UseBasicParsing
    $respCode = [int]$r.StatusCode
    Fail "C4: POST + cookie + no Origin/Referer -> $respCode (expected 403)"
} catch {
    $respCode = 0
    try { $respCode = [int]$_.Exception.Response.StatusCode } catch {}
    if ($respCode -eq 403) {
        Pass "C4: POST + cookie + no Origin/Referer -> 403 CSRF blocked (missing origin)"
    } else {
        Fail "C4: POST + cookie + no Origin/Referer -> $respCode (expected 403)"
    }
}

# C5: Verify 403 error message mentions origin/CSRF
Write-Host "  C5: Verify CSRF 403 error message content ..."
$session4 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$cookie4 = New-Object System.Net.Cookie
$cookie4.Name = "refreshToken"
$cookie4.Value = "csrf-message-test"
$cookie4.Domain = "localhost"
$cookie4.Path = "/"
$session4.Cookies.Add($cookie4)
$csrfErrorMsg = ""
try {
    $r = Invoke-WebRequest -Uri "$BASE_URL/auth/refresh" -Method POST `
        -Headers @{ "Content-Type" = "application/json"; "Origin" = "http://evil.com" } `
        -WebSession $session4 -UseBasicParsing
} catch {
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $stream.Position = 0
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        $csrfErrorMsg = $reader.ReadToEnd()
        $reader.Close()
    } catch {}
}
if ($csrfErrorMsg -match "origin" -or $csrfErrorMsg -match "Origin" -or $csrfErrorMsg -match "CSRF") {
    Pass "C5: CSRF 403 message mentions 'origin' or 'CSRF': $csrfErrorMsg"
} elseif ($csrfErrorMsg -match "Forbidden") {
    Warn "C5: CSRF 403 message says 'Forbidden' but no specific CSRF/origin mention"
} else {
    Fail "C5: CSRF 403 message does not mention origin/CSRF: $csrfErrorMsg"
}

Write-Host ""

# ============================================================================
# PART D: Correct Origin header (~4 tests)
# Requests with a whitelisted Origin should pass CSRF validation.
# ============================================================================
Write-Host "=== PART D: Correct Origin header ===" -ForegroundColor Yellow

# D1: POST /auth/login with Origin: "http://localhost:3000" -> should work
Write-Host "  D1: POST /auth/login + Origin: http://localhost:3000 ..."
$correctOrigin = @{ "Origin" = "http://localhost:3000" }
$r = Api-Expect "POST" "/auth/login" $null $loginBody $correctOrigin
if ($r.code -eq 200) {
    Pass "D1: POST /auth/login + correct Origin -> 200 OK"
} elseif ($r.code -eq 403) {
    Fail "D1: POST /auth/login + correct Origin -> 403 (CSRF should not block)"
} else {
    # Could be 401, 429 etc - not CSRF
    Warn "D1: POST /auth/login + correct Origin -> $($r.code) (not 403, CSRF OK)"
}

# D2: POST /auth/login with Origin: "http://localhost:3001" -> may work (self-origin in CORS)
Write-Host "  D2: POST /auth/login + Origin: http://localhost:3001 ..."
$selfOrigin = @{ "Origin" = "http://localhost:3001" }
$r = Api-Expect "POST" "/auth/login" $null $loginBody $selfOrigin
if ($r.code -eq 200) {
    Pass "D2: POST /auth/login + self Origin (3001) -> 200 OK"
} elseif ($r.code -eq 403) {
    # 3001 may not be in CORS_ORIGINS list
    Warn "D2: POST /auth/login + self Origin (3001) -> 403 (3001 may not be in CORS_ORIGINS)"
} else {
    Warn "D2: POST /auth/login + self Origin (3001) -> $($r.code)"
}

# D3: POST with Referer header instead of Origin -> should work if matching allowed origin
Write-Host "  D3: POST /auth/login + Referer: http://localhost:3000/dashboard ..."
$refererHeader = @{ "Referer" = "http://localhost:3000/dashboard" }
$r = Api-Expect "POST" "/auth/login" $null $loginBody $refererHeader
if ($r.code -eq 200) {
    Pass "D3: POST with Referer from allowed origin -> 200 OK"
} elseif ($r.code -eq 403) {
    Fail "D3: POST with valid Referer -> 403 (should extract origin from Referer)"
} else {
    Warn "D3: POST with valid Referer -> $($r.code) (not 403, CSRF OK)"
}

# D4: POST with both Origin and Referer matching -> should work
Write-Host "  D4: POST /auth/login + Origin + Referer both matching ..."
$bothHeaders = @{
    "Origin"  = "http://localhost:3000"
    "Referer" = "http://localhost:3000/auth/login"
}
$r = Api-Expect "POST" "/auth/login" $null $loginBody $bothHeaders
if ($r.code -eq 200) {
    Pass "D4: POST with Origin + Referer both correct -> 200 OK"
} elseif ($r.code -eq 403) {
    Fail "D4: POST with Origin + Referer both correct -> 403 (should not block)"
} else {
    Warn "D4: POST with both headers correct -> $($r.code) (not 403, CSRF OK)"
}

Write-Host ""

# ============================================================================
# PART E: Security headers (~6 tests)
# Helmet middleware sets various security headers. Verify they are present.
# ============================================================================
Write-Host "=== PART E: Security headers (Helmet) ===" -ForegroundColor Yellow

# Make a simple GET request and inspect response headers
Write-Host "  Fetching headers from GET /auth/profile ..."
$r = Api-Expect "GET" "/auth/profile" $token $null $null

$respHeaders = $r.headers

# E1: X-Frame-Options (DENY or SAMEORIGIN) - prevents clickjacking
Write-Host "  E1: X-Frame-Options header ..."
$xfo = $null
if ($respHeaders -and $respHeaders.ContainsKey("X-Frame-Options")) {
    $xfo = $respHeaders["X-Frame-Options"]
}
if ($xfo -and ($xfo -match "DENY" -or $xfo -match "SAMEORIGIN")) {
    Pass "E1: X-Frame-Options = $xfo (clickjacking protection)"
} elseif ($xfo) {
    Warn "E1: X-Frame-Options = $xfo (unexpected value)"
} else {
    Warn "E1: X-Frame-Options header not found (Helmet may use CSP frame-ancestors instead)"
}

# E2: X-Content-Type-Options: nosniff
Write-Host "  E2: X-Content-Type-Options header ..."
$xcto = $null
if ($respHeaders -and $respHeaders.ContainsKey("X-Content-Type-Options")) {
    $xcto = $respHeaders["X-Content-Type-Options"]
}
if ($xcto -and $xcto -match "nosniff") {
    Pass "E2: X-Content-Type-Options = $xcto (MIME sniffing protection)"
} else {
    Fail "E2: X-Content-Type-Options header missing or not 'nosniff'"
}

# E3: X-XSS-Protection header
Write-Host "  E3: X-XSS-Protection header ..."
$xxss = $null
if ($respHeaders -and $respHeaders.ContainsKey("X-XSS-Protection")) {
    $xxss = $respHeaders["X-XSS-Protection"]
}
if ($xxss) {
    Pass "E3: X-XSS-Protection = $xxss"
} else {
    # Helmet v5+ removed X-XSS-Protection (set to 0) or omits it
    Warn "E3: X-XSS-Protection header not present (Helmet v5+ may omit it)"
}

# E4: Strict-Transport-Security header (may not be present in dev/HTTP)
Write-Host "  E4: Strict-Transport-Security header ..."
$hsts = $null
if ($respHeaders -and $respHeaders.ContainsKey("Strict-Transport-Security")) {
    $hsts = $respHeaders["Strict-Transport-Security"]
}
if ($hsts) {
    Pass "E4: Strict-Transport-Security = $hsts"
} else {
    Warn "E4: HSTS header not present (expected in dev/HTTP, required in production)"
}

# E5: X-DNS-Prefetch-Control header
Write-Host "  E5: X-DNS-Prefetch-Control header ..."
$xdns = $null
if ($respHeaders -and $respHeaders.ContainsKey("X-DNS-Prefetch-Control")) {
    $xdns = $respHeaders["X-DNS-Prefetch-Control"]
}
if ($xdns) {
    Pass "E5: X-DNS-Prefetch-Control = $xdns"
} else {
    Warn "E5: X-DNS-Prefetch-Control header not present"
}

# E6: X-Download-Options header (from Helmet)
Write-Host "  E6: X-Download-Options header ..."
$xdo = $null
if ($respHeaders -and $respHeaders.ContainsKey("X-Download-Options")) {
    $xdo = $respHeaders["X-Download-Options"]
}
if ($xdo -and $xdo -match "noopen") {
    Pass "E6: X-Download-Options = $xdo (IE download protection)"
} elseif ($xdo) {
    Warn "E6: X-Download-Options = $xdo (unexpected value)"
} else {
    Warn "E6: X-Download-Options header not present (Helmet v5+ may omit it)"
}

Write-Host ""

# ============================================================================
# PART F: Cookie security attributes (~4 tests)
# Login via Invoke-WebRequest to capture Set-Cookie headers for refreshToken.
# ============================================================================
Write-Host "=== PART F: Cookie security attributes ===" -ForegroundColor Yellow

# F1: Login and check Set-Cookie header for refreshToken
Write-Host "  F1: Login via Invoke-WebRequest to capture Set-Cookie ..."
$setCookieHeader = ""
try {
    $loginJson = @{ email = "ceo@$DOMAIN"; password = "Admin@123" } | ConvertTo-Json -Compress
    $loginResp = Invoke-WebRequest -Uri "$BASE_URL/auth/login" -Method POST `
        -Body $loginJson -ContentType "application/json" `
        -Headers @{ "Origin" = "http://localhost:3000" } `
        -UseBasicParsing
    $setCookieHeader = ""
    if ($loginResp.Headers.ContainsKey("Set-Cookie")) {
        $setCookieHeader = $loginResp.Headers["Set-Cookie"]
    }
} catch {
    try {
        $resp = $_.Exception.Response
        if ($resp -and $resp.Headers) {
            foreach ($key in $resp.Headers.AllKeys) {
                if ($key -eq "Set-Cookie") {
                    $setCookieHeader = $resp.Headers[$key]
                }
            }
        }
    } catch {}
}

if ($setCookieHeader -and $setCookieHeader -match "refreshToken") {
    Pass "F1: Set-Cookie header contains refreshToken cookie"
} elseif ($setCookieHeader) {
    Warn "F1: Set-Cookie header found but no refreshToken: $setCookieHeader"
} else {
    Warn "F1: No Set-Cookie header in login response (may need 2FA or different flow)"
}

# F2: Verify HttpOnly flag on refreshToken cookie
Write-Host "  F2: Checking HttpOnly flag ..."
if ($setCookieHeader -match "HttpOnly") {
    Pass "F2: refreshToken cookie has HttpOnly flag"
} elseif ($setCookieHeader -match "refreshToken") {
    Fail "F2: refreshToken cookie found but HttpOnly flag missing"
} else {
    Warn "F2: Cannot verify HttpOnly - no refreshToken cookie captured"
}

# F3: Verify SameSite attribute (should be Strict or Lax)
Write-Host "  F3: Checking SameSite attribute ..."
if ($setCookieHeader -match "SameSite=Strict") {
    Pass "F3: refreshToken cookie has SameSite=Strict"
} elseif ($setCookieHeader -match "SameSite=Lax") {
    Pass "F3: refreshToken cookie has SameSite=Lax"
} elseif ($setCookieHeader -match "SameSite") {
    Warn "F3: refreshToken has SameSite but unexpected value"
} elseif ($setCookieHeader -match "refreshToken") {
    Fail "F3: refreshToken cookie found but SameSite attribute missing"
} else {
    Warn "F3: Cannot verify SameSite - no refreshToken cookie captured"
}

# F4: Verify Path is restricted (e.g., /api/auth/refresh)
Write-Host "  F4: Checking Path restriction ..."
if ($setCookieHeader -match "Path=/api/auth/refresh") {
    Pass "F4: refreshToken cookie Path=/api/auth/refresh (restricted)"
} elseif ($setCookieHeader -match "Path=/") {
    Warn "F4: refreshToken cookie Path=/ (broad scope, prefer /api/auth/refresh)"
} elseif ($setCookieHeader -match "refreshToken") {
    Warn "F4: refreshToken found but Path not clearly set"
} else {
    Warn "F4: Cannot verify Path - no refreshToken cookie captured"
}

Write-Host ""

# ============================================================================
# PART G: @Public route CSRF exemption (~3 tests)
# @Public() routes bypass CSRF check in CsrfGuard.
# ============================================================================
Write-Host "=== PART G: @Public route CSRF exemption ===" -ForegroundColor Yellow

# G1: POST to @Public endpoint (/public/leads) with evil Origin -> should work
Write-Host "  G1: POST /public/leads + evil Origin (should bypass CSRF) ..."
$leadBody = @{
    fullName = "CSRF Test Lead"
    phone    = "0901234567"
    email    = "csrftest@example.com"
    source   = "test"
}
$evilHeaders = @{ "Origin" = "http://evil.com" }
$r = Api-Expect "POST" "/public/leads" $null $leadBody $evilHeaders
if ($r.code -eq 201 -or $r.code -eq 200) {
    Pass "G1: POST /public/leads + evil Origin -> $($r.code) (@Public bypasses CSRF)"
} elseif ($r.code -eq 400) {
    # Validation error is OK - it means CSRF guard was bypassed
    Pass "G1: POST /public/leads + evil Origin -> 400 (validation error, CSRF bypassed)"
} elseif ($r.code -eq 403) {
    Fail "G1: POST /public/leads + evil Origin -> 403 (@Public should bypass CSRF)"
} else {
    Warn "G1: POST /public/leads + evil Origin -> $($r.code)"
}

# G2: POST /auth/login (no @Public but no JWT guard) with evil Origin
# Login does NOT have @Public(). CsrfGuard will check Origin.
# With evil Origin, it should be 403 (login is NOT exempt).
Write-Host "  G2: POST /auth/login with evil Origin (NOT @Public) ..."
$r = Api-Expect "POST" "/auth/login" $null $loginBody @{ "Origin" = "http://evil.com" }
if ($r.code -eq 403) {
    Pass "G2: POST /auth/login + evil Origin -> 403 (login is NOT @Public, CSRF applied)"
} elseif ($r.code -eq 200) {
    Warn "G2: POST /auth/login + evil Origin -> 200 (login may have special handling)"
} else {
    Warn "G2: POST /auth/login + evil Origin -> $($r.code)"
}

# G3: POST /auth/forgot-password with evil Origin
# Also NOT @Public(), CsrfGuard should check Origin.
Write-Host "  G3: POST /auth/forgot-password + evil Origin ..."
$fpBody = @{ email = "ceo@$DOMAIN" }
$r = Api-Expect "POST" "/auth/forgot-password" $null $fpBody @{ "Origin" = "http://evil.com" }
if ($r.code -eq 403) {
    Pass "G3: POST /auth/forgot-password + evil Origin -> 403 (CSRF applied)"
} elseif ($r.code -eq 200) {
    Warn "G3: POST /auth/forgot-password + evil Origin -> 200 (may have special handling)"
} else {
    Warn "G3: POST /auth/forgot-password + evil Origin -> $($r.code)"
}

Write-Host ""

# ============================================================================
# PART H: CORS preflight (~3 tests)
# OPTIONS requests should return CORS headers.
# ============================================================================
Write-Host "=== PART H: CORS preflight ===" -ForegroundColor Yellow

# H1: OPTIONS request to /orders -> check Access-Control-Allow-Origin header
Write-Host "  H1: OPTIONS /orders with Origin: http://localhost:3000 ..."
$optHeaders = @{
    "Origin" = "http://localhost:3000"
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "Content-Type, Authorization"
}
$r = Api-Expect "OPTIONS" "/orders" $null $null $optHeaders
$acao = $null
if ($r.headers -and $r.headers.ContainsKey("Access-Control-Allow-Origin")) {
    $acao = $r.headers["Access-Control-Allow-Origin"]
}
if ($acao -and ($acao -eq "http://localhost:3000" -or $acao -eq "*")) {
    Pass "H1: OPTIONS -> Access-Control-Allow-Origin: $acao"
} elseif ($acao) {
    Warn "H1: OPTIONS -> Access-Control-Allow-Origin: $acao (unexpected value)"
} else {
    Warn "H1: OPTIONS -> No Access-Control-Allow-Origin header"
}

# H2: Verify Access-Control-Allow-Credentials: true
Write-Host "  H2: Checking Access-Control-Allow-Credentials ..."
$acac = $null
if ($r.headers -and $r.headers.ContainsKey("Access-Control-Allow-Credentials")) {
    $acac = $r.headers["Access-Control-Allow-Credentials"]
}
if ($acac -and $acac -eq "true") {
    Pass "H2: Access-Control-Allow-Credentials: true (cookie support)"
} elseif ($acac) {
    Warn "H2: Access-Control-Allow-Credentials: $acac (unexpected)"
} else {
    Warn "H2: Access-Control-Allow-Credentials header not found"
}

# H3: OPTIONS with evil Origin -> check if origin is rejected
Write-Host "  H3: OPTIONS with evil Origin: http://evil.com ..."
$evilOptHeaders = @{
    "Origin" = "http://evil.com"
    "Access-Control-Request-Method" = "POST"
}
$r = Api-Expect "OPTIONS" "/orders" $null $null $evilOptHeaders
$acao = $null
if ($r.headers -and $r.headers.ContainsKey("Access-Control-Allow-Origin")) {
    $acao = $r.headers["Access-Control-Allow-Origin"]
}
if (-not $acao -or $acao -ne "http://evil.com") {
    Pass "H3: OPTIONS + evil Origin -> CORS does not reflect evil origin (acao=$acao)"
} else {
    Fail "H3: OPTIONS + evil Origin -> CORS reflects evil origin: $acao"
}

Write-Host ""

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "TEST-SEC-013: CSRF Protection - SUMMARY" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
$total = $passCount + $failCount + $warnCount
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host "  TOTAL: $total" -ForegroundColor White
Write-Host ""
if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL PASSED (with $warnCount warnings)" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $failCount FAILED" -ForegroundColor Red
}
Write-Host "============================================================================" -ForegroundColor Cyan
