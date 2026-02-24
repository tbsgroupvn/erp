import { Module } from '@nestjs/common';
import { SyncEngineService } from './sync-engine.service';
import { WebhookModule } from '../webhook/webhook.module';

/**
 * Sync Engine Module — Bidirectional data synchronization with external systems.
 *
 * Provides SyncEngineService for:
 *   - Outbound sync: Push local changes via webhooks
 *   - Inbound sync: Process incoming data from external systems
 *   - Conflict resolution: Configurable per entity type
 *
 * Dependencies:
 *   - WebhookModule: For outbound event dispatch
 *   - EventBusModule (global): For internal event emission
 *   - PrismaService (global): For database operations
 */
@Module({
  imports: [WebhookModule],
  providers: [SyncEngineService],
  exports: [SyncEngineService],
})
export class SyncEngineModule {}
