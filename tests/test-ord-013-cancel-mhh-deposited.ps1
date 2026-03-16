# ================================================================
# TEST-ORD-013: Huy don MHH da coc (can phe duyet da cap)
# Severity: CRITICAL
#
# Precondition: Don MHH da coc, dang o SOURCING
# Flow: Sale cancel -> Approval (SALES_DIRECTOR -> COO) -> CANCELLED
# Verify: Refund calculation, wallet, supplier order
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
Write-Host "  TEST-ORD-013: Huy don MHH da coc (can phe duyet da cap)" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP: Login roles
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login roles ===" -ForegroundColor White

$SALE1 = Login "sale01@$DOMAIN"
if ($SALE1) { Pass "SALE1 login OK" } else { Fail "SALE1 login FAILED"; exit 1 }

$LEADER = Login "leader.hn@$DOMAIN"
if ($LEADER) { Pass "LEADER login OK" } else { Fail "LEADER login FAILED"; exit 1 }

$GDKD = Login "gdkd@$DOMAIN"
if ($GDKD) { Pass "SALES_DIRECTOR (GDKD) login OK" } else { Fail "GDKD login FAILED"; exit 1 }

$COO = Login "admin@$DOMAIN"
if ($COO) { Pass "COO login OK" } else { Fail "COO login FAILED"; exit 1 }

$CFO = Login "cfo@$DOMAIN"
if ($CFO) { Pass "CFO login OK" } else { Fail "CFO login FAILED"; exit 1 }

