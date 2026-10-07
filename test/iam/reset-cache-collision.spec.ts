import { PermService } from '../../src/iam/perm.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';

/**
 * Ca canh bẫy ĐỤNG KHOÁ CACHE của `resetIam()`.
 *
 * Bẫy: `resetIam()` `TRUNCATE ... RESTART IDENTITY` rồi tạo lại
 * `perm_cfg.version` với giá trị CỐ ĐỊNH, trong khi `PermService` cache bản đồ
 * quyền theo khoá `uid@version`. `RESTART IDENTITY` khiến user đầu tiên của ca
 * SAU lại mang đúng `id` của ca TRƯỚC ⇒ khoá trùng khít ⇒ **ca sau nhận bản đồ
 * quyền của ca trước**.
 *
 * ⚠ Có HAI vế phải cùng đúng thì mới thoát bẫy, thiếu một là vô hiệu:
 *  1. `resetIam()` phải ghi version KHÁC NHAU sau mỗi lần gọi; VÀ
 *  2. `PermService.version()` phải THẬT SỰ đọc lại — mặc định nó memo hoá
 *     `PERM_VERSION_TTL_MS` (5000ms), mà hai ca test liên tiếp cách nhau chưa
 *     tới 5 giây, nên version mới nằm trong CSDL vẫn KHÔNG được đọc.
 *
 * Ca này cố ý KHÔNG gọi `clearCache()` — nó tồn tại để chứng minh bẫy đã chết
 * ngay cả khi người viết spec QUÊN cặp `clearCache()`. Gọi `clearCache()` ở đây
 * là làm ca test tự mù: nó sẽ xanh kể cả khi bản vá bị gỡ.
 */
describe('resetIam không được để đụng khoá cache uid@version', () => {
  it('ca sau KHÔNG nhận bản đồ quyền của ca trước dù trùng uid', async () => {
    const perm = new PermService(prisma as unknown as PrismaService);

    // --- Lượt 1: user có quyền ---
    await resetIam();
    const u1 = await seedUser({ username: 'ZZCACHE_a' });
    const role = await seedRole('zzcache-role', [{ code: 'zzcache.act', scope: 'all' }]);
    await assignRole(u1.id, role.id);
    expect(await perm.can('zzcache.act', u1.id)).toBe(true);

    // --- Lượt 2: RESTART IDENTITY ⇒ user mới lại mang đúng id cũ, nhưng KHÔNG có quyền ---
    await resetIam();
    const u2 = await seedUser({ username: 'ZZCACHE_b' });
    expect(u2.id).toBe(u1.id); // tiền đề của bẫy — nếu id khác thì ca này vô nghĩa

    // Không clearCache(): đây chính là điều kiện bẫy từng phát tác.
    expect(await perm.can('zzcache.act', u2.id)).toBe(false);
  });
});
