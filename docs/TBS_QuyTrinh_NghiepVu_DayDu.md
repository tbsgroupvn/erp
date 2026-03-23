# TBS GROUP — ERP ORDER MANAGEMENT

## Quy trình làm việc các phòng ban theo Flow đơn hàng & Xử lý các trường hợp nghiệp vụ

> **Phiên bản:** 1.0 | Tháng 3/2026
> **Nguồn:** Order Lifecycle Spec v3.2 + PRD v4.4 + System Documentation v3.0
> **Mục đích:** Tài liệu phục vụ họp với Tech Lead — clear nghiệp vụ công ty

---

# PHẦN 1: TỔNG QUAN TỔ CHỨC THAM GIA ĐƠN HÀNG

TBS Group có **7 phòng ban / nhóm vai trò** tham gia vào vòng đời đơn hàng (~50 người, mục tiêu 70-100).

| Phòng ban | Số lượng | Bản chất | Tham gia giai đoạn | KPI chính |
|-----------|----------|----------|-------------------|-----------|
| **Marketing** | 3 | Lead Generation | Chỉ GĐ 1 (đầu phễu) | CPL, số lead/ngày |
| **CSKH** | 1-2 | Intake + Qualify + Handoff | Chỉ GĐ 1. Sau khi assign Sale → không tham gia nữa | Thời gian phản hồi, tỷ lệ qualify |
| **Sale** | 25 (lên 40-50) | Order Owner — Chủ đơn hàng | GĐ 1-4, 5(verify), 9(phiếu chi), 11(hẹn KH), 12(đối soát) | Doanh thu, số đơn, tỷ lệ chốt, hoa hồng |
| **Leader** | Nhiều (3-5 Sale/Leader) | Quản lý nhóm Sale | Đồng duyệt giảm giá, hỗ trợ Sale | Doanh thu nhóm, thu hồi CN |
| **GĐ Kinh doanh** | 1 | Quản lý KD toàn công ty (cả 2 CN) | Duyệt giảm giá > 3%, đơn lớn, hủy đơn | Doanh thu toàn công ty |
| **Phòng XNK** | 3 | Logistics + Compliance | GĐ 7-9. KẾT THÚC khi hàng về kho TBS | Thông quan, fill rate container |
| **Kế toán** | 3 (KT TH + KT TT + KT CP VN) | Tài chính, phê duyệt phiếu | GĐ 2(đồng duyệt), 3(cọc), 4(chi), 9(thuế), 11(kiểm tra TT), 12-13(hạch toán) | Chính xác tài chính, thu hồi CN |
| **Agent TQ** | Thuê ngoài | Kho TQ + Mua hàng | GĐ 4(mua), 5(nhập kho TQ), 6(đóng gói), 7(đóng container) | Thời gian nhập kho, độ chính xác |
| **Trưởng kho VN** | 2 (HN + HCM) | Kho + Giao hàng last-mile | GĐ 10(nhập kho VN), 11(ĐIỀU PHỐI giao hàng) | Thời gian giao, POD, COD |
| **Lái xe** | HN: 1 + đối tác. HCM: đối tác | Giao hàng | GĐ 11 (giao + thu COD + POD) | Giao đúng hẹn, COD đầy đủ |
| **BGĐ/COO** | 1-2 | Phê duyệt cấp cao + Chi tiền | Duyệt chi tiền, giảm giá > 5%, hủy đơn, hoàn tác | Full access, override mọi cấp |

### ⚠️ RANH GIỚI TRÁCH NHIỆM QUAN TRỌNG

1. **XNK kết thúc tại kho TBS:** Sau khi XNK phối hợp HQ cho xe chạy cảng/CK về kho TBS (bước 9.9), XNK hết trách nhiệm. Trưởng kho VN tiếp nhận từ đây.
2. **Trưởng kho = Kho + Giao hàng:** Trưởng kho VN điều phối TOÀN BỘ giao hàng last-mile (lên lịch, phân công lái xe, giám sát COD). XNK KHÔNG tham gia giao hàng nội địa.
3. **Sale là Order Owner xuyên suốt:** Sale chịu trách nhiệm từ đầu đến cuối, tham gia gần như tất cả giai đoạn (trừ vận hành kho & logistics). Mọi phiếu thu/chi đều BẮT BUỘC gắn đơn hàng.

---

# PHẦN 2: CHI TIẾT 13 GIAI ĐOẠN — QUY TRÌNH & XỬ LÝ CÁC TRƯỜNG HỢP

Mỗi giai đoạn trình bày: Phòng ban tham gia → Nhiệm vụ cụ thể → SLA → Tất cả tình huống rẽ nhánh (NẾU CÓ / NẾU KHÔNG).

---

## GĐ 1: TIẾP NHẬN KHÁCH HÀNG (`CONSULTING`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể | SLA |
|-----------|---------|-----------------|-----|
| **Marketing (3 người)** | Tạo nguồn khách (Lead Gen) | Chạy quảng cáo TikTok/FB/YouTube, sản xuất content. Output: Data KH (tin nhắn, gọi điện, Zalo, form web) | KPI: Số lead/ngày, CPL |
| **CSKH (1-2 người)** | Intake + Qualify + Handoff | Liên hệ lại data trong 15 phút, khai thác sơ bộ, nhập CRM, assign Sale, tạo nhóm Zalo 3 bên | **≤ 15 phút phản hồi data**. Sau khi chuyển Sale → CSKH KHÔNG tham gia nữa |
| **Sale** | Nhận khách, bắt đầu tư vấn | Nhận thông báo assign, liên hệ khách, tìm hiểu nhu cầu, xác định loại dịch vụ (VCT/MHH/UTXNK/LCLCN) | **≤ 2 giờ liên hệ khách** |

