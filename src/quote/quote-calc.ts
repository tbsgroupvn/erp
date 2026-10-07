// src/quote/quote-calc.ts
//
// `calcItem` — lõi tính giá một dòng báo giá. Hàm THUẦN (pure function),
// không đụng DB, không NestJS DI. Gọi `ImportTaxService.calc5` (nguồn
// duy nhất cho 5 sắc thuế, xem import-tax.service.ts) — TUYỆT ĐỐI không
// cài lại công thức thuế ở đây.
//
// ⚠ NGOẠI LỆ CHỦ Ý với luật "tiền không dùng float" của dự án (xem
// CLAUDE.md mục Tiền nong): hàm này dùng `number` (float64) cho toàn bộ
// phép tính trung gian, KHÔNG dùng Decimal — giống hệt PHP legacy
// (CLS_QUOTE::calcItem). PHP float và JS number đều là IEEE-754 double,
// nên cùng dãy phép tính SỐ HỌC cho cùng kết quả bit-để-bit. Quyết định này do
// huytq8995 chốt 23/09/2026: Decimal "đúng toán học hơn" nhưng làm lệch
// vài đồng so với 411 báo giá + 55 PO đã duyệt trên prod — mất khả năng
// đối chiếu 1:1 với dữ liệu cũ, là tiêu chí nghiệm thu thật. KHÔNG "sửa
// cho chuẩn hơn" bằng Decimal. Cột lưu (Prisma) vẫn là Decimal/NUMERIC —
// ngoại lệ chỉ giới hạn trong hàm này.
//
// ⚠ ĐÍNH CHÍNH (F9, review cuối 23/09/2026) — "bit-để-bit" ĐÚNG với phép
// SỐ HỌC nhưng KHÔNG đúng với phép LÀM TRÒN. PHP ≤ 8.3 `round()` có bước
// "pre-round" ở khoảng 14−log10(|x|) chữ số có nghĩa TRƯỚC khi làm tròn về
// 0 số lẻ; `Math.round` của JS thì không. Hệ quả: một giá trị như
// 105008.49999999999 cho 105009 ở PHP nhưng 105008 ở JS — lệch 1đ trên đơn
// giá, nhân lên theo SL trên tổng. Prod chạy PHP 8.2 nên hành vi này là
// THẬT. Xác suất mỗi dòng rất nhỏ và cả 6 ca vàng đều khớp, nên KHÔNG đổi
// số học ở đây — nhưng đừng coi việc khớp số là "đúng do bản chất": nó
// được chứng minh bằng ĐỐI CHIẾU DỮ LIỆU THẬT (bộ số vàng A–F + chạy lại
// PHP trên cùng input), không phải bằng suy luận. Khi migrate, nghiệm thu
// phải chạy lại PHP trên cùng input rồi so, đúng như migration doc dặn.
// (Ghi chú phụ: Math.round(-0.5) = -0 còn PHP round(-0.5) = -1 — chỉ đụng
// tới nếu sau này có dòng giảm giá/âm.)
//
// ⚠⚠ TỔNG ĐƯỢC TÍNH LẠI, KHÔNG PHẢI tổng thô của các thành phần. Sau khi
// cộng thô (`total_tho`), hệ suy ra đơn giá, LÀM TRÒN đơn giá ex-VAT về
// đồng chẵn (đó là GỐC — PO chép đúng con số đã làm tròn này), rồi TÍNH
// LẠI tổng từ đơn giá đã làm tròn đó. Bỏ bước này làm 44/53 cặp BG–PO
// lệch, tổng 339.353đ (huytbs chốt 31/08/2026). ĐỪNG "sửa cho khớp"
// bằng cách trả totalVnd = total_tho. Xem test
// "⚠ tổng thô (cộng tay từng cột) KHÁC totalVnd" — đó là cổng gác.
//
// ⚠ ĐƠN VỊ THUẾ SUẤT: `vatPct`/`importTaxPct`/... trên input là PHÂN SỐ
// (0.08 = 8%). `ImportTaxService.calc5` nhận PHẦN TRĂM ⇒ nhân 100 khi
// gọi. Nhưng `vatAmountGoc` (nền hẹp cho phí uỷ thác) và `nenFull` dùng
// `vatPct` là PHÂN SỐ TRỰC TIẾP, KHÔNG ×100. Sai chỗ này lệch 100 lần.
//
// PHẠM VI: TẤT CẢ nhánh của Task 4/5/6 đã dựng đủ (không còn throw nào).
// - Task 4: nhánh `vatBaseFull === true` (nền VAT MỚI) — vatAmount cuối
//   cùng = vatInvoice.
// - Task 5: nhánh CŨ `vatBaseFull === false` — vatAmount GIỮ NGUYÊN =
//   t5.vat (VAT khâu nhập), KHÔNG bị ghi đè bằng vatInvoice (VAT hoá đơn)
//   như nhánh mới ⇒ hai con số VAT cùng tồn tại, cố ý khác nhau (xem
//   golden C, test calc-item-old.spec.ts).
// - Task 6: `vatExclService === true` (chỉ có nghĩa khi vatBaseFull) —
//   đơn giá ex-VAT tính từ nền chịu thuế KHÔNG có phí dịch vụ/uỷ thác,
//   phí uỷ thác cộng thẳng vào totalVnd với GUARD `qty > 0` (thiếu guard
//   này là lỗi ĐÃ XẢY RA THẬT — BG-2026-09-064, xem calc-item-branches
//   .spec.ts). entrustBase đã được viết TỔNG QUÁT (excl_ship/excl_tax)
//   theo đúng công thức trong plan nên 'ship'/'tax'/giá trị lạ (mặc định
//   'full') hoạt động đúng luôn; nhánh 'goods' (legacy, KHÔNG gộp vào
//   'both') cũng transcribe theo plan.
//
// Xem: F:/01_TBS_GROUP/docs/rewrite-spec/plans/2026-09-23-05-bao-gia-plan.md
// mục "⚠ SỐ HỌC — đọc kỹ, đây là chỗ dễ sai nhất" + "BỘ SỐ VÀNG".
import { ImportTaxService } from './import-tax.service';

