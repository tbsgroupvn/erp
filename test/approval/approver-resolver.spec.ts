import { prisma, resetApproval } from '../helpers/approval-db';
import { ApproverResolver } from '../../src/approval/approver-resolver';
const rr = new ApproverResolver(prisma as any);
beforeEach(resetApproval); afterAll(() => prisma.$disconnect());
async function user(username: string, o: any = {}) { return prisma.user.create({ data: { username, password: 'x', ...o } }); }

/*
 * `approver_type='group'` mang **gid cũ** (`tbl_user_group.id`), KHÔNG phải id vai IAM.
 * Prod (`libs/cls.approval.php` HEAD, usersInLegacyOrIamGroup): thành viên nhóm gid N =
 *   (a) `tbl_user.gid = N AND isactive = 1`, CỘNG
 *   (b) người có vai IAM còn hiệu lực, vai `active = 1`, `tbl_role.mo_ta LIKE '%gid N'`.
 * Số liệu thật đo trên prod 24/09/2026:
 *   tbl_user_group 28 = "Giám đốc Kinh doanh", 46 = "KẾ TOÁN LOGISTICS", 51 = "XUẤT NHẬP KHẨU";
 *   tbl_role 28 = "Kế toán" (code ke_toan) với mo_ta "Sinh tu nhom quyen cu gid 46";
 *   tbl_role 33 = "Xuất nhập khẩu" (code xnk) với mo_ta "Sinh tu nhom quyen cu gid 51".
 * ⇒ số 28 trong bước duyệt là GĐKD; vai 28 (Kế toán) là ảnh IAM của nhóm 46.
 */
const D2000 = new Date('2000-01-01');
async function roleKeToan() {
  return prisma.role.create({ data: { id: 28, code: 'ke_toan', ten: 'Kế toán', moTa: 'Sinh tu nhom quyen cu gid 46' } });
}
async function roleXnk() {
  return prisma.role.create({ data: { id: 33, code: 'xnk', ten: 'Xuất nhập khẩu', moTa: 'Sinh tu nhom quyen cu gid 51' } });
}
const grp = (gid: number) => ({ approvers: [{ approverType: 'group', approverRef: gid }] });

describe('D1 — group = gid cũ', () => {
  test('gid 46 (KẾ TOÁN LOGISTICS) ra đúng các thành viên tbl_user.gid=46', async () => {
    await user('kt1', { gid: 46 }); await user('kt2', { gid: 46 }); await user('sale1', { gid: 53 });
    expect((await rr.resolveStepApprovers(grp(46) as any, { submitterUsername: 'sale1' })).sort()).toEqual(['kt1', 'kt2']);
  });

  test('CỐT LÕI: group 28 ra thành viên nhóm GĐKD (gid 28), KHÔNG ra kế toán mang vai id 28', async () => {
    const role = await roleKeToan();
    const kt = await user('kt1', { gid: 46 });
    await prisma.userRole.create({ data: { userId: kt.id, roleId: role.id, hieuLucTu: D2000 } });
    await user('gdkd', { gid: 28 });
    expect(await rr.resolveStepApprovers(grp(28) as any, { submitterUsername: 'x' })).toEqual(['gdkd']);
  });

  test('ĐỐI CHỨNG: group 46 có kế toán mang vai IAM 28 (mo_ta "... gid 46") dù tbl_user.gid khác', async () => {
    const role = await roleKeToan();
    const kt = await user('kt_iam', { gid: 53 });
    await prisma.userRole.create({ data: { userId: kt.id, roleId: role.id, hieuLucTu: D2000 } });
    expect(await rr.resolveStepApprovers(grp(46) as any, { submitterUsername: 'x' })).toEqual(['kt_iam']);
  });

  test('vai IAM ánh xạ gid (ca nguyenha: gid 53 + vai xnk "gid 51") được tính vào nhóm 51', async () => {
    const role = await roleXnk();
    const u = await user('nguyenha.tbs', { gid: 53 });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, hieuLucTu: D2000 } });
    await user('xnk1', { gid: 51 });
    expect((await rr.resolveStepApprovers(grp(51) as any, { submitterUsername: 'x' })).sort()).toEqual(['nguyenha.tbs', 'xnk1']);
  });

  test('mo_ta phải KẾT THÚC bằng "gid N": vai "gid 46" không lọt vào nhóm 4', async () => {
    const role = await roleKeToan();
    const kt = await user('kt_iam', { gid: 53 });
    await prisma.userRole.create({ data: { userId: kt.id, roleId: role.id, hieuLucTu: D2000 } });
    expect(await rr.resolveStepApprovers(grp(4) as any, { submitterUsername: 'x' })).toEqual([]);
  });

  test('mo_ta chỉ CHỨA "gid 46" ở giữa (không ở cuối) thì không tính', async () => {
    const role = await prisma.role.create({ data: { code: 'kt_ghichu', ten: 'x', moTa: 'gid 46 (cũ, đã tách)' } });
    const u = await user('u_ghichu', { gid: 53 });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, hieuLucTu: D2000 } });
    expect(await rr.resolveStepApprovers(grp(46) as any, { submitterUsername: 'x' })).toEqual([]);
  });

  test('so khớp "gid N" không phân biệt hoa thường (collation *_ci của MySQL prod)', async () => {
    const role = await prisma.role.create({ data: { code: 'kt_hoa', ten: 'x', moTa: 'SINH TU NHOM QUYEN CU GID 46' } });
    const u = await user('u_hoa', { gid: 53 });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, hieuLucTu: D2000 } });
    expect(await rr.resolveStepApprovers(grp(46) as any, { submitterUsername: 'x' })).toEqual(['u_hoa']);
  });

  test('user gid 46 đã nghỉ (isActive=false) không còn là người duyệt', async () => {
    await user('kt_nghi', { gid: 46, isActive: false }); await user('kt1', { gid: 46 });
    expect(await rr.resolveStepApprovers(grp(46) as any, { submitterUsername: 'x' })).toEqual(['kt1']);
  });

  test('user nghỉ việc mà còn vai IAM "gid 46" cũng không tính', async () => {
    const role = await roleKeToan();
    const u = await user('kt_nghi', { gid: 53, isActive: false });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, hieuLucTu: D2000 } });
    expect(await rr.resolveStepApprovers(grp(46) as any, { submitterUsername: 'x' })).toEqual([]);
  });

  test('vai IAM hết hiệu lực (hieuLucDen đã qua) không tính', async () => {
    const role = await roleKeToan();
    const u = await user('kt_het', { gid: 53 });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, hieuLucTu: D2000, hieuLucDen: new Date('2001-01-01') } });
    expect(await rr.resolveStepApprovers(grp(46) as any, { submitterUsername: 'x' })).toEqual([]);
  });

  test('vai IAM chưa tới ngày hiệu lực không tính', async () => {
    const role = await roleKeToan();
    const u = await user('kt_sau', { gid: 53 });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, hieuLucTu: new Date('2999-01-01') } });
    expect(await rr.resolveStepApprovers(grp(46) as any, { submitterUsername: 'x' })).toEqual([]);
  });

  test('vai IAM đã tắt (active=false) không tính', async () => {
    const role = await prisma.role.create({ data: { code: 'ke_toan_tat', ten: 'KT', moTa: 'Sinh tu nhom quyen cu gid 46', active: false } });
    const u = await user('kt_tat', { gid: 53 });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, hieuLucTu: D2000 } });
    expect(await rr.resolveStepApprovers(grp(46) as any, { submitterUsername: 'x' })).toEqual([]);
  });

  test('người vừa có gid 46 vừa có vai "gid 46" chỉ xuất hiện một lần', async () => {
    const role = await roleKeToan();
    const u = await user('kt1', { gid: 46 });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, hieuLucTu: D2000 } });
    expect(await rr.resolveStepApprovers(grp(46) as any, { submitterUsername: 'x' })).toEqual(['kt1']);
  });
});