**Phê duyệt:** Không có. CSKH tự assign Sale.
**Hệ thống:** Auto notify Sale khi được assign. Alert Leader nếu Sale không liên hệ trong 2h.

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Khách đến từ kênh Marketing?** | → CSKH nhận data trong ≤ 15 phút → Qualify sơ bộ → Nhập CRM, assign Sale → Tạo nhóm Zalo 3 bên | → Khách đến trực tiếp / giới thiệu: Sale nhận trực tiếp, tự nhập CRM, không qua CSKH. Khách từ website/portal: Form tự động → CSKH nhận → Assign Sale |
| **CSKH qualify được nhu cầu?** | → Assign Sale phù hợp (theo khu vực/chuyên môn) → Sale nhận thông báo App push → Sale liên hệ khách trong ≤ 2 giờ | → Khách không rõ nhu cầu: CSKH tư vấn sơ bộ thêm. Nếu vẫn chưa rõ → đánh dấu "Tiềm năng", follow-up sau 3 ngày. Data spam/sai SĐT: đánh dấu "Không hợp lệ", ghi lý do |
| **Sale liên hệ khách trong 2 giờ?** | → Bắt đầu tư vấn → Chuyển GĐ 2 nếu khách quan tâm | → Hệ thống alert Leader sau 2 giờ → Leader nhắc Sale → Nếu không liên hệ sau 4 giờ: Leader có thể reassign Sale khác |
| **Khách là khách cũ (đã có CRM)?** | → Hệ thống tự nhận diện, hiển thị lịch sử đơn → Assign Sale đang phụ trách → Hiển thị hạng KH (NEW/REGULAR/VIP/STRATEGIC) | → Tạo hồ sơ KH mới, mặc định hạng NEW, yêu cầu nhập đủ thông tin liên hệ |
| **Khách cần loại dịch vụ nào?** | → **VCT**: Khách đã có hàng, chỉ cần ship → **MHH**: TBS tìm + mua + ship (A-Z) → **UTXNK**: TBS đứng tên tờ khai → **LCLCN**: Hàng lẻ, bộ chứng từ đầy đủ → Có thể **MULTI-SELECT** (VD: MHH + LCLCN) | → Khách chưa quyết định: Sale tư vấn dựa trên loại hàng, giá trị, yêu cầu chứng từ |

---

## GĐ 2: BÁO GIÁ (`QUOTATION`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể | SLA |
|-----------|---------|-----------------|-----|
| **Sale** | Chủ trì báo giá | Tìm NCC TQ (với MHH), tạo báo giá từ template, chọn dịch vụ/tuyến đường/tính giá cước, gửi KH qua Email/Portal | **≤ 4 giờ (giờ HC)** |
| **Leader** | Đồng duyệt giảm giá cấp 1 | Review báo giá khi Sale đề xuất giảm giá ≤ 3%, đánh giá tính hợp lý thị trường | **≤ 2 giờ** |
| **KT Thanh toán** | Đồng duyệt giảm giá | Đồng duyệt giảm giá với Leader (song song), đánh giá ảnh hưởng lợi nhuận | **≤ 2 giờ** |
| **GĐ Kinh doanh** | Duyệt giảm giá > 3% | Duyệt giảm giá 3-5%. Nếu > 5% hoặc đơn > 100tr → escalate BGĐ | **≤ 4 giờ** |
| **XNK** | Hỗ trợ HS code | Check mã HS code khi Sale cần, tư vấn thuế suất, quy định NK | **≤ 4 giờ** |

**Phê duyệt giảm giá:**
- 0% (bảng giá): Sale tự quyết
- ≤ 3%: Leader + KT TT đồng duyệt
- \> 3%: + GĐ KD
- \> 5% hoặc đơn > 100tr: + BGĐ/COO

**Hệ thống:** Báo giá hết hạn sau 30 ngày → Auto Expired. Reminder trước 7 ngày. Khi Accepted → nút "Tạo đơn hàng từ báo giá này".

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Báo giá theo bảng giá chuẩn (không giảm giá)?** | → Sale tự quyết, KHÔNG cần phê duyệt → Gửi KH qua Email/Portal → Hệ thống tracking: KH đã xem chưa | → Sale muốn giảm giá: ≤ 3% cần Leader + KT TT đồng duyệt (SLA 2h), > 3% cần + GĐ KD (SLA 4h), > 5% hoặc > 100tr cần + BGĐ. Hệ thống enforce: KHÔNG skip cấp |
| **Khách chấp nhận báo giá?** | → Trạng thái: Accepted → Nút "Tạo đơn hàng từ báo giá này" → Chuyển GĐ 3 | → **Từ chối (Rejected):** Ghi lý do, Sale tạo version mới. **Đàm phán (Negotiating):** Tạo version mới, so sánh margin. **Hết hạn (30 ngày):** Auto Expired, reminder trước 7 ngày |
| **Đơn cần check HS code (hàng đặc thù)?** | → Sale yêu cầu XNK check → XNK tra thuế suất, quy định NK (SLA ≤ 4h) → Kết quả ảnh hưởng báo giá | → Hàng thông thường, HS code đã biết: dùng bảng giá chuẩn, không cần XNK |
| **Khách VIP yêu cầu giảm giá đặc biệt (> 10%)?** | → Tạo báo giá → Gửi phê duyệt BGĐ → BGĐ xem lịch sử đơn, giá trị KH → Duyệt/Từ chối kèm ghi chú → Chỉ gửi KH sau khi đã được duyệt | → Khách thường/mới: Mức giảm giá tối đa thấp hơn, cần lý do business rõ ràng |
| **Dịch vụ MHH cần tìm NCC trước khi báo giá?** | → Sale tìm nguồn trên 1688/Taobao/Pinduoduo → Lấy giá NCC bằng CNY → Cộng phí DV MHH (3-8%) → Quy đổi CNY → VND theo tỷ giá bán → Thời hạn báo giá ngắn hơn (biến động tỷ giá) | → Dịch vụ VCT/UTXNK/LCLCN: Báo giá theo bảng cước vận chuyển, không cần bước tìm NCC, thời hạn 30 ngày |

---

## GĐ 3: ĐẶT CỌC (`PENDING_DEPOSIT`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể | SLA |
|-----------|---------|-----------------|-----|
| **Sale** | Tạo đơn, nhắc cọc | Tạo đơn hàng, gửi yêu cầu cọc, tạo phiếu thu cọc (BẮT BUỘC gắn đơn hàng), nhắc khách nếu chưa cọc | Auto-cancel sau 3 ngày |
| **KT Thanh toán** | Duyệt phiếu thu cọc | Xác nhận tiền cọc đã nhận, duyệt phiếu thu, cập nhật Wallet KH | **≤ 2 giờ** |

