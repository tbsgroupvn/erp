import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService } from '@core/cache/cache.service';
import { CRM_CACHE_KEYS } from '../crm.service';

/**
 * CrmCacheInvalidatorListener
 *
 * Subscribes to cross-module domain events that mutate customer state and
 * invalidates the relevant Redis cache keys so subsequent reads always
 * reflect the latest persisted data.
 *
 * Design rules:
 *  - Every handler is wrapped in try/catch.  A cache miss is always safe;
 *    a thrown error here must NEVER propagate to the caller.
 *  - Handlers are fire-and-forget; they do not return business data.
 *  - Only the minimum set of keys is invalidated to avoid thundering-herd.
 */
@Injectable()
export class CrmCacheInvalidatorListener {
  private readonly logger = new Logger(CrmCacheInvalidatorListener.name);

  constructor(private readonly cacheService: CacheService) {}

  // ─── payment.received ────────────────────────────────────────────────────
  // Emitted by the AR / finance module when a payment is matched to a customer.
  // Affects: currentDebt → credit key; wallet may also be debited → balance key.

  @OnEvent('payment.received')
  async onPaymentReceived(event: { customerId?: string }): Promise<void> {
    if (!event?.customerId) return;
    try {
      await Promise.all([
        this.cacheService.invalidate(CRM_CACHE_KEYS.balance(event.customerId)),
        this.cacheService.invalidate(CRM_CACHE_KEYS.credit(event.customerId)),
        this.cacheService.invalidate(CRM_CACHE_KEYS.profile(event.customerId)),
      ]);
      this.logger.debug(`Cache invalidated for payment.received: customer=${event.customerId}`);
    } catch (err) {
      this.logger.warn(`Cache invalidation failed on payment.received: ${err?.message}`);
    }
  }

  // ─── order.completed ─────────────────────────────────────────────────────
  // Emitted after an order finishes.  The CrmService.updateTier() call that
  // follows may change the tier/credit fields, but we pro-actively bust the
  // profile and credit caches here so callers don't read stale data in the
  // window between the event and the updateTier write.

  @OnEvent('order.completed')
  async onOrderCompleted(event: { customerId?: string }): Promise<void> {
    if (!event?.customerId) return;
    try {
      await Promise.all([
        this.cacheService.invalidate(CRM_CACHE_KEYS.profile(event.customerId)),
        this.cacheService.invalidate(CRM_CACHE_KEYS.credit(event.customerId)),
        this.cacheService.invalidate(CRM_CACHE_KEYS.balance(event.customerId)),
      ]);
      this.logger.debug(`Cache invalidated for order.completed: customer=${event.customerId}`);
    } catch (err) {
      this.logger.warn(`Cache invalidation failed on order.completed: ${err?.message}`);
    }
  }

  // ─── wallet.topup ────────────────────────────────────────────────────────
  // Emitted by CrmService.topupWallet() after the DB write.
  // CrmService already calls invalidate() inline; this listener handles
  // external topups (e.g. webhook-triggered) that bypass CrmService.

  @OnEvent('wallet.topup')
  async onWalletTopup(event: { customerId?: string }): Promise<void> {
    if (!event?.customerId) return;
    try {
      await this.cacheService.invalidate(CRM_CACHE_KEYS.balance(event.customerId));
      this.logger.debug(`Cache invalidated for wallet.topup: customer=${event.customerId}`);
    } catch (err) {
      this.logger.warn(`Cache invalidation failed on wallet.topup: ${err?.message}`);
    }
  }

  // ─── customer.tier.changed ───────────────────────────────────────────────
  // Emitted by CrmService.updateTier() after a successful upgrade.
  // CrmService invalidates profile + credit inline; here we ensure the global
  // tier-stats aggregation key is also busted so dashboards stay accurate.

  @OnEvent('customer.tier.changed')
  async onTierChanged(event: { customerId?: string }): Promise<void> {
    if (!event?.customerId) return;
    try {
      await Promise.all([
        this.cacheService.invalidate(CRM_CACHE_KEYS.profile(event.customerId)),
        this.cacheService.invalidate(CRM_CACHE_KEYS.credit(event.customerId)),
        this.cacheService.invalidate(CRM_CACHE_KEYS.tierStats()),
      ]);
      this.logger.debug(`Cache invalidated for customer.tier.changed: customer=${event.customerId}`);
    } catch (err) {
      this.logger.warn(`Cache invalidation failed on customer.tier.changed: ${err?.message}`);
    }
  }

  // ─── credit.changed ──────────────────────────────────────────────────────
  // Emitted when a manual credit limit override is applied (e.g. STRATEGIC tier set).

  @OnEvent('credit.changed')
  async onCreditChanged(event: { customerId?: string }): Promise<void> {
    if (!event?.customerId) return;
    try {
      await Promise.all([
        this.cacheService.invalidate(CRM_CACHE_KEYS.credit(event.customerId)),
        this.cacheService.invalidate(CRM_CACHE_KEYS.profile(event.customerId)),
      ]);
      this.logger.debug(`Cache invalidated for credit.changed: customer=${event.customerId}`);
    } catch (err) {
      this.logger.warn(`Cache invalidation failed on credit.changed: ${err?.message}`);
    }
  }
}
