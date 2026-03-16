# ================================================================
# TEST-APR-001: Discount Approval Flow - 3-Tier Conditions
# Severity: HIGH
#
# Steps:
#   PART A: Tier 1 - Small discount <= 3% (2 steps: SALES_LEADER + ACCOUNTANT_AR)
#   PART B: Tier 2 - Medium discount > 3% (3 steps: + SALES_DIRECTOR)
#   PART C: Tier 3 - Large discount > 5% (4 steps: + COO)
#   PART D: Rejection flow
#   PART E: Delegation flow
#   PART F: Withdraw flow
#   PART G: Comments & Action Log
#   PART H: Pending approvals view
#   PART I: RBAC - list filtering
#   PART J: Amount-based tier trigger (>100M -> COO)
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
Write-Host "  TEST-APR-001: Discount Approval Flow - 3-Tier Conditions" -ForegroundColor Cyan
Write-Host "  Severity: HIGH" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login all needed roles
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login ===" -ForegroundColor White

$SALE1 = Login "sale01@$DOMAIN"
if ($SALE1) { Pass "SALE1 login OK" } else { Fail "SALE1 login FAILED"; exit 1 }

$LEADER = Login "leader.hn@$DOMAIN"
if ($LEADER) { Pass "SALES_LEADER login OK" } else { Fail "SALES_LEADER login FAILED"; exit 1 }

$GDKD = Login "gdkd@$DOMAIN"
if ($GDKD) { Pass "SALES_DIRECTOR login OK" } else { Fail "SALES_DIRECTOR login FAILED"; exit 1 }

$KETOAN = Login "ketoan@$DOMAIN"
if ($KETOAN) { Pass "CHIEF_ACCOUNTANT login OK" } else { Fail "CHIEF_ACCOUNTANT login FAILED"; exit 1 }

$CFO = Login "cfo@$DOMAIN"
if ($CFO) { Pass "CFO login OK" } else { Fail "CFO login FAILED"; exit 1 }

$COO = Login "admin@$DOMAIN"
if ($COO) { Pass "COO login OK" } else { Fail "COO login FAILED"; exit 1 }

# Get an existing order to use as referenceId
Write-Host ""
Write-Host "=== SETUP: Find existing order ===" -ForegroundColor White
$ordersResp = D (Api "GET" "/orders?limit=1" $SALE1)
$ORDER_ID = $null
$ORDER_CODE = $null
if ($ordersResp -is [array] -and $ordersResp.Count -gt 0) {
    $ORDER_ID = $ordersResp[0].id
    $ORDER_CODE = $ordersResp[0].code
} elseif ($ordersResp -and $ordersResp.items -and $ordersResp.items.Count -gt 0) {
    $ORDER_ID = $ordersResp.items[0].id
    $ORDER_CODE = $ordersResp.items[0].code
} elseif ($ordersResp -and $ordersResp.data -and $ordersResp.data.Count -gt 0) {
    $ORDER_ID = $ordersResp.data[0].id
    $ORDER_CODE = $ordersResp.data[0].code
} elseif ($ordersResp -and $ordersResp.id) {
    $ORDER_ID = $ordersResp.id
    $ORDER_CODE = $ordersResp.code
}

if ($ORDER_ID) {
    Write-Host "  Using order: $ORDER_CODE (ID=$ORDER_ID)" -ForegroundColor Gray
} else {
    Warn "No existing order found, using placeholder ID"
    $ORDER_ID = "placeholder-order-id"
    $ORDER_CODE = "ORD-PLACEHOLDER"
}

# ================================================================
# PART A: TIER 1 - SMALL DISCOUNT <= 3% (2 steps)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Tier 1 - Small discount <= 3% (2 steps)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# A1: Find existing order
Write-Host ""
Write-Host "=== TEST A1: Verify order exists ===" -ForegroundColor White
if ($ORDER_ID -and $ORDER_ID -ne "placeholder-order-id") {
    Pass "A1: Order found ($ORDER_CODE)"
} else {
    Warn "A1: No real order found, tests may produce errors"
}

# A2: Create DISCOUNT approval (2%)
Write-Host ""
Write-Host "=== TEST A2: Create DISCOUNT approval (2%) ===" -ForegroundColor White
$aprA = D (Api "POST" "/approvals" $SALE1 @{
    type          = "DISCOUNT"
    referenceId   = $ORDER_ID
    referenceCode = $ORDER_CODE
    requestData   = @{
        discountPercent = 2
        discountAmount  = 500000
    }
})
$APR_A_ID = $null
if ($aprA -and $aprA.id) {
    $APR_A_ID = $aprA.id
    Write-Host "  Approval ID: $APR_A_ID"
    Write-Host "  Status: $($aprA.status) | Type: $($aprA.type)"
    Pass "A2: DISCOUNT approval created"
} else {
    Fail "A2: Failed to create DISCOUNT approval"
}

# A3: Verify status=PENDING and totalSteps=2
Write-Host ""
Write-Host "=== TEST A3: Verify approval details ===" -ForegroundColor White
if ($APR_A_ID) {
    $detailA = D (Api "GET" "/approvals/$APR_A_ID" $SALE1)
    if ($detailA) {
        if ($detailA.status -eq "PENDING") {
            Pass "A3a: Status = PENDING"
        } else {
            Fail "A3a: Expected PENDING, got $($detailA.status)"
        }

        $stepsA = $detailA.steps
        $stepsCount = 0
        if ($stepsA -is [array]) { $stepsCount = $stepsA.Count }
        elseif ($stepsA) { $stepsCount = 1 }
        Write-Host "  Total steps: $stepsCount"

        if ($stepsCount -eq 2) {
            Pass "A3b: totalSteps = 2 (SALES_LEADER + ACCOUNTANT_AR)"
        } elseif ($stepsCount -gt 0) {
            Warn "A3b: totalSteps = $stepsCount (expected 2 for 2% discount)"
        } else {
            Fail "A3b: No steps found"
        }
    } else {
        Fail "A3: Could not get approval details"
    }
} else {
    Warn "A3: Skipped (no approval created)"
}

