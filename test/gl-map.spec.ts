import { prisma, resetDb, seedAccounts, seedMapping } from './helpers/db';
import { GlService } from '../src/money/gl.service';
import { GlMapService } from '../src/money/gl-map.service';
const gl = new GlService(prisma as any);
const map = new GlMapService(prisma as any, gl);
beforeEach(async () => { await resetDb(); await seedAccounts(); });
afterAll(() => prisma.$disconnect());

test('walletBizType maps codes', () => {
  expect(map.walletBizType(1)).toBe('wallet_tt');
  expect(map.walletBizType(99)).toBeNull();
});
test('skips when mapping not approved', async () => {
  await seedMapping('wallet_nap', '111', '131', false);
  const r = await map.postBiz('wallet_nap', 'wallet_detail', 1, 1000, {});
  expect(r.status).toBe('skipped');
});
test('skips ZZ test data', async () => {
  await seedMapping('wallet_nap', '111', '131', true);
  const r = await map.postBiz('wallet_nap', 'wallet_detail', 2, 1000, { cusId: 'ZZQA_1' });
  expect(r.status).toBe('skipped');
});
test('posts 2-line entry when approved', async () => {
  await seedMapping('wallet_nap', '111', '131', true);
  const r = await map.postBiz('wallet_nap', 'wallet_detail', 3, 1000, { cusId: 'TBS1' });
  expect(r.status).toBe('posted');
  const lines = await prisma.glLine.findMany({ where: { entryId: r.entryId! } });
  expect(lines.map((l) => l.accountCode).sort()).toEqual(['111', '131']);
});
test('balanceFx: gain -> 515 credit, loss -> 635 debit, balanced -> null', () => {
  expect(map.balanceFx(1000, 900)).toEqual({ accountCode: '635', debit: 100, credit: 0 });
  expect(map.balanceFx(1000, 1100)).toEqual({ accountCode: '515', debit: 0, credit: 100 });
  expect(map.balanceFx(1000, 1000)).toBeNull();
});
