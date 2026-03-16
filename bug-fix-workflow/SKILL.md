---
name: bug-fix-workflow
description: "Quy trình fix bug có hệ thống cho dự án TBS ORDER ERP khi dùng AI coding. Dùng khi: (1) Tester báo bug cần fix, (2) Hệ thống gặp lỗi 500/crash/data sai, (3) Fix xong bị regression vỡ chỗ khác, (4) Debug không biết lỗi ở đâu, (5) Cần review code trước deploy, (6) User nói 'fix bug', 'sửa lỗi', 'tester báo', 'bị lỗi', 'không hoạt động', 'bị crash', 'sai data'. LUÔN dùng skill này thay vì fix mù — nó đảm bảo fix đúng, fix nhỏ, không gây regression."
---

# Bug Fix Workflow — TBS ORDER ERP

Skill này hướng dẫn Claude fix bug có hệ thống cho hệ thống TBS ORDER ERP (NestJS + Next.js 14 + PostgreSQL + Redis), tránh regression và đảm bảo tuân thủ business rules.

## Nguyên tắc tối thượng

> **Fix nhỏ nhất có thể. Không refactor khi fix bug. Luôn có error log trước khi fix.**

---

## 1. THU THẬP THÔNG TIN (TRƯỚC KHI FIX)

### 1.1 Thông tin bắt buộc

Trước khi fix BẤT KỲ bug nào, Claude PHẢI có đủ 4 thông tin:

| # | Thông tin | Nếu thiếu |
|---|---|---|
| 1 | **Mô tả lỗi** — Lỗi gì, ở trang/module nào | Hỏi user |
| 2 | **Bước tái hiện** — Reproduce steps cụ thể | Hỏi user |
| 3 | **Error log** — Stack trace từ backend/frontend console | Hướng dẫn user lấy log (xem mục 1.2) |
| 4 | **Role/Account** — Ai gặp lỗi, role gì | Hỏi user |

**Nếu thiếu error log → KHÔNG fix mù.** Hướng dẫn user lấy log trước.

### 1.2 Hướng dẫn lấy Error Log

Khi user không có error log, gửi các lệnh này:

```bash
# Backend log (NestJS)
docker compose logs -f backend 2>&1 | grep -i "error\|exception\|fail" | tail -50

# Log cụ thể theo API endpoint
docker compose logs -f backend 2>&1 | grep "POST /orders"

# Log gần nhất
docker compose logs --tail=200 backend

# Frontend: Hướng dẫn user mở F12 → Console → copy lỗi đỏ
# Frontend: F12 → Network → tìm request đỏ → copy Response
```

### 1.3 Kiểm tra nhanh hệ thống

```bash
# Health check
curl -s https://api.domain.com/health | jq

# Database connection
docker compose exec postgres psql -U erp -d erp_db -c "SELECT 1;"

# Redis
docker compose exec redis redis-cli PING

# Disk space
df -h
```

---

## 2. PHÂN TÍCH BUG (ROOT CAUSE ANALYSIS)

### 2.1 Quy trình phân tích

Khi đã có error log, Claude phân tích theo thứ tự:

```
Error Stack Trace
  → Xác định file + dòng lỗi
    → Trace ngược: Controller → Service → Repository/Prisma
      → Xác định root cause (logic sai? data sai? null pointer? permission?)
        → Đề xuất fix (CHƯA fix, đợi confirm)
```

### 2.2 Phân loại root cause

| Loại | Dấu hiệu | Cách fix |
|---|---|---|
| **Null/Undefined** | `Cannot read property of undefined`, `null reference` | Thêm null check, optional chaining |
| **Prisma/DB** | `PrismaClientKnownRequestError`, `unique constraint` | Check query, check data integrity |
| **Validation** | `Bad Request 400`, DTO validation fail | Kiểm tra DTO decorator, input format |
| **Auth/Permission** | `Unauthorized 401`, `Forbidden 403` | Kiểm tra RBAC guard, role check |
| **FSM violation** | `Invalid state transition` | Kiểm tra current state, allowed transitions |
| **Business rule** | Logic sai nhưng không throw error | Kiểm tra business rule trong service layer |
| **Frontend** | Component crash, API call fail | Check hook, API client, error handling |
| **Cache** | Data cũ, không cập nhật | Invalidate Redis cache |

