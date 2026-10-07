import { PrismaModule } from '../../src/prisma/prisma.module';
// test/customs/e2e.spec.ts — #08 Task 5: e2e qua CustomsModule THẬT
// (Test.createTestingModule -> app.init()), chứng minh module tự wire đúng
// (Prisma + ImportTaxService của #05 qua QuoteModule) VÀ chứng minh một
// vòng đời dòng khai thật: cont (#07) + dòng khai gắn báo giá (#05) ->
// declaredValue USD -> tra tỷ giá qua thang usdRateForFile() (KHÔNG override
// tay) -> recalcItemTax -> thuế khớp tay -> đổi tỷ giá -> tính lại -> thuế
// đổi đúng tỷ lệ -> và một ca hạ cánh 'no_rate' — nhánh DUY NHẤT từng chạy
// thật trên prod (xem plan mục "⚠ ĐO PROD": tax_rate_used>0 = 0/145 dòng).
//
// Cùng lối test/warehouse/e2e.spec.ts (#07 Task 6): dựng module thật qua
// Nest DI, KHÔNG new tay từng service, để tự bắt lỗi wiring (thiếu provider/
// export, quên import QuoteModule cho ImportTaxService...).
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CustomsModule } from '../../src/customs/customs.module';
import { DeclSourceService } from '../../src/customs/decl-source.service';
import { CustomsDeclarationService } from '../../src/customs/customs-declaration.service';
import { ImportGoodsService } from '../../src/customs/import-goods.service';
import { HsTariffService } from '../../src/customs/hs-tariff.service';
import { prisma } from '../helpers/db';
import { resetCustoms, seedExchangeRate } from '../helpers/customs-db';
import { resetWarehouse, seedTransportFile } from '../helpers/warehouse-db';
import { resetQuote, seedQuote, seedItem } from '../helpers/quote-db';

let app: INestApplication;
let declSource: DeclSourceService;
let declSvc: CustomsDeclarationService;
let goodsSvc: ImportGoodsService;
let hsSvc: HsTariffService;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [PrismaModule, CustomsModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  declSource = mod.get(DeclSourceService);
  declSvc = mod.get(CustomsDeclarationService);
  goodsSvc = mod.get(ImportGoodsService);
  hsSvc = mod.get(HsTariffService);
});

