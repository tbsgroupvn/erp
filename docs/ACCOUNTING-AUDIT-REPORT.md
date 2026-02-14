# BÁO CÁO AUDIT KẾ TOÁN - TBS ERP ORDER MANAGEMENT SYSTEM

**Người thực hiện:** Kế toán trưởng / Senior Accountant
**Ngày báo cáo:** 2026-02-09
**Tài liệu review:** TBS Order Lifecycle Specification v3.2 + Operations Guide
**Phạm vi:** Nghiệp vụ Sale & Kế toán, quy trình phê duyệt, kiểm soát nội bộ

---

## EXECUTIVE SUMMARY (TÓM TẮT ĐIỀU HÀNH)

### Đánh giá tổng quan: **🟡 CẦN CẢI THIỆN (ACCEPTABLE WITH IMPROVEMENTS)**

| Tiêu chí | Đánh giá | Điểm |
|----------|----------|------|
| **Phân quyền & Kiểm soát nội bộ** | 🟢 Tốt | 8/10 |
| **Quy trình phê duyệt** | 🟢 Tốt | 8.5/10 |
| **Chống gian lận phiếu chi** | 🟢 Tốt | 8/10 |
| **Tuân thủ pháp luật VN** | 🟡 Cần bổ sung | 6/10 |
| **Hạch toán & Báo cáo tài chính** | 🟡 Chưa rõ ràng | 5.5/10 |
| **Quản lý công nợ** | 🟢 Khá tốt | 7/10 |
| **Audit trail & Truy xuất** | 🟢 Tốt | 8/10 |
| **Quản lý rủi ro tài chính** | 🟡 Cần tăng cường | 6.5/10 |

**Tổng điểm:** **7.1/10** — **Khá tốt nhưng CẦN CẢI THIỆN TRƯỚC KHI TRIỂN KHAI**

### Kết luận chính:

✅ **ĐIỂM MẠNH:**
- Phân quyền rõ ràng (3 cấp KD, kiểm soát chặt chẽ)
- Flow phê duyệt hợp lý (đồng duyệt Leader + KT TT, không skip cấp)
- Anti-fraud controls tốt (FLAG phiếu chi bất thường, audit trail đầy đủ)
- SLA rõ ràng, có cơ chế nhắc nhở

🔴 **CRITICAL ISSUES (Cần fix NGAY):**
1. **THIẾU định khoản kế toán chuẩn** cho từng loại giao dịch → Risk báo cáo tài chính sai
2. **THIẾU quy trình đối chiếu ngân hàng** → Risk tiền mất, gian lận thanh toán
3. **THIẾU kiểm soát tỷ giá hối đoái** → Risk lỗ lớn do CNY/USD biến động
4. **CHƯA rõ xử lý thuế GTGT đầu vào** → Risk bị HQ/Thuế phạt

🟡 **MEDIUM ISSUES (Nên cải thiện):**
1. Chưa có quy định rõ về trích lập dự phòng nợ xấu (theo chuẩn mực VN)
2. Chưa có quy trình kiểm kê hàng tồn kho định kỳ
3. Chưa rõ xử lý chênh lệch tỷ giá cuối kỳ
4. Chưa có cơ chế kiểm soát chi phí phát sinh ngoài dự kiến

---

## PHẦN 1: ĐIỂM MẠNH (STRENGTHS)

### 1.1. Phân quyền & Kiểm soát nội bộ ✅

**Đánh giá: Xuất sắc (8/10)**

```
Điểm tốt:
✅ Phân quyền 3 cấp rõ ràng: Sale → Leader → GĐ KD → BGĐ
✅ Data isolation chặt chẽ: Sale chỉ thấy đơn mình, Leader thấy nhóm, GĐ KD thấy tất cả
✅ Separation of Duties: Sale tạo phiếu, KT duyệt, BGĐ chi tiền (3 người khác nhau)
✅ Không cho phép Sale xóa/edit phiếu sau khi submit (immutable audit trail)
✅ BGĐ phải chi tiền (không tự động) → Kiểm soát cash flow
```

**Phân tích chi tiết:**

| Nguyên tắc kiểm soát | Đáp ứng? | Ghi chú |
|----------------------|----------|---------|
| Separation of Duties | ✅ Có | Sale tạo, KT duyệt, BGĐ chi |
| Authorization | ✅ Có | 4 cấp phê duyệt rõ ràng |
| Documentation | ✅ Có | Bắt buộc chứng từ ≥ 1 file |
| Independent Verification | ✅ Có | KT TT verify trước khi chi |
| Physical Safeguards | ⚠️ Chưa rõ | Kho VN có camera? Seal? |
| Accounting Records | ⚠️ Chưa rõ | Sổ sách kế toán chưa định nghĩa |

**Recommendation:**
- Bổ sung quy định về physical safeguards (camera kho, seal container, kiểm kê định kỳ)

---

### 1.2. Quy trình phê duyệt giảm giá ✅

**Đánh giá: Rất tốt (8.5/10)**

```
Điểm mạnh:
✅ 4 cấp duyệt rõ ràng: 0% / ≤3% / >3% / >5% hoặc >100tr
✅ Đồng duyệt Leader + KT TT (2 góc nhìn: kinh doanh + tài chính)
✅ Hệ thống enforce không skip cấp
✅ Lý do giảm giá bắt buộc nhập
✅ SLA duyệt rõ ràng (2h cho Leader/KT TT, 4h cho GĐ KD)
```

**So sánh với Best Practice:**

| Best Practice | TBS thực hiện | Đánh giá |
|---------------|---------------|----------|
| Dual approval cho discount lớn | ✅ Leader + KT TT đồng duyệt | Tốt |
| Tối đa 4 cấp duyệt | ✅ Có (0% → ≤3% → >3% → >5%/100tr) | Hợp lý |
| Ghi rõ lý do | ✅ Bắt buộc | Tốt |
| SLA rõ ràng | ✅ 2h / 4h / 8h | Tốt |
| Alert khi quá SLA | ✅ Có | Tốt |
| Dashboard approval pending | ⚠️ Chưa rõ implementation | Cần verify |

