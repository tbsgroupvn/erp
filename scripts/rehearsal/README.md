# Diễn tập cutover L0 — nạp dump lõi tiền + dựng CSDL diễn tập

Công cụ CỤC BỘ cho lô L0 của kế hoạch cutover
(`F:\01_TBS_GROUP\docs\rewrite-spec\cutover-so-quy-ke-hoach.md`). Nạp bản dump
prod (đã ẩn một số cột nhạy cảm) vào một MariaDB cục bộ, rồi (Task 2) ETL
sang một CSDL Postgres **diễn tập** riêng, và (Task 3) chạy các cổng nghiệm
thu. **Không phải cutover thật** — không đụng prod ở bất kỳ bước nào (không
SSH, không kết nối trực tiếp).

## An toàn bắt buộc

- ⛔ Dump gốc nằm NGOÀI repo tại `_dump_20260925/` (mặc định
  `F:\01_TBS_GROUP\_dump_20260925`, ghi đè bằng `REHEARSAL_DATABASE_URL`/
  `REHEARSAL_DUMP_DIR` nếu máy khác). KHÔNG bao giờ copy dump hay bất kỳ dòng
  dữ liệu nào vào trong repo; KHÔNG in số tài khoản / nội dung chuyển khoản
  ra log hay báo cáo.
- ⛔ KHÔNG BAO GIỜ ghi vào CSDL test dùng chung `tbs_test`. Mọi script ghi
  CSDL Postgres đích đều gọi `src/rehearsal/target-guard.ts` trước — chốt
  chỉ chấp nhận tên CSDL kết thúc `_rehearsal` và khác `DATABASE_URL` của
  `.env`/`.env.test`. Sai là script tự dừng (`guard-check.ts` exit 1).
- ⛔ Schema Postgres đích luôn dựng bằng `prisma migrate deploy` — không
  `migrate dev` / `migrate reset` / `db push`.
- ⛔ Không SSH prod, không kết nối MariaDB prod. Nguồn dữ liệu duy nhất là
  MariaDB cục bộ nạp từ dump tĩnh.

## Hạ tầng dùng

| | Container | Image | Cổng host | Ghi chú |
|---|---|---|---|---|
| Nguồn (MariaDB) | `tbs-mariadb-rehearsal` | `mariadb:10.11` | `3307` | Riêng, không đụng cổng 3306 mặc định. `sql_mode`/charset/collation set khớp prod đo 25/09/2026. |
| Đích (Postgres) | `tbs-pg-test` (đã có sẵn) | `postgres:16` | `5433` | **Chỉ** `CREATE DATABASE tbs_rehearsal` trong container này — không đổi/xoá gì khác, đặc biệt không đụng CSDL `tbs_test`. |

Chọn dùng chung container `tbs-pg-test` (thay vì dựng container Postgres
riêng) vì container này đã chạy sẵn cho test suite — tạo thêm một CSDL trong
cùng instance không cần cổng/container mới. Vẫn cách ly hoàn toàn ở mức CSDL
nhờ `target-guard`.

## Thứ tự chạy

```bash
# 1) Khởi MariaDB diễn tập cục bộ
bash scripts/rehearsal/start-mariadb.sh

# 2) Nạp 4 tệp dump (thứ tự cố định trong script) + kiểm số dòng
bash scripts/rehearsal/load-dump.sh

# 3) Tạo CSDL Postgres diễn tập + prisma migrate deploy (qua target-guard)
bash scripts/rehearsal/setup-pg-rehearsal.sh
```

Thứ tự nạp dump (`load-dump.sh`, bắt buộc — 2 tệp `*_nosecret` chỉ có
`INSERT`, không có `CREATE TABLE`):

1. `core_money.sql.gz` — tự chứa `CREATE TABLE` + `INSERT` cho 45 bảng lõi
   tiền (ví, sổ quỹ, bank, FX, thanh toán, duyệt, GL, ARAP, PO liên quan...).
2. `schema_accounts_customer.sql.gz` — `CREATE TABLE tbl_accounts`,
   `tbl_customer`.
3. `tbl_accounts_nosecret.sql.gz` — `INSERT` (một số cột nhạy cảm đã lược).
4. `tbl_customer_nosecret.sql.gz` — `INSERT` (một số cột nhạy cảm đã lược).

`load-dump.sh` in ra bảng `table / expected / actual / OK` cho 10 bảng liệt
kê trong `rowcounts_at_dump.tsv` — không in dữ liệu dòng.

## Biến môi trường có thể ghi đè

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `REHEARSAL_DUMP_DIR` | `/f/01_TBS_GROUP/_dump_20260925` | Thư mục chứa 4 tệp dump + `rowcounts_at_dump.tsv` (đường dẫn kiểu Git Bash). |
| `REHEARSAL_DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/tbs_rehearsal?schema=public` | URL Postgres đích diễn tập — luôn phải qua `target-guard`. |

## target-guard

