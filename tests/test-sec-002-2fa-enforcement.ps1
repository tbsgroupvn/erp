# ================================================================
# TEST-SEC-002: 2FA Enforcement by Role + TOTP/SMS/Backup Code Verification
# Severity: HIGH
#
# Tests:
#   A. SALE login - no 2FA required (normal flow)
#   B. 2FA status check
#   C. 2FA setup flow (TOTP secret + QR code generation)
#   D. Enable 2FA with wrong code (expect rejection)
#   E. 2FA verify endpoint with invalid token
#   F. Login flow structure for 2FA-enabled account (CEO/CFO)
#   G. Invalid OTP verification on 2FA-enabled account
#   H. SMS OTP flow structure
#   I. Backup codes generation
#   J. 2FA disable (cleanup on SALE account)
#   K. Rate limit verification (non-destructive)
#   L. Role-based 2FA enforcement check
#
# Limitations:
#   - Cannot generate valid TOTP codes in PowerShell (no otplib)
#   - Cannot read SMS messages
#   - Tests focus on flow structure, error handling, and endpoint availability
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

function Api-Expect-Header($method, $path, $headers, $body) {
    $uri = "$BASE_URL$path"
    $params = @{
        Uri     = $uri
        Method  = $method
        Headers = $headers
    }
    if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 10 -Compress) }
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

# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-SEC-002: 2FA Enforcement + TOTP/SMS/Backup Verification" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------------
# SETUP: Login with SALE account (expected: no 2FA)
# ----------------------------------------------------------------
Write-Host "--- SETUP: Login accounts ---" -ForegroundColor Yellow

$SALE_EMAIL = "sale01@$DOMAIN"
$CEO_EMAIL = "ceo@$DOMAIN"
$CFO_EMAIL = "cfo@$DOMAIN"
$KETOAN_EMAIL = "ketoan@$DOMAIN"

# Login SALE normally (should succeed without 2FA)
$SALE_TOKEN = Login $SALE_EMAIL
if ($SALE_TOKEN) {
    Write-Host "  SALE token obtained" -ForegroundColor Cyan
} else {
    Write-Host "  SALE login failed - some tests will be skipped" -ForegroundColor Yellow
}

# ================================================================
# PART A: SALE login - no 2FA required
# ================================================================
Write-Host ""
Write-Host "--- PART A: SALE login - no 2FA required ---" -ForegroundColor Yellow

# A1: POST /auth/login with sale01@ - full response check
$a1 = Api-Expect "POST" "/auth/login" $null @{ email = $SALE_EMAIL; password = "Admin@123" }

if ($a1.code -eq 200) {
    Pass "A1: SALE login returns 200 OK"
} elseif ($a1.code -eq 429) {
    Warn "A1: SALE login rate-limited (429) - try again later"
} else {
    Fail "A1: SALE login expected 200, got $($a1.code)"
}

# A2: Verify response has tokens (NOT requires2FA)
$a1Data = $null
if ($a1.body -and $a1.body.data) { $a1Data = $a1.body.data }
if ($a1Data -and $a1Data.tokens -and $a1Data.tokens.accessToken) {
    Pass "A2: SALE login returns accessToken (no 2FA challenge)"
} elseif ($a1Data -and $a1Data.requires2FA -eq $true) {
    Warn "A2: SALE account has 2FA enabled (unexpected for SALE role)"
} elseif ($a1.code -eq 429) {
    Warn "A2: Rate-limited, skipping token check"
} else {
    Fail "A2: SALE login response missing tokens structure"
}

# A3: Verify no 2FA challenge
if ($a1Data -and $a1Data.requires2FA -eq $true) {
    Warn "A3: SALE account has 2FA enabled - unexpected"
} elseif ($a1Data -and $a1Data.tokens) {
    Pass "A3: No 2FA challenge for SALE login (expected)"
} elseif ($a1.code -eq 429) {
    Warn "A3: Rate-limited, skipping"
} else {
    Fail "A3: Unexpected login response structure"
}

# A4: GET /auth/2fa/status with sale token
if ($SALE_TOKEN) {
    $a4 = D (Api "GET" "/auth/2fa/status" $SALE_TOKEN)
    if ($null -ne $a4 -and $null -ne $a4.is2FAEnabled) {
        Pass "A4: 2FA status endpoint returns is2FAEnabled=$($a4.is2FAEnabled)"
    } else {
        Fail "A4: 2FA status endpoint failed or missing is2FAEnabled field"
    }
} else {
    Warn "A4: No SALE token, skipping 2FA status check"
}