**Phê duyệt:** Phiếu thu: Sale tạo → KT TT duyệt. Miễn/Giảm cọc: Sale → Leader → BGĐ duyệt.

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Loại dịch vụ là MHH?** | → BẮT BUỘC cọc trước khi đặt hàng NCC. Tỷ lệ theo hạng: NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%. Hệ thống CHẶN tạo PR nếu chưa cọc đủ | → **VCT**: KHÔNG yêu cầu cọc, thanh toán khi nhận hàng, bỏ qua GĐ 3 chuyển thẳng GĐ 5. **UTXNK/LCLCN**: Cọc theo thỏa thuận hợp đồng (thường 30-50%) |
| **Khách đặt cọc trong 3 ngày?** | → KT TT xác nhận tiền → Duyệt phiếu thu (SLA ≤ 2h) → Cập nhật Wallet → Chuyển giai đoạn tiếp theo | → **Auto-cancel** đơn sau 3 ngày → Thông báo Sale + KH → Sale tạo đơn mới nếu KH muốn tiếp tục. Tùy chỉnh: `DEPOSIT_AUTO_CANCEL_DAYS` |
| **Khách muốn miễn/giảm cọc?** | → Sale đề xuất → Leader → BGĐ duyệt (BGĐ là người duy nhất có quyền) → Ghi lý do → Hệ thống điều chỉnh tỷ lệ cọc | → Không được duyệt: Giữ nguyên tỷ lệ cọc theo hạng, Sale thông báo KH phải cọc đủ mới tiếp tục |
| **Khách thanh toán bằng phương thức nào?** | → **Ví (Wallet):** Trừ trực tiếp nếu đủ số dư. **Chuyển khoản:** KT xác nhận. **Tiền mặt:** Thu tại văn phòng, KT ghi nhận | → Ví không đủ số dư: Hiển thị số dư hiện tại, gợi ý nạp thêm hoặc chuyển khoản phần còn thiếu |
| **Đơn kết hợp nhiều dịch vụ (VD: MHH + LCLCN)?** | → Yêu cầu cọc theo dịch vụ có tỷ lệ CAO hơn (VD: MHH + LCLCN → áp cọc theo MHH). Checklist chứng từ gộp cả 2 dịch vụ | → Chỉ 1 dịch vụ: Áp dụng rule đơn giản của dịch vụ đó |

---

## GĐ 4: MUA HÀNG (`SOURCING`) — Chỉ MHH

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể | SLA |
|-----------|---------|-----------------|-----|
| **Sale** | Đặt hàng NCC | Tạo Purchase Request (chỉ khi đã cọc đủ), đặt hàng NCC TQ, tạo phiếu chi (gắn đơn hàng), theo dõi tiến độ | — |
| **Agent TQ** | Thực hiện mua hàng | Tạo SupplierOrder, liên hệ NCC, đặt hàng, thanh toán. Flow: DRAFT → QUOTED → ORDERED → CONFIRMED → SHIPPED_CN → RECEIVED_CN | — |
| **KT Thanh toán** | Duyệt phiếu chi | Duyệt phiếu chi mua hàng, trình BGĐ chi tiền | **≤ 2 giờ** |
| **BGĐ/COO** | Chi tiền | Duyệt chi tiền sau khi KT TT trình. Phiếu chi > 50tr: thêm KT TH duyệt | **4-8 giờ** |

**Phê duyệt:** Phiếu chi: Sale → KT TT → BGĐ. Phiếu chi > 50tr: + KT Tổng hợp.

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Dịch vụ có phải MHH không?** | → Thực hiện toàn bộ GĐ 4. Sale tạo PR → Agent TQ tạo SupplierOrder → Flow đầy đủ | → **VCT / UTXNK / LCLCN: BỎ QUA toàn bộ GĐ 4**, chuyển thẳng GĐ 5. KH tự ship hàng đến kho TBS tại TQ |
| **NCC có hàng sẵn?** | → Agent TQ xác nhận đơn giá + thời gian giao → Tạo phiếu chi → KT TT duyệt → BGĐ chi | → **Hết hàng (OUT_OF_STOCK):** Tạo MHHIssue → Thông báo Sale + KH → Đề xuất: Tìm NCC thay thế / Đợi hàng / Hủy item → KH quyết định: GIỮ / TRẢ / ĐỔI |
| **Hàng NCC giao bị lỗi / sai / thiếu?** | → Tạo MHHIssue (WRONG_ITEM / DAMAGED / INCOMPLETE) → Chụp ảnh evidence → KH quyết định: **KEEP** (giữ, có thể giảm giá), **RETURN** (trả NCC → RETURN_IN_PROGRESS → REFUNDED), **EXCHANGE** (đổi hàng mới) | → Hàng đúng, đủ, chất lượng OK: QC PASSED → Tiếp tục flow bình thường → GĐ 5 |
| **NCC thay đổi giá (PRICE_CHANGE)?** | → Tạo MHHIssue → Thông báo Sale → Sale báo KH giá mới → KH đồng ý: Cập nhật đơn + phiếu chi → KH không đồng ý: Hủy item hoặc tìm NCC khác | → Giá ổn định: Tiến hành đặt hàng bình thường |
| **Phiếu chi mua hàng > 50 triệu?** | → Flow duyệt thêm 1 cấp: Sale → KT TT → **KT Tổng hợp** → BGĐ. KT TH kiểm tra tổng chi phí vs doanh thu đơn | → ≤ 50 triệu: Sale → KT TT → BGĐ (chỉ 3 cấp) |
| **Anti-fraud phát hiện bất thường?** | → **BLOCK tự động** nếu: Thiếu mã đơn hàng / Đơn đã closed / Thiếu chứng từ / Sai owner. **FLAG** (cảnh báo Leader + KT TT) nếu: Tổng chi > 90% DT đơn, Chi "Phát sinh" > 5tr, NCC không trong approved list, Pattern phiếu chi nhỏ liên tiếp, Tạo ngoài giờ HC | → Phiếu chi bình thường: Duyệt theo flow tiêu chuẩn |

---

## GĐ 5: NHẬP KHO TRUNG QUỐC (`WAREHOUSE_CN`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể | SLA |
|-----------|---------|-----------------|-----|
| **Agent TQ (Kho Nghĩa Ô / Bằng Tường)** | Nhận hàng, cân đo, QC | Nhận kiện từ NCC/vận đơn, khớp Pre-alert, CÂN ĐO 3 CHIỀU BẮT BUỘC (D×R×C + cân nặng), chụp ảnh, QC, xếp kho | **≤ 24 giờ nhập kho** |
| **Sale** | Verify số liệu | Kiểm tra thông tin Agent cập nhật, xác nhận SL/CL với KH (MHH), xử lý hàng lạc danh | **≤ 4 giờ verify** |

