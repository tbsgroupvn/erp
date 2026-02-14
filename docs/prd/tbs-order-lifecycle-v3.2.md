# TBS GROUP — ORDER LIFECYCLE SPECIFICATION v3.2
## Đặc tả Vòng đời Đơn hàng (Cơ cấu thực tế TBS — Bản chính thức)

> **Phiên bản:** 3.2 — Bỏ cấp TP KD, cơ cấu KD 3 cấp: Sale → Leader → GĐ KD
> **Ngày:** Tháng 2/2026
> **Người soạn:** COO — Trần Quốc Huy
> **Mục đích:** Làm cơ sở xây dựng module Order Management trong hệ thống TBS ERP
> **Thay đổi so với v3.1:**
> - Bỏ cấp Trưởng phòng Kinh doanh (TP KD)
> - Cơ cấu KD 3 cấp: Sale → Leader → GĐ Kinh doanh
> - Leader báo cáo trực tiếp GĐ KD
> - Flow phê duyệt giảm giá rút gọn 1 cấp

---

# PHẦN A: CƠ CẤU TỔ CHỨC THAM GIA ĐƠN HÀNG

## A1. Sơ đồ tổ chức thực tế TBS (~50 người liên quan đến đơn hàng)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BAN GIÁM ĐỐC (BGĐ)                             │
│                  COO / CEO — Phê duyệt cấp cao, chi tiền              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              KHỐI KINH DOANH (~35-40 người)                      │  │
│  │                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │        GIÁM ĐỐC KINH DOANH (GĐ KD) — 1 người             │  │  │
│  │  │  Quản lý kinh doanh cả 2 chi nhánh (HN + HCM)            │  │  │
│  │  │  Chiến lược, đào tạo, điều phối, phê duyệt               │  │  │
│  │  └──────────────┬─────────────────────────────────────────────┘  │  │
│  │                 │                                                │  │
│  │    ┌────────────┼────────────┬────────────┬──────────┐          │  │
│  │    ▼            ▼            ▼            ▼          ▼          │  │
│  │  Leader 1    Leader 2    Leader 3    Leader 4    Leader N       │  │
│  │  (HN)        (HN)        (HCM)       (HCM)      ...           │  │
│  │  3-5 Sale    3-5 Sale    3-5 Sale    3-5 Sale                  │  │
│  │    │            │            │            │                     │  │
│  │  Sale...     Sale...     Sale...     Sale...                   │  │
│  │                                                                  │  │
│  │  Tổng Sale: 25 hiện tại → mục tiêu 40-50                       │  │
│  │                                                                  │  │
│  │  ┌────────────┐   ┌──────────┐                                   │  │
│  │  │ MARKETING  │──▶│  CSKH    │──▶ Data → Sale qua CRM           │  │
│  │  │ (3 người)  │   │ (1-2     │                                   │  │
│  │  │ TikTok/FB/ │   │  người)  │                                   │  │
│  │  │ YouTube    │   │          │                                   │  │
│  │  └────────────┘   └──────────┘                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐       │
│  │  PHÒNG XNK       │  │  KẾ TOÁN (3 người)                  │       │
│  │  (3 người)       │  │                                      │       │
│  │                  │  │  KT Tổng hợp (1):  Hạch toán, tỷ    │       │
│  │ • Ghép container │  │    giá, hoa hồng                     │       │
│  │ • Book tàu/xe    │  │  KT Thanh toán (1): Duyệt phiếu,   │       │
│  │ • Theo dõi lộ    │  │    công nợ, HĐ GTGT, trình BGĐ chi  │       │
│  │   trình          │  │  KT Chi phí VN (1): Vận tải, thuê   │       │
│  │ • Khai báo HQ    │  │    xe, chi phí ngoài                 │       │
│  │ • Check HS code  │  └──────────────────────────────────────┘       │
│  │ • Thủ tục NK/XK  │                                                 │
│  │ • Phối hợp HQ    │                                                 │
│  │   → xe cảng/CK   │                                                 │
│  │   về kho          │                                                 │
│  │                  │                                                 │
│  │ ⛔ KHÔNG điều    │                                                 │
│  │   phối giao hàng │                                                 │
│  │   nội địa        │                                                 │
│  └──────────────────┘                                                 │
│                                                                        │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │  KHO VIỆT NAM + GIAO HÀNG (Trưởng kho điều phối giao hàng)  │     │
│  │                                                               │     │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐    │     │
│  │  │ KHO HÀ NỘI (Đông Anh)  │  │ KHO HCM (Hóc Môn)      │    │     │
│  │  │                         │  │                         │    │     │
│  │  │ Trưởng kho HN:          │  │ Trưởng kho HCM:         │    │     │
│  │  │ • Quản lý kho           │  │ • Quản lý kho           │    │     │
│  │  │ • ĐIỀU PHỐI giao hàng   │  │ • ĐIỀU PHỐI giao hàng   │    │     │
│  │  │ • Phân công lái xe      │  │ • Phân công lái xe      │    │     │
│  │  │ • Đảm bảo đúng hẹn,    │  │ • Đảm bảo đúng hẹn,    │    │     │
│  │  │   đủ SL, chất lượng    │  │   đủ SL, chất lượng    │    │     │
│  │  │ • Thu hồi COD           │  │ • Thu hồi COD           │    │     │
│  │  │                         │  │                         │    │     │
│  │  │ NV kho: 3 người         │  │ NV kho: 1 người         │    │     │
│  │  │ + thuê theo giờ/cont   │  │ + thuê theo giờ/cont   │    │     │
│  │  │                         │  │                         │    │     │
│  │  │ Lái xe: 1 in-house     │  │ Lái xe: đối tác thuê   │    │     │
│  │  │ + đối tác thuê ngoài   │  │ ngoài                   │    │     │
│  │  └─────────────────────────┘  └─────────────────────────┘    │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                        │
│  ┌──────────────────────────┐                                          │
│  │  KHO TRUNG QUỐC          │                                         │
│  │  (Agent thuê ngoài       │                                         │
│  │   người Trung Quốc)      │                                         │
│  │  Nghĩa Ô + Bằng Tường   │                                         │
│  │  ⚠ Không phải NV TBS     │                                         │
│  └──────────────────────────┘                                          │
└────────────────────────────────────────────────────────────────────────┘
```

## A2. Cấu trúc Phòng Kinh doanh — 3 cấp quản lý

```
GĐ Kinh doanh (1 người) ─── Cấp 3: Quản lý KD cả 2 chi nhánh
    │
    ├── Leader HN Team 1 (3-5 Sale) ─── Cấp 2
    │   ├── Sale A
    │   ├── Sale B
    │   └── Sale C
    │
    ├── Leader HN Team 2 (3-5 Sale)
    │   └── Sale D, E, F...
    │
    ├── Leader HCM Team 1 (3-5 Sale)
    │   └── Sale G, H, I...
    │
    └── Leader HCM Team N...

Cấp 1: Sale (nhân viên) ─── Cấp thực thi
```

**Không có cấp Trưởng phòng Kinh doanh (TP KD). Leader báo cáo trực tiếp GĐ KD.**

## A3. Mô tả chi tiết từng vai trò

---

### 1. MARKETING (3 người) — Lead Generation

| Hạng mục | Chi tiết |
|----------|---------|
| **Số lượng** | 3 người |
| **Bản chất** | **Tạo nguồn khách (Lead Gen)** — Đầu phễu, không tham gia đơn hàng |
| **Nhiệm vụ** | Chạy quảng cáo TikTok, Facebook, YouTube. Sản xuất content. Quản lý MXH. Tối ưu CPL |
| **Output** | Data khách hàng: tin nhắn nền tảng, gọi điện, Zalo, form website |
| **Quyền hệ thống** | Xem dashboard marketing (lead, CPL, chuyển đổi). Không truy cập module đơn hàng |
| **KPI** | Số lead/ngày, CPL, chất lượng lead (tỷ lệ chuyển đổi sang đơn) |

---

### 2. CSKH (1-2 người) — Intake & Qualification

| Hạng mục | Chi tiết |
|----------|---------|
| **Số lượng** | 1-2 người |
| **Bản chất** | **Intake + Qualify + Handoff** — Cửa ngõ duy nhất tiếp nhận data |
| **Nhiệm vụ** | Liên hệ lại data, khai thác sơ bộ, nhập CRM, chuyển Sale, tạo nhóm Zalo |
| **Tham gia** | Chỉ Giai đoạn 1. Sau khi chuyển Sale → CSKH KHÔNG tham gia nữa |
| **Quyền hệ thống** | Tạo lead, nhập thông tin khách, assign Sale. Không truy cập đơn hàng |
| **KPI** | Thời gian phản hồi data, tỷ lệ qualify, số lead xử lý/ngày |

---

### 3. GIÁM ĐỐC KINH DOANH — GĐ KD (1 người) — Cấp 3 (cao nhất phòng KD)

| Hạng mục | Chi tiết |
|----------|---------|
| **Số lượng** | 1 người |
| **Bản chất** | **Quản lý kinh doanh cao nhất** — Quản lý trực tiếp tất cả Leader ở cả 2 chi nhánh HN + HCM |
| **Nhiệm vụ** | Phát triển chiến lược KD toàn công ty. Điều phối đội ngũ Leader cả 2 CN. **Đào tạo nhân lực** (onboarding, coaching Leader). Thiết lập KPI, chính sách giá, hoa hồng. Xử lý các trường hợp Leader không giải quyết được. Quản lý khách hàng chiến lược. Phối hợp BGĐ/COO về mục tiêu doanh thu |
| **Quyền hệ thống** | Xem toàn bộ dữ liệu KD 2 CN. Phê duyệt: giảm giá > 3%, đơn lớn, khách VIP, chính sách. Dashboard doanh thu + LN tổng. Quản lý nhân sự (assign/reassign Sale giữa các nhóm/CN) |
| **Phê duyệt** | Giảm giá > 3%, đơn > 100 triệu, hủy đơn, khiếu nại lớn, case Leader escalate |

---

### 4. LEADER — Trưởng nhóm Kinh doanh (nhiều người) — Cấp 2

| Hạng mục | Chi tiết |
|----------|---------|
| **Số lượng** | Nhiều Leader (mỗi Leader quản lý 3-5 Sale) |
| **Báo cáo cho** | **GĐ Kinh doanh** (trực tiếp, không qua TP KD) |
| **Bản chất** | **Quản lý trực tiếp nhóm Sale** — Cấp duyệt đầu tiên, sát thực tế nhất |
| **Nhiệm vụ** | Quản lý trực tiếp 3-5 Sale. Hỗ trợ Sale xử lý đơn phức tạp. **Duyệt giảm giá cấp đầu tiên** (đồng duyệt với KT TT). Giám sát KPI nhóm. Coaching Sale hàng ngày. Escalate GĐ KD khi không xử lý được |
| **Quyền hệ thống** | Xem tất cả đơn/khách của Sale trong nhóm. Duyệt giảm giá ≤ 3% (đồng duyệt KT TT). Xem báo cáo nhóm. Reassign khách/đơn trong nhóm |
| **KPI** | Doanh thu nhóm, số đơn, tỷ lệ thu hồi CN, tỷ lệ chốt |

**Flow escalation:**
```
Sale gặp vấn đề
    │
    ▼
Leader giải quyết được?
    ├── Được → Leader xử lý + duyệt
    └── Không → Escalate GĐ KD
              │
              ├── GĐ KD giải quyết được?
              │   ├── Được → GĐ KD xử lý
              │   └── Không → Escalate BGĐ/COO
              │
              └── Nghiêm trọng → BGĐ/COO trực tiếp
```

---

### 5. SALE (25 người, lên 40-50) — Order Owner — Cấp 1

| Hạng mục | Chi tiết |
|----------|---------|
| **Số lượng** | Hiện tại: 25. Mục tiêu: 40-50 |
| **Bản chất** | **Chủ đơn hàng (Order Owner)** — Chịu trách nhiệm xuyên suốt |
| **Báo cáo cho** | Leader (trực tiếp) → GĐ KD |
| **Tham gia** | Gần như tất cả giai đoạn (trừ vận hành kho & logistics) |
| **Quyền hệ thống** | Tạo đơn, báo giá, HĐ, phiếu thu/chi **(bắt buộc gắn đơn hàng)**. Xem đơn & CN khách mình. Không xem đơn/khách Sale khác |
| **KPI** | Doanh thu, số đơn, tỷ lệ chốt, thu hồi CN, LN đơn, hoa hồng |

**Nhiệm vụ Sale (giữ nguyên v3.1):**

| Nhóm | Nhiệm vụ |
|------|----------|
| Tư vấn & Tìm NCC | Nhận khách từ CSKH, tư vấn, tìm NCC TQ, thương lượng, so sánh NCC |
| Báo giá & HĐ | Báo giá tổng, soạn HĐ, gửi khách, đàm phán, chốt |
| Xác nhận & Cọc | Tạo đơn, nhắc cọc, tạo phiếu thu → KT duyệt |
| Mua hàng | Đặt hàng NCC, thanh toán, tạo phiếu chi → KT duyệt → BGĐ chi |
| Theo dõi | Monitor đơn qua hệ thống, cập nhật khách |
| Tài chính | Tạo phiếu thu/chi **(gắn đơn hàng bắt buộc)**, đối soát |
| Thu hồi CN | Khi KT alert → liên hệ khách thu hồi |
| Khiếu nại | Tiếp nhận, phối hợp xử lý → Leader/GĐ KD duyệt |

---

### 6. PHÒNG XNK (3 người) — Logistics Operations + Compliance

*(Giữ nguyên v3.1)*

| Hạng mục | Chi tiết |
|----------|---------|
| **Số lượng** | 3 người |
| **Bản chất** | Vận hành logistics quốc tế + Tuân thủ thương mại |
| **Tham gia** | GĐ 7-9 + hỗ trợ check HS code |

| Nhiệm vụ | Phạm vi |
|-----------|---------|
| Check HS code | Xác định mã HS, thuế suất, tư vấn Sale |
| Thủ tục XK TQ | Quy định XK TQ, hỗ trợ agent chứng từ |
| Thủ tục NK VN | Giấy phép, CO, CQ, kiểm dịch |
| Ghép container | Plan, fill rate, manifest |
| Booking tàu/xe | Hãng tàu (biển), xe (bộ) |
| Theo dõi lộ trình | TQ → Cảng/CK VN |
| Khai báo HQ | VNACCS/VCIS, phân luồng |
| **Phối hợp HQ cho xe cảng/CK → kho** | **Điểm cuối phạm vi XNK** |
| ⛔ KHÔNG giao hàng nội địa | Trưởng kho đảm nhận |

**Ranh giới XNK ↔ Trưởng kho:**
```
  XNK: Ghép cont → Book → Vận chuyển → HQ → Xe cảng/CK → Kho TBS
                                                            │
                                                ────────────┤ RANH GIỚI
                                                            │
  Trưởng kho: Nhận hàng → Kiểm tra → Nhập kho → Giao khách → Thu COD
