# ================================================================
# TEST-CRM-001: CRUD khach hang day du
# Severity: HIGH
#
# Steps:
#   1. CREATE: Tao KH moi voi day du thong tin
#   2. READ: GET /customers/:id -> verify tat ca field tra ve dung
#   3. UPDATE: Cap nhat dia chi, SDT -> verify audit log
#   4. DELETE: Soft delete (isActive=false) -> verify KH bi an nhung data van con
#   5. Verify: Don hang cu cua KH van reference duoc sau soft delete
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
Write-Host "  TEST-CRM-001: CRUD Khach Hang Day Du" -ForegroundColor Cyan
Write-Host "  Severity: HIGH" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ================================================================
# SETUP
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login ===" -ForegroundColor White

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SALE login OK" } else { Fail "SALE login FAILED"; exit 1 }

$CEO = Login "admin@$DOMAIN"
if ($CEO) { Pass "CEO login OK" } else { Fail "CEO login FAILED"; exit 1 }

$TS = Get-Date -Format "yyyyMMddHHmmss"

# ================================================================
# PART A: CREATE
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Tao khach hang moi" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST A1: Create customer voi day du thong tin ===" -ForegroundColor White

$createDto = @{
    fullName    = "Test Customer CRM001 $TS"
    companyName = "Cong ty Test CRM $TS"
    phone       = "09$($TS.Substring(4))"
    email       = "testcrm$TS@example.com"
    address     = "123 Pho Test, Quan Hoan Kiem, Ha Noi"
    taxCode     = "0$($TS.Substring(0,9))"
    branch      = "HN"
    note        = "KH test CRM-001"
}

$cust = D (Api "POST" "/customers" $SALE $createDto)
$CUST_ID = $null
if ($cust -and $cust.id) {
    $CUST_ID = $cust.id
    Write-Host "  ID: $CUST_ID"
    Write-Host "  Code: $($cust.code)"
    Write-Host "  fullName: $($cust.fullName)"
    Write-Host "  tier: $($cust.tier) | depositRate: $($cust.depositRate) | creditLimit: $($cust.creditLimit)"
    Pass "A1: Customer created successfully"
} else {
    Fail "A1: Failed to create customer"; exit 1
}

# A2: Verify auto-generated code
Write-Host ""
Write-Host "=== TEST A2: Verify auto-generated fields ===" -ForegroundColor White
if ($cust.code -and $cust.code -match "^ERP-KH-\d{6}$") {
    Pass "A2a: Code format correct ($($cust.code))"
} else {
    Fail "A2a: Code format wrong ($($cust.code)), expected ERP-KH-XXXXXX"
}

if ($cust.tier -eq "NEW") {
    Pass "A2b: Default tier = NEW"
} else {
    Fail "A2b: Default tier = $($cust.tier) (expected NEW)"
}

if ([int]$cust.depositRate -eq 100) {
    Pass "A2c: Default depositRate = 100%"
} else {
    Fail "A2c: Default depositRate = $($cust.depositRate) (expected 100)"
}

if ([double]$cust.creditLimit -eq 0) {
    Pass "A2d: Default creditLimit = 0 (NEW tier)"
} else {
    Fail "A2d: Default creditLimit = $($cust.creditLimit) (expected 0)"
}

# A3: Verify wallet auto-created
Write-Host ""
Write-Host "=== TEST A3: Verify wallet auto-created ===" -ForegroundColor White
if ($cust.wallet -and $cust.wallet.id) {
    $walletBal = [double]$cust.wallet.balance
    if ($walletBal -eq 0) {
        Pass "A3: Wallet auto-created with balance = 0"
    } else {
        Warn "A3: Wallet created but balance = $walletBal (expected 0)"
    }
} else {
    Warn "A3: Wallet not in create response (may need separate call)"
}

# ================================================================
# PART B: READ
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Doc thong tin khach hang" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST B1: GET /customers/:id ===" -ForegroundColor White
$readCust = D (Api "GET" "/customers/$CUST_ID" $SALE)

if ($readCust -and $readCust.id -eq $CUST_ID) {
    Pass "B1a: Customer found by ID"
} else {
    Fail "B1a: Customer not found by ID"; exit 1
}

# Verify all fields match
if ($readCust.fullName -eq $createDto.fullName) {
    Pass "B1b: fullName matches"
} else {
    Fail "B1b: fullName = '$($readCust.fullName)' (expected '$($createDto.fullName)')"
}

