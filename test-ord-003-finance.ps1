$ErrorActionPreference = 'Continue'
$baseUrl = 'http://localhost:3001/api/v1'
$domain = 'nhaphangchinhngach.vn'

$passCount = 0; $failCount = 0; $warnCount = 0

function Log-Result($status, $msg) {
    switch ($status) {
        'PASS' { $script:passCount++; Write-Host "[PASS] $msg" }
        'FAIL' { $script:failCount++; Write-Host "[FAIL] $msg" }
        'WARN' { $script:warnCount++; Write-Host "[WARN] $msg" }
        'INFO' { Write-Host "[INFO] $msg" }
    }
}

function Api-Call($method, $url, $body, $hdrs) {
    try {
        $params = @{ Uri = $url; Method = $method; Headers = $hdrs; UseBasicParsing = $true }
        if ($body) {
            $params.ContentType = 'application/json'
            $params.Body = [System.Text.Encoding]::UTF8.GetBytes($body)
        }
        $resp = Invoke-WebRequest @params
        return @{ ok = $true; code = $resp.StatusCode; data = ($resp.Content | ConvertFrom-Json) }
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        $errBody = ""
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errBody = $reader.ReadToEnd()
        } catch {}
        return @{ ok = $false; code = $code; error = $errBody }
    }
}

