// compare(poId) — ghép cặp PO↔báo giá qua liên kết `Quote.poId` (báo giá
// trỏ VỀ PO — chiều đúng, xem sửa 23/09/2026 sau review), rồi ghép item qua
// PoItem.quoteItemId, phân loại lệch cấu trúc, tổng CÓ THUẾ chỉ trên dòng
// ghép cặp. Xem contract ở docs/rewrite-spec/plans/2026-09-23-06-po-plan.md
// mục "⚠ Hợp đồng `quote_po_diff`" + khối comment đầu
// src/po/quote-po-diff.service.ts.
import { prisma } from '../helpers/db';
import { resetPo, seedPo, seedPoItem } from '../helpers/po-db';
import { resetQuote, seedQuote, seedItem } from '../helpers/quote-db';
import { QuotePoDiffService } from '../../src/po/quote-po-diff.service';
import { PoStatus } from '../../src/po/po.constants';

const svc = new QuotePoDiffService(prisma as any);

describe('QuotePoDiffService.compare() — Task 4 #06', () => {
  beforeEach(async () => {
    await resetPo();
    await resetQuote();
  });
  afterAll(() => prisma.$disconnect());

  // ═══ PO chưa duyệt ⇒ rỗng ═══════════════════════════════════════════
  it('PO status 0/1/2 (chưa duyệt) ⇒ trả rỗng — hệ cũ còn chạy syncFromQuote() ngược chiều mỗi lần lưu báo giá, hai chiều cùng sống là giằng co nhau', async () => {
    for (const status of [PoStatus.NHAP, PoStatus.CHO_LEADER, PoStatus.CHO_TPKD]) {
      const po = await seedPo(`PO-EMPTY-${status}`, { status });
      const cmp = await svc.compare(po.id);
      expect(cmp.quoteId).toBeNull();
      expect(cmp.rows).toEqual([]);
      expect(cmp.structural).toEqual([]);
      expect(cmp.hasDiff).toBe(false);
      expect(cmp.nDiff).toBe(0);
      expect(cmp.totals).toEqual({ po: 0, quote: 0, delta: 0 });
    }
  });

  // ═══ PO không tồn tại ⇒ rỗng, KHÔNG throw ═══════════════════════════
  it('poId không tồn tại ⇒ trả rỗng, KHÔNG throw — cổng CHẶN hoá đơn không phải validator input', async () => {
    const cmp = await svc.compare(999999999);
    expect(cmp.poId).toBe(999999999);
    expect(cmp.poCode).toBe('');
    expect(cmp.quoteId).toBeNull();
    expect(cmp.rows).toEqual([]);
    expect(cmp.structural).toEqual([]);
    expect(cmp.hasDiff).toBe(false);
    expect(cmp.totals).toEqual({ po: 0, quote: 0, delta: 0 });
  });

  // ═══ PO đã duyệt nhưng không có báo giá nào trỏ tới ⇒ rỗng ══════════
  it('PO đã duyệt nhưng không có báo giá nào có Quote.poId trỏ tới ⇒ trả rỗng', async () => {
    const po = await seedPo('PO-NO-QUOTE', { status: PoStatus.DA_DUYET });
    const cmp = await svc.compare(po.id);
    expect(cmp.poCode).toBe('PO-NO-QUOTE');
    expect(cmp.quoteId).toBeNull();
    expect(cmp.rows).toEqual([]);
    expect(cmp.structural).toEqual([]);
  });

  // ═══ Nhiều báo giá cùng trỏ một PO (Quote.poId) ═══════════════════════
  it('nhiều báo giá cùng có Quote.poId trỏ về một PO ⇒ lấy id LỚN NHẤT (bản mới nhất thắng)', async () => {
    const po = await seedPo('PO-MULTI-QUOTE', { status: PoStatus.DA_DUYET });
    const quoteOld = await seedQuote('BG-OLD-001', { poId: po.id });
    const quoteNew = await seedQuote('BG-NEW-002', { poId: po.id }); // seed SAU -> id lớn hơn
    expect(quoteNew.id).toBeGreaterThan(quoteOld.id);

    const cmp = await svc.compare(po.id);
    expect(cmp.quoteId).toBe(quoteNew.id); // bản mới nhất thắng, KHÔNG phải quoteOld
  });

  // ═══ PoItem trỏ vào item của báo giá KHÔNG canonical ═════════════════
  it('PoItem trỏ vào item của báo giá KHÔNG canonical (cũ hơn, cũng poId=PO này) ⇒ quote_missing; item báo giá đó KHÔNG xuất hiện là quote_only', async () => {
    const po = await seedPo('PO-STALE-QUOTE', { status: PoStatus.DA_DUYET });
    const quoteOld = await seedQuote('BG-STALE-OLD', { poId: po.id });
    const quoteNew = await seedQuote('BG-STALE-NEW', { poId: po.id }); // canonical (id lớn hơn)
    expect(quoteNew.id).toBeGreaterThan(quoteOld.id);

    const oldItem = await seedItem(quoteOld.id);
    const newItem = await seedItem(quoteNew.id, { qty: 10, unitPriceNovatVnd: 100000, vatPct: 0.08 });

    // dòng 1 vẫn còn trỏ về báo giá CŨ (chưa được cập nhật lại theo bản mới)
    const staleItem = await seedPoItem(po.id, {
      sortOrder: 1, quoteItemId: oldItem.id, quantity: 1, unitPrice: 1, amount: 1,
    });
    // dòng 2 trỏ về báo giá canonical — ghép cặp bình thường
    await seedPoItem(po.id, {
      sortOrder: 2, quoteItemId: newItem.id,
      quantity: 10, unitPrice: 100000, amount: 1000000, vatRate: 8,
    });

    const cmp = await svc.compare(po.id);
    expect(cmp.quoteId).toBe(quoteNew.id);
    expect(cmp.rows).toHaveLength(1);
    expect(cmp.rows[0].quoteItemId).toBe(newItem.id);
    expect(cmp.structural).toContainEqual(
      expect.objectContaining({ kind: 'quote_missing', poItemId: staleItem.id, quoteItemId: oldItem.id }),
    );
    // oldItem thuộc báo giá KHÔNG canonical -> KHÔNG nằm trong tập item của
    // báo giá canonical -> không thể xuất hiện như quote_only.
    expect(
      cmp.structural.some((s) => s.kind === 'quote_only' && s.quoteItemId === oldItem.id),
    ).toBe(false);
  });

  // ═══ Không PoItem nào có quoteItemId ⇒ mọi item báo giá là quote_only ═
  it('PO có báo giá liên kết nhưng KHÔNG PoItem nào có quoteItemId ⇒ mọi item báo giá là quote_only, kết quả KHÔNG rỗng', async () => {
    const po = await seedPo('PO-NO-LINK', { status: PoStatus.DA_DUYET });
    const quote = await seedQuote('BG-NO-LINK', { poId: po.id });
    const item1 = await seedItem(quote.id, { sortOrder: 1 });
    const item2 = await seedItem(quote.id, { sortOrder: 2 });
    await seedPoItem(po.id, { sortOrder: 1, quoteItemId: null });
    await seedPoItem(po.id, { sortOrder: 2, quoteItemId: null });

    const cmp = await svc.compare(po.id);
    expect(cmp.quoteId).toBe(quote.id); // báo giá VẪN được tìm thấy qua Quote.poId
    expect(cmp.rows).toEqual([]);
    expect(cmp.structural).toContainEqual(expect.objectContaining({ kind: 'quote_only', quoteItemId: item1.id }));
    expect(cmp.structural).toContainEqual(expect.objectContaining({ kind: 'quote_only', quoteItemId: item2.id }));
    // đây chính là ca trước đây bị bỏ lọt (âm thầm trả rỗng) — giờ PHẢI
    // KHÔNG rỗng: có báo giá liên kết, có lệch cấu trúc.
    expect(cmp.hasDiff).toBe(true);
    expect(cmp.nDiff).toBeGreaterThan(0);
  });

  // ═══ Ba loại lệch cấu trúc ═══════════════════════════════════════════
  it('ba loại lệch cấu trúc: po_only · quote_missing · quote_only', async () => {
    const po = await seedPo('PO-STRUCT-001', { status: PoStatus.DA_DUYET });
    const quote = await seedQuote('BG-STRUCT-001', { poId: po.id });
    const pairedQuoteItem = await seedItem(quote.id, { sortOrder: 1 });
    const orphanQuoteItem = await seedItem(quote.id, { sortOrder: 2 }); // không ai trỏ tới

    const pairedPoItem = await seedPoItem(po.id, {
      sortOrder: 1, quoteItemId: pairedQuoteItem.id,
      quantity: 10, unitPrice: 100000, amount: 1000000, vatRate: 8,
    });
    const poOnlyItem = await seedPoItem(po.id, { sortOrder: 2, quoteItemId: null });
    const quoteMissingItem = await seedPoItem(po.id, { sortOrder: 3, quoteItemId: 999999 });

    const cmp = await svc.compare(po.id);

    expect(cmp.rows).toHaveLength(1);
    expect(cmp.rows[0].poItemId).toBe(pairedPoItem.id);
    expect(cmp.rows[0].quoteItemId).toBe(pairedQuoteItem.id);

    expect(cmp.structural).toContainEqual(
      expect.objectContaining({ kind: 'po_only', poItemId: poOnlyItem.id }),
    );
    expect(cmp.structural).toContainEqual(
      expect.objectContaining({ kind: 'quote_missing', poItemId: quoteMissingItem.id, quoteItemId: 999999 }),
    );
    expect(cmp.structural).toContainEqual(
      expect.objectContaining({ kind: 'quote_only', quoteItemId: orphanQuoteItem.id }),
    );
    expect(cmp.structural).toHaveLength(3);
  });

  // ═══ Tổng CHỈ trên dòng ghép cặp ═════════════════════════════════════
  it('tổng CHỈ cộng dòng ghép cặp — dòng lệch cấu trúc (po_only) KHÔNG vào tổng', async () => {
    const po = await seedPo('PO-TOTALS-001', { status: PoStatus.DA_DUYET });
    const quote = await seedQuote('BG-TOTALS-001', { poId: po.id });
    const qi = await seedItem(quote.id, {
      qty: 10, unitPriceNovatVnd: 100000, vatPct: 0.08, // amount=1,000,000 vat=80,000
    });

    await seedPoItem(po.id, {
      sortOrder: 1, quoteItemId: qi.id,
      quantity: 10, unitPrice: 100000, amount: 1000000, vatRate: 8, // vat=80,000
    });
    // dòng po_only — số tiền khổng lồ, PHẢI bị loại khỏi tổng
    await seedPoItem(po.id, {
      sortOrder: 2, quoteItemId: null,
      quantity: 1, unitPrice: 999999999, amount: 999999999,
    });

    const cmp = await svc.compare(po.id);
    expect(cmp.structural.some((s) => s.kind === 'po_only')).toBe(true);
    // tổng có thuế của DUY NHẤT dòng ghép cặp: 1,000,000 + 80,000 = 1,080,000
    expect(cmp.totals.po).toBe(1080000);
    expect(cmp.totals.quote).toBe(1080000);
    expect(cmp.totals.delta).toBe(0);
  });

  // ═══ Hồi quy lỗi 14/08: tổng phải tính TRÊN NỀN CÓ THUẾ ═══════════════
  it('hồi quy 14/08: cùng SL + cùng đơn giá chưa VAT nhưng KHÁC %VAT ⇒ delta KHÁC 0 (nếu chỉ cộng amount ex-VAT thì ra 0 — đúng lỗi cũ)', async () => {
    const po = await seedPo('PO-REGRESSION-1408', { status: PoStatus.DA_DUYET });
    const quote = await seedQuote('BG-REGRESSION-1408', { poId: po.id });
    // quote %VAT = 10%, PO %VAT = 8% — cùng SL=10, cùng đơn giá ex-VAT=100.000
    const qi = await seedItem(quote.id, {
      qty: 10, unitPriceNovatVnd: 100000, vatPct: 0.10,
    });

    await seedPoItem(po.id, {
      sortOrder: 1, quoteItemId: qi.id,
      quantity: 10, unitPrice: 100000, amount: 1000000, vatRate: 8,
    });

    const cmp = await svc.compare(po.id);
    // ex-VAT hai bên bằng nhau tuyệt đối — nếu tổng chỉ cộng `amount` (lỗi
    // cũ trước 14/08), delta sẽ là 0 ngay tại đây dù VAT lệch 20.000đ.
    expect(cmp.rows[0].cells.amount.diff).toBe(false);
    expect(cmp.rows[0].cells.vat_rate.diff).toBe(true); // 8% vs 10% — có lệch %VAT

    // tổng CÓ THUẾ: PO = 1.000.000 + 80.000 = 1.080.000;
    // quote = 1.000.000 + 100.000 = 1.100.000 ⇒ delta = -20.000, KHÁC 0.
    expect(cmp.totals.po).toBe(1080000);
    expect(cmp.totals.quote).toBe(1100000);
    expect(cmp.totals.delta).not.toBe(0);
    expect(cmp.totals.delta).toBe(-20000);
    expect(cmp.hasDiff).toBe(true);
  });

  it('poCode trả đúng theo PO đang so, kể cả khi rỗng (chưa duyệt)', async () => {
    const po = await seedPo('PO-CODE-CHECK', { status: PoStatus.NHAP });
    const cmp = await svc.compare(po.id);
    expect(cmp.poId).toBe(po.id);
    expect(cmp.poCode).toBe('PO-CODE-CHECK');
  });
});
