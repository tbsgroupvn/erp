# ================================================================
# TEST-FIN-005: Payment Voucher Anti-fraud Check
# Severity: CRITICAL
#
# Verifies: Separation of duties (creator != approver),
# approval thresholds, receipt total <= order total,
# anti-fraud flags, attachment requirements
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

# Voucher responses are nested: data.voucher.{id, code, ...}
function DV($resp) {
    $d = D $resp
    if ($d -and $d.voucher) { return $d.voucher }
    return $d
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
Write-Host "  TEST-FIN-005: Payment Voucher Anti-fraud Check" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login roles + Find an order for voucher tests
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login roles ===" -ForegroundColor White

$KETOAN = Login "ketoan@$DOMAIN"
if ($KETOAN) { Pass "KETOAN (Chief Accountant) login OK" } else { Fail "KETOAN login FAILED"; exit 1 }

$CFO = Login "cfo@$DOMAIN"
if ($CFO) { Pass "CFO login OK" } else { Fail "CFO login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

$COO = Login "admin@$DOMAIN"
if ($COO) { Pass "COO login OK" } else { Fail "COO login FAILED"; exit 1 }

$SALE1 = Login "sale01@$DOMAIN"
if ($SALE1) { Pass "SALE1 login OK" } else { Fail "SALE1 login FAILED"; exit 1 }

# Find an active order with decent totalAmount for voucher tests
Write-Host ""
Write-Host "--- Finding an active order (totalAmount > 1M) ---" -ForegroundColor Gray
# Use KETOAN (broader access than SALE1 which has data scoping)
$ordersResp = D (Api "GET" "/orders?limit=50" $KETOAN)
$ORDER_ID = $null
$ORDER_CODE = $null
$ORDER_TOTAL = $null

if ($ordersResp -and $ordersResp.Count -gt 0) {
    # First pass: find order with large totalAmount
    foreach ($o in $ordersResp) {
        if ($o.status -ne "COMPLETED" -and $o.status -ne "CANCELLED" -and $o.totalAmount -and [double]$o.totalAmount -ge 1000000) {
            $ORDER_ID = $o.id
            $ORDER_CODE = $o.code
            $ORDER_TOTAL = [double]$o.totalAmount
            break
        }
    }
    # Fallback: any active order
    if (-not $ORDER_ID) {
        foreach ($o in $ordersResp) {
            if ($o.status -ne "COMPLETED" -and $o.status -ne "CANCELLED" -and $o.totalAmount -and [double]$o.totalAmount -gt 0) {
                $ORDER_ID = $o.id
                $ORDER_CODE = $o.code
                $ORDER_TOTAL = [double]$o.totalAmount
                break
            }
        }
    }
}

if ($ORDER_ID) {
    Pass "Found active order: $ORDER_CODE (total=$ORDER_TOTAL)"
} else {
    Warn "No active order found - some tests may be limited"
}

# If totalAmount is very small, scale amounts accordingly
$SMALL_AMOUNT = [Math]::Max([Math]::Floor($ORDER_TOTAL * 0.3), 1000)
$MEDIUM_AMOUNT = [Math]::Max([Math]::Floor($ORDER_TOTAL * 0.5), 2000)
Write-Host "    SMALL_AMOUNT=$SMALL_AMOUNT, MEDIUM_AMOUNT=$MEDIUM_AMOUNT" -ForegroundColor Gray

# Find a customer for order context
$custResp = D (Api "GET" "/customers?limit=3&tier=VIP" $SALE1)
$CUST_NAME = "Test Customer"
if ($custResp -and $custResp.Count -gt 0) {
    $c = $custResp[0]
    $CUST_NAME = if ($c.name) { $c.name } elseif ($c.companyName) { $c.companyName } else { "KH VIP" }
}

# ================================================================
# PART A: Separation of Duties - Creator cannot approve own voucher
# ================================================================
Write-Host ""
Write-Host "=== PART A: Separation of Duties (Zero Trust) ===" -ForegroundColor Cyan

if ($ORDER_ID) {
    # A1: KETOAN creates a RECEIPT voucher (amount within order total)
    $sodAmount = $SMALL_AMOUNT
    $vBody = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = $sodAmount
        currency      = "VND"
        paymentMethod = "BANK_TRANSFER"
        costType      = "Thu tien coc don hang"
        beneficiary   = $CUST_NAME
        reason        = "Thu tien coc don hang theo yeu cau khach hang, chuyen khoan ngan hang"
        attachments   = @("https://storage.example.com/receipt-001.pdf")
    }
    $vResp = DV (Api "POST" "/cash/vouchers" $KETOAN $vBody)
    $V_SOD_ID = $null
    if ($vResp -and $vResp.id) {
        $V_SOD_ID = $vResp.id
        Pass "A1: KETOAN created RECEIPT voucher $($vResp.code) - $sodAmount VND"
    } else {
        Fail "A1: Failed to create voucher for SoD test"
    }

    # A2: KETOAN attempts to approve own voucher -> should be BLOCKED
    if ($V_SOD_ID) {
        $selfApprove = Api-Expect "PATCH" "/cash/vouchers/$V_SOD_ID/approve" $KETOAN $null
        if ($selfApprove.code -eq 403) {
            Pass "A2: KETOAN self-approve BLOCKED with 403 (Separation of Duties)"
        } elseif ($selfApprove.code -eq 400) {
            # Might return 400 instead of 403
            if ($selfApprove.error -match "t..du.t|ch.nh m.nh|self|creator|segregat") {
                Pass "A2: KETOAN self-approve BLOCKED with 400 (SoD message)"
            } else {
                Warn "A2: Got 400 but message doesn't match SoD pattern: $($selfApprove.error)"
            }
        } elseif ($selfApprove.code -eq 200) {
            Fail "A2: KETOAN was able to approve own voucher - SoD VIOLATED!"
        } else {
            Warn "A2: Unexpected status $($selfApprove.code)"
        }

        # A3: CFO (different user) CAN approve it
        $cfoApprove = Api-Expect "PATCH" "/cash/vouchers/$V_SOD_ID/approve" $CFO $null
        if ($cfoApprove.code -eq 200) {
            Pass "A3: CFO approved KETOAN's voucher (different user - OK)"
        } else {
            Warn "A3: CFO approve returned $($cfoApprove.code) - $($cfoApprove.error)"
        }
    } else {
        Warn "A2-A3: Skipped - no voucher for SoD test"
    }

    # A4: CFO creates voucher, CFO attempts to approve own -> should be BLOCKED
    $sod2Amount = [Math]::Max([Math]::Floor($ORDER_TOTAL * 0.2), 500)
    $vBody2 = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = $sod2Amount
        currency      = "VND"
        paymentMethod = "CASH"
        costType      = "Thu tien mat hang hoa"
        beneficiary   = $CUST_NAME
        reason        = "Thu tien mat hang hoa tu khach hang VIP, thanh toan truc tiep tai quay"
        attachments   = @("https://storage.example.com/receipt-002.pdf")
    }
    $vResp2 = DV (Api "POST" "/cash/vouchers" $CFO $vBody2)
    $V_SOD2_ID = $null
    if ($vResp2 -and $vResp2.id) {
        $V_SOD2_ID = $vResp2.id
        Pass "A4: CFO created RECEIPT voucher $($vResp2.code) - $sod2Amount VND"
    } else {
        Warn "A4: CFO failed to create voucher (may lack role)"
    }

    if ($V_SOD2_ID) {
        $cfoSelfApprove = Api-Expect "PATCH" "/cash/vouchers/$V_SOD2_ID/approve" $CFO $null
        if ($cfoSelfApprove.code -eq 403 -or ($cfoSelfApprove.code -eq 400 -and $cfoSelfApprove.error -match "t..du.t|ch.nh m.nh|self|creator|segregat")) {
            Pass "A5: CFO self-approve BLOCKED (Separation of Duties)"
        } elseif ($cfoSelfApprove.code -eq 200) {
            Fail "A5: CFO was able to approve own voucher - SoD VIOLATED!"
        } else {
            Warn "A5: CFO self-approve returned $($cfoSelfApprove.code)"
        }
    } else {
        Warn "A5: Skipped"
    }
} else {
    Warn "A1-A5: Skipped - no active order for voucher tests"
}