```

---

### 7. KẾ TOÁN (3 người)

#### 7a. KT Tổng hợp (1 người) — Chief Accountant / TP Kế toán

| Hạng mục | Chi tiết |
|----------|---------|
| **Nhiệm vụ** | Tổng thể tài chính. Đổi tệ CNY/USD. Duyệt hạch toán → tính LN + hoa hồng. Báo cáo. Giám sát 2 KT |
| **Tham gia GĐ** | GĐ 12-13: Hạch toán, LN, hoa hồng |

#### 7b. KT Thanh toán (1 người)

| Hạng mục | Chi tiết |
|----------|---------|
| **Nhiệm vụ** | Duyệt phiếu thu/chi. Trình BGĐ chi tiền. **Đồng duyệt giảm giá với Leader.** Duyệt công nợ. Xuất HĐ GTGT. Nhắc Sale CN |
| **Tham gia GĐ** | GĐ 2 (đồng duyệt giảm giá), 3 (cọc), 4 (chi mua hàng), 9 (thuế), 12 (quyết toán) |

#### 7c. KT Chi phí VN (1 người)

| Hạng mục | Chi tiết |
|----------|---------|
| **Nhiệm vụ** | CP vận tải nội địa, thuê xe/nâng, nhân công tạm, chi phí ngoài |
| **Tham gia GĐ** | GĐ 9-11: CP cảng→kho, CP giao hàng, phát sinh |

---

### 8. KHO TQ — Agent thuê ngoài

*(Giữ nguyên v3.1 — Agent người TQ, interface riêng song ngữ, phân quyền chặt, Sale verify)*

---

### 9. KHO VN + GIAO HÀNG — Trưởng kho chi nhánh quản lý

*(Giữ nguyên v3.1)*

| Hạng mục | Chi tiết |
|----------|---------|
| **Số lượng** | HN: Trưởng kho + 3 NV + thuê thêm. HCM: Trưởng kho + 1 NV + thuê thêm |
| **Bản chất** | Kho vận + Giao hàng last-mile — Trưởng kho quản lý toàn bộ |

**Trưởng kho — Vai trò kép:**

| Nhóm | Chi tiết |
|------|---------|
| Quản lý kho | Nhận hàng, kiểm tra, nhập kho, vị trí, tồn kho, thuê nhân sự tạm |
| Điều phối giao hàng | Lên lịch giao, phân công lái xe, tối ưu route, đảm bảo đúng hẹn/đủ SL/CL, giám sát COD |
| Quản lý lái xe | Phân công chuyến, theo dõi giao, kiểm tra POD, xử lý giao không thành công |

**Lái xe:** HN: 1 in-house + đối tác. HCM: đối tác. Điều phối bởi **Trưởng kho** (KHÔNG phải XNK).

---

### 10. Tổng hợp cấp quản lý

| Vai trò | Phê duyệt | Giám sát |
|---------|-----------|----------|
| **GĐ KD** (1 người) | Giảm giá > 3%, đơn > 100tr, hủy đơn, KN lớn, chính sách giá | **Tất cả Leader + Sale 2 CN** |
| **Leader** (nhiều) | Giảm giá ≤ 3% (đồng duyệt KT TT), hỗ trợ Sale | 3-5 Sale trực tiếp |
| **TP XNK** | Container plan, sự cố HQ/vận tải | 3 NV XNK |
| **KT TH** (= TP KT) | Hạch toán, tỷ giá, hoa hồng | 2 KT |
| **Trưởng kho** (2 CN) | Nhập/xuất kho, điều phối giao hàng | NV kho + lái xe |

### 11. BGĐ — COO/CEO

| Hạng mục | Chi tiết |
|----------|---------|
| **Vai trò** | Phê duyệt cấp cao. **Chi tiền** (sau KT TT trình). Chính sách. Dashboard |
| **Quyền** | Full access. Override mọi cấp |

---

# PHẦN B: VÒNG ĐỜI ĐƠN HÀNG — TỔNG QUAN

## B1. Flow tổng thể

```
═══════════════════════════════════════════════════════════
  MARKETING → CSKH → SALE
═══════════════════════════════════════════════════════════

  [MKT] → [CSKH] → [Sale nhận khách]

  ① TIẾP NHẬN → ② BÁO GIÁ → ③ CỌC → ④ MUA HÀNG

═══════════════════════════════════════════════════════════
  AGENT TQ
═══════════════════════════════════════════════════════════

  ⑤ NHẬP KHO TQ → ⑥ ĐÓNG GÓI

═══════════════════════════════════════════════════════════
  XNK (kết thúc khi hàng về kho VN)
═══════════════════════════════════════════════════════════

  ⑦ GHÉP CONT → ⑧ VẬN CHUYỂN → ⑨ THÔNG QUAN
                                       │
                              Xe cảng/CK → Kho TBS
                                       │
                          ─────────────┤
                                       │
═══════════════════════════════════════════════════════════
  TRƯỞNG KHO VN (nhận hàng + giao hàng)
═══════════════════════════════════════════════════════════
                                       │
  ⑩ NHẬP KHO VN → ⑪ GIAO HÀNG (Trưởng kho + Lái xe)

═══════════════════════════════════════════════════════════
  QUYẾT TOÁN
═══════════════════════════════════════════════════════════

  ⑫ ĐỐI SOÁT (Sale + KT) → ⑬ HOÀN THÀNH (Hệ thống)
```

## B2. Bảng tổng hợp

| # | Giai đoạn | Mã | Thực hiện | Sale | Duyệt |
|---|-----------|-----|-----------|------|-------|
| 1 | Tiếp nhận | `CONSULTING` | CSKH → Sale | Nhận khách, tư vấn | — |
| 2 | Báo giá | `QUOTATION` | **Sale** | Tìm NCC, báo giá, HĐ | Leader+KT TT (giảm giá) |
| 3 | Cọc | `PENDING_DEPOSIT` | **Sale** | Tạo đơn, nhắc cọc | KT TT duyệt phiếu |
| 4 | Mua hàng | `SOURCING` | **Sale**+Agent TQ | Đặt hàng, TT NCC | KT TT duyệt, BGĐ chi |
| 5 | Nhập kho TQ | `WAREHOUSE_CN` | Agent TQ | Verify số liệu | Agent xác nhận |
| 6 | Đóng gói | `PACKING` | Agent TQ | Yêu cầu ĐB | Agent xác nhận |
| 7 | Ghép cont | `CONSOLIDATION` | XNK+Agent TQ | Báo khách | TP XNK |
| 8 | Vận chuyển | `IN_TRANSIT` | XNK | Cập nhật khách | — |
| 9 | Thông quan | `CUSTOMS` | XNK+KT | Báo khách | KT TT+BGĐ |
| 10 | Nhập kho VN | `WAREHOUSE_VN` | Kho VN | Xử lý lỗi | Trưởng kho |
| 11 | Giao hàng | `DELIVERING` | **Trưởng kho**+Lái xe | Hẹn khách, confirm | Khách ký+Sale |
| 12 | Quyết toán | `SETTLEMENT` | **Sale**+KT | Đối soát, thu CN | KT TT+KT TH |
| 13 | Hoàn thành | `COMPLETED` | Hệ thống | — | KT TH→hoa hồng |

---

# PHẦN C: CHI TIẾT CÁC GIAI ĐOẠN CÓ THAY ĐỔI

*(GĐ 1-8, 10, 12-13: Giữ nguyên v3.1)*

---

## GĐ 9: THÔNG QUAN (`CUSTOMS`)

*(Giữ nguyên v3.1 — XNK phối hợp HQ cho xe cảng/CK → kho, dừng tại đây)*

| # | Công việc | Người | Bắt buộc? |
|---|-----------|-------|-----------|
| 9.1 | Khai báo HQ điện tử | **XNK** | ✅ |
| 9.2 | Xử lý phân luồng | **XNK** | ✅ |
| 9.3 | Báo KT nộp thuế | **XNK → KT TT** | ✅ |
| 9.4 | KT TT trình BGĐ chi thuế | **KT TT → BGĐ** | ✅ |
| 9.5 | Nộp thuế NK + VAT | **KT TT** | ✅ |
| 9.6 | Sale tạo phiếu chi customs (gắn đơn hàng) | **Sale** | ✅ |
| 9.7 | KT TT duyệt phiếu chi | **KT TT** | ✅ |
| 9.8 | Lấy D/O | **XNK** | ✅ |
| 9.9 | **XNK phối hợp HQ cho xe chạy cảng/CK → kho TBS** | **XNK** | ✅ |
| 9.10 | **XNK báo Trưởng kho VN: hàng sắp về** | **XNK → Trưởng kho** | ✅ |
| 9.11 | KT CP VN ghi CP vận tải cảng→kho | **KT CP VN** | ✅ |
| 9.12 | Sale cập nhật khách | **Sale** | ✅ |

⛔ Sau 9.9, khi hàng đến kho TBS → XNK hết trách nhiệm.

---

## GĐ 11: GIAO HÀNG (`DELIVERING`)

*(Giữ nguyên v3.1 — Trưởng kho điều phối)*

| # | Công việc | Người | Bắt buộc? |
|---|-----------|-------|-----------|
| 11.1 | Sale hẹn khách | **Sale** | ✅ |
| 11.2 | Kiểm tra thanh toán | **Sale + KT TT** | ✅ |
| 11.3 | **Trưởng kho lên lịch giao** | **Trưởng kho** | ✅ |
| 11.4 | **Trưởng kho phân công lái xe** | **Trưởng kho** | ✅ |
| 11.5 | NV kho chuẩn bị hàng | **NV Kho** | ✅ |
| 11.6 | Tạo phiếu xuất kho | **Trưởng kho** | ✅ |
| 11.7 | Vận chuyển | **Lái xe** | ✅ |
| 11.8 | Bàn giao — đảm bảo **đủ SL, chất lượng** | **Lái xe + Khách** | ✅ |
| 11.9 | Khách ký nhận | **Lái xe + Khách** | ✅ |
| 11.10 | Chụp POD | **Lái xe** | ✅ |
| 11.11 | **Thu COD** → nộp Trưởng kho → KT | **Lái xe** | Nếu COD |
| 11.12 | **Trưởng kho kiểm tra kết quả** | **Trưởng kho** | ✅ |
| 11.13 | Sale xác nhận giao thành công | **Sale** | ✅ |
| 11.14 | KT CP VN ghi CP giao hàng | **KT CP VN** | ✅ |

---

# PHẦN D: QUY TẮC PHÊ DUYỆT & KIỂM SOÁT

## D1. Phê duyệt giảm giá — 3 CẤP (Sale → Leader+KT → GĐ KD → BGĐ)

| Mức | Flow | Ghi chú |
|-----|------|---------|
| 0% (bảng giá) | Không cần duyệt | Sale tự quyết |
| ≤ 3% | Sale → **Leader + KT TT** đồng duyệt | 2 người duyệt song song |
| > 3% | Sale → Leader + KT TT → **GĐ KD** duyệt | 3 cấp |
| > 5% hoặc đơn > 100 triệu | Sale → Leader + KT TT → GĐ KD → **BGĐ/COO** | 4 cấp (tối đa) |

**Flow chi tiết:**
```
Sale đề xuất giảm giá (lý do trên hệ thống)
    │
    ▼
Leader + KT TT review song song:
    │
    ├── ≤ 3%:
    │   ├── Leader duyệt ✅ (hợp lý thị trường?)
    │   └── KT TT đồng duyệt ✅ (ảnh hưởng LN?)
    │   → XONG
    │
    └── > 3%:
        ├── Leader duyệt ✅
        ├── KT TT duyệt ✅
        └── → Escalate GĐ KD
              │
              ├── 3-5%: GĐ KD duyệt → XONG
              └── > 5% hoặc > 100tr: GĐ KD → BGĐ/COO

