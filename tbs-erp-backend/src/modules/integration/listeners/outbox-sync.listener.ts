import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SyncEngineService } from '../sync/sync-engine.service';

/**
 * Bridge listener: automatically forwards outbox events to external systems.
 * Listens to domain events emitted by the Outbox poller and dispatches them
 * via the SyncEngine to configured webhook endpoints.
 */
@Injectable()
export class OutboxSyncListener {
  private readonly logger = new Logger(OutboxSyncListener.name);

  // Map event types to sync entity types
  private readonly EVENT_SYNC_MAP: Record<string, { entity: string; action: string }> = {
    'order.created': { entity: 'order', action: 'create' },
    'order.confirmed': { entity: 'order', action: 'update' },
    'order.completed': { entity: 'order', action: 'update' },
    'order.cancelled': { entity: 'order', action: 'update' },
    'payment.approved': { entity: 'paymentVoucher', action: 'create' },
    'payment.rejected': { entity: 'paymentVoucher', action: 'update' },
    'invoice.created': { entity: 'invoice', action: 'create' },
    'invoice.issued': { entity: 'invoice', action: 'update' },
    'ar.payment.received': { entity: 'accountReceivable', action: 'update' },
    'journal.entry.posted': { entity: 'journalEntry', action: 'create' },
  };

  constructor(private readonly syncEngine: SyncEngineService) {}

  @OnEvent('**') // Listen to all events
  async handleOutboxEvent(payload: any): Promise<void> {
    // Only process events that came from the outbox (have outboxId)
    if (!payload?.outboxId || !payload?.eventType) {
      return;
    }

    const mapping = this.EVENT_SYNC_MAP[payload.eventType];
    if (!mapping) {
      return; // Not a syncable event
    }

    try {
      await this.syncEngine.syncToExternal(
        mapping.entity,
        mapping.action,
        payload.payload || payload,
      );
      this.logger.debug(
        `Outbox event ${payload.outboxId} [${payload.eventType}] synced to external`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync outbox event ${payload.outboxId} [${payload.eventType}]: ${error.message}`,
      );
      // Don't rethrow - the outbox has its own retry mechanism
    }
  }
}
