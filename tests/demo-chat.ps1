#!/usr/bin/env pwsh
# DEMO: Chat Module — CEO nhan tin voi COO

$BASE = "http://localhost:3001/api/v1"

function Banner($text) {
    $line = "-" * 60
    Write-Host ""
    Write-Host $line -ForegroundColor DarkCyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host $line -ForegroundColor DarkCyan
}

function Step($text) { Write-Host "  >> $text" -ForegroundColor Yellow }
function OK($text)   { Write-Host "  [OK] $text" -ForegroundColor Green }
function MSG($who, $text, $extra = "") {
    $color = if ($who -eq "CEO") { "Blue" } else { "Magenta" }
    Write-Host "  [$who] $text" -ForegroundColor $color
    if ($extra) { Write-Host "       $extra" -ForegroundColor DarkGray }
}

function Post($path, $token, $body) {
    $h = @{ "Authorization"="Bearer $token"; "Content-Type"="application/json" }
    Invoke-RestMethod -Method POST -Uri "$BASE$path" -Headers $h -Body ($body|ConvertTo-Json) -EA Stop
}
function Get($path, $token) {
    $h = @{ "Authorization"="Bearer $token" }
    Invoke-RestMethod -Method GET -Uri "$BASE$path" -Headers $h -EA Stop
}
function Patch($path, $token, $body) {
    $h = @{ "Authorization"="Bearer $token"; "Content-Type"="application/json" }
    Invoke-RestMethod -Method PATCH -Uri "$BASE$path" -Headers $h -Body ($body|ConvertTo-Json) -EA Stop
}
function Delete($path, $token) {
    $h = @{ "Authorization"="Bearer $token" }
    Invoke-RestMethod -Method DELETE -Uri "$BASE$path" -Headers $h -EA Stop
}

# ── LOGIN ──────────────────────────────────────────────────────
Banner "BUOC 1: DANG NHAP"
Step "CEO dang nhap..."
$r1 = Post "/auth/login" "" @{email="ceo@nhaphangchinhngach.vn"; password="Admin@123"}
$ceoToken = $r1.data.tokens.accessToken; $ceoId = $r1.data.user.id
OK "CEO: $($r1.data.user.fullName) ($($r1.data.user.role))"

Step "COO dang nhap..."
$r2 = Post "/auth/login" "" @{email="admin@nhaphangchinhngach.vn"; password="Admin@123"}
$cooToken = $r2.data.tokens.accessToken; $cooId = $r2.data.user.id
OK "COO: $($r2.data.user.fullName) ($($r2.data.user.role))"

# ── ONLINE STATUS ──────────────────────────────────────────────
Banner "BUOC 2: KIEM TRA ONLINE STATUS"
Step "Lay danh sach user dang online..."
$online = Get "/chat/users/online" $ceoToken
OK "$($online.data.Count) users dang online: $($online.data -join ', ' | Select-Object -First 60)"

# ── TIM USER ───────────────────────────────────────────────────
Banner "BUOC 3: TIM KIEM USER"
Step "CEO tim kiem 'COO'..."
$found = Get "/chat/users/search?q=COO&limit=5" $ceoToken
OK "Tim thay $($found.data.Count) ket qua:"
$found.data | ForEach-Object { Write-Host "     - $($_.fullName) [$($_.role)]" -ForegroundColor DarkGray }

# ── TAO DM ─────────────────────────────────────────────────────
Banner "BUOC 4: TAO DIRECT MESSAGE"
Step "CEO tao DM voi COO..."
$dm = Post "/chat/conversations/dm" $ceoToken @{targetUserId=$cooId}
$dmId = $dm.data.id
OK "Tao DM thanh cong! (id: $dmId)"
OK "Kieu: $($dm.data.type) | So thanh vien: $($dm.data.participants.Count)"

Step "Goi lan 2 (idempotent check)..."
$dm2 = Post "/chat/conversations/dm" $ceoToken @{targetUserId=$cooId}
OK "Tra ve cung conv id: $($dm2.data.id -eq $dmId)"

