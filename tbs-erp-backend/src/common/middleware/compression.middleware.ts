import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as zlib from 'zlib';

/**
 * Response compression middleware that supports:
 * 1. Brotli compression (preferred, best compression ratio)
 * 2. Gzip fallback for older clients
 * 3. Minimum size threshold to avoid compressing tiny payloads
 * 4. Content-type filtering to skip binary formats
 *
 * Note: This middleware is designed to work alongside nginx gzip.
 * When behind nginx with gzip enabled, this provides Brotli support
 * that nginx's open-source version does not include by default.
 *
 * Usage in main.ts:
 *   import compression from 'compression';
 *   app.use(compression({ threshold: 1024 }));
 *
 * This file provides an alternative NestJS middleware implementation
 * for more fine-grained control.
 */

/** Minimum response size in bytes to apply compression */
const MIN_COMPRESSION_SIZE = 1024;

/** Content types that should be compressed */
const COMPRESSIBLE_TYPES = [
  'text/html',
  'text/plain',
  'text/css',
  'text/xml',
  'text/javascript',
  'application/json',
  'application/javascript',
  'application/xml',
  'application/xml+rss',
  'application/atom+xml',
  'image/svg+xml',
];

@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Determine best encoding
    let encoding: 'br' | 'gzip' | null = null;
    if (acceptEncoding.includes('br')) {
      encoding = 'br';
    } else if (acceptEncoding.includes('gzip')) {
      encoding = 'gzip';
    }

    if (!encoding) {
      return next();
    }

    // Store original write and end methods
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    const chunks: Buffer[] = [];
    let totalLength = 0;

    // Override write to buffer the response
    res.write = function (chunk: any, ...args: any[]): boolean {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buffer);
      totalLength += buffer.length;
      return true;
    } as any;

    // Override end to compress and send
    res.end = function (chunk?: any, ...args: any[]): Response {
      if (chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buffer);
        totalLength += buffer.length;
      }

      const body = Buffer.concat(chunks);

      // Check if compression is worthwhile
      const contentType = res.getHeader('content-type')?.toString() || '';
      const isCompressible = COMPRESSIBLE_TYPES.some((type) =>
        contentType.includes(type),
      );

      if (!isCompressible || body.length < MIN_COMPRESSION_SIZE) {
        res.setHeader('Content-Length', body.length);
        return originalEnd(body);
      }

      // Already compressed by upstream (nginx)
      if (res.getHeader('content-encoding')) {
        return originalEnd(body);
      }

      // Compress based on accepted encoding
      try {
        let compressed: Buffer;

        if (encoding === 'br') {
          compressed = zlib.brotliCompressSync(body, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 4, // Fast compression
            },
          });
        } else {
          compressed = zlib.gzipSync(body, { level: 6 });
        }

        res.setHeader('Content-Encoding', encoding);
        res.setHeader('Content-Length', compressed.length);
        res.removeHeader('Content-Length'); // Remove original, let Transfer-Encoding handle it
        res.setHeader('Vary', 'Accept-Encoding');

        return originalEnd(compressed);
      } catch {
        // Fallback to uncompressed on error
        res.setHeader('Content-Length', body.length);
        return originalEnd(body);
      }
    } as any;

    next();
  }
}

/**
 * Helper function to configure the `compression` npm package for use in main.ts.
 * This is the recommended approach as it's more battle-tested than custom middleware.
 *
 * Usage:
 *   import compression from 'compression';
 *   app.use(compression(getCompressionOptions()));
 */
export function getCompressionOptions() {
  return {
    // Only compress responses larger than 1KB
    threshold: MIN_COMPRESSION_SIZE,

    // Compression level (1-9, higher = better compression, slower)
    level: 6,

    // Filter function to decide which responses to compress
    filter: (req: Request, res: Response): boolean => {
      const contentType = res.getHeader('content-type')?.toString() || '';

      // Skip if client requested no transformation
      if (req.headers['cache-control']?.includes('no-transform')) {
        return false;
      }

      // Compress text-based content types
      return COMPRESSIBLE_TYPES.some((type) => contentType.includes(type));
    },
  };
}
