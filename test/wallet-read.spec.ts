import { prisma, resetDb, seedAccounts, seedMapping } from './helpers/db';
import { WalletService } from '../src/money/wallet.service';
import { HoldService } from '../src/money/hold.service';
import { GlMapService } from '../src/money/gl-map.service';
import { GlService } from '../src/money/gl.service';
const gl = new GlService(prisma as any);
const w = new WalletService(prisma as any, new HoldService(prisma as any), new GlMapService(prisma as any, gl));
beforeEach(async () => { await resetDb(); await seedAccounts(); await seedMapping('wallet_nap', '111', '131', true); });
afterAll(() => prisma.$disconnect());

test('available = true - hold', async () => {
  await w.applyEntry('TBS1', 1_000_000, 0, '', 'kt');
  await prisma.poReceipt.create({ data: { customerId: 'TBS1', amount: '300000', method: 'wallet', status: 'no' } });
  expect(await w.getBalanceAvailable('TBS1')).toBe(700_000n);
});
test('repairCache resets total to SUM(detail)', async () => {
  await w.applyEntry('TBS1', 1_000_000, 0, '', 'kt');
  await prisma.wallet.update({ where: { cusId: 'TBS1' }, data: { total: 999n } }); // làm lệch cache
  const fixed = await w.repairCache('TBS1');
  expect(fixed).toBe(1_000_000n);
  const wal = await prisma.wallet.findUnique({ where: { cusId: 'TBS1' } });
  expect(wal!.total).toBe(1_000_000n);
});