**Lưu ý kế toán:**
- ✅ KT TT đồng duyệt giảm giá giúp bảo vệ LN → Ngăn Sale "bán phá giá"
- ✅ Giảm giá > 5% cần BGĐ → Đúng best practice (giảm quá nhiều = risk lỗ)

---

### 1.3. Anti-Fraud Controls (Chống gian lận phiếu chi) ✅

**Đánh giá: Tốt (8/10)**

```
Điểm mạnh:
✅ Bắt buộc 6 field: Mã đơn, Loại CP, Người thụ hưởng, Lý do ≥20 ký tự, Chứng từ, Owner
✅ BLOCK tự động nếu thiếu field → Không cho submit
✅ FLAG phiếu bất thường (chi >90% DT, phát sinh >5tr, NCC không approved, ngoài giờ HC)
✅ Audit trail đầy đủ: Log mọi thao tác, không xóa, BGĐ/KT TH query bất cứ lúc nào
✅ Leader + KT TT nhận alert khi có FLAG → Review ngay
```

**Phân tích Risk Mitigation:**

| Risk | Control | Effectiveness |
|------|---------|---------------|
| **Sale tạo phiếu chi ảo** | Bắt buộc mã đơn hàng + chứng từ | 🟢 High |
| **Chi phí "phát sinh" lớn không rõ ràng** | FLAG nếu >5tr + review | 🟢 High |
| **Chi tiền cho NCC giả** | NCC approved list + verify | 🟡 Medium (cần bổ sung: Verify bank account) |
| **Chi nhiều lần cho cùng 1 hóa đơn** | ⚠️ CHƯA CÓ CONTROL | 🔴 Low → **CẦN BỔ SUNG** |
| **Tạo phiếu ngoài giờ (tránh review)** | FLAG + alert | 🟢 High |
| **Pattern chi nhỏ liên tiếp (dưới threshold)** | FLAG pattern detection | 🟢 High |

**CRITICAL FINDING #1:**
> ⚠️ **CHƯA CÓ CONTROL CHỐNG CHI TRÙNG HÓA ĐƠN**
>
> **Risk:** Sale tạo 2 phiếu chi khác nhau cho cùng 1 invoice NCC
>
> **Scenario:**
> - Invoice NCC #INV123: 10,000 CNY
> - Sale tạo phiếu chi #1: "Mua hàng NCC A" - 10,000 CNY
> - 1 tuần sau, Sale tạo phiếu chi #2: "Chi phí phát sinh NCC A" - 10,000 CNY
> - Cùng invoice INV123, chi 2 lần = embezzlement 10,000 CNY
>
> **Fix:** Hệ thống cần:
> 1. Field bắt buộc: Invoice number
> 2. Unique constraint: Không cho phép 2 phiếu chi cùng invoice number
> 3. OCR invoice number từ file upload (nếu có)

---

### 1.4. Quản lý công nợ ✅

**Đánh giá: Khá tốt (7/10)**

```
Điểm mạnh:
✅ Timeline xử lý CN rõ ràng: T+0 → T+3 → T+7 → T+15 → T+30 → T+60
✅ Escalation tự động: T+15 → Leader, T+30 → GĐ KD, T+60 → BGĐ
✅ BLOCK khách tự động khi CN quá hạn (không nhận đơn mới)
✅ KPI Sale/Leader bị ảnh hưởng bởi CN → Động lực thu hồi
✅ Alert đầy đủ: T-3 (sắp hạn), T+0 (quá hạn), T+15, T+30
```

**Phân tích Aging Report:**

| Khoảng thời gian | Action | Responsible | Đánh giá |
|------------------|--------|-------------|----------|
| T-3 (Sắp hạn) | Alert Sale + Leader | KT TT | ✅ Tốt (proactive) |
| T+0 (Đúng hạn) | Sale gọi nhắc nhẹ | Sale | ✅ Tốt |
| T+3 | Sale gọi + Zalo, đề xuất gia hạn | Sale | ✅ Hợp lý |
| T+7 | Email chính thức + BLOCK khách | Sale + KT TT | ✅ Tốt |
| T+15 | Leader gọi, cảnh báo pháp lý | Leader | ✅ Tốt |
| T+30 | GĐ KD đàm phán, cut loss 20-30%? | GĐ KD | ✅ Hợp lý |
| T+60 | BGĐ quyết định: Kiện/xóa nợ | BGĐ | ✅ Hợp lý |

**FINDING #2 (Medium):**
> ⚠️ **CHƯA RÕ TRÍCH LẬP DỰ PHÒNG NỢ XẤU**
>
> Theo **Thông tư 200/2014/TT-BTC** và **Thông tư 48/2019/TT-BTC**:
> - Nợ quá hạn 90 ngày: Trích lập 30%
> - Nợ quá hạn 180 ngày: Trích lập 50%
> - Nợ quá hạn 360 ngày: Trích lập 100%
>
> **Tài liệu hiện tại:**
> - Chỉ nói "trích lập dự phòng 100% sau 60 ngày" (trong J5)
> - CHƯA ĐÚNG chuẩn mực VN
>
> **Fix:**
> 1. Tuân thủ Thông tư 200/48: 90 ngày (30%), 180 ngày (50%), 360 ngày (100%)
> 2. KT TH tự động tính dự phòng hàng tháng
> 3. Báo cáo: Aging Report chi tiết theo bucket

---

## PHẦN 2: CRITICAL ISSUES (Vấn đề nghiêm trọng - CẦN FIX NGAY)