### 2.3 Câu hỏi tự kiểm tra trước khi đề xuất fix

Claude PHẢI tự hỏi 5 câu trước khi đề xuất:

1. **Fix này có vi phạm 5 nguyên tắc kiến trúc không?** (Order-Centric, Zero Trust, Blocking Flow, Real vs Declared, Dynamic Allocation)
2. **Fix này có bypass FSM không?** (7 máy trạng thái)
3. **Fix này có ảnh hưởng module nào khác không?** (Xem ma trận regression)
4. **Fix này có thay đổi DB schema không?** (Nếu có → DỪNG, tạo ticket riêng)
5. **Fix này có thay đổi API contract không?** (Nếu có → DỪNG, cần plan migration)

---

## 3. THỰC HIỆN FIX

### 3.1 Nguyên tắc fix (BẤT BIẾN)

```
╔══════════════════════════════════════════════════════╗
║  1. Fix ĐÚNG bug — không fix thêm thứ khác          ║
║  2. Fix NHỎ nhất — tối đa 1-2 file cho 1 bug        ║
║  3. KHÔNG refactor — đẹp code là việc khác           ║
║  4. KHÔNG sửa DB schema — tạo ticket riêng           ║
║  5. KHÔNG đổi API contract — sẽ vỡ frontend          ║
║  6. KHÔNG xóa/rename file — gây side effects         ║
║  7. Comment giải thích TẠI SAO fix như vậy            ║
║  8. Tuân thủ 5 nguyên tắc kiến trúc lõi              ║
╚══════════════════════════════════════════════════════╝
```

### 3.2 Template response khi fix

Claude PHẢI trả lời theo format:

```
## Root Cause
[2-3 câu giải thích nguyên nhân gốc]

## Fix
[Code change — CHỈ thay đổi cần thiết, có comment giải thích]

## Impact
- Module bị ảnh hưởng: [liệt kê]
- API bị ảnh hưởng: [liệt kê, hoặc "Không"]
- DB change: Không (hoặc giải thích nếu cần)

## Test Cases
1. [Test case reproduce bug → confirm fixed]
2. [Test case happy path cùng module]
3. [Test case module liên quan]
```

### 3.3 Xử lý khi AI đề xuất sửa nhiều file

Nếu Claude thấy cần sửa >2 file cho 1 bug → DỪNG và hỏi:

```
⚠️ Bug này có thể cần sửa [X] files:
- file1.ts — [lý do]
- file2.ts — [lý do]
- file3.ts — [lý do]

Lý do cần sửa nhiều file: [giải thích]

Bạn muốn:
A) Fix tất cả cùng lúc
B) Fix từng file, test sau mỗi file
C) Chỉ fix file gốc, xem các file khác có tự heal không
```

---

## 4. MA TRẬN REGRESSION TEST

### 4.1 Bảng module liên quan

Khi fix bug ở module A, Claude PHẢI nhắc user test các module liên quan:

| Fix ở Module | PHẢI test thêm |
|---|---|
| **Order** | Package, AR, Delivery, PaymentVoucher, Complaint, SupplierOrder, MHHIssue, CostAllocation, ExtraCharge |
| **PaymentVoucher** | AR, AP, CashTransaction, JournalEntry, Order (deposit status), Wallet |
| **Warehouse CN** | Package (status), Container, QCInspection, TrackingEvent, Order (stage) |
| **Warehouse VN** | Package (status), Delivery, CODRecord, TrackingEvent, Order (stage), AR (credit check) |
| **Container** | Package (all), Order (all in container), OperationCost, CostAllocation, TrackingEvent |
| **Customer** | Order (all), Wallet, AR, Quotation, Contract, Credit check |
| **Delivery** | CODRecord, Package (fulfillment), Order (fulfillmentStatus), TrackingEvent, Warehouse VN (RTO) |
| **Approval** | Entity gốc (Order/Voucher/Leave/etc), ApprovalStep, Notification |
| **Commission** | Order (completion), PayrollRecord (clawback), Complaint (ON_HOLD trigger) |
| **Invoice** | AR, JournalEntry, Order |
| **Quotation** | Contract, Order (conversion), Customer (discount) |
| **Contract** | PaymentAllocation, Order, Customer |

