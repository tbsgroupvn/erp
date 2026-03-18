import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DiscoveryService, ModuleRef } from '@nestjs/core';
import { WorkerHost } from '@nestjs/bullmq';

/**
 * Centralized graceful shutdown orchestrator.
 *
 * Enforces the correct teardown order during SIGTERM/SIGINT:
 *
 * 1. `beforeApplicationShutdown` (this service):
 *    - Drain all BullMQ workers (wait for in-flight jobs, 30s timeout)
 *    - Close WebSocket server (5s timeout)
 *
 * 2. `onModuleDestroy` (NestJS lifecycle, handled by other services):
 *    - PrismaService.$disconnect() closes the database connection
 *    - FailedJobCaptureService closes QueueEvents instances
 *
 * Using `BeforeApplicationShutdown` ensures workers can still access the
 * database while completing in-flight jobs. If we used `OnApplicationShutdown`,
 * PrismaService.onModuleDestroy would have already closed the DB connection.
 *
 * Stalled jobs (those that timeout) are automatically retried by BullMQ
 * on the next application start via its built-in stalled job recovery.
 */
@Injectable()
export class GracefulShutdownService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private readonly DRAIN_TIMEOUT_MS = 30_000;
  private readonly WS_CLOSE_TIMEOUT_MS = 5_000;

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(
      `Graceful shutdown initiated (signal: ${signal || 'unknown'})`,
    );
    const start = Date.now();

    // Step 1: Drain BullMQ workers (in-flight jobs can still access DB)
    await this.drainWorkers();

    // Step 2: Close WebSocket server (disconnect all clients)
    await this.closeWebSocket();

    // Step 3: PrismaService.$disconnect is handled by PrismaService.onModuleDestroy
    // which fires AFTER beforeApplicationShutdown completes.

    const elapsed = Date.now() - start;
    this.logger.log(`Graceful shutdown complete in ${elapsed}ms`);
  }

  /**
   * Discover and drain all BullMQ WorkerHost instances.
   *
   * Uses NestJS DiscoveryService to find all providers that extend WorkerHost,
   * then calls worker.close() on each one. worker.close() waits for in-flight
   * jobs to complete before resolving.
   *
   * If any worker is stuck, the entire drain operation times out after 30s
   * and proceeds with shutdown (stalled jobs will be retried by BullMQ).
   */
  private async drainWorkers(): Promise<void> {
    const providers = this.discoveryService.getProviders();
    const workerHosts = providers
      .filter(
        (wrapper) =>
          wrapper.instance && wrapper.instance instanceof WorkerHost,
      )
      .map((wrapper) => ({
        name: wrapper.instance?.constructor?.name || 'UnknownWorker',
        instance: wrapper.instance as WorkerHost,
      }));

    if (workerHosts.length === 0) {
      this.logger.log('No BullMQ workers to drain');
      return;
    }

    this.logger.log(`Draining ${workerHosts.length} BullMQ worker(s)...`);

    const drainPromise = Promise.allSettled(
      workerHosts.map(async ({ name, instance }) => {
        try {
          await instance.worker.close();
          this.logger.log(`Worker ${name} drained successfully`);
        } catch (err) {
          this.logger.warn(
            `Worker ${name} drain error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );

    const result = await Promise.race([
      drainPromise.then(() => 'drained' as const),
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), this.DRAIN_TIMEOUT_MS),
      ),
    ]);

    if (result === 'timeout') {
      this.logger.warn(
        `Worker drain timed out after ${this.DRAIN_TIMEOUT_MS}ms — forcing shutdown. ` +
          'Stalled jobs will be retried by BullMQ on next start.',
      );
    } else {
      this.logger.log('All BullMQ workers drained');
    }
  }

  /**
   * Close the WebSocket server to disconnect all clients.
   *
   * Dynamically resolves WsGateway via ModuleRef to avoid circular
   * dependency issues. Falls back gracefully if WsGateway is not
   * available (e.g., in unit tests or microservice configurations).
   */
  private async closeWebSocket(): Promise<void> {
    try {
      // Dynamically import to avoid circular dependency at module load time
      const { WsGateway } = await import(
        '@core/websocket/ws.gateway'
      );
      const wsGateway = this.moduleRef.get(WsGateway, { strict: false });

      if (wsGateway?.server) {
        await new Promise<void>((resolve) => {
          wsGateway.server.close(() => {
            this.logger.log('WebSocket server closed');
            resolve();
          });

          // Safety timeout to prevent hanging if WS close is stuck
          setTimeout(() => {
            this.logger.warn(
              `WebSocket close timed out after ${this.WS_CLOSE_TIMEOUT_MS}ms`,
            );
            resolve();
          }, this.WS_CLOSE_TIMEOUT_MS);
        });
      }
    } catch (err) {
      // WsGateway may not be available (e.g., in unit tests)
      this.logger.debug(
        `WebSocket close skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