### 🔴 ISSUE #1: THIẾU ĐỊNH KHOẢN KẾ TOÁN CHUẨN

**Độ nghiêm trọng:** CRITICAL
**Impact:** Báo cáo tài chính sai, audit khó khăn, rủi ro thuế

**Hiện trạng:**
- Tài liệu mô tả quy trình nghiệp vụ chi tiết
- NHƯNG không định nghĩa:
  - Tài khoản kế toán nào được sử dụng?
  - Định khoản từng loại giao dịch như thế nào?
  - Sổ sách nào được ghi nhận?

**Ví dụ thiếu:**

```
GĐ 3: KHÁCH CỌC
- Tài liệu: "KT TT duyệt phiếu thu cọc"
- NHƯNG: Định khoản thế nào?

  Option 1 (Đúng):
    Nợ: 1121 - Tiền mặt / 1122 - Tiền gửi NH (XXX)
    Có: 3387 - Nhận cọc của khách hàng (XXX)

  Option 2 (SAI - nếu ghi nhận doanh thu sớm):
    Nợ: 1121 / 1122 (XXX)
    Có: 5111 - Doanh thu (XXX) ❌ SAI vì chưa giao hàng

- Risk: Nếu không define, mỗi kế toán làm khác nhau → Rối
```

**Ví dụ phức tạp hơn:**

```
GĐ 4: MUA HÀNG TỪ NCC TRUNG QUỐC
- Chi tiền mua hàng: 10,000 CNY = 35,000,000 VND (tỷ giá 3,500)
- Hàng chưa về (FOB, ownership chưa chuyển)
- Định khoản?

  Option A: Ghi nhận hàng về đường
    Nợ: 1561 - Hàng mua đang đi đường (35,000,000)
    Có: 1122 - Tiền gửi NH (35,000,000)

  Option B: Ghi nhận tạm ứng
    Nợ: 1411 - Tạm ứng (35,000,000)
    Có: 1122 - Tiền gửi NH (35,000,000)

  → CẦN CHÍNH SÁCH RÕ RÀNG: Dùng Option nào? (Best practice: Option A)
```

**Các giao dịch CẦN định khoản:**

| Giao dịch | Hiện trạng | Cần bổ sung |
|-----------|-----------|-------------|
| Khách cọc | ⚠️ Chưa rõ | TK 1121/1122 ↔ TK 3387 |
| Chi mua hàng NCC TQ | ⚠️ Chưa rõ | TK 1561 (Hàng đường) ↔ TK 1122 |
| Chi phí vận chuyển | ⚠️ Chưa rõ | TK 1561 (tăng giá vốn) hoặc TK 642 |
| Chi phí thông quan (thuế NK) | ⚠️ Chưa rõ | TK 1561 (thuế NK vào giá vốn) |
| Thuế GTGT đầu vào | 🔴 **CHƯA NHẮC ĐẾN** | TK 133 (nếu được khấu trừ) |
| Nhập kho VN | ⚠️ Chưa rõ | TK 156 (thành phẩm) ↔ TK 1561 |
| Xuất kho giao khách | ⚠️ Chưa rõ | TK 632 (giá vốn) ↔ TK 156 |
| Ghi nhận doanh thu | ⚠️ Chưa rõ | TK 131/1121 ↔ TK 5111 + TK 3331 (VAT) |
| Chênh lệch tỷ giá | 🔴 **CHƯA NHẮC ĐẾN** | TK 413 / 515 |
| Hoa hồng Sale | ⚠️ Chưa rõ | TK 334/338 (trích trước) + TK 642 (ghi nhận CP) |

**RECOMMENDATION #1 (CRITICAL):**

> **CẦN BỔ SUNG NGAY: PHẦN E - KẾ TOÁN POLICIES**
>
> Bao gồm:
> 1. **Biểu đồ tài khoản (Chart of Accounts):**
>    - Danh sách tất cả TK sử dụng (theo Thông tư 200/2014)
>    - Định nghĩa từng TK
>
> 2. **Định khoản chuẩn (Standard Journal Entries):**
>    - Template định khoản cho 20-30 giao dịch thường gặp
>    - Ví dụ cụ thể với số liệu
>
> 3. **Revenue Recognition Policy:**
>    - Ghi nhận doanh thu KHI NÀO? (Khi giao hàng? Khi khách ký POD? Khi thu tiền?)
>    - Theo VAS 14: Ghi nhận khi giao hàng + chuyển quyền sở hữu + thu tiền có khả năng
>
> 4. **Inventory Valuation:**
>    - Giá vốn tính theo phương pháp nào? (FIFO / Bình quân gia quyền / Đích danh)
>    - TBS nên dùng: **Đích danh** (vì mỗi đơn hàng khác nhau, track riêng)
>
> 5. **Foreign Exchange Policy:**
>    - Tỷ giá áp dụng: Tỷ giá ngày giao dịch? Tỷ giá cuối tháng?
>    - Xử lý chênh lệch tỷ giá: Đánh giá lại cuối kỳ? (TK 413/515)

---

### 🔴 ISSUE #2: THIẾU QUY TRÌNH ĐỐI CHIẾU NGÂN HÀNG

**Độ nghiêm trọng:** CRITICAL
**Impact:** Risk tiền mất, gian lận thanh toán, không phát hiện sai sót

**Hiện trạng:**
- Tài liệu nói "BGĐ chi tiền", "KT TT duyệt phiếu chi"
- NHƯNG: KHÔNG NÓI đối chiếu ngân hàng
- Risk: Phiếu chi trên hệ thống ≠ Sao kê NH thực tế

**Scenario Risk:**

