import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Read Replica Service — Routes queries to primary or replica database.
 *
 * When DATABASE_REPLICA_URL is configured, read-heavy operations (reports,
 * dashboards, exports, list views) are routed to the replica to offload
 * the primary. If no replica URL is set, all queries fall back to primary.
 *
 * Usage:
 *   const readClient = this.readReplicaService.getReadClient();
 *   const orders = await readClient.order.findMany({ ... });
 *
 *   const writeClient = this.readReplicaService.getWriteClient();
 *   await writeClient.order.create({ ... });
 *
 * Architecture note: The production docker-compose.production.yml already
 * provisions a postgres-replica service with streaming replication.
 */
@Injectable()
export class ReadReplicaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadReplicaService.name);
  private primaryClient: PrismaClient;
  private replicaClient: PrismaClient | null = null;
  private readonly hasReplica: boolean;

  constructor(private readonly configService: ConfigService) {
    const primaryUrl = configService.get<string>('DATABASE_URL');
    const replicaUrl = configService.get<string>('DATABASE_REPLICA_URL');

    this.primaryClient = new PrismaClient({
      datasources: { db: { url: primaryUrl } },
      log: [
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    this.hasReplica = !!replicaUrl;

    if (replicaUrl) {
      this.replicaClient = new PrismaClient({
        datasources: { db: { url: replicaUrl } },
        log: [
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ],
      });
      this.logger.log('Read replica configured — read queries will be routed to replica');
    } else {
      this.logger.log('No DATABASE_REPLICA_URL set — all queries routed to primary');
    }
  }

  async onModuleInit(): Promise<void> {
    await this.primaryClient.$connect();
    this.logger.log('Primary database connection established for read-replica service');

    if (this.replicaClient) {
      try {
        await this.replicaClient.$connect();
        this.logger.log('Replica database connection established');
      } catch (error) {
        this.logger.error(
          `Failed to connect to replica database: ${error.message}. Falling back to primary for reads.`,
        );
        this.replicaClient = null;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.primaryClient.$disconnect();
    if (this.replicaClient) {
      await this.replicaClient.$disconnect();
    }
    this.logger.log('Read replica connections closed');
  }

  /**
   * Returns a PrismaClient connected to the read replica (if available),
   * otherwise returns the primary client.
   *
   * Use for: Reports, dashboards, exports, search, list queries, analytics.
   * Do NOT use for: Any query that expects to see data written in the same
   * request (replication lag may cause stale reads).
   */
  getReadClient(): PrismaClient {
    return this.replicaClient ?? this.primaryClient;
  }

  /**
   * Returns the PrismaClient connected to the primary database.
   *
   * Use for: All write operations (create, update, delete), and any read
   * that must be strongly consistent (e.g., read-after-write in the same
   * request flow).
   */
  getWriteClient(): PrismaClient {
    return this.primaryClient;
  }

  /**
   * Returns true if a read replica is configured and connected.
   */
  isReplicaAvailable(): boolean {
    return this.replicaClient !== null;
  }

  /**
   * Health check for the replica connection. Returns replication lag
   * information when available.
   */
  async getReplicaStatus(): Promise<{
    available: boolean;
    replicationLagBytes: number | null;
    replicationLagSeconds: number | null;
  }> {
    if (!this.replicaClient) {
      return { available: false, replicationLagBytes: null, replicationLagSeconds: null };
    }

    try {
      // Query replication lag from replica's perspective
      const result: any[] = await this.replicaClient.$queryRaw`
        SELECT
          CASE WHEN pg_is_in_recovery() THEN
            EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))
          ELSE NULL END AS lag_seconds,
          CASE WHEN pg_is_in_recovery() THEN
            pg_wal_lsn_diff(pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn())
          ELSE NULL END AS lag_bytes
      `;

      return {
        available: true,
        replicationLagBytes: result[0]?.lag_bytes ?? null,
        replicationLagSeconds: result[0]?.lag_seconds ?? null,
      };
    } catch (error) {
      this.logger.error(`Replica health check failed: ${error.message}`);
      return { available: false, replicationLagBytes: null, replicationLagSeconds: null };
    }
  }
}
