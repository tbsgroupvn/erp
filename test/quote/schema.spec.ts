import { prisma } from '../helpers/db';
import { resetQuote, seedQuote, seedItem } from '../helpers/quote-db';

describe('Quote schema (#05 báo giá — 4 bảng)', () => {
  beforeEach(async () => {
    await resetQuote();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('tạo Quote + QuoteItem, đọc lại đúng quan hệ', async () => {
    const quote = await seedQuote('BG-TEST-0001');
    const item = await seedItem(quote.id);

    const found = await prisma.quote.findUnique({
      where: { id: quote.id },
      include: { items: true },
    });
    expect(found).not.toBeNull();
    expect(found!.items).toHaveLength(1);
    expect(found!.items[0].id).toBe(item.id);
  });

  it('quoteCode là UNIQUE — trùng mã phải bị chặn', async () => {
    await seedQuote('BG-TEST-0002');
    await expect(seedQuote('BG-TEST-0002')).rejects.toThrow();
  });

  it('⚠ QuoteFee giữ 3 số lẻ — KHÔNG bị làm tròn về 2 (bẫy đã cắn thật ở hệ cũ)', async () => {
    const quote = await seedQuote('BG-TEST-0003');
    const fee = await prisma.quoteFee.create({
      data: {
        quoteId: quote.id,
        qty: 1,
        unitPrice: '1234.567',
        amountNovat: '1234.567',
        vatPct: 0,
        vatAmount: 0,
        amountTotal: '9876.543',
      },
    });

    const reread = await prisma.quoteFee.findUniqueOrThrow({ where: { id: fee.id } });
    // Prisma trả Decimal (decimal.js), so sánh bằng .toString() để tránh
    // sai lệch nổi (float) khi ép qua Number — xem test/gl.spec.ts để biết
    // quy ước Number()+toBeCloseTo, ở đây cần CHÍNH XÁC tuyệt đối nên dùng toString().
    expect(reread.unitPrice.toString()).toBe('1234.567');
    expect(reread.amountTotal.toString()).toBe('9876.543');
  });

  it('thuế suất item lưu dạng PHÂN SỐ — 0.08 đọc lại phải là 0.08, không phải 8', async () => {
    const quote = await seedQuote('BG-TEST-0004');
    const item = await seedItem(quote.id, { vatPct: '0.08', importTaxPct: '0.05' });

    const reread = await prisma.quoteItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.vatPct.toString()).toBe('0.08');
    expect(Number(reread.vatPct)).toBeCloseTo(0.08, 6);
    expect(Number(reread.importTaxPct)).toBeCloseTo(0.05, 6);
  });

  // F1 — production QuoteItem.cbm là decimal(14,4), KHÔNG phải (14,2). Golden
  // case C tự bản thân carry cbm=0.1479 (4 số lẻ) — cột (14,2) sẽ âm thầm
  // làm tròn về 0.15 lúc ghi, mất dữ liệu thật (86/1894 dòng prod bị ảnh
  // hưởng — xem review F1).
  it('⚠⚠ QuoteItem.cbm giữ 4 số lẻ — KHÔNG bị làm tròn về 2 (golden C: 0.1479) (F1)', async () => {
    const quote = await seedQuote('BG-TEST-0005');
    const item = await seedItem(quote.id, { cbm: '0.1479' });

    const reread = await prisma.quoteItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.cbm.toString()).toBe('0.1479');
  });

  // F3 — production tbl_quote_items.detail_auto (1892/1894 dòng có nội dung)
  // và antidumping_expire chưa có model — round-trip để pin không bị rớt.
  it('QuoteItem.detailAuto/antidumpingExpire round-trip (F3, cột prod)', async () => {
    const quote = await seedQuote('BG-TEST-0006');
    const item = await seedItem(quote.id, {
      detailAuto: 'Tự nhận: đồng hồ đeo tay, dây da, mặt kính',
      antidumpingExpire: new Date('2027-01-01T00:00:00.000Z'),
    });

    const reread = await prisma.quoteItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.detailAuto).toBe('Tự nhận: đồng hồ đeo tay, dây da, mặt kính');
    expect(reread.antidumpingExpire?.toISOString().slice(0, 10)).toBe('2027-01-01');
  });

  // F3 — production tbl_quotes.delivery_expected/delivery_deadline (22 dòng
  // có nội dung) chưa có model.
  it('Quote.deliveryExpected/deliveryDeadline round-trip (F3, cột prod)', async () => {
    const quote = await seedQuote('BG-TEST-0007', {
      deliveryExpected: '7-10 ngày làm việc',
      deliveryDeadline: '15 ngày kể từ ngày đặt cọc',
    });

    const reread = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(reread.deliveryExpected).toBe('7-10 ngày làm việc');
    expect(reread.deliveryDeadline).toBe('15 ngày kể từ ngày đặt cọc');
  });

  it('FeeCatalog.feeCode là UNIQUE', async () => {
    await prisma.feeCatalog.create({ data: { feeCode: 'CUOC_NOI_DIA', nameVn: 'Cước nội địa TQ' } });
    await expect(
      prisma.feeCatalog.create({ data: { feeCode: 'CUOC_NOI_DIA', nameVn: 'trùng' } }),
    ).rejects.toThrow();
  });

  // F4 — FeeCatalog trước đây đổi hết tên cột và bỏ mất 9 cột so với prod
  // tbl_fee_catalog (17 cột). Exercising các cột trước đây THIẾU: cột nào
  // không tồn tại sẽ làm TypeScript compile lỗi ngay tại test này.
  it('FeeCatalog khớp cột prod tbl_fee_catalog — exercising cột trước đây thiếu (F4)', async () => {
    const fc = await prisma.feeCatalog.create({
      data: {
        feeCode: 'CUOC_NOI_DIA',
        nameVn: 'Cước nội địa TQ',
        nameEn: 'Domestic freight CN',
        leg: 'cn',
        basis: 'per_kg',
        pctBase: 'amount_vnd',
        defaultUnit: 'kg',
        defaultPrice: '12000.567',
        defaultVatPct: '0.08',
        appliesMode: 'auto',
        explainVn: 'Tính theo cân nặng thực tế',
        defaultIncluded: 1,
        sortOrder: 3,
        isactive: 1,
      },
    });

    const reread = await prisma.feeCatalog.findUniqueOrThrow({ where: { id: fc.id } });
    expect(reread.feeCode).toBe('CUOC_NOI_DIA');
    expect(reread.nameVn).toBe('Cước nội địa TQ');
    expect(reread.nameEn).toBe('Domestic freight CN');
    expect(reread.defaultUnit).toBe('kg');
    expect(reread.defaultPrice?.toString()).toBe('12000.567');
    expect(reread.defaultVatPct?.toString()).toBe('0.08');
    expect(reread.appliesMode).toBe('auto');
    expect(reread.explainVn).toBe('Tính theo cân nặng thực tế');
    expect(reread.defaultIncluded).toBe(1);
    expect(reread.sortOrder).toBe(3);
    expect(reread.isactive).toBe(1);
  });
});
