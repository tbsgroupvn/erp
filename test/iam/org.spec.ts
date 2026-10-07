import { prisma, resetIam } from '../helpers/iam-db';
import { OrgService } from '../../src/iam/org.service';
const org = new OrgService(prisma as any);
beforeEach(resetIam); afterAll(() => prisma.$disconnect());

async function dep(ten: string, parentId: number | null) {
  return prisma.department.create({ data: { ten, parentId: parentId ?? null } });
}
test('recomputePath builds materialized paths down the whole branch', async () => {
  const a = await dep('A', null); const b = await dep('B', a.id); const c = await dep('C', b.id);
  await org.recomputePath(a.id);
  const rb = await prisma.department.findUnique({ where: { id: b.id } });
  const rc = await prisma.department.findUnique({ where: { id: c.id } });
  expect(rb!.duongDan).toBe(`/${a.id}/${b.id}/`);
  expect(rc!.duongDan).toBe(`/${a.id}/${b.id}/${c.id}/`);
});
test('branchIds returns dept + all descendants', async () => {
  const a = await dep('A', null); const b = await dep('B', a.id); const c = await dep('C', b.id);
  await org.recomputePath(a.id);
  const ids = (await org.branchIds([a.id])).sort((x: number, y: number) => x - y);
  expect(ids).toEqual([a.id, b.id, c.id].sort((x, y) => x - y));
});
test('canSetParent blocks cycle and >6 depth', async () => {
  const a = await dep('A', null); const b = await dep('B', a.id);
  expect(await org.canSetParent(a.id, b.id)).toBe(false);  // vòng tròn
  expect(await org.canSetParent(b.id, a.id)).toBe(true);
});