⚠ Hệ thống enforce: Không skip cấp. Tuần tự.
```

## D2. Phê duyệt chung (CẬP NHẬT — bỏ TP KD)

| Hành động | Ai duyệt | Flow |
|-----------|----------|------|
| Báo giá chuẩn (bảng giá) | Không cần | Sale tự quyết |
| Giảm giá ≤ 3% | **Leader + KT TT** đồng duyệt | Sale → Leader + KT TT |
| Giảm giá > 3% | Leader + KT TT → **GĐ KD** | 3 cấp |
| Giảm giá > 5% / Đơn > 100tr | Leader + KT TT → GĐ KD → **BGĐ** | 4 cấp |
| Phiếu thu | **KT TT** | Sale → KT TT |
| Phiếu chi (mọi giá trị) | **KT TT** → **BGĐ** chi tiền | Sale → KT TT → BGĐ |
| Phiếu chi > 50 triệu | KT TT → **KT TH** → BGĐ | +1 cấp |
| Nộp thuế | KT TT → BGĐ chi | XNK thông báo |
| Miễn/Giảm cọc | **BGĐ** | Sale → Leader → BGĐ |
| Gia hạn CN | KT TT + **BGĐ** | Sale → KT TT → BGĐ |
| Hạch toán đơn | **KT TH** | Auto trigger |
| Hủy đơn (chưa cọc) | **Leader** | Sale → Leader |
| Hủy đơn (đã cọc) | Leader + **GĐ KD** | Sale → Leader → GĐ KD |
| Hủy đơn (đã mua hàng+) | GĐ KD + **BGĐ** | Sale → Leader → GĐ KD → BGĐ |
| Bồi thường | **BGĐ** | Sale → Leader → GĐ KD → BGĐ |
| Container plan | **TP XNK** | XNK → TP XNK |
| Xuất kho giao hàng | **Trưởng kho** | NV kho → Trưởng kho |

## D3. Phiếu chi — Quy tắc chống gian lận

*(Giữ nguyên v3.1)*

**Yêu cầu bắt buộc:**

| Field | Enforce |
|-------|---------|
| Mã đơn hàng | BLOCK nếu thiếu |
| Loại chi phí (dropdown) | BLOCK nếu thiếu |
| Người thụ hưởng | BLOCK nếu thiếu |
| Lý do chi tiết (≥ 20 ký tự) | BLOCK nếu thiếu |
| Chứng từ (≥ 1 file) | BLOCK nếu thiếu |
| Người tạo = Sale owner đơn | Hệ thống enforce |

**Auto detection:**
```
🚨 BLOCK: Không gắn đơn / Đơn closed / Thiếu chứng từ / Sai owner
⚠ FLAG → Leader + KT TT:
  • Tổng chi > 90% doanh thu đơn
  • Chi "Phát sinh" > 5 triệu
  • Pattern phiếu chi nhỏ liên tiếp
  • NCC không trong approved list
  • Tạo ngoài giờ HC
📋 Audit trail: log mọi thao tác, không xóa, BGĐ/KT TH query bất kỳ lúc nào
```

---

# PHẦN E: PHÂN QUYỀN HỆ THỐNG

| Module | Sale | Leader | GĐ KD | XNK | KT TH | KT TT | KT CP | Agent TQ | Trưởng kho | Lái xe | BGĐ |
|--------|------|--------|-------|-----|-------|-------|-------|----------|-----------|--------|-----|
| Lead/CRM | Mình | Nhóm | All | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | All |
| Đơn hàng | Mình | Nhóm | All | Xem | TC | TT | CP | ⚠Hạn chế | Kho CN | Giao | All |
| Báo giá | Tạo | Duyệt | Duyệt | ❌ | ❌ | Đồng duyệt | ❌ | ❌ | ❌ | ❌ | Duyệt |
| Phiếu thu/chi | Tạo | Xem nhóm | All | ❌ | All | Duyệt | CP VN | ❌ | ❌ | ❌ | Chi tiền |
| Công nợ | Mình | Nhóm | All | ❌ | All | Duyệt | ❌ | ❌ | ❌ | ❌ | All |
| Container | Xem | ❌ | ❌ | Full | ❌ | ❌ | ❌ | Xem | ❌ | ❌ | All |
| Kho TQ | Verify | ❌ | ❌ | Xem | ❌ | ❌ | ❌ | CậpNhật | ❌ | ❌ | All |
| Kho VN | Xem | ❌ | ❌ | Xem | ❌ | ❌ | CP | ❌ | **Full** | ❌ | All |
| **Giao hàng** | Xem | ❌ | ❌ | **❌** | ❌ | ❌ | CP | ❌ | **Điều phối** | CậpNhật | All |
| Hoa hồng | Mình | Nhóm | All | ❌ | Quản lý | ❌ | ❌ | ❌ | ❌ | ❌ | All |
| Báo cáo | Cá nhân | Nhóm | All | XNK | TC | TT | CP | ❌ | Kho | ❌ | All |

**Data isolation (3 cấp KD):**
```
Sale:     Đơn/khách MÌNH
Leader:   Đơn/khách NHÓM (3-5 Sale)
GĐ KD:    Đơn/khách TẤT CẢ 2 CN
BGĐ:      TẤT CẢ
```

---

# PHẦN F: NOTIFICATION

| Sự kiện | Gửi cho | Kênh |
|---------|---------|------|
| Lead assign | Sale + **Leader** | App push |
| Giảm giá cần duyệt ≤ 3% | **Leader + KT TT** | App push |
| Giảm giá cần duyệt > 3% | + **GĐ KD** | App push |
| **Phiếu chi bất thường (FLAG)** | **Leader + KT TT** | App push urgent |
| Phiếu cần BGĐ chi | BGĐ | App push |
| Hàng đến kho TQ | Sale + Leader | App |
| CW chênh > 10% | Sale (urgent) | App push |
| Container xuất TQ | Sale → Khách | App + Zalo |
| Thông quan xong | **Trưởng kho VN** + Sale | App |
| Nhập kho VN xong | Sale → Khách | App + Zalo |
| Trưởng kho lên lịch giao | Sale + Lái xe | App |
| Đang giao | Khách | Zalo/SMS |
| Giao OK (POD) | Sale + Trưởng kho + KT TT | App |
| **COD đã thu** | Trưởng kho + KT TT | App |
| Phiếu bị từ chối | Sale + **Leader** | App push |
| CN sắp hạn (T-3) | Sale + **Leader** | App |
| CN quá hạn | Sale + Leader + KT TT | App urgent |
| CN > 15 ngày | + **GĐ KD** | App + email |
| CN > 30 ngày | + **BGĐ** | App + email |
| KT TH hạch toán xong | Sale + Leader (hoa hồng) | App |
| Phê duyệt pending > 4h | Người duyệt | App remind |

---

# PHẦN G: SLA

| Hành động | SLA | Alert nếu vượt |
|-----------|-----|----------------|
| CSKH phản hồi data | ≤ 15 phút | GĐ KD |
| Sale liên hệ sau assign | ≤ 2 giờ | Leader |
| Tạo báo giá | ≤ 4 giờ (HC) | Leader |
| Leader duyệt giảm giá | ≤ 2 giờ | GĐ KD |
| KT TT đồng duyệt | ≤ 2 giờ | KT TH |
| **GĐ KD duyệt** | ≤ 4 giờ | BGĐ |
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

# PHẦN H: TRẠNG THÁI ĐẶC BIỆT

*(Giữ nguyên v3.1: ON_HOLD, CANCELLED, RETURNED, ISSUE)*

**Flow hủy đơn (cập nhật — bỏ TP KD):**
```
Sale yêu cầu hủy
    │
    ├── GĐ 1-2 (chưa cọc): Leader duyệt → Hủy
    │
    ├── GĐ 3 (đã cọc, chưa mua): Leader → GĐ KD duyệt
    │   → KT TT tính phí hủy + hoàn cọc
    │
    ├── GĐ 4-6 (đã mua hàng): GĐ KD → BGĐ duyệt
    │   → Tính chi phí phát sinh
    │
    └── GĐ 7+ (đã xuất kho): BGĐ quyết định case by case
```

---

# PHẦN I: LƯU Ý THIẾT KẾ HỆ THỐNG

## I1. Scale 25→50 Sale (3 cấp)
```
Phân quyền data:
  Sale:    Đơn/khách MÌNH
  Leader:  Đơn/khách NHÓM (3-5 Sale)
  GĐ KD:   Đơn/khách TẤT CẢ 2 CN
  BGĐ:     TẤT CẢ

Transfer:
  Sale nghỉ → Leader reassign trong nhóm
  Leader nghỉ → GĐ KD reassign Sale cho Leader khác
  Chuyển Sale giữa nhóm/CN → GĐ KD thực hiện
```

## I2. Agent TQ
*(Giữ nguyên: Interface riêng, phân quyền chặt, Sale verify)*

## I3. Trưởng kho = Kho + Giao hàng
```
Module Kho VN:
  ├── Nhập/xuất kho
  ├── Lên lịch giao hàng (xem đơn cần giao, tối ưu route)
  ├── Quản lý lái xe (phân công, theo dõi, POD)
  ├── Quản lý COD (theo dõi, xác nhận, nộp KT)
  └── Thuê nhân sự tạm
```

## I4. Anti-fraud phiếu chi
*(Giữ nguyên: mandatory fields, auto block/flag, audit trail)*

## I5. Multi-currency
*(Giữ nguyên: CNY, USD, VND — KT TH quản lý tỷ giá)*

---

# TÓM TẮT v3.1 → v3.2

| Hạng mục | v3.1 | v3.2 |
|----------|------|------|
| Cơ cấu KD | Sale → Leader → **TP KD** → GĐ KD (4 cấp) | Sale → Leader → **GĐ KD** (3 cấp) |
| TP KD | 1 người/CN (chiến lược, đào tạo) | **BỎ — GĐ KD đảm nhận** |
| GĐ KD | Quản lý 2 TP KD | **Quản lý trực tiếp tất cả Leader** |
| Leader báo cáo cho | TP KD | **GĐ KD** (trực tiếp) |
| Duyệt giảm giá ≤ 3% | Leader + KT TT | Leader + KT TT (giữ nguyên) |
| Duyệt giảm giá 3-5% | Leader → KT TT → **TP KD** | Leader → KT TT → **GĐ KD** |
| Duyệt giảm giá > 5% | → TP KD → GĐ KD/BGĐ | → GĐ KD → **BGĐ** |
| Hủy đơn (đã cọc) | Leader → TP KD → BGĐ | Leader → **GĐ KD** (→ BGĐ nếu nặng) |
| Escalation path | Sale → Leader → TP KD → GĐ KD → BGĐ | Sale → Leader → **GĐ KD** → BGĐ |
| Alert CN > 15 ngày | TP KD | **GĐ KD** |

---

# PHẦN J: HƯỚNG DẪN VẬN HÀNH (OPERATIONS GUIDE)

> **Mục đích phần này:** Cung cấp hướng dẫn thực hành chi tiết, checklists, kịch bản thực tế và best practices cho từng vai trò và giai đoạn đơn hàng.

---

## J1. QUY TRÌNH THEO VAI TRÒ (ROLE-BASED WORKFLOWS)

### J1.1. SALE — Quy trình làm việc hàng ngày

#### Buổi sáng (8:00-12:00)

**Priority 1: Xử lý đơn đang chạy (70% thời gian)**
```
1. Login hệ thống → Dashboard
2. Check notifications:
   - ⚠️ URGENT: CN quá hạn, FLAG phiếu chi, khiếu nại
   - 🔔 Cần action: Phê duyệt pending, hàng về kho, agent confirm
   - 📊 Info: Hàng xuất TQ, cập nhật logistics
3. Priority matrix:
   Ưu tiên 1: CN quá hạn → Gọi khách ngay
   Ưu tiên 2: Hàng về kho VN → Hẹn giao trong ngày
   Ưu tiên 3: Agent confirm → Verify trong 4h
   Ưu tiên 4: Khách hàng chờ báo giá → Hoàn thành trong 4h
```

**Priority 2: Lead mới & Báo giá (20% thời gian)**
```
4. Check lead mới từ CSKH
5. Liên hệ trong 2h (SLA bắt buộc)
6. Tư vấn → Tìm NCC → Báo giá (hoàn thành trong 4h)
```

**Priority 3: Follow-up & Chốt đơn (10% thời gian)**
```
7. Follow khách đã báo giá chưa chốt (3-5 ngày)
8. Xử lý các câu hỏi/thắc mắc khách hàng
```

#### Buổi chiều (13:00-17:30)

```
9. Xử lý phiếu thu/chi:
   - Tạo phiếu chi cho NCC (đã mua hàng)
   - Tạo phiếu thu (khách thanh toán)
   - ⚠️ BẮT BUỘC: Gắn mã đơn hàng, đầy đủ chứng từ
10. Đối soát với KT:
    - Đơn giao xong → Gửi đối soát trong 3 ngày
    - Kiểm tra công nợ khách hàng
11. Cập nhật CRM:
    - Ghi chú cuộc gọi, email, Zalo
    - Update pipeline stage
12. Planning ngày mai:
    - Đơn nào cần follow
    - Khách nào cần hẹn giao