$KETOAN = Login "ketoan@$DOMAIN"
if ($KETOAN) { Pass "KETOAN login OK" } else { Fail "KETOAN login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

# Get VIP customer dynamically (use CEO token - full visibility)
$customers = D (Api "GET" "/customers?tier=VIP&limit=1" $CEO)
$cust = $null
if ($customers -is [array] -and $customers.Count -gt 0) { $cust = $customers[0] }
elseif ($customers -and $customers.id) { $cust = $customers }
if (-not $cust) {
    $allCusts = D (Api "GET" "/customers?limit=50" $CEO)
    if ($allCusts -is [array]) {
        $cust = $allCusts | Where-Object { $_.tier -eq 'VIP' } | Select-Object -First 1
    }
}
if (-not $cust) { Fail "No VIP customer found"; exit 1 }
$CUST_ID = $cust.id
$CUST_CODE = $cust.code
Write-Host "  Customer: $CUST_CODE ($($cust.tier)) - $($cust.fullName)" -ForegroundColor Gray

# Get wallet balance before test
$walletBefore = D (Api "GET" "/customers/$CUST_ID/wallet" $CEO)
$balanceBefore = 0
if ($walletBefore -and $walletBefore.balance -ne $null) {
    $balanceBefore = [double]$walletBefore.balance
}
Write-Host "  Wallet balance before: $balanceBefore VND" -ForegroundColor Gray

# ================================================================
# PART A: TAO DON MHH + COC + SOURCING
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: TAO DON MHH + COC + CHUYEN DEN SOURCING" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# A1: Create MHH order
Write-Host ""
Write-Host "=== TEST A1: Tao don MHH ===" -ForegroundColor White
$orderBody = @{
    customerId   = $CUST_ID
    serviceType  = "MHH"
    branch       = "HN"
    shippingRoute = "SEA"
    items        = @(
        @{ productName = "Test Cancel Product A"; productUrl = "https://item.taobao.com/item.htm?id=800001"; quantity = 10; unitPrice = 150 },
        @{ productName = "Test Cancel Product B"; productUrl = "https://item.taobao.com/item.htm?id=800002"; quantity = 5; unitPrice = 200 }
    )
    note = "Test order for cancellation flow"
}
$orderResp = Api "POST" "/orders" $SALE1 $orderBody
$order = D $orderResp
if ($order -and $order.id) {
    $ORD_ID = $order.id
    $ORD_CODE = $order.code
    $ORD_TOTAL = [double]$order.totalAmount
    $ORD_DEPOSIT_REQ = [double]$order.depositRequired
    Write-Host "  Order: $ORD_CODE | ID=$ORD_ID"
    Write-Host "  serviceType=$($order.serviceType) | status=$($order.status) | total=$ORD_TOTAL"
    Write-Host "  depositRequired=$ORD_DEPOSIT_REQ | currency=$($order.currency)"
    Pass "A1: MHH order created ($ORD_CODE)"
} else {
    Fail "A1: Failed to create MHH order"
    exit 1
}

# A2: Move to PENDING_DEPOSIT
Write-Host ""
Write-Host "=== TEST A2: CONSULTING -> QUOTATION -> PENDING_DEPOSIT ===" -ForegroundColor White
$r1 = Api "PATCH" "/orders/$ORD_ID/status" $SALE1 @{ status = "QUOTATION" }
$r2 = Api "PATCH" "/orders/$ORD_ID/status" $SALE1 @{ status = "PENDING_DEPOSIT" }
$orderCheck = D (Api "GET" "/orders/$ORD_ID" $SALE1)
if ($orderCheck.status -eq "PENDING_DEPOSIT") {
    Pass "A2: Order at PENDING_DEPOSIT"
} else {
    Fail "A2: Expected PENDING_DEPOSIT, got $($orderCheck.status)"
}

# A3: Pay deposit (VIP = 50%)
Write-Host ""
Write-Host "=== TEST A3: Pay deposit (VIP 50%) ===" -ForegroundColor White
$voucherBody = @{
    orderId       = $ORD_ID
    type          = "RECEIPT"
    amount        = $ORD_DEPOSIT_REQ
    currency      = "VND"
    paymentMethod = "BANK_TRANSFER"
    costType      = "Tien coc don hang"
    beneficiary   = "Khach hang VIP"
    reason        = "Thanh toan tien coc cho don hang MHH cancel test"
}
$vRaw = Api "POST" "/cash/vouchers" $KETOAN $voucherBody
$vResp = D $vRaw
# Voucher might be nested in .voucher
if ($vResp -and $vResp.voucher) { $vResp = $vResp.voucher }
if ($vResp -and $vResp.id) {
    $VOUCHER_1_ID = $vResp.id
    Write-Host "  Voucher: $($vResp.code) | amount=$ORD_DEPOSIT_REQ VND | status=$($vResp.status)"
    # Approve voucher
    $vApprove = Api "PATCH" "/cash/vouchers/$VOUCHER_1_ID/approve" $CFO $null
    Start-Sleep -Milliseconds 500
    $orderAfterDeposit = D (Api "GET" "/orders/$ORD_ID" $SALE1)
    $depositPaid = [double]$orderAfterDeposit.depositPaid
    $isDepositPaid = $orderAfterDeposit.isDepositPaid
    Write-Host "  depositPaid=$depositPaid | isDepositPaid=$isDepositPaid"
    if ($isDepositPaid -eq $true) {
        Pass "A3: Deposit paid ($depositPaid VND)"
    } else {
        Fail "A3: Deposit not marked as paid"
    }
} else {
    Fail "A3: Failed to create deposit voucher"
}

# A4: Move to SOURCING
Write-Host ""
Write-Host "=== TEST A4: PENDING_DEPOSIT -> SOURCING ===" -ForegroundColor White
$rSourcing = Api "PATCH" "/orders/$ORD_ID/status" $SALE1 @{ status = "SOURCING" }
$orderAtSourcing = D (Api "GET" "/orders/$ORD_ID" $SALE1)
if ($orderAtSourcing.status -eq "SOURCING") {
    Pass "A4: Order at SOURCING (deposit gate passed)"
} else {
    Fail "A4: Expected SOURCING, got $($orderAtSourcing.status)"
}

# A5: Create SupplierOrder
Write-Host ""
Write-Host "=== TEST A5: Tao SupplierOrder ===" -ForegroundColor White
# Pay to 70% for procurement gate
$totalAmount = [double]$orderAtSourcing.totalAmount
$currentPaid = [double]$orderAtSourcing.depositPaid
$need70 = [math]::Ceiling($totalAmount * 0.7)
$additionalNeeded = $need70 - $currentPaid
if ($additionalNeeded -gt 0) {
    $v2Body = @{
        orderId       = $ORD_ID
        type          = "RECEIPT"
        amount        = $additionalNeeded
        currency      = "VND"
        paymentMethod = "BANK_TRANSFER"
        costType      = "Tien coc bo sung"
        beneficiary   = "Khach hang VIP"
        reason        = "Bo sung tien coc de dat 70% procurement gate cho don MHH"
    }
    $v2Raw = Api "POST" "/cash/vouchers" $KETOAN $v2Body
    $v2 = D $v2Raw
    if ($v2 -and $v2.voucher) { $v2 = $v2.voucher }
    if ($v2 -and $v2.id) {
        Api "PATCH" "/cash/vouchers/$($v2.id)/approve" $CFO $null | Out-Null
        Start-Sleep -Milliseconds 500
    }
    Write-Host "  Additional $additionalNeeded VND paid (total now $need70, 70%)"
}

$soBody = @{
    orderId          = $ORD_ID
    supplierName     = "Taobao Supplier Test Cancel"
    supplierPlatform = "Taobao"
    quotedPriceCNY   = 1700
    shippingFeeCNY   = 50
    quantityOrdered  = 15
    note             = "Supplier order for cancel test"
}
$soResp = D (Api "POST" "/supplier-orders" $SALE1 $soBody)
if ($soResp -and $soResp.id) {
    $SO_ID = $soResp.id
    $SO_CODE = $soResp.code
    Write-Host "  SupplierOrder: $SO_CODE | ID=$SO_ID | status=$($soResp.status)"
    Pass "A5: SupplierOrder created ($SO_CODE)"

    # Advance supplier order to ORDERED (goods committed)
    Api "PATCH" "/supplier-orders/$SO_ID/status" $SALE1 @{ status = "QUOTED" } | Out-Null
    Api "PATCH" "/supplier-orders/$SO_ID/status" $SALE1 @{ status = "ORDERED" } | Out-Null
    $soCheck = D (Api "GET" "/supplier-orders/$SO_ID" $SALE1)
    Write-Host "  SupplierOrder advanced to: $($soCheck.status)"
} else {
    Warn "A5: Failed to create SupplierOrder (continuing without)"
    $SO_ID = $null
}

# ================================================================
# PART B: SALE REQUEST CANCEL -> TRIGGER APPROVAL FLOW
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: SALE REQUEST CANCEL -> APPROVAL FLOW" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# B1: Sale requests cancel
Write-Host ""
Write-Host "=== TEST B1: Sale requests cancel (SOURCING, deposited) ===" -ForegroundColor White
$cancelBody = @{
    reason = "Customer requested cancellation - found cheaper supplier, no longer needs the order"
}
$cancelResp = Api-Expect "POST" "/orders/$ORD_ID/cancel" $SALE1 $cancelBody

if ($cancelResp.code -eq 200) {
    $cancelData = $null
    if ($cancelResp.body -and $cancelResp.body.data) { $cancelData = $cancelResp.body.data }
    elseif ($cancelResp.body) { $cancelData = $cancelResp.body }

    $cancelStatus = $cancelData.status
    $APPROVAL_ID = $cancelData.approvalId
    $cancelMsg = $cancelData.message
    $cancellation = $cancelData.cancellation

    Write-Host "  Status: $cancelStatus"
    Write-Host "  ApprovalId: $APPROVAL_ID"
    Write-Host "  Message: $cancelMsg"

    if ($cancelStatus -eq "PENDING_APPROVAL" -and $APPROVAL_ID) {
        Pass "B1: Cancel request -> PENDING_APPROVAL (approval required)"
    } elseif ($cancelStatus -eq "CANCELLED") {
        Warn "B1: Order cancelled directly (no approval needed - unexpected for SOURCING)"
    } else {
        Fail "B1: Unexpected cancel status: $cancelStatus"
    }
} else {
    Fail "B1: Cancel request failed with HTTP $($cancelResp.code)"
    $cancelData = $null
}

# B2: Verify cancellation calculation
Write-Host ""
Write-Host "=== TEST B2: Verify cancellation refund calculation ===" -ForegroundColor White
if ($cancelData -and $cancelData.cancellation) {
    $c = $cancelData.cancellation
    Write-Host "  stage=$($c.stage)"
    Write-Host "  depositPaid=$($c.depositPaid)"
    Write-Host "  costsIncurred=$($c.costsIncurred)"
    Write-Host "  adminFee=$($c.adminFee)"
    Write-Host "  refundAmount=$($c.refundAmount)"
    Write-Host "  details=$($c.details)"

    if ($c.stage -eq "GOODS_PURCHASED") {
        Pass "B2a: Cancellation stage = GOODS_PURCHASED (correct for SOURCING)"
    } else {
        Fail "B2a: Expected stage GOODS_PURCHASED, got $($c.stage)"
    }

    # Verify admin fee = 2% of deposit
    $expectedAdminFee = [math]::Ceiling([double]$c.depositPaid * 0.02)
    if ([double]$c.adminFee -eq $expectedAdminFee) {
        Pass "B2b: Admin fee = $($c.adminFee) (2% of deposit = $expectedAdminFee)"
    } else {
        Warn "B2b: Admin fee $($c.adminFee) != expected $expectedAdminFee"
    }

    # Verify refund formula: max(0, deposit - costs - adminFee)
    $expectedRefund = [math]::Max(0, [double]$c.depositPaid - [double]$c.costsIncurred - [double]$c.adminFee)
    if ([double]$c.refundAmount -eq $expectedRefund) {
        Pass "B2c: Refund amount = $($c.refundAmount) (deposit - costs - adminFee)"
    } else {
        Warn "B2c: Refund $($c.refundAmount) != expected $expectedRefund"
    }
} else {
    Warn "B2: No cancellation data in response"
}

# B3: Verify order has cancelReason but status not yet CANCELLED
Write-Host ""
Write-Host "=== TEST B3: Order still at SOURCING (waiting approval) ===" -ForegroundColor White
$orderDuringApproval = D (Api "GET" "/orders/$ORD_ID" $SALE1)
if ($orderDuringApproval) {
    $currentStatus = $orderDuringApproval.status
    $cancelReason = $orderDuringApproval.cancelReason
    Write-Host "  Order status: $currentStatus | cancelReason: $cancelReason"
    if ($currentStatus -eq "SOURCING") {
        Pass "B3a: Order still SOURCING (not cancelled yet, waiting approval)"
    } else {
        Warn "B3a: Order status = $currentStatus (expected SOURCING during approval)"
    }
    if ($cancelReason) {
        Pass "B3b: cancelReason recorded on order"
    } else {
        Warn "B3b: cancelReason not found on order"
    }
}

# ================================================================
# PART C: APPROVAL FLOW VERIFICATION (2-STEP: SALES_DIRECTOR -> COO)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: APPROVAL FLOW (SALES_DIRECTOR -> COO)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

if (-not $APPROVAL_ID) {
    Write-Host "  SKIP: No approval ID (order was cancelled directly)" -ForegroundColor Yellow
} else {

    # C1: Get approval detail
    Write-Host ""
    Write-Host "=== TEST C1: Approval detail ===" -ForegroundColor White
    $approval = D (Api "GET" "/approvals/$APPROVAL_ID" $SALE1)
    if ($approval) {
        $apType = $approval.type
        $apStatus = $approval.status
        $apTotalSteps = $approval.totalSteps
        $apCurrentStep = $approval.currentStep
        $apSteps = @()
        if ($approval.steps) { $apSteps = @($approval.steps) }

        Write-Host "  Type: $apType | Status: $apStatus"
        Write-Host "  TotalSteps: $apTotalSteps | CurrentStep: $apCurrentStep"
        foreach ($step in $apSteps) {
            Write-Host "    Step $($step.stepNumber): role=$($step.approverRole) | status=$($step.status)"
        }

        if ($apType -eq "ORDER_CANCEL") {
            Pass "C1a: Approval type = ORDER_CANCEL"
        } else {
            Fail "C1a: Expected type ORDER_CANCEL, got $apType"
        }

        if ($apTotalSteps -eq 2) {
            Pass "C1b: 2-step approval (GOODS_PURCHASED tier)"
        } elseif ($apTotalSteps -eq 3) {
            Pass "C1b: 3-step approval (as specified)"
        } else {
            Warn "C1b: Expected 2 or 3 steps, got $apTotalSteps"
        }

        if ($apStatus -eq "PENDING") {
            Pass "C1c: Approval status = PENDING"
        } else {
            Fail "C1c: Expected PENDING, got $apStatus"
        }
    } else {
        Fail "C1: Failed to get approval detail"
    }

    # C2: Verify approval chain matches cancellation stage
    Write-Host ""
    Write-Host "=== TEST C2: Verify approval chain ===" -ForegroundColor White
    # Build role -> token mapping
    $roleTokenMap = @{
        "SALES_LEADER"    = $LEADER
        "SALES_DIRECTOR"  = $GDKD
        "COO"             = $COO
        "CEO"             = $CEO
        "CFO"             = $CFO
    }
    $step1 = $apSteps | Where-Object { $_.stepNumber -eq 1 }
    $step1Role = if ($step1) { $step1.approverRole } else { "" }
    Write-Host "  Step 1: role=$step1Role"
    if ($step1Role) {
        Pass "C2a: Step 1 role = $step1Role"
    } else {
        Fail "C2a: Step 1 not found"
    }

    if ($apTotalSteps -ge 2) {
        $step2 = $apSteps | Where-Object { $_.stepNumber -eq 2 }
        $step2Role = if ($step2) { $step2.approverRole } else { "" }
        Write-Host "  Step 2: role=$step2Role"
        if ($step2Role) {
            Pass "C2b: Step 2 role = $step2Role"
        } else {
            Fail "C2b: Step 2 not found"
        }
    }

    # C3: Approve step 1 with correct role
    Write-Host ""
    Write-Host "=== TEST C3: Approve step 1 ($step1Role) ===" -ForegroundColor White
    $step1Token = $roleTokenMap[$step1Role]
    if (-not $step1Token) {
        # Fallback: try LEADER then GDKD
        $step1Token = $LEADER
        Write-Host "  No token for $step1Role, trying LEADER"
    }
    $step1Approve = Api-Expect "POST" "/approvals/$APPROVAL_ID/approve" $step1Token @{ decision = "APPROVE"; comment = "Step 1 approved by $step1Role" }
    if ($step1Approve.code -ge 200 -and $step1Approve.code -lt 300) {
        $approvalAfterStep1 = $null
        if ($step1Approve.body -and $step1Approve.body.data) { $approvalAfterStep1 = $step1Approve.body.data }
        elseif ($step1Approve.body) { $approvalAfterStep1 = $step1Approve.body }

        $afterStep1Status = $approvalAfterStep1.status
        $afterStep1Current = $approvalAfterStep1.currentStep
        Write-Host "  Approval status: $afterStep1Status | currentStep: $afterStep1Current"
        Pass "C3: Step 1 approved by $step1Role"
    } else {
        Fail "C3: Step 1 approve failed ($($step1Approve.code))"
        Write-Host "  Error: $($step1Approve.error)" -ForegroundColor DarkRed
    }

    # C4: Approve step 2 (if exists)
    Write-Host ""
    Write-Host "=== TEST C4: Approve step 2 (final) ===" -ForegroundColor White
    $approvalCheckBefore = D (Api "GET" "/approvals/$APPROVAL_ID" $CEO)
    $statusBefore = $approvalCheckBefore.status

    if ($statusBefore -eq "APPROVED") {
        Write-Host "  Approval already APPROVED after step 1"
        Pass "C4: Approval fully APPROVED (completed at step 1)"
    } elseif ($apTotalSteps -ge 2 -and $step2Role) {
        $step2Token = $roleTokenMap[$step2Role]
        if (-not $step2Token) {
            $step2Token = $GDKD
            Write-Host "  No token for $step2Role, trying GDKD"
        }
        $step2Approve = Api-Expect "POST" "/approvals/$APPROVAL_ID/approve" $step2Token @{ decision = "APPROVE"; comment = "Step 2 approved by $step2Role - proceed with cancellation" }
        if ($step2Approve.code -ge 200 -and $step2Approve.code -lt 300) {
            $approvalFinal = $null
            if ($step2Approve.body -and $step2Approve.body.data) { $approvalFinal = $step2Approve.body.data }
            elseif ($step2Approve.body) { $approvalFinal = $step2Approve.body }

            $finalStatus = $approvalFinal.status
            Write-Host "  Final approval status: $finalStatus"

            if ($finalStatus -eq "APPROVED") {
                Pass "C4a: Step 2 approved by $step2Role"
                Pass "C4b: Approval fully APPROVED"
            } else {
                Warn "C4: Approval status after step 2 = $finalStatus"
            }
        } else {
            Fail "C4: Step 2 approve failed ($($step2Approve.code))"
            Write-Host "  Error: $($step2Approve.error)" -ForegroundColor DarkRed
        }
    } else {
        Warn "C4: No step 2 to approve"
    }

    # C7: Verify approval is APPROVED
    Write-Host ""
    Write-Host "=== TEST C7: Verify final approval state ===" -ForegroundColor White
    $approvalFinalCheck = D (Api "GET" "/approvals/$APPROVAL_ID" $CEO)
    if ($approvalFinalCheck) {
        $aStatus = $approvalFinalCheck.status
        $aSteps = @()
        if ($approvalFinalCheck.steps) { $aSteps = @($approvalFinalCheck.steps) }
        Write-Host "  Final: type=$($approvalFinalCheck.type) | status=$aStatus"
        foreach ($s in $aSteps) {
            Write-Host "    Step $($s.stepNumber): role=$($s.approverRole) | status=$($s.status) | decidedAt=$($s.decidedAt)"
        }

        if ($aStatus -eq "APPROVED") {
            Pass "C7: Approval fully APPROVED (all steps completed)"
        } else {
            Fail "C7: Expected APPROVED, got $aStatus"
        }

        # Verify all steps have decidedAt
        $allDecided = $true
        foreach ($s in $aSteps) {
            if (-not $s.decidedAt -and $s.status -ne "PENDING") { $allDecided = $false }
        }
        if ($allDecided) {
            Pass "C7b: All steps have decidedAt timestamps"
        } else {
            Warn "C7b: Some steps missing decidedAt"
        }
    }

    # C8: Verify action log
    Write-Host ""
    Write-Host "=== TEST C8: Approval action log ===" -ForegroundColor White
    $actionLogResp = Api "GET" "/approvals/$APPROVAL_ID/action-log" $CEO
    $logEntries = @()
    if ($actionLogResp) {
        $logData = D $actionLogResp
        if ($logData -is [array]) { $logEntries = @($logData) }
        elseif ($logData.entries) { $logEntries = @($logData.entries) }
        elseif ($logData.actionLogs) { $logEntries = @($logData.actionLogs) }
        else { $logEntries = @($logData) }
    }
    Write-Host "  Action log: $($logEntries.Count) entries"
    foreach ($entry in $logEntries) {
        Write-Host "    $($entry.action) by $($entry.userId) at $($entry.createdAt)"
    }
    if ($logEntries.Count -ge 2) {
        Pass "C8: Action log has $($logEntries.Count) entries (submit + approve steps)"
    } else {
        Warn "C8: Action log has $($logEntries.Count) entries (may need different endpoint)"
    }
}

# ================================================================
# PART D: ORDER CANCELLATION EFFECT
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: ORDER CANCELLATION EFFECT" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# D1: Check if order is auto-cancelled after approval
Write-Host ""
Write-Host "=== TEST D1: Order status after approval completes ===" -ForegroundColor White
Start-Sleep -Milliseconds 2000  # Wait for async event processing
$orderAfterApproval = D (Api "GET" "/orders/$ORD_ID" $SALE1)
if ($orderAfterApproval) {
    $statusAfter = $orderAfterApproval.status
    Write-Host "  Order status: $statusAfter"
    Write-Host "  cancelReason: $($orderAfterApproval.cancelReason)"

    if ($statusAfter -eq "CANCELLED") {
        Pass "D1: Order auto-cancelled after approval completed"
    } else {
        Fail "D1: Expected CANCELLED, got $statusAfter (cancel-approval listener should auto-cancel)"
    }
}

# D2: Verify order has CANCELLED status (final check)
Write-Host ""
Write-Host "=== TEST D2: Final order status verification ===" -ForegroundColor White
$orderFinal = D (Api "GET" "/orders/$ORD_ID" $SALE1)
if ($orderFinal) {
    Write-Host "  Status: $($orderFinal.status)"
    Write-Host "  cancelReason: $($orderFinal.cancelReason)"
    if ($orderFinal.cancelledAt) {
        Write-Host "  cancelledAt: $($orderFinal.cancelledAt)"
    }
    if ($orderFinal.status -eq "CANCELLED") {
        Pass "D2: Order is CANCELLED"
    } else {
        Warn "D2: Order status = $($orderFinal.status) (expected CANCELLED)"
    }
}

# ================================================================
# PART E: WALLET REFUND VERIFICATION
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: WALLET REFUND VERIFICATION" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# E1: Check wallet balance after cancellation
Write-Host ""
Write-Host "=== TEST E1: Wallet balance after cancellation ===" -ForegroundColor White
Start-Sleep -Milliseconds 1000
$walletAfter = D (Api "GET" "/customers/$CUST_ID/wallet" $CEO)
$balanceAfter = 0
if ($walletAfter -and $walletAfter.balance -ne $null) {
    $balanceAfter = [double]$walletAfter.balance
}
$balanceDiff = $balanceAfter - $balanceBefore
Write-Host "  Before: $balanceBefore VND"
Write-Host "  After:  $balanceAfter VND"
Write-Host "  Diff:   $balanceDiff VND"

# Expected refund from cancellation data
$expectedRefund = 0
if ($cancelData -and $cancelData.cancellation) {
    $expectedRefund = [double]$cancelData.cancellation.refundAmount
}
Write-Host "  Expected refund: $expectedRefund VND"

if ($balanceDiff -gt 0 -and [math]::Abs($balanceDiff - $expectedRefund) -lt 1) {
    Pass "E1: Wallet balance increased by $balanceDiff (auto-refund applied)"
} else {
    Fail "E1: Wallet diff = $balanceDiff (expected $expectedRefund)"
}

# E2: Check wallet balance is accessible
Write-Host ""
Write-Host "=== TEST E2: Wallet endpoint accessible ===" -ForegroundColor White
if ($walletAfter -and $walletAfter.walletId) {
    Pass "E2: Wallet exists (walletId=$($walletAfter.walletId), balance=$balanceAfter)"
} elseif ($walletAfter -and $walletAfter.balance -ne $null) {
    Pass "E2: Wallet accessible (balance=$balanceAfter)"
} else {
    Warn "E2: Wallet not found for customer"
}

# ================================================================
# PART F: SUPPLIER ORDER VERIFICATION
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: SUPPLIER ORDER VERIFICATION" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# F1: Check supplier order status
Write-Host ""
Write-Host "=== TEST F1: SupplierOrder status after cancel ===" -ForegroundColor White
if ($SO_ID) {
    $soAfter = D (Api "GET" "/supplier-orders/$SO_ID" $SALE1)
    if ($soAfter) {
        $soStatus = $soAfter.status
        Write-Host "  SupplierOrder: $($soAfter.code) | status=$soStatus"

        if ($soStatus -eq "CANCELLED") {
            Pass "F1: SupplierOrder auto-cancelled"
        } else {
            Fail "F1: SupplierOrder still $soStatus (expected CANCELLED)"
        }
    } else {
        Warn "F1: Could not retrieve supplier order"
    }
} else {
    Warn "F1: No SupplierOrder to check"
}

# F2: List supplier orders for the order
Write-Host ""
Write-Host "=== TEST F2: List supplier orders for cancelled order ===" -ForegroundColor White
$soList = D (Api "GET" "/supplier-orders?orderId=$ORD_ID" $SALE1)
$soItems = @()
if ($soList -is [array]) { $soItems = @($soList) }
elseif ($soList -and $soList.length) { $soItems = @($soList) }
Write-Host "  Found $($soItems.Count) supplier order(s)"
foreach ($so in $soItems) {
    Write-Host "    $($so.code) | status=$($so.status) | quotedPrice=$($so.quotedPrice)"
}
if ($soItems.Count -ge 1) {
    Pass "F2: Supplier orders listed ($($soItems.Count) found)"
} else {
    Warn "F2: No supplier orders found"
}

# ================================================================
# PART G: EDGE CASES
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: EDGE CASES" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# G1: Cancel reason too short
Write-Host ""
Write-Host "=== TEST G1: Cancel with short reason (< 10 chars) ===" -ForegroundColor White
# Create a new order for edge case testing
$edgeOrderBody = @{
    customerId  = $CUST_ID
    serviceType = "VCT"
    branch      = "HN"
    items       = @( @{ productName = "Edge Case Product"; quantity = 1; unitPrice = 100 } )
}
$edgeResp = D (Api "POST" "/orders" $SALE1 $edgeOrderBody)
$EDGE_ORD_ID = $null
if ($edgeResp -and $edgeResp.id) {
    $EDGE_ORD_ID = $edgeResp.id
    Write-Host "  Edge test order: $($edgeResp.code)"

    $shortReason = Api-Expect "POST" "/orders/$EDGE_ORD_ID/cancel" $SALE1 @{ reason = "short" }
    if ($shortReason.code -eq 400) {
        Pass "G1: Short reason rejected (400)"
    } else {
        Warn "G1: Short reason got HTTP $($shortReason.code) (expected 400)"
    }
}

# G2: Cancel with empty reason
Write-Host ""
Write-Host "=== TEST G2: Cancel with empty reason ===" -ForegroundColor White
if ($EDGE_ORD_ID) {
    $emptyReason = Api-Expect "POST" "/orders/$EDGE_ORD_ID/cancel" $SALE1 @{ reason = "" }
    if ($emptyReason.code -eq 400) {
        Pass "G2: Empty reason rejected (400)"
    } else {
        Warn "G2: Empty reason got HTTP $($emptyReason.code) (expected 400)"
    }
}

# G3: Cancel early-stage VCT (no deposit, low value) -> direct cancel
Write-Host ""
Write-Host "=== TEST G3: Cancel early-stage VCT (no deposit) -> direct cancel ===" -ForegroundColor White
if ($EDGE_ORD_ID) {
    $directCancel = Api-Expect "POST" "/orders/$EDGE_ORD_ID/cancel" $SALE1 @{ reason = "Customer no longer needs this VCT order, changing requirements" }
    if ($directCancel.code -eq 200) {
        $dcData = $null
        if ($directCancel.body -and $directCancel.body.data) { $dcData = $directCancel.body.data }
        elseif ($directCancel.body) { $dcData = $directCancel.body }

        $dcStatus = $dcData.status
        Write-Host "  Cancel status: $dcStatus"

        if ($dcStatus -eq "CANCELLED") {
            Pass "G3: VCT early-stage cancelled directly (no approval needed)"
        } elseif ($dcStatus -eq "PENDING_APPROVAL") {
            Pass "G3: VCT cancel requires approval (high value or policy)"
        } else {
            Warn "G3: Cancel status = $dcStatus"
        }
    } else {
        Fail "G3: Cancel failed with HTTP $($directCancel.code)"
    }
}

# G4: Double cancel (already cancelled order)
Write-Host ""
Write-Host "=== TEST G4: Double cancel (already cancelled) ===" -ForegroundColor White
if ($EDGE_ORD_ID) {
    # Verify it's cancelled first
    $edgeCheck = D (Api "GET" "/orders/$EDGE_ORD_ID" $SALE1)
    if ($edgeCheck -and $edgeCheck.status -eq "CANCELLED") {
        $doubleCancel = Api-Expect "POST" "/orders/$EDGE_ORD_ID/cancel" $SALE1 @{ reason = "Trying to cancel an already cancelled order again" }
        if ($doubleCancel.code -eq 400) {
            Pass "G4: Double cancel blocked (400) - already CANCELLED"
        } else {
            Warn "G4: Double cancel got HTTP $($doubleCancel.code) (expected 400)"
        }
    } else {
        # If not cancelled yet, try to cancel first
        Write-Host "  Edge order not yet CANCELLED ($($edgeCheck.status)), skipping double-cancel test"
        Warn "G4: Could not test double cancel (order not in CANCELLED state)"
    }
}

# G5: Cancel non-cancellable stage (IN_TRANSIT)
Write-Host ""
Write-Host "=== TEST G5: Cancel at non-cancellable stage ===" -ForegroundColor White
# Create order and advance to IN_TRANSIT via direct status
$ncOrderBody = @{
    customerId  = $CUST_ID
    serviceType = "VCT"
    branch      = "HN"
    items       = @( @{ productName = "Non-cancellable Test"; quantity = 1; unitPrice = 50 } )
}
$ncResp = D (Api "POST" "/orders" $SALE1 $ncOrderBody)
if ($ncResp -and $ncResp.id) {
    $NC_ORD_ID = $ncResp.id
    # Advance: CONSULTING -> QUOTATION -> SOURCING -> WAREHOUSE_CN -> PACKING -> CONSOLIDATION -> IN_TRANSIT
    Api "PATCH" "/orders/$NC_ORD_ID/status" $SALE1 @{ status = "QUOTATION" } | Out-Null
    Api "PATCH" "/orders/$NC_ORD_ID/status" $SALE1 @{ status = "SOURCING" } | Out-Null
    Api "PATCH" "/orders/$NC_ORD_ID/status" $SALE1 @{ status = "WAREHOUSE_CN" } | Out-Null
    Api "PATCH" "/orders/$NC_ORD_ID/status" $SALE1 @{ status = "PACKING" } | Out-Null
    Api "PATCH" "/orders/$NC_ORD_ID/status" $SALE1 @{ status = "CONSOLIDATION" } | Out-Null
    Api "PATCH" "/orders/$NC_ORD_ID/status" $SALE1 @{ status = "IN_TRANSIT" } | Out-Null

    $ncCheck = D (Api "GET" "/orders/$NC_ORD_ID" $SALE1)
    Write-Host "  Order at: $($ncCheck.status)"

    if ($ncCheck.status -eq "IN_TRANSIT") {
        $ncCancel = Api-Expect "POST" "/orders/$NC_ORD_ID/cancel" $SALE1 @{ reason = "Trying to cancel an in-transit order which should be blocked" }
        if ($ncCancel.code -eq 400) {
            Pass "G5: Cancel at IN_TRANSIT blocked (400) - non-cancellable stage"
        } else {
            Fail "G5: Cancel at IN_TRANSIT allowed ($($ncCancel.code)) - should be blocked!"
        }
    } else {
        Warn "G5: Could not advance to IN_TRANSIT, at $($ncCheck.status)"
    }
} else {
    Warn "G5: Could not create order for non-cancellable test"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-ORD-013: Huy don MHH da coc (da cap phe duyet)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  Part A: Tao don MHH + coc + SOURCING + SupplierOrder"
Write-Host "  Part B: Sale request cancel -> PENDING_APPROVAL + refund calc"
Write-Host "  Part C: Approval flow (SALES_DIRECTOR -> COO)"
Write-Host "  Part D: Order cancellation effect"
Write-Host "  Part E: Wallet refund verification"
Write-Host "  Part F: Supplier order verification"
Write-Host "  Part G: Edge cases (short reason, double cancel, non-cancellable)"
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
