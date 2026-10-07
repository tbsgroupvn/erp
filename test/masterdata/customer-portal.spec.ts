import { Scope } from '@prisma/client';
import { prisma, resetIam, seedUser, setUserPerm } from '../helpers/iam-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';
import { AuthService } from '../../src/iam/auth.service';
import { PermService } from '../../src/iam/perm.service';
import { CustomerPortalService } from '../../src/masterdata/customer-portal.service';

const auth = new AuthService(prisma as any);
const perm = new PermService(prisma as any);
const portal = new CustomerPortalService(prisma as any, auth, perm);

// Mã quyền gác setPassword() — xem src/masterdata/customer-portal.service.ts.
const PERM_SET_PASSWORD = 'customer.portal_manage';

// seedCustomer() (helpers/masterdata-db.ts) KHÔNG set username — cổng KH đăng nhập
// bằng username nên set thủ công = code cho các ca cần login thật.
async function seedLoginCustomer(code: string) {
  await seedCustomer(code, 'sale1');
  await prisma.customer.update({ where: { code }, data: { username: code } });
}

// Actor CÓ quyền customer.portal_manage — seed lại mỗi ca vì beforeEach TRUNCATE
// tbl_user (RESTART IDENTITY): PermService.of() cache theo `uid@version`, và cả
// uid lẫn version đều tái lập giống hệt ca trước -> clearCache() để không ăn
// nhầm bộ nhớ đệm của ca khác (đã thấy bẫy tương tự ở test/auth/global-guard.spec.ts).
async function seedAllowedActor(username: string): Promise<number> {
  const u = await seedUser({ username });
  await setUserPerm(u.id, PERM_SET_PASSWORD, 'allow', Scope.all);
  perm.clearCache();
  return u.id;
}

describe('CustomerPortalService', () => {
  let uidOk: number;
  beforeEach(async () => {
    await resetIam();
    await resetMasterdata();
    uidOk = await seedAllowedActor('ZZAPI_portal_ok');
  });
  afterAll(() => prisma.$disconnect());

  it('đặt mật khẩu -> băm bcrypt, KHÔNG lưu thô, KHÔNG md5', async () => {
    await seedCustomer('TBS8300', 'sale1');
    await portal.setPassword('TBS8300', 'MatKhau@123', uidOk);
    const c = await prisma.customer.findUnique({ where: { code: 'TBS8300' } });
    expect(c!.password).not.toBe('MatKhau@123');
    expect(c!.password).toMatch(/^\$2[aby]\$/); // bcrypt, không phải md5 32 ký tự
    expect(c!.password).not.toMatch(/^[a-f0-9]{32}$/);
  });

  it('đăng nhập đúng -> ok; sai -> fail', async () => {
    await seedLoginCustomer('TBS8301');
    await portal.setPassword('TBS8301', 'Dung@123', uidOk);
    expect((await portal.login('TBS8301', 'Dung@123')).ok).toBe(true);
    expect((await portal.login('TBS8301', 'Sai@123')).ok).toBe(false);
  });

  it('KHÔNG đăng nhập được bằng tài khoản nội bộ (2 hệ tách biệt)', async () => {
    // seed 1 user nội bộ #01 cùng tên qua helper IAM (seedUser) — không đụng bảng Customer.
    // ⚠ seedUser() mặc định lưu password:'x' (chuỗi thô, KHÔNG phải bcrypt) — nếu chỉ thử mật
    // khẩu SAI thì ca này "xanh" ngay cả khi CustomerPortalService lỡ được sửa để fallback sang
    // tbl_user, vì bcrypt.compare(bất_kỳ, 'x') tự ném lỗi và AuthService.verify() nuốt thành
    // false — chứng minh được "mật khẩu sai thì fail", KHÔNG chứng minh được "2 hệ tách biệt".
    // Ở đây ghi ĐÈ bằng hash bcrypt THẬT (qua chính AuthService.hash(), không tự cài bcrypt
    // riêng) rồi thử đăng nhập cổng KH bằng ĐÚNG username + ĐÚNG mật khẩu đó — vẫn phải fail,
    // vì portal.login() chỉ được phép tra tbl_customer, không được đụng tbl_user.
    const u = await seedUser({ username: 'TBS8302' });
    const realHash = await auth.hash('MatKhauNoiBoThat@123');
    await prisma.user.update({ where: { id: u.id }, data: { password: realHash } });

    const r = await portal.login('TBS8302', 'MatKhauNoiBoThat@123');
    expect(r.ok).toBe(false); // không có Customer tương ứng — dù mật khẩu nội bộ ĐÚNG 100%
  });

  it('khách đã khoá (isactive=0) không đăng nhập được', async () => {
    await seedLoginCustomer('TBS8303');
    await portal.setPassword('TBS8303', 'Dung@123', uidOk);
    await prisma.customer.update({ where: { code: 'TBS8303' }, data: { isactive: 0 } });
    expect((await portal.login('TBS8303', 'Dung@123')).ok).toBe(false);
  });

  it('setPassword từ chối khi người gọi KHÔNG có quyền customer.portal_manage', async () => {
    await seedCustomer('TBS8304', 'sale1');
    const uidNoPerm = (await seedUser({ username: 'ZZAPI_portal_noperm' })).id;
    perm.clearCache();
    await expect(portal.setPassword('TBS8304', 'MatKhau@123', uidNoPerm)).rejects.toThrow(/quyền/i);
    // Fail-closed đúng nghĩa: DB không bị đụng khi bị từ chối.
    const c = await prisma.customer.findUnique({ where: { code: 'TBS8304' } });
    expect(c!.password).toBeNull();
  });

  it('setPassword từ chối khi KHÔNG có actorUid (fail-closed, không suy diễn quyền mặc định)', async () => {
    await seedCustomer('TBS8305', 'sale1');
    await expect(portal.setPassword('TBS8305', 'MatKhau@123', 0 as unknown as number)).rejects.toThrow(/quyền/i);
    await expect(
      portal.setPassword('TBS8305', 'MatKhau@123', undefined as unknown as number),
    ).rejects.toThrow(/quyền/i);
  });
});
