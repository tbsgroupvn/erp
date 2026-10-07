import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { PermService } from '../../src/iam/perm.service';

// HAI instance PermService trên CÙNG một DB = mô phỏng HAI TIẾN TRÌNH/POD.
// Đây là điều kiện sống của lỗi: mỗi tiến trình có memo riêng trong bộ nhớ.
const permA = new PermService(prisma as any); // "pod A" — phục vụ request
const permB = new PermService(prisma as any); // "pod B" — nơi admin thu hồi quyền

beforeEach(async () => {
  await resetIam();
  permA.clearCache();
  permB.clearCache();
  permA.verTtlMs = 5000; // mặc định như prod
  permB.verTtlMs = 5000;
});
afterAll(() => prisma.$disconnect());

// ⚠ Bẫy Jest: toHaveProperty('a.b') coi dấu chấm là ĐƯỜNG DẪN LỒNG NHAU.
// Mã quyền ở đây CÓ dấu chấm ('order.view') nên phải dùng dạng MẢNG
// toHaveProperty(['order.view']) để so đúng tên khoá.
async function grant(uid: number, code: string, sc: any) {
  const r = await seedRole('r' + uid + code, [{ code, scope: sc }]);
  await assignRole(uid, r.id);
  return r;
}

describe('PermService.version() — TTL memo (thu hồi quyền phải có hiệu lực xuyên tiến trình)', () => {
  it('⚠ THU HỒI QUYỀN lan sang tiến trình khác sau khi TTL hết', async () => {
    const u = await seedUser({ username: 'sale_ttl' });
    const role = await grant(u.id, 'order.view', 'own');

    // Pod A phục vụ 1 request -> nạp quyền vào cache, memo luôn version.
    expect(await permA.of(u.id)).toHaveProperty(['order.view']);

    // Pod B (admin) THU HỒI quyền rồi bump version.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await permB.bumpVersion();

    // TTL đã hết -> pod A phải đọc lại version từ DB, khoá cache đổi, quyền BIẾN MẤT.
    permA.verTtlMs = 0;
    expect(await permA.of(u.id)).not.toHaveProperty(['order.view']);
  });

  it('đối chứng: TTL còn hiệu lực thì pod A vẫn phục vụ bản cũ (chứng minh TTL là thứ gánh việc)', async () => {
    const u = await seedUser({ username: 'sale_ttl2' });
    const role = await grant(u.id, 'order.view', 'own');
    expect(await permA.of(u.id)).toHaveProperty(['order.view']);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await permB.bumpVersion();

    // TTL dài => pod A chưa đọc lại version, vẫn trả bản cache cũ.
    // Đây KHÔNG phải hành vi mong muốn — nó là cái giá CÓ CHẶN TRÊN mà ta chấp
    // nhận (tối đa verTtlMs), khác hẳn tình trạng cũ là KẸT VĨNH VIỄN tới lúc
    // restart. Ca này tồn tại để nếu ai đó bỏ TTL đi thì test trên hoá vô nghĩa
    // mà không ai biết.
    permA.verTtlMs = 60_000;
    expect(await permA.of(u.id)).toHaveProperty(['order.view']);
  });

  it('version() đọc lại từ DB khi TTL = 0 (không còn memo vĩnh viễn)', async () => {
    const v1 = await permA.version();
    await permB.bumpVersion();
    permA.verTtlMs = 0;
    expect(await permA.version()).toBe(v1 + 1);
  });
});