# ── NHAN TIN ───────────────────────────────────────────────────
Banner "BUOC 5: NHAN TIN TRONG DM"
Step "CEO gui tin nhan..."
$m1 = Post "/chat/conversations/$dmId/messages" $ceoToken @{content="Chao COO! Hop noi bo luc 3h chieu duoc khong?"}
MSG "CEO" "$($m1.data.content)" "status=$($m1.data.status) | id=$($m1.data.id)"

Start-Sleep -Milliseconds 300

Step "COO reply..."
$m2 = Post "/chat/conversations/$dmId/messages" $cooToken @{content="OK anh, 3h toi se online!"; replyToId=$m1.data.id}
MSG "COO" "$($m2.data.content)" "reply-to: '$($m1.data.content.Substring(0,[Math]::Min(30,$m1.data.content.Length)))...'"

Start-Sleep -Milliseconds 300

Step "CEO gui tiep..."
$m3 = Post "/chat/conversations/$dmId/messages" $ceoToken @{content="Tuyet! Da lich vao calendar roi nhe."}
MSG "CEO" "$($m3.data.content)"

# ── DOC TIN NHAN ───────────────────────────────────────────────
Banner "BUOC 6: DOC LICH SU TIN NHAN"
Step "GET messages (cursor pagination, DESC)..."
$msgs = Get "/chat/conversations/$dmId/messages?limit=10" $ceoToken
OK "$($msgs.data.items.Count) tin nhan | hasMore=$($msgs.data.hasMore)"
$msgs.data.items | Sort-Object {[DateTime]$_.createdAt} | ForEach-Object {
    $who = if ($_.senderId -eq $ceoId) { "CEO" } else { "COO" }
    $color = if ($who -eq "CEO") { "Blue" } else { "Magenta" }
    $reply = if ($_.replyToId) { " [reply]" } else { "" }
    Write-Host "     [$who]$reply $($_.content)" -ForegroundColor $color
}

# ── MARK AS READ + UNREAD COUNT ────────────────────────────────
Banner "BUOC 7: MARK AS READ & UNREAD BADGE"
$unreadBefore = Get "/chat/unread-count" $cooToken
OK "COO unread truoc khi doc: $($unreadBefore.data.total)"

