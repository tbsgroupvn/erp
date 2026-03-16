import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

/**
 * CSRF protection guard that validates Origin/Referer headers
 * for state-changing requests (POST, PUT, PATCH, DELETE).
 *
 * This guard ensures that mutation requests originate from allowed origins,
 * preventing Cross-Site Request Forgery attacks.
 *
 * Skips validation for:
 * - Safe HTTP methods (GET, HEAD, OPTIONS)
 * - Routes marked with @Public() decorator
 * - Requests with valid Bearer token in Authorization header
 *   (Bearer tokens are not automatically sent by browsers, so CSRF is not applicable)
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private readonly allowedOrigins: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.allowedOrigins = this.configService.get<string[]>('app.corsOrigins') || [];
  }

  canActivate(context: ExecutionContext): boolean {
    // GraphQL context (if ever re-enabled) uses Bearer auth, so CSRF does not apply.
    const contextType = context.getType<string>();
    if (contextType === 'graphql') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (!request) {
      return true;
    }
    const { method } = request;

    // Skip safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(method.toUpperCase())) {
      return true;
    }

    // Skip if request has Bearer token (not vulnerable to CSRF)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return true;
    }

    // Check @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Validate Origin or Referer header for cookie-based requests
    const origin = request.headers.origin;
    const referer = request.headers.referer;

    if (origin) {
      if (this.isAllowedOrigin(origin)) {
        return true;
      }
      this.logger.warn(`CSRF blocked: invalid origin ${origin} for ${method} ${request.url}`);
      throw new ForbiddenException('Invalid request origin');
    }

    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (this.isAllowedOrigin(refererOrigin)) {
          return true;
        }
      } catch {
        // Invalid referer URL
      }
      this.logger.warn(`CSRF blocked: invalid referer ${referer} for ${method} ${request.url}`);
      throw new ForbiddenException('Invalid request origin');
    }

    // No Origin or Referer header on a mutation request using cookies
    // This could be a direct API call (allowed) or a CSRF attack
    // Allow if no cookies are present (pure API call)
    const hasCookies = request.headers.cookie && request.headers.cookie.includes('refreshToken');
    if (!hasCookies) {
      return true;
    }

    this.logger.warn(
      `CSRF blocked: missing origin/referer for cookie-based ${method} ${request.url}`,
    );
    throw new ForbiddenException('Missing request origin');
  }

  private isAllowedOrigin(origin: string): boolean {
    return this.allowedOrigins.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        const originUrl = new URL(origin);
        return (
          originUrl.hostname === allowedUrl.hostname && originUrl.protocol === allowedUrl.protocol
        );
      } catch {
        return false;
      }
    });
  }
}
