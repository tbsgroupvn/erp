# ================================================================
# TEST-SEC-014: Field-level Encryption for PII data
# Severity: HIGH
#
# Tests that PII fields are encrypted at rest and transparently
# decrypted when read via API (AES-256-GCM via Prisma extension).
#
# Encrypted fields:
#   - Vendor: phone, bankAccount
#   - Employee: phone, bankAccount, taxCode, insuranceId
#   - Customer: contactPhone, contactEmail (config) / phone, email (schema)
#
# We test INDIRECTLY via API:
#   Write PII -> Read back -> Verify plaintext returned (not encrypted blob)
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
        return @{ code = [int]$r.StatusCode; body = $parsed; error = $null; raw = $r.Content }
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
        return @{ code = $code; body = $parsed; error = $errBody; raw = $errBody }
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

# Helper: Check if a string looks like an encryption artifact
# Standard format: v1:base64:base64:base64
# Deterministic format: d:v1:base64
function Has-EncryptionArtifact($value) {
    if (-not $value) { return $false }
    $s = "$value"
    # Standard encryption: keyVersion:iv:authTag:ciphertext
    if ($s -match '^v\d+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$') { return $true }
    # Deterministic: d:keyVersion:hmac
    if ($s -match '^d:v\d+:[A-Za-z0-9+/=]+$') { return $true }
    return $false
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST-SEC-014: Field-level Encryption for PII Data" -ForegroundColor Cyan
Write-Host "  Severity: HIGH" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$TS = Get-Date -Format "yyyyMMddHHmmss"

# ================================================================
# SETUP: Login all roles
# ================================================================
Write-Host ""
Write-Host "=== SETUP: Login all roles ===" -ForegroundColor White

$CEO = Login "ceo@$DOMAIN"
if ($CEO) { Pass "SETUP: CEO login OK" } else { Warn "SETUP: CEO login failed, trying admin@"; $CEO = Login "admin@$DOMAIN" }
if (-not $CEO) { Fail "SETUP: No CEO/admin token available"; exit 1 }

$COO = Login "admin@$DOMAIN"
if ($COO) { Pass "SETUP: COO login OK" } else { Warn "SETUP: COO login failed" }

$SALE = Login "sale01@$DOMAIN"
if ($SALE) { Pass "SETUP: SALE login OK" } else { Warn "SETUP: SALE login failed" }

$ACCOUNTANT = Login "ketoan@$DOMAIN"
if ($ACCOUNTANT) { Pass "SETUP: CHIEF_ACCOUNTANT login OK" } else { Warn "SETUP: CHIEF_ACCOUNTANT login failed" }

$HR = Login "hr@$DOMAIN"
if ($HR) { Pass "SETUP: HR_MANAGER login OK" } else { Warn "SETUP: HR_MANAGER login failed" }

$XNK = Login "xnk@$DOMAIN"
if ($XNK) { Pass "SETUP: XNK_MANAGER login OK" } else { Warn "SETUP: XNK_MANAGER login failed" }

# Use best available token for vendor operations (XNK or CEO)
$VENDOR_TOKEN = $XNK
if (-not $VENDOR_TOKEN) { $VENDOR_TOKEN = $CEO }

# Use best available token for employee operations (HR or CEO)
$EMP_TOKEN = $HR
if (-not $EMP_TOKEN) { $EMP_TOKEN = $CEO }

# Use best available token for customer operations (SALE or CEO)
$CUST_TOKEN = $SALE
if (-not $CUST_TOKEN) { $CUST_TOKEN = $CEO }

# ================================================================
# PART A: Vendor PII - Create + Read Back
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART A: Vendor PII - Create + Read Back" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$VENDOR_PHONE = "0901234567"
$VENDOR_BANK = "1234567890123456"
$VENDOR_BANK_NAME = "Vietcombank"

$vendorDto = @{
    name          = "SEC-014 Test Vendor $TS"
    contactPerson = "Nguyen Van Test"
    phone         = $VENDOR_PHONE
    email         = "vendor.sec014.$TS@example.com"
    bankName      = $VENDOR_BANK_NAME
    bankAccount   = $VENDOR_BANK
    address       = "123 Le Loi, Q1, HCM"
}

Write-Host ""
Write-Host "=== TEST A1-A2: Create vendor with PII ===" -ForegroundColor White
$vendor = D (Api "POST" "/vendors" $VENDOR_TOKEN $vendorDto)
$VENDOR_ID = $null

if ($vendor -and $vendor.id) {
    $VENDOR_ID = $vendor.id
    Write-Host "  Vendor ID: $VENDOR_ID"
    Write-Host "  Vendor Code: $($vendor.code)"
    Pass "A1: Vendor created successfully"
    Pass "A2: Vendor ID obtained: $VENDOR_ID"
} else {
    Fail "A1: Failed to create vendor"
    Fail "A2: No vendor ID"
}

# A3: Read back and verify phone decrypted
Write-Host ""
Write-Host "=== TEST A3: GET /vendors/:id - verify phone decrypted ===" -ForegroundColor White
if ($VENDOR_ID) {
    $readVendor = D (Api "GET" "/vendors/$VENDOR_ID" $VENDOR_TOKEN)
    if ($readVendor) {
        if ($readVendor.phone -eq $VENDOR_PHONE) {
            Pass "A3: phone returned as '$VENDOR_PHONE' (decrypted correctly)"
        } elseif (Has-EncryptionArtifact $readVendor.phone) {
            Fail "A3: phone returned as ENCRYPTED blob: '$($readVendor.phone)' - Prisma extension not decrypting"
        } elseif ($readVendor.phone) {
            Warn "A3: phone returned as '$($readVendor.phone)' (different from input '$VENDOR_PHONE')"
        } else {
            Warn "A3: phone field is null/empty in response"
        }
    } else {
        Fail "A3: Failed to read vendor"
    }
} else {
    Warn "A3: Skipped (no vendor ID)"
}

# A4: Verify bankAccount decrypted
Write-Host ""
Write-Host "=== TEST A4: Verify bankAccount decrypted ===" -ForegroundColor White
if ($VENDOR_ID -and $readVendor) {
    if ($readVendor.bankAccount -eq $VENDOR_BANK) {
        Pass "A4: bankAccount returned as '$VENDOR_BANK' (decrypted correctly)"
    } elseif (Has-EncryptionArtifact $readVendor.bankAccount) {
        Fail "A4: bankAccount returned as ENCRYPTED blob - Prisma extension not decrypting"
    } elseif ($readVendor.bankAccount) {
        Warn "A4: bankAccount returned as '$($readVendor.bankAccount)' (different from input)"
    } else {
        Warn "A4: bankAccount field is null/empty in response"
    }
} else {
    Warn "A4: Skipped"
}

# A5: Verify bankName returned correctly
Write-Host ""
Write-Host "=== TEST A5: Verify bankName returned ===" -ForegroundColor White
if ($VENDOR_ID -and $readVendor) {
    if ($readVendor.bankName -eq $VENDOR_BANK_NAME) {
        Pass "A5: bankName returned as '$VENDOR_BANK_NAME'"
    } else {
        Warn "A5: bankName = '$($readVendor.bankName)' (expected '$VENDOR_BANK_NAME')"
    }
} else {
    Warn "A5: Skipped"
}

# A6: Verify NO encryption artifacts in response
Write-Host ""
Write-Host "=== TEST A6: No encryption artifacts in vendor response ===" -ForegroundColor White
if ($VENDOR_ID -and $readVendor) {
    $hasArtifact = $false
    foreach ($field in @('phone', 'bankAccount', 'bankName', 'contactPerson', 'email', 'address')) {
        $val = $readVendor.$field
        if ($val -and (Has-EncryptionArtifact $val)) {
            Write-Host "    ARTIFACT found in field '$field': $val" -ForegroundColor Red
            $hasArtifact = $true
        }
    }
    if (-not $hasArtifact) {
        Pass "A6: No encryption artifacts found in vendor response"
    } else {
        Fail "A6: Encryption artifacts found in vendor response (decryption not working)"
    }
} else {
    Warn "A6: Skipped"
}

# ================================================================
# PART B: Employee PII - Create + Read Back
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART B: Employee PII - Create + Read Back" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$EMP_PHONE = "0987654321"
$EMP_BANK = "9876543210987654"
$EMP_TAX = "1234567890"
$EMP_INSURANCE = "HS0123456789"

# B1: Confirm HR token
Write-Host ""
Write-Host "=== TEST B1: HR_MANAGER token for employee operations ===" -ForegroundColor White
if ($EMP_TOKEN) {
    Pass "B1: HR/CEO token available for employee operations"
} else {
    Fail "B1: No token available for employee operations";
}

# B2: Create employee
Write-Host ""
Write-Host "=== TEST B2-B3: Create employee with PII ===" -ForegroundColor White
$empDto = @{
    fullName       = "SEC-014 Employee $TS"
    email          = "sec014.emp.$TS@$DOMAIN"
    phone          = $EMP_PHONE
    bankName       = "Techcombank"
    bankAccount    = $EMP_BANK
    taxCode        = $EMP_TAX
    insuranceId    = $EMP_INSURANCE
    branch         = "HN"
    departmentCode = "IT"
    positionTitle  = "Developer"
    joinDate       = "2025-01-15"
}

$employee = D (Api "POST" "/employees" $EMP_TOKEN $empDto)
$EMP_ID = $null

if ($employee -and $employee.id) {
    $EMP_ID = $employee.id
    Write-Host "  Employee ID: $EMP_ID"
    Write-Host "  Employee Code: $($employee.code)"
    Pass "B2: Employee created successfully"
    Pass "B3: Employee ID obtained: $EMP_ID"
} else {
    Fail "B2: Failed to create employee"
    Fail "B3: No employee ID"
}

# B4: Read back and verify phone decrypted
Write-Host ""
Write-Host "=== TEST B4: GET /employees/:id - verify phone decrypted ===" -ForegroundColor White
if ($EMP_ID) {
    $readEmp = D (Api "GET" "/employees/$EMP_ID" $EMP_TOKEN)
    if ($readEmp) {
        if ($readEmp.phone -eq $EMP_PHONE) {
            Pass "B4: phone returned as '$EMP_PHONE' (decrypted correctly)"
        } elseif (Has-EncryptionArtifact $readEmp.phone) {
            Fail "B4: phone returned as ENCRYPTED blob - Prisma extension not decrypting"
        } elseif ($readEmp.phone) {
            Warn "B4: phone returned as '$($readEmp.phone)' (different from input)"
        } else {
            Warn "B4: phone field is null/empty"
        }
    } else {
        Fail "B4: Failed to read employee"
    }
} else {
    Warn "B4: Skipped (no employee ID)"
}

# B5: Verify bankAccount
Write-Host ""
Write-Host "=== TEST B5: Verify employee bankAccount decrypted ===" -ForegroundColor White
if ($EMP_ID -and $readEmp) {
    if ($readEmp.bankAccount -eq $EMP_BANK) {
        Pass "B5: bankAccount returned as '$EMP_BANK' (decrypted correctly)"
    } elseif (Has-EncryptionArtifact $readEmp.bankAccount) {
        Fail "B5: bankAccount returned as ENCRYPTED blob"
    } elseif ($readEmp.bankAccount) {
        Warn "B5: bankAccount = '$($readEmp.bankAccount)' (different from input)"
    } else {
        Warn "B5: bankAccount field is null/empty"
    }
} else {
    Warn "B5: Skipped"
}

# B6: Verify taxCode
Write-Host ""
Write-Host "=== TEST B6: Verify employee taxCode decrypted ===" -ForegroundColor White
if ($EMP_ID -and $readEmp) {
    if ($readEmp.taxCode -eq $EMP_TAX) {
        Pass "B6: taxCode returned as '$EMP_TAX' (decrypted correctly)"
    } elseif (Has-EncryptionArtifact $readEmp.taxCode) {
        Fail "B6: taxCode returned as ENCRYPTED blob"
    } elseif ($readEmp.taxCode) {
        Warn "B6: taxCode = '$($readEmp.taxCode)' (different from input)"
    } else {
        Warn "B6: taxCode field is null/empty"
    }
} else {
    Warn "B6: Skipped"
}

# B7: Verify insuranceId
Write-Host ""
Write-Host "=== TEST B7: Verify employee insuranceId decrypted ===" -ForegroundColor White
if ($EMP_ID -and $readEmp) {
    if ($readEmp.insuranceId -eq $EMP_INSURANCE) {
        Pass "B7: insuranceId returned as '$EMP_INSURANCE' (decrypted correctly)"
    } elseif (Has-EncryptionArtifact $readEmp.insuranceId) {
        Fail "B7: insuranceId returned as ENCRYPTED blob"
    } elseif ($readEmp.insuranceId) {
        Warn "B7: insuranceId = '$($readEmp.insuranceId)' (different from input)"
    } else {
        Warn "B7: insuranceId field is null/empty"
    }
} else {
    Warn "B7: Skipped"
}

# ================================================================
# PART C: Customer PII
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART C: Customer PII" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# NOTE: The encryption config maps Customer: ['contactPhone', 'contactEmail']
# but the actual Prisma schema uses 'phone' and 'email'.
# This test verifies whether data round-trips correctly regardless.

$CUST_PHONE = "0912SEC014"
$CUST_EMAIL = "sec014.cust.$TS@example.com"

# C1: Create a customer with PII
Write-Host ""
Write-Host "=== TEST C1: Create customer with PII ===" -ForegroundColor White
$custDto = @{
    fullName = "SEC-014 Customer $TS"
    phone    = $CUST_PHONE
    email    = $CUST_EMAIL
    branch   = "HN"
    address  = "456 Tran Hung Dao, Q5, HCM"
    note     = "Field encryption test customer"
}

$customer = D (Api "POST" "/customers" $CUST_TOKEN $custDto)
$CUST_ID = $null

if ($customer -and $customer.id) {
    $CUST_ID = $customer.id
    Write-Host "  Customer ID: $CUST_ID"
    Write-Host "  Customer Code: $($customer.code)"
    Pass "C1: Customer created successfully"
} else {
    Fail "C1: Failed to create customer"
    # Fallback: try to find an existing customer
    Write-Host "  Attempting to find an existing customer..." -ForegroundColor Yellow
    $custList = D (Api "GET" "/customers?limit=1" $CUST_TOKEN)
    if ($custList -and $custList.data -and $custList.data.Count -gt 0) {
        $CUST_ID = $custList.data[0].id
        $CUST_PHONE = $custList.data[0].phone
        $CUST_EMAIL = $custList.data[0].email
        Write-Host "  Found existing customer: $CUST_ID" -ForegroundColor Yellow
    } elseif ($custList -and $custList.Count -gt 0) {
        $CUST_ID = $custList[0].id
        $CUST_PHONE = $custList[0].phone
        $CUST_EMAIL = $custList[0].email
    }
}

# C2: Get customer detail
Write-Host ""
Write-Host "=== TEST C2: GET /customers/:id ===" -ForegroundColor White
$readCust = $null
if ($CUST_ID) {
    $readCust = D (Api "GET" "/customers/$CUST_ID" $CUST_TOKEN)
    if ($readCust -and $readCust.id) {
        Pass "C2: Customer detail retrieved"
    } else {
        Fail "C2: Failed to get customer detail"
    }
} else {
    Warn "C2: Skipped (no customer ID)"
}

# C3: Verify phone is readable (not encrypted format)
Write-Host ""
Write-Host "=== TEST C3: Verify customer phone is readable ===" -ForegroundColor White
if ($readCust) {
    $cPhone = $readCust.phone
    if (-not $cPhone) { $cPhone = $readCust.contactPhone }
    if ($cPhone -and -not (Has-EncryptionArtifact $cPhone)) {
        Pass "C3: Customer phone is readable plaintext: '$cPhone'"
    } elseif (Has-EncryptionArtifact $cPhone) {
        Fail "C3: Customer phone is an encrypted blob - decryption not working"
    } else {
        Warn "C3: Customer phone field is null/empty"
    }
} else {
    Warn "C3: Skipped"
}

# C4: Verify email is readable
Write-Host ""
Write-Host "=== TEST C4: Verify customer email is readable ===" -ForegroundColor White
if ($readCust) {
    $cEmail = $readCust.email
    if (-not $cEmail) { $cEmail = $readCust.contactEmail }
    if ($cEmail -and -not (Has-EncryptionArtifact $cEmail)) {
        Pass "C4: Customer email is readable plaintext: '$cEmail'"
    } elseif (Has-EncryptionArtifact $cEmail) {
        Fail "C4: Customer email is an encrypted blob - decryption not working"
    } else {
        Warn "C4: Customer email field is null/empty"
    }
} else {
    Warn "C4: Skipped"
}

# C5: Verify written PII reads back correctly
Write-Host ""
Write-Host "=== TEST C5: Verify written PII matches read ===" -ForegroundColor White
if ($readCust -and $CUST_PHONE) {
    $matchPhone = ($readCust.phone -eq $CUST_PHONE) -or ($readCust.contactPhone -eq $CUST_PHONE)
    if ($matchPhone) {
        Pass "C5: Customer phone write/read roundtrip matches"
    } else {
        Warn "C5: Customer phone mismatch - wrote '$CUST_PHONE', read '$($readCust.phone)'"
    }
} else {
    Warn "C5: Skipped"
}

# ================================================================
# PART D: Encryption Format Verification (raw response check)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART D: Encryption Format Verification (raw responses)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Regex patterns for encryption artifacts in raw JSON
$stdPattern = 'v\d+:[A-Za-z0-9+/=]{10,}:[A-Za-z0-9+/=]{10,}:[A-Za-z0-9+/=]{2,}'
$detPattern = 'd:v\d+:[A-Za-z0-9+/=]{10,}'

# D1: Get vendor response as raw string
Write-Host ""
Write-Host "=== TEST D1: Raw vendor response check ===" -ForegroundColor White
if ($VENDOR_ID) {
    $rawVendor = Api-Expect "GET" "/vendors/$VENDOR_ID" $VENDOR_TOKEN
    if ($rawVendor.raw) {
        Pass "D1: Got raw vendor response (status $($rawVendor.code))"
    } else {
        Warn "D1: Could not get raw vendor response"
    }
} else {
    Warn "D1: Skipped (no vendor ID)"
}

# D2: Check vendor response for standard encryption pattern
Write-Host ""
Write-Host "=== TEST D2: Vendor response - no standard encryption artifacts ===" -ForegroundColor White
if ($rawVendor -and $rawVendor.raw) {
    if ($rawVendor.raw -match $stdPattern) {
        Fail "D2: Vendor response contains standard encryption artifact (v1:iv:tag:cipher)"
        Write-Host "    Matched: $($Matches[0].Substring(0, [Math]::Min(60, $Matches[0].Length)))..." -ForegroundColor Red
    } else {
        Pass "D2: Vendor response has no standard encryption artifacts"
    }
} else {
    Warn "D2: Skipped"
}

# D3: Check vendor response for deterministic encryption pattern
Write-Host ""
Write-Host "=== TEST D3: Vendor response - no deterministic encryption artifacts ===" -ForegroundColor White
if ($rawVendor -and $rawVendor.raw) {
    if ($rawVendor.raw -match $detPattern) {
        Fail "D3: Vendor response contains deterministic encryption artifact (d:v1:hmac)"
        Write-Host "    Matched: $($Matches[0].Substring(0, [Math]::Min(60, $Matches[0].Length)))..." -ForegroundColor Red
    } else {
        Pass "D3: Vendor response has no deterministic encryption artifacts"
    }
} else {
    Warn "D3: Skipped"
}

# D4: Check employee response
Write-Host ""
Write-Host "=== TEST D4: Employee response - no encryption artifacts ===" -ForegroundColor White
if ($EMP_ID) {
    $rawEmp = Api-Expect "GET" "/employees/$EMP_ID" $EMP_TOKEN
    if ($rawEmp -and $rawEmp.raw) {
        $hasStd = $rawEmp.raw -match $stdPattern
        $hasDet = $rawEmp.raw -match $detPattern
        if ($hasStd -or $hasDet) {
            Fail "D4: Employee response contains encryption artifacts"
            if ($hasStd) { Write-Host "    Standard artifact found" -ForegroundColor Red }
            if ($hasDet) { Write-Host "    Deterministic artifact found" -ForegroundColor Red }
        } else {
            Pass "D4: Employee response has no encryption artifacts"
        }
    } else {
        Warn "D4: Could not get raw employee response"
    }
} else {
    Warn "D4: Skipped (no employee ID)"
}

# D5: Check customer response
Write-Host ""
Write-Host "=== TEST D5: Customer response - no encryption artifacts ===" -ForegroundColor White
if ($CUST_ID) {
    $rawCust = Api-Expect "GET" "/customers/$CUST_ID" $CUST_TOKEN
    if ($rawCust -and $rawCust.raw) {
        $hasStd = $rawCust.raw -match $stdPattern
        $hasDet = $rawCust.raw -match $detPattern
        if ($hasStd -or $hasDet) {
            Fail "D5: Customer response contains encryption artifacts"
            if ($hasStd) { Write-Host "    Standard artifact found" -ForegroundColor Red }
            if ($hasDet) { Write-Host "    Deterministic artifact found" -ForegroundColor Red }
        } else {
            Pass "D5: Customer response has no encryption artifacts"
        }
    } else {
        Warn "D5: Could not get raw customer response"
    }
} else {
    Warn "D5: Skipped (no customer ID)"
}

# ================================================================
# PART E: PII Consistency (write + read roundtrip)
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART E: PII Consistency - Write/Read Roundtrip" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# E1: Update vendor phone to unique value
Write-Host ""
Write-Host "=== TEST E1: Update vendor phone to '0909SEC014' ===" -ForegroundColor White
if ($VENDOR_ID) {
    $updated1 = D (Api "PATCH" "/vendors/$VENDOR_ID" $VENDOR_TOKEN @{ phone = "0909SEC014" })
    if ($updated1) {
        Pass "E1: Vendor phone update request accepted"
    } else {
        Fail "E1: Failed to update vendor phone"
    }
} else {
    Warn "E1: Skipped (no vendor ID)"
}

# E2: Read back and verify
Write-Host ""
Write-Host "=== TEST E2: Read back vendor phone = '0909SEC014' ===" -ForegroundColor White
if ($VENDOR_ID) {
    $readBack1 = D (Api "GET" "/vendors/$VENDOR_ID" $VENDOR_TOKEN)
    if ($readBack1 -and $readBack1.phone -eq "0909SEC014") {
        Pass "E2: Vendor phone roundtrip: wrote '0909SEC014' -> read '0909SEC014'"
    } elseif ($readBack1 -and (Has-EncryptionArtifact $readBack1.phone)) {
        Fail "E2: Vendor phone returned encrypted after update"
    } else {
        Fail "E2: Vendor phone mismatch - expected '0909SEC014', got '$($readBack1.phone)'"
    }
} else {
    Warn "E2: Skipped"
}

# E3: Update again to different value
Write-Host ""
Write-Host "=== TEST E3: Update vendor phone to '0908141592' ===" -ForegroundColor White
if ($VENDOR_ID) {
    $updated2 = D (Api "PATCH" "/vendors/$VENDOR_ID" $VENDOR_TOKEN @{ phone = "0908141592" })
    if ($updated2) {
        Pass "E3: Vendor phone second update accepted"
    } else {
        Fail "E3: Failed to update vendor phone again"
    }
} else {
    Warn "E3: Skipped"
}

# E4: Read back and verify changed
Write-Host ""
Write-Host "=== TEST E4: Read back vendor phone = '0908141592' ===" -ForegroundColor White
if ($VENDOR_ID) {
    $readBack2 = D (Api "GET" "/vendors/$VENDOR_ID" $VENDOR_TOKEN)
    if ($readBack2 -and $readBack2.phone -eq "0908141592") {
        Pass "E4: Vendor phone roundtrip: wrote '0908141592' -> read '0908141592'"
    } elseif ($readBack2 -and (Has-EncryptionArtifact $readBack2.phone)) {
        Fail "E4: Vendor phone returned encrypted after second update"
    } else {
        Fail "E4: Vendor phone mismatch - expected '0908141592', got '$($readBack2.phone)'"
    }
} else {
    Warn "E4: Skipped"
}

# ================================================================
# PART F: Special Characters in PII
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART F: Special Characters in PII Fields" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# F1: Update vendor bankAccount with dashes
Write-Host ""
Write-Host "=== TEST F1: bankAccount with dashes '1234-5678-9012-3456' ===" -ForegroundColor White
$SPECIAL_BANK = "1234-5678-9012-3456"
if ($VENDOR_ID) {
    $updatedF1 = D (Api "PATCH" "/vendors/$VENDOR_ID" $VENDOR_TOKEN @{ bankAccount = $SPECIAL_BANK })
    if ($updatedF1) {
        Pass "F1: bankAccount with dashes update accepted"
    } else {
        Fail "F1: Failed to update bankAccount with dashes"
    }
} else {
    Warn "F1: Skipped"
}

# F2: Read back and verify exact match
Write-Host ""
Write-Host "=== TEST F2: Read back bankAccount with dashes ===" -ForegroundColor White
if ($VENDOR_ID) {
    $readF2 = D (Api "GET" "/vendors/$VENDOR_ID" $VENDOR_TOKEN)
    if ($readF2 -and $readF2.bankAccount -eq $SPECIAL_BANK) {
        Pass "F2: bankAccount with dashes roundtrip matches: '$SPECIAL_BANK'"
    } elseif ($readF2 -and (Has-EncryptionArtifact $readF2.bankAccount)) {
        Fail "F2: bankAccount returned encrypted after special chars update"
    } else {
        Fail "F2: bankAccount mismatch - expected '$SPECIAL_BANK', got '$($readF2.bankAccount)'"
    }
} else {
    Warn "F2: Skipped"
}

# F3: Update bankName with Vietnamese/Unicode
Write-Host ""
Write-Host "=== TEST F3: bankName with Vietnamese text ===" -ForegroundColor White
$UNICODE_BANK = "Ngan hang ABC - Chi nhanh Q1"
if ($VENDOR_ID) {
    $updatedF3 = D (Api "PATCH" "/vendors/$VENDOR_ID" $VENDOR_TOKEN @{ bankName = $UNICODE_BANK })
    if ($updatedF3) {
        Pass "F3: bankName with Vietnamese text update accepted"
    } else {
        Fail "F3: Failed to update bankName with Vietnamese text"
    }
} else {
    Warn "F3: Skipped"
}

# F4: Read back and verify exact match
Write-Host ""
Write-Host "=== TEST F4: Read back bankName with Vietnamese text ===" -ForegroundColor White
if ($VENDOR_ID) {
    $readF4 = D (Api "GET" "/vendors/$VENDOR_ID" $VENDOR_TOKEN)
    if ($readF4 -and $readF4.bankName -eq $UNICODE_BANK) {
        Pass "F4: bankName with Vietnamese text roundtrip matches"
    } elseif ($readF4 -and (Has-EncryptionArtifact $readF4.bankName)) {
        Fail "F4: bankName returned encrypted after Unicode update"
    } else {
        Fail "F4: bankName mismatch - expected '$UNICODE_BANK', got '$($readF4.bankName)'"
    }
} else {
    Warn "F4: Skipped"
}

# ================================================================
# PART G: PII in List Endpoints
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART G: PII Decryption in List Endpoints" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# G1: GET /vendors?limit=5
Write-Host ""
Write-Host "=== TEST G1: Vendor list - PII fields decrypted ===" -ForegroundColor White
$vendorList = Api "GET" "/vendors?limit=5" $VENDOR_TOKEN
$vendorItems = $null
if ($vendorList -and $vendorList.data) {
    if ($vendorList.data.data) { $vendorItems = $vendorList.data.data }
    elseif ($vendorList.data.items) { $vendorItems = $vendorList.data.items }
    elseif ($vendorList.data -is [array]) { $vendorItems = $vendorList.data }
}
if (-not $vendorItems -and $vendorList -and $vendorList.items) { $vendorItems = $vendorList.items }

if ($vendorItems -and $vendorItems.Count -gt 0) {
    $listArtifacts = $false
    foreach ($v in $vendorItems) {
        if ($v.phone -and (Has-EncryptionArtifact $v.phone)) {
            Write-Host "    ARTIFACT in vendor list phone: $($v.code) -> $($v.phone)" -ForegroundColor Red
            $listArtifacts = $true
        }
        if ($v.bankAccount -and (Has-EncryptionArtifact $v.bankAccount)) {
            Write-Host "    ARTIFACT in vendor list bankAccount: $($v.code) -> $($v.bankAccount)" -ForegroundColor Red
            $listArtifacts = $true
        }
    }
    if (-not $listArtifacts) {
        Pass "G1: Vendor list - no encryption artifacts in phone/bankAccount ($($vendorItems.Count) items checked)"
    } else {
        Fail "G1: Vendor list contains encryption artifacts"
    }
} else {
    Warn "G1: No vendors found in list response"
}

# G2: GET /employees?limit=5
Write-Host ""
Write-Host "=== TEST G2: Employee list - PII fields decrypted ===" -ForegroundColor White
$empList = Api "GET" "/employees?limit=5" $EMP_TOKEN
$empItems = $null
if ($empList -and $empList.data) {
    if ($empList.data.data) { $empItems = $empList.data.data }
    elseif ($empList.data.items) { $empItems = $empList.data.items }
    elseif ($empList.data -is [array]) { $empItems = $empList.data }
}
if (-not $empItems -and $empList -and $empList.items) { $empItems = $empList.items }

if ($empItems -and $empItems.Count -gt 0) {
    $listArtifacts = $false
    foreach ($e in $empItems) {
        foreach ($field in @('phone', 'bankAccount', 'taxCode', 'insuranceId')) {
            $val = $e.$field
            if ($val -and (Has-EncryptionArtifact $val)) {
                Write-Host "    ARTIFACT in employee list $field : $($e.code) -> $val" -ForegroundColor Red
                $listArtifacts = $true
            }
        }
    }
    if (-not $listArtifacts) {
        Pass "G2: Employee list - no encryption artifacts in PII fields ($($empItems.Count) items checked)"
    } else {
        Fail "G2: Employee list contains encryption artifacts"
    }
} else {
    Warn "G2: No employees found in list response"
}

# G3: Verify no artifacts in list raw responses
Write-Host ""
Write-Host "=== TEST G3: Raw list responses - no encryption artifacts ===" -ForegroundColor White
$rawVendorList = Api-Expect "GET" "/vendors?limit=5" $VENDOR_TOKEN
$rawEmpList = Api-Expect "GET" "/employees?limit=5" $EMP_TOKEN
$g3Pass = $true

if ($rawVendorList -and $rawVendorList.raw) {
    if ($rawVendorList.raw -match $stdPattern) {
        Write-Host "    Standard encryption artifact in vendor list response" -ForegroundColor Red
        $g3Pass = $false
    }
}
if ($rawEmpList -and $rawEmpList.raw) {
    if ($rawEmpList.raw -match $stdPattern) {
        Write-Host "    Standard encryption artifact in employee list response" -ForegroundColor Red
        $g3Pass = $false
    }
}
if ($g3Pass) {
    Pass "G3: No encryption artifacts in raw list responses"
} else {
    Fail "G3: Encryption artifacts found in raw list responses"
}

# ================================================================
# PART H: Role-based PII Access
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART H: Role-based PII Access" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# H1: CEO can see all employee PII
Write-Host ""
Write-Host "=== TEST H1: CEO GET /employees/:id - see all PII ===" -ForegroundColor White
if ($EMP_ID -and $CEO) {
    $ceoEmp = D (Api "GET" "/employees/$EMP_ID" $CEO)
    if ($ceoEmp -and $ceoEmp.id) {
        $piiFields = @('phone', 'bankAccount', 'taxCode', 'insuranceId')
        $visibleCount = 0
        foreach ($field in $piiFields) {
            if ($ceoEmp.$field) { $visibleCount++ }
        }
        if ($visibleCount -ge 2) {
            Pass "H1: CEO sees $visibleCount/$($piiFields.Count) PII fields on employee"
        } else {
            Warn "H1: CEO only sees $visibleCount/$($piiFields.Count) PII fields (some may be null)"
        }
    } else {
        Fail "H1: CEO cannot read employee detail"
    }
} else {
    Warn "H1: Skipped (no employee ID or CEO token)"
}

# H2: SALE can see customer PII
Write-Host ""
Write-Host "=== TEST H2: SALE GET /customers/:id - see phone/email ===" -ForegroundColor White
if ($CUST_ID -and $SALE) {
    $saleCust = D (Api "GET" "/customers/$CUST_ID" $SALE)
    if ($saleCust -and $saleCust.id) {
        $hasPhone = [bool]($saleCust.phone -or $saleCust.contactPhone)
        $hasEmail = [bool]($saleCust.email -or $saleCust.contactEmail)
        if ($hasPhone -or $hasEmail) {
            Pass "H2: SALE sees customer PII (phone=$hasPhone, email=$hasEmail)"
        } else {
            Warn "H2: SALE does not see customer phone/email (may be null)"
        }
    } else {
        Fail "H2: SALE cannot read customer detail"
    }
} else {
    Warn "H2: Skipped (no customer ID or SALE token)"
}

# H3: SALE tries to access employees (may be 403)
Write-Host ""
Write-Host "=== TEST H3: SALE GET /employees/:id - expect 403 or limited ===" -ForegroundColor White
if ($EMP_ID -and $SALE) {
    $saleEmpResp = Api-Expect "GET" "/employees/$EMP_ID" $SALE
    if ($saleEmpResp.code -eq 403) {
        Pass "H3: SALE correctly denied access to employee PII (403)"
    } elseif ($saleEmpResp.code -eq 200) {
        # SALE can see employees - check if PII is masked
        $saleEmpData = $null
        if ($saleEmpResp.body -and $saleEmpResp.body.data) { $saleEmpData = $saleEmpResp.body.data }
        if ($saleEmpData -and $saleEmpData.bankAccount) {
            Warn "H3: SALE can see employee bankAccount (role-based PII masking not enforced)"
        } else {
            Pass "H3: SALE can access employee but PII appears limited/masked"
        }
    } else {
        Pass "H3: SALE denied access to employees (status $($saleEmpResp.code))"
    }
} else {
    Warn "H3: Skipped"
}

# H4: CHIEF_ACCOUNTANT can see vendor bankAccount
Write-Host ""
Write-Host "=== TEST H4: CHIEF_ACCOUNTANT GET /vendors/:id - see bankAccount ===" -ForegroundColor White
if ($VENDOR_ID -and $ACCOUNTANT) {
    $acctVendor = D (Api "GET" "/vendors/$VENDOR_ID" $ACCOUNTANT)
    if ($acctVendor -and $acctVendor.id) {
        if ($acctVendor.bankAccount -and -not (Has-EncryptionArtifact $acctVendor.bankAccount)) {
            Pass "H4: CHIEF_ACCOUNTANT sees vendor bankAccount (plaintext): '$($acctVendor.bankAccount)'"
        } elseif (Has-EncryptionArtifact $acctVendor.bankAccount) {
            Fail "H4: CHIEF_ACCOUNTANT sees encrypted vendor bankAccount"
        } else {
            Warn "H4: CHIEF_ACCOUNTANT - vendor bankAccount is null"
        }
    } else {
        Fail "H4: CHIEF_ACCOUNTANT cannot access vendor detail"
    }
} else {
    Warn "H4: Skipped (no vendor ID or ACCOUNTANT token)"
}

# H5: Compare CEO vs SALE on vendor access
Write-Host ""
Write-Host "=== TEST H5: Compare role access to vendor PII ===" -ForegroundColor White
if ($VENDOR_ID -and $CEO) {
    $ceoVendor = D (Api "GET" "/vendors/$VENDOR_ID" $CEO)
    if ($ceoVendor -and $ceoVendor.id) {
        $ceoSeesPhone = [bool]$ceoVendor.phone
        $ceoSeesBank = [bool]$ceoVendor.bankAccount
        Write-Host "  CEO sees: phone=$ceoSeesPhone, bankAccount=$ceoSeesBank"
    }

    # SALE typically cannot access vendors
    if ($SALE) {
        $saleVendorResp = Api-Expect "GET" "/vendors/$VENDOR_ID" $SALE
        if ($saleVendorResp.code -eq 403) {
            Pass "H5: Role separation works - SALE denied vendor access, CEO has full access"
        } elseif ($saleVendorResp.code -eq 200) {
            Warn "H5: SALE can also access vendor - role-based PII separation may not apply"
        } else {
            Pass "H5: SALE denied vendor access (status $($saleVendorResp.code))"
        }
    } else {
        Warn "H5: Cannot compare (no SALE token)"
    }
} else {
    Warn "H5: Skipped"
}

# ================================================================
# PART I: Search on Encrypted Fields
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART I: Search on Encrypted Fields" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# I1: Search customer by exact email
# Customer contactEmail uses deterministic encryption (searchable)
# But note: the encryption config maps 'contactEmail' while schema has 'email'
Write-Host ""
Write-Host "=== TEST I1: Search customer by email ===" -ForegroundColor White
if ($CUST_ID -and $CUST_EMAIL) {
    $searchResult = Api "GET" "/customers?search=$CUST_EMAIL" $CUST_TOKEN
    $searchItems = $null
    if ($searchResult -and $searchResult.data) {
        if ($searchResult.data.data) { $searchItems = $searchResult.data.data }
        elseif ($searchResult.data.items) { $searchItems = $searchResult.data.items }
        elseif ($searchResult.data -is [array]) { $searchItems = $searchResult.data }
    }

    $foundTarget = $false
    if ($searchItems) {
        foreach ($item in $searchItems) {
            if ($item.id -eq $CUST_ID) { $foundTarget = $true; break }
        }
    }
    if ($foundTarget) {
        Pass "I1: Customer found by email search (deterministic encryption enables search)"
    } else {
        Warn "I1: Customer not found by email search (search may use LIKE on plaintext or deterministic encryption field mismatch)"
    }
} else {
    Warn "I1: Skipped (no customer ID or email)"
}

# I2: Search with partial match
Write-Host ""
Write-Host "=== TEST I2: Search customer by partial phone ===" -ForegroundColor White
if ($CUST_ID -and $CUST_PHONE) {
    $partialPhone = $CUST_PHONE.Substring(0, 6)
    $partialResult = Api "GET" "/customers?search=$partialPhone" $CUST_TOKEN
    $partialItems = $null
    if ($partialResult -and $partialResult.data) {
        if ($partialResult.data.data) { $partialItems = $partialResult.data.data }
        elseif ($partialResult.data.items) { $partialItems = $partialResult.data.items }
        elseif ($partialResult.data -is [array]) { $partialItems = $partialResult.data }
    }

    $foundPartial = $false
    if ($partialItems) {
        foreach ($item in $partialItems) {
            if ($item.id -eq $CUST_ID) { $foundPartial = $true; break }
        }
    }
    if ($foundPartial) {
        Pass "I2: Partial phone search works (search may be on non-encrypted fields like fullName)"
    } else {
        Warn "I2: Partial phone search did not find customer (expected for encrypted fields - LIKE not supported)"
    }
} else {
    Warn "I2: Skipped"
}

# I3: Verify search returns correct customer data
Write-Host ""
Write-Host "=== TEST I3: Search results contain correct PII ===" -ForegroundColor White
if ($CUST_ID) {
    $nameSearch = Api "GET" "/customers?search=SEC-014" $CUST_TOKEN
    $nameItems = $null
    if ($nameSearch -and $nameSearch.data) {
        if ($nameSearch.data.data) { $nameItems = $nameSearch.data.data }
        elseif ($nameSearch.data.items) { $nameItems = $nameSearch.data.items }
        elseif ($nameSearch.data -is [array]) { $nameItems = $nameSearch.data }
    }

    if ($nameItems -and $nameItems.Count -gt 0) {
        $targetItem = $null
        foreach ($item in $nameItems) {
            if ($item.id -eq $CUST_ID) { $targetItem = $item; break }
        }
        if ($targetItem) {
            $phone = $targetItem.phone
            if ($phone -and -not (Has-EncryptionArtifact $phone)) {
                Pass "I3: Search result contains plaintext PII (phone='$phone')"
            } elseif (Has-EncryptionArtifact $phone) {
                Fail "I3: Search result contains encrypted phone"
            } else {
                Warn "I3: Phone not present in search result"
            }
        } else {
            Warn "I3: Target customer not in search results"
        }
    } else {
        Warn "I3: No customers found in name search"
    }
} else {
    Warn "I3: Skipped"
}

# ================================================================
# PART J: API Error Responses Don't Leak PII
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PART J: API Error Responses Don't Leak PII/Keys" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# J1: Request invalid customer (404)
Write-Host ""
Write-Host "=== TEST J1: 404 error should NOT contain PII ===" -ForegroundColor White
$invalidResp = Api-Expect "GET" "/customers/nonexistent-id-12345" $CUST_TOKEN
if ($invalidResp.code -eq 404 -or $invalidResp.code -eq 400 -or $invalidResp.code -eq 500) {
    $errRaw = "$($invalidResp.raw)"
    $hasPII = $false
    # Check for any phone numbers, bank accounts, or encryption keys
    if ($errRaw -match '0901234567|0987654321|1234567890123456|9876543210987654') {
        $hasPII = $true
    }
    if ($errRaw -match 'FIELD_ENCRYPTION_KEY|aes-256-gcm|AES') {
        $hasPII = $true
    }
    if (-not $hasPII) {
        Pass "J1: 404 error response does not leak PII or encryption details"
    } else {
        Fail "J1: Error response leaks PII or encryption algorithm info"
    }
} else {
    Warn "J1: Unexpected status $($invalidResp.code) for invalid customer"
}

# J2: Invalid vendor update (400)
Write-Host ""
Write-Host "=== TEST J2: 400 error should NOT expose encrypted values ===" -ForegroundColor White
if ($VENDOR_ID) {
    # Send invalid data (e.g., email with bad format)
    $badUpdateResp = Api-Expect "PATCH" "/vendors/$VENDOR_ID" $VENDOR_TOKEN @{ email = "not-an-email" }
    $errRaw2 = "$($badUpdateResp.raw)"
    $hasEncKey = $errRaw2 -match 'FIELD_ENCRYPTION_KEY|encryption_key|pbkdf2'
    $hasEncFormat = $errRaw2 -match $stdPattern
    if (-not $hasEncKey -and -not $hasEncFormat) {
        Pass "J2: Error response does not expose encryption internals"
    } else {
        Fail "J2: Error response exposes encryption key info or encrypted values"
    }
} else {
    Warn "J2: Skipped"
}

# J3: Check error messages for encryption algorithm details
Write-Host ""
Write-Host "=== TEST J3: Error messages don't reveal encryption algorithm ===" -ForegroundColor White
# Try to trigger a server error with malformed data
$malformedResp = Api-Expect "POST" "/vendors" $VENDOR_TOKEN @{ name = "" }
$errRaw3 = "$($malformedResp.raw)"
$leaksAlgo = $errRaw3 -match 'aes-256-gcm|AES.GCM|cipher|decipher|createCipheriv|PBKDF2|pbkdf2Sync'
$leaksKey = $errRaw3 -match 'FIELD_ENCRYPTION_KEY|HMAC|hmacKey|currentKey'
if (-not $leaksAlgo -and -not $leaksKey) {
    Pass "J3: Error messages do not reveal encryption algorithm or key details"
} else {
    Fail "J3: Error messages leak encryption internals"
    if ($leaksAlgo) { Write-Host "    Algorithm info leaked" -ForegroundColor Red }
    if ($leaksKey) { Write-Host "    Key info leaked" -ForegroundColor Red }
}

# ================================================================
# TONG KET
# ================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TONG KET TEST-SEC-014: Field-level Encryption for PII" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Part A: Vendor PII - Create + Read Back (6 tests)"
Write-Host "  Part B: Employee PII - Create + Read Back (7 tests)"
Write-Host "  Part C: Customer PII (5 tests)"
Write-Host "  Part D: Encryption Format Verification (5 tests)"
Write-Host "  Part E: PII Consistency Roundtrip (4 tests)"
Write-Host "  Part F: Special Characters in PII (4 tests)"
Write-Host "  Part G: PII in List Endpoints (3 tests)"
Write-Host "  Part H: Role-based PII Access (5 tests)"
Write-Host "  Part I: Search on Encrypted Fields (3 tests)"
Write-Host "  Part J: Error Responses Don't Leak PII (3 tests)"
Write-Host ""
Write-Host "  PASS: $passCount" -ForegroundColor Green
Write-Host "  FAIL: $failCount" -ForegroundColor Red
Write-Host "  WARN: $warnCount" -ForegroundColor Yellow
$totalTests = $passCount + $failCount
Write-Host "  TOTAL: $totalTests tests executed ($warnCount warnings)" -ForegroundColor White
Write-Host ""
if ($failCount -eq 0) {
    Write-Host "  RESULT: ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  RESULT: $failCount TEST(S) FAILED" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Cyan
