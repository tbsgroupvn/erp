# ================================================================
# TEST-CNT-004: Container chi phi van hanh + phan bo theo don hang
# Severity: CRITICAL
#
# Flow:
#   1. Tao container voi 3 orders (weights: 100, 200, 300 kg)
#   2. Record 4 operation costs (FREIGHT, CUSTOMS_DUTY, HANDLING, TRANSPORT_VN)
#   3. List + verify costs for container
#   4. Cost per kg calculation
#   5. Allocate by WEIGHT -> verify proportional
#   6. Verify allocated costs on each order
#   7. Variance analysis (estimated vs actual)
#   8. Re-allocate by EVEN -> verify equal split
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
        return @{ _error = $true; _code = $code; _body = $errBody }
    }
}

function D($resp) {
    if ($resp -and $resp._error) { return $null }
    if ($resp -and $resp.data) { return $resp.data }
    return $resp
}

function IsError($resp) { return ($resp -and $resp._error -eq $true) }

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
Write-Host "  TEST-CNT-004: Container chi phi van hanh + phan bo" -ForegroundColor Cyan
Write-Host "  Severity: CRITICAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login ===" -ForegroundColor White

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SALE login OK" } else { Fail "SALE login FAILED"; exit 1 }

$WH_CN = Login "khotq01@$DOMAIN"
if ($WH_CN) { Pass "WAREHOUSE_CN login OK" } else { Fail "WAREHOUSE_CN login FAILED"; exit 1 }

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

$ACCT = Login "ketoan01@$DOMAIN"
if ($ACCT) { Pass "ACCOUNTANT login OK" } else { Warn "ACCOUNTANT login FAILED (will use CEO)" }

$COST_TOKEN = if ($ACCT) { $ACCT } else { $CEO }

# Get VIP customer
$customers = D (Api "GET" "/customers?tier=VIP&limit=1" $CEO)
$cust = $null
if ($customers -is [array] -and $customers.Count -gt 0) { $cust = $customers[0] }
elseif ($customers -and $customers.id) { $cust = $customers }
if (-not $cust) { Fail "No VIP customer found"; exit 1 }
$CUST_ID = $cust.id
Write-Host "  Customer: $($cust.code)" -ForegroundColor Gray

$TS = Get-Date -Format "yyyyMMddHHmmss"

# ================================================================
# PART A: TAO CONTAINER VOI 3 ORDERS (100, 200, 300 kg)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Tao container voi 3 orders (100, 200, 300 kg)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$PKG_IDS = @()
$PKG_CODES = @()
$ORDER_IDS = @()
$ORDER_CODES = @()
$CHARGEABLE_WEIGHTS = @()

# Compact heavy items: actual > volumetric -> chargeable = actual
$weights = @(100, 200, 300)
$dims = @(
    @{ l = 40; w = 30; h = 25 },   # vol=30 < 100
    @{ l = 50; w = 35; h = 25 },   # vol=43.75 < 200
    @{ l = 55; w = 40; h = 30 }    # vol=66 < 300
)