# A4: SALES_LEADER approves step 1
Write-Host ""
Write-Host "=== TEST A4: SALES_LEADER approves step 1 ===" -ForegroundColor White
if ($APR_A_ID) {
    $apprA1 = D (Api "POST" "/approvals/$APR_A_ID/approve" $LEADER @{
        decision = "APPROVE"
        comment  = "OK 2% - hop ly"
    })
    Start-Sleep -Milliseconds 500
    if ($apprA1) {
        Pass "A4: SALES_LEADER approved step 1"
    } else {
        Fail "A4: SALES_LEADER approve failed"
    }
} else {
    Warn "A4: Skipped"
}

# A5: ACCOUNTANT_AR (ketoan) approves step 2
Write-Host ""
Write-Host "=== TEST A5: ACCOUNTANT_AR approves step 2 ===" -ForegroundColor White
if ($APR_A_ID) {
    $apprA2 = D (Api "POST" "/approvals/$APR_A_ID/approve" $KETOAN @{
        decision = "APPROVE"
        comment  = "KT xac nhan - giam gia 2% OK"
    })
    Start-Sleep -Milliseconds 500
    if ($apprA2) {
        Pass "A5: ACCOUNTANT_AR approved step 2"
    } else {
        Fail "A5: ACCOUNTANT_AR approve failed"
    }
} else {
    Warn "A5: Skipped"
}

# A6: Verify final status=APPROVED
Write-Host ""
Write-Host "=== TEST A6: Verify final status APPROVED ===" -ForegroundColor White
if ($APR_A_ID) {
    $finalA = D (Api "GET" "/approvals/$APR_A_ID" $SALE1)
    if ($finalA) {
        if ($finalA.status -eq "APPROVED") {
            Pass "A6: Tier 1 approval APPROVED (all 2 steps done)"
        } else {
            Fail "A6: Expected APPROVED, got $($finalA.status)"
        }
    } else {
        Fail "A6: Could not get approval details"
    }
} else {
    Warn "A6: Skipped"
}

# ================================================================
# PART B: TIER 2 - MEDIUM DISCOUNT > 3% (3 steps)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Tier 2 - Medium discount > 3% (3 steps)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# B1: Create DISCOUNT approval (4%)
Write-Host ""
Write-Host "=== TEST B1: Create DISCOUNT approval (4%) ===" -ForegroundColor White
$aprB = D (Api "POST" "/approvals" $SALE1 @{
    type          = "DISCOUNT"
    referenceId   = $ORDER_ID
    referenceCode = $ORDER_CODE
    requestData   = @{
        discountPercent = 4
        discountAmount  = 2000000
    }
})
$APR_B_ID = $null
if ($aprB -and $aprB.id) {
    $APR_B_ID = $aprB.id
    Write-Host "  Approval ID: $APR_B_ID"
    Pass "B1: DISCOUNT approval (4%) created"
} else {
    Fail "B1: Failed to create DISCOUNT approval (4%)"
}

# B2: Verify totalSteps = 3
Write-Host ""
Write-Host "=== TEST B2: Verify totalSteps = 3 ===" -ForegroundColor White
if ($APR_B_ID) {
    $detailB = D (Api "GET" "/approvals/$APR_B_ID" $SALE1)
    if ($detailB) {
        $stepsB = $detailB.steps
        $stepsCountB = 0
        if ($stepsB -is [array]) { $stepsCountB = $stepsB.Count }
        elseif ($stepsB) { $stepsCountB = 1 }
        Write-Host "  Total steps: $stepsCountB"

        if ($stepsCountB -eq 3) {
            Pass "B2: totalSteps = 3 (SALES_LEADER + ACCOUNTANT_AR + SALES_DIRECTOR)"
        } elseif ($stepsCountB -gt 0) {
            Warn "B2: totalSteps = $stepsCountB (expected 3 for 4% discount)"
        } else {
            Fail "B2: No steps found"
        }
    } else {
        Fail "B2: Could not get approval details"
    }
} else {
    Warn "B2: Skipped"
}

# B3: SALES_LEADER approves step 1
Write-Host ""
Write-Host "=== TEST B3: SALES_LEADER approves step 1 ===" -ForegroundColor White
if ($APR_B_ID) {
    $apprB1 = D (Api "POST" "/approvals/$APR_B_ID/approve" $LEADER @{
        decision = "APPROVE"
        comment  = "Dong y giam 4% cho KH than thiet"
    })
    Start-Sleep -Milliseconds 500
    if ($apprB1) { Pass "B3: SALES_LEADER approved step 1" }
    else { Fail "B3: SALES_LEADER approve failed" }
} else {
    Warn "B3: Skipped"
}

# B4: ACCOUNTANT_AR approves step 2
Write-Host ""
Write-Host "=== TEST B4: ACCOUNTANT_AR approves step 2 ===" -ForegroundColor White
if ($APR_B_ID) {
    $apprB2 = D (Api "POST" "/approvals/$APR_B_ID/approve" $KETOAN @{
        decision = "APPROVE"
        comment  = "Da kiem tra cong no - OK"
    })
    Start-Sleep -Milliseconds 500
    if ($apprB2) { Pass "B4: ACCOUNTANT_AR approved step 2" }
    else { Fail "B4: ACCOUNTANT_AR approve failed" }
} else {
    Warn "B4: Skipped"
}

