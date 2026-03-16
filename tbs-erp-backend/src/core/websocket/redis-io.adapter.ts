import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerOptions } from 'socket.io';

/**
 * RedisIoAdapter — Socket.IO adapter backed by Redis pub/sub.
 *
 * Enables horizontal scaling across multiple backend instances:
 * every event emitted on one instance is forwarded to all other
 * instances via Redis, so room-targeted emissions reach clients
 * regardless of which pod they are connected to.
 *
 * DEPENDENCY: requires `@socket.io/redis-adapter` to be installed.
 *   npm install @socket.io/redis-adapter
 *
 * The `redis` package (v5) is already in package.json.
 * Only `@socket.io/redis-adapter` needs to be added to activate this adapter.
 *
 * Both packages are loaded at runtime via dynamic require() so TypeScript
 * compilation succeeds even before the optional package is installed.
 *
 * Usage: bootstrap() in main.ts calls connectToRedis() then
 * useWebSocketAdapter(redisIoAdapter). Falls back to the default
 * in-memory adapter when the package is missing or Redis is unreachable.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);

  // Typed as `any` to avoid a compile-time dependency on the optional package.
  private adapterConstructor: any;

  constructor(private readonly app: INestApplication) {
    super(app);
  }

  /**
   * Connect to Redis and initialise the adapter constructor.
   * Must be called once in bootstrap() before app.listen().
   * Throws if @socket.io/redis-adapter is not installed or Redis is unreachable.
   */
  async connectToRedis(): Promise<void> {
    const configService = this.app.get(ConfigService);
    const host = configService.get<string>('redis.host', 'localhost');
    const port = configService.get<number>('redis.port', 6379);
    const password = configService.get<string>('redis.password');

    // require() is used instead of import() so TypeScript does not attempt
    // to statically resolve the optional package at compile time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('redis') as typeof import('redis');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAdapter } = require('@socket.io/redis-adapter') as {
      createAdapter: (...args: any[]) => any;
    };

    const redisOptions: Parameters<typeof createClient>[0] = {
      socket: { host, port },
    };
    if (password) {
      (redisOptions as any).password = password;
    }

    const pubClient = createClient(redisOptions);
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    pubClient.on('error', (err: Error) =>
      this.logger.error(`Redis pub client error: ${err.message}`, err.stack),
    );
    subClient.on('error', (err: Error) =>
      this.logger.error(`Redis sub client error: ${err.message}`, err.stack),
    );

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(`WebSocket Redis adapter connected to ${host}:${port}`);
  }

  /**
   * Override createIOServer to attach the Redis adapter to the Socket.IO server.
   */
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    if (!this.adapterConstructor) {
      this.logger.warn(
        'RedisIoAdapter.createIOServer() called before connectToRedis(). ' +
          'Falling back to in-memory adapter.',
      );
      return server;
    }

    server.adapter(this.adapterConstructor);
    this.logger.log('Socket.IO server using Redis adapter');
    return server;
  }
}
