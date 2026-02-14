/**
 * Sentry Configuration
 *
 * Error tracking and performance monitoring
 * Note: Sentry dependencies are optional. Install @sentry/node and @sentry/profiling-node to enable.
 */
import { INestApplication, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export const initSentry = (_app: INestApplication) => {
  new Logger('SentryConfig').warn('Sentry not configured. Install @sentry/node and @sentry/profiling-node to enable error tracking.');
};

export const sentryErrorHandler = () => {
  return (_req: Request, _res: Response, next: NextFunction) => next();
};

export const sentryRequestHandler = () => {
  return (_req: Request, _res: Response, next: NextFunction) => next();
};

export const sentryTracingHandler = () => {
  return (_req: Request, _res: Response, next: NextFunction) => next();
};
