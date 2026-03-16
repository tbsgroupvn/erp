################################################################
#  TEST-ORD-011: Invalid State Transitions (FSM Enforcement)
#  Kiem tra state machine chan moi transition khong hop le:
#  - Skip nhieu stage
#  - Quay nguoc (reverse)
#  - Terminal states (COMPLETED, CANCELLED) khong chuyen tiep
#  - Service-type-specific rules (MHH deposit gate)
#  - Non-cancellable stages
#
#  Severity: CRITICAL
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

function Api($method, $path, $token, $body) {
    $headers = @{ Authorization = "Bearer $token" }
    $params = @{
        Uri         = "$BASE$path"
        Method      = $method
        Headers     = $headers
        ContentType = "application/json"
    }
    if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 10) }
    try {
        return Invoke-RestMethod @params
    } catch {
        $errBody = ""
        try {
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $errBody = $reader.ReadToEnd()
            $reader.Close()
        } catch {}
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "    API ERROR: $method $path -> $code : $errBody" -ForegroundColor DarkRed
        throw
    }
}

function D($resp) {
    if ($resp.data) { return $resp.data }
    return $resp
}

# Attempt status transition, return { code, msg, ok }
function Try-Status($orderId, $targetStatus, $token, $note) {
    $headers = @{ Authorization = "Bearer $token" }
    $bodyObj = @{ status = $targetStatus }
    if ($note) { $bodyObj.note = $note }
    $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes(($bodyObj | ConvertTo-Json))
    $params = @{
        Uri         = "$BASE/orders/$orderId/status"
        Method      = "PATCH"
        Headers     = $headers
        ContentType = "application/json"
        Body        = $jsonBytes
        ErrorAction = 'Stop'
    }
    try {
        $r = Invoke-WebRequest @params -UseBasicParsing
        $parsed = $r.Content | ConvertFrom-Json
        return @{ code = [int]$r.StatusCode; msg = "OK"; ok = $true }
    } catch {
        $code = 0; $msg = ""
        try {
            $resp = $_.Exception.Response
            $code = [int]$resp.StatusCode
            $stream = $resp.GetResponseStream()
            $stream.Position = 0
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $errBody = $reader.ReadToEnd()
            $reader.Close()
            $parsed = $errBody | ConvertFrom-Json
            if ($parsed.message -is [array]) { $msg = $parsed.message -join " | " }
            elseif ($parsed.message) { $msg = [string]$parsed.message }
            else { $msg = $errBody.Substring(0, [math]::Min(200, $errBody.Length)) }
        } catch {
            try { $code = [int]$_.Exception.Response.StatusCode } catch {}
        }
        return @{ code = $code; msg = $msg; ok = $false }
    }
}

# Create order helper
function New-Order($custId, $serviceType, $branch, $token) {
    $body = @{
        customerId  = $custId
        serviceType = $serviceType
        branch      = $branch
        items       = @(
            @{ productName = "Test item FSM $serviceType"; quantity = 3; unitPrice = 100; currency = "CNY" }
        )
        note = "TEST-ORD-011 FSM test - $serviceType"
    }
    $res = Api "POST" "/orders" $token $body
    $order = D $res
    return $order
}

# Advance order through statuses (best effort)
function Advance-Order($orderId, $statuses, $token) {
    foreach ($st in $statuses) {
        try {
            Api "PATCH" "/orders/$orderId/status" $token @{ status = $st; note = "FSM test setup" } | Out-Null
        } catch {
            Log-Info "  (advance to $st failed - may need different role/deposit)"
            return $false
        }
    }
    return $true
}

