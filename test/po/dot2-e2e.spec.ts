// test/po/dot2-e2e.spec.ts — #06 đợt 2, Task 4: `SuborderService` +
// `OrderGenService` nối qua `PoModule` THẬT (Test.createTestingModule ->
// app.init()), đi từ PO thật -> tách đơn con -> sinh đơn, khẳng định CỘT ĐÃ
// LƯU (không chỉ giá trị trả về của service) — cùng lối
// `test/po/e2e.spec.ts` (Task 7 #06 đợt 1) và `test/quote/e2e.spec.ts`.
//
// Review cuối (I-2): hàm lõi `createOrdersPerItem` KHÔNG còn lộ qua DI — điểm
// vào duy nhất là `OrderGenService.generateOrdersForPo` (giữ cổng của
// process_gen_orders.php). Pipeline dưới đây đi qua đúng điểm vào đó.
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PoModule } from '../../src/po/po.module';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { OrderGenService } from '../../src/po/order-gen.service';
import { prisma } from '../helpers/db';
import { resetPo, seedPo, seedPoItem } from '../helpers/po-db';
import { PoStatus } from '../../src/po/po.constants';
import { resetMasterdata } from '../helpers/masterdata-db';
import { resetQuote } from '../helpers/quote-db';

let app: INestApplication;
let orderGenSvc: OrderGenService;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [PrismaModule, PoModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  orderGenSvc = mod.get(OrderGenService);
});

beforeEach(async () => {
  await resetMasterdata();
  await resetQuote();
  await resetPo();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function runPipeline(poCode: string) {
  const po = await seedPo(poCode, { status: PoStatus.DA_DUYET });
  const g1 = await seedPoItem(po.id, {
    sortOrder: 1, amount: '100000', vatRate: '8.0000', quantity: '3.00', lineKind: 'goods',
  });
  const fee = await seedPoItem(po.id, {
    sortOrder: 2, amount: '999999', lineKind: 'fee',
  });
  const g2 = await seedPoItem(po.id, {
    sortOrder: 3, amount: '200000', vatRate: '10.0000', quantity: '1.00', lineKind: 'goods',
  });
  const result = await orderGenSvc.generateOrdersForPo(po.id);
  if (!result.ok) throw new Error('setup: ' + result.reason);
  const sub = await prisma.poSuborder.findFirstOrThrow({ where: { poId: po.id } });
  const o1 = await prisma.order.findFirstOrThrow({ where: { poItemId: g1.id, orderType: 1 } });
  const o2 = await prisma.order.findFirstOrThrow({ where: { poItemId: g2.id, orderType: 1 } });
  return { po, g1, fee, g2, result, sub, o1, o2 };
}

describe('#06 đợt 2 — PoModule e2e: PO đã duyệt -> generateOrdersForPo (tự tách phụ lục + sinh đơn, qua DI thật)', () => {
  it('PO có 3 dòng [goods, fee, goods] -> CỘT ĐÃ LƯU đúng, dòng fee bị bỏ qua XUYÊN SUỐT pipeline', async () => {
    const { po, g1, fee, g2, result, sub, o1, o2 } = await runPipeline('ZZPO2_E2E_0001');
    if (!result.ok) throw new Error('unreachable');

    // ── phụ lục tự tách bên trong generateOrdersForPo ──
    expect(sub.subCode).toBe('ZZPO2_E2E_0001-Đ01');
    // recalcTotals (Task 2) đếm CẢ dòng fee — SUM(amount)/COUNT(*) theo
    // suborder_id, KHÔNG lọc line_kind (khác createOrdersPerItem, Task 3,
    // lọc fee). Hai hàm khác mục đích, pin cả hai ở CÙNG một pipeline thật.
    expect(sub.totalItems).toBe(3);
    expect(Number(sub.subtotal)).toBe(100000 + 999999 + 200000);

    expect(result.orderIds.length).toBe(2); // dòng fee KHÔNG sinh đơn
    const feeOrder = await prisma.order.findFirst({ where: { poItemId: fee.id, orderType: 1 } });
    expect(feeOrder).toBeNull();

    // seq bỏ qua dòng fee xuyên suốt pipeline thật:
    expect(o1.codeOrder).toBe('ZZPO2_E2E_0001-Đ01-01');
    expect(o2.codeOrder).toBe('ZZPO2_E2E_0001-Đ01-02');

    // CỘT ĐÃ LƯU — khoá truy vết + cờ:
    expect(o1.orderType).toBe(1);
    expect(o1.isactive).toBe(2);
    expect(o1.poId).toBe(po.id);
    expect(o1.poSuborderId).toBe(sub.id);
    expect(o1.poItemId).toBe(g1.id);
    expect(o2.poItemId).toBe(g2.id);

    // CỘT ĐÃ LƯU — công thức tiền (dòng hàng, seq xen giữa dòng fee):
    // g1: amount=100.000, vat_rate=8 ⇒ vat=8.000, total=108.000, quan=3.
    expect(o1.vatAmount).toBe(8000n);
    expect(o1.priceVn).toBe(100000n);
    expect(o1.totalMoney).toBe(108000n);
    expect(Number(o1.quan)).toBe(3);
    // g2: amount=200.000, vat_rate=10 ⇒ vat=20.000, total=220.000, quan=1.
    expect(o2.vatAmount).toBe(20000n);
    expect(o2.priceVn).toBe(200000n);
    expect(o2.totalMoney).toBe(220000n);
    expect(Number(o2.quan)).toBe(1);

    // suborder.order_id = đơn ĐẦU TIÊN của lượt sinh này (Task 3).
    const subAfter = await prisma.poSuborder.findUniqueOrThrow({ where: { id: sub.id } });
    expect(subAfter.orderId).toBe(Number(result.orderIds[0]));
  });

  // Review cuối I-1: vatRate LƯU trên đơn — PHẦN TRĂM, không phải phân số.
  it('I-1: g1 vat_rate=8 ⇒ o1.vatRate = 8', async () => {
    const { o1 } = await runPipeline('ZZPO2_E2E_0002');
    expect(o1.vatRate.toString()).toBe('8');
  });

  it('I-1: g2 vat_rate=10 ⇒ o2.vatRate = 10', async () => {
    const { o2 } = await runPipeline('ZZPO2_E2E_0003');
    expect(o2.vatRate.toString()).toBe('10');
  });

  it('pipeline đặt orders_generated=1 trên PO', async () => {
    const { po } = await runPipeline('ZZPO2_E2E_0004');
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).ordersGenerated).toBe(1);
  });
});

