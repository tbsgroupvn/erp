import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from './notification.service';
import { NotificationChannel } from '@prisma/client';

/**
 * Payload shape passed to every rule-based event handler.
 * Individual event emitters may include additional fields; we treat
 * the payload as a generic record so the rule engine can inspect
 * any property via dot-notation conditions.
 */
interface EventPayload extends Record<string, unknown> {
  orderId?: string;
  orderCode?: string;
  code?: string;
  customerId?: string;
  saleId?: string;
  changedBy?: string;
  fromStatus?: string;
  toStatus?: string;
  newStatus?: string;
  packageId?: string;
  packageCode?: string;
  deliveryId?: string;
  deliveryCode?: string;
  approvalId?: string;
  requestedBy?: string;
  currentStepRole?: string;
  approverRole?: string;
  type?: string;
  referenceId?: string;
  referenceCode?: string;
  warehouse?: string;
}

/**
 * Condition object stored in NotificationRule.conditions (JSON).
 *
 * Each key maps to one of:
 *   - A single primitive value  (exact match)
 *   - An array of values        (value IN array)
 *
 * Example:
 * ```json
 * { "toStatus": ["WAREHOUSE_VN", "DELIVERED"], "warehouse": "VN" }
 * ```
 */
type RuleConditions = Record<string, unknown>;

/**
 * Dynamic notification rule engine.
 *
 * Instead of hard-coding every event->notification mapping, this service:
 * 1. Subscribes to wildcard domain events (order.**, package.**, delivery.**, approval.**)
 * 2. Queries active NotificationRule records whose eventType matches the incoming event
 * 3. Evaluates JSON conditions against the event payload
 * 4. Replaces template variables ({{order.code}}, {{customer.name}}, etc.) in title/body
 * 5. Resolves recipients (ASSIGNED_SALE, ROLE, SPECIFIC_USER, REQUESTER)
 * 6. Sends notifications via NotificationService for each configured channel
 *
 * This allows operations staff to create/update notification rules at runtime
 * without requiring code changes or deployments.
 */
