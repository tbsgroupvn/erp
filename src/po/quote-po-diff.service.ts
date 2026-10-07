// src/po/quote-po-diff.service.ts
//
// `QuotePoDiffService` — cổng so lệch SỐNG giữa một PO đã duyệt và báo giá
// đã chốt liên kết qua `PoItem.quoteItemId`. Đây là cổng chặn xuất hoá đơn
// GTGT (Task 5 nối tiếp file này bằng `coLechChan`/`hash`/`canIssueInvoice`)
// — sai một trong hai bẫy dưới đây là CHẶN SẠCH hoặc CHO LỌT hoá đơn sai.
//
// Nguồn luật DUY NHẤT: `libs/quote_po_diff.php` (441 dòng), chép nguyên
// trong plans/2026-09-23-06-po-plan.md mục "⚠ Hợp đồng `quote_po_diff`".
// Đọc mục đó TRƯỚC khi sửa file này.
//
// ⚠⚠⚠ BẪY 1 — ĐƠN VỊ %VAT NGƯỢC NHAU GIỮA HAI BẢNG. Đo prod 23/09/2026:
// `tbl_po_items.vat_rate` là PHẦN TRĂM (8.0000 = 8%), `tbl_quote_items
// .vat_pct` là PHÂN SỐ (0.0800 = 8%). So thẳng hai cột là lỗi 100×. Quy đổi
// CHỈ Ở MỘT CHỖ trong `rowCells` (ô `vat_rate`): `vatRateQuote = vatPct ×
// 100`. NULL bên PO ⇒ coi là 0, không bao giờ NaN.
//
// ⚠⚠⚠ BẪY 2 — TUYỆT ĐỐI KHÔNG đọc `tbl_quote_items.vat_amount`. Cột đó là
// VAT khâu NHẬP KHẨU, tính trên nền CHI PHÍ `(amount_vnd + cước + thuế NK)
// × vat_pct` (xem quote-calc.ts) — khác nền DOANH THU của PO. Đọc nhầm cột
// này ⇒ mọi dòng báo lệch giả, cổng chặn sạch hoá đơn ngay ngày đầu công ty
// dùng tính năng. `vat_money` phía quote PHẢI được TÍNH: `amountQuote ×
// vatPct` — `amountQuote` bản thân cũng PHẢI được TÍNH (`qty ×
// unitPriceNovatVnd`), KHÔNG đọc cột lưu sẵn nào.
//
// Toàn file dùng `number` (không `Decimal`) cho phép toán so-lệch — đây là
// so sánh dung sai (EPS), không phải bút toán tiền, cùng lựa chọn có chủ ý
// với `quote-calc.ts` (xem comment đầu file đó). Ranh giới Decimal -> number
// nằm ở duy nhất một hàm `d2n` dưới đây, giống quy ước `quote.service.ts`.
//
// ═══ Task 4 — compare(poId): ghép cặp + lệch cấu trúc + tổng CÓ THUẾ ═════
//
// ⚠ PO `status < 3` (chưa duyệt — xem `PoStatus.DA_DUYET`) ⇒ trả rỗng. Lý
// do trong mã prod: khi PO chưa duyệt, hệ cũ còn chạy `syncFromQuote()`
// chiều NGƯỢC (báo giá -> PO) mỗi lần lưu báo giá — hai chiều cùng sống là
// giằng co nhau, nên cổng so lệch chỉ "sống" từ lúc PO đã duyệt trở đi.
//
// ⚠⚠ SỬA 23/09/2026 sau review: liên kết PO↔báo giá là `Quote.poId` (báo
// giá trỏ VỀ PO — CHIỀU NGƯỢC lại so với suy đoán ban đầu "không có
// PurchaseOrder.quoteId nên phải suy từ PoItem.quoteItemId", suy đoán đó
// SAI, đã sửa). Đúng nguyên văn `libs/quote_po_diff.php`:
//   SELECT id FROM tbl_quotes WHERE po_id = $po_id ORDER BY id DESC LIMIT 1
// Nhiều báo giá cùng `poId` (làm lại báo giá cho cùng một PO) ⇒ báo giá
// canonical là bản MỚI NHẤT (`id` lớn nhất). Không có báo giá nào trỏ tới
// PO ⇒ rỗng (không có gì để so), KHÔNG suy diễn từ `PoItem.quoteItemId`.
//
// Ba loại lệch cấu trúc dùng ĐÚNG map tra cứu của báo giá canonical (giống
// prod: prod chỉ nạp item của MỘT báo giá vào map tra cứu) — một PoItem trỏ
// vào item của MỘT BÁO GIÁ KHÁC (kể cả báo giá cũ hơn cũng có `poId` trỏ về
// PO này) rơi vào `quote_missing` giống hệt trỏ vào id không tồn tại, vì cả
// hai đều "không tìm thấy trong map tra cứu của báo giá đang xét" — đây là
// tái hiện trung thực hành vi prod, không phải quy ước riêng của bản port.
//
// ⚠ Tổng đo bằng TỔNG CÓ THUẾ (`amount + vat_money` mỗi bên), chốt
// 14/08/2026 — trước đó chỉ cộng `amount` (ex-VAT) nên hai bên cùng SL +
// cùng đơn giá ex-VAT hiện "chênh 0đ" ngay trên bảng đang liệt kê hàng
// triệu đồng VAT lệch. Tổng CHỈ cộng DÒNG GHÉP CẶP — dòng lệch cấu trúc
// không vào tổng (nhãn phải nói "chênh trên các dòng ghép cặp", không phải
// "chênh tổng").
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PoStatus } from './po.constants';

