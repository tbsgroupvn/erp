# TBS ERP - User Personas

> Tai lieu phan tich 6 user persona chinh cua he thong TBS Order ERP.
> Ngay tao: 2026-03-21 | Phuong phap: Phan tich ma nguon (RBAC, CASL abilities, menu access, FSM, frontend pages)

---

## Muc luc

1. [Persona 1: SALE - Nhan vien kinh doanh](#persona-1-sale---nhan-vien-kinh-doanh)
2. [Persona 2: WAREHOUSE_CN_AGENT - Nhan vien kho Trung Quoc](#persona-2-warehouse_cn_agent---nhan-vien-kho-trung-quoc)
3. [Persona 3: ACCOUNTANT_AR - Ke toan cong no phai thu](#persona-3-accountant_ar---ke-toan-cong-no-phai-thu)
4. [Persona 4: LOGISTICS_MANAGER - Truong phong Van hanh](#persona-4-logistics_manager---truong-phong-van-hanh)
5. [Persona 5: CSKH - Nhan vien cham soc khach hang](#persona-5-cskh---nhan-vien-cham-soc-khach-hang)
6. [Persona 6: CEO - Giam doc dieu hanh](#persona-6-ceo---giam-doc-dieu-hanh)
7. [Bang tong hop so sanh](#bang-tong-hop-so-sanh)

---

## Persona 1: SALE - Nhan vien kinh doanh

### Ho so

| Thuoc tinh | Chi tiet |
|---|---|
| **Ten** | Nguyen Thanh Tung |
| **Vai tro** | Nhan vien Kinh doanh (SALE) |
| **Tuoi** | 26 |
| **Kinh nghiem** | 2 nam trong nganh logistics/order dich vu Trung Quoc |
| **Trinh do CNTT** | Trung binh - thanh thao su dung web app, Excel, Zalo; chua quen voi he thong ERP phuc tap |

### Muc tieu & Dong luc

- **Muc tieu chinh:** Tang doanh so ca nhan, dat chi tieu hang thang de nhan hoa hong.
- **Muc tieu phu:** Giu chan khach hang cu (tang ti le re-order), rut ngan thoi gian tu tu van den chot don.
- Muon theo doi trang thai don hang real-time de tra loi khach nhanh ma khong can hoi bo phan kho/van hanh.
- Muon biet chinh xac cong no tung khach hang de nhac thanh toan dung luc.

### Pain Points voi quy trinh hien tai

1. **Qua trinh tao don phuc tap:** Phai chon dung serviceType (VCT/MHH/UTXNK/LCLCN), clearanceType (chinh ngach/tieu ngach), shipping route, roi them tung item - de nhap sai khi gap don lon (multi sub-order). Form 3 buoc (Thong tin chung -> Don con -> Xac nhan) doi hoi tap trung cao.
2. **Khong tu xoa/huy don:** CASL chan quyen `delete` va `approve` tren Order - phai gui phe duyet len Sales Leader/Director moi khi can huy, gay cham tre.
3. **Du lieu bi gioi han boi data scope:** Chi xem duoc don hang cua minh (`saleId: userId`), khong the ho tro dong nghiep khi nguoi do nghi phep.
4. **Theo doi cong no thu cong:** Phai vao muc tai-chinh de xem, khong co canh bao tu dong khi khach qua han thanh toan.
5. **Bao gia can phe duyet:** Bao gia dac biet (QUOTATION_SPECIAL) phai qua approval flow, lam cham vong ban hang.

### Cac tinh nang chinh su dung trong ERP

| Module | Hanh dong | Tan suat |
|---|---|---|
| **Don hang** (`/don-hang`) | Tao don moi, xem chi tiet 360, cap nhat trang thai | Nhieu lan/ngay |
| **Bao gia** (`/bao-gia`) | Tao bao gia, gui cho khach | 3-5 lan/ngay |
| **Khach hang** (`/khach-hang`) | Tao khach moi, cap nhat thong tin, xem cong no | Nhieu lan/ngay |
| **Hop dong** (`/hop-dong`) | Tao hop dong khi chot deal | 2-3 lan/tuan |
| **Khieu nai** (`/khieu-nai`) | Tao khieu nai thay khach, theo doi tien do | 1-2 lan/tuan |
| **Dashboard** (`/tong-quan`) | Xem pipeline ban hang, KPI, overdue AR | Moi sang |
| **Cong viec** (`/cong-viec`) | Xem task duoc giao, deadline | Hang ngay |
| **Tro chuyen** (`/tro-chuyen`) | Trao doi noi bo voi kho, ke toan | Nhieu lan/ngay |

### Tan suat su dung

- **Hang ngay**, 6-10 tieng/ngay lam viec
- Cao diem vao dau tuan (tao don, chot bao gia) va cuoi thang (push doanh so, doi hoa hong)

### Trinh do cong nghe

- **Diem: 5/10** - Thanh thao thao tac co ban, nhung de bi nham voi cac trang thai FSM phuc tap (13 trang thai don hang). Can UI/UX ro rang voi tooltip huong dan tung buoc. Su dung chu yeu tren desktop, thi thoang dung mobile de check don.

---

## Persona 2: WAREHOUSE_CN_AGENT - Nhan vien kho Trung Quoc

### Ho so

| Thuoc tinh | Chi tiet |
|---|---|
| **Ten** | Tran Van Lam |
| **Vai tro** | Nhan vien kho Trung Quoc (WAREHOUSE_CN_AGENT) |
| **Tuoi** | 30 |
| **Kinh nghiem** | 3 nam lam viec tai kho Quang Chau, thanh thao quy trinh nhan-kiem-dong-gui |
| **Trinh do CNTT** | Trung binh thap - dung smartphone va may tinh ban co ban, quen voi scan ma vach |

### Muc tieu & Dong luc

- **Muc tieu chinh:** Nhan hang chinh xac, do kich thuoc/can nang that (cnWeight), dong goi nhanh va gui hang ve VN dung lich container.
- **Muc tieu phu:** Giam ty le sai sot (nham hang, thieu hang), xu ly nhanh hang that lac (Lost & Found).
- Can biet ro don nao dang cho hang, tracking number nao tuong ung voi kien hang nao.
- Muon ghi nhan ket qua kiem tra nhanh ma khong phai nhap nhieu truong du lieu.

### Pain Points voi quy trinh hien tai

1. **Nhap lieu nhieu truong khi nhan hang:** Form nhan hang yeu cau orderId, trackingNumberCN, description, note - khi nhan hang lien tuc (50-100 kien/ngay) thi rat mat thoi gian.
2. **OCR packing list chua hoan hao:** Tinh nang PackingListOCR ho tro scan anh packing list tu dong dien du lieu, nhung do chinh xac chua 100% - phai review lai tung dong.
3. **FSM kho TQ cung nhac:** Chi cho phep chuyen trang thai theo thu tu RECEIVED -> CHECKED -> PACKED -> SHIPPED, khong the bo qua buoc nao ke ca truong hop don gian.
4. **Giao dien khong toi uu cho mobile:** Kho TQ thuong dung tablet/dien thoai tai hien truong, nhung UI thiet ke cho desktop la chinh.
5. **Thieu anh huong toi trang thai don:** Chi co quyen `create/read/update` Package, khong co quyen cap nhat trang thai Order - phai bao lai cho XNK Staff/Manager.

### Cac tinh nang chinh su dung trong ERP

| Module | Hanh dong | Tan suat |
|---|---|---|
| **Kho TQ** (`/kho-trung-quoc`) | Nhan hang moi, kiem tra, do luong, dong goi | Lien tuc hang ngay |
| **Chi tiet kien hang** (`/kho-trung-quoc/[id]`) | Cap nhat kich thuoc/can nang, chuyen trang thai | Lien tuc hang ngay |
| **Slotting** (`/kho-trung-quoc/slotting`) | Xem so do kho, vi tri sap xep | 2-3 lan/ngay |
| **Container** (`/container`) | Xem container dang load, them kien vao container | 3-5 lan/ngay |
| **Theo doi** (`/theo-doi`) | Xem tracking kien hang | Khi can |
| **Kiem tra CL** (`/kiem-tra-chat-luong`) | Ghi nhan ket qua kiem tra chat luong | Khi co hang moi |
| **Barcode Scanner** | Quet ma vach de tim kien hang nhanh | Moi kien hang |
| **Packing List OCR** | Chup anh packing list de nhap tu dong | 5-10 lan/ngay |

### Tan suat su dung

- **Hang ngay**, 8-12 tieng (bao gom ca lam ngoai gio khi container gap)
- Cao diem khi container chuan bi xuat: can dong goi va ghi nhan nhanh hang loat kien hang

### Trinh do cong nghe

- **Diem: 3/10** - Chi can thao tac co ban: scan barcode, bam nut chuyen trang thai, nhap so lieu can nang/kich thuoc. Khong quen voi cac khai niem ERP phuc tap. Can UI don gian, nut lon, feedback ro rang (mau sac trang thai, thong bao thanh cong/loi).

---

## Persona 3: ACCOUNTANT_AR - Ke toan cong no phai thu

### Ho so

| Thuoc tinh | Chi tiet |
|---|---|
| **Ten** | Le Thi Mai Anh |
| **Vai tro** | Ke toan Cong no phai thu (ACCOUNTANT_AR) |
| **Tuoi** | 32 |
| **Kinh nghiem** | 5 nam ke toan, 2 nam lam viec voi he thong ERP |
| **Trinh do CNTT** | Kha - thanh thao Excel nang cao, quen lam viec voi phan mem ke toan |

### Muc tieu & Dong luc

- **Muc tieu chinh:** Dam bao thu tien dung han, giam ti le no xau (overdue > 90 ngay), doi chieu cong no chinh xac.
- **Muc tieu phu:** Lap bao cao do tuoi cong no (aging report) dinh ky cho Chief Accountant/CFO, phat hien som khach hang co rui ro.
- Can cap nhat phieu thu/chi nhanh va chinh xac, doi chieu voi ngan hang.
- Muon tu dong hoa canh bao khi khach qua han thanh toan.

### Pain Points voi quy trinh hien tai

1. **Khong co quyen phe duyet phieu thu/chi:** CASL chan `approve` va `delete` tren PaymentVoucher - moi phieu phai gui len Chief Accountant duyet, tao bottleneck khi khoi luong lon.
2. **Doi chieu ngan hang thu cong:** Du co tab doi chieu NH (`/tai-chinh/doi-chieu`), van phai kiem tra tung dong giao dich voi bank statement.
3. **Bao cao aging chua du chi tiet:** Dashboard phan tich do tuoi co bieu do bar/pie/trend, nhung chua ho tro drill-down theo tung nhan vien sale hoac theo nganh hang.
4. **Du lieu gioi han theo chi nhanh:** Data scope filter theo branch - ke toan chi nhanh HN khong xem duoc cong no HCM va nguoc lai, gay kho khan khi doi chieu tong.
5. **Nhieu tab/module tai chinh:** Phai chuyen qua lai giua Cong no, Phieu thu chi, So cai, Hoa don, Doi chieu NH, Bu tru cong no, Chua phan bo - de mat context.

### Cac tinh nang chinh su dung trong ERP

| Module | Hanh dong | Tan suat |
|---|---|---|
| **Cong no phai thu** (`/tai-chinh/cong-no-phai-thu`) | Xem danh sach cong no, loc theo trang thai | Nhieu lan/ngay |
| **Phan tich do tuoi** (`/tai-chinh/cong-no-phai-thu/phan-tich-do-tuoi`) | Xem aging chart, high-risk customers | Hang ngay |
| **Phieu thu chi** (`/tai-chinh/phieu-thu-chi`) | Tao phieu thu, ghi nhan thanh toan | Nhieu lan/ngay |
| **So cai** (`/so-cai`) | Xem but toan, bao cao VAS | 2-3 lan/tuan |
| **Hoa don** (`/hoa-don`) | Xuat hoa don, doi chieu | Hang ngay |
| **Doi chieu NH** (`/tai-chinh/doi-chieu`) | Doi chieu giao dich voi ngan hang | 1-2 lan/ngay |
| **Bu tru cong no** (`/tai-chinh/bu-tru-cong-no`) | Tao phieu bu tru cong no | 2-3 lan/tuan |
| **Don hang** (`/don-hang`) | Xem chi tiet don de xac nhan so tien | Khi can |

### Tan suat su dung

- **Hang ngay**, 7-9 tieng/ngay lam viec
- Cao diem vao cuoi thang (chot cong no) va dau thang (lap bao cao aging cho ban lanh dao)

### Trinh do cong nghe

- **Diem: 7/10** - Thanh thao voi cac cong cu so lieu, Excel pivot table, hieu khai niem CRUD/filter/export. Quen lam viec voi nhieu tab dong thoi. Uu tien do chinh xac so lieu hon toc do.

---

## Persona 4: LOGISTICS_MANAGER - Truong phong Van hanh

### Ho so

| Thuoc tinh | Chi tiet |
|---|---|
| **Ten** | Pham Duc Minh |
| **Vai tro** | Truong phong Van hanh (LOGISTICS_MANAGER) |
| **Tuoi** | 38 |
| **Kinh nghiem** | 10 nam trong nganh logistics quoc te, 3 nam quan ly |
| **Trinh do CNTT** | Kha - su dung ERP, cac tool tracking, bao cao |

### Muc tieu & Dong luc

- **Muc tieu chinh:** Dam bao chuoi van hanh suon se tu kho TQ -> container -> thong quan -> kho VN -> giao hang cuoi. Giam thoi gian transit, giam chi phi van hanh.
- **Muc tieu phu:** Quan ly doi tai xe hieu qua, toi uu hoa container load factor, dam bao thong quan dung han.
- Can nhin tong the pipeline van hanh: bao nhieu don dang o giai doan nao, container nao sap den, kho nao dang qua tai.
- Muon phe duyet nhanh cac yeu cau tu cap duoi (warehouse manager, driver, XNK staff).

### Pain Points voi quy trinh hien tai

1. **Quan ly nhieu module dong thoi:** Phai theo doi Don hang, Container, Kho TQ, Kho VN, Thong quan, Giao hang, Phuong tien, Tai xe, Chi phi van hanh - qua nhieu man hinh de kiem soat.
2. **Thieu dashboard tong hop van hanh:** Dashboard hien tai la loai `warehouse` (chung voi WAREHOUSE_CN_AGENT) - khong phan anh dung nhu cau cua manager can nhin bird-eye view toan bo pipeline.
3. **Approval flow cham:** La nguoi phe duyet cho nhieu loai yeu cau (container plan, warehouse release) - khi di cong tac, cac approval bi delay vi khong co mobile-optimized interface.
4. **Escalation chain phuc tap:** Khi XNK Staff/Warehouse Manager gap van de, escalation leo len LOGISTICS_MANAGER, roi len COO - nhieu cap, cham phan hoi.
5. **Bao cao van hanh chua real-time:** Phai cho report scheduler chay (cron job) moi co so lieu moi, khong phan anh tinh hinh tuc thoi.

### Cac tinh nang chinh su dung trong ERP

| Module | Hanh dong | Tan suat |
|---|---|---|
| **Dashboard** (`/tong-quan`) | Xem tong quan van hanh, KPI | Moi sang + nhieu lan/ngay |
| **Container** (`/container`) | Theo doi trang thai container, phe duyet ke hoach | Nhieu lan/ngay |
| **Don hang** (`/don-hang`) | Xem pipeline don hang dang van chuyen | Hang ngay |
| **Kho TQ** (`/kho-trung-quoc`) | Giam sat tinh hinh nhan hang tai TQ | 2-3 lan/ngay |
| **Kho VN** (`/kho-viet-nam`) | Giam sat tinh hinh xuat/nhap kho VN | 2-3 lan/ngay |
| **Thong quan** (`/thong-quan`) | Theo doi trang thai thong quan | Hang ngay |
| **Giao hang** (`/giao-hang`) | Giam sat tinh hinh giao hang, phan cong tai xe | Hang ngay |
| **Phe duyet** (`/phe-duyet`) | Duyet yeu cau tu cap duoi | Nhieu lan/ngay |
| **Bao cao** (`/bao-cao`) | Xem bao cao hieu suat van hanh | 2-3 lan/tuan |
| **Phuong tien/Tai xe** (`/phuong-tien`) | Quan ly doi xe, trang thai tai xe | Hang ngay |
| **Chi phi van hanh** (`/chi-phi-van-hanh`) | Theo doi chi phi theo container/route | Hang tuan |

### Tan suat su dung

- **Hang ngay**, 5-8 tieng/ngay (khong ngoi suot ngay truoc man hinh nhu sale, nhung check thuong xuyen)
- Cao diem khi container cap cang, khi co van de thong quan, hoac khi doi giao hang gap su co

### Trinh do cong nghe

- **Diem: 6/10** - Su dung tot cac chuc nang co ban, hieu quy trinh FSM, biet xem bao cao. Khong tu tuy chinh duoc automation nhung biet su dung cac rule da thiet lap. Uu tien giao dien tong quan (dashboard) hon chi tiet.

---

## Persona 5: CSKH - Nhan vien cham soc khach hang

### Ho so

| Thuoc tinh | Chi tiet |
|---|---|
| **Ten** | Hoang Thi Ngoc Lan |
| **Vai tro** | Nhan vien Cham soc Khach hang (CSKH) |
| **Tuoi** | 25 |
| **Kinh nghiem** | 1.5 nam CSKH, chuyen tu nganh ban le sang logistics |
| **Trinh do CNTT** | Trung binh - thanh thao Zalo, Facebook, email; dang lam quen voi ERP |

### Muc tieu & Dong luc

- **Muc tieu chinh:** Tra loi thac mac khach hang nhanh va chinh xac - dac biet ve trang thai don hang, thoi gian giao du kien, va cong no.
- **Muc tieu phu:** Ghi nhan khieu nai dung quy trinh, chuyen tiep cho bo phan lien quan xu ly. Xay dung quan he tot voi khach hang.
- Can truy cap nhanh thong tin tong hop cua khach hang (profile, don hang active, cong no, lich su khieu nai) trong mot man hinh duy nhat (Customer Support View).
- Muon biet ro trang thai kien hang dang o dau de tra loi khach khong bi "em hoi lai roi tra loi sau".

### Pain Points voi quy trinh hien tai

1. **Quyen han bi gioi han:** Chi co quyen `read` tren Customer, Order, Package, Delivery va `create/read` PreAlert - khong the cap nhat thong tin gi, phai chuyen yeu cau cho sale hoac bo phan khac.
2. **Khong xem duoc tai chinh chi tiet:** Khong co quyen truy cap `/tai-chinh` - khi khach hoi ve cong no phai lien he ke toan rieng, mat thoi gian.
3. **Customer Support View phu thuoc nhieu query:** Man hinh tong hop khach hang (getSupportView) chay 6 query song song (profile, active orders, AR balance, complaints, interaction notes, support tickets) - doi khi cham khi database tai cao.
4. **Khieu nai bi gioi han rate:** API tao khieu nai co throttle (5 lan/gio) - khi nhieu khach phan nan cung luc se bi chan.
5. **Thieu kenh giao tiep tich hop:** Phai dung Zalo/dien thoai rieng roi ghi lai vao ERP, chua co tich hop truc tiep giua kenh lien lac va he thong.

### Cac tinh nang chinh su dung trong ERP

| Module | Hanh dong | Tan suat |
|---|---|---|
| **Khach hang** (`/khach-hang`) | Tim khach, xem Customer Support View tong hop | Lien tuc hang ngay |
| **Don hang** (`/don-hang`) | Tra cuu trang thai don cho khach | Nhieu lan/ngay |
| **Khieu nai** (`/khieu-nai`) | Tao khieu nai moi, theo doi tien do xu ly | 3-8 lan/ngay |
| **Dashboard** (`/tong-quan`) | Xem CSKH dashboard (so khieu nai, SLA) | Moi sang |
| **Cong viec** (`/cong-viec`) | Xem task duoc giao (follow-up khach hang) | Hang ngay |
| **Tro chuyen** (`/tro-chuyen`) | Trao doi noi bo voi sale, kho, ke toan | Lien tuc |
| **Thong bao** (`/thong-bao`) | Nhan thong bao khi khieu nai duoc xu ly | Nhieu lan/ngay |

### Tan suat su dung

- **Hang ngay**, 8-9 tieng/ngay
- Cao diem vao sang som (khach goi hoi don hang) va chieu (xu ly khieu nai tu ngay hom truoc)

### Trinh do cong nghe

- **Diem: 4/10** - Su dung duoc cac chuc nang tra cuu co ban, nhung gap kho khi phai dung filter phuc tap hoac hieu cac trang thai FSM. Can giao dien truc quan, huong dan buoc-qua-buoc khi tao khieu nai, va search nhanh theo ma don/ten khach.

---

## Persona 6: CEO - Giam doc dieu hanh

### Ho so

| Thuoc tinh | Chi tiet |
|---|---|
| **Ten** | Vu Quang Huy |
| **Vai tro** | Giam doc Dieu hanh (CEO) |
| **Tuoi** | 45 |
| **Kinh nghiem** | 15 nam trong nganh XNK va logistics, sang lap TBS |
| **Trinh do CNTT** | Trung binh kha - su dung smartphone thanh thao, doc bao cao tren web, khong lam viec truc tiep tren ERP nhieu |

### Muc tieu & Dong luc

- **Muc tieu chinh:** Nhin tong the hieu suat kinh doanh cua toan cong ty: doanh thu, loi nhuan, cong no, so luong don, ti le hoan thanh.
- **Muc tieu phu:** Phat hien som cac rui ro (cong no xau tang, container bi giu, khieu nai nghiem trong CRITICAL), ra quyet dinh chien luoc.
- Can dashboard executive the hien so lieu tong hop, bieu do xu huong, so sanh giua cac chi nhanh (HN vs HCM).
- Muon phe duyet nhanh cac yeu cau quan trong (discount lon, huy don, gia han tin dung) ngay tren dien thoai.

### Pain Points voi quy trinh hien tai

1. **Qua nhieu quyen = qua nhieu thong tin:** CEO co quyen `manage all` va truy cap tat ca 55+ route - man hinh sidebar rat dai, kho tim module can thiet.
2. **Dashboard chua du sac net:** BoD Dashboard hien tai cung cap overview (total orders, revenue, customers, completed orders) nhung thieu phan tich sau ve margin, ROI theo kenh, hieu suat tung nhan vien sale.
3. **Phe duyet tren mobile chua toi uu:** Khi di cong tac, can phe duyet discount/huy don tren dien thoai nhung giao dien chua responsive hoan toan.
4. **Bao cao chua tu dong:** Phai tu vao `/bao-cao` de xem, chua co tinh nang gui bao cao tu dong qua email/Zalo hang tuan.
5. **Thieu canh bao chien luoc:** Chua co alert tu dong khi doanh thu giam dot ngot, cong no xau vuot nguong, hoac khach hang VIP/STRATEGIC co van de.

### Cac tinh nang chinh su dung trong ERP

| Module | Hanh dong | Tan suat |
|---|---|---|
| **Dashboard** (`/tong-quan`) | Xem BoD dashboard, overview KPI toan cong ty | Moi sang, 2-3 lan/ngay |
| **Bao cao** (`/bao-cao`) | Xem bao cao doanh so, tai chinh, xuat bao cao tong hop | 2-3 lan/tuan |
| **Phe duyet** (`/phe-duyet`) | Duyet cac yeu cau quan trong (discount, cancel, credit) | 3-5 lan/ngay |
| **Don hang** (`/don-hang`) | Xem danh sach don tong the, loc theo trang thai | 1-2 lan/ngay |
| **Tai chinh** (`/tai-chinh`) | Kiem tra tong quan cong no, doanh thu | 2-3 lan/tuan |
| **Cai dat** (`/cai-dat`) | Quan ly user, cau hinh he thong | Khi can |
| **OKR** (`/okr`) | Dat muc tieu va theo doi tien do | Hang tuan |
| **Thong bao** (`/thong-bao`) | Xem cac canh bao quan trong | Nhieu lan/ngay |

### Tan suat su dung

- **Trung binh**, 1-2 tieng/ngay tren ERP
- Chu yeu check dashboard sang som va cuoi ngay, phe duyet khi co thong bao
- Su dung nhieu hon vao cuoi tuan/cuoi thang khi review hieu suat

### Trinh do cong nghe

- **Diem: 5/10** - Su dung tot cac chuc nang xem bao cao va phe duyet, nhung khong tu thao tac phuc tap (tao don, nhap lieu). Can giao dien truc quan, so lieu noi bat, bieu do de doc. Uu tien mobile-friendly de check nhanh khi di chuyen.

---

## Bang tong hop so sanh

| Tieu chi | SALE | WAREHOUSE_CN_AGENT | ACCOUNTANT_AR | LOGISTICS_MANAGER | CSKH | CEO |
|---|---|---|---|---|---|---|
| **Tuoi** | 26 | 30 | 32 | 38 | 25 | 45 |
| **Trinh do CNTT** | 5/10 | 3/10 | 7/10 | 6/10 | 4/10 | 5/10 |
| **Tan suat dung ERP** | 6-10h/ngay | 8-12h/ngay | 7-9h/ngay | 5-8h/ngay | 8-9h/ngay | 1-2h/ngay |
| **So route truy cap** | 14 | 15 | 16 | 24 | 14 | 55+ (tat ca) |
| **Dashboard type** | sales | warehouse | finance | warehouse* | cskh | executive |
| **Co quyen phe duyet** | Khong | Khong | Khong | Co | Khong | Co (tat ca) |
| **Can mobile** | Trung binh | Cao | Thap | Cao | Thap | Cao |
| **Thao tac chinh** | Tao/cap nhat don | Nhan/kiem/dong kien | Quan ly phieu thu/cong no | Giam sat + phe duyet | Tra cuu + tao khieu nai | Xem bao cao + phe duyet |
| **Pain point lon nhat** | Tao don phuc tap | Nhap lieu nhieu | Khong tu duyet phieu | Qua nhieu module | Quyen han gioi han | Bao cao chua du sau |

> *Luu y: LOGISTICS_MANAGER hien dang su dung dashboard type `warehouse`, nhung nhu cau thuc te la mot dashboard dang `operations` rieng voi goc nhin tong the pipeline.

---

## Goi y thiet ke tu personas

### Uu tien cao (anh huong nhieu nguoi dung)

1. **Mobile-responsive cho WAREHOUSE_CN_AGENT va LOGISTICS_MANAGER:** Hai role nay lam viec nhieu tren hien truong, can giao dien toi uu cho tablet/mobile.
2. **Tao don hang wizard don gian hon cho SALE:** Giam so truong bat buoc, them auto-fill tu don mau (template), luu nhap (draft) tu dong.
3. **Dashboard rieng cho LOGISTICS_MANAGER:** Tach khoi warehouse dashboard, tao operations dashboard voi bird-eye view toan bo pipeline.

### Uu tien trung binh

4. **Mo rong quyen xem cong no cho CSKH:** Cho phep `read` co ban tren AccountReceivable de tra loi khach hang ve tinh hinh thanh toan.
5. **Cai thien OCR accuracy cho WAREHOUSE_CN_AGENT:** Them buoc confirm/sửa nhanh sau khi OCR, hien thi confidence score tung truong.
6. **Auto-alert cho CEO va ACCOUNTANT_AR:** Gui thong bao tu dong khi cong no qua han vuot nguong, doanh thu giam, khieu nai CRITICAL.

### Uu tien thap

7. **Giam sidebar cho CEO:** Nhom cac route thanh favorite/pinned, an bot nhung module it dung.
8. **Tich hop kenh lien lac cho CSKH:** Zalo/email tich hop truc tiep trong ERP, tu dong ghi interaction note.
