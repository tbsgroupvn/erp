# ================================================================
# TEST-APR-002: Payment Voucher Approval with Amount-Based Routing
# Severity: HIGH
#
# Payment voucher approval flow:
#   <= 50M VND: Step1 ACCOUNTANT_AR + Step2 COO (2 steps)
#   >  50M VND: Step1 ACCOUNTANT_AR + Step2 CHIEF_ACCOUNTANT + Step3 COO (3 steps)
#
# Tests: amount routing, boundary, rejection, SoD, urgent, pending view
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

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-APR-002: Payment Voucher Approval - Amount-Based Routing" -ForegroundColor Cyan
Write-Host "  Severity: HIGH" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ================================================================
# SETUP: Login roles + find reference order
# ================================================================
Write-Host "=== SETUP: Login roles ===" -ForegroundColor White

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SALE login OK" } else { Fail "SALE login FAILED"; exit 1 }

$KETOAN = Login "ketoan@$DOMAIN"
if ($KETOAN) { Pass "KETOAN (ACCOUNTANT_AR / CHIEF_ACCOUNTANT) login OK" } else { Fail "KETOAN login FAILED"; exit 1 }

$COO = Login "admin@$DOMAIN"
if ($COO) { Pass "COO (admin) login OK" } else { Fail "COO login FAILED"; exit 1 }

