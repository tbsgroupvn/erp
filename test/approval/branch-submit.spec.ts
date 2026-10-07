import { prisma, resetApproval, seedTemplate, seedBranchGroup, seedStep, seedApprover } from '../helpers/approval-db';
import { TemplateService } from '../../src/approval/template.service';
import { BranchEvaluator } from '../../src/approval/branch-evaluator';
import { RequestService } from '../../src/approval/request.service';
const tpl = new TemplateService(prisma as any);
const svc = new RequestService(prisma as any, tpl, new BranchEvaluator(prisma as any));
beforeEach(resetApproval); afterAll(() => prisma.$disconnect());

/*
 * D3 đầu-cuối: phiếu điều chỉnh chi phí (adjustment_cost) khoản LỚN phải đi chuỗi có Giám đốc.
 * Cấu hình thật prod (sql_nhpcn 24/09/2026) — nhóm nhánh 12, dán nguyên condition_json:
 *   nhánh 27 "Khách chịu — lớn (≥5tr)" p1: Kinh doanh xác nhận khách gánh → Kế toán duyệt (group:46) → Giám đốc duyệt (group:27)
 *   nhánh 28 "Khách chịu — nhỏ"       p2: Kinh doanh xác nhận khách gánh → Kế toán duyệt (group:46)
 *   nhánh 30 "TBS chịu — nhỏ (mặc định)" p4: Kế toán duyệt (group:46)
 */
const C27 = '[{"field_key":"bearer","operator":"=","value":"customer"},{"field_key":"muc_tien","operator":"=","value":"lon"}]';
const C28 = '[{"field_key":"bearer","operator":"=","value":"customer"},{"field_key":"muc_tien","operator":"=","value":"nho"}]';

async function seedAdjustmentCost(withDefault = true) {
  const kd = await prisma.user.create({ data: { username: 'kd185', password: 'x' } });
  await prisma.user.create({ data: { username: 'kt1', password: 'x', gid: 46 } });
  await prisma.user.create({ data: { username: 'gd1', password: 'x', gid: 27 } });
  const t = await seedTemplate('adjustment_cost', { objectType: 'adjustment' });
  const g = await seedBranchGroup(t.id);
  const br = (id: number, branchName: string, priority: number, conditionJson: string, isDefault = false) =>
    prisma.approvalBranch.create({ data: { id, branchGroupId: g.id, branchName, priority, conditionJson, isDefault } });
  await br(27, 'Khách chịu — lớn (≥5tr)', 1, C27);
  await br(28, 'Khách chịu — nhỏ', 2, C28);
  if (withDefault) await br(30, 'TBS chịu — nhỏ (mặc định)', 4, '[]', true);
  const step = async (branchId: number, order: number, name: string, appr: [string, number][]) => {
    const s = await seedStep(t.id, { order, name, branchId });
    for (const [type, ref] of appr) await seedApprover(s.id, type, ref);
  };
  await step(27, 1, 'Kinh doanh xác nhận khách gánh', [['user', kd.id]]);
  await step(27, 2, 'Kế toán duyệt', [['group', 46]]);
  await step(27, 3, 'Giám đốc duyệt', [['group', 27]]);
  await step(28, 1, 'Kinh doanh xác nhận khách gánh', [['user', kd.id]]);
  await step(28, 2, 'Kế toán duyệt', [['group', 46]]);
  if (withDefault) await step(30, 1, 'Kế toán duyệt', [['group', 46]]);
  // luồng chính (branch NULL) — đích của lỗi "rơi về luồng chính" nếu có
  await seedApprover((await seedStep(t.id, { order: 1, name: 'Luồng chính' })).id, 'group', 46);
  return t;
}
const chainOf = async (requestId: number) => {
  const r = (await prisma.approvalRequest.findUnique({ where: { id: requestId } }))!;
  return (await tpl.getSteps(r.templateId, r.resolvedBranchId ?? null)).map((s) => s.stepName);
};

test('CỐT LÕI: khách chịu + muc_tien=lon ⇒ phiếu vào chuỗi có "Giám đốc duyệt"', async () => {
  await seedAdjustmentCost();
  const r = await svc.submit('adjustment_cost', 'adjustment', 1, 'ADJ-1', 'sale1', { bearer: 'customer', muc_tien: 'lon', so_tien: 7000000 });
  expect(await chainOf(r.requestId)).toEqual(['Kinh doanh xác nhận khách gánh', 'Kế toán duyệt', 'Giám đốc duyệt']);
});

test('ĐỐI CHỨNG: khách chịu + muc_tien=nho ⇒ chuỗi khoản nhỏ, KHÔNG có Giám đốc', async () => {
  await seedAdjustmentCost();
  const r = await svc.submit('adjustment_cost', 'adjustment', 1, 'ADJ-2', 'sale1', { bearer: 'customer', muc_tien: 'nho', so_tien: 1000000 });
  expect(await chainOf(r.requestId)).toEqual(['Kinh doanh xác nhận khách gánh', 'Kế toán duyệt']);
});

test('không khớp nhánh nào và không có mặc định ⇒ KHÔNG tạo phiếu (prod từ chối nộp)', async () => {
  await seedAdjustmentCost(false);
  await svc.submit('adjustment_cost', 'adjustment', 1, 'ADJ-3', 'sale1', { bearer: 'tbs', muc_tien: 'nho' }).catch(() => undefined);
  expect(await prisma.approvalRequest.count()).toBe(0);
});