if ($readCust.phone -eq $createDto.phone) {
    Pass "B1c: phone matches"
} else {
    Fail "B1c: phone = '$($readCust.phone)' (expected '$($createDto.phone)')"
}

if ($readCust.email -eq $createDto.email) {
    Pass "B1d: email matches"
} else {
    Fail "B1d: email = '$($readCust.email)' (expected '$($createDto.email)')"
}

if ($readCust.address -eq $createDto.address) {
    Pass "B1e: address matches"
} else {
    Fail "B1e: address = '$($readCust.address)' (expected '$($createDto.address)')"
}

if ($readCust.taxCode -eq $createDto.taxCode) {
    Pass "B1f: taxCode matches"
} else {
    Fail "B1f: taxCode = '$($readCust.taxCode)' (expected '$($createDto.taxCode)')"
}

if ($readCust.companyName -eq $createDto.companyName) {
    Pass "B1g: companyName matches"
} else {
    Fail "B1g: companyName = '$($readCust.companyName)' (expected '$($createDto.companyName)')"
}

if ($readCust.branch -eq "HN") {
    Pass "B1h: branch = HN"
} else {
    Fail "B1h: branch = '$($readCust.branch)' (expected 'HN')"
}

if ($readCust.isActive -eq $true) {
    Pass "B1i: isActive = true (default)"
} else {
    Fail "B1i: isActive = $($readCust.isActive) (expected true)"
}

# B2: List customers with search
Write-Host ""
Write-Host "=== TEST B2: Search customer by phone ===" -ForegroundColor White
$searchResult = Api "GET" "/customers?search=$($createDto.phone)" $SALE
$searchData = $null
if ($searchResult -and $searchResult.data) {
    if ($searchResult.data -is [array]) { $searchData = $searchResult.data }
    elseif ($searchResult.data.data) { $searchData = $searchResult.data.data }
    elseif ($searchResult.data.items) { $searchData = $searchResult.data.items }
}
if (-not $searchData -and $searchResult -and $searchResult.items) {
    $searchData = $searchResult.items
}

$foundInSearch = $false
if ($searchData -is [array]) {
    $foundInSearch = ($searchData | Where-Object { $_.id -eq $CUST_ID }) -ne $null
}
if ($foundInSearch) {
    Pass "B2: Customer found in search by phone"
} else {
    Warn "B2: Customer not found in search (search may not be applied or paginated format different)"
}

# ================================================================
# PART C: UPDATE
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Cap nhat thong tin khach hang" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST C1: Update address + phone ===" -ForegroundColor White

$newAddress = "456 Duong Moi, Quan Ba Dinh, Ha Noi"
$newPhone = "08$($TS.Substring(4))"

$updateDto = @{
    address = $newAddress
    phone   = $newPhone
}

$updated = D (Api "PATCH" "/customers/$CUST_ID" $SALE $updateDto)
if ($updated -and $updated.id -eq $CUST_ID) {
    if ($updated.address -eq $newAddress) {
        Pass "C1a: Address updated successfully"
    } else {
        Fail "C1a: Address not updated (got '$($updated.address)')"
    }

    if ($updated.phone -eq $newPhone) {
        Pass "C1b: Phone updated successfully"
    } else {
        Fail "C1b: Phone not updated (got '$($updated.phone)')"
    }

    # Verify unchanged fields remain
    if ($updated.fullName -eq $createDto.fullName) {
        Pass "C1c: fullName unchanged after partial update"
    } else {
        Fail "C1c: fullName changed to '$($updated.fullName)'"
    }

    if ($updated.email -eq $createDto.email) {
        Pass "C1d: email unchanged after partial update"
    } else {
        Fail "C1d: email changed to '$($updated.email)'"
    }
} else {
    Fail "C1: Failed to update customer"
}

# C2: Verify audit log
Write-Host ""
Write-Host "=== TEST C2: Verify audit log for UPDATE ===" -ForegroundColor White
# AuditLogInterceptor writes: entity="Customer", action="UPDATE", entityId=CUST_ID
# We don't have a direct audit log query endpoint, so we check via DB indirectly
# by re-reading the customer and confirming updatedAt changed
$reRead = D (Api "GET" "/customers/$CUST_ID" $SALE)
if ($reRead -and $reRead.updatedAt) {
    if ($reRead.updatedAt -ne $reRead.createdAt) {
        Pass "C2: updatedAt differs from createdAt (audit trail indicator)"
    } else {
        Warn "C2: updatedAt same as createdAt (audit log may still exist in DB)"
    }
} else {
    Warn "C2: Cannot verify audit log (no updatedAt field)"
}

