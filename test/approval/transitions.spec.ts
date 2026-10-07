import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { TemplateService } from '../../src/approval/template.service';
import { BranchEvaluator } from '../../src/approval/branch-evaluator';
import { RequestService } from '../../src/approval/request.service';
import { ApproverResolver } from '../../src/approval/approver-resolver';
import { ApprovalService } from '../../src/approval/approval.service';
import { BusinessSyncService } from '../../src/approval/business-sync.service';

const tpl = new TemplateService(prisma as any); const be = new BranchEvaluator(prisma as any);
const rr = new ApproverResolver(prisma as any); const sync = new BusinessSyncService(prisma as any);
const reqSvc = new RequestService(prisma as any, tpl, be);
const svc = new ApprovalService(prisma as any, tpl, rr, sync);
beforeEach(resetApproval); afterAll(() => prisma.$disconnect());
async function user(u: string, o: any = {}) { return prisma.user.create({ data: { username: u, password: 'x', ...o } }); }
// approver_ref của 'group' là gid cũ trên prod: 46 = KẾ TOÁN LOGISTICS, 27 = Giám đốc.

test('reject by eligible approver sets REJECTED(-1) with finishedAt + action recorded', async () => {
  const kt = await user('kt_rj1', { gid: 46 });
  const t = await seedTemplate('reject_tpl');
  const s1 = await seedStep(t.id, { order: 1 });
  await seedApprover(s1.id, 'group', 46);
  const r = await reqSvc.submit('reject_tpl', 'wallet_alloc', 1, 'RJ1', 'sale_rj1', {});

  const res = await svc.reject(r.requestId, 'kt_rj1', 'không hợp lệ');
  expect(res.ok).toBe(true);
  expect(res.status).toBe(-1);

  const saved = await prisma.approvalRequest.findUnique({ where: { id: r.requestId } });
  expect(saved!.status).toBe(-1);
  expect(saved!.finishedAt).not.toBeNull();

  const action = await prisma.approvalAction.findFirst({ where: { requestId: r.requestId, action: 'reject' } });
  expect(action).not.toBeNull();
  expect(action!.actedBy).toBe('kt_rj1');
});

test('reject blocked when actor is not eligible approver of current step', async () => {
  const kt = await user('kt_rj2', { gid: 46 });
  const t = await seedTemplate('reject_tpl2');
  const s1 = await seedStep(t.id, { order: 1 });
  await seedApprover(s1.id, 'group', 46);
  const r = await reqSvc.submit('reject_tpl2', 'wallet_alloc', 1, 'RJ2', 'sale_rj2', {});

  const res = await svc.reject(r.requestId, 'random_stranger', 'no');
  expect(res.ok).toBe(false);

  const saved = await prisma.approvalRequest.findUnique({ where: { id: r.requestId } });
  expect(saved!.status).toBe(1); // vẫn PENDING
});

test('reject blocked when request is not PENDING', async () => {
  const kt = await user('kt_rj3', { gid: 46 });
  const t = await seedTemplate('reject_tpl3');
  const s1 = await seedStep(t.id, { order: 1 });
  await seedApprover(s1.id, 'group', 46);
  const r = await reqSvc.submit('reject_tpl3', 'wallet_alloc', 1, 'RJ3', 'sale_rj3', {});
  await svc.reject(r.requestId, 'kt_rj3', 'x'); // -> REJECTED

  const res = await svc.reject(r.requestId, 'kt_rj3', 'lại nữa');
  expect(res.ok).toBe(false);
});