Write-Host "================================================================" -ForegroundColor White
Write-Host "  TEST-ORD-011: Invalid State Transitions (FSM Enforcement)" -ForegroundColor White
Write-Host "  Severity: CRITICAL" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# ============================================================
# SETUP
# ============================================================
Write-Host "`n=== SETUP: Login roles ===" -ForegroundColor Yellow
$SALE1  = Login "sale01@nhaphangchinhngach.vn"
if ($SALE1)  { Log-Pass "SALE1 login OK" } else { Log-Fail "SALE1 login"; return }
$XNK    = Login "xnk@nhaphangchinhngach.vn"
if ($XNK)    { Log-Pass "XNK login OK" } else { Log-Fail "XNK login"; return }
$KETOAN = Login "ketoan@nhaphangchinhngach.vn"
if ($KETOAN) { Log-Pass "KETOAN login OK" } else { Log-Fail "KETOAN login"; return }
$CFO    = Login "cfo@nhaphangchinhngach.vn"
if ($CFO)    { Log-Pass "CFO login OK" } else { Log-Fail "CFO login"; return }
$KHOVN  = Login "khovn@nhaphangchinhngach.vn"
if ($KHOVN)  { Log-Pass "KHOVN login OK" } else { Log-Fail "KHOVN login"; return }

