import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Header name used for request tracing across services.
 */
export const REQUEST_ID_HEADER = 'X-Request-ID';

/**
 * Middleware that assigns a unique request ID to every incoming HTTP request.
 *
 * - If the client sends an X-Request-ID header, it is reused (useful for
 *   distributed tracing across microservices or frontend correlation).
 * - Otherwise, a new UUIDv4 is generated.
 * - The request ID is set on both the request object (for downstream use)
 *   and the response headers (for client correlation).
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers[REQUEST_ID_HEADER.toLowerCase()] as string) || randomUUID();

    // Attach to request for downstream access (logging, interceptors, etc.)
    (req as any).requestId = requestId;

    // Set on response headers so clients can correlate responses
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