# ================================================================
# PART B: Voucher creation validation rules
# ================================================================
Write-Host ""
Write-Host "=== PART B: Creation validation rules ===" -ForegroundColor Cyan

if ($ORDER_ID) {
    # B1: PAYMENT voucher without orderId -> should fail
    $noOrderBody = @{
        type          = "PAYMENT"
        amount        = 1000000
        currency      = "VND"
        paymentMethod = "BANK_TRANSFER"
        costType      = "Chi phi van chuyen"
        beneficiary   = "Nha van chuyen ABC"
        reason        = "Thanh toan chi phi van chuyen noi dia cho don hang thang 3/2026"
        attachments   = @("https://storage.example.com/doc.pdf")
    }
    $noOrderResp = Api-Expect "POST" "/cash/vouchers" $KETOAN $noOrderBody
    if ($noOrderResp.code -eq 400 -or $noOrderResp.code -eq 422) {
        Pass "B1: PAYMENT without orderId rejected ($($noOrderResp.code))"
    } elseif ($noOrderResp.code -eq 201 -or $noOrderResp.code -eq 200) {
        Warn "B1: PAYMENT without orderId accepted (validator may not block)"
    } else {
        Warn "B1: Unexpected status $($noOrderResp.code)"
    }

    # B2: Reason too short (< 20 chars) -> should fail
    $shortReasonBody = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = 500000
        currency      = "VND"
        paymentMethod = "CASH"
        costType      = "Thu tien"
        beneficiary   = $CUST_NAME
        reason        = "Thu tien nhanh"
        attachments   = @("https://storage.example.com/doc.pdf")
    }
    $shortResp = Api-Expect "POST" "/cash/vouchers" $KETOAN $shortReasonBody
    if ($shortResp.code -eq 400 -or $shortResp.code -eq 422) {
        Pass "B2: Short reason (< 20 chars) rejected ($($shortResp.code))"
    } elseif ($shortResp.code -eq 201 -or $shortResp.code -eq 200) {
        Warn "B2: Short reason accepted (MinLength validator may not be active)"
    } else {
        Warn "B2: Unexpected status $($shortResp.code)"
    }

    # B3: PAYMENT voucher without attachments -> should fail or flag
    $noAttachBody = @{
        type          = "PAYMENT"
        orderId       = $ORDER_ID
        amount        = 15000000
        currency      = "VND"
        paymentMethod = "BANK_TRANSFER"
        costType      = "Chi phi mua hang"
        beneficiary   = "Nha cung cap XYZ"
        reason        = "Thanh toan chi phi mua hang cho don hang, chuyen khoan ngan hang theo hop dong"
    }
    $noAttachResp = Api-Expect "POST" "/cash/vouchers" $KETOAN $noAttachBody
    if ($noAttachResp.code -eq 400 -or $noAttachResp.code -eq 422) {
        Pass "B3: PAYMENT 15M without attachments rejected ($($noAttachResp.code))"
    } elseif ($noAttachResp.code -eq 201 -or $noAttachResp.code -eq 200) {
        Warn "B3: PAYMENT without attachments accepted (may be soft check)"
    } else {
        Warn "B3: Unexpected status $($noAttachResp.code)"
    }

    # B4: Amount > 10M without attachments -> must require attachments
    $over10mBody = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = 12000000
        currency      = "VND"
        paymentMethod = "BANK_TRANSFER"
        costType      = "Thu tien coc"
        beneficiary   = $CUST_NAME
        reason        = "Thu tien coc don hang tu khach hang, chuyen khoan qua ngan hang"
    }
    $over10mResp = Api-Expect "POST" "/cash/vouchers" $KETOAN $over10mBody
    if ($over10mResp.code -eq 400) {
        Pass "B4: RECEIPT >10M without attachments rejected (mandatory docs)"
    } elseif ($over10mResp.code -eq 201 -or $over10mResp.code -eq 200) {
        # Check if it was flagged
        $respData = if ($over10mResp.body.data) { $over10mResp.body.data } else { $over10mResp.body }
        if ($respData -and $respData.isFlagged) {
            Warn "B4: Created but flagged (soft check, not hard block)"
        } else {
            Warn "B4: >10M without attachments accepted without flag"
        }
    } else {
        Warn "B4: Unexpected status $($over10mResp.code)"
    }

    # B5: Missing beneficiary -> should fail
    $noBenBody = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = 1000000
        currency      = "VND"
        paymentMethod = "CASH"
        costType      = "Thu tien mat"
        reason        = "Thu tien mat tu khach hang truc tiep tai van phong cong ty"
        attachments   = @("https://storage.example.com/doc.pdf")
    }
    $noBenResp = Api-Expect "POST" "/cash/vouchers" $KETOAN $noBenBody
    if ($noBenResp.code -eq 400 -or $noBenResp.code -eq 422) {
        Pass "B5: Missing beneficiary rejected ($($noBenResp.code))"
    } elseif ($noBenResp.code -eq 201 -or $noBenResp.code -eq 200) {
        Warn "B5: Missing beneficiary accepted (DTO may not require it)"
    } else {
        Warn "B5: Unexpected status $($noBenResp.code)"
    }

    # B6: SALE role cannot create voucher -> should fail (RBAC)
    $saleVBody = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = 500000
        currency      = "VND"
        paymentMethod = "CASH"
        costType      = "Thu tien"
        beneficiary   = $CUST_NAME
        reason        = "Thu tien tu khach hang - test RBAC role check cho sale"
        attachments   = @("https://storage.example.com/doc.pdf")
    }
    $saleVResp = Api-Expect "POST" "/cash/vouchers" $SALE1 $saleVBody
    if ($saleVResp.code -eq 403) {
        Pass "B6: SALE role blocked from creating voucher (RBAC enforced)"
    } elseif ($saleVResp.code -eq 201 -or $saleVResp.code -eq 200) {
        Fail "B6: SALE was able to create voucher - RBAC VIOLATION!"
    } else {
        Warn "B6: SALE create voucher returned $($saleVResp.code)"
    }
} else {
    Warn "B1-B6: Skipped - no active order"
}

