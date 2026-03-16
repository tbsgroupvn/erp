################################################################
#  TEST-ORD-010: Input Validation - Tao don thieu thong tin bat buoc
#  Kiem tra API tra HTTP status dung + error message ro rang
#  khi payload thieu field, sai format, hoac gia tri khong hop le
#
#  Covers: POST /orders, POST /warehouse-cn/receive,
#          POST /warehouse-cn/packages/:id/measure
#  Severity: HIGH
################################################################

$ErrorActionPreference = 'Continue'
$BASE = "http://localhost:3001/api/v1"
$pass = 0; $fail = 0; $warn = 0

function Log-Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green; $script:pass++ }
function Log-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:fail++ }
function Log-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow; $script:warn++ }
function Log-Info($msg) { Write-Host "  $msg" -ForegroundColor Cyan }

function Login($email) {
    $body = @{ email = $email; password = "Admin@123" } | ConvertTo-Json
    try {
        $r = Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -Body $body -ContentType "application/json"
        $token = $r.data.tokens.accessToken
        if (-not $token) { $token = $r.data.accessToken }
        return $token
    } catch {
        Write-Host "  LOGIN FAILED: $email - $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Api-Expect: call API and return { code, body, error } without throwing
function Api-Expect($method, $path, $token, $body) {
    $headers = @{ Authorization = "Bearer $token" }
    $params = @{
        Uri         = "$BASE$path"
        Method      = $method
        Headers     = $headers
        ContentType = "application/json"
        ErrorAction = 'Stop'
    }
    if ($body -ne $null) {
        $jsonBody = if ($body -is [string]) { $body } else { $body | ConvertTo-Json -Depth 10 }
        $params.Body = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
    }
    try {
        $r = Invoke-WebRequest @params -UseBasicParsing
        $parsed = $null
        try { $parsed = $r.Content | ConvertFrom-Json } catch {}
        return @{ code = [int]$r.StatusCode; body = $parsed; error = $null }
    } catch {
        $code = 0
        $errBody = ""
        $parsed = $null
        try {
            $resp = $_.Exception.Response
            $code = [int]$resp.StatusCode
            $stream = $resp.GetResponseStream()
            $stream.Position = 0
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $errBody = $reader.ReadToEnd()
            $reader.Close()
        } catch {
            try {
                $code = [int]$_.Exception.Response.StatusCode
            } catch {}
        }
        if ($errBody) {
            try { $parsed = $errBody | ConvertFrom-Json } catch {}
        }
        return @{ code = $code; body = $parsed; error = $errBody }
    }
}

# Check that error response contains a specific field name in its message
function Has-FieldError($response, $fieldName) {
    $errText = ""
    if ($response.body) {
        if ($response.body.message -is [array]) {
            $errText = $response.body.message -join " "
        } elseif ($response.body.message) {
            $errText = [string]$response.body.message
        }
        if ($response.body.error) { $errText += " " + [string]$response.body.error }
    }
    if ($response.error) { $errText += " " + [string]$response.error }
    return ($errText -match $fieldName)
}

# Extract error messages as string for logging
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

Write-Host "================================================================" -ForegroundColor White
Write-Host "  TEST-ORD-010: Input Validation - Tao don thieu thong tin" -ForegroundColor White
Write-Host "  Missing/invalid fields -> HTTP 400/404 + error messages" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# ============================================================
# SETUP
# ============================================================
Write-Host "`n=== SETUP: Login ===" -ForegroundColor Yellow
$SALE1 = Login "sale01@nhaphangchinhngach.vn"
if ($SALE1) { Log-Pass "SALE1 login OK" } else { Log-Fail "SALE1 login"; return }
$WH_CN = Login "khotq01@nhaphangchinhngach.vn"
if ($WH_CN) { Log-Pass "WH_CN login OK" } else { Log-Fail "WH_CN login"; return }

# Get valid customer for reference
$custRes = Api-Expect "GET" "/customers?tier=VIP&limit=1" $SALE1
$allCust = @()
if ($custRes.body.data -is [array]) { $allCust = @($custRes.body.data) }
elseif ($custRes.body.data.data) { $allCust = @($custRes.body.data.data) }
$vipCust = $allCust | Where-Object { $_.tier -eq 'VIP' } | Select-Object -First 1
if (-not $vipCust) {
    $custRes = Api-Expect "GET" "/customers?limit=10" $SALE1
    $allCust = @(if ($custRes.body.data -is [array]) { $custRes.body.data } else { $custRes.body.data.data })
    $vipCust = $allCust | Where-Object { $_.tier -eq 'VIP' } | Select-Object -First 1
}
if ($vipCust) {
    $VALID_CUST_ID = $vipCust.id
    Log-Info "Valid customer: $($vipCust.code) ($($vipCust.tier))"
} else {
    Log-Fail "No VIP customer found for reference"; return
}

# Valid item template
$VALID_ITEM = @{
    productName = "Test product"
    quantity    = 5
    unitPrice   = 100
    currency    = "CNY"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART A: POST /orders - MISSING REQUIRED FIELDS" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === A1: Missing customerId ===
Write-Host "`n=== TEST A1: Missing customerId ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    serviceType = "MHH"
    branch      = "HN"
    items       = @($VALID_ITEM)
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "A1a: HTTP 400 for missing customerId"
    if (Has-FieldError $r "customerId|Customer ID") {
        Log-Pass "A1b: Error message mentions customerId"
    } else {
        Log-Warn "A1b: Error message does not mention customerId explicitly"
    }
} else {
    Log-Fail "A1: Expected 400, got $($r.code)"
}

# === A2: Missing serviceType ===
Write-Host "`n=== TEST A2: Missing serviceType ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId = $VALID_CUST_ID
    branch     = "HN"
    items      = @($VALID_ITEM)
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "A2a: HTTP 400 for missing serviceType"
    if (Has-FieldError $r "serviceType|service type") {
        Log-Pass "A2b: Error message mentions serviceType"
    } else {
        Log-Warn "A2b: Error message does not mention serviceType explicitly"
    }
} else {
    Log-Fail "A2: Expected 400, got $($r.code)"
}

# === A3: Missing branch ===
Write-Host "`n=== TEST A3: Missing branch ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    items       = @($VALID_ITEM)
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "A3: HTTP 400 for missing branch"
} else {
    Log-Fail "A3: Expected 400, got $($r.code)"
}