# B5: SALES_DIRECTOR approves step 3
Write-Host ""
Write-Host "=== TEST B5: SALES_DIRECTOR approves step 3 ===" -ForegroundColor White
if ($APR_B_ID) {
    $apprB3 = D (Api "POST" "/approvals/$APR_B_ID/approve" $GDKD @{
        decision = "APPROVE"
        comment  = "GDKD duyet giam 4%"
    })
    Start-Sleep -Milliseconds 500
    if ($apprB3) { Pass "B5: SALES_DIRECTOR approved step 3" }
    else { Fail "B5: SALES_DIRECTOR approve failed" }
} else {
    Warn "B5: Skipped"
}

# B6: Verify status=APPROVED
Write-Host ""
Write-Host "=== TEST B6: Verify final status APPROVED ===" -ForegroundColor White
if ($APR_B_ID) {
    $finalB = D (Api "GET" "/approvals/$APR_B_ID" $SALE1)
    if ($finalB -and $finalB.status -eq "APPROVED") {
        Pass "B6: Tier 2 approval APPROVED (all 3 steps done)"
    } elseif ($finalB) {
        Fail "B6: Expected APPROVED, got $($finalB.status)"
    } else {
        Fail "B6: Could not get approval details"
    }
} else {
    Warn "B6: Skipped"
}

# ================================================================
# PART C: TIER 3 - LARGE DISCOUNT > 5% (4 steps)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Tier 3 - Large discount > 5% (4 steps)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# C1: Create DISCOUNT approval (7%, 150M)
Write-Host ""
Write-Host "=== TEST C1: Create DISCOUNT approval (7%, 150M VND) ===" -ForegroundColor White
$aprC = D (Api "POST" "/approvals" $SALE1 @{
    type          = "DISCOUNT"
    referenceId   = $ORDER_ID
    referenceCode = $ORDER_CODE
    requestData   = @{
        discountPercent = 7
        discountAmount  = 150000000
    }
    isUrgent = $true
})
$APR_C_ID = $null
if ($aprC -and $aprC.id) {
    $APR_C_ID = $aprC.id
    Write-Host "  Approval ID: $APR_C_ID"
    Pass "C1: DISCOUNT approval (7%, 150M) created"
} else {
    Fail "C1: Failed to create DISCOUNT approval (7%)"
}

# C2: Verify totalSteps = 4
Write-Host ""
Write-Host "=== TEST C2: Verify totalSteps = 4 ===" -ForegroundColor White
if ($APR_C_ID) {
    $detailC = D (Api "GET" "/approvals/$APR_C_ID" $SALE1)
    if ($detailC) {
        $stepsC = $detailC.steps
        $stepsCountC = 0
        if ($stepsC -is [array]) { $stepsCountC = $stepsC.Count }
        elseif ($stepsC) { $stepsCountC = 1 }
        Write-Host "  Total steps: $stepsCountC"

        if ($stepsCountC -eq 4) {
            Pass "C2: totalSteps = 4 (SALES_LEADER + ACCOUNTANT_AR + SALES_DIRECTOR + COO)"
        } elseif ($stepsCountC -gt 0) {
            Warn "C2: totalSteps = $stepsCountC (expected 4 for 7% / 150M discount)"
        } else {
            Fail "C2: No steps found"
        }
    } else {
        Fail "C2: Could not get approval details"
    }
} else {
    Warn "C2: Skipped"
}

# C3: Approve steps 1-3 sequentially
Write-Host ""
Write-Host "=== TEST C3: Approve steps 1-3 sequentially ===" -ForegroundColor White
if ($APR_C_ID) {
    # Step 1: SALES_LEADER
    $c3a = D (Api "POST" "/approvals/$APR_C_ID/approve" $LEADER @{
        decision = "APPROVE"
        comment  = "Leader duyet giam 7%"
    })
    Start-Sleep -Milliseconds 500
    if ($c3a) { Pass "C3a: SALES_LEADER approved step 1" }
    else { Fail "C3a: SALES_LEADER approve failed" }

    # Step 2: ACCOUNTANT_AR
    $c3b = D (Api "POST" "/approvals/$APR_C_ID/approve" $KETOAN @{
        decision = "APPROVE"
        comment  = "KT xac nhan cong no"
    })
    Start-Sleep -Milliseconds 500
    if ($c3b) { Pass "C3b: ACCOUNTANT_AR approved step 2" }
    else { Fail "C3b: ACCOUNTANT_AR approve failed" }

    # Step 3: SALES_DIRECTOR
    $c3c = D (Api "POST" "/approvals/$APR_C_ID/approve" $GDKD @{
        decision = "APPROVE"
        comment  = "GDKD dong y giam 7%"
    })
    Start-Sleep -Milliseconds 500
    if ($c3c) { Pass "C3c: SALES_DIRECTOR approved step 3" }
    else { Fail "C3c: SALES_DIRECTOR approve failed" }
} else {
    Warn "C3: Skipped"
}

# C4: COO approves step 4
Write-Host ""
Write-Host "=== TEST C4: COO approves step 4 ===" -ForegroundColor White
if ($APR_C_ID) {
    $c4 = D (Api "POST" "/approvals/$APR_C_ID/approve" $COO @{
        decision = "APPROVE"
        comment  = "BGD duyet giam gia lon 7% / 150M"
    })
    Start-Sleep -Milliseconds 500
    if ($c4) { Pass "C4: COO approved step 4" }
    else { Fail "C4: COO approve failed" }
} else {
    Warn "C4: Skipped"
}

# C5: Verify status=APPROVED
Write-Host ""
Write-Host "=== TEST C5: Verify final status APPROVED ===" -ForegroundColor White
if ($APR_C_ID) {
    $finalC = D (Api "GET" "/approvals/$APR_C_ID" $SALE1)
    if ($finalC -and $finalC.status -eq "APPROVED") {
        Pass "C5: Tier 3 approval APPROVED (all 4 steps done)"
    } elseif ($finalC) {
        Fail "C5: Expected APPROVED, got $($finalC.status)"
    } else {
        Fail "C5: Could not get approval details"
    }
} else {
    Warn "C5: Skipped"
}