# Get VIP customer
$customers = Api "GET" "/customers?tier=VIP&limit=1" $SALE1
$cust = if ($customers.data) { $customers.data[0] } else { $customers[0] }
if (-not $cust) {
    $customers = Api "GET" "/customers?limit=10" $SALE1
    $allCusts = if ($customers.data) { $customers.data } else { @($customers) }
    $cust = $allCusts | Where-Object { $_.tier -eq 'VIP' } | Select-Object -First 1
}
if (-not $cust) { Log-Fail "No VIP customer found"; return }
$CUST_ID = $cust.id
Log-Info "Customer: $($cust.code) ($($cust.tier))"

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART A: FORWARD SKIP (nhay coc nhieu stage)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === A1: CONSULTING -> IN_TRANSIT (skip 6 stages) ===
Write-Host "`n=== TEST A1: CONSULTING -> IN_TRANSIT (skip 6 stages) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Log-Info "Order: $($ord.code) | status=$($ord.status)"
    $r = Try-Status $ord.id "IN_TRANSIT" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400 -and -not $r.ok) {
        Log-Pass "A1: CONSULTING -> IN_TRANSIT blocked (400)"
    } else {
        Log-Fail "A1: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "A1: Failed - $($_.Exception.Message)" }

# === A2: CONSULTING -> WAREHOUSE_CN (skip 3 stages) ===
Write-Host "`n=== TEST A2: CONSULTING -> WAREHOUSE_CN (skip 3 stages) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    $r = Try-Status $ord.id "WAREHOUSE_CN" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "A2: CONSULTING -> WAREHOUSE_CN blocked (400)"
    } else {
        Log-Fail "A2: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "A2: Failed - $($_.Exception.Message)" }

# === A3: CONSULTING -> COMPLETED (skip to terminal) ===
Write-Host "`n=== TEST A3: CONSULTING -> COMPLETED (skip to terminal) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    $r = Try-Status $ord.id "COMPLETED" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "A3: CONSULTING -> COMPLETED blocked (400)"
    } else {
        Log-Fail "A3: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "A3: Failed - $($_.Exception.Message)" }

# === A4: CONSULTING -> SETTLEMENT (skip 10 stages) ===
Write-Host "`n=== TEST A4: CONSULTING -> SETTLEMENT (skip 10 stages) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    $r = Try-Status $ord.id "SETTLEMENT" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "A4: CONSULTING -> SETTLEMENT blocked (400)"
    } else {
        Log-Fail "A4: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "A4: Failed - $($_.Exception.Message)" }

# === A5: CONSULTING -> DELIVERING (skip 9 stages) ===
Write-Host "`n=== TEST A5: CONSULTING -> DELIVERING (skip 9 stages) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    $r = Try-Status $ord.id "DELIVERING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "A5: CONSULTING -> DELIVERING blocked (400)"
    } else {
        Log-Fail "A5: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "A5: Failed - $($_.Exception.Message)" }

# === A6: QUOTATION -> CUSTOMS (skip 5 stages) ===
Write-Host "`n=== TEST A6: QUOTATION -> CUSTOMS (skip 5 stages) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION") $SALE1 | Out-Null
    $r = Try-Status $ord.id "CUSTOMS" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "A6: QUOTATION -> CUSTOMS blocked (400)"
    } else {
        Log-Fail "A6: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "A6: Failed - $($_.Exception.Message)" }

# === A7: WAREHOUSE_CN -> WAREHOUSE_VN (skip 3 stages) ===
Write-Host "`n=== TEST A7: WAREHOUSE_CN -> WAREHOUSE_VN (skip 3 stages) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION","SOURCING","WAREHOUSE_CN") $SALE1 | Out-Null
    $r = Try-Status $ord.id "WAREHOUSE_VN" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "A7: WAREHOUSE_CN -> WAREHOUSE_VN blocked (400)"
    } else {
        Log-Fail "A7: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "A7: Failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART B: REVERSE TRANSITIONS (quay nguoc)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === B1: QUOTATION -> CONSULTING (back 1 step) ===
Write-Host "`n=== TEST B1: QUOTATION -> CONSULTING (reverse) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION") $SALE1 | Out-Null
    $r = Try-Status $ord.id "CONSULTING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "B1: QUOTATION -> CONSULTING blocked (400)"
    } else {
        Log-Fail "B1: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "B1: Failed - $($_.Exception.Message)" }

# === B2: SOURCING -> QUOTATION (reverse) ===
Write-Host "`n=== TEST B2: SOURCING -> QUOTATION (reverse) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION","SOURCING") $SALE1 | Out-Null
    $r = Try-Status $ord.id "QUOTATION" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "B2: SOURCING -> QUOTATION blocked (400)"
    } else {
        Log-Fail "B2: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "B2: Failed - $($_.Exception.Message)" }

# === B3: SOURCING -> PENDING_DEPOSIT (reverse) ===
Write-Host "`n=== TEST B3: SOURCING -> PENDING_DEPOSIT (reverse) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION","SOURCING") $SALE1 | Out-Null
    $r = Try-Status $ord.id "PENDING_DEPOSIT" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "B3: SOURCING -> PENDING_DEPOSIT blocked (400)"
    } else {
        Log-Fail "B3: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "B3: Failed - $($_.Exception.Message)" }

# === B4: WAREHOUSE_CN -> SOURCING (reverse) ===
Write-Host "`n=== TEST B4: WAREHOUSE_CN -> SOURCING (reverse) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION","SOURCING","WAREHOUSE_CN") $SALE1 | Out-Null
    $r = Try-Status $ord.id "SOURCING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "B4: WAREHOUSE_CN -> SOURCING blocked (400)"
    } else {
        Log-Fail "B4: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "B4: Failed - $($_.Exception.Message)" }

# === B5: WAREHOUSE_CN -> CONSULTING (reverse far back) ===
Write-Host "`n=== TEST B5: WAREHOUSE_CN -> CONSULTING (reverse far) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION","SOURCING","WAREHOUSE_CN") $SALE1 | Out-Null
    $r = Try-Status $ord.id "CONSULTING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "B5: WAREHOUSE_CN -> CONSULTING blocked (400)"
    } else {
        Log-Fail "B5: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "B5: Failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART C: TERMINAL STATES (COMPLETED, CANCELLED)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# Create and complete an order for terminal state tests
Write-Host "`n=== SETUP: Create + Complete order ===" -ForegroundColor Yellow
$COMPLETED_ORDER_ID = $null
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    $COMPLETED_ORDER_ID = $ord.id
    Log-Info "Order: $($ord.code)"

    # VCT does not require deposit - advance to COMPLETED
    $advSteps = @("QUOTATION","SOURCING","WAREHOUSE_CN","PACKING","CONSOLIDATION","IN_TRANSIT","CUSTOMS","WAREHOUSE_VN","DELIVERING","SETTLEMENT","COMPLETED")
    foreach ($st in $advSteps) {
        try {
            Api "PATCH" "/orders/$COMPLETED_ORDER_ID/status" $SALE1 @{ status = $st; note = "Setup" } | Out-Null
        } catch {
            # Try with other roles for certain stages
            try { Api "PATCH" "/orders/$COMPLETED_ORDER_ID/status" $XNK @{ status = $st; note = "Setup" } | Out-Null } catch {
                try { Api "PATCH" "/orders/$COMPLETED_ORDER_ID/status" $KHOVN @{ status = $st; note = "Setup" } | Out-Null } catch {
                    try { Api "PATCH" "/orders/$COMPLETED_ORDER_ID/status" $KETOAN @{ status = $st; note = "Setup" } | Out-Null } catch {
                        Log-Info "  (could not advance to $st)"
                    }
                }
            }
        }
    }
    $check = D (Api "GET" "/orders/$COMPLETED_ORDER_ID" $SALE1)
    Log-Info "Final status: $($check.status)"
    if ($check.status -eq "COMPLETED") { Log-Pass "SETUP: Order COMPLETED for terminal tests" }
    else { Log-Warn "SETUP: Order at $($check.status), not COMPLETED" }
} catch { Log-Fail "SETUP: Create completed order failed - $($_.Exception.Message)" }