# === A4: Missing items ===
Write-Host "`n=== TEST A4: Missing items ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "HN"
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "A4a: HTTP 400 for missing items"
    if (Has-FieldError $r "items|item") {
        Log-Pass "A4b: Error message mentions items"
    } else {
        Log-Warn "A4b: Error message does not mention items explicitly"
    }
} else {
    Log-Fail "A4: Expected 400, got $($r.code)"
}

# === A5: Empty body ===
Write-Host "`n=== TEST A5: Empty body ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "A5: HTTP 400 for empty body"
} else {
    Log-Fail "A5: Expected 400, got $($r.code)"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART B: POST /orders - INVALID VALUES" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === B1: customerId does not exist (UUID-like) ===
Write-Host "`n=== TEST B1: customerId not found ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = "non_existent_customer_id_12345"
    serviceType = "MHH"
    branch      = "HN"
    items       = @($VALID_ITEM)
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 404) {
    Log-Pass "B1: HTTP 404 for non-existent customerId"
} elseif ($r.code -eq 400) {
    Log-Pass "B1: HTTP 400 for non-existent customerId (validation before lookup)"
} else {
    Log-Fail "B1: Expected 404 or 400, got $($r.code)"
}

# === B2: Invalid serviceType enum ===
Write-Host "`n=== TEST B2: Invalid serviceType ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "INVALID_SERVICE"
    branch      = "HN"
    items       = @($VALID_ITEM)
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "B2a: HTTP 400 for invalid serviceType"
    if (Has-FieldError $r "serviceType|service type|Invalid") {
        Log-Pass "B2b: Error mentions invalid serviceType"
    } else {
        Log-Warn "B2b: Error does not explicitly mention serviceType"
    }
} else {
    Log-Fail "B2: Expected 400, got $($r.code)"
}