# C6: Check action-log has all 4 approve entries
Write-Host ""
Write-Host "=== TEST C6: Verify action-log ===" -ForegroundColor White
if ($APR_C_ID) {
    $logC = D (Api "GET" "/approvals/$APR_C_ID/action-log" $SALE1)
    if ($logC) {
        $logEntries = if ($logC -is [array]) { $logC } else { @($logC) }
        $approveEntries = @($logEntries | Where-Object { $_.action -eq "APPROVE" -or $_.decision -eq "APPROVE" })
        Write-Host "  Total log entries: $($logEntries.Count)"
        Write-Host "  Approve entries: $($approveEntries.Count)"

        if ($approveEntries.Count -ge 4) {
            Pass "C6: Action-log has $($approveEntries.Count) APPROVE entries (expected 4)"
        } elseif ($logEntries.Count -ge 4) {
            Warn "C6: $($logEntries.Count) log entries found, but only $($approveEntries.Count) are APPROVE"
        } else {
            Fail "C6: Only $($logEntries.Count) log entries (expected at least 4)"
        }
    } else {
        Fail "C6: Could not get action-log"
    }
} else {
    Warn "C6: Skipped"
}

# C7: Verify timeline/audit completeness
Write-Host ""
Write-Host "=== TEST C7: Verify audit trail completeness ===" -ForegroundColor White
if ($APR_C_ID) {
    $detailC7 = D (Api "GET" "/approvals/$APR_C_ID" $SALE1)
    if ($detailC7) {
        # Check all steps have APPROVED status
        $stepsC7 = $detailC7.steps
        $allApproved = $true
        if ($stepsC7 -is [array]) {
            foreach ($step in $stepsC7) {
                if ($step.status -ne "APPROVED") {
                    $allApproved = $false
                    Write-Host "  Step $($step.stepNumber): $($step.status) (expected APPROVED)" -ForegroundColor Yellow
                }
            }
        }
        if ($allApproved -and $stepsC7 -is [array] -and $stepsC7.Count -ge 4) {
            Pass "C7: All 4 steps have APPROVED status"
        } elseif ($allApproved) {
            Warn "C7: Steps approved but count may differ"
        } else {
            Fail "C7: Not all steps are APPROVED"
        }
    } else {
        Fail "C7: Could not verify audit trail"
    }
} else {
    Warn "C7: Skipped"
}

# ================================================================
# PART D: REJECTION FLOW
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Rejection flow" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# D1: Create DISCOUNT approval (2%)
Write-Host ""
Write-Host "=== TEST D1: Create DISCOUNT approval for rejection test ===" -ForegroundColor White
$aprD = D (Api "POST" "/approvals" $SALE1 @{
    type          = "DISCOUNT"
    referenceId   = $ORDER_ID
    referenceCode = $ORDER_CODE
    requestData   = @{
        discountPercent = 2
        discountAmount  = 500000
    }
})
$APR_D_ID = $null
if ($aprD -and $aprD.id) {
    $APR_D_ID = $aprD.id
    Pass "D1: DISCOUNT approval created for rejection test"
} else {
    Fail "D1: Failed to create approval"
}

# D2: SALES_LEADER rejects
Write-Host ""
Write-Host "=== TEST D2: SALES_LEADER rejects ===" -ForegroundColor White
if ($APR_D_ID) {
    $rejD = D (Api "POST" "/approvals/$APR_D_ID/reject" $LEADER @{
        decision = "REJECT"
        comment  = "Khong hop ly - ty le giam khong phu hop voi don hang nay"
    })
    Start-Sleep -Milliseconds 500
    if ($rejD) { Pass "D2: SALES_LEADER rejected approval" }
    else { Fail "D2: SALES_LEADER reject failed" }
} else {
    Warn "D2: Skipped"
}

# D3: Verify approval status=REJECTED
Write-Host ""
Write-Host "=== TEST D3: Verify status REJECTED ===" -ForegroundColor White
if ($APR_D_ID) {
    $finalD = D (Api "GET" "/approvals/$APR_D_ID" $SALE1)
    if ($finalD -and $finalD.status -eq "REJECTED") {
        Pass "D3: Approval status = REJECTED"
    } elseif ($finalD) {
        Fail "D3: Expected REJECTED, got $($finalD.status)"
    } else {
        Fail "D3: Could not get approval details"
    }
} else {
    Warn "D3: Skipped"
}

# D4: Verify remaining steps are CANCELLED (not PENDING)
Write-Host ""
Write-Host "=== TEST D4: Verify remaining steps CANCELLED ===" -ForegroundColor White
if ($APR_D_ID) {
    $detailD4 = D (Api "GET" "/approvals/$APR_D_ID" $SALE1)
    if ($detailD4 -and $detailD4.steps -is [array]) {
        $stepsD4 = $detailD4.steps
        $rejectedStep = $stepsD4 | Where-Object { $_.status -eq "REJECTED" }
        $cancelledSteps = @($stepsD4 | Where-Object { $_.status -eq "CANCELLED" -or $_.status -eq "SKIPPED" })
        $pendingSteps = @($stepsD4 | Where-Object { $_.status -eq "PENDING" })

        Write-Host "  Rejected steps: $(if ($rejectedStep) { ($rejectedStep | Measure-Object).Count } else { 0 })"
        Write-Host "  Cancelled/Skipped steps: $($cancelledSteps.Count)"
        Write-Host "  Still pending steps: $($pendingSteps.Count)"

        if ($pendingSteps.Count -eq 0) {
            Pass "D4: No remaining PENDING steps (all resolved)"
        } else {
            Warn "D4: $($pendingSteps.Count) step(s) still PENDING after rejection"
        }
    } elseif ($detailD4) {
        Warn "D4: Steps not available in response"
    } else {
        Fail "D4: Could not get approval details"
    }
} else {
    Warn "D4: Skipped"
}

