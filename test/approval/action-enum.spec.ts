import { prisma, resetApproval } from '../helpers/approval-db';
beforeEach(resetApproval); afterAll(() => prisma.$disconnect());

/*
 * D4 — enum ActionType phải chứa ĐỦ miền giá trị của prod, không thì INSERT vỡ lúc migrate dữ liệu.
 * Prod (sql_nhpcn, information_schema.columns, 24/09/2026) tbl_approval_actions.action:
 *   enum('approve','reject','transfer','return','add_approver','remove_approver','auto_approve',
 *        'auto_reject','revoke','modify_submit','modify_approve','modify_reject','stuck_no_approver',
 *        'return_submitter','resubmit','fx_adjust')
 * Giá trị ĐANG CÓ dữ liệu: approve 19525 · reject 276 · return_submitter 199 · resubmit 173 ·
 *   auto_approve 66 · revoke 38 · return 12 · stuck_no_approver 8 (4 trên phiếu còn tồn tại) ·
 *   add_approver 6 · transfer 6.
 */
const PROD_ACTIONS = ['approve', 'reject', 'transfer', 'return', 'add_approver', 'remove_approver', 'auto_approve',
  'auto_reject', 'revoke', 'modify_submit', 'modify_approve', 'modify_reject', 'stuck_no_approver',
  'return_submitter', 'resubmit', 'fx_adjust'];

async function enumValues(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ v: string }[]>(`SELECT unnest(enum_range(NULL::"ActionType"))::text AS v`);
  return rows.map((r) => r.v);
}

test('enum ActionType chứa đủ 16 giá trị action của prod', async () => {
  const have = new Set(await enumValues());
  expect(PROD_ACTIONS.filter((a) => !have.has(a))).toEqual([]);
});

test('nạp được dòng stuck_no_approver thật (system, ghi chú kẹt người duyệt)', async () => {
  const row = await prisma.approvalAction.create({ data: {
    requestId: 1, stepOrder: 1, stepName: 'Kế toán duyệt', action: 'stuck_no_approver', actedBy: 'system',
    actedAt: 1757000000, note: 'Khong xac dinh duoc nguoi duyet cho buoc nay va phuong an du phong (empty_approver_action=to_admin) cung khong ra ai',
  }});
  expect(row.action).toBe('stuck_no_approver');
});

test('ĐỐI CHỨNG: enum vẫn chặn giá trị lạ', async () => {
  await expect(prisma.approvalAction.create({ data: {
    requestId: 1, stepOrder: 1, action: 'khong_co_tren_prod' as any, actedBy: 'x', actedAt: 1,
  }})).rejects.toThrow();
});
