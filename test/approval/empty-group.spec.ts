import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { TemplateService } from '../../src/approval/template.service';
import { BranchEvaluator } from '../../src/approval/branch-evaluator';
import { RequestService } from '../../src/approval/request.service';
import { ApproverResolver } from '../../src/approval/approver-resolver';
import { ApprovalService } from '../../src/approval/approval.service';
import { BusinessSyncService } from '../../src/approval/business-sync.service';

/*
 * I1 (review cuối) — mục NHÓM không có thành viên phải FAIL-CLOSED như prod.
 * Prod `resolveStepApprovers()` (libs/cls.approval.php HEAD) LUÔN phát `{type:'group', ref:N}` dù
 * nhóm không có ai ⇒ `applyEntryRulesOnce()` bước 3 `if(empty($resolved))` KHÔNG chạy (không
 * bao giờ tới empty_approver_action) và `isStepFullySatisfied()` không bao giờ thoả mục đó ⇒ phiếu
 * đứng chờ tới khi admin can thiệp. Các loại KHÁC khi rỗng thì prod KHÔNG phát mục:
 *   user không tồn tại ⇒ bỏ mục; submitter_manager không tìm ra quản lý ⇒ không có mục;
 *   requester mà người nộp không có trong tbl_user ⇒ không có mục; self_select ⇒ không có mục.
 *   Chỉ khi $resolved RỖNG mới đi empty_approver_action.
 * Prod 24/09/2026: gid 28 "Giám đốc Kinh doanh" isactive=0, 0 thành viên (nhóm rỗng duy nhất).
 * Bước auto_approve DUY NHẤT trên prod: giaitrinh_chamcong step 17155 "Quản lý trực tiếp duyệt",
 * OR, empty_approver_action=auto_approve, self_approval_action=skip, approvers = submitter_manager.
 */
const tpl = new TemplateService(prisma as any); const be = new BranchEvaluator(prisma as any);
const rr = new ApproverResolver(prisma as any); const sync = new BusinessSyncService(prisma as any);
const reqSvc = new RequestService(prisma as any, tpl, be);
const svc = new ApprovalService(prisma as any, tpl, rr, sync);
beforeEach(resetApproval); afterAll(() => prisma.$disconnect());
async function user(u: string, o: any = {}) { return prisma.user.create({ data: { username: u, password: 'x', ...o } }); }
const status = async (id: number) => (await prisma.approvalRequest.findUnique({ where: { id } }))!.status;

/** Bước AND hai mục: group:46 + group:<gid2>. */
async function andTwoGroups(gid2: number) {
  await user('sale_eg'); await user('kt1', { gid: 46 }); await user('gd1', { gid: 27 });
  const t = await seedTemplate('eg_and_' + gid2);
  const s1 = await seedStep(t.id, { order: 1, nodeType: 'AND' });
  await seedApprover(s1.id, 'group', 46);
  await seedApprover(s1.id, 'group', gid2);
  return reqSvc.submit('eg_and_' + gid2, 'wallet_alloc', 1, 'EG-' + gid2, 'sale_eg', {});
}

describe('I1 — nhóm rỗng không được làm bước tự qua', () => {
  test('CỐT LÕI: AND group:46 + group:28 (0 thành viên) — một kế toán ký thì phiếu VẪN chờ', async () => {
    const r = await andTwoGroups(28);
    expect((await svc.approve(r.requestId, 'kt1')).status).toBe(1);
  });

  test('ĐỐI CHỨNG: AND group:46 + group:27 (đều có người) — kế toán + giám đốc ký ⇒ APPROVED', async () => {
    const r = await andTwoGroups(27);
    await svc.approve(r.requestId, 'kt1');
    expect((await svc.approve(r.requestId, 'gd1')).status).toBe(2);
  });

  test('OR chỉ có group:28 rỗng + emptyApproverAction=auto_approve ⇒ KHÔNG tự duyệt (prod không tới empty_approver_action)', async () => {
    await user('sale_eg');
    const t = await seedTemplate('eg_or_28');
    const s1 = await seedStep(t.id, { order: 1, nodeType: 'OR', emptyApproverAction: 'auto_approve' });
    await seedApprover(s1.id, 'group', 28);
    const r = await reqSvc.submit('eg_or_28', 'wallet_alloc', 1, 'EG-OR', 'sale_eg', {});
    await svc.runAutomation(r.requestId);
    expect(await status(r.requestId)).toBe(1);
  });

  test('override excluded người DUY NHẤT của nhóm 27 thì mục 27 vẫn đòi chữ ký: kế toán ký một mình ⇒ VẪN chờ', async () => {
    const r = await andTwoGroups(27);
    await prisma.approvalRequestApprover.create({ data: { requestId: r.requestId, stepOrder: 1, username: 'gd1', changeType: 'excluded' } });
    expect((await svc.approve(r.requestId, 'kt1')).status).toBe(1);
  });

  test('SEQ có nhóm rỗng cũng không qua: SEQ group:46 + group:28, kế toán ký ⇒ VẪN chờ', async () => {
    await user('sale_eg'); await user('kt1', { gid: 46 });
    const t = await seedTemplate('eg_seq');
    const s1 = await seedStep(t.id, { order: 1, nodeType: 'SEQ' });
    await seedApprover(s1.id, 'group', 46);
    await seedApprover(s1.id, 'group', 28);
    const r = await reqSvc.submit('eg_seq', 'wallet_alloc', 1, 'EG-SEQ', 'sale_eg', {});
    expect((await svc.approve(r.requestId, 'kt1')).status).toBe(1);
  });

  test('mục nhóm rỗng VÌ SoD loại người nộp (skip) thì không còn đòi: nhóm 46 chỉ có người nộp + nhóm 27 ⇒ giám đốc ký là xong', async () => {
    await user('kt_nop', { gid: 46 }); await user('gd1', { gid: 27 });
    const t = await seedTemplate('eg_sod');
    const s1 = await seedStep(t.id, { order: 1, nodeType: 'AND', selfApprovalAction: 'skip' });
    await seedApprover(s1.id, 'group', 46);
    await seedApprover(s1.id, 'group', 27);
    const r = await reqSvc.submit('eg_sod', 'wallet_alloc', 1, 'EG-SOD', 'kt_nop', {});
    expect((await svc.approve(r.requestId, 'gd1')).status).toBe(2);
  });
});

describe('prod giaitrinh_chamcong step 17155 — ca prod THẬT SỰ tự duyệt', () => {
  async function chamCong(submitter: string) {
    const t = await seedTemplate('giaitrinh_chamcong');
    const s1 = await seedStep(t.id, { order: 1, name: 'Quản lý trực tiếp duyệt', nodeType: 'OR', emptyApproverAction: 'auto_approve', selfApprovalAction: 'skip' });
    await seedApprover(s1.id, 'submitter_manager');
    const r = await reqSvc.submit('giaitrinh_chamcong', 'wallet_alloc', 1, 'GTCC-1', submitter, {});
    await svc.runAutomation(r.requestId);
    return r;
  }

  test('người nộp KHÔNG có quản lý ⇒ không có mục nào ⇒ empty_approver_action=auto_approve ⇒ APPROVED', async () => {
    await user('nv_khong_ql');
    const r = await chamCong('nv_khong_ql');
    expect(await status(r.requestId)).toBe(2);
  });

  test('ĐỐI CHỨNG: người nộp CÓ quản lý ⇒ chờ quản lý duyệt', async () => {
    const ql = await user('ql1'); await user('nv_co_ql', { leaderId: ql.id });
    const r = await chamCong('nv_co_ql');
    expect(await status(r.requestId)).toBe(1);
  });
});