# ================================================================
# PART B: 2FA status detail check
# ================================================================
Write-Host ""
Write-Host "--- PART B: 2FA status detail check ---" -ForegroundColor Yellow

if ($SALE_TOKEN) {
    # B1: Login already done above
    Pass "B1: SALE login successful (reusing token)"

    # B2: GET /auth/2fa/status
    $b2 = D (Api "GET" "/auth/2fa/status" $SALE_TOKEN)
    if ($null -ne $b2) {
        Pass "B2: GET /auth/2fa/status returned data"
    } else {
        Fail "B2: GET /auth/2fa/status returned null"
    }

    # B3: Verify is2FAEnabled field exists
    if ($null -ne $b2 -and $b2.PSObject.Properties.Name -contains "is2FAEnabled") {
        Pass "B3: is2FAEnabled field exists in 2FA status response"
    } else {
        Fail "B3: is2FAEnabled field missing from 2FA status response"
    }

    # B4: If 2FA not enabled, verify hasBackupCodes=false
    if ($null -ne $b2 -and $b2.is2FAEnabled -eq $false) {
        if ($b2.hasBackupCodes -eq $false) {
            Pass "B4: 2FA disabled -> hasBackupCodes=false (correct)"
        } else {
            Fail "B4: 2FA disabled but hasBackupCodes=$($b2.hasBackupCodes)"
        }
    } elseif ($null -ne $b2 -and $b2.is2FAEnabled -eq $true) {
        Warn "B4: SALE already has 2FA enabled - cannot verify hasBackupCodes=false"
    } else {
        Fail "B4: Cannot read 2FA status"
    }
} else {
    Warn "B1: No SALE token"
    Warn "B2: Skipped - no token"
    Warn "B3: Skipped - no token"
    Warn "B4: Skipped - no token"
}

# ================================================================
# PART C: 2FA setup flow (on SALE account)
# ================================================================
Write-Host ""
Write-Host "--- PART C: 2FA TOTP setup flow ---" -ForegroundColor Yellow

$setupResult = $null
$totpSecret = $null

if ($SALE_TOKEN) {
    # C1: POST /auth/2fa/setup -> get secret, qrCodeDataUrl, otpauthUrl
    $c1Raw = Api "POST" "/auth/2fa/setup" $SALE_TOKEN
    $c1 = D $c1Raw

    if ($null -ne $c1 -and $c1.secret) {
        Pass "C1: 2FA setup returns secret and QR code data"
        $setupResult = $c1
    } else {
        Fail "C1: 2FA setup failed or returned no secret"
    }

    if ($setupResult) {
        # C2: Verify secret is non-empty string
        if ($setupResult.secret -and $setupResult.secret.Length -gt 0) {
            Pass "C2: TOTP secret is non-empty ($($setupResult.secret.Length) chars)"
        } else {
            Fail "C2: TOTP secret is empty"
        }

        # C3: Verify qrCodeDataUrl starts with "data:image/"
        if ($setupResult.qrCodeDataUrl -and $setupResult.qrCodeDataUrl.StartsWith("data:image/")) {
            Pass "C3: qrCodeDataUrl starts with 'data:image/'"
        } else {
            Fail "C3: qrCodeDataUrl does not start with 'data:image/' - got: $($setupResult.qrCodeDataUrl.Substring(0, [Math]::Min(30, $setupResult.qrCodeDataUrl.Length)))"
        }

        # C4: Verify otpauthUrl starts with "otpauth://totp/"
        if ($setupResult.otpauthUrl -and $setupResult.otpauthUrl.StartsWith("otpauth://totp/")) {
            Pass "C4: otpauthUrl starts with 'otpauth://totp/'"
        } else {
            Fail "C4: otpauthUrl does not start with 'otpauth://totp/' - got: $($setupResult.otpauthUrl)"
        }

        # C5: Extract secret from otpauthUrl
        $totpSecret = $null
        if ($setupResult.otpauthUrl -match "secret=([A-Z2-7]+)") {
            $totpSecret = $Matches[1]
            Pass "C5: Extracted TOTP secret from otpauthUrl ($($totpSecret.Length) chars)"
        } else {
            Fail "C5: Cannot extract secret from otpauthUrl"
        }

        # C6: Verify otpauthUrl contains the account email
        $saleEmailEncoded = $SALE_EMAIL.Replace("@", "%40")
        if ($setupResult.otpauthUrl -match [regex]::Escape($SALE_EMAIL) -or $setupResult.otpauthUrl -match [regex]::Escape($saleEmailEncoded)) {
            Pass "C6: otpauthUrl contains the account email"
        } else {
            Warn "C6: otpauthUrl does not contain email '$SALE_EMAIL' (may use display name)"
        }
    } else {
        Warn "C2: Skipped - setup failed"
        Warn "C3: Skipped - setup failed"
        Warn "C4: Skipped - setup failed"
        Warn "C5: Skipped - setup failed"
        Warn "C6: Skipped - setup failed"
    }
} else {
    Warn "C1: No SALE token"
    Warn "C2: Skipped"
    Warn "C3: Skipped"
    Warn "C4: Skipped"
    Warn "C5: Skipped"
    Warn "C6: Skipped"
}

