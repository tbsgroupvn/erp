// test/customs/import-goods.spec.ts — #08 Task 4
//
// ImportGoodsService (upsert theo goods_key + cảnh báo dải giá khai) +
// HsTariffService (tra biểu thuế HS, chuẩn hoá thuế suất dạng chuỗi sang số).
// Tái hiện NGUYÊN VĂN hai hàm gốc:
//   - ImportGoodsUpsert($row) — global/libs/gffunc.php:585
//   - tra cứu biểu thuế qua hs_norm, ưu tiên hs_level=8, fallback mọi cấp —
//     cùng cách ajaxs/goods/hs_info.php + cls.container.php:1864.
//
// ⚠ ĐO PROD 23/09/2026 (task-4-report.md có chi tiết):
//   - tbl_hs_tariff (15.119 dòng): nk_uu_dai/vat/acfta/ttdb/nk_tt/rcep/bvmt
//     lưu VARCHAR — phần lớn số thuần ('0','20','5'...) nhưng cũng có
//     '' (rỗng, PHỔ BIẾN), '8/10' (nhiều mức gộp), '*/5/8/10', '0 (-KH)'
//     (miễn trừ theo nước), 'ĐB' (đặc biệt), 'Theo hướng dẫn tại khoản 1.1
//     Chương 98' (dẫn chiếu văn bản), '150% thuế MFN', số thập phân PHẨY
//     ('12,5'). parseRateString() CHỈ chuẩn hoá được số thuần (có thể có
//     '%' hoặc dấu phẩy thập phân) — mọi biểu thức nhiều-giá-trị/điều-kiện
//     trả về null (giữ nguyên "raw" để không mất thông tin), KHÔNG suy diễn
//     lấy một số trong đó vì sẽ sai đối tượng.
//   - tbl_import_goods (690 dòng, hs_status=0 TOÀN BỘ — xem test riêng cho
//     nhánh "locked" hs_status=2, nhánh này CHƯA TỪNG chạy thật trên prod
//     nhưng vẫn là 1 phần của hàm ImportGoodsUpsert được copy nguyên văn).
import { PrismaService } from '../../src/prisma/prisma.service';
import { ImportGoodsService } from '../../src/customs/import-goods.service';
import { HsTariffService } from '../../src/customs/hs-tariff.service';
import { prisma } from '../helpers/db';
import { resetCustoms, seedImportGoods, seedHsTariff } from '../helpers/customs-db';