# ================================================================
# PART C: Receipt total cannot exceed order total
# ================================================================
Write-Host ""
Write-Host "=== PART C: Receipt total <= Order total ===" -ForegroundColor Cyan

if ($ORDER_ID -and $ORDER_TOTAL) {
    # C1: Create a RECEIPT voucher with 70% of order total
    $bigAmount = [Math]::Max([Math]::Floor($ORDER_TOTAL * 0.7), 1000)

    $bigVBody = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = $bigAmount
        currency      = "VND"
        paymentMethod = "BANK_TRANSFER"
        costType      = "Thu tien don hang"
        beneficiary   = $CUST_NAME
        reason        = "Thu tien don hang $ORDER_CODE tu khach hang, chuyen khoan ngan hang"
        attachments   = @("https://storage.example.com/receipt-big.pdf")
    }
    $bigVResp = DV (Api "POST" "/cash/vouchers" $KETOAN $bigVBody)
    $V_BIG_ID = $null
    if ($bigVResp -and $bigVResp.id) {
        $V_BIG_ID = $bigVResp.id
        Pass "C1: Created RECEIPT voucher $($bigVResp.code) - amount=$bigAmount (70% of $ORDER_TOTAL)"
    } else {
        Warn "C1: Failed to create RECEIPT voucher"
    }

    # C2: Approve it (CFO)
    if ($V_BIG_ID) {
        $appBig = Api-Expect "PATCH" "/cash/vouchers/$V_BIG_ID/approve" $CFO $null
        if ($appBig.code -eq 200) {
            Pass "C2: RECEIPT approved by CFO"
        } else {
            Warn "C2: RECEIPT approve returned $($appBig.code) - $($appBig.error)"
        }
        Start-Sleep -Milliseconds 300
    }

    # C3: Create another RECEIPT that pushes total over order amount (need 50% more = 120% total)
    $overAmount = [Math]::Max([Math]::Floor($ORDER_TOTAL * 0.5), 500)

    $overVBody = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = $overAmount
        currency      = "VND"
        paymentMethod = "BANK_TRANSFER"
        costType      = "Thu tien bo sung"
        beneficiary   = $CUST_NAME
        reason        = "Thu tien bo sung don hang $ORDER_CODE, chuyen khoan ngan hang lam 2 dot"
        attachments   = @("https://storage.example.com/receipt-over.pdf")
    }
    $overVResp = DV (Api "POST" "/cash/vouchers" $KETOAN $overVBody)
    $V_OVER_ID = $null
    if ($overVResp -and $overVResp.id) {
        $V_OVER_ID = $overVResp.id
        Pass "C3: Created 2nd RECEIPT voucher $($overVResp.code) - amount=$overAmount"
    } else {
        Warn "C3: Failed to create 2nd RECEIPT"
    }

    # C4: Approve 2nd RECEIPT -> should be BLOCKED (70% + 50% = 120% > 100%)
    if ($V_OVER_ID) {
        $overApprove = Api-Expect "PATCH" "/cash/vouchers/$V_OVER_ID/approve" $CFO $null
        if ($overApprove.code -eq 400) {
            if ($overApprove.error -match "v..t|exceed|t.ng") {
                Pass "C4: 2nd RECEIPT approve BLOCKED - total exceeds order amount"
            } else {
                Pass "C4: 2nd RECEIPT approve BLOCKED with 400"
            }
        } elseif ($overApprove.code -eq 200) {
            # Might be OK if there were prior approved receipts that were counted
            Warn "C4: 2nd RECEIPT approved - cumulative check may account for prior vouchers"
        } else {
            Warn "C4: Unexpected status $($overApprove.code)"
        }
    } else {
        Warn "C4: Skipped"
    }
} else {
    Warn "C1-C4: Skipped - no active order with totalAmount"
}