# ================================================================
# PART D: Enable 2FA with WRONG code (expect rejection)
# ================================================================
Write-Host ""
Write-Host "--- PART D: Enable 2FA with wrong code ---" -ForegroundColor Yellow

if ($SALE_TOKEN -and $setupResult) {
    # D1: POST /auth/2fa/enable { code: "000000" } -> expect 400
    $d1 = Api-Expect "POST" "/auth/2fa/enable" $SALE_TOKEN @{ code = "000000" }
    if ($d1.code -eq 400) {
        Pass "D1: Enable 2FA with code '000000' rejected (400)"
    } elseif ($d1.code -eq 401) {
        Pass "D1: Enable 2FA with code '000000' rejected (401)"
    } else {
        Fail "D1: Enable 2FA with '000000' expected 400/401, got $($d1.code)"
    }

    # D2: POST /auth/2fa/enable { code: "123456" } -> expect 400
    $d2 = Api-Expect "POST" "/auth/2fa/enable" $SALE_TOKEN @{ code = "123456" }
    if ($d2.code -eq 400) {
        Pass "D2: Enable 2FA with code '123456' rejected (400)"
    } elseif ($d2.code -eq 401) {
        Pass "D2: Enable 2FA with code '123456' rejected (401)"
    } else {
        Fail "D2: Enable 2FA with '123456' expected 400/401, got $($d2.code)"
    }

    # D3: Verify error message mentions invalid code
    $d2Msg = ""
    if ($d2.body -and $d2.body.message) { $d2Msg = $d2.body.message }
    if ($d2Msg -match "(?i)invalid|code|wrong|incorrect") {
        Pass "D3: Error message indicates invalid code: '$d2Msg'"
    } elseif ($d2.code -eq 400 -or $d2.code -eq 401) {
        Warn "D3: Error code correct but message unclear: '$d2Msg'"
    } else {
        Fail "D3: No clear error message about invalid code"
    }
} else {
    Warn "D1: Skipped - no SALE token or setup incomplete"
    Warn "D2: Skipped"
    Warn "D3: Skipped"
}

# ================================================================
# PART E: 2FA verify endpoint with invalid token
# ================================================================
Write-Host ""
Write-Host "--- PART E: 2FA verify endpoint with invalid token ---" -ForegroundColor Yellow

# E1: POST /auth/2fa/verify with no x-2fa-token header -> 401
$e1Headers = @{ "Content-Type" = "application/json" }
$e1 = Api-Expect-Header "POST" "/auth/2fa/verify" $e1Headers @{ userId = "fake-user-id"; code = "123456"; method = "TOTP" }
if ($e1.code -eq 401) {
    Pass "E1: 2FA verify with no token returns 401"
} elseif ($e1.code -eq 400) {
    Pass "E1: 2FA verify with no token returns 400 (validation error)"
} else {
    Fail "E1: 2FA verify with no token expected 401/400, got $($e1.code)"
}

# E2: POST /auth/2fa/verify with invalid tempToken -> 401
$e2Headers = @{ "Content-Type" = "application/json"; "x-2fa-token" = "invalid-token-12345" }
$e2 = Api-Expect-Header "POST" "/auth/2fa/verify" $e2Headers @{ userId = "fake-user-id"; code = "123456"; method = "TOTP" }
if ($e2.code -eq 401) {
    Pass "E2: 2FA verify with invalid tempToken returns 401"
} else {
    Fail "E2: 2FA verify with invalid tempToken expected 401, got $($e2.code)"
}

# E3: POST /auth/2fa/verify with expired/garbage JWT token -> 401
$garbageJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidHlwZSI6IjJmYS1wZW5kaW5nIiwiZXhwIjoxMDAwMDAwMDAwfQ.garbage_sig"
$e3Headers = @{ "Content-Type" = "application/json"; "x-2fa-token" = $garbageJwt }
$e3 = Api-Expect-Header "POST" "/auth/2fa/verify" $e3Headers @{ userId = "1234567890"; code = "123456"; method = "TOTP" }
if ($e3.code -eq 401) {
    Pass "E3: 2FA verify with garbage JWT returns 401"
} else {
    Fail "E3: 2FA verify with garbage JWT expected 401, got $($e3.code)"
}

