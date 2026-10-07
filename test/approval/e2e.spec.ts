import { PrismaModule } from '../../src/prisma/prisma.module';
import { Test } from '@nestjs/testing';
import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { resetDb, seedAccounts, seedMapping } from '../helpers/db';
import { ApprovalModule } from '../../src/approval/approval.module';
import { MoneyModule } from '../../src/money/money.module';
import { RequestService } from '../../src/approval/request.service';
import { ApprovalService } from '../../src/approval/approval.service';
import { BusinessSyncService } from '../../src/approval/business-sync.service';
import { WalletService } from '../../src/money/wallet.service';

// e2e: chuỗi SoD 4 vai (sale -> KT -> KTT -> business-sync -> ví), dựng qua ApprovalModule
// thật (Nest DI), không new tay từng service như các spec đơn vị khác. Đây là bài kiểm chứng
// cuối cùng rằng ApprovalModule đã wire đúng: MoneyModule import, WalletAllocHandler đăng ký
// vào BusinessSyncService qua onModuleInit.
beforeEach(async () => { await resetApproval(); await resetDb(); });
afterAll(() => prisma.$disconnect());

test('SoD chain sale->KT->KTT qua ApprovalModule thật -> business-sync trừ ví ĐÚNG 1 LẦN', async () => {
  const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, ApprovalModule, MoneyModule] }).compile();
  await moduleRef.init(); // bắt buộc để onModuleInit chạy -> BusinessSyncService.register(WalletAllocHandler)

  const reqSvc = moduleRef.get(RequestService);
  const approvalSvc = moduleRef.get(ApprovalService);
  const sync = moduleRef.get(BusinessSyncService);
  const wallet = moduleRef.get(WalletService);

  // --- seed nền: GL mapping wallet_po (approved) mà WalletAllocHandler cần khi ghi ví ---
  await seedAccounts();
  await seedMapping('wallet_po', '111', '131', true);

  // --- seed ví KH TBS1 = 1_000_000 qua applyEntry type 0 (nạp thường) ---
  const seedDeposit = await wallet.applyEntry('TBS1', 1_000_000, 0, 'nạp trước', 'kt');
  expect(seedDeposit.ok).toBe(true);
  expect(await wallet.getBalanceTrue('TBS1')).toBe(1_000_000n);

  // --- seed users + roles: sale1 (nộp), kt1 (KT), ktt1 (KTT) ---
  await prisma.user.create({ data: { username: 'sale1', password: 'x' } });
  // gid thật trên prod: 46 = KẾ TOÁN LOGISTICS, 27 = Giám đốc (approver_ref của 'group' là gid cũ)
  await prisma.user.create({ data: { username: 'kt1', password: 'x', gid: 46 } });
  await prisma.user.create({ data: { username: 'ktt1', password: 'x', gid: 27 } });

  // --- seed mẫu phan_bo_vi_kh, objectType wallet_alloc: step1 group=KT (skip self), step2 group=KTT ---
  const t = await seedTemplate('phan_bo_vi_kh', { objectType: 'wallet_alloc' });
  const s1 = await seedStep(t.id, { order: 1, selfApprovalAction: 'skip' });
  const s2 = await seedStep(t.id, { order: 2 });
  await seedApprover(s1.id, 'requester');       // người nộp cũng là ứng viên bước 1...
  await seedApprover(s1.id, 'group', 46); // ...cùng KT -> self_approval_action=skip sẽ loại sale1
  await seedApprover(s2.id, 'group', 27);

  // --- sale1 submit yêu cầu phân bổ ví 400_000 cho TBS1 ---
  const r = await reqSvc.submit('phan_bo_vi_kh', 'wallet_alloc', 1, 'WA-TBS1-01', 'sale1', { cus: 'TBS1', so_tien: 400_000 });
  expect(r.currentStepOrder).toBe(1);

  // sale1 tự duyệt phiếu của mình -> bị chặn (SoD)
  const selfTry = await approvalSvc.approve(r.requestId, 'sale1');
  expect(selfTry.ok).toBe(false);

  // kt1 duyệt bước 1 -> tiến sang bước 2, còn PENDING
  const ktApprove = await approvalSvc.approve(r.requestId, 'kt1');
  expect(ktApprove.ok).toBe(true);
  expect(ktApprove.status).toBe(1); // AStatus.PENDING

  // ktt1 duyệt bước 2 -> hết bước -> APPROVED -> business-sync tự chạy -> ví trừ 400_000
  const kttApprove = await approvalSvc.approve(r.requestId, 'ktt1');
  expect(kttApprove.ok).toBe(true);
  expect(kttApprove.status).toBe(2); // AStatus.APPROVED

  expect(await wallet.getBalanceTrue('TBS1')).toBe(600_000n); // 1_000_000 - 400_000

  // gọi lại business-sync thủ công (giả lập retry/duplicate dispatch) -> KHÔNG trừ ví lần 2
  await sync.onApproved(r.requestId);
  expect(await wallet.getBalanceTrue('TBS1')).toBe(600_000n);

  await moduleRef.close();
});