```
Ngày 5/2: KT TT duyệt phiếu chi #PC001 - Chi NCC A: 100 triệu
Ngày 6/2: BGĐ approve
Ngày 7/2: BGĐ chuyển khoản... NHƯNG nhầm số tài khoản → Tiền vào sai người
Ngày 8/2: NCC A chưa nhận được tiền, gọi hỏi
Ngày 9/2: Phát hiện chuyển nhầm → Phải liên hệ NH thu hồi (phức tạp, mất phí, mất thời gian)

→ Nếu CÓ đối chiếu NH hàng ngày: Phát hiện ngay ngày 7/2, xử lý nhanh
```

**Best Practice bị thiếu:**

| Hoạt động | Tần suất | TBS hiện tại | Cần bổ sung |
|-----------|----------|--------------|-------------|
| Đối chiếu NH hàng ngày | Mỗi ngày | ❌ Chưa có | ✅ KT TT làm |
| Review giao dịch bất thường | Mỗi ngày | ❌ Chưa có | ✅ KT TT flag |
| Reconcile cuối tháng | Cuối tháng | ❌ Chưa có | ✅ KT TH làm |
| Sign off từ BGĐ | Cuối tháng | ❌ Chưa có | ✅ BGĐ ký |

**RECOMMENDATION #2 (CRITICAL):**

> **BỔ SUNG: QUY TRÌNH ĐỐI CHIẾU NGÂN HÀNG**
>
> **1. Đối chiếu hàng ngày (KT TT):**
> ```
> Sáng mỗi ngày (trước 10h):
> ☑ Download sao kê NH từ internet banking
> ☑ So sánh với sổ quỹ/sổ ngân hàng trên hệ thống
> ☑ Check:
>    - Số dư đầu ngày khớp không?
>    - Mọi giao dịch đều match không?
>    - Có giao dịch lạ không?
> ☑ Ghi chú các khoản chênh lệch chưa xác định được
> ☑ Report cho KT TH nếu có vấn đề
> ```
>
> **2. Reconcile cuối tháng (KT TH):**
> ```
> Trong 3 ngày đầu tháng sau:
> ☑ Tổng hợp tất cả chênh lệch trong tháng
> ☑ Phân loại:
>    - Timing difference (chi phiếu ngày 30, NH trừ tiền ngày 1 → OK)
>    - Real difference (phiếu 100tr, NH trừ 105tr phí → Cần điều chỉnh)
> ☑ Điều chỉnh sổ sách (nếu cần)
> ☑ Soạn Bank Reconciliation Statement
> ☑ Trình BGĐ ký duyệt
> ```
>
> **3. Hệ thống hỗ trợ:**
> - Tích hợp API ngân hàng (auto download sao kê)
> - Auto-match transactions (ML-based)
> - Alert nếu chênh lệch > threshold (VD: >5 triệu)

---

### 🔴 ISSUE #3: THIẾU KIỂM SOÁT TỶ GIÁ HỐI ĐOÁI

**Độ nghiêm trọng:** CRITICAL
**Impact:** Risk lỗ lớn do CNY/USD biến động, không kiểm soát được

**Hiện trạng:**
- Tài liệu nói "KT TH đổi tệ CNY/USD"
- NHƯNG: Không nói rõ:
  - Tỷ giá lấy từ đâu? (NH? Vietcombank? Cố định?)
  - Update tần suất nào? (Real-time? Ngày? Tuần?)
  - Ai approve tỷ giá? (Tự động? KT TH? BGĐ?)
  - Xử lý chênh lệch tỷ giá thế nào?

**Risk Scenario:**

```
Case 1: Báo giá dựa trên tỷ giá cũ
- Ngày 1/2: Sale báo giá khách, dùng tỷ giá CNY = 3,500 VND
- Ngày 10/2: Khách chốt, cọc
- Ngày 20/2: Mua hàng NCC, tỷ giá thực tế CNY = 3,700 VND (+5.7%)
- Giá vốn tăng 5.7%, LN giảm → Có thể lỗ nếu LN mỏng

Case 2: Không đánh giá lại cuối kỳ
- Cuối tháng: Còn công nợ phải thu USD/CNY, nhưng không revalue
- Tỷ giá tăng → Lãi → KHÔNG ghi nhận (thiếu doanh thu)
- Tỷ giá giảm → Lỗ → KHÔNG trích lập (thiếu chi phí)
- → Báo cáo tài chính SAI

Case 3: Không hedge (phòng ngừa)
- Đơn lớn 500,000 CNY (1.75 tỷ VND)
- Thời gian từ báo giá → nhập kho: 45 ngày
- CNY tăng 3% = Lỗ 52 triệu VND
- KHÔNG có chiến lược hedge → Chịu 100% risk
```

**Best Practice bị thiếu:**

| Hoạt động | Best Practice | TBS hiện tại | Gap |
|-----------|---------------|--------------|-----|
| Tỷ giá tham khảo | Vietcombank mua/bán | ❌ Chưa rõ | ✅ Cần define |
| Update tỷ giá | Mỗi ngày (9h sáng) | ❌ Chưa rõ | ✅ Cần auto |
| Margin FX buffer | +2-3% vào báo giá | ⚠️ Chưa nhắc | ✅ Nên có |
| Revalue cuối kỳ | Theo VAS 10 | ❌ Chưa có | ✅ Bắt buộc |
| FX hedge (đơn lớn) | Forward contract | ❌ Chưa có | 🟡 Nên có |

**RECOMMENDATION #3 (CRITICAL):**

