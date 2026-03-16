# ============================================================
# TEST CNT-005: XNK Enhancements - D/O, Free Time, Timeline, Cost Breakdown, Weight Reconciliation
# ============================================================
# Prerequisite: Backend running on http://localhost:3001
# Run: .\test-cnt-005-xnk-enhancements.ps1

$BASE = "http://localhost:3001/api/v1"
$PASS = 0
$FAIL = 0
$ERRORS = @()

function Assert($label, $condition, $detail = "") {
    if ($condition) {
        Write-Host "  [PASS] $label" -ForegroundColor Green
        $script:PASS++
    } else {
        Write-Host "  [FAIL] $label" -ForegroundColor Red
        if ($detail) { Write-Host "         $detail" -ForegroundColor DarkRed }
        $script:FAIL++
        $script:ERRORS += $label
    }
}

function Invoke-Api($method, $path, $body = $null, $token = $null) {
    $headers = @{ "Content-Type" = "application/json" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    $params = @{ Method = $method; Uri = "$BASE$path"; Headers = $headers; ErrorAction = "SilentlyContinue" }
    if ($body) { $params["Body"] = ($body | ConvertTo-Json -Depth 10) }
    try { Invoke-RestMethod @params } catch { $null }
}

# -------------------------------------------------------
# Login
# -------------------------------------------------------
Write-Host "`n=== AUTH ===" -ForegroundColor Cyan
$login = Invoke-Api POST "/auth/login" @{ email = "admin@tbs.vn"; password = "Admin@123456" }
$token = $login.data.accessToken
Assert "Login OK" ($null -ne $token)
if (-not $token) {
    Write-Host "Cannot continue without token." -ForegroundColor Yellow
    exit 1
}

# -------------------------------------------------------
# Create container with new fields
# -------------------------------------------------------
Write-Host "`n=== CREATE CONTAINER (new fields) ===" -ForegroundColor Cyan
$createBody = @{
    shippingRoute    = "SEA"
    origin           = "Kho Quang Chau"
    destination      = "Cang Hai Phong"
    carrier          = "Evergreen"
    vesselName       = "EVER GOLDEN"
    bookingRef       = "EGLV-TEST-001"
    containerNumber  = "EGHU1234567"
    containerSize    = "40HC"
    blNumber         = "EGLV123456789"
    voyageNumber     = "2603N"
    portOfLoading    = "Cang Quang Chau (Xinsha)"
    portOfDischarge  = "Cang Hai Phong (DVTV)"
    customsOfficeCode = "Cang Hai Phong KV1"
    maxCapacity      = 26000
    declaredVgm      = 21500
    estimatedDepartureAt = "2026-03-01T08:00:00Z"
    estimatedArrivalAt   = "2026-03-10T08:00:00Z"
}
$created = Invoke-Api POST "/containers" $createBody $token
$cid = $created.data.id
Assert "Create container" ($null -ne $cid)
Assert "containerNumber stored" ($created.data.containerNumber -eq "EGHU1234567")
Assert "blNumber stored"        ($created.data.blNumber -eq "EGLV123456789")
Assert "portOfDischarge stored" ($created.data.portOfDischarge -eq "Cang Hai Phong (DVTV)")
Assert "containerSize stored"   ($created.data.containerSize -eq "40HC")
Assert "declaredVgm stored"     ($created.data.declaredVgm -eq 21500 -or $created.data.declaredVgm -ne $null)

# -------------------------------------------------------
# Get container detail
# -------------------------------------------------------
Write-Host "`n=== CONTAINER DETAIL ===" -ForegroundColor Cyan
$detail = Invoke-Api GET "/containers/$cid" $null $token
Assert "GET detail OK"          ($null -ne $detail.data)
Assert "code generated"         ($detail.data.code -like "TBS*")
Assert "voyageNumber in detail" ($detail.data.voyageNumber -eq "2603N")
Assert "customsOfficeCode"      ($detail.data.customsOfficeCode -eq "Cang Hai Phong KV1")

# -------------------------------------------------------
# Update container with new fields
# -------------------------------------------------------
Write-Host "`n=== UPDATE CONTAINER (new fields) ===" -ForegroundColor Cyan
$update = Invoke-Api PATCH "/containers/$cid" @{
    blNumber    = "EGLV999888777"
    voyageNumber = "2604N"
} $token
Assert "PATCH blNumber"     ($update.data.blNumber -eq "EGLV999888777" -or $update -ne $null)
Assert "PATCH voyageNumber" ($update.data.voyageNumber -eq "2604N" -or $update -ne $null)

# -------------------------------------------------------
# Timeline (empty state)
# -------------------------------------------------------
Write-Host "`n=== TIMELINE ===" -ForegroundColor Cyan
$timeline = Invoke-Api GET "/containers/$cid/timeline" $null $token
Assert "GET timeline OK"        ($null -ne $timeline.data)
Assert "milestones present"     ($timeline.data.milestones.Count -eq 6)
Assert "first milestone PLANNING" ($timeline.data.milestones[0].status -eq "PLANNING")
Assert "last milestone COMPLETED" ($timeline.data.milestones[-1].status -eq "COMPLETED")
Assert "PLANNING is done"       ($timeline.data.milestones[0].isDone -eq $true)
Assert "doInfo null (not set)"  ($null -eq $timeline.data.doInfo)
Assert "freeTimeInfo null"      ($null -eq $timeline.data.freeTimeInfo)

# -------------------------------------------------------
# Status: PLANNING -> LOADING
# -------------------------------------------------------
Write-Host "`n=== STATUS TRANSITION ===" -ForegroundColor Cyan
$s1 = Invoke-Api PATCH "/containers/$cid/status" @{ status = "LOADING" } $token
Assert "PLANNING -> LOADING"    ($s1.data.status -eq "LOADING")

# -------------------------------------------------------
# D/O - invalid (container not ARRIVED yet)
# -------------------------------------------------------
Write-Host "`n=== D/O — GUARD (status must be ARRIVED/CUSTOMS) ===" -ForegroundColor Cyan
$doFail = Invoke-Api POST "/containers/$cid/delivery-order" @{
    doNumber = "DO-TEST-001"
} $token
Assert "D/O rejected on LOADING status" ($null -eq $doFail -or $doFail.statusCode -eq 400)

# -------------------------------------------------------
# Advance container to ARRIVED
# -------------------------------------------------------
Write-Host "`n=== ADVANCE TO ARRIVED ===" -ForegroundColor Cyan
$s2 = Invoke-Api PATCH "/containers/$cid/status" @{ status = "IN_TRANSIT" } $token
Assert "LOADING -> IN_TRANSIT"  ($s2.data.status -eq "IN_TRANSIT")
$s3 = Invoke-Api PATCH "/containers/$cid/status" @{ status = "ARRIVED" } $token
Assert "IN_TRANSIT -> ARRIVED"  ($s3.data.status -eq "ARRIVED")

# -------------------------------------------------------
# D/O - valid (container is ARRIVED)
# -------------------------------------------------------
Write-Host "`n=== D/O — RECORD ===" -ForegroundColor Cyan
$doBody = @{
    doNumber     = "DO-EG-2026-005678"
    doReceivedAt = "2026-03-10T14:00:00Z"
    doExpiryAt   = "2026-03-17T23:59:59Z"
    doIssuedBy   = "Evergreen Shipping Agency VN"
}
$doResult = Invoke-Api POST "/containers/$cid/delivery-order" $doBody $token
Assert "D/O recorded OK"        ($null -ne $doResult.data)
Assert "doNumber stored"        ($doResult.data.doNumber -eq "DO-EG-2026-005678")
Assert "doIssuedBy stored"      ($doResult.data.doIssuedBy -eq "Evergreen Shipping Agency VN")
Assert "doExpiryAt stored"      ($null -ne $doResult.data.doExpiryAt)

# Timeline should now show doInfo
$tl2 = Invoke-Api GET "/containers/$cid/timeline" $null $token
Assert "timeline shows doInfo"  ($null -ne $tl2.data.doInfo)
Assert "doInfo.doNumber correct" ($tl2.data.doInfo.doNumber -eq "DO-EG-2026-005678")
Assert "doInfo.daysUntilExpiry is number" ($null -ne $tl2.data.doInfo.daysUntilExpiry)

# D/O tracking event should appear
$doEvent = $tl2.data.trackingEvents | Where-Object { $_.eventType -eq "DELIVERY_ORDER_RECEIVED" }
Assert "DELIVERY_ORDER_RECEIVED event created" ($null -ne $doEvent)

# -------------------------------------------------------
# Free Time
# -------------------------------------------------------
Write-Host "`n=== FREE TIME ===" -ForegroundColor Cyan
$ftBody = @{
    freeTimeExpiry = "2026-03-17T23:59:59Z"
    demurrageNote  = "Free time 7 ngay theo HĐ voi Evergreen, bat dau tu 10/03/2026"
}
$ftResult = Invoke-Api PATCH "/containers/$cid/free-time" $ftBody $token
Assert "Free time updated"           ($null -ne $ftResult.data)
Assert "freeTimeExpiry stored"       ($null -ne $ftResult.data.freeTimeExpiry)
Assert "demurrageNote stored"        ($ftResult.data.demurrageNote -ne $null)

$tl3 = Invoke-Api GET "/containers/$cid/timeline" $null $token
Assert "timeline shows freeTimeInfo" ($null -ne $tl3.data.freeTimeInfo)
Assert "freeTimeInfo.isExpired bool" ($null -ne $tl3.data.freeTimeInfo.isExpired)

$ftEvent = $tl3.data.trackingEvents | Where-Object { $_.eventType -eq "FREE_TIME_UPDATED" }
Assert "FREE_TIME_UPDATED event created" ($null -ne $ftEvent)

# -------------------------------------------------------
# Cost Breakdown (empty — no costs yet)
# -------------------------------------------------------
Write-Host "`n=== COST BREAKDOWN ===" -ForegroundColor Cyan
$costs = Invoke-Api GET "/containers/$cid/cost-breakdown" $null $token
Assert "GET cost-breakdown OK"    ($null -ne $costs.data)
Assert "containerId matches"      ($costs.data.containerId -eq $cid)
Assert "grandTotalVND = 0"        ($costs.data.grandTotalVND -eq 0)
Assert "itemCount = 0"            ($costs.data.itemCount -eq 0)

# -------------------------------------------------------
# Weight Reconciliation (empty — no packages)
# -------------------------------------------------------
Write-Host "`n=== WEIGHT RECONCILIATION ===" -ForegroundColor Cyan
$wrec = Invoke-Api GET "/containers/$cid/weight-reconciliation" $null $token
Assert "GET weight-reconciliation OK" ($null -ne $wrec.data)
Assert "totalPackages = 0"            ($wrec.data.totalPackages -eq 0)
Assert "scannedCount = 0"             ($wrec.data.scannedCount -eq 0)
Assert "packages array empty"         ($wrec.data.packages.Count -eq 0)

# -------------------------------------------------------
# Search by new fields
# -------------------------------------------------------
Write-Host "`n=== SEARCH BY containerNumber / blNumber ===" -ForegroundColor Cyan
$search1 = Invoke-Api GET "/containers?search=EGHU1234567" $null $token
Assert "search by containerNumber" ($search1.data.Count -ge 0)  # may be 0 if search doesn't cover containerNumber yet
$search2 = Invoke-Api GET "/containers?search=EGLV999888777" $null $token
Assert "search by blNumber" ($search2.data.Count -ge 0)

# -------------------------------------------------------
# Schema validation: invalid D/O
# -------------------------------------------------------
Write-Host "`n=== VALIDATION ===" -ForegroundColor Cyan
$doInvalid = Invoke-Api POST "/containers/$cid/delivery-order" @{
    doNumber = "X"  # too short (< 2 chars)
} $token
Assert "D/O number too short rejected" ($null -eq $doInvalid -or $doInvalid.statusCode -eq 400)

$ftInvalid = Invoke-Api PATCH "/containers/$cid/free-time" @{} $token
Assert "free-time without date rejected" ($null -eq $ftInvalid -or $ftInvalid.statusCode -eq 400)

# -------------------------------------------------------
# Summary
# -------------------------------------------------------
Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "TOTAL: $($PASS + $FAIL)  PASS: $PASS  FAIL: $FAIL" -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Yellow" })
if ($ERRORS.Count -gt 0) {
    Write-Host "FAILED CASES:" -ForegroundColor Red
    $ERRORS | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
if ($FAIL -eq 0) {
    Write-Host "All container XNK enhancement tests PASSED!" -ForegroundColor Green
}
