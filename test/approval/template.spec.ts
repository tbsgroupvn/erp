import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { TemplateService } from '../../src/approval/template.service';
const svc = new TemplateService(prisma as any);
beforeEach(resetApproval); afterAll(() => prisma.$disconnect());
test('getByCode + getSteps (main flow, ordered, with approvers)', async () => {
  const t = await seedTemplate('phan_bo_vi_kh');
  const s2 = await seedStep(t.id, { order: 2 }); const s1 = await seedStep(t.id, { order: 1 });
  await seedApprover(s1.id, 'group', 5);
  expect((await svc.getByCode('phan_bo_vi_kh'))!.id).toBe(t.id);
  const steps = await svc.getSteps(t.id, null);
  expect(steps.map((s) => s.stepOrder)).toEqual([1, 2]);           // sorted
  expect((steps[0] as any).approvers.length).toBe(1);
});
