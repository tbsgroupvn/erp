import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Global exception filter that captures unhandled exceptions to Sentry.
 *
 * Behavior:
 * - Only sends 5xx errors to Sentry (skips 4xx client errors)
 * - Strips sensitive headers (Authorization, Cookie) before sending
 * - Adds user context (userId, role) to Sentry scope
 * - Falls back gracefully if @sentry/node is not installed
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);
  private sentryModule: any = null;
  private sentryLoadAttempted = false;

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    // Determine HTTP status
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Only capture 5xx server errors to Sentry
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      await this.captureToSentry(exception, request);
    }

    // Re-throw so other filters (HttpExceptionFilter, PrismaExceptionFilter) handle the response
    throw exception;
  }

  private async captureToSentry(
    exception: unknown,
    request: Request,
  ): Promise<void> {
    try {
      const Sentry = await this.getSentry();
      if (!Sentry) return;

      Sentry.withScope((scope: any) => {
        // Add user context if available
        const user = (request as any).user as
          | { id?: string; userId?: string; role?: string; email?: string }
          | undefined;
        if (user) {
          scope.setUser({
            id: user.id || user.userId,
            email: user.email,
          });
          if (user.role) {
            scope.setTag('user.role', user.role);
          }
        }

        // Add request context (strip sensitive headers)
        scope.setTag('url', request.url);
        scope.setTag('method', request.method);
        scope.setExtra('query', request.query);

        // Sanitize and attach headers
        const safeHeaders = { ...request.headers };
        delete safeHeaders['authorization'];
        delete safeHeaders['cookie'];
        delete safeHeaders['x-csrf-token'];
        delete safeHeaders['x-api-key'];
        scope.setExtra('headers', safeHeaders);

        // Add request body (strip sensitive fields)
        if (request.body && typeof request.body === 'object') {
          const safeBody = this.stripSensitiveFields(request.body);
          scope.setExtra('body', safeBody);
        }

        // Add IP and user agent
        const ip = request.ip || request.headers['x-forwarded-for'];
        if (ip) {
          scope.setTag('ip', Array.isArray(ip) ? ip[0] : ip);
        }

        // Capture the exception
        if (exception instanceof Error) {
          Sentry.captureException(exception);
        } else {
          Sentry.captureMessage(
            `Non-Error exception: ${JSON.stringify(exception)}`,
            'error',
          );
        }
      });
    } catch (captureError) {
      this.logger.debug(
        `Failed to capture exception to Sentry: ${captureError}`,
      );
    }
  }

  private async getSentry(): Promise<any> {
    if (this.sentryModule) return this.sentryModule;
    if (this.sentryLoadAttempted) return null;

    this.sentryLoadAttempted = true;
    try {
      // @ts-ignore
      this.sentryModule = await import('@sentry/node');
      return this.sentryModule;
    } catch {
      return null;
    }
  }

  private stripSensitiveFields(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'newPassword',
      'oldPassword',
      'confirmPassword',
      'token',
      'refreshToken',
      'accessToken',
      'secret',
      'creditCard',
      'cardNumber',
      'cvv',
    ];

    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (
        sensitiveKeys.some((sk) =>
          key.toLowerCase().includes(sk.toLowerCase()),
        )
      ) {
        cleaned[key] = '[Filtered]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        cleaned[key] = this.stripSensitiveFields(
          value as Record<string, unknown>,
        );
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
}