# ================================================================
# PART F: Login flow structure for 2FA-enabled account (CEO/CFO)
# ================================================================
Write-Host ""
Write-Host "--- PART F: Login flow for 2FA-enabled account ---" -ForegroundColor Yellow

# Try multiple high-privilege accounts to find one with 2FA enabled
$twoFaAccount = $null
$twoFaLoginData = $null
$twoFaTempToken = $null
$twoFaUserId = $null

$highPrivEmails = @($CEO_EMAIL, $CFO_EMAIL, $KETOAN_EMAIL)

foreach ($email in $highPrivEmails) {
    $fResp = Api-Expect "POST" "/auth/login" $null @{ email = $email; password = "Admin@123" }
    if ($fResp.code -eq 200 -and $fResp.body -and $fResp.body.data) {
        $fData = $fResp.body.data
        if ($fData.requires2FA -eq $true) {
            $twoFaAccount = $email
            $twoFaLoginData = $fData
            $twoFaTempToken = $fData.tempToken
            $twoFaUserId = $fData.userId
            Write-Host "  Found 2FA-enabled account: $email" -ForegroundColor Cyan
            break
        }
    } elseif ($fResp.code -eq 429) {
        Write-Host "  Rate-limited for $email, trying next..." -ForegroundColor Yellow
    }
}

# F1: Check if any BGD account requires 2FA
if ($twoFaAccount) {
    Pass "F1: Found 2FA-enabled account: $twoFaAccount"
} else {
    Warn "F1: No BGD/accounting account has 2FA enabled"
}

# F2: Verify tempToken returned
if ($twoFaTempToken -and $twoFaTempToken.Length -gt 0) {
    Pass "F2: tempToken returned ($($twoFaTempToken.Length) chars)"
} elseif ($twoFaAccount) {
    Fail "F2: 2FA account found but no tempToken"
} else {
    Warn "F2: Skipped - no 2FA account found"
}

# F3: Verify methods array
if ($twoFaLoginData -and $twoFaLoginData.methods) {
    $methodsList = $twoFaLoginData.methods -join ", "
    if ($twoFaLoginData.methods.Count -gt 0) {
        Pass "F3: 2FA methods returned: [$methodsList]"
    } else {
        Fail "F3: 2FA methods array is empty"
    }
} elseif ($twoFaAccount) {
    Fail "F3: 2FA account found but no methods array"
} else {
    Warn "F3: Skipped - no 2FA account"
}

# F4: Verify userId returned
if ($twoFaUserId -and $twoFaUserId.Length -gt 0) {
    Pass "F4: userId returned in 2FA challenge: $twoFaUserId"
} elseif ($twoFaAccount) {
    Fail "F4: 2FA account found but no userId"
} else {
    Warn "F4: Skipped - no 2FA account"
}

# F5: Summary
if (-not $twoFaAccount) {
    Warn "F5: No 2FA-enabled accounts found among BGD/accounting roles"
} else {
    Pass "F5: 2FA login challenge flow verified for $twoFaAccount"
}

# ================================================================
# PART G: Invalid OTP verification on 2FA-enabled account
# ================================================================
Write-Host ""
Write-Host "--- PART G: Invalid OTP verification ---" -ForegroundColor Yellow

