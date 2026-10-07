import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
const perm = new PermService(prisma as any); const org = new OrgService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org);
beforeEach(async () => { await resetIam(); perm.clearCache(); });
afterAll(() => prisma.$disconnect());

async function grant(uid: number, code: string, sc: any) { const r = await seedRole('r' + uid + sc, [{ code, scope: sc }]); await assignRole(uid, r.id); }

test('no perm -> fail-closed {id:-1}', async () => {
  const u = await seedUser({});
  expect(await scope.buildStaffScope('hrm.view', u.id)).toEqual({ id: -1 });
});
test('all -> {} (no restriction)', async () => {
  const u = await seedUser({}); await grant(u.id, 'hrm.view', 'all');
  expect(await scope.buildStaffScope('hrm.view', u.id)).toEqual({});
});
test('own -> {id:uid}', async () => {
  const u = await seedUser({}); await grant(u.id, 'hrm.view', 'own');
  expect(await scope.buildStaffScope('hrm.view', u.id)).toEqual({ id: u.id });
});
test('team -> self or direct reports', async () => {
  const u = await seedUser({}); await grant(u.id, 'hrm.view', 'team');
  expect(await scope.buildStaffScope('hrm.view', u.id)).toEqual({ OR: [{ id: u.id }, { leaderId: u.id }] });
});
test('dept_tree -> phongbanId in branch', async () => {
  const root = await prisma.department.create({ data: { ten: 'R' } });
  const child = await prisma.department.create({ data: { ten: 'C', parentId: root.id } });
  await org.recomputePath(root.id);
  const u = await seedUser({ phongbanId: root.id }); await grant(u.id, 'hrm.view', 'dept_tree');
  const w: any = await scope.buildStaffScope('hrm.view', u.id);
  expect(w.phongbanId.in.sort()).toEqual([root.id, child.id].sort());
});
test('dept -> phongbanId of uid', async () => {
  const d = await prisma.department.create({ data: { ten: 'D' } });
  const u = await seedUser({ phongbanId: d.id }); await grant(u.id, 'hrm.view', 'dept');
  expect(await scope.buildStaffScope('hrm.view', u.id)).toEqual({ phongbanId: d.id });
});
test('dept, no phongbanId -> self only, not {phongbanId:null}', async () => {
  const u = await seedUser({}); await grant(u.id, 'hrm.view', 'dept');
  expect(await scope.buildStaffScope('hrm.view', u.id)).toEqual({ id: u.id });
});
test('invalid uid (<=0) on non-all scope -> fail-closed', async () => {
  const u = await seedUser({}); await grant(u.id, 'hrm.view', 'own');
  expect(await scope.buildStaffScope('hrm.view', 0)).toEqual({ id: -1 });
  expect(await scope.buildStaffScope('hrm.view', -5)).toEqual({ id: -1 });
});
