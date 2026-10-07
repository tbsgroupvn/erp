// test/customs/recalc-item-tax.spec.ts — #08 Task 3
//
// CustomsDeclarationService.recalcItemTax() — tái hiện NGUYÊN VĂN
// recalcItemTax (libs/cls.container.php:726). Xem
// F:/01_TBS_GROUP/docs/rewrite-spec/plans/2026-09-23-08-haiquan-plan.md
// mục "⚠⚠⚠ CÔNG THỨC" + Global Constraints.
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DeclSourceService } from '../../src/customs/decl-source.service';
import { ImportTaxService } from '../../src/quote/import-tax.service';
import { CustomsDeclarationService } from '../../src/customs/customs-declaration.service';
import { prisma } from '../helpers/db';
import { resetQuote, seedQuote, seedItem } from '../helpers/quote-db';
import { resetWarehouse, seedTransportFile } from '../helpers/warehouse-db';
import { resetCustoms, seedExchangeRate } from '../helpers/customs-db';

describe('CustomsDeclarationService.recalcItemTax — #08 Task 3, tính thuế dòng khai', () => {
  const declSource = new DeclSourceService(prisma as unknown as PrismaService);
  const importTax = new ImportTaxService();
  const svc = new CustomsDeclarationService(prisma as unknown as PrismaService, declSource, importTax);

  beforeEach(async () => {
    await resetWarehouse();
    await resetQuote();
    await resetCustoms();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ⛔⛔ RÀNG BUỘC CỨNG: cấm cài lại công thức 5 sắc thuế ở #08. Ca test
  // TĨNH này grep chính file nguồn: phải THẤY gọi ImportTaxService.calc5,
  // và KHÔNG được có phép "× 100" nào (đó là dấu hiệu ai đó tự nhân phần
  // trăm — dòng khai đã là phần trăm sẵn, khác #05 phải ×100).
  // ⚠ MINOR (a) (fix-round-2) — bỏ nhánh regex "cấm ×100" của ca này. Nó đã
  // hai lần cho thấy dễ vỡ: lần đầu bắt nhầm `round2()`'s `v*100` (phải vá
  // lại bằng một danh sách tên biến), và regex theo TÊN BIẾN/hình dạng
  // MÃ NGUỒN không bao giờ bao quát hết mọi cách viết lại phép ×100
  // (`Number(x)*100`, `100*pctNk`, qua biến trung gian, qua hàm phụ…).
  // Ca hành vi `⚠⚠ CỔNG GÁC` bên dưới ĐÃ được mutation-test (ép ×100 thật,
  // xem task-2-report.md) và bắt được lỗi này bất kể mã nguồn viết thế
  // nào — giữ lại phần kiểm tĩnh còn CHẮC CHẮN đúng (import + gọi calc5),
  // bỏ phần suy đoán hình dạng mã.
  it('⛔⛔ KHÔNG cài lại công thức 5 sắc thuế — gọi thẳng ImportTaxService.calc5', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../src/customs/customs-declaration.service.ts'),
      'utf8',
    );
    expect(src).toMatch(/import\s*{\s*ImportTaxService\s*}\s*from\s*'\.\.\/quote\/import-tax\.service'/);
    expect(src).toMatch(/\.calc5\(/);
  });

  // Ca cổng gác: dòng khai import_duty_rate=5 (nghĩa là 5%) trên nền
  // 1.000.000 (không gắn báo giá -> phía an toàn, nen.hang=tong) phải ra
  // NK=50.000. Nếu ai đó ×100 (hiểu nhầm là phân số) sẽ ra 5.000.000.
  it('⚠⚠ CỔNG GÁC — thuế suất PHẦN TRĂM truyền THẲNG, không ×100: import_duty_rate=5 trên nền 1.000.000 -> NK=50.000', async () => {
    const file = await seedTransportFile();
    const declItem = await prisma.transportFileItem.create({
      data: {
        fileId: file.id,
        declaredValue: 40, // USD
        importDutyRate: 5, // 5%
        consumptionTaxRate: 0,
        antidumpingPct: 0,
        envtaxAmount: 0,
        vatRate: 0,
        quantity: 1,
      },
    });

    const r = await svc.recalcItemTax(declItem.id, 25_000); // tygia=25.000 -> tgk=1.000.000
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.taxBase).toBe(1_000_000);
    expect(r.dutyNkAmt).toBe(50_000); // NẾU ×100 sai sẽ ra 5.000.000
    expect(r.dutyTtdbAmt).toBe(0);
    expect(r.dutyCbpgAmt).toBe(0);
    expect(r.envtaxVnd).toBe(0);
    expect(r.dutyVatAmt).toBe(0);
    expect(r.totalTax).toBe(50_000);

    const reread = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: declItem.id } });
    expect(Number(reread.dutyNkAmt)).toBe(50_000);
  });

  it('⚠⚠ tygia <= 0 -> ZERO SẠCH mọi cột thuế (kể cả số cũ từ lần tính trước) và trả error "no_rate"', async () => {
    const file = await seedTransportFile();
    const quote = await seedQuote('ZZ-RECALC-NORATE-NOMORE');
    const qItem = await seedItem(quote.id, { amountVnd: 800_000, shipToVnVnd: 200_000, otherCost: 0 });
    const declItem = await prisma.transportFileItem.create({
      data: {
        fileId: file.id,
        quoteItemId: qItem.id,
        declaredValue: 40,
        freightAlloc: 7_777_777,
        importDutyRate: 5,
        consumptionTaxRate: 10,
        antidumpingPct: 3,
        envtaxAmount: 1_000,
        vatRate: 8,
        quantity: 6,
        declaredNameVi: 'Tên khai giữ nguyên',
      },
    });

    // Lần đầu: tính thật, cột thuế phải khác 0.
    const first = await svc.recalcItemTax(declItem.id, 25_000);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.dutyNkAmt).toBeGreaterThan(0);

    // Lần hai: KHÔNG có tỷ giá -> phải zero sạch, không phải "giữ số cũ".
    const second = await svc.recalcItemTax(declItem.id, 0);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe('no_rate');

    const reread = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: declItem.id } });
    expect(Number(reread.taxBase)).toBe(0);
    expect(Number(reread.dutyNkAmt)).toBe(0);
    expect(Number(reread.dutyTtdbAmt)).toBe(0);
    expect(Number(reread.dutyCbpgAmt)).toBe(0);
    expect(Number(reread.envtaxVnd)).toBe(0);
    expect(Number(reread.dutyVatAmt)).toBe(0);
    expect(Number(reread.totalTax)).toBe(0);
    expect(Number(reread.taxRateUsed)).toBe(0);

    // ⚠⚠ D10 (review cuối #08) — "zero SẠCH 8 cột" chưa đủ: phải chứng minh
    // KHÔNG ĐỤNG GÌ THÊM. Nhánh no_rate ghi ĐÚNG 8 cột mà prod `UPDATE`
    // (cls.container.php:736) ghi; nếu ai đó thêm `declaredValue: 0` (hay
    // bất cứ cột đầu vào nào) vào cùng object `data`, bộ test cũ vẫn XANH
    // vì nó chỉ hỏi "8 cột kia đã về 0 chưa". Khẳng định NGƯỢC LẠI ở đây —
    // mọi cột ĐẦU VÀO của dòng khai phải y nguyên sau khi zero.
    expect(Number(reread.declaredValue)).toBe(40);
    expect(Number(reread.freightAlloc)).toBe(7_777_777);
    expect(Number(reread.importDutyRate)).toBe(5);
    expect(Number(reread.consumptionTaxRate)).toBe(10);
    expect(Number(reread.antidumpingPct)).toBe(3);
    expect(Number(reread.envtaxAmount)).toBe(1_000);
    expect(Number(reread.vatRate)).toBe(8);
    expect(Number(reread.quantity)).toBe(6);
    expect(reread.quoteItemId).toBe(qItem.id);
    expect(reread.fileId).toBe(file.id);
    expect(reread.declaredNameVi).toBe('Tên khai giữ nguyên');

    // tygia âm cũng phải zero sạch giống hệt tygia=0.
    const third = await svc.recalcItemTax(declItem.id, -5);
    expect(third.ok).toBe(false);
    if (third.ok) return;
    expect(third.error).toBe('no_rate');
  });

  // ⚠⚠⚠ tax_base CỐ Ý là TRỊ GIÁ KHAI (declaredValue × tygia), KHÔNG phải
  // nen.hang — dựng dòng CÓ CƯỚC (gắn báo giá có ship_to_vn_vnd > 0) để
  // taxBase !== nen.hang thật sự khác nhau, không phải trùng hợp cuoc=0.
  it('⚠⚠⚠ tax_base là TRỊ GIÁ KHAI (declaredValue×tygia), không phải nền hàng đã tách cước', async () => {
    const file = await seedTransportFile();
    const quote = await seedQuote('ZZ-RECALC-TAXBASE');
    // a=800.000, s=200.000, c=0 -> tt=1.000.000 -> nen.hang=800.000 khi tong=1.000.000
    const qItem = await seedItem(quote.id, { amountVnd: 800_000, shipToVnVnd: 200_000, otherCost: 0 });
    const declItem = await prisma.transportFileItem.create({
      data: {
        fileId: file.id,
        quoteItemId: qItem.id,
        declaredValue: 40,
        importDutyRate: 0,
        vatRate: 0,
        quantity: 1,
      },
    });

    const r = await svc.recalcItemTax(declItem.id, 25_000); // tgk = 40*25.000 = 1.000.000
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const nen = await declSource.tachNenThue(declItem.id, 40 * 25_000);
    expect(nen.hang).toBe(800_000); // nền hàng đã tách cước — KHÁC taxBase
    expect(r.taxBase).toBe(1_000_000); // = declaredValue × tygia
    expect(r.taxBase).not.toBe(nen.hang);
  });

  // ⚠ freight_alloc (phí CIF phân bổ) KHÔNG bao giờ vào nền thuế — đổi nó
  // không được ảnh hưởng một đồng thuế nào.
  it('⚠ freight_alloc khác 0 -> KHÔNG ảnh hưởng một đồng thuế nào', async () => {
    const file = await seedTransportFile();
    const noFreight = await prisma.transportFileItem.create({
      data: {
        fileId: file.id,
        declaredValue: 40,
        freightAlloc: 0,
        importDutyRate: 5,
        vatRate: 8,
        quantity: 3,
      },
    });
    const withFreight = await prisma.transportFileItem.create({
      data: {
        fileId: file.id,
        declaredValue: 40,
        freightAlloc: 5_000_000, // khác 0, KHÔNG được đổi số thuế
        importDutyRate: 5,
        vatRate: 8,
        quantity: 3,
      },
    });

    const r1 = await svc.recalcItemTax(noFreight.id, 25_000);
    const r2 = await svc.recalcItemTax(withFreight.id, 25_000);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;

    expect(r2.taxBase).toBe(r1.taxBase);
    expect(r2.dutyNkAmt).toBe(r1.dutyNkAmt);
    expect(r2.dutyTtdbAmt).toBe(r1.dutyTtdbAmt);
    expect(r2.dutyCbpgAmt).toBe(r1.dutyCbpgAmt);
    expect(r2.envtaxVnd).toBe(r1.envtaxVnd);
    expect(r2.dutyVatAmt).toBe(r1.dutyVatAmt);
    expect(r2.totalTax).toBe(r1.totalTax);
  });

  // Ca đầu-cuối: dòng khai gắn báo giá THẬT (golden A của #05, id 66040 —
  // xem test/quote/calc-item-new.spec.ts): amountVnd=1.009.800,
  // shipToVnVnd=10.000, otherCost=0 -> tt=1.019.800. Chọn tygia=1 (tuỳ ý,
  // chỉ là hệ số quy đổi) và declaredValue=1.019.800 để tgk=tt CHÍNH XÁC
  // (nen.hang=1.009.800, nen.cuoc=10.000, nen.cpk=0 không lệch phần trăm
  // nào) — giữ phép tính tay đơn giản, không lẫn sai số làm tròn USD.
  // Thuế suất dòng khai TỰ CHỌN cho ca này (import_duty_rate=5%,
  // vat_rate=8%) — không phải thuế suất của báo giá gốc (#05 dùng phân số,
  // đơn vị khác).
  //
  // Tính tay (calc5 nguyên văn — xem src/quote/import-tax.service.ts):
  //   nk    = 1.009.800 × 5%              = 50.490
  //   ttdb  = (1.009.800+50.490) × 0%     = 0
  //   cbpg  = 1.009.800 × 0%               = 0
  //   bvmt  = 10 × 0                       = 0
  //   nenVat= 1.009.800+10.000+50.490+0+0+0 = 1.070.290
  //   vat   = 1.070.290 × 8%               = 85.623,2
  //   tong  = 50.490+0+0+0+85.623,2        = 136.113,2
  it('ca đầu-cuối: dòng khai gắn golden A của #05 -> NK/TTĐB/CBPG/BVMT/VAT khớp tay', async () => {
    const file = await seedTransportFile();
    const quote = await seedQuote('ZZ-RECALC-GOLDENA');
    const qItem = await seedItem(quote.id, {
      amountVnd: 1_009_800,
      shipToVnVnd: 10_000,
      otherCost: 0,
    });
    const declItem = await prisma.transportFileItem.create({
      data: {
        fileId: file.id,
        quoteItemId: qItem.id,
        declaredValue: 1_019_800, // × tygia=1 -> tgk=1.019.800 = tt của báo giá
        importDutyRate: 5,
        consumptionTaxRate: 0,
        antidumpingPct: 0,
        envtaxAmount: 0,
        vatRate: 8,
        quantity: 10,
      },
    });

    const r = await svc.recalcItemTax(declItem.id, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.taxBase).toBe(1_019_800);
    expect(r.dutyNkAmt).toBe(50_490);
    expect(r.dutyTtdbAmt).toBe(0);
    expect(r.dutyCbpgAmt).toBe(0);
    expect(r.envtaxVnd).toBe(0);
    expect(r.dutyVatAmt).toBeCloseTo(85_623.2, 6);
    expect(r.totalTax).toBeCloseTo(136_113.2, 6);

    const reread = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: declItem.id } });
    expect(Number(reread.dutyNkAmt)).toBe(50_490);
    expect(Number(reread.dutyVatAmt)).toBeCloseTo(85_623.2, 6);
    expect(Number(reread.totalTax)).toBeCloseTo(136_113.2, 6);
  });

  // ═══ #08 fix-round-1 (23/09/2026) — `tygia` giờ là THAM SỐ TUỲ CHỌN.
  // Không truyền -> tự tra qua DeclSourceService.usdRateForFile(fileId)
  // (thang ưu tiên cont -> treasury_closed -> treasury_today -> none).
  // Có truyền (kể cả 0/âm) -> LUÔN LÀ OVERRIDE, ghi đè hoàn toàn thang tra —
  // giữ nguyên mọi ca test PHÍA TRÊN (chúng đều truyền tygia tường minh) ý
  // nghĩa như cũ, không cần sửa lại. ═══════════════════════════════════════
  describe('#08 fix-round-1 — tygia tuỳ chọn, tự tra qua usdRateForFile khi không truyền', () => {
    it('KHÔNG truyền tygia -> tự tra ra usd_rate_closed của cont (hạng 1 của thang)', async () => {
      const file = await seedTransportFile({ usdRateClosed: 25_000 });
      const declItem = await prisma.transportFileItem.create({
        data: {
          fileId: file.id,
          declaredValue: 40, // USD
          importDutyRate: 5,
          vatRate: 0,
          quantity: 1,
        },
      });

      const r = await svc.recalcItemTax(declItem.id); // KHÔNG truyền tygia
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.taxRateUsed).toBe(25_000);
      expect(r.taxBase).toBe(1_000_000); // 40 × 25.000
      expect(r.dutyNkAmt).toBe(50_000); // 5% của 1.000.000
    });

    it('KHÔNG truyền tygia, cont không có usd_rate_closed nhưng có closed_at + treasury khớp ngày -> tự tra ra rung treasury_closed', async () => {
      const file = await seedTransportFile({ closedAt: new Date('2026-09-10') });
      await seedExchangeRate({ currency: 'USD', rateVnd: 24_500, rateDate: new Date('2026-09-01') });
      const declItem = await prisma.transportFileItem.create({
        data: {
          fileId: file.id,
          declaredValue: 40,
          importDutyRate: 5,
          vatRate: 0,
          quantity: 1,
        },
      });

      const r = await svc.recalcItemTax(declItem.id);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.taxRateUsed).toBe(24_500);
      expect(r.taxBase).toBe(40 * 24_500);
    });

    it('⚠⚠ TRUYỀN tygia LÀ OVERRIDE — bỏ qua thang tra dù cont có usd_rate_closed hợp lệ', async () => {
      const file = await seedTransportFile({ usdRateClosed: 25_000 });
      const declItem = await prisma.transportFileItem.create({
        data: {
          fileId: file.id,
          declaredValue: 40,
          importDutyRate: 5,
          vatRate: 0,
          quantity: 1,
        },
      });

      // Override rõ ràng khác hẳn usd_rate_closed=25.000 của cont.
      const r = await svc.recalcItemTax(declItem.id, 10_000);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.taxRateUsed).toBe(10_000); // KHÔNG phải 25.000
      expect(r.taxBase).toBe(40 * 10_000);
    });

    it('KHÔNG truyền tygia, thang tra hạ cánh "none" (bảng tỷ giá rỗng, không usd_rate_closed) -> no_rate, zero sạch', async () => {
      const file = await seedTransportFile(); // không usd_rate_closed, không closed_at
      const declItem = await prisma.transportFileItem.create({
        data: {
          fileId: file.id,
          declaredValue: 40,
          importDutyRate: 5,
          vatRate: 8,
          quantity: 1,
        },
      });

      const r = await svc.recalcItemTax(declItem.id); // không truyền -> resolver -> rate=0
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toBe('no_rate');

      const reread = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: declItem.id } });
      expect(Number(reread.taxBase)).toBe(0);
      expect(Number(reread.dutyNkAmt)).toBe(0);
      expect(Number(reread.totalTax)).toBe(0);
      expect(Number(reread.taxRateUsed)).toBe(0);
    });
  });

  // ⚠⚠⚠ IMPORTANT 3 (fix-round-2, 23/09/2026) — chứng minh round2() thật
  // sự DÙNG phpRound(), không chỉ import cho có. Dựng nền hàng=1005,
  // vatRate=0.1% (mọi thuế khác =0) -> t5.vat = 1005×0.1/100 = 1.005 CHÍNH
  // XÁC — đúng giá trị biên PHP round() và Math.round(v*100)/100 cho KẾT
  // QUẢ KHÁC NHAU (1.01 vs 1.00, xem test/money.spec.ts). Nếu round2() bị
  // đổi ngược lại Math.round(v*100)/100, ca này FAIL.
  it('⚠⚠⚠ round2() dùng phpRound() thật — nền=1005, vatRate=0.1% cho vat=1.005 CHÍNH XÁC, PHẢI ra 1.01 (không phải 1.00 của Math.round naive)', async () => {
    const file = await seedTransportFile();
    const declItem = await prisma.transportFileItem.create({
      data: {
        fileId: file.id,
        declaredValue: 1005, // × tygia=1 -> tgk=1005, không gắn báo giá -> nen.hang=1005
        importDutyRate: 0,
        consumptionTaxRate: 0,
        antidumpingPct: 0,
        envtaxAmount: 0,
        vatRate: 0.1, // 0.1% -> vat = 1005×0.1/100 = 1.005 chính xác
        quantity: 1,
      },
    });

    const r = await svc.recalcItemTax(declItem.id, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dutyVatAmt).toBe(1.01); // KHÔNG PHẢI 1.00
    expect(r.totalTax).toBe(1.01);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // D4 (review cuối #08, 23/09/2026) — BA THAM SỐ CỦA calc5 TRƯỚC ĐÂY KHÔNG
  // CÓ MỘT CA TEST NÀO CHỞ SỨC NẶNG
  //
  // `calc5(nen.hang, nen.cuoc, quantity, pctNk, pctTtdb, pctCbpg, mucBvmt,
  // pctVat)` — TOÀN BỘ ca test của nhánh này từng đặt
  // `consumptionTaxRate = 0`, `antidumpingPct = 0`, `envtaxAmount = 0`. Vì
  // `bvmt = sl × mucBvmt` luôn =0 nên tham số `quantity` cũng không chở sức
  // nặng nào. Hệ quả: thay CẢ BA bằng hằng `0` (và hoán vị chúng cho nhau,
  // và hoán vị `quantity` với bất kỳ cái nào) vẫn XANH toàn bộ bộ test.
  // Lệch KHÔNG BỊ PHÁT HIỆN đo được: **172.800đ trên MỘT dòng khai** với đầu
  // vào ở ca đầu tiên bên dưới.
  //
  // Các ca dưới đây đã được MUTATION-TEST thật (không phải suy luận) — xem
  // .superpowers/sdd/2026-09-23-08-haiquan-plan/final-fix-report.md, mục
  // "D4 — mutants đã chạy", nơi trích NGUYÊN VĂN expected/received của từng
  // lần chạy đỏ.
  // ═══════════════════════════════════════════════════════════════════════
  describe('D4 — pctTtdb / pctCbpg / mucBvmt / quantity phải CHỞ SỨC NẶNG', () => {
    // Đầu vào NGUYÊN VĂN của ví dụ "lệch không bị phát hiện" trong review
    // cuối. tygia=25.000, declaredValue=40 -> tgk=1.000.000; KHÔNG gắn báo
    // giá -> tachNenThue trả phía AN TOÀN (nen.hang = tgk, nen.cuoc = 0).
    //
    // Tính tay theo calc5 (src/quote/import-tax.service.ts):
    //   nk     = 1.000.000 × 0%                                   =       0
    //   ttdb   = (1.000.000 + 0) × 10%                            = 100.000
    //   cbpg   = 1.000.000 × 5%       (SONG SONG, không lồng ttdb) =  50.000
    //   bvmt   = 10 × 1.000           (tuyệt đối/đơn vị, không %)  =  10.000
    //   nenVat = 1.000.000 + 0 + 0 + 100.000 + 50.000 + 10.000     = 1.160.000
    //   vat    = 1.160.000 × 8%                                    =  92.800
    //   tong   = 0 + 100.000 + 50.000 + 10.000 + 92.800            = 252.800
    //
    // Nếu ba tham số bị thay bằng hằng 0: tong = 80.000 (chỉ còn VAT trên
    // nền trần) -> chênh ĐÚNG 172.800đ.
    it('⚠⚠⚠ ba tham số CÙNG khác 0 — TTĐB + CBPG + BVMT + VAT khớp tay (mutant "thay cả ba bằng 0" lệch 172.800đ/dòng)', async () => {
      const file = await seedTransportFile();
      const declItem = await prisma.transportFileItem.create({
        data: {
          fileId: file.id,
          declaredValue: 40, // USD
          importDutyRate: 0,
          consumptionTaxRate: 10, // 10% TTĐB
          antidumpingPct: 5, // 5% chống bán phá giá (PHẦN TRĂM, xem ca riêng bên dưới)
          envtaxAmount: 1_000, // 1.000đ/đơn vị BVMT (TUYỆT ĐỐI, không phải %)
          vatRate: 8,
          quantity: 10,
        },
      });

      const r = await svc.recalcItemTax(declItem.id, 25_000);
      expect(r.ok).toBe(true);
      if (!r.ok) return;

      expect(r.taxBase).toBe(1_000_000);
      expect(r.dutyNkAmt).toBe(0);
      expect(r.dutyTtdbAmt).toBe(100_000);
      expect(r.dutyCbpgAmt).toBe(50_000);
      expect(r.envtaxVnd).toBe(10_000);
      expect(r.dutyVatAmt).toBe(92_800);
      expect(r.totalTax).toBe(252_800); // mutant "ba tham số = 0" cho 80.000

      // Ghi xuống CSDL, không chỉ trả về.
      const reread = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: declItem.id } });
      expect(Number(reread.dutyTtdbAmt)).toBe(100_000);
      expect(Number(reread.dutyCbpgAmt)).toBe(50_000);
      expect(Number(reread.envtaxVnd)).toBe(10_000);
      expect(Number(reread.totalTax)).toBe(252_800);
    });

    // TTĐB CỘNG DỒN TRÊN THUẾ NK — `ttdb = (nenHang + nk) × pctTtdb`, KHÔNG
    // phải `nenHang × pctTtdb`. Đặt pctNk=5 và pctTtdb=10 trên nền 1.000.000:
    //   nk   = 50.000
    //   ttdb = (1.000.000 + 50.000) × 10% = 105.000   <- CÓ cộng dồn
    //   (mutant bỏ cộng dồn cho 100.000 — lệch 5.000đ, ca này bắt)
    it('⚠⚠ TTĐB CỘNG DỒN trên thuế NK: (nền + NK) × 10% = 105.000, KHÔNG phải nền × 10% = 100.000', async () => {
      const file = await seedTransportFile();
      const declItem = await prisma.transportFileItem.create({
        data: {
          fileId: file.id,
          declaredValue: 40,
          importDutyRate: 5,
          consumptionTaxRate: 10,
          antidumpingPct: 0,
          envtaxAmount: 0,
          vatRate: 0,
          quantity: 1,
        },
      });

      const r = await svc.recalcItemTax(declItem.id, 25_000);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.dutyNkAmt).toBe(50_000);
      expect(r.dutyTtdbAmt).toBe(105_000); // KHÔNG phải 100.000
      expect(r.totalTax).toBe(155_000);
    });

    // CBPG SONG SONG, KHÔNG LỒNG TRONG TTĐB — `cbpg = nenHang × pctCbpg`,
    // tính trên nền GỐC chứ không trên (nền + nk + ttdb). Cùng đầu vào ca
    // trên + pctCbpg=5:
    //   cbpg ĐÚNG    = 1.000.000 × 5%                        = 50.000
    //   nếu bị LỒNG  = (1.000.000 + 50.000 + 105.000) × 5%   = 57.750
    it('⚠⚠ CBPG tính SONG SONG trên nền GỐC (50.000), KHÔNG lồng sau NK+TTĐB (57.750)', async () => {
      const file = await seedTransportFile();
      const declItem = await prisma.transportFileItem.create({
        data: {
          fileId: file.id,
          declaredValue: 40,
          importDutyRate: 5,
          consumptionTaxRate: 10,
          antidumpingPct: 5,
          envtaxAmount: 0,
          vatRate: 0,
          quantity: 1,
        },
      });

      const r = await svc.recalcItemTax(declItem.id, 25_000);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.dutyNkAmt).toBe(50_000);
      expect(r.dutyTtdbAmt).toBe(105_000);
      expect(r.dutyCbpgAmt).toBe(50_000); // KHÔNG phải 57.750 (lồng sau NK+TTĐB)
      expect(r.totalTax).toBe(205_000);
    });

    // ⚠⚠⚠ QUY ƯỚC `antidumping_pct`: cột `decimal(6,4)` mang HÌNH DẠNG phân
    // số (giống các cột *Pct của #05, nơi 0.05 = 5%) nhưng được TIÊU THỤ như
    // PHẦN TRĂM — `recalcItemTax` truyền THẲNG vào `calc5`, hàm nhận phần
    // trăm. Đo prod 23/09/2026: 0.0000 ở 145/145 dòng ⇒ quy ước này CHƯA
    // TỪNG bị dữ liệu thật kiểm chứng theo HƯỚNG NÀO. Plan §"BẪY TIỀM ẨN"
    // dòng 36 đòi "phải có ca test ghi rõ quy ước" — ca đó chưa bao giờ được
    // viết (ca duy nhất có antidumpingPct khác 0 là một round-trip CSDL
    // thuần, nó XANH dưới CẢ HAI quy ước).
    //
    // Ca này là CỔNG GÁC quy ước: `antidumpingPct = 5` PHẢI nghĩa là 5%
    //   -> cbpg = nền × 0,05 = 50.000
    //   KHÔNG phải nền × 0,0005 = 500  (đọc kiểu (6,4) như phân số)
    //   KHÔNG phải nền × 5     = 5.000.000 (×100 nhầm chiều)
    // Sai một trong hai hướng lệch đúng 100 lần.
    it('⚠⚠⚠ CỔNG GÁC QUY ƯỚC: antidumpingPct=5 nghĩa là 5% -> cbpg=50.000 (KHÔNG phải 500 kiểu phân số, KHÔNG phải 5.000.000 kiểu ×100)', async () => {
      const file = await seedTransportFile();
      const declItem = await prisma.transportFileItem.create({
        data: {
          fileId: file.id,
          declaredValue: 40,
          importDutyRate: 0,
          consumptionTaxRate: 0,
          antidumpingPct: 5, // lưu 5.0000 — NGHĨA LÀ 5%
          envtaxAmount: 0,
          vatRate: 0,
          quantity: 1,
        },
      });

      // Cột thật trong CSDL đúng là 5.0000 (hình dạng phân số), để ca này
      // chứng minh cùng lúc hai việc: giá trị lưu là 5, và nó được HIỂU là 5%.
      const stored = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: declItem.id } });
      expect(stored.antidumpingPct?.toString()).toBe('5');

      const r = await svc.recalcItemTax(declItem.id, 25_000);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.dutyCbpgAmt).toBe(50_000); // = 1.000.000 × 5%
      expect(r.dutyCbpgAmt).not.toBe(500); // quy ước phân số (sai)
      expect(r.dutyCbpgAmt).not.toBe(5_000_000); // ×100 nhầm chiều (sai)
      expect(r.totalTax).toBe(50_000);
    });

    // BVMT = `quantity × mức` — SỐ TIỀN TUYỆT ĐỐI TRÊN MỘT ĐƠN VỊ, không
    // phải phần trăm. Hai dòng khai GIỐNG HỆT NHAU trừ `quantity` phải cho
    // BVMT khác nhau ĐÚNG TỶ LỆ số lượng — đó là điều mà mọi ca test cũ (đều
    // có envtaxAmount=0) không thể thấy.
    it('⚠⚠ BVMT = quantity × mức (tuyệt đối/đơn vị, KHÔNG phải %) — đổi riêng quantity phải đổi riêng BVMT đúng tỷ lệ', async () => {
      const file = await seedTransportFile();
      const mk = (quantity: number) =>
        prisma.transportFileItem.create({
          data: {
            fileId: file.id,
            declaredValue: 40,
            importDutyRate: 0,
            consumptionTaxRate: 0,
            antidumpingPct: 0,
            envtaxAmount: 1_000, // 1.000đ mỗi đơn vị
            vatRate: 0,
            quantity,
          },
        });

      const it1 = await mk(1);
      const it10 = await mk(10);

      const r1 = await svc.recalcItemTax(it1.id, 25_000);
      const r10 = await svc.recalcItemTax(it10.id, 25_000);
      expect(r1.ok).toBe(true);
      expect(r10.ok).toBe(true);
      if (!r1.ok || !r10.ok) return;

      expect(r1.envtaxVnd).toBe(1_000); // 1 × 1.000
      expect(r10.envtaxVnd).toBe(10_000); // 10 × 1.000
      expect(r10.envtaxVnd).toBe(r1.envtaxVnd * 10);
      // Nền thuế giống hệt nhau -> mọi sắc thuế KHÁC phải bằng nhau; chỉ
      // BVMT (và tổng) được phép khác. Chốt điều này để mutant "quantity đi
      // nhầm vào một tham số khác" không lọt.
      expect(r10.taxBase).toBe(r1.taxBase);
      expect(r10.dutyNkAmt).toBe(r1.dutyNkAmt);
      expect(r10.dutyTtdbAmt).toBe(r1.dutyTtdbAmt);
      expect(r10.dutyCbpgAmt).toBe(r1.dutyCbpgAmt);
      expect(r10.totalTax).toBe(r1.totalTax + 9_000);
    });

    // ⚠ Ruling 5 của review cuối: `quantity` giữ `Decimal(15,2)` (prod là
    // int(11), đo 0/145 dòng không nguyên ⇒ ETL không mất gì, và thu hẹp về
    // Int mới là thay đổi dễ gây hồi quy hơn). Nhưng vì `quantity` CHÍNH LÀ
    // `sl` trong `bvmt = sl × mức`, một lượng KHÔNG NGUYÊN giờ tính được
    // thuế BVMT mà cột prod không thể chứa — ca này ghim hành vi đó thành
    // hợp đồng rõ ràng thay vì một vùng tối.
    it('⚠ quantity KHÔNG NGUYÊN (Decimal(15,2)) đi thẳng vào BVMT: 2,5 × 1.000 = 2.500 (prod intval() sẽ cho 2.000 — khác biệt CÓ CHỦ Ý, đã ghi ở migration doc)', async () => {
      const file = await seedTransportFile();
      const declItem = await prisma.transportFileItem.create({
        data: {
          fileId: file.id,
          declaredValue: 40,
          importDutyRate: 0,
          consumptionTaxRate: 0,
          antidumpingPct: 0,
          envtaxAmount: 1_000,
          vatRate: 0,
          quantity: '2.50',
        },
      });

      const r = await svc.recalcItemTax(declItem.id, 25_000);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.envtaxVnd).toBe(2_500); // 2,5 × 1.000 — KHÔNG làm tròn xuống 2.000
      expect(r.totalTax).toBe(2_500);
    });

    // VAT tính trên TỔNG nền + CẢ BỐN sắc thuế đứng trước (nk, ttdb, cbpg,
    // bvmt) + cước. Đây là ca duy nhất trong nhánh có ĐỦ bốn sắc thuế khác 0
    // CÙNG LÚC với cước khác 0, nên nó là ca duy nhất phân biệt được
    // "nenVat = nền + cước + 4 sắc thuế" với mọi biến thể thiếu số hạng.
    //
    // Gắn báo giá a=800.000 / s=200.000 / c=0, tgk=1.000.000
    //   -> nen.hang = 800.000, nen.cuoc = 200.000
    //   nk     = 800.000 × 5%                                    =  40.000
    //   ttdb   = (800.000 + 40.000) × 10%                        =  84.000
    //   cbpg   = 800.000 × 5%                                    =  40.000
    //   bvmt   = 4 × 1.000                                       =   4.000
    //   nenVat = 800.000 + 200.000 + 40.000 + 84.000 + 40.000 + 4.000 = 1.168.000
    //   vat    = 1.168.000 × 8%                                  =  93.440
    //   tong   = 40.000 + 84.000 + 40.000 + 4.000 + 93.440       = 261.440
    //
    // Các biến thể SAI mà ca này loại trừ (tính sẵn để người sau đọc là
    // thấy, không phải chạy lại):
    //   nenVat thiếu ttdb  -> vat = 1.084.000 × 8% =  86.720
    //   nenVat thiếu cbpg  -> vat = 1.128.000 × 8% =  90.240
    //   nenVat thiếu bvmt  -> vat = 1.164.000 × 8% =  93.120
    //   nenVat thiếu nk    -> vat = 1.128.000 × 8% =  90.240
    //   nenVat thiếu cước  -> vat =   968.000 × 8% =  77.440
    it('⚠⚠⚠ VAT tính trên nền + CƯỚC + CẢ BỐN sắc thuế đứng trước (NK+TTĐB+CBPG+BVMT) — 93.440, thiếu bất kỳ số hạng nào cũng ra số khác', async () => {
      const file = await seedTransportFile();
      const quote = await seedQuote('ZZ-RECALC-VATBASE-4THUE');
      const qItem = await seedItem(quote.id, { amountVnd: 800_000, shipToVnVnd: 200_000, otherCost: 0 });
      const declItem = await prisma.transportFileItem.create({
        data: {
          fileId: file.id,
          quoteItemId: qItem.id,
          declaredValue: 40, // × 25.000 = 1.000.000 = tổng báo giá
          importDutyRate: 5,
          consumptionTaxRate: 10,
          antidumpingPct: 5,
          envtaxAmount: 1_000,
          vatRate: 8,
          quantity: 4,
        },
      });

      const r = await svc.recalcItemTax(declItem.id, 25_000);
      expect(r.ok).toBe(true);
      if (!r.ok) return;

      expect(r.taxBase).toBe(1_000_000); // trị giá khai, KHÔNG phải nền hàng
      expect(r.dutyNkAmt).toBe(40_000);
      expect(r.dutyTtdbAmt).toBe(84_000);
      expect(r.dutyCbpgAmt).toBe(40_000);
      expect(r.envtaxVnd).toBe(4_000);
      expect(r.dutyVatAmt).toBe(93_440);
      expect(r.totalTax).toBe(261_440);
    });

    // ⚠ Hoán vị thứ tự tham số — `calc5(nenHang, cuoc, sl, pctNk, pctTtdb,
    // pctCbpg, mucBvmt, pctVat)` có BA tham số phần trăm liền kề nhau và một
    // tham số `sl`. Khi cả ba =0 (trạng thái cũ) mọi hoán vị đều vô hại. Ca
    // này chọn bốn giá trị ĐÔI MỘT KHÁC NHAU và dùng các cột kết quả RIÊNG
    // BIỆT (dutyTtdbAmt/dutyCbpgAmt/envtaxVnd), nên mọi hoán vị hai-trong-bốn
    // đều làm ít nhất một assertion đỏ.
    it('⚠⚠ bốn giá trị ĐÔI MỘT KHÁC NHAU (ttdb=10 · cbpg=3 · bvmt=7 · quantity=2) — mọi hoán vị tham số đều bị bắt', async () => {
      const file = await seedTransportFile();
      const declItem = await prisma.transportFileItem.create({
        data: {
          fileId: file.id,
          declaredValue: 40, // tgk = 1.000.000
          importDutyRate: 0,
          consumptionTaxRate: 10, // -> ttdb = 100.000
          antidumpingPct: 3, // -> cbpg =  30.000
          envtaxAmount: 7, // -> bvmt =  2 × 7 = 14
          vatRate: 0,
          quantity: 2,
        },
      });

      const r = await svc.recalcItemTax(declItem.id, 25_000);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.dutyTtdbAmt).toBe(100_000);
      expect(r.dutyCbpgAmt).toBe(30_000);
      expect(r.envtaxVnd).toBe(14);
      expect(r.dutyNkAmt).toBe(0);
      expect(r.totalTax).toBe(130_014);
    });
  });
});
