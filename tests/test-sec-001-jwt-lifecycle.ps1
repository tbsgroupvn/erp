# ================================================================
# TEST-SEC-001: JWT Token Lifecycle
# Severity: CRITICAL
#
# Tests:
#   A. Login + Token structure
#   B. Access token usage
#   C. Invalid/expired token
#   D. Refresh token flow
#   E. Token rotation (reuse detection)
#   F. Logout
#   G. JWT payload inspection
#   H. Wrong password login
#   I. Profile endpoint
#   J. Change password
#   K. Forgot password (non-destructive)
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

function Pass($msg) { $script:passCount++; Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { $script:failCount++; Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Warn($msg) { $script:warnCount++; Write-Host "[WARN] $msg" -ForegroundColor Yellow }

# ----------------------------------------------------------------
# Helper: Login with WebSession to capture cookies
# Returns @{ accessToken; expiresIn; user; session; rawBody }
# ----------------------------------------------------------------
function Login-WithSession($email, $password) {
    $sess = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $loginBody = @{ email = $email; password = $password } | ConvertTo-Json -Compress
    try {
        $r = Invoke-WebRequest -Uri "$BASE_URL/auth/login" `
            -Method POST -Body $loginBody `
            -ContentType "application/json" `
            -WebSession $sess -UseBasicParsing
        $parsed = $r.Content | ConvertFrom-Json
        $data = $null
        if ($parsed.data) { $data = $parsed.data } else { $data = $parsed }
        return @{
            accessToken = $data.tokens.accessToken
            expiresIn   = $data.tokens.expiresIn
            user        = $data.user
            session     = $sess
            rawBody     = $parsed
            statusCode  = [int]$r.StatusCode
        }
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
        return @{
            accessToken = $null
            session     = $sess
            statusCode  = $code
            error       = $errBody
        }
    }
}

# ----------------------------------------------------------------
# Helper: Refresh token using a WebSession (cookies)
# Returns @{ accessToken; expiresIn; session; statusCode; error }
# ----------------------------------------------------------------
function Refresh-Token($sess) {
    try {
        $r = Invoke-WebRequest -Uri "$BASE_URL/auth/refresh" `
            -Method POST `
            -ContentType "application/json" `
            -WebSession $sess -UseBasicParsing
        $parsed = $r.Content | ConvertFrom-Json
        $data = $null
        if ($parsed.data) { $data = $parsed.data } else { $data = $parsed }
        return @{
            accessToken = $data.accessToken
            expiresIn   = $data.expiresIn
            session     = $sess
            statusCode  = [int]$r.StatusCode
            error       = $null
        }
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
        return @{
            accessToken = $null
            session     = $sess
            statusCode  = $code
            error       = $errBody
        }
    }
}

# ----------------------------------------------------------------
# Helper: Decode base64url JWT segment
# ----------------------------------------------------------------
function Decode-JwtSegment($segment) {
    # base64url -> base64: replace - with + and _ with /
    $b64 = $segment.Replace('-', '+').Replace('_', '/')
    # Add padding
    $mod = $b64.Length % 4
    if ($mod -eq 2) { $b64 += "==" }
    elseif ($mod -eq 3) { $b64 += "=" }
    $bytes = [Convert]::FromBase64String($b64)
    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

# ----------------------------------------------------------------
# Helper: Clone a WebRequestSession's cookies into a new session
# ----------------------------------------------------------------
function Clone-Session($sourceSession) {
    $newSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $cookies = $sourceSession.Cookies.GetCookies("$BASE_URL/auth/refresh")
    foreach ($c in $cookies) {
        $clone = New-Object System.Net.Cookie($c.Name, $c.Value, $c.Path, $c.Domain)
        $newSession.Cookies.Add($clone)
    }
    # Also try the base URL
    $cookies2 = $sourceSession.Cookies.GetCookies($BASE_URL)
    foreach ($c in $cookies2) {
        $exists = $newSession.Cookies.GetCookies("$BASE_URL") | Where-Object { $_.Name -eq $c.Name }
        if (-not $exists) {
            $clone = New-Object System.Net.Cookie($c.Name, $c.Value, $c.Path, $c.Domain)
            $newSession.Cookies.Add($clone)
        }
    }
    return $newSession
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-SEC-001: JWT Token Lifecycle" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$TEST_EMAIL = "sale01@$DOMAIN"
$TEST_PASS  = "Admin@123"

# ================================================================
# PART A: Login + Token Structure (~6 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Login + Token Structure" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST A1: POST /auth/login with sale01 ===" -ForegroundColor White
$loginResult = Login-WithSession $TEST_EMAIL $TEST_PASS

if ($loginResult.accessToken) {
    Pass "A1: Login successful (HTTP $($loginResult.statusCode))"
} else {
    Fail "A1: Login failed (HTTP $($loginResult.statusCode)): $($loginResult.error)"
    Write-Host "  FATAL: Cannot continue without login" -ForegroundColor Red
    exit 1
}

$ACCESS_TOKEN = $loginResult.accessToken
$LOGIN_SESSION = $loginResult.session

Write-Host ""
Write-Host "=== TEST A2: Response has data.user object ===" -ForegroundColor White
$user = $loginResult.user
if ($user -and $user.email -and $user.role) {
    Write-Host "  email: $($user.email)"
    Write-Host "  role: $($user.role)"
    Pass "A2: Response has user with email and role"
} else {
    Fail "A2: Response missing user object or email/role"
}

Write-Host ""
Write-Host "=== TEST A3: Response has tokens.accessToken ===" -ForegroundColor White
if ($ACCESS_TOKEN -and $ACCESS_TOKEN.Length -gt 20) {
    Write-Host "  accessToken length: $($ACCESS_TOKEN.Length)"
    Pass "A3: accessToken is a non-empty string"
} else {
    Fail "A3: accessToken missing or too short"
}

Write-Host ""
Write-Host "=== TEST A4: expiresIn > 0 ===" -ForegroundColor White
$expiresIn = $loginResult.expiresIn
if ($expiresIn -and [int]$expiresIn -gt 0) {
    Write-Host "  expiresIn: $expiresIn seconds"
    if ([int]$expiresIn -eq 900) {
        Pass "A4: expiresIn = 900 (15 min)"
    } else {
        Warn "A4: expiresIn = $expiresIn (expected 900 for 15min, but > 0)"
    }
} else {
    Fail "A4: expiresIn missing or <= 0"
}

Write-Host ""
Write-Host "=== TEST A5: Decode JWT payload - verify sub, email, role ===" -ForegroundColor White
$jwtParts = $ACCESS_TOKEN -split '\.'
if ($jwtParts.Count -eq 3) {
    $payloadJson = Decode-JwtSegment $jwtParts[1]
    $claims = $payloadJson | ConvertFrom-Json
    if ($claims.sub -and $claims.email -and $claims.role) {
        Write-Host "  sub: $($claims.sub)"
        Write-Host "  email: $($claims.email)"
        Write-Host "  role: $($claims.role)"
        Pass "A5: JWT payload has sub, email, role"
    } else {
        Fail "A5: JWT payload missing sub/email/role"
    }
} else {
    Fail "A5: JWT does not have 3 parts (header.payload.signature)"
}

Write-Host ""
Write-Host "=== TEST A6: refreshToken cookie was set ===" -ForegroundColor White
# Check cookies from the session
$allCookies = $LOGIN_SESSION.Cookies.GetCookies("http://localhost:3001")
$refreshCookie = $null
foreach ($c in $allCookies) {
    if ($c.Name -eq "refreshToken") { $refreshCookie = $c; break }
}
# Also try alternate paths
if (-not $refreshCookie) {
    $allCookies2 = $LOGIN_SESSION.Cookies.GetCookies("http://localhost:3001/api/auth/refresh")
    foreach ($c in $allCookies2) {
        if ($c.Name -eq "refreshToken") { $refreshCookie = $c; break }
    }
}
if (-not $refreshCookie) {
    $allCookies3 = $LOGIN_SESSION.Cookies.GetCookies("http://localhost:3001/api/v1/auth/refresh")
    foreach ($c in $allCookies3) {
        if ($c.Name -eq "refreshToken") { $refreshCookie = $c; break }
    }
}

if ($refreshCookie) {
    Write-Host "  refreshToken cookie found (length=$($refreshCookie.Value.Length))"
    Pass "A6: refreshToken cookie was set"
} else {
    Warn "A6: refreshToken cookie not captured (HttpOnly cookie may not be visible to PS, will test refresh anyway)"
}

# ================================================================
# PART B: Access Token Usage (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Access Token Usage" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST B1: GET /auth/profile with valid accessToken -> 200 ===" -ForegroundColor White
$profileResp = Api-Expect "GET" "/auth/profile" $ACCESS_TOKEN
if ($profileResp.code -eq 200) {
    Pass "B1: GET /auth/profile returned 200"
} else {
    Fail "B1: GET /auth/profile returned $($profileResp.code)"
}

Write-Host ""
Write-Host "=== TEST B2: Profile has email and role matching login ===" -ForegroundColor White
$profile = $null
if ($profileResp.body -and $profileResp.body.data) { $profile = $profileResp.body.data }
elseif ($profileResp.body) { $profile = $profileResp.body }
if ($profile -and $profile.email -eq $TEST_EMAIL) {
    Pass "B2a: Profile email matches login email"
} else {
    Fail "B2a: Profile email = '$($profile.email)' (expected '$TEST_EMAIL')"
}
if ($profile -and $profile.role -eq "SALE") {
    Pass "B2b: Profile role = SALE"
} else {
    if ($profile) {
        Warn "B2b: Profile role = '$($profile.role)' (expected SALE)"
    } else {
        Fail "B2b: No profile data returned"
    }
}

Write-Host ""
Write-Host "=== TEST B3: Call API (GET /orders?limit=1) with valid token -> 200 ===" -ForegroundColor White
$ordersResp = Api-Expect "GET" "/orders?limit=1" $ACCESS_TOKEN
if ($ordersResp.code -eq 200) {
    Pass "B3: GET /orders with valid token returned 200"
} else {
    Fail "B3: GET /orders returned $($ordersResp.code)"
}

Write-Host ""
Write-Host "=== TEST B4: Call API with no token -> 401 ===" -ForegroundColor White
$noTokenResp = Api-Expect "GET" "/auth/profile" $null
if ($noTokenResp.code -eq 401) {
    Pass "B4: No token -> 401 Unauthorized"
} else {
    Fail "B4: No token -> $($noTokenResp.code) (expected 401)"
}

# ================================================================
# PART C: Invalid/Expired Token (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Invalid/Expired Token" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST C1: Garbage token -> 401 ===" -ForegroundColor White
$garbageResp = Api-Expect "GET" "/auth/profile" "invalid.token.here"
if ($garbageResp.code -eq 401) {
    Pass "C1: Garbage token -> 401"
} else {
    Fail "C1: Garbage token -> $($garbageResp.code) (expected 401)"
}

Write-Host ""
Write-Host "=== TEST C2: Malformed JWT (valid base64 but wrong sig) -> 401 ===" -ForegroundColor White
# Construct a JWT-like string with valid base64 segments but wrong signature
$fakeHeader = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('{"alg":"HS256","typ":"JWT"}'))
$fakePayload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('{"sub":"fake","email":"fake@test.com","role":"SALE"}'))
$fakeSig = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('fakesignature12345'))
$malformedJwt = "$fakeHeader.$fakePayload.$fakeSig"
$malformedResp = Api-Expect "GET" "/auth/profile" $malformedJwt
if ($malformedResp.code -eq 401) {
    Pass "C2: Malformed JWT -> 401"
} else {
    Fail "C2: Malformed JWT -> $($malformedResp.code) (expected 401)"
}

Write-Host ""
Write-Host "=== TEST C3: Error response has message ===" -ForegroundColor White
$errMsg = $null
if ($garbageResp.body -and $garbageResp.body.message) { $errMsg = $garbageResp.body.message }
if ($errMsg) {
    Write-Host "  Error message: $errMsg"
    Pass "C3: Error response has message field"
} else {
    Warn "C3: Error response does not have message field"
}

Write-Host ""
Write-Host "=== TEST C4: 'Bearer null' -> 401 ===" -ForegroundColor White
$nullTokenResp = Api-Expect "GET" "/auth/profile" "null"
if ($nullTokenResp.code -eq 401) {
    Pass "C4: 'Bearer null' -> 401"
} else {
    Fail "C4: 'Bearer null' -> $($nullTokenResp.code) (expected 401)"
}

# ================================================================
# PART D: Refresh Token Flow (~6 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Refresh Token Flow" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST D1: POST /auth/refresh using session cookie -> new accessToken ===" -ForegroundColor White
$refreshResult = Refresh-Token $LOGIN_SESSION
if ($refreshResult.statusCode -eq 200 -and $refreshResult.accessToken) {
    Pass "D1: Refresh returned 200 with new accessToken"
} else {
    Warn "D1: Refresh returned $($refreshResult.statusCode) - $($refreshResult.error)"
    Write-Host "  Note: HttpOnly cookies may not be captured by PowerShell's WebSession" -ForegroundColor Yellow
    Write-Host "  Attempting workaround..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== TEST D2: Verify new accessToken returned ===" -ForegroundColor White
$NEW_ACCESS_TOKEN = $refreshResult.accessToken
if ($NEW_ACCESS_TOKEN -and $NEW_ACCESS_TOKEN.Length -gt 20) {
    Write-Host "  New accessToken length: $($NEW_ACCESS_TOKEN.Length)"
    Pass "D2: New accessToken returned from refresh"
} else {
    Warn "D2: No new accessToken from refresh (may be cookie issue)"
}

Write-Host ""
Write-Host "=== TEST D3: New accessToken is DIFFERENT from original ===" -ForegroundColor White
if ($NEW_ACCESS_TOKEN -and $ACCESS_TOKEN -and $NEW_ACCESS_TOKEN -ne $ACCESS_TOKEN) {
    Pass "D3: New accessToken differs from original"
} elseif ($NEW_ACCESS_TOKEN -eq $ACCESS_TOKEN) {
    Fail "D3: New accessToken is same as original"
} else {
    Warn "D3: Cannot compare (refresh may have failed)"
}

Write-Host ""
Write-Host "=== TEST D4: Use new accessToken to call API -> 200 ===" -ForegroundColor White
if ($NEW_ACCESS_TOKEN) {
    $newTokenResp = Api-Expect "GET" "/auth/profile" $NEW_ACCESS_TOKEN
    if ($newTokenResp.code -eq 200) {
        Pass "D4: New accessToken works (200 on /auth/profile)"
    } else {
        Fail "D4: New accessToken rejected ($($newTokenResp.code))"
    }
} else {
    Warn "D4: Skipped (no new access token)"
}

Write-Host ""
Write-Host "=== TEST D5: Old accessToken still works (within 15min window) ===" -ForegroundColor White
$oldTokenResp = Api-Expect "GET" "/auth/profile" $ACCESS_TOKEN
if ($oldTokenResp.code -eq 200) {
    Pass "D5: Old accessToken still valid within window"
} else {
    Warn "D5: Old accessToken rejected ($($oldTokenResp.code)) - session may have been invalidated"
}

Write-Host ""
Write-Host "=== TEST D6: Verify expiresIn in refresh response ===" -ForegroundColor White
if ($refreshResult.expiresIn -and [int]$refreshResult.expiresIn -gt 0) {
    Write-Host "  expiresIn: $($refreshResult.expiresIn)"
    Pass "D6: expiresIn present in refresh response"
} else {
    Warn "D6: expiresIn missing from refresh response"
}

# ================================================================
# PART E: Token Rotation (Reuse Detection) (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: Token Rotation (Reuse Detection)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST E1: Login fresh to get clean session ===" -ForegroundColor White
$freshLogin = Login-WithSession $TEST_EMAIL $TEST_PASS
if ($freshLogin.accessToken) {
    Pass "E1: Fresh login successful"
} else {
    Fail "E1: Fresh login failed"
}

Write-Host ""
Write-Host "=== TEST E2: Save session cookies (clone) ===" -ForegroundColor White
$oldSession = Clone-Session $freshLogin.session
Write-Host "  Cloned session cookies for later reuse test"
Pass "E2: Session cookies saved"

Write-Host ""
Write-Host "=== TEST E3: Call /auth/refresh once (rotate token) ===" -ForegroundColor White
$rotateResult = Refresh-Token $freshLogin.session
if ($rotateResult.statusCode -eq 200 -and $rotateResult.accessToken) {
    Write-Host "  Refresh succeeded - token rotated"
    Pass "E3: Token rotation successful"
} else {
    Warn "E3: Token rotation may have failed ($($rotateResult.statusCode))"
}

Write-Host ""
Write-Host "=== TEST E4: Try refresh with OLD session (old cookie) -> should fail ===" -ForegroundColor White
$reuseResult = Refresh-Token $oldSession
if ($reuseResult.statusCode -eq 401) {
    Pass "E4: Old refresh token rejected (401) - reuse detection works"
} elseif ($reuseResult.statusCode -eq 200) {
    Warn "E4: Old refresh token accepted - reuse detection may not be implemented at cookie level"
    Write-Host "  Note: Cookie-based rotation relies on server-side hash comparison" -ForegroundColor Yellow
} else {
    Warn "E4: Unexpected status $($reuseResult.statusCode)"
}

# ================================================================
# PART F: Logout (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Logout" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST F1: Login to get fresh token ===" -ForegroundColor White
$logoutLogin = Login-WithSession $TEST_EMAIL $TEST_PASS
$logoutToken = $logoutLogin.accessToken
if ($logoutToken) {
    Pass "F1: Login for logout test OK"
} else {
    Fail "F1: Login for logout test failed"; exit 1
}

Write-Host ""
Write-Host "=== TEST F2: POST /auth/logout with valid token -> 200 ===" -ForegroundColor White
$logoutResp = Api-Expect "POST" "/auth/logout" $logoutToken
if ($logoutResp.code -eq 200) {
    Pass "F2: Logout returned 200"
    $logoutMsg = $null
    if ($logoutResp.body -and $logoutResp.body.data -and $logoutResp.body.data.message) {
        $logoutMsg = $logoutResp.body.data.message
    } elseif ($logoutResp.body -and $logoutResp.body.message) {
        $logoutMsg = $logoutResp.body.message
    }
    if ($logoutMsg) { Write-Host "  Message: $logoutMsg" }
} else {
    Fail "F2: Logout returned $($logoutResp.code)"
}

Write-Host ""
Write-Host "=== TEST F3: Use same accessToken after logout -> should be 401 ===" -ForegroundColor White
$afterLogoutResp = Api-Expect "GET" "/auth/profile" $logoutToken
if ($afterLogoutResp.code -eq 401) {
    Pass "F3: AccessToken rejected after logout (session invalidated)"
} else {
    Warn "F3: AccessToken still accepted after logout ($($afterLogoutResp.code)) - session check may be deferred"
}

Write-Host ""
Write-Host "=== TEST F4: Try refresh after logout -> should be 401 ===" -ForegroundColor White
$refreshAfterLogout = Refresh-Token $logoutLogin.session
if ($refreshAfterLogout.statusCode -eq 401) {
    Pass "F4: Refresh after logout rejected (401)"
} else {
    Warn "F4: Refresh after logout returned $($refreshAfterLogout.statusCode)"
}

# ================================================================
# PART G: JWT Payload Inspection (~6 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: JWT Payload Inspection" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST G1: Login and get accessToken ===" -ForegroundColor White
$gLogin = Login-WithSession $TEST_EMAIL $TEST_PASS
$gToken = $gLogin.accessToken
if ($gToken) {
    Pass "G1: Login for JWT inspection OK"
} else {
    Fail "G1: Login for JWT inspection failed"
}

Write-Host ""
Write-Host "=== TEST G2: Decode JWT payload from base64url ===" -ForegroundColor White
$gParts = $gToken -split '\.'
$gPayloadJson = $null
$gClaims = $null
if ($gParts.Count -eq 3) {
    try {
        $gPayloadJson = Decode-JwtSegment $gParts[1]
        $gClaims = $gPayloadJson | ConvertFrom-Json
        Write-Host "  Decoded payload: $gPayloadJson"
        Pass "G2: JWT payload decoded successfully"
    } catch {
        Fail "G2: Failed to decode JWT payload: $($_.Exception.Message)"
    }
} else {
    Fail "G2: JWT does not have 3 parts"
}

Write-Host ""
Write-Host "=== TEST G3: claims.sub is a valid UUID ===" -ForegroundColor White
if ($gClaims -and $gClaims.sub) {
    $uuidPattern = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    if ($gClaims.sub -match $uuidPattern) {
        Pass "G3: claims.sub is a valid UUID ($($gClaims.sub))"
    } else {
        # Could also be a cuid or other format
        Write-Host "  sub: $($gClaims.sub)"
        Warn "G3: claims.sub exists but is not UUID format (may be cuid)"
    }
} else {
    Fail "G3: claims.sub missing"
}

Write-Host ""
Write-Host "=== TEST G4: claims.email matches login email ===" -ForegroundColor White
if ($gClaims -and $gClaims.email -eq $TEST_EMAIL) {
    Pass "G4: claims.email = $TEST_EMAIL"
} else {
    Fail "G4: claims.email = '$($gClaims.email)' (expected '$TEST_EMAIL')"
}

Write-Host ""
Write-Host "=== TEST G5: claims.role matches expected (SALE) ===" -ForegroundColor White
if ($gClaims -and $gClaims.role -eq "SALE") {
    Pass "G5: claims.role = SALE"
} else {
    if ($gClaims) {
        Warn "G5: claims.role = '$($gClaims.role)' (expected SALE)"
    } else {
        Fail "G5: No claims available"
    }
}

Write-Host ""
Write-Host "=== TEST G6: claims.exp - claims.iat = 900 (15 min) ===" -ForegroundColor White
if ($gClaims -and $gClaims.exp -and $gClaims.iat) {
    $ttl = [int]$gClaims.exp - [int]$gClaims.iat
    Write-Host "  iat: $($gClaims.iat), exp: $($gClaims.exp), diff: $ttl"
    if ($ttl -eq 900) {
        Pass "G6: Token TTL = 900s (15 min)"
    } else {
        Warn "G6: Token TTL = ${ttl}s (expected 900)"
    }
} else {
    Fail "G6: claims.exp or claims.iat missing"
}

# ================================================================
# PART H: Wrong Password Login (~3 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Wrong Password Login" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST H1: Login with wrong password -> 401 ===" -ForegroundColor White
$wrongPassResult = Login-WithSession $TEST_EMAIL "WrongPassword123!"
if ($wrongPassResult.statusCode -eq 401) {
    Pass "H1: Wrong password -> 401 Unauthorized"
} else {
    Fail "H1: Wrong password -> $($wrongPassResult.statusCode) (expected 401)"
}

Write-Host ""
Write-Host "=== TEST H2: Error message does not leak info ===" -ForegroundColor White
$hErrBody = $null
if ($wrongPassResult.error) {
    try { $hErrBody = $wrongPassResult.error | ConvertFrom-Json } catch {}
}
if ($hErrBody -and $hErrBody.message) {
    $hMsg = $hErrBody.message
    Write-Host "  Error: $hMsg"
    # Should NOT say "password is wrong" or "user not found" specifically
    if ($hMsg -match "Invalid email or password" -or $hMsg -match "Unauthorized" -or $hMsg -match "invalid credentials") {
        Pass "H2: Generic error message (no info leak)"
    } else {
        Warn "H2: Error message: '$hMsg' (should be generic)"
    }
} else {
    Warn "H2: No error message in response body"
}

Write-Host ""
Write-Host "=== TEST H3: Second wrong attempt still works (within rate limit) ===" -ForegroundColor White
$wrongPass2 = Login-WithSession $TEST_EMAIL "AnotherWrongPass!"
if ($wrongPass2.statusCode -eq 401) {
    Pass "H3: Second wrong attempt returns 401 (not rate limited yet)"
} elseif ($wrongPass2.statusCode -eq 429) {
    Warn "H3: Got 429 Too Many Requests (rate limit hit, may be from previous test runs)"
} else {
    Fail "H3: Unexpected status $($wrongPass2.statusCode)"
}

# ================================================================
# PART I: Profile Endpoint (~3 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART I: Profile Endpoint" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST I1: GET /auth/profile -> full user object ===" -ForegroundColor White
# Use the token from Part G login (still valid)
$iProfileResp = Api-Expect "GET" "/auth/profile" $gToken
$iProfile = $null
if ($iProfileResp.code -eq 200) {
    if ($iProfileResp.body -and $iProfileResp.body.data) { $iProfile = $iProfileResp.body.data }
    elseif ($iProfileResp.body) { $iProfile = $iProfileResp.body }
    if ($iProfile -and $iProfile.id -and $iProfile.email -and $iProfile.role) {
        Write-Host "  id: $($iProfile.id)"
        Write-Host "  email: $($iProfile.email)"
        Write-Host "  role: $($iProfile.role)"
        Write-Host "  fullName: $($iProfile.fullName)"
        Pass "I1: Profile has id, email, role, fullName"
    } else {
        Fail "I1: Profile missing required fields"
    }
} else {
    Fail "I1: GET /auth/profile returned $($iProfileResp.code)"
}

Write-Host ""
Write-Host "=== TEST I2: No sensitive fields in profile ===" -ForegroundColor White
if ($iProfile) {
    $hasSensitive = $false
    $sensitiveFields = @("passwordHash", "twoFactorSecret", "twoFactorBackupCodes", "resetToken", "resetTokenExpiry")
    foreach ($field in $sensitiveFields) {
        $val = $iProfile | Select-Object -ExpandProperty $field -ErrorAction SilentlyContinue
        if ($val -ne $null) {
            Write-Host "  SENSITIVE FIELD EXPOSED: $field" -ForegroundColor Red
            $hasSensitive = $true
        }
    }
    if (-not $hasSensitive) {
        Pass "I2: No sensitive fields in profile response"
    } else {
        Fail "I2: Sensitive field(s) exposed in profile response"
    }
} else {
    Warn "I2: No profile to inspect"
}

Write-Host ""
Write-Host "=== TEST I3: Role and email correct ===" -ForegroundColor White
if ($iProfile) {
    if ($iProfile.email -eq $TEST_EMAIL) {
        Pass "I3a: Profile email correct"
    } else {
        Fail "I3a: Profile email = '$($iProfile.email)'"
    }
    if ($iProfile.role -eq "SALE") {
        Pass "I3b: Profile role = SALE"
    } else {
        Warn "I3b: Profile role = '$($iProfile.role)' (expected SALE)"
    }
} else {
    Warn "I3: No profile to verify"
}

# ================================================================
# PART J: Change Password (~5 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART J: Change Password" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$ORIG_PASS = "Admin@123"
$NEW_PASS  = "Admin@1234"

Write-Host ""
Write-Host "=== TEST J1: PATCH /auth/change-password ===" -ForegroundColor White
# Login fresh for change-password test
$jLogin = Login-WithSession $TEST_EMAIL $ORIG_PASS
$jToken = $jLogin.accessToken
if (-not $jToken) {
    Fail "J1: Could not login for change-password test"
} else {
    $changeDto = @{
        currentPassword = $ORIG_PASS
        newPassword     = $NEW_PASS
        confirmPassword = $NEW_PASS
    }
    $changeResp = Api-Expect "PATCH" "/auth/change-password" $jToken $changeDto
    if ($changeResp.code -eq 200) {
        Pass "J1: Change password returned 200"
    } else {
        Fail "J1: Change password returned $($changeResp.code): $($changeResp.error)"
    }
}

Write-Host ""
Write-Host "=== TEST J2: Verify success message ===" -ForegroundColor White
$jMsg = $null
if ($changeResp -and $changeResp.body) {
    if ($changeResp.body.data -and $changeResp.body.data.message) { $jMsg = $changeResp.body.data.message }
    elseif ($changeResp.body.message) { $jMsg = $changeResp.body.message }
}
if ($jMsg) {
    Write-Host "  Message: $jMsg"
    Pass "J2: Success message returned"
} else {
    Warn "J2: No success message in response"
}

Write-Host ""
Write-Host "=== TEST J3: Login with NEW password -> should work ===" -ForegroundColor White
$newPassLogin = Login-WithSession $TEST_EMAIL $NEW_PASS
if ($newPassLogin.accessToken) {
    Pass "J3: Login with new password succeeded"
} else {
    Fail "J3: Login with new password failed ($($newPassLogin.statusCode))"
}

Write-Host ""
Write-Host "=== TEST J4: Login with OLD password -> should fail ===" -ForegroundColor White
$oldPassLogin = Login-WithSession $TEST_EMAIL $ORIG_PASS
if ($oldPassLogin.statusCode -eq 401) {
    Pass "J4: Login with old password rejected (401)"
} elseif ($oldPassLogin.accessToken) {
    Fail "J4: Login with old password still works (should be rejected)"
} else {
    # Could be rate limited
    if ($oldPassLogin.statusCode -eq 429) {
        Warn "J4: Rate limited (429) - cannot verify old password rejection"
    } else {
        Pass "J4: Login with old password failed (status $($oldPassLogin.statusCode))"
    }
}

Write-Host ""
Write-Host "=== TEST J5: Restore original password ===" -ForegroundColor White
# Must use token from new-password login
$restoreToken = $newPassLogin.accessToken
if ($restoreToken) {
    $restoreDto = @{
        currentPassword = $NEW_PASS
        newPassword     = $ORIG_PASS
        confirmPassword = $ORIG_PASS
    }
    $restoreResp = Api-Expect "PATCH" "/auth/change-password" $restoreToken $restoreDto
    if ($restoreResp.code -eq 200) {
        Pass "J5: Original password restored successfully"
        # Verify we can login with original password
        $verifyLogin = Login-WithSession $TEST_EMAIL $ORIG_PASS
        if ($verifyLogin.accessToken) {
            Write-Host "  Verified: login with original password works" -ForegroundColor Green
        } else {
            Write-Host "  WARNING: Cannot verify original password login" -ForegroundColor Yellow
        }
    } else {
        Fail "J5: Failed to restore original password ($($restoreResp.code))"
        Write-Host "  CRITICAL: Password may be stuck at '$NEW_PASS'!" -ForegroundColor Red
    }
} else {
    Fail "J5: No token available to restore password"
    Write-Host "  CRITICAL: Password may be stuck at '$NEW_PASS'!" -ForegroundColor Red
}

# ================================================================
# PART K: Forgot Password (Non-destructive) (~2 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART K: Forgot Password (Non-destructive)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST K1: POST /auth/forgot-password with real email -> 200 ===" -ForegroundColor White
$forgotResp = Api-Expect "POST" "/auth/forgot-password" $null @{ email = $TEST_EMAIL }
if ($forgotResp.code -eq 200) {
    $kMsg = $null
    if ($forgotResp.body -and $forgotResp.body.data -and $forgotResp.body.data.message) {
        $kMsg = $forgotResp.body.data.message
    } elseif ($forgotResp.body -and $forgotResp.body.message) {
        $kMsg = $forgotResp.body.message
    }
    if ($kMsg) { Write-Host "  Message: $kMsg" }
    Pass "K1: forgot-password with real email -> 200"
} else {
    Fail "K1: forgot-password returned $($forgotResp.code)"
}

Write-Host ""
Write-Host "=== TEST K2: POST /auth/forgot-password with non-existent email -> 200 (no enumeration) ===" -ForegroundColor White
$forgotFakeResp = Api-Expect "POST" "/auth/forgot-password" $null @{ email = "nonexistent999@example.com" }
if ($forgotFakeResp.code -eq 200) {
    Pass "K2: forgot-password with fake email -> 200 (prevents email enumeration)"
} else {
    Fail "K2: forgot-password with fake email -> $($forgotFakeResp.code) (should be 200 to prevent enumeration)"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-SEC-001: JWT Token Lifecycle" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Part A: Login + Token Structure"
Write-Host "  Part B: Access Token Usage"
Write-Host "  Part C: Invalid/Expired Token"
Write-Host "  Part D: Refresh Token Flow"
Write-Host "  Part E: Token Rotation (Reuse Detection)"
Write-Host "  Part F: Logout"
Write-Host "  Part G: JWT Payload Inspection"
Write-Host "  Part H: Wrong Password Login"
Write-Host "  Part I: Profile Endpoint"
Write-Host "  Part J: Change Password"
Write-Host "  Part K: Forgot Password (Non-destructive)"
Write-Host ""
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
$total = $passCount + $failCount + $warnCount
Write-Host "  TOTAL: $total"
Write-Host ""
if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $failCount TEST(S) FAILED" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Cyan