**Công thức:** Đường biển = D×R×C/6000, Đường bộ = D×R×C/5000. **KL tính cước = MAX(KL thực, KL quy đổi)**.

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Quét mã vận đơn → KHỚP Pre-alert?** | → Tự động gán khách hàng → Liên kết đơn hàng → Trạng thái: Đã nhận → Tiếp tục cân đo | → **KHÔNG KHỚP Pre-alert:** Tự động tạo Hàng lạc danh (Lost & Found). Chụp ảnh bắt buộc. Hệ thống GỢI Ý Pre-alert gần đúng (fuzzy match, VD: SF999 → SF9999). Thông báo Sale nhận diện (7 ngày). Quá 7 ngày: Liên hệ shipper TQ. **Quá 30 ngày: BGĐ duyệt thanh lý** |
| **KL quy đổi > KL thực?** | → Hàng nhẹ cồng kềnh (bông gòn, nhựa lớn). VD: 60×50×40cm, 1kg → Quy đổi = 20kg → **Tính cước 20kg**. Cảnh báo Sale: CW cao hơn dự kiến | → KL thực > KL quy đổi: Hàng nặng nhỏ gọn (kim loại). VD: 20×15×10cm, 15kg → Quy đổi = 0.5kg → **Tính cước 15kg** |
| **Chênh lệch CW so với báo giá > 10%?** | → **Alert URGENT** cho Sale qua App push → Sale liên hệ KH thông báo giá có thể thay đổi → KH đồng ý: Tiếp tục. KH không đồng ý: Đàm phán hoặc ON_HOLD | → Chênh lệch ≤ 10%: Chấp nhận, tiếp tục flow, không cần thông báo KH |
| **QC kiểm tra hàng MHH → KH REJECTED?** | → Tạo MHHIssue → KH quyết định: **KEEP** (giữ, yêu cầu giảm giá), **RETURN** (trả NCC → RETURN_IN_PROGRESS → REFUNDED), **EXCHANGE** (đổi hàng mới, lặp lại QC) | → KH APPROVED: QC CUSTOMER_APPROVED → Tiếp tục đóng gói → GĐ 6 |
| **Hàng lưu kho TQ quá 30 ngày?** | → Cảnh báo đỏ → Tính phí lưu kho: số ngày × phí/ngày → Thông báo Sale + KH → Cộng phí vào công nợ | → Xuất trong thời hạn: Không phát sinh phí lưu kho |

---

## GĐ 6: ĐÓNG GÓI (`PACKING`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể |
|-----------|---------|-----------------|
| **Agent TQ** | Đóng gói | Đánh kiện, dán nhãn, đóng gói bảo vệ hàng hóa, chuẩn bị ghép container |
| **Sale** | Yêu cầu đặc biệt | Yêu cầu đóng gói đặc biệt (hàng dễ vỡ, giá trị cao), thông báo KH tiến độ |

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Hàng cần đóng gói đặc biệt (dễ vỡ, giá trị cao)?** | → Bọc thêm foam, carton dày, đánh dấu FRAGILE → Phát sinh phí đóng gói → Cộng vào chi phí đơn | → Hàng thông thường: Đóng gói tiêu chuẩn, không phí phát sinh |
| **Nhiều đơn cùng 1 KH → gộp kiện?** | → Agent TQ gộp kiện tiết kiệm CBM → Cập nhật lại KL tính cước (có thể giảm) → Dán nhãn rõ từng đơn trong kiện gộp | → Mỗi đơn đóng kiện riêng: Dễ phân loại tại kho VN |
| **Phát hiện lỗi hàng khi đóng gói?** | → Tạo MHHIssue / Complaint → Dừng đóng gói item lỗi → Thông báo Sale → KH quyết định → Các item OK vẫn tiếp tục | → Tất cả hàng OK: Hoàn tất đóng gói → Chờ ghép container |

---

## GĐ 7: GHÉP CONTAINER (`CONSOLIDATION`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể |
|-----------|---------|-----------------|
| **Phòng XNK (3 người)** | Kế hoạch ghép container | Lập kế hoạch, tối ưu fill rate (20ft/40ft), book container hãng tàu (biển) hoặc xe (bộ), tạo manifest |
| **Agent TQ** | Thực hiện đóng hàng | Chuẩn bị hàng theo pick list, đóng container, niêm seal, chụp ảnh/video |
| **TP XNK** | Duyệt container plan | Duyệt kế hoạch ghép container |
| **Sale** | Báo khách | Thông báo KH hàng đã lên container, cập nhật số seal, ETD |

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Container đạt fill rate > 95%?** | → Tối ưu, tiết kiệm chi phí/CBM → TP XNK duyệt → Xuất container | → Fill rate thấp: Chờ thêm đơn hàng để ghép, hoặc xuất với fill rate thấp (chấp nhận chi phí cao). TP XNK quyết định dựa trên deadline KH |
| **Hàng không tương thích trong cùng container?** | → Hệ thống CẢNH BÁO (VD: hóa chất + thực phẩm) → Không cho ghép chung → Phải tách container riêng | → Hàng tương thích: Ghép bình thường, hệ thống suggest đơn phù hợp theo CBM còn trống |
| **Seal container bị phá khi kiểm tra?** | → DỪNG dỡ hàng ngay → Chụp ảnh, quay video evidence → Báo BGĐ, tạo incident report → Kiểm kê so với manifest → Tạo claim hãng tàu | → Seal nguyên vẹn: Dỡ hàng bình thường, kiểm tra số kiện vs manifest |
| **Container bị kẹt cửa khẩu (ON_HOLD_BORDER)?** | → Trạng thái đặc biệt: ON_HOLD_BORDER → Auto thông báo tất cả KH có hàng trong cont → XNK xử lý vấn đề → Có thể quay lại IN_TRANSIT hoặc chuyển ARRIVED | → Thông quan suôn sẻ: ARRIVED → CUSTOMS → COMPLETED |
| **Thiếu hàng so với manifest khi dỡ?** | → Ghi nhận số kiện thiếu → Check video đóng container → Tạo claim hãng tàu → Thông báo KH bị ảnh hưởng → Tạo Complaint | → Đủ kiện: Tiếp tục phân loại bình thường |

---

