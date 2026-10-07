import { prisma, resetDb, seedAccounts, seedMapping } from './helpers/db';
import { WalletService } from '../src/money/wallet.service';
import { HoldService } from '../src/money/hold.service';
import { GlMapService } from '../src/money/gl-map.service';
import { GlService } from '../src/money/gl.service';

const gl = new GlService(prisma as any);
const glmap = new GlMapService(prisma as any, gl);
const hold = new HoldService(prisma as any);
const w = new WalletService(prisma as any, hold, glmap);

beforeEach(async () => {
  await resetDb(); await seedAccounts();
  await seedMapping('wallet_nap', '111', '131', true);
  await seedMapping('wallet_tt', '131', '511', true);
});
afterAll(() => prisma.$disconnect());

test('deposit increases balance and writes detail', async () => {
  const r = await w.applyEntry('TBS1', 1_000_000, 0, 'nạp', 'kt');
  expect(r.ok).toBe(true);
  expect(r.balance).toBe(1_000_000n);
  expect(await w.getBalanceTrue('TBS1')).toBe(1_000_000n);
});
test('balance = SUM(detail); cache total updated', async () => {
  await w.applyEntry('TBS1', 1_000_000, 0, '', 'kt');
  await w.applyEntry('TBS1', -400_000, 1, '', 'kt', 55);
  expect(await w.getBalanceTrue('TBS1')).toBe(600_000n);
  const wal = await prisma.wallet.findUnique({ where: { cusId: 'TBS1' } });
  expect(wal!.total).toBe(600_000n);
});
test('blocks negative beyond tolerance', async () => {
  await w.applyEntry('TBS1', 100_000, 0, '', 'kt');
  const r = await w.applyEntry('TBS1', -110_000, 1, '', 'kt', 1);
  expect(r.ok).toBe(false);
  expect(await w.getBalanceTrue('TBS1')).toBe(100_000n); // không đổi
});
test('allows tiny negative within 5000 tolerance', async () => {
  await w.applyEntry('TBS1', 100_000, 0, '', 'kt');
  const r = await w.applyEntry('TBS1', -104_000, 1, '', 'kt', 1);
  expect(r.ok).toBe(true);
  expect(await w.getBalanceTrue('TBS1')).toBe(-4_000n);
});
test('boundary: -5000 tolerance edge succeeds, -5001 fails (guards < vs <= flip)', async () => {
  // Lands exactly at -5000n → within tolerance, must succeed.
  await w.applyEntry('TBS1', 100_000, 0, '', 'kt');
  const ok = await w.applyEntry('TBS1', -105_000, 1, '', 'kt', 1);
  expect(ok.ok).toBe(true);
  expect(ok.balance).toBe(-5_000n);
  expect(await w.getBalanceTrue('TBS1')).toBe(-5_000n);

  // Lands at -5001n, one past tolerance → must fail, balance unchanged.
  await w.applyEntry('TBS2', 100_000, 0, '', 'kt');
  const fail = await w.applyEntry('TBS2', -105_001, 1, '', 'kt', 1);
  expect(fail.ok).toBe(false);
  expect(await w.getBalanceTrue('TBS2')).toBe(100_000n); // không đổi
});
test('blocks spending into held amount', async () => {
  await w.applyEntry('TBS1', 1_000_000, 0, '', 'kt');
  await prisma.poReceipt.create({ data: { customerId: 'TBS1', amount: '800000', method: 'wallet', status: 'no' } });
  const r = await w.applyEntry('TBS1', -500_000, 1, '', 'kt', 1);
  expect(r.ok).toBe(false); // khả dụng chỉ 200k
  expect(r.hold).toBe(800_000n);
});
test('rejects zero and missing customer', async () => {
  expect((await w.applyEntry('TBS1', 0, 0)).ok).toBe(false);
  expect((await w.applyEntry('', 1000, 0)).ok).toBe(false);
});
test('posts GL after commit for real customer', async () => {
  await w.applyEntry('TBS1', 1_000_000, 0, '', 'kt');
  const e = await prisma.glEntry.findFirst({ where: { sourceType: 'wallet_detail' } });
  expect(e).not.toBeNull();
});
test('GL skipped for ZZ but wallet still written', async () => {
  const r = await w.applyEntry('ZZQA_1', 1_000_000, 0, '', 'kt');
  expect(r.ok).toBe(true);
  expect(await prisma.glEntry.count()).toBe(0);
});