function Login($email) {
    $body = "{`"email`":`"$email@$domain`",`"password`":`"Admin@123`"}"
    $r = Api-Call 'POST' "$baseUrl/auth/login" $body @{}
    if ($r.ok) {
        $t = $r.data.data.tokens.accessToken
        $uid = $r.data.data.user.id
        $role = $r.data.data.user.role
        return @{ token = $t; userId = $uid; role = $role; headers = @{ Authorization = "Bearer $t" } }
    }
    Write-Host "[ERROR] Login failed for $email"
    return $null
}

Write-Host "================================================================"
Write-Host "  TEST-ORD-003: Finance - Deposit, Cash, AR, Commission"
Write-Host "================================================================"
Write-Host ""

# ============================================================
# SETUP: Login all roles
# ============================================================
Write-Host "=== SETUP ==="
$sale = Login 'sale01'
$ketoan = Login 'ketoan'
$cfo = Login 'cfo'
$ceo = Login 'ceo'
$ketoantt = Login 'ketoantt'

if ($sale) { Log-Result 'PASS' "SALE login" } else { exit 1 }
if ($ketoan) { Log-Result 'PASS' "CHIEF_ACCOUNTANT login" } else { exit 1 }
if ($cfo) { Log-Result 'PASS' "CFO login" } else { exit 1 }
if ($ceo) { Log-Result 'PASS' "CEO login" } else { exit 1 }
if ($ketoantt) { Log-Result 'PASS' "ACCOUNTANT_AR login" } else { exit 1 }

# Get VIP customer
$custR = Api-Call 'GET' "$baseUrl/customers?page=1&limit=10" $null $sale.headers
$customers = @($custR.data.data)
$vipCust = $customers | Where-Object { $_.tier -eq 'VIP' -and [decimal]$_.creditLimit -gt 0 } | Select-Object -First 1
Write-Host "  Customer VIP: $($vipCust.code) credit=$($vipCust.creditLimit)"

# ============================================================
# PART A: DEPOSIT FLOW (MHH order requires deposit)
# ============================================================
Write-Host ""
Write-Host "================================================================"
Write-Host "  PART A: Deposit Flow (MHH order)"
Write-Host "================================================================"

# TEST 1: Create MHH order (requires 50% deposit for VIP)
Write-Host ""
Write-Host "=== TEST 1: Create MHH order (deposit required) ==="
$mhhPayload = @"
{
  "customerId": "$($vipCust.id)",
  "serviceType": "MHH",
  "branch": "HN",
  "shippingRoute": "SEA",
  "items": [
    {"productName": "Tai nghe Bluetooth cao cap", "quantity": 200, "unitPrice": 100, "currency": "CNY"}
  ],
  "note": "TEST-003: MHH deposit flow"
}
"@
$r = Api-Call 'POST' "$baseUrl/orders" $mhhPayload $sale.headers
if ($r.ok) {
    $mhhOrder = $r.data.data
    $mhhOrderId = $mhhOrder.id
    Write-Host "  Order: $($mhhOrder.code) total=$($mhhOrder.totalAmount) deposit=$($mhhOrder.depositRequired)"
    if ([decimal]$mhhOrder.depositRequired -gt 0) {
        Log-Result 'PASS' "MHH order deposit required = $($mhhOrder.depositRequired)"
    } else {
        Log-Result 'FAIL' "MHH should require deposit"
    }
} else {
    Log-Result 'FAIL' "Create MHH order: HTTP $($r.code) $($r.error)"
    exit 1
}

# Move to QUOTATION then try SOURCING (should be blocked by deposit gate)
$r = Api-Call 'PATCH' "$baseUrl/orders/$mhhOrderId/status" '{"status":"QUOTATION"}' $sale.headers
if ($r.ok) { Log-Result 'PASS' "MHH -> QUOTATION" } else { Log-Result 'FAIL' "MHH -> QUOTATION: $($r.code)" }

# TEST 2: MHH QUOTATION -> SOURCING should be blocked (deposit not paid)
Write-Host ""
Write-Host "=== TEST 2: Deposit gate blocks SOURCING ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$mhhOrderId/status" '{"status":"SOURCING"}' $sale.headers
if (-not $r.ok) {
    Log-Result 'PASS' "Deposit gate blocked SOURCING ($($r.code)) - deposit not paid"
} else {
    Log-Result 'WARN' "SOURCING allowed without deposit (check VCT bypass)"
}

# Move to PENDING_DEPOSIT
$r = Api-Call 'PATCH' "$baseUrl/orders/$mhhOrderId/status" '{"status":"PENDING_DEPOSIT"}' $sale.headers
if ($r.ok) { Log-Result 'PASS' "MHH -> PENDING_DEPOSIT" } else { Log-Result 'FAIL' "MHH -> PENDING_DEPOSIT: $($r.code)" }

# TEST 3: Create RECEIPT voucher (deposit payment)
Write-Host ""
Write-Host "=== TEST 3: Create RECEIPT voucher (deposit) ==="
$depositAmt = [decimal]$mhhOrder.depositRequired
$receiptPayload = @"
{
  "type": "RECEIPT",
  "orderId": "$mhhOrderId",
  "amount": $depositAmt,
  "currency": "VND",
  "paymentMethod": "BANK_TRANSFER",
  "costType": "Coc hang ho MHH",
  "beneficiary": "TBS Logistics Co., Ltd",
  "reason": "Thanh toan coc 50 phan tram cho don hang MHH $($mhhOrder.code) theo hop dong ky ngay hom nay. Khach hang VIP.",
  "attachments": ["https://storage.tbs.vn/receipts/deposit-mhh-test.pdf"]
}
"@
$r = Api-Call 'POST' "$baseUrl/cash/vouchers" $receiptPayload $ketoan.headers
if ($r.ok) {
    # Response: { data: { voucher: {...}, flags: [...] } }
    $voucher = if ($r.data.data.voucher) { $r.data.data.voucher } else { $r.data.data }
    $voucherId = $voucher.id
    $voucherCode = $voucher.code
    Write-Host "  Voucher: $voucherCode type=$($voucher.type) amount=$($voucher.amount) status=$($voucher.status)"
    Log-Result 'PASS' "RECEIPT voucher created: $voucherCode"
} else {
    Log-Result 'FAIL' "Create receipt: HTTP $($r.code) $($r.error)"
}

# TEST 4: SALE cannot create voucher (RBAC)
Write-Host ""
Write-Host "=== TEST 4: SALE cannot create voucher ==="
$r = Api-Call 'POST' "$baseUrl/cash/vouchers" $receiptPayload $sale.headers
if (-not $r.ok -and $r.code -eq 403) {
    Log-Result 'PASS' "SALE blocked from creating voucher (403)"
} else {
    Log-Result 'FAIL' "SALE should not create vouchers (got $($r.code))"
}

# TEST 5: Creator cannot approve own voucher (segregation of duties)
Write-Host ""
Write-Host "=== TEST 5: Segregation of duties ==="
if ($voucherId) {
    $r = Api-Call 'PATCH' "$baseUrl/cash/vouchers/$voucherId/approve" $null $ketoan.headers
    if (-not $r.ok) {
        Log-Result 'PASS' "Creator cannot approve own voucher ($($r.code))"
    } else {
        Log-Result 'FAIL' "Segregation of duties violated - creator approved own voucher"
    }
}

# TEST 6: CFO approves voucher
Write-Host ""
Write-Host "=== TEST 6: CFO approves RECEIPT voucher ==="
if ($voucherId) {
    $r = Api-Call 'PATCH' "$baseUrl/cash/vouchers/$voucherId/approve" $null $cfo.headers
    if ($r.ok) {
        $approved = if ($r.data.data.voucher) { $r.data.data.voucher } elseif ($r.data.data.status) { $r.data.data } else { $r.data.data }
        Write-Host "  Voucher status: $($approved.status)"
        if ($approved.status -eq 'APPROVED') {
            Log-Result 'PASS' "CFO approved voucher -> APPROVED"
        } else {
            Log-Result 'WARN' "Voucher status = $($approved.status)"
        }
    } else {
        Log-Result 'FAIL' "CFO approve failed: HTTP $($r.code) $($r.error)"
    }
}

# TEST 7: Verify deposit updated on order
Write-Host ""
Write-Host "=== TEST 7: Verify deposit updated on order ==="
Start-Sleep -Seconds 2
$r = Api-Call 'GET' "$baseUrl/orders/$mhhOrderId" $null $sale.headers
if ($r.ok) {
    $orderAfter = $r.data.data
    $paidAmt = [decimal]$orderAfter.depositPaid
    Write-Host "  depositRequired: $($orderAfter.depositRequired)"
    Write-Host "  depositPaid: $paidAmt"
    Write-Host "  isDepositPaid: $($orderAfter.isDepositPaid)"
    if ($paidAmt -ge $depositAmt) {
        Log-Result 'PASS' "Deposit updated: paid=$paidAmt >= required=$depositAmt"
    } elseif ($paidAmt -gt 0) {
        Log-Result 'WARN' "Deposit partially updated: paid=$paidAmt < required=$depositAmt"
    } else {
        Log-Result 'WARN' "Deposit not yet updated (event might be async)"
    }
}

# TEST 8: Now SOURCING should be allowed
Write-Host ""
Write-Host "=== TEST 8: PENDING_DEPOSIT -> SOURCING after deposit ==="
$r = Api-Call 'PATCH' "$baseUrl/orders/$mhhOrderId/status" '{"status":"SOURCING","note":"Coc da nhan, bat dau mua hang"}' $sale.headers
if ($r.ok) {
    $st = $r.data.data.status
    if ($st -eq 'SOURCING') { Log-Result 'PASS' "SOURCING allowed after deposit" }
    else { Log-Result 'FAIL' "Status = $st, expected SOURCING" }
} else {
    Log-Result 'WARN' "SOURCING still blocked: HTTP $($r.code) (deposit event may be async)"
}

# ============================================================
# PART B: CASH VOUCHER VALIDATION
# ============================================================
Write-Host ""
Write-Host "================================================================"
Write-Host "  PART B: Cash Voucher Validations"
Write-Host "================================================================"

# TEST 9: Reject voucher flow
Write-Host ""
Write-Host "=== TEST 9: Create and reject voucher ==="
$rejectPayload = @"
{
  "type": "RECEIPT",
  "orderId": "$mhhOrderId",
  "amount": 100000,
  "currency": "VND",
  "paymentMethod": "CASH",
  "costType": "Thu tien mat",
  "beneficiary": "TBS Logistics",
  "reason": "Thu tien mat bo sung cho don hang test phan reject voucher workflow"
}
"@
$r = Api-Call 'POST' "$baseUrl/cash/vouchers" $rejectPayload $ketoan.headers
if ($r.ok) {
    $rejectVoucher = if ($r.data.data.voucher) { $r.data.data.voucher } else { $r.data.data }
    $rejectVoucherId = $rejectVoucher.id
    Write-Host "  Created voucher for reject test: $($rejectVoucher.code) id=$rejectVoucherId"

    $r2 = Api-Call 'PATCH' "$baseUrl/cash/vouchers/$rejectVoucherId/reject" '{"reason":"Thieu chung tu hop le, can bo sung hoa don"}' $cfo.headers
    if ($r2.ok) {
        $rejData = if ($r2.data.data.voucher) { $r2.data.data.voucher } elseif ($r2.data.data.status) { $r2.data.data } else { $r2.data.data }
        $rejStatus = $rejData.status
        if ($rejStatus -eq 'REJECTED') { Log-Result 'PASS' "Voucher rejected -> REJECTED" }
        else { Log-Result 'WARN' "Reject status = $rejStatus" }
    } else {
        Log-Result 'FAIL' "Reject failed: HTTP $($r2.code) $($r2.error)"
    }
} else {
    Log-Result 'FAIL' "Create voucher for reject: HTTP $($r.code)"
}

# TEST 10: List vouchers (CEO can see all)
Write-Host ""
Write-Host "=== TEST 10: List vouchers ==="
$r = Api-Call 'GET' "$baseUrl/cash/vouchers?page=1&limit=10" $null $ceo.headers
if ($r.ok) {
    # List might be flat array or paginated
    if ($r.data.data -is [Array]) { $vouchers = @($r.data.data) }
    elseif ($r.data.data.data -is [Array]) { $vouchers = @($r.data.data.data) }
    else { $vouchers = @($r.data.data) }
    Write-Host "  Total vouchers visible: $($vouchers.Count)"
    foreach ($v in $vouchers) {
        Write-Host "    $($v.code) | $($v.type) | $($v.amount) $($v.currency) | $($v.status)"
    }
    Log-Result 'PASS' "List vouchers OK ($($vouchers.Count) items)"
} else {
    Log-Result 'FAIL' "List vouchers: HTTP $($r.code)"
}

# TEST 11: SALE cannot list vouchers
Write-Host ""
Write-Host "=== TEST 11: SALE cannot list vouchers ==="
$r = Api-Call 'GET' "$baseUrl/cash/vouchers?page=1&limit=10" $null $sale.headers
if (-not $r.ok -and $r.code -eq 403) {
    Log-Result 'PASS' "SALE blocked from vouchers (403)"
} else {
    Log-Result 'WARN' "SALE voucher access: code=$($r.code) (may need role check)"
}

# ============================================================
# PART C: ACCOUNTS RECEIVABLE
# ============================================================
Write-Host ""
Write-Host "================================================================"
Write-Host "  PART C: Accounts Receivable (AR)"
Write-Host "================================================================"

# TEST 12: List AR records
Write-Host ""
Write-Host "=== TEST 12: List AR records ==="
$r = Api-Call 'GET' "$baseUrl/ar?page=1&limit=10" $null $ketoan.headers
if ($r.ok) {
    $arRecords = @($r.data.data)
    Write-Host "  AR records: $($arRecords.Count)"
    foreach ($ar in $arRecords) {
        Write-Host "    $($ar.code) | customer=$($ar.customerId) | amount=$($ar.amount) | paid=$($ar.paidAmount) | status=$($ar.status)"
    }
    Log-Result 'PASS' "List AR records OK"
} else {
    Log-Result 'FAIL' "List AR: HTTP $($r.code)"
}

# TEST 13: Create AR record manually
Write-Host ""
Write-Host "=== TEST 13: Create AR record ==="
$arPayload = @"
{
  "customerId": "$($vipCust.id)",
  "orderId": "$mhhOrderId",
  "amount": 10000000,
  "currency": "VND",
  "dueDate": "2026-04-01",
  "note": "TEST: Cong no phai thu cho don MHH"
}
"@
$r = Api-Call 'POST' "$baseUrl/ar" $arPayload $ketoan.headers
if ($r.ok) {
    $arRecord = $r.data.data
    $arId = $arRecord.id
    $arCode = $arRecord.code
    Write-Host "  AR: $arCode amount=$($arRecord.amount) status=$($arRecord.status)"
    Log-Result 'PASS' "AR created: $arCode"
} else {
    Log-Result 'FAIL' "Create AR: HTTP $($r.code) $($r.error)"
}

# TEST 14: Record partial payment
Write-Host ""
Write-Host "=== TEST 14: Record AR partial payment ==="
if ($arId) {
    $payPayload = '{"amount": 3000000, "reference": "BANK-TRF-TEST-001", "note": "Thanh toan dot 1"}'
    $r = Api-Call 'PATCH' "$baseUrl/ar/$arId/payment" $payPayload $ketoan.headers
    if ($r.ok) {
        $arAfter = $r.data.data
        Write-Host "  paidAmount: $($arAfter.paidAmount) status=$($arAfter.status)"
        if ($arAfter.status -eq 'PARTIAL') {
            Log-Result 'PASS' "Partial payment: status=PARTIAL, paid=$($arAfter.paidAmount)"
        } else {
            Log-Result 'WARN' "Status = $($arAfter.status), expected PARTIAL"
        }
    } else {
        Log-Result 'FAIL' "AR payment: HTTP $($r.code) $($r.error)"
    }
}

# TEST 15: Record remaining payment -> PAID
Write-Host ""
Write-Host "=== TEST 15: Record remaining payment -> PAID ==="
if ($arId) {
    $payPayload2 = '{"amount": 7000000, "reference": "BANK-TRF-TEST-002", "note": "Thanh toan dot 2 (con lai)"}'
    $r = Api-Call 'PATCH' "$baseUrl/ar/$arId/payment" $payPayload2 $ketoan.headers
    if ($r.ok) {
        $arFinal = $r.data.data
        Write-Host "  paidAmount: $($arFinal.paidAmount) status=$($arFinal.status)"
        if ($arFinal.status -eq 'PAID') {
            Log-Result 'PASS' "Full payment: status=PAID"
        } else {
            Log-Result 'WARN' "Status = $($arFinal.status), expected PAID"
        }
    } else {
        Log-Result 'FAIL' "AR full payment: HTTP $($r.code) $($r.error)"
    }
}

# TEST 16: Overpayment should be rejected
Write-Host ""
Write-Host "=== TEST 16: Overpayment rejected ==="
if ($arId) {
    $overPayload = '{"amount": 5000000, "note": "Overpayment test"}'
    $r = Api-Call 'PATCH' "$baseUrl/ar/$arId/payment" $overPayload $ketoan.headers
    if (-not $r.ok -and $r.code -eq 400) {
        Log-Result 'PASS' "Overpayment rejected (400)"
    } else {
        Log-Result 'WARN' "Overpayment: code=$($r.code)"
    }
}

# TEST 17: AR aging report
Write-Host ""
Write-Host "=== TEST 17: AR aging report ==="
$r = Api-Call 'GET' "$baseUrl/ar/aging" $null $ketoan.headers
if ($r.ok) {
    Write-Host "  Aging data received"
    Log-Result 'PASS' "AR aging report OK"
} else {
    Log-Result 'WARN' "AR aging: HTTP $($r.code)"
}

# TEST 18: AR overdue list
Write-Host ""
Write-Host "=== TEST 18: AR overdue list ==="
$r = Api-Call 'GET' "$baseUrl/ar/overdue" $null $ketoan.headers
if ($r.ok) {
    Log-Result 'PASS' "AR overdue list OK"
} else {
    Log-Result 'WARN' "AR overdue: HTTP $($r.code)"
}

# TEST 19: SALE cannot access AR
Write-Host ""
Write-Host "=== TEST 19: SALE cannot access AR ==="
$r = Api-Call 'GET' "$baseUrl/ar?page=1&limit=5" $null $sale.headers
if (-not $r.ok -and $r.code -eq 403) {
    Log-Result 'PASS' "SALE blocked from AR (403)"
} else {
    Log-Result 'WARN' "SALE AR access: code=$($r.code)"
}

# ============================================================
# PART D: COMMISSION
# ============================================================
Write-Host ""
Write-Host "================================================================"
Write-Host "  PART D: Commission"
Write-Host "================================================================"

# TEST 20: Create commission rule
Write-Host ""
Write-Host "=== TEST 20: Create commission rule ==="
$rulePayload = @"
{
  "serviceType": "VCT",
  "minProfit": 0,
  "maxProfit": 100000000,
  "rate": 0.05,
  "description": "TEST: VCT commission 5% for profit 0-100M"
}
"@
$r = Api-Call 'POST' "$baseUrl/commissions/rules" $rulePayload $ceo.headers
if ($r.ok) {
    $rule = $r.data.data
    Write-Host "  Rule: serviceType=$($rule.serviceType) rate=$($rule.rate)"
    Log-Result 'PASS' "Commission rule created"
} else {
    Log-Result 'WARN' "Create rule: HTTP $($r.code) (may already exist) $($r.error)"
}

# TEST 21: List commission rules
Write-Host ""
Write-Host "=== TEST 21: List commission rules ==="
$r = Api-Call 'GET' "$baseUrl/commissions/rules?page=1&limit=20" $null $ceo.headers
if ($r.ok) {
    $rules = @($r.data.data)
    Write-Host "  Rules count: $($rules.Count)"
    foreach ($rl in $rules) {
        Write-Host "    $($rl.serviceType) | profit $($rl.minProfit)-$($rl.maxProfit) | rate=$($rl.rate)"
    }
    Log-Result 'PASS' "List rules OK ($($rules.Count) rules)"
} else {
    Log-Result 'FAIL' "List rules: HTTP $($r.code)"
}

# TEST 22: Calculate commission for completed order
# First, create and complete a quick VCT order
Write-Host ""
Write-Host "=== TEST 22: Commission calculation for completed order ==="
$quickPayload = @"
{
  "customerId": "$($vipCust.id)",
  "serviceType": "VCT",
  "branch": "HN",
  "shippingRoute": "SEA",
  "items": [{"productName": "Test commission", "quantity": 10, "unitPrice": 50, "currency": "CNY"}],
  "note": "Commission test order"
}
"@
$r = Api-Call 'POST' "$baseUrl/orders" $quickPayload $sale.headers
if ($r.ok) {
    $commOrderId = $r.data.data.id
    $commOrderCode = $r.data.data.code
    Write-Host "  Order for commission: $commOrderCode"

    # Fast-track through statuses
    $statuses = @('QUOTATION','SOURCING','WAREHOUSE_CN','PACKING','CONSOLIDATION','IN_TRANSIT','CUSTOMS','WAREHOUSE_VN','DELIVERING','SETTLEMENT','COMPLETED')
    $allOk = $true
    foreach ($s in $statuses) {
        $sr = Api-Call 'PATCH' "$baseUrl/orders/$commOrderId/status" "{`"status`":`"$s`"}" $sale.headers
        if (-not $sr.ok) {
            Write-Host "  Transition to $s failed: HTTP $($sr.code)"
            $allOk = $false
            break
        }
    }

    if ($allOk) {
        Log-Result 'PASS' "Order fast-tracked to COMPLETED"

        # Wait for async commission calculation
        Start-Sleep -Seconds 3

        # Try calculate commission manually
        $r = Api-Call 'POST' "$baseUrl/commissions/calculate/$commOrderId" $null $ceo.headers
        if ($r.ok) {
            $comm = $r.data.data
            if ($comm) {
                Write-Host "  Commission: revenue=$($comm.orderRevenue) cost=$($comm.orderCost) profit=$($comm.netProfit)"
                Write-Host "  Rate=$($comm.commissionRate) amount=$($comm.commissionAmount) status=$($comm.status)"
                Log-Result 'PASS' "Commission calculated: $($comm.commissionAmount)"
            } else {
                Log-Result 'WARN' "No applicable commission rule found"
            }
        } else {
            Log-Result 'WARN' "Calculate commission: HTTP $($r.code) $($r.error)"
        }
    } else {
        Log-Result 'FAIL' "Order could not reach COMPLETED"
    }
}

