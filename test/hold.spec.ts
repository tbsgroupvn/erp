import { prisma, resetDb } from './helpers/db';
import { HoldService } from '../src/money/hold.service';
beforeEach(resetDb); afterAll(() => prisma.$disconnect());

test('sums pending wallet PO receipts', async () => {
  await prisma.poReceipt.createMany({ data: [
    { customerId: 'TBS1', amount: '1000', method: 'wallet', status: 'no' },
    { customerId: 'TBS1', amount: '500', method: 'wallet', status: 'yes' }, // đã duyệt -> không giữ
    { customerId: 'TBS1', amount: '300', method: 'bank', status: 'no' },     // không phải ví
  ]});
  const svc = new HoldService(prisma as any);
  expect(await svc.holdAmount('TBS1')).toBe(1000n);
});
test('adds registered providers and excludes request', async () => {
  const svc = new HoldService(prisma as any);
  svc.register({ pendingHold: async (_c, ex) => (ex === 7 ? 0n : 2000n) });
  expect(await svc.holdAmount('TBS1')).toBe(2000n);
  expect(await svc.holdAmount('TBS1', 7)).toBe(0n);
});

test('excludeRequestId still counts NULL-alloc pending receipts (nullable-FK footgun)', async () => {
  await prisma.poReceipt.createMany({ data: [
    { customerId: 'TBS1', amount: '1000', method: 'wallet', status: 'no' }, // allocRequestId NULL -> vẫn phải tính
    { customerId: 'TBS1', amount: '9999', method: 'wallet', status: 'no', allocRequestId: 7 }, // bị loại
  ]});
  const svc = new HoldService(prisma as any);
  expect(await svc.holdAmount('TBS1', 7)).toBe(1000n);
});
