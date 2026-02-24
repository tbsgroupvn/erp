# QUY TRINH VAN HANH CHUAN (SOP)
# TAI CHINH - DONG TIEN DOANH NGHIEP
## TBS LOGISTICS - HE THONG ERP

**Ma tai lieu:** SOP-FIN-001
**Phien ban:** 1.0
**Ngay ban hanh:** 2026-02-18
**Nguoi soan:** Ban Tai chinh - Ke toan
**Phe duyet:** Tong Giam doc (CEO)

---

## MUC LUC

1. [Pham vi ap dung](#1-pham-vi-ap-dung)
2. [Dinh nghia va viet tat](#2-dinh-nghia-va-viet-tat)
3. [Quy trinh thu tien khach hang (Revenue Collection)](#3-quy-trinh-thu-tien-khach-hang)
4. [Quy trinh chi tien nha cung cap (Supplier Payment)](#4-quy-trinh-chi-tien-nha-cung-cap)
5. [Quy trinh quan ly cong no phai thu (AR)](#5-quy-trinh-quan-ly-cong-no-phai-thu)
6. [Quy trinh quan ly cong no phai tra (AP)](#6-quy-trinh-quan-ly-cong-no-phai-tra)
7. [Quy trinh bu tru cong no (Debt Netting)](#7-quy-trinh-bu-tru-cong-no)
8. [Quy trinh thu ho COD](#8-quy-trinh-thu-ho-cod)
9. [Quy trinh phan bo chi phi van hanh](#9-quy-trinh-phan-bo-chi-phi-van-hanh)
10. [Quy trinh tinh hoa hong kinh doanh](#10-quy-trinh-tinh-hoa-hong-kinh-doanh)
11. [Quy trinh xuat hoa don](#11-quy-trinh-xuat-hoa-don)
12. [Quy trinh hach toan so cai (GL)](#12-quy-trinh-hach-toan-so-cai)
13. [Quy trinh phe duyet tai chinh](#13-quy-trinh-phe-duyet-tai-chinh)
14. [Kiem soat chong gian lan](#14-kiem-soat-chong-gian-lan)
15. [Quan ly ty gia](#15-quan-ly-ty-gia)
16. [Bao cao tai chinh dinh ky](#16-bao-cao-tai-chinh-dinh-ky)
17. [Phu luc - Tham so he thong](#17-phu-luc---tham-so-he-thong)

---

## 1. Pham vi ap dung

### 1.1 Doi tuong ap dung
- Ban Giam doc (CEO, COO)
- Phong Tai chinh - Ke toan (Ke toan truong, Ke toan thanh toan, Ke toan chi phi)
- Phong Kinh doanh (Giam doc KD, Truong nhom, Nhan vien kinh doanh)
- Phong Xuat nhap khau (Truong phong, Nhan vien)
- Phong Kho van (Truong kho, Nhan vien kho)
- Tai xe giao hang

### 1.2 Pham vi nghiep vu
Toan bo hoat dong tai chinh dong tien cua cong ty bao gom:
- Thu tien tu khach hang (coc, thanh toan, tat toan)
- Chi tien cho nha cung cap (mua hang, cuoc van chuyen, phi dich vu)
- Thu ho COD (thu tien mat khi giao hang)
- Phan bo chi phi van hanh
- Tinh hoa hong kinh doanh
- Xuat hoa don GTGT
- Hach toan so cai

---

## 2. Dinh nghia va viet tat

| Viet tat | Dinh nghia |
|----------|------------|
| AR | Accounts Receivable - Cong no phai thu |
| AP | Accounts Payable - Cong no phai tra |
| COD | Cash On Delivery - Thu tien mat khi giao hang |
| GL | General Ledger - So cai tong hop |
| VCT | Van Chuyen Thuan - Dich vu van chuyen thuan tuy |
| MHH | Mua Hang Ho - Dich vu mua hang ho |
| UTXNK | Uy Thac Xuat Nhap Khau |
| LCLCN | Less than Container Load Chinh Ngach - Hang le chinh ngach |
| KTTT | Ke toan Thanh toan |
| KTCP | Ke toan Chi phi |
| KTT | Ke toan Truong |
| GDKD | Giam doc Kinh doanh |
| BGD | Ban Giam doc |
| NCC | Nha cung cap |
| KH | Khach hang |

---

## 3. Quy trinh thu tien khach hang

### 3.1 Tong quan dong tien thu

```
Bao gia → Hop dong → Dat coc → Thuc hien don → Hoa don → Tat toan
```

### 3.2 Thu tien coc

**Buoc 1: Xac dinh ty le coc**

| Hang khach hang | Ty le coc | Ghi chu |
|-----------------|-----------|---------|
| Khach moi (NEW) | 100% | Mac dinh |
| Khach thuong (REGULAR) | 70% | Tu 10 don tro len |
| VIP | 50% | Tu 20 don tro len |
| Chien luoc (STRATEGIC) | 30% | Thoa thuan rieng |

- Cong thuc: `Tien coc = Tong gia tri don hang x Ty le coc`
- Mien/giam coc phai qua phe duyet loai `DEPOSIT_EXEMPTION`

**Buoc 2: Tao phieu thu tien coc**
1. Ke toan thanh toan (KTTT) vao module **Phieu thu chi** > **Tao phieu thu**
2. Chon loai: `RECEIPT` (Phieu thu)
3. Nhap: Ma don hang, so tien, phuong thuc thanh toan
4. Dinh kem: Uy nhiem chi / Bien lai chuyen khoan
5. Ghi ly do (toi thieu 20 ky tu)
6. Gui phe duyet

**Buoc 3: Phe duyet phieu thu**
1. Ke toan truong (KTT) duyet phieu thu
2. He thong tu dong:
   - Tao giao dich tien mat (CashTransaction type=IN)
   - Cap nhat tien coc da nhan (Order.depositPaid)
   - Tao ban ghi phan bo thanh toan (PaymentAllocation purpose=DEPOSIT)
   - Gui thong bao cho Sale phu trach

**Buoc 4: Theo doi coc**
- Don hang chua nhan coc sau **3 ngay** → Tu dong huy (configurable)
- He thong canh bao truoc khi huy

### 3.3 Thu thanh toan/tat toan

**Buoc 1: Xuat hoa don** (xem Muc 11)

**Buoc 2: Tao phieu thu tat toan**
1. KTTT vao module **Phieu thu chi** > **Tao phieu thu**
2. Chon loai: `RECEIPT`, muc dich: `SETTLEMENT` (Tat toan)
3. Nhap so tien con lai = Tong gia tri - Tien coc da nhan
4. Dinh kem chung tu lien quan
5. He thong tu dong:
   - Cap nhat cong no phai thu (AR): paidAmount += so tien
   - Chuyen trang thai AR: PARTIAL hoac PAID
   - Tao ban ghi phan bo thanh toan (PaymentAllocation purpose=SETTLEMENT)
   - Hach toan so cai (GL)

### 3.4 Vi dien tu khach hang (Customer Wallet)

1. Khach hang nap tien vao vi qua Cong khach hang
2. Gioi han: Toi thieu 100,000 VND - Toi da 100,000,000 VND
3. Tien trong vi duoc su dung de thanh toan coc hoac tat toan
4. Phan bo thanh toan loai `WALLET_TOPUP`

---

## 4. Quy trinh chi tien nha cung cap

### 4.1 Tong quan dong tien chi

```
Mua hang/Dich vu → Ghi nhan chi phi → Tao phieu chi → Phe duyet → Thanh toan → Cap nhat AP
```

### 4.2 Tao phieu chi

**Buoc 1: Ke toan chi phi (KTCP) tao phieu chi**
1. Vao module **Phieu thu chi** > **Tao phieu chi**
2. Chon loai: `PAYMENT` (Phieu chi)
3. Nhap bat buoc:
   - Ma don hang hoac hop dong lien quan
   - So tien, loai tien te (VND/CNY/USD)
   - Phuong thuc thanh toan (chuyen khoan/tien mat/sec)
   - Loai chi phi (cuoc van chuyen, phi kho, bao hiem, hai quan...)
   - Nguoi thu huong (ten, so tai khoan)
   - Ly do chi (toi thieu 20 ky tu)
   - Chung tu dinh kem (BAT BUOC)

**Buoc 2: He thong tu dong kiem tra chong gian lan** (xem Muc 14)

**Buoc 3: Gui phe duyet**
- Phieu chi tu dong chuyen sang trang thai `PENDING`
- Gui thong bao den nguoi phe duyet theo quy trinh

### 4.3 Phe duyet phieu chi

**Nguyen tac phe duyet theo han muc:**

| Han muc (VND) | Nguoi phe duyet |
|----------------|-----------------|
| ≤ 10,000,000 | Ke toan truong |
| 10M - 50,000,000 | Giam doc Tai chinh |
| 50M - 500,000,000 | Tong Giam doc |
| > 500,000,000 | KHONG CHO PHEP (tach phieu) |

**Sau khi phe duyet:**
1. He thong tao giao dich tien mat (CashTransaction type=OUT)
2. Cap nhat cong no phai tra (AP): paidAmount += so tien
3. Chuyen trang thai AP: PARTIAL hoac PAID
4. Hach toan so cai tu dong

### 4.4 Tu choi phieu chi

1. Nguoi phe duyet chon "Tu choi" va ghi ly do
2. He thong gui thong bao ve cho nguoi tao
3. Nguoi tao sua lai va gui phe duyet moi (KHONG sua phieu cu)

---

## 5. Quy trinh quan ly cong no phai thu (AR)

### 5.1 Tao ban ghi AR

- Tu dong tao khi:
  - Hoa don xuat cho khach hang (Invoice status = ISSUED)
  - Don hang xac nhan (tong gia tri - tien coc)
- Ma AR: `TBS-AR-XXXXXX` (tu dong tang)
- Thong tin: KH, don hang, so tien, ngay den han (mac dinh +30 ngay)

### 5.2 Ghi nhan thanh toan

1. Khi nhan phieu thu duoc duyet → Tu dong cap nhat AR
2. Cong thuc: `So tien con no = Tong no - Da thu - Da bu tru`
3. Trang thai tu dong chuyen:
   - `OPEN` → `PARTIAL` (thanh toan 1 phan)
   - `PARTIAL` → `PAID` (thanh toan du)
   - `OPEN`/`PARTIAL` → `NETTED` (bu tru cong no)

### 5.3 Phan tich tuoi no (AR Aging)

**He thong tu dong chay luc 01:00 hang ngay:**

| Nhom tuoi no | Phan loai |
|--------------|-----------|
| Chua den han | Current |
| 1-30 ngay qua han | Bucket 1 |
| 31-60 ngay qua han | Bucket 2 |
| 61-90 ngay qua han | Bucket 3 |
| > 90 ngay qua han | Bucket 4 |

**Muc do rui ro tu dong tinh:**

| Muc do | Dieu kien |
|--------|-----------|
| THAP (LOW) | Tong qua han ≤ 1M, khong co no 90+ ngay |
| TRUNG BINH (MEDIUM) | Qua han 1-5M hoac co no 30+ ngay |
| CAO (HIGH) | Qua han 5-20M hoac co no 60+ ngay |
| NGHIEM TRONG (CRITICAL) | Qua han 20M+ hoac co no 90+ ngay |

### 5.4 Canh bao cong no (Tu dong luc 08:00 hang ngay)

| Moc thoi gian | Doi tuong nhan canh bao |
|---------------|-------------------------|
| Truoc 3 ngay den han (T-3) | Sale phu trach + Truong nhom |
| Ngay den han (T+0) | Sale + Truong nhom + Ke toan |
| Qua han 15 ngay (T+15) | + Giam doc Kinh doanh |
| Qua han 30 ngay (T+30) | + COO/CEO |

### 5.5 Chan don hang tu dong

- Khach hang muc do rui ro `CRITICAL` → Tu dong chan tao don hang moi
- Ly do chan: "Cong no qua han 90+ ngay, so tien: XX trieu VND"
- Mo chan: Ke toan truong xac nhan sau khi khach hang thanh toan

---

## 6. Quy trinh quan ly cong no phai tra (AP)

### 6.1 Tao ban ghi AP

- Tu dong tao khi:
  - Don mua hang (Purchase Order) duoc duyet
  - Chi phi van hanh ghi nhan (Operation Cost)
  - Hoa don NCC nhan duoc
- Ma AP: `TBS-AP-XXXXXX`
- Thong tin: NCC, so tien, ngay den han

### 6.2 Ghi nhan thanh toan

1. Phieu chi duoc duyet → Cap nhat AP
2. Cong thuc: `So tien con phai tra = Tong no - Da tra - Da bu tru`
3. Trang thai: OPEN → PARTIAL → PAID

### 6.3 Theo doi va bao cao

- Tong hop AP theo NCC
- Bao cao AP sap den han
- Canh bao AP qua han

---

## 7. Quy trinh bu tru cong no (Debt Netting)

### 7.1 Khi nao ap dung

Ap dung khi mot doi tac vua la khach hang (TBS thu) vua la nha cung cap (TBS tra):
- KH no TBS: 100 trieu (AR)
- TBS no KH: 60 trieu (AP)
- Bu tru: 60 trieu → KH chi can tra 40 trieu

### 7.2 Quy trinh

**Buoc 1: Tim co hoi bu tru**
- He thong tu dong quet cac truong hop AR va AP cung doi tac
- Hien thi: So du AR, So du AP, So tien co the bu tru

**Buoc 2: Tao yeu cau bu tru**
1. KTTT chon cac ban ghi AR va AP can bu tru
2. Nhap so tien bu tru (≤ min(tong AR, tong AP))
3. Gui phe duyet → Trang thai: `PENDING`

**Buoc 3: Phe duyet**
- Ke toan truong phe duyet → Trang thai: `APPROVED`

**Buoc 4: Thuc hien bu tru**
1. KTT xac nhan thuc hien
2. He thong xu ly (dung so hoc so nguyen de tranh sai so):
   - Cap nhat AR: nettedAmount += phan tuong ung
   - Cap nhat AP: nettedAmount += phan tuong ung
   - Tao but toan so cai: No TK AP / Co TK AR
3. Trang thai: `EXECUTED`

### 7.3 Luu y quan trong
- Tinh toan su dung so hoc so nguyen (x100, lam tron, /100) de tranh sai so
- Phan du luon duoc gan cho ban ghi cuoi cung
- Khong the hoan tac sau khi thuc hien

---

## 8. Quy trinh thu ho COD

### 8.1 Dong tien COD

```
Giao hang → Tai xe thu tien → Nop tien cuoi ngay → Doi soat → Xu ly thieu hut
```

### 8.2 Thu tien tai dia chi giao

**Buoc 1:** Tai xe giao hang va thu tien mat
**Buoc 2:** Ghi nhan tren he thong:
- So tien thu
- Phuong thuc (tien mat/chuyen khoan)
- Anh chup bien nhan
**Buoc 3:** Trang thai → `COLLECTED`

### 8.3 Nop tien cuoi ngay

**Buoc 1:** Tai xe mang tien ve kho/van phong
**Buoc 2:** Thu kho xac nhan:
- Kiem tra tong tien thu theo he thong
- Doi chieu voi tien nop thuc te
- Xac nhan → Trang thai: `REMITTED`

### 8.4 Xu ly thieu hut

- Sai lech > 1% → Ghi nhan trang thai `SHORTAGE`
- He thong tu dong:
  - Tinh so tien thieu: `thieu_hut = tong_thu - tong_nop`
  - Gui canh bao den Truong kho va Ke toan
- Quy trinh xu ly:
  - Tai xe giai trinh
  - Ke toan ghi nhan chenh lech
  - Tru luong hoac lap bien ban (theo quy che cong ty)

### 8.5 Doi soat COD dinh ky

- Bao cao doi soat: `tong_thu`, `tong_nop`, `tong_thieu`, `sai_lech`
- Phan loai theo trang thai: PENDING, COLLECTED, REMITTED, RECONCILED, SHORTAGE
- Thuc hien hang tuan boi Ke toan truong

---

## 9. Quy trinh phan bo chi phi van hanh

### 9.1 Cac loai chi phi

| Loai chi phi | Mo ta | Vi du |
|--------------|-------|-------|
| Cuoc van chuyen | Phi van tai quoc te | Container, duong bo, duong khong |
| Phi kho | Chi phi luu kho | Kho TQ, Kho VN |
| Bao hiem | Bao hiem hang hoa | Bao hiem door-to-door |
| Hai quan | Chi phi thong quan | Thue, phi hai quan |
| Phi khac | Chi phi phat sinh | Dong goi, xu ly dac biet |

### 9.2 Phuong thuc phan bo

**Phan bo theo trong luong (MAC DINH - pho bien nhat):**
```
Ty le = Trong luong don hang / Tong trong luong container
Chi phi phan bo = Tong chi phi x Ty le
Phan du → Don hang cuoi cung (tranh sai so lam tron)
```

**Phan bo theo the tich:**
```
The tich = Dai x Rong x Cao (m3)
Ty le = The tich don hang / Tong the tich container
```

**Phan bo deu:**
```
Chi phi phan bo = Tong chi phi / So don hang
Phan du → Don hang cuoi cung
```

### 9.3 Quy trinh thuc hien

**Buoc 1:** Ghi nhan chi phi van hanh theo container
- KTCP nhap: loai chi phi, so tien, tien te, hoa don NCC
- Nhap uoc tinh truoc (de tinh chenh lech sau)

**Buoc 2:** Thuc hien phan bo
- Chon container va phuong thuc phan bo
- He thong tu dong tinh ty le va phan bo
- Kiem tra: tong phan bo = tong chi phi (chinh xac)

**Buoc 3:** Phan tich chenh lech (Variance Report)
```
Chenh lech = Thuc te - Uoc tinh
Ty le chenh lech (%) = (Chenh lech / Uoc tinh) x 100
```
- Danh dau "Vuot ngan sach" neu thuc te > uoc tinh

### 9.4 Chi so quan trong

- **Chi phi/kg**: Tong chi phi / Tong trong luong tinh cuoc
- **Ty suat loi nhuan uoc tinh**: ((Doanh thu - Chi phi) / Doanh thu) x 100%
- Top 10 container chi phi cao nhat

---

## 10. Quy trinh tinh hoa hong kinh doanh

### 10.1 Cong thuc tinh

```
Loi nhuan rong = Doanh thu don hang - Tong chi phi phan bo
Hoa hong = Loi nhuan rong x Ty le hoa hong (theo bac)
```

### 10.2 Bang ty le hoa hong (theo loai dich vu va bac loi nhuan)

| Dich vu | Loi nhuan | Ty le |
|---------|-----------|-------|
| VCT | 0 - 1 trieu | 2% |
| VCT | 1 - 5 trieu | 3% |
| VCT | > 5 trieu | 5% |
| MHH | 0 - 2 trieu | 2% |
| MHH | 2 - 10 trieu | 3% |
| MHH | > 10 trieu | 4% |

*Ty le cu the duoc cau hinh trong he thong tai **Cai dat > Quy tac hoa hong***

### 10.3 Quy trinh

**Buoc 1: Tinh tu dong khi don hang hoan thanh**
1. Don hang chuyen trang thai `COMPLETED`
2. He thong tinh: doanh thu, chi phi, loi nhuan
3. Tim quy tac hoa hong phu hop (dich vu + bac loi nhuan)
4. Tao ban ghi hoa hong trang thai `PENDING`

**Buoc 2: Phe duyet**
- Ke toan truong xem xet va duyet
- Don < 1 trieu → Tu dong duyet
- Trang thai: `PENDING` → `APPROVED`

**Buoc 3: Chi tra**
- Ke toan chi phi tao phieu chi tra hoa hong
- Cap nhat trang thai: `APPROVED` → `PAID`
- Hach toan so cai

### 10.4 Bao cao hoa hong

| Bao cao | Doi tuong |
|---------|-----------|
| Hoa hong ca nhan | Sale xem hoa hong cua minh |
| Hoa hong nhom | Truong nhom xem toan nhom |
| Bao cao thang | Ke toan xem toan cong ty |

---

## 11. Quy trinh xuat hoa don

### 11.1 Loai hoa don

| Loai | Ma | Mo ta |
|------|----|-------|
| Hoa don GTGT | GTGT | Hoa don thong thuong |
| Hoa don dieu chinh | DIEU_CHINH | Sua hoa don da xuat |
| Hoa don huy | HUY | Huy hoa don |

### 11.2 Quy trinh xuat hoa don

**Buoc 1: Tao hoa don (DRAFT)**
1. KTTT vao module **Hoa don** > **Tao moi**
2. Chon don hang/khach hang
3. He thong tu dong tinh:
   - `Tien thue = Gia tri x Thue suat (mac dinh 10%)`
   - `Tong tien = Gia tri + Tien thue`
4. Ma hoa don: `TBS-INV-XXXXXX`

**Buoc 2: Phat hanh (DRAFT → ISSUED)**
- KTT xac nhan phat hanh
- Ghi nhan ngay phat hanh
- Tu dong tao ban ghi AR

**Buoc 3: Gui co quan thue**
- Dong bo voi MISA/phan mem thue
- Ghi nhan ngay gui va ma thue

### 11.3 Dieu chinh hoa don

- Hoa don DA gui co quan thue → Khong the huy
- Phai tao hoa don dieu chinh:
  1. Hoa don goc chuyen trang thai `ADJUSTED`
  2. Tao hoa don moi loai `DIEU_CHINH`
  3. Lien ket voi hoa don goc

---

## 12. Quy trinh hach toan so cai (GL)

### 12.1 Nguyen tac hach toan

- **Ghi so kep (Double-Entry)**: Tong No = Tong Co
- Sai lech cho phep: ≤ 0.01 VND
- Toi thieu 2 dong moi but toan
- Moi dong: No > 0 HOAC Co > 0 (khong dong thoi)

### 12.2 Cac nghiep vu tu dong hach toan

| Nghiep vu | No (Debit) | Co (Credit) |
|-----------|------------|-------------|
| Thu tien coc | TK Tien mat/Ngan hang | TK Khach hang tra truoc |
| Thu tat toan | TK Tien mat/Ngan hang | TK Cong no phai thu |
| Chi tra NCC | TK Cong no phai tra | TK Tien mat/Ngan hang |
| Ghi nhan doanh thu | TK Cong no phai thu | TK Doanh thu |
| Ghi nhan chi phi | TK Chi phi | TK Cong no phai tra |
| Bu tru cong no | TK Cong no phai tra | TK Cong no phai thu |
| Chi tra hoa hong | TK Chi phi ban hang | TK Tien mat/Ngan hang |

### 12.3 Quan ly ky ke toan

- **Dong ky**: KTT dong ky ke toan thang/nam
- Sau khi dong: Khong the tao but toan moi trong ky da dong
- Rang buoc: Moi (nam, thang) chi dong 1 lan

### 12.4 Bao cao ke toan

**Bang can doi thu (Trial Balance):**
- Theo ngay: Tong No, Tong Co, So du theo tung tai khoan
- Kiem tra can doi: Tong No = Tong Co

**So du tai khoan:**
- Theo ky: Lich su bien dong No/Co, so du luy ke

---

## 13. Quy trinh phe duyet tai chinh

### 13.1 Cac loai phe duyet tai chinh

| Loai | Trigger | Nguoi duyet |
|------|---------|-------------|
| Giam gia (DISCOUNT) | Giam gia > 3% | Truong nhom KD → GD KD → BGD |
| Phieu chi (PAYMENT_VOUCHER) | Moi phieu chi | KTT → GD TC → CEO (theo han muc) |
| Phieu thu (RECEIPT_VOUCHER) | Moi phieu thu | KTT |
| Huy don (ORDER_CANCEL) | Huy don hang | Tuy giai doan coc |
| Gia han cong no (CREDIT_EXTENSION) | Keo dai thoi han tra | KTT → GD TC |
| Mien/giam coc (DEPOSIT_EXEMPTION) | Giam ty le coc | GD KD → CEO |
| Bao gia dac biet (QUOTATION_SPECIAL) | Giam gia > 5% | GD KD → CEO |

### 13.2 Muc giam gia va cap phe duyet

| Muc giam gia | Cap phe duyet |
|--------------|---------------|
| ≤ 3% | Truong nhom Kinh doanh |
| 3% - 5% | Giam doc Kinh doanh |
| > 5% | Tong Giam doc |

### 13.3 Quy trinh phe duyet

```
Tao yeu cau → PENDING → [Duyet] → APPROVED
                       → [Tu choi] → REJECTED
                       → [Tra lai] → RETURNED → Sua lai → Gui lai
                       → [Rut lai] → WITHDRAWN (nguoi tao tu rut)
```

### 13.4 Quy dinh thoi gian

- Thoi gian phe duyet toi da: **24 gio**
- Qua 24 gio: He thong gui nhac nho va leo thang (escalation)
- Qua 48 gio: Tu dong leo thang len cap tren
- He thong kiem tra moi **1 gio**

### 13.5 Uy quyen phe duyet

- Nguoi duyet co the uy quyen cho nguoi khac (cung cap bac)
- Ghi nhan: nguoi uy quyen, nguoi duoc uy quyen, ly do
- Toan bo hanh dong ghi nhat ky (Approval Action Log)

---

## 14. Kiem soat chong gian lan

### 14.1 Kiem tra chan (CHAN - Khong cho tao phieu)

| Quy tac | Mo ta |
|---------|-------|
| Khong co ma don hang | Phieu chi/thu phai gan voi don hang |
| Don hang da hoan thanh/huy | Khong chi them cho don da dong |
| Khong co chung tu dinh kem | BAT BUOC phai co chung tu |
| Ly do qua ngan | Toi thieu 20 ky tu |
| Khong co nguoi thu huong | Phai ghi ro nguoi nhan tien |
| Khong co loai chi phi | Phai phan loai chi phi |

### 14.2 Kiem tra canh bao (FLAG - Cho tao nhung danh dau)

| Quy tac | Muc do | Mo ta |
|---------|--------|-------|
| Vuot 90% doanh thu don | CAO | Phieu chi > 90% tong gia tri don hang |
| Phat sinh > 5 trieu | TRUNG BINH | Chi phi phat sinh bat thuong |
| 5+ phieu/ngay/nguoi tao | CAO | Nghi ngo tach phieu (splitting) |
| Nguoi thu huong khong co trong danh sach | TRUNG BINH | NCC chua duoc duyet |
| Ngoai gio lam viec | THAP | Tao phieu ngoai 07:00-19:00 |

### 14.3 Xu ly phieu bi danh dau

1. Phieu danh dau van duoc tao nhung co co `isFlagged = true`
2. He thong gui thong bao den KTT va nguoi phe duyet
3. Nguoi phe duyet PHAI xem xet ky truoc khi duyet
4. Ghi nhan ly do danh dau trong `flagReason`

---

## 15. Quan ly ty gia

### 15.1 Nguon ty gia

| Nguon | Mo ta |
|-------|-------|
| VIETCOMBANK | Tu dong dong bo tu API Vietcombank |
| MANUAL | Nhap tay boi Ke toan |

### 15.2 Cac cap tien te

| Tu | Sang | Su dung |
|----|------|---------|
| CNY | VND | Mua hang TQ, chi phi kho TQ |
| USD | VND | Phi van chuyen quoc te |
| CNY | USD | Quy doi trung gian |

### 15.3 Quy trinh

**Ty gia tu dong:**
- Dong bo tu Vietcombank (co circuit breaker: 3 lan that bai → ngung 2 phut)
- Retry: 3 lan, thoi gian tang dan (2s → 30s)
- Cache: 1 gio

**Ty gia thu cong:**
- KTT nhap ty gia khi khong co du lieu tu dong
- Ghi nhan nguon = MANUAL

**Khoa ty gia:**
- Khi tao don hang MHH, ty gia duoc khoa tai thoi diem mua hang
- Luu trong OrderItem.exchangeRateUsed
- Khong thay doi theo ty gia moi

### 15.4 Cong thuc quy doi

```
So tien VND = So tien ngoai te x Ty gia
Lam tron: 2 chu so thap phan
```

---

## 16. Bao cao tai chinh dinh ky

### 16.1 Bao cao hang ngay

| STT | Bao cao | Nguoi nhan | Thoi gian |
|-----|---------|------------|-----------|
| 1 | Snapshot tuoi no AR | KTT, GDKD | 01:00 tu dong |
| 2 | Canh bao cong no | Sale, KTT | 08:00 tu dong |
| 3 | Tong hop COD | Truong kho, KTT | Cuoi ngay |

### 16.2 Bao cao hang tuan

| STT | Bao cao | Nguoi nhan |
|-----|---------|------------|
| 1 | Doi soat COD | KTT |
| 2 | Dong tien vao/ra | KTT, GD TC |
| 3 | Tong hop AP den han | KTCP |

### 16.3 Bao cao hang thang

| STT | Bao cao | Nguoi nhan |
|-----|---------|------------|
| 1 | Bang can doi thu (Trial Balance) | KTT, CEO |
| 2 | Bao cao hoa hong | KTT, GDKD |
| 3 | Chenh lech chi phi van hanh | KTCP, COO |
| 4 | Phan tich cong no AR Aging | KTT, CEO |
| 5 | Tong hop dong tien (Cash Flow) | KTT, CEO |
| 6 | Bao cao loi nhuan theo don hang | GDKD, CEO |

### 16.4 Dong ky ke toan

- KTT thuc hien dong ky ke toan cuoi moi thang
- Truoc khi dong: Kiem tra can doi so cai
- Sau khi dong: Khong the tao but toan trong ky da dong
- Deadline: Ngay 5 cua thang tiep theo

---

## 17. Phu luc - Tham so he thong

### 17.1 Ty le coc theo hang khach hang

| Tham so | Gia tri | Don vi |
|---------|---------|--------|
| DEPOSIT_RATE_NEW | 1.0 | 100% |
| DEPOSIT_RATE_REGULAR | 0.7 | 70% |
| DEPOSIT_RATE_VIP | 0.5 | 50% |
| DEPOSIT_RATE_STRATEGIC | 0.3 | 30% |
| DEPOSIT_AUTO_CANCEL_DAYS | 3 | ngay |

### 17.2 Gioi han tai chinh

| Tham so | Gia tri | Don vi |
|---------|---------|--------|
| MAX_VOUCHER_AMOUNT | 500,000,000 | VND |
| MIN_REASON_LENGTH | 20 | ky tu |
| AR_DUE_DATE_DAYS | 30 | ngay |
| OVERDUE_THRESHOLD_DAYS | 15 | ngay |

### 17.3 Phe duyet

| Tham so | Gia tri | Don vi |
|---------|---------|--------|
| APPROVAL_ESCALATE_HOURS | 24 | gio |
| DISCOUNT_LEVEL2 | 0.03 | 3% |
| DISCOUNT_LEVEL3 | 0.05 | 5% |
| HIGH_VALUE_ORDER | 100,000,000 | VND |

### 17.4 Chong gian lan

| Tham so | Gia tri | Don vi |
|---------|---------|--------|
| MAX_VOUCHERS_PER_DAY | 5 | phieu/nguoi/ngay |
| MISC_EXPENSE_THRESHOLD | 5,000,000 | VND |
| EXPENSE_RATIO_THRESHOLD | 0.9 | 90% doanh thu |
| BUSINESS_HOURS_START | 07:00 | gio |
| BUSINESS_HOURS_END | 19:00 | gio |

### 17.5 Hoa hong

| Tham so | Gia tri | Don vi |
|---------|---------|--------|
| DEFAULT_COMMISSION_RATE | 0.03 | 3% |
| COMMISSION_AUTO_APPROVE | 1,000,000 | VND |
| COMMISSION_CACHE_TTL | 1800 | giay (30 phut) |

### 17.6 COD

| Tham so | Gia tri | Don vi |
|---------|---------|--------|
| COD_SHORTAGE_TOLERANCE | 0.01 | 1% |

### 17.7 Bu tru cong no

| Tham so | Gia tri | Don vi |
|---------|---------|--------|
| DEBT_NETTING_MIN | 100,000 | VND |

### 17.8 Vi khach hang

| Tham so | Gia tri | Don vi |
|---------|---------|--------|
| WALLET_TOPUP_MIN | 100,000 | VND |
| WALLET_TOPUP_MAX | 100,000,000 | VND |

### 17.9 Cache

| Du lieu | Thoi gian | Don vi |
|---------|-----------|--------|
| Ty gia | 3600 | giay (1 gio) |
| Dashboard | 300 | giay (5 phut) |
| Hoa hong | 1800 | giay (30 phut) |
| Cong khach hang | 300 | giay (5 phut) |

---

## LICH SU THAY DOI TAI LIEU

| Phien ban | Ngay | Noi dung thay doi | Nguoi sua |
|-----------|------|-------------------|-----------|
| 1.0 | 2026-02-18 | Ban hanh lan dau | Ban TC-KT |

---

*Tai lieu nay la tai san tri tue cua TBS Logistics. Cam sao chep va phat tan khi chua duoc phep.*
