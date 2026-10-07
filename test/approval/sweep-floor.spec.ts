// Review cuối nhánh fix/approval-money-order, I-1 — lượt quét KHÔNG có sàn cutover.
//
// resumeUnfinished() chạy lại hiệu ứng tiền cho MỌI phiếu APPROVED+synced=false, bất kể cũ tới đâu;
// bảo vệ duy nhất là một câu trong tài liệu migration, trong khi cột `synced` mặc định false. Prod để
// lại phiếu rút APPROVED mà KHÔNG trừ ví khi trừ thất bại ⇒ nạp sang với synced=false là bị lượt quét
// đầu tiên trừ ví, vài tuần sau, không ai duyệt lại. Sàn `APPROVAL_SWEEP_CUTOVER_AT` (giây unix) nay
// là BẮT BUỘC: thiếu/sai ⇒ lượt quét không làm gì và nói rõ vì sao.
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { ApprovalModule } from '../../src/approval/approval.module';
import { MoneyModule } from '../../src/money/money.module';
import { ApprovalService, SweepResult } from '../../src/approval/approval.service';
import { WalletService } from '../../src/money/wallet.service';
import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { resetDb } from '../helpers/db';

const ENV = 'APPROVAL_SWEEP_CUTOVER_AT';
const RUT = 'TBS_ZZAPPR_rut_tien_vi_kh';
const PRE = 'TBS_ZZAPPR_PRE';   // phiếu kết thúc TRƯỚC sàn (vd nạp từ prod)
const POST = 'TBS_ZZAPPR_POST'; // phiếu kết thúc SAU sàn (hệ mới)
const T = 1_900_000_000;        // sàn thử — cố định để khỏi phụ thuộc đồng hồ

let mod: TestingModule;
let approvalSvc: ApprovalService;
let wallet: WalletService;
const saved = process.env[ENV];

async function fresh() {
  await resetApproval();
  await resetDb();
  await prisma.user.create({ data: { username: 'zzappr_kt', password: 'x', gid: 46 } }); // gid 46 = KẾ TOÁN LOGISTICS (prod)
  const t = await seedTemplate(RUT, { objectType: 'wallet_withdraw' });
  await seedApprover((await seedStep(t.id, { order: 1 })).id, 'group', 46);
  for (const c of [PRE, POST, 'TBS_ZZAPPR_POST2']) await wallet.applyEntry(c, 1_000_000, 0, 'nạp', 'zzappr');
  return t.id;
}
/** Phiếu rút APPROVED + synced=false, CHƯA trừ ví. */
async function approvedUnsynced(tplId: number, cus: string, finishedAt: number | null) {
  return (await prisma.approvalRequest.create({ data: {
    templateId: tplId, objectType: 'wallet_withdraw', objectId: 0, currentStepOrder: 1, status: 2,
    submittedBy: 'zzappr_sale', submittedAt: 1, finishedAt,
    formData: JSON.stringify({ cus, so_tien: 300_000 }),
  } })).id;
}
/** Trạng thái giữa-sập: PENDING, bút toán (khoá mới) ĐÃ vào sổ. */
async function pendingDebited(tplId: number, cus: string, submittedAt: number) {
  const id = (await prisma.approvalRequest.create({ data: {
    templateId: tplId, objectType: 'wallet_withdraw', objectId: 0, currentStepOrder: 1, status: 1,
    submittedBy: 'zzappr_sale', submittedAt, pendingSince: submittedAt,
    formData: JSON.stringify({ cus, so_tien: 300_000 }),
  } })).id;
  const r = await wallet.applyEntry(cus, -300_000, -3, 'Rút tiền theo phiếu duyệt #' + id, 'zzappr_sale', 0,
    { refKey: 'approval:' + id + ':wallet_withdraw', holdExcludeRequest: id });
  if (!r.ok) throw new Error('fixture: trừ ví thất bại — ' + r.msg); // fixture hỏng phải nổ, không lặng lẽ
  return id;
}
const withdrawals = (cus: string) => prisma.walletEntry.count({ where: { cusId: cus, type: -3 } });
const status = async (id: number) => (await prisma.approvalRequest.findUniqueOrThrow({ where: { id } })).status;

beforeAll(async () => {
  mod = await Test.createTestingModule({ imports: [PrismaModule, ApprovalModule, MoneyModule] }).compile();
  await mod.init();
  approvalSvc = mod.get(ApprovalService);
  wallet = mod.get(WalletService);
});
afterAll(async () => {
  if (saved === undefined) delete process.env[ENV]; else process.env[ENV] = saved;
  await resetApproval(); await resetDb();
  await mod.close();
  await prisma.$disconnect();
});

