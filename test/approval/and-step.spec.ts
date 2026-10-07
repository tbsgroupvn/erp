import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { TemplateService } from '../../src/approval/template.service';
import { BranchEvaluator } from '../../src/approval/branch-evaluator';
import { RequestService } from '../../src/approval/request.service';
import { ApproverResolver } from '../../src/approval/approver-resolver';
import { ApprovalService } from '../../src/approval/approval.service';
import { BusinessSyncService } from '../../src/approval/business-sync.service';

/*
 * D2 — bước AND cần MỘT chữ ký cho MỖI MỤC người duyệt; mục là nhóm thì MỘT thành viên ký là đủ.
 * Prod `isStepFullySatisfied()` (libs/cls.approval.php HEAD): duyệt từng mục trong $resolved, mục
 * `group` được thoả khi có một lượt approve của người thuộc nhóm đó.
 *
 * Hình thật trên prod (24/09/2026): mọi bước AND đều có ĐÚNG MỘT mục, vd `rut_tien_vi_kh`
 *   step 362 "Kế toán kiểm tra" AND, self_approval_action=to_user, approvers = group:46
 *   step 364 "BGĐ duyệt chi (kèm ảnh uỷ nhiệm chi)" AND, approvers = group:27
 * 13 phiếu đang chờ ở bước `AND group:46` (2 là lệnh rút ví đang giữ tiền khách).
 * gid 46 = KẾ TOÁN LOGISTICS, gid 27 = Giám đốc.
 */
const tpl = new TemplateService(prisma as any); const be = new BranchEvaluator(prisma as any);
const rr = new ApproverResolver(prisma as any); const sync = new BusinessSyncService(prisma as any);
const reqSvc = new RequestService(prisma as any, tpl, be);
const svc = new ApprovalService(prisma as any, tpl, rr, sync);
beforeEach(resetApproval); afterAll(() => prisma.$disconnect());
async function user(u: string, o: any = {}) { return prisma.user.create({ data: { username: u, password: 'x', ...o } }); }
const cur = async (id: number) => (await prisma.approvalRequest.findUnique({ where: { id } }))!;

/** Hình rut_tien_vi_kh: bước 1 AND group:46 (to_user) → bước 2 AND group:27. */
async function rutTienShape() {
  await user('sale_rt'); await user('kt1', { gid: 46 }); await user('kt2', { gid: 46 });
  await user('gd1', { gid: 27 }); await user('gd2', { gid: 27 });
  const t = await seedTemplate('rut_shape_and');
  const s1 = await seedStep(t.id, { order: 1, name: 'Kế toán kiểm tra', nodeType: 'AND', selfApprovalAction: 'to_user' });
  const s2 = await seedStep(t.id, { order: 2, name: 'BGĐ duyệt chi', nodeType: 'AND' });
  await seedApprover(s1.id, 'group', 46);
  await seedApprover(s2.id, 'group', 27);
  return reqSvc.submit('rut_shape_and', 'wallet_alloc', 1, 'RUT-AND', 'sale_rt', {});
}

/** Bước AND hai mục: group:46 VÀ group:27 (không có trên prod — là đối chứng cho đa-chữ-ký). */
async function twoGroupAnd() {
  await user('sale_2g'); await user('kt1', { gid: 46 }); await user('kt2', { gid: 46 });
  await user('gd1', { gid: 27 });
  const t = await seedTemplate('and_2groups');
  const s1 = await seedStep(t.id, { order: 1, nodeType: 'AND' });
  await seedApprover(s1.id, 'group', 46);
  await seedApprover(s1.id, 'group', 27);
  return reqSvc.submit('and_2groups', 'wallet_alloc', 1, 'AND-2G', 'sale_2g', {});
}

