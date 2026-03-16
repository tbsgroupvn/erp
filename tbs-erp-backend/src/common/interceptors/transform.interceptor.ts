import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TransformedResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Wraps all successful responses in a standard envelope:
 * { success: true, data: <original response> }
 *
 * If the response already has a `success` property (e.g., from BaseResponse),
 * it is returned as-is to avoid double-wrapping.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, TransformedResponse<T> | T> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<TransformedResponse<T> | T> {
    // GraphQL has its own response format; skip REST envelope wrapping
    if (context.getType<string>() !== 'http') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // If the response already follows our standard format, pass through
        if (data !== null && data !== undefined && typeof data === 'object' && 'success' in data) {
          return data;
        }

        return {
          success: true,
          data,
        };
      }),
    );
  }
}
