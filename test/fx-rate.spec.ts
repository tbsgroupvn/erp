// test/fx-rate.spec.ts
import { prisma, resetDb } from './helpers/db';
import { FxRateService } from '../src/money/fx-rate.service';
const svc = new FxRateService(prisma as any);
beforeEach(resetDb); afterAll(() => prisma.$disconnect());

test('set then current returns latest effective', async () => {
  expect(await svc.current('TT_1688')).toBeNull();
  await svc.set('TT_1688', 'MAC_DINH', '3650.00', 'ktt');
  expect(await svc.current('TT_1688')).toBe('3650.0000');
});
test('set closes old row (only one effective)', async () => {
  await svc.set('TT_1688', 'MAC_DINH', '3650', 'ktt');
  await svc.set('TT_1688', 'MAC_DINH', '3700', 'ktt');
  expect(await svc.current('TT_1688')).toBe('3700.0000');
  const open = await prisma.mhRate.count({ where: { loai: 'TT_1688', hieuLucDen: null } });
  expect(open).toBe(1);
});
test('rejects invalid rate', async () => {
  expect((await svc.set('TT_1688', 'MAC_DINH', '-1', 'x')).ok).toBe(false);
  expect((await svc.set('TT_1688', 'MAC_DINH', 'abc', 'x')).ok).toBe(false);
});
test('concurrent set() leaves exactly one open row (DB-enforced invariant)', async () => {
  await svc.set('TT_1688', 'MAC_DINH', '3650', 'ktt');
  const results = await Promise.all([
    svc.set('TT_1688', 'MAC_DINH', '3700', 'ktt'),
    svc.set('TT_1688', 'MAC_DINH', '3710', 'ktt'),
  ]);
  expect(results.some((r) => r.ok === true)).toBe(true);
  const open = await prisma.mhRate.count({
    where: { loai: 'TT_1688', hangKhach: 'MAC_DINH', hieuLucDen: null },
  });
  expect(open).toBe(1);
});
