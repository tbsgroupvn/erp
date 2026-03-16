# PROMPT FIX BUG — TBS ORDER ERP
# Hướng dẫn sử dụng: Copy prompt phù hợp → Paste vào Claude Code / Cursor / AI IDE
# Điền thông tin trong [...] trước khi paste

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PROMPT 1: FIX BUG ĐƠN LẺ (Dùng nhiều nhất)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
Đọc file bug-fix-workflow/SKILL.md trước khi bắt đầu.

## BUG FIX REQUEST

### 1. Bug ID & Mức độ
- ID: BUG-[YYYYMMDD]-[XXX]
- Mức độ: [P0-Block / P1-High / P2-Medium / P3-Low]
- Module: [tên module — vd: order, finance, warehouse-cn]

### 2. Mô tả lỗi
[Mô tả ngắn gọn hiện tượng lỗi]

### 3. Bước tái hiện
1. Login với role [ROLE], tài khoản [email]
2. Vào trang [/route]
3. Thực hiện [thao tác cụ thể]
4. Kết quả: [lỗi gì xảy ra]

### 4. Kết quả mong đợi
[Hệ thống đáng lẽ phải làm gì]

### 5. Error Log
```
[Paste error stack trace từ docker logs / Sentry / browser console]
```

### 6. Quy tắc fix (BẮT BUỘC)
- Chỉ fix đúng bug, KHÔNG refactor code khác
- KHÔNG thay đổi DB schema / API format / enum values
- Tối đa sửa 3 file. Nếu cần nhiều hơn → dừng lại hỏi tôi
- Tuân thủ 5 nguyên tắc kiến trúc lõi
- Comment giải thích tại sao sửa

### 7. Output yêu cầu
1. Root cause (2-3 câu)
2. Code fix cụ thể
3. Danh sách module bị ảnh hưởng
4. 3-5 test cases cần verify
```


## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PROMPT 2: DEBUG — KHÔNG BIẾT LỖI Ở ĐÂU
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
Đọc file bug-fix-workflow/SKILL.md trước khi bắt đầu.

## DEBUG REQUEST

### Triệu chứng
[Mô tả hiện tượng — vd: trang trắng, data sai, chậm, crash]

### Thông tin có
- Role: [role đang dùng]
- Route: [trang bị lỗi]
- Trình duyệt: [Chrome/Safari/Mobile]
- Lỗi console (nếu có): [paste từ F12 → Console]
- Lỗi network (nếu có): [paste từ F12 → Network → request fail]
- Backend log (nếu có): [paste từ docker compose logs]

### Yêu cầu
1. Phân tích thông tin đã có
2. Nếu chưa đủ → cho tôi lệnh cụ thể để lấy thêm log
3. Trace: endpoint → controller → service → repository
4. Xác định chính xác file + dòng gây lỗi
5. Đề xuất fix — NHƯNG CHƯA APPLY, đợi tôi confirm
```


## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PROMPT 3: FIX BATCH — NHIỀU BUG CÙNG MODULE
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
Đọc file bug-fix-workflow/SKILL.md trước khi bắt đầu.

## BATCH BUG FIX — Module: [tên module]

Fix theo thứ tự ưu tiên. Mỗi bug = 1 commit riêng. KHÔNG gộp.

### Bug 1 — [P0/P1/P2] — BUG-[ID]
- Mô tả: [lỗi gì]
- Steps: [bước tái hiện ngắn gọn]
- Error: [paste log snippet]

### Bug 2 — [P0/P1/P2] — BUG-[ID]
- Mô tả: [lỗi gì]
- Steps: [bước tái hiện ngắn gọn]
- Error: [paste log snippet]

### Bug 3 — [P0/P1/P2] — BUG-[ID]
- Mô tả: [lỗi gì]
- Steps: [bước tái hiện ngắn gọn]
- Error: [paste log snippet]

