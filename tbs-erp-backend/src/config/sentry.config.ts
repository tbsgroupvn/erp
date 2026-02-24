/**
 * Sentry Configuration
 *
 * Error tracking and performance monitoring.
 * SENTRY_DSN is required in production. Install @sentry/node and @sentry/profiling-node to enable.
 */
import { INestApplication, Logger } from '@nestjs/common';
import { registerAs, ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

const logger = new Logger('SentryConfig');

/** Sensitive field names to strip from event data before sending to Sentry */
const SENSITIVE_FIELDS = [
  'password',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'token',
  'refreshToken',
  'accessToken',
  'secret',
  'authorization',
  'cookie',
  'creditCard',
  'cardNumber',
  'cvv',
];

/**
 * Recursively strip sensitive fields from an object.
 * Returns a shallow copy with sensitive values replaced by '[Filtered]'.
 */
function stripSensitiveData(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => stripSensitiveData(item));
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      cleaned[key] = '[Filtered]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = stripSensitiveData(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export const sentryConfig = registerAs('sentry', () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dsn = process.env.SENTRY_DSN || '';

  // SENTRY_DSN is required in production
  if (nodeEnv === 'production' && !dsn) {
    logger.error(
      'SENTRY_DSN is required in production! Set SENTRY_DSN environment variable.',
    );
    throw new Error('SENTRY_DSN environment variable is required in production.');
  }

  // Determine sample rates by environment
  const isProduction = nodeEnv === 'production';
  const isStaging = nodeEnv === 'staging' || process.env.APP_ENV === 'staging';

  // Traces sample rate: proportion of transactions to capture for performance monitoring.
  // Production: 0.1 (10%) to balance observability with overhead.
  // Staging: 1.0 (100%) for full visibility during testing.
  // Note: Error events are always captured at 100% (Sentry default).
  const tracesSampleRate = process.env.SENTRY_TRACES_SAMPLE_RATE
    ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE)
    : isProduction
      ? 0.1
      : isStaging
        ? 1.0
        : 0.0;

  // Profiles sample rate: proportion of traced transactions to profile.
  // Production: 0.1 (10% of traced transactions) to minimize overhead.
  // Staging: 0.5 (50%) for development insights.
  const profilesSampleRate = process.env.SENTRY_PROFILES_SAMPLE_RATE
    ? parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE)
    : isProduction
      ? 0.1
      : isStaging
        ? 0.5
        : 0.0;

  // Determine release from GIT_SHA or package.json version
  const release =
    process.env.GIT_SHA ||
    process.env.SENTRY_RELEASE ||
    `tbs-erp-backend@${process.env.npm_package_version || '0.1.0'}`;

  return {
    dsn,
    enabled: !!dsn,
    environment: process.env.APP_ENV || nodeEnv,
    tracesSampleRate,
    profilesSampleRate,
    release,
  };
});

/**
 * Initialize Sentry SDK.
 * Attempts dynamic import of @sentry/node; logs a warning if not installed.
 */
export const initSentry = async (app: INestApplication) => {
  const config = app.get(ConfigService);
  const dsn = config.get<string>('sentry.dsn');
  const enabled = config.get<boolean>('sentry.enabled');

  if (!enabled || !dsn) {
    logger.warn(
      'Sentry is disabled. Set SENTRY_DSN to enable error tracking.',
    );
    return;
  }

  try {
    // @ts-ignore
    const Sentry = await import('@sentry/node');

    Sentry.init({
      dsn,
      environment: config.get<string>('sentry.environment'),
      release: config.get<string>('sentry.release'),
      tracesSampleRate: config.get<number>('sentry.tracesSampleRate'),
      profilesSampleRate: config.get<number>('sentry.profilesSampleRate'),
      beforeSend(event: any) {
        // Strip sensitive data from request body
        if (event.request?.data) {
          event.request.data = stripSensitiveData(event.request.data) as Record<string, string>;
        }

        // Strip sensitive headers
        if (event.request?.headers) {
          const headers = { ...event.request.headers };
          delete headers['authorization'];
          delete headers['cookie'];
          delete headers['x-csrf-token'];
          event.request.headers = headers;
        }

        // Strip sensitive data from breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((breadcrumb: any) => {
            if (breadcrumb.data) {
              breadcrumb.data = stripSensitiveData(breadcrumb.data) as Record<string, unknown>;
            }
            return breadcrumb;
          });
        }

        return event;
      },
      integrations: [],
    });

    logger.log(
      `Sentry initialized (env: ${config.get<string>('sentry.environment')}, ` +
      `traces: ${config.get<number>('sentry.tracesSampleRate')}, ` +
      `profiles: ${config.get<number>('sentry.profilesSampleRate')})`,
    );
  } catch {
    logger.warn(
      'Sentry SDK not installed. Install @sentry/node to enable error tracking.',
    );
  }
};

/** Express error handler middleware - captures errors to Sentry */
export const sentryErrorHandler = () => {
  return async (err: Error, _req: Request, _res: Response, next: NextFunction) => {
    try {
      // @ts-ignore
      const Sentry = await import('@sentry/node');
      Sentry.captureException(err);
    } catch {
      // Sentry not available, skip
    }
    next(err);
  };
};

/** Express request handler middleware - noop if Sentry not available */
export const sentryRequestHandler = () => {
  return (_req: Request, _res: Response, next: NextFunction) => next();
};

/** Express tracing handler middleware - noop if Sentry not available */
export const sentryTracingHandler = () => {
  return (_req: Request, _res: Response, next: NextFunction) => next();
};

export { stripSensitiveData };