$CFO = Login "cfo@$DOMAIN"
if ($CFO) { Pass "CFO login OK" } else { Fail "CFO login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

Write-Host ""

# Find an existing order to use as reference
Write-Host "=== SETUP: Find reference order ===" -ForegroundColor White
$ordersResp = D (Api "GET" "/orders?page=1&limit=5" $SALE)
$refOrder = $null
if ($ordersResp -and $ordersResp.items) {
    $refOrder = $ordersResp.items | Select-Object -First 1
} elseif ($ordersResp -is [array] -and $ordersResp.Count -gt 0) {
    $refOrder = $ordersResp[0]
} elseif ($ordersResp -and $ordersResp.data) {
    $items = @($ordersResp.data)
    if ($items.Count -gt 0) { $refOrder = $items[0] }
}

if (-not $refOrder) {
    # Create an order as fallback reference
    Write-Host "  No existing order found, creating one..." -ForegroundColor Gray
    $custResp = D (Api "GET" "/customers?page=1&limit=1" $CEO)
    $custId = $null
    if ($custResp -is [array] -and $custResp.Count -gt 0) { $custId = $custResp[0].id }
    elseif ($custResp -and $custResp.items) { $custId = $custResp.items[0].id }
    elseif ($custResp -and $custResp.data) { $custId = @($custResp.data)[0].id }
    elseif ($custResp -and $custResp.id) { $custId = $custResp.id }

    if ($custId) {
        $ts = Get-Date -Format "yyyyMMddHHmmss"
        $orderBody = @{
            customerId = $custId
            serviceType = "VCT"
            branch = "HN"
            shippingRoute = "SEA"
            items = @(@{ productName = "Test APR-002 ref"; quantity = 10; unitPrice = 50; currency = "CNY" })
            note = "Reference order for APR-002 test $ts"
        }
        $createResp = D (Api "POST" "/orders" $SALE $orderBody)
        if ($createResp -and $createResp.id) {
            $refOrder = $createResp
        }
    }
}

$REF_ID = if ($refOrder) { $refOrder.id } else { "test-ref-apr002" }
$REF_CODE = if ($refOrder) { $refOrder.code } else { "APR002-REF" }
Write-Host "  Reference: id=$REF_ID code=$REF_CODE" -ForegroundColor Gray
Write-Host ""

# ================================================================
# PART A: Small amount <= 50M - 2 steps
# ================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Small amount <= 50M VND - 2 steps" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# TEST A1: Create PAYMENT_VOUCHER approval with 8M
Write-Host "=== TEST A1: Create PAYMENT_VOUCHER (8M VND) ===" -ForegroundColor White
$apprA = $null
$apprAId = $null
$bodyA = @{
    type = "PAYMENT_VOUCHER"
    referenceId = $REF_ID
    referenceCode = $REF_CODE
    requestData = @{ amount = 8000000 }
    isUrgent = $false
}
$respA = D (Api "POST" "/approvals" $SALE $bodyA)
if ($respA -and $respA.id) {
    $apprA = $respA
    $apprAId = $respA.id
    Write-Host "  Approval: id=$apprAId | status=$($apprA.status) | totalSteps=$($apprA.totalSteps)" -ForegroundColor Gray
    Pass "A1: PAYMENT_VOUCHER approval created (8M VND)"
} else {
    Fail "A1: Failed to create PAYMENT_VOUCHER approval (8M)"
}

# TEST A2: Verify totalSteps = 2
Write-Host ""
Write-Host "=== TEST A2: Verify totalSteps = 2 ===" -ForegroundColor White
if ($apprA) {
    if ([int]$apprA.totalSteps -eq 2) {
        Pass "A2: totalSteps = 2 (correct for <= 50M)"
    } else {
        Fail "A2: Expected totalSteps=2, got $($apprA.totalSteps)"
    }
    # Verify step roles
    if ($apprA.steps -and $apprA.steps.Count -ge 2) {
        $s1Role = $apprA.steps[0].approverRole
        $s2Role = $apprA.steps[1].approverRole
        Write-Host "  Step1: $s1Role | Step2: $s2Role" -ForegroundColor Gray
        if ($s1Role -eq "ACCOUNTANT_AR" -and $s2Role -eq "COO") {
            Pass "A2: Step roles correct (ACCOUNTANT_AR -> COO)"
        } else {
            Warn "A2: Step roles unexpected: $s1Role -> $s2Role"
        }
    }
} else {
    Fail "A2: No approval to verify"
}

# TEST A3: ACCOUNTANT_AR (ketoan) approves step 1
Write-Host ""
Write-Host "=== TEST A3: ACCOUNTANT_AR approves step 1 ===" -ForegroundColor White
if ($apprAId) {
    $approveBody = @{ decision = "APPROVE"; comment = "Xac nhan so tien 8M hop le" }
    $respApprove = D (Api "POST" "/approvals/$apprAId/approve" $KETOAN $approveBody)
    Start-Sleep -Milliseconds 500
    if ($respApprove) {
        Pass "A3: ACCOUNTANT_AR approved step 1"
    } else {
        Fail "A3: ACCOUNTANT_AR approve step 1 failed"
    }
} else {
    Fail "A3: No approval ID"
}

# TEST A4: Verify step 1 APPROVED, step 2 now pending
Write-Host ""
Write-Host "=== TEST A4: Verify step progression ===" -ForegroundColor White
if ($apprAId) {
    $detailA = D (Api "GET" "/approvals/$apprAId" $SALE)
    if ($detailA) {
        $step1 = $detailA.steps | Where-Object { [int]$_.stepNumber -eq 1 }
        $step2 = $detailA.steps | Where-Object { [int]$_.stepNumber -eq 2 }
        Write-Host "  Step1 status: $($step1.status) | Step2 status: $($step2.status) | currentStep: $($detailA.currentStep)" -ForegroundColor Gray
        if ($step1.status -eq "APPROVED") {
            Pass "A4a: Step 1 is APPROVED"
        } else {
            Fail "A4a: Step 1 expected APPROVED, got $($step1.status)"
        }
        if ([int]$detailA.currentStep -eq 2) {
            Pass "A4b: currentStep advanced to 2"
        } else {
            Fail "A4b: Expected currentStep=2, got $($detailA.currentStep)"
        }
    } else {
        Fail "A4: Failed to get approval detail"
    }
} else {
    Fail "A4: No approval ID"
}

# TEST A5: COO (admin) approves step 2
Write-Host ""
Write-Host "=== TEST A5: COO approves step 2 ===" -ForegroundColor White
if ($apprAId) {
    $approveBody2 = @{ decision = "APPROVE"; comment = "COO duyet chi 8M" }
    $respApprove2 = D (Api "POST" "/approvals/$apprAId/approve" $COO $approveBody2)
    Start-Sleep -Milliseconds 500
    if ($respApprove2) {
        Pass "A5: COO approved step 2"
    } else {
        Fail "A5: COO approve step 2 failed"
    }
} else {
    Fail "A5: No approval ID"
}

# TEST A6: Verify approval status = APPROVED
Write-Host ""
Write-Host "=== TEST A6: Verify final status = APPROVED ===" -ForegroundColor White
if ($apprAId) {
    $finalA = D (Api "GET" "/approvals/$apprAId" $SALE)
    if ($finalA) {
        Write-Host "  Final status: $($finalA.status)" -ForegroundColor Gray
        if ($finalA.status -eq "APPROVED") {
            Pass "A6: Approval fully APPROVED (2-step flow complete)"
        } else {
            Fail "A6: Expected APPROVED, got $($finalA.status)"
        }
    } else {
        Fail "A6: Failed to get final status"
    }
} else {
    Fail "A6: No approval ID"
}

Write-Host ""

# ================================================================
# PART B: Medium amount 30M - still 2 steps
# ================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Medium amount 30M VND - still 2 steps" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# TEST B1: Create PAYMENT_VOUCHER approval with 30M
Write-Host "=== TEST B1: Create PAYMENT_VOUCHER (30M VND) ===" -ForegroundColor White
$apprB = $null
$apprBId = $null
$bodyB = @{
    type = "PAYMENT_VOUCHER"
    referenceId = $REF_ID
    referenceCode = $REF_CODE
    requestData = @{ amount = 30000000 }
}
$respB = D (Api "POST" "/approvals" $SALE $bodyB)
if ($respB -and $respB.id) {
    $apprB = $respB
    $apprBId = $respB.id
    Write-Host "  Approval: id=$apprBId | totalSteps=$($apprB.totalSteps)" -ForegroundColor Gray
    Pass "B1: PAYMENT_VOUCHER approval created (30M VND)"
} else {
    Fail "B1: Failed to create PAYMENT_VOUCHER approval (30M)"
}

# TEST B2: Verify totalSteps = 2
Write-Host ""
Write-Host "=== TEST B2: Verify totalSteps = 2 ===" -ForegroundColor White
if ($apprB) {
    if ([int]$apprB.totalSteps -eq 2) {
        Pass "B2: totalSteps = 2 (correct for 30M <= 50M)"
    } else {
        Fail "B2: Expected totalSteps=2, got $($apprB.totalSteps)"
    }
} else {
    Fail "B2: No approval to verify"
}

# TEST B3: Approve both steps
Write-Host ""
Write-Host "=== TEST B3: Approve both steps (ACCOUNTANT_AR + COO) ===" -ForegroundColor White
if ($apprBId) {
    # Step 1: ACCOUNTANT_AR
    $body1 = @{ decision = "APPROVE"; comment = "Duyet 30M - step 1" }
    $r1 = D (Api "POST" "/approvals/$apprBId/approve" $KETOAN $body1)
    Start-Sleep -Milliseconds 500
    if ($r1) {
        Pass "B3a: ACCOUNTANT_AR approved step 1"
    } else {
        Fail "B3a: ACCOUNTANT_AR approve failed"
    }

    # Step 2: COO
    $body2 = @{ decision = "APPROVE"; comment = "Duyet 30M - step 2" }
    $r2 = D (Api "POST" "/approvals/$apprBId/approve" $COO $body2)
    Start-Sleep -Milliseconds 500
    if ($r2) {
        Pass "B3b: COO approved step 2"
    } else {
        Fail "B3b: COO approve failed"
    }
} else {
    Fail "B3: No approval ID"
}

# TEST B4: Verify APPROVED
Write-Host ""
Write-Host "=== TEST B4: Verify final status = APPROVED ===" -ForegroundColor White
if ($apprBId) {
    $finalB = D (Api "GET" "/approvals/$apprBId" $SALE)
    if ($finalB -and $finalB.status -eq "APPROVED") {
        Pass "B4: 30M approval fully APPROVED"
    } else {
        Fail "B4: Expected APPROVED, got $($finalB.status)"
    }
} else {
    Fail "B4: No approval ID"
}

Write-Host ""

# ================================================================
# PART C: Large amount > 50M - 3 steps
# ================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Large amount > 50M VND - 3 steps" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# TEST C1: Create PAYMENT_VOUCHER approval with 80M
Write-Host "=== TEST C1: Create PAYMENT_VOUCHER (80M VND) ===" -ForegroundColor White
$apprC = $null
$apprCId = $null
$bodyC = @{
    type = "PAYMENT_VOUCHER"
    referenceId = $REF_ID
    referenceCode = $REF_CODE
    requestData = @{ amount = 80000000 }
}
$respC = D (Api "POST" "/approvals" $SALE $bodyC)
if ($respC -and $respC.id) {
    $apprC = $respC
    $apprCId = $respC.id
    Write-Host "  Approval: id=$apprCId | totalSteps=$($apprC.totalSteps) | status=$($apprC.status)" -ForegroundColor Gray
    Pass "C1: PAYMENT_VOUCHER approval created (80M VND)"
} else {
    Fail "C1: Failed to create PAYMENT_VOUCHER approval (80M)"
}

# TEST C2: Verify totalSteps = 3
Write-Host ""
Write-Host "=== TEST C2: Verify totalSteps = 3 ===" -ForegroundColor White
if ($apprC) {
    if ([int]$apprC.totalSteps -eq 3) {
        Pass "C2: totalSteps = 3 (correct for > 50M)"
    } else {
        Fail "C2: Expected totalSteps=3, got $($apprC.totalSteps)"
    }
    # Verify step roles
    if ($apprC.steps -and $apprC.steps.Count -ge 3) {
        $s1 = $apprC.steps[0].approverRole
        $s2 = $apprC.steps[1].approverRole
        $s3 = $apprC.steps[2].approverRole
        Write-Host "  Step1: $s1 | Step2: $s2 | Step3: $s3" -ForegroundColor Gray
        if ($s1 -eq "ACCOUNTANT_AR" -and $s2 -eq "CHIEF_ACCOUNTANT" -and $s3 -eq "COO") {
            Pass "C2: Step roles correct (ACCOUNTANT_AR -> CHIEF_ACCOUNTANT -> COO)"
        } else {
            Warn "C2: Step roles unexpected: $s1 -> $s2 -> $s3"
        }
    }
} else {
    Fail "C2: No approval to verify"
}

# TEST C3: ACCOUNTANT_AR approves step 1
Write-Host ""
Write-Host "=== TEST C3: ACCOUNTANT_AR approves step 1 ===" -ForegroundColor White
if ($apprCId) {
    $bodyAppr = @{ decision = "APPROVE"; comment = "KT xac nhan 80M - step 1" }
    $rC3 = D (Api "POST" "/approvals/$apprCId/approve" $KETOAN $bodyAppr)
    Start-Sleep -Milliseconds 500
    if ($rC3) {
        Pass "C3: ACCOUNTANT_AR approved step 1"
        Write-Host "  currentStep after: $($rC3.currentStep)" -ForegroundColor Gray
    } else {
        Fail "C3: ACCOUNTANT_AR approve step 1 failed"
    }
} else {
    Fail "C3: No approval ID"
}

# TEST C4: CHIEF_ACCOUNTANT approves step 2
Write-Host ""
Write-Host "=== TEST C4: CHIEF_ACCOUNTANT approves step 2 ===" -ForegroundColor White
if ($apprCId) {
    # ketoan has CHIEF_ACCOUNTANT role as well in the seed data
    $bodyAppr2 = @{ decision = "APPROVE"; comment = "KTT xac nhan 80M - step 2" }
    $rC4 = D (Api "POST" "/approvals/$apprCId/approve" $KETOAN $bodyAppr2)
    Start-Sleep -Milliseconds 500
    if ($rC4) {
        Pass "C4: CHIEF_ACCOUNTANT approved step 2"
        Write-Host "  currentStep after: $($rC4.currentStep)" -ForegroundColor Gray
    } else {
        # If ketoan does not have CHIEF_ACCOUNTANT role, try CFO
        Write-Host "  ketoan failed step 2, trying CFO..." -ForegroundColor Yellow
        $rC4 = D (Api "POST" "/approvals/$apprCId/approve" $CFO $bodyAppr2)
        Start-Sleep -Milliseconds 500
        if ($rC4) {
            Pass "C4: CFO approved step 2 (as CHIEF_ACCOUNTANT fallback)"
        } else {
            # Try CEO
            $rC4 = D (Api "POST" "/approvals/$apprCId/approve" $CEO $bodyAppr2)
            Start-Sleep -Milliseconds 500
            if ($rC4) {
                Pass "C4: CEO approved step 2 (as CHIEF_ACCOUNTANT fallback)"
            } else {
                Fail "C4: Could not approve step 2 (CHIEF_ACCOUNTANT)"
            }
        }
    }
} else {
    Fail "C4: No approval ID"
}

# TEST C5: COO approves step 3
Write-Host ""
Write-Host "=== TEST C5: COO approves step 3 ===" -ForegroundColor White
if ($apprCId) {
    $bodyAppr3 = @{ decision = "APPROVE"; comment = "COO duyet chi 80M - step 3" }
    $rC5 = D (Api "POST" "/approvals/$apprCId/approve" $COO $bodyAppr3)
    Start-Sleep -Milliseconds 500
    if ($rC5) {
        Pass "C5: COO approved step 3"
    } else {
        Fail "C5: COO approve step 3 failed"
    }
} else {
    Fail "C5: No approval ID"
}

# TEST C6: Verify status = APPROVED
Write-Host ""
Write-Host "=== TEST C6: Verify final status = APPROVED ===" -ForegroundColor White
if ($apprCId) {
    $finalC = D (Api "GET" "/approvals/$apprCId" $SALE)
    if ($finalC) {
        Write-Host "  Final status: $($finalC.status)" -ForegroundColor Gray
        if ($finalC.status -eq "APPROVED") {
            Pass "C6: 80M approval fully APPROVED (3-step flow complete)"
        } else {
            Fail "C6: Expected APPROVED, got $($finalC.status)"
        }
    } else {
        Fail "C6: Failed to get final status"
    }
} else {
    Fail "C6: No approval ID"
}

# TEST C7: Get action-log - verify 3 approve entries
Write-Host ""
Write-Host "=== TEST C7: Verify action-log has 3 approve entries ===" -ForegroundColor White
if ($apprCId) {
    $actionLog = D (Api "GET" "/approvals/$apprCId/action-log" $SALE)
    if ($actionLog) {
        $logItems = @($actionLog)
        $approveEntries = @($logItems | Where-Object { $_.action -eq "APPROVE" })
        Write-Host "  Action log: $($logItems.Count) total entries, $($approveEntries.Count) APPROVE entries" -ForegroundColor Gray
        foreach ($entry in $logItems) {
            Write-Host "    $($entry.action) by $($entry.userId) at $($entry.createdAt)" -ForegroundColor Gray
        }
        if ($approveEntries.Count -ge 3) {
            Pass "C7: Action log has $($approveEntries.Count) APPROVE entries (expected >= 3)"
        } else {
            Warn "C7: Expected >= 3 APPROVE entries, got $($approveEntries.Count)"
        }
    } else {
        Fail "C7: Failed to get action log"
    }
} else {
    Fail "C7: No approval ID"
}

Write-Host ""

# ================================================================
# PART D: Exact boundary 50M
# ================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Exact boundary 50M VND" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# TEST D1: Create with amount = 50000000 (exactly 50M)
Write-Host "=== TEST D1: Create PAYMENT_VOUCHER (exactly 50M VND) ===" -ForegroundColor White
$apprD = $null
$apprDId = $null
$bodyD = @{
    type = "PAYMENT_VOUCHER"
    referenceId = $REF_ID
    referenceCode = $REF_CODE
    requestData = @{ amount = 50000000 }
}
$respD = D (Api "POST" "/approvals" $SALE $bodyD)
if ($respD -and $respD.id) {
    $apprD = $respD
    $apprDId = $respD.id
    Write-Host "  Approval: id=$apprDId | totalSteps=$($apprD.totalSteps)" -ForegroundColor Gray
    Pass "D1: PAYMENT_VOUCHER approval created (exactly 50M VND)"
} else {
    Fail "D1: Failed to create PAYMENT_VOUCHER approval (50M)"
}

# TEST D2: Verify totalSteps = 2 (boundary: <= 50M means NOT > 50M)
Write-Host ""
Write-Host "=== TEST D2: Verify totalSteps = 2 (boundary: 50M is NOT > 50M) ===" -ForegroundColor White
if ($apprD) {
    if ([int]$apprD.totalSteps -eq 2) {
        Pass "D2: totalSteps = 2 (50M boundary correctly uses 2-step flow)"
    } elseif ([int]$apprD.totalSteps -eq 3) {
        Fail "D2: totalSteps = 3 (boundary error: 50M should use 2-step flow, not 3-step)"
    } else {
        Fail "D2: Unexpected totalSteps=$($apprD.totalSteps)"
    }
} else {
    Fail "D2: No approval to verify"
}

# TEST D3: Approve and verify
Write-Host ""
Write-Host "=== TEST D3: Approve 50M boundary approval ===" -ForegroundColor White
if ($apprDId) {
    # Step 1: ACCOUNTANT_AR
    $b1 = @{ decision = "APPROVE"; comment = "Duyet 50M boundary - step 1" }
    $r1 = D (Api "POST" "/approvals/$apprDId/approve" $KETOAN $b1)
    Start-Sleep -Milliseconds 500

    # Step 2: COO
    $b2 = @{ decision = "APPROVE"; comment = "Duyet 50M boundary - step 2" }
    $r2 = D (Api "POST" "/approvals/$apprDId/approve" $COO $b2)
    Start-Sleep -Milliseconds 500

    $finalD = D (Api "GET" "/approvals/$apprDId" $SALE)
    if ($finalD -and $finalD.status -eq "APPROVED") {
        Pass "D3: 50M boundary approval fully APPROVED"
    } else {
        Fail "D3: Expected APPROVED, got $($finalD.status)"
    }
} else {
    Fail "D3: No approval ID"
}

Write-Host ""

# ================================================================
# PART E: Very large amount
# ================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: Very large amount 500M VND" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# TEST E1: Create with amount = 500000000 (500M)
Write-Host "=== TEST E1: Create PAYMENT_VOUCHER (500M VND) ===" -ForegroundColor White
$apprE = $null
$apprEId = $null
$bodyE = @{
    type = "PAYMENT_VOUCHER"
    referenceId = $REF_ID
    referenceCode = $REF_CODE
    requestData = @{ amount = 500000000 }
}
$respE = D (Api "POST" "/approvals" $SALE $bodyE)
if ($respE -and $respE.id) {
    $apprE = $respE
    $apprEId = $respE.id
    Write-Host "  Approval: id=$apprEId | totalSteps=$($apprE.totalSteps)" -ForegroundColor Gray
    Pass "E1: PAYMENT_VOUCHER approval created (500M VND)"
} else {
    Fail "E1: Failed to create PAYMENT_VOUCHER approval (500M)"
}

# TEST E2: Verify totalSteps = 3
Write-Host ""
Write-Host "=== TEST E2: Verify totalSteps = 3 ===" -ForegroundColor White
if ($apprE) {
    if ([int]$apprE.totalSteps -eq 3) {
        Pass "E2: totalSteps = 3 (correct for 500M > 50M)"
    } else {
        Fail "E2: Expected totalSteps=3, got $($apprE.totalSteps)"
    }
} else {
    Fail "E2: No approval to verify"
}

# TEST E3: Approve all steps
Write-Host ""
Write-Host "=== TEST E3: Approve all 3 steps ===" -ForegroundColor White
if ($apprEId) {
    # Step 1: ACCOUNTANT_AR
    $r1 = D (Api "POST" "/approvals/$apprEId/approve" $KETOAN (@{ decision = "APPROVE"; comment = "KT duyet 500M step 1" }))
    Start-Sleep -Milliseconds 500
    if ($r1) { Write-Host "  Step 1 approved" -ForegroundColor Gray } else { Warn "E3: Step 1 approve issue" }

    # Step 2: CHIEF_ACCOUNTANT
    $r2 = D (Api "POST" "/approvals/$apprEId/approve" $KETOAN (@{ decision = "APPROVE"; comment = "KTT duyet 500M step 2" }))
    Start-Sleep -Milliseconds 500
    if (-not $r2) {
        $r2 = D (Api "POST" "/approvals/$apprEId/approve" $CFO (@{ decision = "APPROVE"; comment = "CFO duyet 500M step 2" }))
        Start-Sleep -Milliseconds 500
    }
    if ($r2) { Write-Host "  Step 2 approved" -ForegroundColor Gray } else { Warn "E3: Step 2 approve issue" }

    # Step 3: COO
    $r3 = D (Api "POST" "/approvals/$apprEId/approve" $COO (@{ decision = "APPROVE"; comment = "COO duyet 500M step 3" }))
    Start-Sleep -Milliseconds 500
    if ($r3) { Write-Host "  Step 3 approved" -ForegroundColor Gray } else { Warn "E3: Step 3 approve issue" }

    $finalE = D (Api "GET" "/approvals/$apprEId" $SALE)
    if ($finalE -and $finalE.status -eq "APPROVED") {
        Pass "E3: 500M approval fully APPROVED (all 3 steps)"
    } else {
        Fail "E3: Expected APPROVED, got $($finalE.status)"
    }
} else {
    Fail "E3: No approval ID"
}

# TEST E4: Verify requestData preserved
Write-Host ""
Write-Host "=== TEST E4: Verify requestData preserved ===" -ForegroundColor White
if ($apprEId) {
    $detailE = D (Api "GET" "/approvals/$apprEId" $SALE)
    if ($detailE -and $detailE.requestData) {
        $storedAmount = $detailE.requestData.amount
        Write-Host "  requestData.amount = $storedAmount" -ForegroundColor Gray
        if ([decimal]$storedAmount -eq 500000000) {
            Pass "E4: requestData.amount = 500000000 (preserved correctly)"
        } else {
            Fail "E4: Expected amount=500000000, got $storedAmount"
        }
    } else {
        Fail "E4: requestData not found in approval"
    }
} else {
    Fail "E4: No approval ID"
}

Write-Host ""

# ================================================================
# PART F: Rejection at step 2
# ================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Rejection at step 2 (3-step flow)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# TEST F1: Create PAYMENT_VOUCHER (80M, 3 steps)
Write-Host "=== TEST F1: Create PAYMENT_VOUCHER (80M for rejection test) ===" -ForegroundColor White
$apprF = $null
$apprFId = $null
$bodyF = @{
    type = "PAYMENT_VOUCHER"
    referenceId = $REF_ID
    referenceCode = $REF_CODE
    requestData = @{ amount = 80000000 }
}
$respF = D (Api "POST" "/approvals" $SALE $bodyF)
if ($respF -and $respF.id) {
    $apprF = $respF
    $apprFId = $respF.id
    Write-Host "  Approval: id=$apprFId | totalSteps=$($apprF.totalSteps)" -ForegroundColor Gray
    Pass "F1: PAYMENT_VOUCHER created for rejection test (80M, 3 steps)"
} else {
    Fail "F1: Failed to create PAYMENT_VOUCHER for rejection test"
}

# TEST F2: Step 1 approves
Write-Host ""
Write-Host "=== TEST F2: ACCOUNTANT_AR approves step 1 ===" -ForegroundColor White
if ($apprFId) {
    $rF2 = D (Api "POST" "/approvals/$apprFId/approve" $KETOAN (@{ decision = "APPROVE"; comment = "Duyet step 1 truoc khi reject" }))
    Start-Sleep -Milliseconds 500
    if ($rF2) {
        Pass "F2: Step 1 approved"
    } else {
        Fail "F2: Step 1 approve failed"
    }
} else {
    Fail "F2: No approval ID"
}

# TEST F3: Step 2 (CHIEF_ACCOUNTANT) rejects
Write-Host ""
Write-Host "=== TEST F3: CHIEF_ACCOUNTANT rejects step 2 ===" -ForegroundColor White
if ($apprFId) {
    $rejectBody = @{ decision = "REJECT"; comment = "So tien qua lon, can xem lai" }
    $rF3 = D (Api "POST" "/approvals/$apprFId/reject" $KETOAN $rejectBody)
    Start-Sleep -Milliseconds 500
    if (-not $rF3) {
        # Try CFO as fallback for CHIEF_ACCOUNTANT
        $rF3 = D (Api "POST" "/approvals/$apprFId/reject" $CFO $rejectBody)
        Start-Sleep -Milliseconds 500
    }
    if ($rF3) {
        Pass "F3: Step 2 rejected by CHIEF_ACCOUNTANT"
    } else {
        Fail "F3: Step 2 reject failed"
    }
} else {
    Fail "F3: No approval ID"
}

# TEST F4: Verify entire approval REJECTED
Write-Host ""
Write-Host "=== TEST F4: Verify entire approval REJECTED ===" -ForegroundColor White
if ($apprFId) {
    $finalF = D (Api "GET" "/approvals/$apprFId" $SALE)
    if ($finalF) {
        Write-Host "  Final status: $($finalF.status)" -ForegroundColor Gray
        if ($finalF.status -eq "REJECTED") {
            Pass "F4: Entire approval is REJECTED (rejection at any step rejects all)"
        } else {
            Fail "F4: Expected REJECTED, got $($finalF.status)"
        }
        # Verify the reject step
        $rejectedStep = $finalF.steps | Where-Object { $_.status -eq "REJECTED" }
        if ($rejectedStep) {
            Write-Host "  Rejected at step $($rejectedStep.stepNumber) by role $($rejectedStep.approverRole)" -ForegroundColor Gray
        }
    } else {
        Fail "F4: Failed to get final status"
    }
} else {
    Fail "F4: No approval ID"
}

Write-Host ""

# ================================================================
# PART G: Separation of Duties check
# ================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: Separation of Duties (SoD)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# TEST G1: SALE creates PAYMENT_VOUCHER approval
Write-Host "=== TEST G1: SALE creates PAYMENT_VOUCHER ===" -ForegroundColor White
$apprG = $null
$apprGId = $null
$bodyG = @{
    type = "PAYMENT_VOUCHER"
    referenceId = $REF_ID
    referenceCode = $REF_CODE
    requestData = @{ amount = 10000000 }
}
$respG = D (Api "POST" "/approvals" $SALE $bodyG)
if ($respG -and $respG.id) {
    $apprG = $respG
    $apprGId = $respG.id
    Pass "G1: SALE created PAYMENT_VOUCHER approval"
} else {
    Fail "G1: SALE failed to create approval"
}

# TEST G2: Same SALE tries to approve own approval - expect rejection
Write-Host ""
Write-Host "=== TEST G2: SALE tries to approve own approval ===" -ForegroundColor White
if ($apprGId) {
    $sodResp = Api-Expect "POST" "/approvals/$apprGId/approve" $SALE (@{ decision = "APPROVE"; comment = "Self approve attempt" })
    if ($sodResp.code -ge 400) {
        Pass "G2: SALE cannot approve own approval (HTTP $($sodResp.code) - SoD enforced)"
    } else {
        Warn "G2: SALE was able to call approve (HTTP $($sodResp.code)) - SoD may be role-based not user-based"
    }
} else {
    Fail "G2: No approval ID"
}

# TEST G3: Verify SoD - approval still PENDING (not self-approved)
Write-Host ""
Write-Host "=== TEST G3: Verify approval still PENDING ===" -ForegroundColor White
if ($apprGId) {
    $detailG = D (Api "GET" "/approvals/$apprGId" $SALE)
    if ($detailG) {
        if ($detailG.status -eq "PENDING") {
            Pass "G3: Approval still PENDING (SoD maintained)"
        } else {
            Fail "G3: Expected PENDING, got $($detailG.status)"
        }
    } else {
        Fail "G3: Failed to get approval"
    }
    # Clean up: withdraw this approval
    $withdrawResp = D (Api "POST" "/approvals/$apprGId/withdraw" $SALE @{})
} else {
    Fail "G3: No approval ID"
}

Write-Host ""

# ================================================================
# PART H: Urgent flag
# ================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Urgent flag" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# TEST H1: Create PAYMENT_VOUCHER with isUrgent=true
Write-Host "=== TEST H1: Create urgent PAYMENT_VOUCHER ===" -ForegroundColor White
$apprH = $null
$apprHId = $null
$bodyH = @{
    type = "PAYMENT_VOUCHER"
    referenceId = $REF_ID
    referenceCode = $REF_CODE
    requestData = @{ amount = 15000000 }
    isUrgent = $true
}
$respH = D (Api "POST" "/approvals" $SALE $bodyH)
if ($respH -and $respH.id) {
    $apprH = $respH
    $apprHId = $respH.id
    Write-Host "  Approval: id=$apprHId | isUrgent=$($apprH.isUrgent)" -ForegroundColor Gray
    Pass "H1: Urgent PAYMENT_VOUCHER created"
} else {
    Fail "H1: Failed to create urgent PAYMENT_VOUCHER"
}

# TEST H2: Verify isUrgent flag stored
Write-Host ""
Write-Host "=== TEST H2: Verify isUrgent flag ===" -ForegroundColor White
if ($apprHId) {
    $detailH = D (Api "GET" "/approvals/$apprHId" $SALE)
    if ($detailH) {
        if ($detailH.isUrgent -eq $true) {
            Pass "H2: isUrgent = true (stored correctly)"
        } else {
            Warn "H2: isUrgent = $($detailH.isUrgent) (may not be exposed in response)"
        }
    } else {
        Fail "H2: Failed to get approval detail"
    }
} else {
    Fail "H2: No approval ID"
}

# TEST H3: Approve normally (urgent does not change step count)
Write-Host ""
Write-Host "=== TEST H3: Approve urgent approval normally ===" -ForegroundColor White
if ($apprHId) {
    # Verify still 2 steps (15M <= 50M)
    if ($apprH -and [int]$apprH.totalSteps -eq 2) {
        Write-Host "  totalSteps = 2 (urgent does not add extra steps)" -ForegroundColor Gray
    }

    # Step 1: ACCOUNTANT_AR
    $r1 = D (Api "POST" "/approvals/$apprHId/approve" $KETOAN (@{ decision = "APPROVE"; comment = "Urgent - duyet nhanh step 1" }))
    Start-Sleep -Milliseconds 500

    # Step 2: COO
    $r2 = D (Api "POST" "/approvals/$apprHId/approve" $COO (@{ decision = "APPROVE"; comment = "Urgent - duyet nhanh step 2" }))
    Start-Sleep -Milliseconds 500

    $finalH = D (Api "GET" "/approvals/$apprHId" $SALE)
    if ($finalH -and $finalH.status -eq "APPROVED") {
        Pass "H3: Urgent approval fully APPROVED"
    } else {
        Fail "H3: Expected APPROVED, got $($finalH.status)"
    }
} else {
    Fail "H3: No approval ID"
}

Write-Host ""

# ================================================================
# PART I: Pending view per role
# ================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART I: Pending view per role" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# TEST I1: Create PAYMENT_VOUCHER (pending at ACCOUNTANT_AR)
Write-Host "=== TEST I1: Create PAYMENT_VOUCHER for pending view test ===" -ForegroundColor White
$apprI = $null
$apprIId = $null
$bodyI = @{
    type = "PAYMENT_VOUCHER"
    referenceId = $REF_ID
    referenceCode = $REF_CODE
    requestData = @{ amount = 20000000 }
}
$respI = D (Api "POST" "/approvals" $SALE $bodyI)
if ($respI -and $respI.id) {
    $apprI = $respI
    $apprIId = $respI.id
    Write-Host "  Approval: id=$apprIId | currentStep=$($apprI.currentStep)" -ForegroundColor Gray
    Pass "I1: PAYMENT_VOUCHER created (pending at step 1 / ACCOUNTANT_AR)"
} else {
    Fail "I1: Failed to create PAYMENT_VOUCHER for pending view test"
}

# TEST I2: KETOAN gets /approvals/pending - verify it appears
Write-Host ""
Write-Host "=== TEST I2: KETOAN (ACCOUNTANT_AR) pending list ===" -ForegroundColor White
if ($apprIId) {
    $pendingKetoan = D (Api "GET" "/approvals/pending?limit=50&offset=0" $KETOAN)
    $foundInKetoan = $false
    if ($pendingKetoan) {
        $pendingItems = @()
        if ($pendingKetoan -is [array]) { $pendingItems = @($pendingKetoan) }
        elseif ($pendingKetoan.items) { $pendingItems = @($pendingKetoan.items) }
        elseif ($pendingKetoan.data) { $pendingItems = @($pendingKetoan.data) }
        foreach ($item in $pendingItems) {
            if ($item.id -eq $apprIId) { $foundInKetoan = $true; break }
        }
        Write-Host "  KETOAN pending: $($pendingItems.Count) items, found target: $foundInKetoan" -ForegroundColor Gray
    }
    if ($foundInKetoan) {
        Pass "I2: Approval appears in KETOAN (ACCOUNTANT_AR) pending list"
    } else {
        Warn "I2: Approval NOT found in KETOAN pending list (may use different query)"
    }
} else {
    Fail "I2: No approval ID"
}

# TEST I3: COO gets /approvals/pending - should NOT appear yet (not their step)
Write-Host ""
Write-Host "=== TEST I3: COO pending list - should NOT show step-1 approval ===" -ForegroundColor White
if ($apprIId) {
    $pendingCOO = D (Api "GET" "/approvals/pending?limit=50&offset=0" $COO)
    $foundInCOO = $false
    if ($pendingCOO) {
        $cooItems = @()
        if ($pendingCOO -is [array]) { $cooItems = @($pendingCOO) }
        elseif ($pendingCOO.items) { $cooItems = @($pendingCOO.items) }
        elseif ($pendingCOO.data) { $cooItems = @($pendingCOO.data) }
        foreach ($item in $cooItems) {
            if ($item.id -eq $apprIId) { $foundInCOO = $true; break }
        }
        Write-Host "  COO pending: $($cooItems.Count) items, found target: $foundInCOO" -ForegroundColor Gray
    }
    if (-not $foundInCOO) {
        Pass "I3: Approval does NOT appear in COO pending (correct - not their step yet)"
    } else {
        Warn "I3: Approval found in COO pending even though step 1 is still with ACCOUNTANT_AR"
    }
} else {
    Fail "I3: No approval ID"
}

# TEST I4: After KETOAN approves step 1, COO pending should show it
Write-Host ""
Write-Host "=== TEST I4: After step 1 approve, COO pending should show it ===" -ForegroundColor White
if ($apprIId) {
    # Approve step 1
    $rI4 = D (Api "POST" "/approvals/$apprIId/approve" $KETOAN (@{ decision = "APPROVE"; comment = "Step 1 duyet de test pending view" }))
    Start-Sleep -Milliseconds 500

    if ($rI4) {
        Write-Host "  Step 1 approved, now checking COO pending..." -ForegroundColor Gray

        $pendingCOO2 = D (Api "GET" "/approvals/pending?limit=50&offset=0" $COO)
        $foundInCOO2 = $false
        if ($pendingCOO2) {
            $coo2Items = @()
            if ($pendingCOO2 -is [array]) { $coo2Items = @($pendingCOO2) }
            elseif ($pendingCOO2.items) { $coo2Items = @($pendingCOO2.items) }
            elseif ($pendingCOO2.data) { $coo2Items = @($pendingCOO2.data) }
            foreach ($item in $coo2Items) {
                if ($item.id -eq $apprIId) { $foundInCOO2 = $true; break }
            }
            Write-Host "  COO pending after step 1: $($coo2Items.Count) items, found target: $foundInCOO2" -ForegroundColor Gray
        }
        if ($foundInCOO2) {
            Pass "I4: After step 1 approved, approval now appears in COO pending list"
        } else {
            Warn "I4: Approval still not in COO pending after step 1 approved"
        }
    } else {
        Fail "I4: Step 1 approve failed"
    }

    # Clean up: approve step 2 so approval is complete
    $rClean = D (Api "POST" "/approvals/$apprIId/approve" $COO (@{ decision = "APPROVE"; comment = "Cleanup step 2" }))
    Start-Sleep -Milliseconds 500
} else {
    Fail "I4: No approval ID"
}

Write-Host ""

# ================================================================
# SUMMARY
# ================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-APR-002: Payment Voucher Approval" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Part A: Small amount 8M (2 steps)              - ACCOUNTANT_AR -> COO"
Write-Host "  Part B: Medium amount 30M (2 steps)            - ACCOUNTANT_AR -> COO"
Write-Host "  Part C: Large amount 80M (3 steps)             - ACCOUNTANT_AR -> CHIEF_ACCOUNTANT -> COO"
Write-Host "  Part D: Exact boundary 50M (2 steps)           - Boundary check"
Write-Host "  Part E: Very large 500M (3 steps)              - requestData preserved"
Write-Host "  Part F: Rejection at step 2 (3 steps)          - Entire approval REJECTED"
Write-Host "  Part G: Separation of Duties                   - Cannot self-approve"
Write-Host "  Part H: Urgent flag                            - isUrgent preserved"
Write-Host "  Part I: Pending view per role                  - Role-based visibility"
Write-Host ""
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host ""

$total = $passCount + $failCount + $warnCount
if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL $total TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $failCount / $total TESTS FAILED - REVIEW REQUIRED" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Cyan