```

#### Trước khi về (17:30)

```
13. Kiểm tra:
    ☑ Tất cả notification urgent đã xử lý?
    ☑ Phiếu chi/thu đã tạo đầy đủ chứng từ?
    ☑ Khách đã reply tin nhắn quan trọng?
    ☑ Đơn nào cần escalate Leader?
```

---

### J1.2. LEADER — Checklist hàng ngày

#### Sáng (8:00-9:00): Planning & Monitoring

```
1. Dashboard Leader:
   ☑ Doanh thu nhóm YTD vs Target
   ☑ Số đơn đang chạy của từng Sale
   ☑ Alert: CN quá hạn, pending approval
   ☑ SLA violations (Sale chậm trả lời, chậm báo giá)

2. Standup nhanh (10-15 phút) với nhóm:
   - Mỗi Sale báo cáo: TOP 3 priority hôm nay
   - Leader note: Ai cần hỗ trợ gì
   - Chia sẻ case khó
```

#### Trong ngày: Monitoring & Support

```
3. Xử lý approval (SLA ≤ 2h):
   ☑ Giảm giá ≤ 3% → Review:
     - Lý do có hợp lý?
     - Khách VIP/khách mới?
     - LN còn dương?
     → Duyệt hoặc từ chối (ghi rõ lý do)

   ☑ Hủy đơn (chưa cọc):
     - Lý do khách? (hết nhu cầu, đắt, chậm)
     - Có cách giữ khách không?
     - Học được gì cho lần sau?

   ☑ FLAG phiếu chi bất thường:
     - Chi > 90% doanh thu → Gọi Sale giải thích ngay
     - NCC không approved → Xác nhận với Sale
     - Chi phát sinh lớn → Hiểu nguyên nhân

4. Coaching (1-2 lần/ngày):
   - Nghe Sale gọi điện khách khó
   - Review báo giá trước khi gửi (Sale mới)
   - Chốt đơn lớn: Sale cần hỗ trợ gì?

5. Escalation (khi cần):
   - Giảm giá > 3% → GĐ KD
   - Khách VIP khó tính → GĐ KD
   - Khiếu nại lớn → GĐ KD
```

#### Chiều: Review & Planning

```
6. EOD Review (16:30-17:30):
   ☑ Duyệt hết pending approval chưa?
   ☑ Sale nào SLA violation cần nhắc?
   ☑ Đơn nào risk (CN cao, khách delay TT)?
   ☑ Target tháng: Còn thiếu bao nhiêu?

7. Planning tuần/tháng (thứ 6):
   - Phân tích tỷ lệ chốt từng Sale
   - Khách tiềm năng lớn cần focus
   - Training plan cho Sale yếu
```

---

### J1.3. GĐ KINH DOANH — Quy trình quản lý

#### Weekly Review (Thứ 2 hàng tuần)

```
1. Dashboard GĐ KD:
   ☑ Doanh thu tuần/tháng/quý 2 CN
   ☑ So sánh HN vs HCM
   ☑ Tỷ lệ chốt từng Leader
   ☑ LN trung bình/đơn
   ☑ Tỷ lệ CN > 15 ngày

2. Meeting với Leaders (1h):
   - TOP 3 achievements tuần trước
   - TOP 3 challenges
   - Case khó cần GĐ KD hỗ trợ
   - Pipeline lớn tuần này
   - Action items: Ai làm gì đến khi nào

3. Review approval pending:
   - Giảm giá > 3% → Duyệt/từ chối
   - Hủy đơn (đã cọc) → Xem chi phí, quyết định
   - Khiếu nại → Phương án xử lý, approve bồi thường nếu cần
```

#### Daily Operations

```
4. Xử lý escalation từ Leader:
   - Khách VIP khó → Gọi điện trực tiếp
   - Vấn đề phức tạp → Họp nhanh với Sale + Leader + KT
   - Chính sách giá đặc biệt → Đề xuất BGĐ

5. Coaching & Training:
   - Join call khách lớn với Leader/Sale
   - Review case study (thành công/thất bại)
   - 1-on-1 với Leader (2 tuần/lần)

6. Cross-function coordination:
   - Họp với KT (tuần 1 lần): CN, LN, hoa hồng
   - Họp với XNK (tuần 1 lần): Logistics issues
   - Họp với COO/BGĐ: Strategy, policy
```

#### Monthly Planning

```
7. Cuối tháng (T-5 ngày):
   ☑ Forecast tháng sau: Doanh thu dự kiến
   ☑ Điều chỉnh target từng nhóm nếu cần
   ☑ Review: Leader/Sale nào cần training/reassign
   ☑ Chính sách: Giá, hoa hồng, ưu đãi tháng mới

8. Báo cáo BGĐ:
   - Doanh thu/LN thực tế vs Target
   - TOP 5 khách hàng lớn nhất
   - Risk: CN cao, khách rớt
   - Plan tháng sau
```

---

## J2. CHECKLIST TỪNG GIAI ĐOẠN ĐƠN HÀNG

### GĐ 1: TIẾP NHẬN (`CONSULTING`)

**Checklist CSKH khi tiếp data:**
```
☑ Kiểm tra data chất lượng:
  - Số điện thoại hợp lệ? (đúng 10-11 số)
  - Tên rõ ràng? (không phải "Khách hàng 123")
  - Nhu cầu rõ? (loại hàng, số lượng ước lượng)
  - Source? (TikTok/FB/Zalo/Website)

☑ Gọi lại trong 15 phút (SLA):
  - Xác nhận nhu cầu
  - Qualify: Khách thật hay spam?
  - Budget khách: Dưới 10tr / 10-50tr / >50tr
  - Urgency: Gấp (trong tuần) / Bình thường (1-2 tuần) / Tìm hiểu

☑ Nhập CRM:
  - Họ tên, SĐT, email, địa chỉ
  - Loại hàng quan tâm
  - Budget range
  - Urgency level
  - Note: Tính cách khách (dễ tính/khó tính/chuyên nghiệp)

☑ Assign Sale:
  - Rule: Round-robin trong nhóm
  - Ưu tiên: Sale ít đơn hơn
  - Khách VIP → Assign Sale giỏi hoặc Leader xử lý

☑ Tạo nhóm Zalo 3 người:
  - CSKH + Sale + Khách
  - CSKH giới thiệu Sale
  - CSKH rời nhóm sau khi Sale confirm nhận
```

**KPI CSKH:**
- Thời gian phản hồi: Trung bình < 15 phút
- Tỷ lệ qualify: > 70% (70% data thật, 30% spam)
- Số lead xử lý: 30-50/ngày

---

### GĐ 2: BÁO GIÁ (`QUOTATION`)

**Checklist Sale:**
```
☑ Liên hệ khách trong 2h sau assign (SLA bắt buộc):
  - Gọi điện (ưu tiên) hoặc Zalo
  - Tự giới thiệu: "Em là [Tên], phụ trách đơn hàng của anh/chị"
  - Confirm lại nhu cầu
  - Hỏi thêm: Link sản phẩm, hình ảnh, specs chi tiết

☑ Tìm NCC Trung Quốc (nếu khách chưa có):
  - Nguồn: 1688, Taobao, Tmall, Pinduoduo
  - So sánh 3-5 NCC:
    - Giá FOB (Free on Board)
    - MOQ (Minimum Order Quantity)
    - Lead time (thời gian sản xuất)
    - Rating & reviews
  - Screenshot NCC, gửi khách chọn

☑ Tính giá báo cho khách:
  Công thức: Giá bán = FOB + Freight + Thuế + Phí + LN

  Chi tiết:
  - FOB (giá NCC): $XXX
  - Vận chuyển TQ→VN: $YYY/kg hoặc /m³
  - Thuế NK + VAT: 10-30% (tùy HS code)
  - Phí XNK, kho, giao hàng: ~5-10%
  - LN mục tiêu: 15-25%

  ⚠️ Lưu ý:
  - Check HS code với XNK (nếu không chắc)
  - Nếu biển: Tính theo CBM (kg/CBM > 166.67)
  - Nếu bộ: Tính theo kg
  - Báo 2 phương án: Biển (chậm, rẻ) vs Bộ (nhanh, đắt)

☑ Soạn báo giá:
  - Template chuẩn (có logo TBS)
  - Breakdown chi tiết từng mục
  - Điều khoản: TT, giao hàng, bảo hành
  - Thời hạn: Báo giá hiệu lực 7 ngày
  - Gửi qua email + PDF qua Zalo

☑ Follow-up:
  - Sau 1 giờ: "Anh/chị đã xem báo giá chưa ạ?"
  - Sau 1 ngày: "Em có thể giải đáp thêm thắc mắc không ạ?"
  - Sau 3 ngày: "Anh chị có cân nhắc thêm không? Em hỗ trợ gì thêm?"

☑ Nếu khách yêu cầu giảm giá:
  - Giảm 0-3%: Xin Leader + KT TT duyệt
    - Lý do rõ ràng: Khách VIP, đơn lớn, cạnh tranh
    - Tạo request trong hệ thống
    - SLA Leader duyệt: 2h

  - Giảm > 3%: Escalate GĐ KD
    - Chuẩn bị: So sánh giá đối thủ, lịch sử khách
    - Justification: Tại sao cần giảm nhiều?
    - Alternative: Giảm specs/chất lượng thay vì giảm giá?

☑ Khi khách chốt:
  - Confirm lại: SL, giá, specs, thời gian giao
  - Soạn HĐ (nếu cần)
  - Tạo đơn hàng trong hệ thống
  - Chuyển sang GĐ 3: Nhắc cọc
```

**Timing chuẩn:**
- Từ nhận lead → Gọi điện: < 2h
- Tìm NCC + Tính giá: 2-4h
- Gửi báo giá: < 4h (cùng ngày)
- Tổng: Nhận lead buổi sáng → Gửi báo giá chiều cùng ngày

**Common mistakes:**
- ❌ Không check HS code → Báo giá sai thuế → Lỗ
- ❌ Không tính phí phát sinh → LN bị ăn mòn
- ❌ Quên note MOQ của NCC → Khách đặt ít bị NCC từ chối
- ❌ Không confirm specs kỹ → Về hàng không đúng

---

### GĐ 3: CỌC (`PENDING_DEPOSIT`)

**Checklist Sale:**
```
☑ Tạo đơn hàng trong hệ thống:
  - Mã đơn tự động: DH[YYMMDD][SEQ]
  - Gắn khách hàng
  - Nhập items: SKU, tên, SL, đơn giá
  - Tổng giá trị đơn
  - Chi nhánh: HN/HCM
  - Branch: Sale thuộc Leader nào
  - Ghi chú nội bộ: Yêu cầu đặc biệt
  - Ghi chú khách hàng: Note giao hàng

☑ Thông báo khách cọc:
  - Tỷ lệ: 30-50% giá trị đơn (policy công ty)
  - Đặc biệt:
    - Khách mới: 50%
    - Khách quen (CN tốt): 30%
    - Khách VIP: Linh động (cần Leader approve)

  - Thời hạn: Cọc trong 24-48h để giữ giá
  - Lý do: Đặt cọc NCC TQ, tỷ giá biến động

☑ Tạo phiếu thu cọc:
  - Loại: Phiếu thu
  - Mã đơn hàng: DH... (bắt buộc gắn)
  - Số tiền: XXX VND
  - Hình thức: CK ngân hàng / Tiền mặt / COD
  - Chứng từ: Screenshot CK / Ảnh biên lai
  - Gửi KT TT duyệt (SLA KT: 2h)

☑ Follow cọc:
  Ngày 1: "Anh/chị vui lòng chuyển khoản cọc để em giữ giá ạ"
  Ngày 2: "Em nhắc nhẹ anh/chị về khoản cọc, tỷ giá có thể tăng ạ"
  Ngày 3: "Em cần confirm: Anh chị còn nhu cầu không ạ? Nếu không chuyển được, em hỗ trợ gì thêm?"

  ⚠️ Sau 3-5 ngày không cọc:
    - Case 1: Khách bận → Hẹn lại rõ ràng
    - Case 2: Khách do dự → Tìm hiểu lý do, xử lý từng barrier
    - Case 3: Khách mất tín hiệu → Chuyển "ON_HOLD", follow 1 tuần/lần

☑ Khi khách đã cọc:
  - KT TT duyệt phiếu thu
  - KT confirm tiền về
  - Đơn chuyển GĐ 4: Mua hàng
  - Cảm ơn khách, báo timeline mua hàng
```

**Edge cases:**
```
Tình huống 1: Khách xin miễn cọc
  → Chỉ BGĐ duyệt được
  → Sale → Leader → BGĐ
  → Cần lý do rất đặc biệt (khách VIP, đơn > 500tr, khách quen lâu năm)

Tình huống 2: Khách cọc ít hơn quy định
  → Leader duyệt nếu 20-30% (thấp hơn 30%)
  → Ghi rõ lý do: Khách khó khăn tài chính, chia nhiều đợt
  → Risk: Note vào đơn, theo dõi sát

Tình huống 3: Khách muốn hủy sau khi cọc
  → Đã mua hàng chưa? Nếu chưa → Hoàn cọc - phí admin (5-10%)
  → Đã mua hàng → Tính chi phí phát sinh, trừ vào cọc
  → Leader + GĐ KD duyệt