## GĐ 8: VẬN CHUYỂN (`IN_TRANSIT`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể |
|-----------|---------|-----------------|
| **Phòng XNK** | Theo dõi lộ trình | Theo dõi container TQ → Cảng/CK VN, cập nhật trạng thái, xử lý sự cố |
| **Sale** | Cập nhật khách | Thông báo KH tiến độ vận chuyển, ETA dự kiến |

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Tuyến vận chuyển?** | → **SEA** (đường biển): KL quy đổi /6000, 5-10 ngày, chi phí thấp. **ROAD** (đường bộ): /5000, 3-5 ngày, trung bình. **AIR** (hàng không): Nhanh nhất 1-3 ngày, chi phí cao | → KH không chỉ định: Sale tư vấn dựa trên khối lượng, độ gấp, ngân sách |
| **Delay do thời tiết / sự cố?** | → XNK cập nhật ETA mới → Auto notify tất cả KH → Sale chủ động liên hệ giải thích → Exception alert nếu > 24h stuck | → Đúng lịch trình: Cập nhật tracking bình thường, KH theo dõi qua Portal |
| **Container bị tạm giữ / kiểm tra đặc biệt?** | → XNK phối hợp HQ xử lý → Có thể cần bổ sung chứng từ → Thông báo BGĐ nếu nghiêm trọng → Đơn liên quan → ON_HOLD | → Không có vấn đề: Container tiếp tục đến cảng/CK VN |

---

## GĐ 9: THÔNG QUAN (`CUSTOMS`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể | SLA |
|-----------|---------|-----------------|-----|
| **Phòng XNK** | Khai báo + Thủ tục HQ | Khai báo HQ điện tử (VNACCS/VCIS), xử lý phân luồng, lấy D/O, phối hợp xe cảng/CK → kho TBS, báo Trưởng kho VN | **≤ 2 ngày làm việc**. SAU bước 9.9 → XNK HẾT TRÁCH NHIỆM |
| **KT Thanh toán** | Nộp thuế | Nhận thông báo từ XNK, trình BGĐ chi tiền thuế, nộp thuế NK + VAT, duyệt phiếu chi customs | **≤ 2 giờ** |
| **Sale** | Phiếu chi + cập nhật KH | Tạo phiếu chi customs (gắn đơn hàng), cập nhật KH tiến độ | — |
| **KT Chi phí VN** | Ghi chi phí | Ghi CP vận tải cảng/CK → kho | — |
| **BGĐ/COO** | Chi tiền thuế | Duyệt chi tiền thuế NK + VAT | **4-8 giờ** |

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Phân luồng hải quan?** | → **LUỒNG XANH:** Thông quan tự động, ≤ 1 ngày. **LUỒNG VÀNG:** Kiểm tra chứng từ, 1-2 ngày. **LUỒNG ĐỎ:** Kiểm tra thực tế hàng hóa, 2-5 ngày, có thể phát sinh phí | → Kiểm tra phát hiện sai lệch: Khai không đúng → Phạt. Hàng cấm/hạn chế → HQ tạm giữ. Trạng thái kiện: CONFISCATED_BY_CUSTOMS. Thông báo KH + BGĐ |
| **Hàng bị hải quan tạm giữ?** | → Trạng thái kiện: CONFISCATED_BY_CUSTOMS → XNK phối hợp HQ giải quyết → Bổ sung giấy phép/chứng từ → Đơn → ON_HOLD → Không giải quyết được: CANCELLED | → Thông quan thành công: XNK lấy D/O → Xe cảng/CK → kho TBS → Báo Trưởng kho VN: hàng sắp về |
| **Loại thông quan?** | → **CHÍNH NGẠCH:** Khai báo đầy đủ, đóng thuế NK + VAT (dịch vụ LCLCN, UTXNK). Phí cao hơn, bộ chứng từ đầy đủ. Nộp thuế: XNK báo → KT TT trình → BGĐ chi | → **TIỂU NGẠCH:** Quy trình đơn giản hơn, phù hợp hàng giá trị nhỏ |
| **Phát sinh phí bất thường (phạt, kiểm hàng)?** | → Sale tạo phiếu chi phát sinh (gắn đơn hàng) → Phê duyệt Extra Charge: KT TT → BGĐ → Cộng vào chi phí đơn → Thông báo KH nếu ảnh hưởng giá | → Không phí phát sinh: Chi phí thông quan theo kế hoạch |
| **RANH GIỚI XNK ↔ Trưởng kho VN** | → XNK: Phối hợp HQ cho xe cảng/CK → kho TBS (bước 9.9 — bước CUỐI CÙNG). XNK báo Trưởng kho VN (bước 9.10). **Sau đó XNK HẾT TRÁCH NHIỆM** | → Trưởng kho VN tiếp nhận: Nhận hàng tại kho, kiểm tra, phân loại, điều phối giao hàng nội địa |

---

## GĐ 10: NHẬP KHO VIỆT NAM (`WAREHOUSE_VN`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể | SLA |
|-----------|---------|-----------------|-----|
| **Trưởng kho VN (HN: Đông Anh, HCM: Hóc Môn)** | Quản lý nhập kho | Nhận hàng từ xe cảng/CK, dỡ container, scan verify, kiểm tra SL/CL, phân loại theo đơn, nhập kho | **≤ 24 giờ** |
| **NV Kho** | Thực hiện | Dỡ hàng, scan barcode, phân loại, xếp kho | — |
| **Sale** | Xử lý lỗi | Xử lý nếu hàng thiếu/hỏng/sai, liên hệ KH thông báo hàng đã về kho VN | — |
| **KT Chi phí VN** | Ghi chi phí | Ghi CP nhập kho, bốc dỡ, nhân công tạm | — |

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Số kiện thực tế khớp manifest?** | → Nhập kho bình thường → Phân loại theo đơn → Xếp kho / Giao ngay nếu KH gấp | → **Thiếu kiện:** Ghi nhận, check video đóng container, tạo claim/Complaint, thông báo KH. **Thừa kiện:** Kiểm tra hàng lạc danh, so sánh với Lost & Found kho TQ |
| **Chênh lệch cân nặng TQ vs VN > 5%?** | → Hệ thống CẢNH BÁO tự động → Trưởng kho kiểm tra lại → Nguyên nhân: hư hỏng, mất hàng một phần, đóng gói lại → Ghi nhận, điều tra | → Chênh lệch ≤ 5%: Chấp nhận (dung sai bình thường), tiếp tục flow |
| **KH cần giao gấp (dỡ express)?** | → Ưu tiên dỡ đơn gấp trước → Giao ngay không qua lưu kho → Có thể phát sinh phí giao gấp | → KH không gấp: Lưu kho chờ lên lịch giao theo batch tối ưu route |
| **Phát hiện hàng hư hỏng khi dỡ?** | → Chụp ảnh evidence ngay → Ghi nhận hệ thống → Tạo Complaint (loại DAMAGE) → Thông báo Sale → KH → Xử lý: Bồi thường / Claim hãng tàu / Hoàn trả NCC | → Hàng nguyên vẹn: Tiếp tục phân loại, nhập kho |
| **Hàng bị giữ lại do rủi ro cao?** | → Trạng thái kiện: HIGH_RISK_HOLD → Cần BGĐ / Trưởng kho duyệt mới xuất → Thông báo Sale xử lý | → Hàng bình thường (NORMAL): Sẵn sàng giao |