describe('các loại người duyệt khác (giữ nguyên)', () => {
  test('user theo id', async () => {
    const kt1 = await user('kt1');
    expect(await rr.resolveStepApprovers({ approvers: [{ approverType: 'user', approverRef: kt1.id }] } as any, { submitterUsername: 'sale1' })).toEqual(['kt1']);
  });

  test('submitter_manager = leader của người nộp', async () => {
    const boss = await user('boss'); await user('sale1', { leaderId: boss.id });
    expect(await rr.resolveStepApprovers({ approvers: [{ approverType: 'submitter_manager', approverRef: null }] } as any, { submitterUsername: 'sale1' })).toEqual(['boss']);
  });

  test('requester = người nộp', async () => {
    await user('sale1');
    expect(await rr.resolveStepApprovers({ approvers: [{ approverType: 'requester', approverRef: null }] } as any, { submitterUsername: 'sale1' })).toEqual(['sale1']);
  });

  test('requester mà người nộp KHÔNG có trong tbl_user ⇒ không có mục nào (prod)', async () => {
    expect(await rr.resolveStepEntries({ approvers: [{ approverType: 'requester', approverRef: null }] } as any, { submitterUsername: 'khong_ton_tai' })).toEqual([]);
  });

  test('I1: group rỗng (gid 28, 0 thành viên) VẪN phát một mục, members rỗng', async () => {
    expect(await rr.resolveStepEntries(grp(28) as any, { submitterUsername: 'x' })).toEqual([{ kind: 'group', ref: 28, members: [] }]);
  });

  test('self_select = danh sách người nộp tự chọn', async () => {
    expect(await rr.resolveStepApprovers({ approvers: [{ approverType: 'self_select', approverRef: null }] } as any, { submitterUsername: 'sale1', selfSelected: ['kt2'] })).toEqual(['kt2']);
  });

  test('gộp nhiều mục: nhóm 46 + leader + người nộp', async () => {
    const boss = await user('boss'); await user('kt1', { gid: 46 }); await user('sale1', { leaderId: boss.id });
    const step = { approvers: [
      { approverType: 'group', approverRef: 46 },
      { approverType: 'submitter_manager', approverRef: null },
      { approverType: 'requester', approverRef: null },
    ]};
    expect((await rr.resolveStepApprovers(step as any, { submitterUsername: 'sale1' })).sort()).toEqual(['boss', 'kt1', 'sale1']);
  });
});