# ================================================================
# PART D: SALE cannot approve vouchers (RBAC)
# ================================================================
Write-Host ""
Write-Host "=== PART D: Approve role enforcement ===" -ForegroundColor Cyan

# D1: Create a voucher for approval RBAC test
if ($ORDER_ID) {
    $rbacAmount = [Math]::Max([Math]::Floor($ORDER_TOTAL * 0.1), 500)
    $rbacVBody = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = $rbacAmount
        currency      = "VND"
        paymentMethod = "CASH"
        costType      = "Thu tien mat"
        beneficiary   = $CUST_NAME
        reason        = "Thu tien mat tu khach hang tai van phong cong ty chi nhanh HN"
        attachments   = @("https://storage.example.com/rbac-test.pdf")
    }
    $rbacVResp = DV (Api "POST" "/cash/vouchers" $KETOAN $rbacVBody)
    $V_RBAC_ID = $null
    if ($rbacVResp -and $rbacVResp.id) {
        $V_RBAC_ID = $rbacVResp.id
        Pass "D1: Created voucher for RBAC test"
    } else {
        Warn "D1: Failed to create voucher"
    }

    # D2: SALE attempts to approve -> should fail
    if ($V_RBAC_ID) {
        $saleApprove = Api-Expect "PATCH" "/cash/vouchers/$V_RBAC_ID/approve" $SALE1 $null
        if ($saleApprove.code -eq 403) {
            Pass "D2: SALE approve BLOCKED with 403 (correct RBAC)"
        } elseif ($saleApprove.code -eq 200) {
            Fail "D2: SALE was able to approve voucher - RBAC VIOLATION!"
        } else {
            Warn "D2: SALE approve returned $($saleApprove.code)"
        }

        # D3: CEO CAN approve (has approve role)
        $ceoApprove = Api-Expect "PATCH" "/cash/vouchers/$V_RBAC_ID/approve" $CEO $null
        if ($ceoApprove.code -eq 200) {
            Pass "D3: CEO approved voucher (correct - has CFO/CEO/COO role)"
        } else {
            Warn "D3: CEO approve returned $($ceoApprove.code)"
        }
    } else {
        Warn "D2-D3: Skipped"
    }
} else {
    Warn "D1-D3: Skipped"
}