export const QPD_EPS_MONEY = 0.5;
export const QPD_EPS_PCT = 0.001;
export const QPD_EPS_QTY = 0.0001;

/** 9 ô so — thứ tự đúng bảng trong plan. */
export type DiffField =
  | 'quantity'
  | 'unit_price'
  | 'amount'
  | 'vat_rate'
  | 'vat_money'
  | 'hs_code'
  | 'origin'
  | 'product_name'
  | 'unit';

/** 7 ô CHẶN xuất hoá đơn. `product_name`/`unit` KHÔNG có mặt — thêm
 *  07/09/2026, CỐ Ý không chặn vì không đụng tiền và sẽ chặn hàng loạt PO
 *  bán hàng bình thường nếu bắt chặn (xem Task 5 `coLechChan`). */
export const FIELDS_CHAN: DiffField[] = [
  'quantity', 'unit_price', 'amount', 'vat_rate', 'vat_money', 'hs_code', 'origin',
];

export interface DiffCell {
  po: number | string | null;
  quote: number | string | null;
  diff: boolean;
  type: 'numeric' | 'string';
}

export type RowCells = Record<DiffField, DiffCell>;

/** Decimal (hoặc number/string/null) đọc từ DB -> number thuần. Cùng quy ước
 *  `d2n` của `quote.service.ts`: truyền thẳng `Prisma.Decimal` vào phép toán
 *  số học (+, ×, so sánh) ÂM THẦM ra rác vì Decimal không tự ép kiểu. */