> **BỔ SUNG: FOREIGN EXCHANGE POLICY**
>
> **1. Nguồn tỷ giá:**
> - Tỷ giá tham khảo: **Vietcombank** (bảng giá mua/bán ngoại tệ chính thức)
> - Update: **Mỗi ngày 9h sáng** (auto fetch từ API Vietcombank hoặc nhập tay)
> - Hệ thống lưu lịch sử tỷ giá (để audit, truy xuất)
>
> **2. Áp dụng tỷ giá:**
> - **Báo giá:** Tỷ giá ngày báo giá + buffer 2-3%
>   - VD: Tỷ giá hôm nay 3,500 → Báo giá dùng 3,600 (bảo hiểm)
> - **Mua hàng:** Tỷ giá ngày chuyển tiền thực tế
> - **Hạch toán:** Tỷ giá ngày phát sinh giao dịch
> - **Cuối kỳ:** Tỷ giá Vietcombank ngày cuối cùng của kỳ (revalue)
>
> **3. Xử lý chênh lệch tỷ giá:**
> ```
> Định khoản:
> - Lãi tỷ giá:
>   Nợ: TK 1122/131 (Tăng giá trị tài sản ngoại tệ)
>   Có: TK 515 - Doanh thu hoạt động tài chính (Lãi)
>
> - Lỗ tỷ giá:
>   Nợ: TK 635 - Chi phí tài chính (Lỗ)
>   Có: TK 1122/331 (Giảm giá trị nợ ngoại tệ)
> ```
>
> **4. Hedging strategy (đơn lớn):**
> - Đơn > 100 triệu VND, thời gian > 30 ngày:
>   - Option 1: Mua forward contract từ NH (lock tỷ giá)
>   - Option 2: Mua CNY/USD trước, giữ (nếu có tiền nhàn rỗi)
>   - Option 3: Clause với khách: "Giá cuối cùng điều chỉnh theo tỷ giá thực tế"
>
> **5. Dashboard FX Risk:**
> - KT TH monitoring:
>   - Tổng exposure CNY/USD (bao nhiêu tiền đang risk tỷ giá)
>   - Đơn lớn, thời gian dài → Alert
>   - Tỷ giá biến động >2% trong 1 tuần → Alert GĐ KD + BGĐ

---

### 🔴 ISSUE #4: CHƯA RÕ XỬ LÝ THUẾ GTGT ĐẦU VÀO

**Độ nghiêm trọng:** CRITICAL
**Impact:** Risk bị HQ/Cơ quan thuế phạt, không khấu trừ được thuế

**Hiện trạng:**
- Tài liệu nói "KT TT xuất HĐ GTGT" (thuế đầu ra)
- NHƯNG: **CHƯA NÓI** về thuế GTGT đầu vào khi nhập khẩu
- Risk: Không khai đúng → Mất quyền khấu trừ

**Background (Luật thuế VN):**

Khi nhập khẩu hàng hóa:
1. **Thuế NK (Import Duty):** 0-30% tùy HS code, tính trên CIF
2. **Thuế GTGT (VAT):** 0-10% tùy loại hàng, tính trên (CIF + Thuế NK)
3. Thuế GTGT này là **thuế đầu vào**, được **khấu trừ** với thuế đầu ra

**Công thức:**
```
Giá CIF:                  10,000 USD = 250,000,000 VND
Thuế NK (10%):            1,000 USD = 25,000,000 VND
→ Giá tính thuế GTGT:     11,000 USD = 275,000,000 VND
Thuế GTGT đầu vào (10%):  1,100 USD = 27,500,000 VND

Định khoản:
  Nợ: TK 1561 - Hàng mua đang đi đường (250,000,000)
  Nợ: TK 1561 - Thuế NK (vào giá vốn) (25,000,000)
  Nợ: TK 133 - Thuế GTGT đầu vào (27,500,000) ← QUAN TRỌNG
  Có: TK 1122 - Tiền gửi NH (302,500,000)
```

**Tại sao quan trọng?**
- Nếu KHÔNG ghi nhận TK 133 → Mất 27.5 triệu khấu trừ
- Khi bán hàng:
  ```
  Doanh thu: 400 triệu
  Thuế GTGT đầu ra (10%): 40 triệu
  Thuế GTGT đầu vào: 27.5 triệu
  → Thuế phải nộp: 40 - 27.5 = 12.5 triệu

  Nếu thiếu ghi nhận đầu vào → Nộp 40 triệu (thay vì 12.5 triệu)
  → Lỗ 27.5 triệu
  ```

**RECOMMENDATION #4 (CRITICAL):**

> **BỔ SUNG: THUẾ GTGT POLICY**
>
> **1. Thuế GTGT đầu vào (Input VAT):**
> - Nhập khẩu:
>   - Nộp thuế NK + VAT tại HQ
>   - Ghi nhận: TK 133 - Thuế GTGT đầu vào
>   - Chứng từ: Tờ khai HQ, biên lai nộp thuế
>   - Deadline khai: Trong kỳ kê khai (tháng/quý)
>
> - Mua dịch vụ trong nước (vận tải, kho, ...):
>   - Yêu cầu NCC xuất HĐ GTGT hợp lệ (đủ thông tin, đúng MST)
>   - Ghi nhận: TK 133
>   - Lưu HĐ gốc để khai thuế
>
> **2. Thuế GTGT đầu ra (Output VAT):**
> - Xuất HĐ GTGT cho khách (đúng mẫu, đủ thông tin)
> - Ghi nhận: TK 3331
> - Deadline xuất HĐ: Trong 2 ngày sau giao hàng (theo Nghị định 123/2020)
>
> **3. Khai thuế:**
> - Kỳ khai: Tháng (nếu DT > 50 tỷ/năm) hoặc Quý (nếu DT < 50 tỷ/năm)
> - Công thức: Thuế phải nộp = Thuế đầu ra - Thuế đầu vào
> - Deadline: Ngày 20 tháng sau (khai tháng) hoặc cuối tháng đầu quý sau (khai quý)
> - KT TH chịu trách nhiệm khai đúng hạn
>
> **4. Checklist hàng tháng (KT TH):**
> ```
> Trước ngày 20 hàng tháng:
> ☑ Tổng hợp tất cả HĐ GTGT đầu ra đã xuất
> ☑ Tổng hợp tất cả HĐ GTGT đầu vào hợp lệ
> ☑ Đối chiếu với TK 133, 3331 trên sổ sách
> ☑ Tính thuế phải nộp
> ☑ Soạn tờ khai (form 01/GTGT)
> ☑ Nộp qua e-filing (portal Tổng cục thuế)
> ☑ Nộp tiền thuế qua NH
> ☑ Lưu chứng từ nộp
> ```