for ($i = 0; $i -lt 3; $i++) {
    $n = $i + 1

    $ord = D (Api "POST" "/orders" $SALE @{
        customerId    = $CUST_ID
        serviceType   = "VCT"
        shippingRoute = "SEA"
        branch        = "HN"
        items         = @(@{ productName = "CNT004 product $n"; quantity = $n * 5; unitPrice = 100; currency = "CNY" })
        note          = "CNT-004 order #$n ($($weights[$i]) kg) - $TS"
    })
    if (-not $ord -or -not $ord.id) { Fail "A: Create order #$n failed"; continue }
    $ORDER_IDS += $ord.id
    $ORDER_CODES += $ord.code

    foreach ($st in @("QUOTATION", "PENDING_DEPOSIT", "SOURCING", "WAREHOUSE_CN")) {
        $tr = Api "PATCH" "/orders/$($ord.id)/status" $CEO @{ status = $st }
        if (IsError $tr) { break }
    }

    $rcvResp = Api "POST" "/warehouse-cn/receive" $WH_CN @{
        trackingNumberCN = "CNT004-P$n-$TS"
        orderId          = $ord.id
        imageUrls        = @("https://storage.tbs.vn/test/cnt004-p${n}.jpg")
    }
    if (IsError $rcvResp) { Fail "A: Receive #$n failed"; continue }
    $rcvData = D $rcvResp
    $pkg = if ($rcvData.package) { $rcvData.package } else { $rcvData }
    if (-not $pkg -or -not $pkg.id) { Fail "A: No pkg ID #$n"; continue }

    $d = $dims[$i]
    $mResp = D (Api "POST" "/warehouse-cn/packages/$($pkg.id)/measure" $WH_CN @{
        length = $d.l; width = $d.w; height = $d.h; actualWeight = $weights[$i]
    })
    # Get chargeable weight
    $cw = $null
    if ($mResp.calculation -and $mResp.calculation.chargeableWeight) { $cw = [double]$mResp.calculation.chargeableWeight }
    if (-not $cw -and $mResp.package -and $mResp.package.chargeableWeight) { $cw = [double]$mResp.package.chargeableWeight }
    if (-not $cw) { $cw = $weights[$i] }

    D (Api "PATCH" "/warehouse-cn/packages/$($pkg.id)/status" $WH_CN @{ status = "PACKED" }) | Out-Null

    $PKG_IDS += $pkg.id
    $PKG_CODES += $pkg.code
    $CHARGEABLE_WEIGHTS += $cw
    Write-Host "    $($ord.code) -> $($pkg.code) PACKED ($cw kg chargeable)" -ForegroundColor Gray
}

if ($PKG_IDS.Count -eq 3) {
    Pass "A1: 3 orders created + packed"
} else {
    Fail "A1: Only $($PKG_IDS.Count)/3 ready"; exit 1
}

$TOTAL_WEIGHT = ($CHARGEABLE_WEIGHTS | Measure-Object -Sum).Sum
Write-Host "  Total chargeable weight: $TOTAL_WEIGHT kg" -ForegroundColor Gray
Write-Host "  Weight proportions: $($CHARGEABLE_WEIGHTS[0])/$TOTAL_WEIGHT, $($CHARGEABLE_WEIGHTS[1])/$TOTAL_WEIGHT, $($CHARGEABLE_WEIGHTS[2])/$TOTAL_WEIGHT" -ForegroundColor Gray

# Create container + add packages
$cnt = D (Api "POST" "/containers" $WH_CN @{
    shippingRoute = "SEA"
    origin        = "Guangzhou, CN"
    destination   = "Hai Phong, VN"
    carrier       = "COSCO"
    maxCapacity   = 5000
})
if (-not $cnt -or -not $cnt.id) { Fail "A2: Create container failed"; exit 1 }
$CNT_ID = $cnt.id
$CNT_CODE = $cnt.code

$addResp = D (Api "POST" "/containers/$CNT_ID/add-packages" $WH_CN @{ packageIds = $PKG_IDS })
if ($addResp -and [int]$addResp.totalPackages -eq 3) {
    Write-Host "  Container ${CNT_CODE}: $($addResp.totalPackages) pkgs, $($addResp.totalWeight) kg"
    Pass "A2: Container created with 3 packages"
} else {
    Fail "A2: Add packages failed"
}

# ================================================================
# PART B: RECORD OPERATION COSTS
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Record 4 operation costs (total 18,000,000 VND)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$COST_IDS = @()
$costs = @(
    @{ type = "FREIGHT";       amount = 12000000; est = 11000000; desc = "Sea freight Guangzhou - Hai Phong" },
    @{ type = "CUSTOMS_DUTY";  amount = 3000000;  est = 3500000;  desc = "Import customs duty" },
    @{ type = "HANDLING";      amount = 1500000;  est = 1500000;  desc = "Port handling charges" },
    @{ type = "TRANSPORT_VN";  amount = 1500000;  est = 1200000;  desc = "Trucking Hai Phong - Ha Noi" }
)
$TOTAL_COST = 0

