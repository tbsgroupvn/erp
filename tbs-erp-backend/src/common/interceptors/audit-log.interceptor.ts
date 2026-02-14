import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuthenticatedRequest } from '@common/interfaces/authenticated-request.interface';
import { PrismaService } from '@core/database/prisma.service';

/**
 * HTTP methods that represent Create, Update, Delete operations.
 * GET/HEAD/OPTIONS are read-only and do not generate audit logs.
 */
const CUD_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Maps HTTP methods to audit log action strings.
 */
function getActionFromMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return method.toUpperCase();
  }
}

/**
 * Extracts the entity name from the request URL.
 * e.g., /api/v1/orders/abc123 -> "Order"
 *       /api/v1/customers -> "Customer"
 */
function extractEntityFromUrl(url: string): string {
  // Remove query string
  const path = url.split('?')[0];
  // Split path segments and find the first meaningful resource name
  const segments = path.split('/').filter(Boolean);

  // Skip common prefixes like 'api', 'v1', etc.
  const prefixes = new Set(['api', 'v1', 'v2']);
  const resourceSegments = segments.filter(
    (s) => !prefixes.has(s.toLowerCase()),
  );

  if (resourceSegments.length === 0) {
    return 'Unknown';
  }

  // Take the first non-ID segment as the entity name
  const resource = resourceSegments[0];
  // Convert to PascalCase singular (simple heuristic: remove trailing 's')
  const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

/**
 * Extracts the entity ID from the URL if present.
 * Assumes patterns like /resource/:id or /resource/:id/sub
 */
function extractEntityIdFromUrl(url: string): string | undefined {
  const path = url.split('?')[0];
  const segments = path.split('/').filter(Boolean);
  const prefixes = new Set(['api', 'v1', 'v2']);
  const resourceSegments = segments.filter(
    (s) => !prefixes.has(s.toLowerCase()),
  );

  // The ID is typically the second segment: /orders/:id
  if (resourceSegments.length >= 2) {
    return resourceSegments[1];
  }
  return undefined;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, ip } = request;

    // Only audit CUD operations
    if (!CUD_METHODS.includes(method.toUpperCase())) {
      return next.handle();
    }

    // Type-safe access to authenticated user
    const authenticatedRequest = request as AuthenticatedRequest;
    const user = authenticatedRequest.user;
    const userId = user?.id;

    // If no authenticated user, skip audit logging
    if (!userId) {
      return next.handle();
    }

    const action = getActionFromMethod(method);
    const entity = extractEntityFromUrl(url);
    const entityId = extractEntityIdFromUrl(url);

    // Capture the request body as "newData" for create/update
    const newData = method.toUpperCase() === 'DELETE' ? null : body || null;

    return next.handle().pipe(
      tap({
        next: async (responseData) => {
          try {
            // For delete operations, the response may contain the deleted record
            const oldData =
              method.toUpperCase() === 'DELETE' ? responseData : null;

            // Determine the actual entity ID from the response if not in URL
            const resolvedEntityId =
              entityId ||
              (responseData &&
              typeof responseData === 'object' &&
              'id' in responseData
                ? String((responseData as { id: unknown }).id)
                : undefined);

            await this.prisma.auditLog.create({
              data: {
                userId,
                action,
                entity,
                entityId: resolvedEntityId || null,
                oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
                newData: newData ? JSON.parse(JSON.stringify(newData)) : null,
                ipAddress: ip || null,
              },
            });
          } catch (error) {
            // Audit logging failures should not break the main request
            this.logger.error(
              `Failed to create audit log: ${error.message}`,
              error.stack,
            );
          }
        },
        error: () => {
          // Do not audit failed operations
        },
      }),
    );
  }
}