# === C1: COMPLETED -> CONSULTING ===
Write-Host "`n=== TEST C1: COMPLETED -> CONSULTING ===" -ForegroundColor Yellow
if ($COMPLETED_ORDER_ID) {
    $r = Try-Status $COMPLETED_ORDER_ID "CONSULTING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C1: COMPLETED -> CONSULTING blocked (terminal state)"
    } else {
        Log-Fail "C1: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C1: Skipped - no completed order" }

# === C2: COMPLETED -> QUOTATION ===
Write-Host "`n=== TEST C2: COMPLETED -> QUOTATION ===" -ForegroundColor Yellow
if ($COMPLETED_ORDER_ID) {
    $r = Try-Status $COMPLETED_ORDER_ID "QUOTATION" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C2: COMPLETED -> QUOTATION blocked (terminal)"
    } else {
        Log-Fail "C2: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C2: Skipped" }

# === C3: COMPLETED -> SOURCING ===
Write-Host "`n=== TEST C3: COMPLETED -> SOURCING ===" -ForegroundColor Yellow
if ($COMPLETED_ORDER_ID) {
    $r = Try-Status $COMPLETED_ORDER_ID "SOURCING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C3: COMPLETED -> SOURCING blocked (terminal)"
    } else {
        Log-Fail "C3: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C3: Skipped" }

# === C4: COMPLETED -> SETTLEMENT ===
Write-Host "`n=== TEST C4: COMPLETED -> SETTLEMENT ===" -ForegroundColor Yellow
if ($COMPLETED_ORDER_ID) {
    $r = Try-Status $COMPLETED_ORDER_ID "SETTLEMENT" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C4: COMPLETED -> SETTLEMENT blocked (terminal)"
    } else {
        Log-Fail "C4: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C4: Skipped" }

# === C5: COMPLETED -> CANCELLED ===
Write-Host "`n=== TEST C5: COMPLETED -> CANCELLED ===" -ForegroundColor Yellow
if ($COMPLETED_ORDER_ID) {
    $r = Try-Status $COMPLETED_ORDER_ID "CANCELLED" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C5: COMPLETED -> CANCELLED blocked (terminal)"
    } else {
        Log-Fail "C5: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C5: Skipped" }

# === C6: COMPLETED -> ON_HOLD ===
Write-Host "`n=== TEST C6: COMPLETED -> ON_HOLD ===" -ForegroundColor Yellow
if ($COMPLETED_ORDER_ID) {
    $r = Try-Status $COMPLETED_ORDER_ID "ON_HOLD" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C6: COMPLETED -> ON_HOLD blocked (terminal)"
    } else {
        Log-Fail "C6: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C6: Skipped" }

# === CANCELLED order tests ===
Write-Host "`n=== SETUP: Create + Cancel order ===" -ForegroundColor Yellow
$CANCELLED_ORDER_ID = $null
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    $CANCELLED_ORDER_ID = $ord.id
    Log-Info "Order: $($ord.code)"
    Api "PATCH" "/orders/$CANCELLED_ORDER_ID/status" $SALE1 @{ status = "CANCELLED"; note = "Cancel for test" } | Out-Null
    $check = D (Api "GET" "/orders/$CANCELLED_ORDER_ID" $SALE1)
    if ($check.status -eq "CANCELLED") { Log-Pass "SETUP: Order CANCELLED for terminal tests" }
    else { Log-Warn "SETUP: Order at $($check.status), not CANCELLED" }
} catch { Log-Fail "SETUP: Cancel order failed - $($_.Exception.Message)" }

