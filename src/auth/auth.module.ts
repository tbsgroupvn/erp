import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { IamModule } from '../iam/iam.module';
import { PermGuard } from '../iam/perm.guard';
import { ScopeGuard } from '../iam/scope.guard';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    IamModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET chưa đặt — từ chối khởi động');
        return { secret, signOptions: { expiresIn: process.env.JWT_TTL ?? '8h' } };
      },
    }),
  ],
  controllers: [AuthController],
  // THỨ TỰ QUAN TRỌNG: JwtAuthGuard chạy TRƯỚC để nạp req.user, rồi PermGuard mới
  // đọc được req.user.sub. Đảo lại là PermGuard luôn thấy undefined ⇒ chặn sạch.
  //
  // ScopeGuard (Task 1, kế hoạch @RequirePerm nhận biết PHẠM VI) chạy SAU
  // CÙNG — nó cần REQUIRE_PERM của handler đã được PermGuard xác nhận "được
  // phép gọi" để chọn ĐÚNG mã quyền dựng phạm vi; đặt trước PermGuard sẽ hỏi
  // scope cho một request còn có thể bị PermGuard chặn ngay sau đó, tốn một
  // lượt truy vấn DB vô ích trên đường 403 (không phải lỗi đúng-sai, chỉ là
  // thứ tự lãng phí — nhưng vẫn giữ ĐÚNG thứ tự nêu trong chú thích trên).
  providers: [
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermGuard },
    { provide: APP_GUARD, useClass: ScopeGuard },
  ],
})
export class AuthModule {}
