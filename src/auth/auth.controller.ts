import { Body, Controller, Post, UnauthorizedException, Req, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../iam/auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';
import { clientIp, gateIp, normalizeIp } from '../common/client-ip';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private jwt: JwtService) {}

  @Public()
  @Post('login')
  async login(
    // Pipe gắn NGAY TẠI tham số (không phụ thuộc main.ts gọi useGlobalPipes hay
    // không) để hành vi validate giống hệt nhau ở test lẫn production.
    @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: LoginDto,
    @Req() req: any,
  ) {
    const r = await this.auth.login(dto.username, dto.password, {
      ip: clientIp(req),
      // I-1: cổng tài khoản chỉ-nội-bộ đọc IP FAIL-CLOSED (proxy cấu hình sai ⇒ '' ⇒ không cho qua).
      gateIp: gateIp(req),
      // D3: tương đương SERVER_ADDR của Apache — địa chỉ cục bộ của kết nối TCP. Cổng tài khoản
      // chỉ-nội-bộ cho qua khi IP client == địa chỉ này (máy chủ tự gọi vòng qua tên miền).
      serverIp: normalizeIp(req?.socket?.localAddress || ''),
      userAgent: req.headers['user-agent'], referer: req.headers['referer'],
    });
    // Dùng CHUNG một thông điệp cho mọi nhánh hỏng. `r.reason` đã được AuthService
    // viết cho người dùng cuối, nhưng nó PHÂN BIỆT được các nhánh (khoá tài khoản,
    // chặn IP nội bộ, sai mật khẩu) ⇒ trả thẳng ra là kênh dò tài khoản.
    //
    // ⚠ ĐÍNH CHÍNH 23/09/2026 (F-6): chú thích này ĐÃ TỪNG mô tả một nhánh "khoá
    // tài khoản" mà `AuthService.login()` không hề có — `recentFailCount()` được
    // viết, được test, và KHÔNG AI GỌI. Nay nhánh đó CÓ THẬT (khoá tạm sau
    // LOGIN_MAX_FAIL_24H lần sai trong 24h, mặc định 10) nên chú thích mới đúng.
    // Chính vì nó có thật mà câu chung dưới đây càng quan trọng: lộ ra "tài khoản
    // đang bị khoá" là xác nhận username tồn tại VÀ đang bị nhắm.
    if (!r.ok) throw new UnauthorizedException('Đăng nhập không thành công');
    // D7: username ĐÃ LƯU trong CSDL (AuthService trả về), KHÔNG phải `dto.username` người dùng gõ —
    // gõ `lephuc ` vẫn vào `LePhuc` (D4), và mọi khoá nối submitted_by/saler dựa vào chuỗi này.
    return { access_token: await this.jwt.signAsync({ sub: r.userId, username: r.username }) };
  }
}