### Quy tắc
- Fix lần lượt Bug 1 → Bug 2 → Bug 3
- Mỗi bug: phân tích → fix → test → commit riêng
- Nếu Bug 2 liên quan đến code vừa fix ở Bug 1 → báo tôi trước
- Commit message: fix([module]): BUG-[ID] [mô tả ngắn]
```


## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PROMPT 4: FIX BUG LIÊN QUAN NHIỀU MODULE
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
Đọc file bug-fix-workflow/SKILL.md trước khi bắt đầu.

## CROSS-MODULE BUG FIX

### Mô tả lỗi
[Lỗi gì, ảnh hưởng module nào]

### Flow bị lỗi
[Module A] → [Module B] → [Module C]
Ví dụ: Tạo đơn (Order) → Xuất kho (Warehouse VN) → Công nợ (AR) không cập nhật

### Error Log
```
[Paste log]
```

### Yêu cầu
1. Trace toàn bộ flow từ đầu đến cuối
2. Xác định module NÀO là điểm đứt (root cause)
3. Chỉ fix tại điểm đứt — KHÔNG sửa module đang hoạt động đúng
4. Nếu downstream module cũng cần fix → giải thích tại sao, hỏi tôi confirm
5. Liệt kê regression test cho TẤT CẢ module trong flow
```


## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PROMPT 5: FIX BUG REGRESSION (fix xong vỡ chỗ khác)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
Đọc file bug-fix-workflow/SKILL.md trước khi bắt đầu.

## REGRESSION BUG FIX

### Bug gốc đã fix trước đó
- BUG-[ID]: [mô tả bug gốc]
- Commit: [commit hash hoặc mô tả thay đổi]
- File đã sửa: [liệt kê file]

### Bug mới phát sinh sau khi fix
- Mô tả: [lỗi mới gì]
- Module bị ảnh hưởng: [module nào]
- Error: [paste log]

### Yêu cầu
1. So sánh code trước/sau commit fix trước đó
2. Xác định CHÍNH XÁC thay đổi nào gây ra bug mới
3. Fix bug mới mà KHÔNG revert fix cũ (trừ khi fix cũ sai hoàn toàn)
4. Nếu 2 bug conflict nhau → đề xuất giải pháp bao quát hơn
5. Sau khi fix → regression test CẢ 2 bug
```


## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PROMPT 6: FIX LỖI FRONTEND (UI/UX)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
Đọc file bug-fix-workflow/SKILL.md trước khi bắt đầu.

## FRONTEND BUG FIX

### Mô tả lỗi UI
[Trang nào, component nào, hiện tượng gì — vd: bảng không hiển thị data, nút bấm không phản hồi, form submit lỗi]

### Route: [/route]
### Role: [role đang dùng]

### Console Error (F12 → Console)
```
[Paste lỗi đỏ từ console]
```

### Network Error (F12 → Network)
- Request: [METHOD] [URL]
- Status: [status code]
- Response: [paste response body nếu có]

### Yêu cầu
1. Xác định lỗi ở layer nào: Component → Hook → API Client → Backend API
2. Nếu lỗi frontend thuần (component/hook): fix tại frontend
3. Nếu lỗi do API trả data sai: fix tại backend service
4. KHÔNG sửa cả frontend lẫn backend nếu chỉ 1 bên sai
5. Đảm bảo TypeScript types khớp với API response
```


## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PROMPT 7: FIX LỖI TÀI CHÍNH (CẨN THẬN CAO)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
Đọc file bug-fix-workflow/SKILL.md trước khi bắt đầu.

## FINANCE BUG FIX ⚠️ HIGH SENSITIVITY

### Mô tả lỗi
[Lỗi liên quan: phiếu thu/chi, công nợ, hoa hồng, tỷ giá, sổ cái, hóa đơn]

### Số liệu cụ thể
- Giá trị đúng: [số tiền/tỷ lệ mong đợi]
- Giá trị sai: [số tiền/tỷ lệ đang hiển thị]
- Chênh lệch: [bao nhiêu]

### Error Log
```
[Paste log]
```