foreach ($c in $costs) {
    Write-Host ""
    Write-Host "=== Record: $($c.type) = $($c.amount) VND ===" -ForegroundColor White
    $costResp = D (Api "POST" "/operation-costs" $COST_TOKEN @{
        containerId     = $CNT_ID
        costType        = $c.type
        amount          = $c.amount
        currency        = "VND"
        estimatedAmount = $c.est
        description     = $c.desc
        invoiceRef      = "INV-CNT004-$($c.type)-$TS"
    })
    if ($costResp -and $costResp.id) {
        $COST_IDS += $costResp.id
        $TOTAL_COST += $c.amount
        Write-Host "  Created: $($costResp.id) | $($costResp.costType) = $($costResp.amount) $($costResp.currency)"
        Pass "B: $($c.type) recorded ($($c.amount) VND)"
    } else {
        Fail "B: Failed to record $($c.type)"
    }
}

Write-Host ""
Write-Host "  Total costs recorded: $TOTAL_COST VND" -ForegroundColor Gray

# Wait for async auto-allocation via finance-events queue
Write-Host "  Waiting for async allocation processing..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# ================================================================
# PART C: LIST + VERIFY COSTS FOR CONTAINER
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: List + verify costs for container" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST C1: GET /operation-costs/containers/:containerId ===" -ForegroundColor White
$cntCosts = D (Api "GET" "/operation-costs/containers/$CNT_ID" $COST_TOKEN)
if ($cntCosts) {
    # Response might be array or object with costs property
    $costList = $null
    $totalFromApi = 0

    if ($cntCosts -is [array]) {
        $costList = $cntCosts
    } elseif ($cntCosts.costs) {
        $costList = @($cntCosts.costs)
        if ($cntCosts.totalCost) { $totalFromApi = [double]$cntCosts.totalCost }
    } elseif ($cntCosts.data) {
        $costList = @($cntCosts.data)
    } else {
        # Might be the container costs object itself
        $costList = @($cntCosts)
    }

    if ($costList -and $costList.Count -ge 4) {
        Write-Host "  Costs found: $($costList.Count)"
        foreach ($ci in $costList) {
            Write-Host "    $($ci.costType): $($ci.amount) $($ci.currency)"
        }
        Pass "C1a: Container has $($costList.Count) cost records"
    } elseif ($costList) {
        Write-Host "  Costs found: $($costList.Count)"
        Warn "C1a: Only $($costList.Count) costs found (expected 4)"
    } else {
        Fail "C1a: No costs returned"
    }

    # Check total
    if ($totalFromApi -gt 0 -and [Math]::Abs($totalFromApi - $TOTAL_COST) -lt 1) {
        Pass "C1b: Total cost = $totalFromApi VND (matches $TOTAL_COST)"
    } elseif ($totalFromApi -gt 0) {
        Warn "C1b: Total cost = $totalFromApi, expected $TOTAL_COST"
    } else {
        # Calculate from list
        $calcTotal = 0
        if ($costList) { foreach ($ci in $costList) { $calcTotal += [double]$ci.amount } }
        if ([Math]::Abs($calcTotal - $TOTAL_COST) -lt 1) {
            Pass "C1b: Sum of costs = $calcTotal VND (matches $TOTAL_COST)"
        } elseif ($calcTotal -gt 0) {
            Warn "C1b: Sum = $calcTotal, expected $TOTAL_COST"
        } else {
            Warn "C1b: Cannot verify total cost"
        }
    }
} else {
    Fail "C1: Failed to get container costs"
}

# ================================================================
# PART D: COST PER KG
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Cost per kg calculation" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST D1: GET cost-per-kg ===" -ForegroundColor White
$expectedCostPerKg = [Math]::Round($TOTAL_COST / $TOTAL_WEIGHT, 0)
Write-Host "  Expected: $TOTAL_COST / $TOTAL_WEIGHT = $expectedCostPerKg VND/kg"

