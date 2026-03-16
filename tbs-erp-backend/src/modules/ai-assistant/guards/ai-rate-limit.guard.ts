import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CacheService } from '@core/cache/cache.service';

// Role duoc gioi han cao hon (100 req/gio thay vi 30)
const HIGH_LIMIT_ROLES = ['CEO', 'COO', 'CFO'];

// Gioi han mac dinh
const DEFAULT_HOURLY_LIMIT = 30;
const HIGH_HOURLY_LIMIT = 100;
const MINUTE_LIMIT = 5;
const HIGH_MINUTE_LIMIT = 20;

// TTL (mili giay)
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * AiRateLimitGuard — Kiem soat tan suat goi cac endpoint AI.
 *
 * Chinh sach:
 * - Role thuong (SALE, CSKH, ...): 30 req/gio, 5 req/phut
 * - Role cap cao (CEO, COO, CFO): 100 req/gio, 20 req/phut
 *
 * Redis keys:
 *   ai-rate:{userId}:hour  — dem theo gio, TTL 1 gio
 *   ai-rate:{userId}:min   — dem theo phut, TTL 1 phut
 *
 * Response headers:
 *   X-RateLimit-Remaining — so request con lai trong gio hien tai
 *   X-RateLimit-Reset     — thoi diem reset (epoch seconds)
 */
@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AiRateLimitGuard.name);

  constructor(private readonly cache: CacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const user = request.user as { id?: string; role?: string } | undefined;

    // Neu chua xac thuc, bo qua (JwtAuthGuard xu ly truoc)
    if (!user?.id) {
      return true;
    }

    const userId = user.id;
    const userRole = user.role || '';
    const isHighLimit = HIGH_LIMIT_ROLES.includes(userRole);

    const hourlyLimit = isHighLimit ? HIGH_HOURLY_LIMIT : DEFAULT_HOURLY_LIMIT;
    const minuteLimit = isHighLimit ? HIGH_MINUTE_LIMIT : MINUTE_LIMIT;

    const hourKey = `ai-rate:${userId}:hour`;
    const minKey = `ai-rate:${userId}:min`;

    // Lay dem hien tai tu Redis
    const [hourCount, minCount] = await Promise.all([
      this.cache.get<number>(hourKey).then((v) => v ?? 0),
      this.cache.get<number>(minKey).then((v) => v ?? 0),
    ]);

    // Tinh thoi diem reset (dau gio tiep theo)
    const now = Date.now();
    const resetEpochSeconds = Math.ceil(now / HOUR_MS) * (HOUR_MS / 1000);
    const remaining = Math.max(0, hourlyLimit - hourCount - 1);

    // Set headers truoc khi co the throw
    response.setHeader('X-RateLimit-Remaining', remaining.toString());
    response.setHeader('X-RateLimit-Reset', resetEpochSeconds.toString());

    // Kiem tra gioi han theo phut truoc
    if (minCount >= minuteLimit) {
      this.logger.warn(`AI rate limit (per-minute) vuot qua cho user=${userId} role=${userRole}: ${minCount}/${minuteLimit}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Qua nhieu yeu cau. Toi da ${minuteLimit} yeu cau/phut. Vui long cho 1 phut roi thu lai.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Kiem tra gioi han theo gio
    if (hourCount >= hourlyLimit) {
      this.logger.warn(`AI rate limit (per-hour) vuot qua cho user=${userId} role=${userRole}: ${hourCount}/${hourlyLimit}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Qua nhieu yeu cau. Toi da ${hourlyLimit} yeu cau/gio. Vui long thu lai sau.`,
          error: 'Too Many Requests',
          resetAt: resetEpochSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Tang dem (non-blocking, cho phep gap loi Redis)
    this.incrementCounters(hourKey, minKey, hourCount, minCount).catch((err) =>
      this.logger.error(`Khong the cap nhat AI rate counter cho user=${userId}: ${err.message}`),
    );

    return true;
  }

  private async incrementCounters(
    hourKey: string,
    minKey: string,
    currentHour: number,
    currentMin: number,
  ): Promise<void> {
    await Promise.all([
      this.cache.set<number>(hourKey, currentHour + 1, HOUR_MS),
      this.cache.set<number>(minKey, currentMin + 1, MINUTE_MS),
    ]);
  }
}