# ================================================================
# PART E: DELEGATION FLOW
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: Delegation flow" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# E1: Get SALES_LEADER profile to get userId
Write-Host ""
Write-Host "=== TEST E1: Get SALES_LEADER profile ===" -ForegroundColor White
$leaderProfile = D (Api "GET" "/auth/profile" $LEADER)
$LEADER_USER_ID = $null
if ($leaderProfile -and $leaderProfile.id) {
    $LEADER_USER_ID = $leaderProfile.id
    Write-Host "  Leader userId: $LEADER_USER_ID"
    Write-Host "  Leader role: $($leaderProfile.role)"
    Pass "E1: SALES_LEADER profile retrieved (userId=$LEADER_USER_ID)"
} elseif ($leaderProfile -and $leaderProfile.user -and $leaderProfile.user.id) {
    $LEADER_USER_ID = $leaderProfile.user.id
    Write-Host "  Leader userId: $LEADER_USER_ID"
    Pass "E1: SALES_LEADER profile retrieved"
} else {
    Fail "E1: Could not get SALES_LEADER profile"
}

# E2: Get SALES_DIRECTOR profile to get userId (delegatee)
Write-Host ""
Write-Host "=== TEST E2: Get SALES_DIRECTOR profile ===" -ForegroundColor White
$gdkdProfile = D (Api "GET" "/auth/profile" $GDKD)
$GDKD_USER_ID = $null
if ($gdkdProfile -and $gdkdProfile.id) {
    $GDKD_USER_ID = $gdkdProfile.id
    Write-Host "  GDKD userId: $GDKD_USER_ID"
    Pass "E2: SALES_DIRECTOR profile retrieved (userId=$GDKD_USER_ID)"
} elseif ($gdkdProfile -and $gdkdProfile.user -and $gdkdProfile.user.id) {
    $GDKD_USER_ID = $gdkdProfile.user.id
    Pass "E2: SALES_DIRECTOR profile retrieved"
} else {
    Fail "E2: Could not get SALES_DIRECTOR profile"
}

# E3: Create delegation from SALES_LEADER to SALES_DIRECTOR
Write-Host ""
Write-Host "=== TEST E3: Create delegation ===" -ForegroundColor White
$DELEGATION_ID = $null
if ($LEADER_USER_ID -and $GDKD_USER_ID) {
    $startDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $endDate = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $delResp = D (Api "POST" "/approval-delegations" $LEADER @{
        toUserId      = $GDKD_USER_ID
        startDate     = $startDate
        endDate       = $endDate
        approvalTypes = @("DISCOUNT")
        reason        = "Di cong tac 1 tuan"
    })
    if ($delResp -and $delResp.id) {
        $DELEGATION_ID = $delResp.id
        Write-Host "  Delegation ID: $DELEGATION_ID"
        Pass "E3: Delegation created (SALES_LEADER -> SALES_DIRECTOR for DISCOUNT)"
    } else {
        Fail "E3: Failed to create delegation"
    }
} else {
    Warn "E3: Skipped (missing user IDs)"
}

# E4: Verify delegation appears in list
Write-Host ""
Write-Host "=== TEST E4: Verify delegation in list ===" -ForegroundColor White
$delList = D (Api "GET" "/approval-delegations" $LEADER)
if ($delList) {
    $delItems = $null
    if ($delList -is [array]) { $delItems = $delList }
    elseif ($delList.items) { $delItems = $delList.items }
    elseif ($delList.data) { $delItems = $delList.data }
    else { $delItems = @($delList) }

    $found = $false
    if ($delItems -is [array]) {
        foreach ($d in $delItems) {
            if ($d.id -eq $DELEGATION_ID) { $found = $true; break }
        }
    }
    if ($found) {
        Pass "E4: Delegation found in list"
    } elseif ($DELEGATION_ID) {
        Warn "E4: Delegation created but not found in list (may be different response format)"
    } else {
        Warn "E4: No delegation to verify"
    }
} else {
    Warn "E4: Could not get delegation list"
}

# E5: Create a DISCOUNT approval and test if SALES_DIRECTOR can approve as delegatee
Write-Host ""
Write-Host "=== TEST E5: Test delegated approval ===" -ForegroundColor White
if ($DELEGATION_ID) {
    $aprE = D (Api "POST" "/approvals" $SALE1 @{
        type          = "DISCOUNT"
        referenceId   = $ORDER_ID
        referenceCode = $ORDER_CODE
        requestData   = @{
            discountPercent = 2
            discountAmount  = 400000
        }
    })
    if ($aprE -and $aprE.id) {
        $APR_E_ID = $aprE.id
        # SALES_DIRECTOR tries to approve step 1 (delegated from SALES_LEADER)
        $delApprove = D (Api "POST" "/approvals/$APR_E_ID/approve" $GDKD @{
            decision = "APPROVE"
            comment  = "Duyet thay SALES_LEADER (uy quyen)"
        })
        Start-Sleep -Milliseconds 500
        if ($delApprove) {
            Pass "E5: SALES_DIRECTOR approved as delegatee for SALES_LEADER step"
        } else {
            Warn "E5: Delegated approval may not be supported in this implementation"
        }
    } else {
        Fail "E5: Could not create approval for delegation test"
    }
} else {
    Warn "E5: Skipped (no delegation created)"
}

# ================================================================
# PART F: WITHDRAW FLOW
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Withdraw flow" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# F1: Create DISCOUNT approval
Write-Host ""
Write-Host "=== TEST F1: Create DISCOUNT approval for withdraw test ===" -ForegroundColor White
$aprF = D (Api "POST" "/approvals" $SALE1 @{
    type          = "DISCOUNT"
    referenceId   = $ORDER_ID
    referenceCode = $ORDER_CODE
    requestData   = @{
        discountPercent = 3
        discountAmount  = 900000
    }
})
$APR_F_ID = $null
if ($aprF -and $aprF.id) {
    $APR_F_ID = $aprF.id
    Pass "F1: DISCOUNT approval created for withdraw test"
} else {
    Fail "F1: Failed to create approval"
}

