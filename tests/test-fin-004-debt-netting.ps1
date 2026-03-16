# ================================================================
# TEST-FIN-004: Debt Netting (Bu tru cong no)
# Severity: HIGH (Business pain point #5)
#
# Verifies: AR/AP netting full lifecycle, approval flow,
# validation rules (max/min), status enforcement,
# partial netting, list/history queries
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
Write-Host "  TEST-FIN-004: Debt Netting (Bu tru cong no)" -ForegroundColor Cyan
Write-Host "  Severity: HIGH (Business pain point #5)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login roles + Find customer + vendor
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login roles ===" -ForegroundColor White

$CFO = Login "cfo@$DOMAIN"
if ($CFO) { Pass "CFO login OK" } else { Fail "CFO login FAILED"; exit 1 }

$KETOAN = Login "ketoan@$DOMAIN"
if ($KETOAN) { Pass "KETOAN (Chief Accountant) login OK" } else { Fail "KETOAN login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

# Find a customer
Write-Host ""
Write-Host "--- Finding customer for test data ---" -ForegroundColor Gray
$custResp = D (Api "GET" "/customers?limit=5" $CFO)
$CUSTOMER = $null
$CUSTOMER_ID = $null
$CUSTOMER_NAME = $null

if ($custResp -and $custResp.Count -gt 0) {
    $CUSTOMER = $custResp[0]
    $CUSTOMER_ID = $CUSTOMER.id
    $CUSTOMER_NAME = $CUSTOMER.name
    if (-not $CUSTOMER_NAME) { $CUSTOMER_NAME = $CUSTOMER.companyName }
    Pass "Found customer: $CUSTOMER_NAME ($CUSTOMER_ID)"
} else {
    Fail "No customers found - cannot create AR test data"
    exit 1
}

# Find a vendor
Write-Host ""
Write-Host "--- Finding vendor for test data ---" -ForegroundColor Gray
$vendorResp = D (Api "GET" "/vendors?limit=5" $CEO)
$VENDOR_ID = $null
$VENDOR_NAME = $null

if ($vendorResp -and $vendorResp.Count -gt 0) {
    $VENDOR_ID = $vendorResp[0].id
    $VENDOR_NAME = $vendorResp[0].name
    if (-not $VENDOR_NAME) { $VENDOR_NAME = $vendorResp[0].companyName }
    Pass "Found vendor: $VENDOR_NAME ($VENDOR_ID)"
} else {
    Warn "No vendors found - will create AP without vendorId"
}

$DUE_DATE = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")

# ================================================================
# PART A: Create AR (100M) + AP (30M) test data
# ================================================================
Write-Host ""
Write-Host "=== PART A: Create AR 100M + AP 30M ===" -ForegroundColor Cyan

# A1: Create AR 100,000,000 VND
$arBody = @{
    customerId = $CUSTOMER_ID
    amount     = 100000000
    currency   = "VND"
    dueDate    = $DUE_DATE
    note       = "FIN-004 test AR: KH no TBS 100tr"
}

$arResp = D (Api "POST" "/ar" $CFO $arBody)
$AR1_ID = $null
if ($arResp -and $arResp.id) {
    $AR1_ID = $arResp.id
    Pass "A1: Created AR 100M - ID: $AR1_ID"
} else {
    Fail "A1: Failed to create AR 100M"
}

# A2: Verify AR record
if ($AR1_ID) {
    $arCheck = D (Api "GET" "/ar/$AR1_ID" $CFO)
    if ($arCheck -and $arCheck.status -eq "OPEN" -and [double]$arCheck.amount -eq 100000000) {
        Pass "A2: AR verified - status=OPEN, amount=100M"
    } elseif ($arCheck) {
        Warn "A2: AR exists but status=$($arCheck.status), amount=$($arCheck.amount)"
    } else {
        Fail "A2: Cannot read AR record"
    }
} else {
    Warn "A2: Skipped - no AR1_ID"
}

# A3: Create AP 30,000,000 VND
$apBody = @{
    amount  = 30000000
    currency = "VND"
    dueDate = $DUE_DATE
    note    = "FIN-004 test AP: TBS no KH 30tr (refund/claim)"
}
if ($VENDOR_ID) { $apBody.vendorId = $VENDOR_ID }
else { $apBody.vendorName = "Test Vendor FIN-004" }

$apResp = D (Api "POST" "/ap" $CFO $apBody)
$AP1_ID = $null
if ($apResp -and $apResp.id) {
    $AP1_ID = $apResp.id
    Pass "A3: Created AP 30M - ID: $AP1_ID"
} else {
    Fail "A3: Failed to create AP 30M"
}

# A4: Verify AP record
if ($AP1_ID) {
    $apCheck = D (Api "GET" "/ap/$AP1_ID" $CFO)
    if ($apCheck -and $apCheck.status -eq "OPEN" -and [double]$apCheck.amount -eq 30000000) {
        Pass "A4: AP verified - status=OPEN, amount=30M"
    } elseif ($apCheck) {
        Warn "A4: AP exists but status=$($apCheck.status), amount=$($apCheck.amount)"
    } else {
        Fail "A4: Cannot read AP record"
    }
} else {
    Warn "A4: Skipped - no AP1_ID"
}

# ================================================================
# PART B: Find netting opportunities
# ================================================================
Write-Host ""
Write-Host "=== PART B: Netting opportunities ===" -ForegroundColor Cyan

$opps = D (Api "GET" "/debt-netting/opportunities" $CFO)
if ($opps -ne $null) {
    if ($opps.Count -gt 0) {
        Pass "B1: Found $($opps.Count) netting opportunity(ies)"
        # Check that at least one has nettableAmount > 0
        $hasValid = $false
        foreach ($opp in $opps) {
            if ([double]$opp.nettableAmount -gt 0) { $hasValid = $true; break }
        }
        if ($hasValid) {
            Pass "B2: At least one opportunity has nettableAmount > 0"
        } else {
            Warn "B2: All opportunities have nettableAmount = 0"
        }
    } else {
        Warn "B1: No netting opportunities found (may need matching customer/vendor)"
        Warn "B2: Skipped - no opportunities"
    }
} else {
    Warn "B1: Opportunities endpoint returned null"
    Warn "B2: Skipped"
}

# ================================================================
# PART C: Create netting request (nettingAmount = 30M)
# ================================================================
Write-Host ""
Write-Host "=== PART C: Create netting request ===" -ForegroundColor Cyan

$NET1_ID = $null
if ($AR1_ID -and $AP1_ID) {
    $nettingBody = @{
        counterpartyId   = $CUSTOMER_ID
        counterpartyName = if ($CUSTOMER_NAME) { $CUSTOMER_NAME } else { "Test Customer" }
        arIds            = @($AR1_ID)
        apIds            = @($AP1_ID)
        nettingAmount    = 30000000
        notes            = "FIN-004: Bu tru cong no 30M (AR 100M - AP 30M)"
    }

    $netResp = D (Api "POST" "/debt-netting" $CFO $nettingBody)
    if ($netResp -and $netResp.id) {
        $NET1_ID = $netResp.id
        Pass "C1: Netting request created - ID: $NET1_ID"

        # C2: Verify status = PENDING
        if ($netResp.status -eq "PENDING") {
            Pass "C2: Netting status = PENDING"
        } else {
            Fail "C2: Expected PENDING, got $($netResp.status)"
        }

        # C3: Verify code format NET-YYYYMM-XXXX
        if ($netResp.code -match "^NET-\d{6}-\d{4}$") {
            Pass "C3: Code format valid: $($netResp.code)"
        } else {
            Warn "C3: Code format unexpected: $($netResp.code)"
        }

        # C4: Verify netAmount = 30M
        if ([double]$netResp.netAmount -eq 30000000) {
            Pass "C4: netAmount = 30,000,000 VND"
        } else {
            Fail "C4: Expected netAmount=30M, got $($netResp.netAmount)"
        }
    } else {
        Fail "C1: Failed to create netting request"
        Warn "C2: Skipped"
        Warn "C3: Skipped"
        Warn "C4: Skipped"
    }
} else {
    Fail "C1: Skipped - missing AR1_ID or AP1_ID"
    Warn "C2-C4: Skipped"
}

# ================================================================
# PART D: Approve netting (PENDING -> APPROVED)
# ================================================================
Write-Host ""
Write-Host "=== PART D: Approve netting ===" -ForegroundColor Cyan

if ($NET1_ID) {
    $approveResp = D (Api "PATCH" "/debt-netting/$NET1_ID/approve" $CFO)
    if ($approveResp -and $approveResp.status -eq "APPROVED") {
        Pass "D1: Netting approved - status=APPROVED"

        # D2: Verify approvedBy set
        if ($approveResp.approvedBy) {
            Pass "D2: approvedBy set: $($approveResp.approvedBy)"
        } else {
            Warn "D2: approvedBy is null"
        }

        # D3: Verify approvedAt set
        if ($approveResp.approvedAt) {
            Pass "D3: approvedAt set: $($approveResp.approvedAt)"
        } else {
            Warn "D3: approvedAt is null"
        }
    } else {
        Fail "D1: Approve failed or status != APPROVED"
        Warn "D2: Skipped"
        Warn "D3: Skipped"
    }
} else {
    Warn "D1-D3: Skipped - no NET1_ID"
}

# ================================================================
# PART E: Execute netting + verify AR/AP updates
# ================================================================
Write-Host ""
Write-Host "=== PART E: Execute netting + verify AR/AP ===" -ForegroundColor Cyan

if ($NET1_ID) {
    $execResp = D (Api "POST" "/debt-netting/$NET1_ID/execute" $CFO)
    if ($execResp) {
        Pass "E1: Netting executed successfully"
    } else {
        Fail "E1: Execute netting failed"
    }

    Start-Sleep -Milliseconds 500

    # E2: Check AR - nettedAmount should be 30M, status PARTIAL
    if ($AR1_ID) {
        $arAfter = D (Api "GET" "/ar/$AR1_ID" $CFO)
        if ($arAfter) {
            $arNetted = [double]$arAfter.nettedAmount
            if ($arNetted -eq 30000000) {
                Pass "E2: AR nettedAmount = 30M (correct)"
            } else {
                Fail "E2: AR nettedAmount = $arNetted, expected 30M"
            }

            # E3: AR status should be PARTIAL (100M - 30M netted = 70M remaining)
            if ($arAfter.status -eq "PARTIAL") {
                Pass "E3: AR status = PARTIAL (70M remaining)"
            } else {
                Warn "E3: AR status = $($arAfter.status), expected PARTIAL"
            }

            # E4: Verify remaining balance = 70M
            $arRemaining = [double]$arAfter.amount - [double]$arAfter.paidAmount - [double]$arAfter.nettedAmount
            if ([Math]::Abs($arRemaining - 70000000) -lt 1) {
                Pass "E4: AR remaining balance = 70M"
            } else {
                Fail "E4: AR remaining = $arRemaining, expected 70M"
            }
        } else {
            Fail "E2: Cannot read AR after execution"
            Warn "E3-E4: Skipped"
        }
    }

    # E5: Check AP - nettedAmount should be 30M, status NETTED
    if ($AP1_ID) {
        $apAfter = D (Api "GET" "/ap/$AP1_ID" $CFO)
        if ($apAfter) {
            $apNetted = [double]$apAfter.nettedAmount
            if ($apNetted -eq 30000000) {
                Pass "E5: AP nettedAmount = 30M (correct)"
            } else {
                Fail "E5: AP nettedAmount = $apNetted, expected 30M"
            }

            # E6: AP status should be NETTED (30M - 30M = 0 remaining)
            if ($apAfter.status -eq "NETTED") {
                Pass "E6: AP status = NETTED (fully offset)"
            } else {
                Warn "E6: AP status = $($apAfter.status), expected NETTED"
            }

            # E7: Verify AP remaining = 0
            $apRemaining = [double]$apAfter.amount - [double]$apAfter.paidAmount - [double]$apAfter.nettedAmount
            if ([Math]::Abs($apRemaining) -lt 1) {
                Pass "E7: AP remaining balance = 0 (fully netted)"
            } else {
                Fail "E7: AP remaining = $apRemaining, expected 0"
            }
        } else {
            Fail "E5: Cannot read AP after execution"
            Warn "E6-E7: Skipped"
        }
    }
} else {
    Warn "E1-E7: Skipped - no NET1_ID"
}

# ================================================================
# PART F: Validation - netting amount exceeds max
# ================================================================
Write-Host ""
Write-Host "=== PART F: Exceed max nettable amount ===" -ForegroundColor Cyan

# Create small AR + AP for validation tests
$ar2Body = @{
    customerId = $CUSTOMER_ID
    amount     = 50000000
    currency   = "VND"
    dueDate    = $DUE_DATE
    note       = "FIN-004 validation AR 50M"
}
$ar2Resp = D (Api "POST" "/ar" $CFO $ar2Body)
$AR2_ID = if ($ar2Resp) { $ar2Resp.id } else { $null }

$ap2Body = @{
    amount  = 20000000
    currency = "VND"
    dueDate = $DUE_DATE
    note    = "FIN-004 validation AP 20M"
}
if ($VENDOR_ID) { $ap2Body.vendorId = $VENDOR_ID }
else { $ap2Body.vendorName = "Test Vendor FIN-004 V2" }

$ap2Resp = D (Api "POST" "/ap" $CFO $ap2Body)
$AP2_ID = if ($ap2Resp) { $ap2Resp.id } else { $null }

if ($AR2_ID -and $AP2_ID) {
    # F1: Attempt netting 25M > min(50M, 20M) = 20M -> should fail
    $overBody = @{
        counterpartyId   = $CUSTOMER_ID
        counterpartyName = if ($CUSTOMER_NAME) { $CUSTOMER_NAME } else { "Test" }
        arIds            = @($AR2_ID)
        apIds            = @($AP2_ID)
        nettingAmount    = 25000000
        notes            = "Should fail - exceeds max"
    }
    $overResp = Api-Expect "POST" "/debt-netting" $CFO $overBody
    if ($overResp.code -eq 400) {
        Pass "F1: Netting 25M exceeding max(20M) rejected with 400"
    } elseif ($overResp.code -eq 201 -or $overResp.code -eq 200) {
        Fail "F1: Netting 25M should be rejected but was accepted"
    } else {
        Warn "F1: Unexpected status $($overResp.code)"
    }

    # F2: Verify error message mentions exceeds
    if ($overResp.error -match "exceed|vuot|max") {
        Pass "F2: Error message mentions exceeds/max"
    } elseif ($overResp.code -eq 400) {
        Warn "F2: Got 400 but error doesn't match pattern: $($overResp.error)"
    } else {
        Warn "F2: Skipped"
    }
} else {
    Warn "F1-F2: Skipped - failed to create AR2 or AP2"
}

# ================================================================
# PART G: Validation - below minimum threshold (100,000)
# ================================================================
Write-Host ""
Write-Host "=== PART G: Below minimum threshold ===" -ForegroundColor Cyan

# Create small AR + AP for min threshold test
$ar3Body = @{
    customerId = $CUSTOMER_ID
    amount     = 500000
    currency   = "VND"
    dueDate    = $DUE_DATE
    note       = "FIN-004 min threshold AR 500K"
}
$ar3Resp = D (Api "POST" "/ar" $CFO $ar3Body)
$AR3_ID = if ($ar3Resp) { $ar3Resp.id } else { $null }

$ap3Body = @{
    amount  = 500000
    currency = "VND"
    dueDate = $DUE_DATE
    note    = "FIN-004 min threshold AP 500K"
}
if ($VENDOR_ID) { $ap3Body.vendorId = $VENDOR_ID }
else { $ap3Body.vendorName = "Test Vendor FIN-004 V3" }

$ap3Resp = D (Api "POST" "/ap" $CFO $ap3Body)
$AP3_ID = if ($ap3Resp) { $ap3Resp.id } else { $null }

if ($AR3_ID -and $AP3_ID) {
    # G1: Attempt netting 50,000 < 100,000 threshold -> should fail
    $minBody = @{
        counterpartyId   = $CUSTOMER_ID
        counterpartyName = if ($CUSTOMER_NAME) { $CUSTOMER_NAME } else { "Test" }
        arIds            = @($AR3_ID)
        apIds            = @($AP3_ID)
        nettingAmount    = 50000
        notes            = "Should fail - below min threshold"
    }
    $minResp = Api-Expect "POST" "/debt-netting" $CFO $minBody
    if ($minResp.code -eq 400) {
        Pass "G1: Netting 50K below min threshold rejected with 400"
    } else {
        Fail "G1: Expected 400, got $($minResp.code)"
    }

    # G2: Verify error mentions threshold
    if ($minResp.error -match "th.p|threshold|t.i thi.u|min") {
        Pass "G2: Error message mentions threshold/minimum"
    } elseif ($minResp.code -eq 400) {
        Warn "G2: Got 400 but error doesn't match pattern: $($minResp.error)"
    } else {
        Warn "G2: Skipped"
    }
} else {
    Warn "G1-G2: Skipped - failed to create AR3 or AP3"
}

# ================================================================
# PART H: Status enforcement
# ================================================================
Write-Host ""
Write-Host "=== PART H: Status enforcement ===" -ForegroundColor Cyan

# H1: Cannot execute a PENDING netting (must be APPROVED first)
if ($AR2_ID -and $AP2_ID) {
    $pendBody = @{
        counterpartyId   = $CUSTOMER_ID
        counterpartyName = if ($CUSTOMER_NAME) { $CUSTOMER_NAME } else { "Test" }
        arIds            = @($AR2_ID)
        apIds            = @($AP2_ID)
        nettingAmount    = 20000000
        notes            = "Status enforcement test"
    }
    $pendResp = D (Api "POST" "/debt-netting" $CFO $pendBody)
    $NET_H_ID = if ($pendResp) { $pendResp.id } else { $null }

    if ($NET_H_ID) {
        # H1: Attempt execute on PENDING -> should fail
        $execPendResp = Api-Expect "POST" "/debt-netting/$NET_H_ID/execute" $CFO $null
        if ($execPendResp.code -eq 400) {
            Pass "H1: Execute PENDING netting rejected with 400"
        } else {
            Fail "H1: Expected 400, got $($execPendResp.code)"
        }

        # H2: Approve it
        $appH = D (Api "PATCH" "/debt-netting/$NET_H_ID/approve" $CFO)
        if ($appH -and $appH.status -eq "APPROVED") {
            Pass "H2: Netting approved for status test"
        } else {
            Warn "H2: Approve failed"
        }

        # H3: Attempt approve again on APPROVED -> should fail
        $reAppResp = Api-Expect "PATCH" "/debt-netting/$NET_H_ID/approve" $CFO $null
        if ($reAppResp.code -eq 400) {
            Pass "H3: Re-approve APPROVED netting rejected with 400"
        } else {
            Warn "H3: Expected 400, got $($reAppResp.code)"
        }

        # H4: Execute it
        $execH = D (Api "POST" "/debt-netting/$NET_H_ID/execute" $CFO)
        if ($execH) {
            Pass "H4: Execute approved netting OK"
        } else {
            Warn "H4: Execute failed"
        }

        # H5: Attempt execute again on already executed -> should fail
        Start-Sleep -Milliseconds 300
        $reExecResp = Api-Expect "POST" "/debt-netting/$NET_H_ID/execute" $CFO $null
        if ($reExecResp.code -eq 400) {
            Pass "H5: Re-execute already executed netting rejected with 400"
        } else {
            Warn "H5: Expected 400, got $($reExecResp.code)"
        }
    } else {
        Warn "H1-H5: Skipped - could not create netting for status test"
    }
} else {
    Warn "H1-H5: Skipped - no AR2/AP2 for status test"
}

# ================================================================
# PART I: Partial netting scenario
# ================================================================
Write-Host ""
Write-Host "=== PART I: Partial netting (net less than full) ===" -ForegroundColor Cyan

# Create AR 80M + AP 60M, net only 40M
$ar4Body = @{
    customerId = $CUSTOMER_ID
    amount     = 80000000
    currency   = "VND"
    dueDate    = $DUE_DATE
    note       = "FIN-004 partial netting AR 80M"
}
$ar4Resp = D (Api "POST" "/ar" $CFO $ar4Body)
$AR4_ID = if ($ar4Resp) { $ar4Resp.id } else { $null }

$ap4Body = @{
    amount  = 60000000
    currency = "VND"
    dueDate = $DUE_DATE
    note    = "FIN-004 partial netting AP 60M"
}
if ($VENDOR_ID) { $ap4Body.vendorId = $VENDOR_ID }
else { $ap4Body.vendorName = "Test Vendor FIN-004 Partial" }

$ap4Resp = D (Api "POST" "/ap" $CFO $ap4Body)
$AP4_ID = if ($ap4Resp) { $ap4Resp.id } else { $null }

if ($AR4_ID -and $AP4_ID) {
    # I1: Create netting 40M (less than both AR=80M and AP=60M)
    $partBody = @{
        counterpartyId   = $CUSTOMER_ID
        counterpartyName = if ($CUSTOMER_NAME) { $CUSTOMER_NAME } else { "Test" }
        arIds            = @($AR4_ID)
        apIds            = @($AP4_ID)
        nettingAmount    = 40000000
        notes            = "Partial netting 40M"
    }
    $partResp = D (Api "POST" "/debt-netting" $CFO $partBody)
    $NET_P_ID = if ($partResp) { $partResp.id } else { $null }

    if ($NET_P_ID) {
        Pass "I1: Partial netting request created (40M)"

        # I2: Approve + execute
        $appP = D (Api "PATCH" "/debt-netting/$NET_P_ID/approve" $CFO)
        if ($appP -and $appP.status -eq "APPROVED") {
            $execP = D (Api "POST" "/debt-netting/$NET_P_ID/execute" $CFO)
            if ($execP) {
                Pass "I2: Partial netting approved + executed"
            } else {
                Fail "I2: Execute partial netting failed"
            }
        } else {
            Fail "I2: Approve partial netting failed"
        }

        Start-Sleep -Milliseconds 500

        # I3: Verify AR nettedAmount=40M, status PARTIAL
        $ar4After = D (Api "GET" "/ar/$AR4_ID" $CFO)
        if ($ar4After -and [double]$ar4After.nettedAmount -eq 40000000) {
            Pass "I3: AR nettedAmount = 40M, remaining = $([double]$ar4After.amount - [double]$ar4After.paidAmount - [double]$ar4After.nettedAmount)"
        } elseif ($ar4After) {
            Fail "I3: AR nettedAmount = $($ar4After.nettedAmount), expected 40M"
        } else {
            Fail "I3: Cannot read AR4 after partial netting"
        }

        # I4: Verify AP nettedAmount=40M, status PARTIAL (60M - 40M = 20M remaining)
        $ap4After = D (Api "GET" "/ap/$AP4_ID" $CFO)
        if ($ap4After -and [double]$ap4After.nettedAmount -eq 40000000) {
            Pass "I4: AP nettedAmount = 40M, status = $($ap4After.status)"
        } elseif ($ap4After) {
            Fail "I4: AP nettedAmount = $($ap4After.nettedAmount), expected 40M"
        } else {
            Fail "I4: Cannot read AP4 after partial netting"
        }

        # I5: Both should be PARTIAL (neither fully settled)
        if ($ar4After -and $ar4After.status -eq "PARTIAL" -and $ap4After -and $ap4After.status -eq "PARTIAL") {
            Pass "I5: Both AR and AP status = PARTIAL after partial netting"
        } elseif ($ar4After -and $ap4After) {
            Warn "I5: AR status=$($ar4After.status), AP status=$($ap4After.status) - expected both PARTIAL"
        } else {
            Warn "I5: Cannot verify statuses"
        }
    } else {
        Fail "I1: Failed to create partial netting"
        Warn "I2-I5: Skipped"
    }
} else {
    Warn "I1-I5: Skipped - failed to create AR4 or AP4"
}

# ================================================================
# PART J: List + History queries
# ================================================================
Write-Host ""
Write-Host "=== PART J: List + History ===" -ForegroundColor Cyan

# J1: GET /debt-netting -> list
$listResp = Api "GET" "/debt-netting?limit=10" $CFO
if ($listResp) {
    $listData = $null
    if ($listResp.data -and $listResp.data.Count -ge 0) { $listData = $listResp.data }
    elseif ($listResp.Count -ge 0) { $listData = $listResp }

    if ($listData -ne $null -and $listData.Count -gt 0) {
        Pass "J1: Netting list returned $($listData.Count) entries"
    } elseif ($listData -ne $null) {
        Warn "J1: Netting list returned 0 entries"
    } else {
        Warn "J1: Unexpected list response format"
    }
} else {
    Fail "J1: Netting list endpoint failed"
}

# J2: Verify pagination structure
if ($listResp -and ($listResp.total -ne $null -or $listResp.meta)) {
    Pass "J2: Pagination structure present (total/meta)"
} elseif ($listResp -and $listResp.data) {
    Warn "J2: Response has data but no clear pagination"
} else {
    Warn "J2: Cannot verify pagination"
}

# J3: GET /debt-netting/history/:counterpartyId
$histResp = D (Api "GET" "/debt-netting/history/$CUSTOMER_ID" $CFO)
if ($histResp -ne $null) {
    if ($histResp.Count -gt 0) {
        Pass "J3: History returned $($histResp.Count) entries for customer"
    } else {
        Warn "J3: History returned 0 entries"
    }
} else {
    Warn "J3: History endpoint returned null"
}

# J4: Verify history entries have expected fields
if ($histResp -and $histResp.Count -gt 0) {
    $entry = $histResp[0]
    if ($entry.code -and $entry.status -and $entry.netAmount -ne $null) {
        Pass "J4: History entry has code, status, netAmount fields"
    } else {
        Warn "J4: History entry missing expected fields"
    }
} else {
    Warn "J4: Skipped - no history entries"
}

# ================================================================
# PART K: Journal entry check (event-driven, may not exist)
# ================================================================
Write-Host ""
Write-Host "=== PART K: Journal entry verification ===" -ForegroundColor Cyan

# Try to find journal entries related to netting
$glResp = D (Api "GET" "/general-ledger/journal-entries?limit=20" $KETOAN)
if ($glResp -ne $null) {
    $nettingEntries = @()
    $items = if ($glResp.Count) { $glResp } elseif ($glResp.data) { $glResp.data } else { @() }
    foreach ($je in $items) {
        $ref = "$($je.reference)$($je.description)$($je.note)"
        if ($ref -match "(?i)nett|NET-|bu.tr") {
            $nettingEntries += $je
        }
    }
    if ($nettingEntries.Count -gt 0) {
        Pass "K1: Found $($nettingEntries.Count) journal entries related to netting"
        # K2: Verify double-entry (debit = credit)
        $je0 = $nettingEntries[0]
        if ($je0.lines -and $je0.lines.Count -ge 2) {
            Pass "K2: Journal entry has multiple lines (double-entry)"
        } elseif ($je0.debit -and $je0.credit) {
            Pass "K2: Journal entry has debit + credit"
        } else {
            Warn "K2: Cannot verify double-entry structure"
        }
    } else {
        Warn "K1: No journal entries found for netting (event listener may not create JE)"
        Warn "K2: Skipped"
    }
} else {
    Warn "K1: Cannot query journal entries"
    Warn "K2: Skipped"
}

# ================================================================
# SUMMARY
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-FIN-004 SUMMARY" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host "  TOTAL: $($passCount + $failCount + $warnCount)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Cyan
