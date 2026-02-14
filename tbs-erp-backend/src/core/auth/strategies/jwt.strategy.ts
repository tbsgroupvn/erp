import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole, Branch } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  branch: Branch | null;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  branch: Branch | null;
  sessionId: string;
  leaderId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, role: true, branch: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    // Verify the session is still valid
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: { id: true, expiresAt: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session has expired or been revoked');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      branch: payload.branch,
      sessionId: payload.sessionId,
      leaderId: null,
    };
  }
}
