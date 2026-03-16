import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent, DomainEventType, PackageReceivedPayload } from '../domain-events';

/**
 * Processes warehouse-related domain events from the 'warehouse-events' queue.
 *
 * Handles:
 * - Package received at CN / VN warehouses
 * - Package shipped from CN
 * - Package in transit, at customs, delivered
 * - Inventory updates
 *
 * All processing is idempotent.
 */
@Processor('warehouse-events')
export class WarehouseEventProcessor extends WorkerHost {
  private readonly logger = new Logger(WarehouseEventProcessor.name);

  constructor(private readonly eventEmitter: EventEmitter2) {
    super();
  }

  async process(job: Job<DomainEvent>): Promise<void> {
    const event = job.data;
    this.logger.log(
      `Processing ${event.type} (jobId: ${job.id}, ` +
        `correlationId: ${event.metadata.correlationId})`,
    );

    switch (event.type) {
      case DomainEventType.PACKAGE_RECEIVED_CN:
        await this.handlePackageReceivedCN(event as DomainEvent<PackageReceivedPayload>);
        break;

      case DomainEventType.PACKAGE_SHIPPED_CN:
        await this.handlePackageShippedCN(event);
        break;

      case DomainEventType.PACKAGE_IN_TRANSIT:
        await this.handlePackageInTransit(event);
        break;

      case DomainEventType.PACKAGE_AT_CUSTOMS:
        await this.handlePackageAtCustoms(event);
        break;

      case DomainEventType.PACKAGE_RECEIVED_VN:
        await this.handlePackageReceivedVN(event as DomainEvent<PackageReceivedPayload>);
        break;

      case DomainEventType.PACKAGE_DELIVERED:
        await this.handlePackageDelivered(event);
        break;

      case DomainEventType.INVENTORY_UPDATED:
        await this.handleInventoryUpdated(event);
        break;

      default:
        this.logger.warn(`Unhandled warehouse event type: ${event.type}`);
    }
  }

  /**
   * Package received at China warehouse:
   * 1. Update tracking
   * 2. Notify sales person
   * 3. Update dashboard warehouse stats
   */
  private async handlePackageReceivedCN(event: DomainEvent<PackageReceivedPayload>): Promise<void> {
    const { packageId, trackingCode, orderId, weight } = event.payload;

    this.logger.log(`Package received at CN warehouse: ${trackingCode} (order: ${orderId})`);

    // 1. Tracking update
    this.eventEmitter.emit('tracking.package.updated', {
      packageId,
      trackingCode,
      orderId,
      status: 'WAREHOUSE_CN',
      warehouse: 'CN',
      weight,
    });

    // 2. Dashboard update
    this.eventEmitter.emit('dashboard.update', {
      type: 'PACKAGE_RECEIVED_CN',
      data: { packageId, orderId },
    });

    // 3. Real-time WebSocket update for warehouse operators
    this.eventEmitter.emit('ws.emit.role', {
      role: 'WAREHOUSE_CN',
      event: 'package_received',
      data: { packageId, trackingCode, orderId, weight },
    });
  }

  private async handlePackageShippedCN(event: DomainEvent): Promise<void> {
    this.logger.log(`Package shipped from CN: ${event.metadata.aggregateId}`);

    this.eventEmitter.emit('tracking.package.updated', {
      ...event.payload,
      status: 'SHIPPED_CN',
    });

    this.eventEmitter.emit('dashboard.update', {
      type: 'PACKAGE_SHIPPED_CN',
      data: event.payload,
    });
  }

  private async handlePackageInTransit(event: DomainEvent): Promise<void> {
    this.logger.log(`Package in transit: ${event.metadata.aggregateId}`);

    this.eventEmitter.emit('tracking.package.updated', {
      ...event.payload,
      status: 'IN_TRANSIT',
    });

    this.eventEmitter.emit('dashboard.update', {
      type: 'PACKAGE_IN_TRANSIT',
      data: event.payload,
    });
  }

  private async handlePackageAtCustoms(event: DomainEvent): Promise<void> {
    this.logger.log(`Package at customs: ${event.metadata.aggregateId}`);

    this.eventEmitter.emit('tracking.package.updated', {
      ...event.payload,
      status: 'AT_CUSTOMS',
    });

    // Notify customs team
    this.eventEmitter.emit('ws.emit.role', {
      role: 'CUSTOMS',
      event: 'package_at_customs',
      data: event.payload,
    });
  }

  /**
   * Package received at Vietnam warehouse:
   * 1. Update tracking
   * 2. Notify customer
   * 3. Dashboard update
   */
  private async handlePackageReceivedVN(event: DomainEvent<PackageReceivedPayload>): Promise<void> {
    const { packageId, trackingCode, orderId, weight } = event.payload;

    this.logger.log(`Package received at VN warehouse: ${trackingCode} (order: ${orderId})`);

    this.eventEmitter.emit('tracking.package.updated', {
      packageId,
      trackingCode,
      orderId,
      status: 'WAREHOUSE_VN',
      warehouse: 'VN',
      weight,
    });

    this.eventEmitter.emit('dashboard.update', {
      type: 'PACKAGE_RECEIVED_VN',
      data: { packageId, orderId },
    });

    // Notify VN warehouse operators
    this.eventEmitter.emit('ws.emit.role', {
      role: 'WAREHOUSE_VN',
      event: 'package_received',
      data: { packageId, trackingCode, orderId, weight },
    });
  }

  private async handlePackageDelivered(event: DomainEvent): Promise<void> {
    this.logger.log(`Package delivered: ${event.metadata.aggregateId}`);

    this.eventEmitter.emit('tracking.package.updated', {
      ...event.payload,
      status: 'DELIVERED',
    });

    this.eventEmitter.emit('dashboard.update', {
      type: 'PACKAGE_DELIVERED',
      data: event.payload,
    });
  }

  private async handleInventoryUpdated(event: DomainEvent): Promise<void> {
    this.logger.log(`Inventory updated: ${event.metadata.aggregateId}`);

    this.eventEmitter.emit('dashboard.update', {
      type: 'INVENTORY_UPDATED',
      data: event.payload,
    });
  }
}
