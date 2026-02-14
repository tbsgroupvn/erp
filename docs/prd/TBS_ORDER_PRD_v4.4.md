# TBS ORDER ERP - PRD v4.4

## Tài liệu Yêu cầu Sản phẩm
**41 Phân hệ | 7 Phòng ban | Kiểm soát Rủi ro Tài chính**

> **Bao gồm:** Kiểm soát cọc MHH • Trọng lượng quy đổi • Thanh toán Ví/Credit • Bù trừ công nợ • Pre-alert

**TBS GROUP** - Giải pháp Logistics & Giao nhận Trung - Việt

Ngày tạo: 29/1/2026

---

## MỤC LỤC

1. [Kiến trúc Tổng thể](#phần-a-kiến-trúc-tổng-thể)
2. [Phòng ban & Phân quyền](#phần-b-phòng-ban--phân-quyền)
3. [Danh sách Phân hệ](#phần-c-danh-sách-phân-hệ)
4. [Chi tiết 5 Điểm Mù Đã Xử Lý](#phần-d-5-điểm-mù-rủi-ro-đã-xử-lý)
5. [Yêu cầu Phi chức năng](#phần-e-yêu-cầu-phi-chức-năng)
6. [Web vs Mobile](#phần-f-web-vs-mobile)
7. [Tích hợp Bên thứ 3](#phần-g-tích-hợp-bên-thứ-3)

---

# PHẦN A: KIẾN TRÚC TỔNG THỂ

## 1. Triết lý Hub & Spoke

```
                    📦 CONTAINER
                         ↑
    👤 KHÁCH HÀNG  ←→  📋 ĐƠN HÀNG  ←→  🚚 VẬN CHUYỂN
                         ↓
                    💰 TÀI CHÍNH
```

- **Trung tâm (Hub):** Phân hệ ĐƠN HÀNG - Nơi mọi hoạt động kinh doanh bắt đầu và kết thúc
- **Các nan hoa (Spokes):** 40 phân hệ còn lại đều kết nối, hỗ trợ và phục vụ cho Đơn hàng

## 2. Luồng Công việc Xuyên suốt

```
Khách hàng → Báo giá → Đơn hàng → Container → Vận chuyển → Kho VN → Giao hàng → Thanh toán
```

## 3. Bốn loại Dịch vụ

| Mã | Tên | Mô tả |
|----|-----|-------|
| **VCT** | Vận chuyển thuần | Chỉ vận chuyển hàng khách đã mua sẵn từ TQ về VN |
| **MHH** | Mua hàng hộ | TBS tìm nguồn, đàm phán, mua hàng và vận chuyển - lo từ A-Z |
| **UTXNK** | Ủy thác XNK | TBS đứng tên trên tờ khai hải quan, khách không cần giấy phép NK |
| **LCLCN** | LCL chính ngạch | Hàng lẻ ghép container, khai báo đứng tên khách, đầy đủ chứng từ |

---

# PHẦN B: PHÒNG BAN & PHÂN QUYỀN

## Danh sách 7 Phòng ban

| Mã | Tên đầy đủ | Viết tắt | Chức năng chính |
|----|------------|----------|-----------------|
| BOD | Ban Giám đốc | BGĐ | Phê duyệt, giám sát, ra quyết định chiến lược |
| SAL | Kinh doanh | KD | Tiếp nhận đơn, chăm sóc khách, báo giá, theo dõi đơn hàng |
| MKT | Marketing | MKT | Quảng cáo, thu hút khách tiềm năng, phân tích thị trường |
| ACC | Kế toán | KT | Quản lý tài chính, công nợ, xuất hóa đơn, báo cáo thuế |
| DOC | Chứng từ | CT | Xử lý hồ sơ hải quan, chứng từ xuất nhập khẩu |
| WCN | Kho Trung Quốc | KTQ | Nhận hàng, kiểm tra, đóng gói, cân đo tại kho TQ |
| WVN | Kho Việt Nam | KVN | Nhận hàng, phân loại, giao hàng chặng cuối |

---

# PHẦN C: DANH SÁCH PHÂN HỆ

## Tổng quan 41 Phân hệ

### Nhóm A: Vận hành Logistics

| ID | Mã | Tên | Ưu tiên | Mô tả |
|----|-----|-----|---------|-------|
| 1 | ORD | Quản lý Đơn hàng | P0 | Quản lý toàn bộ vòng đời đơn hàng. Hỗ trợ 4 loại dịch vụ: VCT, MHH, UTXNK, LCLCN |
| 2 | QUO | Báo giá | P1 | Tạo và quản lý báo giá cho khách hàng |
| 3 | CNT | Quản lý Container | P0 | Ghép hàng, theo dõi container từ TQ về VN |
| 4 | WCN | Kho Trung Quốc | P0 | Nhận hàng, cân đo 3 chiều, đóng gói tại kho TQ |
| 5 | WVN | Kho Việt Nam | P0 | Nhận hàng, phân loại, giao hàng chặng cuối |
| 6 | TRK | Theo dõi Vận đơn | P1 | Tracking đơn hàng realtime cho khách |
| 7 | QMS | Khiếu nại | P1 | Tiếp nhận và xử lý khiếu nại khách hàng |
| 8 | OPC | Chi phí Chuyến | P1 | Phân bổ chi phí vận hành theo container |

### Nhóm B: Quan hệ Khách hàng

| ID | Mã | Tên | Ưu tiên | Mô tả |
|----|-----|-----|---------|-------|
| 9 | CRM | Khách hàng | P0 | Quản lý thông tin, hạng, hạn mức tín dụng khách |
| 10 | VND | Nhà cung cấp | P1 | Quản lý NCC, đại lý, đối tác |
| 11 | CTR | Hợp đồng | P2 | Quản lý hợp đồng với khách và NCC |
| 12 | MKT | Marketing | P2 | Quản lý chiến dịch, khách tiềm năng |

### Nhóm C: Tài chính Kế toán

| ID | Mã | Tên | Ưu tiên | Mô tả |
|----|-----|-----|---------|-------|
| 13 | GLG | Sổ cái | P1 | Hệ thống sổ cái kế toán |
| 14 | ARP | Công nợ Phải thu | P0 | Quản lý công nợ khách hàng |
| 15 | APP | Công nợ Phải trả | P0 | Quản lý công nợ với NCC |
| 16 | CSH | Tiền mặt | P0 | Quản lý thu chi, quỹ tiền mặt |
| 17 | AST | Tài sản | P2 | Quản lý tài sản cố định |
| 18 | INV | Hóa đơn | P0 | Xuất hóa đơn điện tử |
| 19 | BDG | Ngân sách | P2 | Lập và theo dõi ngân sách |
| 20 | PUR | Mua hàng | P1 | Quản lý yêu cầu mua hàng, đặt hàng NCC |
| 21 | INV2 | Tồn kho | P1 | Quản lý tồn kho vật tư, bao bì |

### Nhóm D: Vận tải

| ID | Mã | Tên | Ưu tiên | Mô tả |
|----|-----|-----|---------|-------|
| 22 | FLT | Quản lý Xe | P1 | Quản lý đội xe, lịch trình, bảo dưỡng |
| 23 | CAR | Tài xế | P1 | Quản lý tài xế, phân công giao hàng |

### Nhóm E: Nhân sự

| ID | Mã | Tên | Ưu tiên | Mô tả |
|----|-----|-----|---------|-------|
| 24 | EMP | Nhân viên | P1 | Quản lý thông tin nhân viên |
| 25 | ATT | Chấm công | P1 | Chấm công, tính giờ làm |
| 26 | PAY | Bảng lương | P1 | Tính lương, thuế TNCN |
| 27 | PMS | Đánh giá | P2 | KPI, đánh giá hiệu suất |
| 28 | TRN | Đào tạo | P2 | Quản lý khóa đào tạo |

### Nhóm F: Hệ thống

| ID | Mã | Tên | Ưu tiên | Mô tả |
|----|-----|-----|---------|-------|
| 29 | DSH | Báo cáo | P0 | Dashboard, báo cáo tổng hợp |
| 30 | APR | Phê duyệt | P0 | Quy trình phê duyệt đa cấp |
| 31 | TSK | Công việc | P1 | Quản lý task, todo |
| 32 | CAL | Lịch | P2 | Lịch họp, sự kiện |
| 33 | MSG | Tin nhắn | P2 | Chat nội bộ |
| 34 | EML | Email | P2 | Gửi email tự động |
| 35 | DOC | Tài liệu | P1 | Quản lý file, chứng từ |
| 36 | NTF | Thông báo | P1 | Hệ thống thông báo đa kênh |

### Nhóm G: Mở rộng

| ID | Mã | Tên | Ưu tiên | Mô tả |
|----|-----|-----|---------|-------|
| 37 | FXR | Tỷ giá | P1 | Quản lý tỷ giá CNY/USD/VND |
| 38 | COM | Hoa hồng | P1 | Tính hoa hồng kinh doanh |
| 39 | CPT | Cổng Khách hàng | P1 | Portal khách hàng: Ví, Pre-alert, Tracking |
| 40 | COD | Quản lý COD | P1 | Thu hộ, đối soát COD |
| 41 | LNF | Hàng lạc danh | P1 | Xử lý hàng không rõ nguồn gốc |
| 42 | NET | Bù trừ Công nợ | P1 | Bù trừ AR/AP cùng đối tác |

---

# PHẦN D: 5 ĐIỂM MÙ RỦI RO ĐÃ XỬ LÝ

## 1. 🔴 Chặn Đặt hàng nếu Chưa Cọc (Deposit Gate)

### Vấn đề
Trong mô hình Mua hàng hộ (MHH), Sale có thể tạo đơn MHH trị giá 1 tỷ đồng, Sếp duyệt, và Kế toán chuyển tiền sang Trung Quốc **khi khách chưa đóng đồng nào**. Nếu khách "bùng", công ty ôm trọn đống hàng đó.

### Giải pháp

**Quy tắc cọc theo Hạng khách hàng:**

| Hạng khách hàng | Tỷ lệ cọc tối thiểu | Ghi chú |
|-----------------|---------------------|---------|
| Khách mới (< 3 đơn) | **100%** | Phải cọc đủ mới cho đặt hàng |
| Khách thường | **70%** | Còn lại thanh toán khi nhận hàng |
| Khách VIP (> 500tr/năm) | **50%** | Có credit limit bổ sung |
| Đối tác chiến lược | **30%** | Theo hợp đồng riêng |

**Cơ chế chặn:**
- Đơn MHH **BẮT BUỘC** phải có trạng thái "Đã đặt cọc" 
- Hệ thống **CHẶN** nút [Tạo PR] và [Gửi duyệt] nếu chưa cọc đủ
- Nếu khách không cọc trong 3 ngày → Tự động hủy đơn

```
Nháp → Gửi yêu cầu cọc → [Chờ cọc] → Khách thanh toán → [Đã đặt cọc] → Mới được tạo PR
```

---

## 2. 🟡 Logic Thanh toán Ví vs Công nợ (Payment Priority)

### Vấn đề
Khách hàng doanh nghiệp (B2B) thường thanh toán theo công nợ tháng (Post-paid), khách lẻ dùng Ví (Pre-paid). Một đơn hàng khi hoàn thành sẽ trừ vào đâu?

### Giải pháp: Payment Priority Logic

```
┌─────────────────────────────────────────────────────────────┐
│ Bước 1: Kiểm tra số dư Ví                                   │
│         Nếu Ví >= Phải thu → Trừ Ví → ✅ Cho giao           │
│         Nếu Ví < Phải thu → Bước 2                          │
├─────────────────────────────────────────────────────────────┤
│ Bước 2: Kiểm tra Hạn mức tín dụng còn lại                   │
│         Credit còn = Hạn mức - Công nợ hiện tại             │
│         Nếu Credit còn >= Phải thu → Ghi nợ AR → ✅ Cho giao │
│         Nếu Credit còn < Phải thu → Bước 3                  │
├─────────────────────────────────────────────────────────────┤
│ Bước 3: Kết hợp Ví + Credit                                 │
│         Nếu Ví + Credit còn >= Phải thu:                    │
│            → Trừ hết Ví + Ghi nợ phần còn lại → ✅ Cho giao  │
│         Nếu không đủ → ❌ CHẶN GIAO → Thông báo KD + Khách   │
└─────────────────────────────────────────────────────────────┘
```

**Ví dụ:**
- Đơn 10 triệu, Ví có 3 triệu, Credit còn 10 triệu
- → Trừ Ví 3tr + Ghi nợ 7tr → Cho giao

---

## 3. 🟢 Trọng lượng Quy đổi (Chargeable Weight)

### Vấn đề
Trong logistics, đây là nơi **thất thoát doanh thu ngầm lớn nhất**. Một kiện hàng bông gòn nhẹ 1kg nhưng to như cái tủ lạnh. Nếu chỉ cân kg, công ty lỗ nặng tiền cước vận chuyển.

### Giải pháp

**Công thức:**
```
Cân tính tiền = MAX(Cân nặng thực, Cân nặng quy đổi)

Cân nặng quy đổi = (Dài × Rộng × Cao) ÷ Hệ số
```

**Hệ số theo tuyến:**

| Tuyến vận chuyển | Hệ số | Quy đổi |
|------------------|-------|---------|
| Đường biển | 6000 | 1 CBM = 166.67 kg |
| Đường bộ | 5000 | 1 CBM = 200 kg |
| Đường hàng không | 5000 | 1 CBM = 200 kg |

**Ví dụ thực tế:**
- Kiện hàng: 50cm × 40cm × 30cm, cân nặng thực: 2kg
- Cân quy đổi = (50 × 40 × 30) ÷ 6000 = **10kg**
- Cân tính tiền = MAX(2kg, 10kg) = **10kg** ← Tính giá theo số này

**Yêu cầu Kho TQ:**
- ✅ BẮT BUỘC nhập 3 chiều (Dài × Rộng × Cao) bên cạnh Cân nặng thực
- ✅ Hệ thống tự động tính và hiển thị Cân tính tiền

---

## 4. 🔵 Bù trừ Công nợ (Debt Netting) - Module NET

### Vấn đề
TBS có các Agent/Partner (Kho TQ, Nhà xe). 
- TBS nợ tiền thuê kho họ 50 triệu (AP)
- Họ làm mất hàng của TBS đền 15 triệu (AR)

Nếu không bù trừ: Phải chuyển khoản trả họ 50 triệu, rồi chờ họ chuyển trả 15 triệu. **Rất rủi ro dòng tiền**.

### Giải pháp: Module NET - Bù trừ Công nợ

**Quy trình:**
1. Kế toán vào màn hình "Công nợ 2 chiều" → Xem đối tác có cả AR và AP
2. Tick chọn các khoản muốn bù trừ
3. Tạo phiếu bù trừ → Gửi duyệt
4. BGĐ/Kế toán trưởng phê duyệt
5. Hệ thống tự động:
   - Cập nhật AR/AP thành "Đã bù trừ"
   - Tạo bút toán trong Sổ cái
   - Tạo khoản mới cho phần chênh lệch (nếu có)

**Ví dụ:**
```
TBS nợ Kho TQ tiền thuê kho:     50 triệu (AP)
Kho TQ làm mất hàng đền TBS:     15 triệu (AR)
─────────────────────────────────────────────
Bù trừ: 50 - 15 = 35 triệu
→ TBS chỉ cần trả Kho TQ 35 triệu
```

---

## 5. 🟣 Khai báo Mã vận đơn (Pre-alert)

### Vấn đề
Trong mô hình Mua hàng hộ hoặc Ký gửi, khách thường mua hàng trên Taobao trước, sau đó hàng mới về kho TQ. Kho TQ nhận được kiện hàng có mã vận đơn TQ nhưng **không biết của ai** → Phải đưa vào "Hàng lạc danh" → Tốn thời gian xử lý.

### Giải pháp: Tính năng Pre-alert trong Cổng Khách hàng (CPT)

**Quy trình:**
1. Khách mua hàng trên Taobao/1688 → Có mã vận đơn TQ (ví dụ: SF123456)
2. Vào Portal TBS → [Khai báo tracking] → Nhập mã + mô tả
3. Khi hàng về kho TQ:
   - Kho quét mã vận đơn
   - Hệ thống tự động tìm trong danh sách Pre-alert
   - **Nếu khớp** → Tự động gán cho khách → Tạo đơn hoặc gán vào đơn có sẵn
   - **Nếu không khớp** → Đưa vào Hàng lạc danh (LNF)

**Kết quả:** Giảm **80%** lượng hàng lạc danh

**Màn hình Khai báo tracking:**
| Trường | Mô tả |
|--------|-------|
| Mã vận đơn TQ | Bắt buộc nhập |
| Mô tả hàng | Tùy chọn |
| Số kiện dự kiến | Tùy chọn |
| Ảnh đơn hàng | Tùy chọn |

**Trạng thái tracking:**
- 🟡 Chờ hàng
- 🟢 Đã nhận
- ✅ Đã gán đơn

---

# PHẦN E: YÊU CẦU PHI CHỨC NĂNG

## 1. Hiệu năng (Performance)

| Chỉ số | Tối thiểu | Mục tiêu |
|--------|-----------|----------|
| Đơn hàng/ngày | 500 | 2,000 (cao điểm) |
| Người dùng đồng thời | 50 | 200 (web + mobile) |
| Thời gian tải trang | < 3 giây | < 1.5 giây (95% requests) |
| Thời gian tải báo cáo | < 10 giây | < 5 giây (báo cáo < 1 tháng) |
| Uptime | 99% | 99.5% (trừ bảo trì Chủ nhật) |
| Backup | Hàng ngày 2:00 AM | Incremental 4h + Full daily |

## 2. Lưu trữ (Storage Policy)

| Loại dữ liệu | Thời gian giữ | Sau đó |
|--------------|---------------|--------|
| Ảnh kho (TQ/VN) | 6 tháng | Cold Storage (giảm 70% chi phí), xóa sau 2 năm |
| Ảnh POD giao hàng | 12 tháng | Nén và lưu trữ vĩnh viễn (yêu cầu pháp lý) |
| Dữ liệu đơn hàng | 5 năm | Lưu trữ theo quy định kế toán |
| Log hệ thống | 90 ngày | Tự động xóa |
| Audit trail | Vĩnh viễn | Nén và lưu trữ sau 2 năm |
| Chứng từ scan | 10 năm | Yêu cầu pháp lý hải quan |

## 3. Bảo mật (Security)

| Tiêu chí | Yêu cầu |
|----------|---------|
| Mã hóa | HTTPS/TLS 1.3 cho mọi kết nối, AES-256 cho dữ liệu nhạy cảm |
| Xác thực | JWT token, hỗ trợ 2FA cho BGĐ và Kế toán |
| Phân quyền | RBAC theo 7 phòng ban + phân cấp |
| Audit log | Ghi nhận mọi thao tác quan trọng (ai, làm gì, khi nào, IP) |
| Session | Tự động logout sau 30 phút không hoạt động (Web), 7 ngày (Mobile) |
| Mật khẩu | Tối thiểu 8 ký tự, chữ hoa + thường + số. Đổi mỗi 90 ngày |

---

# PHẦN F: WEB VS MOBILE

## Mobile App BẮT BUỘC

| Module | Lý do |
|--------|-------|
| WCN - Kho TQ | Quét mã, chụp ảnh, nhận hàng tại chỗ |
| WVN - Kho VN | Quét mã, xác nhận giao, chụp POD |
| CAR - Tài xế | GPS tracking, nhận lệnh giao, cập nhật trạng thái |
| COD - Thu hộ | Xác nhận thu tiền, chụp biên nhận |
| ATT - Chấm công | Check-in GPS, Face ID |

## Mobile App NÊN CÓ

| Module | Lý do |
|--------|-------|
| APR - Phê duyệt | BGĐ duyệt nhanh khi đi công tác |
| ORD - Đơn hàng | Sales xem trạng thái, cập nhật nhanh |
| TSK - Công việc | Nhận thông báo, cập nhật tiến độ |
| MSG - Tin nhắn | Chat nội bộ, liên lạc nhanh |

## Chỉ Web (Không cần Mobile)

| Module | Lý do |
|--------|-------|
| GLG - Sổ cái | Công việc kế toán cần màn hình lớn |
| DSH - Báo cáo | Dashboard phức tạp cần màn hình lớn |
| PAY - Bảng lương | Thao tác HR phức tạp |

## Nguyên tắc Thiết kế Mobile

- **MINIMAL:** Chỉ hiển thị thông tin và nút cần thiết cho công việc
- **OFFLINE:** Kho/Tài xế làm việc không có mạng, đồng bộ sau
- **SCAN/PHOTO:** Tích hợp camera quét barcode, QR, chụp ảnh hàng
- **GPS:** Theo dõi vị trí xe, check-in theo tọa độ
- **PUSH:** Thông báo realtime khi có đơn mới, cần duyệt, cảnh báo

---

# PHẦN G: TÍCH HỢP BÊN THỨ 3

## Danh sách Tích hợp

| Loại | Nhà cung cấp | Chức năng |
|------|--------------|-----------|
| Hóa đơn điện tử | MISA meInvoice / Viettel S-Invoice | Xuất, hủy, điều chỉnh hóa đơn theo quy định thuế |
| SMS | Viettel / VNPT / FPT | Gửi OTP, thông báo đơn, nhắc nợ |
| Zalo ZNS | Zalo Official Account | Gửi thông báo qua Zalo (chi phí thấp hơn SMS) |
| Ngân hàng | Vietcombank / Techcombank API | Đối soát sao kê tự động, xác nhận nạp Ví |
| Tỷ giá | Vietcombank / BIDV API | Lấy tỷ giá CNY/VND, USD/VND hàng ngày |
| Tracking TQ | Kuaidi100 API / 17Track | Lấy trạng thái vận đơn từ hãng vận chuyển TQ |
| Bản đồ | Google Maps / Goong.io | Hiển thị vị trí hàng, tối ưu lộ trình giao |
| Kế toán | MISA SME (optional) | Xuất dữ liệu sang MISA để báo cáo thuế |
| Email | SendGrid / AWS SES | Gửi email thông báo, statement công nợ |
| Cloud Storage | AWS S3 / Google Cloud Storage | Lưu ảnh hàng hóa, chứng từ scan |

## Xử lý Hoàn tác khi đã Xuất Hóa đơn Điện tử

Khi BGĐ bấm [Hoàn tác] đơn hàng đã xuất hóa đơn điện tử:

1. **Nếu hóa đơn chưa gửi cơ quan thuế (trong ngày):** 
   - Hệ thống tự động hủy hóa đơn

2. **Nếu hóa đơn đã gửi cơ quan thuế:**
   - ❌ KHÔNG THỂ hoàn tác tự động
   - Kế toán phải lập Hóa đơn điều chỉnh hoặc Biên bản hủy theo quy định
   - Hệ thống chỉ hoàn tác phần nội bộ (trạng thái đơn, tồn kho...)

3. **Hệ thống tạo TODO cho Kế toán:**
   - "Xử lý hóa đơn điện tử cho đơn [Mã đơn]"

---

# PHỤ LỤC: THUẬT NGỮ

| Thuật ngữ | Giải thích |
|-----------|------------|
| **VCT** | Vận chuyển thuần - Chỉ vận chuyển |
| **MHH** | Mua hàng hộ - TBS mua và vận chuyển |
| **UTXNK** | Ủy thác Xuất nhập khẩu - TBS đứng tên khai báo |
| **LCLCN** | Less than Container Load Chính ngạch - Hàng lẻ đứng tên khách |
| **PR** | Purchase Request - Yêu cầu mua hàng |
| **PO** | Purchase Order - Đơn đặt hàng |
| **AR** | Accounts Receivable - Công nợ phải thu |
| **AP** | Accounts Payable - Công nợ phải trả |
| **COD** | Cash on Delivery - Thu tiền khi giao hàng |
| **POD** | Proof of Delivery - Bằng chứng giao hàng |
| **Pre-alert** | Khai báo mã vận đơn trước khi hàng về |
| **Credit Limit** | Hạn mức tín dụng cho khách B2B |
| **Chargeable Weight** | Trọng lượng tính cước = MAX(thực, quy đổi) |
| **Debt Netting** | Bù trừ công nợ giữa AR và AP |
| **Hub & Spoke** | Mô hình trung tâm và các nan hoa |

---

**© 2025 TBS Group** - Tài liệu nội bộ