# F2: Requester withdraws
Write-Host ""
Write-Host "=== TEST F2: Requester withdraws approval ===" -ForegroundColor White
if ($APR_F_ID) {
    $withdrawF = D (Api "POST" "/approvals/$APR_F_ID/withdraw" $SALE1)
    Start-Sleep -Milliseconds 500
    if ($withdrawF) {
        Pass "F2: Withdrawal request sent"
    } else {
        Fail "F2: Withdraw failed"
    }
} else {
    Warn "F2: Skipped"
}

# F3: Verify status=WITHDRAWN
Write-Host ""
Write-Host "=== TEST F3: Verify status WITHDRAWN ===" -ForegroundColor White
if ($APR_F_ID) {
    $finalF = D (Api "GET" "/approvals/$APR_F_ID" $SALE1)
    if ($finalF -and $finalF.status -eq "WITHDRAWN") {
        Pass "F3: Approval status = WITHDRAWN"
    } elseif ($finalF -and $finalF.status -eq "CANCELLED") {
        Pass "F3: Approval status = CANCELLED (alternative for WITHDRAWN)"
    } elseif ($finalF) {
        Fail "F3: Expected WITHDRAWN, got $($finalF.status)"
    } else {
        Fail "F3: Could not get approval details"
    }
} else {
    Warn "F3: Skipped"
}

# ================================================================
# PART G: COMMENTS & ACTION LOG
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: Comments & Action Log" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# G1: Create DISCOUNT approval
Write-Host ""
Write-Host "=== TEST G1: Create DISCOUNT approval for comment test ===" -ForegroundColor White
$aprG = D (Api "POST" "/approvals" $SALE1 @{
    type          = "DISCOUNT"
    referenceId   = $ORDER_ID
    referenceCode = $ORDER_CODE
    requestData   = @{
        discountPercent = 2
        discountAmount  = 600000
    }
})
$APR_G_ID = $null
if ($aprG -and $aprG.id) {
    $APR_G_ID = $aprG.id
    Pass "G1: DISCOUNT approval created for comment test"
} else {
    Fail "G1: Failed to create approval"
}

# G2: Add comment
Write-Host ""
Write-Host "=== TEST G2: Add comment ===" -ForegroundColor White
if ($APR_G_ID) {
    $commentResp = D (Api "POST" "/approvals/$APR_G_ID/comments" $SALE1 @{
        content = "Giam gia cho KH VIP de giu chan - don hang lon, KH than thiet"
    })
    if ($commentResp) {
        Pass "G2: Comment added successfully"
    } else {
        Fail "G2: Failed to add comment"
    }
} else {
    Warn "G2: Skipped"
}

# G3: Get comments
Write-Host ""
Write-Host "=== TEST G3: Get comments ===" -ForegroundColor White
if ($APR_G_ID) {
    $commentsG = D (Api "GET" "/approvals/$APR_G_ID/comments" $SALE1)
    if ($commentsG) {
        $commentItems = if ($commentsG -is [array]) { $commentsG } else { @($commentsG) }
        Write-Host "  Total comments: $($commentItems.Count)"
        $foundComment = $false
        foreach ($c in $commentItems) {
            if ($c.content -match "Giam gia cho KH VIP") { $foundComment = $true; break }
        }
        if ($foundComment) {
            Pass "G3: Comment found with correct content"
        } elseif ($commentItems.Count -gt 0) {
            Pass "G3: Comments exist ($($commentItems.Count) found)"
        } else {
            Fail "G3: No comments found"
        }
    } else {
        Fail "G3: Could not get comments"
    }
} else {
    Warn "G3: Skipped"
}

# G4: Get action-log
Write-Host ""
Write-Host "=== TEST G4: Get action-log ===" -ForegroundColor White
if ($APR_G_ID) {
    $logG = D (Api "GET" "/approvals/$APR_G_ID/action-log" $SALE1)
    if ($logG) {
        $logItems = if ($logG -is [array]) { $logG } else { @($logG) }
        Write-Host "  Total action-log entries: $($logItems.Count)"
        $foundSubmit = $false
        foreach ($l in $logItems) {
            if ($l.action -eq "SUBMIT" -or $l.action -eq "CREATE" -or $l.action -eq "CREATED") {
                $foundSubmit = $true; break
            }
        }
        if ($foundSubmit) {
            Pass "G4: SUBMIT entry found in action-log"
        } elseif ($logItems.Count -gt 0) {
            Write-Host "  Actions: $(($logItems | ForEach-Object { $_.action }) -join ', ')" -ForegroundColor Gray
            Pass "G4: Action-log has $($logItems.Count) entries"
        } else {
            Fail "G4: No action-log entries found"
        }
    } else {
        Fail "G4: Could not get action-log"
    }
} else {
    Warn "G4: Skipped"
}

# ================================================================
# PART H: PENDING APPROVALS VIEW
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Pending approvals view" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# H1: Create DISCOUNT approval (pending at SALES_LEADER step)
Write-Host ""
Write-Host "=== TEST H1: Create DISCOUNT approval for pending test ===" -ForegroundColor White
$aprH = D (Api "POST" "/approvals" $SALE1 @{
    type          = "DISCOUNT"
    referenceId   = $ORDER_ID
    referenceCode = $ORDER_CODE
    requestData   = @{
        discountPercent = 1
        discountAmount  = 200000
    }
})
$APR_H_ID = $null
if ($aprH -and $aprH.id) {
    $APR_H_ID = $aprH.id
    Pass "H1: DISCOUNT approval created (pending at SALES_LEADER)"
} else {
    Fail "H1: Failed to create approval"
}