# === B3: Invalid branch enum ===
Write-Host "`n=== TEST B3: Invalid branch ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "INVALID_BRANCH"
    items       = @($VALID_ITEM)
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "B3: HTTP 400 for invalid branch"
} else {
    Log-Fail "B3: Expected 400, got $($r.code)"
}

# === B4: Empty items array ===
Write-Host "`n=== TEST B4: Empty items array ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "HN"
    items       = @()
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "B4a: HTTP 400 for empty items array"
    if (Has-FieldError $r "item|At least") {
        Log-Pass "B4b: Error mentions item requirement"
    } else {
        Log-Warn "B4b: Error does not explicitly mention items minimum"
    }
} else {
    Log-Fail "B4: Expected 400, got $($r.code)"
}

# === B5: Item with negative unitPrice ===
Write-Host "`n=== TEST B5: Negative unitPrice ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "HN"
    items       = @(
        @{ productName = "Negative price item"; quantity = 1; unitPrice = -100; currency = "CNY" }
    )
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "B5a: HTTP 400 for negative unitPrice"
    if (Has-FieldError $r "price|negative|unitPrice|must not") {
        Log-Pass "B5b: Error mentions price validation"
    } else {
        Log-Warn "B5b: Error does not explicitly mention unitPrice"
    }
} else {
    Log-Fail "B5: Expected 400, got $($r.code)"
}

# === B6: Item with quantity = 0 ===
Write-Host "`n=== TEST B6: Zero quantity ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "HN"
    items       = @(
        @{ productName = "Zero qty item"; quantity = 0; unitPrice = 100; currency = "CNY" }
    )
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "B6a: HTTP 400 for zero quantity"
    if (Has-FieldError $r "quantity|Quantity|at least 1") {
        Log-Pass "B6b: Error mentions quantity validation"
    } else {
        Log-Warn "B6b: Error does not explicitly mention quantity"
    }
} else {
    Log-Fail "B6: Expected 400, got $($r.code)"
}

# === B7: Item with negative quantity ===
Write-Host "`n=== TEST B7: Negative quantity ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "HN"
    items       = @(
        @{ productName = "Neg qty item"; quantity = -5; unitPrice = 100; currency = "CNY" }
    )
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "B7: HTTP 400 for negative quantity"
} else {
    Log-Fail "B7: Expected 400, got $($r.code)"
}

# === B8: Item missing productName ===
Write-Host "`n=== TEST B8: Missing productName in item ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "HN"
    items       = @(
        @{ quantity = 5; unitPrice = 100; currency = "CNY" }
    )
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "B8a: HTTP 400 for missing productName"
    if (Has-FieldError $r "productName|Product name|product") {
        Log-Pass "B8b: Error mentions productName"
    } else {
        Log-Warn "B8b: Error does not explicitly mention productName"
    }
} else {
    Log-Fail "B8: Expected 400, got $($r.code)"
}

# === B9: Invalid productUrl format ===
Write-Host "`n=== TEST B9: Invalid productUrl ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "HN"
    items       = @(
        @{ productName = "Bad URL item"; productUrl = "not-a-url"; quantity = 1; unitPrice = 100 }
    )
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "B9a: HTTP 400 for invalid productUrl"
    if (Has-FieldError $r "productUrl|url|URL") {
        Log-Pass "B9b: Error mentions URL validation"
    } else {
        Log-Warn "B9b: Error does not explicitly mention productUrl"
    }
} else {
    Log-Fail "B9: Expected 400, got $($r.code)"
}

