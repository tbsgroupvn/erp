$ErrorActionPreference = 'Continue'
$baseUrl = 'http://localhost:3001/api/v1'

# Login as CEO
Write-Host "=== LOGIN ==="
$loginBody = '{"email":"ceo@nhaphangchinhngach.vn","password":"Admin@123"}'
$loginResp = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -ContentType 'application/json' -Body $loginBody -UseBasicParsing
$loginData = $loginResp.Content | ConvertFrom-Json
$token = $loginData.data.tokens.accessToken
Write-Host "Login OK - Role: $($loginData.data.user.role)"

$headers = @{ Authorization = "Bearer $token" }

# Test Orders
Write-Host "`n=== ORDERS ==="
$resp = Invoke-WebRequest -Uri "$baseUrl/orders?page=1&limit=3" -Headers $headers -UseBasicParsing
$data = $resp.Content | ConvertFrom-Json
Write-Host "Orders: total=$($data.data.total), count=$($data.data.data.Count)"

# Test Customers
Write-Host "`n=== CUSTOMERS ==="
$resp = Invoke-WebRequest -Uri "$baseUrl/customers?page=1&limit=3" -Headers $headers -UseBasicParsing
$data = $resp.Content | ConvertFrom-Json
Write-Host "Customers: total=$($data.data.total), count=$($data.data.data.Count)"

# Test Dashboard
Write-Host "`n=== DASHBOARD ==="
$resp = Invoke-WebRequest -Uri "$baseUrl/dashboard" -Headers $headers -UseBasicParsing
$data = $resp.Content | ConvertFrom-Json
Write-Host "Dashboard: success=$($data.success)"

# Test Reconciliation endpoint (should work for CEO)
Write-Host "`n=== RECONCILIATION RUNS ==="
try {
    $resp = Invoke-WebRequest -Uri "$baseUrl/reconciliation/runs?page=1&limit=5" -Headers $headers -UseBasicParsing
    $data = $resp.Content | ConvertFrom-Json
    Write-Host "Reconciliation runs: success=$($data.success)"
} catch {
    Write-Host "Reconciliation: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)"
}

# Test Approval flows
Write-Host "`n=== APPROVAL FLOWS ==="
try {
    $resp = Invoke-WebRequest -Uri "$baseUrl/approval/flows?page=1&limit=5" -Headers $headers -UseBasicParsing
    $data = $resp.Content | ConvertFrom-Json
    Write-Host "Flows: success=$($data.success)"
} catch {
    Write-Host "Flows: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)"
}

# Test unauthorized access (login as SALE, try /employees)
Write-Host "`n=== RBAC TEST ==="
$saleBody = '{"email":"sale01@nhaphangchinhngach.vn","password":"Admin@123"}'
$saleResp = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -ContentType 'application/json' -Body $saleBody -UseBasicParsing
$saleData = $saleResp.Content | ConvertFrom-Json
$saleToken = $saleData.data.tokens.accessToken
$saleHeaders = @{ Authorization = "Bearer $saleToken" }
Write-Host "Sale login OK - Role: $($saleData.data.user.role)"

try {
    $resp = Invoke-WebRequest -Uri "$baseUrl/employees?page=1&limit=3" -Headers $saleHeaders -UseBasicParsing
    Write-Host "RBAC FAIL - SALE can access /employees (should be blocked)"
} catch {
    $statusCode = [int]$_.Exception.Response.StatusCode
    if ($statusCode -eq 403) {
        Write-Host "RBAC OK - SALE blocked from /employees (403 Forbidden)"
    } else {
        Write-Host "RBAC: status=$statusCode"
    }
}

# Test health
Write-Host "`n=== HEALTH ==="
$resp = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing
$data = $resp.Content | ConvertFrom-Json
Write-Host "Health: $($data.data.status)"

Write-Host "`n=== ALL TESTS DONE ==="
