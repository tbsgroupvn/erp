// test/quote/quote-fee.spec.ts — Task 8: QuoteFee — phí dịch vụ giữ 3 số thập phân + cờ included.
import { prisma } from '../helpers/db';
import { resetQuote, seedQuote } from '../helpers/quote-db';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
import { QuoteService } from '../../src/quote/quote.service';

const perm = new PermService(prisma as any);
const org = new OrgService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org);
const svc = new QuoteService(prisma as any, scope);

describe('QuoteService.addFee — 3 số thập phân + included', () => {
  beforeEach(async () => {
    await resetQuote();
  });
  afterAll(() => prisma.$disconnect());

  it('⚠ ca pin bẫy: unitPrice=1234.567 đọc lại PHẢI CÒN .567 (không bị nuốt về 0 lẻ)', async () => {
    const q = await seedQuote('BG-FEE-0001');
    const fee = await svc.addFee(q.id, {
      feeCode: 'CUOC_NOI_DIA',
      feeName: 'Cước nội địa TQ',
      qty: 1,
      unitPrice: 1234.567,
      vatPct: 0,
    });

    const reread = await prisma.quoteFee.findUniqueOrThrow({ where: { id: fee.id } });
    // So bằng .toString() — Prisma trả Decimal (decimal.js), ép qua Number()
    // có thể mất/lệch độ chính xác nổi. Xem test/quote/schema.spec.ts.
    expect(reread.unitPrice.toString()).toBe('1234.567');
    expect(reread.amountNovat.toString()).toBe('1234.567');
    expect(reread.amountTotal.toString()).toBe('1234.567'); // vatPct=0 -> total = novat
  });

  it('amountTotal (có VAT) vẫn giữ đúng 3 số lẻ, không tự làm tròn về nguyên/2 lẻ', async () => {
    const q = await seedQuote('BG-FEE-0002');
    const fee = await svc.addFee(q.id, {
      feeCode: 'PHI_CHUNG_TU',
      qty: 1,
      unitPrice: 1234.567,
      vatPct: 0.08,
    });
    const reread = await prisma.quoteFee.findUniqueOrThrow({ where: { id: fee.id } });
    // amountNovat = 1234.567; vatAmount = 1234.567*0.08 = 98.76536 -> lưu 3 lẻ = 98.765
    // amountTotal = 1234.567 + 98.76536 = 1333.33236 -> lưu 3 lẻ = 1333.332
    expect(reread.vatAmount.toString()).toBe('98.765');
    expect(reread.amountTotal.toString()).toBe('1333.332');
    // Vẫn còn số lẻ thứ 3 khác 0 — không bị bẹp về 2 số lẻ kiểu tiền VNĐ thường.
    expect(reread.amountTotal.toString().split('.')[1]).toHaveLength(3);
  });

  it('included quyết định có gộp vào giá bán hay không — khẳng định qua sellPriceTotal(), không chỉ qua cột', async () => {
    const q = await seedQuote('BG-FEE-0003');
    const included = await svc.addFee(q.id, {
      feeCode: 'PHI_UY_THAC',
      qty: 1,
      unitPrice: 100_000,
      vatPct: 0,
      included: true,
    });
    const excluded = await svc.addFee(q.id, {
      feeCode: 'PHI_VAN_CHUYEN_NOI_BO',
      qty: 1,
      unitPrice: 50_000,
      vatPct: 0,
      included: false,
    });

    // Cột lưu đúng cờ đã truyền — nhưng đây KHÔNG PHẢI khẳng định chính.
    const rowIncluded = await prisma.quoteFee.findUniqueOrThrow({ where: { id: included.id } });
    const rowExcluded = await prisma.quoteFee.findUniqueOrThrow({ where: { id: excluded.id } });
    expect(rowIncluded.included).toBe(1);
    expect(rowExcluded.included).toBe(0);

    // Khẳng định CHÍNH: hàm tổng hợp giá bán chỉ gộp phí included=true.
    const sell = await svc.sellPriceTotal(q.id);
    expect(sell.includedFeesTotal).toBe(100_000); // chỉ phí included
    expect(sell.total).toBe(100_000); // KHÔNG cộng 50_000 của phí excluded
    expect(sell.total).not.toBe(150_000);
  });

  it('included mặc định = true (gộp) khi không truyền', async () => {
    const q = await seedQuote('BG-FEE-0004');
    const fee = await svc.addFee(q.id, { qty: 1, unitPrice: 10_000 });
    const row = await prisma.quoteFee.findUniqueOrThrow({ where: { id: fee.id } });
    expect(row.included).toBe(1);
    const sell = await svc.sellPriceTotal(q.id);
    expect(sell.includedFeesTotal).toBe(10_000);
  });
});
