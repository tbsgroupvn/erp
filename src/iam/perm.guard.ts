import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERM } from './require-perm.decorator';
import { PermService } from './perm.service';
import { PrismaService } from '../prisma/prisma.service';
import { isSuperAdmin } from './super-admin';

@Injectable()
export class PermGuard implements CanActivate {
  constructor(private reflector: Reflector, private perm: PermService, private prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // ⚠ PHẢI dùng getAllAndOverride([handler, class]) — ĐỐI XỨNG với cách
    // JwtAuthGuard đọc IS_PUBLIC (src/auth/jwt-auth.guard.ts:10). Bản cũ đọc
    // `get(REQUIRE_PERM, ctx.getHandler())`: @RequirePerm gắn ở cấp LỚP biên
    // dịch trót lọt, chạy trót lọt, và GÁC ĐÚNG SỐ KHÔNG — route rơi thẳng vào
    // `if (!need) return true` bên dưới. Mà @Public() ở cấp lớp thì CHẠY, nên
    // hệ thống tự dạy người viết controller rằng cấp lớp là hợp lệ (F-4 của
    // review cuối nhánh feat/api-dot1). Ưu tiên handler nếu cả hai cùng khai.
    const raw = this.reflector.getAllAndOverride<string | string[]>(REQUIRE_PERM, [ctx.getHandler(), ctx.getClass()]);
    // @RequirePerm nhận NHIỀU mã (Ruling 4) và đòi ĐỦ CẢ. Vẫn chấp nhận dạng
    // chuỗi đơn để metadata cũ/viết tay không im lặng bị bỏ qua — bỏ qua im
    // lặng ở guard là mở cửa, đúng lớp lỗi F-4 vừa vá.
    const need = raw === undefined || raw === null ? [] : (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
    // ⚠⚠ `if (!need) return true` là MẶC ĐỊNH MỞ của tầng PHÂN QUYỀN, và "lối
    // mở" của nó là SỰ IM LẶNG (quên decorator, không để lại vết trong diff).
    // KHÔNG lật thành `return false` ở đây: làm vậy chỉ dời phát hiện sang lúc
    // CHẠY (403 bất ngờ trên production) và vẫn phải đẻ ra một @NoPermRequired
    // tức lại một sự im lặng khác. Chốt chặn thật nằm ở
    // test/auth/route-inventory.spec.ts: nó duyệt MỌI handler đã đăng ký trong
    // DI container và làm ĐỎ BUILD nếu có cái nào thiếu cả @Public lẫn
    // @RequirePerm — "ai đó quên" biến từ lỗ im lặng thành lỗi biên dịch xã hội.
    if (!need.length) return true;
    const req = ctx.switchToHttp().getRequest();
    // x-uid is a TEST-ONLY actor shortcut; production identity comes solely from a verified
    // JWT (req.user.sub). Never honor x-uid outside test.
    const jwtUid = req.user?.sub;
    const testUid = process.env.NODE_ENV === 'test' ? req.headers['x-uid'] : undefined;
    const uid = Number(jwtUid ?? testUid);
    if (!uid || uid <= 0) return false;                          // fail-closed
    const user = await this.prisma.user.findUnique({ where: { id: uid }, select: { isSuperAdmin: true, isActive: true } });
    if (!user || !user.isActive) return false;
    if (isSuperAdmin(user)) return true;
    // ĐỦ CẢ (every), không phải "một trong số" (some). Đổi thành some là nới
    // cửa: càng khai thêm mã càng dễ qua — xem chú thích ở require-perm.decorator.ts.
    for (const p of need) {
      if (!(await this.perm.can(p, uid))) return false;
    }
    return true;
  }
}