test('submitter can revoke a PENDING request when template allowRevokePending=true', async () => {
  await user('kt_rv1');
  const t = await seedTemplate('revoke_tpl1');
  await prisma.approvalTemplate.update({ where: { id: t.id }, data: { allowRevokePending: true } });
  const s1 = await seedStep(t.id, { order: 1 });
  await seedApprover(s1.id, 'user', (await user('rv1_appr')).id);
  const r = await reqSvc.submit('revoke_tpl1', 'wallet_alloc', 1, 'RV1', 'sale_rv1', {});

  const res = await svc.revoke(r.requestId, 'sale_rv1', 'đổi ý');
  expect(res.ok).toBe(true);
  expect(res.status).toBe(-2);

  const saved = await prisma.approvalRequest.findUnique({ where: { id: r.requestId } });
  expect(saved!.status).toBe(-2);
  expect(saved!.finishedAt).not.toBeNull();
  const action = await prisma.approvalAction.findFirst({ where: { requestId: r.requestId, action: 'revoke' } });
  expect(action).not.toBeNull();
});

test('non-submitter cannot revoke even when template allows revoke', async () => {
  const t = await seedTemplate('revoke_tpl2');
  await prisma.approvalTemplate.update({ where: { id: t.id }, data: { allowRevokePending: true } });
  const s1 = await seedStep(t.id, { order: 1 });
  await seedApprover(s1.id, 'user', (await user('rv2_appr')).id);
  const r = await reqSvc.submit('revoke_tpl2', 'wallet_alloc', 1, 'RV2', 'sale_rv2', {});

  const res = await svc.revoke(r.requestId, 'not_the_submitter', 'x');
  expect(res.ok).toBe(false);

  const saved = await prisma.approvalRequest.findUnique({ where: { id: r.requestId } });
  expect(saved!.status).toBe(1); // vẫn PENDING
});

test('submitter cannot revoke when template does NOT allow allowRevokePending', async () => {
  const t = await seedTemplate('revoke_tpl3'); // allowRevokePending mặc định false
  const s1 = await seedStep(t.id, { order: 1 });
  await seedApprover(s1.id, 'user', (await user('rv3_appr')).id);
  const r = await reqSvc.submit('revoke_tpl3', 'wallet_alloc', 1, 'RV3', 'sale_rv3', {});

  const res = await svc.revoke(r.requestId, 'sale_rv3', 'x');
  expect(res.ok).toBe(false);

  const saved = await prisma.approvalRequest.findUnique({ where: { id: r.requestId } });
  expect(saved!.status).toBe(1);
});

// #04b Task 2 — bản cũ của ca này GHIM HÀNH VI SAI ("trả về" = kéo phiếu về bước 1, đặt lại pendingSince,
// không khoá gì — chữ ký cũ còn nguyên nên lượt kế tiếp tiến bước lại). Prod KHÔNG đụng
// currentStepOrder/pendingSince khi trả về (docs/rewrite-spec/04b-tra-ve-nguoi-nop-sua.md §2.1, §8.1);
// phiếu đứng yên ở bước bị trả, dòng tbl_return_state = 'returned' chặn duyệt. Cổng đầy đủ:
// test/approval/return-gates.spec.ts.
test('returnToSubmitter keeps request PENDING at the SAME step (no rewind, pendingSince untouched) + marks it returned', async () => {
  const kt = await user('kt_rt1', { gid: 46 });
  const ktt = await user('ktt_rt1', { gid: 27 });
  const t = await seedTemplate('return_tpl1');
  const s1 = await seedStep(t.id, { order: 1, nodeType: 'OR' });
  const s2 = await seedStep(t.id, { order: 2, nodeType: 'OR' });
  await seedApprover(s1.id, 'group', 46);
  await seedApprover(s2.id, 'group', 27);
  // Điểm duyệt bước 2 bật trả về (không có dòng cấu hình ⇒ prod từ chối 'Điểm duyệt này không bật trả về.')
  await prisma.returnConfig.create({ data: { checkpointType: 'approval', checkpointRef: String(s2.id), editMode: 'all' } });
  const r = await reqSvc.submit('return_tpl1', 'wallet_alloc', 1, 'RT1', 'sale_rt1', {});

  const step1 = await svc.approve(r.requestId, 'kt_rt1');
  expect(step1.ok).toBe(true);
  expect(step1.status).toBe(1); // đã sang bước 2, còn PENDING

  const afterAdvance = await prisma.approvalRequest.findUnique({ where: { id: r.requestId } });
  expect(afterAdvance!.currentStepOrder).toBe(s2.stepOrder);
  // mốc dễ thấy: đặt lại pendingSince trong cùng giây với lúc tiến bước sẽ không lộ ra nếu so với giờ thật
  await prisma.approvalRequest.update({ where: { id: r.requestId }, data: { pendingSince: 1_000 } });

  const res = await svc.returnToSubmitter(r.requestId, 'ktt_rt1', 'thiếu chứng từ');
  expect(res.ok).toBe(true);
  expect(res.status).toBe(1); // vẫn PENDING

  const saved = await prisma.approvalRequest.findUnique({ where: { id: r.requestId } });
  expect(saved!.status).toBe(1);
  expect(saved!.currentStepOrder).toBe(s2.stepOrder); // đứng yên ở bước bị trả (bản cũ: s1)
  expect(saved!.pendingSince).toBe(1_000); // không đặt lại đồng hồ

  const st = await prisma.returnState.findUnique({
    where: { objectType_objectId: { objectType: 'approval_request', objectId: r.requestId } },
  });
  expect(st?.state).toBe('returned');

  const action = await prisma.approvalAction.findFirst({ where: { requestId: r.requestId, action: 'return_submitter' } });
  expect(action).not.toBeNull();
  expect(action!.actedBy).toBe('ktt_rt1');
  expect(action!.stepOrder).toBe(s2.stepOrder);
  expect(action!.note).toBe('Trả người nộp sửa: thiếu chứng từ');
});

