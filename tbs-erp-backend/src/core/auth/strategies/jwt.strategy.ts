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
  sessionId?: string;
  impersonatedBy?: string;
  isImpersonation?: boolean;
  impersonationLogId?: string;
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
  impersonatedBy?: string;
  isImpersonation?: boolean;
  impersonationLogId?: string;
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
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid token subject');
    }

    // Handle impersonation tokens
    if (payload.isImpersonation && payload.impersonatedBy) {
      // Validate the admin user who initiated impersonation
      const adminUser = await this.prisma.user.findUnique({
        where: { id: payload.impersonatedBy },
        select: { id: true, isActive: true, role: true, branch: true },
      });

      if (!adminUser || !adminUser.isActive) {
        throw new UnauthorizedException('Impersonating admin user is inactive or not found');
      }

      return {
        id: payload.sub,
        email: payload.email,
        role: adminUser.role,
        branch: adminUser.branch,
        sessionId: payload.impersonationLogId || '',
        leaderId: null,
        impersonatedBy: payload.impersonatedBy,
        isImpersonation: true,
        impersonationLogId: payload.impersonationLogId,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, role: true, branch: true, leaderId: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    // Verify the session is still valid
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session has expired or been revoked');
    }

    // Verify session belongs to the user from the token
    if (session.userId !== payload.sub) {
      throw new UnauthorizedException('Session does not belong to the authenticated user');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: user.role,
      branch: user.branch,
      sessionId: payload.sessionId ?? '',
      leaderId: user.leaderId,
    };
  }
}
