import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { TemplateService } from '../../src/approval/template.service';
import { BranchEvaluator } from '../../src/approval/branch-evaluator';
import { RequestService } from '../../src/approval/request.service';
const svc = new RequestService(prisma as any, new TemplateService(prisma as any), new BranchEvaluator(prisma as any));
beforeEach(resetApproval); afterAll(() => prisma.$disconnect());
test('submit creates PENDING request at first step', async () => {
  const t = await seedTemplate('phan_bo_vi_kh'); const s1 = await seedStep(t.id, { order: 1 }); await seedApprover(s1.id, 'group', 1);
  const r = await svc.submit('phan_bo_vi_kh', 'wallet_alloc', 99, 'ALLOC-99', 'sale1', { so_tien: 5000 });
  expect(r.currentStepOrder).toBe(1);
  const req = await prisma.approvalRequest.findUnique({ where: { id: r.requestId } });
  expect(req!.status).toBe(1); expect(req!.submittedBy).toBe('sale1');
});