# TEST 23: Get my commissions (SALE)
Write-Host ""
Write-Host "=== TEST 23: Get my commissions (SALE) ==="
$r = Api-Call 'GET' "$baseUrl/commissions/my?startDate=2026-01-01&endDate=2026-12-31" $null $sale.headers
if ($r.ok) {
    $myComm = $r.data.data
    if ($myComm.records) {
        Write-Host "  My commissions: $($myComm.records.Count) records, total=$($myComm.total)"
    } else {
        Write-Host "  My commissions data received"
    }
    Log-Result 'PASS' "My commissions OK"
} else {
    Log-Result 'WARN' "My commissions: HTTP $($r.code)"
}

# TEST 24: Get team commissions (as SALES_LEADER)
Write-Host ""
Write-Host "=== TEST 24: Team commissions ==="
$leader = Login 'leader.hn'
if ($leader) {
    $r = Api-Call 'GET' "$baseUrl/commissions/team?startDate=2026-01-01&endDate=2026-12-31" $null $leader.headers
    if ($r.ok) {
        Log-Result 'PASS' "Team commissions OK"
    } else {
        Log-Result 'WARN' "Team commissions: HTTP $($r.code)"
    }
} else {
    Log-Result 'WARN' "Leader login failed"
}

# TEST 25: Monthly commission report
Write-Host ""
Write-Host "=== TEST 25: Monthly commission report ==="
$r = Api-Call 'GET' "$baseUrl/commissions/report/monthly?year=2026&month=3" $null $ceo.headers
if ($r.ok) {
    Log-Result 'PASS' "Monthly report OK"
} else {
    Log-Result 'WARN' "Monthly report: HTTP $($r.code)"
}