---

## GĐ 11: GIAO HÀNG (`DELIVERING`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể | SLA |
|-----------|---------|-----------------|-----|
| **Sale** | Hẹn khách + kiểm tra TT | Hẹn lịch giao, kiểm tra thanh toán với KT TT, xác nhận giao thành công | — |
| **KT Thanh toán** | Kiểm tra thanh toán | Xác nhận tình trạng thanh toán: Wallet → Credit limit → Cho giao hay chặn | — |
| **Trưởng kho VN** | ĐIỀU PHỐI giao hàng | Lên lịch giao, phân công lái xe, tạo phiếu xuất kho, kiểm tra kết quả | **Lên lịch ≤ 1 ngày. Giao ≤ 3 ngày** |
| **NV Kho** | Chuẩn bị hàng | Chuẩn bị hàng theo phiếu xuất | — |
| **Lái xe** | Giao + Thu COD | Vận chuyển, bàn giao, KH ký nhận, chụp POD, thu COD → nộp Trưởng kho → KT | COD enforcement: Chặn nếu chưa nộp > 24h |
| **KT Chi phí VN** | Ghi chi phí | Ghi CP giao hàng | — |

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Kiểm tra thanh toán trước giao** | → Bước 1: Tổng phải thu = Giá trị đơn - Đã cọc. Bước 2: Ví KH đủ → Trừ tự động → Cho giao. Bước 3: Ví không đủ → Kiểm tra Credit limit → Còn hạn mức → Ghi nợ AR → Cho giao | → **BỊ CHẶN GIAO** (hết hạn mức + Ví không đủ): Thông báo Sale liên hệ KH thanh toán. Trạng thái: Chờ thanh toán. Không tạo được phiếu xuất kho. Hàng lưu kho, tính phí lưu kho nếu quá hạn |
| **Giao hàng thành công?** | → Lái xe bàn giao đủ SL + CL → KH ký nhận → Chụp POD → Thu COD (nếu có) → Nộp Trưởng kho → KT → Sale xác nhận → Chuyển GĐ 12 | → **Giao thất bại (FAILED):** Lái xe BẮT BUỘC chọn lý do (KH vắng, từ chối, địa chỉ sai, hàng hỏng). Trạng thái: RETURN_TO_ORIGIN → RTO_RECEIVED. **Tính phí lưu kho: số ngày × 10,000 VND/ngày** cộng vào công nợ KH |
| **Giao hàng từng phần (Partial Delivery)?** | → Chọn một số kiện giao trước → isPartialDelivery = true → fulfillmentStatus: NONE → PARTIAL → Đơn chưa DELIVERED cho đến khi TẤT CẢ kiện đã giao → Tạo nhiều phiếu giao | → Giao toàn bộ: 1 phiếu = 1 đơn, fulfillmentStatus: NONE → FULL |
| **Thu COD → Tài xế thiếu tiền?** | → Dung sai ≤ 1% (COD_SHORTAGE_TOLERANCE). Thiếu > 1%: Tạm giữ, điều tra, trừ lương nếu không giải trình. **Chặn tài xế nhận lệnh mới nếu chưa nộp COD > 24h** | → COD đầy đủ: Xác nhận App, chụp ảnh biên nhận, nộp quỹ cuối ngày |
| **KH bom hàng (nhận nhưng không trả tiền)?** | → Ghi nhận hệ thống → Sale liên hệ thu hồi → Tái phạm: Blacklist + Auto-block KH | → KH thanh toán đầy đủ: Flow bình thường |
| **Giao nhiều điểm cùng container?** | → Trưởng kho tối ưu route theo khu vực → Group đơn theo quận/huyện → Phân công lái xe theo khu vực | → Chỉ 1 điểm: Giao trực tiếp |

---

## GĐ 12: QUYẾT TOÁN (`SETTLEMENT`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể | SLA |
|-----------|---------|-----------------|-----|
| **Sale** | Đối soát | Gửi bảng đối soát cho KT (trong 3 ngày sau giao), liên hệ KH thu hồi công nợ khi KT alert | **≤ 3 ngày sau giao** |
| **KT Thanh toán** | Đối soát + Thu CN | Đối soát phiếu thu/chi, nhắc Sale thu hồi CN, escalate CN theo mốc | — |
| **KT Tổng hợp** | Hạch toán + Hoa hồng | Hạch toán đơn, tính LN ròng, tính hoa hồng Sale (3% LN ròng), ghi bút toán lãi/lỗ tỷ giá | **≤ 5 ngày sau TT đủ** |

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **KH đã thanh toán đủ?** | → KT TT xác nhận → KT TH hạch toán → Tính LN ròng → Tính hoa hồng Sale (3%) → Chuyển GĐ 13 | → **KH còn nợ → AR aging:** Current (trong hạn), 1-30 ngày (Sale nhắc), 31-60 (+ Leader), 61-90 (+ GĐ KD), **> 90 ngày: Auto-block KH**. Escalation: > 15 ngày alert GĐ KD, > 30 ngày alert BGĐ |
| **Hoa hồng Sale?** | → < 1 triệu: Tự động duyệt. ≥ 1 triệu: Cần phê duyệt KT TH | → **Có khiếu nại REFUND/CREDIT:** Hoa hồng → ON_HOLD (tạm giữ, badge vàng + lý do). Xác nhận lỗi Sale: **CLAWBACK — tự động trừ lương tháng sau** |
| **Chênh lệch tỷ giá CNY/VND?** | → Tỷ giá chốt đơn ≠ Tỷ giá thanh toán → KT TH tính lãi/lỗ → Ghi bút toán Sổ cái → Cuối tháng: Đánh giá lại toàn bộ CN ngoại tệ | → Đơn chỉ VND: Không có chênh lệch tỷ giá |
| **KH có công nợ 2 chiều (AR + AP)?** | → Bù trừ công nợ (Debt Netting): AR vs AP cho cùng đối tác → Chỉ thanh toán phần chênh lệch → Tối thiểu 100K VND → Cần phê duyệt KT TH hoặc BGĐ | → Công nợ 1 chiều: Thu/Chi bình thường |
| **Phát sinh phí bổ sung sau giao?** | → Sale tạo Extra Charge → Phê duyệt Extra Charge Approval → Cộng vào chi phí đơn → Cập nhật AR nếu KH chịu | → Không phí phát sinh: Quyết toán theo chi phí đã plan |