### 4.2 Template nhắc regression

Sau mỗi fix, Claude LUÔN nói:

```
✅ Fix đã apply. Hãy test:
1. ☐ Reproduce bug → confirm đã fix
2. ☐ [Module chính] — happy path (tạo/sửa/xóa)
3. ☐ [Module liên quan 1] — kiểm tra data đúng
4. ☐ [Module liên quan 2] — kiểm tra flow không vỡ
5. ☐ Không có error mới trong: docker compose logs --tail=50 backend
```

---

## 5. CÁC TÌNH HUỐNG ĐẶC BIỆT

### 5.1 Bug liên quan FSM (State Machine)

7 FSM trong hệ thống:

| FSM | States |
|---|---|
| Đơn NCC | DRAFT → QUOTED → ORDERED → CONFIRMED → PARTIALLY_SHIPPED → SHIPPED_CN → RECEIVED_CN |
| Container | PLANNING → LOADING → IN_TRANSIT → (ON_HOLD_BORDER) → ARRIVED → CUSTOMS → COMPLETED |
| Báo giá | DRAFT → PENDING → APPROVED → CONVERTED/EXPIRED/REJECTED |
| Khiếu nại | OPEN → INVESTIGATING → PENDING_RESOLUTION → RESOLVED → CLOSED |
| Phiếu thu/chi | PENDING → APPROVED/REJECTED |
| Kho TQ | RECEIVED → INSPECTED → PACKED → SHIPPED |
| Kho VN | RECEIVED → SORTED → READY → DELIVERED |

**Quy tắc fix FSM:**
- LUÔN dùng `canTransition()` / `enforceTransition()` — KHÔNG check bằng if/else thủ công
- KHÔNG thêm transition mới mà không review toàn bộ flow
- Nếu cần thêm state → tạo ticket riêng, không fix nóng

### 5.2 Bug liên quan Tài chính

**Quy tắc đặc biệt:**
- Kiểm tra anti-fraud rules (>90% tháng trước, >5tr chi phí khác, >5 phiếu/ngày, lý do <20 ký tự, ngoài giờ)
- Kiểm tra tách biệt nhiệm vụ (người tạo ≠ người duyệt)
- Kiểm tra chặn vượt tổng đơn (tổng phiếu thu ≤ tổng đơn)
- Kiểm tra credit check tích lũy khi xuất kho
- Kiểm tra kiểm soát kỳ kế toán
- Phiếu >10M VND → bắt buộc chứng từ

### 5.3 Bug liên quan Kho

**Quy tắc đặc biệt:**
- Bắt buộc ảnh khi nhận kiện kho TQ (check cả DTO + service layer)
- `cnWeight` và `vnWeight` là 2 field riêng, KHÔNG ghi đè
- Cảnh báo chênh lệch >5% giữa cnWeight và vnWeight
- Kiện có `PackageIndependentStatus` (CONFISCATED/HIGH_RISK_HOLD) xử lý riêng
- Barcode scan dùng Redis cache <50ms

### 5.4 Bug P0 — Khẩn cấp

Khi hệ thống down hoặc block toàn bộ user:

```
1. Kiểm tra health: curl https://api.domain.com/health
2. Kiểm tra DB: docker compose exec postgres psql -U erp -d erp_db -c "SELECT 1;"
3. Kiểm tra Redis: docker compose exec redis redis-cli PING
4. Xem log: docker compose logs --tail=200 backend
5. Nếu OOM: docker compose restart backend
6. Nếu DB lock: 
   SELECT pid, query FROM pg_stat_activity WHERE state = 'active';
   SELECT pg_terminate_backend(pid);
7. Nếu Redis full: docker compose exec redis redis-cli FLUSHDB
```

---

## 6. PRE-DEPLOY CHECK

### 6.1 Prompt review trước deploy

Sau khi fix xong tất cả bugs, Claude chạy review:

