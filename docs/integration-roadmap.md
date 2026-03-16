# LO TRINH TICH HOP HE THONG TBS ERP
# LO TRINH TICH HOP - INTEGRATION ROADMAP

> **Phien ban:** 2.0 | **Ngay cap nhat:** 2026-02-25
> **Phu trach:** Ban Giam doc Cong nghe | **Phe duyet:** Ban Giam doc TBS Group
> **Ma tai lieu:** BGD-5 | **Trang thai:** Dang trien khai

---

## MUC LUC

1. [Tong quan](#1-tong-quan)
2. [Bang tong hop lo trinh](#2-bang-tong-hop-lo-trinh)
3. [Tich hop Ngan hang](#3-tich-hop-ngan-hang)
4. [Tich hop San TMDT](#4-tich-hop-san-tmdt)
5. [Tich hop Hang tau / Logistics](#5-tich-hop-hang-tau--logistics)
6. [Tich hop Ke toan](#6-tich-hop-ke-toan)
7. [Tich hop Hai quan](#7-tich-hop-hai-quan)
8. [Tich hop LarkSuite / Zalo](#8-tich-hop-larksuite--zalo)
9. [Kien truc ky thuat tich hop](#9-kien-truc-ky-thuat-tich-hop)
10. [Quan ly rui ro](#10-quan-ly-rui-ro)
11. [Ngan sach du kien](#11-ngan-sach-du-kien)
12. [Phu luc](#12-phu-luc)

---

## 1. TONG QUAN

### 1.1 Muc dich

Tai lieu nay mo ta chi tiet lo trinh tich hop he thong TBS ERP voi cac doi tac va nen tang ben ngoai, nham:

- **Tu dong hoa quy trinh**: Giam thieu thao tac thu cong, tang hieu qua van hanh
- **Dong bo du lieu thoi gian thuc**: Dam bao tinh nhat quan giua cac he thong
- **Mo rong kenh ban hang**: Ket noi san thuong mai dien tu, tang doanh thu
- **Tuan thu phap luat**: Dap ung yeu cau ve hoa don dien tu, khai hai quan dien tu
- **Nang cao trai nghiem khach hang**: Thong bao tu dong, theo doi don hang tien loi

### 1.2 Pham vi

| Linh vuc tich hop | So doi tac | Giai doan | Uu tien |
|---|---|---|---|
| Ngan hang | 3 ngan hang | Q2 2026 | :red_circle: Cao |
| San TMDT | 3 san | Q3 2026 | :orange_circle: Trung binh |
| Hang tau / Logistics | 3 hang tau | Q2 2026 | :red_circle: Cao |
| Ke toan | 2 phan mem | Q3 2026 | :orange_circle: Trung binh |
| Hai quan (VNACCS/VCIS) | 1 he thong | Q4 2026 | :red_circle: Cao |
| LarkSuite / Zalo | 2 nen tang | Q2-Q3 2026 | :red_circle: Cao |

### 1.3 Ky hieu trang thai

| Ky hieu | Y nghia |
|---|---|
| `[CHUA BAT DAU]` | Chua bat dau trien khai |
| `[DANG PHAN TICH]` | Dang phan tich yeu cau, thiet ke |
| `[DANG PHAT TRIEN]` | Dang lap trinh, tich hop |
| `[DANG TEST]` | Dang kiem thu |
| `[HOAN THANH]` | Da hoan thanh va go live |
| `[TAM HOAN]` | Tam hoan do thay doi ke hoach |

---

## 2. BANG TONG HOP LO TRINH

### 2.1 Timeline theo Quy

```
Q2/2026 (04-06/2026)
├── Ngan hang: Ket noi API doc sao ke + Doi soat tu dong
├── Hang tau: Tracking tu dong (Maersk, COSCO, Yang Ming)
├── LarkSuite: Dong bo nhan su + Luong phe duyet
└── Zalo ZNS: Thong bao trang thai don hang

Q3/2026 (07-09/2026)
├── San TMDT: Shopee, Lazada, TikTok Shop API
├── Ke toan: MISA, Fast Accounting lien thong
├── Ngan hang: Thanh toan tu dong + Webhook
├── Hang tau: Dat cho tu dong
└── Zalo: Chatbot tra cuu don hang

Q4/2026 (10-12/2026)
├── Hai quan: VNACCS/VCIS khai bao dien tu
├── San TMDT: Analytics da kenh
├── Ngan hang: Quan ly ngoai te tu dong
└── Hang tau: Chung tu dien tu (eBL)
```

### 2.2 Bang tong hop uu tien va tien do

| # | Module tich hop | Uu tien | Thoi gian | Trang thai | Phu trach | ROI du kien |
|---|---|---|---|---|---|---|
| 1 | Ngan hang - Doi soat tu dong | CAO | Q2 2026 | `[DANG PHAN TICH]` | Team Backend | Giam 70% thoi gian doi soat |
| 2 | Hang tau - Tracking tu dong | CAO | Q2 2026 | `[DANG PHAN TICH]` | Team Backend | Giam 90% thoi gian check tracking |
| 3 | LarkSuite - Nhan su & Phe duyet | CAO | Q2 2026 | `[CHUA BAT DAU]` | Team Backend + HR | Giam 60% thoi gian phe duyet |
| 4 | Zalo ZNS - Thong bao KH | CAO | Q2 2026 | `[CHUA BAT DAU]` | Team Backend | Tang 50% hai long KH |
| 5 | San TMDT - Dong bo don hang | TB | Q3 2026 | `[CHUA BAT DAU]` | Team Backend | Mo rong 3+ kenh ban |
| 6 | Ke toan - MISA / Fast | TB | Q3 2026 | `[CHUA BAT DAU]` | Team Backend + KT | Giam 80% nhap lieu thu cong |
| 7 | Hai quan - VNACCS/VCIS | CAO | Q4 2026 | `[CHUA BAT DAU]` | Team Backend + XNK | Giam 50% thoi gian thong quan |
| 8 | Ngan hang - Thanh toan tu dong | TB | Q3 2026 | `[CHUA BAT DAU]` | Team Backend | Giam 60% thoi gian thanh toan |
| 9 | Hang tau - Dat cho tu dong | TB | Q3 2026 | `[CHUA BAT DAU]` | Team Backend | Giam 30% chi phi van chuyen |
| 10 | San TMDT - Ton kho da kenh | TB | Q3 2026 | `[CHUA BAT DAU]` | Team Backend | Giam 40% ton kho chet |

---

## 3. TICH HOP NGAN HANG

### 3.1 Tong quan

| Thuoc tinh | Gia tri |
|---|---|
| **Doi tac** | Vietcombank (VCB), BIDV, Techcombank (TCB) |
| **Giao thuc** | REST API, SOAP (VCB), SFTP (bao cao) |
| **Bao mat** | OAuth2, HMAC-SHA256 signing, IP whitelisting, mTLS |
| **Timeline** | Q2 2026 (GD1) - Q4 2026 (GD3) |
| **Uu tien** | CAO |
| **Trang thai** | `[DANG PHAN TICH]` |

### 3.2 Giai doan 1: Doi soat tu dong (Q2 2026)

**Muc tieu:** Tu dong doc sao ke ngan hang va doi chieu voi phieu thu/chi trong ERP.

**Chuc nang chi tiet:**

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Ket noi API doc sao ke | Lay giao dich tu VCB, BIDV, TCB theo lich (moi 30 phut) | CAO |
| 2 | Phan tich giao dich | Parse noi dung chuyen khoan, nhan dien ma don hang | CAO |
| 3 | Doi chieu tu dong | Match giao dich ngan hang voi phieu thu/chi trong ERP | CAO |
| 4 | Canh bao chenh lech | Thong bao khi co giao dich chua khop hoac chenh lech so tien | CAO |
| 5 | Bao cao doi soat | Bao cao doi soat hang ngay/tuan/thang tu dong | TB |
| 6 | Xu ly ngoai le | Giao dien xu ly giao dich khong tu dong khop duoc | TB |

**Luong xu ly doi soat tu dong:**

```
Ngan hang API ──> [Fetch Transactions]
                        │
                        v
              [Parse & Normalize]
                        │
                        v
              [Auto-Matching Engine] ──> Match theo:
                        │                 - Ma don hang trong noi dung CK
                        │                 - So tien chinh xac
                        │                 - Ten nguoi chuyen
                        │
                   ┌────┴────┐
                   v         v
            [KHOP]     [KHONG KHOP]
               │              │
               v              v
       [Tu dong ghi        [Dua vao hang doi]
        nhan phieu]              │
                                 v
                         [Thong bao Ke toan]
                                 │
                                 v
                         [Xu ly thu cong]
```

**API Spec cho tung ngan hang:**

| Ngan hang | Endpoint | Xac thuc | Rate limit | Dinh dang |
|---|---|---|---|---|
| Vietcombank | SOAP/XML Gateway | Digital Certificate + OTP | 100 req/phut | XML |
| BIDV | REST API v2.0 | OAuth2 Client Credentials | 200 req/phut | JSON |
| Techcombank | REST API v3.0 | API Key + HMAC-SHA256 | 500 req/phut | JSON |

### 3.3 Giai doan 2: Thanh toan tu dong (Q3 2026)

**Muc tieu:** Tao va thuc hien lenh chuyen khoan truc tiep tu ERP.

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Tao lenh chuyen khoan | Tao lenh CK tu phieu chi duoc duyet trong ERP | CAO |
| 2 | Phe duyet nhieu cap | Luong phe duyet theo han muc (< 50tr: 1 cap, >= 50tr: 2 cap) | CAO |
| 3 | Xac nhan real-time | Nhan ket qua CK qua webhook tu ngan hang | CAO |
| 4 | Thanh toan hang loat | Thanh toan nhieu phieu chi cung luc (batch payment) | TB |
| 5 | Thanh toan NCC Trung Quoc | Chuyen khoan quoc te cho NCC TQ qua SWIFT/T-T | TB |
| 6 | Lich su giao dich | Luu tru va tra cuu toan bo lich su thanh toan | TB |

### 3.4 Giai doan 3: Quan ly ngoai te (Q4 2026)

**Muc tieu:** Tu dong hoa viec mua ban ngoai te va hedging ty gia.

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | So sanh ty gia | Lay ty gia tu nhieu ngan hang, chon gia tot nhat | CAO |
| 2 | Mua ngoai te tu dong | Dat lenh mua USD/CNY khi ty gia dat nguong | TB |
| 3 | Hedging ty gia | Hop dong ky han cho don hang lon (> $50,000) | THAP |
| 4 | Bao cao lai/lo ty gia | Tinh lai/lo ty gia tu dong cho tung don hang | TB |

---

## 4. TICH HOP SAN TMDT

### 4.1 Tong quan

| Thuoc tinh | Gia tri |
|---|---|
| **Doi tac** | Shopee, Lazada, TikTok Shop |
| **Giao thuc** | REST API (tat ca), Webhook |
| **Bao mat** | OAuth2 (Shopee, Lazada), Access Token (TikTok Shop) |
| **Timeline** | Q3 2026 (GD1) - Q4 2026 (GD3) |
| **Uu tien** | TRUNG BINH |
| **Trang thai** | `[CHUA BAT DAU]` |

### 4.2 Giai doan 1: Dong bo don hang (Q3 2026)

**Muc tieu:** Tu dong tao don hang trong ERP khi co don moi tren san TMDT.

**Chuc nang chi tiet:**

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Ket noi API san | Dang ky app, lay token cho Shopee, Lazada, TikTok Shop | CAO |
| 2 | Webhook nhan don | Nhan thong bao don hang moi qua webhook tu cac san | CAO |
| 3 | Map san pham | Anh xa san pham tren san voi san pham trong ERP (SKU mapping) | CAO |
| 4 | Tu dong tao don | Tao don hang VCT/MHH tuong ung trong ERP | CAO |
| 5 | Dong bo trang thai | Cap nhat trang thai don hang 2 chieu (ERP <-> San) | CAO |
| 6 | Xu ly huy/hoan | Dong bo trang thai huy don, hoan hang tu san ve ERP | TB |

**Luong dong bo don hang:**

```
San TMDT ──webhook──> [Webhook Receiver]
                            │
                            v
                    [Validate & Parse]
                            │
                            v
                    [Product Mapping] ──> Tim SKU trong ERP
                            │
                    ┌───────┴───────┐
                    v               v
             [TIM THAY]     [KHONG TIM THAY]
                 │                  │
                 v                  v
         [Tao Don Hang        [Tao ticket canh bao]
          trong ERP]               │
                 │                  v
                 v           [Nhan vien xu ly
         [Cap nhat trang      thu cong]
          thai ve San]
```

**Thong tin API tung san:**

| San TMDT | API Version | Auth | Webhook | Rate Limit | Tai lieu |
|---|---|---|---|---|---|
| Shopee | Open API v2.0 | OAuth2 + Shop ID | Co | 10,000/ngay | open.shopee.com |
| Lazada | Open Platform 2.0 | OAuth2 + App Key | Co | 50 req/giay | open.lazada.com |
| TikTok Shop | Open API v202309 | Access Token | Co | 600 req/phut | partner.tiktokshop.com |

### 4.3 Giai doan 2: Dong bo ton kho da kenh (Q3 2026)

**Muc tieu:** Dam bao so luong ton kho nhat quan giua ERP va cac san.

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Push ton kho | Day so luong ton kho tu ERP len cac san khi co thay doi | CAO |
| 2 | Reserve stock | Giu hang khi co don chua xac nhan tren san | CAO |
| 3 | Canh bao het hang | Tu dong an san pham khi ton kho = 0, hien lai khi nhap hang | TB |
| 4 | Phan bo ton kho | Quy tac phan bo ton kho theo do uu tien cua tung kenh | TB |
| 5 | Dong bo gia ban | Cap nhat gia ban theo quy tac rieng cho tung san | THAP |

### 4.4 Giai doan 3: Analytics da kenh (Q4 2026)

**Muc tieu:** Dashboard tong hop va phan tich hieu suat ban hang da kenh.

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Dashboard doanh thu | Tong hop doanh thu tu tat ca kenh ban hang | CAO |
| 2 | Phan tich loi nhuan | Tinh loi nhuan theo tung kenh (tru phi san, van chuyen) | CAO |
| 3 | So sanh hieu suat | So sanh conversion rate, don trung binh giua cac kenh | TB |
| 4 | De xuat toi uu | AI goi y san pham nen day manh tren kenh nao | THAP |

---

## 5. TICH HOP HANG TAU / LOGISTICS

### 5.1 Tong quan

| Thuoc tinh | Gia tri |
|---|---|
| **Doi tac** | Maersk, COSCO Shipping, Yang Ming |
| **Giao thuc** | REST API, EDI (INTTRA), Webhook |
| **Bao mat** | API Key, OAuth2 (Maersk), Certificate (COSCO) |
| **Timeline** | Q2 2026 (GD1) - Q4 2026 (GD3) |
| **Uu tien** | CAO |
| **Trang thai** | `[DANG PHAN TICH]` |

### 5.2 Giai doan 1: Tracking tu dong (Q2 2026)

**Muc tieu:** Tu dong cap nhat vi tri container va thong bao cac moc quan trong.

**Chuc nang chi tiet:**

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Ket noi Tracking API | Tich hop API tracking cua Maersk, COSCO, Yang Ming | CAO |
| 2 | Polling dinh ky | Tu dong check vi tri container moi 2 gio | CAO |
| 3 | Cap nhat vi tri | Luu lich su di chuyen container vao he thong | CAO |
| 4 | Thong bao moc quan trong | Push notification khi: xuat phat, den cang trung chuyen, den cang dich | CAO |
| 5 | ETA du bao | Du bao thoi gian den cang dich dua tren du lieu thoi gian thuc | TB |
| 6 | Ban do theo doi | Hien thi vi tri container tren ban do (Google Maps API) | THAP |

**Luong tracking tu dong:**

```
[Cron Job moi 2h] ──> [Tracking Service]
                            │
               ┌────────────┼────────────┐
               v            v            v
         [Maersk API] [COSCO API] [Yang Ming API]
               │            │            │
               └────────────┼────────────┘
                            v
                   [Normalize Data]
                            │
                            v
                   [So sanh voi trang thai cu]
                            │
                   ┌────────┴────────┐
                   v                 v
            [CO THAY DOI]    [KHONG DOI]
                 │                  │
                 v                  v
         [Cap nhat DB]         [Bo qua]
                 │
                 v
         [Check moc quan trong?]
                 │
            ┌────┴────┐
            v         v
         [CO]      [KHONG]
           │
           v
    [Gui thong bao]
    - Zalo ZNS cho KH
    - LarkSuite cho nhan vien
    - Email cho ke toan
```

**Thong tin API tung hang tau:**

| Hang tau | API | Xac thuc | Du lieu | Rate limit |
|---|---|---|---|---|
| Maersk | Track & Trace API v2 | OAuth2 (Consumer Key) | Container, B/L, Booking | 100 req/phut |
| COSCO | COSCO Syncon Hub API | API Key + Certificate | Container, Vessel | 60 req/phut |
| Yang Ming | Yang Ming eService API | API Key + Token | Container, B/L | 30 req/phut |

### 5.3 Giai doan 2: Dat cho tu dong (Q3 2026)

**Muc tieu:** Gui booking request truc tiep qua API hang tau, so sanh gia cuoc.

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Yeu cau bao gia | Gui yeu cau bao gia cuoc tu ERP den nhieu hang tau | CAO |
| 2 | So sanh gia cuoc | Bang so sanh gia cuoc, thoi gian van chuyen giua cac hang | CAO |
| 3 | Dat booking | Gui booking request tu dong khi ke toan duyet | CAO |
| 4 | Nhan Booking Confirmation | Tu dong cap nhat so booking vao don hang ERP | TB |
| 5 | Tu dong chon hang toi uu | Goi y hang tau toi uu theo chi phi + thoi gian | THAP |

### 5.4 Giai doan 3: Chung tu dien tu (Q4 2026)

**Muc tieu:** Xu ly Bill of Lading dien tu va lien thong chung tu.

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Nhan eBL | Nhan Bill of Lading dien tu tu hang tau | CAO |
| 2 | Luu tru chung tu | Quan ly tap trung Packing List, Invoice, C/O dien tu | CAO |
| 3 | Chia se voi Hai quan | Tu dong gui chung tu sang module Hai quan | TB |
| 4 | Chia se voi Ngan hang | Gui chung tu cho ngan hang de lam L/C | THAP |

---

## 6. TICH HOP KE TOAN

### 6.1 Tong quan

| Thuoc tinh | Gia tri |
|---|---|
| **Doi tac** | MISA SME.NET, Fast Accounting |
| **Giao thuc** | REST API (MISA), File Import/Export (Fast), XML |
| **Bao mat** | API Key (MISA), File encryption (Fast) |
| **Timeline** | Q3 2026 |
| **Uu tien** | TRUNG BINH |
| **Trang thai** | `[CHUA BAT DAU]` |

### 6.2 Giai doan 1: Xuat/Nhap du lieu (Q3 2026)

**Muc tieu:** Dong bo du lieu ke toan giua ERP va phan mem ke toan chuyen dung.

**Chuc nang chi tiet:**

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Dong bo he thong tai khoan | Map he thong tai khoan ERP voi MISA/Fast | CAO |
| 2 | Xuat phieu thu/chi | Tu dong xuat phieu thu/chi tu ERP sang phan mem KT | CAO |
| 3 | Xuat hoa don ban | Day hoa don ban hang sang phan mem KT de ghi so | CAO |
| 4 | Nhap hoa don mua | Nhap hoa don dau vao tu phan mem KT vao ERP | CAO |
| 5 | Dong bo cong no | Doi chieu cong no phai thu/phai tra giua 2 he thong | TB |
| 6 | Bao cao thue | Xuat du lieu bao cao thue GTGT, TNDN tu ERP | TB |

**Anh xa he thong tai khoan (Chart of Accounts Mapping):**

| TK ERP | Mo ta | TK MISA | TK Fast |
|---|---|---|---|
| 111 | Tien mat | 1111 | 111 |
| 112 | Tien gui ngan hang | 1121 | 112 |
| 131 | Phai thu khach hang | 1311 | 131 |
| 331 | Phai tra NCC | 3311 | 331 |
| 511 | Doanh thu ban hang | 5111 | 511 |
| 632 | Gia von hang ban | 6321 | 632 |
| 641 | Chi phi ban hang | 6411 | 641 |
| 642 | Chi phi quan ly DN | 6421 | 642 |
| 515 | Doanh thu tai chinh | 5151 | 515 |
| 635 | Chi phi tai chinh | 6351 | 635 |

**Luong dong bo du lieu:**

```
ERP System                              Phan mem Ke toan
┌─────────────────┐                    ┌─────────────────┐
│                 │                    │                 │
│  Phieu thu/chi  │───── API/File ────>│  Phieu thu/chi  │
│                 │                    │                 │
│  Hoa don ban    │───── API/File ────>│  Hoa don dau ra │
│                 │                    │                 │
│  Don mua hang   │<──── API/File ─────│  Hoa don dau vao│
│                 │                    │                 │
│  Cong no        │<───── Sync ──────>│  So cong no     │
│                 │                    │                 │
│  Bao cao thue   │<──── Export ──────│  Bao cao thue   │
│                 │                    │                 │
└─────────────────┘                    └─────────────────┘
```

**Chi tiet tich hop theo phan mem:**

| Tinh nang | MISA SME.NET | Fast Accounting |
|---|---|---|
| **Phuong thuc ket noi** | REST API (amis.misa.vn) | File XML/Excel import |
| **Dong bo tai khoan** | API `GET /accounts` | File Excel template |
| **Xuat phieu thu** | API `POST /cash-receipts` | File XML theo mau Fast |
| **Xuat phieu chi** | API `POST /cash-payments` | File XML theo mau Fast |
| **Xuat hoa don** | API `POST /sa-invoices` | File XML theo mau Fast |
| **Nhap hoa don mua** | API `GET /pu-invoices` | Doc file XML export |
| **Tan suat dong bo** | Real-time / Moi 15 phut | Hang ngay (batch) |
| **Xu ly loi** | Retry 3 lan + canh bao | Log loi + gui email |

### 6.3 Giai doan 2: Bao cao & Phan tich (Q4 2026)

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Bao cao tai chinh hop nhat | Ket hop du lieu tu ERP + Phan mem KT | TB |
| 2 | Doi chieu tu dong | Tu dong doi chieu so lieu giua 2 he thong | TB |
| 3 | Canh bao chenh lech | Thong bao khi phat hien chenh lech so lieu | TB |

---

## 7. TICH HOP HAI QUAN

### 7.1 Tong quan

| Thuoc tinh | Gia tri |
|---|---|
| **He thong** | VNACCS/VCIS (Vietnam Automated Cargo Clearance System / Vietnam Customs Information System) |
| **Giao thuc** | XML/EDIFACT qua cong dien tu Hai quan |
| **Bao mat** | Chu ky so (Digital Signature), Certificate VNACCS |
| **Timeline** | Q4 2026 |
| **Uu tien** | CAO |
| **Trang thai** | `[CHUA BAT DAU]` |

### 7.2 Boi canh

TBS Group chuyen ve dich vu nhap khau hang Trung Quoc voi 4 loai dich vu:
- **VCT** (Van chuyen thuan): Can khai bao van don quoc te
- **MHH** (Mua hang ho): Can khai bao full bo chung tu nhap khau
- **UTXNK** (Uy thac xuat nhap khau): Can khai bao thong quan cho khach hang
- **LCLCN** (LCL chinh ngach): Can khai bao hang LCL ghep container

### 7.3 Giai doan 1: Khai bao dien tu (Q4 2026)

**Muc tieu:** Tu dong tao va nop to khai hai quan dien tu tu du lieu trong ERP.

**Chuc nang chi tiet:**

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Tao to khai nhap khau | Tu dong dien thong tin to khai tu du lieu don hang | CAO |
| 2 | Ky dien tu | Ky to khai bang chu ky so USB Token / HSM | CAO |
| 3 | Nop to khai | Gui to khai den VNACCS qua cong dien tu | CAO |
| 4 | Nhan ket qua phan luong | Nhan ket qua phan luong (Xanh/Vang/Do) tu VNACCS | CAO |
| 5 | Thanh toan thue | Tao lenh nop thue nhap khau + VAT tu dong | CAO |
| 6 | Theo doi trang thai | Cap nhat trang thai thong quan vao ERP | TB |
| 7 | Luu tru chung tu | Luu bo chung tu nhap khau dien tu tap trung | TB |

**Luong khai bao hai quan dien tu:**

```
Don hang trong ERP
       │
       v
[Thu thap du lieu]
- Invoice thuong mai
- Packing List
- Bill of Lading
- Certificate of Origin
- Hop dong ngoai thuong
       │
       v
[Tao to khai tu dong]
- Dien thong tin hang hoa (ma HS, SL, gia tri)
- Tinh thue nhap khau + VAT tu dong
- Xac dinh luat ap dung (FTA, C/O uu dai)
       │
       v
[Ky chu ky so]
- USB Token (ca nhan)
- HSM (tu dong cho he thong)
       │
       v
[Gui den VNACCS/VCIS]
       │
       v
[Nhan ket qua phan luong]
       │
  ┌────┼────┐
  v    v    v
XANH  VANG  DO
  │    │    │
  v    v    v
Thong  Kiem  Kiem
quan   tra    tra
tu     chung  thuc
dong   tu     te
  │    │    │
  v    v    v
[Thong bao ket qua cho KH]
       │
       v
[Cap nhat trang thai don hang trong ERP]
```

**Thong tin truong du lieu to khai:**

| Nhom truong | Chi tiet | Nguon du lieu trong ERP |
|---|---|---|
| Thong tin chung | So to khai, ngay, cua khau | Auto-generate |
| Nguoi nhap khau | MST, ten, dia chi | Thong tin cong ty |
| Nguoi xuat khau | Ten, dia chi NCC TQ | Don hang - Nha cung cap |
| Hang hoa | Ma HS, mo ta, SL, don gia | Don hang - San pham |
| Tri gia tinh thue | FOB/CIF, phi van chuyen, bao hiem | Don hang - Chi phi |
| Thue | Thue nhap khau, VAT, thue TTDB | Tu dong tinh theo bieu thue |
| Van tai | So B/L, ten tau, cang di/den | Don hang - Van don |
| Chung tu | Invoice, P/L, C/O | Module tai lieu |

### 7.4 Giai doan 2: Tich hop nang cao (Q1 2027 - Du kien)

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Phan loai HS tu dong | AI goi y ma HS dua tren mo ta san pham | TB |
| 2 | Tra cuu bieu thue | Tu dong tra cuu thue suat theo ma HS + nuoc xuat xu | TB |
| 3 | Quan ly C/O dien tu | Xin cap C/O dien tu tu VCCI | THAP |
| 4 | Lien thong mot cua | Ket noi Cong thong tin mot cua quoc gia (VNSW) | THAP |

---

## 8. TICH HOP LARKSUITE / ZALO

### 8.1 Tich hop LarkSuite

#### 8.1.1 Tong quan

| Thuoc tinh | Gia tri |
|---|---|
| **Nen tang** | LarkSuite (Feishu quoc te) |
| **Giao thuc** | REST API, Webhook, Bot API |
| **Bao mat** | OAuth2, App ID + App Secret |
| **Timeline** | Q2-Q3 2026 |
| **Uu tien** | CAO |
| **Trang thai** | `[CHUA BAT DAU]` |

#### 8.1.2 Chuc nang tich hop

**A. Dong bo nhan su (Q2 2026)**

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Dong bo danh sach NV | Lay thong tin nhan vien tu LarkSuite ve ERP | CAO |
| 2 | Dong bo phong ban | Map co cau to chuc LarkSuite voi ERP | CAO |
| 3 | Tu dong tao tai khoan | Khi co nhan vien moi tren Lark -> tao user ERP | TB |
| 4 | Vo hieu hoa tu dong | Khi NV nghi viec tren Lark -> disable tai khoan ERP | TB |

**B. Luong phe duyet (Approval Workflow) (Q2-Q3 2026)**

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Gui yeu cau phe duyet | Tu ERP gui phieu trinh duyet qua Lark Approval | CAO |
| 2 | Thong bao phe duyet | NV nhan thong bao va duyet ngay tren Lark | CAO |
| 3 | Dong bo ket qua | Ket qua duyet/tu choi tu Lark cap nhat ve ERP | CAO |
| 4 | Nhac nho phe duyet | Tu dong nhac nho khi phieu chua duyet qua 24h | TB |
| 5 | Bao cao phe duyet | Thong ke thoi gian phe duyet trung binh | THAP |

**Cac luong phe duyet tich hop:**

| Loai phieu | Nguoi tao | Nguoi duyet | SLA |
|---|---|---|---|
| Bao gia cho khach | Nhan vien kinh doanh | Truong phong KD -> GD | 4h |
| Don mua hang NCC | Nhan vien mua hang | Truong phong MH -> KT truong -> GD | 8h |
| Phieu chi > 10 trieu | Ke toan | KT truong -> GD | 4h |
| Phieu chi > 50 trieu | Ke toan | KT truong -> PGD -> GD | 8h |
| Don hang moi | Nhan vien KD | Truong phong KD | 2h |
| Yeu cau xuat kho | Thu kho | Truong phong kho -> KT | 2h |
| Nghi phep | Nhan vien | Truong phong -> HR | 24h |

**C. Thong bao & Bot (Q2 2026)**

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Bot thong bao nhom | Gui thong bao tu dong vao group chat Lark | CAO |
| 2 | Canh bao he thong | Gui canh bao khi co van de (don hang tre, ton kho thap) | CAO |
| 3 | Bao cao hang ngay | Tu dong gui bao cao tong ket ngay vao nhom quan ly | TB |
| 4 | Interactive message | Nut bam duyet/tu choi truc tiep trong tin nhan Lark | TB |

### 8.2 Tich hop Zalo

#### 8.2.1 Tong quan

| Thuoc tinh | Gia tri |
|---|---|
| **Nen tang** | Zalo Official Account (ZOA) + Zalo Notification Service (ZNS) |
| **Giao thuc** | REST API |
| **Bao mat** | OAuth2 (ZOA), OA Secret Key (ZNS) |
| **Timeline** | Q2-Q3 2026 |
| **Uu tien** | CAO |
| **Trang thai** | `[CHUA BAT DAU]` |

#### 8.2.2 Chuc nang tich hop

**A. Zalo ZNS - Thong bao khach hang (Q2 2026)**

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Thong bao don hang moi | Gui ZNS khi tao don hang thanh cong | CAO |
| 2 | Cap nhat trang thai | Gui ZNS khi don hang chuyen trang thai (dang van chuyen, da den kho, ...) | CAO |
| 3 | Thong bao container | Gui ZNS khi container den cang, da thong quan | CAO |
| 4 | Nhac thanh toan | Gui ZNS nhac khach hang thanh toan cong no den han | TB |
| 5 | Thong bao hoa don | Gui link hoa don dien tu qua ZNS | TB |
| 6 | Khao sat hai long | Gui khao sat sau khi don hang hoan thanh | THAP |

**Mau ZNS Template:**

| Ma Template | Ten | Noi dung | Su kien trigger |
|---|---|---|---|
| ZNS-001 | Xac nhan don hang | "Don hang {ma_don} da duoc tiep nhan. Du kien: {ngay_du_kien}" | Don hang moi tao |
| ZNS-002 | Dang van chuyen | "Don {ma_don} dang tren duong van chuyen. Container: {container}" | Trang thai -> Dang van chuyen |
| ZNS-003 | Den cang | "Container {container} da den cang {ten_cang}. Du kien thong quan: {ngay}" | Tracking -> Den cang |
| ZNS-004 | Da thong quan | "Don {ma_don} da thong quan thanh cong. Hang dang ve kho." | Trang thai -> Da thong quan |
| ZNS-005 | San sang giao | "Don {ma_don} da san sang giao hang. Lien he: {sdt}" | Trang thai -> San sang giao |
| ZNS-006 | Nhac no | "Cong no {so_tien} cho don {ma_don} da den han. Vui long thanh toan." | Cron job hang ngay |

**B. Zalo Chatbot (Q3 2026)**

| STT | Chuc nang | Mo ta | Do uu tien |
|---|---|---|---|
| 1 | Tra cuu don hang | KH gui ma don -> Bot tra ve trang thai | CAO |
| 2 | Tra cuu tracking | KH gui ma container -> Bot tra ve vi tri | TB |
| 3 | Yeu cau ho tro | KH gui yeu cau -> Chuyen den CSKH | TB |
| 4 | Tra cuu cong no | KH xac thuc -> Xem cong no hien tai | THAP |

---

## 9. KIEN TRUC KY THUAT TICH HOP

### 9.1 Tong quan kien truc

```
                        ┌─────────────────────┐
                        │   API Gateway        │
                        │   (Kong / Nginx)     │
                        │   - Rate limiting    │
                        │   - Auth             │
                        │   - Logging          │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    v              v              v
            ┌──────────┐  ┌──────────┐  ┌──────────┐
            │ Webhook  │  │Integration│  │ Outbound │
            │ Receiver │  │   API     │  │ API Call │
            │ (Inbound)│  │ (Internal)│  │ (Client) │
            └────┬─────┘  └────┬─────┘  └────┬─────┘
                 │              │              │
                 └──────────────┼──────────────┘
                                │
                        ┌───────v────────┐
                        │  Message Queue │
                        │  (BullMQ +     │
                        │   Redis)       │
                        └───────┬────────┘
                                │
              ┌─────────────────┼─────────────────┐
              v                 v                 v
     ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
     │  Bank Service │ │ Ecom Service  │ │Shipping Svc   │
     │  - VCB        │ │ - Shopee      │ │ - Maersk      │
     │  - BIDV       │ │ - Lazada      │ │ - COSCO       │
     │  - TCB        │ │ - TikTok Shop │ │ - Yang Ming   │
     └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
              │                 │                 │
     ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
     │Accounting Svc │ │ Customs Svc   │ │ Comms Service │
     │ - MISA        │ │ - VNACCS/VCIS │ │ - LarkSuite   │
     │ - Fast        │ │               │ │ - Zalo ZNS    │
     └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
              │                 │                 │
              └─────────────────┼─────────────────┘
                                │
                        ┌───────v────────┐
                        │  TBS ERP Core  │
                        │  (NestJS +     │
                        │   Prisma +     │
                        │   PostgreSQL)  │
                        └────────────────┘
```

### 9.2 Cac thanh phan ky thuat

| Thanh phan | Cong nghe | Muc dich |
|---|---|---|
| API Gateway | Kong / Nginx | Dinh tuyen, xac thuc, rate limit, logging |
| Message Queue | BullMQ + Redis | Xu ly bat dong bo, retry, dead letter queue |
| Webhook Receiver | NestJS Controller | Nhan webhook tu doi tac (da co module WebhookEndpoint) |
| Integration Services | NestJS Modules | Xu ly logic tich hop cho tung doi tac |
| Data Transformer | Custom Mappers | Chuyen doi du lieu giua cac dinh dang (JSON, XML, EDI) |
| Monitoring | Sentry + Grafana | Giam sat loi, performance, uptime |
| Audit Log | PostgreSQL | Ghi lai moi giao dich tich hop de doi soat |

### 9.3 Nguyen tac thiet ke

1. **Idempotency**: Moi API call phai idempotent - goi lai khong gay duplicate
2. **Retry with backoff**: Tu dong retry khi that bai (1s, 5s, 30s, 5m)
3. **Circuit breaker**: Ngat ket noi khi doi tac loi lien tuc (> 5 lan lien tiep)
4. **Data validation**: Validate du lieu truoc khi gui va sau khi nhan
5. **Audit trail**: Ghi log tat ca giao dich tich hop
6. **Graceful degradation**: He thong van hoat dong khi 1 tich hop gap su co
7. **Versioning**: Ho tro nhieu phien ban API cua doi tac

### 9.4 Bao mat tich hop

| Yeu cau | Giai phap | Ap dung cho |
|---|---|---|
| Xac thuc API | OAuth2 / API Key + HMAC-SHA256 | Tat ca |
| Ma hoa truyen tai | TLS 1.2+ / mTLS | Tat ca |
| IP Whitelisting | Firewall rules | Ngan hang, Hai quan |
| Chu ky so | USB Token / HSM | Hai quan (VNACCS) |
| Luu tru bao mat | Encrypted at rest (AES-256) | Du lieu tai chinh |
| Rate limiting | Per-partner, per-endpoint | Tat ca |
| Audit logging | Immutable audit log | Tat ca |

---

## 10. QUAN LY RUI RO

### 10.1 Rui ro va bien phap giam thieu

| # | Rui ro | Xac suat | Tac dong | Bien phap giam thieu |
|---|---|---|---|---|
| 1 | API ngan hang thay doi version | Trung binh | Cao | Dung adapter pattern, theo doi changelog cua ngan hang |
| 2 | San TMDT thay doi chinh sach API | Cao | Trung binh | Tham gia partner program, co ban backup thu cong |
| 3 | VNACCS ngung hoat dong bao tri | Thap | Cao | Co quy trinh khai bao thu cong backup |
| 4 | Du lieu dong bo bi trung | Trung binh | Trung binh | Idempotency key cho moi giao dich |
| 5 | Mat ket noi mang | Thap | Trung binh | Queue offline, tu dong gui lai khi co mang |
| 6 | Ro ri du lieu tai chinh | Thap | Rat cao | Ma hoa end-to-end, audit log, penetration test |
| 7 | Rate limit bi vuot | Trung binh | Thap | Adaptive rate limiting, request queuing |
| 8 | Doi tac ngung hop tac | Thap | Cao | Khong phu thuoc 1 doi tac, co backup cho moi loai |

### 10.2 Ke hoach du phong (Contingency)

| Tinh huong | Hanh dong |
|---|---|
| API ngan hang ngung | Chuyen sang doc sao ke SFTP/Email, nhap thu cong |
| San TMDT loi | Nhan vien xu ly don hang truc tiep tren san |
| Tracking hang tau loi | Tra cuu thu cong tren website hang tau |
| VNACCS ngung | Khai bao qua dai ly hai quan |
| LarkSuite loi | Email fallback cho thong bao va phe duyet |
| Zalo ZNS loi | SMS fallback cho thong bao KH |

---

## 11. NGAN SACH DU KIEN

### 11.1 Chi phi theo module

| Module | Nhan luc (man-month) | Chi phi API/License | Chi phi khac | Tong |
|---|---|---|---|---|
| Ngan hang | 6 MM | 15 trieu/nam (API fee) | 10 trieu (USB Token) | 100 trieu |
| San TMDT | 4 MM | Mien phi (Partner) | 5 trieu (Test account) | 65 trieu |
| Hang tau | 5 MM | 20 trieu/nam (API fee) | 0 | 95 trieu |
| Ke toan | 3 MM | 10 trieu/nam (MISA API) | 5 trieu (License) | 55 trieu |
| Hai quan | 6 MM | 30 trieu/nam (VNACCS) | 20 trieu (HSM, Cert) | 110 trieu |
| LarkSuite/Zalo | 4 MM | 8 trieu/nam (ZNS) | 5 trieu (OA verified) | 65 trieu |
| **TONG CONG** | **28 MM** | **83 trieu/nam** | **45 trieu** | **490 trieu** |

*Ghi chu: 1 man-month (MM) uoc tinh 15 trieu VND (luong + overhead)*

### 11.2 ROI du kien

| Module | Loi ich | Tiet kiem/nam | Thoi gian hoan von |
|---|---|---|---|
| Ngan hang | Giam 70% thoi gian doi soat | 120 trieu | 10 thang |
| San TMDT | Mo rong 3+ kenh, tang 30% don | 200 trieu | 4 thang |
| Hang tau | Giam 90% thoi gian tracking | 80 trieu | 14 thang |
| Ke toan | Giam 80% nhap lieu thu cong | 100 trieu | 7 thang |
| Hai quan | Giam 50% thoi gian thong quan | 150 trieu | 9 thang |
| LarkSuite/Zalo | Tang 50% hai long KH, giam 60% thoi gian duyet | 90 trieu | 9 thang |
| **TONG CONG** | | **740 trieu/nam** | **8 thang TB** |

---

## 12. PHU LUC

### 12.1 Danh sach lien he doi tac

| Doi tac | Bo phan | Lien he | Ghi chu |
|---|---|---|---|
| Vietcombank | Phong CNTT | Quan he khach hang doanh nghiep | Yeu cau hop dong API rieng |
| BIDV | SmartBanking API Team | developer.bidv.com.vn | Dang ky sandbox |
| Techcombank | Open Banking Team | openapi.techcombank.com.vn | Dang ky developer account |
| Shopee | Seller Open Platform | open.shopee.com | Can la Shopee Mall seller |
| Lazada | Open Platform | open.lazada.com | Can la Lazada seller |
| TikTok Shop | Partner Center | partner.tiktokshop.com | Dang ky partner account |
| Maersk | API Team | developer.maersk.com | Dang ky Consumer Key |
| COSCO | Syncon Hub | synconhub.com | Lien he van phong VN |
| Yang Ming | IT Department | yangming.com | Lien he dai ly VN |
| MISA | API Partner | amis.misa.vn/api | Mua goi API Enterprise |
| Fast Accounting | Ho tro ky thuat | fast.com.vn | Lien he truc tiep |
| VNACCS | Tong cuc Hai quan | customs.gov.vn | Dang ky chu ky so |
| LarkSuite | Developer Portal | open.larksuite.com | Tao enterprise app |
| Zalo | ZNS Team | zalo.cloud | Dang ky OA Business |

### 12.2 Tieu chi nghiem thu (Acceptance Criteria)

Moi module tich hop can dat cac tieu chi sau truoc khi go live:

| # | Tieu chi | Mo ta |
|---|---|---|
| 1 | Ket noi thanh cong | API call thanh cong >= 99% trong moi truong staging |
| 2 | Du lieu chinh xac | Du lieu dong bo chinh xac 100% (so sanh thu cong 50 ban ghi) |
| 3 | Xu ly loi | Retry, fallback hoat dong dung khi doi tac gap su co |
| 4 | Hieu nang | Response time < 3s cho moi API call |
| 5 | Bao mat | Pass penetration test, khong ro ri du lieu |
| 6 | Monitoring | Alert hoat dong khi co loi, dashboard hien thi metric |
| 7 | Tai lieu | Co tai lieu ky thuat, huong dan van hanh |
| 8 | Dao tao | Nhan vien duoc dao tao su dung tinh nang moi |

### 12.3 Timeline chi tiet theo tuan

**Q2 2026 (Thang 4 - Thang 6)**

| Tuan | Ngan hang | Hang tau | LarkSuite | Zalo ZNS |
|---|---|---|---|---|
| T4-W1 | Phan tich API VCB | Phan tich Maersk API | Thiet ke dong bo NS | Dang ky ZOA |
| T4-W2 | Phan tich API BIDV, TCB | Phan tich COSCO, YM API | Phat trien dong bo NS | Thiet ke ZNS template |
| T4-W3 | Phat trien adapter VCB | Phat trien Maersk adapter | Test dong bo NS | Dang ky ZNS template |
| T4-W4 | Phat trien adapter BIDV | Phat trien COSCO adapter | Deploy dong bo NS | Phat trien ZNS module |
| T5-W1 | Phat trien adapter TCB | Phat trien YM adapter | Phat trien approval flow | Test ZNS gui thu |
| T5-W2 | Phat trien matching engine | Test tracking tu dong | Phat trien approval flow | Tich hop voi don hang |
| T5-W3 | Test doi soat VCB | Test tracking da hang | Test approval flow | Test end-to-end |
| T5-W4 | Test doi soat BIDV, TCB | Fix bug, toi uu | Fix bug approval | Fix bug, toi uu |
| T6-W1 | UAT voi ke toan | UAT voi van hanh | UAT voi nhan su | UAT voi CSKH |
| T6-W2 | Fix bug UAT | Fix bug UAT | Fix bug UAT | Fix bug UAT |
| T6-W3 | Go live noi bo | Go live noi bo | Go live noi bo | Go live noi bo |
| T6-W4 | Monitor & support | Monitor & support | Monitor & support | Monitor & support |

**Q3 2026 (Thang 7 - Thang 9)**

| Tuan | San TMDT | Ke toan | Ngan hang GD2 | Hang tau GD2 |
|---|---|---|---|---|
| T7-W1 | Dang ky Shopee API | Phan tich MISA API | Thiet ke payment flow | Thiet ke booking flow |
| T7-W2 | Dang ky Lazada, TikTok | Phan tich Fast format | Phat trien payment VCB | Phat trien quote request |
| T7-W3 | Phat trien Shopee sync | Phat trien MISA adapter | Phat trien payment BIDV | Phat trien booking API |
| T7-W4 | Phat trien Lazada sync | Phat trien Fast adapter | Phat trien payment TCB | Phat trien comparison |
| T8-W1 | Phat trien TikTok sync | Phat trien dong bo TK | Test payment flow | Test booking flow |
| T8-W2 | Phat trien inventory sync | Test dong bo phieu thu/chi | Test webhook nhan KQ | Test xac nhan booking |
| T8-W3 | Test Shopee end-to-end | Test dong bo hoa don | UAT payment | UAT booking |
| T8-W4 | Test Lazada, TikTok | UAT voi ke toan | Fix bug UAT | Fix bug UAT |
| T9-W1 | UAT voi kinh doanh | Fix bug UAT | Go live payment | Go live booking |
| T9-W2 | Fix bug UAT | Go live MISA | Monitor & support | Monitor & support |
| T9-W3 | Go live Shopee | Go live Fast | Toi uu hieu nang | Toi uu hieu nang |
| T9-W4 | Go live Lazada, TikTok | Monitor & support | Bao cao GD2 | Bao cao GD2 |

**Q4 2026 (Thang 10 - Thang 12)**

| Tuan | Hai quan VNACCS | San TMDT GD3 | Ngan hang GD3 |
|---|---|---|---|
| T10-W1 | Phan tich VNACCS format | Phat trien analytics dashboard | Phan tich FX trading API |
| T10-W2 | Dang ky chu ky so | Phat trien profit analysis | Phat trien so sanh ty gia |
| T10-W3 | Phat trien to khai module | Phat trien channel comparison | Phat trien mua ngoai te |
| T10-W4 | Phat trien ky dien tu | Test analytics | Test FX module |
| T11-W1 | Phat trien nop to khai | UAT analytics | UAT FX module |
| T11-W2 | Phat trien nhan phan luong | Go live analytics | Fix bug UAT |
| T11-W3 | Test to khai mau | Monitor & support | Go live FX |
| T11-W4 | Test voi Hai quan (sandbox) | Toi uu, bao cao Q4 | Monitor & support |
| T12-W1 | UAT voi XNK | --- | --- |
| T12-W2 | Fix bug UAT | --- | --- |
| T12-W3 | Go live VNACCS | --- | --- |
| T12-W4 | Monitor, tong ket nam | Tong ket nam | Tong ket nam |

---

> **Tai lieu nay duoc cap nhat dinh ky. Phien ban moi nhat luon co tai:** `docs/integration-roadmap.md`
>
> **Lich hop review tien do:** Thu 2 hang tuan, 9:00 AM, phong hop TBS-01
>
> **Lien he:** Ban Giam doc Cong nghe - TBS Group Co., Ltd.
