import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Skip detailed HTTP logging for non-HTTP contexts (e.g. GraphQL)
    if (context.getType<string>() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '-';
    const userId = (request as any).user?.id || 'anonymous';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const duration = Date.now() - startTime;

          this.logger.log(
            `${method} ${url} ${statusCode} - ${duration}ms - ${userId} - ${ip} - ${userAgent}`,
          );

          // Log slow requests as warnings
          if (duration > 3000) {
            this.logger.warn(`Slow request: ${method} ${url} took ${duration}ms - ${userId}`);
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error?.status || 500;

          this.logger.error(
            `${method} ${url} ${statusCode} - ${duration}ms - ${userId} - ${ip} - ${error.message}`,
          );
        },
      }),
    );
  }
}