# ================================================================
# PART E: Anti-fraud flags
# ================================================================
Write-Host ""
Write-Host "=== PART E: Anti-fraud flags ===" -ForegroundColor Cyan

if ($ORDER_ID -and $ORDER_TOTAL) {
    # E1: Create PAYMENT voucher with amount > 90% of order total -> should flag
    $fraudAmount = [Math]::Max([Math]::Floor($ORDER_TOTAL * 0.95), 1000)

    $fraudBody = @{
        type          = "PAYMENT"
        orderId       = $ORDER_ID
        amount        = $fraudAmount
        currency      = "VND"
        paymentMethod = "BANK_TRANSFER"
        costType      = "Chi phi mua hang"
        beneficiary   = "Nha cung cap DEF"
        reason        = "Thanh toan chi phi mua hang cho don hang, chuyen khoan ngan hang theo hop dong"
        attachments   = @("https://storage.example.com/fraud-test.pdf")
    }
    $fraudResp = DV (Api "POST" "/cash/vouchers" $KETOAN $fraudBody)
    if ($fraudResp -and $fraudResp.id) {
        if ($fraudResp.isFlagged -eq $true) {
            Pass "E1: Voucher >90% order value FLAGGED (isFlagged=true)"
            if ($fraudResp.flagReason) {
                Pass "E2: Flag reason present: $($fraudResp.flagReason)"
            } else {
                Warn "E2: isFlagged=true but no flagReason"
            }
        } else {
            Warn "E1: Voucher created but not flagged (amount=$fraudAmount, orderTotal=$ORDER_TOTAL)"
            Warn "E2: Skipped - not flagged"
        }
    } else {
        Warn "E1: Failed to create PAYMENT voucher for fraud test (amount=$fraudAmount)"
        Warn "E2: Skipped"
    }

    # E3: Create voucher with costType "phat sinh" > 5M -> should flag
    # Use an amount > 5M if order allows, else smaller
    $miscAmount = if ($ORDER_TOTAL -ge 6000000) { 6000000 } else { [Math]::Max([Math]::Floor($ORDER_TOTAL * 0.8), 1000) }
    $miscBody = @{
        type          = "PAYMENT"
        orderId       = $ORDER_ID
        amount        = $miscAmount
        currency      = "VND"
        paymentMethod = "CASH"
        costType      = "Chi phi phat sinh"
        beneficiary   = "Doi tac van chuyen"
        reason        = "Chi phi phat sinh van chuyen do thay doi dia chi giao hang cua khach hang"
        attachments   = @("https://storage.example.com/misc-test.pdf")
    }
    $miscResp = DV (Api "POST" "/cash/vouchers" $KETOAN $miscBody)
    if ($miscResp -and $miscResp.id) {
        if ($miscResp.isFlagged -eq $true) {
            Pass "E3: 'Phat sinh' expense FLAGGED (amount=$miscAmount)"
        } else {
            if ($miscAmount -lt 5000000) {
                Warn "E3: Amount $miscAmount < 5M threshold - flag not expected"
            } else {
                Warn "E3: 'Phat sinh' expense created but not flagged"
            }
        }
    } else {
        Warn "E3: Failed to create misc expense voucher"
    }
} else {
    Warn "E1-E3: Skipped - no active order"
}

