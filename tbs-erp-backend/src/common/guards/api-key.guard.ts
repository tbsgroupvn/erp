import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';

/**
 * API Key Guard — Authenticates external integration partners using API keys.
 *
 * API keys are passed in the X-API-Key header. The guard:
 *   1. Extracts the key from the request header
 *   2. Hashes it with SHA-256 (keys are stored as hashes in the database)
 *   3. Looks up the ApiKey record (with Redis caching for performance)
 *   4. Validates: exists, is active, not expired, rate limit not exceeded
 *   5. Checks endpoint permissions against the requested route
 *   6. Updates lastUsedAt and lastUsedIp
 *
 * Rate limiting uses a sliding window counter in Redis:
 *   Key: api_key_rate:{prefix}
 *   TTL: 1 hour
 *   Limit: Configurable per API key (default 1000 req/hour)
 *
 * Usage:
 *   @UseGuards(ApiKeyGuard)
 *   @Get('external/orders')
 *   async getOrders() { ... }
 *
 * Or combine with JWT for endpoints that accept both:
 *   @UseGuards(JwtOrApiKeyGuard)
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    // Hash the key for lookup
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const prefix = apiKey.substring(0, 8);

    // Try cache first (cache key record for 5 minutes)
    const cacheKey = `api_key:${keyHash}`;
    let apiKeyRecord = await this.cacheService.get<any>(cacheKey);

    if (!apiKeyRecord) {
      apiKeyRecord = await this.prisma.apiKey.findUnique({
        where: { key: keyHash },
      });

      if (apiKeyRecord) {
        await this.cacheService.set(cacheKey, apiKeyRecord, 300); // 5 min TTL
      }
    }

    if (!apiKeyRecord) {
      this.logger.warn(`Invalid API key attempted: ${prefix}...`);
      throw new UnauthorizedException('Invalid API key');
    }

    // Check if active
    if (!apiKeyRecord.isActive) {
      throw new UnauthorizedException('API key is deactivated');
    }

    // Check expiry
    if (apiKeyRecord.expiresAt && new Date(apiKeyRecord.expiresAt) < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Check rate limit using Redis sliding window
    const rateLimitKey = `api_key_rate:${prefix}`;
    const currentCount = await this.cacheService.get<number>(rateLimitKey);
    const limit = apiKeyRecord.rateLimit || 1000;

    const currentCountVal = currentCount ?? 0;
    if (currentCountVal >= limit) {
      this.logger.warn(`Rate limit exceeded for API key: ${prefix} (${currentCountVal}/${limit})`);
      throw new UnauthorizedException(
        `Rate limit exceeded. Maximum ${limit} requests per hour.`,
      );
    }

    // Increment rate counter
    if (currentCount === null) {
      await this.cacheService.set(rateLimitKey, 1, 3600); // 1 hour TTL
    } else {
      await this.cacheService.set(rateLimitKey, currentCountVal + 1, 3600);
    }

    // Check endpoint permissions
    const route = request.route?.path || request.url;
    const method = request.method;
    if (apiKeyRecord.permissions && apiKeyRecord.permissions.length > 0) {
      const hasPermission = this.checkPermission(apiKeyRecord.permissions, route, method);
      if (!hasPermission) {
        this.logger.warn(
          `API key ${prefix} lacks permission for ${method} ${route}`,
        );
        throw new UnauthorizedException(
          'API key does not have permission for this endpoint',
        );
      }
    }

    // Update usage tracking (non-blocking)
    const clientIp = request.ip || request.connection?.remoteAddress;
    this.prisma.apiKey
      .update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date(), lastUsedIp: clientIp },
      })
      .catch((err) => this.logger.error(`Failed to update API key usage: ${err.message}`));

    // Attach API key info to request for downstream use
    request.apiKey = {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      prefix: apiKeyRecord.prefix,
      permissions: apiKeyRecord.permissions,
    };

    return true;
  }

  /**
   * Check if the API key's permissions allow access to the given route.
   *
   * Permission format: "resource:action" or "resource:*"
   * Examples: "orders:read", "webhooks:*", "*:*"
   *
   * Route matching is simplified — it checks if any permission pattern
   * matches the route path.
   */
  private checkPermission(
    permissions: string[],
    route: string,
    method: string,
  ): boolean {
    // Wildcard permission
    if (permissions.includes('*:*') || permissions.includes('*')) {
      return true;
    }

    // Map HTTP methods to action names
    const actionMap: Record<string, string> = {
      GET: 'read',
      POST: 'write',
      PUT: 'write',
      PATCH: 'write',
      DELETE: 'delete',
    };
    const action = actionMap[method] || 'read';

    // Extract resource from route (e.g., /api/v1/orders -> orders)
    const routeParts = route.replace(/^\/api\/v[0-9]+\//, '').split('/');
    const resource = routeParts[0] || '';

    for (const perm of permissions) {
      const [permResource, permAction] = perm.split(':');
      if (
        (permResource === resource || permResource === '*') &&
        (permAction === action || permAction === '*')
      ) {
        return true;
      }
    }

    return false;
  }
}
