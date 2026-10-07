import { prisma } from '../helpers/db';
import {
  resetCustoms,
  seedCustomsDeclaration,
  seedImportGoods,
  seedHsTariff,
  seedCustomsUnitRule,
} from '../helpers/customs-db';

describe('customs schema (#08 hải quan, Task 1)', () => {
  beforeEach(async () => {
    await resetCustoms();
    // TransportFileItem không TRUNCATE ở đây (thuộc #07) — nhưng #08 chỉ
    // THÊM cột vào bảng đó, không sở hữu vòng đời của nó. Dọn riêng để các
    // ca test dưới không cộng dồn giữa các lần chạy.
    await prisma.$executeRawUnsafe(
      `TRUNCATE tbl_transport_file_items, tbl_transport_files RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Đo prod 23/09/2026: channel='' TRÊN TOÀN BỘ 248 dòng — luồng xanh/vàng/đỏ
  // chưa từng chạy thật. Cột enum('','green','yellow','red') của MySQL không
  // thể có tên thành viên rỗng trong Prisma ⇒ đặt tên KHONG, @map("") xuống
  // đúng giá trị cột thật. Phải round-trip cả 4 giá trị, kể cả giá trị rỗng
  // (giá trị PHỔ BIẾN NHẤT trên prod, không phải trường hợp biên).
  it('⚠ CustomsDeclaration.channel round-trip đủ 4 giá trị, kể cả rỗng (KHONG↔"")', async () => {
    const khong = await seedCustomsDeclaration({ channel: 'KHONG' });
    const green = await seedCustomsDeclaration({ channel: 'green' });
    const yellow = await seedCustomsDeclaration({ channel: 'yellow' });
    const red = await seedCustomsDeclaration({ channel: 'red' });

    expect((await prisma.customsDeclaration.findUniqueOrThrow({ where: { id: khong.id } })).channel).toBe('KHONG');
    expect((await prisma.customsDeclaration.findUniqueOrThrow({ where: { id: green.id } })).channel).toBe('green');
    expect((await prisma.customsDeclaration.findUniqueOrThrow({ where: { id: yellow.id } })).channel).toBe('yellow');
    expect((await prisma.customsDeclaration.findUniqueOrThrow({ where: { id: red.id } })).channel).toBe('red');

    // Cột thật dưới Postgres phải là chuỗi rỗng, không phải NULL hay 'KHONG'.
    const raw = await prisma.$queryRawUnsafe<{ channel: string }[]>(
      `SELECT channel FROM tbl_customs_declarations WHERE id = $1`,
      khong.id,
    );
    expect(raw[0].channel).toBe('');
  });

  it('CustomsDeclaration.channel mặc định là KHONG (rỗng) khi không truyền', async () => {
    const d = await seedCustomsDeclaration({});
    expect(d.channel).toBe('KHONG');
  });

  it('CustomsDeclaration.channel từ chối giá trị lạ ngoài 4 giá trị enum', async () => {
    await expect(
      prisma.customsDeclaration.create({ data: { status: 0, channel: 'blue' as any } }),
    ).rejects.toThrow();
  });

  // §4.7: frozen_json/frozen_at rỗng 100% (248/248) — workflow đóng băng
  // CHƯA TỪNG chạy, nhưng cột phải tồn tại + round-trip để migrate dữ liệu
  // thật không mất gì khi tính năng bật lên ở đợt sau.
  it('⚠ CustomsDeclaration giữ cột frozenJson/frozenAt/hqPrecheck* dù chưa dựng workflow', async () => {
    const d = await seedCustomsDeclaration({
      frozenJson: '{"locked":true}',
      frozenAt: new Date('2026-09-23T10:00:00Z'),
      // ⚠ D5 (review cuối #08): hai cột này là `datetime` trên prod, KHÔNG
      // phải epoch int — trước bản vá chúng nhận số nguyên (2000/3000).
      hqPrecheckSentAt: new Date('2026-09-21T08:15:00.000Z'),
      hqPrecheckSentBy: 'nv1',
      hqPrecheckOkAt: new Date('2026-09-21T11:40:30.000Z'),
      hqPrecheckOkBy: 'kt1',
      hqPrecheckNote: 'đã kiểm tiền kiểm',
    });
    const reread = await prisma.customsDeclaration.findUniqueOrThrow({ where: { id: d.id } });
    expect(reread.frozenJson).toBe('{"locked":true}');
    expect(reread.frozenAt?.toISOString()).toBe('2026-09-23T10:00:00.000Z');
    expect(reread.hqPrecheckSentAt?.toISOString()).toBe('2026-09-21T08:15:00.000Z');
    expect(reread.hqPrecheckSentBy).toBe('nv1');
    expect(reread.hqPrecheckOkAt?.toISOString()).toBe('2026-09-21T11:40:30.000Z');
    expect(reread.hqPrecheckOkBy).toBe('kt1');
    expect(reread.hqPrecheckNote).toBe('đã kiểm tiền kiểm');
  });

  // ═══ D1 (review cuối #08, 23/09/2026) ═══════════════════════════════════
  // Đo prod: `tbl_customs_declarations.updated_at datetime DEFAULT
  // current_timestamp()`, CÓ GIÁ TRỊ ở 248/248 dòng (dải 2026-09-02 20:55:08
  // … 2026-09-20 08:30:03). Model TỪNG KHÔNG CÓ field nào map tới nó — ETL
  // không có chỗ đổ vết audit của mọi dòng. Lọt lưới vì nghiệm thu chỉ ĐẾM
  // cột (30 = 30): cột MA `customs_gate` (không tồn tại trên prod) bù đúng
  // một chỗ cho cột thiếu này.
  it('⚠⚠⚠ D1 — CustomsDeclaration.updatedAt TỒN TẠI + round-trip DATETIME (prod: 248/248 dòng có dữ liệu)', async () => {
    const d = await seedCustomsDeclaration({
      createdAt: new Date('2026-09-02T20:55:08.000Z'),
      updatedAt: new Date('2026-09-20T08:30:03.000Z'),
    });
    const reread = await prisma.customsDeclaration.findUniqueOrThrow({ where: { id: d.id } });
    // ⚠ D5 — createdAt cũng là datetime (248/248 có dữ liệu), từng là Int?.
    expect(reread.createdAt?.toISOString()).toBe('2026-09-02T20:55:08.000Z');
    expect(reread.updatedAt?.toISOString()).toBe('2026-09-20T08:30:03.000Z');
  });

  // ═══ D1 — cột MA `customs_gate` PHẢI KHÔNG CÒN ở bảng này ════════════════
  // `customs_gate` là cột của `tbl_transport_files` (model TransportFile đã
  // có), KHÔNG phải của `tbl_customs_declarations` — đo prod: bảng này có
  // đúng 30 cột và không cột nào tên như vậy. Kiểm ở tầng CATALOG Postgres
  // (information_schema), không qua Prisma client, để nếu ai đó khai lại
  // field đó trong schema thì ca này đỏ ngay chứ không chờ một ETL im lặng.
  it('⚠⚠ D1 — tbl_customs_declarations KHÔNG có cột customs_gate (cột MA), nhưng tbl_transport_files THÌ CÓ', async () => {
    const decl = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'tbl_customs_declarations' AND column_name = 'customs_gate'`,
    );
    expect(decl).toHaveLength(0);

    const files = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'tbl_transport_files' AND column_name = 'customs_gate'`,
    );
    expect(files).toHaveLength(1);
  });

  // ═══ D2 (review cuối #08, 23/09/2026) ═══════════════════════════════════
  // Đo prod: `tbl_transport_file_items.declaration_id int(11) NOT NULL
  // DEFAULT 0`; 6223 -> 60 dòng, 6224 -> 40 dòng, 0 -> 45 dòng; JOIN sang
  // `tbl_customs_declarations` giải được 100/145 dòng, KHÔNG SÓT dòng nào.
  // Model TỪNG bỏ hẳn cột này ⇒ `CustomsDeclaration` là một hòn ĐẢO: không
  // có đường nào từ tờ khai xuống dòng khai hay ngược lại, và ETL vứt 100
  // mối nối thật.
  //
  // ⚠ Bảng `CustomsDeclaration` hiện KHÔNG có đường ghi từ ứng dụng (đợt 1
  // chỉ port lõi tính thuế; tạo/sửa tờ khai là đợt 2) — CỐ Ý và được ghi rõ
  // ở đầu model trong schema.prisma + migration 20260923250000 + migration
  // doc mục 7.1. Ca test này là bằng chứng quan hệ THẬT SỰ nạp được, không
  // chỉ là cột nằm đó.
  it('⚠⚠⚠ D2 — TransportFileItem.declarationId nối THẬT sang CustomsDeclaration, nạp được cả hai chiều', async () => {
    const file = await prisma.transportFile.create({ data: { status: 0 } });
    const decl = await seedCustomsDeclaration({ fileId: file.id, declarationNumber: 'TK-D2-6223' });

    const gan1 = await prisma.transportFileItem.create({
      data: { fileId: file.id, declarationId: decl.id, productName: 'Dòng khai đã gắn tờ khai 1' },
    });
    const gan2 = await prisma.transportFileItem.create({
      data: { fileId: file.id, declarationId: decl.id, productName: 'Dòng khai đã gắn tờ khai 2' },
    });
    // 45/145 dòng prod có declaration_id=0 -> ETL NULLIF(...,0) -> NULL.
    const chuaGan = await prisma.transportFileItem.create({
      data: { fileId: file.id, declarationId: null, productName: 'Dòng khai CHƯA gắn tờ khai' },
    });

    // Chiều xuôi: dòng khai -> tờ khai.
    const xuoi = await prisma.transportFileItem.findUniqueOrThrow({
      where: { id: gan1.id },
      include: { declaration: true },
    });
    expect(xuoi.declarationId).toBe(decl.id);
    expect(xuoi.declaration?.declarationNumber).toBe('TK-D2-6223');

    // Chiều ngược: tờ khai -> các dòng khai của nó (ĐÚNG 2 dòng, không nuốt
    // dòng chưa gắn).
    const nguoc = await prisma.customsDeclaration.findUniqueOrThrow({
      where: { id: decl.id },
      include: { items: true },
    });
    expect(nguoc.items.map((x) => x.id).sort()).toEqual([gan1.id, gan2.id].sort());
    expect(nguoc.items.map((x) => x.id)).not.toContain(chuaGan.id);

    // Dòng chưa gắn: declarationId NULL, include ra null — không phải 0.
    const rong = await prisma.transportFileItem.findUniqueOrThrow({
      where: { id: chuaGan.id },
      include: { declaration: true },
    });
    expect(rong.declarationId).toBeNull();
    expect(rong.declaration).toBeNull();
  });

  it('CustomsDeclaration: totalDeclaredValue/totalTax/totalVat/totalImportDuty round-trip Decimal(15,2)', async () => {
    const d = await seedCustomsDeclaration({
      totalDeclaredValue: '123456789.12',
      totalTax: '1000.50',
      totalVat: '800.25',
      totalImportDuty: '200.25',
    });
    const reread = await prisma.customsDeclaration.findUniqueOrThrow({ where: { id: d.id } });
    expect(reread.totalDeclaredValue?.toString()).toBe('123456789.12');
    expect(reread.totalTax?.toString()).toBe('1000.5');
    expect(reread.totalVat?.toString()).toBe('800.25');
    expect(reread.totalImportDuty?.toString()).toBe('200.25');
  });

  it('CustomsDeclaration.fileId/declarationNumber có index — lọc theo cont và theo số tờ khai', async () => {
    const d = await seedCustomsDeclaration({ fileId: 777, declarationNumber: 'TK-0001' });
    const byFile = await prisma.customsDeclaration.findMany({ where: { fileId: 777 } });
    const byNumber = await prisma.customsDeclaration.findMany({ where: { declarationNumber: 'TK-0001' } });
    expect(byFile.map((x) => x.id)).toContain(d.id);
    expect(byNumber.map((x) => x.id)).toContain(d.id);
  });

  // registeredAt đo prod là DATETIME (không phải DATE) — round-trip giữ cả
  // giờ:phút:giây, khác clearanceDate (@db.Date, chỉ có ngày).
  it('⚠ CustomsDeclaration.registeredAt giữ nguyên DATETIME (giờ:phút:giây), clearanceDate chỉ giữ ngày', async () => {
    const d = await seedCustomsDeclaration({
      registeredAt: new Date('2026-09-20T14:35:07Z'),
      clearanceDate: new Date('2026-09-22'),
    });
    const reread = await prisma.customsDeclaration.findUniqueOrThrow({ where: { id: d.id } });
    expect(reread.registeredAt?.toISOString()).toBe('2026-09-20T14:35:07.000Z');
    expect(reread.clearanceDate?.toISOString().slice(0, 10)).toBe('2026-09-22');
  });

  // §4.8: hs_status=0 trên TOÀN BỘ 690 dòng prod — workflow duyệt HS chưa
  // từng chạy. Cột phải tồn tại + round-trip, không dựng service duyệt.
  it('⚠ ImportGoods giữ cột hsStatus/pendingJson/approvedBy dù workflow duyệt HS chưa chạy', async () => {
    const g = await seedImportGoods({
      hsStatus: 1,
      approvedBy: 'kt1',
      // ⚠ D5 (review cuối #08): approvedAt/pendingAt là `datetime` trên prod,
      // KHÔNG phải epoch int — trước bản vá ca này truyền 5000/4000.
      approvedAt: new Date('2026-08-25T09:12:34.000Z'),
      hsVersion: 2,
      pendingJson: '{"hsCode":"1234.56.78"}',
      pendingBy: 'nv1',
      pendingAt: new Date('2026-08-24T15:00:00.000Z'),
      // ⚠ D5: procedure_days là int(11) trên prod, model từng khai String?.
      procedureDays: 7,
      lastClearedAt: new Date('2026-09-19T03:20:00.000Z'),
    });
    const reread = await prisma.importGoods.findUniqueOrThrow({ where: { id: g.id } });
    expect(reread.hsStatus).toBe(1);
    expect(reread.approvedBy).toBe('kt1');
    expect(reread.approvedAt?.toISOString()).toBe('2026-08-25T09:12:34.000Z');
    expect(reread.hsVersion).toBe(2);
    expect(reread.pendingJson).toBe('{"hsCode":"1234.56.78"}');
    expect(reread.pendingBy).toBe('nv1');
    expect(reread.pendingAt?.toISOString()).toBe('2026-08-24T15:00:00.000Z');
    expect(reread.procedureDays).toBe(7);
    expect(reread.lastClearedAt?.toISOString()).toBe('2026-09-19T03:20:00.000Z');
  });

  // Đo prod: nguồn lark_import 424, manual 266 — đủ 3 giá trị enum, giá trị
  // lạ phải bị Postgres chặn ngay ở cột.
  it('ImportGoods.source chấp nhận đủ 3 giá trị enum, từ chối giá trị lạ', async () => {
    const manual = await seedImportGoods({ source: 'manual', goodsKey: 'GK-1' });
    const fromDecl = await seedImportGoods({ source: 'from_declaration', goodsKey: 'GK-2' });
    const lark = await seedImportGoods({ source: 'lark_import', goodsKey: 'GK-3' });

    expect((await prisma.importGoods.findUniqueOrThrow({ where: { id: manual.id } })).source).toBe('manual');
    expect((await prisma.importGoods.findUniqueOrThrow({ where: { id: fromDecl.id } })).source).toBe('from_declaration');
    expect((await prisma.importGoods.findUniqueOrThrow({ where: { id: lark.id } })).source).toBe('lark_import');

    await expect(
      prisma.importGoods.create({
        // goodsKey giờ NOT NULL (fix-round-1) — truyền để lỗi dưới đây là
        // do ENUM sai (điều test này đang kiểm), không phải do thiếu cột
        // bắt buộc khác.
        data: { hsStatus: 0, goodsKey: 'GK-BAD-ENUM', source: 'khong_ton_tai' as any },
      }),
    ).rejects.toThrow();
  });

  it('ImportGoods.hsCode/productName có index — lọc theo mã HS và theo tên hàng', async () => {
    const g = await seedImportGoods({ hsCode: '8448.39.13', productName: 'Phụ tùng máy dệt' });
    const byHs = await prisma.importGoods.findMany({ where: { hsCode: '8448.39.13' } });
    const byName = await prisma.importGoods.findMany({ where: { productName: 'Phụ tùng máy dệt' } });
    expect(byHs.map((x) => x.id)).toContain(g.id);
    expect(byName.map((x) => x.id)).toContain(g.id);
  });

  it('ImportGoods: dải giá khai min/max/lastDeclaredPriceUsd round-trip Decimal(15,4)', async () => {
    const g = await seedImportGoods({
      minDeclaredPriceUsd: '1.2345',
      maxDeclaredPriceUsd: '9.8765',
      lastDeclaredPriceUsd: '5.5',
    });
    const reread = await prisma.importGoods.findUniqueOrThrow({ where: { id: g.id } });
    expect(reread.minDeclaredPriceUsd?.toString()).toBe('1.2345');
    expect(reread.maxDeclaredPriceUsd?.toString()).toBe('9.8765');
    expect(reread.lastDeclaredPriceUsd?.toString()).toBe('5.5');
  });

  // fix-round-1 (Task 4, 23/09/2026, coordinator-measured): 7 cột prod đo
  // được (690 dòng: status 690/690 đều =1, created_by/created_at 690/690,
  // origin 429/690, updated_by/updated_at 58/690, last_used_at 1/690) đã
  // từng THIẾU khỏi model — đúng lớp bẫy #07 receipt_images (cột có dữ liệu
  // thật, nghiệm thu chỉ so ĐẾM DÒNG nên không phát hiện được cột mất).
  // Test này khoá cứng: cả 7 cột PHẢI tồn tại + round-trip ĐÚNG KIỂU, để lỗ
  // này không thể lặng lẽ mở lại. created_at/updated_at/last_used_at là
  // DATETIME thật (Date round-trip), KHÔNG phải epoch int như
  // approvedAt/pendingAt/lastClearedAt cạnh đó trong CÙNG model — cố ý viết
  // riêng, không dùng chung assertion với các cột epoch để một lần lỡ tay
  // đổi kiểu nhầm bị bắt ngay ở ĐÚNG cột.
  it('⚠⚠ ImportGoods giữ đủ 7 cột prod (status/origin/created_by,at/updated_by,at/last_used_at), round-trip đúng kiểu và default', async () => {
    // default: KHÔNG truyền gì -> status mặc định 1, origin mặc định 'CN'
    // (đúng DEFAULT của prod), 5 cột còn lại mặc định NULL (prod cũng NULL
    // mặc định, không có DEFAULT nào cho 5 cột này).
    const def = await seedImportGoods({ goodsKey: 'zz-schema-igcols-default' });
    const rereadDef = await prisma.importGoods.findUniqueOrThrow({ where: { id: def.id } });
    expect(rereadDef.status).toBe(1);
    expect(rereadDef.origin).toBe('CN');
    expect(rereadDef.createdBy).toBeNull();
    expect(rereadDef.createdAt).toBeNull();
    expect(rereadDef.updatedBy).toBeNull();
    expect(rereadDef.updatedAt).toBeNull();
    expect(rereadDef.lastUsedAt).toBeNull();

    // ghi đủ cả 7 giá trị — round-trip đúng kiểu thật (DateTime giữ nguyên
    // mili-giây, không rơi rớt/làm tròn về NGÀY như clearanceDate @db.Date).
    const full = await seedImportGoods({
      goodsKey: 'zz-schema-igcols-full',
      status: 0,
      origin: 'VN',
      createdBy: 'kt1',
      createdAt: new Date('2026-08-25T09:12:34.000Z'),
      updatedBy: 'kt2',
      updatedAt: new Date('2026-09-01T16:45:00.000Z'),
      lastUsedAt: new Date('2026-09-20T00:00:00.000Z'),
    });
    const rereadFull = await prisma.importGoods.findUniqueOrThrow({ where: { id: full.id } });
    expect(rereadFull.status).toBe(0);
    expect(rereadFull.origin).toBe('VN');
    expect(rereadFull.createdBy).toBe('kt1');
    expect(rereadFull.createdAt?.toISOString()).toBe('2026-08-25T09:12:34.000Z');
    expect(rereadFull.updatedBy).toBe('kt2');
    expect(rereadFull.updatedAt?.toISOString()).toBe('2026-09-01T16:45:00.000Z');
    expect(rereadFull.lastUsedAt?.toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });

  // fix-round-1 (Task 4, 23/09/2026, coordinator-measured): prod goods_key
  // là varchar(500) NOT NULL + UNIQUE KEY uq_goods_key (đo non_unique=0) —
  // schema trước để nullable, không unique. Khoá cứng cả hai ràng buộc ở
  // ĐÚNG tầng DB (Postgres tự chặn, không phải service tự kiểm tra bằng
  // JS) — service ImportGoodsService.upsert() dựa THẲNG vào ràng buộc này
  // để atomically upsert (xem import-goods.spec.ts ca "hai upsert() ĐỒNG
  // THỜI").
  it('⚠⚠ ImportGoods.goodsKey NOT NULL + UNIQUE ở tầng DB (uq_goods_key) — Postgres tự chặn, không phải service tự canh', async () => {
    await expect(
      prisma.importGoods.create({ data: { goodsKey: null as any } }),
    ).rejects.toThrow();

    await seedImportGoods({ goodsKey: 'zz-schema-uq-dup' });
    await expect(
      prisma.importGoods.create({ data: { goodsKey: 'zz-schema-uq-dup' } }),
    ).rejects.toThrow(/Unique constraint/i);
  });

  // ⚠ Biểu thuế lưu dạng CHUỖI trên prod (varchar), không phải số. Đo
  // nk_uu_dai: '0' x3.769 · RỖNG x3.115 (3.115/15.119 dòng — PHỔ BIẾN, không
  // phải lỗi) · '20'/'5'/'10'/'3'/'12'/'15'. Chuẩn hoá ở biên service (Task
  // 4), KHÔNG ở schema — bộ chuẩn hoá đó PHẢI xử lý được cả chuỗi rỗng.
  it('⚠ HsTariff.nkUuDai round-trip chuỗi số VÀ chuỗi rỗng (3.115/15.119 dòng prod là rỗng)', async () => {
    const withRate = await seedHsTariff({ hsRaw: '8448391300', hsNorm: '84483913', nkUuDai: '5' });
    const empty = await seedHsTariff({ hsRaw: '8483.10.00', hsNorm: '84831000', nkUuDai: '' });

    const rereadRate = await prisma.hsTariff.findUniqueOrThrow({ where: { id: withRate.id } });
    const rereadEmpty = await prisma.hsTariff.findUniqueOrThrow({ where: { id: empty.id } });
    expect(rereadRate.nkUuDai).toBe('5');
    expect(rereadEmpty.nkUuDai).toBe('');
  });

  it('HsTariff: mọi cột thuế suất khác (nkTt/vat/acfta/rcep/ttdb/xk/bvmt) đều là chuỗi, round-trip nguyên văn', async () => {
    const t = await seedHsTariff({
      hsRaw: '0101.21.00',
      hsNorm: '01012100',
      nkTt: '20',
      vat: '10',
      acfta: '0',
      rcep: '',
      ttdb: '-',
      xk: '0',
      bvmt: '',
      chinhSach: 'Kiểm dịch động vật',
      giamVat: 'giảm 2%',
    });
    const reread = await prisma.hsTariff.findUniqueOrThrow({ where: { id: t.id } });
    expect(reread.nkTt).toBe('20');
    expect(reread.vat).toBe('10');
    expect(reread.acfta).toBe('0');
    expect(reread.rcep).toBe('');
    expect(reread.ttdb).toBe('-');
    expect(reread.xk).toBe('0');
    expect(reread.bvmt).toBe('');
    expect(reread.chinhSach).toBe('Kiểm dịch động vật');
    expect(reread.giamVat).toBe('giảm 2%');
  });

  it('HsTariff.hsNorm có index — lọc theo mã HS đã chuẩn hoá', async () => {
    const t = await seedHsTariff({ hsRaw: '8448.39.13.00', hsNorm: '84483913' });
    const found = await prisma.hsTariff.findMany({ where: { hsNorm: '84483913' } });
    expect(found.map((x) => x.id)).toContain(t.id);
  });

  // §4.6: tbl_customs_unit_rules đo được 0 dòng prod — quy tắc SL1/SL2 chưa
  // ai cấu hình. Bảng vẫn phải dựng đủ cột tối giản theo brief.
  it('⚠ CustomsUnitRule round-trip — 0 dòng trên prod (chưa từng cấu hình), vẫn phải tồn tại đủ cột', async () => {
    const r = await seedCustomsUnitRule({
      scopeType: 'hs_code',
      scopeKey: '8448.39.13',
      unit1: 'CAI',
      unit2: 'KG',
      conversionType: 'fixed_factor',
      factor: '0.35',
      paramsJson: '{"note":"1 cái = 0.35kg"}',
    });
    const reread = await prisma.customsUnitRule.findUniqueOrThrow({ where: { id: r.id } });
    expect(reread.scopeType).toBe('hs_code');
    expect(reread.scopeKey).toBe('8448.39.13');
    expect(reread.unit1).toBe('CAI');
    expect(reread.unit2).toBe('KG');
    expect(reread.conversionType).toBe('fixed_factor');
    expect(reread.factor?.toString()).toBe('0.35');
    expect(reread.paramsJson).toBe('{"note":"1 cái = 0.35kg"}');
  });

  it('CustomsUnitRule.scopeType có index', async () => {
    const r = await seedCustomsUnitRule({ scopeType: 'hs_code', scopeKey: 'X' });
    const found = await prisma.customsUnitRule.findMany({ where: { scopeType: 'hs_code' } });
    expect(found.map((x) => x.id)).toContain(r.id);
  });

  // ===== TransportFileItem — cột dòng khai mở rộng cho #08 =====

  // Đo prod: import_duty_rate 5.00 (6 dòng)/0.00 (139) · vat_rate 8.00 (128)/
  // 10.00 (9)/0.00 (8) ⇒ CẢ HAI là PHẦN TRĂM (5 nghĩa là 5%, không phải
  // 0,05). Dùng .toString() vì Prisma trả Decimal object — toBe(5) lỗi vì lý
  // do khác (so sánh object với number), không phải vì logic sai.
  it('⚠ TransportFileItem: importDutyRate/vatRate round-trip PHẦN TRĂM (5.00 nghĩa là 5%)', async () => {
    const file = await prisma.transportFile.create({ data: { status: 0 } });
    const item = await prisma.transportFileItem.create({
      data: { fileId: file.id, importDutyRate: '5.00', vatRate: '8.00' },
    });
    const reread = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.importDutyRate?.toString()).toBe('5');
    expect(reread.vatRate?.toString()).toBe('8');
  });

  // ⚠⚠ antidumpingPct kiểu (6,4) mang HÌNH DẠNG phân số, NHƯNG quy ước thật
  // (theo recalcItemTax của prod, cls.container.php:726) là PHẦN TRĂM — nhập
  // `5` cho nghĩa 5%, KHÔNG nhập `0.05`. 100% 145 dòng đo được là 0.0000
  // (quy ước CHƯA từng bị dữ liệu thật kiểm chứng) — ca này pin đúng quy ước
  // để người đầu tiên nhập giá trị khác 0 không sai 100 lần.
  it('⚠ TransportFileItem.antidumpingPct round-trip 5.0000 — quy ước PHẦN TRĂM, không phải phân số', async () => {
    const file = await prisma.transportFile.create({ data: { status: 0 } });
    const item = await prisma.transportFileItem.create({
      data: { fileId: file.id, antidumpingPct: '5.0000' },
    });
    const reread = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.antidumpingPct?.toString()).toBe('5');
  });

  // ⚠⚠⚠ declaredValue là USD, freightAlloc là VND — TUYỆT ĐỐI không được
  // cộng thẳng hai số này (bug đã bắt ở cls.container.php:707). Ca test chỉ
  // pin round-trip đúng số lẻ của từng cột; phép cấm-cộng nằm ở comment +
  // được Task 3 kiểm bằng hành vi (taxBase không đổi khi freightAlloc đổi).
  it('⚠ TransportFileItem.declaredValue (USD) và freightAlloc (VND) round-trip — hai đơn vị KHÁC NHAU, không được cộng', async () => {
    const file = await prisma.transportFile.create({ data: { status: 0 } });
    const item = await prisma.transportFileItem.create({
      data: { fileId: file.id, declaredValue: '1234.56', freightAlloc: '9876543.21' },
    });
    const reread = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.declaredValue?.toString()).toBe('1234.56');
    expect(reread.freightAlloc?.toString()).toBe('9876543.21');
  });

  it('TransportFileItem: cột thuế tính toán (taxBase/dutyNkAmt/dutyTtdbAmt/dutyCbpgAmt/envtaxVnd/dutyVatAmt/totalTax/taxRateUsed) round-trip', async () => {
    const file = await prisma.transportFile.create({ data: { status: 0 } });
    const item = await prisma.transportFileItem.create({
      data: {
        fileId: file.id,
        taxBase: '1000000.00',
        dutyNkAmt: '50000.00',
        dutyTtdbAmt: '0.00',
        dutyCbpgAmt: '0.00',
        envtaxVnd: '0.00',
        dutyVatAmt: '80000.00',
        totalTax: '130000.00',
        taxRateUsed: '13.0000',
      },
    });
    const reread = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.taxBase?.toString()).toBe('1000000');
    expect(reread.dutyNkAmt?.toString()).toBe('50000');
    expect(reread.dutyTtdbAmt?.toString()).toBe('0');
    expect(reread.dutyCbpgAmt?.toString()).toBe('0');
    expect(reread.envtaxVnd?.toString()).toBe('0');
    expect(reread.dutyVatAmt?.toString()).toBe('80000');
    expect(reread.totalTax?.toString()).toBe('130000');
    expect(reread.taxRateUsed?.toString()).toBe('13');
  });

  // quoteItemId là khoá tra báo giá gốc của tbs_decl_tach_nen_thue() —
  // TUYỆT ĐỐI phải nullable (nhiều dòng khai không gắn báo giá) và có index
  // (mọi lần tính lại thuế của một dòng khai đều join qua cột này).
  it('⚠ TransportFileItem.quoteItemId nullable và có index (khoá tra báo giá của hàm tách nền thuế)', async () => {
    const file = await prisma.transportFile.create({ data: { status: 0 } });
    const withoutQuote = await prisma.transportFileItem.create({ data: { fileId: file.id } });
    expect(withoutQuote.quoteItemId).toBeNull();

    const withQuote = await prisma.transportFileItem.create({ data: { fileId: file.id, quoteItemId: 42 } });
    const found = await prisma.transportFileItem.findMany({ where: { quoteItemId: 42 } });
    expect(found.map((x) => x.id)).toContain(withQuote.id);
  });

  it('TransportFileItem.declaredNameVi round-trip VARCHAR(500)', async () => {
    const file = await prisma.transportFile.create({ data: { status: 0 } });
    const item = await prisma.transportFileItem.create({
      data: { fileId: file.id, declaredNameVi: 'Phụ tùng máy dệt bằng sắt' },
    });
    const reread = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.declaredNameVi).toBe('Phụ tùng máy dệt bằng sắt');
  });

  // ⚠ TransportFileItem.quantity đã tồn tại từ #07 dưới dạng Decimal(15,2)
  // (placeholder chưa đo — xem comment tại model). Đo #08 (23/09/2026) cho
  // biết cột thật trên prod là int(11), NHƯNG brief Task 1 cấm retype cột đã
  // có — giữ nguyên Decimal(15,2), KHÔNG đổi sang Int ở đợt này. Ca này pin
  // hành vi HIỆN TẠI (chấp nhận số lẻ) để không ai vô tình "sửa" lại mà
  // không đọc report.
  it('⚠ TransportFileItem.quantity giữ nguyên Decimal(15,2) từ #07 — KHÔNG retype sang Int ở Task 1 này', async () => {
    const file = await prisma.transportFile.create({ data: { status: 0 } });
    const item = await prisma.transportFileItem.create({ data: { fileId: file.id, quantity: '12.50' } });
    const reread = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.quantity?.toString()).toBe('12.5');
  });

  // ═══ #08 fix-round-1 (23/09/2026) — schema bổ sung cho thang tra tỷ giá
  // `tbs_decl_usd_rate` (DeclSourceService.usdRateForFile). Xem
  // task-2-report.md mục "Fix round 1" cho lý do đo prod.

  it('⚠⚠ TransportFile.closedAt RETYPE từ Int? (epoch, #07) sang DateTime? thật — giữ nguyên GIỜ:PHÚT:GIÂY, không chỉ ngày (khác clearanceDate @db.Date)', async () => {
    const closedAt = new Date('2026-09-10T14:37:22.000Z');
    const file = await prisma.transportFile.create({ data: { status: 0, closedAt } });
    const reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(reread.closedAt?.toISOString()).toBe(closedAt.toISOString());
  });

  it('TransportFile.closedAt nullable (mặc định phần lớn cont chưa đóng tờ khai)', async () => {
    const file = await prisma.transportFile.create({ data: { status: 0 } });
    const reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(reread.closedAt).toBeNull();
  });

  it('TransportFile.usdRateClosed nullable + round-trip Decimal(12,4) — hạng 1 của thang tra tỷ giá', async () => {
    const withRate = await prisma.transportFile.create({ data: { status: 0, usdRateClosed: '25400.1234' } });
    const rereadWith = await prisma.transportFile.findUniqueOrThrow({ where: { id: withRate.id } });
    expect(rereadWith.usdRateClosed?.toString()).toBe('25400.1234');

    const withoutRate = await prisma.transportFile.create({ data: { status: 0 } });
    const rereadWithout = await prisma.transportFile.findUniqueOrThrow({ where: { id: withoutRate.id } });
    expect(rereadWithout.usdRateClosed).toBeNull();
  });

  it('⚠ ExchangeRate (tbl_exchange_rates) round-trip cả 2 giá trị Currency, default createdBy/cdate, rateDate CHỈ giữ NGÀY (@db.Date) — bảng KHÁC HẲN MhRate/tbl_mh_tygia', async () => {
    const usd = await prisma.exchangeRate.create({
      data: { currency: 'USD', rateVnd: 25_400, rateDate: new Date('2026-09-10') },
    });
    expect(usd.currency).toBe('USD');
    expect(usd.rateVnd.toString()).toBe('25400');
    expect(usd.createdBy).toBe(''); // default
    expect(usd.cdate).toBe(0); // default

    const cny = await prisma.exchangeRate.create({
      data: { currency: 'CNY', rateVnd: 3_500, rateDate: new Date('2026-09-10'), createdBy: 'kt1', cdate: 123 },
    });
    expect(cny.currency).toBe('CNY');
    expect(cny.createdBy).toBe('kt1');
    expect(cny.cdate).toBe(123);

    const reread = await prisma.exchangeRate.findUniqueOrThrow({ where: { id: usd.id } });
    expect(reread.rateDate.toISOString().slice(0, 10)).toBe('2026-09-10');
  });

  it('ExchangeRate.currency chỉ nhận CNY/USD — giá trị lạ bị Postgres từ chối', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO tbl_exchange_rates (currency, rate_vnd, rate_date) VALUES ('EUR', 1, '2026-01-01')`,
      ),
    ).rejects.toThrow();
  });

  it('ExchangeRate có UNIQUE index (currency, rateDate) phục vụ getRate() — filter theo cả hai cột chạy được, trả đúng dòng', async () => {
    await prisma.exchangeRate.create({ data: { currency: 'USD', rateVnd: 24_000, rateDate: new Date('2026-09-01') } });
    await prisma.exchangeRate.create({ data: { currency: 'USD', rateVnd: 24_800, rateDate: new Date('2026-09-05') } });
    await prisma.exchangeRate.create({ data: { currency: 'CNY', rateVnd: 3_500, rateDate: new Date('2026-09-05') } });

    const rows = await prisma.exchangeRate.findMany({
      where: { currency: 'USD', rateDate: { lte: new Date('2026-09-05') } },
      orderBy: { rateDate: 'desc' },
    });
    expect(rows.map((r) => r.rateVnd.toString())).toEqual(['24800', '24000']);
  });

  // ⚠⚠ IMPORTANT 2 (fix-round-2, 23/09/2026) — coordinator đo prod:
  // `uq_cur_date` UNIQUE(currency, rate_date), non_unique=0. Bản
  // fix-round-1 model plain @@index (không chặn trùng lặp) — với 2 dòng
  // trùng (currency, rateDate), `getRate`'s `findFirst orderBy rateDate
  // desc` không có tiebreaker, khiến kết quả (và cả tiền thuế phụ thuộc
  // nó) KHÔNG XÁC ĐỊNH giữa các lần chạy. Ca này chứng minh CSDL tự chặn
  // trùng lặp, không chỉ dựa vào kỷ luật code.
  it('⚠⚠ ExchangeRate.(currency,rateDate) là UNIQUE — trùng lặp bị Postgres từ chối ở tầng CSDL', async () => {
    await prisma.exchangeRate.create({ data: { currency: 'USD', rateVnd: 24_000, rateDate: new Date('2026-09-05') } });
    await expect(
      prisma.exchangeRate.create({ data: { currency: 'USD', rateVnd: 24_999, rateDate: new Date('2026-09-05') } }),
    ).rejects.toThrow();

    // Cùng ngày nhưng KHÁC currency -> vẫn hợp lệ (constraint là composite,
    // không phải rateDate đơn lẻ).
    await expect(
      prisma.exchangeRate.create({ data: { currency: 'CNY', rateVnd: 3_500, rateDate: new Date('2026-09-05') } }),
    ).resolves.toBeDefined();
  });
});
