import { calcItem } from '../../src/quote/quote-calc';

describe('calcItem — #05 báo giá, nhánh nền VAT CŨ (vat_base_full=0)', () => {
  // Bộ số vàng đo trên prod 23/09/2026, khớp CLS_QUOTE::calcItem thật từng đồng.
  // Xem F:/01_TBS_GROUP/docs/rewrite-spec/plans/2026-09-23-05-bao-gia-plan.md
  // mục "⚠ SỐ HỌC" + "BỘ SỐ VÀNG".

  it('golden C (id 61717): nhánh CŨ — HAI con số VAT cùng tồn tại, cố ý khác nhau', () => {
    const r = calcItem(
      {
        qty: 30,
        unitPriceRmb: 26,
        domesticShipRmb: 40,
        weightKg: 55,
        cbm: 0.1479,
        importTaxPct: 0,
        consumptionTaxPct: 0,
        antidumpingPct: 0,
        envtaxAmount: 0,
        vatPct: 0.08,
        qcCost: 0,
        otherCost: 0,
      },
      {
        rateRmbVnd: 3975,
        rateUsdVnd: 0,
        currencyMode: 'rmb',
        freightVnPerKg: 6500,
        freightVnPerCbm: 1300000,
        entrustFeePct: 0.03,
        entrustBase: 'full',
        fxBufferPct: 0,
        vatBaseFull: false,
        vatExclService: false,
      },
    );
    expect(r.amountVnd).toBe(3_259_500);
    expect(r.shipToVnVnd).toBe(357_500);
    expect(r.shipBy).toBe('kg');
    expect(r.importFeeVnd).toBe(0);
    expect(r.consumptionTaxVnd).toBe(0);
    expect(r.antidumpingVnd).toBe(0);
    expect(r.envtaxVnd).toBe(0);
    expect(r.entrustFeeVnd).toBeCloseTo(117_190.8, 4);
    expect(r.fxBufferVnd).toBe(0);
    expect(r.unitPriceNovatVnd).toBe(124_184);
    expect(r.baseInvoice).toBe(3_725_520);
    expect(r.totalVnd).toBe(4_023_562);
    expect(r.unitPriceVnd).toBeCloseTo(134_118.73, 2);

    // ⚠⚠ Ca then chốt của nhánh CŨ — HAI con số VAT, KHÔNG được gộp.
    expect(r.vatAmount).toBe(289_360); // VAT khâu NHẬP KHẨU (t5.vat) — KHÔNG bị ghi đè
    expect(r.vatInvoice).toBe(298_042); // VAT HOÁ ĐƠN (trên nền unitPriceNovatVnd đã làm tròn)
    expect(r.vatAmount).not.toBe(r.vatInvoice); // CỐ Ý khác nhau — gộp là sai, đụng số của 55 PO đã duyệt
  });

  it('golden D (id 61716): nhánh CŨ, qty=500, đơn giá RMB lẻ 0.7', () => {
    const r = calcItem(
      {
        qty: 500,
        unitPriceRmb: 0.7,
        domesticShipRmb: 21,
        weightKg: 20,
        cbm: 0,
        importTaxPct: 0,
        consumptionTaxPct: 0,
        antidumpingPct: 0,
        envtaxAmount: 0,
        vatPct: 0.08,
        qcCost: 0,
        otherCost: 0,
      },
      {
        rateRmbVnd: 3975,
        rateUsdVnd: 0,
        currencyMode: 'rmb',
        freightVnPerKg: 6500,
        freightVnPerCbm: 1300000,
        entrustFeePct: 0.03,
        entrustBase: 'full',
        fxBufferPct: 0,
        vatBaseFull: false,
        vatExclService: false,
      },
    );
    expect(r.amountVnd).toBe(1_474_725);
    expect(r.shipToVnVnd).toBe(130_000);
    expect(r.shipBy).toBe('kg');
    expect(r.importFeeVnd).toBe(0);
    expect(r.consumptionTaxVnd).toBe(0);
    expect(r.antidumpingVnd).toBe(0);
    expect(r.envtaxVnd).toBe(0);
    expect(r.entrustFeeVnd).toBeCloseTo(51_993.09, 4);
    expect(r.fxBufferVnd).toBe(0);
    expect(r.unitPriceNovatVnd).toBe(3_306);
    expect(r.baseInvoice).toBe(1_653_000);
    expect(r.vatInvoice).toBe(132_240);
    expect(r.totalVnd).toBe(1_785_240);
    expect(r.unitPriceVnd).toBeCloseTo(3_570.48, 2);

    // Nhánh CŨ: vatAmount = VAT khâu nhập (t5.vat), khác vatInvoice.
    expect(r.vatAmount).toBe(128_378);
    expect(r.vatAmount).not.toBe(r.vatInvoice);
  });

  // entrustBase:'goods' — nhánh legacy, KHÔNG còn dòng thật nào dùng (chốt
  // trong plan §BỘ SỐ VÀNG: "chưa có dòng thật nào bật ... entrustBase=goods").
  // Số kỳ vọng dưới đây DỰNG TAY từ công thức
  // `entrust_fee_vnd = amount_vnd × entrust_fee_pct` (xem plan mục Số học,
  // nhánh entrust_base==='goods'), KHÔNG phải số đo từ dữ liệu thật.
  //
  // amountRmb = 10×25.5 + 0 = 255 ; amountVnd = 255×3960 = 1.009.800
  // entrustFeeVnd('goods') = 1.009.800 × 0.03 = 30.294
  //
  // Để chứng minh 'goods' KHÔNG đi theo công thức của 'both', ta chạy lại
  // với qcCost/otherCost > 0 (nếu bằng 0 thì 'goods' và 'both' vô tình cho
  // cùng một số, vì 'both' loại cước+thuế, chỉ còn amountVnd+qcCost+otherCost
  // — bằng 'goods' khi hai khoản đó = 0, nên phải chọn ca có qcCost/otherCost
  // khác 0 mới tách bạch được hai công thức):
  // base('both') = amountVnd + qcCost + otherCost = 1.009.800+50.000+20.000 = 1.079.800
  // entrustFeeVnd('both') = 1.079.800 × 0.03 = 32.394 ≠ 30.294
  it("entrustBase:'goods' (legacy) — entrustFeeVnd = amountVnd × entrustFeePct, KHÔNG theo công thức 'both'", () => {
    const input = {
      qty: 10,
      unitPriceRmb: 25.5,
      domesticShipRmb: 0,
      weightKg: 1,
      cbm: 0,
      importTaxPct: 0,
      consumptionTaxPct: 0,
      antidumpingPct: 0,
      envtaxAmount: 0,
      vatPct: 0.08,
      qcCost: 50_000,
      otherCost: 20_000,
    };
    const headerBase = {
      rateRmbVnd: 3960,
      rateUsdVnd: 0,
      currencyMode: 'rmb' as const,
      freightVnPerKg: 10000,
      freightVnPerCbm: 1300000,
      entrustFeePct: 0.03,
      fxBufferPct: 0,
      vatBaseFull: false,
      vatExclService: false,
    };

    const goods = calcItem(input, { ...headerBase, entrustBase: 'goods' });
    expect(goods.amountVnd).toBe(1_009_800);
    expect(goods.entrustFeeVnd).toBeCloseTo(1_009_800 * 0.03, 4);
    expect(goods.entrustFeeVnd).toBeCloseTo(30_294, 4);

    const both = calcItem(input, { ...headerBase, entrustBase: 'both' });
    expect(both.entrustFeeVnd).toBeCloseTo(32_394, 4);

    // Cùng input, chỉ khác entrustBase — 'goods' KHÔNG cộng qcCost/otherCost
    // vào nền như 'both' ⇒ hai kết quả phải khác nhau.
    expect(goods.entrustFeeVnd).not.toBeCloseTo(both.entrustFeeVnd, 4);
  });
});
