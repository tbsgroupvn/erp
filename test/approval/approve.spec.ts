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

test('SoD: submitter cannot self-approve (skip); approver advances to APPROVED', async () => {
  const sale = await user('sale1'); const kt = await user('kt1', { gid: 46 }); // gid 46 = KẾ TOÁN LOGISTICS (prod)
  const t = await seedTemplate('phan_bo_vi_kh');
  const s1 = await seedStep(t.id, { order: 1, selfApprovalAction: 'skip' });
  await seedApprover(s1.id, 'requester');       // người nộp là ứng viên...
  await seedApprover(s1.id, 'group', 46); // ...cùng KT (gid 46)
  const r = await reqSvc.submit('phan_bo_vi_kh', 'wallet_alloc', 1, 'A1', 'sale1', {});

  const selfTry = await svc.approve(r.requestId, 'sale1');
  expect(selfTry.ok).toBe(false);               // SoD: người nộp bị loại (skip)

  const ktApprove = await svc.approve(r.requestId, 'kt1');
  expect(ktApprove.ok).toBe(true);
  expect(ktApprove.status).toBe(2);             // 1 bước OR -> APPROVED
});

test('SoD to_user: selfApprovalRef NULL -> submitter still excluded (regression pin cho bug Critical)', async () => {
  const sale = await user('sale2'); const kt = await user('kt2', { gid: 46 });
  const t = await seedTemplate('phan_bo_vi_kh_2');
  const s1 = await seedStep(t.id, { order: 1, selfApprovalAction: 'to_user', selfApprovalRef: null });
  await seedApprover(s1.id, 'requester');
  await seedApprover(s1.id, 'group', 46);
  const r = await reqSvc.submit('phan_bo_vi_kh_2', 'wallet_alloc', 1, 'A2', 'sale2', {});

  const selfTry = await svc.approve(r.requestId, 'sale2');
  expect(selfTry.ok).toBe(false); // submitter phải bị loại dù selfApprovalRef chưa cấu hình

  const ktApprove = await svc.approve(r.requestId, 'kt2');
  expect(ktApprove.ok).toBe(true);
  expect(ktApprove.status).toBe(2);
});

test('SoD to_user: selfApprovalRef SET -> submitter excluded, ref user can approve', async () => {
  const sale = await user('sale3'); const proxy = await user('proxy3');
  const t = await seedTemplate('phan_bo_vi_kh_3');
  const s1 = await seedStep(t.id, { order: 1, selfApprovalAction: 'to_user', selfApprovalRef: proxy.id });
  await seedApprover(s1.id, 'requester');
  const r = await reqSvc.submit('phan_bo_vi_kh_3', 'wallet_alloc', 1, 'A3', 'sale3', {});

  const selfTry = await svc.approve(r.requestId, 'sale3');
  expect(selfTry.ok).toBe(false);

  const proxyApprove = await svc.approve(r.requestId, 'proxy3');
  expect(proxyApprove.ok).toBe(true);
  expect(proxyApprove.status).toBe(2);
});

test('AND step: first approver alone does not advance; second approver completes it', async () => {
  const submitter = await user('sale4'); const a1 = await user('and_a1'); const a2 = await user('and_a2');
  const t = await seedTemplate('and_step_tpl');
  const s1 = await seedStep(t.id, { order: 1, nodeType: 'AND' });
  await seedApprover(s1.id, 'user', a1.id);
  await seedApprover(s1.id, 'user', a2.id);
  const r = await reqSvc.submit('and_step_tpl', 'wallet_alloc', 1, 'A4', 'sale4', {});

  const first = await svc.approve(r.requestId, 'and_a1');
  expect(first.ok).toBe(true);
  expect(first.status).toBe(1); // PENDING - chưa đủ AND

  const second = await svc.approve(r.requestId, 'and_a2');
  expect(second.ok).toBe(true);
  expect(second.status).toBe(2); // đủ cả hai -> APPROVED
});

