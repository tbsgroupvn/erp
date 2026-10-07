// D8 (docs/rewrite-spec/migration/01-iam.md) — ràng buộc UNIQUE prod có mà Postgres thiếu.
// Prod sql_nhpcn (information_schema 24/09/2026):
//   tbl_user_role  uq_user_role  (user_id, role_id, hieu_luc_tu)
//   tbl_user_perm  uq_user_perm  (user_id, perm_code, loai)
//   tbl_user_scope uq_user_scope (user_id, loai, gia_tri)
//   tbl_user       username      UNIQUE với collation utf8mb3_unicode_ci ⇒ KHÔNG phân biệt hoa-thường
// Mỗi ca "bị từ chối" có ca ĐỐI CHỨNG đổi đúng MỘT cột khoá ⇒ được nhận, chứng minh ca kia đỏ vì
// ràng buộc chứ không vì fixture.
import { prisma, resetIam, seedRole, seedUser } from '../helpers/iam-db';
beforeEach(resetIam); afterAll(() => prisma.$disconnect());

async function fixture() {
  const u = await seedUser({ username: 'u_d8' });
  const role = await seedRole('r_d8', []);
  await prisma.permission.create({ data: { code: 'x.view', module: 'x', action: 'view' } });
  return { uid: u.id, rid: role.id };
}

describe('tbl_user_role UNIQUE (user_id, role_id, hieu_luc_tu)', () => {
  const row = (uid: number, rid: number, tu: string) =>
    prisma.userRole.create({ data: { userId: uid, roleId: rid, hieuLucTu: new Date(tu) } });

  it('chèn trùng bộ ba ⇒ bị từ chối', async () => {
    const { uid, rid } = await fixture();
    await row(uid, rid, '2026-08-13');
    await expect(row(uid, rid, '2026-08-13')).rejects.toThrow();
  });

  it('đối chứng: khác hieu_luc_tu ⇒ nhận', async () => {
    const { uid, rid } = await fixture();
    await row(uid, rid, '2026-08-13');
    await expect(row(uid, rid, '2026-08-14')).resolves.toBeDefined();
  });
});

describe('tbl_user_perm UNIQUE (user_id, perm_code, loai)', () => {
  const row = (uid: number, loai: 'allow' | 'deny', scope: 'own' | 'all') =>
    prisma.userPermission.create({ data: { userId: uid, permCode: 'x.view', loai, scope } });

  it('chèn trùng bộ ba (kể cả khác scope) ⇒ bị từ chối', async () => {
    const { uid } = await fixture();
    await row(uid, 'allow', 'own');
    await expect(row(uid, 'allow', 'all')).rejects.toThrow();
  });

  it('đối chứng: khác loai ⇒ nhận', async () => {
    const { uid } = await fixture();
    await row(uid, 'allow', 'own');
    await expect(row(uid, 'deny', 'own')).resolves.toBeDefined();
  });
});

describe('tbl_user_scope UNIQUE (user_id, loai, gia_tri)', () => {
  const row = (uid: number, giaTri: string) =>
    prisma.userScope.create({ data: { userId: uid, loai: 'warehouse', giaTri } });

  it('chèn trùng bộ ba ⇒ bị từ chối', async () => {
    const { uid } = await fixture();
    await row(uid, 'KHO_TQ');
    await expect(row(uid, 'KHO_TQ')).rejects.toThrow();
  });

  it('đối chứng: khác gia_tri ⇒ nhận', async () => {
    const { uid } = await fixture();
    await row(uid, 'KHO_TQ');
    await expect(row(uid, 'KHO_VN')).resolves.toBeDefined();
  });
});

describe('tbl_user.username UNIQUE không phân biệt hoa-thường', () => {
  it("'LePhuc' đã có ⇒ chèn 'lephuc' bị từ chối", async () => {
    await seedUser({ username: 'LePhuc' });
    await expect(seedUser({ username: 'lephuc' })).rejects.toThrow();
  });

  it("đối chứng: 'LePhuc' đã có ⇒ chèn 'LePhuc2' được nhận", async () => {
    await seedUser({ username: 'LePhuc' });
    await expect(seedUser({ username: 'LePhuc2' })).resolves.toBeDefined();
  });
});