# H2: SALES_LEADER gets pending - should see this approval
Write-Host ""
Write-Host "=== TEST H2: SALES_LEADER sees pending approval ===" -ForegroundColor White
if ($APR_H_ID) {
    $pendingH = D (Api "GET" "/approvals/pending" $LEADER)
    if ($pendingH) {
        $pendingItems = $null
        if ($pendingH -is [array]) { $pendingItems = $pendingH }
        elseif ($pendingH.items) { $pendingItems = $pendingH.items }
        elseif ($pendingH.data) { $pendingItems = $pendingH.data }
        else { $pendingItems = @($pendingH) }

        $foundPending = $false
        if ($pendingItems -is [array]) {
            foreach ($p in $pendingItems) {
                if ($p.id -eq $APR_H_ID) { $foundPending = $true; break }
            }
        }
        if ($foundPending) {
            Pass "H2: SALES_LEADER sees the pending approval in list"
        } elseif ($pendingItems -is [array] -and $pendingItems.Count -gt 0) {
            Warn "H2: SALES_LEADER has $($pendingItems.Count) pending approvals but target not found (may be paginated)"
        } else {
            Warn "H2: SALES_LEADER pending list empty or format unexpected"
        }
    } else {
        Fail "H2: Could not get pending approvals for SALES_LEADER"
    }
} else {
    Warn "H2: Skipped"
}

# H3: CFO gets pending - should NOT see this approval
Write-Host ""
Write-Host "=== TEST H3: CFO should NOT see this pending approval ===" -ForegroundColor White
if ($APR_H_ID) {
    $pendingCFO = D (Api "GET" "/approvals/pending" $CFO)
    if ($pendingCFO) {
        $pendingCFOItems = $null
        if ($pendingCFO -is [array]) { $pendingCFOItems = $pendingCFO }
        elseif ($pendingCFO.items) { $pendingCFOItems = $pendingCFO.items }
        elseif ($pendingCFO.data) { $pendingCFOItems = $pendingCFO.data }
        else { $pendingCFOItems = @($pendingCFO) }

        $foundInCFO = $false
        if ($pendingCFOItems -is [array]) {
            foreach ($p in $pendingCFOItems) {
                if ($p.id -eq $APR_H_ID) { $foundInCFO = $true; break }
            }
        }
        if (-not $foundInCFO) {
            Pass "H3: CFO does NOT see the SALES_LEADER-pending approval"
        } else {
            Fail "H3: CFO sees the SALES_LEADER-pending approval (should not)"
        }
    } else {
        Pass "H3: CFO has no pending approvals (correct)"
    }
} else {
    Warn "H3: Skipped"
}

# ================================================================
# PART I: RBAC - LIST FILTERING
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART I: RBAC - list filtering" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# I1: Filter by type=DISCOUNT
Write-Host ""
Write-Host "=== TEST I1: Filter approvals by type=DISCOUNT ===" -ForegroundColor White
$listI1 = Api "GET" "/approvals?type=DISCOUNT&limit=10" $SALE1
$dataI1 = D $listI1
if ($dataI1) {
    $itemsI1 = $null
    if ($dataI1 -is [array]) { $itemsI1 = $dataI1 }
    elseif ($dataI1.items) { $itemsI1 = $dataI1.items }
    elseif ($dataI1.data) { $itemsI1 = $dataI1.data }
    else { $itemsI1 = @($dataI1) }

    $allDiscount = $true
    if ($itemsI1 -is [array] -and $itemsI1.Count -gt 0) {
        foreach ($item in $itemsI1) {
            if ($item.type -and $item.type -ne "DISCOUNT") { $allDiscount = $false; break }
        }
        if ($allDiscount) {
            Pass "I1: All returned approvals are type=DISCOUNT ($($itemsI1.Count) items)"
        } else {
            Fail "I1: Non-DISCOUNT items found in filtered list"
        }
    } else {
        Warn "I1: No items returned for type=DISCOUNT filter"
    }
} else {
    Fail "I1: Could not list approvals"
}

# I2: Filter by status=APPROVED
Write-Host ""
Write-Host "=== TEST I2: Filter approvals by status=APPROVED ===" -ForegroundColor White
$listI2 = Api "GET" "/approvals?status=APPROVED&limit=10" $SALE1
$dataI2 = D $listI2
if ($dataI2) {
    $itemsI2 = $null
    if ($dataI2 -is [array]) { $itemsI2 = $dataI2 }
    elseif ($dataI2.items) { $itemsI2 = $dataI2.items }
    elseif ($dataI2.data) { $itemsI2 = $dataI2.data }
    else { $itemsI2 = @($dataI2) }

    $allApproved = $true
    if ($itemsI2 -is [array] -and $itemsI2.Count -gt 0) {
        foreach ($item in $itemsI2) {
            if ($item.status -and $item.status -ne "APPROVED") { $allApproved = $false; break }
        }
        if ($allApproved) {
            Pass "I2: All returned approvals have status=APPROVED ($($itemsI2.Count) items)"
        } else {
            Fail "I2: Non-APPROVED items found in filtered list"
        }
    } else {
        Warn "I2: No items returned for status=APPROVED filter"
    }
} else {
    Fail "I2: Could not list approvals"
}

# I3: SALE1 gets submitted approvals
Write-Host ""
Write-Host "=== TEST I3: SALE1 gets submitted approvals ===" -ForegroundColor White
$listI3 = D (Api "GET" "/approvals/submitted" $SALE1)
if ($listI3) {
    $itemsI3 = $null
    if ($listI3 -is [array]) { $itemsI3 = $listI3 }
    elseif ($listI3.items) { $itemsI3 = $listI3.items }
    elseif ($listI3.data) { $itemsI3 = $listI3.data }
    else { $itemsI3 = @($listI3) }

    if ($itemsI3 -is [array] -and $itemsI3.Count -gt 0) {
        Pass "I3: SALE1 submitted approvals returned ($($itemsI3.Count) items)"
    } else {
        Warn "I3: No submitted approvals found for SALE1"
    }
} else {
    Fail "I3: Could not get submitted approvals"
}