// Module-level singleton — ImportTaxService không có constructor
// dependency, dựng thẳng để calcItem giữ được là hàm thuần, không cần DI.
const importTaxService = new ImportTaxService();

export type EntrustBase = 'goods' | 'full' | 'ship' | 'tax' | 'both' | string;
export type ShipBy = 'kg' | 'cbm';
export type CurrencyMode = 'rmb' | 'usd' | string;

export interface QuoteItemInput {
  qty: number;
  unitPriceRmb: number;
  domesticShipRmb: number;
  weightKg: number;
  cbm: number;
  /** Phân số, vd 0.08 = 8%. */
  importTaxPct: number;
  /** Phân số. */
  consumptionTaxPct: number;
  /** Phân số. */
  antidumpingPct: number;
  /** Số tiền tuyệt đối trên mỗi đơn vị số lượng (BVMT). */
  envtaxAmount: number;
  /** Phân số, vd 0.08 = 8%. */
  vatPct: number;
  qcCost: number;
  otherCost: number;
}

export interface QuoteHeaderConfig {
  rateRmbVnd: number;
  rateUsdVnd: number;
  currencyMode: CurrencyMode;
  freightVnPerKg: number;
  freightVnPerCbm: number;
  /** Phân số, vd 0.03 = 3% — KHÔNG ×100 khi dùng. */
  entrustFeePct: number;
  entrustBase: EntrustBase;
  /** Phần trăm (vd 2 = 2%) — công thức fx_buffer chia /100. */
  fxBufferPct: number;
  vatBaseFull: boolean;
  vatExclService: boolean;
}