function d2n(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

function trimStr(v: string | null | undefined): string {
  return (v ?? '').trim();
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function numCell(po: number, quote: number, eps: number): DiffCell {
  return { po, quote, diff: Math.abs(po - quote) > eps, type: 'numeric' };
}

/** Ô chuỗi CHẶN (`hs_code`/`origin`) — so trực tiếp chuỗi đã trim, rỗng hai
 *  bên vẫn so bình thường (khác `strCellWarn`). */
function strCellChan(po: string, quote: string): DiffCell {
  return { po, quote, diff: po !== quote, type: 'string' };
}

/** Ô chuỗi CẢNH BÁO (`product_name`/`unit`) — ⚠ rỗng MỘT BÊN KHÔNG tính
 *  lệch: dòng PO gõ tay chưa điền ĐVT là THIẾU DỮ LIỆU, không phải hai
 *  nguồn mâu thuẫn nhau. */
function strCellWarn(po: string, quote: string): DiffCell {
  const diff = po !== '' && quote !== '' && po !== quote;
  return { po, quote, diff, type: 'string' };
}

// Không dùng `Pick<PoItem, ...>` thẳng: cột tiền của Prisma model là
// `Prisma.Decimal` cứng, trong khi test (và một số điểm gọi thuần) muốn
// truyền `number` tay. Khai type riêng nới lỏng numeric field thành
// `Decimal | number | string`, đi qua `d2n` ở trên — vẫn khớp cấu trúc với
// `PoItem`/`QuoteItem` thật khi PrismaService gọi vào (Task 4).
export interface PoItemForDiff {
  quantity: Prisma.Decimal | number | string;
  unitPrice: Prisma.Decimal | number | string;
  amount: Prisma.Decimal | number | string;
  vatRate: Prisma.Decimal | number | string | null;
  hsCode: string | null;
  origin: string | null;
  productName: string | null;
  unit: string | null;
}
export interface QuoteItemForDiff {
  qty: Prisma.Decimal | number | string;
  unitPriceNovatVnd: Prisma.Decimal | number | string;
  vatPct: Prisma.Decimal | number | string;
  hsCode: string | null;
  origin: string | null;
  nameVn: string | null;
  unit: string | null;
}

/**
 * So 9 ô giữa một `PoItem` và `QuoteItem` đã ghép cặp. Hàm THUẦN — không
 * đụng DB, nhận object đã tải sẵn (Decimal hoặc number/string đều được,
 * qua `d2n`).
 */
export function rowCells(poItem: PoItemForDiff, quoteItem: QuoteItemForDiff): RowCells {
  const qtyPo = d2n(poItem.quantity);
  const qtyQuote = d2n(quoteItem.qty);

  const unitPricePo = d2n(poItem.unitPrice);
  const unitPriceQuote = d2n(quoteItem.unitPriceNovatVnd);

  const amountPo = d2n(poItem.amount);
  // ⚠ TÍNH, không đọc cột — xem BẪY 2 ở đầu file.
  const amountQuote = round2(qtyQuote * unitPriceQuote);

  // ⚠⚠⚠ BẪY 1 — quy đổi %VAT đúng MỘT CHỖ. NULL bên PO -> d2n trả 0.
  const vatRatePo = d2n(poItem.vatRate);
  const vatRateQuote = round4(d2n(quoteItem.vatPct) * 100);

  // ⚠⚠⚠ BẪY 2 — vatMoneyQuote TÍNH từ amountQuote (đã tính ở trên) ×
  // vatPct (nền DOANH THU của PO). TUYỆT ĐỐI không đọc `quoteItem.vatAmount`
  // (nền NHẬP KHẨU, cột khác hẳn) — đọc nhầm là chặn sạch hoá đơn ngày đầu.
  const vatMoneyPo = round2((amountPo * vatRatePo) / 100);
  const vatMoneyQuote = round2(amountQuote * d2n(quoteItem.vatPct));

  return {
    quantity: numCell(qtyPo, qtyQuote, QPD_EPS_QTY),
    unit_price: numCell(unitPricePo, unitPriceQuote, QPD_EPS_MONEY),
    amount: numCell(amountPo, amountQuote, QPD_EPS_MONEY),
    vat_rate: numCell(vatRatePo, vatRateQuote, QPD_EPS_PCT),
    vat_money: numCell(vatMoneyPo, vatMoneyQuote, QPD_EPS_MONEY),
    hs_code: strCellChan(trimStr(poItem.hsCode), trimStr(quoteItem.hsCode)),
    origin: strCellChan(trimStr(poItem.origin), trimStr(quoteItem.origin)),
    product_name: strCellWarn(trimStr(poItem.productName), trimStr(quoteItem.nameVn)),
    unit: strCellWarn(trimStr(poItem.unit), trimStr(quoteItem.unit)),
  };
}

export interface DiffRow {
  poItemId: number;
  quoteItemId: number;
  cells: RowCells;
}

export type StructuralKind = 'po_only' | 'quote_missing' | 'quote_only';

export interface StructuralEntry {
  kind: StructuralKind;
  /** Có mặt cho `po_only`/`quote_missing`, KHÔNG có ở `quote_only`. */
  poItemId?: number;
  /** Có mặt cho `quote_missing`/`quote_only`; với `quote_missing` là id đã
   *  gõ trên PoItem (dù không giải quyết được), với `po_only` luôn null. */
  quoteItemId?: number | null;
}

export interface CompareTotals {
  po: number;
  quote: number;
  delta: number;
}

export interface CompareResult {
  poId: number;
  poCode: string;
  quoteId: number | null;
  rows: DiffRow[];
  structural: StructuralEntry[];
  /** true nếu có BẤT KỲ lệch nào — kể cả ô chỉ CẢNH BÁO (product_name/unit)
   *  và lệch cấu trúc. Không dùng trực tiếp để chặn hoá đơn — xem
   *  `coLechChan` (Task 5), vốn chỉ tính trên 7 ô CHẶN. */
  hasDiff: boolean;
  /** Tổng số đơn vị lệch (số ô-lệch trên các dòng ghép cặp, cả 9 ô, cộng số
   *  mục lệch cấu trúc) — chỉ số tham khảo cho UI, không phải căn cứ chặn. */
  nDiff: number;
  totals: CompareTotals;
}

// ═══ Task 5 — coLechChan / hash / acceptGap / canIssueInvoice ════════════
//
// ⚠ Đọc kỹ "⚠ Hợp đồng `quote_po_diff`" mục hash trong
// docs/rewrite-spec/plans/2026-09-23-06-po-plan.md trước khi sửa khối này.
//
// `coLechChan`/`hash` CHỈ xét `rows` (dòng ghép cặp) — lệch cấu trúc
// (po_only/quote_missing/quote_only) KHÔNG vào hai hàm này, đúng nguyên văn
// hợp đồng ("Build it from the result of compare(): for each differing
// row..."). Một PO có lệch cấu trúc nhưng mọi dòng ghép cặp đều khớp 7 ô
// chặn thì `coLechChan=false` — lệch cấu trúc là chuyện khác (thiếu/thừa
// dòng), không phải nội dung Task 5 xử lý.
//
// `hasDiff` (Task 4) vẫn tính CẢ product_name/unit lẫn lệch cấu trúc — đây
// là hành vi CỐ Ý khác nhau giữa `hasDiff` và `coLechChan`, xem test 1.

/** Có ô CHẶN nào đang lệch trên bất kỳ dòng ghép cặp nào không — chỉ 7 ô
 *  `FIELDS_CHAN`. Lệch CHỈ ở `product_name`/`unit` (2 ô cảnh báo, thêm
 *  07/09/2026 CỐ Ý không chặn) hoặc CHỈ ở lệch cấu trúc ⇒ trả `false`. */
export function coLechChan(cmp: CompareResult): boolean {
  return cmp.rows.some((row) => FIELDS_CHAN.some((f) => row.cells[f].diff));
}

/** Chuẩn hoá một số (hoặc chuỗi số) về dạng CANONICAL trước khi ghép vào
 *  chuỗi băm, để hai cách trình bày CÙNG một giá trị không ra hai
 *  fingerprint khác nhau — vd `"17.000"` (chấm ngăn cách nghìn kiểu VN) và
 *  `"17000"` (số thuần), hay `"17.0"` (đuôi .0 thừa) và `"17"`.
 *
 *  Quy tắc: trim khoảng trắng -> nếu TOÀN CHUỖI khớp mẫu số nguyên nhóm 3
 *  chữ số cách nhau bằng dấu chấm (`17.000`, `1.234.567`) thì coi mọi dấu
 *  chấm là ngăn cách NGHÌN, bỏ hết -> ép qua `Number` rồi `String` lại để
 *  tự động rụng số 0 thừa (đuôi `.0`, `.00`...). Không phải số hợp lệ (ô
 *  chuỗi như hs_code/origin) thì trả nguyên chuỗi đã trim, không đụng vào.
 *
 *  Sản xuất gọi một hàm PHP tương đương cho cùng mục đích trước khi băm
 *  SHA-1; đây là bản port thuần TypeScript, có unit test riêng
 *  (`test/po/diff-gate.spec.ts`).
 */
export function normalizeNumForHash(raw: string | number): string {
  let s = String(raw).trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isNaN(n) ? s : String(n);
}

/** Nhãn hiển thị 7 ô CHẶN — dùng trong lý do chặn của `canIssueInvoice`.
 *  Tái dùng đúng `DiffField` làm khoá (không dựng thêm map tên khác) — xem
 *  comment Task 5 đầu khối này. */
const FIELD_LABEL: Record<DiffField, string> = {
  quantity: 'Số lượng',
  unit_price: 'Đơn giá',
  amount: 'Thành tiền',
  vat_rate: '%VAT',
  vat_money: 'Tiền VAT',
  hs_code: 'Mã HS',
  origin: 'Xuất xứ',
  product_name: 'Tên hàng',
  unit: 'ĐVT',
};

/** Lý do "chấp nhận chênh" rỗng/toàn khoảng trắng — `acceptGap` từ chối. */
export class GapReasonRequired extends Error {}

/** F6 (review cuối #06, 23/09/2026) — `acceptGap` từ chối khi không có báo
 *  giá canonical liên kết với PO (`compare().quoteId === null`): không có gì
 *  để so, "chấp nhận chênh" vô nghĩa. Cùng bản gốc `libs/quote_po_diff.php`. */
export class GapNoLinkedQuote extends Error {}

/** F6 — `acceptGap` từ chối khi không có ô CHẶN nào đang lệch
 *  (`coLechChan(cmp) === false`): "Báo giá đã khớp PO — không cần chấp
 *  nhận", đúng thông điệp sản xuất `qpd_accepted()`. Trước bản vá này, port
 *  ghi nhận VÔ ĐIỀU KIỆN, tích luỹ các dòng hash-của-chuỗi-rỗng — reviewer
 *  xác nhận chưa khai thác được (một lệch CHẶN luôn cho hash khác rỗng),
 *  nhưng vẫn thêm chốt để khớp đúng hợp đồng gốc. */
export class GapNoBlockingDiff extends Error {}

@Injectable()
export class QuotePoDiffService {
  constructor(private prisma: PrismaService) {}

  private emptyResult(poId: number, poCode: string, quoteId: number | null = null): CompareResult {
    return {
      poId,
      poCode,
      quoteId,
      rows: [],
      structural: [],
      hasDiff: false,
      nDiff: 0,
      totals: { po: 0, quote: 0, delta: 0 },
    };
  }

  /**
   * So sánh SỐNG giữa PO `poId` (đã duyệt) và báo giá canonical — báo giá có
   * `poId` trỏ về PO này, chọn bản MỚI NHẤT nếu có nhiều. Xem khối comment
   * "Task 4" đầu file cho luật đầy đủ, đặc biệt các điều kiện trả rỗng.
   */
  async compare(poId: number): Promise<CompareResult> {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) {
      // PO không tồn tại — KHÔNG throw. Đây là cổng CHẶN hoá đơn, không
      // phải validator input: một id sai phải trả "không có gì để so" thay
      // vì biến thành 500, đồng nhất với hai nhánh rỗng khác dưới đây.
      return this.emptyResult(poId, '');
    }

    if (po.status < PoStatus.DA_DUYET) {
      // ⚠ Xem lý do "syncFromQuote chiều ngược" ở khối comment đầu file.
      return this.emptyResult(poId, po.poCode);
    }

    // ⚠ Liên kết là Quote.poId -> PurchaseOrder.id, đúng nguyên văn
    // libs/quote_po_diff.php — xem khối comment đầu file. KHÔNG suy diễn từ
    // PoItem.quoteItemId.
    const quote = await this.prisma.quote.findFirst({
      where: { poId },
      orderBy: { id: 'desc' },
    });
    if (!quote) {
      // Không có báo giá nào liên kết tới PO này -> không có gì để so.
      return this.emptyResult(poId, po.poCode);
    }

    const poItems = await this.prisma.poItem.findMany({ where: { poId }, orderBy: { id: 'asc' } });
    const quoteItems = await this.prisma.quoteItem.findMany({ where: { quoteId: quote.id } });
    const byId = new Map(quoteItems.map((qi) => [qi.id, qi]));

    const rows: DiffRow[] = [];
    const structural: StructuralEntry[] = [];
    const referencedIds = new Set<number>();

    for (const item of poItems) {
      const qid = item.quoteItemId;
      if (qid == null || qid <= 0) {
        structural.push({ kind: 'po_only', poItemId: item.id });
        continue;
      }
      const qi = byId.get(qid);
      if (!qi) {
        // "Không tồn tại" đo TRONG PHẠM VI item của báo giá canonical —
        // bao gồm cả id thật sự không tồn tại lẫn id thuộc MỘT BÁO GIÁ
        // KHÁC (kể cả báo giá cũ hơn cũng có poId trỏ về PO này). Xem giải
        // thích ở khối comment đầu file — đây là tái hiện đúng hành vi
        // prod, không phải quy ước riêng.
        structural.push({ kind: 'quote_missing', poItemId: item.id, quoteItemId: qid });
        continue;
      }
      referencedIds.add(qi.id);
      rows.push({ poItemId: item.id, quoteItemId: qi.id, cells: rowCells(item, qi) });
    }

    for (const qi of quoteItems) {
      if (!referencedIds.has(qi.id)) {
        structural.push({ kind: 'quote_only', quoteItemId: qi.id });
      }
    }

    // ⚠⚠ Tổng CHỈ trên `rows` (dòng ghép cặp) — `structural` KHÔNG vào tổng.
    // Mỗi bên = Σ(amount + vat_money), TỔNG CÓ THUẾ — xem khối comment
    // "Task 4" đầu file cho lý do (bug 14/08).
    let totalPo = 0;
    let totalQuote = 0;
    let cellDiffCount = 0;
    let anyCellDiff = false;
    for (const row of rows) {
      totalPo += (row.cells.amount.po as number) + (row.cells.vat_money.po as number);
      totalQuote += (row.cells.amount.quote as number) + (row.cells.vat_money.quote as number);
      for (const f of Object.keys(row.cells) as DiffField[]) {
        if (row.cells[f].diff) {
          cellDiffCount++;
          anyCellDiff = true;
        }
      }
    }
    const totals: CompareTotals = {
      po: round2(totalPo),
      quote: round2(totalQuote),
      delta: round2(totalPo - totalQuote),
    };

    return {
      poId,
      poCode: po.poCode,
      quoteId: quote.id,
      rows,
      structural,
      hasDiff: anyCellDiff || structural.length > 0,
      nDiff: cellDiffCount + structural.length,
      totals,
    };
  }

  /**
   * Fingerprint SHA-256 của BỘ SỐ ĐANG LỆCH (chỉ 7 ô `FIELDS_CHAN`, chỉ
   * dòng ghép cặp) — KHÔNG phải fingerprint của PO. Đây là điểm mấu chốt
   * Task 5: ai bấm "cập nhật báo giá theo PO" chỉ đổi phía báo giá, PO đứng
   * yên, nhưng bộ số lệch (PO vs báo giá) là MỚI HOÀN TOÀN -> hash phải đổi
   * theo, để `canIssueInvoice` không lỡ cho qua một chênh lệch chưa ai từng
   * thấy. Xem test "ca then chốt" trong `test/po/diff-gate.spec.ts`.
   *
   * Định dạng nguồn băm (nội bộ, không cần khớp bit-for-bit với PHP):
   *   mỗi dòng lệch  -> "<quoteItemId>:field=po/quote,field2=po2/quote2"
   *   nối các dòng bằng ";" (đã theo đúng thứ tự `rows` của compare(), tức
   *   thứ tự PoItem.id tăng dần — ổn định qua các lần gọi).
   * Dòng chỉ lệch ở ô CẢNH BÁO (product_name/unit) không đóng góp gì (rỗng
   * -> bị bỏ qua hẳn, không để lại dấu "<id>:" trơ trọi).
   *
   * ⚠ Sản xuất dùng SHA-1; bản viết lại này CHỦ Ý nâng lên SHA-256 (không
   * phải tương thích ngược, không cần đọc lại hash cũ từ hệ cũ).
   */
  async hash(poId: number): Promise<string> {
    const cmp = await this.compare(poId);
    return this.hashFromCompare(cmp);
  }

  /** Phần thuần của `hash()` — tách riêng để `acceptGap` tái dùng CHÍNH
   *  `CompareResult` nó vừa đọc để kiểm tra chốt chặn (F6), thay vì gọi lại
   *  `compare()` một lần nữa (tốn thêm round-trip DB và có nguy cơ đọc lệch
   *  nếu dữ liệu đổi giữa hai lần gọi). */
  private hashFromCompare(cmp: CompareResult): string {
    const rowParts: string[] = [];
    for (const row of cmp.rows) {
      const fieldParts: string[] = [];
      for (const f of FIELDS_CHAN) {
        const cell = row.cells[f];
        if (!cell.diff) continue;
        const poStr =
          cell.type === 'numeric' ? normalizeNumForHash(cell.po as number) : String(cell.po ?? '');
        const quoteStr =
          cell.type === 'numeric' ? normalizeNumForHash(cell.quote as number) : String(cell.quote ?? '');
        fieldParts.push(`${f}=${poStr}/${quoteStr}`);
      }
      if (fieldParts.length === 0) continue; // dòng chỉ lệch ô cảnh báo -> không góp phần
      rowParts.push(`${row.quoteItemId}:${fieldParts.join(',')}`);
    }
    return createHash('sha256').update(rowParts.join(';')).digest('hex');
  }

  /**
   * Ghi nhận một người có thẩm quyền đã ký nhận BỘ SỐ LỆCH hiện tại của PO
   * `poId` (chốt bằng `hash(poId)` tại thời điểm gọi). `reason` BẮT BUỘC —
   * rỗng/toàn khoảng trắng bị từ chối, KHÔNG ghi gì (ném `GapReasonRequired`,
   * không âm thầm nuốt lỗi).
   *
   * ⚠ F6 (review cuối #06, 23/09/2026) — hai chốt thêm, khớp
   * `libs/quote_po_diff.php` gốc: từ chối khi (a) không có báo giá canonical
   * liên kết (`compare().quoteId === null` — không có gì để so), hoặc (b)
   * không có ô CHẶN nào đang lệch (`coLechChan(cmp) === false` — "Báo giá đã
   * khớp PO — không cần chấp nhận"). Trước bản vá, hàm ghi VÔ ĐIỀU KIỆN sau
   * khi qua chốt `reason`, tích luỹ các dòng có hash của một bộ-số-lệch RỖNG.
   * Reviewer xác nhận ca (b) hiện KHÔNG khai thác được qua `canIssueInvoice`
   * (một lệch CHẶN luôn cho hash khác chuỗi rỗng) — vẫn thêm chốt để khớp
   * đúng hợp đồng gốc, không dựa vào "may mắn chưa bị khai thác".
   */
  async acceptGap(poId: number, reason: string, actor: string) {
    const trimmed = (reason ?? '').trim();
    if (trimmed === '') {
      throw new GapReasonRequired('Lý do chấp nhận chênh lệch là bắt buộc');
    }
    const cmp = await this.compare(poId);
    if (cmp.quoteId === null) {
      throw new GapNoLinkedQuote('PO chưa có báo giá liên kết — không có gì để chấp nhận chênh lệch');
    }
    if (!coLechChan(cmp)) {
      throw new GapNoBlockingDiff('Báo giá đã khớp PO — không cần chấp nhận');
    }
    const h = this.hashFromCompare(cmp);
    return this.prisma.poDiffAcceptance.create({
      data: { poId, hash: h, reason: trimmed, actor },
    });
  }

  /**
   * Cổng chặn xuất hoá đơn GTGT:
   *  - không có ô CHẶN nào lệch (kể cả khi CHỈ lệch cảnh báo/cấu trúc) -> ok
   *  - có ô CHẶN lệch NHƯNG bản ghi `acceptGap` MỚI NHẤT của PO này có `hash`
   *    khớp ĐÚNG hash hiện tại -> ok (người ký gần nhất đã thấy CHÍNH bộ số
   *    này)
   *  - có ô CHẶN lệch, bản ghi mới nhất không khớp (hoặc chưa từng chấp
   *    nhận) -> chặn, nêu tên các ô đang lệch.
   *
   * ⚠⚠⚠ F6 (review cuối #06, 23/09/2026) — CHỈ đọc bản ghi MỚI NHẤT
   * (`orderBy id desc, take 1`), KHÔNG `findFirst({ hash: currentHash })`
   * (bug cũ: tìm KHẮP LỊCH SỬ). Khớp đúng `qpd_accepted()` sản xuất — nó chỉ
   * đọc chấp nhận gần nhất và đòi CHÍNH bản đó khớp vân tay hiện tại.
   * Sai khác có thật: chấp nhận bộ lệch D (hash HD) -> báo giá sửa thành E
   * (HE) -> báo giá bị SỬA LẠI về D (hash lại thành HD, vì hash bám NỘI DUNG
   * đang lệch chứ không bám PO). Đọc "khắp lịch sử" thấy dòng HD cũ vẫn còn
   * -> lọt qua SAI — bản chấp nhận E (mới hơn, có chủ ý) đã bị dòng D cũ đè
   * lên. Đọc "chỉ bản mới nhất" thấy bản ghi mới nhất là HE ≠ HD hiện tại ->
   * CHẶN ĐÚNG, đòi ký lại. Xem test D→E→D trong `test/po/diff-gate.spec.ts`.
   */
  async canIssueInvoice(poId: number): Promise<{ ok: boolean; reason?: string }> {
    const cmp = await this.compare(poId);
    if (!coLechChan(cmp)) return { ok: true };

    const currentHash = this.hashFromCompare(cmp);
    const latest = await this.prisma.poDiffAcceptance.findFirst({
      where: { poId },
      orderBy: { id: 'desc' },
    });
    if (latest && latest.hash === currentHash) return { ok: true };

    const diffFields = new Set<DiffField>();
    for (const row of cmp.rows) {
      for (const f of FIELDS_CHAN) {
        if (row.cells[f].diff) diffFields.add(f);
      }
    }
    const names = [...diffFields].map((f) => FIELD_LABEL[f]).join(', ');
    return { ok: false, reason: `Lệch chưa được chấp nhận: ${names}` };
  }
}
