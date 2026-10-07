import { prisma, resetApproval, seedTemplate } from '../helpers/approval-db';
import { resetDb } from '../helpers/db';
import { BusinessSyncService } from '../../src/approval/business-sync.service';
import { WalletAllocHandler } from '../../src/approval/wallet-alloc.handler';
import { WalletService } from '../../src/money/wallet.service';
import { HoldService } from '../../src/money/hold.service';
import { GlMapService } from '../../src/money/gl-map.service';
import { GlService } from '../../src/money/gl.service';

beforeEach(async () => { await resetApproval(); await resetDb(); });
afterAll(() => prisma.$disconnect());

test('onApproved runs handler once (idempotent via synced flag)', async () => {
  const t = await seedTemplate('phan_bo_vi_kh', { objectType: 'demo_sync' });
  const req = await prisma.approvalRequest.create({ data: { templateId: t.id, objectType: 'demo_sync', objectId: 1, currentStepOrder: 1, status: 2, submittedBy: 'sale1', submittedAt: 1, formData: '{}' } });
  const svc = new BusinessSyncService(prisma as any);
  let calls = 0; svc.register({ objectType: 'demo_sync', sync: async () => { calls++; } });
  await svc.onApproved(req.id); await svc.onApproved(req.id);   // gọi 2 lần
  expect(calls).toBe(1);                                        // chỉ chạy 1 lần
  expect((await prisma.approvalRequest.findUnique({ where: { id: req.id } }))!.synced).toBe(true);
});

test('handler throws -> synced stays/reverts to false and error rethrows (retryable)', async () => {
  const t = await seedTemplate('phan_bo_vi_kh_err', { objectType: 'demo_sync_err' });
  const req = await prisma.approvalRequest.create({ data: { templateId: t.id, objectType: 'demo_sync_err', objectId: 1, currentStepOrder: 1, status: 2, submittedBy: 'sale1', submittedAt: 1, formData: '{}' } });
  const svc = new BusinessSyncService(prisma as any);
  let calls = 0;
  svc.register({ objectType: 'demo_sync_err', sync: async () => { calls++; throw new Error('boom'); } });

  await expect(svc.onApproved(req.id)).rejects.toThrow('boom');
  expect(calls).toBe(1);
  expect((await prisma.approvalRequest.findUnique({ where: { id: req.id } }))!.synced).toBe(false); // KHÔNG set synced -> retryable

  // Gọi lại (retry) phải chạy lại handler vì synced vẫn false
  await expect(svc.onApproved(req.id)).rejects.toThrow('boom');
  expect(calls).toBe(2);
  expect((await prisma.approvalRequest.findUnique({ where: { id: req.id } }))!.synced).toBe(false);
});

test('WalletAllocHandler posts to wallet exactly once across two onApproved calls (the money link)', async () => {
  const gl = new GlService(prisma as any);
  const glmap = new GlMapService(prisma as any, gl);
  const hold = new HoldService(prisma as any);
  const wallet = new WalletService(prisma as any, hold, glmap);
  await wallet.applyEntry('TBSALLOC1', 500_000, 0, 'nạp trước', 'kt'); // đủ số dư để phân bổ

  const t = await seedTemplate('phan_bo_vi_kh_real');
  const req = await prisma.approvalRequest.create({
    data: { templateId: t.id, objectType: 'wallet_alloc', objectId: 7, currentStepOrder: 1, status: 2, submittedBy: 'sale1', submittedAt: 1, formData: JSON.stringify({ cus: 'TBSALLOC1', so_tien: 100_000 }) },
  });

  const svc = new BusinessSyncService(prisma as any);
  svc.register(new WalletAllocHandler(wallet, prisma as any));

  await svc.onApproved(req.id);
  await svc.onApproved(req.id); // gọi lại KHÔNG được trừ lần 2

  expect(await wallet.getBalanceTrue('TBSALLOC1')).toBe(400_000n); // 500_000 - 100_000, chỉ trừ 1 lần
  expect((await prisma.approvalRequest.findUnique({ where: { id: req.id } }))!.synced).toBe(true);
});

test('WalletAllocHandler throws (fail-visible) when so_tien=0 — no silent no-op, no wallet entry, synced stays false', async () => {
  const gl = new GlService(prisma as any);
  const glmap = new GlMapService(prisma as any, gl);
  const hold = new HoldService(prisma as any);
  const wallet = new WalletService(prisma as any, hold, glmap);
  await wallet.applyEntry('TBSALLOC2', 500_000, 0, 'nạp trước', 'kt');

  const t = await seedTemplate('phan_bo_vi_kh_zero');
  const req = await prisma.approvalRequest.create({
    data: { templateId: t.id, objectType: 'wallet_alloc', objectId: 8, currentStepOrder: 1, status: 2, submittedBy: 'sale1', submittedAt: 1, formData: JSON.stringify({ cus: 'TBSALLOC2', so_tien: 0 }) },
  });

  const svc = new BusinessSyncService(prisma as any);
  svc.register(new WalletAllocHandler(wallet, prisma as any));

  await expect(svc.onApproved(req.id)).rejects.toThrow(); // fail-visible, KHÔNG trả về im lặng

  expect(await wallet.getBalanceTrue('TBSALLOC2')).toBe(500_000n); // KHÔNG có bút toán nào được ghi
  expect((await prisma.approvalRequest.findUnique({ where: { id: req.id } }))!.synced).toBe(false); // retryable
});

test('WalletAllocHandler throws (fail-visible) when cus is missing — no wallet entry written', async () => {
  const gl = new GlService(prisma as any);
  const glmap = new GlMapService(prisma as any, gl);
  const hold = new HoldService(prisma as any);
  const wallet = new WalletService(prisma as any, hold, glmap);

  const t = await seedTemplate('phan_bo_vi_kh_nocus');
  const req = await prisma.approvalRequest.create({
    data: { templateId: t.id, objectType: 'wallet_alloc', objectId: 9, currentStepOrder: 1, status: 2, submittedBy: 'sale1', submittedAt: 1, formData: JSON.stringify({ so_tien: 100_000 }) },
  });

  const svc = new BusinessSyncService(prisma as any);
  svc.register(new WalletAllocHandler(wallet, prisma as any));

  await expect(svc.onApproved(req.id)).rejects.toThrow();
  expect((await prisma.approvalRequest.findUnique({ where: { id: req.id } }))!.synced).toBe(false);
});