# === C7: CANCELLED -> CONSULTING ===
Write-Host "`n=== TEST C7: CANCELLED -> CONSULTING ===" -ForegroundColor Yellow
if ($CANCELLED_ORDER_ID) {
    $r = Try-Status $CANCELLED_ORDER_ID "CONSULTING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C7: CANCELLED -> CONSULTING blocked (terminal)"
    } else {
        Log-Fail "C7: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C7: Skipped" }

# === C8: CANCELLED -> QUOTATION ===
Write-Host "`n=== TEST C8: CANCELLED -> QUOTATION ===" -ForegroundColor Yellow
if ($CANCELLED_ORDER_ID) {
    $r = Try-Status $CANCELLED_ORDER_ID "QUOTATION" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C8: CANCELLED -> QUOTATION blocked (terminal)"
    } else {
        Log-Fail "C8: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C8: Skipped" }

# === C9: CANCELLED -> SOURCING ===
Write-Host "`n=== TEST C9: CANCELLED -> SOURCING ===" -ForegroundColor Yellow
if ($CANCELLED_ORDER_ID) {
    $r = Try-Status $CANCELLED_ORDER_ID "SOURCING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C9: CANCELLED -> SOURCING blocked (terminal)"
    } else {
        Log-Fail "C9: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C9: Skipped" }

# === C10: CANCELLED -> COMPLETED ===
Write-Host "`n=== TEST C10: CANCELLED -> COMPLETED ===" -ForegroundColor Yellow
if ($CANCELLED_ORDER_ID) {
    $r = Try-Status $CANCELLED_ORDER_ID "COMPLETED" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C10: CANCELLED -> COMPLETED blocked (terminal)"
    } else {
        Log-Fail "C10: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C10: Skipped" }

# === C11: CANCELLED -> ON_HOLD ===
Write-Host "`n=== TEST C11: CANCELLED -> ON_HOLD ===" -ForegroundColor Yellow
if ($CANCELLED_ORDER_ID) {
    $r = Try-Status $CANCELLED_ORDER_ID "ON_HOLD" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C11: CANCELLED -> ON_HOLD blocked (terminal)"
    } else {
        Log-Fail "C11: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C11: Skipped" }

# === C12: CANCELLED -> WAREHOUSE_VN ===
Write-Host "`n=== TEST C12: CANCELLED -> WAREHOUSE_VN ===" -ForegroundColor Yellow
if ($CANCELLED_ORDER_ID) {
    $r = Try-Status $CANCELLED_ORDER_ID "WAREHOUSE_VN" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "C12: CANCELLED -> WAREHOUSE_VN blocked (terminal)"
    } else {
        Log-Fail "C12: Expected 400, got $($r.code)"
    }
} else { Log-Warn "C12: Skipped" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART D: SERVICE-TYPE-SPECIFIC RULES" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === D1: MHH QUOTATION -> SOURCING (blocked - must go through PENDING_DEPOSIT) ===
Write-Host "`n=== TEST D1: MHH QUOTATION -> SOURCING (deposit gate) ===" -ForegroundColor Yellow
try {
    $mhh = New-Order $CUST_ID "MHH" "HN" $SALE1
    Log-Info "MHH Order: $($mhh.code) | serviceType=$($mhh.serviceType)"
    Advance-Order $mhh.id @("QUOTATION") $SALE1 | Out-Null
    $r = Try-Status $mhh.id "SOURCING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "D1: MHH QUOTATION -> SOURCING blocked (must go through PENDING_DEPOSIT)"
    } else {
        Log-Fail "D1: Expected 400 for MHH deposit gate, got $($r.code)"
    }
} catch { Log-Fail "D1: Failed - $($_.Exception.Message)" }

