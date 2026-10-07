import { isSuperAdmin } from '../../src/iam/super-admin';

describe('isSuperAdmin', () => {
  test('canonical flag', () => {
    expect(isSuperAdmin({ isSuperAdmin: true })).toBe(true);
    expect(isSuperAdmin({ isSuperAdmin: false })).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});
