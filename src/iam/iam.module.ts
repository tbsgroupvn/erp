import { Module } from '@nestjs/common';
import { PermService } from './perm.service';
import { OrgService } from './org.service';
import { ScopeService } from './scope.service';
import { TeamScopeService } from './team-scope.service';
import { AuthService } from './auth.service';
import { PermGuard } from './perm.guard';
import { PermAdminService } from './perm-admin.service';

@Module({
  providers: [PermService, OrgService, TeamScopeService, ScopeService, AuthService, PermGuard, PermAdminService],
  // ⚠ Trước 24/09/2026 chỗ này còn phải export cả `PrismaService`, vì
  // `@UseGuards(PermGuard)` khiến Nest dựng `PermGuard` "on the fly" trong
  // module CHỦ của controller (không tái dùng instance của IamModule), nên mọi
  // dependency của guard phải lộ ra qua exports. Nay `PrismaModule` là
  // `@Global` nên `PrismaService` có mặt ở mọi module mà không cần export lại —
  // và KHÔNG ĐƯỢC khai lại trong `providers`, vì khai lại là sinh thêm một
  // instance + một connection pool (xem src/prisma/prisma.module.ts).
  exports: [PermService, OrgService, TeamScopeService, ScopeService, AuthService, PermGuard, PermAdminService],
})
export class IamModule {}