# === B10: Invalid shippingRoute enum ===
Write-Host "`n=== TEST B10: Invalid shippingRoute ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId    = $VALID_CUST_ID
    serviceType   = "MHH"
    branch        = "HN"
    shippingRoute = "TELEPORT"
    items         = @($VALID_ITEM)
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "B10: HTTP 400 for invalid shippingRoute"
} else {
    Log-Fail "B10: Expected 400, got $($r.code)"
}

# === B11: Forbidden extra fields (whitelist) ===
Write-Host "`n=== TEST B11: Extra/unknown fields ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "HN"
    items       = @($VALID_ITEM)
    hackField   = "injection_attempt"
    isAdmin     = $true
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "B11: HTTP 400 for unknown fields (whitelist enforcement)"
} elseif ($r.code -eq 201) {
    Log-Warn "B11: Order created despite extra fields (whitelist strips but allows)"
} else {
    Log-Fail "B11: Expected 400 or 201, got $($r.code)"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART C: POST /orders - AUTH & EDGE CASES" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === C1: No auth token ===
Write-Host "`n=== TEST C1: No auth token ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" "" @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "HN"
    items       = @($VALID_ITEM)
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 401) {
    Log-Pass "C1: HTTP 401 for missing auth token"
} else {
    Log-Fail "C1: Expected 401, got $($r.code)"
}

# === C2: Invalid auth token ===
Write-Host "`n=== TEST C2: Invalid auth token ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" "invalid.jwt.token.here" @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "HN"
    items       = @($VALID_ITEM)
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 401) {
    Log-Pass "C2: HTTP 401 for invalid auth token"
} else {
    Log-Fail "C2: Expected 401, got $($r.code)"
}

# === C3: customerId empty string ===
Write-Host "`n=== TEST C3: Empty string customerId ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = ""
    serviceType = "MHH"
    branch      = "HN"
    items       = @($VALID_ITEM)
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "C3: HTTP 400 for empty customerId string"
} else {
    Log-Fail "C3: Expected 400, got $($r.code)"
}

# === C4: Extremely long note (> 2000 chars) ===
Write-Host "`n=== TEST C4: Extremely long note ===" -ForegroundColor Yellow
$longNote = "A" * 3000
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "MHH"
    branch      = "HN"
    items       = @($VALID_ITEM)
    note        = $longNote
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "C4: HTTP 400 for note exceeding 2000 chars"
} elseif ($r.code -eq 201) {
    Log-Warn "C4: Order created with 3000-char note (no maxLength enforcement)"
} else {
    Log-Fail "C4: Expected 400 or 201, got $($r.code)"
}

# === C5: Valid order creation (sanity check) ===
Write-Host "`n=== TEST C5: Valid order creation (sanity) ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/orders" $SALE1 @{
    customerId  = $VALID_CUST_ID
    serviceType = "VCT"
    branch      = "HN"
    items       = @($VALID_ITEM)
    note        = "Sanity check - valid order"
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 201) {
    $SANITY_ORDER_ID = $r.body.data.id
    Log-Pass "C5: HTTP 201 for valid order (sanity check)"
    Log-Info "Order ID=$SANITY_ORDER_ID"
} else {
    Log-Fail "C5: Expected 201, got $($r.code)"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART D: POST /warehouse-cn/receive - VALIDATION" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === D1: Missing trackingNumberCN ===
Write-Host "`n=== TEST D1: Missing trackingNumberCN ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/warehouse-cn/receive" $WH_CN @{
    orderId   = if ($SANITY_ORDER_ID) { $SANITY_ORDER_ID } else { $VALID_CUST_ID }
    imageUrls = @("https://storage.example.com/test.jpg")
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "D1a: HTTP 400 for missing trackingNumberCN"
    if (Has-FieldError $r "tracking|trackingNumberCN|Tracking") {
        Log-Pass "D1b: Error mentions trackingNumberCN"
    } else {
        Log-Warn "D1b: Error does not explicitly mention trackingNumberCN"
    }
} else {
    Log-Fail "D1: Expected 400, got $($r.code)"
}

# === D2: Missing orderId ===
Write-Host "`n=== TEST D2: Missing orderId ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = "TEST-MISSING-ORDER"
    imageUrls        = @("https://storage.example.com/test.jpg")
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "D2a: HTTP 400 for missing orderId"
    if (Has-FieldError $r "orderId|Order ID|order") {
        Log-Pass "D2b: Error mentions orderId"
    } else {
        Log-Warn "D2b: Error does not explicitly mention orderId"
    }
} else {
    Log-Fail "D2: Expected 400, got $($r.code)"
}

