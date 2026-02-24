import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { WebhookRetryService } from '../webhook/webhook-retry.service';

/**
 * Represents a sync operation result.
 */
export interface SyncResult {
  success: boolean;
  entity: string;
  action: 'create' | 'update' | 'delete';
  sourceId: string;
  targetId?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Represents a data conflict between local and remote systems.
 */
export interface DataConflict {
  entity: string;
  entityId: string;
  field: string;
  localValue: any;
  remoteValue: any;
  localUpdatedAt: Date;
  remoteUpdatedAt: Date;
}

/**
 * Conflict resolution strategy.
 */
export type ConflictStrategy = 'last_write_wins' | 'local_wins' | 'remote_wins' | 'manual';

/**
 * Sync Engine Service — Bidirectional data synchronization with external systems.
 *
 * Supports:
 *   - Outbound sync: Push changes to external systems via webhooks or API calls
 *   - Inbound sync: Process incoming data from external systems
 *   - Conflict resolution: Last-write-wins by default, configurable per entity
 *   - Audit trail: All sync operations are logged for compliance
 *
 * Architecture:
 *   Internal events (via EventBus) -> SyncEngine -> WebhookRetryService -> External
 *   External -> API endpoint -> SyncEngine -> Database + Internal events
 *
 * Entity mapping:
 *   Each entity type can have a custom transformer to convert between
 *   internal and external data formats.
 */
@Injectable()
export class SyncEngineService {
  private readonly logger = new Logger(SyncEngineService.name);

  /** Registry of entity transformers for outbound sync */
  private readonly outboundTransformers = new Map<string, (data: any) => any>();

  /** Registry of entity transformers for inbound sync */
  private readonly inboundTransformers = new Map<string, (data: any) => any>();

