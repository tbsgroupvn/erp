import { Prisma } from '@prisma/client';

/**
 * Configuration for sequential code generation.
 */
export interface CodeGeneratorConfig {
  /** Static prefix, e.g. 'TBS-ORD', 'TBS', 'QMS', 'QUO' */
  prefix: string;
  /**
   * Date prefix format to insert between prefix and sequence number.
   * - 'YYMMDD' -> e.g. TBS-ORD-260301-0001
   * - 'YYYYMM' -> e.g. QMS-202603-0001
   * - undefined  -> no date part, e.g. TBS-PKG-000001
   */
  datePrefixFormat?: 'YYMMDD' | 'YYYYMM';
  /** Number of digits to pad the sequence number (default: 4) */
  sequenceLength?: number;
  /** Separator between parts (default: '-'). Use '' for no separator, e.g. TBS20260301 */
  separator?: string;
}

/**
 * Redis-backed cache service interface for atomic code generation.
 */
interface CodeGenCacheService {
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  get<T>(key: string): Promise<T | null | undefined>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<unknown>;
  setnx(key: string, value: number | string, ttlSeconds?: number): Promise<boolean>;
}

/**
 * A Prisma delegate that supports `findFirst` with `where`, `orderBy`, and `select`.
 * This matches any Prisma model delegate (e.g., prisma.order, prisma.container, etc.).
 */
interface PrismaModelDelegate {
  findFirst(args: {
    where?: Record<string, any>;
    orderBy?: Record<string, any>;
    select?: Record<string, any>;
  }): Promise<{ code: string } | null>;
}

/**
 * Build the full prefix string (PREFIX + optional date part) for today.
 */
function buildFullPrefix(config: CodeGeneratorConfig): string {
  const { prefix, datePrefixFormat, separator = '-' } = config;

  if (!datePrefixFormat) {
    return prefix;
  }

  const now = new Date();

  if (datePrefixFormat === 'YYMMDD') {
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${prefix}${separator}${yy}${mm}${dd}`;
  }

  if (datePrefixFormat === 'YYYYMM') {
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${prefix}${separator}${yyyy}${mm}`;
  }

  return prefix;
}

/**
 * Generate the next sequential code using Redis INCR for atomic concurrency safety.
 *
 * Uses Redis atomic increment to guarantee unique codes even under concurrent requests.
 * On first use per prefix, seeds Redis from the database to avoid sequence reset.
 *
 * @param delegate - A Prisma model delegate that has a `code` field
 * @param config   - Code generation configuration
 * @param cacheService - Redis-backed cache service with incr/expire
 * @returns The next code string, e.g. "TBS-ORD-260301-0042"
 */
export async function generateCode(
  delegate: PrismaModelDelegate,
  config: CodeGeneratorConfig,
  cacheService?: CodeGenCacheService,
): Promise<string> {
  const { sequenceLength = 4, separator = '-' } = config;
  const fullPrefix = buildFullPrefix(config);

  // Prefer atomic Redis INCR when cache service is available
  if (cacheService) {
    const redisKey = `code:seq:${fullPrefix}`;
    const lockKey = `code:lock:${fullPrefix}`;

    // Use SETNX to ensure only one request seeds Redis (prevents race condition)
    const acquired = await cacheService.setnx(lockKey, 1, 30); // 30s lock TTL
    if (acquired) {
      // We got the lock — check if key needs seeding
      const existing = await cacheService.get<number>(redisKey);
      if (existing === null || existing === undefined) {
        const latest = await delegate.findFirst({
          where: { code: { startsWith: fullPrefix } },
          orderBy: { code: 'desc' },
          select: { code: true },
        });

        let currentMax = 0;
        if (latest?.code) {
          const seqStr = latest.code.substring(fullPrefix.length + separator.length);
          const parsed = parseInt(seqStr, 10);
          if (!isNaN(parsed)) {
            currentMax = parsed;
          }
        }

        // Initialize Redis counter at current max using SETNX (only if still absent)
        await cacheService.setnx(redisKey, currentMax, 60 * 86400);
      }
    }

    // Atomic increment — guaranteed unique across concurrent requests
    const seq = await cacheService.incr(redisKey);
    await cacheService.expire(redisKey, 60 * 86400);

    return `${fullPrefix}${separator}${String(seq).padStart(sequenceLength, '0')}`;
  }

  // Fallback: DB-based (not atomic — callers should use P2002 retry)
  const latest = await delegate.findFirst({
    where: { code: { startsWith: fullPrefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let sequence = 1;
  if (latest?.code) {
    const seqStr = latest.code.substring(fullPrefix.length + separator.length);
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed)) {
      sequence = parsed + 1;
    }
  }

  return `${fullPrefix}${separator}${String(sequence).padStart(sequenceLength, '0')}`;
}