// ═══ FIX 1 (task-4-brief.md), sau review cuối ═══
// Bản trước gọi hàm lõi hai lần qua DI để phân biệt "kiểm trùng tầng ứng dụng
// còn sống" với "chỉ index đang đỡ". Hàm lõi nay KHÔNG còn lộ qua DI; phép
// phân biệt đó nằm ở test/po/order-gen.spec.ts ca "gọi lại lần hai" (gọi thẳng
// hàm lõi) — mutation gỡ kiểm ứng dụng đã chạy lại trên ca đó (xem
// final-fix-report.md). Qua điểm vào có cổng, lượt thứ hai dừng ở cổng
// orders_generated và trả 'already' — đúng hành vi prod.
describe('#06 đợt 2 — gọi lại generateOrdersForPo qua DI thật', () => {
  it('lượt thứ hai ⇒ already với CÙNG id, không ném lỗi', async () => {
    const po = await seedPo('ZZPO2_E2E_FIX1', { status: PoStatus.DA_DUYET });
    await seedPoItem(po.id, { sortOrder: 1, amount: '50000', vatRate: '8.0000', lineKind: 'goods' });

    const first = await orderGenSvc.generateOrdersForPo(po.id);
    const second = await orderGenSvc.generateOrdersForPo(po.id);

    expect(second).toEqual({
      ok: true, already: true,
      orderIds: first.ok ? first.orderIds : ['first failed'],
      msg: 'PO này đã sinh đơn hàng rồi (1 đơn).',
    });
  });
});
