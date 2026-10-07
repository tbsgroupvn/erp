// rowCells() — so 9 ô giữa một PoItem và QuoteItem đã ghép cặp qua
// PoItem.quoteItemId. Hàm THUẦN (không DB) — mọi input là object literal,
// không cần seed Postgres. Xem contract ở
// docs/rewrite-spec/plans/2026-09-23-06-po-plan.md mục "⚠ Hợp đồng
// `quote_po_diff`" (chép từ libs/quote_po_diff.php, 441 dòng).
import {
  rowCells,
  FIELDS_CHAN,
  QPD_EPS_MONEY,
  QPD_EPS_PCT,
  QPD_EPS_QTY,
} from '../../src/po/quote-po-diff.service';

/** PoItem tối thiểu cho rowCells — mọi test override phần cần. */
function poItem(overrides: Partial<Parameters<typeof rowCells>[0]> = {}) {
  return {
    quantity: 10,
    unitPrice: 100000,
    amount: 1000000,
    vatRate: 8, // PHẦN TRĂM
    hsCode: 'HS1234',
    origin: 'CN',
    productName: 'Áo thun',
    unit: 'cái',
    ...overrides,
  };
}

/** QuoteItem tối thiểu cho rowCells — mọi test override phần cần. */
function quoteItem(overrides: Partial<Parameters<typeof rowCells>[1]> = {}) {
  return {
    qty: 10,
    unitPriceNovatVnd: 100000,
    vatPct: 0.08, // PHÂN SỐ
    hsCode: 'HS1234',
    origin: 'CN',
    nameVn: 'Áo thun',
    unit: 'cái',
    ...overrides,
  };
}