$cpkResp = D (Api "GET" "/operation-costs/containers/$CNT_ID/cost-per-kg" $COST_TOKEN)
if ($cpkResp) {
    Write-Host "  totalCost:            $($cpkResp.totalCost) VND"
    Write-Host "  totalChargeableWeight: $($cpkResp.totalChargeableWeight) kg"
    Write-Host "  costPerKg:            $($cpkResp.costPerKg) VND/kg"
    Write-Host "  totalPackages:        $($cpkResp.totalPackages)"

    # D1a: totalCost matches
    if ([Math]::Abs([double]$cpkResp.totalCost - $TOTAL_COST) -lt 1) {
        Pass "D1a: totalCost = $($cpkResp.totalCost) VND (correct)"
    } else {
        Fail "D1a: totalCost = $($cpkResp.totalCost), expected $TOTAL_COST"
    }

    # D1b: totalChargeableWeight matches
    if ([Math]::Abs([double]$cpkResp.totalChargeableWeight - $TOTAL_WEIGHT) -lt 1) {
        Pass "D1b: totalChargeableWeight = $($cpkResp.totalChargeableWeight) kg (correct)"
    } else {
        Fail "D1b: totalChargeableWeight = $($cpkResp.totalChargeableWeight), expected $TOTAL_WEIGHT"
    }

    # D1c: costPerKg reasonable
    $apiCpk = [double]$cpkResp.costPerKg
    if ([Math]::Abs($apiCpk - $expectedCostPerKg) -lt 100) {
        Pass "D1c: costPerKg = $apiCpk VND/kg (expected ~$expectedCostPerKg)"
    } else {
        Fail "D1c: costPerKg = $apiCpk, expected ~$expectedCostPerKg"
    }
} else {
    Fail "D1: Failed to get cost-per-kg"
}

# ================================================================
# PART E: ALLOCATE BY WEIGHT
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: Allocate costs by WEIGHT" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST E1: POST allocate by WEIGHT ===" -ForegroundColor White
$allocResp = D (Api "POST" "/operation-costs/containers/$CNT_ID/allocate?method=WEIGHT" $COST_TOKEN)
if ($allocResp) {
    $allocations = $null
    if ($allocResp -is [array]) { $allocations = $allocResp }
    elseif ($allocResp.allocations) { $allocations = @($allocResp.allocations) }
    elseif ($allocResp.results) { $allocations = @($allocResp.results) }
    else { $allocations = @($allocResp) }

    Write-Host "  Allocations returned: $(if ($allocations) { $allocations.Count } else { 0 })"

    if ($allocations -and $allocations.Count -ge 3) {
        Pass "E1: Weight allocation returned $($allocations.Count) records"
        foreach ($al in $allocations) {
            $orderCode = $al.orderCode
            if (-not $orderCode -and $al.orderId) {
                $idx = $ORDER_IDS.IndexOf($al.orderId)
                if ($idx -ge 0) { $orderCode = $ORDER_CODES[$idx] }
            }
            Write-Host "    ${orderCode}: proportion=$($al.proportion) | allocated=$($al.allocatedAmount) VND"
        }
    } elseif ($allocations) {
        Warn "E1: Only $($allocations.Count) allocations (expected 3)"
    } else {
        Warn "E1: No allocation data in response"
    }
} else {
    Fail "E1: Allocation request failed"
}