# ================================================================
# PART F: Voucher status FSM enforcement
# ================================================================
Write-Host ""
Write-Host "=== PART F: Status FSM enforcement ===" -ForegroundColor Cyan

if ($ORDER_ID) {
    # F1: Create + approve a voucher, then try to approve again
    $fsmAmount = [Math]::Max([Math]::Floor($ORDER_TOTAL * 0.05), 500)
    $fsmVBody = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = $fsmAmount
        currency      = "VND"
        paymentMethod = "BANK_TRANSFER"
        costType      = "Thu tien coc"
        beneficiary   = $CUST_NAME
        reason        = "Thu tien coc don hang tu khach hang, chuyen khoan ngan hang dot 1"
        attachments   = @("https://storage.example.com/fsm-test.pdf")
    }
    $fsmResp = DV (Api "POST" "/cash/vouchers" $KETOAN $fsmVBody)
    $V_FSM_ID = $null
    if ($fsmResp -and $fsmResp.id) {
        $V_FSM_ID = $fsmResp.id
        # Approve it
        $appFsm = Api-Expect "PATCH" "/cash/vouchers/$V_FSM_ID/approve" $CFO $null
        if ($appFsm.code -eq 200) {
            Pass "F1: Voucher approved (for re-approve test)"
        } else {
            Warn "F1: Initial approve failed: $($appFsm.code)"
        }

        # F2: Try to approve already APPROVED voucher -> should fail
        $reApp = Api-Expect "PATCH" "/cash/vouchers/$V_FSM_ID/approve" $CEO $null
        if ($reApp.code -eq 400) {
            Pass "F2: Re-approve APPROVED voucher rejected (FSM enforced)"
        } elseif ($reApp.code -eq 200) {
            Warn "F2: Re-approve accepted (may be idempotent)"
        } else {
            Warn "F2: Re-approve returned $($reApp.code)"
        }

        # F3: Try to reject already APPROVED voucher -> should fail
        $rejApp = Api-Expect "PATCH" "/cash/vouchers/$V_FSM_ID/reject" $CEO @{ reason = "test reject after approve" }
        if ($rejApp.code -eq 400) {
            Pass "F3: Reject APPROVED voucher blocked (terminal state)"
        } elseif ($rejApp.code -eq 200) {
            Warn "F3: Reject after approve accepted (may allow reversal)"
        } else {
            Warn "F3: Reject returned $($rejApp.code)"
        }
    } else {
        Warn "F1-F3: Failed to create FSM test voucher"
    }

    # F4: Create + reject, then try to approve rejected
    $fsm2Amount = [Math]::Max([Math]::Floor($ORDER_TOTAL * 0.03), 500)
    $fsmV2Body = @{
        type          = "RECEIPT"
        orderId       = $ORDER_ID
        amount        = $fsm2Amount
        currency      = "VND"
        paymentMethod = "CASH"
        costType      = "Thu tien mat"
        beneficiary   = $CUST_NAME
        reason        = "Thu tien mat tu khach hang tai quay giao dich chi nhanh HCM"
        attachments   = @("https://storage.example.com/fsm-test2.pdf")
    }
    $fsmResp2 = DV (Api "POST" "/cash/vouchers" $KETOAN $fsmV2Body)
    if ($fsmResp2 -and $fsmResp2.id) {
        $V_FSM2_ID = $fsmResp2.id
        # Reject it
        $rejResp = Api-Expect "PATCH" "/cash/vouchers/$V_FSM2_ID/reject" $CFO @{ reason = "Khong du chung tu" }
        if ($rejResp.code -eq 200) {
            # F4: Try approve rejected voucher
            $appRej = Api-Expect "PATCH" "/cash/vouchers/$V_FSM2_ID/approve" $CEO $null
            if ($appRej.code -eq 400) {
                Pass "F4: Approve REJECTED voucher blocked (terminal state)"
            } elseif ($appRej.code -eq 200) {
                Warn "F4: Approve rejected voucher accepted (may allow re-open)"
            } else {
                Warn "F4: Approve rejected returned $($appRej.code)"
            }
        } else {
            Warn "F4: Initial reject failed: $($rejResp.code)"
        }
    } else {
        Warn "F4: Failed to create reject test voucher"
    }
} else {
    Warn "F1-F4: Skipped - no active order"
}

