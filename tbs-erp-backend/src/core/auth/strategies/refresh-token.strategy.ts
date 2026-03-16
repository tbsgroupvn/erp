import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '@core/database/prisma.service';

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export interface RefreshTokenUser {
  userId: string;
  sessionId: string;
  refreshToken: string;
}

// Custom extractor to read refresh token from HttpOnly cookie
const cookieExtractor = (req: Request): string | null => {
  if (req && req.cookies) {
    return req.cookies['refreshToken'];
  }
  return null;
};

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: cookieExtractor, // Read from HttpOnly cookie instead of body
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.refreshSecret'),
      passReqToCallback: true as const,
    });
  }

  async validate(req: Request, payload: RefreshTokenPayload): Promise<RefreshTokenUser> {
    // Read refresh token from HttpOnly cookie
    const refreshToken = req.cookies?.['refreshToken'];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found in cookies');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Verify user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    // Verify the session exists and matches
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid session');
    }

    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Refresh token has expired');
    }

    return {
      userId: payload.sub,
      sessionId: payload.sessionId,
      refreshToken,
    };
  }
}
