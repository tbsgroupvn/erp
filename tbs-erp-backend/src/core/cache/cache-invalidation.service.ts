import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService } from './cache.service';
import { MetricsService } from '@core/metrics/metrics.service';

/**
 * Event-driven cache invalidation service.
 *
 * Listens for domain events emitted by business modules and invalidates
 * relevant cache keys to prevent stale data. Uses the EventEmitter wildcard
 * feature configured in EventBusModule.
 *
 * Invalidation strategy:
 * - Order events:  invalidate dashboard + order list caches
 * - Finance events: invalidate dashboard + finance caches
 * - Warehouse events: invalidate dashboard + pipeline caches
 * - Customer events: invalidate dashboard + CRM caches
 * - Exchange rate events: invalidate exchange rate caches
 *
 * Each invalidation is logged and timed for observability.
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
  ) {}

  // ─── Order Events ───

  @OnEvent('order.created')
  async onOrderCreated(): Promise<void> {
    await this.invalidate('order.created', [
      'dashboard:overview:',
      'orders:list:',
      'orders:active-counts',
      'order:stats:',
    ]);
  }

  @OnEvent('order.status.changed')
  async onOrderStatusChanged(event: { orderId?: string }): Promise<void> {
    const prefixes: string[] = [
      'dashboard:overview:',
      'orders:list:',
      'orders:active-counts',
      'dashboard:warehouse:',
      'order:stats:',
    ];

    // Also invalidate the specific order's detail and 360-view caches
    if (event?.orderId) {
      prefixes.push(`order:detail:${event.orderId}`);
      prefixes.push(`order:360:${event.orderId}`);
    } else {
      // No orderId in event — fall back to invalidating all detail caches
      prefixes.push('order:detail:');
      prefixes.push('order:360:');
    }

    await this.invalidate('order.status.changed', prefixes);
  }

  @OnEvent('order.updated')
  async onOrderUpdated(event: { orderId?: string }): Promise<void> {
    const prefixes: string[] = ['orders:list:', 'order:stats:'];

    if (event?.orderId) {
      prefixes.push(`order:detail:${event.orderId}`);
      prefixes.push(`order:360:${event.orderId}`);
    } else {
      prefixes.push('order:detail:');
      prefixes.push('order:360:');
    }

    await this.invalidate('order.updated', prefixes);
  }

  @OnEvent('order.completed')
  async onOrderCompleted(event: { orderId?: string }): Promise<void> {
    const prefixes: string[] = [
      'dashboard:overview:',
      'orders:list:',
      'orders:active-counts',
      'dashboard:finance:',
      'order:stats:',
    ];

    if (event?.orderId) {
      prefixes.push(`order:detail:${event.orderId}`);
      prefixes.push(`order:360:${event.orderId}`);
    }

    await this.invalidate('order.completed', prefixes);
  }

  @OnEvent('order.cancelled')
  async onOrderCancelled(event: { orderId?: string }): Promise<void> {
    const prefixes: string[] = [
      'dashboard:overview:',
      'orders:list:',
      'orders:active-counts',
      'order:stats:',
    ];

    if (event?.orderId) {
      prefixes.push(`order:detail:${event.orderId}`);
      prefixes.push(`order:360:${event.orderId}`);
    }

    await this.invalidate('order.cancelled', prefixes);
  }

  @OnEvent('order.amount.adjusted')
  async onOrderAmountAdjusted(event: { orderId?: string }): Promise<void> {
    const prefixes: string[] = ['orders:list:', 'order:stats:', 'dashboard:finance:'];

    if (event?.orderId) {
      prefixes.push(`order:detail:${event.orderId}`);
      prefixes.push(`order:360:${event.orderId}`);
    }

    await this.invalidate('order.amount.adjusted', prefixes);
  }

  // ─── Finance Events ───

  @OnEvent('finance.payment.received')
  async onPaymentReceived(): Promise<void> {
    await this.invalidate('finance.payment.received', [
      'dashboard:overview:',
      'dashboard:finance:',
      'finance:ar:',
    ]);
  }

  @OnEvent('finance.payment.created')
  async onPaymentCreated(): Promise<void> {
    await this.invalidate('finance.payment.created', ['dashboard:finance:', 'finance:ap:']);
  }

  @OnEvent('finance.voucher.approved')
  async onVoucherApproved(): Promise<void> {
    await this.invalidate('finance.voucher.approved', ['dashboard:finance:', 'finance:vouchers:']);
  }

  @OnEvent('finance.invoice.created')
  async onInvoiceCreated(): Promise<void> {
    await this.invalidate('finance.invoice.created', ['dashboard:finance:', 'finance:invoices:']);
  }

  // ─── Warehouse Events ───

  @OnEvent('warehouse.cn.received')
  async onWarehouseCNReceived(): Promise<void> {
    await this.invalidate('warehouse.cn.received', [
      'dashboard:warehouse:',
      'orders:active-counts',
    ]);
  }

  @OnEvent('warehouse.vn.received')
  async onWarehouseVNReceived(): Promise<void> {
    await this.invalidate('warehouse.vn.received', [
      'dashboard:warehouse:',
      'orders:active-counts',
    ]);
  }

  @OnEvent('warehouse.shipped')
  async onWarehouseShipped(): Promise<void> {
    await this.invalidate('warehouse.shipped', ['dashboard:warehouse:', 'orders:active-counts']);
  }

  @OnEvent('warehouse.delivered')
  async onWarehouseDelivered(): Promise<void> {
    await this.invalidate('warehouse.delivered', [
      'dashboard:warehouse:',
      'dashboard:overview:',
      'orders:active-counts',
    ]);
  }

  // ─── Customer Events ───

  @OnEvent('customer.created')
  async onCustomerCreated(): Promise<void> {
    await this.invalidate('customer.created', ['dashboard:overview:', 'crm:customers:']);
  }

  // ─── Exchange Rate Events ───

  @OnEvent('exchange-rate.updated')
  async onExchangeRateUpdated(): Promise<void> {
    await this.invalidate('exchange-rate.updated', ['exchange-rates:active', 'exchange-rates:']);
  }

  // ─── Approval Events ───

  @OnEvent('approval.submitted')
  async onApprovalSubmitted(): Promise<void> {
    await this.invalidate('approval.submitted', ['approvals:pending:']);
  }

  @OnEvent('approval.completed')
  async onApprovalCompleted(): Promise<void> {
    await this.invalidate('approval.completed', ['approvals:pending:']);
  }

  // ─── Employee Events ───

  @OnEvent('employee.created')
  async onEmployeeCreated(): Promise<void> {
    await this.invalidate('employee.created', ['dashboard:hr:', 'employees:list:']);
  }

  @OnEvent('employee.updated')
  async onEmployeeUpdated(): Promise<void> {
    await this.invalidate('employee.updated', ['dashboard:hr:', 'employees:list:']);
  }

  // ─── Internal Helper ───

  /**
   * Invalidate cache entries by a mix of exact keys and prefix patterns.
   *
   * Convention:
   *   - Keys ending with `:` are treated as prefix patterns → `delByPrefix()`
   *   - All other strings are treated as exact keys → `del()`
   *
   * Logs the event and records metrics.
   */
  private async invalidate(eventName: string, keys: string[]): Promise<void> {
    const start = performance.now();

    try {
      await Promise.all(
        keys.map((key) =>
          key.endsWith(':')
            ? this.cacheService.delByPrefix(key)
            : this.cacheService.del(key),
        ),
      );

      const duration = performance.now() - start;

      this.logger.debug(
        `Cache invalidated for event "${eventName}" ` +
          `(${keys.length} entries) in ${duration.toFixed(0)}ms`,
      );

      // Record invalidation metric
      this.metricsService.cacheInvalidationsTotal.inc({
        event: eventName,
      });
    } catch (error) {
      this.logger.error(`Cache invalidation failed for event "${eventName}": ${error.message}`);
    }
  }
}
