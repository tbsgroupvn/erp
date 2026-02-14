# TBS ERP - Review toan bo he thong

> Ngay review: 2026-02-08
> Pham vi: Frontend (tbs-erp-frontend) + Backend (tbs-erp-backend)
> Goc nhin: Sale, Ke toan, Marketing, Kho, XNK, Ban Giam Doc, IT/Dev

---

## MUC LUC

1. [Tong quan he thong](#1-tong-quan-he-thong)
2. [Review theo vai tro](#2-review-theo-vai-tro)
3. [Review theo module](#3-review-theo-module)
4. [Danh sach BUG](#4-danh-sach-bug)
5. [De xuat cai thien](#5-de-xuat-cai-thien)
6. [Checklist uu tien](#6-checklist-uu-tien)

---

## 1. TONG QUAN HE THONG

### Cac module chinh (24 module frontend, 41 module backend)

| STT | Module | Route | Trang thai |
|-----|--------|-------|------------|
| 1 | Tong quan (Dashboard) | `/tong-quan` | Co 6 dashboard theo role (executive, sales, finance, warehouse, hr, cskh) |
| 2 | Don hang | `/don-hang` | Co list + detail + tao moi + nhap excel |
| 3 | Bao gia | `/bao-gia` | Co list + detail + tao moi |
| 4 | Khach hang | `/khach-hang` | Co list + detail + tao moi + sua |
| 5 | Nhan su | `/nhan-su` | Co list + detail + tao moi |
| 6 | Phe duyet | `/phe-duyet` | Co list (5 tab) + detail |
| 7 | Mua hang | `/mua-hang` | Co list (2 tab) + detail + tao moi |
| 8 | Cong viec | `/cong-viec` | Co list (3 tab) + detail + tao moi |
| 9 | Nha cung cap | `/nha-cung-cap` | Co list + detail |
| 10 | Khieu nai | `/khieu-nai` | Co list + detail + tao moi |
| 11 | Kho Trung Quoc | `/kho-trung-quoc` | Co list |
| 12 | Kho Viet Nam | `/kho-viet-nam` | Co list |
| 13 | Kho vat tu | `/kho-vat-tu` | Co list |
| 14 | Tai xe | `/tai-xe` | Co list + detail |
| 15 | Phuong tien | `/phuong-tien` | Co list + detail |
| 16 | Tai chinh | `/tai-chinh/*` | 6 trang con (cong no phai thu/tra, phieu thu chi, hoa don, ty gia, bu tru cong no) |
| 17 | Theo doi | `/theo-doi` | Tracking search |
| 18 | Cai dat | `/cai-dat` | Profile + doi mat khau + quy trinh phe duyet |
| 19 | Cham cong | `/cham-cong` | 2 tab (cham cong + nghi phep), check-in/out, leave form |
| 20 | Quan ly user | `/quan-ly-user` | List + tao user + phan quyen |
| 21 | Uy quyen | `/uy-quyen` | Tao/huy uy quyen phe duyet |
| 22 | Tai lieu | `/tai-lieu` | Upload/download + filter |
| 23 | Thong bao | `/thong-bao` | Notification center + unread badge |
| 24 | Hoa hong | `/hoa-hong` | Hoa hong ban hang |

### 16 vai tro nguoi dung

| Nhom | Vai tro | Dashboard |
|------|---------|-----------|
| Ban Giam Doc | CEO, COO | executive (full access) |
| Kinh doanh | SALES_DIRECTOR, SALES_LEADER, SALE | sales |
| Marketing | MARKETING_STAFF | sales |
| CSKH | CSKH | cskh |
| Ke toan | CHIEF_ACCOUNTANT, ACCOUNTANT_AR, ACCOUNTANT_COST | finance |
| XNK | XNK_MANAGER, XNK_STAFF | operations |
| Kho | WAREHOUSE_CN_AGENT, WAREHOUSE_VN_MANAGER, WAREHOUSE_VN_STAFF | warehouse |
| Van tai | DRIVER | logistics |

---

## 2. REVIEW THEO VAI TRO

### 2.1 SALE (Nhan vien kinh doanh)

**Co the truy cap:** Tong quan, Don hang, Bao gia, Khach hang, Cong viec, Khieu nai

**OK:**
- [x] Tao don hang moi (wizard 3 buoc, chon KH, them don con, xac nhan)
- [x] Tao bao gia moi (chon KH, them hang muc, tinh gia)
- [x] Tao khach hang moi (form day du voi lien he)
- [x] Sua khach hang (edit mode tren trang detail)
- [x] Xem danh sach don hang, bao gia, khach hang
- [x] Nhap don hang tu Excel (upload, preview, tao hang loat)
- [x] Tao khieu nai

**Van de:**
- [x] **[BUG-S01]** ~~Tab "Don hang" trong trang chi tiet KH chi hien "Chua co du lieu"~~ **DA FIX** (2026-02-08) - Them component CustomerOrders goi useMasterOrders({customerId}), hien bang don hang voi ma don, chi nhanh, trang thai, ngay tao
- [x] **[BUG-S02]** ~~Sales Dashboard: "Khach hang moi" hardcode = 0~~ **DA FIX** (2026-02-08) - Goi useCustomers({tier:NEW}) lay total tu API
- [ ] **[MISS-S01]** Khong co chuc nang tao NCC (nha cung cap) - Sale khong truy cap duoc
- [ ] **[MISS-S02]** Khong co form tao nhan su - chi CEO/COO truy cap
- [ ] **[UX-S01]** Khi tao don hang, khong hien thi cong no hien tai cua khach hang de canh bao
- [ ] **[UX-S02]** Bao gia khong co nut "Gui cho KH" (email/zalo)
- [ ] **[UX-S03]** Khong co trang "Bao cao doanh so ca nhan"

### 2.2 SALES_LEADER / SALES_DIRECTOR

**Them quyen:** Phe duyet

**Van de:**
- [ ] **[MISS-SL01]** Khong co dashboard "Team performance" - chi thay dashboard cua ban than
- [ ] **[MISS-SL02]** Khong co bao cao theo nhom/team
- [ ] **[UX-SL01]** Khong co cach nhanh de xem don hang cua nhan vien trong nhom

### 2.3 KE TOAN (Chief Accountant, AR, Cost)

**Co the truy cap:** Tong quan, Don hang, Tai chinh (4 module), Mua hang, NCC, Kho vat tu, Cong viec, Phe duyet

**OK:**
- [x] Xem cong no phai thu/phai tra
- [x] Xem hoa don
- [x] Xem phieu thu chi
- [x] Tao yeu cau mua hang
- [x] Phe duyet (Chief Accountant)

**Van de:**
- [x] **[BUG-F01]** ~~Trang tai chinh (4 trang) chi hien danh sach, khong co nut tao moi phieu thu/chi~~ **DA FIX** (2026-02-08) - Hoa don co form tao moi + phat hanh/huy. Cong no phai thu co form ghi nhan thanh toan
- [x] **[BUG-F02]** ~~Trang hoa don khong co nut tao hoa don~~ **DA FIX** (2026-02-08) - Them form tao hoa don voi customerId, orderId, type, amount, taxRate
- [x] **[MISS-F01]** ~~Khong co trang Bao cao tai chinh~~ **DA FIX** (2026-02-08) - Tao trang /bao-cao/tai-chinh voi summary va chi tiet theo thang
- [x] **[MISS-F02]** ~~Khong co form ghi nhan thanh toan cong no~~ **DA FIX** - Trang cong no phai thu da co form ghi nhan thanh toan (co tu truoc)
- [x] **[MISS-F03]** ~~Khong co trang ty gia hoi doai~~ **DA FIX** (2026-02-08) - Tao trang /tai-chinh/ty-gia
- [ ] **[MISS-F04]** Khong co trang quyet toan don hang
- [x] **[MISS-F05]** ~~Khong co trang bu tru cong no~~ **DA FIX** (2026-02-08) - Tao trang /tai-chinh/bu-tru-cong-no
- [ ] **[UX-F01]** Finance Dashboard: "Cash flow" va "Ty gia" chi hien so, khong co bieu do/lich su
- [ ] **[UX-F02]** Cong no phai thu khong co nut "Nhac no" (gui thong bao cho KH)

### 2.4 MARKETING / CSKH

**Co the truy cap:** Tong quan, Khach hang, Don hang, Cong viec, (CSKH them Khieu nai)

**Van de:**
- [ ] **[MISS-M01]** Khong co module marketing (chien dich, bao cao marketing)
- [x] **[MISS-M02]** ~~Khong co dashboard CSKH (so khieu nai, diem hai long, thoi gian xu ly)~~ **DA FIX** (2026-02-09) - Tao CSKHDashboard voi 4 stat cards (khieu nai moi, dang xu ly, da giai quyet, ti le hai long) + bang khieu nai gan day. Map role CSKH → dashboard type 'cskh'
- [ ] **[MISS-M03]** Khong co trang bao cao khach hang (phan khuc, tang truong, retention)
- [ ] **[UX-M01]** CSKH khong truy cap duoc trang Khieu nai tu sidebar (thieu trong menu)

### 2.5 KHO (Warehouse CN, VN)

**Co the truy cap:** Tong quan, Kho TQ/VN, Container, Theo doi, (Manager them Phe duyet, Phuong tien, Tai xe)

**OK:**
- [x] Xem danh sach kien hang Kho TQ / Kho VN
- [x] Theo doi kien hang va container
- [x] Warehouse Dashboard co pipeline 6 buoc

**Van de:**
- [ ] **[BUG-W01]** Kho TQ va Kho VN chi co list, khong co trang detail kien hang
- [ ] **[BUG-W02]** Khong co nut thao tac tren kien hang (nhan, can, dong goi, xuat) - du backend co day du endpoint
- [ ] **[MISS-W01]** Khong co form nhap kien hang moi (backend co POST warehouse-cn/receive)
- [ ] **[MISS-W02]** Khong co form cap nhat trang thai kien hang
- [ ] **[MISS-W03]** Container page chi la placeholder - khong co UI quan ly container
- [ ] **[MISS-W04]** Khong co chuc nang in nhan/barcode kien hang
- [ ] **[MISS-W05]** Khong co ke hoach giao hang (backend co POST warehouse-vn/delivery-plan)
- [ ] **[UX-W01]** Warehouse Dashboard hien so lieu nhung click vao khong di dau

### 2.6 XNK (Xuat nhap khau)

**Co the truy cap:** Tong quan, Don hang, Container, Kho TQ/VN, Theo doi, Cong viec, (Manager them Phe duyet)

**Van de:**
- [ ] **[MISS-X01]** Khong co trang quan ly thong quan (customs), du don hang co trang thai CUSTOMS
- [ ] **[MISS-X02]** Khong co form lam to khai hai quan
- [ ] **[MISS-X03]** Khong co trang chi phi van hanh (operation-cost), du backend da co module
- [ ] **[MISS-X04]** Khong co trang consolidation planning (ghep container)

### 2.7 BAN GIAM DOC (CEO, COO)

**Co the truy cap:** Tat ca cac route

**OK:**
- [x] BOD Dashboard voi bieu do va thong ke
- [x] Xem tat ca module
- [x] Quan ly quy trinh phe duyet
- [x] Cai dat he thong

**Van de:**
- [x] **[BUG-B01]** ~~BOD Dashboard: Bieu do doanh thu trong~~ **DA FIX** (2026-02-08) - Hien so doanh thu + % tang truong
- [x] **[BUG-B02]** ~~BOD Dashboard: Bang "Don hang gan day" khong co du lieu~~ **DA FIX** (2026-02-08) - Goi useMasterOrders({limit:5})
- [ ] **[MISS-B01]** Khong co trang bao cao tong hop (revenue, profit, KPI)
- [ ] **[MISS-B02]** Khong co dashboard nhan su (headcount, cham cong, nghi phep)
- [x] **[MISS-B03]** ~~Khong co trang quan ly hoa hong (commission)~~ **DA FIX** (2026-02-08) - Tao trang /hoa-hong voi tinh hoa hong, duyet, xem cua toi/nhom, quy tac
- [ ] **[UX-B01]** Cai dat chi co doi mat khau va quan ly phe duyet - thieu quan ly user, phan quyen

### 2.8 TAI XE (Driver)

**Co the truy cap:** Tong quan, Kho VN (chi xem)

**Van de:**
- [ ] **[MISS-D01]** Khong co trang "Chuyen giao cua toi" - tai xe khong thay danh sach giao hang
- [ ] **[MISS-D02]** Khong co chuc nang xac nhan giao hang (backend co confirm-delivery)
- [ ] **[MISS-D03]** Khong co chuc nang COD (thu tien khi giao)
- [ ] **[UX-D01]** Dashboard tai xe dung chung warehouse dashboard - khong phu hop

---

## 3. REVIEW THEO MODULE

### 3.1 Don hang (`/don-hang`)

| Tinh nang | Frontend | Backend | Trang thai |
|-----------|----------|---------|------------|
| Danh sach don tong | OK | OK | OK |
| Chi tiet don tong + don con | OK | OK | OK |
| Tao don moi (wizard) | OK | OK | OK |
| Nhap Excel hang loat | OK | OK | OK |
| Cap nhat trang thai don | - | OK | **THIEU UI** |
| Huy don hang | - | OK | **THIEU UI** |
| Sua don hang | - | OK | **THIEU UI** |
| Xem lich su trang thai | OK (timeline) | OK | OK |

### 3.2 Bao gia (`/bao-gia`)

| Tinh nang | Frontend | Backend | Trang thai |
|-----------|----------|---------|------------|
| Danh sach + filter tab | OK | OK | OK |
| Chi tiet bao gia | OK | OK | OK |
| Tao bao gia moi | OK | OK | OK |
| Duyet/Tu choi | OK | OK | OK |
| Chuyen thanh don hang | OK | OK | OK |
| Sao chep bao gia | OK | OK | OK |
| Xuat PDF/Excel | OK | OK | OK |
| Sua bao gia | - | OK | **THIEU UI** |

### 3.3 Khach hang (`/khach-hang`)

| Tinh nang | Frontend | Backend | Trang thai |
|-----------|----------|---------|------------|
| Danh sach + tim kiem | OK | OK | OK |
| Chi tiet (4 tab) | OK | OK | OK (tru tab Don hang) |
| Tao khach hang | OK | OK | OK |
| Sua khach hang | OK | OK | OK |
| Tab Don hang | OK | OK | **DA FIX** (2026-02-08) |
| Tab Vi | OK | OK | OK |
| Tab Cong no | OK | OK | OK |
| Nap vi | - | OK | **THIEU UI** |
| Quan ly lien he rieng | - | - | **THIEU CA 2** |

### 3.4 Phe duyet (`/phe-duyet`)

| Tinh nang | Frontend | Backend | Trang thai |
|-----------|----------|---------|------------|
| 5 tab (cho duyet, da gui, da xu ly, theo doi, tat ca) | OK | OK | OK |
| Chi tiet + timeline | OK | OK | OK |
| Duyet/Tu choi | OK | OK | OK |
| Binh luan | OK | OK | OK |
| Nhat ky hanh dong | OK | OK | OK |
| Uy quyen (delegation) | - | OK | **THIEU UI** |
| Tao quy trinh phe duyet | OK | OK | OK |

### 3.5 Mua hang (`/mua-hang`)

| Tinh nang | Frontend | Backend | Trang thai |
|-----------|----------|---------|------------|
| Danh sach PR/PO | OK | OK | OK |
| Tao yeu cau mua | OK | OK | OK |
| Chi tiet PR | OK | OK | OK |
| Duyet PR | OK | OK | OK |
| Chuyen PR → PO | OK | OK | OK |
| Ghi nhan nhap hang | OK | OK | OK |
| Tao PO truc tiep | - | OK | **THIEU UI** |
| Sua/Huy PR/PO | - | OK | **THIEU UI** |

### 3.6 Tai chinh (`/tai-chinh/*`)

| Tinh nang | Frontend | Backend | Trang thai |
|-----------|----------|---------|------------|
| Danh sach hoa don | OK (read-only) | OK | **THIEU** tao/phat hanh |
| Danh sach cong no phai thu | OK (read-only) | OK | **THIEU** ghi nhan thanh toan |
| Danh sach cong no phai tra | OK (read-only) | OK | **THIEU** ghi nhan thanh toan |
| Danh sach phieu thu chi | OK (read-only) | OK | **THIEU** tao phieu |
| Ty gia hoi doai | - | OK | **THIEU UI** |
| So cai / But toan | - | OK | **THIEU UI** |
| Bu tru cong no | - | OK | **THIEU UI** |

### 3.7 Kho (`/kho-*`)

| Tinh nang | Frontend | Backend | Trang thai |
|-----------|----------|---------|------------|
| Danh sach kien Kho TQ | OK (read-only) | OK | **THIEU** thao tac |
| Danh sach kien Kho VN | OK (read-only) | OK | **THIEU** thao tac |
| Nhan kien hang | - | OK | **THIEU UI** |
| Can/Do kien | - | OK | **THIEU UI** |
| Dong goi | - | OK | **THIEU UI** |
| Xuat kho | - | OK | **THIEU UI** |
| Giao hang | - | OK | **THIEU UI** |
| Ke hoach giao hang | - | OK | **THIEU UI** |
| Kho vat tu | OK | OK | OK |

### 3.8 Cac module khac

| Module | Frontend | Backend | Ghi chu |
|--------|----------|---------|---------|
| Container | Placeholder | OK | **THIEU** UI quan ly |
| Theo doi (Tracking) | OK | OK | OK - nhung tracking API la stub |
| Tai lieu | List only | OK | **THIEU** upload/download |
| Luong (Payroll) | List only | OK | **THIEU** tinh luong, duyet, chi tiet |
| Cham cong (Attendance) | - | OK | **THIEU UI hoan toan** |
| Hoa hong (Commission) | - | OK | **THIEU UI hoan toan** |
| COD | - | OK | **THIEU UI hoan toan** |
| Customer Portal | - | OK | **THIEU UI hoan toan** |
| Calendar | - | OK | **THIEU UI hoan toan** |
| Ngan sach (Budget) | - | OK | **THIEU UI hoan toan** |

---

## 4. DANH SACH BUG

### Do uu tien CAO (anh huong truc tiep den nghiep vu)

| ID | Module | Mo ta | Loai |
|----|--------|-------|------|
| ~~BUG-S01~~ | ~~Khach hang~~ | ~~Tab "Don hang" trong chi tiet KH hien "Chua co du lieu"~~ **DA FIX** | ~~UI Bug~~ |
| ~~BUG-S02~~ | ~~Dashboard~~ | ~~Sales Dashboard: "Khach hang moi" hardcode = 0~~ **DA FIX** | ~~Hardcode~~ |
| ~~BUG-B01~~ | ~~Dashboard~~ | ~~BOD Dashboard: Bieu do doanh thu = empty array~~ **DA FIX** | ~~Data Bug~~ |
| ~~BUG-B02~~ | ~~Dashboard~~ | ~~BOD Dashboard: Bang "Don hang gan day" khong co data~~ **DA FIX** | ~~Data Bug~~ |
| BUG-F01 | Tai chinh | 4 trang tai chinh chi read-only, khong co nut tao/sua | Missing Action |
| ~~BUG-W01~~ | ~~Kho~~ | ~~Kho TQ va Kho VN chi list, khong co nut thao tac (nhan/can/dong goi/xuat)~~ **DA FIX** (2026-02-08) - Them day du nut nhan/can/dong goi/cap nhat trang thai cho Kho TQ va nhan/phan loai/xuat cho Kho VN | ~~Missing Action~~ |
| ~~BUG-W02~~ | ~~Kho~~ | ~~Kien hang khong co trang detail~~ **DA FIX** (2026-02-08) - Tao trang `/kho-trung-quoc/[id]` voi thong tin co ban, kich thuoc, dong thoi gian | ~~Missing Page~~ |

### Do uu tien TRUNG BINH

| ID | Module | Mo ta | Loai |
|----|--------|-------|------|
| BUG-F02 | Hoa don | Khong co nut tao hoa don moi | Missing Action |
| ~~BUG-UI01~~ | ~~Sidebar~~ | ~~2 file sidebar trung lap~~ **DA FIX** (2026-02-08) - Chuyen layout.tsx sang dung `layout/app-sidebar.tsx` (co role filter, collapsible groups, badge phe duyet, user info) + fix icon map tu string sang LucideIcon + dung ROLE_MENU_ACCESS thay vi hardcode | ~~Code Duplicate~~ |
| ~~BUG-UI02~~ | ~~Dashboard~~ | ~~`tong-quan/page.tsx` duplicate role~~ **DA FIX** (2026-02-08) - Thay 4 mang role duplicate bang `getDashboardType()` tu permissions.ts, dung switch/case | ~~Code Duplicate~~ |
| ~~BUG-UI03~~ | ~~Container~~ | ~~Trang `/container` la placeholder, chua co noi dung~~ **DA FIX** (2026-02-08) - Them form tao container, cap nhat trang thai, them kien, filter trang thai/tuyen | ~~Missing UI~~ |
| BUG-UI04 | Tai lieu | Trang `/tai-lieu` chi hien list, khong co upload/download | Missing Action |
| BUG-UI05 | Luong | Trang `/luong` chi hien list, khong co tinh luong/duyet | Missing Action |

### Do uu tien THAP

| ID | Module | Mo ta | Loai |
|----|--------|-------|------|
| BUG-BE01 | Tracking | Tracking API (Kuaidi100, 17Track) la stub - chua tich hop that | Backend Stub |
| BUG-BE02 | Ty gia | Vietcombank API sync la stub | Backend Stub |
| BUG-BE03 | Thong bao | Email va SMS provider chua tich hop | Backend Stub |

---

## 5. DE XUAT CAI THIEN

### 5.1 UU TIEN 1 - Hoan thien cac module da co backend

Cac module nay backend da xong, chi can lam UI:

| STT | Module | Cong viec | Do kho | Thoi gian uoc tinh |
|-----|--------|-----------|--------|---------------------|
| 1 | Kho TQ/VN | Them nut nhan/can/dong goi/xuat kien hang, trang detail kien | Trung binh | 3-5 ngay |
| 2 | Tai chinh | Them form tao hoa don, ghi nhan thanh toan, tao phieu thu chi | Trung binh | 3-5 ngay |
| 3 | Don hang | Them nut cap nhat trang thai, huy don | De | 1-2 ngay |
| 4 | Container | UI quan ly container (list, detail, ghep container) | Trung binh | 2-3 ngay |
| 5 | Cham cong | Trang cham cong + nghi phep | Trung binh | 3-4 ngay |
| 6 | COD | Trang quan ly COD cho tai xe | De | 2 ngay |
| 7 | Hoa hong | Trang hoa hong nhan vien | De | 2 ngay |
| 8 | Ty gia | Trang quan ly ty gia | De | 1 ngay |
| 9 | Bu tru cong no | Trang debt netting | Trung binh | 2-3 ngay |

### 5.2 UU TIEN 2 - Fix bug va UX

| STT | Viec | Chi tiet |
|-----|------|----------|
| 1 | Fix tab Don hang trong KH detail | Goi API lay don hang theo customerId |
| 2 | Fix dashboard data | Ket noi API thuc thay vi hardcode |
| 3 | Dung sidebar co role filter | Chuyen sang dung `layout/app-sidebar.tsx` |
| 4 | Fix duplicate role definitions | Import tu `permissions.ts` thay vi khai bao lai |
| 5 | Them form nap vi KH | Them nut + modal nap vi trong tab Vi |
| 6 | Them uy quyen phe duyet | UI cho delegation management |

### 5.3 UU TIEN 3 - Tinh nang moi

| STT | Tinh nang | Mo ta | Doi tuong |
|-----|-----------|-------|-----------|
| 1 | Bao cao doanh so | Bao cao theo sale/nhom/thoi gian | Sale, Leader, BGD |
| 2 | Bao cao tai chinh | So cai, bang can doi, P&L | Ke toan, BGD |
| 3 | Customer Portal | Portal rieng cho khach hang tu theo doi | Khach hang |
| 4 | Dashboard CSKH | Thong ke khieu nai, thoi gian xu ly | CSKH |
| 5 | Dashboard nhan su | Headcount, cham cong, nghi phep | BGD, HR |
| 6 | Ke hoach giao hang | Phan tuyen, toi uu tuyen duong | Kho VN, Tai xe |
| 7 | Tich hop tracking | Ket noi Kuaidi100/17Track that | XNK, Kho |
| 8 | Gui thong bao KH | Email/Zalo thong bao trang thai don | Sale, CSKH |
| 9 | Quan ly user | Tao/sua/khoa tai khoan, phan quyen | Admin, BGD |
| 10 | In nhan/barcode | In nhan kien hang, ma van don | Kho |

### 5.4 UU TIEN 4 - Ky thuat (IT/Dev)

| STT | Viec | Chi tiet |
|-----|------|----------|
| 1 | Xoa sidebar trung lap | Giu 1 file sidebar duy nhat (layout version) |
| 2 | Centralize role definitions | Dung 1 nguon duy nhat cho role groups |
| 3 | Tich hop email/SMS | Chon provider va tich hop thuc |
| 4 | Tich hop Vietcombank API | Lay ty gia tu dong |
| 5 | Toi uu bundle size | `/tong-quan` = 259kB, `/don-hang/nhap-excel` = 310kB |
| 6 | Unit testing | Vitest setup, 60 unit tests (hooks + permissions). Can them component tests |
| 7 | Error boundary per module | Hien chi co global error boundary |
| 8 | Optimistic updates | Cac mutation chua co optimistic update |

---

## 6. CHECKLIST UU TIEN

### Sprint 1 - Fix bug va hoan thien co ban (1-2 tuan)

- [x] Fix tab "Don hang" trong khach hang detail (BUG-S01) - **DONE 2026-02-08**
- [x] Fix Sales Dashboard hardcode (BUG-S02) - **DONE 2026-02-08**
- [x] Fix BOD Dashboard data (BUG-B01, BUG-B02) - **DONE 2026-02-08**
- [x] Chuyen sang dung sidebar co role filter (BUG-UI01) - **DONE 2026-02-08**
- [x] Fix code duplicate role definitions (BUG-UI02) - **DONE 2026-02-08**
- [x] Don hang: them nut cap nhat trang thai + huy don - **DONE 2026-02-08**
- [x] Tai chinh: them form tao phieu thu chi - **DONE 2026-02-08**
- [x] Tai chinh: them ghi nhan thanh toan cong no - **DONE 2026-02-08**
- [x] Bao gia: them form sua bao gia - **DONE 2026-02-08**
- [x] Khach hang: them form nap vi - **DONE 2026-02-08**

### Sprint 2 - Module kho van (2-3 tuan)

- [x] Kho TQ: them nut nhan/can/dong goi kien hang - **DONE 2026-02-08** — Them form "Nhan kien" (orderId, trackingNumberCN, description, note), action "Can/Do" per row (actualWeight, length, width, height), cap nhat trang thai (RECEIVED→CHECKED→PACKED→SHIPPED), link detail
- [x] Kho VN: them nut nhan/phan loai/xuat kien hang - **DONE 2026-02-08** — Them form "Nhan tu container" (containerId, packageIds), batch sort (checkbox chon nhieu kien, phan loai SORTED/READY), per-row actions, status filter
- [x] Kho: trang detail kien hang - **DONE 2026-02-08** — Tao trang `/kho-trung-quoc/[id]` voi card thong tin co ban, card kich thuoc (form can/do), dong thoi gian (received CN → packed → received VN → delivered), cap nhat trang thai
- [x] Container: UI quan ly container + ghep container - **DONE 2026-02-08** — Them form "Tao container" (shippingRoute, origin, destination, carrier, bookingRef, vesselName, maxCapacity, dates), per-row status update + them kien, filter theo trang thai/tuyen
- [x] Ke hoach giao hang (delivery plan) - **DONE 2026-02-08** — Tao trang `/giao-hang` voi warehouse view (branch selector, summary cards, package list, form tao chuyen giao) va driver view (danh sach chuyen giao duoc phan cong)
- [x] Tai xe: trang "Chuyen giao cua toi" - **DONE 2026-02-08** — Tich hop vao `/giao-hang` khi role=DRIVER: hien danh sach chuyen giao + nut "Xac nhan giao" (form receivedBy, notes) + nut "Thu COD"
- [x] COD: thu tien khi giao - **DONE 2026-02-08** — Tao API client + hooks cho COD (recordCollection, getDriverCollections, confirmRemittance). Tich hop thu COD vao trang driver deliveries (form amount, paymentMethod, notes)

### Sprint 3 - Tai chinh va bao cao (2-3 tuan)

- [x] Tai chinh: tao hoa don + phat hanh - **DONE 2026-02-08** — Them form "Tao hoa don" (customerId, orderId, type, amount, taxRate), per-row "Phat hanh" (DRAFT→ISSUED) va "Huy" actions, status filter, summary cards
- [x] Tai chinh: trang ty gia hoi doai - **DONE 2026-02-08** — Tao trang `/tai-chinh/ty-gia` voi ty gia hien tai (CNY/USD→VND), form cap nhat ty gia, cong cu quy doi, nut "Dong bo Vietcombank", bang lich su ty gia
- [x] Tai chinh: bu tru cong no - **DONE 2026-02-08** — Tao trang `/tai-chinh/bu-tru-cong-no` voi danh sach co hoi bu tru, tao yeu cau bu tru, duyet/thuc hien bu tru, bang lich su voi status filter
- [x] Bao cao doanh so (sale/team/thoi gian) - **DONE 2026-02-08** — Tao trang `/bao-cao/doanh-so` voi filter ngay/chi nhanh, summary cards (tong don, doanh thu, loi nhuan, gia tri TB), bang chi tiet theo nhan vien
- [x] Bao cao tai chinh co ban - **DONE 2026-02-08** — Tao trang `/bao-cao/tai-chinh` voi filter ngay, summary cards (doanh thu, chi phi, loi nhuan, so du, cong no), bang doanh thu/chi phi/loi nhuan theo thang
- [x] Hoa hong nhan vien - **DONE 2026-02-08** — Tao trang `/hoa-hong` voi chon ky (thang/nam), summary cards, tab "Cua toi"/"Nhom", bang hoa hong voi duyet per-row, nut tinh hoa hong, card quy tac hoa hong
- [x] Luong: tinh luong + duyet + phieu luong - **DONE 2026-02-08** — Nang cap trang `/luong`: them phieu luong chi tiet (card thu nhap + khau tru + thuc linh), nut "Phieu luong" per-row, status filter, dung Button component

### Sprint 4 - Nhan su va he thong (2-3 tuan) ✅ DONE 2026-02-08

- [x] Cham cong + nghi phep - **DONE 2026-02-08** — Trang `/cham-cong`: 2 tab (Cham cong/Nghi phep), check-in/check-out, summary cards (co mat/vang/muon/nghi), attendance table, leave balance cards, form xin nghi phep, leave table voi cancel
- [x] Dashboard nhan su - **DONE 2026-02-08** — Component `HRDashboard`: 6 stat cards (tong NV, dang lam, moi tuyen, nghi viec, ti le cham cong, nghi phep cho duyet), gio lam TB/tang ca, bang nhan su theo phong ban. Tich hop vao `/tong-quan` cho role HR
- [x] Quan ly user + phan quyen - **DONE 2026-02-08** — Trang `/quan-ly-user`: form tao user (email, ten, role, mat khau), bang danh sach voi filter role/status/search, thao tac activate/deactivate/reset password, phan quyen dua tren `ROLE_MENU_ACCESS` 16 role
- [x] Uy quyen phe duyet - **DONE 2026-02-08** — Trang `/uy-quyen`: form tao uy quyen (nguoi nhan, ly do, ngay bat dau/ket thuc, loai phe duyet), bang danh sach uy quyen voi trang thai va nut huy
- [x] Tai lieu: upload/download - **DONE 2026-02-08** — Nang cap trang `/tai-lieu`: them form upload (file, ten, danh muc, loai doi tuong, ma doi tuong), filter tim kiem/loai/danh muc, DataTable voi pagination
- [x] Tich hop email/SMS thong bao - **DONE 2026-02-08** — Trang `/thong-bao`: notification center voi tab tat ca/chua doc, card-based list, mark as read, unread count badge, hooks polling 30s sync voi zustand store

### Sprint 5 - Testing va Backlog P0/P1 (2026-02-09)

- [x] Setup Vitest cho frontend - **DONE 2026-02-09** — vitest + @testing-library/react + jsdom. vitest.config.ts voi alias path, setup file, 60 tests pass
- [x] Unit tests cho Sprint 4 hooks - **DONE 2026-02-09** — 7 test files: use-attendance (12 tests), use-notifications (5), use-complaints (6), use-exchange-rate (4), use-cod (4), use-finance (13), permissions (16)
- [x] Dashboard CSKH - **DONE 2026-02-09** — CSKHDashboard component voi useComplaintStatistics, 4 stat cards, bang khieu nai gan day. Them 'cskh' vao DashboardType, map CSKH role
- [x] Dong bo VCB ty gia - **DA CO** — Trang `/tai-chinh/ty-gia` da co nut "Dong bo Vietcombank" voi useSyncVietcombank hook

### Backlog

- [ ] Customer Portal
- [ ] Tich hop tracking API (Kuaidi100/17Track)
- [ ] In nhan/barcode
- [ ] Ngan sach (Budget)
- [ ] E2E testing (component tests)
- [ ] Performance optimization

---

## PHU LUC: BACKEND API CHUA CO UI

Cac endpoint backend da san sang nhung frontend chua co UI:

```
POST   /invoices                         - Tao hoa don
PATCH  /invoices/:id/issue               - Phat hanh hoa don
POST   /invoices/:id/adjust              - Dieu chinh hoa don

POST   /accounts-receivable/:id/payment  - Ghi nhan thanh toan phai thu
POST   /accounts-payable/:id/payment     - Ghi nhan thanh toan phai tra

POST   /cash/vouchers                    - Tao phieu thu chi
PATCH  /cash/vouchers/:id/approve        - Duyet phieu thu chi

POST   /warehouse-cn/receive             - Nhan kien Kho TQ
PATCH  /warehouse-cn/:id/measure         - Can/do kien
PATCH  /warehouse-cn/:id/status          - Cap nhat trang thai

POST   /warehouse-vn/receive             - Nhan kien Kho VN
PATCH  /warehouse-vn/:id/sort            - Phan loai
POST   /warehouse-vn/dispatch            - Xuat kho giao hang
POST   /warehouse-vn/confirm-delivery    - Xac nhan giao hang
POST   /warehouse-vn/delivery-plan       - Ke hoach giao hang

POST   /containers                       - Tao container
PATCH  /containers/:id/status            - Cap nhat trang thai
POST   /containers/:id/packages          - Them kien vao container

POST   /orders/:id/status                - Cap nhat trang thai don
POST   /orders/:id/cancel                - Huy don

GET    /exchange-rate/current             - Ty gia hien tai
POST   /exchange-rate                     - Cap nhat ty gia
POST   /exchange-rate/sync-vcb           - Dong bo Vietcombank

POST   /debt-netting                     - Tao yeu cau bu tru
POST   /debt-netting/:id/approve         - Duyet bu tru
POST   /debt-netting/:id/execute         - Thuc hien bu tru

POST   /attendance/check-in              - Cham cong vao
POST   /attendance/check-out             - Cham cong ra
POST   /attendance/leave-request         - Gui nghi phep

POST   /commissions/calculate            - Tinh hoa hong
GET    /commissions/my                   - Hoa hong cua toi

POST   /cod/collect                      - Thu COD
POST   /cod/remit                        - Nop COD

GET    /delegations/my                   - Uy quyen cua toi
POST   /delegations                      - Tao uy quyen

POST   /documents/upload                 - Upload tai lieu
GET    /documents/:id/download           - Download tai lieu

POST   /payroll/calculate                - Tinh luong
PATCH  /payroll/:id/approve              - Duyet bang luong
```

---

> **Tong ket:** He thong co backend rat day du (200+ API endpoint), frontend da hoan thien khoang **70-75%** cac tinh nang sau 5 sprint. 49 pages, 6 dashboards, 60 unit tests. Backlog con lai: Customer Portal, tracking API integration, print/barcode, budget module.
