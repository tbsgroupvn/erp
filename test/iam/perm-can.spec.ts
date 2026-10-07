import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { PermService } from '../../src/iam/perm.service';
const svc = new PermService(prisma as any);
beforeEach(async () => { await resetIam(); svc.clearCache(); });
afterAll(() => prisma.$disconnect());

test('can + scopeOf + canModule', async () => {
  const u = await seedUser({});
  const r = await seedRole('a', [{ code: 'order.view', scope: 'dept' }]);
  await assignRole(u.id, r.id);
  expect(await svc.can('ORDER.VIEW', u.id)).toBe(true);      // case-insensitive
  expect(await svc.can('order.edit', u.id)).toBe(false);
  expect(await svc.scopeOf('order.view', u.id)).toBe('dept');
  expect(await svc.scopeOf('order.edit', u.id)).toBe('');    // không có -> ''
  expect(await svc.canModule('order', u.id)).toBe(true);
  expect(await svc.canModule('wallet', u.id)).toBe(false);
});

test('prototype-chain property names are not granted', async () => {
  const u = await seedUser({});
  const r = await seedRole('a', [{ code: 'order.view', scope: 'own' }]); await assignRole(u.id, r.id);
  for (const k of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
    expect(await svc.can(k, u.id)).toBe(false);
    expect(await svc.scopeOf(k, u.id)).toBe('');
    expect(await svc.canModule(k, u.id)).toBe(false);
  }
  expect(await svc.can('order.view', u.id)).toBe(true); // real perm still works
});
