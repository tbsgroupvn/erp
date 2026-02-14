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

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error' | 'warn'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    const isDev =
      configService.get<string>('app.env', 'development') === 'development';

    super({
      datasources: {
        db: {
          url: configService.get<string>('database.url'),
        },
      },
      log: isDev
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ],
    });

    if (isDev) {
      this.$on('query', (event: Prisma.QueryEvent) => {
        this.logger.debug(
          `Query: ${event.query} — Params: ${event.params} — Duration: ${event.duration}ms`,
        );
      });
    }

    this.$on('error', (event: Prisma.LogEvent) => {
      this.logger.error(`Prisma error: ${event.message}`);
    });

    this.$on('warn', (event: Prisma.LogEvent) => {
      this.logger.warn(`Prisma warning: ${event.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');
    const timeout = setTimeout(() => {
      this.logger.error('Database connection timed out after 30s');
      process.exit(1);
    }, 30000);
    try {
      await this.$connect();
      this.logger.log('Database connection established.');
    } finally {
      clearTimeout(timeout);
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

    const models = Reflect.ownKeys(this).filter(
      (key) =>
        typeof key === 'string' &&
        !key.startsWith('_') &&
        !key.startsWith('$') &&
        typeof (this as any)[key]?.deleteMany === 'function',
    );

    for (const model of models) {
      await (this as any)[model].deleteMany();
    }
  }
}