```

---

### GĐ 4: MUA HÀNG (`SOURCING`)

**Checklist Sale:**
```
☑ Chuẩn bị đặt hàng NCC:
  - Confirm lại với NCC:
    - SKU, specs, màu sắc, size
    - SL chính xác
    - Giá FOB
    - Lead time (thời gian sản xuất)
    - Yêu cầu đặc biệt: Logo, nhãn, đóng gói

  - Yêu cầu NCC:
    - Invoice (hóa đơn)
    - Packing list
    - Hợp đồng mua bán (nếu > $5,000)
    - QC report (nếu yêu cầu kiểm hàng)

☑ Thanh toán NCC:
  - Hình thức: Alipay / WeChat Pay / Wire transfer CNY/USD
  - Tỷ lệ:
    - 30% trước khi sản xuất (deposit)
    - 70% trước khi xuất kho (trước khi giao agent)

  - Tạo phiếu chi:
    - Loại: Chi phí mua hàng
    - Mã đơn hàng: DH... (bắt buộc)
    - NCC: Tên công ty TQ
    - Số tiền: XXX CNY/USD
    - Chứng từ:
      - Invoice NCC
      - Screenshot thanh toán
      - Hợp đồng (nếu có)
    - Ghi chú: SKU, SL, lý do chi

  - Flow duyệt:
    - Sale tạo → KT TT duyệt (2h) → BGĐ chi tiền (4-8h)
    - ⚠️ Phiếu > 50tr: + KT TH duyệt thêm

☑ Monitor sản xuất:
  - Theo dõi: NCC báo tiến độ qua Alibaba/Wechat
  - Progress:
    - Nguyên liệu: 20%
    - Sản xuất: 50%
    - QC: 80%
    - Hoàn thành: 100%

  - Update khách:
    - Mỗi milestone → Gửi ảnh/video từ NCC
    - Khách yên tâm, giảm refund

☑ QC trước khi xuất kho NCC (nếu cần):
  - Agent TQ hoặc thuê QC riêng
  - Checklist QC:
    - Đúng SKU, màu, size?
    - Chất lượng: Vết xước, lỗi sản xuất?
    - SL đúng?
    - Đóng gói cẩn thận?
  - Ảnh/video gửi khách approve
  - Nếu lỗi: Yêu cầu NCC đổi hàng/sửa

☑ Giao hàng cho Agent TQ:
  - NCC giao hàng đến kho Agent (Nghĩa Ô/Bằng Tường)
  - Agent confirm nhận hàng
  - Chuyển sang GĐ 5: Nhập kho TQ
```

**Common mistakes:**
```
❌ Không confirm specs kỹ với NCC → Về hàng sai
  ✅ Fix: Gửi ảnh, link, sample rõ ràng cho NCC

❌ Thanh toán 100% trước → NCC chậm ship/không ship
  ✅ Fix: Luôn giữ 70% cuối, chỉ trả khi hàng về agent

❌ Không yêu cầu invoice → HQ khó khăn
  ✅ Fix: Invoice là bắt buộc, có giá trị pháp lý

❌ Quên tính phí QC → LN bị ăn
  ✅ Fix: Báo giá đã tính sẵn phí QC 1-2%
```

---

### GĐ 5-9: KHO TQ → VẬN CHUYỂN → THÔNG QUAN

*(Đơn giản hóa vì đã có chi tiết ở PHẦN C)*

**Sale responsibilities:**
```
GĐ 5: NHẬP KHO TQ
☑ Agent báo: Hàng về kho
☑ Sale verify SL trong 4h (SLA)
☑ Nếu chênh > 10% → Alert urgent, xử lý với NCC
☑ Báo khách: "Hàng đã về kho TQ, chuẩn bị xuất"

GĐ 6: ĐÓNG GÓI
☑ Agent đóng gói theo yêu cầu
☑ Sale check: Đóng gói cẩn thận? Dễ vỡ cần foam/bọc khí?
☑ Agent báo: Kích thước, cân nặng chính xác

GĐ 7-8: GHÉP CONT & VẬN CHUYỂN
☑ XNK xử lý (Sale chỉ theo dõi)
☑ Sale update khách:
  - "Hàng đã xuất TQ ngày [DD/MM]"
  - "Dự kiến về VN: [DD/MM]"
  - ETA (Estimated Time of Arrival)

GĐ 9: THÔNG QUAN
☑ XNK xử lý HQ
☑ KT TT thông báo nộp thuế
☑ Sale tạo phiếu chi thuế NK + VAT (gắn đơn hàng)
☑ KT TT duyệt → BGĐ chi
☑ Sale báo khách: "Hàng đã thông quan, chuẩn bị về kho VN"
```

**Best practice:**
```
✅ Update khách chủ động mỗi milestone
✅ Screenshot tracking number, bill of lading gửi khách (minh bạch)
✅ Nếu delay: Báo khách ngay, không để khách hỏi mới biết
✅ Backup plan: Nếu HQ phân luồng đỏ → Chuẩn bị giấy tờ thêm
```

---

### GĐ 10-11: KHO VN & GIAO HÀNG

**Sale checklist:**
```
☑ GĐ 10: NHẬP KHO VN
  - Kho báo: Hàng về kho VN
  - Sale báo khách: "Hàng đã về kho [HN/HCM], anh chị muốn hẹn giao khi nào?"
  - Hẹn giao hàng: Ngày, giờ, địa chỉ cụ thể
  - Confirm: Có người nhận hàng không? (tránh shipper đi không gặp)

☑ GĐ 11: GIAO HÀNG
  - Kiểm tra thanh toán:
    - TT full chưa? → Nếu còn nợ, nhắc khách trả trước khi giao
    - COD? → Lái xe thu tiền, nộp Trưởng kho
    - Nếu khách nợ > credit limit → BLOCK giao hàng (KT enforce)

  - Trưởng kho lên lịch:
    - Phân công lái xe
    - Tối ưu route (giao nhiều đơn cùng khu vực)
    - Báo Sale: "Dự kiến giao [ngày] [giờ]"

  - Sale thông báo khách:
    - "Xe sẽ giao hàng [ngày] [giờ], anh chị chuẩn bị nhận ạ"
    - Zalo/SMS trước 2h: "Xe đang trên đường, 2h nữa đến"

  - Lái xe giao:
    - Bàn giao hàng: Kiểm tra đủ SL, chất lượng cùng khách
    - Khách ký POD (Proof of Delivery)
    - Chụp ảnh: Khách + hàng + chữ ký
    - Thu COD (nếu có) → Nộp Trưởng kho → KT

  - Sale confirm:
    - Check POD trong hệ thống
    - Gọi khách: "Anh chị đã nhận hàng OK chưa ạ? Có vấn đề gì không?"
    - Xử lý khiếu nại ngay (nếu có)
```

**Xử lý giao hàng KHÔNG thành công:**
```
Tình huống 1: Khách không có nhà
  → Lái xe gọi → Không nghe máy
  → Sale gọi khách → Hẹn lại
  → Trưởng kho lên lịch lần 2
  → ⚠️ Phí giao lại: Khách chịu (nếu không báo trước)

Tình huống 2: Địa chỉ sai/không tìm được
  → Lái xe gọi Sale
  → Sale gọi khách xác nhận địa chỉ
  → Nếu quá xa (sai quận/huyện) → Phí phát sinh

Tình huống 3: Khách từ chối nhận (hàng không đúng/hư)
  → KHÔNG để lái xe tự quyết định
  → Lái xe gọi Sale ngay
  → Sale gọi khách, tìm hiểu lý do
  → Chụp ảnh/video hiện trạng hàng
  → Nếu lỗi TBS: Nhận hàng về, đổi hàng mới
  → Nếu lỗi khách (đổi ý): Tính phí giao 2 lần + phí kho
  → Escalate Leader/GĐ KD quyết định

Tình huống 4: Hàng bị hư trong quá trình vận chuyển
  → Trách nhiệm: Lái xe + Trưởng kho
  → Chụp ảnh ngay
  → Báo bảo hiểm (nếu có застрахован)
  → TBS bồi thường khách (BGĐ duyệt)
  → Xử lý nội bộ: Lái xe/NV kho chịu trách nhiệm
```

---

### GĐ 12-13: ĐỐI SOÁT & HOÀN THÀNH

**Sale checklist:**
```
☑ GĐ 12: ĐỐI SOÁT
  - Trong 3 ngày sau giao hàng (SLA):
    - Sale soạn bảng đối soát:
      - Tổng giá trị đơn hàng
      - Đã thu: Cọc + Thanh toán + COD
      - Còn nợ: XXX VND
      - Phí phát sinh (nếu có): Lý do + chứng từ

    - Gửi KT TT:
      - File Excel đối soát
      - Tất cả phiếu thu/chi related
      - Invoice, POD, chứng từ khác

    - KT TT kiểm tra:
      - Số liệu khớp không?
      - Phiếu đầy đủ chứng từ?
      - Công nợ đúng không?

    - Nếu khớp → KT TT approve
    - Nếu sai lệch → Sale điều chỉnh

  - Thu hồi công nợ:
    - Nếu còn nợ → KT alert Sale
    - Sale nhắc khách:
      - Email: Báo CN, hạn thanh toán
      - Zalo: Nhắc nhẹ nhàng
      - Gọi điện (nếu quá hạn 3 ngày)

    - Escalation:
      - CN > 15 ngày → Leader hỗ trợ
      - CN > 30 ngày → GĐ KD gọi khách
      - CN > 60 ngày → BGĐ quyết định: Khởi kiện/xóa nợ/thương lượng

☑ GĐ 13: HOÀN THÀNH
  - KT TH hạch toán:
    - Doanh thu: XXX VND
    - Chi phí: YYY VND (mua hàng + vận chuyển + thuế + phí)
    - LN: XXX - YYY = ZZZ VND
    - LN%: (ZZZ / XXX) × 100%

  - Tính hoa hồng Sale:
    - Formula: LN × Tỷ lệ HH (10-20% tùy level)
    - Hoa hồng tạm: Tính ngay khi hoàn thành
    - Hoa hồng thực: Trả khi thu đủ CN (để tránh rủi ro)

  - Sale thấy:
    - Dashboard: Hoa hồng tháng này
    - Chi tiết: Từng đơn đóng góp bao nhiêu

  - Tự động chuyển trạng thái: `COMPLETED`
  - Khóa đơn: Không sửa được nữa (chỉ BGĐ/KT TH mở khóa)
```

**Follow-up sau hoàn thành:**
```
✅ Sale gọi khách (sau 3-7 ngày):
  - "Anh chị dùng hàng thấy OK không ạ?"
  - "Có vấn đề gì cần em hỗ trợ thêm không?"
  - "Anh chị có nhu cầu đặt thêm không? Em hỗ trợ ạ"

✅ Xin review/feedback:
  - Nếu khách hài lòng → Xin Google review/Facebook review
  - Nếu khách có issue → Xử lý ngay, tránh review xấu

✅ Upsell/Cross-sell:
  - Gợi ý sản phẩm liên quan
  - Chương trình ưu đãi cho khách quen
  - Giới thiệu dịch vụ khác của TBS
```

---

## J3. CÁC TÌNH HUỐNG THỰC TẾ (REAL-WORLD SCENARIOS)

### Scenario 1: Khách yêu cầu giảm giá 15% (đơn 50 triệu)

**Bối cảnh:**
- Khách mới, đơn đầu tiên
- Đã báo giá 50 triệu (LN 20%)
- Khách nói: "Bên khác báo 42.5 triệu, bạn giảm được không?"

**Phân tích:**
- Giảm 15% = 7.5 triệu → Giá còn 42.5 triệu
- LN ban đầu 20% = 10 triệu
- Sau giảm: LN còn 2.5 triệu (5%) → Rất thấp, risk cao

**Quy trình xử lý:**

```
Bước 1: Sale verify thông tin đối thủ
  - Yêu cầu khách: "Anh cho em xem báo giá của bên đó được không?"
  - Check: Có phải so sánh đúng specs/dịch vụ không?
    - Bên đó có bao gồm VAT không?
    - Bảo hành? Giao hàng tận nơi?
    - Lead time?
  - Có thể bên đó báo giá "mồi nhử" (rẻ nhưng ẩn chi phí)

Bước 2: Sale tính toán lại
  - Có thể tối ưu chi phí không?
    - Đổi hình thức vận chuyển (biển thay vì bộ)?
    - Ghép container với đơn khác?
    - Giảm packaging?
  - Nếu tối ưu được → Giá giảm còn 46-47 triệu (LN 10-12%)

Bước 3: Sale đàm phán với khách
  - "Anh ơi, em đã tính lại chi tiết:
    - Nếu anh chấp nhận ship biển (chậm 5 ngày), giá 46 triệu
    - Hoặc anh tăng SL lên 20% (scale), giá 45 triệu
    - Hoặc em xin Leader giảm đặc biệt xuống 47 triệu, anh có OK không?"

  - Tạo urgency: "Tỷ giá CNY đang tăng, nếu anh chốt hôm nay em giữ giá 47tr"

Bước 4: Nếu khách vẫn đòi 42.5 triệu
  - Sale báo Leader + GĐ KD (giảm > 3%)
  - Meeting nhanh:
    - Leader: "Khách này tiềm năng lâu dài không?"
    - GĐ KD: "LN 5% quá thấp, risk nếu phát sinh chi phí"
  - Options:
    - A. Chấp nhận 5% LN để giữ khách (nếu khách VIP, đơn lớn sau)
    - B. Từ chối, giải thích: "Giá 42.5tr không đủ cover chi phí, TBS làm uy tín lâu dài"
    - C. Thương lượng: 44-45tr (LN 8-10%), "anh chị thông cảm cho em"