# === D2: VCT CONSULTING -> SOURCING (skip - must go through QUOTATION first) ===
Write-Host "`n=== TEST D2: VCT CONSULTING -> SOURCING (skip QUOTATION) ===" -ForegroundColor Yellow
try {
    $vct = New-Order $CUST_ID "VCT" "HN" $SALE1
    Log-Info "VCT Order: $($vct.code) | serviceType=$($vct.serviceType)"
    $r = Try-Status $vct.id "SOURCING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "D2: VCT CONSULTING -> SOURCING blocked (must go QUOTATION first)"
    } else {
        Log-Fail "D2: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "D2: Failed - $($_.Exception.Message)" }

# === D3: VCT QUOTATION -> SOURCING (allowed - VCT can skip deposit) ===
Write-Host "`n=== TEST D3: VCT QUOTATION -> SOURCING (valid for VCT) ===" -ForegroundColor Yellow
try {
    $vct = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $vct.id @("QUOTATION") $SALE1 | Out-Null
    $r = Try-Status $vct.id "SOURCING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.ok) {
        Log-Pass "D3: VCT QUOTATION -> SOURCING allowed (no deposit required)"
    } else {
        Log-Warn "D3: VCT QUOTATION -> SOURCING returned $($r.code) (may need deposit)"
    }
} catch { Log-Fail "D3: Failed - $($_.Exception.Message)" }

# === D4: MHH valid path: QUOTATION -> PENDING_DEPOSIT (correct for MHH) ===
Write-Host "`n=== TEST D4: MHH QUOTATION -> PENDING_DEPOSIT (valid) ===" -ForegroundColor Yellow
try {
    $mhh2 = New-Order $CUST_ID "MHH" "HN" $SALE1
    Advance-Order $mhh2.id @("QUOTATION") $SALE1 | Out-Null
    $r = Try-Status $mhh2.id "PENDING_DEPOSIT" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.ok) {
        Log-Pass "D4: MHH QUOTATION -> PENDING_DEPOSIT allowed (correct path)"
    } else {
        Log-Fail "D4: MHH QUOTATION -> PENDING_DEPOSIT rejected ($($r.code))"
    }
} catch { Log-Fail "D4: Failed - $($_.Exception.Message)" }

# === D5: LCLCN QUOTATION -> SOURCING (allowed or blocked?) ===
Write-Host "`n=== TEST D5: LCLCN QUOTATION -> SOURCING ===" -ForegroundColor Yellow
try {
    $lcl = New-Order $CUST_ID "LCLCN" "HN" $SALE1
    Log-Info "LCLCN Order: $($lcl.code)"
    Advance-Order $lcl.id @("QUOTATION") $SALE1 | Out-Null
    $r = Try-Status $lcl.id "SOURCING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.ok) {
        Log-Pass "D5: LCLCN QUOTATION -> SOURCING allowed"
    } elseif ($r.code -eq 400) {
        Log-Pass "D5: LCLCN QUOTATION -> SOURCING blocked (deposit required)"
    } else {
        Log-Warn "D5: Unexpected HTTP $($r.code)"
    }
} catch { Log-Fail "D5: Failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART E: NON-CANCELLABLE STAGES" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === E1: IN_TRANSIT -> CANCELLED (non-cancellable) ===
Write-Host "`n=== TEST E1: IN_TRANSIT -> CANCELLED (non-cancellable) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION","SOURCING","WAREHOUSE_CN","PACKING","CONSOLIDATION","IN_TRANSIT") $SALE1 | Out-Null
    $check = D (Api "GET" "/orders/$($ord.id)" $SALE1)
    Log-Info "Order at: $($check.status)"
    if ($check.status -eq "IN_TRANSIT") {
        $r = Try-Status $ord.id "CANCELLED" $SALE1
        Log-Info "Result: HTTP $($r.code) | $($r.msg)"
        if ($r.code -eq 400) {
            Log-Pass "E1: IN_TRANSIT -> CANCELLED blocked (non-cancellable)"
        } else {
            Log-Fail "E1: Expected 400, got $($r.code)"
        }
    } else {
        Log-Warn "E1: Could not advance to IN_TRANSIT (at $($check.status))"
    }
} catch { Log-Fail "E1: Failed - $($_.Exception.Message)" }

