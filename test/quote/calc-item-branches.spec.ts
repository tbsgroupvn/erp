import { calcItem } from '../../src/quote/quote-calc';

// Mọi số kỳ vọng trong file này ĐƯỢC DỰNG TAY từ công thức (xem plan mục
// "⚠ SỐ HỌC", F:/01_TBS_GROUP/docs/rewrite-spec/plans/2026-09-23-05-bao-gia-plan.md)
// — dữ liệu thật trên prod chưa phủ các nhánh này (entrustBase ship/tax,
// vatExclService, fxBufferPct, currencyMode usd, qty=0). KHÔNG phải số đo.
describe('calcItem — #05 báo giá, các nhánh còn lại (ship/tax/xyz, vat_excl_service, fx_buffer, qty=0, usd, tie kg=cbm)', () => {
  it("entrustBase:'ship' — nền uỷ thác BỎ cước, vẫn CỘNG thuế NK+VAT-goc", () => {
    // amountRmb = 10×10+0 = 100 ; amountVnd = 100×1000 = 100.000
    // shipKg = 2×5000 = 10.000 ; shipCbm = 0 ⇒ shipToVnVnd = 10.000, shipBy=kg
    // t5(nenHang=100.000, cuoc=10.000, sl=10, pctNk=5, …, pctVat=8):
    //   nk = 100.000×5% = 5.000 ; nenVat = 100.000+10.000+5.000 = 115.000
    // vatAmountGoc = (100.000+10.000+5.000)×0.08 = 9.200
    // entrustBase='ship': base = amountVnd + 0(ship bị loại) + (nk+vatAmountGoc) + 0+0
    //                    = 100.000 + 14.200 = 114.200
    // entrustFeeVnd = 114.200 × 0.02 = 2.284
    const input = {
      qty: 10,
      unitPriceRmb: 10,
      domesticShipRmb: 0,
      weightKg: 2,
      cbm: 0,
      importTaxPct: 0.05,
      consumptionTaxPct: 0,
      antidumpingPct: 0,
      envtaxAmount: 0,
      vatPct: 0.08,
      qcCost: 0,
      otherCost: 0,
    };
    const headerBase = {
      rateRmbVnd: 1000,
      rateUsdVnd: 0,
      currencyMode: 'rmb' as const,
      freightVnPerKg: 5000,
      freightVnPerCbm: 100000,
      entrustFeePct: 0.02,
      fxBufferPct: 0,
      vatBaseFull: true,
      vatExclService: false,
    };

    const rShip = calcItem(input, { ...headerBase, entrustBase: 'ship' });
    expect(rShip.importFeeVnd).toBe(5_000);
    expect(rShip.entrustFeeVnd).toBeCloseTo(2_284, 4);

    // Đối chứng: 'full' cộng thêm shipToVnVnd (10.000) vào nền ⇒ entrustFeeVnd
    // cao hơn đúng 10.000×0.02=200.
    const rFull = calcItem(input, { ...headerBase, entrustBase: 'full' });
    expect(rFull.entrustFeeVnd).toBeCloseTo(2_484, 4);
    expect(rShip.entrustFeeVnd).toBeCloseTo(rFull.entrustFeeVnd - 200, 4);
  });

  it("entrustBase:'tax' — nền uỷ thác BỎ importFee+vatAmountGoc, vẫn CỘNG cước", () => {
    // Cùng input ca 'ship' ở trên. entrustBase='tax': base = amountVnd + shipToVnVnd
    //   + 0(thuế bị loại) + 0+0 = 100.000+10.000 = 110.000
    // entrustFeeVnd = 110.000 × 0.02 = 2.200
    const input = {
      qty: 10,
      unitPriceRmb: 10,
      domesticShipRmb: 0,
      weightKg: 2,
      cbm: 0,
      importTaxPct: 0.05,
      consumptionTaxPct: 0,
      antidumpingPct: 0,
      envtaxAmount: 0,
      vatPct: 0.08,
      qcCost: 0,
      otherCost: 0,
    };
    const headerBase = {
      rateRmbVnd: 1000,
      rateUsdVnd: 0,
      currencyMode: 'rmb' as const,
      freightVnPerKg: 5000,
      freightVnPerCbm: 100000,
      entrustFeePct: 0.02,
      fxBufferPct: 0,
      vatBaseFull: true,
      vatExclService: false,
    };

    const rTax = calcItem(input, { ...headerBase, entrustBase: 'tax' });
    expect(rTax.entrustFeeVnd).toBeCloseTo(2_200, 4);

    const rFull = calcItem(input, { ...headerBase, entrustBase: 'full' });
    // Chênh lệch đúng bằng (importFeeVnd + vatAmountGoc) × entrustFeePct
    // = (5.000+9.200) × 0.02 = 284
    expect(rFull.entrustFeeVnd - rTax.entrustFeeVnd).toBeCloseTo(284, 4);
  });

  it("entrustBase giá trị lạ ('xyz') — coi như 'full' (fail-safe)", () => {
    const input = {
      qty: 10,
      unitPriceRmb: 10,
      domesticShipRmb: 0,
      weightKg: 2,
      cbm: 0,
      importTaxPct: 0.05,
      consumptionTaxPct: 0,
      antidumpingPct: 0,
      envtaxAmount: 0,
      vatPct: 0.08,
      qcCost: 0,
      otherCost: 0,
    };
    const headerBase = {
      rateRmbVnd: 1000,
      rateUsdVnd: 0,
      currencyMode: 'rmb' as const,
      freightVnPerKg: 5000,
      freightVnPerCbm: 100000,
      entrustFeePct: 0.02,
      fxBufferPct: 0,
      vatBaseFull: true,
      vatExclService: false,
    };

    const rXyz = calcItem(input, { ...headerBase, entrustBase: 'xyz' });
    const rFull = calcItem(input, { ...headerBase, entrustBase: 'full' });
    expect(rXyz).toEqual(rFull);
  });

  it('vatExclService:true — đơn giá ex-VAT tính từ nền chịu thuế (không phí dịch vụ), totalVnd = base+vat+round(entrust)', () => {
    // amountVnd = 10×25.5×3960 = 1.009.800 ; shipToVnVnd=10.000 ; importFee=0
    // entrustBase='both' (loại cước+thuế): base = amountVnd+qcCost+otherCost
    //   = 1.009.800+5.000+3.000 = 1.017.800 ; entrustFeeVnd = ×0.03 = 30.534
    // nenChiuThue = amountVnd+shipToVnVnd+0+0+0+0+qcCost+otherCost+fxBufferVnd(0)
    //   = 1.009.800+10.000+5.000+3.000 = 1.027.800
    // unitPriceNovatVnd = round(1.027.800/10) = 102.780
    // baseInvoice = round(10×102.780) = 1.027.800
    // vatInvoice = round(1.027.800×0.08) = 82.224
    // totalVnd = 1.027.800+82.224+round(30.534) = 1.140.558
    const r = calcItem(
      {
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
        qcCost: 5_000,
        otherCost: 3_000,
      },
      {
        rateRmbVnd: 3960,
        rateUsdVnd: 0,
        currencyMode: 'rmb',
        freightVnPerKg: 10000,
        freightVnPerCbm: 1300000,
        entrustFeePct: 0.03,
        entrustBase: 'both',
        fxBufferPct: 0,
        vatBaseFull: true,
        vatExclService: true,
      },
    );
    expect(r.entrustFeeVnd).toBeCloseTo(30_534, 4);
    expect(r.unitPriceNovatVnd).toBe(102_780);
    expect(r.baseInvoice).toBe(1_027_800);
    expect(r.vatInvoice).toBe(82_224);
    expect(r.totalVnd).toBe(1_140_558);
    expect(r.vatAmount).toBe(82_224); // vatBaseFull=true ⇒ vatAmount = vatInvoice
  });

  it('qty=0 ⇒ totalVnd=0 — pin lỗi THẬT đã xảy ra trên prod (BG-2026-09-064: dòng rỗng có 120.090đ vì phí uỷ thác vẫn dương nhờ qcCost/otherCost)', () => {
    // amountVnd=0 (qty=0) nhưng entrustBase='both' loại cước+thuế nên
    // base = amountVnd(0)+qcCost+otherCost = 5.000+3.000 = 8.000
    // entrustFeeVnd = 8.000×0.03 = 240 (DƯƠNG dù không có hàng) — đây
    // chính là mầm bệnh của BG-2026-09-064 nếu thiếu guard qty>0.
    const input = {
      qty: 0,
      unitPriceRmb: 25.5,
      domesticShipRmb: 0,
      weightKg: 1,
      cbm: 0,
      importTaxPct: 0,
      consumptionTaxPct: 0,
      antidumpingPct: 0,
      envtaxAmount: 0,
      vatPct: 0.08,
      qcCost: 5_000,
      otherCost: 3_000,
    };
    const header = {
      rateRmbVnd: 3960,
      rateUsdVnd: 0,
      currencyMode: 'rmb' as const,
      freightVnPerKg: 10000,
      freightVnPerCbm: 1300000,
      entrustFeePct: 0.03,
      entrustBase: 'both' as const,
      fxBufferPct: 0,
      vatBaseFull: true,
      vatExclService: true,
    };

    const r = calcItem(input, header);
    expect(r.entrustFeeVnd).toBeCloseTo(240, 4); // dương — nguồn của lỗi cũ
    expect(r.totalVnd).toBe(0); // guard qty>0 phải triệt tiêu nó khỏi tổng

    // Ca đối chứng: nhánh KHÔNG vatExclService cũng phải cho totalVnd=0 —
    // baseInvoice suy từ qty×unitPriceNovatVnd nên tự nhiên =0 khi qty=0.
    const rNormal = calcItem(input, { ...header, vatExclService: false });
    expect(rNormal.totalVnd).toBe(0);
  });

  it('fxBufferPct>0 — chỉ tính trên tiền hàng, KHÔNG vào nền phí uỷ thác', () => {
    // amountVnd = 1.009.800 ; fxBufferVnd = 1.009.800×2/100 = 20.196
    // entrustBase='both', qcCost=otherCost=0 ⇒ entrustFeeVnd = amountVnd×0.03
    //   = 30.294 — GIỐNG HỆT golden A (fxBufferPct=0) vì fxBufferVnd không
    //   được cộng vào nền uỷ thác.
    const r = calcItem(
      {
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
        qcCost: 0,
        otherCost: 0,
      },
      {
        rateRmbVnd: 3960,
        rateUsdVnd: 0,
        currencyMode: 'rmb',
        freightVnPerKg: 10000,
        freightVnPerCbm: 1300000,
        entrustFeePct: 0.03,
        entrustBase: 'both',
        fxBufferPct: 2,
        vatBaseFull: true,
        vatExclService: false,
      },
    );
    expect(r.fxBufferVnd).toBeCloseTo(20_196, 4);
    expect(r.entrustFeeVnd).toBeCloseTo(30_294, 4); // = amountVnd×entrustFeePct, KHÔNG có fxBufferVnd
  });

  it("currencyMode:'usd' dùng rateUsdVnd; giá trị khác 'usd' fallback về rateRmbVnd", () => {
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
      qcCost: 0,
      otherCost: 0,
    };
    const headerBase = {
      rateRmbVnd: 3960,
      rateUsdVnd: 24000,
      freightVnPerKg: 10000,
      freightVnPerCbm: 1300000,
      entrustFeePct: 0.03,
      entrustBase: 'both' as const,
      fxBufferPct: 0,
      vatBaseFull: true,
      vatExclService: false,
    };

    // amountRmb=255 ; usd: amountVnd = 255×24000 = 6.120.000
    const rUsd = calcItem(input, { ...headerBase, currencyMode: 'usd' });
    expect(rUsd.amountRmb).toBe(255);
    expect(rUsd.amountVnd).toBe(6_120_000);

    // giá trị lạ 'zzz' ⇒ fallback rmb: amountVnd = 255×3960 = 1.009.800
    // (khớp golden A vì cùng input/rate rmb).
    const rOther = calcItem(input, { ...headerBase, currencyMode: 'zzz' });
    expect(rOther.amountVnd).toBe(1_009_800);
  });

  it('cước kg === cbm (bằng nhau tuyệt đối) ⇒ shipBy = kg (nhánh cbm cần THẮNG TUYỆT ĐỐI, không phải ≥)', () => {
    // shipKg = 5×10.000 = 50.000 ; shipCbm = 0.05×1.000.000 = 50.000 — BẰNG NHAU
    const r = calcItem(
      {
        qty: 10,
        unitPriceRmb: 10,
        domesticShipRmb: 0,
        weightKg: 5,
        cbm: 0.05,
        importTaxPct: 0,
        consumptionTaxPct: 0,
        antidumpingPct: 0,
        envtaxAmount: 0,
        vatPct: 0.08,
        qcCost: 0,
        otherCost: 0,
      },
      {
        rateRmbVnd: 1000,
        rateUsdVnd: 0,
        currencyMode: 'rmb',
        freightVnPerKg: 10000,
        freightVnPerCbm: 1000000,
        entrustFeePct: 0.03,
        entrustBase: 'both',
        fxBufferPct: 0,
        vatBaseFull: true,
        vatExclService: false,
      },
    );
    expect(r.shipToVnVnd).toBe(50_000);
    expect(r.shipBy).toBe('kg'); // bằng nhau ⇒ 'kg' thắng, vì nhánh cbm đòi shipCbm > shipKg (strictly greater)
  });
});