---

## PHẦN 3: MEDIUM ISSUES (Nên cải thiện)

### 🟡 ISSUE #5: Chưa có quy trình kiểm kê hàng tồn kho định kỳ

**Độ nghiêm trọng:** MEDIUM
**Impact:** Risk sai lệch giữa sổ sách và thực tế, mất mát hàng hóa

**Hiện trạng:**
- Tài liệu nói "Trưởng kho nhập/xuất kho"
- CHƯA NÓI: Kiểm kê định kỳ (inventory count)

**Best Practice:**
- Kiểm kê **cuối tháng** (đơn giản: đếm, so sánh sổ sách)
- Kiểm kê **cuối năm** (đầy đủ: đếm lại tất cả, có BGĐ/KT chứng kiến)
- Xử lý chênh lệch: Tìm nguyên nhân, điều chỉnh sổ sách

**RECOMMENDATION #5:**

> **BỔ SUNG: QUY TRÌNH KIỂM KÊ HÀNG TỒN KHO**
>
> **1. Kiểm kê định kỳ (cuối tháng):**
> ```
> Ngày 28-30 hàng tháng:
> ☑ Trưởng kho + NV kho đếm hàng thực tế
> ☑ So sánh với sổ sách (Inventory Report từ hệ thống)
> ☑ Ghi nhận chênh lệch (nếu có):
>    - Thừa: Nguyên nhân? (Nhập chưa ghi sổ? Trả hàng chưa ghi?)
>    - Thiếu: Nguyên nhân? (Xuất chưa ghi? Mất mát? Hư hỏng?)
> ☑ Report cho KT TH
> ☑ KT TH điều chỉnh sổ sách (nếu cần)
> ```
>
> **2. Kiểm kê toàn diện (cuối năm):**
> ```
> Ngày 31/12:
> ☑ Dừng hoạt động nhập/xuất kho từ 16h chiều
> ☑ Team kiểm kê (3-5 người): Trưởng kho + NV kho + KT TT + BGĐ (hoặc đại diện)
> ☑ Phân công khu vực, đếm độc lập
> ☑ Cross-check (người khác đếm lại)
> ☑ Ghi biên bản kiểm kê (có chữ ký tất cả thành viên)
> ☑ So sánh với sổ sách
> ☑ Xử lý chênh lệch:
>    - Thiếu < 1% giá trị: Chấp nhận (sai số hợp lý)
>    - Thiếu > 1%: Điều tra, xác định trách nhiệm, bồi thường
>    - Thừa: Điều chỉnh sổ sách
> ☑ KT TH hạch toán điều chỉnh
> ☑ BGĐ ký duyệt biên bản
> ```
>
> **3. Định khoản điều chỉnh (nếu thiếu hàng):**
> ```
> Nợ: TK 632 - Giá vốn hàng bán (Thiếu hàng = tăng giá vốn)
> Hoặc: TK 811 - Chi phí khác (nếu mất do nhân viên)
> Có: TK 156 - Thành phẩm (Giảm tồn kho)
>
> Nếu có NV chịu trách nhiệm:
> Nợ: TK 138 - Phải thu NV (Bồi thường)
> Có: TK 811 (Giảm chi phí)
> ```

---

### 🟡 ISSUE #6: Chưa rõ cơ chế kiểm soát chi phí phát sinh

**Độ nghiêm trọng:** MEDIUM
**Impact:** Chi phí phát sinh lớn ăn mòn LN, khó kiểm soát

**Hiện trạng:**
- Tài liệu có FLAG "Chi phát sinh > 5 triệu"
- NHƯNG: Không có **budget control**
- Risk: Mỗi đơn phát sinh nhiều chi phí nhỏ (mỗi cái 4.9 triệu, không FLAG) → Tổng lớn

**Best Practice:**
- Set **budget** cho mỗi đơn (dựa trên báo giá)
- Monitor: Tổng chi phí thực tế vs budget
- Alert nếu vượt budget >10%

**RECOMMENDATION #6:**

> **BỔ SUNG: BUDGET CONTROL PER ORDER**
>
> **1. Set budget khi tạo đơn:**
> ```
> Khi Sale tạo đơn hàng:
> ☑ Hệ thống tự động tính budget dựa trên báo giá:
>    - Chi phí mua hàng (FOB): XXX
>    - Chi phí vận chuyển (ước tính): YYY
>    - Chi phí thông quan (ước tính): ZZZ
>    - Chi phí khác (buffer 5%): AAA
>    → Tổng budget: XXX + YYY + ZZZ + AAA
>
> ☑ Lưu budget vào đơn hàng (field: estimated_cost)
> ```
>
> **2. Monitor real-time:**
> ```
> Mỗi khi Sale tạo phiếu chi cho đơn DH123:
> ☑ Hệ thống tự động cộng dồn:
>    - Total spent to date: Tổng chi phí đã phát sinh
>    - Budget remaining: Budget - Total spent
>    - % used: (Total spent / Budget) × 100%
>
> ☑ Alert nếu:
>    - % used > 90% → Warning Sale + Leader (màu vàng)
>    - % used > 100% → Urgent alert Sale + Leader + KT TT (màu đỏ)
> ```
>
> **3. Approval nếu vượt budget:**
> ```
> Nếu tổng chi phí vượt budget >10%:
> ☑ Sale phải giải thích lý do (field bắt buộc)
> ☑ Escalate Leader duyệt
> ☑ Nếu vượt >20%: Leader → GĐ KD duyệt
> ☑ KT TT review: LN còn dương không? Nếu âm → Block
> ```
>
> **4. Dashboard (Sale/Leader/GĐ KD):**
> ```
> [ TOP Đơn hàng vượt budget ]
> DH001: 120% budget (vượt 20%) 🔴
> DH005: 105% budget (vượt 5%) 🟡
> DH012: 98% budget (sắp vượt) ⚠️
>
> → Click vào xem chi tiết: Chi phí nào vượt? Tại sao?
> ```

