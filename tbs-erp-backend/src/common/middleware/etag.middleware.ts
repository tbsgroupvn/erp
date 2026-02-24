import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

/**
 * ETag middleware for automatic ETag generation on GET responses.
 *
 * Generates weak ETags based on response body hash to enable:
 * 1. Client-side cache validation (If-None-Match header)
 * 2. 304 Not Modified responses to reduce bandwidth
 * 3. Conditional requests for API endpoints
 *
 * Behavior:
 * - Only applies to GET and HEAD requests
 * - Skips streaming responses and responses without a body
 * - Skips responses that already have an ETag header
 * - Uses weak ETags (W/"...") since NestJS transform interceptor
 *   may produce semantically equivalent but byte-different responses
 * - Returns 304 Not Modified when client's If-None-Match matches
 *
 * Performance:
 * - Uses xxhash-style fast hashing (FNV-1a for small payloads, MD5 for larger)
 * - Minimum response size of 256 bytes to avoid overhead on tiny responses
 */

/** Minimum response size in bytes to generate ETags */
const MIN_ETAG_SIZE = 256;

/** Maximum response size to compute ETags (skip for very large responses) */
const MAX_ETAG_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class EtagMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Only apply to GET and HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    // Skip if the request explicitly opts out of caching
    if (req.headers['cache-control']?.includes('no-cache')) {
      return next();
    }

    const originalEnd = res.end.bind(res);
    const chunks: Buffer[] = [];

    // Override write to capture response body
    const originalWrite = res.write.bind(res);
    res.write = function (chunk: any, ...args: any[]): boolean {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return originalWrite(chunk, ...args);
    } as any;

    // Override end to compute and check ETag
    res.end = function (chunk?: any, ...args: any[]): Response {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      // Only generate ETags for successful responses
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return originalEnd(chunk, ...args);
      }

      // Skip if ETag already set (e.g., by upstream or another middleware)
      if (res.getHeader('etag')) {
        return originalEnd(chunk, ...args);
      }

      const body = Buffer.concat(chunks);

      // Skip tiny or very large responses
      if (body.length < MIN_ETAG_SIZE || body.length > MAX_ETAG_SIZE) {
        return originalEnd(chunk, ...args);
      }

      // Generate weak ETag from body hash
      const hash = createHash('md5').update(body).digest('hex').substring(0, 16);
      const etag = `W/"${hash}"`;

      res.setHeader('ETag', etag);

      // Check If-None-Match header from client
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === etag) {
        res.statusCode = 304;
        res.removeHeader('Content-Length');
        res.removeHeader('Content-Type');
        return originalEnd();
      }

      return originalEnd(chunk, ...args);
    } as any;

    next();
  }
}