# === D3: Missing imageUrls (mandatory photos) ===
Write-Host "`n=== TEST D3: Missing imageUrls (mandatory photos) ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/warehouse-cn/receive" $WH_CN @{
    trackingNumberCN = "TEST-NO-PHOTOS"
    orderId          = if ($SANITY_ORDER_ID) { $SANITY_ORDER_ID } else { "some-order-id" }
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "D3: HTTP 400 for missing imageUrls (photo required)"
} else {
    Log-Warn "D3: Expected 400 for missing photos, got $($r.code)"
}

# === D4: Empty body ===
Write-Host "`n=== TEST D4: Empty body to warehouse receive ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/warehouse-cn/receive" $WH_CN @{}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "D4: HTTP 400 for empty body"
} else {
    Log-Fail "D4: Expected 400, got $($r.code)"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART E: POST /warehouse-cn/packages/:id/measure - VALIDATION" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

$FAKE_PKG_ID = "non_existent_pkg_id_99999"

# === E1: Negative weight ===
Write-Host "`n=== TEST E1: Negative weight ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/warehouse-cn/packages/$FAKE_PKG_ID/measure" $WH_CN @{
    actualWeight = -10
    length       = 50
    width        = 40
    height       = 30
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "E1a: HTTP 400 for negative weight"
    if (Has-FieldError $r "weight|actualWeight|greater than 0") {
        Log-Pass "E1b: Error mentions weight validation"
    } else {
        Log-Warn "E1b: Error does not explicitly mention weight"
    }
} else {
    Log-Fail "E1: Expected 400, got $($r.code)"
}

# === E2: Zero dimensions ===
Write-Host "`n=== TEST E2: Zero dimensions ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/warehouse-cn/packages/$FAKE_PKG_ID/measure" $WH_CN @{
    actualWeight = 5.0
    length       = 0
    width        = 0
    height       = 0
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "E2a: HTTP 400 for zero dimensions"
    if (Has-FieldError $r "length|width|height|greater than 0|Length|Width|Height") {
        Log-Pass "E2b: Error mentions dimension validation"
    } else {
        Log-Warn "E2b: Error does not explicitly mention dimensions"
    }
} else {
    Log-Fail "E2: Expected 400, got $($r.code)"
}

# === E3: Missing required fields ===
Write-Host "`n=== TEST E3: Missing weight and dimensions ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/warehouse-cn/packages/$FAKE_PKG_ID/measure" $WH_CN @{}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "E3: HTTP 400 for missing measure fields"
} else {
    Log-Fail "E3: Expected 400, got $($r.code)"
}

# === E4: Negative dimensions ===
Write-Host "`n=== TEST E4: Negative dimensions ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/warehouse-cn/packages/$FAKE_PKG_ID/measure" $WH_CN @{
    actualWeight = 5.0
    length       = -10
    width        = 40
    height       = 30
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 400) {
    Log-Pass "E4: HTTP 400 for negative length"
} else {
    Log-Fail "E4: Expected 400, got $($r.code)"
}

