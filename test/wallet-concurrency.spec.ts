import { prisma, resetDb, seedAccounts, seedMapping } from './helpers/db';
import { WalletService } from '../src/money/wallet.service';
import { HoldService } from '../src/money/hold.service';
import { GlMapService } from '../src/money/gl-map.service';
import { GlService } from '../src/money/gl.service';

const gl = new GlService(prisma as any);
const w = new WalletService(prisma as any, new HoldService(prisma as any), new GlMapService(prisma as any, gl));

beforeEach(async () => {
  await resetDb();
  await seedAccounts();
  await seedMapping('wallet_nap', '111', '131', true);
  await seedMapping('wallet_tt', '131', '511', true);
});
afterAll(() => prisma.$disconnect());

test('10 concurrent debits never drive balance below tolerance', async () => {
  await w.applyEntry('TBS1', 1_000_000, 0, '', 'kt'); // dư 1tr
  // 10 lần trừ 200k đồng thời — chỉ 5 lần được phép (1tr / 200k)
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) => w.applyEntry('TBS1', -200_000, 1, '', 'kt', i + 1)),
  );
  const ok = results.filter((r) => r.ok).length;
  expect(ok).toBe(5);
  const bal = await w.getBalanceTrue('TBS1');
  expect(bal).toBeGreaterThanOrEqual(-5000n);
  expect(bal).toBe(0n);
});