Bước 5: Kết quả
  - Nếu deal → Tạo đơn, note: "Đơn LN thấp, cẩn thận phát sinh"
  - Nếu mất khách → Học bài: Phân tích tại sao mất, improve lần sau
```

**Bài học:**
- ✅ Luôn verify thông tin đối thủ (nhiều khách "bluff")
- ✅ Đưa ra alternatives thay vì cứng nhắc
- ✅ Biết khi nào nên "walk away" (LN quá thấp = risk cao)

---

### Scenario 2: Hàng về kho VN thiếu 50 sản phẩm (thiếu 10%)

**Bối cảnh:**
- Đơn 500 sản phẩm, giá trị 100 triệu
- Kho VN nhập kho: Chỉ có 450 sản phẩm (thiếu 50)
- Khách đã thanh toán full, đang chờ giao

**Root cause analysis:**

```
Điểm check:
1. Agent TQ báo: 500 sản phẩm ✅ (Sale đã verify)
2. XNK manifest: 500 sản phẩm ✅
3. Kho VN nhận: 450 sản phẩm ❌ (thiếu 50)

→ Vấn đề ở đâu?
  Option 1: Agent TQ đếm sai → Lỗi agent
  Option 2: Mất trong quá trình vận chuyển → Lỗi logistics
  Option 3: Kho VN đếm sai → Check lại
```

**Quy trình xử lý:**

```
Step 1: URGENT - Kiểm tra ngay (trong 2h)
  - Trưởng kho VN: Đếm lại 2 lần
  - Confirm: Thật sự thiếu 50 sản phẩm
  - Chụp ảnh: Packing list, thực tế hàng

Step 2: Truy xuất nguồn gốc (2-4h)
  - Sale gọi Agent TQ: "Anh xác nhận đã xuất đủ 500 sản phẩm?"
  - Agent check camera kho, packing record
  - XNK check: Manifest, bill of lading, seal container

  - Kết quả:
    - Nếu agent confirm đúng 500 → Mất trong vận chuyển
    - Nếu agent thừa nhận sai → Lỗi agent, agent bồi thường

Step 3: Xử lý với khách (ngay lập tức)
  - Sale gọi khách NGAY (không che giấu):
    "Anh ơi, em có tin không tốt. Hàng về kho bị thiếu 50 sản phẩm (10%).
     Em đang truy tìm nguyên nhân. Em xin lỗi anh về sự cố này."

  - Đưa phương án:
    A. Đặt bổ sung 50 sản phẩm, TBS chịu phí ship nhanh (3-5 ngày)
    B. Hoàn tiền 10% giá trị (10 triệu), anh nhận 450 sản phẩm
    C. Giao 450 trước, 50 sản phẩm đặt thêm giao sau (7-10 ngày)

  - Bồi thường thiện chí:
    - Giảm thêm 2-3% (2-3 triệu)
    - Hoặc tặng quà/voucher đơn sau
    - Mục tiêu: Giữ khách, giữ uy tín

Step 4: Xử lý nội bộ
  - Họp: Sale + XNK + Agent TQ + GĐ KD + BGĐ
  - Trách nhiệm:
    - Lỗi agent → Agent bồi thường TBS
    - Lỗi logistics → Claim bảo hiểm (nếu застрахован)
    - Lỗi kho VN → NV kho chịu trách nhiệm

  - Phòng ngừa:
    - Rule mới: Đếm hàng 2 lần (1 lần agent, 1 lần kho VN)
    - Video đóng gói/mở hàng
    - Seal container có mã số, check khi mở

Step 5: Follow-up
  - Giao 50 sản phẩm bổ sung
  - Gọi khách xin lỗi lần nữa, xin feedback
  - Note vào hệ thống: Incident report, lesson learned
```

**Outcome:**
- ✅ Khách hài lòng vì xử lý nhanh, minh bạch
- ✅ TBS giữ được uy tín
- ❌ LN bị ăn (chi thêm 2-3 triệu bồi thường + ship nhanh)
- ✅ Học được: Cải thiện quy trình check hàng

---

### Scenario 3: Sale bị overload (30 đơn đang chạy, lead mới liên tục)

**Bối cảnh:**
- Sale A có 30 đơn đang ở các giai đoạn khác nhau
- Mỗi ngày nhận thêm 3-5 lead mới
- Không đủ thời gian xử lý
- SLA bị vi phạm: Gọi khách chậm, báo giá chậm
- Khách phàn nàn "không liên lạc được Sale"

**Warning signs:**
```
🚨 Metrics báo động:
  - SLA liên hệ lead: 5/10 lead vi phạm (> 2h)
  - SLA báo giá: 3/8 báo giá chậm (> 4h)
  - Response time: Trung bình 6h (tiêu chuẩn < 2h)
  - Khiếu nại: 2 khách trong tuần phàn nàn "không thấy Sale"
```

**Quy trình xử lý (Leader intervention):**

```
Step 1: Leader phát hiện (từ dashboard)
  - Dashboard Leader hiện: Sale A có SLA violation nhiều
  - Leader 1-on-1 với Sale A:
    "Em thấy tuần này em bận quá, có vấn đề gì không?"

Step 2: Đánh giá tình hình
  - Sale A báo cáo:
    - 30 đơn đang chạy (capacity thường là 15-20)
    - 10 đơn GĐ 1-2 (báo giá, chốt cọc) - cần interaction nhiều
    - 15 đơn GĐ 3-8 (đang logistics) - chỉ monitor
    - 5 đơn GĐ 11-12 (giao hàng, đối soát) - cần follow sát

  - Leader phân tích:
    - Root cause: Lead generation tăng đột biến (MKT chạy campaign)
    - Sale A chưa biết ưu tiên
    - Chưa biết delegate/automate

Step 3: Giải pháp ngắn hạn (trong ngày)
  - Leader hỗ trợ:
    A. Phân lại lead mới:
       - 5 lead mới tuần này → Assign cho Sale B, C (nhóm cùng)
       - Sale A focus: Close đơn đang có

    B. Ưu tiên:
       - Priority 1: Đơn GĐ 11-12 (giao hàng, đối soát) → Hoàn thành ngay
       - Priority 2: Đơn GĐ 1-2 (chốt cọc) → Close trong 2 ngày
       - Priority 3: Đơn GĐ 3-8 (logistics) → Set reminder, check 1 ngày/lần

    C. Automation:
       - Setup auto-reply Zalo: "Em đang bận, sẽ liên hệ lại trong 2h"
       - Template message: Cập nhật logistics hàng loạt
       - Dùng tool: Mass update status trong hệ thống

Step 4: Giải pháp dài hạn (tuần sau)
  - Leader training Sale A:
    A. Time management:
       - Block calendar: 8-10h (xử lý lead mới), 10-12h (follow đơn cũ), 14-16h (admin)
       - Batch processing: Gọi 5 khách liên tiếp, sau đó mới làm việc khác

    B. Workflow optimization:
       - Dùng CRM reminder: Tự động nhắc follow-up
       - Template: Báo giá, email, Zalo message → Copy/paste nhanh
       - Keyboard shortcut: Tạo đơn, phiếu nhanh hơn

    C. Delegation:
       - Intern/Admin: Hỗ trợ nhập data, tạo phiếu
       - Leader: Review case khó, Sale focus execution

Step 5: Review sau 1 tuần
  - Metrics cải thiện?
    - SLA liên hệ: 9/10 đạt (< 2h) ✅
    - SLA báo giá: 7/8 đạt (< 4h) ✅
    - Khiếu nại: 0 ✅

  - Nếu vẫn quá tải:
    - GĐ KD quyết định: Tuyển thêm Sale hoặc giảm lead generation
```

**Lesson learned:**
- ✅ Monitor SLA metrics real-time (dashboard quan trọng)
- ✅ Leader can thiệp sớm (đừng để Sale burn out)
- ✅ Ưu tiên + Automation + Delegation = Key to scale

---

## J4. BEST PRACTICES & COMMON MISTAKES

### Best Practices (Thực hành tốt nhất)

#### Cho SALE

```
✅ 1. Communication (Giao tiếp)
  - Gọi điện > Zalo > Email (thứ tự ưu tiên với khách quan trọng)
  - Response trong 2h: Khách thấy được "chăm sóc"
  - Update chủ động: Đừng để khách phải hỏi "hàng đâu rồi?"
  - Dùng template NHƯNG personalize: Gọi tên khách, nhắc chi tiết cá nhân

✅ 2. Documentation (Ghi chép)
  - Mọi cuộc gọi/Zalo → Note vào CRM ngay
  - Lý do: Nếu khách phàn nàn về sau, có bằng chứng
  - Format: [DD/MM HH:mm] Nội dung trao đổi. Kết quả: ...

✅ 3. Expectation Management (Quản lý kỳ vọng)
  - Underpromise, Overdeliver: Hứa 10 ngày, giao 8 ngày → Khách vui
  - Đừng hứa "chắc chắn": Logistics có biến số, nói "dự kiến" hoặc "thông thường"
  - Nếu delay: Báo khách TRƯỚC deadline, đừng để quá hạn mới nói

✅ 4. Risk Management (Quản lý rủi ro)
  - Khách mới: Cọc 50%, thận trọng hơn
  - Đơn lớn (> 100tr): Escalate Leader/GĐ KD review
  - Khách khó tính: Ghi chú đầy đủ, CC Leader vào email quan trọng

✅ 5. Continuous Learning (Học hỏi liên tục)
  - Mỗi tuần: Review 2-3 đơn mình làm (tốt/xấu), rút kinh nghiệm
  - Học từ đồng nghiệp: Sale giỏi close đơn như thế nào?
  - Tự học: Về sản phẩm, thị trường TQ, logistics
```

#### Cho LEADER

```
✅ 1. Coaching (Đào tạo)
  - 1-on-1 mỗi Sale: 1 lần/2 tuần (30 phút)
  - Role-play: Tập gọi điện khách, xử lý từ chối
  - Shadow: Nghe Sale gọi điện thật, feedback ngay

✅ 2. Monitoring (Giám sát)
  - Dashboard mỗi sáng: SLA, doanh thu, đơn risk
  - Spot check: Random kiểm tra 2-3 đơn của Sale mỗi tuần
  - Review phiếu chi: 100% phiếu chi FLAG phải xem

✅ 3. Motivation (Động viên)
  - Khen công khai: Sale close đơn lớn → Khen trong nhóm
  - Nhắc nhở riêng: Sale mắc lỗi → Nói riêng, đừng khen chê trước đám đông
  - Gamification: Bảng xếp hạng sale tuần, tháng → Tạo động lực

✅ 4. Escalation (Leo thang)
  - Biết khi nào escalate GĐ KD:
    - Case phức tạp quá khả năng
    - Giảm giá > 3%
    - Khách VIP
  - Đừng "giữ" case vì sợ trông yếu → Mục tiêu là giải quyết tốt, không phải "tự làm hết"

✅ 5. Data-Driven (Dựa trên dữ liệu)
  - Review metrics hàng tuần: Conversion rate, average deal size, sales cycle
  - So sánh: Sale A vs Sale B → Tại sao khác nhau?
  - Action: Focus cải thiện điểm yếu, không chỉ khen giỏi
```

#### Cho GĐ KD

```
✅ 1. Strategic (Chiến lược)
  - Focus vào big picture: Doanh thu cả năm, market share, competitive advantage
  - Đừng micromanage: Trust Leader xử lý operation, GĐ KD chỉ intervene case đặc biệt

✅ 2. Cross-Function (Liên phòng ban)
  - Meeting định kỳ với KT, XNK, Kho: Giải quyết bottleneck
  - VD: XNK chậm HQ → Tác động Sale → GĐ KD phối hợp TP XNK tăng tốc

✅ 3. People Development (Phát triển con người)
  - Identify high-potential Sale → Đào tạo thành Leader
  - Succession planning: Nếu Leader nghỉ, ai thay?

✅ 4. Policy & Process (Chính sách & Quy trình)
  - Review chính sách giá mỗi quý: Vẫn cạnh tranh không?
  - Cải tiến quy trình: Lắng nghe feedback Sale/Leader, đơn giản hóa

✅ 5. Customer-Centric (Hướng khách hàng)
  - Gặp khách VIP định kỳ: Giữ relationship
  - Xử lý khiếu nại lớn: Khách thấy "lãnh đạo quan tâm" → Giữ được khách
```

---

### Common Mistakes (Lỗi thường gặp)

#### Sale

```
❌ 1. Không verify specs kỹ với khách
  → Hậu quả: Hàng về không đúng, khách không nhận
  → Fix: Checklist 3 lần: Trước báo giá, trước đặt NCC, trước xuất kho

❌ 2. Hứa delivery time quá lạc quan
  → Hậu quả: Khách mất lòng tin khi delay
  → Fix: Luôn cộng buffer 3-5 ngày

❌ 3. Không gắn đơn hàng vào phiếu chi
  → Hậu quả: KT TT BLOCK, Sale bị nhắc nhở
  → Fix: Checklist trước submit: Mã đơn có chưa?

❌ 4. Báo giá thiếu chi phí phát sinh
  → Hậu quả: LN bị ăn mòn, thậm chí lỗ
  → Fix: Dùng template báo giá chuẩn (đã tính sẵn tất cả phí)