`src/rehearsal/target-guard.ts` là hàm THUẦN (`assertRehearsalTarget`,
`extractDatabaseName`) — không tự đọc file, nơi gọi truyền URL đích + danh
sách URL cấm (đọc từ `.env`/`.env.test`). `scripts/rehearsal/guard-check.ts`
là lớp mỏng dòng lệnh bọc quanh nó, dùng bởi `setup-pg-rehearsal.sh` và
(Task 2/3) mọi script ETL/cổng trước khi mở kết nối ghi.

Test: `test/rehearsal/target-guard.spec.ts`
(`npx dotenv -e .env.test -- npx jest test/rehearsal/target-guard.spec.ts`).

## Thư viện thêm

- `ts-node` (devDependency) — chạy trực tiếp các script TypeScript trong
  `scripts/rehearsal/*.ts` (`guard-check.ts`, và Task 2/3
  `etl.ts`/`gates.ts`) mà không cần bước build riêng.
- (Task 2 sẽ thêm `mysql2` làm devDependency để đọc MariaDB diễn tập từ
  Node — chưa cần cho Task 1 vì `load-dump.sh` chỉ dùng client `mariadb` CLI
  qua `docker exec`.)

## Kết quả diễn tập (báo cáo, số tiền thật)

Mọi báo cáo có số liệu thật từ dump (Task 3) ghi ra thư mục NGOÀI repo, mặc
định `REHEARSAL_OUT_DIR` = `<REHEARSAL_DUMP_DIR>/rehearsal-out`. Không có gì
ở đây được commit vào repo.

## ETL lõi tiền (Task 2)

```bash
# 4) ETL 17 bảng (09b → 09c → 09a → 04b) vào tbs_rehearsal — chạy lại được
npx ts-node scripts/rehearsal/etl.ts
```

- `runEtl()` (`src/rehearsal/etl/runner.ts`) gọi `assertRehearsalTarget()` TRƯỚC khi mở
  kết nối (URL cấm = `DATABASE_URL` của `.env`/`.env.test`/môi trường, gom bởi
  `src/rehearsal/forbidden-urls.ts`), kiểm lại `current_database()`, rồi `TRUNCATE … RESTART
  IDENTITY` đúng 17 bảng đích, nạp id tường minh theo §5, `setval` sau cùng.
- `setval` (L13 fix round 1): `GREATEST(PG MAX(id), MySQL MAX(id) KỂ CẢ dòng ETL đã loại, MySQL
  AUTO_INCREMENT − 1) + 1` — sàn phía nguồn đọc trên MariaDB (`information_schema.TABLES`,
  `src/rehearsal/etl/seq-floor.ts`). Công thức cũ `MAX(id đã nạp)+1` để v2 cấp lại id mà MySQL còn
  giữ (dòng đỉnh bị loại / id đã cấp rồi xoá) ⇒ chép ngược R1 trùng khoá. Cổng `09x-6-setval` kiểm
  công thức mới (cần giá trị phía nguồn).
- Mỗi bảng một bộ ánh xạ THUẦN (`src/rehearsal/etl/{treasury,fx-bank,supplier-payment,return-state}.ts`);
  tiền/bigint đọc dạng CHUỖI (`mysql2` `bigNumberStrings`/`decimalNumbers:false`) → `Prisma.Decimal`/`BigInt`.
- Báo cáo (chỉ số đếm) ra `REHEARSAL_OUT_DIR` (mặc định `F:\01_TBS_GROUP\_dump_20260925\rehearsal-out\etl-<thời điểm>.json/.md`);
  runner từ chối thư mục nằm trong repo.
