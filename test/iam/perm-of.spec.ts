import { prisma, resetIam, seedUser, seedRole, assignRole, setUserPerm } from '../helpers/iam-db';
import { PermService } from '../../src/iam/perm.service';
const svc = new PermService(prisma as any);
beforeEach(async () => { await resetIam(); svc.clearCache(); });
afterAll(() => prisma.$disconnect());

// Same local-calendar-date convention the service uses (UTC-midnight of "today"),
// so test seed dates and the code's `today` agree regardless of host TZ/time-of-day.
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDaysStr(base: Date, days: number) {
  const d = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

test('role grants perm with its scope', async () => {
  const u = await seedUser({}); const r = await seedRole('sale', [{ code: 'order.view', scope: 'own' }]);
  await assignRole(u.id, r.id);
  expect(await svc.of(u.id)).toEqual({ 'order.view': 'own' });
});
test('multiple roles -> widest scope wins', async () => {
  const u = await seedUser({});
  const r1 = await seedRole('a', [{ code: 'order.view', scope: 'own' }]);
  const r2 = await seedRole('b', [{ code: 'order.view', scope: 'dept' }]);
  await assignRole(u.id, r1.id); await assignRole(u.id, r2.id);
  expect((await svc.of(u.id))['order.view']).toBe('dept');
});
test('allow lẻ overrides scope exactly', async () => {
  const u = await seedUser({}); const r = await seedRole('a', [{ code: 'order.view', scope: 'all' }]);
  await assignRole(u.id, r.id);
  await setUserPerm(u.id, 'order.view', 'allow', 'own');
  expect((await svc.of(u.id))['order.view']).toBe('own'); // ghi đè, không lấy rộng nhất
});
test('deny lẻ removes perm entirely (wins over allow+role)', async () => {
  const u = await seedUser({}); const r = await seedRole('a', [{ code: 'order.view', scope: 'all' }]);
  await assignRole(u.id, r.id);
  await setUserPerm(u.id, 'order.view', 'allow', 'own');
  await setUserPerm(u.id, 'order.view', 'deny', 'own');
  expect(await svc.of(u.id)).toEqual({});
});
test('expired role does not grant', async () => {
  const u = await seedUser({}); const r = await seedRole('a', [{ code: 'order.view', scope: 'own' }]);
  await assignRole(u.id, r.id, { tu: '2000-01-01', den: '2000-12-31' });
  expect(await svc.of(u.id)).toEqual({});
});
test('inactive role does not grant', async () => {
  const u = await seedUser({}); const r = await seedRole('a', [{ code: 'order.view', scope: 'own' }]);
  await prisma.role.update({ where: { id: r.id }, data: { active: false } });
  await assignRole(u.id, r.id);
  expect(await svc.of(u.id)).toEqual({});
});
test('role starting today grants (date-only, not full-timestamp, comparison)', async () => {
  const u = await seedUser({}); const r = await seedRole('a', [{ code: 'order.view', scope: 'own' }]);
  await assignRole(u.id, r.id, { tu: todayStr(), den: null });
  expect(await svc.of(u.id)).toEqual({ 'order.view': 'own' });
});
test('role whose last valid day is today still grants (through end of day)', async () => {
  const u = await seedUser({}); const r = await seedRole('a', [{ code: 'order.view', scope: 'own' }]);
  await assignRole(u.id, r.id, { tu: '2000-01-01', den: todayStr() });
  expect(await svc.of(u.id)).toEqual({ 'order.view': 'own' });
});
test('role that expired yesterday grants nothing', async () => {
  const u = await seedUser({}); const r = await seedRole('a', [{ code: 'order.view', scope: 'own' }]);
  await assignRole(u.id, r.id, { tu: '2000-01-01', den: addDaysStr(new Date(), -1) });
  expect(await svc.of(u.id)).toEqual({});
});
test('bumpVersion invalidates cache', async () => {
  const u = await seedUser({}); const r = await seedRole('a', [{ code: 'order.view', scope: 'own' }]);
  await assignRole(u.id, r.id);
  await svc.of(u.id);                         // cache
  await prisma.userRole.deleteMany({ where: { userId: u.id } });
  expect((await svc.of(u.id))['order.view']).toBe('own'); // vẫn cache cũ
  await svc.bumpVersion();
  expect(await svc.of(u.id)).toEqual({});     // cache mới, quyền đã mất
});