@Injectable()
export class NotificationRulesService {
  private readonly logger = new Logger(NotificationRulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Wildcard event listeners
  // ---------------------------------------------------------------------------

  @OnEvent('order.**')
  async handleOrderEvent(payload: EventPayload): Promise<void> {
    await this.processEvent('order', payload);
  }

  @OnEvent('package.**')
  async handlePackageEvent(payload: EventPayload): Promise<void> {
    await this.processEvent('package', payload);
  }

  @OnEvent('delivery.**')
  async handleDeliveryEvent(payload: EventPayload): Promise<void> {
    await this.processEvent('delivery', payload);
  }

  @OnEvent('approval.**')
  async handleApprovalEvent(payload: EventPayload): Promise<void> {
    await this.processEvent('approval', payload);
  }

  // ---------------------------------------------------------------------------
  // Core rule processing
  // ---------------------------------------------------------------------------

  /**
   * Main entry point called by each wildcard listener.
   *
   * @param domain  The event domain (order, package, delivery, approval)
   * @param payload The raw event payload
   */
  private async processEvent(domain: string, payload: EventPayload): Promise<void> {
    try {
      // Derive a canonical eventType string that rules can match against.
      // EventEmitter2 passes the full event name as a hidden property;
      // we also fall back to the domain prefix if not available.
      const eventType = (payload as any)?.event ?? domain;

      const rules = await this.prisma.notificationRule.findMany({
        where: {
          isActive: true,
          eventType: eventType,
        },
      });

      if (rules.length === 0) {
        return;
      }

      this.logger.debug(`Found ${rules.length} active rule(s) for event "${eventType}"`);

      for (const rule of rules) {
        try {
          await this.evaluateAndSend(rule, payload);
        } catch (error) {
          this.logger.error(`Failed to process rule "${rule.name}" (${rule.id}): ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing event for domain "${domain}": ${error.message}`);
    }
  }

  /**
   * Evaluate a single rule's conditions against the payload, resolve
   * recipients, render templates, and dispatch notifications.
   */
  private async evaluateAndSend(
    rule: {
      id: string;
      name: string;
      eventType: string;
      conditions: unknown;
      channels: string[];
      recipientType: string;
      recipientRole: string | null;
      recipientUserId: string | null;
      templateTitle: string;
      templateBody: string;
    },
    payload: EventPayload,
  ): Promise<void> {
    // 1. Check conditions
    const conditions = rule.conditions as RuleConditions;
    if (!this.matchesConditions(conditions, payload)) {
      this.logger.debug(`Rule "${rule.name}" conditions not met, skipping`);
      return;
    }

    // 2. Build template context (may include DB lookups)
    const context = await this.buildTemplateContext(payload);

    // 3. Render title & body
    const title = this.renderTemplate(rule.templateTitle, context);
    const body = this.renderTemplate(rule.templateBody, context);

    // 4. Resolve recipients
    const recipientIds = await this.resolveRecipients(
      rule.recipientType,
      rule.recipientRole,
      rule.recipientUserId,
      payload,
    );

    if (recipientIds.length === 0) {
      this.logger.warn(`Rule "${rule.name}" resolved 0 recipients, skipping notification`);
      return;
    }

    // 5. Send for each configured channel
    const notificationType = this.deriveNotificationType(rule.eventType);
    const referenceId =
      (payload.orderId as string) ??
      (payload.approvalId as string) ??
      (payload.deliveryId as string) ??
      (payload.packageId as string) ??
      (payload.referenceId as string) ??
      undefined;

    for (const channelStr of rule.channels) {
      const channel = channelStr as NotificationChannel;

      if (channel === NotificationChannel.APP_PUSH && recipientIds.length > 1) {
        // Use bulk send for efficiency
        await this.notificationService.sendBulk(recipientIds, {
          title,
          body,
          type: notificationType,
          channel,
          referenceId,
        });
      } else {
        for (const userId of recipientIds) {
          await this.notificationService.send({
            userId,
            title,
            body,
            type: notificationType,
            channel,
            referenceId,
          });
        }
      }
    }

    this.logger.log(
      `Rule "${rule.name}" sent to ${recipientIds.length} recipient(s) via [${rule.channels.join(', ')}]`,
    );
  }

  // ---------------------------------------------------------------------------
  // Condition matching
  // ---------------------------------------------------------------------------

  /**
   * Check whether the event payload satisfies all conditions defined in the rule.
   *
   * Conditions is a JSON object where each key is a dot-notation path into the
   * payload and the value is either:
   *   - A primitive: exact equality check
   *   - An array:    the payload value must be one of the array elements (IN check)
   *
   * An empty or null conditions object is treated as "always match".
   */
  private matchesConditions(conditions: RuleConditions, payload: EventPayload): boolean {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    for (const [key, expected] of Object.entries(conditions)) {
      const actual = this.getNestedValue(payload, key);

      if (Array.isArray(expected)) {
        // IN check: payload value must be in the expected array
        if (!expected.includes(actual)) {
          return false;
        }
      } else {
        // Exact match
        if (actual !== expected) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Retrieve a nested value from an object using dot notation.
   * e.g. getNestedValue({ order: { code: 'X' } }, 'order.code') => 'X'
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[segment];
      }
      return undefined;
    }, obj);
  }

  // ---------------------------------------------------------------------------
  // Template rendering
  // ---------------------------------------------------------------------------

  /**
   * Build a context map for template variable replacement.
   * Enriches the raw event payload with data fetched from the database
   * (e.g. customer name, order code).
   */
  private async buildTemplateContext(payload: EventPayload): Promise<Record<string, string>> {
    const context: Record<string, string> = {};

    // Flatten scalar payload values into the context
    for (const [key, value] of Object.entries(payload)) {
      if (value !== null && value !== undefined && typeof value !== 'object') {
        context[key] = String(value);
      }
    }

    // Alias common fields for convenient template usage
    if (payload.orderCode) {
      context['order.code'] = String(payload.orderCode);
    }
    if (payload.code) {
      context['order.code'] = context['order.code'] ?? String(payload.code);
    }
    if (payload.packageCode) {
      context['package.code'] = String(payload.packageCode);
    }
    if (payload.deliveryCode) {
      context['delivery.code'] = String(payload.deliveryCode);
    }
    if (payload.referenceCode) {
      context['approval.referenceCode'] = String(payload.referenceCode);
    }
    if (payload.toStatus) {
      context['order.newStatus'] = String(payload.toStatus);
    }
    if (payload.fromStatus) {
      context['order.oldStatus'] = String(payload.fromStatus);
    }
    if (payload.warehouse) {
      context['warehouse'] = String(payload.warehouse);
    }

    // Enrich from DB: order details
    if (payload.orderId) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: payload.orderId as string },
          include: {
            customer: { select: { fullName: true, code: true } },
          },
        });
        if (order) {
          context['order.code'] = context['order.code'] ?? order.code;
          context['order.status'] = order.status;
          if (order.customer) {
            context['customer.name'] = order.customer.fullName;
            context['customer.code'] = order.customer.code;
          }
        }
      } catch {
        // Non-critical: template will show the raw placeholder if lookup fails
      }
    }

    // Enrich from DB: approval details
    if (payload.approvalId) {
      try {
        const approval = await this.prisma.approval.findUnique({
          where: { id: payload.approvalId as string },
          select: { type: true, referenceCode: true, referenceId: true },
        });
        if (approval) {
          context['approval.type'] = approval.type;
          context['approval.referenceCode'] = approval.referenceCode ?? approval.referenceId;
        }
      } catch {
        // Non-critical
      }
    }

    return context;
  }

  /**
   * Replace {{variable}} placeholders in a template string with values
   * from the context map.  Unknown variables are left as empty strings.
   */
  private renderTemplate(template: string, context: Record<string, string>): string {
    return template.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (_match, key: string) => {
      const trimmedKey = key.trim();
      return context[trimmedKey] ?? '';
    });
  }

  // ---------------------------------------------------------------------------
  // Recipient resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve the list of user IDs that should receive the notification
   * based on the rule's recipientType.
   *
   * Supported recipientTypes:
   *   - ASSIGNED_SALE   : the saleId on the order
   *   - ROLE            : all active users with a specific UserRole
   *   - SPECIFIC_USER   : a single hard-coded userId
   *   - REQUESTER       : the user who triggered the event (requestedBy / changedBy)
   */
  private async resolveRecipients(
    recipientType: string,
    recipientRole: string | null,
    recipientUserId: string | null,
    payload: EventPayload,
  ): Promise<string[]> {
    switch (recipientType) {
      case 'ASSIGNED_SALE': {
        // Look up the sale owner from the order
        const saleId = payload.saleId as string | undefined;
        if (saleId) return [saleId];

        // Fallback: fetch from DB
        if (payload.orderId) {
          const order = await this.prisma.order.findUnique({
            where: { id: payload.orderId as string },
            select: { saleId: true },
          });
          if (order?.saleId) return [order.saleId];
        }

        // For delivery events, the orderId might be nested
        if (payload.deliveryId) {
          const delivery = await this.prisma.delivery.findUnique({
            where: { id: payload.deliveryId as string },
            select: { order: { select: { saleId: true } } },
          });
          if (delivery?.order?.saleId) return [delivery.order.saleId];
        }

        return [];
      }

      case 'ROLE': {
        // Use the rule's recipientRole first, then fall back to the event
        // payload's approverRole / currentStepRole for dynamic resolution.
        const role =
          recipientRole ??
          (payload.approverRole as string | undefined) ??
          (payload.currentStepRole as string | undefined);

        if (!role) {
          this.logger.warn(
            'Rule with recipientType=ROLE but no recipientRole and no role in payload',
          );
          return [];
        }
        const users = await this.prisma.user.findMany({
          where: { role: role as any, isActive: true },
          select: { id: true },
        });
        return users.map((u) => u.id);
      }

      case 'SPECIFIC_USER': {
        if (!recipientUserId) {
          this.logger.warn('Rule with recipientType=SPECIFIC_USER but no recipientUserId');
          return [];
        }
        return [recipientUserId];
      }

      case 'REQUESTER': {
        const requesterId =
          (payload.requestedBy as string) ??
          (payload.changedBy as string) ??
          (payload.createdBy as string);
        if (requesterId) return [requesterId];
        return [];
      }

      default:
        this.logger.warn(`Unknown recipientType: ${recipientType}`);
        return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Derive a NotificationType string from the event type for DB persistence.
   */
  private deriveNotificationType(eventType: string): string {
    const prefix = eventType.split('.')[0]?.toUpperCase();
    const typeMap: Record<string, string> = {
      ORDER: 'ORDER',
      PACKAGE: 'WAREHOUSE',
      DELIVERY: 'ORDER',
      APPROVAL: 'APPROVAL',
      WAREHOUSE: 'WAREHOUSE',
    };
    return typeMap[prefix] ?? 'SYSTEM';
  }
}
