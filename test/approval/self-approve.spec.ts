import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { TemplateService } from '../../src/approval/template.service';
import { BranchEvaluator } from '../../src/approval/branch-evaluator';
import { RequestService } from '../../src/approval/request.service';
import { ApproverResolver } from '../../src/approval/approver-resolver';
import { ApprovalService } from '../../src/approval/approval.service';
import { BusinessSyncService } from '../../src/approval/business-sync.service';

/*
 * I2 (review cuối) — chặn TỰ DUYỆT lúc bấm duyệt, chép prod `approve()` (libs/cls.approval.php HEAD):
 *   if($username === $req['submitted_by'] && intval($isadmin) != 1){
 *     $__is_ketoan = isaccountant của tbl_user_group WHERE id = <gid phiên của người bấm> AND isactive=1
 *     if(!$__is_ketoan) return error 'Bạn là người TRÌNH phiếu này nên không thể tự duyệt ...'
 *   }
 * $isadmin = CLS_STAFF::laSuperAdmin() (gid 1 / nhóm isadmin / isroot) = `isSuperAdmin` của v2.
 * Prod 24/09/2026: nhóm isaccountant=1 DUY NHẤT là gid 46 "KẾ TOÁN LOGISTICS".
 * Hình thật: van_phong_pham step 78 "HCNS xử lý", AND, approvers group:50 (HÀNH CHÍNH NHÂN SỰ),
 * self_approval_action='self' (mặc định cột; 96/107 bước prod mang 'self').
 */
const MSG = 'Bạn là người TRÌNH phiếu này nên không thể tự duyệt (nguyên tắc tách bạch người trình / người duyệt). Cần người khác trong nhóm duyệt.';
const tpl = new TemplateService(prisma as any); const be = new BranchEvaluator(prisma as any);
const rr = new ApproverResolver(prisma as any); const sync = new BusinessSyncService(prisma as any);
const reqSvc = new RequestService(prisma as any, tpl, be);
const svc = new ApprovalService(prisma as any, tpl, rr, sync);
async function user(u: string, o: any = {}) { return prisma.user.create({ data: { username: u, password: 'x', ...o } }); }
const status = async (id: number) => (await prisma.approvalRequest.findUnique({ where: { id } }))!.status;

beforeEach(async () => {
  await resetApproval();
  // tbl_user_group thật (cột đo trên prod): 46 isaccountant=1, 50 isaccountant=0, 1 Super Admin
  for (const g of [
    { id: 1, name: 'Super Admin', isAccountant: false, isActive: true },
    { id: 46, name: 'KẾ TOÁN LOGISTICS', isAccountant: true, isActive: true },
    { id: 50, name: 'HÀNH CHÍNH NHÂN SỰ', isAccountant: false, isActive: true },
  ]) await prisma.legacyGroup.upsert({ where: { id: g.id }, create: g, update: g });
});
afterAll(() => prisma.$disconnect());

/** van_phong_pham step 78: AND group:<gid>, self_approval_action 'self'; `submitter` nộp. */
async function vpp(gid: number, submitter: string) {
  const t = await seedTemplate('van_phong_pham_' + gid);
  const s = await seedStep(t.id, { order: 1, name: 'HCNS xử lý', nodeType: 'AND', selfApprovalAction: 'self' });
  await seedApprover(s.id, 'group', gid);
  return reqSvc.submit('van_phong_pham_' + gid, 'wallet_alloc', 1, 'VPP-1', submitter, {});
}