### CHECKLIST BẮT BUỘC TRƯỚC KHI FIX
Hãy kiểm tra và báo cáo từng mục:
- [ ] Tách biệt nhiệm vụ: Người tạo ≠ Người duyệt?
- [ ] Chặn vượt tổng: Tổng phiếu thu ≤ tổng đơn hàng?
- [ ] Anti-fraud rules: >90% tháng trước? >5tr chi phí khác? >5 phiếu/ngày?
- [ ] Bắt buộc chứng từ: Phiếu >10M có attachment?
- [ ] Kiểm soát kỳ: Kỳ kế toán đã đóng chưa?
- [ ] Kiểm tra 3 bên: Tổng chi NCC ≤ báo giá +5%?
- [ ] Tỷ giá: CNY manual (KTT), USD auto (Vietcombank)?

### Sau khi fix, kiểm tra:
- AR/AP balance có đúng không
- JournalEntry debit = credit không
- Commission calculation có bị ảnh hưởng không
- CashTransaction có khớp PaymentVoucher không
```


## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PROMPT 8: REVIEW TRƯỚC KHI DEPLOY
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
## PRE-DEPLOY REVIEW

Review TẤT CẢ thay đổi trong [X] commit gần nhất.

Với mỗi file đã thay đổi, kiểm tra:

### 1. Nguyên tắc kiến trúc
- [ ] Order-Centric: Có tạo data mồ côi không?
- [ ] Zero Trust: Có bypass validation nào không?
- [ ] Blocking Flow: FSM có bị bypass không?
- [ ] Real vs Declared: Có ghi đè data gốc / hard delete không?
- [ ] Dynamic Allocation: Chi phí có xử lý sync thay vì async không?

### 2. Security
- [ ] RBAC đúng cho endpoint mới/sửa?
- [ ] Input validation đầy đủ?
- [ ] Audit log cho mọi CRUD?
- [ ] Sensitive data có encrypt?

### 3. Impact Analysis
- Liệt kê module bị ảnh hưởng
- Liệt kê API endpoint bị ảnh hưởng
- Có breaking change không?

### 4. Test Cases
- Đề xuất 5-10 test cases quan trọng nhất cần chạy trước deploy
- Ưu tiên: happy path → edge case → regression

### 5. Rollback Plan
- Nếu deploy lỗi, cần revert những gì?
- Có migration DB cần rollback không?
```


## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PROMPT 9: FIX NHANH — KHI ĐÃ BIẾT FILE LỖI
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
Fix lỗi trong file [path/to/file.ts]:

Lỗi: [mô tả ngắn]
Error: [paste error message 1 dòng]

Quy tắc: Chỉ sửa file này. Không refactor. Comment giải thích.
```


## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PROMPT 10: TỔNG HỢP BUG REPORT TỪ TESTER
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
Tester vừa gửi bug report dưới đây. Hãy:

1. Phân tích bug report
2. Đánh giá mức độ (P0/P1/P2/P3)
3. Xác định module liên quan
4. Cho tôi lệnh lấy error log cụ thể
5. Nếu đã đủ thông tin → đề xuất fix
6. Nếu thiếu → liệt kê thông tin cần bổ sung

--- BUG REPORT ---
[Paste toàn bộ bug report từ tester vào đây]
--- END ---
```


## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## LỆNH LẤY LOG THƯỜNG DÙNG
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```bash
# === BACKEND LOG ===
docker compose logs --tail=100 backend                              # 100 dòng gần nhất
docker compose logs -f backend 2>&1 | grep -i "error\|exception"   # Realtime filter lỗi
docker compose logs -f backend 2>&1 | grep "POST /orders"          # Filter theo API
docker compose logs --since="2h" backend                            # Log 2 giờ gần nhất

# === DATABASE ===
docker compose exec postgres psql -U erp -d erp_db
# Kiểm tra đơn: SELECT id, status, "customerId" FROM "Order" WHERE id='xxx';
# Kiểm tra audit: SELECT * FROM "AuditLog" WHERE "entityId"='xxx' ORDER BY "createdAt" DESC LIMIT 5;

# === REDIS ===
docker compose exec redis redis-cli PING
docker compose exec redis redis-cli KEYS "*order*"
docker compose exec redis redis-cli FLUSHDB                        # Xóa cache (cẩn thận)

# === HEALTH ===
curl -s https://api.domain.com/health | jq

# === RESTART ===
docker compose restart backend
docker compose restart redis
docker compose up -d --force-recreate backend                      # Rebuild container
```
