import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
const perm = new PermService(prisma as any); const org = new OrgService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org);
beforeEach(async () => { await resetIam(); perm.clearCache(); });
afterAll(() => prisma.$disconnect());
async function grant(uid: number, code: string, sc: any) { const r = await seedRole('r' + uid + sc, [{ code, scope: sc }]); await assignRole(uid, r.id); }

test('no perm -> {id:-1}', async () => {
  const u = await seedUser({ username: 'sale1' });
  expect(await scope.buildDocScope('order.view', u.id)).toEqual({ id: -1 });
});
test('own -> saler match or salerOther contains quoted username', async () => {
  const u = await seedUser({ username: 'sale1' }); await grant(u.id, 'order.view', 'own');
  expect(await scope.buildDocScope('order.view', u.id)).toEqual({
    OR: [{ saler: 'sale1' }, { salerOther: { contains: '"sale1"' } }],
  });
});
test('warehouse: có khai cột kho -> lọc theo kho được gán; chưa gán kho -> {id:-1}', async () => {
  const u = await seedUser({ username: 'kho1' }); await grant(u.id, 'khovn.view', 'warehouse');
  const F = { warehouse: 'storeId' }; // chứng từ CÓ cột kho thì phải khai tên cột
  expect(await scope.buildDocScope('khovn.view', u.id, F)).toEqual({ id: -1 }); // chưa gán kho
  await prisma.userScope.create({ data: { userId: u.id, loai: 'warehouse', giaTri: 'VN_HN' } });
  perm.clearCache();
  expect(await scope.buildDocScope('khovn.view', u.id, F)).toEqual({ storeId: { in: ['VN_HN'] } });
});

// ⚠ Ca này pin một lỗ HỆ THỐNG đã cắn thật ở CẢ #02 (Customer) lẫn #05 (Quote):
// trước 23/09/2026 `warehouse` mặc định lọc trên 'storeId', mà KHÔNG model nào
// trong schema có cột đó ⇒ Prisma ném PrismaClientValidationError (lỗi 500) cho
// mọi user có quyền ở phạm vi warehouse. Nay phải DENY (fail-closed).
test('warehouse: KHÔNG khai cột kho -> DENY, tuyệt đối không dựng filter lên cột lạ', async () => {
  const u = await seedUser({ username: 'kho2' }); await grant(u.id, 'quote.view', 'warehouse');
  await prisma.userScope.create({ data: { userId: u.id, loai: 'warehouse', giaTri: 'VN_HN' } });
  perm.clearCache();
  const w = await scope.buildDocScope('quote.view', u.id); // không truyền fields.warehouse
  expect(w).toEqual({ id: -1 });
  expect(JSON.stringify(w)).not.toContain('storeId');
});

// Chứng từ KHÔNG có khái niệm "người phụ trách phụ" (vd Quote chỉ có createdBy):
// nhánh own chỉ được lọc theo saler, không dựng vế OR trỏ vào cột không tồn tại.
test('own: salerOther=null -> chỉ lọc theo saler, không có vế OR', async () => {
  const u = await seedUser({ username: 'sale9' }); await grant(u.id, 'quote.view', 'own');
  expect(await scope.buildDocScope('quote.view', u.id, { saler: 'createdBy', salerOther: null }))
    .toEqual({ createdBy: 'sale9' });
});