---

## GĐ 13: HOÀN THÀNH (`COMPLETED`)

### Phòng ban tham gia

| Phòng ban | Vai trò | Nhiệm vụ cụ thể |
|-----------|---------|-----------------|
| **Hệ thống (tự động)** | Đóng đơn | Tự động chuyển COMPLETED khi hạch toán xong, tính hoa hồng, cập nhật KPI, thông báo Sale + Leader |
| **KT Tổng hợp** | Xác nhận | Xác nhận hạch toán hoàn tất, trigger tính hoa hồng |
| **BGĐ/COO** | Hoàn tác (nếu cần) | Chỉ BGĐ có quyền Hoàn tác: Chọn trạng thái quay về, nhập lý do. Hệ thống tự động cập nhật trạng thái, hoàn tác tồn kho, hoàn cọc Ví, ghi log |

### Xử lý các trường hợp

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Đơn hoàn thành bình thường?** | → Hệ thống tự động COMPLETED → Tính hoa hồng → Cập nhật KPI → Thông báo Sale + Leader → Cập nhật hạng KH nếu đủ điều kiện | → **BGĐ cần HOÀN TÁC:** Chỉ BGĐ có quyền. Chọn trạng thái quay về + nhập lý do bắt buộc. Hệ thống tự động: cập nhật trạng thái, hoàn tác tồn kho, hoàn cọc Ví, ghi log audit trail, thông báo các bên |
| **KH khiếu nại sau hoàn thành?** | → Tạo Complaint (QMS): DAMAGE / MISSING / DELAY / QUALITY / OTHER. Mức nghiêm trọng: LOW / MEDIUM / HIGH / CRITICAL. Flow: Reported → Investigating → Pending Resolution → Resolved → Closed. **Bồi thường:** ≤ 5tr: GĐ KD duyệt, ≤ 20tr: BGĐ, > 20tr: BGĐ + hội đồng | → Không khiếu nại: Đơn closed hoàn toàn, hoa hồng Sale được chi trả |
| **KH đủ điều kiện nâng hạng?** | → ≥ 10 đơn → REGULAR. ≥ 20 đơn → VIP. Hệ thống tự động đề xuất. Hạng mới áp dụng đơn tiếp theo (cọc giảm, credit limit tăng) | → Chưa đủ: Giữ hạng hiện tại |

---

# PHẦN 3: TRẠNG THÁI ĐẶC BIỆT

## HỦY ĐƠN (`CANCELLED`)

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Hủy ở GĐ 1-2 (chưa cọc)?** | → Sale yêu cầu → **Leader duyệt** → Hủy nhanh, không phát sinh chi phí → Ghi lý do | → Leader từ chối: Sale tiếp tục thuyết phục KH hoặc escalate GĐ KD |
| **Hủy ở GĐ 3 (đã cọc, chưa mua)?** | → Flow: Sale → Leader → **GĐ KD duyệt** → KT TT tính phí hủy → Hoàn cọc vào Wallet (trừ phí hủy) | → GĐ KD từ chối: Giữ đơn, Sale liên hệ KH giải quyết |
| **Hủy ở GĐ 4-6 (đã mua hàng)?** | → Flow: GĐ KD → **BGĐ duyệt** → Tính toàn bộ chi phí phát sinh (tiền hàng, ship nội địa TQ, đóng gói) → KH chịu chi phí → Phần cọc còn lại hoàn Wallet | → BGĐ từ chối: Đơn tiếp tục, KH chịu nhận hàng |
| **Hủy ở GĐ 7+ (đã xuất kho/vận chuyển)?** | → BGĐ quyết định **case by case** → Chi phí cực cao → Gần như không hoàn cọc → Cân nhắc hàng quay TQ hay giao VN | → Thường BGĐ khuyến khích không hủy: Tốt hơn là giao + thu tiền |

## TẠM GIỮ (`ON_HOLD`)

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Lý do tạm giữ?** | → Chờ KH thanh toán bổ sung, chờ giải quyết khiếu nại, chờ bổ sung chứng từ (UTXNK/LCLCN), hàng bị HQ tạm giữ. Có thể ON_HOLD từ bất kỳ giai đoạn nào | → Không cần tạm giữ: Đơn tiếp tục flow bình thường |
| **Giải quyết xong vấn đề?** | → Quay lại trạng thái trước ON_HOLD → Tiếp tục flow → Ghi log: Ai giữ, bao lâu, lý do, ai mở lại | → Không giải quyết được: Chuyển CANCELLED (cần phê duyệt) hoặc giữ ON_HOLD tiếp |

## TRẢ HÀNG (`RETURNED`)

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **KH trả hàng vì lỗi TBS?** | → Tạo Complaint, xác nhận lỗi → Thu hồi, giao lại hàng đúng → Bồi thường nếu yêu cầu → TBS chịu CP vận chuyển trả | → KH trả vì lý do cá nhân: KH chịu phí vận chuyển trả + phí restocking. Hoàn tiền sau trừ phí |
| **Hàng trả về kho VN?** | → Trưởng kho nhận, kiểm tra → Cập nhật tồn kho → Tính phí lưu kho RTO: 10,000 VND/ngày → Cộng vào công nợ KH | → Hàng trả về kho TQ (MHH): Agent TQ nhận → Liên hệ NCC hoàn trả → Hoàn tiền Wallet KH (REFUNDED) |

## CÓ VẤN ĐỀ (`ISSUE`)

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Loại sự cố MHH?** | → **OUT_OF_STOCK:** Hết hàng → Tìm NCC khác / Hủy item. **WRONG_ITEM:** Giao sai → Đổi/Hoàn. **DAMAGED:** Hàng hỏng → Claim NCC. **INCOMPLETE:** Thiếu → Giao bổ sung. **QUALITY:** Kém → KH quyết định Keep/Return. **PRICE_CHANGE:** NCC đổi giá → KH đồng ý/Hủy. **DELAY:** Giao chậm → Đợi/Hủy/Đổi NCC | → Không phải MHH: Tạo Complaint qua QMS (DAMAGE, MISSING, DELAY, QUALITY, OTHER). Auto-escalate sau 24h |
| **Mức nghiêm trọng?** | → **LOW:** Sale tự xử lý. **MEDIUM:** Leader hỗ trợ. **HIGH:** GĐ KD. **CRITICAL:** BGĐ trực tiếp | → Escalation tự động theo SLA: Quá 24h chưa phản hồi → Lên cấp. Gợi ý giải pháp từ case tương tự |

