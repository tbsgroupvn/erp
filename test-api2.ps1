$ErrorActionPreference = 'Continue'
$baseUrl = 'http://localhost:3001/api/v1'

# Login as CEO
$loginBody = '{"email":"ceo@nhaphangchinhngach.vn","password":"Admin@123"}'
$loginResp = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -ContentType 'application/json' -Body $loginBody -UseBasicParsing
$loginData = $loginResp.Content | ConvertFrom-Json
$token = $loginData.data.tokens.accessToken
$headers = @{ Authorization = "Bearer $token" }
Write-Host "CEO token obtained"

function Test-Endpoint($name, $url) {
    try {
        $resp = Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing
        $data = $resp.Content | ConvertFrom-Json
        Write-Host "[PASS] $name - success=$($data.success)"
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        Write-Host "[FAIL] $name - HTTP $code"
    }
}

Write-Host ""
Write-Host "--- Core Modules ---"
Test-Endpoint "Dashboard Overview" "$baseUrl/dashboard/overview"
Test-Endpoint "Dashboard Finance" "$baseUrl/dashboard/finance"
Test-Endpoint "Orders" "$baseUrl/orders?page=1&limit=3"
Test-Endpoint "Customers" "$baseUrl/customers?page=1&limit=3"
Test-Endpoint "Containers" "$baseUrl/containers?page=1&limit=3"
Test-Endpoint "Warehouse CN" "$baseUrl/warehouse-cn/packages?page=1&limit=3"
Test-Endpoint "Warehouse VN" "$baseUrl/warehouse-vn/packages?page=1&limit=3"

Write-Host ""
Write-Host "--- Finance ---"
Test-Endpoint "Cash Vouchers" "$baseUrl/cash/vouchers?page=1&limit=3"
Test-Endpoint "AR" "$baseUrl/ar?page=1&limit=3"
Test-Endpoint "AP" "$baseUrl/ap?page=1&limit=3"
Test-Endpoint "Invoices" "$baseUrl/invoices?page=1&limit=3"

Write-Host ""
Write-Host "--- Integration ---"
Test-Endpoint "Reconciliation Runs" "$baseUrl/reconciliation/runs?page=1&limit=5"
Test-Endpoint "Webhooks" "$baseUrl/integrations/webhooks?page=1&limit=5"

Write-Host ""
Write-Host "--- HR ---"
Test-Endpoint "Employees" "$baseUrl/employees?page=1&limit=3"
Test-Endpoint "Vendors" "$baseUrl/vendors?page=1&limit=3"

Write-Host ""
Write-Host "--- RBAC Tests ---"
# Login as SALE
$saleBody = '{"email":"sale01@nhaphangchinhngach.vn","password":"Admin@123"}'
$saleResp = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -ContentType 'application/json' -Body $saleBody -UseBasicParsing
$saleData = $saleResp.Content | ConvertFrom-Json
$saleToken = $saleData.data.tokens.accessToken
$saleHeaders = @{ Authorization = "Bearer $saleToken" }

function Test-RBAC($name, $url, $expectedCode) {
    try {
        $resp = Invoke-WebRequest -Uri $url -Headers $saleHeaders -UseBasicParsing
        if ($expectedCode -eq 200) {
            Write-Host "[PASS] SALE -> $name = 200 (allowed)"
        } else {
            Write-Host "[FAIL] SALE -> $name = 200 (should be $expectedCode)"
        }
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        if ($code -eq $expectedCode) {
            Write-Host "[PASS] SALE -> $name = $code (blocked correctly)"
        } else {
            Write-Host "[WARN] SALE -> $name = $code (expected $expectedCode)"
        }
    }
}

Test-RBAC "Orders (own)" "$baseUrl/orders?page=1&limit=3" 200
Test-RBAC "Employees (HR)" "$baseUrl/employees?page=1&limit=3" 403
Test-RBAC "Cash Vouchers (Finance)" "$baseUrl/cash/vouchers?page=1&limit=3" 403
Test-RBAC "Payroll (HR)" "$baseUrl/payroll?page=1&limit=3" 403
Test-RBAC "Reconciliation (Finance)" "$baseUrl/reconciliation/runs?page=1&limit=5" 403

Write-Host ""
Write-Host "=== ALL TESTS DONE ==="