describe('sàn đặt: APPROVED+unsynced TRƯỚC sàn bị bỏ qua, SAU sàn được hoàn tất', () => {
  let r: SweepResult;
  let pre: number, preNull: number, post: number;
  beforeAll(async () => {
    const tpl = await fresh();
    process.env[ENV] = String(T);
    pre = await approvedUnsynced(tpl, PRE, T - 1);
    preNull = await approvedUnsynced(tpl, PRE, null);
    post = await approvedUnsynced(tpl, POST, T);
    r = await approvalSvc.resumeUnfinished();
  });
  it('phiếu trước sàn KHÔNG bị trừ ví', async () => {
    expect(await withdrawals(PRE)).toBe(0);
  });
  it('phiếu trước sàn (kể cả finishedAt NULL) được báo là TỪ CHỐI', () => {
    expect(r.refused.map((x) => x.id)).toEqual([pre, preNull]);
  });
  it('refusedCount = 2', () => {
    expect(r.refusedCount).toBe(2);
  });
  it('phiếu trước sàn vẫn synced=false (không bị đánh dấu xong)', async () => {
    expect((await prisma.approvalRequest.findUniqueOrThrow({ where: { id: pre } })).synced).toBe(false);
  });
  it('đối chứng: phiếu ĐÚNG mốc sàn được hoàn tất', () => {
    expect(r.synced).toEqual([post]);
  });
  it('đối chứng: phiếu sau sàn bị trừ đúng một lần', async () => {
    expect(await withdrawals(POST)).toBe(1);
  });
});

describe('sàn CHƯA đặt: lượt quét không làm gì và nói vì sao', () => {
  let r: SweepResult;
  beforeAll(async () => {
    const tpl = await fresh();
    delete process.env[ENV];
    await approvedUnsynced(tpl, POST, Math.floor(Date.now() / 1000));
    r = await approvalSvc.resumeUnfinished();
  });
  it('ran = false', () => {
    expect(r.ran).toBe(false);
  });
  it('lý do nêu tên biến cấu hình', () => {
    expect(r.reason).toMatch(/APPROVAL_SWEEP_CUTOVER_AT chưa đặt/);
  });
  it('không trừ ví', async () => {
    expect(await withdrawals(POST)).toBe(0);
  });
  it('đối chứng: đặt sàn rồi quét lại thì trừ đúng một lần', async () => {
    process.env[ENV] = String(Math.floor(Date.now() / 1000) - 3600);
    await approvalSvc.resumeUnfinished();
    expect(await withdrawals(POST)).toBe(1);
  });
});

describe.each([
  ['chuỗi rỗng', '', /chưa đặt/],
  ['không phải số', 'abc', /không phải số giây unix dương/],
  ['số 0', '0', /không phải số giây unix dương/],
  ['mili giây', '1900000000000', /MILI giây/],
])('sàn sai (%s) ⇒ không chạy', (_n, v, re) => {
  let r: SweepResult;
  beforeAll(async () => {
    const tpl = await fresh();
    process.env[ENV] = v;
    await approvedUnsynced(tpl, POST, Math.floor(Date.now() / 1000));
    r = await approvalSvc.resumeUnfinished();
  });
  it('ran = false với lý do đúng', () => {
    expect([r.ran, re.test(r.reason ?? '')]).toEqual([false, true]);
  });
  it('không trừ ví', async () => {
    expect(await withdrawals(POST)).toBe(0);
  });
});

describe('giữa-sập (PENDING, đã trừ): hệ mới chưa chạm sau sàn ⇒ bỏ qua; có lượt duyệt sau sàn ⇒ hoàn tất', () => {
  let r: SweepResult;
  let untouched: number, approvedAfter: number, submittedAfter: number;
  beforeAll(async () => {
    const tpl = await fresh();
    process.env[ENV] = String(T);
    untouched = await pendingDebited(tpl, PRE, T - 10);
    // lượt duyệt TRƯỚC sàn (vd nạp từ prod) — đủ để bước xong, nên nếu sàn bị bỏ qua thì phiếu SẼ bị hoàn tất
    await prisma.approvalAction.create({ data: {
      requestId: untouched, stepOrder: 1, stepName: 'S1', action: 'approve', actedBy: 'zzappr_kt', actedAt: T - 50,
    } });
    approvedAfter = await pendingDebited(tpl, POST, T - 10);
    await prisma.approvalAction.create({ data: {
      requestId: approvedAfter, stepOrder: 1, stepName: 'S1', action: 'approve', actedBy: 'zzappr_kt', actedAt: T + 5,
    } });
    submittedAfter = await pendingDebited(tpl, 'TBS_ZZAPPR_POST2', T + 1);
    await prisma.approvalAction.create({ data: {
      requestId: submittedAfter, stepOrder: 1, stepName: 'S1', action: 'approve', actedBy: 'zzappr_kt', actedAt: T - 50,
    } });
    r = await approvalSvc.resumeUnfinished();
  });
  it('phiếu nộp trước sàn, chưa ai duyệt ở hệ mới: bị TỪ CHỐI', () => {
    expect(r.refused.map((x) => x.id)).toEqual([untouched]);
  });
  it('phiếu đó vẫn PENDING', async () => {
    expect(await status(untouched)).toBe(1);
  });
  it('đối chứng: có lượt duyệt sau sàn ⇒ hoàn tất; nộp sau sàn ⇒ hoàn tất', () => {
    expect(r.finalized).toEqual([approvedAfter, submittedAfter]);
  });
  it('đối chứng: không trừ thêm lần nào', async () => {
    expect(await withdrawals(POST)).toBe(1);
  });
});
