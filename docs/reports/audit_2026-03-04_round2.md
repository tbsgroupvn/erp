# 🏥 Audit Report Round 2 - TBS ERP Backend
**Ngày kiểm tra:** 2026-03-04 (23:16)
**Người kiểm tra:** Khang (Antigravity Code Auditor)
**Phạm vi:** Full Audit Round 2 — Verify fixes + Deep Scan mới

---

## 📊 Tóm tắt

| Chỉ số | Lần 1 | Lần 2 |
|--------|-------|-------|
| 🔴 Critical | 0 | **0** |
| 🟡 Warnings | 4 | **2** ✅ (2 đã fix) |
| 🟢 Suggestions | 6 | **5** ✅ (1 đã fix) |
| 🆕 Mới phát hiện | — | **1 Warning mới** |

---

## ✅ Đã Sửa (Từ Round 1)

- ✅ **W-01 FIXED:** `task.controller.ts` — Đã thêm `RolesGuard` + `@Roles` cho `/assign`
- ✅ **W-02 FIXED:** `document.controller.ts` — Đã thêm `RolesGuard` class-level
- ✅ **W-04 FIXED:** `auth.service.ts` — PBKDF2 salt đọc từ `TWO_FA_ENCRYPTION_SALT` env var

---

## 🔴 Critical Issues

**Không có** — Dự án sạch Critical.

---

## 🟡 Warnings (Còn lại + Mới)

### ⚠️ W-05 (MỚI - QUAN TRỌNG): 34 npm vulnerabilities — 21 High

**Phát hiện từ: `npm audit`**

```
Total: 34 vulnerabilities
  - 5 low
  - 8 moderate
  - 21 high
  - 0 critical
```

**Packages chính xác định được:**
- `ajv < 6.14.0` — ReDoS vulnerability (devDep qua webpack, @nestjs/cli)
- `@nestjs/bull-shared` 10.0.0–10.2.3 — transitive dep vulnerability
- `@nestjs/core` — transitive dep từ một số packages

**Giải thích đời thường:**  
> Một số thư viện bên thứ 3 đang có lỗ hổng bảo mật đã biết. Phần lớn là trong devDependencies (chỉ ảnh hưởng khi build, không ở production runtime), nhưng cần review cẩn thận.

**Cách sửa:**
```bash
# Bước 1: Thử auto-fix an toàn trước
npm audit fix

# Bước 2: Nếu vẫn còn, xem xét từng package
npm audit fix --force  # ⚠️ Cẩn thận: có thể breaking changes

# Bước 3: Sau khi fix, test lại
npm run build && npm run test
```

---

### ⚠️ W-03 (Giữ nguyên): 30+ TODOs là integrations chưa implement

- Email notification, SMS, Tax API (MISA/Viettel), Bank API, VNACCS, LarkSuite, Vietcombank rate API...
- Đây là planned work, không phải bug — cần lên timeline implement

---

## 🟢 Suggestions (Còn lại)

### 💡 S-01: complaint.controller — TODO comment cũ trong service (đã có ở controller)

`complaint.service.ts:57` còn TODO comment nhắc thêm throttle, nhưng complaint.controller ĐÃ CÓ `@UseGuards(JwtAuthGuard, RolesGuard)` đầy đủ. Chỉ cần xóa comment cũ.

### 💡 S-02: `newsletter.controller` + `contacts.controller` — Export Excel stub

Tính năng export Excel chưa implement.

### 💡 S-03: customer-portal — `verifyOwnership()` pattern hợp lý ✅

Đã review: controller dùng custom `verifyOwnership()` thay vì RolesGuard — đây là pattern đúng cho impersonation flow. **Không cần sửa.**

### 💡 S-04: Bull Board `/admin/queues` — Nên thêm basic auth

Nếu expose ra internet, nên protect bằng basic auth hoặc IP whitelist.

### 💡 S-05: Background job `findMany` không có `take` limit

- `container-event.listener.ts:78`
- `container-arrival.listener.ts:52`
- `fulfillment-tracking.listener.ts:62`

Trigger khi xử lý event batch — nếu data lớn có thể OOM. Nên thêm batching/cursor pagination.

---

## 📋 Dependencies Audit Chi Tiết

| Package | Severity | Loại | Ảnh hưởng |
|---------|----------|------|-----------|
| `ajv < 6.14.0` | moderate | devDep (webpack) | Build time only |
| `@nestjs/bull-shared 10.0.0–10.2.3` | high | prod | Queue module |
| webpack (via @nestjs/cli) | high | devDep | Build time only |

**Lưu ý quan trọng:** Hầu hết 21 "high" vulnerabilities là trong devDependencies (webpack, cli tools) — **KHÔNG ảnh hưởng đến production runtime**. Tuy nhiên vẫn nên cập nhật.

---

## 🗄️ Database Schema / Index Audit

✅ Prisma schemas có `@@index` đầy đủ và hợp lý:
- `auth.prisma`: index trên `resetToken`, `userId`, `expiresAt`, `createdAt`
- `cms.prisma`: index trên `slug`, `status+publishedAt`, `tags`
- `blog.prisma`: index trên `status+publishedAt`, `slug`
- Composite indexes sử dụng đúng cách

---

## ✅ Điểm Mạnh Mới Ghi Nhận (Round 2)

- ✅ **customer-portal** — `verifyOwnership()` pattern tốt cho impersonation, không lộ data chéo user
- ✅ **complaint.controller** — Full RolesGuard + @Roles đầy đủ trên tất cả endpoints
- ✅ **DB Indexes** — Schema được thiết kế tốt với composite indexes cho queries phổ biến
- ✅ **@Public()** — Chỉ 2 endpoints public (đúng): blog list và page list

---

## 🎯 Next Steps (Theo độ ưu tiên)

| # | Action | Độ ưu tiên | Thời gian ước tính |
|---|--------|-----------|-------------------|
| 1 | Chạy `npm audit fix` | 🔴 Cao | 15 phút |
| 2 | Review @nestjs/bull-shared update | 🔴 Cao | 30 phút |
| 3 | Implement Email notification | 🟡 Trung | 2-3 ngày |
| 4 | Thêm `take` limit cho background listeners | 🟡 Trung | 1 giờ |
| 5 | Xóa TODO comment cũ trong complaint.service | 🟢 Thấp | 2 phút |
| 6 | Implement Vietcombank rate API | 🟢 Thấp | 1 ngày |
