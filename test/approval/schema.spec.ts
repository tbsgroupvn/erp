import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
beforeEach(resetApproval); afterAll(() => prisma.$disconnect());
test('approval tables reachable + seed works', async () => {
  const t = await seedTemplate('phan_bo_vi_kh');
  const s = await seedStep(t.id, { order: 1 });
  await seedApprover(s.id, 'group', 5);
  expect(await prisma.approvalStepApprover.count()).toBe(1);
});