  /** Conflict resolution strategies per entity type */
  private readonly conflictStrategies = new Map<string, ConflictStrategy>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly webhookRetryService: WebhookRetryService,
  ) {
    this.initializeDefaultTransformers();
    this.initializeDefaultStrategies();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Outbound Sync — Push local changes to external systems
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sync a local entity change to all subscribed external systems.
   *
   * Called by domain services when entities are created, updated, or deleted.
   * Example: this.syncEngine.syncToExternal('order', 'created', orderData);
   */
  async syncToExternal(
    entity: string,
    action: string,
    data: Record<string, any>,
  ): Promise<SyncResult> {
    const timestamp = new Date();
    const eventType = `${entity}.${action}`;

    try {
      // Transform data to external format
      const transformer = this.outboundTransformers.get(entity);
      const transformedData = transformer ? transformer(data) : data;

      // Remove sensitive/internal fields before sending externally
      const sanitizedData = this.sanitizeForExternal(transformedData);

      // Dispatch via webhook system
      await this.webhookRetryService.dispatch(eventType, {
        event: eventType,
        timestamp: timestamp.toISOString(),
        data: sanitizedData,
      });

      this.logger.log(`Outbound sync: ${eventType} dispatched for entity ${data.id || 'unknown'}`);

      return {
        success: true,
        entity,
        action: action as SyncResult['action'],
        sourceId: data.id || '',
        timestamp,
      };
    } catch (error) {
      this.logger.error(`Outbound sync failed for ${eventType}: ${error.message}`);

      return {
        success: false,
        entity,
        action: action as SyncResult['action'],
        sourceId: data.id || '',
        error: error.message,
        timestamp,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Inbound Sync — Process changes from external systems
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Process an incoming sync payload from an external system.
   *
   * Called by integration API endpoints when external systems push updates.
   * The data is validated, transformed to internal format, and upserted.
   */
  async syncFromExternal(
    source: string,
    entity: string,
    data: Record<string, any>,
  ): Promise<SyncResult> {
    const timestamp = new Date();

    try {
      // Validate the incoming data has required fields
      if (!data.id && !data.externalId) {
        throw new Error('Incoming sync data must have an id or externalId field');
      }

      // Transform to internal format
      const transformer = this.inboundTransformers.get(entity);
      const internalData = transformer ? transformer(data) : data;

      // Check for conflicts with local data
      const existingRecord = await this.findExistingRecord(entity, data.id || data.externalId);

      if (existingRecord) {
        const conflicts = this.detectConflicts(entity, existingRecord, internalData);

        if (conflicts.length > 0) {
          const resolved = await this.resolveConflicts(entity, conflicts, existingRecord, internalData);
          Object.assign(internalData, resolved);
        }
      }

      // Upsert to database
      const result = await this.upsertEntity(entity, internalData);

      // Emit internal event for other modules to react
      this.eventEmitter.emit(`sync.${entity}.received`, {
        source,
        entity,
        data: result,
        timestamp,
      });

      this.logger.log(
        `Inbound sync from ${source}: ${entity} ${data.id || data.externalId} processed`,
      );

      return {
        success: true,
        entity,
        action: existingRecord ? 'update' : 'create',
        sourceId: data.id || data.externalId,
        targetId: result?.id,
        timestamp,
      };
    } catch (error) {
      this.logger.error(
        `Inbound sync from ${source} failed for ${entity}: ${error.message}`,
      );

      return {
        success: false,
        entity,
        action: 'update',
        sourceId: data.id || data.externalId || '',
        error: error.message,
        timestamp,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Conflict Resolution
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Detect field-level conflicts between local and remote data.
   */
  private detectConflicts(
    entity: string,
    localData: Record<string, any>,
    remoteData: Record<string, any>,
  ): DataConflict[] {
    const conflicts: DataConflict[] = [];

    for (const field of Object.keys(remoteData)) {
      // Skip metadata fields
      if (['id', 'createdAt', 'updatedAt', 'externalId'].includes(field)) continue;

      if (
        localData[field] !== undefined &&
        remoteData[field] !== undefined &&
        JSON.stringify(localData[field]) !== JSON.stringify(remoteData[field])
      ) {
        conflicts.push({
          entity,
          entityId: localData.id,
          field,
          localValue: localData[field],
          remoteValue: remoteData[field],
          localUpdatedAt: localData.updatedAt || new Date(),
          remoteUpdatedAt: remoteData.updatedAt || new Date(),
        });
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts based on the configured strategy for the entity type.
   */
  async resolveConflicts(
    entity: string,
    conflicts: DataConflict[],
    localData: Record<string, any>,
    remoteData: Record<string, any>,
  ): Promise<Record<string, any>> {
    const strategy = this.conflictStrategies.get(entity) || 'last_write_wins';
    const resolved: Record<string, any> = {};

    for (const conflict of conflicts) {
      switch (strategy) {
        case 'last_write_wins':
          // Whichever was updated more recently wins
          resolved[conflict.field] =
            conflict.remoteUpdatedAt > conflict.localUpdatedAt
              ? conflict.remoteValue
              : conflict.localValue;
          break;

        case 'local_wins':
          resolved[conflict.field] = conflict.localValue;
          break;

        case 'remote_wins':
          resolved[conflict.field] = conflict.remoteValue;
          break;

        case 'manual':
          // Log for manual resolution — keep local value for now
          this.logger.warn(
            `Manual conflict resolution needed for ${entity}.${conflict.field}: ` +
            `local="${conflict.localValue}" vs remote="${conflict.remoteValue}"`,
          );
          resolved[conflict.field] = conflict.localValue;
          break;
      }
    }

    // Log conflict resolution for audit
    if (conflicts.length > 0) {
      this.logger.log(
        `Resolved ${conflicts.length} conflict(s) for ${entity} ${localData.id} using strategy: ${strategy}`,
      );
    }

    return resolved;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a custom transformer for outbound sync of an entity type.
   */
  registerOutboundTransformer(entity: string, transformer: (data: any) => any): void {
    this.outboundTransformers.set(entity, transformer);
  }

  /**
   * Register a custom transformer for inbound sync of an entity type.
   */
  registerInboundTransformer(entity: string, transformer: (data: any) => any): void {
    this.inboundTransformers.set(entity, transformer);
  }

  /**
   * Set the conflict resolution strategy for an entity type.
   */
  setConflictStrategy(entity: string, strategy: ConflictStrategy): void {
    this.conflictStrategies.set(entity, strategy);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Remove sensitive/internal fields before sending data externally.
   * Complies with ND 13/2023 Article 26 (cross-border data minimization).
   */
  private sanitizeForExternal(data: Record<string, any>): Record<string, any> {
    const sensitiveFields = [
      'passwordHash',
      'password',
      'twoFactorSecret',
      'backupCodes',
      'resetToken',
      'refreshToken',
      'bankAccount',
      'taxCode',
      'salary',
      'idNumber',
    ];

    const sanitized = { ...data };
    for (const field of sensitiveFields) {
      delete sanitized[field];
    }
    return sanitized;
  }

  /**
   * Find an existing record in the database by entity type and ID.
   */
  private async findExistingRecord(
    entity: string,
    id: string,
  ): Promise<Record<string, any> | null> {
    try {
      const model = (this.prisma as any)[entity];
      if (!model || typeof model.findUnique !== 'function') {
        return null;
      }
      return await model.findUnique({ where: { id } });
    } catch {
      return null;
    }
  }

  /**
   * Upsert an entity record to the database.
   */
  private async upsertEntity(
    entity: string,
    data: Record<string, any>,
  ): Promise<Record<string, any> | null> {
    try {
      const model = (this.prisma as any)[entity];
      if (!model || typeof model.upsert !== 'function') {
        this.logger.warn(`No Prisma model found for entity: ${entity}`);
        return null;
      }

      const { id, ...updateData } = data;
      return await model.upsert({
        where: { id: id || 'nonexistent' },
        create: data,
        update: updateData,
      });
    } catch (error) {
      this.logger.error(`Failed to upsert ${entity}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize default outbound transformers for common entity types.
   */
  private initializeDefaultTransformers(): void {
    // Order: Include only operational fields for external systems
    this.outboundTransformers.set('order', (data) => ({
      id: data.id,
      code: data.code,
      status: data.status,
      serviceType: data.serviceType,
      totalAmount: data.totalAmount,
      currency: data.currency,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }));

    // Customer: Exclude PII per ND 13/2023
    this.outboundTransformers.set('customer', (data) => ({
      id: data.id,
      code: data.code,
      companyName: data.companyName,
      // Exclude: phone, email, address, taxCode, bankAccount
    }));
  }

  /**
   * Initialize default conflict resolution strategies.
   */
  private initializeDefaultStrategies(): void {
    // Financial records: local always wins to maintain accounting integrity
    this.conflictStrategies.set('paymentVoucher', 'local_wins');
    this.conflictStrategies.set('receiptVoucher', 'local_wins');
    this.conflictStrategies.set('invoice', 'local_wins');

    // Orders: last write wins (most recent update from either system)
    this.conflictStrategies.set('order', 'last_write_wins');

    // Inventory: remote wins (warehouse system is authoritative)
    this.conflictStrategies.set('package', 'remote_wins');
  }
}
