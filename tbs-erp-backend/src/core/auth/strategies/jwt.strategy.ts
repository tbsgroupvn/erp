import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole, Branch } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  branch: Branch | null;
  hasSaleCode?: boolean;
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
  hasSaleCode: boolean;
  sessionId: string;
  leaderId: string | null;
  impersonatedBy?: string;
  isImpersonation?: boolean;
  impersonationLogId?: string;
}

/** TTL for JWT session cache entries: 2 minutes (security-sensitive). */
const JWT_SESSION_CACHE_TTL_MS = 120_000;

/**
 * Build the Redis cache key for a validated JWT session.
 *
 * Scoped to both userId and sessionId so that single-session logout can
 * invalidate just the one key, while logoutAll can wipe the user prefix.
 *
 * Example: `jwt-session:clxabc123:sess_xyz789`
 */
export function jwtSessionCacheKey(userId: string, sessionId: string): string {
  return `jwt-session:${userId}:${sessionId}`;
}

/**
 * Build the prefix used by logoutAll / password reset to wipe all sessions
 * for a single user in one `delByPrefix` call.
 *
 * Example: `jwt-session:clxabc123:`
 */
export function jwtSessionCachePrefix(userId: string): string {
  return `jwt-session:${userId}:`;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid token subject');
    }

    // Handle impersonation tokens — these are short-lived and not cached
    // because the admin's active state must always be checked in real-time.
    if (payload.isImpersonation && payload.impersonatedBy) {
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
        hasSaleCode: payload.hasSaleCode ?? false,
        sessionId: payload.impersonationLogId || '',
        leaderId: null,
        impersonatedBy: payload.impersonatedBy,
        isImpersonation: true,
        impersonationLogId: payload.impersonationLogId,
      };
    }

    // -----------------------------------------------------------------
    // Fast path: Redis cache hit
    // -----------------------------------------------------------------
    const sessionId = payload.sessionId ?? '';
    const cacheKey = jwtSessionCacheKey(payload.sub, sessionId);

    const cached = await this.cacheService.get<AuthenticatedUser>(cacheKey);
    if (cached !== undefined) {
      this.logger.debug(`JWT session cache HIT for user ${payload.sub}`);
      return cached;
    }

    // -----------------------------------------------------------------
    // Slow path: DB validation (cache miss or Redis unavailable)
    // -----------------------------------------------------------------
    this.logger.debug(`JWT session cache MISS for user ${payload.sub} — querying DB`);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, role: true, branch: true, leaderId: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    // Verify the session is still valid
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session has expired or been revoked');
    }

    // Verify session belongs to the user from the token
    if (session.userId !== payload.sub) {
      throw new UnauthorizedException('Session does not belong to the authenticated user');
    }

    const authenticatedUser: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email,
      role: user.role,
      branch: user.branch,
      hasSaleCode: payload.hasSaleCode ?? false,
      sessionId,
      leaderId: user.leaderId,
    };

    // Cache the result for subsequent requests within the TTL window.
    // CacheService.set() swallows Redis errors — if Redis is down we simply
    // skip caching and fall through to the DB on the next request (graceful
    // degradation; no exception is thrown here).
    await this.cacheService.set(cacheKey, authenticatedUser, JWT_SESSION_CACHE_TTL_MS);

    return authenticatedUser;
  }
}