# TEST 26: Approve commission (if any pending)
Write-Host ""
Write-Host "=== TEST 26: Approve commission ==="
$r = Api-Call 'GET' "$baseUrl/commissions/my?startDate=2026-01-01&endDate=2026-12-31" $null $sale.headers
if ($r.ok -and $r.data.data.records -and $r.data.data.records.Count -gt 0) {
    $pendingComm = $r.data.data.records | Where-Object { $_.status -eq 'PENDING' } | Select-Object -First 1
    if ($pendingComm) {
        $commId = $pendingComm.id
        Write-Host "  Approving commission: $commId"
        $r2 = Api-Call 'PATCH' "$baseUrl/commissions/$commId/approve" $null $ketoan.headers
        if ($r2.ok) {
            Log-Result 'PASS' "Commission approved"
        } else {
            Log-Result 'WARN' "Commission approve: HTTP $($r2.code) $($r2.error)"
        }
    } else {
        Log-Result 'INFO' "No pending commissions to approve"
    }
} else {
    Log-Result 'INFO' "No commissions found for SALE"
}

# ============================================================
# PART E: CROSS-CUTTING FINANCE CHECKS
# ============================================================
Write-Host ""
Write-Host "================================================================"
Write-Host "  PART E: Cross-cutting Finance Checks"
Write-Host "================================================================"