// ⚠ D5 Task 1 (25/09/2026) ĐỔI luật: trước đây `team` = mình + `User.leaderId=uid` bất kể có Team
// hay không, chỉ so `saler`. Nay theo prod `tbs_team_salers`: cấp dưới HRM CHỈ tính khi uid là
// leader của một `Team`; không làm leader/phó ⇒ `team` ≡ `own`. Ca đầy đủ ở test/iam/scope-team.spec.ts.
test('team: có cấp dưới HRM nhưng không làm leader Team nào -> ≡ own (luật cũ đã bỏ)', async () => {
  const leader = await seedUser({ username: 'lead1' });
  await prisma.user.create({ data: { username: 'rep1', password: 'x', leaderId: leader.id, isActive: true } });
  await grant(leader.id, 'order.view', 'team');
  expect(await scope.buildDocScope('order.view', leader.id)).toEqual({
    OR: [{ saler: 'lead1' }, { salerOther: { contains: '"lead1"' } }],
  });
});
test('team: leader của Team -> self + active direct reports (inactive excluded), khớp cả salerOther', async () => {
  const leader = await seedUser({ username: 'lead1' });
  await prisma.team.create({ data: { name: 'T', leaderId: leader.id } });
  await prisma.user.create({ data: { username: 'rep1', password: 'x', leaderId: leader.id, isActive: true } });
  await prisma.user.create({ data: { username: 'rep2', password: 'x', leaderId: leader.id, isActive: true } });
  await prisma.user.create({ data: { username: 'repOff', password: 'x', leaderId: leader.id, isActive: false } });
  await grant(leader.id, 'order.view', 'team');
  const w: any = await scope.buildDocScope('order.view', leader.id);
  const names = w.OR.filter((c: any) => 'saler' in c).map((c: any) => c.saler).sort();
  expect(names).toEqual(['lead1', 'rep1', 'rep2'].sort()); // repOff excluded
  expect(w.OR).toContainEqual({ salerOther: { contains: '"rep1"' } });
});
test('dept, no phongbanId -> own-narrow {saler:username}', async () => {
  const u = await seedUser({ username: 'sd1' }); await grant(u.id, 'order.view', 'dept');
  expect(await scope.buildDocScope('order.view', u.id)).toEqual({ saler: 'sd1' });
});
test('dept, has phongbanId but no active users -> fail-closed', async () => {
  const d = await prisma.department.create({ data: { ten: 'D' } });
  const u = await seedUser({ username: 'sd2', phongbanId: d.id });
  await prisma.user.update({ where: { id: u.id }, data: { isActive: false } }); // no active user in dept
  await grant(u.id, 'order.view', 'dept'); // note: grant assigns a role to u; u is inactive but scopeOf still resolves via role rows
  expect(await scope.buildDocScope('order.view', u.id)).toEqual({ id: -1 });
});
test('dept, has active users -> saler in dept usernames', async () => {
  const d = await prisma.department.create({ data: { ten: 'D2' } });
  const u = await seedUser({ username: 'sd3', phongbanId: d.id });
  await grant(u.id, 'order.view', 'dept');
  const w: any = await scope.buildDocScope('order.view', u.id);
  expect(w.saler.in).toContain('sd3');
});
test('dept_tree -> saler in branch (parent + child dept users)', async () => {
  const root = await prisma.department.create({ data: { ten: 'R' } });
  const child = await prisma.department.create({ data: { ten: 'C', parentId: root.id } });
  await org.recomputePath(root.id);
  const boss = await seedUser({ username: 'dt1', phongbanId: root.id });
  await prisma.user.create({ data: { username: 'dt2', password: 'x', phongbanId: child.id, isActive: true } });
  await grant(boss.id, 'order.view', 'dept_tree');
  const w: any = await scope.buildDocScope('order.view', boss.id);
  expect(w.saler.in.sort()).toEqual(['dt1', 'dt2'].sort());
});
test('non-existent uid, no grant -> fail-closed (sc==="" short-circuit)', async () => {
  expect(await scope.buildDocScope('order.view', 999999)).toEqual({ id: -1 });
});
test('scope resolves but user row missing -> fail-closed (no-username guard)', async () => {
  // tbl_user_role.user_id has no FK (only role_id does), so a role can be granted to a uid
  // with no tbl_user row. This forces sc !== '' and reaches the `me` lookup, which returns
  // null -> `!me?.username` -> {id:-1}, independently of the sc==='' early-exit above.
  const r = await seedRole('r_ghost', [{ code: 'order.view', scope: 'own' }]);
  await assignRole(999999, r.id);
  expect(await scope.buildDocScope('order.view', 999999)).toEqual({ id: -1 });
});
// Note: an "unknown/legacy scope value" test (raw-insert a value outside the Scope union to hit the
// `return {...DENY}` fallthrough) was attempted and deliberately omitted — verified live that Postgres
// rejects a non-enum value at INSERT time (`invalid input value for enum "Scope"`), so that branch is
// unreachable through the DB today. The fallthrough line stays in buildDocScope as defense-in-depth
// against a future non-enum scope source (e.g. a raw/legacy scope string bypassing the enum).