```
Kiểm tra tất cả thay đổi:
1. File nào đã sửa? Liệt kê.
2. Mỗi file: có vi phạm 5 nguyên tắc kiến trúc không?
3. FSM có bị bypass không?
4. RBAC check có đúng không?
5. Có hard-coded value mới không?
6. Có console.log/debug code còn sót không?
7. Module nào cần test trước deploy?
```

### 6.2 Lệnh deploy

```bash
# Pull + Deploy
git pull origin main
chmod +x scripts/update.sh
./scripts/update.sh

# Monitor 5-10 phút
docker compose logs -f backend 2>&1 | grep -i "error\|exception" | head -20

# Health check
curl -s https://api.domain.com/health | jq
```

### 6.3 Rollback nếu deploy fail

```bash
# Xem commit trước
git log --oneline -5

# Rollback
git revert HEAD
./scripts/update.sh

# Hoặc rollback DB nếu migration lỗi
docker compose exec postgres pg_restore -U erp -d erp_db backup_latest.dump
```

---

## 7. GIT CONVENTION

| Prefix | Khi nào | Ví dụ |
|---|---|---|
| `fix(module):` | Fix bug thường | `fix(order): BUG-001 lỗi 500 khi tạo đơn VIP` |
| `hotfix(module):` | Fix P0 khẩn | `hotfix(auth): login fail toàn hệ thống` |
| `feat(module):` | Thêm tính năng | `feat(warehouse): thêm cân lại kiện VN` |
| `refactor(module):` | Cải thiện code | `refactor(finance): optimize AR aging query` |

**Quy tắc:** Mỗi bug = 1 commit riêng. Không gộp. Message phải có BUG-ID nếu có.

---

## 8. ANTI-PATTERNS (TUYỆT ĐỐI KHÔNG LÀM)

| ❌ Không làm | ✅ Thay bằng |
|---|---|
| Fix mù không có error log | Lấy log trước, phân tích rồi mới fix |
| Sửa 5+ files cho 1 bug | Xác định file gốc, fix tối đa 1-2 file |
| Refactor code khi đang fix bug | Fix trước, refactor sau (ticket riêng) |
| Thay đổi DB schema để fix bug | Tạo migration ticket riêng |
| Đổi API request/response format | Giữ nguyên contract, fix logic bên trong |
| Xóa/rename file | Giữ nguyên file structure |
| Fix xong không test regression | LUÔN test theo ma trận regression |
| Deploy không monitor | Monitor logs 5-10 phút sau deploy |
| Gộp nhiều bug vào 1 commit | Mỗi bug 1 commit riêng |
| Bypass FSM bằng if/else | Dùng canTransition()/enforceTransition() |
| Hard-code business values | Dùng env variables (xem Business Rules config) |

---

## 9. QUICK REFERENCE — COPY & PASTE PROMPTS

### Prompt A: Fix bug đơn lẻ
```
## BUG FIX
Lỗi: [mô tả]
Steps: [bước tái hiện]
Error: [paste log]
File (nếu biết): [path]

Quy tắc: Fix nhỏ nhất, không refactor, không đổi schema/API.
Output: Root cause → Fix → Impact → Test cases.
```

### Prompt B: Debug không biết lỗi ở đâu
```
## DEBUG
Triệu chứng: [mô tả]
Error log: [paste]

Chưa biết lỗi ở file nào. Hãy:
1. Phân tích stack trace
2. Trace: endpoint → controller → service → DB
3. Xác định dòng code gây lỗi
4. Đề xuất fix (CHƯA apply, đợi confirm)
```

### Prompt C: Fix nhiều bug cùng module
```
## BATCH FIX — [Module]
Bug 1 (P0): [mô tả] — Error: [log]
Bug 2 (P1): [mô tả] — Error: [log]
Bug 3 (P2): [mô tả] — Error: [log]

Fix từng bug một, commit riêng. Bắt đầu từ P0.
```

### Prompt D: Review trước deploy
```
Review toàn bộ thay đổi gần nhất:
1. Có vi phạm 5 nguyên tắc kiến trúc?
2. FSM bị bypass?
3. RBAC đúng chưa?
4. Console.log/debug sót?
5. Test case cần chạy?
```