test('returnToSubmitter blocked when actor is not eligible approver of current step', async () => {
  const kt = await user('kt_rt2', { gid: 46 });
  const t = await seedTemplate('return_tpl2');
  const s1 = await seedStep(t.id, { order: 1 });
  await seedApprover(s1.id, 'group', 46);
  const r = await reqSvc.submit('return_tpl2', 'wallet_alloc', 1, 'RT2', 'sale_rt2', {});

  const res = await svc.returnToSubmitter(r.requestId, 'random_stranger', 'x');
  expect(res.ok).toBe(false);
  const saved = await prisma.approvalRequest.findUnique({ where: { id: r.requestId } });
  expect(saved!.currentStepOrder).toBe(s1.stepOrder);
});

test('transfer: eligible approver transfers to another user when step allows -> request_approver + action recorded', async () => {
  const a1 = await user('tr1_a1'); const toUser = await user('tr1_to');
  const t = await seedTemplate('transfer_tpl1');
  const s1 = await seedStep(t.id, { order: 1 }); // allowTransfer mặc định true
  await seedApprover(s1.id, 'user', a1.id);
  const r = await reqSvc.submit('transfer_tpl1', 'wallet_alloc', 1, 'TR1', 'sale_tr1', {});

  const res = await svc.transfer(r.requestId, 'tr1_a1', 'tr1_to', 'nghỉ phép');
  expect(res.ok).toBe(true);

  const saved = await prisma.approvalRequest.findUnique({ where: { id: r.requestId } });
  expect(saved!.status).toBe(1); // vẫn PENDING

  const ra = await prisma.approvalRequestApprover.findFirst({ where: { requestId: r.requestId, changeType: 'transfer_in' } });
  expect(ra).not.toBeNull();
  expect(ra!.username).toBe('tr1_to');
  expect(ra!.stepOrder).toBe(s1.stepOrder);

  const action = await prisma.approvalAction.findFirst({ where: { requestId: r.requestId, action: 'transfer' } });
  expect(action).not.toBeNull();
  expect(action!.actedBy).toBe('tr1_a1');
});

test('transfer blocked when step.allowTransfer=false', async () => {
  const a1 = await user('tr2_a1');
  const t = await seedTemplate('transfer_tpl2');
  const s1 = await seedStep(t.id, { order: 1 });
  await prisma.approvalStep.update({ where: { id: s1.id }, data: { allowTransfer: false } });
  await seedApprover(s1.id, 'user', a1.id);
  const r = await reqSvc.submit('transfer_tpl2', 'wallet_alloc', 1, 'TR2', 'sale_tr2', {});

  const res = await svc.transfer(r.requestId, 'tr2_a1', 'someone_else', 'x');
  expect(res.ok).toBe(false);

  const ra = await prisma.approvalRequestApprover.findFirst({ where: { requestId: r.requestId } });
  expect(ra).toBeNull();
});

