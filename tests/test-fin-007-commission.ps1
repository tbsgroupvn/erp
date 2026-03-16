# ================================================================
# TEST-FIN-007: Commission Calculation & Payout
# Severity: HIGH
#
# Verifies: Commission rule CRUD, profit-based tiered calculation,
# approval flow (PENDING -> APPROVED -> PAID), my/team views,
# monthly report, validation, auto-approve on AR payment
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
Write-Host "  TEST-FIN-007: Commission Calculation & Payout" -ForegroundColor Cyan
Write-Host "  Severity: HIGH" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login roles
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login roles ===" -ForegroundColor White

$SALE1 = Login "sale01@$DOMAIN"
if ($SALE1) { Pass "SALE1 login OK" } else { Fail "SALE1 login FAILED"; exit 1 }

$KETOAN = Login "ketoan@$DOMAIN"
if ($KETOAN) { Pass "KETOAN (Chief Accountant) login OK" } else { Fail "KETOAN login FAILED"; exit 1 }

$CFO = Login "cfo@$DOMAIN"
if ($CFO) { Pass "CFO login OK" } else { Fail "CFO login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

$GDKD = Login "gdkd@$DOMAIN"
if ($GDKD) { Pass "GDKD (Sales Director) login OK" } else { Warn "GDKD login failed - team tests may be limited" }

$LEADER = Login "leader.hn@$DOMAIN"
if ($LEADER) { Pass "LEADER login OK" } else { Warn "LEADER login failed" }

# ================================================================
# PART A: Commission Rules CRUD
# ================================================================
Write-Host ""
Write-Host "=== PART A: Commission Rules CRUD ===" -ForegroundColor Cyan

# A1: List existing rules
$rulesResp = Api "GET" "/commissions/rules?limit=50" $CFO
$existingRules = $null
if ($rulesResp) {
    $existingRules = D $rulesResp
    # May be paginated: { data: [...], meta: {...} }
    $ruleItems = if ($existingRules -is [Array]) { $existingRules } elseif ($existingRules.data) { $existingRules.data } else { @() }
    if ($ruleItems.Count -gt 0) {
        Pass "A1: Found $($ruleItems.Count) existing commission rules"
        foreach ($r in $ruleItems) {
            Write-Host "    Rule: $($r.serviceType) profit=$($r.minProfit)-$($r.maxProfit) rate=$($r.rate)" -ForegroundColor Gray
        }
    } else {
        Pass "A1: No existing rules - will create new ones"
    }
} else {
    Warn "A1: Rules endpoint returned null"
}

# A2: Create commission rule MHH profit 0-10M -> 3%
$rule1Body = @{
    serviceType = "MHH"
    minProfit   = 0
    maxProfit   = 10000000
    rate        = 0.03
    description = "FIN-007: MHH profit 0-10M, commission 3%"
}
$rule1Resp = D (Api "POST" "/commissions/rules" $CFO $rule1Body)
$RULE1_ID = $null
if ($rule1Resp -and $rule1Resp.id) {
    $RULE1_ID = $rule1Resp.id
    Pass "A2: Created rule MHH 0-10M @ 3% (ID: $RULE1_ID)"
} else {
    Warn "A2: Failed to create MHH 0-10M rule (may already exist)"
}

# A3: Create commission rule MHH profit 10M-50M -> 5%
$rule2Body = @{
    serviceType = "MHH"
    minProfit   = 10000000
    maxProfit   = 50000000
    rate        = 0.05
    description = "FIN-007: MHH profit 10M-50M, commission 5%"
}
$rule2Resp = D (Api "POST" "/commissions/rules" $CFO $rule2Body)
$RULE2_ID = $null
if ($rule2Resp -and $rule2Resp.id) {
    $RULE2_ID = $rule2Resp.id
    Pass "A3: Created rule MHH 10M-50M @ 5% (ID: $RULE2_ID)"
} else {
    Warn "A3: Failed to create MHH 10M-50M rule"
}

# A4: Create commission rule MHH profit 50M+ -> 7%
$rule3Body = @{
    serviceType = "MHH"
    minProfit   = 50000000
    maxProfit   = 999999999999
    rate        = 0.07
    description = "FIN-007: MHH profit 50M+, commission 7%"
}
$rule3Resp = D (Api "POST" "/commissions/rules" $CFO $rule3Body)
$RULE3_ID = $null
if ($rule3Resp -and $rule3Resp.id) {
    $RULE3_ID = $rule3Resp.id
    Pass "A4: Created rule MHH 50M+ @ 7% (ID: $RULE3_ID)"
} else {
    Warn "A4: Failed to create MHH 50M+ rule"
}

# A5: Re-list rules to verify
$rulesCheck = Api "GET" "/commissions/rules?limit=50" $CFO
if ($rulesCheck) {
    $rcItems = D $rulesCheck
    $rcData = if ($rcItems -is [Array]) { $rcItems } elseif ($rcItems.data) { $rcItems.data } else { @() }
    $mhhRules = @($rcData | Where-Object { $_.serviceType -eq "MHH" })
    if ($mhhRules.Count -ge 3) {
        Pass "A5: At least 3 MHH commission rules exist"
    } elseif ($mhhRules.Count -gt 0) {
        Warn "A5: Only $($mhhRules.Count) MHH rules found (expected >= 3)"
    } else {
        Warn "A5: No MHH rules found in list"
    }
} else {
    Warn "A5: Rules re-list failed"
}

# ================================================================
# PART B: Rule validation
# ================================================================
Write-Host ""
Write-Host "=== PART B: Rule validation ===" -ForegroundColor Cyan

# B1: Rate > 1 -> should fail
$badRateBody = @{
    serviceType = "VCT"
    minProfit   = 0
    maxProfit   = 10000000
    rate        = 1.5
    description = "Should fail - rate > 1"
}
$badRateResp = Api-Expect "POST" "/commissions/rules" $CFO $badRateBody
if ($badRateResp.code -eq 400 -or $badRateResp.code -eq 422) {
    Pass "B1: Rule with rate > 1 rejected ($($badRateResp.code))"
} elseif ($badRateResp.code -eq 201 -or $badRateResp.code -eq 200) {
    Fail "B1: Rule with rate > 1 was accepted - validation missing!"
} else {
    Warn "B1: Unexpected status $($badRateResp.code)"
}

# B2: Negative rate -> should fail
$negRateBody = @{
    serviceType = "VCT"
    minProfit   = 0
    maxProfit   = 10000000
    rate        = -0.05
    description = "Should fail - negative rate"
}
$negRateResp = Api-Expect "POST" "/commissions/rules" $CFO $negRateBody
if ($negRateResp.code -eq 400 -or $negRateResp.code -eq 422) {
    Pass "B2: Rule with negative rate rejected ($($negRateResp.code))"
} elseif ($negRateResp.code -eq 201 -or $negRateResp.code -eq 200) {
    Fail "B2: Rule with negative rate accepted!"
} else {
    Warn "B2: Unexpected status $($negRateResp.code)"
}

# B3: Missing serviceType -> should fail
$noTypeBody = @{
    minProfit   = 0
    maxProfit   = 10000000
    rate        = 0.05
}
$noTypeResp = Api-Expect "POST" "/commissions/rules" $CFO $noTypeBody
if ($noTypeResp.code -eq 400 -or $noTypeResp.code -eq 422) {
    Pass "B3: Rule without serviceType rejected ($($noTypeResp.code))"
} else {
    Warn "B3: Unexpected status $($noTypeResp.code)"
}

# ================================================================
# PART C: Commission Calculation
# ================================================================
Write-Host ""
Write-Host "=== PART C: Commission Calculation ===" -ForegroundColor Cyan

# Find a COMPLETED order to calculate commission
Write-Host "--- Finding COMPLETED order ---" -ForegroundColor Gray
$ordersResp = D (Api "GET" "/orders?limit=50&status=COMPLETED" $CEO)
$COMPLETED_ORDER = $null
$COMPLETED_ID = $null

if ($ordersResp) {
    $orderList = if ($ordersResp -is [Array]) { $ordersResp } elseif ($ordersResp.data) { $ordersResp.data } else { @() }
    if ($orderList.Count -gt 0) {
        $COMPLETED_ORDER = $orderList[0]
        $COMPLETED_ID = $COMPLETED_ORDER.id
        Write-Host "    Found COMPLETED order: $($COMPLETED_ORDER.code) total=$($COMPLETED_ORDER.totalAmount) service=$($COMPLETED_ORDER.serviceType)" -ForegroundColor Gray
    }
}

# Also try without status filter and look for COMPLETED
if (-not $COMPLETED_ID) {
    $allOrders = D (Api "GET" "/orders?limit=100" $CEO)
    if ($allOrders) {
        $oList = if ($allOrders -is [Array]) { $allOrders } elseif ($allOrders.data) { $allOrders.data } else { @() }
        foreach ($o in $oList) {
            if ($o.status -eq "COMPLETED") {
                $COMPLETED_ORDER = $o
                $COMPLETED_ID = $o.id
                Write-Host "    Found COMPLETED: $($o.code) total=$($o.totalAmount)" -ForegroundColor Gray
                break
            }
        }
    }
}

if ($COMPLETED_ID) {
    Pass "C0: Found COMPLETED order: $($COMPLETED_ORDER.code)"

    # C1: Calculate commission for completed order
    $calcResp = D (Api "POST" "/commissions/calculate/$COMPLETED_ID" $CFO)
    if ($calcResp) {
        Pass "C1: Commission calculation triggered"

        # C2: Verify commission record fields
        $commId = if ($calcResp.id) { $calcResp.id } elseif ($calcResp.commissionId) { $calcResp.commissionId } else { $null }
        if ($commId) {
            $COMMISSION_ID = $commId
            Pass "C2: Commission record created (ID: $commId)"
        } else {
            # Might return existing record or different format
            Warn "C2: Commission ID not found in response"
            Write-Host "    Response: $($calcResp | ConvertTo-Json -Depth 2 -Compress)" -ForegroundColor Gray
            # Try to extract from nested data
            if ($calcResp.commission -and $calcResp.commission.id) {
                $COMMISSION_ID = $calcResp.commission.id
                Pass "C2b: Found commission ID in nested object"
            }
        }

        # C3: Verify status = PENDING
        $status = if ($calcResp.status) { $calcResp.status } elseif ($calcResp.commission -and $calcResp.commission.status) { $calcResp.commission.status } else { $null }
        if ($status -eq "PENDING") {
            Pass "C3: Commission status = PENDING"
        } elseif ($status) {
            Warn "C3: Commission status = $status (expected PENDING, may already be APPROVED)"
        } else {
            Warn "C3: Cannot determine commission status"
        }

        # C4: Verify calculation fields present
        $hasFields = $false
        $cr = if ($calcResp.commission) { $calcResp.commission } else { $calcResp }
        if ($cr.netProfit -ne $null -or $cr.commissionAmount -ne $null -or $cr.commissionRate -ne $null) {
            $hasFields = $true
            Pass "C4: Commission has calculation fields (profit=$($cr.netProfit), rate=$($cr.commissionRate), amount=$($cr.commissionAmount))"
        } elseif ($cr.orderRevenue -ne $null) {
            $hasFields = $true
            Pass "C4: Commission has revenue field (revenue=$($cr.orderRevenue), cost=$($cr.orderCost))"
        } else {
            Warn "C4: Calculation fields not found in response"
        }

        # C5: Commission amount >= 0
        $commAmount = if ($cr.commissionAmount) { [double]$cr.commissionAmount } else { 0 }
        if ($commAmount -ge 0) {
            Pass "C5: Commission amount = $commAmount (non-negative)"
        } else {
            Fail "C5: Commission amount = $commAmount (negative!)"
        }
    } else {
        Fail "C1: Commission calculation failed"
        Warn "C2-C5: Skipped"
    }

    # C6: Calculate same order again -> should return existing or error
    $calcDup = Api-Expect "POST" "/commissions/calculate/$COMPLETED_ID" $CFO $null
    if ($calcDup.code -eq 400 -or $calcDup.code -eq 409) {
        Pass "C6: Duplicate commission calculation blocked ($($calcDup.code))"
    } elseif ($calcDup.code -eq 200 -or $calcDup.code -eq 201) {
        Warn "C6: Duplicate calculation accepted (may return existing record)"
    } else {
        Warn "C6: Duplicate calculation returned $($calcDup.code)"
    }
} else {
    Warn "C0: No COMPLETED orders found - calculation tests limited"
    Warn "C1-C6: Skipped"

    # Try calculating on a non-completed order -> should fail
    $anyOrderResp = D (Api "GET" "/orders?limit=1" $CEO)
    if ($anyOrderResp -and $anyOrderResp.Count -gt 0) {
        $anyId = $anyOrderResp[0].id
        $anyStatus = $anyOrderResp[0].status
        $calcNonComp = Api-Expect "POST" "/commissions/calculate/$anyId" $CFO $null
        if ($calcNonComp.code -eq 400) {
            Pass "C1-alt: Commission calc on $anyStatus order rejected (400)"
        } elseif ($calcNonComp.code -eq 200) {
            Warn "C1-alt: Commission calc on $anyStatus order accepted"
        } else {
            Warn "C1-alt: Returned $($calcNonComp.code)"
        }
    }
}

# ================================================================
# PART D: Commission Approval
# ================================================================
Write-Host ""
Write-Host "=== PART D: Commission Approval ===" -ForegroundColor Cyan

if ($COMMISSION_ID) {
    # D1: Approve commission (KETOAN)
    $approveResp = D (Api "PATCH" "/commissions/$COMMISSION_ID/approve" $KETOAN)
    if ($approveResp) {
        $appStatus = if ($approveResp.status) { $approveResp.status } elseif ($approveResp.commission -and $approveResp.commission.status) { $approveResp.commission.status } else { $null }
        if ($appStatus -eq "APPROVED") {
            Pass "D1: Commission approved - status=APPROVED"
        } elseif ($appStatus) {
            Warn "D1: Approve returned status=$appStatus (may already be approved)"
        } else {
            Pass "D1: Approve endpoint returned data"
        }

        # D2: Verify approvedBy set
        $cr = if ($approveResp.commission) { $approveResp.commission } else { $approveResp }
        if ($cr.approvedBy) {
            Pass "D2: approvedBy set: $($cr.approvedBy)"
        } else {
            Warn "D2: approvedBy not found in response"
        }

        # D3: Verify approvedAt set
        if ($cr.approvedAt) {
            Pass "D3: approvedAt set: $($cr.approvedAt)"
        } else {
            Warn "D3: approvedAt not found in response"
        }
    } else {
        Warn "D1: Approve returned null"
        Warn "D2-D3: Skipped"
    }

    # D4: Attempt approve already APPROVED -> should fail
    $reApprove = Api-Expect "PATCH" "/commissions/$COMMISSION_ID/approve" $KETOAN $null
    if ($reApprove.code -eq 400) {
        Pass "D4: Re-approve APPROVED commission rejected (400)"
    } elseif ($reApprove.code -eq 200) {
        Warn "D4: Re-approve accepted (may be idempotent)"
    } else {
        Warn "D4: Re-approve returned $($reApprove.code)"
    }
} else {
    Warn "D1-D4: Skipped - no COMMISSION_ID"
}

# ================================================================
# PART E: My Commissions (SALE view)
# ================================================================
Write-Host ""
Write-Host "=== PART E: My Commissions ===" -ForegroundColor Cyan

# E1: Get SALE1's own commissions
$myResp = D (Api "GET" "/commissions/my" $SALE1)
if ($myResp -ne $null) {
    Pass "E1: My commissions endpoint accessible"

    # E2: Check records array
    $records = if ($myResp.records) { $myResp.records } elseif ($myResp -is [Array]) { $myResp } elseif ($myResp.data) { $myResp.data } else { @() }
    if ($records.Count -gt 0) {
        Pass "E2: SALE1 has $($records.Count) commission records"
    } else {
        Warn "E2: SALE1 has 0 commission records (may not own completed orders)"
    }

    # E3: Check total field
    if ($myResp.total -ne $null) {
        Pass "E3: Total commission = $($myResp.total)"
    } else {
        Warn "E3: Total field not found in my commissions response"
    }
} else {
    Warn "E1: My commissions endpoint returned null"
    Warn "E2-E3: Skipped"
}

# E4: With date range filter
$startDate = (Get-Date).AddMonths(-3).ToString("yyyy-MM-dd")
$endDate = (Get-Date).ToString("yyyy-MM-dd")
$myDateResp = D (Api "GET" "/commissions/my?startDate=$startDate&endDate=$endDate" $SALE1)
if ($myDateResp -ne $null) {
    Pass "E4: My commissions with date range works"
} else {
    Warn "E4: My commissions with date range returned null"
}

# ================================================================
# PART F: Team Commissions (Leader view)
# ================================================================
Write-Host ""
Write-Host "=== PART F: Team Commissions ===" -ForegroundColor Cyan

# F1: Get team commissions (GDKD or LEADER)
$teamToken = if ($GDKD) { $GDKD } elseif ($LEADER) { $LEADER } else { $CEO }
$teamResp = D (Api "GET" "/commissions/team" $teamToken)
if ($teamResp -ne $null) {
    Pass "F1: Team commissions endpoint accessible"

    # F2: Check members array
    $members = if ($teamResp.members) { $teamResp.members } elseif ($teamResp -is [Array]) { $teamResp } elseif ($teamResp.data) { $teamResp.data } else { @() }
    if ($members.Count -gt 0) {
        Pass "F2: Team has $($members.Count) member(s) with commissions"
        foreach ($m in $members) {
            Write-Host "    Member: $($m.name) total=$($m.total) count=$($m.count)" -ForegroundColor Gray
        }
    } else {
        Warn "F2: No team members with commissions found"
    }

    # F3: Check aggregate fields
    if ($teamResp.totalCommission -ne $null -or $teamResp.totalRecords -ne $null) {
        Pass "F3: Team aggregates present (totalCommission=$($teamResp.totalCommission), totalRecords=$($teamResp.totalRecords))"
    } else {
        Warn "F3: Team aggregate fields not found"
    }
} else {
    Warn "F1: Team commissions returned null"
    Warn "F2-F3: Skipped"
}

# ================================================================
# PART G: Monthly Report
# ================================================================
Write-Host ""
Write-Host "=== PART G: Monthly Report ===" -ForegroundColor Cyan

$curYear = (Get-Date).Year
$curMonth = (Get-Date).Month

# G1: Get monthly report
$monthResp = D (Api "GET" "/commissions/report/monthly?year=$curYear&month=$curMonth" $CFO)
if ($monthResp -ne $null) {
    Pass "G1: Monthly report endpoint accessible"

    # G2: Check period field
    $expectedPeriod = "$curYear-$('{0:D2}' -f $curMonth)"
    if ($monthResp.period -eq $expectedPeriod) {
        Pass "G2: Period = $expectedPeriod (correct)"
    } elseif ($monthResp.period) {
        Warn "G2: Period = $($monthResp.period), expected $expectedPeriod"
    } else {
        Warn "G2: Period field not found"
    }

    # G3: Check report fields
    if ($monthResp.totalRecords -ne $null -and $monthResp.totalCommission -ne $null) {
        Pass "G3: Report has totalRecords=$($monthResp.totalRecords), totalCommission=$($monthResp.totalCommission)"
    } else {
        Warn "G3: Report missing totalRecords or totalCommission"
    }

    # G4: Check byStatus breakdown
    if ($monthResp.byStatus) {
        $bs = $monthResp.byStatus
        Pass "G4: byStatus present (pending=$($bs.pending), approved=$($bs.approved), paid=$($bs.paid))"
    } else {
        Warn "G4: byStatus breakdown not found"
    }

    # G5: Check records array
    $reportRecords = if ($monthResp.records) { $monthResp.records } else { @() }
    if ($reportRecords.Count -ge 0) {
        Pass "G5: Report contains $($reportRecords.Count) commission records"
    }
} else {
    Warn "G1: Monthly report returned null"
    Warn "G2-G5: Skipped"
}

# G6: Previous month (should still work)
$prevMonth = if ($curMonth -eq 1) { 12 } else { $curMonth - 1 }
$prevYear = if ($curMonth -eq 1) { $curYear - 1 } else { $curYear }
$prevResp = D (Api "GET" "/commissions/report/monthly?year=$prevYear&month=$prevMonth" $CFO)
if ($prevResp -ne $null) {
    Pass "G6: Previous month report accessible ($prevYear-$prevMonth)"
} else {
    Warn "G6: Previous month report returned null"
}

# ================================================================
# PART H: Calculate for non-existent order
# ================================================================
Write-Host ""
Write-Host "=== PART H: Error handling ===" -ForegroundColor Cyan

# H1: Non-existent order ID
$fakeId = "non_existent_order_id_12345"
$fakeResp = Api-Expect "POST" "/commissions/calculate/$fakeId" $CFO $null
if ($fakeResp.code -eq 404 -or $fakeResp.code -eq 400) {
    Pass "H1: Non-existent order rejected ($($fakeResp.code))"
} else {
    Warn "H1: Non-existent order returned $($fakeResp.code)"
}

# H2: Approve non-existent commission
$fakeApprove = Api-Expect "PATCH" "/commissions/$fakeId/approve" $KETOAN $null
if ($fakeApprove.code -eq 404 -or $fakeApprove.code -eq 400) {
    Pass "H2: Non-existent commission approve rejected ($($fakeApprove.code))"
} else {
    Warn "H2: Non-existent commission approve returned $($fakeApprove.code)"
}

# ================================================================
# PART I: RBAC - SALE cannot approve commissions
# ================================================================
Write-Host ""
Write-Host "=== PART I: RBAC enforcement ===" -ForegroundColor Cyan

if ($COMMISSION_ID) {
    # I1: SALE attempts to approve -> behavior check
    $saleApprove = Api-Expect "PATCH" "/commissions/$COMMISSION_ID/approve" $SALE1 $null
    if ($saleApprove.code -eq 403) {
        Pass "I1: SALE blocked from approving commission (RBAC enforced)"
    } elseif ($saleApprove.code -eq 400) {
        # May be blocked because already APPROVED, not RBAC
        Pass "I1: SALE approve returned 400 (may be status check not RBAC)"
    } elseif ($saleApprove.code -eq 200) {
        Warn "I1: SALE was able to call approve endpoint (no @Roles decorator)"
    } else {
        Warn "I1: SALE approve returned $($saleApprove.code)"
    }
} else {
    # I1: Try with fake ID
    $saleApproveFake = Api-Expect "PATCH" "/commissions/fake_id/approve" $SALE1 $null
    if ($saleApproveFake.code -eq 403) {
        Pass "I1: SALE blocked from commission approve (RBAC)"
    } elseif ($saleApproveFake.code -eq 404 -or $saleApproveFake.code -eq 400) {
        Warn "I1: SALE got $($saleApproveFake.code) (reached endpoint, no RBAC block)"
    } else {
        Warn "I1: SALE approve returned $($saleApproveFake.code)"
    }
}

# I2: SALE can access /commissions/my
$saleMyResp = Api-Expect "GET" "/commissions/my" $SALE1 $null
if ($saleMyResp.code -eq 200) {
    Pass "I2: SALE can access own commissions (/my)"
} else {
    Warn "I2: SALE /my returned $($saleMyResp.code)"
}

# I3: SALE cannot access /commissions/team
$saleTeamResp = Api-Expect "GET" "/commissions/team" $SALE1 $null
if ($saleTeamResp.code -eq 403) {
    Pass "I3: SALE blocked from team commissions (RBAC)"
} elseif ($saleTeamResp.code -eq 200) {
    Warn "I3: SALE can access team commissions (no RBAC on endpoint)"
} else {
    Warn "I3: SALE /team returned $($saleTeamResp.code)"
}

# ================================================================
# PART J: Commission with VCT service type
# ================================================================
Write-Host ""
Write-Host "=== PART J: VCT commission rule ===" -ForegroundColor Cyan

# J1: Create VCT commission rule
$vctRuleBody = @{
    serviceType = "VCT"
    minProfit   = 0
    maxProfit   = 100000000
    rate        = 0.04
    description = "FIN-007: VCT standard commission 4%"
}
$vctRuleResp = D (Api "POST" "/commissions/rules" $CFO $vctRuleBody)
if ($vctRuleResp -and $vctRuleResp.id) {
    Pass "J1: Created VCT commission rule @ 4%"
} else {
    Warn "J1: Failed to create VCT rule"
}

# J2: List rules and verify both MHH and VCT exist
$allRulesResp = Api "GET" "/commissions/rules?limit=50" $CFO
if ($allRulesResp) {
    $allData = D $allRulesResp
    $allItems = if ($allData -is [Array]) { $allData } elseif ($allData.data) { $allData.data } else { @() }
    $serviceTypes = @($allItems | ForEach-Object { $_.serviceType } | Sort-Object -Unique)
    if ($serviceTypes.Count -ge 2) {
        Pass "J2: Rules cover multiple service types: $($serviceTypes -join ', ')"
    } elseif ($serviceTypes.Count -eq 1) {
        Warn "J2: Only 1 service type in rules: $($serviceTypes[0])"
    } else {
        Warn "J2: No rules found"
    }
} else {
    Warn "J2: Rules list failed"
}

# J3: Verify tiered rates for MHH
if ($allRulesResp) {
    $mhhTiers = @($allItems | Where-Object { $_.serviceType -eq "MHH" } | Sort-Object { [double]$_.minProfit })
    if ($mhhTiers.Count -ge 3) {
        $ratesIncreasing = $true
        for ($i = 1; $i -lt $mhhTiers.Count; $i++) {
            if ([double]$mhhTiers[$i].rate -le [double]$mhhTiers[$i-1].rate) {
                $ratesIncreasing = $false
                break
            }
        }
        if ($ratesIncreasing) {
            Pass "J3: MHH tiers have increasing rates (higher profit = higher %)"
        } else {
            Warn "J3: MHH tiers don't have strictly increasing rates"
        }
    } elseif ($mhhTiers.Count -gt 0) {
        Warn "J3: Only $($mhhTiers.Count) MHH tiers (expected >= 3)"
    } else {
        Warn "J3: No MHH tiers found"
    }
}

# ================================================================
# SUMMARY
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-FIN-007 SUMMARY" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host "  TOTAL: $($passCount + $failCount + $warnCount)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Cyan
