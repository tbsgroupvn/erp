import { PrismaModule } from '../../src/prisma/prisma.module';
// test/quote/e2e.spec.ts — Task 9: e2e vòng đời báo giá qua QuoteModule thật
// (Test.createTestingModule -> app.init()), KHÔNG gọi thẳng `new QuoteService`
// như test/quote/quote-service.spec.ts (Task 7) — mục tiêu ở đây là chứng
// minh QuoteModule TỰ WIRE đúng (Prisma + ScopeService của IamModule), không
// phải chứng minh lại công thức calcItem (đã có bộ golden A–F ở
// calc-item-new/old.spec.ts).
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { QuoteModule } from '../../src/quote/quote.module';
import { QuoteService, CreateQuoteInput, AddItemInput } from '../../src/quote/quote.service';
import { prisma } from '../helpers/db';
import { resetQuote } from '../helpers/quote-db';

// Header + dòng hàng golden A (xem plan §BỘ SỐ VÀNG, id 66040 + test/quote/
// calc-item-new.spec.ts) — vat_base_full=1, entrust_base='both'.
const HEADER_A: CreateQuoteInput = {
  rateRmbVnd: 3960,
  rateUsdVnd: 0,
  rateCnyUsd: 3960,
  fxBufferPct: 0,
  entrustFeePct: 0.03,
  freightVnPerKg: 10000,
  freightVnPerCbm: 1300000,
  entrustBase: 'both',
  currencyMode: 'rmb',
  vatBaseFull: true,
  vatExclService: false,
  paymentMode: 'tra_truoc',
};
const ITEM_A: AddItemInput = {
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
};

// Header + dòng hàng golden C (xem plan §BỘ SỐ VÀNG, id 61717 + test/quote/
// calc-item-old.spec.ts) — vat_base_full=0 (nhánh CŨ, hai con số VAT), tỷ
// giá/cước KHÁC header A. ⚠ Header báo giá là cấu hình PER-QUOTATION — không
// được nhét ca C vào cùng quotation của ca A (sẽ đổi luôn số của ca A), nên
// đây là HAI quotation riêng.
const HEADER_C: CreateQuoteInput = {
  rateRmbVnd: 3975,
  rateUsdVnd: 0,
  rateCnyUsd: 3975,
  fxBufferPct: 0,
  entrustFeePct: 0.03,
  freightVnPerKg: 6500,
  freightVnPerCbm: 1300000,
  entrustBase: 'full',
  currencyMode: 'rmb',
  vatBaseFull: false,
  vatExclService: false,
  paymentMode: 'tra_truoc',
};
const ITEM_C: AddItemInput = {
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
};

let app: INestApplication;
let svc: QuoteService;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [PrismaModule, QuoteModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  svc = mod.get(QuoteService);
});

beforeEach(async () => {
  await resetQuote();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('QuoteModule e2e — vòng đời báo giá', () => {
  it('2 báo giá (header A + header C) -> totalVnd đọc từ DB khớp golden A/C -> đổi tỷ giá -> recalcQuote -> số đổi', async () => {
    // -- Báo giá 1: header A, dòng hàng golden A --
    const quoteA = await svc.createQuote(HEADER_A, 'sale1');
    const itemA = await svc.addItem(quoteA.id, ITEM_A);

    // -- Báo giá 2 (RIÊNG): header C, dòng hàng golden C --
    const quoteC = await svc.createQuote(HEADER_C, 'sale1');
    const itemC = await svc.addItem(quoteC.id, ITEM_C);

    // Đọc lại từ DB (không phải từ giá trị trả về của addItem) — khẳng định
    // cột Decimal đã lưu đúng, khớp biên Decimal<->number ở quote.service.ts.
    const rereadA = await prisma.quoteItem.findUniqueOrThrow({ where: { id: itemA.id } });
    expect(Number(rereadA.totalVnd)).toBe(1_134_097);

    const rereadC = await prisma.quoteItem.findUniqueOrThrow({ where: { id: itemC.id } });
    expect(Number(rereadC.totalVnd)).toBe(4_023_562);

    // -- Đổi tỷ giá RMB->VND của báo giá A rồi recalcQuote: số phải đổi,
    // chứng minh cột lưu là DẪN XUẤT chứ không phải đóng băng lúc addItem. --
    await prisma.quote.update({ where: { id: quoteA.id }, data: { rateRmbVnd: 4200 } });
    const nRecalced = await svc.recalcQuote(quoteA.id);
    expect(nRecalced).toBe(1);

    const afterA = await prisma.quoteItem.findUniqueOrThrow({ where: { id: itemA.id } });
    expect(Number(afterA.totalVnd)).not.toBe(1_134_097);
    expect(Number(afterA.amountVnd)).toBe(255 * 4200);

    // Báo giá C không hề bị đụng tới — vẫn đúng golden C.
    const stillC = await prisma.quoteItem.findUniqueOrThrow({ where: { id: itemC.id } });
    expect(Number(stillC.totalVnd)).toBe(4_023_562);
  });
});