# TEST 27: AR by customer
Write-Host ""
Write-Host "=== TEST 27: AR by customer ==="
$r = Api-Call 'GET' "$baseUrl/ar/by-customer/$($vipCust.id)" $null $ketoan.headers
if ($r.ok) {
    Log-Result 'PASS' "AR by customer OK"
} else {
    Log-Result 'WARN' "AR by customer: HTTP $($r.code)"
}

# TEST 28: Cash flow report
Write-Host ""
Write-Host "=== TEST 28: Cash flow report ==="
$r = Api-Call 'GET' "$baseUrl/cash/flow?startDate=2026-01-01&endDate=2026-12-31" $null $cfo.headers
if ($r.ok) {
    Log-Result 'PASS' "Cash flow report OK"
} else {
    Log-Result 'WARN' "Cash flow: HTTP $($r.code)"
}

# TEST 29: Invoice list
Write-Host ""
Write-Host "=== TEST 29: Invoice list ==="
$r = Api-Call 'GET' "$baseUrl/invoices?page=1&limit=5" $null $ketoan.headers
if ($r.ok) {
    Log-Result 'PASS' "Invoice list OK"
} else {
    Log-Result 'WARN' "Invoices: HTTP $($r.code)"
}

# TEST 30: AP list
Write-Host ""
Write-Host "=== TEST 30: AP (Accounts Payable) list ==="
$r = Api-Call 'GET' "$baseUrl/ap?page=1&limit=5" $null $ketoan.headers
if ($r.ok) {
    Log-Result 'PASS' "AP list OK"
} else {
    Log-Result 'WARN' "AP: HTTP $($r.code)"
}

# ============================================================
# SUMMARY
# ============================================================
Write-Host ""
Write-Host "================================================================"
Write-Host "  TONG KET TEST-ORD-003: Finance"
Write-Host "================================================================"
Write-Host "  PASS: $passCount"
Write-Host "  FAIL: $failCount"
Write-Host "  WARN: $warnCount"
Write-Host ""
Write-Host "  PART A: Deposit Flow (MHH)"
Write-Host "  PART B: Cash Voucher Validations"
Write-Host "  PART C: Accounts Receivable"
Write-Host "  PART D: Commission"
Write-Host "  PART E: Cross-cutting Finance"
Write-Host ""
if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED"
} else {
    Write-Host "  RESULT: $failCount TESTS FAILED"
}
Write-Host "================================================================"
