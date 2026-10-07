import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET;
    // Fail-closed: thiếu secret thì SẬP LÚC KHỞI ĐỘNG, không chạy với secret mặc định.
    if (!secret) throw new Error('JWT_SECRET chưa đặt — từ chối khởi động');
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: secret });
  }
  async validate(payload: { sub: number; username: string }) {
    if (!payload?.sub) throw new UnauthorizedException();
    return { sub: payload.sub, username: payload.username };
  }
}