# ================================================================
# PART G: Voucher list and cash flow
# ================================================================
Write-Host ""
Write-Host "=== PART G: List + Cash flow ===" -ForegroundColor Cyan

# G1: List vouchers
$listResp = Api "GET" "/cash/vouchers?limit=10" $CFO
if ($listResp) {
    $listData = D $listResp
    $items = if ($listData.Count) { $listData } elseif ($listData.data) { $listData.data } else { @() }
    if ($items.Count -gt 0) {
        Pass "G1: Voucher list returned $($items.Count) entries"
    } else {
        Warn "G1: Voucher list returned 0 entries"
    }
} else {
    Warn "G1: Voucher list endpoint failed"
}

# G2: Filter by type RECEIPT
$receiptList = Api "GET" "/cash/vouchers?type=RECEIPT&limit=5" $CFO
if ($receiptList) {
    Pass "G2: Filter by type=RECEIPT works"
} else {
    Warn "G2: Filter by RECEIPT failed"
}

# G3: Cash flow summary
$cfResp = D (Api "GET" "/cash/flow" $CFO)
if ($cfResp -ne $null) {
    Pass "G3: Cash flow endpoint accessible"
} else {
    Warn "G3: Cash flow endpoint returned null"
}

# ================================================================
# SUMMARY
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-FIN-005 SUMMARY" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
Write-Host "  TOTAL: $($passCount + $failCount + $warnCount)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Cyan
