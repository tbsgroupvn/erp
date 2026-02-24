import { Global, Module } from '@nestjs/common';
import { ReadReplicaService } from './read-replica.service';

/**
 * Read Replica Module — Provides read/write routing for database queries.
 *
 * Registered globally so any service can inject ReadReplicaService to route
 * read-heavy queries (reports, dashboards, exports) to the PostgreSQL
 * streaming replica defined in docker-compose.production.yml.
 *
 * If DATABASE_REPLICA_URL is not set, all queries transparently fall back
 * to the primary database.
 */
@Global()
@Module({
  providers: [ReadReplicaService],
  exports: [ReadReplicaService],
})
export class ReadReplicaModule {}
