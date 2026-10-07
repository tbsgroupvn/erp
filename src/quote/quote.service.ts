// src/quote/quote.service.ts
//
// `QuoteService` — CRUD header/item/fee của báo giá, cầu nối giữa DB
// (Prisma, cột `Decimal`) và `calcItem` (hàm thuần, `number`/float64 —
// xem quote-calc.ts). KHÔNG cài lại công thức tính giá ở đây.
//
// ⚠ BIÊN Decimal ↔ number: `calcItem` cố ý dùng `number` để khớp bit-để-bit
// với PHP legacy (xem quote-calc.ts đầu file). Cột Prisma vẫn là `Decimal`.
// MỌI chuyển đổi hai chiều đi qua ĐÚNG HAI hàm ở dưới (`d2n`/`n2d`) — không
// rải rác nơi khác. Truyền thẳng một `Prisma.Decimal` vào phép toán số học
// (+, ×, so sánh) sẽ ÂM THẦM ra rác (nối chuỗi hoặc NaN) vì Decimal không tự
// ép kiểu như PHP — đây là lỗi đã cảnh báo trước khi cắn thật.
import { Injectable } from '@nestjs/common';
import { Prisma, Quote, QuoteItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../iam/scope.service';
import { calcItem, QuoteHeaderConfig, QuoteItemInput } from './quote-calc';
import { nowSec } from '../common/money';

/** Decimal (hoặc number/null) đọc từ DB -> number thuần cho calcItem. */
function d2n(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}
/** number thuần (kết quả calcItem hoặc input) -> Prisma.Decimal để ghi cột. */
function n2d(v: number | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(v ?? 0);
}

// F2 — tập field hợp lệ của Quote (Prisma tự sinh, luôn khớp schema hiện
// hành). Dùng để phát hiện where-clause tham chiếu cột KHÔNG tồn tại trên
// Quote trước khi đưa xuống Prisma — xem comment ở listForUser().
//
// ⛔ CHỈ dùng cho where do `ScopeService.buildDocScope()` sinh ra, và CHỈ ở
// `listForUser()`. Lý do: mọi nhánh của buildDocScope chỉ phát ra khoá là
// field VÔ HƯỚNG ở tầng trên cùng (`createdBy`, `storeId`, `id`) — không
// bao giờ có filter quan hệ. Nếu đem guard này soi một `where` giàu hơn
// (vd `{ items: { some: {...} } }`, hay filter do caller trộn thêm), nó sẽ
// coi khoá quan hệ hợp lệ là "field lạ" và trả về RỖNG cho một truy vấn
// ĐÚNG — tệ hơn cả cái crash mà nó thay thế, vì fail-closed kiểu đó KHÔNG
// AI NHẬN RA. Muốn dùng rộng hơn thì phải dạy nó biết khoá quan hệ +
// toán tử Prisma trước đã.
const QUOTE_FIELDS = new Set<string>(Object.values(Prisma.QuoteScalarFieldEnum));

/** true nếu `where` (đệ quy qua OR/AND/NOT) tham chiếu một field Quote
 *  KHÔNG có — dấu hiệu ScopeService đã dựng where cho một field/bảng khác. */
function referencesUnknownQuoteField(where: unknown): boolean {
  if (!where || typeof where !== 'object') return false;
  for (const [key, val] of Object.entries(where as Record<string, unknown>)) {
    if (key === 'OR' || key === 'AND' || key === 'NOT') {
      const arr = Array.isArray(val) ? val : [val];
      if (arr.some((w) => referencesUnknownQuoteField(w))) return true;
    } else if (!QUOTE_FIELDS.has(key)) {
      return true;
    }
  }
  return false;
}

export type CreateQuoteInput = {
  buyerId?: number | null;
  leadId?: number | null;
  prospectName?: string | null;
  prospectPhone?: string | null;
  prospectTax?: string | null;
  prospectAddress?: string | null;

  rateRmbVnd: number;
  rateUsdVnd: number;
  rateCnyUsd: number;
  fxBufferPct?: number;
  entrustFeePct: number;
  freightVnPerKg: number;
  freightVnPerCbm: number;
  entrustBase?: string;
  currencyMode?: string;
  vatBaseFull?: boolean;
  vatExclService?: boolean;
  paymentMode: 'tra_truoc' | 'cong_no';
  status?: number;
};

export type AddItemInput = {
  sortOrder?: number;
  productUrl?: string | null;
  imageUrl?: string | null;
  origin?: string | null;
  model?: string | null;
  hsCode?: string | null;
  nameVn?: string | null;
  size?: string | null;
  material?: string | null;
  specParams?: string | null;
  unit?: string | null;

  qty: number;
  weightKg: number;
  cbm: number;
  unitPriceRmb: number;
  domesticShipRmb: number;
  qcCost?: number;
  otherCost?: number;
  importTaxPct?: number;
  consumptionTaxPct?: number;
  antidumpingPct?: number;
  envtaxAmount?: number;
  vatPct: number;
};

export type AddFeeInput = {
  catalogId?: number | null;
  feeCode?: string | null;
  feeName?: string | null;
  leg?: string | null;
  basis?: string | null;
  pctBase?: string | null;
  unit?: string | null;
  qty: number;
  qty2?: number | null;
  pct?: number | null;
  unitPrice: number;
  unitPrice2?: number | null;
  /** Phân số (0.08 = 8%) — cùng quy ước với QuoteItem.vatPct. */
  vatPct?: number;
  /** true (mặc định) = gộp vào giá bán; false = báo riêng. */
  included?: boolean;
  formulaText?: string | null;
  explainText?: string | null;
  note?: string | null;
  sortOrder?: number;
};

@Injectable()
export class QuoteService {
  constructor(private prisma: PrismaService, private scope: ScopeService) {}

  // -- Sinh mã báo giá -----------------------------------------------------
  // Cùng lối CustomerCodeService: SEQUENCE Postgres, nextval() KHÔNG bị
  // rollback ⇒ số đã phát không bao giờ tái dùng kể cả khi transaction tạo
  // quote sau đó thất bại. Xem prisma/migrations/<ts>_quote_code_seq/.
  // F5 — public (không còn private): mirror CustomerCodeService.nextNum()
  // (test/masterdata/customer-code.spec.ts) — cần lộ ra để test pin đúng
  // invariant "số đã phát không tái dùng" bằng cách đốt số qua CHÍNH `tx`
  // (transaction) rồi rollback, xem test/quote/quote-service.spec.ts.
  async nextQuoteNum(): Promise<number> {
    const r = await this.prisma.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('quote_code_seq')`;
    return Number(r[0].nextval);
  }
  // F5 — prod: TOÀN BỘ 413 dòng dùng dạng `BG-YYYY-MM-NNN` (vd
  // `BG-2026-09-413`), NNN là bộ đếm GLOBAL (không reset theo tháng) lấy từ
  // quote_code_seq. Định dạng cũ `BG<seq>` KHÔNG khớp — xem review F5 +
  // migration doc mục 4 (sinh quoteCode/seed sequence đi cùng cặp: cách đọc
  // NNN từ mã cũ khi seed sequence PHẢI khớp với cách sinh mã mới ở đây).
  async nextQuoteCode(prefix = 'BG'): Promise<string> {
    const num = await this.nextQuoteNum();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${prefix}-${year}-${month}-${num}`;
  }

  async createQuote(input: CreateQuoteInput, by: string): Promise<Quote> {
    const quoteCode = await this.nextQuoteCode();
    return this.prisma.quote.create({
      data: {
        quoteCode,
        buyerId: input.buyerId ?? null,
        leadId: input.leadId ?? null,
        prospectName: input.prospectName ?? null,
        prospectPhone: input.prospectPhone ?? null,
        prospectTax: input.prospectTax ?? null,
        prospectAddress: input.prospectAddress ?? null,

        rateRmbVnd: n2d(input.rateRmbVnd),
        rateUsdVnd: n2d(input.rateUsdVnd),
        rateCnyUsd: n2d(input.rateCnyUsd),
        fxBufferPct: n2d(input.fxBufferPct ?? 0),
        entrustFeePct: n2d(input.entrustFeePct),
        freightVnPerKg: n2d(input.freightVnPerKg),
        freightVnPerCbm: n2d(input.freightVnPerCbm),
        entrustBase: input.entrustBase ?? 'full',
        currencyMode: input.currencyMode ?? 'rmb',
        vatBaseFull: input.vatBaseFull ? 1 : 0,
        vatExclService: input.vatExclService ? 1 : 0,

        paymentMode: input.paymentMode,
        // F7 — prod tbl_quotes.status chỉ từng quan sát 2 giá trị: 0 (128
        // dòng) hoặc 2 (285 dòng) — KHÔNG BAO GIỜ 1. Mặc định về 0 để khớp
        // đa số quan sát được; ý nghĩa nghiệp vụ 0/2 CHƯA được hình thức
        // hoá (chưa có enum/định nghĩa trạng thái báo giá) — đo prod
        // 23/09/2026, xem review F7.
        status: input.status ?? 0,

        createdBy: by,
        cdate: nowSec(),
      },
    });
  }

  /** Quote (Decimal) -> QuoteHeaderConfig (number) cho calcItem. MỘT chỗ duy nhất. */
  private headerConfig(quote: Quote): QuoteHeaderConfig {
    return {
      rateRmbVnd: d2n(quote.rateRmbVnd),
      rateUsdVnd: d2n(quote.rateUsdVnd),
      currencyMode: quote.currencyMode ?? 'rmb',
      freightVnPerKg: d2n(quote.freightVnPerKg),
      freightVnPerCbm: d2n(quote.freightVnPerCbm),
      entrustFeePct: d2n(quote.entrustFeePct),
      entrustBase: quote.entrustBase ?? 'full',
      fxBufferPct: d2n(quote.fxBufferPct),
      vatBaseFull: quote.vatBaseFull === 1,
      vatExclService: quote.vatExclService === 1,
    };
  }

  /** QuoteItem đã lưu (Decimal) -> QuoteItemInput (number) để tính lại. */
  private itemCalcInputFromRow(item: QuoteItem): QuoteItemInput {
    return {
      qty: d2n(item.qty),
      unitPriceRmb: d2n(item.unitPriceRmb),
      domesticShipRmb: d2n(item.domesticShipRmb),
      weightKg: d2n(item.weightKg),
      cbm: d2n(item.cbm),
      importTaxPct: d2n(item.importTaxPct),
      consumptionTaxPct: d2n(item.consumptionTaxPct),
      antidumpingPct: d2n(item.antidumpingPct),
      envtaxAmount: d2n(item.envtaxAmount),
      vatPct: d2n(item.vatPct),
      qcCost: d2n(item.qcCost),
      otherCost: d2n(item.otherCost),
    };
  }

  async addItem(quoteId: number, input: AddItemInput): Promise<QuoteItem> {
    const quote = await this.prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    const header = this.headerConfig(quote);
    const calcInput: QuoteItemInput = {
      qty: input.qty,
      unitPriceRmb: input.unitPriceRmb,
      domesticShipRmb: input.domesticShipRmb,
      weightKg: input.weightKg,
      cbm: input.cbm,
      importTaxPct: input.importTaxPct ?? 0,
      consumptionTaxPct: input.consumptionTaxPct ?? 0,
      antidumpingPct: input.antidumpingPct ?? 0,
      envtaxAmount: input.envtaxAmount ?? 0,
      vatPct: input.vatPct,
      qcCost: input.qcCost ?? 0,
      otherCost: input.otherCost ?? 0,
    };
    const calc = calcItem(calcInput, header);

    // F10 — sortOrder trước đây = `count()+1` NGOÀI transaction: hai
    // addItem() chạy đồng thời trên cùng quoteId có thể đọc cùng count()
    // rồi cùng ghi trùng sortOrder. Dùng MAX(sortOrder)+1 ĐỌC TRONG CÙNG
    // transaction với create() — thu hẹp cửa sổ race đáng kể so với hai câu
    // lệnh tách rời (không cần SELECT...FOR UPDATE khoá cả bảng cho một cột
    // chỉ ảnh hưởng THỨ TỰ HIỂN THỊ, không phải tiền).
    return this.prisma.$transaction(async (tx) => {
      const sortOrder =
        input.sortOrder ??
        ((await tx.quoteItem.aggregate({ where: { quoteId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1;

      return tx.quoteItem.create({
      data: {
        quoteId,
        sortOrder,
        productUrl: input.productUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        origin: input.origin ?? null,
        model: input.model ?? null,
        hsCode: input.hsCode ?? null,
        nameVn: input.nameVn ?? null,
        size: input.size ?? null,
        material: input.material ?? null,
        specParams: input.specParams ?? null,
        unit: input.unit ?? null,

        // Input gốc — lưu lại nguyên vẹn (không chỉ lưu kết quả tính).
        qty: n2d(calcInput.qty),
        weightKg: n2d(calcInput.weightKg),
        cbm: n2d(calcInput.cbm),
        unitPriceRmb: n2d(calcInput.unitPriceRmb),
        domesticShipRmb: n2d(calcInput.domesticShipRmb),
        qcCost: n2d(calcInput.qcCost),
        otherCost: n2d(calcInput.otherCost),
        importTaxPct: n2d(calcInput.importTaxPct),
        consumptionTaxPct: n2d(calcInput.consumptionTaxPct),
        antidumpingPct: n2d(calcInput.antidumpingPct),
        envtaxAmount: n2d(calcInput.envtaxAmount),
        vatPct: n2d(calcInput.vatPct),

        // Kết quả calcItem — DẪN XUẤT, không nhập tay.
        shipBy: calc.shipBy,
        amountRmb: n2d(calc.amountRmb),
        amountVnd: n2d(calc.amountVnd),
        shipToVnVnd: n2d(calc.shipToVnVnd),
        importFeeVnd: n2d(calc.importFeeVnd),
        consumptionTaxVnd: n2d(calc.consumptionTaxVnd),
        antidumpingVnd: n2d(calc.antidumpingVnd),
        envtaxVnd: n2d(calc.envtaxVnd),
        vatAmount: n2d(calc.vatAmount),
        entrustFeeVnd: n2d(calc.entrustFeeVnd),
        fxBufferVnd: n2d(calc.fxBufferVnd),
        totalVnd: n2d(calc.totalVnd),
        unitPriceVnd: n2d(calc.unitPriceVnd),
        unitPriceNovatVnd: n2d(calc.unitPriceNovatVnd),
        baseInvoice: n2d(calc.baseInvoice),
        vatInvoice: n2d(calc.vatInvoice),
      },
      });
    });
  }

  /** Tính lại MỌI dòng của báo giá theo header HIỆN HÀNH (vd sau khi đổi tỷ
   *  giá) — pin rằng các cột đã lưu là DẪN XUẤT, không phải nhập tay. */
  async recalcQuote(quoteId: number): Promise<number> {
    const quote = await this.prisma.quote.findUniqueOrThrow({
      where: { id: quoteId },
      include: { items: true },
    });
    const header = this.headerConfig(quote);

    for (const item of quote.items) {
      const calcInput = this.itemCalcInputFromRow(item);
      const calc = calcItem(calcInput, header);
      await this.prisma.quoteItem.update({
        where: { id: item.id },
        data: {
          shipBy: calc.shipBy,
          amountRmb: n2d(calc.amountRmb),
          amountVnd: n2d(calc.amountVnd),
          shipToVnVnd: n2d(calc.shipToVnVnd),
          importFeeVnd: n2d(calc.importFeeVnd),
          consumptionTaxVnd: n2d(calc.consumptionTaxVnd),
          antidumpingVnd: n2d(calc.antidumpingVnd),
          envtaxVnd: n2d(calc.envtaxVnd),
          vatAmount: n2d(calc.vatAmount),
          entrustFeeVnd: n2d(calc.entrustFeeVnd),
          fxBufferVnd: n2d(calc.fxBufferVnd),
          totalVnd: n2d(calc.totalVnd),
          unitPriceVnd: n2d(calc.unitPriceVnd),
          unitPriceNovatVnd: n2d(calc.unitPriceNovatVnd),
          baseInvoice: n2d(calc.baseInvoice),
          vatInvoice: n2d(calc.vatInvoice),
        },
      });
    }
    return quote.items.length;
  }

  // -- Phạm vi xem (#01 ScopeService.buildDocScope) ------------------------
  // `Quote` chỉ có MỘT chủ sở hữu thật: `created_by` (05-bao-gia.md §2 — "Sale
  // lập/sửa báo giá của mình"), KHÔNG có khái niệm "sale phụ" như Customer, và
  // KHÔNG có cột kho. Nên khai báo rõ cả ba với buildDocScope:
  //   saler      = 'createdBy'  (bắt buộc: mặc định 'saler' không tồn tại trên Quote)
  //   salerOther = null         (không có sale phụ ⇒ nhánh own chỉ lọc theo createdBy)
  //   warehouse  = null (mặc định) ⇒ scope 'warehouse' DENY thay vì dựng filter hỏng
  //
  // 23/09/2026: ba lỗ này trước đây phải vá vòng tại đây (trỏ salerOther vào
  // chính createdBy + guard dò field lạ) vì #01 không cho tắt. Nay đã sửa ĐÚNG
  // GỐC ở ScopeService (warehouse thành opt-in, salerOther nhận null), nên chỗ
  // này chỉ còn khai báo trung thực hình dạng của Quote.
  //
  // Guard `referencesUnknownQuoteField` GIỮ LẠI làm lớp phòng thủ thứ hai: nếu
  // sau này #01 thêm một nhánh scope mới sinh ra field Quote không có, ta trả
  // rỗng (fail-closed) thay vì để Prisma ném 500 lên người dùng.
  async listForUser(perm: string, uid: number): Promise<Quote[]> {
    const where = await this.scope.buildDocScope(perm, uid, { saler: 'createdBy', salerOther: null });
    if (referencesUnknownQuoteField(where)) return [];
    return this.prisma.quote.findMany({ where, orderBy: { id: 'desc' } });
  }

  // ═══ Task 8 — phí dịch vụ (QuoteFee), 3 số thập phân ═══════════════════

  async addFee(quoteId: number, input: AddFeeInput) {
    const qty = input.qty;
    const unitPrice = input.unitPrice;
    const vatPct = input.vatPct ?? 0;

    // amount_novat/vat_amount/amount_total: KHÔNG làm tròn thủ công ở đây —
    // cột Decimal(18,3) tự quy về đúng 3 số lẻ khi ghi (cùng lối các cột
    // Decimal(20,2) của QuoteItem ở addItem/recalcQuote phía trên). Làm
    // tròn tay về ít số lẻ hơn ở bước này chính là bẫy đã cắn thật ở hệ cũ
    // (tbs_money() mặc định 0 lẻ nuốt mất .567 — xem plan mục "SỐ HỌC" +
    // 05-bao-gia.md luật #5).
    const amountNovat = qty * unitPrice;
    const vatAmount = amountNovat * vatPct;
    const amountTotal = amountNovat + vatAmount;

    return this.prisma.quoteFee.create({
      data: {
        quoteId,
        catalogId: input.catalogId ?? null,
        feeCode: input.feeCode ?? null,
        feeName: input.feeName ?? null,
        leg: input.leg ?? null,
        basis: input.basis ?? null,
        pctBase: input.pctBase ?? null,
        unit: input.unit ?? null,

        qty: n2d(qty),
        qty2: input.qty2 != null ? n2d(input.qty2) : null,
        pct: input.pct != null ? n2d(input.pct) : null,
        unitPrice: n2d(unitPrice),
        unitPrice2: input.unitPrice2 != null ? n2d(input.unitPrice2) : null,

        amountNovat: n2d(amountNovat),
        vatPct: n2d(vatPct),
        vatAmount: n2d(vatAmount),
        amountTotal: n2d(amountTotal),

        included: input.included === false ? 0 : 1,

        formulaText: input.formulaText ?? null,
        explainText: input.explainText ?? null,
        note: input.note ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  /** Tổng giá bán cho khách = Σ totalVnd các dòng hàng + Σ amountTotal các
   *  phí có included=true. Phí included=false được BÁO RIÊNG, KHÔNG gộp —
   *  dùng hàm tổng hợp này (thay vì đọc thẳng cột included) để khẳng định
   *  cờ included thật sự đổi HÀNH VI, không chỉ đổi giá trị lưu. */
  async sellPriceTotal(quoteId: number): Promise<{ itemsTotal: number; includedFeesTotal: number; total: number }> {
    const [items, fees] = await Promise.all([
      this.prisma.quoteItem.findMany({ where: { quoteId } }),
      this.prisma.quoteFee.findMany({ where: { quoteId } }),
    ]);
    const itemsTotal = items.reduce((s, it) => s + d2n(it.totalVnd), 0);
    const includedFeesTotal = fees
      .filter((f) => f.included === 1)
      .reduce((s, f) => s + d2n(f.amountTotal), 0);
    return { itemsTotal, includedFeesTotal, total: itemsTotal + includedFeesTotal };
  }
}
