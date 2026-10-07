import { calcItem } from '../../src/quote/quote-calc';

describe('calcItem — #05 báo giá, nhánh nền VAT MỚI (vat_base_full=1)', () => {
  // Bộ số vàng đo trên prod 23/09/2026, khớp CLS_QUOTE::calcItem thật từng đồng.
  // Xem F:/01_TBS_GROUP/docs/rewrite-spec/plans/2026-09-23-05-bao-gia-plan.md
  // mục "⚠ SỐ HỌC" + "BỘ SỐ VÀNG".

  it('golden A (id 66040): nền VAT mới, uỷ thác both', () => {
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
        fxBufferPct: 0,
        vatBaseFull: true,
        vatExclService: false,
      },
    );
    expect(r.amountVnd).toBe(1_009_800);
    expect(r.shipToVnVnd).toBe(10_000);
    expect(r.shipBy).toBe('kg');
    expect(r.importFeeVnd).toBe(0);
    expect(r.consumptionTaxVnd).toBe(0);
    expect(r.antidumpingVnd).toBe(0);
    expect(r.envtaxVnd).toBe(0);
    expect(r.entrustFeeVnd).toBeCloseTo(30_294, 4);
    expect(r.fxBufferVnd).toBe(0);
    expect(r.unitPriceNovatVnd).toBe(105_009); // LÀM TRÒN về đồng chẵn — là GỐC
    expect(r.baseInvoice).toBe(1_050_090);
    expect(r.vatInvoice).toBe(84_007);
    expect(r.totalVnd).toBe(1_134_097); // tổng TÍNH LẠI, KHÔNG phải tổng thô
    expect(r.vatAmount).toBe(84_007); // nền mới: vatAmount = vatInvoice
    expect(r.unitPriceVnd).toBeCloseTo(113_409.7, 4);
  });

  it('golden B (id 66038): nền VAT mới, uỷ thác both, qty=40', () => {
    const r = calcItem(
      {
        qty: 40,
        unitPriceRmb: 39.6,
        domesticShipRmb: 0,
        weightKg: 5,
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
        fxBufferPct: 0,
        vatBaseFull: true,
        vatExclService: false,
      },
    );
    expect(r.amountVnd).toBe(6_272_640);
    expect(r.shipToVnVnd).toBe(50_000);
    expect(r.shipBy).toBe('kg');
    expect(r.importFeeVnd).toBe(0);
    expect(r.vatAmount).toBe(520_864);
    expect(r.entrustFeeVnd).toBeCloseTo(188_179.2, 4);
    expect(r.totalVnd).toBe(7_031_664);
    expect(r.unitPriceVnd).toBeCloseTo(175_791.6, 4);
  });

  it('golden E (id 66024): cước theo khối thắng (cbm), thuế NK 15%, uỷ thác full', () => {
    const r = calcItem(
      {
        qty: 20,
        unitPriceRmb: 19,
        domesticShipRmb: 0,
        weightKg: 0,
        cbm: 0.02,
        importTaxPct: 0.15,
        consumptionTaxPct: 0,
        antidumpingPct: 0,
        envtaxAmount: 0,
        vatPct: 0.08,
        qcCost: 0,
        otherCost: 0,
      },
      {
        rateRmbVnd: 3955,
        rateUsdVnd: 0,
        currencyMode: 'rmb',
        freightVnPerKg: 9000,
        freightVnPerCbm: 1300000,
        entrustFeePct: 0.02,
        entrustBase: 'full',
        fxBufferPct: 0,
        vatBaseFull: true,
        vatExclService: false,
      },
    );
    expect(r.amountVnd).toBe(1_502_900);
    expect(r.shipToVnVnd).toBe(26_000);
    expect(r.shipBy).toBe('cbm'); // kg=0 nhưng cbm×1.300.000 thắng
    expect(r.importFeeVnd).toBe(225_435);
    expect(r.vatAmount).toBe(143_378);
    expect(r.entrustFeeVnd).toBeCloseTo(37_893.64, 2);
    expect(r.unitPriceNovatVnd).toBe(89_611);
    expect(r.baseInvoice).toBe(1_792_220);
    expect(r.vatInvoice).toBe(143_378);
    expect(r.totalVnd).toBe(1_935_598);
    expect(r.unitPriceVnd).toBeCloseTo(96_779.9, 4);
  });

  it('golden F (id 66020): cước theo khối thắng (cbm), thuế NK 15%, uỷ thác full', () => {
    const r = calcItem(
      {
        qty: 50,
        unitPriceRmb: 5,
        domesticShipRmb: 0,
        weightKg: 0,
        cbm: 0.04,
        importTaxPct: 0.15,
        consumptionTaxPct: 0,
        antidumpingPct: 0,
        envtaxAmount: 0,
        vatPct: 0.08,
        qcCost: 0,
        otherCost: 0,
      },
      {
        rateRmbVnd: 3955,
        rateUsdVnd: 0,
        currencyMode: 'rmb',
        freightVnPerKg: 9000,
        freightVnPerCbm: 1300000,
        entrustFeePct: 0.02,
        entrustBase: 'full',
        fxBufferPct: 0,
        vatBaseFull: true,
        vatExclService: false,
      },
    );
    expect(r.amountVnd).toBe(988_750);
    expect(r.shipToVnVnd).toBe(52_000);
    expect(r.shipBy).toBe('cbm');
    expect(r.importFeeVnd).toBe(148_312.5);
    expect(r.vatAmount).toBe(97_180);
    expect(r.entrustFeeVnd).toBeCloseTo(25_683.75, 2);
    expect(r.unitPriceNovatVnd).toBe(24_295);
    expect(r.baseInvoice).toBe(1_214_750);
    expect(r.vatInvoice).toBe(97_180);
    expect(r.totalVnd).toBe(1_311_930);
    expect(r.unitPriceVnd).toBeCloseTo(26_238.6, 4);
  });

  // ⚠⚠ CỔNG GÁC — pin rằng việc TÍNH LẠI tổng từ đơn giá đã làm tròn là
  // CÓ CHỦ Ý (xem plan mục Số học: "RỒI TỔNG ĐƯỢC TÍNH LẠI"). Cộng tay
  // các cột calcItem trả về (dùng vatAmount CUỐI CÙNG — cột duy nhất mà
  // caller nhìn thấy) ra tổng THÔ = 1.134.101 — KHÁC với totalVnd =
  // 1.134.097. Chênh lệch (4đ) là phần làm tròn đơn giá ex-VAT về đồng
  // chẵn trước khi nhân lại số lượng (đơn giá gốc dùng nenFull×vatPct
  // CHƯA làm tròn = 84.007,52 chứ không phải 84.007 khi tính total_tho
  // nội bộ — càng cho thấy vì sao không thể suy total_tho từ các cột đã
  // công bố). KHÔNG PHẢI thiếu tiền hay lỗi cộng dồn. Sở dĩ tổng phải
  // tính lại: PO chép `unitPriceNovatVnd` (đã làm tròn) rồi nhân SL —
  // giữ tổng thô làm 44/53 cặp BG–PO lệch, tổng 339.353đ (huytbs chốt
  // 31/08). ĐỪNG "sửa cho khớp" bằng cách bỏ bước làm tròn/tính lại này.
  it('⚠ tổng thô (cộng tay từng cột) KHÁC totalVnd — tính lại là chủ ý (ca A)', () => {
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
        fxBufferPct: 0,
        vatBaseFull: true,
        vatExclService: false,
      },
    );
    // "Một bản viết lại theo tóm tắt" điển hình sẽ cộng thẳng các cột đã
    // công bố (amountVnd + shipToVnVnd + importFeeVnd + vatAmount +
    // entrustFeeVnd + qcCost + otherCost + fxBufferVnd + consumptionTaxVnd
    // + antidumpingVnd + envtaxVnd) và tưởng đó là totalVnd. Nó KHÔNG phải.
    const rawSum =
      r.amountVnd +
      r.shipToVnVnd +
      r.importFeeVnd +
      r.vatAmount +
      r.entrustFeeVnd +
      0 /* qcCost */ +
      0 /* otherCost */ +
      r.fxBufferVnd +
      r.consumptionTaxVnd +
      r.antidumpingVnd +
      r.envtaxVnd;
    expect(rawSum).toBe(1_134_101); // KHÔNG phải 1.134.097
    expect(r.totalVnd).toBe(1_134_097);
    expect(rawSum).not.toBe(r.totalVnd);
  });
});