❌ 5. Không follow khách sau khi giao hàng
  → Hậu quả: Mất cơ hội upsell, cross-sell
  → Fix: Reminder 7 ngày sau giao → Gọi khách

❌ 6. Để khách chờ quá lâu không update
  → Hậu quả: Khách lo lắng, gọi liên tục, mất thời gian
  → Fix: Update chủ động mỗi 2-3 ngày (dù không có gì mới)

❌ 7. Không escalate khi cần
  → Hậu quả: Case phức tạp kéo dài, mất khách
  → Fix: Rule: Nếu stuck > 2 ngày → Escalate Leader
```

#### Leader

```
❌ 1. Duyệt phiếu không xem kỹ
  → Hậu quả: Phiếu chi gian lận qua
  → Fix: 100% phiếu chi FLAG phải xem chi tiết, gọi Sale hỏi

❌ 2. Không coaching Sale, chỉ "sai bảo"
  → Hậu quả: Sale không học được gì, lặp lại sai lầm
  → Fix: Mỗi lần sai → Giải thích tại sao, hướng dẫn cách đúng

❌ 3. Thiên vị Sale (ưu ái/ghét)
  → Hậu quả: Mất động lực nhóm, Sale giỏi nghỉ việc
  → Fix: Data-driven: Đánh giá dựa trên số liệu, không cảm tính

❌ 4. Không theo dõi SLA
  → Hậu quả: Sale vi phạm SLA nhiều, khách phàn nàn
  → Fix: Check dashboard mỗi sáng, alert Sale ngay

❌ 5. Quá nhiều meeting
  → Hậu quả: Sale không có thời gian bán hàng
  → Fix: Meeting tối đa 30 phút, focus action items
```

#### GĐ KD

```
❌ 1. Micromanage Leader
  → Hậu quả: Leader không phát triển, GĐ KD quá tải
  → Fix: Delegate, trust, chỉ review metrics + escalation

❌ 2. Không data-driven
  → Hậu quả: Quyết định dựa trên "cảm giác", sai lầm
  → Fix: Dashboard GĐ KD phải có đủ data, review trước quyết định

❌ 3. Không lắng nghe feedback
  → Hậu quả: Policy/process không thực tế, Sale/Leader bất mãn
  → Fix: Meeting tuần: Hỏi "Có vấn đề gì cần cải thiện?"

❌ 4. Không phát triển Leader
  → Hậu quả: Khi scale không có Leader mới
  → Fix: Training plan cho high-potential Sale

❌ 5. Chậm xử lý approval
  → Hậu quả: Đơn stuck, mất khách
  → Fix: SLA GĐ KD duyệt ≤ 4h, check app thường xuyên
```

---

## J5. XỬ LÝ NGOẠI LỆ (EXCEPTION HANDLING)

### Exception 1: Khách yêu cầu hủy đơn sau khi đã mua hàng (GĐ 4+)

**Độ nghiêm trọng:** HIGH (chi phí phát sinh lớn)

**Checklist xử lý:**

```
1. Xác định giai đoạn hiện tại:
   ☑ GĐ 4: Đã đặt cọc NCC → NCC chưa sản xuất
   ☑ GĐ 5: Đang sản xuất → NCC đã dùng nguyên liệu
   ☑ GĐ 6-7: Đã về kho TQ/đang ghép cont
   ☑ GĐ 8+: Đã xuất TQ hoặc đang vận chuyển

2. Tính chi phí phát sinh:
   - Cọc NCC mất (nếu NCC không hoàn): 30% FOB
   - Chi phí sản xuất (nếu đã sx): 50-100% FOB
   - Chi phí vận chuyển đã phát sinh
   - Chi phí kho TQ, đóng gói
   - Chi phí hủy container (nếu đã ghép)

3. Sale báo cáo Leader + GĐ KD:
   - Lý do khách hủy: Hết nhu cầu / Tài chính / Hàng không đúng
   - Tổng chi phí phát sinh: XXX VND
   - Đề xuất: Khách chịu XX%, TBS chịu YY%

4. GĐ KD + BGĐ quyết định:
   Option A: Thương lượng khách chịu 70-80% chi phí
   Option B: TBS chịu 50% để giữ relationship (nếu khách VIP)
   Option C: Legal action (nếu khách từ chối trách nhiệm)

5. Xử lý hàng tồn:
   - Tìm khách khác mua: Sale chào hàng trong database
   - Bán lỗ thanh lý: Giảm giá 20-30%
   - Lưu kho: Nếu hàng general, bán dần (có chi phí kho)

6. Đóng đơn:
   - KT TH hạch toán: Lỗ XXX VND
   - Lesson learned: Ghi chú nguyên nhân, phòng tránh
   - Blacklist khách? (Nếu vi phạm hợp đồng)
```

**Phòng ngừa:**
- ✅ HĐ rõ ràng: Phí hủy đơn từng giai đoạn
- ✅ Cọc cao hơn (50%) cho khách mới
- ✅ Confirm lại specs 2-3 lần trước khi đặt NCC

---

### Exception 2: NCC giao hàng không đúng specs (sai màu/size/chất lượng)

**Độ nghiêm trọng:** HIGH (ảnh hưởng khách hàng)

**Checklist xử lý:**

```
1. Phát hiện (Ai phát hiện?)
   - Agent TQ khi nhập kho (tốt nhất)
   - Sale khi verify ảnh/video từ agent
   - Khách khi nhận hàng (tệ nhất)

2. Thu thập bằng chứng ngay:
   ☑ Chụp ảnh/video: Góc rộng + close-up chi tiết lỗi
   ☑ So sánh: Ảnh NCC hứa vs Ảnh thực tế
   ☑ Screenshot: Chat với NCC, PO, invoice
   ☑ Witness: Agent xác nhận

3. Sale liên hệ NCC ngay (trong 24h):
   - Thông báo: "Hàng không đúng specs, đề nghị đổi hàng"
   - Gửi bằng chứng: Ảnh, video, so sánh
   - Yêu cầu: Đổi hàng mới HOẶC hoàn tiền 70% đã thanh toán

4. NCC phản hồi:
   Tình huống A: NCC thừa nhận lỗi, đồng ý đổi hàng
     → Timeline: 7-10 ngày sản xuất + ship lại
     → Chi phí: NCC chịu
     → Sale báo khách: "Hàng bị lỗi, đang đổi, chậm thêm 10 ngày. Em xin lỗi anh."
     → Bồi thường khách: Giảm giá 5% hoặc tặng quà

   Tình huống B: NCC chối, nói "hàng đúng specs"
     → Escalate: Sale → Leader → GĐ KD gọi NCC trực tiếp
     → Đàm phán: Chứng cứ rõ ràng, yêu cầu hoàn tiền ít nhất 50%
     → Nếu NCC vẫn từ chối → Báo sàn 1688/Taobao, claim bảo hiểm

   Tình huống C: NCC đồng ý hoàn tiền 50-70%
     → Sale quyết định:
       Option 1: Nhận tiền, tìm NCC khác sản xuất lại (chậm 15-20 ngày)
       Option 2: Bán hàng lỗi giá thấp cho khách khác, bù lỗ cho khách cũ
       Option 3: Thương lượng khách: Giảm giá 30%, khách nhận hàng lỗi

5. Xử lý với khách:
   - Báo ngay: "Anh ơi, em có tin không tốt..."
   - Đưa phương án: A/B/C như trên
   - Bồi thường: Giảm giá + tặng quà + ưu tiên đơn sau
   - Follow-up: Đảm bảo khách hài lòng với giải pháp

6. Nội bộ TBS:
   - Blacklist NCC (nếu chối trách nhiệm)
   - Update NCC rating trong hệ thống
   - Lesson learned: Tăng cường QC trước khi xuất kho TQ
```

**Phòng ngừa:**
- ✅ Yêu cầu NCC gửi sample trước khi sản xuất hàng loạt
- ✅ QC 100% hàng tại kho TQ (agent kiểm tra kỹ)
- ✅ Video unboxing khi nhập kho TQ
- ✅ Hợp đồng NCC rõ: Penalty khi giao hàng lỗi

---

### Exception 3: Công nợ quá hạn > 30 ngày, khách không trả

**Độ nghiêm trọng:** HIGH (risk mất tiền)

**Checklist xử lý:**

```
1. Timeline xử lý CN:

   T+0 (Ngày đến hạn):
     - KT TT alert Sale: "Đơn DH123 đến hạn thanh toán hôm nay"
     - Sale gọi khách nhắc nhẹ: "Anh ơi, hôm nay hạn thanh toán đơn XX ạ"

   T+3 (Quá hạn 3 ngày):
     - Sale gọi + Zalo: "Anh chị có khó khăn gì không? Em hỗ trợ được không?"
     - Đề xuất: Gia hạn 7 ngày (nếu khách có lý do chính đáng)

   T+7 (Quá hạn 1 tuần):
     - Sale gọi nghiêm túc hơn: "Anh ơi, công ty em có quy định về CN quá hạn..."
     - Email chính thức: Thư nhắc nợ (CC: Leader)
     - BLOCK khách: Không nhận đơn mới cho đến khi trả hết nợ

   T+15 (Quá hạn 2 tuần):
     - Leader gọi khách: "Anh X, tôi là Leader của Sale Y..."
     - Đàm phán: Phương án trả góp? Nếu không → Cảnh báo pháp lý
     - Alert GĐ KD: Case CN nghiêm trọng

   T+30 (Quá hạn 1 tháng):
     - GĐ KD gọi khách: Cuối cùng thương lượng
     - Options:
       Option A: Khách trả 70-80% nợ, TBS xóa 20-30% (cut loss)
       Option B: Khách trả góp trong 3 tháng (ký cam kết)
       Option C: Chuyển pháp lý (nếu khách cứng đầu/mất tích)

   T+60 (Quá hạn 2 tháng):
     - BGĐ quyết định:
       - Hire luật sư, gửi thư cảnh cáo
       - Kiện ra tòa (nếu giá trị lớn > 100 triệu)
       - Hoặc xóa nợ, blacklist khách (nếu giá trị nhỏ, chi phí kiện > nợ)

2. Xử lý nội bộ:
   - KT TH trích lập dự phòng nợ xấu: 100% sau 60 ngày
   - Sale không được hoa hồng từ đơn CN quá hạn > 30 ngày
   - Leader bị trừ KPI nếu nhóm có CN quá hạn > 30 ngày > 5% doanh thu

3. Phòng ngừa:
   - Credit check trước khi nhận đơn (khách mới)
   - Giới hạn CN: Khách thường 20-50 triệu, khách VIP 100-200 triệu
   - Theo dõi CN real-time: Dashboard Sale/Leader/GĐ KD
```

**Red flags (cảnh báo khách sắp nợ xấu):**
- 🚩 Trả chậm 2-3 đơn liên tiếp (dù cuối cùng có trả)
- 🚩 Tránh né cuộc gọi của Sale
- 🚩 Lý do trì hoãn không rõ ràng ("Tuần sau", "Đang chờ khách trả tiền")
- 🚩 Đặt đơn mới trong khi chưa trả hết nợ cũ
- 🚩 Business khách có dấu hiệu đi xuống (đóng cửa cửa hàng, sa thải NV)

**Action khi thấy red flag:**
- ✅ Tăng cảnh giác: Theo dõi sát hơn
- ✅ Giảm credit limit: 50 triệu → 20 triệu
- ✅ Yêu cầu TT trước khi giao hàng (thay vì CN)
- ✅ Alert Leader + GĐ KD

---

## J6. PHỐI HỢP GIỮA CÁC BỘ PHẬN (INTER-DEPARTMENT COORDINATION)

### Case 1: Sale ↔ XNK - Logistics Issues

**Tình huống thường gặp:**

```
Issue: Hàng stuck ở HQ (phân luồng đỏ)
  → Khách liên tục hỏi Sale: "Hàng đâu rồi?"
  → Sale không biết chi tiết HQ, chỉ biết "đang xử lý"
  → Khách mất lòng tin
```

**Best practice phối hợp:**

```
1. Communication channel rõ ràng:
   - Hệ thống: XNK update status đơn real-time trong module
   - Zalo group: "XNK + Sale" (cho case urgent)
   - SLA: XNK reply câu hỏi Sale trong 2h (HC)

2. Sale hỏi XNK đúng cách:
   ❌ Sai: "Anh ơi, đơn DH123 sao vậy?"
   ✅ Đúng: "Anh ơi, đơn DH123 đang stuck ở HQ phải không ạ? Lý do gì và dự kiến bao giờ xong? Em cần thông tin để báo khách."

3. XNK trả lời cụ thể:
   ❌ Sai: "Đang xử lý"
   ✅ Đúng: "Phân luồng đỏ, HQ yêu cầu bổ sung CO (Certificate of Origin). Tôi đã gửi, dự kiến 2-3 ngày nữa thông quan được. Em báo khách nhé."

4. Sale update khách:
   ✅ "Anh ơi, em update: Hàng đang HQ, cần bổ sung giấy tờ, dự kiến 2-3 ngày nữa về kho. Em sẽ báo anh ngay khi có update."

5. Escalation (nếu cần):
   - XNK không reply trong 2h → Sale nhắc lại + tag Leader
   - Stuck > 5 ngày → Sale escalate Leader → Leader gọi TP XNK
   - TP XNK + GĐ KD họp: Tìm giải pháp nhanh (quan hệ HQ? Thuê broker?)