describe('rowCells() — Task 3 #06 (QuotePoDiffService)', () => {
  it('FIELDS_CHAN đúng 7 ô, KHÔNG có product_name/unit (thêm 07/09, cố ý chỉ cảnh báo)', () => {
    expect(FIELDS_CHAN).toEqual([
      'quantity', 'unit_price', 'amount', 'vat_rate', 'vat_money', 'hs_code', 'origin',
    ]);
    expect(FIELDS_CHAN).not.toContain('product_name');
    expect(FIELDS_CHAN).not.toContain('unit');
  });

  // ═══ BẪY 1 — đơn vị %VAT ngược nhau (lỗi 100×) ═══════════════════════
  describe('cổng gác đơn vị %VAT (BẪY 1)', () => {
    it('PO vat_rate=8 (phần trăm) vs quote vat_pct=0.08 (phân số) ⇒ KHÔNG lệch', () => {
      const cells = rowCells(
        poItem({ vatRate: 8 }),
        quoteItem({ vatPct: 0.08 }),
      );
      expect(cells.vat_rate.po).toBe(8);
      expect(cells.vat_rate.quote).toBe(8); // quy đổi 0.08 × 100 = 8
      expect(cells.vat_rate.diff).toBe(false);
    });

    it('PO vat_rate=0.08 (gõ NHẦM phân số thay vì %) vs quote vat_pct=0.08 ⇒ CÓ lệch — bắt đúng lỗi 100×', () => {
      const cells = rowCells(
        poItem({ vatRate: 0.08 }),
        quoteItem({ vatPct: 0.08 }),
      );
      expect(cells.vat_rate.po).toBe(0.08);
      expect(cells.vat_rate.quote).toBe(8);
      expect(cells.vat_rate.diff).toBe(true);
    });
  });

  // ═══ BẪY 2 — không được đọc quote_items.vat_amount ═══════════════════
  describe('cổng gác nền VAT (BẪY 2) — quote_items.vat_amount TUYỆT ĐỐI không được đọc', () => {
    it('vat_money phía quote phải được TÍNH từ nền doanh thu (amount × vat_pct), KHÔNG bằng cột vat_amount (nền nhập khẩu)', () => {
      // qi.vatAmount mô phỏng cột VAT-khâu-nhập trên nền
      // (amount_vnd + cước + thuế NK) × vat_pct — một con số hoàn toàn khác,
      // cố tình đặt rất xa kết quả đúng để lộ ra ngay nếu code đọc nhầm cột.
      const qi = { ...quoteItem({ qty: 10, unitPriceNovatVnd: 100000, vatPct: 0.08 }), vatAmount: 999999999 };
      const cells = rowCells(poItem({ amount: 1000000 }), qi);

      const amountQuoteExpected = 10 * 100000; // round(qty × unitPriceNovatVnd, 2)
      const vatMoneyQuoteExpected = amountQuoteExpected * 0.08; // TÍNH trên nền doanh thu

      expect(cells.vat_money.quote).toBe(vatMoneyQuoteExpected);
      expect(cells.vat_money.quote).toBe(80000);
      // Khẳng định trực tiếp: KHÔNG bằng cột vat_amount (nền nhập khẩu, decoy).
      // Đọc nhầm cột này chặn sạch hoá đơn ngày đầu — đây là cổng gác cho lỗi đó.
      expect(cells.vat_money.quote).not.toBe(qi.vatAmount);
    });
  });

  // ═══ Ngưỡng EPS ════════════════════════════════════════════════════
  describe('ngưỡng EPS đúng biên', () => {
    it(`tiền: lệch 0.4đ (< EPS_MONEY=${QPD_EPS_MONEY}) ⇒ không lệch`, () => {
      const cells = rowCells(
        poItem({ unitPrice: 100000 }),
        quoteItem({ unitPriceNovatVnd: 100000.4 }),
      );
      expect(cells.unit_price.diff).toBe(false);
    });

    it(`tiền: lệch 0.6đ (> EPS_MONEY=${QPD_EPS_MONEY}) ⇒ lệch`, () => {
      const cells = rowCells(
        poItem({ unitPrice: 100000 }),
        quoteItem({ unitPriceNovatVnd: 100000.6 }),
      );
      expect(cells.unit_price.diff).toBe(true);
    });

    it(`%: lệch 0.0008 (< EPS_PCT=${QPD_EPS_PCT}) ⇒ không lệch`, () => {
      const cells = rowCells(
        poItem({ vatRate: 8.0008 }),
        quoteItem({ vatPct: 0.08 }), // quy đổi = 8.0000
      );
      expect(cells.vat_rate.diff).toBe(false);
    });

    it(`%: lệch 0.0012 (> EPS_PCT=${QPD_EPS_PCT}) ⇒ lệch`, () => {
      const cells = rowCells(
        poItem({ vatRate: 8.0012 }),
        quoteItem({ vatPct: 0.08 }),
      );
      expect(cells.vat_rate.diff).toBe(true);
    });

    it(`SL: lệch 0.00005 (< EPS_QTY=${QPD_EPS_QTY}) ⇒ không lệch`, () => {
      const cells = rowCells(
        poItem({ quantity: 10.00005 }),
        quoteItem({ qty: 10 }),
      );
      expect(cells.quantity.diff).toBe(false);
    });

    it(`SL: lệch 0.00015 (> EPS_QTY=${QPD_EPS_QTY}) ⇒ lệch`, () => {
      const cells = rowCells(
        poItem({ quantity: 10.00015 }),
        quoteItem({ qty: 10 }),
      );
      expect(cells.quantity.diff).toBe(true);
    });
  });

  // ═══ product_name / unit — CẢNH BÁO, không CHẶN ═══════════════════
  describe('product_name/unit — ô rỗng một bên KHÔNG tính lệch', () => {
    it('product_name: PO rỗng, quote có giá trị ⇒ không lệch', () => {
      const cells = rowCells(
        poItem({ productName: '' }),
        quoteItem({ nameVn: 'Áo thun nam' }),
      );
      expect(cells.product_name.diff).toBe(false);
    });

    it('product_name: PO rỗng (khoảng trắng), quote có giá trị ⇒ không lệch (trim trước khi so)', () => {
      const cells = rowCells(
        poItem({ productName: '   ' }),
        quoteItem({ nameVn: 'Áo thun nam' }),
      );
      expect(cells.product_name.diff).toBe(false);
    });

    it('product_name: hai bên đều có giá trị và KHÁC nhau ⇒ lệch', () => {
      const cells = rowCells(
        poItem({ productName: 'Áo thun' }),
        quoteItem({ nameVn: 'Áo sơ mi' }),
      );
      expect(cells.product_name.diff).toBe(true);
    });

    it('unit: quote rỗng, PO có giá trị ⇒ không lệch', () => {
      const cells = rowCells(
        poItem({ unit: 'cái' }),
        quoteItem({ unit: '' }),
      );
      expect(cells.unit.diff).toBe(false);
    });

    it('unit: hai bên đều có giá trị và khác nhau ⇒ lệch', () => {
      const cells = rowCells(
        poItem({ unit: 'cái' }),
        quoteItem({ unit: 'bộ' }),
      );
      expect(cells.unit.diff).toBe(true);
    });
  });

  // ═══ vat_rate NULL bên PO ═══════════════════════════════════════════
  describe('vat_rate NULL bên PO (prod có 2 dòng)', () => {
    it('coi như 0, không NaN ở vat_rate lẫn vat_money', () => {
      const cells = rowCells(
        poItem({ vatRate: null as any, amount: 1000000 }),
        quoteItem({ vatPct: 0 }),
      );
      expect(cells.vat_rate.po).toBe(0);
      expect(Number.isNaN(cells.vat_rate.po)).toBe(false);
      expect(Number.isNaN(cells.vat_rate.diff ? 0 : cells.vat_money.po)).toBe(false);
      expect(cells.vat_money.po).toBe(0);
      expect(Number.isNaN(cells.vat_money.po)).toBe(false);
      expect(cells.vat_rate.diff).toBe(false); // 0 vs 0 -> không lệch
    });
  });

  it('sanity: hai bên khớp hoàn toàn ⇒ không ô nào lệch (kể cả hs_code/origin)', () => {
    const cells = rowCells(poItem(), quoteItem());
    for (const f of Object.keys(cells) as (keyof typeof cells)[]) {
      expect(cells[f].diff).toBe(false);
    }
  });
});
