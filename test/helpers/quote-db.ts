import { Prisma } from '@prisma/client';
import { prisma } from './db';

export async function resetQuote() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE tbl_quote_fees, tbl_quote_items, tbl_quotes, tbl_fee_catalog RESTART IDENTITY CASCADE`,
  );
}

/** Header báo giá với mọi cột bắt buộc điền sẵn giá trị hợp lệ — override khi cần. */
export async function seedQuote(
  quoteCode: string,
  overrides: Partial<Prisma.QuoteUncheckedCreateInput> = {},
) {
  return prisma.quote.create({
    data: {
      quoteCode,
      rateRmbVnd: 3960,
      rateUsdVnd: 25400,
      rateCnyUsd: 6.4,
      fxBufferPct: 0,
      entrustFeePct: 0.03,
      freightVnPerKg: 10000,
      freightVnPerCbm: 1300000,
      entrustBase: 'full',
      paymentMode: 'tra_truoc',
      status: 1,
      cdate: 1,
      ...overrides,
    },
  });
}

/** Dòng báo giá với mọi cột bắt buộc điền sẵn giá trị hợp lệ (giống ca golden A) — override khi cần. */
export async function seedItem(
  quoteId: number,
  overrides: Partial<Prisma.QuoteItemUncheckedCreateInput> = {},
) {
  return prisma.quoteItem.create({
    data: {
      quoteId,
      sortOrder: 1,
      qty: 10,
      weightKg: 1,
      cbm: 0,
      unitPriceRmb: 25.5,
      domesticShipRmb: 0,
      qcCost: 0,
      otherCost: 0,
      amountRmb: 255,
      amountVnd: 1009800,
      shipToVnVnd: 10000,
      importTaxPct: 0,
      consumptionTaxPct: 0,
      antidumpingPct: 0,
      vatPct: 0.08,
      envtaxAmount: 0,
      importFeeVnd: 0,
      consumptionTaxVnd: 0,
      antidumpingVnd: 0,
      envtaxVnd: 0,
      vatAmount: 84007,
      entrustFeeVnd: 30294,
      fxBufferVnd: 0,
      totalVnd: 1134097,
      unitPriceVnd: 113409.7,
      unitPriceNovatVnd: 105009,
      baseInvoice: 1050090,
      vatInvoice: 84007,
      ...overrides,
    },
  });
}
