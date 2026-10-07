import { prisma, resetDb, seedAccounts } from './helpers/db';
import { GlService } from '../src/money/gl.service';
const gl = new GlService(prisma as any);
beforeEach(async () => { await resetDb(); await seedAccounts(); });
afterAll(() => prisma.$disconnect());

const entry = (sid: number) => ({
  entryDate: 1, sourceType: 'wallet_nap', sourceId: sid, createdBy: 't',
  lines: [
    { accountCode: '111', debit: 1000, credit: 0 },
    { accountCode: '131', debit: 0, credit: 1000 },
  ],
});

test('posts a balanced entry', async () => {
  const r = await gl.post(entry(1));
  expect(r.status).toBe('posted');
  const lines = await prisma.glLine.count();
  expect(lines).toBe(2);
});
test('rejects unbalanced entry', async () => {
  const r = await gl.post({ ...entry(2), lines: [
    { accountCode: '111', debit: 1000, credit: 0 },
    { accountCode: '131', debit: 0, credit: 900 },
  ]});
  expect(r.status).toBe('error');
});
test('idempotent by (sourceType, sourceId)', async () => {
  await gl.post(entry(3));
  const r2 = await gl.post(entry(3));
  expect(r2.status).toBe('exists');
  expect(await prisma.glEntry.count()).toBe(1);
});
test('reverse creates mirror entry', async () => {
  const r = await gl.post(entry(4));
  const rev = await gl.reverse(r.entryId!, 'admin', 'sai_tien');
  expect(rev.status).toBe('posted');
  const e = await prisma.glEntry.findUnique({ where: { id: rev.entryId } });
  expect(e!.reversalOf).toBe(r.entryId);
});

test('unique entryNo across different entries', async () => {
  const r1 = await gl.post(entry(5));
  const r2 = await gl.post(entry(6));
  expect(r1.status).toBe('posted');
  expect(r2.status).toBe('posted');
  const e1 = await prisma.glEntry.findUnique({ where: { id: r1.entryId } });
  const e2 = await prisma.glEntry.findUnique({ where: { id: r2.entryId } });
  expect(e1!.entryNo).not.toBe(e2!.entryNo);
});

test('reverse is idempotent — second reverse returns exists, only one reversal row exists', async () => {
  const r = await gl.post(entry(7));
  const rev1 = await gl.reverse(r.entryId!, 'admin', 'sai_tien');
  expect(rev1.status).toBe('posted');
  const rev2 = await gl.reverse(r.entryId!, 'admin', 'sai_tien');
  expect(rev2.status).not.toBe('error');
  expect(rev2.entryId).toBe(rev1.entryId);
  const reversalCount = await prisma.glEntry.count({ where: { reversalOf: r.entryId! } });
  expect(reversalCount).toBe(1);
});

test('reverse of an FX-tagged line carries currency/amountCcy/fxRate/cusId', async () => {
  const r = await gl.post({
    entryDate: 1, sourceType: 'wallet_nap', sourceId: 8, createdBy: 't',
    lines: [
      { accountCode: '111', debit: 1000, credit: 0, currency: 'CNY', amountCcy: 300, fxRate: 3.3333, cusId: 'ZZCUS1', orderId: 42, note: 'fx line' },
      { accountCode: '131', debit: 0, credit: 1000 },
    ],
  });
  expect(r.status).toBe('posted');
  const rev = await gl.reverse(r.entryId!, 'admin', 'sai_tien');
  expect(rev.status).toBe('posted');
  const mirrorLine = await prisma.glLine.findFirst({ where: { entryId: rev.entryId!, accountCode: '111' } });
  expect(mirrorLine!.currency).toBe('CNY');
  expect(Number(mirrorLine!.amountCcy)).toBeCloseTo(300, 2);
  expect(Number(mirrorLine!.fxRate)).toBeCloseTo(3.3333, 4);
  expect(mirrorLine!.cusId).toBe('ZZCUS1');
  expect(mirrorLine!.orderId).toBe(42);
  // debit/credit swapped
  expect(Number(mirrorLine!.debit)).toBe(0);
  expect(Number(mirrorLine!.credit)).toBe(1000);
});

test('fewer than 2 lines reports "cần ≥2 dòng", not a balance error', async () => {
  const r = await gl.post({
    entryDate: 1, sourceType: 'wallet_nap', sourceId: 9, createdBy: 't',
    lines: [{ accountCode: '111', debit: 1000, credit: 0 }],
  });
  expect(r.status).toBe('error');
  expect(r.reason).toMatch(/≥2 dòng/);
});

test('sourceId beyond int4 range (BIGINT wallet_detail id) posts and is found idempotently', async () => {
  const bigSourceId = 3_000_000_000n; // > int4 max (2,147,483,647)
  const posted = await gl.post({
    entryDate: 1, sourceType: 'wallet_nap', sourceId: bigSourceId, createdBy: 't',
    lines: [
      { accountCode: '111', debit: 1000, credit: 0 },
      { accountCode: '131', debit: 0, credit: 1000 },
    ],
  });
  expect(posted.status).toBe('posted');

  const found = await gl.findBySource('wallet_nap', bigSourceId);
  expect(found).not.toBeNull();
  expect(found!.id).toBe(posted.entryId);
  expect(found!.sourceId).toBe(bigSourceId);

  // idempotency still works at bigint scale
  const again = await gl.post({
    entryDate: 1, sourceType: 'wallet_nap', sourceId: bigSourceId, createdBy: 't',
    lines: [
      { accountCode: '111', debit: 1000, credit: 0 },
      { accountCode: '131', debit: 0, credit: 1000 },
    ],
  });
  expect(again.status).toBe('exists');
  expect(again.entryId).toBe(posted.entryId);
});