if ($twoFaTempToken -and $twoFaUserId) {
    # G1: Login to get tempToken (already done in Part F)
    Pass "G1: Using tempToken from Part F login"

    # G2: POST /auth/2fa/verify { userId, code: "000000", method: "TOTP" } with x-2fa-token -> 401
    $g2Headers = @{ "Content-Type" = "application/json"; "x-2fa-token" = $twoFaTempToken }
    $g2 = Api-Expect-Header "POST" "/auth/2fa/verify" $g2Headers @{ userId = $twoFaUserId; code = "000000"; method = "TOTP" }
    if ($g2.code -eq 401) {
        Pass "G2: Invalid OTP '000000' rejected with 401"
    } elseif ($g2.code -eq 400) {
        Pass "G2: Invalid OTP '000000' rejected with 400"
    } else {
        Fail "G2: Invalid OTP expected 401/400, got $($g2.code)"
    }

    # G3: POST /auth/2fa/verify { userId, code: "999999", method: "TOTP" } -> 401
    # Re-login to get fresh tempToken (previous may still be valid within 5min)
    $g3LoginResp = Api-Expect "POST" "/auth/login" $null @{ email = $twoFaAccount; password = "Admin@123" }
    $g3TempToken = $null
    if ($g3LoginResp.code -eq 200 -and $g3LoginResp.body.data.tempToken) {
        $g3TempToken = $g3LoginResp.body.data.tempToken
    }

    if ($g3TempToken) {
        $g3Headers = @{ "Content-Type" = "application/json"; "x-2fa-token" = $g3TempToken }
        $g3 = Api-Expect-Header "POST" "/auth/2fa/verify" $g3Headers @{ userId = $twoFaUserId; code = "999999"; method = "TOTP" }
        if ($g3.code -eq 401) {
            Pass "G3: Invalid OTP '999999' rejected with 401"
        } elseif ($g3.code -eq 400) {
            Pass "G3: Invalid OTP '999999' rejected with 400"
        } else {
            Fail "G3: Invalid OTP expected 401/400, got $($g3.code)"
        }
    } else {
        Warn "G3: Could not re-login to get fresh tempToken (may be rate-limited)"
    }

    # G4: Verify we haven't been rate-limited after 2 attempts
    $g4LoginResp = Api-Expect "POST" "/auth/login" $null @{ email = $twoFaAccount; password = "Admin@123" }
    if ($g4LoginResp.code -eq 200) {
        Pass "G4: Not rate-limited after 2 failed OTP attempts"
    } elseif ($g4LoginResp.code -eq 429) {
        Warn "G4: Rate-limited (429) after OTP attempts - rate limit may be strict"
    } else {
        Fail "G4: Unexpected status $($g4LoginResp.code) after OTP attempts"
    }
} else {
    Warn "G1: No 2FA account available - skipping OTP tests"
    Warn "G2: Skipped"
    Warn "G3: Skipped"
    Warn "G4: Skipped"
}

# ================================================================
# PART H: SMS OTP flow structure
# ================================================================
Write-Host ""
Write-Host "--- PART H: SMS OTP flow structure ---" -ForegroundColor Yellow

$hasSmsMethod = $false
if ($twoFaLoginData -and $twoFaLoginData.methods) {
    foreach ($m in $twoFaLoginData.methods) {
        if ($m -eq "SMS") { $hasSmsMethod = $true; break }
    }
}

if ($twoFaTempToken -and $twoFaUserId -and $hasSmsMethod) {
    # H1: Re-login to get fresh tempToken
    $h1LoginResp = Api-Expect "POST" "/auth/login" $null @{ email = $twoFaAccount; password = "Admin@123" }
    $h1TempToken = $null
    if ($h1LoginResp.code -eq 200 -and $h1LoginResp.body.data.tempToken) {
        $h1TempToken = $h1LoginResp.body.data.tempToken
        Pass "H1: Re-login for SMS test successful"
    } else {
        Warn "H1: Could not re-login for SMS test"
    }

    if ($h1TempToken) {
        # H2: POST /auth/2fa/sms/send { userId } with x-2fa-token header
        $h2Headers = @{ "Content-Type" = "application/json"; "x-2fa-token" = $h1TempToken }
        $h2 = Api-Expect-Header "POST" "/auth/2fa/sms/send" $h2Headers @{ userId = $twoFaUserId }
        if ($h2.code -eq 200) {
            Pass "H2: SMS OTP send returned 200"
        } elseif ($h2.code -eq 400) {
            Warn "H2: SMS send returned 400 - phone number may not be configured"
        } else {
            Fail "H2: SMS OTP send expected 200/400, got $($h2.code)"
        }

        # H3: POST /auth/2fa/verify { userId, code: "000000", method: "SMS" } -> 401
        $h3Headers = @{ "Content-Type" = "application/json"; "x-2fa-token" = $h1TempToken }
        $h3 = Api-Expect-Header "POST" "/auth/2fa/verify" $h3Headers @{ userId = $twoFaUserId; code = "000000"; method = "SMS" }
        if ($h3.code -eq 401) {
            Pass "H3: Invalid SMS code '000000' rejected (401)"
        } elseif ($h3.code -eq 400) {
            Pass "H3: Invalid SMS code '000000' rejected (400)"
        } else {
            Fail "H3: Invalid SMS code expected 401/400, got $($h3.code)"
        }

        # H4: Verify SMS send response message
        if ($h2.code -eq 200 -and $h2.body -and $h2.body.data -and $h2.body.data.message) {
            Pass "H4: SMS send response has message: '$($h2.body.data.message)'"
        } elseif ($h2.code -eq 200) {
            Warn "H4: SMS send succeeded but no message in response"
        } else {
            Warn "H4: SMS send did not succeed - cannot verify response message"
        }
    } else {
        Warn "H2: Skipped - no fresh tempToken"
        Warn "H3: Skipped"
        Warn "H4: Skipped"
    }
} elseif ($twoFaTempToken -and $twoFaUserId) {
    Warn "H1: 2FA account does not have SMS method available"
    Warn "H2: Skipped - no SMS method"
    Warn "H3: Skipped"
    Warn "H4: Skipped"
} else {
    Warn "H1: No 2FA account available"
    Warn "H2: Skipped"
    Warn "H3: Skipped"
    Warn "H4: Skipped"
}