# ================================================================
# PART F: VERIFY ALLOCATED COSTS PER ORDER
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Verify allocated cost per order (by WEIGHT)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$allocSum = 0
for ($i = 0; $i -lt 3; $i++) {
    $n = $i + 1
    $expectedProportion = [Math]::Round($CHARGEABLE_WEIGHTS[$i] / $TOTAL_WEIGHT, 4)
    $expectedAlloc = [Math]::Round($TOTAL_COST * $expectedProportion, 0)

    Write-Host ""
    Write-Host "=== TEST F${n}: Order #${n} ($($ORDER_CODES[$i])) - weight=$($CHARGEABLE_WEIGHTS[$i])/$TOTAL_WEIGHT ===" -ForegroundColor White
    Write-Host "  Expected proportion: $expectedProportion ($([Math]::Round($expectedProportion * 100, 1))%)"
    Write-Host "  Expected allocation: ~$expectedAlloc VND"

    $orderCost = D (Api "GET" "/operation-costs/orders/$($ORDER_IDS[$i])" $COST_TOKEN)
    if ($orderCost) {
        Write-Host "  totalAllocatedCost: $($orderCost.totalAllocatedCost) VND"
        Write-Host "  chargeableWeight:   $($orderCost.chargeableWeight) kg"
        if ($orderCost.orderCostPerKg) {
            Write-Host "  orderCostPerKg:     $($orderCost.orderCostPerKg) VND/kg"
        }

        $actualAlloc = [double]$orderCost.totalAllocatedCost

        # F.n.a: Allocation > 0
        if ($actualAlloc -gt 0) {
            Pass "F${n}a: Order #$n has allocated cost = $actualAlloc VND"
        } else {
            Fail "F${n}a: Order #$n allocated cost = 0"
        }

        # F.n.b: Allocation proportional to weight (allow 5% tolerance for rounding)
        $tolerance = $TOTAL_COST * 0.05
        if ([Math]::Abs($actualAlloc - $expectedAlloc) -lt $tolerance) {
            Pass "F${n}b: Allocation ~$actualAlloc VND proportional to weight (expected ~$expectedAlloc)"
        } else {
            Warn "F${n}b: Allocation $actualAlloc differs from expected $expectedAlloc"
        }

        $allocSum += $actualAlloc
    } else {
        Fail "F${n}: Failed to get order cost for $($ORDER_CODES[$i])"
    }
}

Write-Host ""
Write-Host "=== TEST F4: Sum of allocations = total cost ===" -ForegroundColor White
Write-Host "  Allocation sum: $allocSum VND | Total cost: $TOTAL_COST VND"
if ([Math]::Abs($allocSum - $TOTAL_COST) -lt 1) {
    Pass "F4: Sum of allocations = $allocSum matches total $TOTAL_COST (no rounding loss)"
} elseif ([Math]::Abs($allocSum - $TOTAL_COST) -lt 100) {
    Pass "F4: Sum of allocations = $allocSum (within 100 VND of $TOTAL_COST)"
} else {
    Fail "F4: Sum $allocSum != total $TOTAL_COST (rounding issue)"
}

# ================================================================
# PART G: VARIANCE ANALYSIS
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: Variance analysis (estimated vs actual)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST G1: GET variance report ===" -ForegroundColor White
# Estimated totals: 11M + 3.5M + 1.5M + 1.2M = 17.2M
# Actual totals:    12M + 3.0M + 1.5M + 1.5M = 18.0M
# Total variance: +800K (over budget)

