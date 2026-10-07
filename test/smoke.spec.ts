import { prisma, resetDb } from './helpers/db';

afterAll(async () => prisma.$disconnect());

test('db reachable + truncate works', async () => {
  await resetDb();
  const n = await prisma.wallet.count();
  expect(n).toBe(0);
});