describe('D2 — AND: một chữ ký mỗi mục', () => {
  test('CỐT LÕI: bước AND group:46 xong khi MỘT kế toán duyệt ⇒ phiếu sang bước 2', async () => {
    const r = await rutTienShape();
    await svc.approve(r.requestId, 'kt1');
    expect((await cur(r.requestId)).currentStepOrder).toBe(2);
  });

  test('ĐỐI CHỨNG: chưa ai duyệt thì bước AND group:46 vẫn đứng ở bước 1', async () => {
    const r = await rutTienShape();
    await svc.runAutomation(r.requestId);
    expect((await cur(r.requestId)).currentStepOrder).toBe(1);
  });

  test('AND hai mục (46 + 27): một kế toán duyệt thì phiếu VẪN chờ', async () => {
    const r = await twoGroupAnd();
    expect((await svc.approve(r.requestId, 'kt1')).status).toBe(1);
  });

  test('AND hai mục: kế toán thứ hai (cùng nhóm 46) KHÔNG thay được chữ ký của nhóm 27', async () => {
    const r = await twoGroupAnd();
    await svc.approve(r.requestId, 'kt1');
    expect((await svc.approve(r.requestId, 'kt2')).status).toBe(1);
  });

  test('AND hai mục: kế toán (46) + giám đốc (27) duyệt ⇒ APPROVED', async () => {
    const r = await twoGroupAnd();
    await svc.approve(r.requestId, 'kt1');
    expect((await svc.approve(r.requestId, 'gd1')).status).toBe(2);
  });

  test('prod: một người thuộc CẢ nhóm 46 (gid) lẫn nhóm 27 (vai IAM "gid 27") thoả cả hai mục bằng một chữ ký', async () => {
    const r = await twoGroupAnd();
    const role = await prisma.role.create({ data: { code: 'giam_doc_iam', ten: 'Giám đốc', moTa: 'Sinh tu nhom quyen cu gid 27' } });
    const both = await user('kt_gd', { gid: 46 });
    await prisma.userRole.create({ data: { userId: both.id, roleId: role.id, hieuLucTu: new Date('2000-01-01') } });
    expect((await svc.approve(r.requestId, 'kt_gd')).status).toBe(2);
  });

  test('mục chỉ còn người nộp bị SoD loại (requester + skip) thì không còn đòi chữ ký: kế toán duyệt ⇒ APPROVED', async () => {
    await user('sale_rq'); await user('kt1', { gid: 46 }); await user('kt2', { gid: 46 });
    const t = await seedTemplate('and_req_grp');
    const s1 = await seedStep(t.id, { order: 1, nodeType: 'AND', selfApprovalAction: 'skip' });
    await seedApprover(s1.id, 'requester');
    await seedApprover(s1.id, 'group', 46);
    const r = await reqSvc.submit('and_req_grp', 'wallet_alloc', 1, 'AND-RQ', 'sale_rq', {});
    expect((await svc.approve(r.requestId, 'kt1')).status).toBe(2);
  });
});

describe('D2 — SoD không nới', () => {
  /** Kế toán tự lập phiếu rồi nộp; bước AND group:46 (skip). */
  async function ktSubmits() {
    await user('kt_nop', { gid: 46 }); await user('kt2', { gid: 46 });
    const t = await seedTemplate('and_kt_nop');
    const s1 = await seedStep(t.id, { order: 1, nodeType: 'AND', selfApprovalAction: 'skip' });
    await seedApprover(s1.id, 'group', 46);
    return reqSvc.submit('and_kt_nop', 'wallet_alloc', 1, 'AND-KTNOP', 'kt_nop', {});
  }

  test('người nộp là thành viên nhóm 46 KHÔNG tự duyệt được bước AND group:46', async () => {
    const r = await ktSubmits();
    expect((await svc.approve(r.requestId, 'kt_nop')).ok).toBe(false);
  });

  test('người nộp tự bấm duyệt không làm bước AND hoàn tất', async () => {
    const r = await ktSubmits();
    await svc.approve(r.requestId, 'kt_nop');
    expect((await cur(r.requestId)).status).toBe(1);
  });

  test('ĐỐI CHỨNG: thành viên KHÁC của nhóm 46 duyệt ⇒ APPROVED', async () => {
    const r = await ktSubmits();
    expect((await svc.approve(r.requestId, 'kt2')).status).toBe(2);
  });
});

describe('SEQ giữ nguyên (prod 0 bước SEQ — ngoài phạm vi D2)', () => {
  test('SEQ group:46 hai thành viên: một người duyệt thì phiếu VẪN chờ (giữ ngữ nghĩa cũ "đủ mọi người")', async () => {
    await user('sale_sq'); await user('kt1', { gid: 46 }); await user('kt2', { gid: 46 });
    const t = await seedTemplate('seq_grp');
    const s1 = await seedStep(t.id, { order: 1, nodeType: 'SEQ' });
    await seedApprover(s1.id, 'group', 46);
    const r = await reqSvc.submit('seq_grp', 'wallet_alloc', 1, 'SEQ-G', 'sale_sq', {});
    expect((await svc.approve(r.requestId, 'kt1')).status).toBe(1);
  });
});
