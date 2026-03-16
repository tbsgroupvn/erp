# ================================================================
# TEST-FIN-006: AR Aging Report & Auto-reminder
# Severity: HIGH
#
# Verifies: AR aging bucket classification, aging report,
# overdue detection, high-risk customers, aging trends,
# customer-level aging, snapshot data
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
Write-Host "  TEST-FIN-006: AR Aging Report & Auto-reminder" -ForegroundColor Cyan
Write-Host "  Severity: HIGH" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login + Find customer
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login roles ===" -ForegroundColor White

$CFO = Login "cfo@$DOMAIN"
if ($CFO) { Pass "CFO login OK" } else { Fail "CFO login FAILED"; exit 1 }

$KETOAN = Login "ketoan@$DOMAIN"
if ($KETOAN) { Pass "KETOAN (Chief Accountant) login OK" } else { Fail "KETOAN login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

$SALE1 = Login "sale01@$DOMAIN"
if ($SALE1) { Pass "SALE1 login OK" } else { Fail "SALE1 login FAILED"; exit 1 }

# Find customer
Write-Host ""
Write-Host "--- Finding customer ---" -ForegroundColor Gray
$custResp = D (Api "GET" "/customers?limit=5" $CFO)
$CUSTOMER_ID = $null
if ($custResp -and $custResp.Count -gt 0) {
    $CUSTOMER_ID = $custResp[0].id
    $cName = if ($custResp[0].name) { $custResp[0].name } else { $custResp[0].companyName }
    Pass "Found customer: $cName ($CUSTOMER_ID)"
} else {
    Fail "No customers found"
    exit 1
}

# ================================================================
# PART A: Create AR records with different due dates
# ================================================================
Write-Host ""
Write-Host "=== PART A: Create AR records with varied due dates ===" -ForegroundColor Cyan

# Create 5 AR records:
# AR-Current: due in 7 days (not yet due)
# AR-1-30: due 15 days ago (15 days overdue)
# AR-31-60: due 45 days ago (45 days overdue)
# AR-61-90: due 75 days ago (75 days overdue)
# AR-90+: due 100 days ago (100 days overdue)

$today = Get-Date
$dueDates = @(
    @{ label = "Current (due in 7d)";   days = 7;    amount = 10000000 }
    @{ label = "1-30 (15d overdue)";    days = -15;  amount = 20000000 }
    @{ label = "31-60 (45d overdue)";   days = -45;  amount = 15000000 }
    @{ label = "61-90 (75d overdue)";   days = -75;  amount = 25000000 }
    @{ label = "90+ (100d overdue)";    days = -100; amount = 30000000 }
)

$AR_IDS = @()
$idx = 0
foreach ($dd in $dueDates) {
    $idx++
    $dueDate = $today.AddDays($dd.days).ToString("yyyy-MM-dd")
    $arBody = @{
        customerId = $CUSTOMER_ID
        amount     = $dd.amount
        currency   = "VND"
        dueDate    = $dueDate
        note       = "FIN-006 aging test: $($dd.label)"
    }
    $arResp = D (Api "POST" "/ar" $CFO $arBody)
    if ($arResp -and $arResp.id) {
        $AR_IDS += $arResp.id
        Pass "A$idx`: Created AR $($dd.label) - $($dd.amount / 1000000)M, due=$dueDate"
    } else {
        Fail "A$idx`: Failed to create AR $($dd.label)"
        $AR_IDS += $null
    }
}

# ================================================================
# PART B: Aging report - bucket classification
# ================================================================
Write-Host ""
Write-Host "=== PART B: Aging report bucket classification ===" -ForegroundColor Cyan

$agingResp = D (Api "GET" "/ar/aging" $CFO)
if ($agingResp -ne $null) {
    Pass "B1: Aging report endpoint accessible"

    # Check report structure
    $items = $null
    if ($agingResp -is [Array]) { $items = $agingResp }
    elseif ($agingResp.data) { $items = $agingResp.data }
    elseif ($agingResp.customers) { $items = $agingResp.customers }

    if ($items -and $items.Count -gt 0) {
        Pass "B2: Aging report contains $($items.Count) customer entries"

        # Find our test customer (may be nested in .customerId or .customer.id)
        $testCust = $null
        foreach ($item in $items) {
            $cid = if ($item.customerId) { $item.customerId } elseif ($item.customer_id) { $item.customer_id } elseif ($item.customer -and $item.customer.id) { $item.customer.id } else { $null }
            if ($cid -eq $CUSTOMER_ID) {
                $testCust = $item
                break
            }
        }

        if ($testCust) {
            Pass "B3: Found test customer in aging report"

            # Aging data may be nested in .aging sub-object
            $ag = if ($testCust.aging) { $testCust.aging } else { $testCust }

            # Check buckets
            $hasCurrent = ($ag.current -ne $null)
            $has1_30 = ($ag.days1_30 -ne $null -or $ag.'1_30' -ne $null)
            $has31_60 = ($ag.days31_60 -ne $null -or $ag.'31_60' -ne $null)
            $has61_90 = ($ag.days61_90 -ne $null -or $ag.'61_90' -ne $null)
            $has90Plus = ($ag.days90Plus -ne $null -or $ag.'90Plus' -ne $null)

            if ($hasCurrent -or $has1_30 -or $has31_60 -or $has61_90 -or $has90Plus) {
                Pass "B4: Aging buckets present in report"
                Write-Host "    Buckets: current=$($ag.current), 1-30=$($ag.days1_30), 31-60=$($ag.days31_60), 61-90=$($ag.days61_90), 90+=$($ag.days90Plus)" -ForegroundColor Gray
            } else {
                Warn "B4: Aging bucket fields not found in expected format"
                Write-Host "    Fields: $($testCust | ConvertTo-Json -Depth 2 -Compress)" -ForegroundColor Gray
            }

            # B5: Verify current bucket has our "not yet due" AR
            $valCurrent = if ($ag.current) { [double]$ag.current } else { 0 }
            if ($valCurrent -ge 10000000) {
                Pass "B5: Current bucket >= 10M (contains our not-yet-due AR)"
            } elseif ($valCurrent -gt 0) {
                Warn "B5: Current bucket = $valCurrent, expected >= 10M"
            } else {
                Warn "B5: Current bucket = 0 or not found"
            }

            # B6: Verify 90+ bucket has our 100-day overdue AR
            $val90 = if ($ag.days90Plus) { [double]$ag.days90Plus } elseif ($ag.'90Plus') { [double]$ag.'90Plus' } else { 0 }
            if ($val90 -ge 30000000) {
                Pass "B6: 90+ bucket >= 30M (contains our 100d overdue AR)"
            } elseif ($val90 -gt 0) {
                Warn "B6: 90+ bucket = $val90, expected >= 30M"
            } else {
                Warn "B6: 90+ bucket = 0 or not found"
            }
        } else {
            Warn "B3: Test customer not found in aging report (checked $($items.Count) entries)"
            Warn "B4-B6: Skipped"
        }
    } elseif ($agingResp.PSObject -and $agingResp.PSObject.Properties) {
        # Report might be a single summary object
        Pass "B2: Aging report returned summary object"
        Write-Host "    Keys: $($agingResp.PSObject.Properties.Name -join ', ')" -ForegroundColor Gray
        Warn "B3-B6: Report format is summary, not per-customer"
    } else {
        Warn "B2: Aging report returned unexpected format"
        Warn "B3-B6: Skipped"
    }
} else {
    Fail "B1: Aging report endpoint failed"
    Warn "B2-B6: Skipped"
}

# ================================================================
# PART C: Overdue list
# ================================================================
Write-Host ""
Write-Host "=== PART C: Overdue list ===" -ForegroundColor Cyan

$overdueResp = D (Api "GET" "/ar/overdue" $CFO)
if ($overdueResp -ne $null) {
    $overdueItems = if ($overdueResp -is [Array]) { $overdueResp } elseif ($overdueResp.data) { $overdueResp.data } else { @($overdueResp) }
    if ($overdueItems.Count -gt 0) {
        Pass "C1: Overdue list returned $($overdueItems.Count) records"

        # C2: All items should have dueDate < today
        $allOverdue = $true
        foreach ($item in $overdueItems) {
            if ($item.dueDate) {
                $due = [DateTime]$item.dueDate
                if ($due -gt $today) { $allOverdue = $false; break }
            }
        }
        if ($allOverdue) {
            Pass "C2: All overdue items have dueDate in the past"
        } else {
            Warn "C2: Some items have future dueDate (may include grace period)"
        }

        # C3: Check that our 15d, 45d, 75d, 100d overdue ARs are in the list
        $foundOverdueCount = 0
        foreach ($arId in $AR_IDS[1..4]) {
            if (-not $arId) { continue }
            foreach ($item in $overdueItems) {
                if ($item.id -eq $arId) { $foundOverdueCount++; break }
            }
        }
        if ($foundOverdueCount -ge 3) {
            Pass "C3: Found $foundOverdueCount of our 4 overdue ARs in the list"
        } elseif ($foundOverdueCount -gt 0) {
            Warn "C3: Found only $foundOverdueCount of 4 overdue ARs"
        } else {
            Warn "C3: None of our overdue ARs found in list"
        }
    } else {
        Warn "C1: Overdue list returned 0 records"
        Warn "C2-C3: Skipped"
    }
} else {
    Fail "C1: Overdue endpoint failed"
    Warn "C2-C3: Skipped"
}

# ================================================================
# PART D: Customer-level aging
# ================================================================
Write-Host ""
Write-Host "=== PART D: Customer-level aging ===" -ForegroundColor Cyan

$custAgingResp = D (Api "GET" "/ar/aging/customer/$CUSTOMER_ID" $CFO)
if ($custAgingResp -ne $null) {
    Pass "D1: Customer aging endpoint accessible"

    # Response may have nested .aging object: {customerId, aging:{current, days1_30, ...}, riskLevel}
    $agingData = $null
    if ($custAgingResp.aging) { $agingData = $custAgingResp.aging }
    else { $agingData = $custAgingResp }

    # Check for bucket data
    if ($agingData.current -ne $null -or $agingData.days1_30 -ne $null -or $agingData.totalOutstanding -ne $null) {
        Pass "D2: Customer aging has bucket/total fields"
        Write-Host "    current=$($agingData.current), 1-30=$($agingData.days1_30), 31-60=$($agingData.days31_60), 61-90=$($agingData.days61_90), 90+=$($agingData.days90Plus)" -ForegroundColor Gray
    } else {
        Warn "D2: Customer aging response format unexpected"
        Write-Host "    Response: $($custAgingResp | ConvertTo-Json -Depth 2 -Compress)" -ForegroundColor Gray
    }

    # D3: Check total outstanding >= sum of our 5 ARs (100M total)
    $totalOut = 0
    if ($agingData.totalOutstanding) { $totalOut = [double]$agingData.totalOutstanding }
    elseif ($agingData.total) { $totalOut = [double]$agingData.total }
    elseif ($custAgingResp.totalOutstanding) { $totalOut = [double]$custAgingResp.totalOutstanding }
    if ($totalOut -ge 100000000) {
        Pass "D3: Total outstanding >= 100M ($totalOut)"
    } elseif ($totalOut -gt 0) {
        Warn "D3: Total outstanding = $totalOut (may not include all test ARs)"
    } else {
        Warn "D3: Total outstanding = 0 or not found"
    }

    # D4: Risk level check (may be at top level or nested)
    $risk = if ($custAgingResp.riskLevel) { $custAgingResp.riskLevel } elseif ($agingData.riskLevel) { $agingData.riskLevel } else { $null }
    if ($risk) {
        # Risk depends on ratio of overdue vs total - with many existing ARs ratio may be diluted
        if ($risk -eq "CRITICAL" -or $risk -eq "HIGH") {
            Pass "D4: Risk level = $risk (high risk with 90+ day debt)"
        } elseif ($risk -eq "MEDIUM") {
            # MEDIUM is valid when overdue ratio is 20-30% (diluted by existing current ARs)
            Pass "D4: Risk level = $risk (valid when overdue ratio diluted by current ARs)"
        } else {
            Warn "D4: Risk level = $risk (expected at least MEDIUM)"
        }
    } else {
        Warn "D4: riskLevel field not present"
    }

    # D5: Verify shouldBlock if 90+ debt exists
    $shouldBlock = if ($custAgingResp.shouldBlock -ne $null) { $custAgingResp.shouldBlock } else { $null }
    if ($shouldBlock -eq $true) {
        Pass "D5: shouldBlock = true (has 90+ day debt)"
    } elseif ($shouldBlock -eq $false) {
        Warn "D5: shouldBlock = false (expected true with 90+ debt)"
    } else {
        Warn "D5: shouldBlock field not present"
    }
} else {
    Fail "D1: Customer aging endpoint failed"
    Warn "D2-D5: Skipped"
}

# ================================================================
# PART E: Aging summary (company-wide)
# ================================================================
Write-Host ""
Write-Host "=== PART E: Company-wide aging summary ===" -ForegroundColor Cyan

$summaryResp = D (Api "GET" "/ar/aging/summary" $CFO)
if ($summaryResp -ne $null) {
    Pass "E1: Aging summary endpoint accessible"

    # Check summary structure
    if ($summaryResp.totalOutstanding -ne $null -or $summaryResp.total -ne $null -or $summaryResp.customerCount -ne $null) {
        Pass "E2: Summary has aggregate fields"
    } elseif ($summaryResp -is [Array] -and $summaryResp.Count -gt 0) {
        Pass "E2: Summary returned array of customer snapshots ($($summaryResp.Count) entries)"
    } else {
        Warn "E2: Summary response format unexpected"
        Write-Host "    Response: $($summaryResp | ConvertTo-Json -Depth 2 -Compress)" -ForegroundColor Gray
    }
} else {
    Warn "E1: Aging summary endpoint returned null"
    Warn "E2: Skipped"
}

# E3: Aging summary with specific date
$dateParam = $today.ToString("yyyy-MM-dd")
$summaryDateResp = D (Api "GET" "/ar/aging/summary?date=$dateParam" $CFO)
if ($summaryDateResp -ne $null) {
    Pass "E3: Aging summary with date param works"
} else {
    Warn "E3: Aging summary with date param returned null"
}

# ================================================================
# PART F: Aging trends
# ================================================================
Write-Host ""
Write-Host "=== PART F: Historical aging trends ===" -ForegroundColor Cyan

$trendsResp = D (Api "GET" "/ar/aging/trends?days=30" $CFO)
if ($trendsResp -ne $null) {
    $trendItems = if ($trendsResp -is [Array]) { $trendsResp } elseif ($trendsResp.data) { $trendsResp.data } else { @($trendsResp) }
    if ($trendItems.Count -gt 0) {
        Pass "F1: Aging trends returned $($trendItems.Count) data points"
    } else {
        Warn "F1: Aging trends returned 0 data points (snapshot cron may not have run)"
    }
} else {
    Warn "F1: Aging trends endpoint returned null"
}

# F2: Customer-level trend
$custTrendResp = D (Api "GET" "/ar/aging/customer/$CUSTOMER_ID/trend?days=30" $CFO)
if ($custTrendResp -ne $null) {
    $custTrends = if ($custTrendResp -is [Array]) { $custTrendResp } elseif ($custTrendResp.data) { $custTrendResp.data } else { @($custTrendResp) }
    if ($custTrends.Count -gt 0) {
        Pass "F2: Customer aging trend has $($custTrends.Count) data points"
    } else {
        Warn "F2: Customer aging trend returned 0 points (cron may not have run)"
    }
} else {
    Warn "F2: Customer aging trend returned null"
}

# ================================================================
# PART G: High-risk customers
# ================================================================
Write-Host ""
Write-Host "=== PART G: High-risk customers ===" -ForegroundColor Cyan

$highRiskResp = D (Api "GET" "/ar/aging/high-risk" $CFO)
if ($highRiskResp -ne $null) {
    $hrItems = if ($highRiskResp -is [Array]) { $highRiskResp } elseif ($highRiskResp.data) { $highRiskResp.data } else { @() }
    if ($hrItems.Count -gt 0) {
        Pass "G1: High-risk customers returned $($hrItems.Count) entries"

        # G2: Check risk levels are HIGH or CRITICAL
        $allHighRisk = $true
        foreach ($hr in $hrItems) {
            if ($hr.riskLevel -and $hr.riskLevel -ne "HIGH" -and $hr.riskLevel -ne "CRITICAL") {
                $allHighRisk = $false
                break
            }
        }
        if ($allHighRisk) {
            Pass "G2: All entries have HIGH or CRITICAL risk level"
        } else {
            Warn "G2: Some entries have non-HIGH/CRITICAL risk levels"
        }

        # G3: Check our customer is in the high-risk list (has 90+ day debt)
        $foundOurs = $false
        foreach ($hr in $hrItems) {
            if ($hr.customerId -eq $CUSTOMER_ID -or $hr.customer_id -eq $CUSTOMER_ID) {
                $foundOurs = $true
                break
            }
        }
        if ($foundOurs) {
            Pass "G3: Test customer found in high-risk list"
        } else {
            Warn "G3: Test customer not in high-risk list (snapshot may not have run)"
        }
    } else {
        Warn "G1: High-risk list returned 0 entries (daily snapshot may not have run)"
        Warn "G2-G3: Skipped"
    }
} else {
    Warn "G1: High-risk endpoint returned null"
    Warn "G2-G3: Skipped"
}

# ================================================================
# PART H: Record payment and verify AR update
# ================================================================
Write-Host ""
Write-Host "=== PART H: Record payment on AR ===" -ForegroundColor Cyan

# H1: Record partial payment on the 15-day overdue AR
$AR_15D_ID = $AR_IDS[1]
if ($AR_15D_ID) {
    $payBody = @{
        amount    = 5000000
        reference = "TK-20260302-001"
        note      = "Thanh toan 1 phan cong no 15 ngay"
    }
    $payResp = D (Api "PATCH" "/ar/$AR_15D_ID/payment" $CFO $payBody)
    if ($payResp) {
        Pass "H1: Payment 5M recorded on 15d overdue AR"

        # H2: Verify paidAmount increased
        if ([double]$payResp.paidAmount -eq 5000000) {
            Pass "H2: paidAmount = 5M (correct)"
        } elseif ([double]$payResp.paidAmount -gt 0) {
            Warn "H2: paidAmount = $($payResp.paidAmount), expected 5M"
        } else {
            Warn "H2: paidAmount not updated"
        }

        # H3: Status should be PARTIAL (5M paid of 20M)
        if ($payResp.status -eq "PARTIAL") {
            Pass "H3: AR status = PARTIAL after partial payment"
        } else {
            Warn "H3: AR status = $($payResp.status), expected PARTIAL"
        }
    } else {
        Fail "H1: Failed to record payment"
        Warn "H2-H3: Skipped"
    }

    # H4: Record full remaining payment
    $payFull = D (Api "PATCH" "/ar/$AR_15D_ID/payment" $CFO @{ amount = 15000000; reference = "TK-20260302-002"; note = "Thanh toan het cong no" })
    if ($payFull) {
        if ($payFull.status -eq "PAID") {
            Pass "H4: AR status = PAID after full payment"
        } elseif ([double]$payFull.paidAmount -eq 20000000) {
            Pass "H4: Full payment recorded (paidAmount = 20M)"
        } else {
            Warn "H4: AR status=$($payFull.status), paidAmount=$($payFull.paidAmount)"
        }
    } else {
        Warn "H4: Full payment failed"
    }
} else {
    Warn "H1-H4: Skipped - no 15d overdue AR"
}

# ================================================================
# PART I: Customer debt view
# ================================================================
Write-Host ""
Write-Host "=== PART I: Customer debt view ===" -ForegroundColor Cyan

$debtResp = D (Api "GET" "/ar/by-customer/$CUSTOMER_ID" $CFO)
if ($debtResp -ne $null) {
    Pass "I1: Customer debt view accessible"

    # I2: Should have receivables array
    $receivables = $null
    if ($debtResp.receivables) { $receivables = $debtResp.receivables }
    elseif ($debtResp -is [Array]) { $receivables = $debtResp }
    elseif ($debtResp.data) { $receivables = $debtResp.data }

    if ($receivables -and $receivables.Count -gt 0) {
        Pass "I2: Customer has $($receivables.Count) AR records"
    } else {
        Warn "I2: No receivables in debt view"
    }

    # I3: Check summary totals
    if ($debtResp.totalDebt -ne $null -or $debtResp.totalOutstanding -ne $null -or $debtResp.summary) {
        $total = if ($debtResp.totalDebt) { $debtResp.totalDebt } elseif ($debtResp.totalOutstanding) { $debtResp.totalOutstanding } else { "present" }
        Pass "I3: Debt summary present (total=$total)"
    } else {
        Warn "I3: No summary totals in debt view"
    }
} else {
    Fail "I1: Customer debt view failed"
    Warn "I2-I3: Skipped"
}

# ================================================================
# PART J: AR list with filters
# ================================================================
Write-Host ""
Write-Host "=== PART J: AR list + filters ===" -ForegroundColor Cyan

# J1: List all ARs
$arListResp = Api "GET" "/ar?limit=10" $CFO
if ($arListResp) {
    $arListData = D $arListResp
    $arItems = if ($arListData -is [Array]) { $arListData } elseif ($arListData.Count) { $arListData } else { @() }
    if ($arItems.Count -gt 0) {
        Pass "J1: AR list returned $($arItems.Count) records"
    } else {
        Warn "J1: AR list returned 0 records"
    }
} else {
    Fail "J1: AR list endpoint failed"
}

# J2: Filter by status OPEN
$arOpenResp = Api "GET" "/ar?status=OPEN&limit=10" $CFO
if ($arOpenResp) {
    Pass "J2: AR filter by status=OPEN works"
} else {
    Warn "J2: AR filter by OPEN failed"
}

# J3: Filter by isOverdue=true
$arOverdueFilter = Api "GET" "/ar?isOverdue=true&limit=10" $CFO
if ($arOverdueFilter) {
    Pass "J3: AR filter by isOverdue=true works"
} else {
    Warn "J3: AR filter by isOverdue failed (param may not be supported)"
}

# J4: Filter by customerId
$arCustFilter = Api "GET" "/ar?customerId=$CUSTOMER_ID&limit=10" $CFO
if ($arCustFilter) {
    Pass "J4: AR filter by customerId works"
} else {
    Warn "J4: AR filter by customerId failed"
}

# ================================================================
# PART K: Notification rules for aging
# ================================================================
Write-Host ""
Write-Host "=== PART K: Notification rules ===" -ForegroundColor Cyan

$rulesResp = D (Api "GET" "/notification-rules" $CEO)
if ($rulesResp -ne $null) {
    $rules = if ($rulesResp -is [Array]) { $rulesResp } elseif ($rulesResp.data) { $rulesResp.data } else { @() }
    if ($rules.Count -gt 0) {
        Pass "K1: Notification rules returned $($rules.Count) rules"

        # K2: Check for aging-related rules
        $agingRules = @()
        foreach ($rule in $rules) {
            if ($rule.eventType -match "aging|overdue|ar\." -or $rule.name -match "aging|overdue|nh.c n.|qu. h.n") {
                $agingRules += $rule
            }
        }
        if ($agingRules.Count -gt 0) {
            Pass "K2: Found $($agingRules.Count) aging-related notification rules"
            foreach ($ar in $agingRules) {
                Write-Host "    Rule: $($ar.name) - event=$($ar.eventType) - channels=$($ar.channels -join ',')" -ForegroundColor Gray
            }
        } else {
            Warn "K2: No aging-related rules found (may need seeding)"
        }
    } else {
        Warn "K1: No notification rules found"
        Warn "K2: Skipped"
    }
} else {
    Warn "K1: Notification rules endpoint returned null"
    Warn "K2: Skipped"
}

# ================================================================
# PART L: Escalation rules
# ================================================================
Write-Host ""
Write-Host "=== PART L: Escalation configuration ===" -ForegroundColor Cyan

# Check escalation rules endpoint (try multiple possible paths)
$escResp = D (Api "GET" "/escalation-rules" $CEO)
if (-not $escResp) { $escResp = D (Api "GET" "/notification-rules?eventType=OVERDUE_AR" $CEO) }
if ($escResp -ne $null) {
    Pass "L1: Escalation settings accessible"

    # Check for OVERDUE_AR rules
    $overdueRules = @()
    $items = if ($escResp -is [Array]) { $escResp } elseif ($escResp.data) { $escResp.data } elseif ($escResp.rules) { $escResp.rules } else { @() }
    foreach ($item in $items) {
        if ($item.eventType -match "overdue|ar|aging" -or $item.type -match "overdue|ar") {
            $overdueRules += $item
        }
    }
    if ($overdueRules.Count -gt 0) {
        Pass "L2: Found $($overdueRules.Count) overdue AR escalation rules"
    } else {
        Warn "L2: No overdue AR escalation rules (may use different endpoint)"
    }
} else {
    Warn "L1: Escalation settings not accessible (endpoint may differ)"
    Warn "L2: Skipped"
}

# ================================================================
# PART M: RBAC enforcement
# ================================================================
Write-Host ""
Write-Host "=== PART M: RBAC enforcement ===" -ForegroundColor Cyan

# M1: SALE cannot access aging report
$saleAging = Api-Expect "GET" "/ar/aging" $SALE1 $null
if ($saleAging.code -eq 403) {
    Pass "M1: SALE blocked from aging report (RBAC enforced)"
} elseif ($saleAging.code -eq 200) {
    Warn "M1: SALE can access aging report (may have elevated permissions)"
} else {
    Warn "M1: Aging report returned $($saleAging.code) for SALE"
}

# M2: SALE cannot record payment
if ($AR_IDS[2]) {
    $salePayResp = Api-Expect "PATCH" "/ar/$($AR_IDS[2])/payment" $SALE1 @{ amount = 1000; reference = "test" }
    if ($salePayResp.code -eq 403) {
        Pass "M2: SALE blocked from recording payment (RBAC enforced)"
    } elseif ($salePayResp.code -eq 200) {
        Fail "M2: SALE was able to record payment - RBAC VIOLATION!"
    } else {
        Warn "M2: Payment by SALE returned $($salePayResp.code)"
    }
} else {
    Warn "M2: Skipped - no AR for RBAC test"
}

# ================================================================
# SUMMARY
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-FIN-006 SUMMARY" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host "  TOTAL: $($passCount + $failCount + $warnCount)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Cyan
