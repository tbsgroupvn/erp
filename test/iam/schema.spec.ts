import { prisma, resetIam, seedRole } from '../helpers/iam-db';
beforeEach(resetIam); afterAll(() => prisma.$disconnect());
test('IAM tables reachable + seed works', async () => {
  const r = await seedRole('sale', [{ code: 'order.view', scope: 'own' }]);
  expect(r.id).toBeGreaterThan(0);
  expect(await prisma.rolePermission.count()).toBe(1);
  // ⚠ KHÔNG khẳng định `=== '1'` nữa: từ 24/09/2026 `resetIam()` cố ý ghi version
  // KHÁC NHAU mỗi lần để khoá cache `uid@version` không đụng nhau giữa các ca
  // (xem test/helpers/iam-db.ts). Ở đây chỉ cần: có dòng, và giá trị là số dương
  // hợp lệ — đúng thứ `PermService.version()` thật sự cần.
  const ver = (await prisma.permConfig.findUnique({ where: { ten: 'version' } }))!.giaTri;
  expect(parseInt(ver, 10)).toBeGreaterThan(0);
});