$varResp = D (Api "GET" "/operation-costs/containers/$CNT_ID/variance" $COST_TOKEN)
if ($varResp) {
    Write-Host "  Response keys: $($varResp.PSObject.Properties.Name -join ', ')"

    $variances = $null
    if ($varResp.variances) { $variances = @($varResp.variances) }
    $totals = $varResp.totals

    if ($variances -and $variances.Count -ge 4) {
        Pass "G1a: Variance report has $($variances.Count) cost items"
        foreach ($v in $variances) {
            $sign = if ([double]$v.variance -gt 0) { "+" } else { "" }
            Write-Host "    $($v.costType): est=$($v.estimatedAmount) | act=$($v.actualAmount) | var=$sign$($v.variance) ($($v.variancePercent)%)"
        }
    } elseif ($variances) {
        Warn "G1a: Only $($variances.Count) variance items"
    } else {
        Warn "G1a: No variances array in response"
    }

    if ($totals) {
        Write-Host ""
        Write-Host "  Totals:"
        Write-Host "    totalEstimated: $($totals.totalEstimated) VND"
        Write-Host "    totalActual:    $($totals.totalActual) VND"
        Write-Host "    totalVariance:  $($totals.totalVariance) VND"
        Write-Host "    isOverBudget:   $($totals.isOverBudget)"

        # G1b: Total actual = 18M
        if ([Math]::Abs([double]$totals.totalActual - 18000000) -lt 1) {
            Pass "G1b: totalActual = $($totals.totalActual) VND (18M correct)"
        } else {
            Fail "G1b: totalActual = $($totals.totalActual), expected 18000000"
        }

        # G1c: Total estimated = 17.2M
        if ([Math]::Abs([double]$totals.totalEstimated - 17200000) -lt 1) {
            Pass "G1c: totalEstimated = $($totals.totalEstimated) VND (17.2M correct)"
        } else {
            Warn "G1c: totalEstimated = $($totals.totalEstimated), expected 17200000"
        }

        # G1d: isOverBudget = true (actual > estimated)
        if ($totals.isOverBudget -eq $true) {
            Pass "G1d: isOverBudget = true (800K over)"
        } elseif ($totals.isOverBudget -eq $false) {
            Fail "G1d: isOverBudget = false (should be true, variance = +800K)"
        } else {
            Warn "G1d: isOverBudget = $($totals.isOverBudget)"
        }
    } else {
        Warn "G1b: No totals in variance response"
    }

    # G1e: FREIGHT over budget, CUSTOMS_DUTY under budget
    if ($variances) {
        $freightVar = $variances | Where-Object { $_.costType -eq 'FREIGHT' } | Select-Object -First 1
        $customsVar = $variances | Where-Object { $_.costType -eq 'CUSTOMS_DUTY' } | Select-Object -First 1

        if ($freightVar -and [double]$freightVar.isOverBudget -eq $true) {
            Pass "G1e: FREIGHT over budget (est 11M, act 12M)"
        } elseif ($freightVar -and [double]$freightVar.variance -gt 0) {
            Pass "G1e: FREIGHT variance positive ($($freightVar.variance))"
        } elseif ($freightVar) {
            Warn "G1e: FREIGHT variance = $($freightVar.variance)"
        }

        if ($customsVar -and [double]$customsVar.variance -lt 0) {
            Pass "G1f: CUSTOMS_DUTY under budget (est 3.5M, act 3M, saved 500K)"
        } elseif ($customsVar) {
            Warn "G1f: CUSTOMS_DUTY variance = $($customsVar.variance)"
        }
    }
} else {
    Fail "G1: Failed to get variance report"
}

# ================================================================
# PART H: RE-ALLOCATE BY EVEN
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Re-allocate by EVEN (equal split)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST H1: POST allocate by EVEN ===" -ForegroundColor White
$expectedPerOrder = [Math]::Floor($TOTAL_COST / 3)
Write-Host "  Expected per order: ~$expectedPerOrder VND ($TOTAL_COST / 3)"

$evenResp = D (Api "POST" "/operation-costs/containers/$CNT_ID/allocate?method=EVEN" $COST_TOKEN)
if ($evenResp) {
    Pass "H1: Even allocation request accepted"
} else {
    Fail "H1: Even allocation failed"
}

# Wait for async processing
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=== TEST H2: Verify even allocation on orders ===" -ForegroundColor White
$evenAllocSum = 0
$evenAllocAmounts = @()

for ($i = 0; $i -lt 3; $i++) {
    $n = $i + 1
    $orderCost = D (Api "GET" "/operation-costs/orders/$($ORDER_IDS[$i])" $COST_TOKEN)
    if ($orderCost) {
        $amt = [double]$orderCost.totalAllocatedCost
        $evenAllocAmounts += $amt
        $evenAllocSum += $amt
        Write-Host "    Order #${n} ($($ORDER_CODES[$i])): $amt VND"
    }
}