describe('I2 — người nộp không tự duyệt', () => {
  test('CỐT LÕI: nhân viên HCNS (gid 50) tự duyệt phiếu mình nộp ⇒ bị từ chối', async () => {
    await user('hcns1', { gid: 50 }); await user('hcns2', { gid: 50 });
    const r = await vpp(50, 'hcns1');
    expect((await svc.approve(r.requestId, 'hcns1')).ok).toBe(false);
  });

  test('submitted_by có khoảng trắng thừa (dữ liệu NẠP từ prod) vẫn bị chặn tự duyệt', async () => {
    // Review cuối #04b: approve()/stepEntries so `submittedBy` KHÔNG trim, resubmit() có trim (như prod).
    // MariaDB prod bỏ qua khoảng trắng cuối khi so (PAD SPACE) ⇒ prod chặn; Postgres thì không ⇒ phải trim.
    await user('hcns1', { gid: 50 }); await user('hcns2', { gid: 50 });
    const r = await vpp(50, 'hcns1');
    await prisma.approvalRequest.update({ where: { id: r.requestId }, data: { submittedBy: 'hcns1 ' } });
    expect(await svc.approve(r.requestId, 'hcns1')).toMatchObject({ ok: false, reason: MSG });
    expect(await status(r.requestId)).toBe(1);
  });

  test('lời từ chối đúng câu prod, không lộ chi tiết nội bộ', async () => {
    await user('hcns1', { gid: 50 }); await user('hcns2', { gid: 50 });
    const r = await vpp(50, 'hcns1');
    expect((await svc.approve(r.requestId, 'hcns1')).reason).toBe(MSG);
  });

  test('tự duyệt bị từ chối thì KHÔNG ghi lượt duyệt nào', async () => {
    await user('hcns1', { gid: 50 }); await user('hcns2', { gid: 50 });
    const r = await vpp(50, 'hcns1');
    await svc.approve(r.requestId, 'hcns1');
    expect(await prisma.approvalAction.count({ where: { requestId: r.requestId, action: 'approve' } })).toBe(0);
  });

  test('tự duyệt bị từ chối thì phiếu vẫn chờ', async () => {
    await user('hcns1', { gid: 50 });
    const r = await vpp(50, 'hcns1');
    await svc.approve(r.requestId, 'hcns1');
    expect(await status(r.requestId)).toBe(1);
  });

  test('ĐỐI CHỨNG: người KHÁC trong nhóm 50 duyệt ⇒ APPROVED', async () => {
    await user('hcns1', { gid: 50 }); await user('hcns2', { gid: 50 });
    const r = await vpp(50, 'hcns1');
    expect((await svc.approve(r.requestId, 'hcns2')).status).toBe(2);
  });

  test('Super Admin (isSuperAdmin) tự duyệt được — prod miễn $isadmin', async () => {
    await user('sa1', { gid: 50, isSuperAdmin: true });
    const r = await vpp(50, 'sa1');
    expect((await svc.approve(r.requestId, 'sa1')).ok).toBe(true);
  });

  test('kế toán gid 46 (nhóm isaccountant=1) tự duyệt được — như prod', async () => {
    await user('kt1', { gid: 46 });
    const r = await vpp(46, 'kt1');
    expect((await svc.approve(r.requestId, 'kt1')).ok).toBe(true);
  });

  test('nhóm kế toán đã TẮT (isactive=0) thì không còn được miễn', async () => {
    await prisma.legacyGroup.update({ where: { id: 46 }, data: { isActive: false } });
    await user('kt1', { gid: 46 });
    const r = await vpp(46, 'kt1');
    expect((await svc.approve(r.requestId, 'kt1')).ok).toBe(false);
  });

  test('miễn trừ xét gid CỦA NGƯỜI BẤM, không xét vai IAM: gid 53 + vai "gid 46" vẫn bị chặn', async () => {
    const role = await prisma.role.create({ data: { code: 'ke_toan', ten: 'Kế toán', moTa: 'Sinh tu nhom quyen cu gid 46' } });
    const u = await user('kt_iam', { gid: 53 });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, hieuLucTu: new Date('2000-01-01') } });
    const r = await vpp(46, 'kt_iam');
    expect((await svc.approve(r.requestId, 'kt_iam')).ok).toBe(false);
  });
});