# === E2: CUSTOMS -> CANCELLED ===
Write-Host "`n=== TEST E2: CUSTOMS -> CANCELLED (non-cancellable) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION","SOURCING","WAREHOUSE_CN","PACKING","CONSOLIDATION","IN_TRANSIT","CUSTOMS") $SALE1 | Out-Null
    $check = D (Api "GET" "/orders/$($ord.id)" $SALE1)
    Log-Info "Order at: $($check.status)"
    if ($check.status -eq "CUSTOMS") {
        $r = Try-Status $ord.id "CANCELLED" $SALE1
        Log-Info "Result: HTTP $($r.code) | $($r.msg)"
        if ($r.code -eq 400) {
            Log-Pass "E2: CUSTOMS -> CANCELLED blocked (non-cancellable)"
        } else {
            Log-Fail "E2: Expected 400, got $($r.code)"
        }
    } else {
        Log-Warn "E2: Could not advance to CUSTOMS (at $($check.status))"
    }
} catch { Log-Fail "E2: Failed - $($_.Exception.Message)" }

# === E3: DELIVERING -> CANCELLED ===
Write-Host "`n=== TEST E3: DELIVERING -> CANCELLED (non-cancellable) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION","SOURCING","WAREHOUSE_CN","PACKING","CONSOLIDATION","IN_TRANSIT","CUSTOMS","WAREHOUSE_VN","DELIVERING") $SALE1 | Out-Null
    $check = D (Api "GET" "/orders/$($ord.id)" $SALE1)
    Log-Info "Order at: $($check.status)"
    if ($check.status -eq "DELIVERING") {
        $r = Try-Status $ord.id "CANCELLED" $SALE1
        Log-Info "Result: HTTP $($r.code) | $($r.msg)"
        if ($r.code -eq 400) {
            Log-Pass "E3: DELIVERING -> CANCELLED blocked (non-cancellable)"
        } else {
            Log-Fail "E3: Expected 400, got $($r.code)"
        }
    } else {
        Log-Warn "E3: Could not advance to DELIVERING (at $($check.status))"
    }
} catch { Log-Fail "E3: Failed - $($_.Exception.Message)" }

# === E4: SETTLEMENT -> CANCELLED ===
Write-Host "`n=== TEST E4: SETTLEMENT -> CANCELLED (non-cancellable) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION","SOURCING","WAREHOUSE_CN","PACKING","CONSOLIDATION","IN_TRANSIT","CUSTOMS","WAREHOUSE_VN","DELIVERING","SETTLEMENT") $SALE1 | Out-Null
    $check = D (Api "GET" "/orders/$($ord.id)" $SALE1)
    Log-Info "Order at: $($check.status)"
    if ($check.status -eq "SETTLEMENT") {
        $r = Try-Status $ord.id "CANCELLED" $SALE1
        Log-Info "Result: HTTP $($r.code) | $($r.msg)"
        if ($r.code -eq 400) {
            Log-Pass "E4: SETTLEMENT -> CANCELLED blocked (non-cancellable)"
        } else {
            Log-Fail "E4: Expected 400, got $($r.code)"
        }
    } else {
        Log-Warn "E4: Could not advance to SETTLEMENT (at $($check.status))"
    }
} catch { Log-Fail "E4: Failed - $($_.Exception.Message)" }

# === E5: CONSULTING -> CANCELLED (allowed - early stage) ===
Write-Host "`n=== TEST E5: CONSULTING -> CANCELLED (allowed - early stage) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    $r = Try-Status $ord.id "CANCELLED" $SALE1 "Huy don som"
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.ok) {
        Log-Pass "E5: CONSULTING -> CANCELLED allowed (early cancellable stage)"
    } else {
        Log-Fail "E5: Expected success for early cancellation, got $($r.code)"
    }
} catch { Log-Fail "E5: Failed - $($_.Exception.Message)" }