export interface QuoteItemCalc {
  amountRmb: number;
  amountVnd: number;
  shipToVnVnd: number;
  shipBy: ShipBy;
  importFeeVnd: number;
  consumptionTaxVnd: number;
  antidumpingVnd: number;
  envtaxVnd: number;
  vatAmount: number;
  entrustFeeVnd: number;
  fxBufferVnd: number;
  unitPriceNovatVnd: number;
  baseInvoice: number;
  vatInvoice: number;
  totalVnd: number;
  unitPriceVnd: number;
}

export function calcItem(input: QuoteItemInput, header: QuoteHeaderConfig): QuoteItemCalc {
  const {
    qty,
    unitPriceRmb,
    domesticShipRmb,
    weightKg,
    cbm,
    importTaxPct,
    consumptionTaxPct,
    antidumpingPct,
    envtaxAmount,
    vatPct,
    qcCost,
    otherCost,
  } = input;
  const {
    rateRmbVnd,
    rateUsdVnd,
    currencyMode,
    freightVnPerKg,
    freightVnPerCbm,
    entrustFeePct,
    entrustBase,
    fxBufferPct,
    vatBaseFull,
    vatExclService,
  } = header;

  // -- Tiền hàng --
  const amountRmb = qty * unitPriceRmb + domesticShipRmb;
  const rateToVnd = currencyMode === 'usd' ? rateUsdVnd : rateRmbVnd;
  const amountVnd = amountRmb * rateToVnd;

  // -- Cước: hai đơn giá ĐỘC LẬP (kg vs cbm), lấy SỐ TIỀN CAO HƠN --
  const shipKg = weightKg * freightVnPerKg;
  const shipCbm = cbm * freightVnPerCbm;
  const shipToVnVnd = Math.max(shipKg, shipCbm);
  const shipBy: ShipBy = shipCbm > shipKg ? 'cbm' : 'kg';

  // -- 5 sắc thuế (ImportTaxService nhận PHẦN TRĂM = phân số × 100) --
  const t5 = importTaxService.calc5(
    amountVnd,
    shipToVnVnd,
    qty,
    importTaxPct * 100,
    consumptionTaxPct * 100,
    antidumpingPct * 100,
    envtaxAmount,
    vatPct * 100,
  );
  const importFeeVnd = t5.nk;
  const consumptionTaxVnd = t5.ttdb;
  const antidumpingVnd = t5.cbpg;
  const envtaxVnd = t5.bvmt;

  // -- Nền hẹp, CHỈ dùng làm gốc tính phí uỷ thác (vatPct PHÂN SỐ, không ×100) --
  const vatAmountGoc = (amountVnd + shipToVnVnd + importFeeVnd) * vatPct;

  // -- Phí uỷ thác --
  const exclShip = entrustBase === 'ship' || entrustBase === 'both';
  const exclTax = entrustBase === 'tax' || entrustBase === 'both';
  let entrustFeeVnd: number;
  if (entrustBase === 'goods') {
    // Nhánh CŨ — GIỮ NGUYÊN, không gộp vào 'both'.
    entrustFeeVnd = amountVnd * entrustFeePct;
  } else {
    const base =
      amountVnd +
      (exclShip ? 0 : shipToVnVnd) +
      (exclTax ? 0 : importFeeVnd + vatAmountGoc) +
      qcCost +
      otherCost;
    entrustFeeVnd = base * entrustFeePct;
  }

  // -- VAT (giá trị TẠM — nếu vatBaseFull sẽ bị ghi đè bằng vatInvoice sau
  // khi tính lại tổng; nếu KHÔNG vatBaseFull, đây CHÍNH LÀ giá trị cuối
  // cùng của vatAmount — VAT khâu NHẬP KHẨU, cố ý khác vatInvoice, xem
  // Task 5 / golden C trong plan) --
  let vatAmount = t5.vat;
  if (vatBaseFull) {
    let nenFull = t5.nenVat + qcCost + otherCost;
    // vatExclService: phí uỷ thác KHÔNG vào nền VAT ở bước này — nền VAT
    // hoá đơn cho ca này được tính lại từ nenChiuThue riêng ở dưới.
    if (!vatExclService) nenFull += entrustFeeVnd;
    vatAmount = nenFull * vatPct; // PHÂN SỐ, KHÔNG ×100
  }

  // -- Biên phòng tỷ giá (chỉ trên tiền hàng) --
  const fxBufferVnd = fxBufferPct > 0 ? (amountVnd * fxBufferPct) / 100 : 0;

  // -- Tổng thô --
  const totalTho =
    amountVnd +
    shipToVnVnd +
    importFeeVnd +
    vatAmount +
    entrustFeeVnd +
    qcCost +
    otherCost +
    fxBufferVnd +
    consumptionTaxVnd +
    antidumpingVnd +
    envtaxVnd;

  // ⚠⚠ TỔNG ĐƯỢC TÍNH LẠI từ đơn giá ex-VAT đã LÀM TRÒN về đồng chẵn —
  // đây là GỐC (PO chép đúng số này rồi nhân SL). Xem comment đầu file.
  const unitPriceVndRaw = qty > 0 ? totalTho / qty : 0;
  let unitPriceNovatVnd = Math.round(unitPriceVndRaw / (1 + vatPct));

  let baseInvoice: number;
  let vatInvoice: number;
  let totalVnd: number;
  if (vatExclService) {
    // Chỉ có nghĩa khi vatBaseFull — đơn giá ex-VAT tính từ NỀN CHỊU THUẾ
    // (không có phí dịch vụ/uỷ thác), rồi phí uỷ thác được CỘNG THẲNG vào
    // tổng thay vì lẫn vào đơn giá.
    const nenChiuThue =
      amountVnd +
      shipToVnVnd +
      importFeeVnd +
      consumptionTaxVnd +
      antidumpingVnd +
      envtaxVnd +
      qcCost +
      otherCost +
      fxBufferVnd;
    unitPriceNovatVnd = qty > 0 ? Math.round(nenChiuThue / qty) : 0;
    baseInvoice = Math.round(qty * unitPriceNovatVnd);
    vatInvoice = Math.round(baseInvoice * vatPct);
    // ⚠⚠ GUARD qty>0 bắt buộc — thiếu nó là lỗi ĐÃ XẢY RA THẬT trên prod
    // (BG-2026-09-064): dòng rỗng (qty=0) tự nhiên có totalVnd dương vì
    // entrustFeeVnd vẫn > 0 nhờ qcCost/otherCost dù không có hàng.
    totalVnd = baseInvoice + vatInvoice + (qty > 0 ? Math.round(entrustFeeVnd) : 0);
  } else {
    baseInvoice = Math.round(qty * unitPriceNovatVnd);
    vatInvoice = Math.round(baseInvoice * vatPct);
    totalVnd = baseInvoice + vatInvoice;
  }

  // Nền MỚI: một con số VAT duy nhất = VAT hoá đơn (đã tính lại).
  // Nền CŨ (vatBaseFull=false): GIỮ NGUYÊN vatAmount = t5.vat (VAT khâu
  // nhập, gán ở trên) — KHÔNG ghi đè bằng vatInvoice. Hai con số VAT
  // khác nhau là CỐ Ý, xem Task 5 / golden C.
  if (vatBaseFull) {
    vatAmount = vatInvoice;
  }
  const unitPriceVnd = qty > 0 ? totalVnd / qty : 0;

  return {
    amountRmb,
    amountVnd,
    shipToVnVnd,
    shipBy,
    importFeeVnd,
    consumptionTaxVnd,
    antidumpingVnd,
    envtaxVnd,
    vatAmount,
    entrustFeeVnd,
    fxBufferVnd,
    unitPriceNovatVnd,
    baseInvoice,
    vatInvoice,
    totalVnd,
    unitPriceVnd,
  };
}