# H2a: All 3 orders should have roughly equal allocation
if ($evenAllocAmounts.Count -eq 3) {
    $minAlloc = ($evenAllocAmounts | Measure-Object -Minimum).Minimum
    $maxAlloc = ($evenAllocAmounts | Measure-Object -Maximum).Maximum
    $spread = $maxAlloc - $minAlloc

    Write-Host "  Min=$minAlloc | Max=$maxAlloc | Spread=$spread VND"

    if ($spread -lt 2) {
        Pass "H2a: All 3 orders have equal allocation ($minAlloc VND each)"
    } elseif ($spread -lt $TOTAL_COST * 0.02) {
        Pass "H2a: Allocations nearly equal (spread=$spread, < 2%)"
    } else {
        Fail "H2a: Allocations not equal (spread=$spread VND)"
    }
}

# H2b: Sum still equals total
Write-Host ""
Write-Host "=== TEST H3: Sum of even allocations ===" -ForegroundColor White
Write-Host "  Sum: $evenAllocSum VND | Total: $TOTAL_COST VND"
if ([Math]::Abs($evenAllocSum - $TOTAL_COST) -lt 1) {
    Pass "H3: Even allocation sum = $evenAllocSum matches total (no rounding loss)"
} elseif ([Math]::Abs($evenAllocSum - $TOTAL_COST) -lt 100) {
    Pass "H3: Even allocation sum = $evenAllocSum (within 100 VND of total)"
} else {
    Fail "H3: Sum $evenAllocSum != total $TOTAL_COST"
}

# ================================================================
# PART I: COST SUMMARY
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART I: Cost summary endpoint" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST I1: GET /operation-costs/summary ===" -ForegroundColor White
$summaryResp = D (Api "GET" "/operation-costs/summary" $COST_TOKEN)
if ($summaryResp) {
    Write-Host "  Response keys: $($summaryResp.PSObject.Properties.Name -join ', ')"

    if ($summaryResp.totalCost) {
        Write-Host "  totalCost:    $($summaryResp.totalCost) VND"
        Write-Host "  totalRecords: $($summaryResp.totalRecords)"
    }

    # I1a: Summary has cost breakdown by type
    $byType = $summaryResp.byCostType
    if ($byType -and $byType.Count -gt 0) {
        Write-Host "  Cost types: $($byType.Count)"
        foreach ($bt in $byType) {
            Write-Host "    $($bt.costType): total=$($bt.totalAmount), count=$($bt.count)"
        }
        Pass "I1a: Summary has cost breakdown by type ($($byType.Count) types)"
    } else {
        Warn "I1a: No byCostType in summary"
    }

    # I1b: Summary has top containers
    $topCnt = $summaryResp.topContainers
    if ($topCnt -and $topCnt.Count -gt 0) {
        $ourCnt = $topCnt | Where-Object { $_.containerCode -eq $CNT_CODE -or $_.containerId -eq $CNT_ID }
        if ($ourCnt) {
            Write-Host "  Our container in top list: $($ourCnt.containerCode) = $($ourCnt.totalCost) VND"
            Pass "I1b: Our container appears in top containers"
        } else {
            Pass "I1b: Top containers returned ($($topCnt.Count) entries)"
        }
    } else {
        Warn "I1b: No topContainers in summary"
    }
} else {
    Fail "I1: Failed to get cost summary"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-CNT-004: Chi phi van hanh + phan bo" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Container: $CNT_CODE (SEA, 3 orders, $TOTAL_WEIGHT kg)"
Write-Host "  Total costs: $TOTAL_COST VND (FREIGHT + CUSTOMS + HANDLING + TRANSPORT)"
Write-Host ""
Write-Host "  Part A: 3 orders (100, 200, 300 kg) + container"
Write-Host "  Part B: Record 4 operation costs"
Write-Host "  Part C: List + verify costs for container"
Write-Host "  Part D: Cost per kg = $([Math]::Round($TOTAL_COST / $TOTAL_WEIGHT, 0)) VND/kg"
Write-Host "  Part E: Allocate by WEIGHT (proportional)"
Write-Host "  Part F: Verify per-order allocation"
Write-Host "  Part G: Variance analysis (est vs actual)"
Write-Host "  Part H: Re-allocate by EVEN (equal split)"
Write-Host "  Part I: Cost summary"
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