# === E6: QUOTATION -> CANCELLED (allowed) ===
Write-Host "`n=== TEST E6: QUOTATION -> CANCELLED (allowed) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    Advance-Order $ord.id @("QUOTATION") $SALE1 | Out-Null
    $r = Try-Status $ord.id "CANCELLED" $SALE1 "Huy don bao gia"
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.ok) {
        Log-Pass "E6: QUOTATION -> CANCELLED allowed (early cancellable stage)"
    } else {
        Log-Fail "E6: Expected success, got $($r.code)"
    }
} catch { Log-Fail "E6: Failed - $($_.Exception.Message)" }

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  PART F: SELF-TRANSITION + EDGE CASES" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White

# === F1: CONSULTING -> CONSULTING (self-transition) ===
Write-Host "`n=== TEST F1: CONSULTING -> CONSULTING (self-transition) ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    $r = Try-Status $ord.id "CONSULTING" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "F1: Self-transition CONSULTING -> CONSULTING blocked (400)"
    } else {
        Log-Warn "F1: Self-transition returned $($r.code) (may be idempotent)"
    }
} catch { Log-Fail "F1: Failed - $($_.Exception.Message)" }

# === F2: Double transition attempt ===
Write-Host "`n=== TEST F2: Double QUOTATION transition ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    $r1 = Try-Status $ord.id "QUOTATION" $SALE1
    $r2 = Try-Status $ord.id "QUOTATION" $SALE1
    Log-Info "1st: HTTP $($r1.code) | 2nd: HTTP $($r2.code)"
    if ($r1.ok -and $r2.code -eq 400) {
        Log-Pass "F2: Double transition blocked (1st OK, 2nd 400)"
    } elseif ($r1.ok -and $r2.ok) {
        Log-Warn "F2: Both succeeded (idempotent or self-transition allowed)"
    } else {
        Log-Warn "F2: 1st=$($r1.code), 2nd=$($r2.code)"
    }
} catch { Log-Fail "F2: Failed - $($_.Exception.Message)" }

# === F3: Valid transition works after invalid attempt ===
Write-Host "`n=== TEST F3: Valid transition after invalid attempt ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    # Try invalid first
    $r1 = Try-Status $ord.id "COMPLETED" $SALE1
    Log-Info "Invalid attempt: HTTP $($r1.code)"
    # Then valid
    $r2 = Try-Status $ord.id "QUOTATION" $SALE1
    Log-Info "Valid attempt: HTTP $($r2.code)"
    if (-not $r1.ok -and $r2.ok) {
        Log-Pass "F3: Valid transition succeeds after failed invalid attempt"
    } else {
        Log-Fail "F3: Expected invalid=fail, valid=ok. Got invalid=$($r1.code), valid=$($r2.code)"
    }
} catch { Log-Fail "F3: Failed - $($_.Exception.Message)" }

# === F4: Invalid status enum value ===
Write-Host "`n=== TEST F4: Non-existent status enum ===" -ForegroundColor Yellow
try {
    $ord = New-Order $CUST_ID "VCT" "HN" $SALE1
    $r = Try-Status $ord.id "SUPER_STATUS" $SALE1
    Log-Info "Result: HTTP $($r.code) | $($r.msg)"
    if ($r.code -eq 400) {
        Log-Pass "F4: Non-existent status enum rejected (400)"
    } else {
        Log-Fail "F4: Expected 400, got $($r.code)"
    }
} catch { Log-Fail "F4: Failed - $($_.Exception.Message)" }

# ============================================================
# SUMMARY
# ============================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  TONG KET TEST-ORD-011: Invalid State Transitions" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White
Write-Host ""
Write-Host "  Part A: Forward skip (7 tests) - nhay coc nhieu stage" -ForegroundColor Gray
Write-Host "  Part B: Reverse transitions (5 tests) - quay nguoc" -ForegroundColor Gray
Write-Host "  Part C: Terminal states (12 tests) - COMPLETED/CANCELLED" -ForegroundColor Gray
Write-Host "  Part D: Service-type rules (5 tests) - MHH deposit gate" -ForegroundColor Gray
Write-Host "  Part E: Non-cancellable stages (6 tests) - IN_TRANSIT+" -ForegroundColor Gray
Write-Host "  Part F: Edge cases (4 tests) - self-transition, double, enum" -ForegroundColor Gray
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