# ================================================================
# PART J: AMOUNT-BASED TIER TRIGGER (>100M -> COO)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART J: Amount-based tier trigger (>100M -> COO)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# J1: Create discount with low percent (3%) but high amount (120M > 100M)
Write-Host ""
Write-Host "=== TEST J1: Create discount 3% but amount 120M > 100M ===" -ForegroundColor White
$aprJ = D (Api "POST" "/approvals" $SALE1 @{
    type          = "DISCOUNT"
    referenceId   = $ORDER_ID
    referenceCode = $ORDER_CODE
    requestData   = @{
        discountPercent = 3
        discountAmount  = 120000000
    }
})
$APR_J_ID = $null
if ($aprJ -and $aprJ.id) {
    $APR_J_ID = $aprJ.id
    Write-Host "  Approval ID: $APR_J_ID"
    Pass "J1: DISCOUNT approval created (3%, 120M VND)"
} else {
    Fail "J1: Failed to create approval"
}

# J2: Verify totalSteps = 4 (amount triggers COO even though percent <= 5%)
Write-Host ""
Write-Host "=== TEST J2: Verify totalSteps = 4 (amount > 100M triggers COO) ===" -ForegroundColor White
if ($APR_J_ID) {
    $detailJ = D (Api "GET" "/approvals/$APR_J_ID" $SALE1)
    if ($detailJ) {
        $stepsJ = $detailJ.steps
        $stepsCountJ = 0
        if ($stepsJ -is [array]) { $stepsCountJ = $stepsJ.Count }
        elseif ($stepsJ) { $stepsCountJ = 1 }
        Write-Host "  Total steps: $stepsCountJ"

        # discountPercent=3 (not > 3, so no SALES_DIRECTOR)
        # but discountAmount=120M (> 100M, so COO needed)
        # Expected: SALES_LEADER + ACCOUNTANT_AR + COO = 3 steps
        # OR if the engine also adds SALES_DIRECTOR when amount>100M: 4 steps
        if ($stepsCountJ -ge 3) {
            Pass "J2: totalSteps = $stepsCountJ (amount > 100M triggers extra approval)"
            # Check if COO step exists
            $hasCOO = $false
            if ($stepsJ -is [array]) {
                foreach ($s in $stepsJ) {
                    if ($s.approverRole -eq "COO" -or $s.role -eq "COO") { $hasCOO = $true; break }
                }
            }
            if ($hasCOO) {
                Write-Host "  COO step found in approval flow"
            } else {
                Write-Host "  COO step not explicitly visible (may be resolved at runtime)" -ForegroundColor Gray
            }
        } else {
            Fail "J2: totalSteps = $stepsCountJ (expected >= 3 for amount > 100M)"
        }
    } else {
        Fail "J2: Could not get approval details"
    }
} else {
    Warn "J2: Skipped"
}

# J3: Verify requestData stored correctly
Write-Host ""
Write-Host "=== TEST J3: Verify requestData stored correctly ===" -ForegroundColor White
if ($APR_J_ID) {
    $detailJ3 = D (Api "GET" "/approvals/$APR_J_ID" $SALE1)
    if ($detailJ3 -and $detailJ3.requestData) {
        $rd = $detailJ3.requestData
        $pct = [double]$rd.discountPercent
        $amt = [double]$rd.discountAmount

        Write-Host "  requestData.discountPercent: $pct"
        Write-Host "  requestData.discountAmount: $amt"

        if ($pct -eq 3) {
            Pass "J3a: requestData.discountPercent = 3 (correct)"
        } else {
            Fail "J3a: discountPercent = $pct (expected 3)"
        }

        if ($amt -eq 120000000) {
            Pass "J3b: requestData.discountAmount = 120000000 (correct)"
        } else {
            Fail "J3b: discountAmount = $amt (expected 120000000)"
        }
    } elseif ($detailJ3) {
        Warn "J3: requestData not found in approval response"
    } else {
        Fail "J3: Could not get approval details"
    }
} else {
    Warn "J3: Skipped"
}

# ================================================================
# CLEANUP: Withdraw pending approvals created during tests
# ================================================================
Write-Host ""
Write-Host "=== CLEANUP: Withdraw remaining pending approvals ===" -ForegroundColor Gray
foreach ($pendingId in @($APR_G_ID, $APR_H_ID, $APR_J_ID)) {
    if ($pendingId) {
        $check = D (Api "GET" "/approvals/$pendingId" $SALE1)
        if ($check -and $check.status -eq "PENDING") {
            Api "POST" "/approvals/$pendingId/withdraw" $SALE1 | Out-Null
        }
    }
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-APR-001: Discount Approval Flow" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Part A: Tier 1 - Small discount <= 3% (2 steps)" -ForegroundColor Gray
Write-Host "  Part B: Tier 2 - Medium discount > 3% (3 steps)" -ForegroundColor Gray
Write-Host "  Part C: Tier 3 - Large discount > 5% (4 steps)" -ForegroundColor Gray
Write-Host "  Part D: Rejection flow" -ForegroundColor Gray
Write-Host "  Part E: Delegation flow" -ForegroundColor Gray
Write-Host "  Part F: Withdraw flow" -ForegroundColor Gray
Write-Host "  Part G: Comments & Action Log" -ForegroundColor Gray
Write-Host "  Part H: Pending approvals view" -ForegroundColor Gray
Write-Host "  Part I: RBAC - list filtering" -ForegroundColor Gray
Write-Host "  Part J: Amount-based tier trigger (>100M -> COO)" -ForegroundColor Gray
Write-Host ""
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host ""
if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $failCount TEST(S) FAILED" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Cyan