test('transfer blocked when actor is not eligible approver', async () => {
  const a1 = await user('tr3_a1');
  const t = await seedTemplate('transfer_tpl3');
  const s1 = await seedStep(t.id, { order: 1 });
  await seedApprover(s1.id, 'user', a1.id);
  const r = await reqSvc.submit('transfer_tpl3', 'wallet_alloc', 1, 'TR3', 'sale_tr3', {});

  const res = await svc.transfer(r.requestId, 'random_stranger', 'someone_else', 'x');
  expect(res.ok).toBe(false);
});

test('transfer is FUNCTIONAL: transferred-to user B becomes eligible and can actually approve/advance', async () => {
  const a1 = await user('tr4_a1'); const b = await user('tr4_b');
  const t = await seedTemplate('transfer_tpl4');
  const s1 = await seedStep(t.id, { order: 1, nodeType: 'OR' });
  await seedApprover(s1.id, 'user', a1.id);
  const r = await reqSvc.submit('transfer_tpl4', 'wallet_alloc', 1, 'TR4', 'sale_tr4', {});

  const transferRes = await svc.transfer(r.requestId, 'tr4_a1', 'tr4_b', 'nghỉ phép');
  expect(transferRes.ok).toBe(true);

  // B KHÔNG có mặt trong template.approvers -> chỉ được thêm qua override transfer_in
  const bTry = await svc.approve(r.requestId, 'tr4_b');
  expect(bTry.ok).toBe(true);
  expect(bTry.status).toBe(2); // 1 bước OR -> APPROVED sau khi B duyệt
});

test('transfer override "excluded" removes a template-group member from eligibility', async () => {
  const c = await user('tr5_c', { gid: 46 });
  const other = await user('tr5_other', { gid: 46 });
  const t = await seedTemplate('transfer_tpl5');
  const s1 = await seedStep(t.id, { order: 1, nodeType: 'OR' });
  await seedApprover(s1.id, 'group', 46); // cả tr5_c lẫn tr5_other đều trong nhóm
  const r = await reqSvc.submit('transfer_tpl5', 'wallet_alloc', 1, 'TR5', 'sale_tr5', {});

  await prisma.approvalRequestApprover.create({ data: {
    requestId: r.requestId, stepOrder: s1.stepOrder, username: 'tr5_c', changeType: 'excluded',
  }});

  const cTry = await svc.approve(r.requestId, 'tr5_c');
  expect(cTry.ok).toBe(false); // bị loại dù ở trong nhóm template

  const otherTry = await svc.approve(r.requestId, 'tr5_other');
  expect(otherTry.ok).toBe(true); // thành viên còn lại của nhóm vẫn duyệt được
  expect(otherTry.status).toBe(2);
});

test('transfer override cannot bypass SoD: transfer_in naming the submitter does not let submitter approve own request', async () => {
  const a1 = await user('tr6_a1');
  const t = await seedTemplate('transfer_tpl6');
  const s1 = await seedStep(t.id, { order: 1, nodeType: 'OR', selfApprovalAction: 'skip' });
  await seedApprover(s1.id, 'user', a1.id);
  const r = await reqSvc.submit('transfer_tpl6', 'wallet_alloc', 1, 'TR6', 'sale_tr6', {});

  // Override thêm thẳng người nộp vào diện transfer_in (giả lập lạm dụng/lỗi cấu hình)
  await prisma.approvalRequestApprover.create({ data: {
    requestId: r.requestId, stepOrder: s1.stepOrder, username: 'sale_tr6', changeType: 'transfer_in',
  }});

  const selfTry = await svc.approve(r.requestId, 'sale_tr6');
  expect(selfTry.ok).toBe(false); // SoD vẫn thắng, dù có override transfer_in
});