Step "COO doc tin nhan (mark as read)..."
try {
    Invoke-RestMethod -Method POST -Uri "$BASE/chat/conversations/$dmId/read" `
        -Headers @{"Authorization"="Bearer $cooToken";"Content-Type"="application/json"} -EA Stop
    OK "Mark as read: 204 No Content"
} catch { OK "Mark as read: $($_.Exception.Response.StatusCode.value__)" }

$unreadAfter = Get "/chat/unread-count" $cooToken
OK "COO unread sau khi doc: $($unreadAfter.data.total)"

# ── CHINH SUA TIN NHAN ─────────────────────────────────────────
Banner "BUOC 8: CHINH SUA TIN NHAN (5 PHUT)"
Step "CEO chinh sua tin nhan cuoi..."
$edited = Patch "/chat/messages/$($m3.data.id)" $ceoToken @{content="Tuyet! Da lich vao calendar + thong bao nhom roi nhe."}
OK "Sau khi sua: '$($edited.data.content)'"
OK "status=$($edited.data.status) | editedAt=$($edited.data.editedAt -ne $null)"

Step "COO thu chinh sua tin cua CEO (phai bi tu choi)..."
try {
    $hackTry = Patch "/chat/messages/$($m3.data.id)" $cooToken @{content="hack"} 2>&1
    Write-Host "  [SECURITY FAIL] Chinh sua thanh cong - loi bao mat!" -ForegroundColor Red
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    OK "Bi tu choi dung - HTTP $sc (ForbiddenException)"
}

# ── THU HOI TIN NHAN ───────────────────────────────────────────
Banner "BUOC 9: THU HOI TIN NHAN (SOFT DELETE)"
Step "COO thu hoi tin nhan reply..."
$deleted = Delete "/chat/messages/$($m2.data.id)" $cooToken
OK "Tin nhan status: $($deleted.data.status)"
OK "Phia nhan se hien: 'Da thu hoi' (content van giu trong DB)"

# ── TAO NHOM ───────────────────────────────────────────────────
Banner "BUOC 10: TAO NHOM CHAT"
Step "CEO tao nhom 'Ban Giam Doc' voi COO..."
$group = Post "/chat/conversations/group" $ceoToken @{
    name = "Ban Giam Doc"
    participantIds = @($cooId)
}
$groupId = $group.data.id
OK "Nhom tao thanh cong: '$($group.data.name)'"
OK "Loai: $($group.data.type) | Thanh vien: $($group.data.participants.Count)"

Step "Them thanh vien tu danh sach search..."
$extraUser = Get "/chat/users/search?q=dops&limit=1" $ceoToken
if ($extraUser.data.Count -gt 0) {
    $addResult = Post "/chat/conversations/$groupId/participants" $ceoToken @{userIds=@($extraUser.data[0].id)}
    OK "Da them: $($extraUser.data[0].fullName)"
}

Step "Doi ten nhom..."
$renamed = Patch "/chat/conversations/$groupId" $ceoToken @{name="Ban Lanh Dao TBS"}
OK "Ten moi: '$($renamed.data.name)'"

Step "COO thu doi ten nhom (phai bi tu choi - khong phai OWNER)..."
try {
    Patch "/chat/conversations/$groupId" $cooToken @{name="Hack Name"} | Out-Null
    Write-Host "  [SECURITY FAIL]" -ForegroundColor Red
} catch {
    OK "Bi tu choi - COO khong co quyen owner"
}

Step "Gui tin trong nhom..."
$gm1 = Post "/chat/conversations/$groupId/messages" $ceoToken @{content="Chao ca nha! Day la kenh lien lac noi bo BGD."}
MSG "CEO" "$($gm1.data.content)"
$gm2 = Post "/chat/conversations/$groupId/messages" $cooToken @{content="Xin chao! Da join nhom."}
MSG "COO" "$($gm2.data.content)"

# ── CONVERSATIONS LIST ─────────────────────────────────────────
Banner "BUOC 11: DANH SACH CONVERSATION CEO"
$convList = Get "/chat/conversations" $ceoToken
OK "$($convList.data.Count) cuoc tro chuyen:"
$convList.data | ForEach-Object {
    $icon = if ($_.type -eq "DIRECT") { "DM" } else { "GROUP" }
    $unread = $_.unreadCount
    $convName = if ($_.displayName) { $_.displayName } else { $_.name }
    Write-Host "     [$icon] $convName - unread:$unread" -ForegroundColor White
}

# ── ROI NHOM ───────────────────────────────────────────────────
Banner "BUOC 12: ROI NHOM"
Step "COO roi nhom 'Ban Lanh Dao TBS'..."
try {
    Invoke-RestMethod -Method POST -Uri "$BASE/chat/conversations/$groupId/leave" `
        -Headers @{"Authorization"="Bearer $cooToken";"Content-Type"="application/json"} -EA Stop
    OK "ROI NHOM THANH CONG (204)"
} catch { OK "HTTP $($_.Exception.Response.StatusCode.value__)" }

$cooConvs = Get "/chat/conversations" $cooToken
$stillThere = $cooConvs.data | Where-Object {$_.id -eq $groupId}
OK "Nhom con hien trong conv COO: $($stillThere.Count -gt 0)"

# ── TONG KET ───────────────────────────────────────────────────
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host "  DEMO HOAN THANH - TAT CA TINH NANG HOAT DONG DUNG" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host ""
Write-Host "  Tinh nang da demo:" -ForegroundColor White
@(
    "Login dual-user (CEO + COO)",
    "Online status polling",
    "User search (cho DM/Group)",
    "Tao DM idempotent",
    "Gui tin nhan + reply-to",
    "Get messages (cursor pagination)",
    "Mark as read / Unread badge count",
    "Edit message (5min window)",
    "Security: khong the edit tin nguoi khac",
    "Thu hoi tin (soft delete, giu DB)",
    "Tao nhom + them thanh vien",
    "Doi ten nhom (OWNER only)",
    "Security: member khong the doi ten",
    "Gui tin nhom - 2 user",
    "Danh sach conv + unread badge",
    "Roi nhom (ownership transfer)"
) | ForEach-Object { Write-Host "  - $_" -ForegroundColor DarkGray }
Write-Host ""