beforeEach(async () => {
  await resetWarehouse();
  await resetQuote();
  await resetCustoms();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('CustomsModule e2e — vòng đời dòng khai thật (#08 Task 5)', () => {
  it('module tự wire đủ 4 service qua Nest DI (Prisma dùng chung + ImportTaxService của #05 qua QuoteModule)', () => {
    expect(declSource).toBeInstanceOf(DeclSourceService);
    expect(declSvc).toBeInstanceOf(CustomsDeclarationService);
    expect(goodsSvc).toBeInstanceOf(ImportGoodsService);
    expect(hsSvc).toBeInstanceOf(HsTariffService);
  });

  it('cont + dòng khai gắn báo giá -> tra tỷ giá qua THANG (không override) -> recalcItemTax khớp tay -> đổi tỷ giá -> thuế đổi ĐÚNG TỶ LỆ -> mất tỷ giá -> zero sạch (no_rate — nhánh DUY NHẤT prod từng chạy thật)', async () => {
    // ── 1. Cont thật qua #07 (KHÔNG chốt usd_rate_closed tay — buộc phải
    //    tra qua treasury) + một dòng tỷ giá treasury cũ (chắc chắn <= hôm nay). ──
    const file = await seedTransportFile();
    await seedExchangeRate({ rateVnd: 25_000, rateDate: new Date('2020-01-01') });

    // ── 2. Báo giá thật qua #05 — tỷ trọng a=800.000/s=150.000/c=50.000 trên
    //    tong=1.000.000 (đúng ví dụ "ca tỷ trọng thật" của plan Task 2). ──
    const quote = await seedQuote('ZZ-CUSTOMS-E2E-1');
    const qItem = await seedItem(quote.id, {
      amountVnd: 800_000,
      shipToVnVnd: 150_000,
      otherCost: 50_000,
    });

    // ── 3. Dòng khai (transport_file_items) gắn cont + báo giá gốc.
    //    declaredValue=40 USD × tygia(25.000) = tgk=1.000.000, khớp ĐÚNG
    //    tổng báo giá -> tachNenThue chia tỷ trọng ra số nguyên sạch. ──
    const declItem = await prisma.transportFileItem.create({
      data: {
        fileId: file.id,
        quoteItemId: qItem.id,
        declaredValue: 40,
        importDutyRate: 5, // PHẦN TRĂM — truyền thẳng, không ×100
        consumptionTaxRate: 0,
        antidumpingPct: 0,
        envtaxAmount: 0, // giữ 0 để ca "đổi tỷ giá" bên dưới tuyến tính TUYỆT ĐỐI
        vatRate: 8,
        quantity: 10,
        freightAlloc: 999_999_999, // ⚠⚠⚠ USD vs VND — cố tình đặt to để chứng minh KHÔNG lọt vào nền thuế
      },
    });

    // ── 4. recalcItemTax KHÔNG truyền tygiaOverride -> PHẢI tự tra qua
    //    usdRateForFile() (thang cont -> treasury_closed -> treasury_today
    //    -> none), rơi tới rung treasury_today vì không có usd_rate_closed
    //    lẫn closedAt. ──
    const ladder = await declSource.usdRateForFile(file.id);
    expect(ladder).toEqual({ rate: 25_000, src: 'treasury_today', date: expect.any(Date) });

    const r1 = await declSvc.recalcItemTax(declItem.id);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error('setup');

    // Tính tay (calc5 nguyên văn — xem src/quote/import-tax.service.ts):
    //   tgk = 40 × 25.000 = 1.000.000
    //   nen = tachNenThue: a=800.000,s=150.000,c=50.000,tt=1.000.000
    //         -> hang=800.000, cuoc=150.000, cpk=50.000
    //   nk    = 800.000 × 5%                       = 40.000
    //   ttdb  = (800.000+40.000) × 0%               = 0
    //   cbpg  = 800.000 × 0%                         = 0
    //   bvmt  = 10 × 0                               = 0
    //   nenVat= 800.000+150.000+40.000+0+0+0         = 990.000
    //   vat   = 990.000 × 8%                         = 79.200
    //   tong  = 40.000+0+0+0+79.200                  = 119.200
    expect(r1.taxBase).toBe(1_000_000);
    expect(r1.dutyNkAmt).toBe(40_000);
    expect(r1.dutyTtdbAmt).toBe(0);
    expect(r1.dutyCbpgAmt).toBe(0);
    expect(r1.envtaxVnd).toBe(0);
    expect(r1.dutyVatAmt).toBe(79_200);
    expect(r1.totalTax).toBe(119_200);
    expect(r1.taxRateUsed).toBe(25_000);

    const reread1 = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: declItem.id } });
    expect(Number(reread1.taxBase)).toBe(1_000_000);
    expect(Number(reread1.totalTax)).toBe(119_200);
    // ⚠⚠⚠ freightAlloc KHÔNG được vào nền thuế — dù đặt =999.999.999 (VND,
    // khổng lồ so với USD), totalTax vẫn khớp đúng số tính tay ở trên.

    // ── 5. Đổi tỷ giá (thêm dòng treasury MỚI HƠN, ưu tiên bởi ORDER BY
    //    rate_date DESC) -> tính lại KHÔNG override -> mọi cột thuế phải
    //    đổi ĐÚNG TỶ LỆ với tỷ giá mới (envtaxAmount=0 ở dòng khai này nên
    //    KHÔNG có số hạng tuyệt đối nào phá tuyến tính). ──
    await seedExchangeRate({ rateVnd: 50_000, rateDate: new Date('2020-06-01') }); // gấp đôi, vẫn <= hôm nay
    const ladder2 = await declSource.usdRateForFile(file.id);
    expect(ladder2.rate).toBe(50_000);

    const r2 = await declSvc.recalcItemTax(declItem.id);
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error('setup');

    const tyLe = r2.taxRateUsed / r1.taxRateUsed;
    expect(tyLe).toBe(2);
    expect(r2.taxBase).toBe(r1.taxBase * tyLe);
    expect(r2.dutyNkAmt).toBe(r1.dutyNkAmt * tyLe);
    expect(r2.dutyVatAmt).toBe(r1.dutyVatAmt * tyLe);
    expect(r2.totalTax).toBe(r1.totalTax * tyLe);

    // ── 6. Ca 'no_rate' — nhánh DUY NHẤT prod từng chạy thật (đo 23/09/2026:
    //    tax_rate_used>0 = 0/145 dòng). Cont MỚI, KHÔNG usd_rate_closed,
    //    KHÔNG closedAt, và KHÔNG một dòng tbl_exchange_rates nào (đúng
    //    trạng thái prod: bảng RỖNG toàn bộ) -> zero SẠCH mọi cột thuế. ──
    await resetCustoms(); // xoá sạch tbl_exchange_rates vừa seed ở bước 4-5
    const file2 = await seedTransportFile();
    const declItem2 = await prisma.transportFileItem.create({
      data: {
        fileId: file2.id,
        quoteItemId: qItem.id,
        declaredValue: 40,
        importDutyRate: 5,
        vatRate: 8,
        quantity: 10,
        // ⚠ Dòng khai ĐÃ CÓ số thuế từ một lần tính trước (giả lập trạng
        // thái thật: cont bị mất tỷ giá sau khi đã tính — closed_at gỡ hoặc
        // treasury bị xoá) — số CŨ trông như số ĐÚNG, khẳng định
        // recalcItemTax GHI ĐÈ về 0 chứ không giữ nguyên.
        taxBase: 999_999,
        dutyNkAmt: 999_999,
        totalTax: 999_999,
        taxRateUsed: 12_345,
      },
    });

    const ladderNone = await declSource.usdRateForFile(file2.id);
    expect(ladderNone).toEqual({ rate: 0, src: 'none', date: null });

    const r3 = await declSvc.recalcItemTax(declItem2.id);
    expect(r3.ok).toBe(false);
    if (r3.ok) throw new Error('setup');
    expect(r3.error).toBe('no_rate');

    const reread2 = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: declItem2.id } });
    expect(Number(reread2.taxBase)).toBe(0);
    expect(Number(reread2.dutyNkAmt)).toBe(0);
    expect(Number(reread2.totalTax)).toBe(0);
    expect(Number(reread2.taxRateUsed)).toBe(0);
  });

  it('ImportGoodsService + HsTariffService cùng module: upsert hàng nhập rồi tra biểu thuế qua HS đã gõ đúng — mã HS gõ THỪA số không khớp hs_norm gốc (đúng hành vi, không phải bug)', async () => {
    await prisma.hsTariff.create({
      data: { hsRaw: '8515.80.90', hsNorm: '85158090', hsLevel: 8, vat: '8', nkUuDai: '5' },
    });

    const up = await goodsSvc.upsert({ productName: 'Máy hàn E2E', hsCode: '8515.80.90', priceUsd: 120 });
    expect(up).toBe('inserted');

    const traThua = await hsSvc.tra('8515809000'); // norm='8515809000' (10 số) != '85158090' đã lưu -> KHÔNG khớp
    expect(traThua).toBeNull();

    const traDung = await hsSvc.tra('8515.80.90');
    expect(traDung?.hsNorm).toBe('85158090');
    expect(traDung?.vat.value).toBe(8);
    expect(traDung?.nkUuDai.value).toBe(5);
  });
});
