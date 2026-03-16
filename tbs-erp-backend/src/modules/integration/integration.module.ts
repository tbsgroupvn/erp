import { DynamicModule, Logger, Module } from '@nestjs/common';
import { CustomsModule } from './customs/customs.module';
import { AccountingIntegrationModule } from './accounting/accounting.module';
import { BankingIntegrationModule } from './banking/banking.module';
import { ShippingIntegrationModule } from './shipping/shipping.module';
import { LarkSuiteModule } from './larksuite/larksuite.module';
import { WebhookModule } from './webhook/webhook.module';
import { SyncEngineModule } from './sync/sync-engine.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { OutboxSyncListener } from './listeners/outbox-sync.listener';

/**
 * Master integration module that conditionally registers sub-modules
 * based on environment configuration.
 *
 * Each integration can be independently enabled/disabled via environment variables:
 * - CUSTOMS_INTEGRATION_ENABLED=true
 * - ACCOUNTING_INTEGRATION_ENABLED=true
 * - BANKING_INTEGRATION_ENABLED=true
 * - SHIPPING_INTEGRATION_ENABLED=true
 * - LARK_INTEGRATION_ENABLED=true
 *
 * When disabled, the sub-module is still loaded (so DTOs and interfaces are available)
 * but the service methods will throw NotImplementedException with helpful messages.
 *
 * Always-on modules:
 * - WebhookModule: Webhook endpoint management and reliable delivery
 * - SyncEngineModule: Bidirectional data synchronization with external systems
 */
@Module({})
export class IntegrationModule {
  private static readonly logger = new Logger(IntegrationModule.name);

  static forRoot(): DynamicModule {
    const imports: any[] = [];

    // Always import all integration modules so their controllers are registered.
    // Each service internally checks if it's enabled and throws NotImplementedException
    // if not configured. This approach ensures Swagger docs are always available
    // and provides clear error messages when integrations are not yet configured.
    imports.push(
      CustomsModule,
      AccountingIntegrationModule,
      BankingIntegrationModule,
      ShippingIntegrationModule,
      LarkSuiteModule,

      // Webhook, sync, and reconciliation are always-on infrastructure modules
      WebhookModule,
      SyncEngineModule,
      ReconciliationModule,
    );

    return {
      module: IntegrationModule,
      imports,
      providers: [OutboxSyncListener],
      exports: [
        CustomsModule,
        AccountingIntegrationModule,
        BankingIntegrationModule,
        ShippingIntegrationModule,
        LarkSuiteModule,
        WebhookModule,
        SyncEngineModule,
        ReconciliationModule,
      ],
    };
  }
}