- Biến thêm: `REHEARSAL_MARIADB_HOST` (127.0.0.1), `REHEARSAL_MARIADB_PORT` (3307), `REHEARSAL_MARIADB_PASSWORD`.
- Thư viện: `mysql2` (devDependency) — chỉ dùng trong `scripts/rehearsal/etl.ts`.
- **Mã thoát ETL:** `0` nạp sạch · `1` lỗi · `2` DỪNG trước khi TRUNCATE vì bất thường tài liệu ghi "≥1 ⇒ DỪNG" (09a A8/A9, 09c §2.2 …) — CSDL đích giữ nguyên · `3` đã nạp NHỜ cờ `--allow-stop-anomalies` (báo cáo ghi cờ + luật đã kích). Dump 25/09 15:41 có A8/A9 = 1 (phiếu #51529) ⇒ diễn tập phải chạy `npx ts-node scripts/rehearsal/etl.ts --allow-stop-anomalies` và nhận mã 3; cutover THẬT không được dùng cờ này.
- ⚠ Nguồn MariaDB mặc định là container cục bộ `tbs-mariadb-rehearsal` (127.0.0.1:3307); công cụ KHÔNG tự kiểm điều đó (review cuối M5) — đừng trỏ `REHEARSAL_MARIADB_HOST` vào máy khác.

## Cổng nghiệm thu (Task 3)

```bash
# 5) chạy MỌI cổng nguồn/đích/số vàng — CHỈ ĐỌC cả hai phía
npx ts-node scripts/rehearsal/gates.ts   # exit 0 PASS · 4 có FAIL · 1 lỗi/ERROR
```

- ⚠ **Đọc PASS cho đúng (review cuối L0):** các số vàng `09d-e/f/g/h` chạy CÙNG thuật toán ở hai phía ⇒ chỉ chứng minh ĐỌC dữ liệu + ETL đúng, không chứng minh thuật toán; `09d-b/c/d` chỉ phủ VND vì `tbl_exchange_rates` rỗng; `09a-7.1*`, `09a-7.3`, `04b-10.1*` loại ở nguồn đúng các dòng ETL bỏ ⇒ chứng minh ETL áp luật, không chứng minh luật đúng. Danh sách đủ trong `final-review.md` của đợt L0.

- Sổ cổng `src/rehearsal/gates/registry.ts`: nguồn §7 (09b/09c/09a/04b "sai là DỪNG"), đích mức cột
  §8 (số dư từng ví, tổng theo nhóm, sentinel, tham chiếu chéo, setval), G-DOC-1..3, số vàng 09d §9 (a)–(i).
  Mỗi cổng = câu nguồn/đích (hoặc lời gọi service ĐỌC v2) + hàm so sánh THUẦN (`compare.ts`).
- `runGates()` gọi `assertRehearsalTarget()` TRƯỚC khi mở kết nối, kiểm `current_database()`, và đòi
  phiên read-only hai phía (PG `default_transaction_read_only=on` qua URL `options`; MariaDB
  `SET SESSION TRANSACTION READ ONLY`). Adapter từ chối câu không phải SELECT/SHOW.
- Số vàng: NGUỒN = công thức prod (SQL prod trên MariaDB + hàm thuần v2 đã port), ĐÍCH = service v2
  (`TreasuryReportService`, `TreasuryService`, `PoTienNccService`, `BankReconService`) trên PrismaClient
  diễn tập; cổng quyền của service thay bằng stub TRONG tiến trình (đích chưa có user/vai #01).
- Báo cáo `gates-<thời điểm>.json/.md` ra `REHEARSAL_OUT_DIR` — chỉ số đếm/tổng (`assertCountsOnly`).

## Chép ngược L13 (PG v2 → MySQL) — `copyback.ts`

Điều kiện của điểm quay lui R1 (cutover §3.7): chép các dòng MỚI của 17 bảng
lõi tiền từ Postgres v2 về MySQL, ánh xạ NGƯỢC đúng luật cột, nâng
`AUTO_INCREMENT`.

```bash
npx ts-node scripts/rehearsal/copyback.ts --dry-run   # chỉ phân loại + báo cáo, rollback
npx ts-node scripts/rehearsal/copyback.ts             # chép thật (MỘT transaction)
# lần chạy thứ 2 trở đi: truyền báo cáo ETL để dòng v2 đã chép trước không bị báo lại
npx ts-node scripts/rehearsal/copyback.ts --etl-report=<rehearsal-out/etl-*.json>
```

- ⛔ **Đích bị khoá vào MariaDB diễn tập cục bộ** (`src/rehearsal/copyback/mysql-target-guard.ts`):
  trước khi kết nối — host phải là `127.0.0.1`/`localhost`, cổng ĐÚNG `3307`,
  CSDL `sql_nhpcn` (IP/tên miền prod bị gọi tên và từ chối); sau khi kết nối,
  trước mọi ghi — `SELECT @@hostname` phải BẰNG hostname của container
  `tbs-mariadb-rehearsal` đọc bằng `docker inspect` (id docker 12 hex), cổng
  3306/tcp của container phải ánh xạ ra host 3307, máy chủ phải là MariaDB 10.11
  với `STRICT_TRANS_TABLES`. Tên CSDL prod cũng là `sql_nhpcn` nên lớp kiểm
  hostname mới là lớp phân biệt (chặn cả đường hầm SSH 127.0.0.1:3307 → máy
  khác). **Không có cờ/biến môi trường nào mở chốt** — chép vào prod thật là
  quyết định Q-CUT-5.
- Nguồn PG qua `assertRehearsalTarget` (cấm `tbs_test`), đọc mọi cột bằng
  `::text` ⇒ tiền/bigint không qua số JS.
- Ngữ cảnh chiều xuôi dựng THẬT như ETL (id phiếu/bước duyệt đọc ở MySQL, id đã nạp/đã loại
  của các bảng cha) để phân biệt "ETL đã loại" với "v2 xoá".
- Mốc từng bảng = `MAX(id)` MySQL lúc chạy. Phân loại:
  - PG `id > mốc` ⇒ chép.
  - PG `id ≤ mốc` mà MySQL KHÔNG có id đó ("lỗ") ⇒ **VẪN chép** (không mất dòng v2) nhưng
    **mã thoát 5 + liệt kê id**. ⚠ Đây là **lệch câu chữ kế hoạch L13** ("chỉ chép id > mốc")
    — quyết định controller (fix round 1). Với công thức `setval` mới, lỗ chỉ còn xuất hiện nếu
    bộ đếm PG bị đặt sai.
  - PG `id ≤ mốc` mà MySQL CÓ ⇒ so ở **MỨC PG** với `ảnhPG(xuôi(dòng MySQL))` (độ chính xác
    PG: v2 sửa `rate` 3500.50 → 3500.501 vẫn bị bắt) ⇒ khác ⇒ BÁO tên cột theo từng id, KHÔNG
    ghi đè. Dòng id ≥ `setval` của báo cáo ETL (`--etl-report`) là dòng v2 tạo đã chép trước ⇒
    so ở mức MySQL (phần làm tròn khi chép không bị báo lại). Không có `--etl-report` ⇒ dòng như
    vậy bị báo "khác dưới độ chính xác MySQL".
  - MySQL `id ≤ mốc` vắng ở PG: chiều xuôi LOẠI dòng đó ⇒ bình thường; KHÔNG loại ⇒ **v2 xoá
    cứng** ⇒ BÁO id, mã thoát 5, KHÔNG xoá ở MySQL.
- **Khoá UNIQUE** (đọc từ `information_schema.STATISTICS`, `NON_UNIQUE=0`, trừ `PRIMARY`): mọi
  dòng sắp chép được kiểm TRƯỚC khi ghi — với MySQL (collation thật) và giữa các dòng trong lô
  (xấp xỉ không phân biệt hoa/thường + PAD SPACE) ⇒ trùng ⇒ **HUỶ cả lần chạy trước mọi ghi**,
  báo bảng + id + tên khoá, mã thoát 5 (thông điệp khác lỗi exit 1).
- Một transaction MySQL; lỗi ⇒ rollback toàn bộ (exit 1). `ALTER TABLE … AUTO_INCREMENT` chạy
  SAU commit (DDL tự commit), chỉ NÂNG lên `MAX(id)+1`. ALTER hỏng ⇒ dữ liệu ĐÃ commit ⇒ báo
  cáo ghi outcome `ai_raise_failed` "committed; AUTO_INCREMENT raise failed on <bảng>", **mã
  thoát 5** (không phải 1 — 1 nghĩa là đã rollback). Xử lý: chạy tay `ALTER TABLE <bảng>
  AUTO_INCREMENT = MAX(id)+1` rồi chạy lại công cụ (0 dòng mới).
- Mã thoát: `0` sạch · `1` lỗi (đã rollback) · `5` cần người xem: dòng ≤ mốc khác / lỗ / v2 xoá
  cứng / đổi giá trị do ép kiểu (vd `rate` 6→2 số lẻ) — phần mới VẪN chép; hoặc trùng khoá
  UNIQUE (không ghi gì); hoặc ALTER AUTO_INCREMENT hỏng sau commit.
- `PaymentSource.created_at`: v2 hiện **không có đường ghi** bảng này. Nếu thêm, phải ghi **giờ
  đồng hồ VN** (lưu như UTC) đúng quy ước chiều xuôi (`src/rehearsal/etl/convert.ts`
  `optDateTime`) — ghi `now()` UTC sẽ lệch 7 giờ khi chép ngược. Báo cáo cũng ghi chú điều này.
- Báo cáo `copyback-<thời điểm>.{json,md}` ra `REHEARSAL_OUT_DIR` (ngoài repo):
  chỉ số đếm + id kỹ thuật + tên cột/khoá, không giá trị dòng.
- Test: `test/rehearsal/copyback-mappers.spec.ts` (khứ hồi thuần từng bảng +
  phần mất có chủ đích), `copyback-runner.spec.ts` (đồ giả), `mysql-target-guard.spec.ts`,
  `copyback-live.spec.ts` (chỉ chạy khi `REHEARSAL_LIVE=1`, dry-run trên hạ tầng diễn tập).
- **`--etl-report` phải khớp (L13 Task 2, N1):** báo cáo phải có `targetDatabase` + `setval` đủ 17 bảng
  (thiếu ⇒ từ chối); `targetDatabase` phải BẰNG `current_database()` PG; và `setval` từng bảng phải ≥ sàn
  nguồn HIỆN TẠI = `GREATEST(MySQL MAX(id), AUTO_INCREMENT−1)+1` đọc lúc chạy, không tính phần do chính
  lần chép trước đẩy lên (dòng id ≥ setval có ở PG VÀ bằng ảnh ngược của dòng PG ở mức MySQL — cùng id mà khác ⇒ exit 1 "va chạm id"); chưa có dòng v2 nào ở MySQL ⇒ setval phải BẰNG sàn. Sai ⇒ exit 1, rollback, thông điệp nêu bảng +
  `v2Start` + sàn — nghĩa là báo cáo ETL cũ / của lần nạp khác, hoặc MySQL có dòng mới sau ETL. Dùng ĐÚNG
  báo cáo ETL của lần cutover. ⛔ **Quay lui R1 thật: KHÔNG chạy lại ETL** — ETL `TRUNCATE` PG ⇒ xoá sạch dữ
  liệu v2 sau cutover mà R1 cần chép về; kiểm lẻ bằng `--dry-run`. (Chỉ trên hạ tầng diễn tập mới được nạp
  lại dump + ETL.) Test: `copyback-etl-report.spec.ts` + khối N1 trong `copyback-runner.spec.ts`.

## Tổng duyệt khứ hồi L13 — `roundtrip.ts`

```bash
npx ts-node scripts/rehearsal/roundtrip.ts   # exit 0 PASS · 4 có kiểm FAIL · 1 lỗi
```

⚠ **Phá huỷ — chỉ trên hạ tầng diễn tập cục bộ.** Trình tự: chốt PG (`assertRehearsalTarget`, cấm
`tbs_test`) + chốt MySQL tĩnh (127.0.0.1:3307/sql_nhpcn) → mở MySQL, `@@hostname` == container
`tbs-mariadb-rehearsal` (docker inspect) → CHỈ SAU ĐÓ mới `load-dump.sh` (nạp lại 4 tệp dump; dump có sẵn
`DROP TABLE IF EXISTS`) → `etl.ts --allow-stop-anomalies` (nhận mã 0/3) → mốc MySQL (id + băm SHA-256 mọi
cột của dòng ≤ MAX) → **giả lập ghi v2 bằng service THẬT** (`src/rehearsal/roundtrip/simulate.ts`) → chép
ngược lần 1 và lần 2 (cả hai với `--etl-report` của lần ETL vừa chạy) → kiểm. Không bao giờ đụng `tbs_test`.

Giả lập (dữ liệu tự dựng tiền tố `RTL13`/`rtl13_`, không lấy từ prod; cổng quyền/danh tính stub trong
tiến trình như `gates`; GL stub vì #03 chưa nạp):

| bước | service v2 | ghi gì |
|---|---|---|
| S1 | `TreasuryService.postEntry` | 2 bút toán status=1 + 1 treo |
| S2 | `TreasuryService.daoTheoNguon` | đảo bút toán chi |
| S3 | fixture Prisma phiếu FX + `TreasuryService.fxGhiSoPhieu` | 2 chân sổ, `rate` 6 số lẻ (⇒ ép 6→2 khi chép) |
| S4 | `BankIngestService.ingest` | 2 giao dịch SePay tự dựng (vào nội bộ ⇒ sổ + chi tiết; ra ⇒ chi tiết) |
| S5 | fixture Prisma phiếu NCC + `SupplierPaymentService.returnDoc/resubmitDoc` + `TreasuryService.postPaymentEntry` | phiếu mới, trạng thái trả/nộp lại, nhật ký, bút toán chi |
| S6 | `SupplierPaymentService.returnDoc/resubmitDoc` trên phiếu CÓ SẴN | **sửa dòng trước cutover** (`tbl_payment`: `mdate`, `ncc_bank_note`) |
| S7 | `SupplierPaymentService.delete` trên phiếu CÓ SẴN chưa duyệt, ĐÃ có `tbl_return_state` từ trước | **xoá cứng dòng trước cutover** (+ cascade `tbl_payment_orders` + dọn `tbl_return_state` — cả ba phải được báo xoá) |

v2 CHƯA có service tạo phiếu FX / tạo phiếu NCC / duyệt phiếu NCC ⇒ hai phiếu gốc là fixture Prisma (ghi rõ
trong báo cáo `gaps`); không có câu SQL tay nào ghi dữ liệu.

Kiểm (mỗi kiểm PASS/FAIL trong `roundtrip-<t>.{json,md}`, dòng cuối console `VERDICT: …`):

| id | nội dung |
|---|---|
| `R-mo-phong` | mọi bước giả lập chạy ra đúng kết quả mong đợi |
| `R-co-lan-1` | chép lần 1 BÁO đúng mọi cờ kỳ vọng (id + tên cột sửa, id xoá, id ép kiểu), không cờ thừa — **exit 5 ở đây là CÓ CHỦ ĐÍCH**; công cụ im lặng = FAIL |
| `R-dong-moi` | mỗi dòng MySQL mới == ngược(dòng PG) từng cột; xuôi(dòng MySQL) khác PG chỉ ở phần mất có chủ đích (`rate`, `created_at`); không thiếu/thừa dòng |
| `R-dong-cu-lan-1` | băm dòng ≤ mốc trước/sau chép lần 1 bằng nhau |
| `R-ai-lan-1`, `R-ai-lan-2` | `AUTO_INCREMENT` > `MAX(id)` ở 17 bảng |
| `R-so-du` | số dư từng quỹ theo CÔNG THỨC PROD (`getBalances`: opening + Σmoney status=1 theo tk_code) trên MariaDB == `TreasuryService.getBalances()` trên PG. ⚠ Chỉ phủ tiền đi qua dòng sổ MỚI: không service v2 nào sửa dòng sổ cũ hay `opening_balance` (đảo = ghi dòng mới), nên trường hợp đó KHÔNG được giả lập |
| `R-lan-2` | chép lần 2: 0 dòng mới/lỗ/ép kiểu/trùng khoá; chỉ còn đúng cờ sửa/xoá dòng cũ |
| `R-dong-cu-lan-2` | sau lần 2, dòng ≤ mốc VÀ dòng đã chép ở lần 1 không đổi |

Test: `test/rehearsal/roundtrip-checks.spec.ts` (hàm kiểm thuần), `roundtrip-runner.spec.ts` (đồ giả: chốt
chạy trước khi nạp lại, thứ tự pha, FAIL trung thực, chốt CSDL của giả lập).

⚠ **`roundtrip.ts` KHÔNG tự khôi phục.** Sau khứ hồi (hoặc bất kỳ lần `copyback.ts` có GHI) MariaDB diễn tập
còn dòng đã chép về và `tbs_rehearsal` còn dòng giả lập ⇒ `gates.ts` và `copyback-live.spec.ts` sẽ lệch. Trước
khi chạy chúng, đưa hạ tầng về trạng thái L0:

```bash
bash scripts/rehearsal/load-dump.sh
npx ts-node scripts/rehearsal/etl.ts --allow-stop-anomalies   # mã 3 là bình thường với dump 25/09
```

## Quay lui R1 — xử lý dòng bị gắn cờ

Công cụ chép ngược **không bao giờ tự sửa hay xoá dòng cũ ở MySQL**. Mọi mục nó gắn cờ (mã thoát 5) phải
có người xử lý tay trên MySQL đích, theo đúng mục trong báo cáo `copyback-<t>.md` (bản đủ id ở `.json`,
`tables[]`). Nguyên tắc chung cho MỌI loại:

1. Sao lưu trước khi đụng: `mysqldump` đúng bảng liên quan (kiểm tệp sao lưu có dữ liệu thật, không phải
   vài chục byte), hoặc chép dòng vào bảng `*_bak_YYYYMMDD`.
2. Mỗi thay đổi tay là một transaction; kiểm `affected rows` đúng số dòng mong đợi rồi mới `COMMIT`.
3. Ghi biên bản: loại cờ, bảng, id, cột, quyết định (sửa / xoá / giữ), người quyết, lúc nào.
4. **Xử lý XONG mọi cờ TRƯỚC khi PHP ghi lại** (trước khi trỏ SePay/luồng ghi về PHP, cutover §3.7). Công cụ
   chỉ chạy lại được (`copyback.ts --etl-report=<etl-*.json của lần ETL cutover>`, hoặc `--dry-run` để kiểm
   lẻ) chừng nào MySQL CHƯA có dòng id ≥ setval nào vắng ở PG. Hai việc làm mất khả năng đó: (i) chèn tay một
   dòng với id mới = `AUTO_INCREMENT` (thủ tục "xung đột"/"va chạm id"/"trùng trong lô" dưới), (ii) PHP ghi
   dòng mới. Sau đó MỌI lần chạy đều exit 1 (N1) — **không** cố chạy lại, **không** chạy lại ETL; kiểm các mục
   còn lại bằng tay theo mục "Kiểm tay khi công cụ không chạy lại được". Vì vậy: làm các việc chỉ UPDATE/DELETE
   trước, chạy lại xác nhận, rồi mới làm các việc chèn tay, cuối cùng mới mở PHP.
5. Không "làm cho hết cờ" bằng cách sửa/xoá dòng ở PG v2 cho hai bên giống nhau — PG là bằng chứng của
   những gì v2 đã làm (ngoại lệ duy nhất: trùng khoá UNIQUE trong lô, xem dưới).

### "dòng ≤ mốc KHÁC (không chép, không ghi đè)" — theo lý do

Báo cáo liệt kê `id <n>: <cột MySQL>, …` (JSON: `modifiedDetails`) và đếm theo lý do (`modifiedReasons`).

- **`v2 sửa dòng lịch sử`** — một thao tác nghiệp vụ v2 đã sửa dòng có từ trước cutover (vd nộp lại phiếu
  NCC ⇒ `tbl_payment` `mdate`, `ncc_bank_note`). Xử lý:
  1. đọc giá trị PG hiện tại của ĐÚNG các cột được báo (`SELECT "<cột>"::text FROM <bảng> WHERE id = <n>`)
     và giá trị MySQL cùng id;
  2. xác nhận thay đổi hợp lệ bằng vết nghiệp vụ v2 đã chép về (dòng MỚI): vd `tbl_payment_log`
     `doc_return`/`doc_resubmit` và `tbl_return_state` của phiếu đó (ai làm, lúc nào);
  3. hợp lệ ⇒ `UPDATE <bảng> SET <đúng các cột báo> … WHERE id = <n>` trên MySQL, đổi kiểu theo luật ngược
     ở mục "Chép ngược L13" (tên cột MySQL, số lẻ theo MySQL, NULL giữ NULL, sentinel 0/'' như cũ);
     không hợp lệ ⇒ giữ MySQL, ghi biên bản;
  4. chạy lại ⇒ id hết bị báo. Riêng cột MySQL ít số lẻ hơn PG (`rate`): phần lẻ không biểu diễn được vẫn
     bị báo — ghi biên bản chấp nhận.
- **`v2 sửa dòng đã chép ngược trước`** — từ fix round 1 của Task 2, trường hợp này KHÔNG còn ra cờ mà ra
  **exit 1 "va chạm id / báo cáo ETL cũ — <bảng> id <n>"** (xem mục "Mã thoát 1" dưới): dòng id ≥ setval có ở
  cả hai phía mà khác nội dung không phân biệt được với va chạm id.
- **`khác dưới độ chính xác MySQL …`** — gần như luôn do chạy THIẾU `--etl-report` (dòng v2 đã chép có làm
  tròn bị so lại ở mức PG). Chạy lại với cờ. Còn báo ⇒ v2 sửa phần lẻ không biểu diễn được ⇒ biên bản.
- **`xung đột: xuôi đã loại dòng MySQL cùng id`** — v2 cấp đúng id của một dòng MySQL mà ETL đã LOẠI (rác
  ZZ, A2/A4/A5): dòng v2 **không về được** MySQL. Với `setval` = `GREATEST(…)+1` (fix round 1) việc này không
  được xảy ra — xảy ra ⇒ trước hết kiểm cổng `09x-6-setval` của lần ETL. Xử lý: xác minh dòng MySQL cùng id
  đúng là dòng bị loại (lý do trong báo cáo ETL `skipped`); rồi hoặc (a) chép dòng rác MySQL ra bảng sao lưu,
  xoá nó, chạy lại (dòng v2 thành "lỗ" ⇒ được chép), hoặc (b) chèn tay dòng v2 với id mới = `AUTO_INCREMENT`
  hiện tại VÀ sửa mọi tham chiếu tới id cũ (vd `tbl_payment_orders.payment_id`, `tbl_payment_log.payment_id`,
  `tbl_return_state.object_id`). Ghi biên bản lựa chọn (a)/(b).
  ⚠ Lựa chọn (b) là chèn tay ⇒ từ đây công cụ không chạy lại được (nguyên tắc 4).
- **`ảnh kỳ vọng lỗi …`** — dòng MySQL không qua được chiều xuôi (bị ghi sau ETL, vi phạm luật cột). Không tự
  sửa: điều tra ai ghi MySQL sau mốc cutover; báo kỹ thuật.

### "v2 XOÁ CỨNG (còn ở MySQL, KHÔNG xoá)"

Báo cáo liệt kê `id` theo bảng (JSON: `deletedIds`) — dòng có trước cutover mà v2 đã xoá cứng (vd
`SupplierPaymentService.delete` xoá phiếu chưa duyệt; `tbl_payment_orders` đi theo cascade; `tbl_return_state`
được dọn). Xử lý:

1. xác nhận việc xoá bằng vết v2 đã chép về: `tbl_payment_log` `action='delete'`, `payment_id=<id>`
   (`old_data` = ảnh 8 cột lúc xoá, `created_by`, `cdate`);
2. hợp lệ ⇒ sao lưu rồi `DELETE` đúng các id được báo ở MySQL — **từng bảng** (MySQL prod không có FK: xoá
   phiếu cha không tự xoá `tbl_payment_orders` / `tbl_return_state`; báo cáo đã liệt kê đủ id từng bảng).
   Không rõ ⇒ giữ, ghi biên bản (MySQL giữ dòng thì sổ/màn hình PHP vẫn thấy phiếu);
3. chạy lại ⇒ id biến mất khỏi danh sách.

### "dòng LỖ (≤ mốc, MySQL không có) — ĐÃ chép"

Dòng v2 đã về MySQL (không mất dữ liệu). Lỗ nghĩa là bộ đếm PG đã cấp id ≤ `MAX(id)` MySQL ⇒ kiểm lại
`setval` của lần ETL (cổng `09x-6-setval`) và xác nhận `AUTO_INCREMENT` MySQL sau chép > `MAX(id)` (báo cáo cột
"AI trước → sau"). Ghi biên bản id; không sửa dữ liệu.

### "đổi giá trị do ép kiểu — cột: … · id: …"

Dòng mới ĐÃ chép với giá trị làm tròn/cắt theo kiểu MySQL. Chỉ chấp nhận khi cột thuộc phần mất có chủ đích:
`tbl_account_histories.rate` (6 → 2 số lẻ, nửa-xa-0 — không ảnh hưởng `money`/số dư) và
`tbl_payment_source.created_at` (cắt giây lẻ). Cột khác ⇒ dừng, báo kỹ thuật (mapper ngược sai). Ghi biên bản
số dòng. Các lần chạy sau phải có `--etl-report` để các dòng này không bị báo lại.

### "⛔ Trùng khoá UNIQUE — đã HUỶ trước mọi ghi"

Lần chạy đó KHÔNG ghi gì (mọi dòng mới khác cũng CHƯA về). Báo cáo liệt kê `<bảng> id <n> — khoá <tên>` và
trùng với ai:

- **`trùng dòng MySQL`** — MySQL đã có dòng mang cùng giá trị khoá (vd `tbl_fx_transfers.code`,
  `tbl_return_state` `(object_type, object_id)`, `tbl_payment_orders` `(payment_id, order_id)`) — thường do cùng
  một đối tượng được ghi ở cả hai phía sau mốc cutover. So hai dòng, quyết dòng nào đúng; sửa/gộp tay phía
  MySQL (sao lưu trước); chạy lại. Công cụ chỉ ghi khi hết trùng.
- **`trùng dòng mới khác trong lô`** — hai dòng v2 khác nhau ở PG nhưng MySQL coi là trùng (collation `_ci`:
  hoa/thường, khoảng trắng cuối). Công cụ không có đường vòng: còn trùng là còn huỷ cả lần chạy. Quyết giá trị
  khoá đúng cho từng dòng, ghi biên bản giá trị gốc ở PG, rồi chỉnh khoá của MỘT dòng ở PG (v2 đã đóng băng
  khi quay lui) cho khác nhau theo collation MySQL — ngoại lệ DUY NHẤT của nguyên tắc 5 — và chạy lại (không
  chèn tay, nên vẫn chạy lại được).

### `ai_raise_failed` (committed; AUTO_INCREMENT raise failed on <bảng>)

Dữ liệu đã commit. Chạy tay `ALTER TABLE <bảng> AUTO_INCREMENT = MAX(id)+1` rồi chạy lại công cụ (0 dòng mới).

### Mã thoát 1

Đã rollback, không ghi gì. Đọc thông điệp (không chứa giá trị dòng): chốt đích, `--etl-report` không khớp
(N1), mapper ngược nổ, cảnh báo MySQL… Sửa nguyên nhân rồi chạy lại công cụ (⛔ ở R1 thật KHÔNG chạy lại ETL).

Riêng **"va chạm id / báo cáo ETL cũ — <bảng> id <n>"**: dòng id ≥ setval của báo cáo ETL có ở CẢ MySQL lẫn
PG nhưng KHÁC nội dung. Hai khả năng, phân biệt bằng vết nghiệp vụ (nhật ký PHP phía MySQL / nhật ký v2):
(a) **va chạm** — MySQL (PHP) tự ghi dòng id đó SAU mốc ETL, v2 cấp lại đúng id: dòng v2 không về được. Giữ
dòng MySQL; chèn tay dòng v2 với id mới = `AUTO_INCREMENT` hiện tại và sửa mọi tham chiếu tới id cũ (như mục
"xung đột" ở trên); ghi biên bản — và kiểm vì sao MySQL còn ghi sau cutover. (b) **v2 sửa dòng đã chép** — dòng
do v2 tạo, đã về MySQL lần trước, rồi v2 sửa tiếp: sao lưu rồi `UPDATE` dòng MySQL thành ảnh ngược của dòng PG
hiện tại (luật ngược mục "Chép ngược L13"). Chạy lại. Còn `v2Start ≠ sàn nguồn hiện tại` khi chưa có dòng v2
nào ở MySQL ⇒ báo cáo ETL không phải của lần nạp này — dùng đúng báo cáo (⛔ KHÔNG chạy lại ETL ở R1 thật).
⚠ Cách (a) là chèn tay ⇒ sau đó công cụ không chạy lại được (nguyên tắc 4); cách (b) chỉ UPDATE ⇒ chạy lại được.

### Kiểm tay khi công cụ không chạy lại được

Dùng các câu dưới (thay `<bảng>`, `<id…>`, `<v2Start>` = setval của bảng trong báo cáo ETL cutover); đối chiếu
số/giá trị hai phía trong phiên làm việc, KHÔNG chép giá trị vào tài liệu/biên bản ngoài id + kết luận khớp/lệch.

- Cờ sửa dòng cũ đã xử lý — cột báo hai phía khớp:
  MySQL `SELECT id, <cột báo> FROM <bảng> WHERE id IN (<id…>)` ↔ PG `SELECT id, "<cột>"::text FROM <bảng> WHERE id IN (<id…>)`.
- Cờ xoá cứng đã xử lý — MySQL không còn dòng: `SELECT COUNT(*) FROM <bảng> WHERE id IN (<id…>)` = 0
  (từng bảng: `tbl_payment`, `tbl_payment_orders`, `tbl_return_state` …).
- Dòng v2 đã về đủ — MySQL `SELECT COUNT(*) FROM <bảng> WHERE id >= <v2Start>` = PG
  `SELECT COUNT(*) FROM <bảng> WHERE id >= <v2Start>` + số dòng đã chèn tay với id mới (biên bản) + số dòng
  PHP đã ghi (nếu PHP đã mở).
- Dòng chèn tay với id mới — từng dòng: MySQL `SELECT <mọi cột> FROM <bảng> WHERE id = <id mới>` ↔ PG dòng id
  cũ; và không còn tham chiếu tới id cũ: `SELECT COUNT(*) FROM tbl_payment_orders WHERE payment_id = <id cũ>`,
  `… tbl_payment_log WHERE payment_id = <id cũ>`, `… tbl_return_state WHERE object_type='payment' AND object_id = <id cũ>`.
- Bộ đếm: `SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND
  TABLE_NAME = '<bảng>'` > `SELECT MAX(id) FROM <bảng>`.
- Số dư quỹ (công thức prod): `SELECT code, opening_balance FROM tbl_accounts` +
  `SELECT tk_code, SUM(money) FROM tbl_account_histories WHERE status=1 GROUP BY tk_code` ↔ PG cùng hai câu
  (hoặc `TreasuryService.getBalances()`).