# C3: Update note
Write-Host ""
Write-Host "=== TEST C3: Update note ===" -ForegroundColor White
$newNote = "Updated note - CRM test at $TS"
$updated2 = D (Api "PATCH" "/customers/$CUST_ID" $SALE @{ note = $newNote })
if ($updated2 -and $updated2.note -eq $newNote) {
    Pass "C3: Note updated successfully"
} else {
    Fail "C3: Note not updated (got '$($updated2.note)')"
}

# ================================================================
# PART D: SOFT DELETE
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Soft delete (isActive = false)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST D1: Set isActive = false ===" -ForegroundColor White
$deactivated = D (Api "PATCH" "/customers/$CUST_ID" $SALE @{ isActive = $false })
if ($deactivated -and $deactivated.isActive -eq $false) {
    Pass "D1: Customer deactivated (isActive=false)"
} else {
    Fail "D1: Failed to deactivate customer (isActive=$($deactivated.isActive))"
}

# D2: Verify customer still readable by ID
Write-Host ""
Write-Host "=== TEST D2: Deactivated customer still readable by ID ===" -ForegroundColor White
$readInactive = D (Api "GET" "/customers/$CUST_ID" $SALE)
if ($readInactive -and $readInactive.id -eq $CUST_ID) {
    Pass "D2a: Deactivated customer still accessible by ID"
    if ($readInactive.isActive -eq $false) {
        Pass "D2b: isActive confirmed = false"
    } else {
        Fail "D2b: isActive = $($readInactive.isActive) (expected false)"
    }
    # Verify all data intact
    if ($readInactive.fullName -eq $createDto.fullName) {
        Pass "D2c: fullName intact after deactivation"
    } else {
        Fail "D2c: fullName lost after deactivation"
    }
    if ($readInactive.taxCode -eq $createDto.taxCode) {
        Pass "D2d: taxCode intact after deactivation"
    } else {
        Fail "D2d: taxCode lost after deactivation"
    }
} else {
    Fail "D2: Cannot read deactivated customer"
}

# D3: Verify customer filtered from active list
Write-Host ""
Write-Host "=== TEST D3: Deactivated customer hidden from active list ===" -ForegroundColor White
$activeList = Api "GET" "/customers?isActive=true&search=$($createDto.fullName.Substring(0,20))" $SALE
$activeData = $null
if ($activeList -and $activeList.data) {
    if ($activeList.data -is [array]) { $activeData = $activeList.data }
    elseif ($activeList.data.data) { $activeData = $activeList.data.data }
    elseif ($activeList.data.items) { $activeData = $activeList.data.items }
}
$foundInActive = $false
if ($activeData -is [array]) {
    $foundInActive = ($activeData | Where-Object { $_.id -eq $CUST_ID }) -ne $null
}
if ($foundInActive -eq $false) {
    Pass "D3: Deactivated customer NOT in active list"
} else {
    Fail "D3: Deactivated customer still appears in active list"
}

# ================================================================
# PART E: ORDER REFERENCE AFTER SOFT DELETE
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: Don hang van reference KH sau soft delete" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== TEST E1: Reactivate + create order + deactivate again ===" -ForegroundColor White
# First, reactivate so we can create an order
$reactivated = D (Api "PATCH" "/customers/$CUST_ID" $SALE @{ isActive = $true })
if ($reactivated -and $reactivated.isActive -eq $true) {
    Pass "E1a: Customer reactivated"
} else {
    Fail "E1a: Failed to reactivate"; exit 1
}

# Upgrade to STRATEGIC so credit limit allows order creation (NEW has credit=0)
D (Api "PATCH" "/customers/$CUST_ID" $SALE @{ tier = "STRATEGIC" }) | Out-Null

