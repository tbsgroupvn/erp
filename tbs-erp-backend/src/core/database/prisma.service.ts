import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Extended PrismaService with performance monitoring.
 *
 * In production, query events are enabled to detect slow queries (>200ms).
 * For fine-grained per-model/operation tracking via Prisma extensions,
 * see `prisma-performance.extension.ts` which provides a `createPerformanceExtension()`
 * function that records all query durations to Prometheus.
 */
@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error' | 'warn'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    const isDev = configService.get<string>('app.env', 'development') === 'development';

    super({
      datasources: {
        db: {
          url: configService.get<string>('database.url'),
        },
      },
      // Enable query events in all environments for performance monitoring
      log: isDev
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ],
    });

    if (isDev) {
      // In development, log all queries for debugging
      this.$on('query', (event: Prisma.QueryEvent) => {
        this.logger.debug(
          `Query: ${event.query} — Params: ${event.params} — Duration: ${event.duration}ms`,
        );
      });
    } else {
      // In production, only log slow queries (>200ms)
      this.$on('query', (event: Prisma.QueryEvent) => {
        if (event.duration > 2000) {
          this.logger.error(
            `CRITICAL slow query (${event.duration}ms): ${event.query.substring(0, 200)}`,
          );
        } else if (event.duration > 200) {
          this.logger.warn(`Slow query (${event.duration}ms): ${event.query.substring(0, 200)}`);
        }
      });
    }

    this.$on('error', (event: Prisma.LogEvent) => {
      this.logger.error(`Prisma error: ${event.message}`);
    });

    this.$on('warn', (event: Prisma.LogEvent) => {
      this.logger.warn(`Prisma warning: ${event.message}`);
    });
  }

  private _isHealthy = true;

  get isHealthy(): boolean {
    return this._isHealthy;
  }

  /**
   * Quick health check - runs a simple query to verify DB connectivity.
   * Called by health indicators and monitoring.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      if (!this._isHealthy) {
        this.logger.log('Database connection restored.');
      }
      this._isHealthy = true;
      return true;
    } catch (error) {
      this._isHealthy = false;
      this.logger.error(`Database health check failed: ${error.message}`);
      return false;
    }
  }

  private static readonly MAX_CONNECTION_RETRIES = 5;
  private static readonly RETRY_DELAY_MS = 3000;

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');

    for (let attempt = 1; attempt <= PrismaService.MAX_CONNECTION_RETRIES; attempt++) {
      try {
        const timeout = setTimeout(() => {
          this.logger.error(`Database connection timed out after 30s (attempt ${attempt})`);
        }, 30000);

        try {
          await this.$connect();
          this.logger.log('Database connection established.');
          return;
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        const isLastAttempt = attempt === PrismaService.MAX_CONNECTION_RETRIES;
        this.logger.error(
          `Database connection failed (attempt ${attempt}/${PrismaService.MAX_CONNECTION_RETRIES}): ${error.message}`,
        );

        if (isLastAttempt) {
          this.logger.error(
            'All database connection attempts exhausted. Application cannot start.',
          );
          throw new Error(
            `Failed to connect to database after ${PrismaService.MAX_CONNECTION_RETRIES} attempts: ${error.message}`,
          );
        }

        this.logger.log(`Retrying database connection in ${PrismaService.RETRY_DELAY_MS}ms...`);
        await new Promise((resolve) => setTimeout(resolve, PrismaService.RETRY_DELAY_MS));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database connection closed.');
  }

  /**
   * Helper for transactions with automatic retries on serialization failures.
   */
  async executeInTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await this.$transaction(fn);
      } catch (error) {
        // Detect connection-level errors and mark DB as unhealthy
        if (
          error instanceof Prisma.PrismaClientInitializationError ||
          error instanceof Prisma.PrismaClientRustPanicError
        ) {
          this._isHealthy = false;
          this.logger.error(`Database connection lost during transaction: ${error.message}`);
          throw new InternalServerErrorException('Database temporarily unavailable');
        }

        attempt++;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || error.code === 'P2035') &&
          attempt < maxRetries
        ) {
          this.logger.warn(
            `Transaction serialization failure, retrying (${attempt}/${maxRetries})...`,
          );
          continue;
        }
        throw error;
      }
    }
    throw new InternalServerErrorException('Transaction failed after maximum retries');
  }

  /**
   * Convenience wrapper for cleaning the database during tests.
   */
  async cleanDatabase(): Promise<void> {
    if (this.configService.get<string>('app.env') === 'production') {
      throw new ForbiddenException('cleanDatabase cannot be called in production');
    }

    const tablenames = Reflect.ownKeys(this).filter(
      (key) =>
        typeof key === 'string' &&
        !key.startsWith('_') &&
        !key.startsWith('$') &&
        typeof (this as any)[key]?.deleteMany === 'function',
    ) as string[];

    await this.$transaction(tablenames.map((table) => (this as any)[table].deleteMany()));
  }
}