```

**Meeting định kỳ (tuần 1 lần):**
```
Participants: TP XNK + GĐ KD + 1-2 Leader đại diện

Agenda:
  1. Review: Đơn nào đang stuck logistics (5 phút)
  2. Root cause: Tại sao stuck? (10 phút)
  3. Action plan: Làm gì để resolve? (10 phút)
  4. Phòng ngừa: Process improvement (5 phút)

Output: Action items với deadline rõ ràng
```

---

### Case 2: Sale ↔ KẾ TOÁN - Payment Issues

**Tình huống thường gặp:**

```
Issue: Sale tạo phiếu chi → KT TT từ chối → Sale không hiểu tại sao
  → Sale tạo lại phiếu → Lại bị từ chối
  → Đơn delay, NCC chờ tiền
```

**Best practice phối hợp:**

```
1. KT TT từ chối phải ghi rõ lý do:
   ❌ Sai: "Không duyệt"
   ✅ Đúng: "Không duyệt. Lý do: Thiếu chứng từ invoice NCC. Vui lòng bổ sung."

2. Sale fix và resubmit:
   - Đọc kỹ lý do từ chối
   - Bổ sung đầy đủ (invoice, screenshot TT, hợp đồng)
   - Note: "Em đã bổ sung invoice NCC, anh kiểm tra lại giúp em ạ"

3. KT TT review lại trong 1h (urgent case)

4. Nếu không rõ:
   - Sale gọi điện KT TT: "Chị ơi, phiếu DH123 em không hiểu cần bổ sung gì, chị hướng dẫn em được không?"
   - KT TT giải thích: "Em cần invoice có đóng dấu đỏ của NCC, không phải screenshot"

5. Training (quý 1 lần):
   - KT TT đào tạo Sale: Cách tạo phiếu đúng, chứng từ cần gì
   - Sale học 1 lần, sau đó ít bị từ chối hơn
```

**Common reasons KT TT từ chối phiếu:**
```
1. Thiếu/sai chứng từ (70%)
2. Không gắn mã đơn hàng (15%)
3. Số tiền không khớp với invoice (10%)
4. Lý do chi không rõ ràng (5%)
```

**Fix:** Checklist trước khi submit (Sale tự check):
```
☑ Mã đơn hàng: DH...
☑ Loại chi phí: Dropdown chọn đúng
☑ Số tiền: Khớp với invoice
☑ Người thụ hưởng: Tên NCC/người nhận
☑ Lý do chi: ≥ 20 ký tự, rõ ràng
☑ Chứng từ: ≥ 1 file PDF/ảnh (invoice, screenshot TT, hợp đồng)
```

---

### Case 3: Sale ↔ KHO VN - Delivery Issues

**Tình huống thường gặp:**

```
Issue: Khách phàn nàn "Hẹn giao 9h sáng, 11h chưa thấy xe"
  → Khách gọi Sale
  → Sale không biết xe đâu, gọi Trưởng kho
  → Trưởng kho nói "Xe đang kẹt đường"
  → Khách không hài lòng
```

**Best practice phối hợp:**

```
1. Hẹn giao hàng rõ ràng:
   Sale ↔ Khách: "Anh muốn giao ngày/giờ nào?"
   Sale ↔ Trưởng kho: "Đơn DH123, khách hẹn [DD/MM] [9h-11h sáng], địa chỉ [XXX], SĐT [YYY]"

   ⚠️ Lưu ý:
   - Không hứa giờ cụ thể ("9h đúng") → Hứa khung giờ ("9-11h sáng")
   - Buffer: Nếu route xa, hẹn khung rộng hơn ("8-12h")

2. Trưởng kho confirm:
   "OK, đơn DH123 em phân lái xe A, dự kiến đến 9-10h. Nếu có gì em báo anh ngay."

3. Tracking real-time:
   - Hệ thống: Lái xe update "Đang giao" khi xuất phát
   - Lái xe gọi khách trước 30 phút: "Em là lái xe TBS, 30 phút nữa em đến ạ"
   - Nếu delay: Lái xe gọi Sale → Sale gọi khách TRƯỚC giờ hẹn
     "Anh ơi, xe đang kẹt đường, dự kiến chậm 30 phút, anh thông cảm ạ"

4. Xử lý delay:
   - Delay < 1h: Xin lỗi khách, không bồi thường
   - Delay 1-2h: Gọi xin lỗi, tặng voucher đơn sau
   - Delay > 2h hoặc không giao được: Bồi thường, giao lại ngay hôm sau (free)

5. Sau giao hàng:
   - Lái xe update hệ thống: POD, chữ ký, ảnh
   - Sale gọi khách (sau 2h): "Anh nhận hàng OK chưa ạ?"
   - Trưởng kho báo cáo EOD: Đơn nào giao thành công, đơn nào chưa
```

**Meeting định kỳ (tuần 1 lần):**
```
Participants: Trưởng kho HN + Trưởng kho HCM + GĐ KD + Leader đại diện

Agenda:
  1. Review tuần trước: Tỷ lệ giao thành công (target > 95%)
  2. Issues: Đơn nào giao không thành công? Lý do?
  3. Feedback từ khách: Khách phàn nàn gì về giao hàng?
  4. Process improvement: Cải thiện điểm nào?

Output: Action items, adjust process
```

---

## J7. PERFORMANCE METRICS & KPIs

### KPI Sale (Individual)

```
1. Doanh thu (Revenue)
   - Target tháng: 200-500 triệu (tùy level)
   - Đo: Tổng giá trị đơn hoàn thành trong tháng
   - Trọng số: 40%

2. Số đơn hàng (Number of Orders)
   - Target tháng: 15-30 đơn
   - Đo: Số đơn chuyển trạng thái COMPLETED
   - Trọng số: 20%

3. Tỷ lệ chuyển đổi (Conversion Rate)
   - Target: > 30% (lead → đơn hàng)
   - Đo: (Số đơn / Số lead nhận) × 100%
   - Trọng số: 15%

4. Lợi nhuận trung bình (Average Margin)
   - Target: > 15%
   - Đo: Trung bình LN% của tất cả đơn
   - Trọng số: 15%

5. Thu hồi công nợ (AR Collection)
   - Target: CN < 15 ngày = 90% đơn
   - Đo: (Số đơn thu đủ tiền đúng hạn / Tổng đơn) × 100%
   - Trọng số: 10%

6. SLA Compliance
   - Target: > 90%
   - Đo: (Số task đúng SLA / Tổng task) × 100%
   - Trọng số: Không tính điểm, nhưng vi phạm > 10% → Warning
```

**Bảng xếp hạng Sale (Leaderboard):**
```
Rank | Sale     | Doanh thu | Số đơn | LN%  | Score
-----|----------|-----------|--------|------|-------
  1  | Nguyễn A | 450tr     | 25     | 18%  | 95
  2  | Trần B   | 400tr     | 28     | 16%  | 92
  3  | Lê C     | 380tr     | 22     | 20%  | 90
...

→ TOP 3 được thưởng, công khai, tạo động lực
```

---

### KPI Leader (Team)

```
1. Doanh thu nhóm (Team Revenue)
   - Target: 1-2 tỷ/tháng (tùy số Sale)
   - Đo: Tổng doanh thu tất cả Sale trong nhóm
   - Trọng số: 30%

2. Tỷ lệ đạt target cá nhân (Individual Target Achievement)
   - Target: > 80% Sale đạt target
   - Đo: (Số Sale đạt ≥ 80% target / Tổng Sale) × 100%
   - Trọng số: 20%

3. Tỷ lệ công nợ quá hạn (Overdue AR)
   - Target: < 5% doanh thu
   - Đo: (Tổng CN > 30 ngày / Doanh thu tháng) × 100%
   - Trọng số: 20%

4. Approval SLA (Leader)
   - Target: > 95% duyệt trong 2h
   - Đo: (Số approval đúng SLA / Tổng approval) × 100%
   - Trọng số: 10%

5. Phát triển nhân sự (People Development)
   - Target: Training ≥ 2 sessions/tháng, 1-on-1 mỗi Sale ≥ 2 lần/tháng
   - Đo: Self-report + verify bởi GĐ KD
   - Trọng số: 10%

6. Phiếu chi FLAG (Anti-Fraud)
   - Target: 0 phiếu chi gian lận qua
   - Đo: Số phiếu chi bị audit phát hiện sai / Tổng phiếu duyệt
   - Trọng số: 10% (critical)
```

---

### KPI GĐ Kinh Doanh

```
1. Doanh thu toàn công ty (Company Revenue)
   - Target: 10-20 tỷ/tháng (tùy giai đoạn)
   - Đo: Tổng doanh thu 2 chi nhánh HN + HCM
   - Trọng số: 40%

2. Lợi nhuận (Profit)
   - Target: Tổng LN > 2 tỷ/tháng, LN% > 15%
   - Đo: KT TH báo cáo
   - Trọng số: 30%

3. Tỷ lệ Leader/Sale đạt target
   - Target: > 70% Leader đạt target
   - Đo: (Số Leader đạt ≥ 80% target / Tổng Leader) × 100%
   - Trọng số: 15%

4. Công nợ quá hạn toàn công ty
   - Target: < 3% doanh thu
   - Đo: (Tổng CN > 30 ngày / Doanh thu tháng) × 100%
   - Trọng số: 10%

5. Chiến lược & Process Improvement
   - Target: ≥ 1 improvement/quý (policy, process, training)
   - Đo: Self-report + BGĐ đánh giá
   - Trọng số: 5%
```

---

### Dashboard quan trọng cần có trong hệ thống

#### Dashboard Sale (Cá nhân)

```
[ Doanh thu tháng này ]  [ LN tháng này ]  [ Hoa hồng dự kiến ]
    350tr / 400tr            18%              12tr
    ███████░░ 88%

[ Đơn hàng theo trạng thái ]
  - Đang tư vấn: 5 đơn
  - Chờ cọc: 3 đơn
  - Đang logistics: 8 đơn
  - Chờ giao hàng: 2 đơn
  - Đối soát: 1 đơn

[ Công nợ khách hàng ]
  - Trong hạn: 15 đơn (30tr)
  - Sắp hạn (T-3): 2 đơn (5tr) ⚠️
  - Quá hạn: 1 đơn (3tr) 🚨

[ Task cần làm hôm nay ]
  1. Gọi khách A (lead mới) - SLA: còn 1h
  2. Gửi báo giá khách B - SLA: còn 2h
  3. Follow khách C (cọc quá hạn 2 ngày) - URGENT
  4. Verify agent: Đơn DH123 nhập kho TQ - SLA: còn 3h

[ Leaderboard tuần này ]
  Bạn: #3 / 20 Sale (85 điểm)
  TOP 1: Nguyễn A (95 điểm) ⭐
```

#### Dashboard Leader (Nhóm)

```
[ Doanh thu nhóm ]          [ Tỷ lệ đạt target ]
  1.2 tỷ / 1.5 tỷ               4/5 Sale (80%)
  ████████░ 80%

[ Performance từng Sale ]
  Sale A: 450tr / 400tr ✅ (112%)
  Sale B: 380tr / 400tr ⚠️ (95%)
  Sale C: 250tr / 400tr 🚨 (62%) ← Cần coaching
  Sale D: 100tr / 400tr 🚨 (25%) ← Risk không đạt
  Sale E: 20tr / 400tr 🚨 (5%) ← Mới onboard

[ Approval pending ]
  - Giảm giá: 3 requests (SLA: < 2h)
  - Hủy đơn: 1 request
  - Phiếu chi FLAG: 2 phiếu 🚨 (cần xem ngay)

[ SLA violations tuần này ]
  - Sale C: 3 lần chậm gọi khách
  - Sale D: 2 lần chậm báo giá

[ Công nợ nhóm ]
  - Trong hạn: 200tr
  - Quá hạn < 15 ngày: 20tr ⚠️
  - Quá hạn > 30 ngày: 5tr 🚨
```

#### Dashboard GĐ Kinh Doanh (Toàn công ty)

```
[ Doanh thu 2 CN ]            [ Lợi nhuận ]
  HN: 8 tỷ                     2.5 tỷ (15.6%)
  HCM: 8 tỷ                     ████░ Good
  Total: 16 tỷ / 18 tỷ (89%)

[ Performance Leader ]
  Leader 1 (HN): 120% ✅
  Leader 2 (HN): 95% ⚠️
  Leader 3 (HCM): 110% ✅
  Leader 4 (HCM): 70% 🚨 ← Cần review

[ TOP Metrics ]
  - Conversion rate: 32% (target 30%) ✅
  - Average deal size: 15tr (tăng 10% vs tháng trước) ✅
  - Sales cycle: 18 ngày (giảm 2 ngày vs tháng trước) ✅
  - CN quá hạn: 2.8% (target < 3%) ✅

[ Alerts ]
  🚨 5 đơn CN > 60 ngày (tổng 50tr) - Cần action
  ⚠️ 3 Leader SLA approval < 90%
  ⚠️ Doanh thu tuần này -15% vs tuần trước

[ Pipeline forecast ]
  Tháng sau dự kiến: 19 tỷ (dựa trên pipeline hiện tại)
```

---

*Tài liệu phản ánh cơ cấu thực tế TBS Group tháng 2/2026.*
*Bản chính thức cho development team thiết kế TBS ERP.*