---

### 🟡 ISSUE #7: Chưa có policy về cut-off (đóng sổ cuối kỳ)

**Độ nghiêm trọng:** MEDIUM
**Impact:** Risk ghi nhận doanh thu/chi phí sai kỳ

**Hiện trạng:**
- Tài liệu không nhắc đến cut-off
- Risk: Đơn giao ngày 31/12 nhưng ghi nhận doanh thu ngày 2/1 năm sau → Sai

**Best Practice:**
- Cut-off date: Ngày cuối cùng của kỳ (31/12, 31/3, 30/6, 30/9, 31/12)
- Deadline hoàn tất giao dịch: Trước 23:59 ngày cut-off
- Giao dịch sau cut-off → Ghi nhận kỳ sau

**RECOMMENDATION #7:**

> **BỔ SUNG: CUT-OFF POLICY**
>
> **1. Xác định giao dịch thuộc kỳ nào:**
> ```
> - Doanh thu: Ghi nhận theo ngày giao hàng (POD date)
>   VD: Giao hàng 31/12 23:00 → Doanh thu năm nay
>       Giao hàng 1/1 00:30 → Doanh thu năm sau
>
> - Chi phí: Ghi nhận theo ngày phát sinh thực tế
>   VD: Nộp thuế 31/12 → Chi phí năm nay
>       Nộp thuế 2/1 → Chi phí năm sau
>
> - Hàng tồn kho: Đếm thực tế cuối ngày 31/12
> ```
>
> **2. Quy trình đóng sổ cuối kỳ:**
> ```
> T-5: KT TH thông báo "Sắp đóng sổ, hoàn tất giao dịch"
> T-3: Nhắc lại Sale/Leader: Giao hàng/đối soát kịp deadline
> T-1: Freeze: Không nhận đơn mới (trừ urgent có BGĐ approve)
> T+0 (23:59): Cut-off, đóng sổ
> T+1: Mở lại, giao dịch mới ghi nhận kỳ sau
> T+5: KT TH hoàn tất báo cáo tài chính kỳ vừa rồi
> ```

---

## PHẦN 4: COMPLIANCE CHECK (Tuân thủ pháp luật VN)

### ✅ Đáp ứng tốt:

| Quy định | Yêu cầu | TBS đáp ứng | Ghi chú |
|----------|---------|-------------|---------|
| **Luật Kế toán 2015** | Chứng từ gốc đầy đủ | ✅ Có | Bắt buộc ≥1 file upload |
| **Thông tư 200/2014** | Phân cấp phê duyệt | ✅ Có | 4 cấp rõ ràng |
| **Nghị định 123/2020** | Xuất HĐ trong 2 ngày | ⚠️ Chưa rõ | Cần verify KT TT làm kịp không |
| **Luật Thuế GTGT** | Khai đúng hạn | ⚠️ Chưa rõ | Cần bổ sung quy trình |
| **Thông tư 133/2016** | Chứng từ điện tử hợp lệ | ⚠️ Chưa rõ | File scan có đủ thông tin không? |

### ⚠️ Cần kiểm tra thêm:

1. **Hóa đơn điện tử:**
   - TBS có dùng HĐ điện tử không? (Bắt buộc từ 1/7/2022)
   - Nếu có: Dùng provider nào? (VNPT, Viettel, Misa, FPT, ...)
   - Integrate với hệ thống ERP chưa?

2. **Chữ ký số:**
   - BGĐ có chữ ký số không? (Cần cho HĐ điện tử)
   - KT TH có chữ ký số không? (Cần cho khai thuế online)

3. **Lưu trữ chứng từ:**
   - Lưu trữ bao lâu? (Luật yêu cầu: Tối thiểu 10 năm)
   - Lưu ở đâu? (Cloud? Server? Backup?)
   - Có encrypt không? (GDPR/PDPA compliance)

4. **Báo cáo tài chính:**
   - Chuẩn mực áp dụng: VAS (Vietnamese Accounting Standards)
   - Kiểm toán độc lập: Có hay không? (Bắt buộc nếu doanh nghiệp lớn)

---

## PHẦN 5: RISK ASSESSMENT (Đánh giá rủi ro)

### Rủi ro tài chính (Financial Risks)

| Risk | Likelihood | Impact | Score | Mitigation |
|------|------------|--------|-------|------------|
| **Công nợ khó đòi** | 🟡 Medium | 🔴 High | 🟡 Medium | Timeline T+0→T+60 tốt, cần thêm credit check |
| **Gian lận phiếu chi** | 🟢 Low | 🔴 High | 🟡 Medium | Anti-fraud controls tốt, cần thêm: chống chi trùng invoice |
| **Tỷ giá hối đoái biến động** | 🔴 High | 🔴 High | 🔴 **HIGH** | **CHƯA CÓ hedging, cần bổ sung ngay** |
| **Mất tiền do chuyển nhầm** | 🟡 Medium | 🟡 Medium | 🟡 Medium | Cần đối chiếu NH hàng ngày |
| **Chi phí phát sinh vượt budget** | 🟡 Medium | 🟡 Medium | 🟡 Medium | Cần budget control per order |
| **Báo cáo tài chính sai** | 🟡 Medium | 🔴 High | 🟡 Medium | **CHƯA CÓ định khoản chuẩn, cần bổ sung ngay** |