test('multi-step: approving step1 advances to step2 (still PENDING); approving step2 -> APPROVED', async () => {
  const submitter = await user('sale5');
  const kt = await user('kt5', { gid: 46 }); const ktt = await user('ktt5', { gid: 27 }); // 46 KẾ TOÁN LOGISTICS, 27 Giám đốc (prod)
  const t = await seedTemplate('multi_step_tpl');
  const s1 = await seedStep(t.id, { order: 1, nodeType: 'OR' });
  const s2 = await seedStep(t.id, { order: 2, nodeType: 'OR' });
  await seedApprover(s1.id, 'group', 46);
  await seedApprover(s2.id, 'group', 27);
  const r = await reqSvc.submit('multi_step_tpl', 'wallet_alloc', 1, 'A5', 'sale5', {});

  const step1Approve = await svc.approve(r.requestId, 'kt5');
  expect(step1Approve.ok).toBe(true);
  expect(step1Approve.status).toBe(1); // PENDING - đã sang bước 2, chưa duyệt xong

  // KT (bước 1) không nằm trong ứng viên bước 2 -> không được duyệt
  const wrongStepTry = await svc.approve(r.requestId, 'kt5');
  expect(wrongStepTry.ok).toBe(false);

  const step2Approve = await svc.approve(r.requestId, 'ktt5');
  expect(step2Approve.ok).toBe(true);
  expect(step2Approve.status).toBe(2);
});

test('empty-eligible step with emptyApproverAction=auto_approve auto-completes the chain', async () => {
  const submitter = await user('sale6'); const a = await user('emptychain_a'); const b = await user('emptychain_b');
  const t = await seedTemplate('empty_step_tpl');
  const s1 = await seedStep(t.id, { order: 1, nodeType: 'OR' });
  // Bước 2: không seedApprover -> ứng viên rỗng, nhưng auto_approve -> runAutomation tự đi qua, KHÔNG cần ApprovalAction
  const s2 = await seedStep(t.id, { order: 2, nodeType: 'OR', emptyApproverAction: 'auto_approve' });
  const s3 = await seedStep(t.id, { order: 3, nodeType: 'OR' });
  await seedApprover(s1.id, 'user', a.id);
  await seedApprover(s3.id, 'user', b.id);
  const r = await reqSvc.submit('empty_step_tpl', 'wallet_alloc', 1, 'A6', 'sale6', {});

  const step1Approve = await svc.approve(r.requestId, 'emptychain_a');
  expect(step1Approve.ok).toBe(true);
  expect(step1Approve.status).toBe(1); // PENDING - đã tự đi qua bước 2 rỗng, đang chờ bước 3

  const step2ActionsCount = await prisma.approvalAction.count({ where: { requestId: r.requestId, stepOrder: 2 } });
  expect(step2ActionsCount).toBe(0); // không có ApprovalAction nào ở bước rỗng

  const step3Approve = await svc.approve(r.requestId, 'emptychain_b');
  expect(step3Approve.ok).toBe(true);
  expect(step3Approve.status).toBe(2);
});

test('SEQ step: first approver alone does NOT complete step (multi-eye safe); second approver completes it', async () => {
  const submitter = await user('sale7'); const a1 = await user('seq_a1'); const a2 = await user('seq_a2');
  const t = await seedTemplate('seq_step_tpl');
  const s1 = await seedStep(t.id, { order: 1, nodeType: 'SEQ' });
  await seedApprover(s1.id, 'user', a1.id);
  await seedApprover(s1.id, 'user', a2.id);
  const r = await reqSvc.submit('seq_step_tpl', 'wallet_alloc', 1, 'A7', 'sale7', {});

  const first = await svc.approve(r.requestId, 'seq_a1');
  expect(first.ok).toBe(true);
  expect(first.status).toBe(1); // PENDING - SEQ phải yêu cầu ĐỦ cả hai, không được xong sau 1 người

  const saved = await prisma.approvalRequest.findUnique({ where: { id: r.requestId } });
  expect(saved!.status).toBe(1); // vẫn PENDING sau khi mới có 1/2 duyệt

  const second = await svc.approve(r.requestId, 'seq_a2');
  expect(second.ok).toBe(true);
  expect(second.status).toBe(2); // đủ cả hai -> APPROVED
});