# === E5: Non-existent package ID with valid body ===
Write-Host "`n=== TEST E5: Non-existent package ID ===" -ForegroundColor Yellow
$r = Api-Expect "POST" "/warehouse-cn/packages/$FAKE_PKG_ID/measure" $WH_CN @{
    actualWeight = 5.0
    length       = 50
    width        = 40
    height       = 30
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 404) {
    Log-Pass "E5: HTTP 404 for non-existent package"
} elseif ($r.code -eq 400) {
    Log-Pass "E5: HTTP 400 for non-existent package (validation or lookup)"
} else {
    Log-Fail "E5: Expected 404 or 400, got $($r.code)"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART F: ORDER STATUS - INVALID TRANSITIONS" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === F1: Invalid status value ===
Write-Host "`n=== TEST F1: Invalid status enum ===" -ForegroundColor Yellow
if ($SANITY_ORDER_ID) {
    $r = Api-Expect "PATCH" "/orders/$SANITY_ORDER_ID/status" $SALE1 @{
        status = "FAKE_STATUS"
    }
    Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
    if ($r.code -eq 400) {
        Log-Pass "F1: HTTP 400 for invalid status enum"
    } else {
        Log-Fail "F1: Expected 400, got $($r.code)"
    }
} else { Log-Warn "F1: Skipped - no sanity order" }

# === F2: Skip status (CONSULTING -> SOURCING directly) ===
Write-Host "`n=== TEST F2: Skip status (CONSULTING -> SOURCING) ===" -ForegroundColor Yellow
if ($SANITY_ORDER_ID) {
    $r = Api-Expect "PATCH" "/orders/$SANITY_ORDER_ID/status" $SALE1 @{
        status = "SOURCING"
        note   = "Trying to skip"
    }
    Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
    if ($r.code -eq 400) {
        Log-Pass "F2: HTTP 400 for FSM skip (CONSULTING -> SOURCING blocked)"
    } else {
        Log-Fail "F2: Expected 400, got $($r.code)"
    }
} else { Log-Warn "F2: Skipped - no sanity order" }

# === F3: Non-existent order ID ===
Write-Host "`n=== TEST F3: Non-existent order ID ===" -ForegroundColor Yellow
$r = Api-Expect "PATCH" "/orders/non_existent_order_id/status" $SALE1 @{
    status = "QUOTATION"
}
Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
if ($r.code -eq 404) {
    Log-Pass "F3: HTTP 404 for non-existent order"
} elseif ($r.code -eq 400) {
    Log-Pass "F3: HTTP 400 for non-existent order"
} else {
    Log-Fail "F3: Expected 404 or 400, got $($r.code)"
}

# === F4: Missing status field ===
Write-Host "`n=== TEST F4: Missing status field ===" -ForegroundColor Yellow
if ($SANITY_ORDER_ID) {
    $r = Api-Expect "PATCH" "/orders/$SANITY_ORDER_ID/status" $SALE1 @{}
    Log-Info "HTTP $($r.code) | $(Get-ErrorMsg $r)"
    if ($r.code -eq 400) {
        Log-Pass "F4: HTTP 400 for missing status field"
    } else {
        Log-Fail "F4: Expected 400, got $($r.code)"
    }
} else { Log-Warn "F4: Skipped - no sanity order" }

# ============================================================
# SUMMARY
# ============================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  TONG KET TEST-ORD-010: Input Validation" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White
Write-Host ""
Write-Host "  Part A: Missing required fields (customerId, serviceType, branch, items)" -ForegroundColor Gray
Write-Host "  Part B: Invalid values (bad enum, negative, zero, empty array, bad URL)" -ForegroundColor Gray
Write-Host "  Part C: Auth + edge cases (no token, empty string, long note)" -ForegroundColor Gray
Write-Host "  Part D: Warehouse CN receive validation" -ForegroundColor Gray
Write-Host "  Part E: Package measure validation (weight, dimensions)" -ForegroundColor Gray
Write-Host "  Part F: Order status FSM validation (skip, invalid enum)" -ForegroundColor Gray
Write-Host ""
Write-Host "  PASS: $pass" -ForegroundColor Green
Write-Host "  FAIL: $fail" -ForegroundColor Red
Write-Host "  WARN: $warn" -ForegroundColor Yellow
Write-Host ""
if ($fail -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $fail TEST(S) FAILED" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor White
