import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ErrorCode } from '../exceptions/error-codes';
import { StandardErrorResponse } from '../exceptions/error-response.interface';

/**
 * Global exception filter that captures unhandled exceptions to Sentry.
 *
 * Behavior:
 * - For HttpException: captures to Sentry (if 5xx), then re-throws for HttpExceptionFilter
 * - For PrismaClientKnownRequestError / PrismaClientValidationError: re-throws for PrismaExceptionFilter
 * - For ALL OTHER unknown exceptions: captures to Sentry, formats 500 response directly
 * - Strips sensitive headers (Authorization, Cookie) before sending to Sentry
 * - Adds user context (userId, role) and requestId to Sentry scope
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
    const response = ctx.getResponse<Response>();
    const requestId = (request as any).requestId || 'unknown';

    // HttpException: capture 5xx to Sentry, then re-throw for HttpExceptionFilter
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        await this.captureToSentry(exception, request, requestId);
      }
      throw exception;
    }

    // PrismaClientKnownRequestError / PrismaClientValidationError: re-throw for PrismaExceptionFilter
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientValidationError
    ) {
      await this.captureToSentry(exception, request, requestId);
      throw exception;
    }

    // Unknown exception: capture to Sentry, format 500 response directly
    await this.captureToSentry(exception, request, requestId);

    this.logger.error(
      `[${requestId}] Unhandled exception: ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const errorResponse: StandardErrorResponse = {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCode.INTERNAL_ERROR,
      message: 'An internal server error occurred',
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  }

  private async captureToSentry(
    exception: unknown,
    request: Request,
    requestId: string,
  ): Promise<void> {
    try {
      const Sentry = await this.getSentry();
      if (!Sentry) return;

      Sentry.withScope((scope: any) => {
        // Add requestId tag for correlation
        scope.setTag('requestId', requestId);

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
            `Non-Error exception: ${this.sanitizeForSentry(exception)}`,
            'error',
          );
        }
      });
    } catch (captureError) {
      this.logger.debug(`Failed to capture exception to Sentry: ${captureError}`);
    }
  }

  private async getSentry(): Promise<any> {
    if (this.sentryModule) return this.sentryModule;
    if (this.sentryLoadAttempted) return null;

    this.sentryLoadAttempted = true;
    try {
      // @ts-expect-error @sentry/node may not be installed
      this.sentryModule = await import('@sentry/node');
      return this.sentryModule;
    } catch {
      return null;
    }
  }

  private sanitizeForSentry(obj: unknown): string {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'authorization',
      'cookie',
      'creditCard',
      'ssn',
      'apiKey',
      'refreshToken',
      'accessToken',
    ];
    const str = JSON.stringify(obj, (key, value) => {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
        return '[REDACTED]';
      }
      return value;
    });
    return str.substring(0, 2000); // Truncate to prevent excessive data
  }

  private stripSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
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
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
        cleaned[key] = '[Filtered]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        cleaned[key] = this.stripSensitiveFields(value as Record<string, unknown>);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
}
