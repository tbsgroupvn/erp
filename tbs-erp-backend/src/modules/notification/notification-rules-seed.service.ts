import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

/**
 * Seeds default NotificationRule records on application bootstrap.
 *
 * Uses upsert-by-name so the seed is idempotent: rules are created on first
 * run and left untouched on subsequent restarts.  Operators can freely edit
 * or deactivate them at runtime without risk of the seed overwriting changes.
 */
@Injectable()
export class NotificationRulesSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationRulesSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    // Run in background so it does not block app startup
    setImmediate(async () => {
      try {
        await this.seedDefaultRules();
      } catch (error) {
        this.logger.error(`Failed to seed notification rules: ${error.message}`);
      }
    });
  }

  /**
   * Create the default set of notification rules if they do not already exist.
   */
  private async seedDefaultRules(): Promise<void> {
    const defaults = this.getDefaultRules();
    let created = 0;

    for (const rule of defaults) {
      const existing = await this.prisma.notificationRule.findFirst({
        where: { name: rule.name },
      });

      if (!existing) {
        await this.prisma.notificationRule.create({ data: rule });
        created++;
      }
    }

    if (created > 0) {
      this.logger.log(`Seeded ${created} default notification rule(s)`);
    } else {
      this.logger.debug('All default notification rules already exist');
    }
  }

  /**
   * Returns the list of default notification rules.
   *
   * Template variables supported:
   *   {{order.code}}            - Order code (e.g. TBS-ORD-240101-0001)
   *   {{customer.name}}         - Customer name
   *   {{customer.code}}         - Customer code
   *   {{order.newStatus}}       - New order status
   *   {{order.oldStatus}}       - Previous order status
   *   {{package.code}}          - Package code
   *   {{delivery.code}}         - Delivery code
   *   {{approval.type}}         - Approval type
   *   {{approval.referenceCode}} - Approval reference code
   *   {{warehouse}}             - Warehouse identifier (CN / VN)
   */
  private getDefaultRules() {
    return [
      // -----------------------------------------------------------------
      // 1. Order arrived at VN warehouse -> notify assigned sale
      // -----------------------------------------------------------------
      {
        name: 'Order arrived at VN warehouse',
        eventType: 'order.status.changed',
        conditions: {
          toStatus: ['WAREHOUSE_VN'],
        },
        channels: ['APP_PUSH'],
        recipientType: 'ASSIGNED_SALE',
        recipientRole: null,
        recipientUserId: null,
        templateTitle: 'Order {{order.code}} arrived at VN warehouse',
        templateBody:
          'Order {{order.code}} for customer {{customer.name}} has arrived at the Vietnam warehouse and is ready for processing.',
        isActive: true,
      },

      // -----------------------------------------------------------------
      // 2. Order delivered -> notify assigned sale
      // -----------------------------------------------------------------
      {
        name: 'Order delivered to customer',
        eventType: 'delivery.completed',
        conditions: {},
        channels: ['APP_PUSH'],
        recipientType: 'ASSIGNED_SALE',
        recipientRole: null,
        recipientUserId: null,
        templateTitle: 'Delivery completed - {{order.code}}',
        templateBody:
          'Order {{order.code}} has been successfully delivered to customer {{customer.name}}.',
        isActive: true,
      },

      // -----------------------------------------------------------------
      // 3. New approval request -> notify approvers by role
      // -----------------------------------------------------------------
      {
        name: 'New approval request - notify approvers',
        eventType: 'approval.requested',
        conditions: {},
        channels: ['APP_PUSH'],
        recipientType: 'ROLE',
        recipientRole: null, // Will be resolved dynamically from payload.approverRole
        recipientUserId: null,
        templateTitle: 'New approval request: {{approval.type}}',
        templateBody:
          'A new {{approval.type}} approval request ({{approval.referenceCode}}) is waiting for your review. Please take action.',
        isActive: true,
      },

      // -----------------------------------------------------------------
      // 4. Order status changed -> notify assigned sale
      // -----------------------------------------------------------------
      {
        name: 'Order status changed - notify sale',
        eventType: 'order.status.changed',
        conditions: {},
        channels: ['APP_PUSH'],
        recipientType: 'ASSIGNED_SALE',
        recipientRole: null,
        recipientUserId: null,
        templateTitle: 'Order {{order.code}} status updated',
        templateBody:
          'Order {{order.code}} status changed from {{order.oldStatus}} to {{order.newStatus}}.',
        isActive: true,
      },
    ];
  }
}