---

# PHẦN 4: QUY TẮC XUYÊN SUỐT MỌI GIAI ĐOẠN

| Điều kiện / Tình huống | Nếu CÓ | Nếu KHÔNG / Xử lý khác |
|------------------------|---------|------------------------|
| **Phiếu thu/chi PHẢI gắn đơn hàng?** | → Đúng: Hệ thống cho phép tạo. Mọi phiếu liên kết 1:1 với đơn | → Thiếu mã đơn hàng: Hệ thống **BLOCK**, không cho tạo |
| **Người tạo phiếu = Sale owner đơn?** | → Đúng: Cho phép tạo | → Sai owner: Hệ thống **BLOCK**. Chỉ Sale phụ trách đơn mới tạo được |
| **Tỷ giá CNY: Tự động hay Thủ công?** | → **CNY: KT Trưởng đặt THỦ CÔNG** hàng ngày. Vô hiệu hóa sync tự động. Ghi nhật ký kiểm toán: ai đặt, lúc nào, giá trị cũ/mới | → **USD: Lấy TỰ ĐỘNG** từ Vietcombank, cache TTL 1 giờ, KT Trưởng có thể override |
| **KH bị Auto-block (nợ > 90 ngày)?** | → Hệ thống tự động block → Không tạo đơn mới → Chặn giao hàng đang xử lý → Thông báo Sale + Leader + BGĐ | → Muốn mở block: KH thanh toán hết nợ quá hạn, hoặc BGĐ override (gia hạn công nợ) |
| **Sale nghỉ / chuyển công tác?** | → Leader reassign đơn/khách trong nhóm. Leader nghỉ → GĐ KD reassign. Chuyển giữa nhóm/CN → GĐ KD thực hiện. Lịch sử vẫn gắn Sale cũ (audit trail) | → Sale hoạt động bình thường: Tự quản lý đơn/khách |
| **Phê duyệt quá SLA (> 24h)?** | → **Auto-escalate** lên cấp trên. VD: Leader quá hạn → GĐ KD, GĐ KD quá hạn → BGĐ. Ghi nhận vào KPI người duyệt | → Duyệt trong SLA: Flow tiếp tục bình thường |
| **Người duyệt vắng mặt?** | → Có thể **DELEGATE** quyền duyệt cho người khác. Ghi log ai delegate cho ai, thời gian. Người được delegate có đầy đủ quyền tạm thời | → Không delegate: Auto-escalate theo SLA hoặc chờ quay lại |

---

# PHẦN 5: TỔNG HỢP MA TRẬN PHÊ DUYỆT

| Hành động | Ai duyệt | Flow |
|-----------|----------|------|
| Báo giá chuẩn (bảng giá) | Không cần | Sale tự quyết |
| Giảm giá ≤ 3% | Leader + KT TT đồng duyệt | Sale → Leader + KT TT |
| Giảm giá > 3% | Leader + KT TT → GĐ KD | 3 cấp |
| Giảm giá > 5% / Đơn > 100tr | Leader + KT TT → GĐ KD → BGĐ | 4 cấp (tối đa) |
| Phiếu thu | KT TT | Sale → KT TT |
| Phiếu chi (mọi giá trị) | KT TT → BGĐ chi tiền | Sale → KT TT → BGĐ |
| Phiếu chi > 50 triệu | KT TT → KT TH → BGĐ | +1 cấp |
| Nộp thuế | KT TT → BGĐ chi | XNK thông báo |
| Miễn/Giảm cọc | BGĐ | Sale → Leader → BGĐ |
| Gia hạn công nợ | KT TT + BGĐ | Sale → KT TT → BGĐ |
| Hủy đơn (chưa cọc) | Leader | Sale → Leader |
| Hủy đơn (đã cọc) | Leader + GĐ KD | Sale → Leader → GĐ KD |
| Hủy đơn (đã mua hàng+) | GĐ KD + BGĐ | Sale → Leader → GĐ KD → BGĐ |
| Bồi thường | BGĐ | Sale → Leader → GĐ KD → BGĐ |
| Container plan | TP XNK | XNK → TP XNK |
| Xuất kho giao hàng | Trưởng kho | NV kho → Trưởng kho |

---

# PHẦN 6: TỔNG HỢP SLA

| Hành động | SLA | Alert nếu vượt |
|-----------|-----|----------------|
| CSKH phản hồi data | ≤ 15 phút | GĐ KD |
| Sale liên hệ sau assign | ≤ 2 giờ | Leader |
| Tạo báo giá | ≤ 4 giờ (HC) | Leader |
| Leader duyệt giảm giá | ≤ 2 giờ | GĐ KD |
| KT TT đồng duyệt | ≤ 2 giờ | KT TH |
| GĐ KD duyệt | ≤ 4 giờ | BGĐ |
| BGĐ duyệt / chi tiền | ≤ 4-8 giờ | — |
| KT TT duyệt phiếu | ≤ 2 giờ | KT TH |
| XNK check HS code | ≤ 4 giờ | TP XNK |
| Agent TQ nhập kho | ≤ 24 giờ | Sale |
| Sale verify agent | ≤ 4 giờ | Leader |
| Thông quan | ≤ 2 ngày LV | TP XNK |
| Kho VN nhập kho | ≤ 24 giờ | Trưởng kho |
| Trưởng kho lên lịch giao | ≤ 1 ngày sau nhập | Trưởng kho |
| Giao hàng | ≤ 3 ngày sau nhập | Trưởng kho + Sale |
| Sale gửi đối soát | ≤ 3 ngày sau giao | Leader |
| KT TH hạch toán | ≤ 5 ngày sau TT đủ | BGĐ |

---

# PHẦN 7: PHÂN QUYỀN DỮ LIỆU (DATA ISOLATION)

| Vai trò | Phạm vi dữ liệu | Ghi chú |
|---------|-----------------|---------|
| **Sale** | Đơn/khách **CỦA MÌNH** | Không xem đơn/khách Sale khác |
| **Leader** | Đơn/khách **NHÓM** (3-5 Sale) | Reassign trong nhóm |
| **GĐ Kinh doanh** | **TẤT CẢ** 2 chi nhánh | Reassign Sale giữa nhóm/CN |
| **BGĐ/COO** | **TẤT CẢ** | Override mọi cấp |

---

*Tài liệu phản ánh cơ cấu thực tế TBS Group tháng 3/2026.*
*Bản chính thức cho development team thiết kế TBS ERP.*
