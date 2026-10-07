import { Scope } from '@prisma/client';
import { prisma, resetIam, seedUser, seedRole, seedPerm } from '../helpers/iam-db';
import { PermService } from '../../src/iam/perm.service';
import { PermAdminService } from '../../src/iam/perm-admin.service';
const perm = new PermService(prisma as any);
const admin = new PermAdminService(prisma as any, perm);
beforeEach(async () => { await resetIam(); perm.clearCache(); });
afterAll(() => prisma.$disconnect());

test('assignRole grants + logs + bumps version', async () => {
  const u = await seedUser({}); const r = await seedRole('a', [{ code: 'order.view', scope: 'own' }]);
  const v0 = await perm.version();
  await admin.assignRole(u.id, r.id, 999);
  expect(await perm.can('order.view', u.id)).toBe(true);
  expect(await prisma.staffLog.count({ where: { hanhDong: 'gan_vai' } })).toBe(1);
  expect(await perm.version()).toBeGreaterThan(v0);
});
test('setLenPerm deny removes perm', async () => {
  const u = await seedUser({}); const r = await seedRole('a', [{ code: 'order.view', scope: 'all' }]);
  await admin.assignRole(u.id, r.id, 999);
  await admin.setLenPerm(u.id, 'order.view', 'deny', 'own', 999, 'thu hồi');
  expect(await perm.can('order.view', u.id)).toBe(false);
  expect(await prisma.staffLog.count({ where: { hanhDong: 'cap_le' } })).toBe(1);
});
test('saveMatrix blocks actor removing own admin perm (SoD)', async () => {
  const actor = await seedUser({});
  await seedPerm('iam.manage');
  const r = await seedRole('quan_tri', [{ code: 'iam.manage', scope: 'all' }]);
  await prisma.userRole.create({ data: { userId: actor.id, roleId: r.id, hieuLucTu: new Date('2000-01-01') } });
  perm.clearCache();
  await expect(admin.saveMatrix([{ roleId: r.id, permCode: 'iam.manage', bat: false, scope: 'all' }], actor.id))
    .rejects.toThrow(/quản trị|self/i);
});

test('removeRole blocks actor stripping own admin role (SoD)', async () => {
  const actor = await seedUser({});
  await seedPerm('iam.manage');
  const r = await seedRole('quan_tri', [{ code: 'iam.manage', scope: 'all' }]);
  await prisma.userRole.create({ data: { userId: actor.id, roleId: r.id, hieuLucTu: new Date('2000-01-01') } });
  perm.clearCache();
  await expect(admin.removeRole(actor.id, r.id, actor.id)).rejects.toThrow(/quản trị|self/i);
  const stillAssigned = await prisma.userRole.findFirst({ where: { userId: actor.id, roleId: r.id } });
  expect(stillAssigned).not.toBeNull();
});

test('saveMatrix partial-rejection is atomic — nothing lands when a later change violates SoD', async () => {
  const actor = await seedUser({});
  await seedPerm('iam.manage');
  await seedPerm('order.view');
  const adminRole = await seedRole('quan_tri', [{ code: 'iam.manage', scope: 'all' }]);
  await prisma.userRole.create({ data: { userId: actor.id, roleId: adminRole.id, hieuLucTu: new Date('2000-01-01') } });
  const roleA = await seedRole('roleA', []);
  perm.clearCache();

  const changes = [
    { roleId: roleA.id, permCode: 'order.view', bat: true, scope: 'own' as Scope },
    { roleId: adminRole.id, permCode: 'iam.manage', bat: false, scope: 'all' as Scope },
  ];
  await expect(admin.saveMatrix(changes, actor.id)).rejects.toThrow(/quản trị|self/i);

  const roleAPerm = await prisma.rolePermission.findFirst({ where: { roleId: roleA.id, permCode: 'order.view' } });
  expect(roleAPerm).toBeNull();
  const adminRolePerm = await prisma.rolePermission.findFirst({ where: { roleId: adminRole.id, permCode: 'iam.manage' } });
  expect(adminRolePerm).not.toBeNull();
});

test('setLenPerm logs the normalized (lowercased) permCode in audit', async () => {
  const actor = await seedUser({});
  const u = await seedUser({});
  await seedPerm('order.view');
  await admin.setLenPerm(u.id, 'ORDER.VIEW', 'deny', 'own', actor.id);
  const log = await prisma.staffLog.findFirst({ where: { hanhDong: 'cap_le' }, orderBy: { id: 'desc' } });
  expect(log?.sauJson).toContain('"permCode":"order.view"');
  const row = await prisma.userPermission.findFirst({ where: { userId: u.id } });
  expect(row?.permCode).toBe('order.view');
});