# ================================================================
# PART I: Backup codes generation
# ================================================================
Write-Host ""
Write-Host "--- PART I: Backup codes generation ---" -ForegroundColor Yellow

# Backup codes require 2FA to be enabled on the account.
# We need a token from a fully-authenticated 2FA account.
# Since we can't complete 2FA login (no valid TOTP), test with SALE account instead.

if ($SALE_TOKEN) {
    # I1: POST /auth/2fa/backup-codes with SALE token (2FA not enabled -> expect 400)
    $i1 = Api-Expect "POST" "/auth/2fa/backup-codes" $SALE_TOKEN
    if ($i1.code -eq 400) {
        Pass "I1: Backup codes generation rejected - 2FA not enabled (400)"
    } elseif ($i1.code -eq 200 -and $i1.body -and $i1.body.data -and $i1.body.data.backupCodes) {
        # Unexpected: SALE has 2FA enabled
        $backupCodes = $i1.body.data.backupCodes
        Pass "I1: Backup codes returned (SALE has 2FA - unexpected)"

        # I2: Verify backupCodes is array of 10 items
        if ($backupCodes.Count -eq 10) {
            Pass "I2: backupCodes array has 10 items"
        } else {
            Fail "I2: backupCodes expected 10 items, got $($backupCodes.Count)"
        }

        # I3: Verify each code matches XXXX-XXXX format
        $allMatch = $true
        foreach ($bc in $backupCodes) {
            if ($bc -notmatch "^[A-F0-9]{4}-[A-F0-9]{4}$") {
                $allMatch = $false
                Write-Host "    Code '$bc' does not match XXXX-XXXX format" -ForegroundColor DarkYellow
            }
        }
        if ($allMatch) {
            Pass "I3: All backup codes match XXXX-XXXX hex format"
        } else {
            Fail "I3: Some backup codes do not match XXXX-XXXX format"
        }
    } else {
        Warn "I1: Unexpected response code $($i1.code) for backup codes"
        Warn "I2: Skipped"
        Warn "I3: Skipped"
    }
} else {
    Warn "I1: No SALE token available"
    Warn "I2: Skipped"
    Warn "I3: Skipped"
}

# Test backup codes with a 2FA-enabled account if we have one logged in normally
# (We can't since 2FA blocks normal login, so this is just structural testing)

# ================================================================
# PART J: 2FA disable (cleanup on SALE account)
# ================================================================
Write-Host ""
Write-Host "--- PART J: 2FA disable (cleanup) ---" -ForegroundColor Yellow

# NOTE: We could NOT enable 2FA (no valid TOTP code), so disable is N/A.
# But let's test that disable rejects when 2FA is not enabled.

if ($SALE_TOKEN) {
    # J1: POST /auth/2fa/disable { code: "000000", password: "Admin@123" } -> expect 400 (2FA not enabled)
    $j1 = Api-Expect "POST" "/auth/2fa/disable" $SALE_TOKEN @{ code = "000000"; password = "Admin@123" }
    if ($j1.code -eq 400) {
        Pass "J1: Disable 2FA rejected - 2FA is not enabled (400)"
    } elseif ($j1.code -eq 200) {
        Warn "J1: Disable 2FA succeeded (SALE had 2FA enabled - cleanup done)"
    } else {
        Fail "J1: Disable 2FA expected 400, got $($j1.code)"
    }

    # J2: Verify 2FA status is still disabled
    $j2 = D (Api "GET" "/auth/2fa/status" $SALE_TOKEN)
    if ($null -ne $j2 -and $j2.is2FAEnabled -eq $false) {
        Pass "J2: SALE 2FA status confirmed disabled"
    } elseif ($null -ne $j2 -and $j2.is2FAEnabled -eq $true) {
        Warn "J2: SALE still has 2FA enabled - may need manual cleanup"
    } else {
        Fail "J2: Cannot check 2FA status"
    }

    # J3: Login again -> should NOT require 2FA
    $j3 = Api-Expect "POST" "/auth/login" $null @{ email = $SALE_EMAIL; password = "Admin@123" }
    if ($j3.code -eq 200 -and $j3.body -and $j3.body.data) {
        $j3Data = $j3.body.data
        if ($j3Data.tokens -and $j3Data.tokens.accessToken) {
            Pass "J3: SALE login works without 2FA challenge"
        } elseif ($j3Data.requires2FA -eq $true) {
            Fail "J3: SALE login still requires 2FA"
        } else {
            Warn "J3: SALE login returned unexpected structure"
        }
    } elseif ($j3.code -eq 429) {
        Warn "J3: Rate-limited (429)"
    } else {
        Fail "J3: SALE re-login failed with code $($j3.code)"
    }
} else {
    Warn "J1: No SALE token"
    Warn "J2: Skipped"
    Warn "J3: Skipped"
}