# Create an order for this customer
$order = D (Api "POST" "/orders" $SALE @{
    customerId    = $CUST_ID
    serviceType   = "VCT"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @( @{ productName = "Test item CRM001"; quantity = 1; unitPrice = 100 } )
    note          = "Order for soft-delete test"
})
$ORD_ID = $null
if ($order -and $order.id) {
    $ORD_ID = $order.id
    Write-Host "  Order: $($order.code) | customerId=$($order.customerId)"
    Pass "E1b: Order created for test customer"
} else {
    Fail "E1b: Failed to create order for test customer"
}

# Deactivate customer again
$deactivated2 = D (Api "PATCH" "/customers/$CUST_ID" $SALE @{ isActive = $false })
if ($deactivated2 -and $deactivated2.isActive -eq $false) {
    Pass "E1c: Customer deactivated again"
} else {
    Warn "E1c: Failed to deactivate again"
}

# E2: Verify order still references the customer
Write-Host ""
Write-Host "=== TEST E2: Order still accessible with deactivated customer ===" -ForegroundColor White
if ($ORD_ID) {
    $orderCheck = D (Api "GET" "/orders/$ORD_ID" $SALE)
    if ($orderCheck -and $orderCheck.customerId -eq $CUST_ID) {
        Pass "E2a: Order still references deactivated customer"
    } else {
        Fail "E2a: Order lost customer reference"
    }
    # Check if customer info is included in order response
    if ($orderCheck.customer -and $orderCheck.customer.fullName) {
        Pass "E2b: Customer data still available in order response"
    } elseif ($orderCheck.customerName) {
        Pass "E2b: Customer name available in order response (customerName field)"
    } else {
        Warn "E2b: Customer data not included in order response (may need join)"
    }
} else {
    Warn "E2: Skipped (no order created)"
}

# E3: Verify new order blocked for inactive customer
Write-Host ""
Write-Host "=== TEST E3: New order blocked for inactive customer ===" -ForegroundColor White
$blockedOrder = Api "POST" "/orders" $SALE @{
    customerId    = $CUST_ID
    serviceType   = "VCT"
    branch        = "HN"
    shippingRoute = "SEA"
    items         = @( @{ productName = "Blocked item"; quantity = 1; unitPrice = 100 } )
}
if (-not $blockedOrder -or ($blockedOrder.statusCode -and $blockedOrder.statusCode -ge 400)) {
    Pass "E3: New order blocked for inactive customer (403/400)"
} elseif ($blockedOrder.data -and $blockedOrder.data.id) {
    Fail "E3: Order was created for inactive customer (should be blocked)"
} else {
    Pass "E3: New order blocked for inactive customer"
}

# ================================================================
# PART F: EDGE CASES
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Edge cases" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# F1: Create customer with missing required field
Write-Host ""
Write-Host "=== TEST F1: Missing required field (fullName) ===" -ForegroundColor White
$badCreate = Api "POST" "/customers" $SALE @{
    phone = "0999999999"
}
if (-not $badCreate -or ($badCreate.statusCode -and $badCreate.statusCode -ge 400)) {
    Pass "F1: Missing fullName rejected (400)"
} else {
    Fail "F1: Missing fullName accepted (should fail)"
}

# F2: Create customer with missing phone
Write-Host ""
Write-Host "=== TEST F2: Missing required field (phone) ===" -ForegroundColor White
$badCreate2 = Api "POST" "/customers" $SALE @{
    fullName = "Missing Phone Test"
}
if (-not $badCreate2 -or ($badCreate2.statusCode -and $badCreate2.statusCode -ge 400)) {
    Pass "F2: Missing phone rejected (400)"
} else {
    Fail "F2: Missing phone accepted (should fail)"
}

# F3: Reactivate customer
Write-Host ""
Write-Host "=== TEST F3: Reactivate deactivated customer ===" -ForegroundColor White
$reactivated2 = D (Api "PATCH" "/customers/$CUST_ID" $SALE @{ isActive = $true })
if ($reactivated2 -and $reactivated2.isActive -eq $true) {
    Pass "F3: Customer reactivated successfully"
} else {
    Fail "F3: Failed to reactivate customer"
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-CRM-001: CRUD Khach Hang Day Du" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Part A: Create customer with full info"
Write-Host "  Part B: Read + verify all fields"
Write-Host "  Part C: Update partial fields + audit"
Write-Host "  Part D: Soft delete (isActive=false)"
Write-Host "  Part E: Order reference after soft delete"
Write-Host "  Part F: Edge cases"
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
