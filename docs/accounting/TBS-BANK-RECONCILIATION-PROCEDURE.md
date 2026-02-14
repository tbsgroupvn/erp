# TBS GROUP — BANK RECONCILIATION PROCEDURE

**Company:** TBS Group Co., Ltd.
**Effective Date:** 01/03/2026
**Version:** 1.0
**Approved by:** BOD

---

## TABLE OF CONTENTS

- [1. OVERVIEW](#1-overview)
- [2. DAILY RECONCILIATION](#2-daily-reconciliation)
- [3. MONTHLY RECONCILIATION](#3-monthly-reconciliation)
- [4. DISCREPANCY HANDLING](#4-discrepancy-handling)
- [5. CONTROLS & APPROVALS](#5-controls--approvals)
- [6. TEMPLATES & CHECKLISTS](#6-templates--checklists)

---

# 1. OVERVIEW

## 1.1. Purpose

Quy trình đối chiếu ngân hàng nhằm:
- ✅ Đảm bảo số dư sổ sách = Số dư thực tế tại ngân hàng
- ✅ Phát hiện sai sót, giao dịch lạ, gian lận
- ✅ Kiểm soát dòng tiền (cash flow control)
- ✅ Compliance với chuẩn mực kế toán VN

## 1.2. Scope

Áp dụng cho:
- ✅ Tất cả tài khoản ngân hàng của TBS (VND, USD, CNY)
- ✅ Tài khoản tiền mặt tại quỹ (cash on hand)

## 1.3. Frequency

| Loại đối chiếu | Tần suất | Deadline | Người thực hiện |
|----------------|----------|----------|-----------------|
| **Daily Reconciliation** | Mỗi ngày | Trước 10:00 sáng | KT Thanh toán |
| **Monthly Reconciliation** | Cuối tháng | Ngày 3 tháng sau | KT Tổng hợp |
| **Quarterly Review** | Cuối quý | Ngày 5 quý sau | KT Tổng hợp + BGĐ |

## 1.4. Responsibilities

| Vai trò | Trách nhiệm |
|---------|-------------|
| **KT Thanh toán (KT TT)** | Daily reconciliation, phát hiện discrepancy |
| **KT Tổng hợp (KT TH)** | Monthly reconciliation, điều chỉnh sổ sách, báo cáo BGĐ |
| **BGĐ/COO** | Review & approve monthly reconciliation statement |

---

# 2. DAILY RECONCILIATION

## 2.1. Objective

- Phát hiện **NGAY** các giao dịch bất thường trong ngày
- Đảm bảo tất cả giao dịch đã ghi sổ đúng
- Alert nếu có chênh lệch lớn (>5 triệu VND)

## 2.2. Daily Checklist (KT Thanh Toán)

### 🕐 Bước 1: Download sao kê NH (8:30-9:00 AM)

```
☑ Login internet banking từng ngân hàng:
  - Vietcombank (TK VND: xxx-xxx-xxx, TK USD: yyy-yyy-yyy)
  - Techcombank (TK VND: zzz-zzz-zzz)
  - ACB (TK CNY: aaa-aaa-aaa)

☑ Download bank statement (sao kê) ngày hôm qua:
  - Format: Excel/CSV (ưu tiên) hoặc PDF
  - Lưu vào: \\shared\Accounting\Bank\[YYYY-MM]\[Bank]_[Date].xlsx

☑ Verify:
  - Số dư đầu ngày (Beginning Balance) khớp với số dư cuối ngày hôm trước không?
  - Tất cả giao dịch đều hiển thị đầy đủ không?
```

### 🕑 Bước 2: So sánh với sổ sách (9:00-9:30 AM)

**Export từ TBS ERP:**
```
☑ Login TBS ERP → Module "Kế toán" → "Sổ Ngân hàng"
☑ Filter: Ngày hôm qua, Tài khoản: [Chọn TK NH]
☑ Export Excel: Tất cả giao dịch (Thu/Chi)
☑ Lưu vào: \\shared\Accounting\Reconciliation\[YYYY-MM]\ERP_[Date].xlsx
```

**So sánh từng dòng:**
```
☑ Mở 2 file: Bank statement vs ERP export
☑ Check từng giao dịch:

  Trong Bank Statement                 Trong ERP
  ────────────────────────────────────────────────────────
  Date: 08/02  Amount: -35,000,000    Date: 08/02  Amount: 35,000,000
  Description: "Chuyen khoan"         Description: "Chi mua hàng NCC A"
  Balance: 250,000,000                Ref: PC001

  → KHỚP ✅ (Dấu âm ở bank = Chi, dương ở ERP = Chi ra)

☑ Highlight các giao dịch KHÔNG khớp (màu vàng)
```

### 🕒 Bước 3: Xác định chênh lệch (9:30-9:45 AM)

**Công thức kiểm tra:**
```
Số dư sổ sách cuối ngày = Số dư NH cuối ngày + Điều chỉnh

Điều chỉnh gồm:
  (+) Chi phiếu chưa về NH (Issued but not presented)
  (-) Thu tiền chưa về NH (Deposits in transit)
  (±) Bank fees/interest chưa ghi sổ
```

**Ví dụ:**
```
Số dư sổ sách cuối ngày 08/02:  260,000,000 VND
Số dư NH cuối ngày 08/02:       255,000,000 VND
Chênh lệch:                       5,000,000 VND

Phân tích:
  Chi phiếu #PC123 (07/02) - 5tr → NH chưa trừ (do cuối giờ)
  → OK, chênh lệch timing difference (bình thường)

  Nếu không tìm ra nguyên nhân → ALERT ⚠️
```

### 🕓 Bước 4: Ghi nhận & Report (9:45-10:00 AM)

**Nếu khớp hoặc chênh lệch nhỏ (<1 triệu):**
```
☑ Ghi vào Daily Reconciliation Log:
  Date: 08/02/2026
  Bank: Vietcombank VND
  Book Balance: 260,000,000
  Bank Balance: 255,000,000
  Difference: 5,000,000
  Reason: Chi phiếu #PC123 chưa về
  Status: ✅ OK

☑ Lưu file log: \\shared\Accounting\Reconciliation\[YYYY-MM]\Daily_Log.xlsx
```

**Nếu chênh lệch lớn (>5 triệu) hoặc không tìm ra nguyên nhân:**
```
☑ URGENT: Email ngay KT TH + BGĐ
  Subject: [URGENT] Bank Reconciliation Alert - [Bank] [Date]
  Body:
    - Số dư sổ sách: XXX
    - Số dư NH: YYY
    - Chênh lệch: ZZZ
    - Nguyên nhân tạm thời: [...]
    - Action needed: Investigate ASAP

☑ Stop: KHÔNG approve bất kỳ phiếu chi nào cho đến khi tìm ra nguyên nhân
```

---

## 2.3. Common Scenarios (Daily)

### Scenario 1: Chi phiếu chưa về NH

**Tình huống:**
- Ngày 08/02 chiều: Tạo phiếu chi #PC123 - 5 triệu
- ERP ghi nhận: Giảm TK 112 (Tiền gửi NH) - 5 triệu
- Ngày 09/02 sáng: Check NH → Chưa thấy trừ tiền

**Nguyên nhân:**
- Chi phiếu muộn (sau 15h) → NH xử lý ngày hôm sau
- Hoặc NH chậm xử lý (1-2 ngày)

**Xử lý:**
- ✅ Bình thường, không cần điều chỉnh
- Monitor: Ngày 10/02 nếu vẫn chưa về → Call NH

---

### Scenario 2: Phí NH chưa ghi sổ

**Tình huống:**
- Check NH: Thấy trừ phí 200,000 VND (phí chuyển tiền swift)
- ERP: Chưa có giao dịch này

**Nguyên nhân:**
- NH tự động trừ phí, chưa thông báo trước

**Xử lý:**
```
☑ Ghi nhận ngay:

Định khoản:
Nợ: TK 635 - Chi phí tài chính (200,000)
Có: TK 112 - Tiền gửi NH (200,000)

Ghi chú: Phí NH - Swift transfer fee ngày 08/02
```

---

### Scenario 3: Lãi tiền gửi

**Tình huống:**
- Check NH: Thấy cộng lãi 500,000 VND
- ERP: Chưa có

**Xử lý:**
```
Định khoản:
Nợ: TK 112 - Tiền gửi NH (500,000)
Có: TK 515 - Doanh thu hoạt động tài chính (500,000)

Ghi chú: Lãi tiền gửi tháng 01/2026
```

---

### Scenario 4: Giao dịch lạ (FRAUD ALERT)

**Tình huống:**
- Check NH: Thấy chi 50 triệu cho "Công ty XYZ"
- ERP: KHÔNG có phiếu chi này
- Không ai trong công ty biết giao dịch này

**⚠️ ACTION NGAY:**
```
1. URGENT: Gọi điện NH NGAY (hotline)
   - Yêu cầu: Block account tạm thời
   - Tra cứu: Giao dịch này được authorize bởi ai?

2. Email BGĐ + COO NGAY (trong 5 phút)
   Subject: [URGENT] Suspicious Transaction - Possible Fraud
   - Screenshot giao dịch
   - Yêu cầu: Họp khẩn

3. Báo cáo công an (nếu xác định là gian lận)

4. Điều tra nội bộ:
   - Ai có quyền truy cập internet banking?
   - Token/OTP bị đánh cắp?
   - Máy tính bị hack?
```

---

# 3. MONTHLY RECONCILIATION

## 3.1. Objective

- Đối chiếu **TOÀN DIỆN** tất cả giao dịch trong tháng
- Điều chỉnh sổ sách (nếu cần)
- Soạn **Bank Reconciliation Statement** chính thức
- BGĐ sign-off

## 3.2. Monthly Checklist (KT Tổng Hợp)

### Timeline: Ngày 1-3 tháng sau

**Ngày 1 (Cuối tháng):**
```
☑ 17:00: Cut-off - Đóng sổ tháng vừa rồi
☑ Export từ ERP: Tất cả giao dịch NH tháng vừa rồi
☑ Download NH: Sao kê FULL tháng (từ ngày 1 đến ngày cuối)
```

**Ngày 2:**
```
☑ So sánh chi tiết (line-by-line reconciliation)
☑ Tổng hợp timing differences:
  - Chi phiếu chưa về: XXX
  - Thu tiền chưa về: YYY
  - Phí/lãi NH: ZZZ
☑ Điều chỉnh sổ sách (nếu có phí/lãi NH chưa ghi)
☑ Soạn Bank Reconciliation Statement
```

**Ngày 3:**
```
☑ Review với KT TT (quality check)
☑ Trình BGĐ ký duyệt
☑ Lưu trữ: Archive file + chứng từ
```

---

## 3.3. Bank Reconciliation Statement Format

**TBS GROUP**
**BANK RECONCILIATION STATEMENT**
**Tài khoản: Vietcombank VND (xxx-xxx-xxx)**
**Tháng: 02/2026**

---

### A. Số dư theo sổ sách (Book Balance)

```
Số dư đầu tháng (01/02/2026):              500,000,000 VND

Tổng thu trong tháng:                    1,200,000,000 VND
Tổng chi trong tháng:                     (900,000,000) VND
                                          ─────────────────
Số dư cuối tháng theo sổ sách (28/02):    800,000,000 VND
```

---

### B. Số dư theo ngân hàng (Bank Balance)

```
Số dư cuối tháng theo sao kê NH (28/02):   785,000,000 VND
```

---

### C. Các khoản điều chỉnh (Reconciling Items)

#### C1. Cộng vào số dư ngân hàng (+)

| # | Mô tả | Số tiền | Ghi chú |
|---|-------|---------|---------|
| 1 | Chi phiếu #PC145 (27/02) | 10,000,000 | NH chưa trừ, dự kiến 01/03 |
| 2 | Chi phiếu #PC150 (28/02) | 5,000,000 | NH chưa trừ, dự kiến 01/03 |
| **Tổng cộng (+)** | **15,000,000** | |

#### C2. Trừ vào số dư ngân hàng (-)

| # | Mô tả | Số tiền | Ghi chú |
|---|-------|---------|---------|
| 1 | Thu tiền khách A (28/02 chiều) | - | Chuyển khoản sau giờ, NH chưa cộng |
| **Tổng trừ (-)** | **0** | |

---

### D. Điều chỉnh vào sổ sách (Book Adjustments)

| # | Mô tả | Số tiền | JE # | Ghi chú |
|---|-------|---------|------|---------|
| 1 | Phí NH - Chuyển tiền swift | (200,000) | JE-0228-01 | Đã ghi nhận ngày 28/02 |
| **Tổng điều chỉnh** | **(200,000)** | |

*Số dư sổ sách đã điều chỉnh: 800,000,000 - 200,000 = 799,800,000*

---

### E. Đối chiếu (Reconciliation)

```
Số dư NH cuối tháng (28/02):                785,000,000
(+) Chi phiếu chưa về:                       15,000,000
(-) Thu tiền chưa về:                                 0
                                            ────────────
Số dư NH điều chỉnh:                        800,000,000

Số dư sổ sách điều chỉnh:                   799,800,000
                                            ────────────
Chênh lệch:                                     200,000 ❌

Nguyên nhân: Làm tròn số trong ERP (bug minor)
Action: Fix ERP rounding issue
```

---

### F. Sign-off

```
Người lập: ________________          Ngày: 03/03/2026
           (KT Tổng hợp)

Người kiểm tra: ____________        Ngày: 03/03/2026
                (KT TT)

Người phê duyệt: ___________        Ngày: 03/03/2026
                 (BGĐ/COO)
```

---

## 3.4. Timing Differences vs. Errors

### Timing Differences (Chênh lệch thời gian - BÌNH THƯỜNG)

**Đặc điểm:**
- ✅ Tự giải quyết trong vài ngày
- ✅ Có thể giải thích rõ ràng
- ✅ Không cần điều chỉnh sổ sách

**Ví dụ:**
- Chi phiếu cuối ngày → NH xử lý ngày sau
- Thu tiền chuyển khoản ngoài giờ → NH cộng sáng hôm sau
- Séc khách gửi → NH clearing 2-3 ngày

**Xử lý:**
- Note lại trong Reconciliation Statement
- Monitor ngày hôm sau để confirm đã về NH

---

### Errors (Sai sót - CẦN ĐIỀU CHỈNH)

**Đặc điểm:**
- 🔴 Không tự giải quyết
- 🔴 Sổ sách KHÔNG khớp với thực tế
- 🔴 CẦN điều chỉnh ngay

**Ví dụ:**

#### Lỗi 1: Phí NH chưa ghi sổ
```
NH: Trừ phí 500,000
ERP: Chưa có

Điều chỉnh:
Nợ: TK 635 - Chi phí TC (500,000)
Có: TK 112 - Tiền gửi NH (500,000)
```

#### Lỗi 2: Ghi nhầm số tiền
```
NH: Chi 10,000,000
ERP: Ghi 1,000,000 (thiếu 1 số 0)

Điều chỉnh:
Nợ: TK [...] (9,000,000) - Tùy loại CP
Có: TK 112 (9,000,000)
```

#### Lỗi 3: Ghi trùng giao dịch
```
NH: Chi 5,000,000 (1 lần)
ERP: Ghi 2 lần (tổng 10,000,000)

Điều chỉnh (reverse 1 entry):
Nợ: TK 112 (5,000,000)
Có: TK [...] (5,000,000)
```

---

# 4. DISCREPANCY HANDLING

## 4.1. Tolerance Levels (Mức độ chấp nhận)

| Chênh lệch | Phân loại | Action |
|------------|-----------|--------|
| **0 - 100,000** | Immaterial (không trọng yếu) | Note lại, có thể chấp nhận nếu rounding error |
| **100,000 - 1,000,000** | Material | Investigate & điều chỉnh trong ngày |
| **1,000,000 - 5,000,000** | Significant | Alert KT TH, investigate ngay, báo cáo ngày hôm sau |
| **> 5,000,000** | Critical | URGENT: Alert BGĐ ngay, họp khẩn, investigate trong 2h |

## 4.2. Investigation Procedure

### Step 1: Tự kiểm tra (Self-check)

```
☑ Recheck calculation: Có tính sai không?
☑ Redownload bank statement: File bị corrupt?
☑ Re-export từ ERP: Data export đầy đủ không?
☑ Check date range: Có đúng kỳ không? (VD: Lẫn tháng 1 với tháng 2)
```

### Step 2: So sánh từng dòng (Line-by-line)

```
☑ Sort cả 2 file theo: Date + Amount
☑ Visual comparison: Dòng nào thiếu? Dòng nào thừa?
☑ Highlight discrepancies
☑ Liệt kê:
  - Missing in Bank (có trong ERP, không có trong NH)
  - Missing in ERP (có trong NH, không có trong ERP)
  - Amount mismatch (có cả 2 nhưng số tiền khác nhau)
```

### Step 3: Root cause analysis

**Câu hỏi cần trả lời:**
```
1. Giao dịch này có trong phiếu chi/thu không?
   → Check phiếu gốc (PDF, chữ ký BGĐ)

2. Có chứng từ gốc không?
   → Invoice, PO, Contract, Receipt

3. Ai approve giao dịch này?
   → Check workflow: Sale → KT TT → BGĐ

4. Timing: Phát sinh khi nào?
   → Nếu cuối tháng → Có thể timing difference

5. Có pattern không?
   → VD: Nhiều phiếu chi nhỏ liên tiếp → Suspicious
```

### Step 4: Escalation (nếu không tìm ra trong 2h)

```
☑ Email KT TH:
  Subject: Bank Reconciliation Discrepancy - Need Help
  Body:
    - Bank: [...]
    - Amount: [...]
    - Checked: [List các bước đã làm]
    - Suspect: [Nguyên nhân nghi ngờ]
    - Need: [Cần hỗ trợ gì]

☑ Nếu > 5 triệu: CC BGĐ

☑ Meeting (nếu cần):
  Participants: KT TT + KT TH + (BGĐ nếu critical)
  Duration: 30 phút
  Outcome: Action plan rõ ràng
```

---

## 4.3. Resolution Actions

### Action 1: Điều chỉnh sổ sách (Book Adjustment)

**Khi nào:**
- Phí NH chưa ghi
- Lãi NH chưa ghi
- Ghi nhầm số tiền
- Ghi thiếu/thừa giao dịch

**Quy trình:**
```
1. Soạn Journal Entry (JE) điều chỉnh
2. Attach: Bank statement screenshot + Explanation note
3. Trình KT TH approve
4. Post vào ERP
5. Re-run reconciliation → Confirm đã khớp
```

### Action 2: Liên hệ ngân hàng (Bank Follow-up)

**Khi nào:**
- NH ghi nhầm
- NH trừ phí không đúng
- NH chưa cộng tiền (quá 2 ngày)

**Quy trình:**
```
1. Gọi hotline NH:
   - Chuẩn bị: Account number, Transaction date, Amount, Reference
   - Yêu cầu: Check transaction, explain discrepancy

2. Email official request (nếu hotline không giải quyết):
   - Subject: Transaction Discrepancy - Account [XXX]
   - Body: Chi tiết giao dịch, yêu cầu điều tra
   - Attach: Chứng từ (phiếu chi, receipt, ...)

3. Follow-up:
   - Ngày 1: Gọi điện
   - Ngày 3: Email reminder
   - Ngày 7: Escalate to branch manager
   - Ngày 14: Official complaint letter from BOD

4. Khi NH confirm sai:
   - Yêu cầu NH điều chỉnh + Refund (nếu bị trừ nhầm)
   - Lấy confirmation letter từ NH
   - Update vào reconciliation
```

### Action 3: Fraud investigation

**Khi nào:**
- Giao dịch lạ, không ai biết
- Số tiền lớn (> 50 triệu)
- Pattern suspicious (nhiều giao dịch nhỏ cùng 1 người nhận)

**⚠️ CRITICAL PROCEDURE:**
```
1. IMMEDIATE (trong 30 phút):
   ☑ Block account tạm thời (gọi NH)
   ☑ Alert BGĐ/COO
   ☑ Preserve evidence: Screenshot, log, email

2. Same day:
   ☑ Họp khẩn: BGĐ + KT + IT
   ☑ Điều tra nội bộ:
     - Ai có quyền approve?
     - Token/OTP ở đâu? (Bị đánh cắp?)
     - Máy tính có malware không?
     - Ai truy cập internet banking gần đây?
   ☑ Thay đổi password, token ngay

3. Within 24h:
   ☑ Báo cáo công an (nếu xác định gian lận)
   ☑ File claim với NH (dispute transaction)
   ☑ Báo cáo Audit Committee (nếu có)

4. Within 1 week:
   ☑ Điều tra forensic (nếu cần)
   ☑ Tăng cường security:
     - 2-factor authentication
     - Maker-Checker cho mọi transaction
     - IP whitelist
   ☑ Review toàn bộ internal control
```

---

# 5. CONTROLS & APPROVALS

## 5.1. Segregation of Duties (Phân tách quyền hạn)

**Nguyên tắc:** Không 1 người nào được:
- ✅ Tạo phiếu chi **VÀ** approve **VÀ** execute (chuyển tiền)

**TBS Implementation:**

| Activity | Person 1 (Maker) | Person 2 (Checker) | Person 3 (Approver) |
|----------|------------------|-------------------|---------------------|
| **Tạo phiếu chi** | Sale | - | - |
| **Kiểm tra phiếu** | - | KT Thanh toán | - |
| **Approve phiếu** | - | - | BGĐ |
| **Execute (chuyển tiền)** | - | KT Thanh toán (login NH) | BGĐ (OTP/Token) |
| **Đối chiếu NH** | - | KT Thanh toán (daily) | KT Tổng hợp (monthly) |

**Lợi ích:**
- ✅ Gian lận cần 3 người thông đồng → Rất khó
- ✅ Sai sót được phát hiện qua 2 lớp kiểm tra

---

## 5.2. Dual Control for Banking

**Internet Banking Access:**

```
TBS Policy: Dual authentication (Maker-Checker)

Maker (KT Thanh toán):
  - Login internet banking
  - Nhập thông tin giao dịch
  - Submit → Status: "Pending approval"

Checker (BGĐ):
  - Login internet banking (account riêng)
  - Review transaction
  - Xác nhận: OTP (gửi về điện thoại BGĐ)
  - Approve → Transaction executed

Lợi ích:
  ✅ KT TT không thể tự ý chuyển tiền (cần BGĐ OTP)
  ✅ BGĐ review trước khi approve (double check)
  ✅ Log đầy đủ: Ai tạo, ai approve, khi nào
```

**Token/OTP Management:**
```
☑ Token vật lý (hardware token): Chỉ BGĐ giữ
☑ OTP gửi điện thoại: Chỉ điện thoại BGĐ
☑ KHÔNG chia sẻ OTP qua email/Zalo
☑ Thay đổi password 3 tháng/lần
☑ Logout sau mỗi session
```

---

## 5.3. Monthly Sign-off Requirement

**Bank Reconciliation Statement CẦN:**
- ✅ Chữ ký KT Tổng hợp (Người lập)
- ✅ Chữ ký KT Thanh toán (Người kiểm tra)
- ✅ Chữ ký BGĐ (Người phê duyệt)

**BGĐ KHÔNG ký nếu:**
- ❌ Có chênh lệch > 1 triệu chưa giải thích
- ❌ Thiếu chứng từ
- ❌ Có red flag (suspicious transaction)

**Action nếu BGĐ không ký:**
- KT TH điều tra thêm
- Soạn lại reconciliation statement
- Trình lại sau khi fix xong

---

# 6. TEMPLATES & CHECKLISTS

## 6.1. Daily Reconciliation Log Template

| Date | Bank | Book Balance | Bank Balance | Difference | Reason | Status | Checked by |
|------|------|--------------|--------------|------------|--------|--------|------------|
| 08/02 | VCB-VND | 260,000,000 | 255,000,000 | 5,000,000 | Chi phiếu #PC123 chưa về | ✅ OK | Nguyen A |
| 08/02 | VCB-USD | $50,000 | $50,000 | $0 | - | ✅ OK | Nguyen A |
| 09/02 | VCB-VND | 265,000,000 | 265,000,000 | 0 | - | ✅ OK | Nguyen A |

---

## 6.2. Monthly Reconciliation Checklist

```
☑ PREPARATION (Ngày 1)
  ☑ Download bank statement (full month)
  ☑ Export ERP data (full month)
  ☑ Check: Số dư đầu tháng khớp với tháng trước không?

☑ RECONCILIATION (Ngày 2)
  ☑ Line-by-line comparison
  ☑ Identify timing differences
  ☑ Identify errors (phí NH, sai số, ...)
  ☑ Điều chỉnh sổ sách (nếu cần)
  ☑ Soạn Reconciliation Statement
  ☑ Calculate: Book balance vs Bank balance (adjusted)

☑ REVIEW (Ngày 3)
  ☑ Self-review: Double check calculation
  ☑ Peer review: KT TT review
  ☑ Attach: Bank statement + Supporting docs
  ☑ Trình BGĐ

☑ APPROVAL (Ngày 3-5)
  ☑ BGĐ review
  ☑ BGĐ ký duyệt
  ☑ Lưu trữ: Scan + Archive
```

---

## 6.3. Red Flags Checklist

**⚠️ Các dấu hiệu cần cảnh giác (Report ngay BGĐ):**

```
☑ Giao dịch lạ:
  ☑ Người nhận không quen (không phải NCC thường xuyên)
  ☑ Số tiền tròn lớn (VD: 100tr, 200tr - không phải số lẻ)
  ☑ Mô tả không rõ ràng (VD: "Thanh toán", không ghi chi tiết)
  ☑ Tạo ngoài giờ hành chính (sau 18h, cuối tuần)

☑ Pattern suspicious:
  ☑ Nhiều giao dịch nhỏ liên tiếp (< 50tr, dưới threshold cần KT TH approve)
  ☑ Chi tiền cùng 1 người nhận nhiều lần trong ngày
  ☑ Giao dịch ngay trước/sau kỳ đóng sổ (window dressing)

☑ Chênh lệch lớn:
  ☑ Chênh > 10 triệu không giải thích được
  ☑ Chênh lệch âm (Book balance < Bank balance) - Nguy hiểm hơn
  ☑ Chênh lệch tăng dần qua các tháng (cumulative error)

☑ Khác:
  ☑ NH statement thiếu trang
  ☑ NH statement bị chỉnh sửa (watermark, font khác nhau)
  ☑ Không thể download statement (bị block account)
```

---

## 6.4. Escalation Matrix

| Issue | Severity | Action | Timeline | Escalate to |
|-------|----------|--------|----------|-------------|
| Chênh lệch < 100K | Low | Note, monitor | EOD | - |
| Chênh lệch 100K-1M | Medium | Investigate & fix | Within 1 day | KT TH |
| Chênh lệch 1M-5M | High | Alert, investigate | Within 2 hours | KT TH + BGĐ |
| Chênh lệch > 5M | Critical | URGENT meeting | Within 30 min | BGĐ + COO |
| Suspicious transaction | Critical | Block account, investigate | Immediately | BGĐ + Police |
| Bank statement missing | High | Contact bank | Within 4 hours | NH + KT TH |

---

## 6.5. Document Retention

**Lưu trữ Bank Reconciliation:**

```
☑ Physical (Giấy):
  - Reconciliation Statement (đã ký)
  - Bank statement gốc (từ NH)
  - Lưu trong: File "Đối chiếu NH [YYYY]"
  - Thời gian: 10 năm

☑ Digital (Điện tử):
  - Excel files (Bank + ERP export)
  - PDF scan (Reconciliation statement)
  - Lưu trong: \\shared\Accounting\Bank\[YYYY]\[MM]
  - Backup: Cloud (Google Drive) + External HDD
  - Thời gian: Vĩnh viễn (hoặc 10 năm)

☑ Naming convention:
  [YYYY-MM]_Reconciliation_[Bank]_[Currency].xlsx
  VD: 2026-02_Reconciliation_VCB_VND.xlsx
```

---

# APPENDIX A: EXAMPLE SCENARIOS

## Example 1: Perfect Match

```
Date: 08/02/2026
Bank: Vietcombank VND

Book Balance: 500,000,000
Bank Balance: 500,000,000
Difference: 0

→ Result: ✅ PERFECT - No action needed
```

---

## Example 2: Timing Difference (Chi phiếu chưa về)

```
Date: 28/02/2026 (Cuối tháng)
Bank: Vietcombank VND

Book Balance: 800,000,000
Bank Balance: 785,000,000
Difference: 15,000,000

Investigation:
- Chi phiếu #PC145 (27/02): 10,000,000 → NH chưa trừ
- Chi phiếu #PC150 (28/02): 5,000,000 → NH chưa trừ

Adjusted:
Bank Balance: 785,000,000
(+) Outstanding checks: 15,000,000
→ Adjusted: 800,000,000 ✅ MATCH

Action: Monitor ngày 01/03, confirm đã trừ
```

---

## Example 3: Bank Fee (Cần điều chỉnh sổ sách)

```
Date: 15/02/2026
Bank: Vietcombank USD

Book Balance: $50,000 (× 25,000 = 1,250,000,000)
Bank Balance: $49,995 (× 25,000 = 1,249,875,000)
Difference: 125,000 VND ($5)

Investigation:
- NH statement: Bank fee $5 (swift transfer fee)
- ERP: Chưa ghi nhận

Book Adjustment:
Nợ: TK 635 - Chi phí TC (125,000)
Có: TK 112 - USD (125,000)

After adjustment:
Book Balance: 1,249,875,000 ✅ MATCH
```

---

## Example 4: Error (Ghi nhầm số tiền)

```
Date: 10/02/2026
Bank: Techcombank VND

Book Balance: 300,000,000
Bank Balance: 310,000,000
Difference: -10,000,000 (Book < Bank) 🚨

Investigation:
- Chi phiếu #PC100: Mua hàng NCC A
- Bank: Trừ 20,000,000
- ERP: Ghi 30,000,000 (ghi nhầm nhiều 10tr)

Root cause: KT TT nhập nhầm (typo: 30 thay vì 20)

Book Adjustment (Reverse excess):
Nợ: TK 112 (10,000,000) - Cộng lại tiền
Có: TK 156 (10,000,000) - Giảm giá vốn (đã ghi nhầm nhiều)

After adjustment:
Book Balance: 310,000,000 ✅ MATCH

Lesson learned: Double check số tiền trước khi post
```

---

# APPENDIX B: APPROVAL & SIGN-OFF

**Soạn thảo:**
- Họ tên: _________________________
- Chức vụ: Kế toán tổng hợp
- Ngày: __/__/2026
- Chữ ký: _________________________

**Phê duyệt:**
- Họ tên: _________________________
- Chức vụ: Giám đốc điều hành (COO/CEO)
- Ngày: __/__/2026
- Chữ ký: _________________________

---

**END OF DOCUMENT**