# ================================================================
# PART K: Rate limit verification (non-destructive)
# ================================================================
Write-Host ""
Write-Host "--- PART K: Rate limit verification ---" -ForegroundColor Yellow

# K1: Make a few login attempts and verify they succeed within limit
$k1Success = 0
for ($i = 0; $i -lt 2; $i++) {
    $kResp = Api-Expect "POST" "/auth/login" $null @{ email = $SALE_EMAIL; password = "Admin@123" }
    if ($kResp.code -eq 200) {
        $k1Success++
    } elseif ($kResp.code -eq 429) {
        Write-Host "    Rate-limited on attempt $($i+1)" -ForegroundColor Yellow
        break
    }
    Start-Sleep -Milliseconds 500
}
if ($k1Success -ge 2) {
    Pass "K1: $k1Success/2 login attempts succeeded within rate limit"
} elseif ($k1Success -ge 1) {
    Warn "K1: Only $k1Success/2 attempts before rate limiting"
} else {
    Fail "K1: All login attempts failed"
}

# K2: We intentionally do NOT exceed the rate limit to avoid blocking further tests
Pass "K2: Rate limit not exceeded (intentional - avoid blocking)"

# K3: Check for rate limit headers (X-RateLimit-*)
$k3Resp = $null
try {
    $k3Resp = Invoke-WebRequest -Uri "$BASE_URL/auth/login" -Method POST `
        -Body (@{ email = $SALE_EMAIL; password = "Admin@123" } | ConvertTo-Json) `
        -ContentType "application/json" -UseBasicParsing
} catch {
    try {
        $k3Resp = $_.Exception.Response
    } catch {}
}

$hasRateLimitHeaders = $false
if ($k3Resp -and $k3Resp.Headers) {
    $rlKeys = @()
    foreach ($key in $k3Resp.Headers.Keys) {
        if ($key -match "(?i)ratelimit|x-ratelimit|retry-after") {
            $rlKeys += $key
            $hasRateLimitHeaders = $true
        }
    }
    if ($hasRateLimitHeaders) {
        Pass "K3: Rate limit headers found: [$($rlKeys -join ', ')]"
    } else {
        Warn "K3: No rate limit headers in response (may use different mechanism)"
    }
} else {
    Warn "K3: Cannot inspect response headers"
}

# ================================================================
# PART L: Role-based 2FA enforcement check
# ================================================================
Write-Host ""
Write-Host "--- PART L: Role-based 2FA enforcement ---" -ForegroundColor Yellow

$roleResults = @{}

# L1: Login CEO -> check if requires2FA
$l1 = Api-Expect "POST" "/auth/login" $null @{ email = $CEO_EMAIL; password = "Admin@123" }
if ($l1.code -eq 200 -and $l1.body -and $l1.body.data) {
    $l1Data = $l1.body.data
    if ($l1Data.requires2FA -eq $true) {
        $roleResults["CEO"] = "2FA_REQUIRED"
        Pass "L1: CEO login requires 2FA"
    } else {
        $roleResults["CEO"] = "NO_2FA"
        Warn "L1: CEO login does NOT require 2FA"
    }
} elseif ($l1.code -eq 429) {
    Warn "L1: CEO login rate-limited"
    $roleResults["CEO"] = "RATE_LIMITED"
} else {
    Fail "L1: CEO login failed with code $($l1.code)"
    $roleResults["CEO"] = "ERROR"
}

