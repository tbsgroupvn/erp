import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerLimitDetail } from '@nestjs/throttler/dist/throttler.guard.interface';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/exceptions/error-codes';

/**
 * Custom ThrottlerGuard that extends NestJS ThrottlerGuard with:
 * - userId-based tracking for authenticated requests (IP fallback for anonymous)
 * - Retry-After header on 429 responses
 * - DomainException with RATE_LIMIT_EXCEEDED error code
 * - Automatic skip for non-HTTP contexts (WebSocket, RPC)
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Skip throttling for non-HTTP contexts (WebSocket, microservice).
   * HTTP requests proceed to normal throttle checking.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    return super.canActivate(context);
  }

  /**
   * Track by userId for authenticated requests, IP for anonymous.
   * This ensures per-user rate limiting instead of per-IP (which would
   * unfairly aggregate all users behind a shared NAT/proxy).
   */
  async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.id || req.ip;
  }

  /**
   * Throw a DomainException with RATE_LIMIT_EXCEEDED error code
   * and set the Retry-After header for client retry logic.
   */
  async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse();
    const retryAfter = Math.ceil(throttlerLimitDetail.ttl / 1000);
    res.header('Retry-After', String(retryAfter));

    throw new DomainException(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u. Vui l\u00f2ng th\u1eed l\u1ea1i sau ${retryAfter} gi\u00e2y.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
