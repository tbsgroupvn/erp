import { PrismaClient, Scope, PermKind } from '@prisma/client';
export const prisma = new PrismaClient();

/**
 * Version cấp cho `perm_cfg` sau mỗi `resetIam()`. **Phải KHÁC NHAU mỗi lần.**
 *
 * ⚠⚠ Trước 24/09/2026 chỗ này ghi cứng `'1'`, và đó là một bẫy thật:
 * `PermService` cache bản đồ quyền theo khoá `uid@version`, còn
 * `TRUNCATE ... RESTART IDENTITY` khiến user đầu tiên của ca SAU lại mang đúng
 * `id` của ca TRƯỚC. Version cố định + id lặp lại = **khoá trùng khít** ⇒ ca sau
 * nhận bản đồ quyền của ca trước. Các ca phủ định ("user này KHÔNG có quyền X")
 * chỉ xanh nhờ tình cờ chạy sớm lúc cache còn rỗng — mong manh, vỡ ngay khi
 * chèn thêm ca hoặc đổi thứ tự trong file.
 *
 * Mốc `Date.now()` + bộ đếm: đảm bảo tăng đơn điệu và duy nhất kể cả khi nhiều
 * file spec dùng chung một tiến trình worker. `PermService.version()` đọc bằng
 * `parseInt(...,10)` nên số lớn vẫn hợp lệ.
 *
 * ⚠ Vế này MỘT MÌNH là chưa đủ: `version()` memo hoá `PERM_VERSION_TTL_MS`
 * (mặc định 5000ms) nên version mới trong CSDL vẫn KHÔNG được đọc lại giữa hai
 * ca test cách nhau chưa tới 5 giây. Vế còn lại nằm ở `.env.test`
 * (`PERM_VERSION_TTL_MS=0`). Gỡ một trong hai là bẫy sống lại.
 */
let __permVersionSeq = Date.now();

export async function resetIam() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE tbl_user, tbl_perm, tbl_role, tbl_role_perm, tbl_user_role,
     tbl_user_perm, tbl_user_scope, tbl_phongban, tbl_job_titles, tbl_team,
     tbl_saler_team, tbl_perm_cfg, tbl_login_log, tbl_staff_log RESTART IDENTITY CASCADE`,
  );
  await prisma.permConfig.create({ data: { ten: 'version', giaTri: String(++__permVersionSeq) } });
}
export async function seedPerm(code: string) {
  const [module, action] = code.split('.');
  await prisma.permission.upsert({ where: { code }, create: { code, module, action }, update: {} });
}
export async function seedUser(data: Partial<{ username: string; isSuperAdmin: boolean; phongbanId: number; leaderId: number }>) {
  return prisma.user.create({ data: {
    username: data.username ?? 'u' + Math.random().toString(36).slice(2, 7),
    password: 'x', isSuperAdmin: data.isSuperAdmin ?? false,
    phongbanId: data.phongbanId ?? null, leaderId: data.leaderId ?? null,
  }});
}
export async function seedRole(code: string, perms: { code: string; scope: Scope }[]) {
  const role = await prisma.role.create({ data: { code, ten: code } });
  for (const p of perms) { await seedPerm(p.code); await prisma.rolePermission.create({ data: { roleId: role.id, permCode: p.code, scope: p.scope } }); }
  return role;
}
export async function assignRole(userId: number, roleId: number, w?: { tu?: string; den?: string | null }) {
  return prisma.userRole.create({ data: {
    userId, roleId, hieuLucTu: new Date(w?.tu ?? '2000-01-01'),
    hieuLucDen: w?.den === undefined ? null : (w.den ? new Date(w.den) : null),
  }});
}
export async function setUserPerm(userId: number, code: string, loai: PermKind, scope: Scope) {
  await seedPerm(code);
  return prisma.userPermission.create({ data: { userId, permCode: code, loai, scope } });
}