describe('HsTariffService — #08 Task 4, tra biểu thuế HS', () => {
  const svc = new HsTariffService(prisma as unknown as PrismaService);

  beforeEach(async () => {
    await resetCustoms();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('normalizeHsCode — bỏ mọi ký tự không phải chữ số', () => {
    it.each([
      ['8515.80.90', '85158090'],
      ['8515 80 90', '85158090'],
      ['85158090', '85158090'],
      ['', ''],
      [null, ''],
      [undefined, ''],
    ])('normalizeHsCode(%p) === %p', (input, expected) => {
      expect(HsTariffService.normalizeHsCode(input as any)).toBe(expected);
    });
  });

  describe('parseRateString — chuẩn hoá thuế suất dạng chuỗi sang số, phía AN TOÀN: không parse được -> null', () => {
    it.each([
      [null, null],
      [undefined, null],
      ['', null],
      ['  ', null],
      ['0', 0],
      ['20', 20],
      ['  5  ', 5],
      ['5%', 5],
      ['12,5', 12.5], // phẩy thập phân kiểu VN (đo thật: nk_tt/rcep có '12,5','7,5','6,7'...)
      ['-', null], // brief: phải phủ ca '-'
      ['8/10', null], // đo thật vat: nhiều mức gộp — KHÔNG được đoán lấy 1 số
      ['*/5/8/10', null], // đo thật vat
      ['0 (-KH)', null], // đo thật acfta: miễn trừ theo nước
      ['ĐB', null], // đo thật ttdb: đặc biệt (thuốc lá/rượu)
      ['Theo hướng dẫn tại khoản 1.1 Chương 98', null], // đo thật nk_uu_dai
      ['150% thuế MFN', null], // đo thật nk_tt — có '%' nhưng KHÔNG phải số thuần
      ['*', null], // đo thật rcep
    ])('parseRateString(%p) === %p', (input, expected) => {
      expect(HsTariffService.parseRateString(input as any)).toBe(expected);
    });
  });

  it('hsCode rỗng/không có chữ số -> null, KHÔNG đụng DB', async () => {
    expect(await svc.tra('')).toBeNull();
    expect(await svc.tra('   ')).toBeNull();
    expect(await svc.tra('abc')).toBeNull(); // không chữ số nào -> norm rỗng
  });

  it('không có dòng nào khớp hs_norm -> null', async () => {
    await seedHsTariff({ hsNorm: '85158090', hsLevel: 8, nkUuDai: '5' });
    expect(await svc.tra('99999999')).toBeNull();
  });

  it('ưu tiên dòng hs_level=8 khi có nhiều cấp cùng hs_norm (chuẩn hoá dấu chấm trong mã HS đầu vào)', async () => {
    await seedHsTariff({ hsNorm: '85158090', hsLevel: 6, descVi: 'cấp 6 (chương)', nkUuDai: '10' });
    await seedHsTariff({ hsNorm: '85158090', hsLevel: 8, descVi: 'cấp 8 (dòng thuế thật)', nkUuDai: '5' });

    const r = await svc.tra('8515.80.90');
    expect(r).not.toBeNull();
    expect(r!.hsLevel).toBe(8);
    expect(r!.descVi).toBe('cấp 8 (dòng thuế thật)');
    expect(r!.nkUuDai).toEqual({ raw: '5', value: 5 });
  });

  it('không có dòng hs_level=8 -> lùi về dòng cấp bất kỳ khớp hs_norm', async () => {
    await seedHsTariff({ hsNorm: '01013090', hsLevel: 6, descVi: 'chỉ có cấp 6', nkUuDai: '0' });

    const r = await svc.tra('01013090');
    expect(r).not.toBeNull();
    expect(r!.hsLevel).toBe(6);
    expect(r!.descVi).toBe('chỉ có cấp 6');
  });

  it('trả đủ 7 sắc thuế (nk_tt/nk_uu_dai/vat/acfta/rcep/ttdb/bvmt), mỗi trường giữ RAW lẫn giá trị đã chuẩn hoá', async () => {
    await seedHsTariff({
      hsNorm: '01012100',
      hsLevel: 8,
      nkTt: '5',
      nkUuDai: '0',
      vat: '*/8/10', // giá trị lạ đo thật — value phải là null, raw phải giữ nguyên
      acfta: '0',
      rcep: '',
      ttdb: '',
      bvmt: '',
    });

    const r = await svc.tra('01012100');
    expect(r).toEqual({
      hsNorm: '01012100',
      hsLevel: 8,
      descVi: null,
      descEn: null,
      unit: null,
      nkTt: { raw: '5', value: 5 },
      nkUuDai: { raw: '0', value: 0 },
      vat: { raw: '*/8/10', value: null },
      acfta: { raw: '0', value: 0 },
      rcep: { raw: '', value: null },
      ttdb: { raw: '', value: null },
      bvmt: { raw: '', value: null },
    });
  });
});

describe('ImportGoodsService — #08 Task 4, upsert theo goods_key + dải giá khai', () => {
  const svc = new ImportGoodsService(prisma as unknown as PrismaService);

  beforeEach(async () => {
    await resetCustoms();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('buildGoodsKey — nguyên văn mb_strtolower(name).."|"..mb_strtolower(spec)', () => {
    it.each([
      ['Áo Thun Nam', 'Size L', 'áo thun nam|size l'],
      ['Áo Thun Nam', '', 'áo thun nam|'],
      ['Áo Thun Nam', undefined, 'áo thun nam|'],
      ['  Áo Thun Nam  ', '  Size L  ', 'áo thun nam|size l'],
    ])('buildGoodsKey(%p, %p) === %p', (name, spec, expected) => {
      expect(ImportGoodsService.buildGoodsKey(name, spec as any)).toBe(expected);
    });
  });

  it('product_name rỗng (kể cả toàn khoảng trắng) -> false, KHÔNG ghi gì vào DB', async () => {
    expect(await svc.upsert({ productName: '' })).toBe(false);
    expect(await svc.upsert({ productName: '   ' })).toBe(false);
    expect(await prisma.importGoods.count()).toBe(0);
  });

  it("hàng MỚI (goods_key chưa tồn tại) -> 'inserted', min=max=last=price_usd, times_used=1", async () => {
    const res = await svc.upsert({
      productName: 'Ốp lưng điện thoại',
      spec: 'iPhone 15',
      hsCode: '39269099',
      priceUsd: 1.5,
      source: 'manual',
    });
    expect(res).toBe('inserted');

    const row = await prisma.importGoods.findFirst({ where: { goodsKey: 'ốp lưng điện thoại|iphone 15' } });
    expect(row).not.toBeNull();
    expect(row!.hsCode).toBe('39269099');
    expect(Number(row!.minDeclaredPriceUsd)).toBe(1.5);
    expect(Number(row!.maxDeclaredPriceUsd)).toBe(1.5);
    expect(Number(row!.lastDeclaredPriceUsd)).toBe(1.5);
    expect(row!.timesUsed).toBe(1);
    expect(row!.hsStatus).toBe(0);
  });

  it('hàng MỚI, KHÔNG kèm price_usd -> min/max/last đều NULL (không tự bịa giá)', async () => {
    await svc.upsert({ productName: 'Hàng chưa có giá' });
    const row = await prisma.importGoods.findFirst({ where: { goodsKey: 'hàng chưa có giá|' } });
    expect(row!.minDeclaredPriceUsd).toBeNull();
    expect(row!.maxDeclaredPriceUsd).toBeNull();
    expect(row!.lastDeclaredPriceUsd).toBeNull();
  });

  it("goods_key ĐÃ TỒN TẠI (kể cả khác hoa/thường) -> 'merged', dải giá khai mở rộng theo LEAST/GREATEST, last=giá mới nhất", async () => {
    await svc.upsert({ productName: 'Dây sạc USB-C', spec: '1m', priceUsd: 2.0 });

    const res = await svc.upsert({ productName: 'DÂY SẠC USB-C', spec: '1M', priceUsd: 3.0 });
    expect(res).toBe('merged');

    const res2 = await svc.upsert({ productName: 'dây sạc usb-c', spec: '1m', priceUsd: 0.8 });
    expect(res2).toBe('merged');

    const row = await prisma.importGoods.findFirst({ where: { goodsKey: 'dây sạc usb-c|1m' } });
    expect(await prisma.importGoods.count()).toBe(1); // vẫn 1 dòng, không đẻ thêm
    expect(Number(row!.minDeclaredPriceUsd)).toBe(0.8); // LEAST(2.0, 3.0, 0.8)
    expect(Number(row!.maxDeclaredPriceUsd)).toBe(3.0); // GREATEST(2.0, 3.0, 0.8)
    expect(Number(row!.lastDeclaredPriceUsd)).toBe(0.8); // giá lần cuối, KHÔNG phải max
    expect(row!.timesUsed).toBe(3);
  });

  it('merge KHÔNG ghi đè trường bằng chuỗi rỗng — chỉ ghi đè khi giá trị mới KHÔNG rỗng', async () => {
    await svc.upsert({ productName: 'Bánh xe đẩy', hsCode: '87169000', declaredNameEn: 'Trolley wheel' });

    await svc.upsert({ productName: 'Bánh xe đẩy', hsCode: '', declaredNameEn: '' }); // đợt sau không có HS/tên EN

    const row = await prisma.importGoods.findFirst({ where: { goodsKey: 'bánh xe đẩy|' } });
    expect(row!.hsCode).toBe('87169000'); // vẫn giữ nguyên
    expect(row!.declaredNameEn).toBe('Trolley wheel'); // vẫn giữ nguyên
  });

  it("merge CÓ ghi đè khi giá trị mới khác rỗng", async () => {
    await svc.upsert({ productName: 'Bánh xe đẩy 2', hsCode: '87169000' });
    await svc.upsert({ productName: 'Bánh xe đẩy 2', hsCode: '87168000' });

    const row = await prisma.importGoods.findFirst({ where: { goodsKey: 'bánh xe đẩy 2|' } });
    expect(row!.hsCode).toBe('87168000');
  });

  it("source: đã 'manual' thì GIỮ NGUYÊN 'manual' dù lần ghi sau là nguồn khác", async () => {
    await svc.upsert({ productName: 'Hàng do tay nhập', source: 'manual' });
    await svc.upsert({ productName: 'Hàng do tay nhập', source: 'lark_import' });

    const row = await prisma.importGoods.findFirst({ where: { goodsKey: 'hàng do tay nhập|' } });
    expect(row!.source).toBe('manual');
  });

  it("source: KHÔNG phải 'manual' thì bị GHI ĐÈ bởi nguồn mới nhất", async () => {
    await svc.upsert({ productName: 'Hàng đồng bộ Lark', source: 'lark_import' });
    await svc.upsert({ productName: 'Hàng đồng bộ Lark', source: 'from_declaration' });

    const row = await prisma.importGoods.findFirst({ where: { goodsKey: 'hàng đồng bộ lark|' } });
    expect(row!.source).toBe('from_declaration');
  });

  // §4.8 (không dựng service duyệt HS) — nhưng nhánh KHOÁ vẫn PHẢI đúng vì nó
  // là 1 phần của HÀM upsert copy nguyên văn (gffunc.php:625: hs_status===2).
  it('⚠ hồ sơ ĐÃ DUYỆT (hs_status=2) bị KHOÁ — upsert chỉ cập nhật times_used + dải giá, KHÔNG sửa nội dung hồ sơ', async () => {
    const existing = await seedImportGoods({
      goodsKey: 'hàng đã duyệt|',
      productName: 'Hàng đã duyệt',
      hsCode: 'HS_CU',
      declaredNameEn: 'Old EN name',
      hsStatus: 2,
      timesUsed: 5,
      minDeclaredPriceUsd: 10,
      maxDeclaredPriceUsd: 20,
      lastDeclaredPriceUsd: 15,
    });

    const res = await svc.upsert({
      productName: 'Hàng đã duyệt',
      hsCode: 'HS_MOI_BI_TU_CHOI',
      declaredNameEn: 'Attempted overwrite',
      priceUsd: 5, // < min hiện tại -> phải kéo min xuống 5
    });
    expect(res).toBe('locked');

    const row = await prisma.importGoods.findUnique({ where: { id: existing.id } });
    expect(row!.hsCode).toBe('HS_CU'); // KHÔNG bị sửa
    expect(row!.declaredNameEn).toBe('Old EN name'); // KHÔNG bị sửa
    expect(row!.timesUsed).toBe(6); // +1
    expect(Number(row!.minDeclaredPriceUsd)).toBe(5); // LEAST(10,5)
    expect(Number(row!.maxDeclaredPriceUsd)).toBe(20); // GREATEST(20,5)
    expect(Number(row!.lastDeclaredPriceUsd)).toBe(5);
  });

  // fix-round-1 (coordinator, 23/09/2026): trước bản vá này, upsert() tự
  // tìm dòng đã tồn tại bằng findFirst rồi mới create/update (check-then-
  // act) — không có gì ở tầng DB ngăn HAI lượt gọi đồng thời cùng goods_key
  // cùng thấy "chưa có" rồi cùng insert. Khôi phục UNIQUE(goods_key) +
  // chuyển upsert() sang 1 câu INSERT...ON CONFLICT nguyên tử đóng đúng cửa
  // sổ race này — Postgres tự phục vụ lượt gọi thứ hai qua nhánh UPDATE của
  // CÙNG câu lệnh, không có khoảng hở giữa đọc và ghi.
  it('⚠⚠ CA THEN CHỐT — hai upsert() ĐỒNG THỜI cùng goods_key -> ĐÚNG 1 dòng, times_used=2 (không phải 2 dòng hay lỗi unique-violation lộ ra ngoài)', async () => {
    const input = { productName: 'Hàng đua race upsert', priceUsd: 7 };

    const [r1, r2] = await Promise.all([svc.upsert(input), svc.upsert(input)]);

    // Đúng 1 lượt 'inserted' (thắng cuộc đua insert) và 1 lượt 'merged'
    // (thua cuộc đua, rơi vào nhánh UPDATE của CHÍNH câu ON CONFLICT đó).
    expect([r1, r2].sort()).toEqual(['inserted', 'merged']);

    const rows = await prisma.importGoods.findMany({
      where: { goodsKey: 'hàng đua race upsert|' },
    });
    expect(rows).toHaveLength(1); // KHÔNG phải 2 dòng — đây là khẳng định trung tâm
    expect(rows[0].timesUsed).toBe(2); // insert times_used=1, merge +1 -> 2, không mất lượt tăng nào
  });

  // ═══════════════════════════════════════════════════════════════════════
  // D3 (review cuối #08, 23/09/2026) — SÁU CỘT PROD-PARITY MÀ upsert() TRƯỚC
  // ĐÂY KHÔNG GHI MỘT CỘT NÀO
  //
  // fix-round-1 thêm 7 cột vào schema "cho khớp prod" rồi người ghi DUY NHẤT
  // của module populate ĐÚNG SỐ KHÔNG trong số đó, biện minh bằng một câu
  // SAI ("không nơi nào trong ImportGoodsUpsert($row) gốc đụng tới chúng").
  // Đọc lại gffunc.php:585-662: hàm gốc ghi SÁU cột, và nhánh INSERT khác
  // nhánh UPDATE:
  //   INSERT  : origin · last_used_at=NOW() · created_by · created_at=NOW()
  //   MERGE   : origin (IF<>'') · last_used_at=NOW() · updated_by · updated_at=NOW()
  //   LOCKED  : last_used_at=NOW() (KHÔNG origin/updated_by/updated_at)
  //
  // `origin` là cột nguy hiểm nhất: cột có DEFAULT 'CN', nên thiếu nó trong
  // câu INSERT là ghi hàng Thái Lan thành hàng Trung Quốc, lặng lẽ.
  // ═══════════════════════════════════════════════════════════════════════
  describe('D3 — prod parity: origin / created_* / updated_* / last_used_at', () => {
    it('⚠⚠⚠ origin ĐI QUA được upsert: hàng xuất xứ Thái Lan phải ghi "TH", KHÔNG rơi vào DEFAULT "CN" của cột', async () => {
      const res = await svc.upsert({
        productName: 'Ghế gỗ',
        spec: '',
        hsCode: '94036090',
        source: 'lark_import',
        origin: 'TH',
      });
      expect(res).toBe('inserted');

      const row = await prisma.importGoods.findFirstOrThrow({ where: { goodsKey: 'ghế gỗ|' } });
      expect(row.origin).toBe('TH'); // KHÔNG phải 'CN'
    });

    it('⚠⚠⚠ KHÔNG truyền origin -> ghi CHUỖI RỖNG (nguyên văn trim($row["origin"] ?? "")), KHÔNG để cột rơi vào DEFAULT "CN"', async () => {
      // Đây là nửa còn lại của cùng một cái bẫy: nếu câu INSERT bỏ cột
      // `origin` ra ngoài thì Postgres điền DEFAULT 'CN' và mọi mặt hàng
      // không khai xuất xứ bỗng trở thành hàng Trung Quốc. Prod ghi '' —
      // "chưa biết", chứ không phải "Trung Quốc".
      await svc.upsert({ productName: 'Hàng chưa khai xuất xứ' });
      const row = await prisma.importGoods.findFirstOrThrow({
        where: { goodsKey: 'hàng chưa khai xuất xứ|' },
      });
      expect(row.origin).toBe('');
      expect(row.origin).not.toBe('CN');
    });

    it('⚠⚠ merge: origin chỉ GHI ĐÈ khi giá trị mới khác rỗng (IF(VALUES(origin)<>"", VALUES(origin), origin))', async () => {
      await svc.upsert({ productName: 'Máy khoan', origin: 'TH' });
      // Đợt đồng bộ sau thiếu trường xuất xứ -> KHÔNG được xoá mất 'TH'.
      await svc.upsert({ productName: 'Máy khoan' });
      let row = await prisma.importGoods.findFirstOrThrow({ where: { goodsKey: 'máy khoan|' } });
      expect(row.origin).toBe('TH');

      // Đợt sau có xuất xứ mới -> ghi đè.
      await svc.upsert({ productName: 'Máy khoan', origin: 'CN' });
      row = await prisma.importGoods.findFirstOrThrow({ where: { goodsKey: 'máy khoan|' } });
      expect(row.origin).toBe('CN');
    });

    it('⚠⚠ INSERT ghi created_by + created_at + last_used_at, và KHÔNG ghi updated_by/updated_at (hai cặp cột có nghĩa khác nhau)', async () => {
      const truoc = new Date();
      await svc.upsert({ productName: 'Hàng tạo mới có người thao tác', username: 'nv_xnk1' });
      const sau = new Date();

      const row = await prisma.importGoods.findFirstOrThrow({
        where: { goodsKey: 'hàng tạo mới có người thao tác|' },
      });
      expect(row.createdBy).toBe('nv_xnk1');
      expect(row.createdAt).not.toBeNull();
      expect(row.createdAt!.getTime()).toBeGreaterThanOrEqual(truoc.getTime() - 1000);
      expect(row.createdAt!.getTime()).toBeLessThanOrEqual(sau.getTime() + 1000);
      expect(row.lastUsedAt).not.toBeNull();
      // Dòng vừa TẠO chưa từng được SỬA — hai cột updated_* phải còn trống.
      expect(row.updatedBy).toBeNull();
      expect(row.updatedAt).toBeNull();
    });

    it('⚠⚠ MERGE ghi updated_by + updated_at + last_used_at, và KHÔNG ĐỤNG created_by/created_at của lần tạo', async () => {
      await svc.upsert({ productName: 'Hàng sửa lại', username: 'nguoi_tao' });
      const sauKhiTao = await prisma.importGoods.findFirstOrThrow({
        where: { goodsKey: 'hàng sửa lại|' },
      });

      const res = await svc.upsert({ productName: 'Hàng sửa lại', username: 'nguoi_sua' });
      expect(res).toBe('merged');

      const row = await prisma.importGoods.findUniqueOrThrow({ where: { id: sauKhiTao.id } });
      // created_* GIỮ NGUYÊN của lần tạo — đây là điều phân biệt hai cặp cột.
      expect(row.createdBy).toBe('nguoi_tao');
      expect(row.createdAt?.getTime()).toBe(sauKhiTao.createdAt?.getTime());
      // updated_* mới được điền ở lần merge này.
      expect(row.updatedBy).toBe('nguoi_sua');
      expect(row.updatedAt).not.toBeNull();
      expect(row.lastUsedAt).not.toBeNull();
    });

    it('⚠⚠ nhánh KHOÁ (hs_status=2): CHỈ last_used_at được cập nhật — origin/updated_by/updated_at KHÔNG đổi (UPDATE riêng của PHP gốc không có ba cột đó)', async () => {
      const existing = await seedImportGoods({
        goodsKey: 'hàng khoá giữ origin|',
        productName: 'Hàng khoá giữ origin',
        hsStatus: 2,
        timesUsed: 1,
        origin: 'TH',
        updatedBy: 'nguoi_cu',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdBy: 'nguoi_tao_cu',
        createdAt: new Date('2025-12-01T00:00:00.000Z'),
      });

      const res = await svc.upsert({
        productName: 'Hàng khoá giữ origin',
        origin: 'CN', // cố ghi đè xuất xứ -> phải bị TỪ CHỐI vì hồ sơ đã duyệt
        username: 'nguoi_moi',
      });
      expect(res).toBe('locked');

      const row = await prisma.importGoods.findUniqueOrThrow({ where: { id: existing.id } });
      expect(row.origin).toBe('TH'); // KHÔNG bị ghi đè thành 'CN'
      expect(row.updatedBy).toBe('nguoi_cu'); // KHÔNG đổi
      expect(row.updatedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z'); // KHÔNG đổi
      expect(row.createdBy).toBe('nguoi_tao_cu'); // KHÔNG đổi
      expect(row.timesUsed).toBe(2); // vẫn +1 (số liệu quan trắc)
      // last_used_at LÀ số liệu quan trắc -> vẫn phải được cập nhật ngay cả
      // với hồ sơ đã duyệt (gffunc.php:628).
      expect(row.lastUsedAt).not.toBeNull();
      expect(row.lastUsedAt!.getTime()).toBeGreaterThan(new Date('2026-09-01').getTime());
    });

    it('last_used_at TIẾN LÊN sau mỗi lượt upsert (số liệu quan trắc "lần cuối dùng đến mặt hàng này")', async () => {
      await svc.upsert({ productName: 'Hàng dùng nhiều lần' });
      const lan1 = await prisma.importGoods.findFirstOrThrow({
        where: { goodsKey: 'hàng dùng nhiều lần|' },
      });
      await new Promise((r) => setTimeout(r, 25));
      await svc.upsert({ productName: 'Hàng dùng nhiều lần' });
      const lan2 = await prisma.importGoods.findUniqueOrThrow({ where: { id: lan1.id } });

      expect(lan2.lastUsedAt!.getTime()).toBeGreaterThan(lan1.lastUsedAt!.getTime());
    });
  });

  describe('canhBaoGiaKhai — §4.10 cảnh báo giá khai ngoài dải [min,max]', () => {
    it('tra theo goods_id: giá THẤP hơn sàn -> below_min', async () => {
      const g = await seedImportGoods({ minDeclaredPriceUsd: 10, maxDeclaredPriceUsd: 50 });
      const r = await svc.canhBaoGiaKhai(g.id, 5);
      expect(r).toEqual({ level: 'below_min', matchedBy: 'goods', min: 10, max: 50 });
    });

    it('tra theo goods_id: giá CAO hơn trần -> above_max', async () => {
      const g = await seedImportGoods({ minDeclaredPriceUsd: 10, maxDeclaredPriceUsd: 50 });
      const r = await svc.canhBaoGiaKhai(g.id, 60);
      expect(r).toEqual({ level: 'above_max', matchedBy: 'goods', min: 10, max: 50 });
    });

    it('tra theo goods_id: giá TRONG dải (kể cả đúng biên) -> không cảnh báo', async () => {
      const g = await seedImportGoods({ minDeclaredPriceUsd: 10, maxDeclaredPriceUsd: 50 });
      expect(await svc.canhBaoGiaKhai(g.id, 30)).toEqual({ level: null, matchedBy: 'goods', min: 10, max: 50 });
      expect(await svc.canhBaoGiaKhai(g.id, 10)).toEqual({ level: null, matchedBy: 'goods', min: 10, max: 50 });
      expect(await svc.canhBaoGiaKhai(g.id, 50)).toEqual({ level: null, matchedBy: 'goods', min: 10, max: 50 });
    });

    it('goods_id không tồn tại -> không cảnh báo (phía AN TOÀN, không chặn nhập liệu vì thiếu dữ liệu tham chiếu)', async () => {
      const r = await svc.canhBaoGiaKhai(999_999, 5);
      expect(r).toEqual({ level: null, matchedBy: null, min: null, max: null });
    });

    it('chưa có dải giá lịch sử (min/max NULL) -> không cảnh báo dù giá bao nhiêu', async () => {
      const g = await seedImportGoods({});
      const r = await svc.canhBaoGiaKhai(g.id, 999);
      // ⚠ matchedBy='goods' VẪN đúng: mặt hàng CÓ khớp, chỉ là chưa có dải
      // giá. Đây là trạng thái KHÁC HẲN "không tìm thấy mặt hàng nào"
      // (matchedBy=null ở ca trên) — hai trạng thái này trước đây không
      // phân biệt được từ bên ngoài.
      expect(r).toEqual({ level: null, matchedBy: 'goods', min: null, max: null });
    });

    it('giá khai <= 0 -> không cảnh báo, không đụng DB (phía AN TOÀN, tránh chặn nhầm dòng chưa nhập giá)', async () => {
      const g = await seedImportGoods({ minDeclaredPriceUsd: 10, maxDeclaredPriceUsd: 50 });
      expect(await svc.canhBaoGiaKhai(g.id, 0)).toEqual({ level: null, matchedBy: null, min: null, max: null });
      expect(await svc.canhBaoGiaKhai(g.id, -5)).toEqual({ level: null, matchedBy: null, min: null, max: null });
    });

    it('tra theo mã HS (string): gộp dải giá MIN-của-các-min / MAX-của-các-max trên MỌI mặt hàng cùng HS', async () => {
      await seedImportGoods({ hsCode: '94032090', minDeclaredPriceUsd: 2.67, maxDeclaredPriceUsd: 10 });
      await seedImportGoods({ hsCode: '94032090', minDeclaredPriceUsd: 5, maxDeclaredPriceUsd: 62.8 });
      await seedImportGoods({ hsCode: 'KHAC_HS', minDeclaredPriceUsd: 1000, maxDeclaredPriceUsd: 2000 });

      const r = await svc.canhBaoGiaKhai('94032090', 1);
      expect(r).toEqual({ level: 'below_min', matchedBy: 'hs', min: 2.67, max: 62.8 });
    });

    it('tra theo mã HS không có mặt hàng nào -> không cảnh báo', async () => {
      const r = await svc.canhBaoGiaKhai('00000000', 100);
      expect(r).toEqual({ level: null, matchedBy: null, min: null, max: null });
    });

    // ═══ Ruling 3 (review cuối #08) ═══════════════════════════════════════
    // `canhBaoGiaKhai()` CỐ Ý không tự chấm màu: prod có HAI chính sách khác
    // nhau dùng chung dải giá này (process_ai_check.php nới 0.5x/2x cho
    // severity AI-check · cls.pipeline.php so trực tiếp NHƯNG chấm "khớp
    // đúng mặt hàng" = ĐỎ và "chỉ khớp theo HS" = VÀNG). Trả biên thô là
    // đúng — nhưng nếu kết quả không nói NGUỒN của dải thì bên gọi KHÔNG
    // THỂ tái hiện cách chấm của cls.pipeline.php. `matchedBy` đóng đúng lỗ
    // đó.
    it('⚠⚠ Ruling 3 — matchedBy PHÂN BIỆT dải của ĐÚNG mặt hàng ("goods") với dải GỘP theo mã HS ("hs"), là thứ prod chấm hai mức khác nhau', async () => {
      // CÙNG một mặt hàng, CÙNG một giá khai, tra bằng hai đường -> cùng
      // level nhưng KHÁC nguồn. Dải của riêng mặt hàng [10,50]; dải gộp
      // theo HS rộng hơn vì có mặt hàng thứ hai [1,100].
      const g = await seedImportGoods({
        hsCode: '85044090',
        minDeclaredPriceUsd: 10,
        maxDeclaredPriceUsd: 50,
      });
      await seedImportGoods({
        hsCode: '85044090',
        minDeclaredPriceUsd: 1,
        maxDeclaredPriceUsd: 100,
      });

      const theoMatHang = await svc.canhBaoGiaKhai(g.id, 5);
      const theoHs = await svc.canhBaoGiaKhai('85044090', 5);

      // Khớp ĐÚNG mặt hàng: 5 < 10 -> cảnh báo, nguồn 'goods' (prod: ĐỎ).
      expect(theoMatHang).toEqual({ level: 'below_min', matchedBy: 'goods', min: 10, max: 50 });
      // Khớp theo HS: dải gộp [1,100] nên 5 nằm TRONG dải -> không cảnh
      // báo, nhưng nguồn vẫn là 'hs' (prod: mức VÀNG khi có cảnh báo).
      expect(theoHs).toEqual({ level: null, matchedBy: 'hs', min: 1, max: 100 });

      // ⚠ Khẳng định TRUNG TÂM: hai đường tra KHÔNG thể lẫn vào nhau.
      expect(theoMatHang.matchedBy).not.toBe(theoHs.matchedBy);
    });
  });
});