### Rủi ro tuân thủ (Compliance Risks)

| Risk | Likelihood | Impact | Score | Mitigation |
|------|------------|--------|-------|------------|
| **Khai thuế sai/chậm** | 🟡 Medium | 🔴 High | 🟡 Medium | Cần quy trình thuế GTGT rõ ràng |
| **HĐ GTGT không hợp lệ** | 🟡 Medium | 🟡 Medium | 🟡 Medium | Verify HĐ điện tử, checklist đầy đủ thông tin |
| **Chứng từ thiếu/mất** | 🟢 Low | 🟡 Medium | 🟢 Low | Bắt buộc upload, lưu trữ cloud |
| **Không kiểm toán được** | 🟡 Medium | 🔴 High | 🟡 Medium | Cần audit trail đầy đủ (đã có) |

### Rủi ro vận hành (Operational Risks)

| Risk | Likelihood | Impact | Score | Mitigation |
|------|------------|--------|-------|------------|
| **Hàng tồn sai lệch sổ sách** | 🟡 Medium | 🟡 Medium | 🟡 Medium | Cần kiểm kê định kỳ |
| **KT TT overload, duyệt chậm** | 🟡 Medium | 🟡 Medium | 🟡 Medium | Monitor SLA, tuyển thêm KT nếu cần |
| **Sai sót nhập liệu** | 🟡 Medium | 🟢 Low | 🟢 Low | Validation rules, auto-fill |

---

## PHẦN 6: RECOMMENDATIONS SUMMARY (Tổng hợp đề xuất)

### Priority 1 (CRITICAL - Fix ngay trước khi deploy)

1. ✅ **Bổ sung định khoản kế toán chuẩn** (Issue #1)
   - Timeline: 1 tuần
   - Owner: KT TH + Dev team
   - Deliverable: Document "Accounting Policies" + Chart of Accounts

2. ✅ **Bổ sung quy trình đối chiếu ngân hàng** (Issue #2)
   - Timeline: 3 ngày
   - Owner: KT TT + Dev team
   - Deliverable: Daily reconciliation SOP + Bank integration (if possible)

3. ✅ **Bổ sung Foreign Exchange Policy** (Issue #3)
   - Timeline: 1 tuần
   - Owner: KT TH + GĐ KD
   - Deliverable: FX policy document + Hedging strategy cho đơn lớn

4. ✅ **Bổ sung quy trình thuế GTGT** (Issue #4)
   - Timeline: 3 ngày
   - Owner: KT TH
   - Deliverable: VAT policy + Monthly checklist

5. ✅ **Thêm control: Chống chi trùng invoice** (Issue #1 - Finding)
   - Timeline: 1 tuần
   - Owner: Dev team
   - Deliverable: Unique constraint invoice_number, validation logic

### Priority 2 (MEDIUM - Nên làm trong tháng đầu)

6. ✅ **Quy trình kiểm kê hàng tồn kho** (Issue #5)
   - Timeline: 3 ngày
   - Owner: Trưởng kho + KT TH
   - Deliverable: Inventory count SOP

7. ✅ **Budget control per order** (Issue #6)
   - Timeline: 1 tuần
   - Owner: Dev team + KT TT
   - Deliverable: Budget tracking module

8. ✅ **Cut-off policy** (Issue #7)
   - Timeline: 2 ngày
   - Owner: KT TH
   - Deliverable: Cut-off policy document + EOD/EOM checklist

### Priority 3 (LOW - Nice to have)

9. 🟡 **Dashboard nâng cao:**
   - FX exposure monitoring
   - Budget variance analysis
   - Aging report tự động

10. 🟡 **Tích hợp ngân hàng API:**
    - Auto download sao kê
    - Auto reconcile transactions

11. 🟡 **Credit scoring model:**
    - Tự động đánh giá khách hàng mới
    - Gợi ý credit limit

---

## PHẦN 7: KẾT LUẬN & SIGN-OFF

### Đánh giá cuối cùng:

**Hệ thống TBS ERP Order Management có nền tảng tốt về:**
- ✅ Phân quyền & kiểm soát nội bộ
- ✅ Quy trình phê duyệt
- ✅ Anti-fraud controls

**Tuy nhiên, CẦN BỔ SUNG CRITICAL ITEMS trước khi deploy:**
- 🔴 Định khoản kế toán chuẩn
- 🔴 Đối chiếu ngân hàng
- 🔴 Foreign exchange policy
- 🔴 Thuế GTGT procedures

**Recommendation:**
> **KHÔNG NÊN deploy production cho đến khi fix xong 5 items Priority 1.**
>
> **Timeline ước tính:** 2-3 tuần nếu tập trung.
>
> **Sau khi fix:** Review lại với Kế toán trưởng, sign-off, rồi mới deploy.

---

**Người thực hiện:**
_[Tên Kế toán trưởng]_
_[Chữ ký]_
_Ngày: 09/02/2026_

**Người duyệt:**
_[BGĐ/COO]_
_[Chữ ký]_
_Ngày: __/__/_____

---

**PHỤ LỤC A: DANH SÁCH CHUẨN MỰC THAM KHẢO**

1. **Luật Kế toán số 88/2015/QH13**
2. **Thông tư 200/2014/TT-BTC** - Hệ thống tài khoản kế toán
3. **Thông tư 133/2016/TT-BTC** - Chứng từ kế toán
4. **Nghị định 123/2020/NĐ-CP** - Hóa đơn điện tử
5. **Thông tư 219/2013/TT-BTC** - Thuế GTGT
6. **VAS 01-26** - Chuẩn mực kế toán Việt Nam
7. **Thông tư 48/2019/TT-BTC** - Dự phòng rủi ro tín dụng

---

*Tài liệu này là confidential, chỉ dành cho nội bộ TBS Group.*