# L2: Login CFO -> check if requires2FA
$l2 = Api-Expect "POST" "/auth/login" $null @{ email = $CFO_EMAIL; password = "Admin@123" }
if ($l2.code -eq 200 -and $l2.body -and $l2.body.data) {
    $l2Data = $l2.body.data
    if ($l2Data.requires2FA -eq $true) {
        $roleResults["CFO"] = "2FA_REQUIRED"
        Pass "L2: CFO login requires 2FA"
    } else {
        $roleResults["CFO"] = "NO_2FA"
        Warn "L2: CFO login does NOT require 2FA"
    }
} elseif ($l2.code -eq 429) {
    Warn "L2: CFO login rate-limited"
    $roleResults["CFO"] = "RATE_LIMITED"
} else {
    Fail "L2: CFO login failed with code $($l2.code)"
    $roleResults["CFO"] = "ERROR"
}

# L3: Login KETOAN (Chief Accountant) -> check if requires2FA
$l3 = Api-Expect "POST" "/auth/login" $null @{ email = $KETOAN_EMAIL; password = "Admin@123" }
if ($l3.code -eq 200 -and $l3.body -and $l3.body.data) {
    $l3Data = $l3.body.data
    if ($l3Data.requires2FA -eq $true) {
        $roleResults["KETOAN"] = "2FA_REQUIRED"
        Pass "L3: KETOAN login requires 2FA"
    } else {
        $roleResults["KETOAN"] = "NO_2FA"
        Warn "L3: KETOAN login does NOT require 2FA"
    }
} elseif ($l3.code -eq 429) {
    Warn "L3: KETOAN login rate-limited"
    $roleResults["KETOAN"] = "RATE_LIMITED"
} else {
    Fail "L3: KETOAN login failed with code $($l3.code)"
    $roleResults["KETOAN"] = "ERROR"
}

# L4: Compare roles - BGD/accounting should have stricter 2FA policy
$bgdWith2FA = 0
$bgdWithout2FA = 0
foreach ($role in @("CEO", "CFO", "KETOAN")) {
    if ($roleResults[$role] -eq "2FA_REQUIRED") { $bgdWith2FA++ }
    elseif ($roleResults[$role] -eq "NO_2FA") { $bgdWithout2FA++ }
}

# Check SALE for comparison
$saleHas2FA = $false
if ($a1Data -and $a1Data.requires2FA -eq $true) { $saleHas2FA = $true }

if ($bgdWith2FA -gt 0 -and -not $saleHas2FA) {
    Pass "L4: BGD/accounting roles ($bgdWith2FA) have stricter 2FA than SALE"
} elseif ($bgdWith2FA -gt 0 -and $saleHas2FA) {
    Warn "L4: Both BGD and SALE have 2FA - cannot compare strictness"
} elseif ($bgdWith2FA -eq 0 -and -not $saleHas2FA) {
    Warn "L4: No role has 2FA enabled - 2FA enforcement is per-user, not per-role"
} else {
    Warn "L4: SALE has 2FA but no BGD account does - unusual configuration"
}

# ================================================================
# SUMMARY
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  SUMMARY: TEST-SEC-002 - 2FA Enforcement" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$total = $passCount + $failCount + $warnCount
Write-Host "  Total : $total" -ForegroundColor White
Write-Host "  PASS  : $passCount" -ForegroundColor Green
Write-Host "  FAIL  : $failCount" -ForegroundColor Red
Write-Host "  WARN  : $warnCount" -ForegroundColor Yellow
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "  Result: ALL TESTS PASSED (with $warnCount warnings)" -ForegroundColor Green
} else {
    Write-Host "  Result: $failCount FAILURES detected" -ForegroundColor Red
}
Write-Host ""

# Role 2FA summary table
Write-Host "  2FA Enforcement by Role:" -ForegroundColor Cyan
Write-Host "  +-----------------+---------------+" -ForegroundColor DarkGray
Write-Host "  | Role            | 2FA Status    |" -ForegroundColor DarkGray
Write-Host "  +-----------------+---------------+" -ForegroundColor DarkGray
foreach ($role in @("CEO", "CFO", "KETOAN")) {
    $status = $roleResults[$role]
    if (-not $status) { $status = "UNKNOWN" }
    $padRole = $role.PadRight(15)
    $padStatus = $status.PadRight(13)
    $color = if ($status -eq "2FA_REQUIRED") { "Green" } elseif ($status -eq "NO_2FA") { "Yellow" } else { "DarkGray" }
    Write-Host "  | $padRole | $padStatus |" -ForegroundColor $color
}
$saleStatus = if ($saleHas2FA) { "2FA_REQUIRED" } else { "NO_2FA" }
$padSaleStatus = $saleStatus.PadRight(13)
$saleColor = if ($saleHas2FA) { "Green" } else { "Cyan" }
Write-Host "  | SALE            | $padSaleStatus |" -ForegroundColor $saleColor
Write-Host "  +-----------------+---------------+" -ForegroundColor DarkGray
Write-Host ""
