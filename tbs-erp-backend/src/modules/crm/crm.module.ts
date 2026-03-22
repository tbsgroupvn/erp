import { Module } from '@nestjs/common';
import { RbacModule } from '@core/rbac/rbac.module';
import { CacheModule } from '@core/cache/cache.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CrmRepository } from './crm.repository';
import { CustomerTierService } from './domain/customer-tier.service';
import { WalletService } from './domain/wallet.service';
import { GracePeriodService } from './domain/grace-period.service';
import { CreditOverdraftService } from './domain/credit-overdraft.service';
import { CustomerAnalyticsService } from './domain/customer-analytics.service';
import { OrderCompletedListener } from './listeners/order-completed.listener';
import { GracePeriodApprovalListener } from './listeners/grace-period-approval.listener';
import { ChurnAlertListener } from './listeners/churn-alert.listener';
import { CrmCacheInvalidatorListener } from './listeners/crm-cache-invalidator.listener';
import { LeadService } from './lead.service';
import { InteractionNoteService } from './interaction-note.service';
import { CustomerSupportViewService } from './customer-support-view.service';

// ScheduleModule.forRoot() da duoc dang ky tai AppModule — khong import lai o day

@Module({
  imports: [RbacModule, CacheModule],
  controllers: [CrmController],
  providers: [
    CrmService,
    CrmRepository,
    CustomerTierService,
    WalletService,
    GracePeriodService,
    CreditOverdraftService,
    CustomerAnalyticsService,
    OrderCompletedListener,
    GracePeriodApprovalListener,
    ChurnAlertListener,
    CrmCacheInvalidatorListener,
    LeadService,
    InteractionNoteService,
    CustomerSupportViewService,
  ],
  exports: [
    CrmService,
    CrmRepository,
    WalletService,
    CustomerTierService,
    GracePeriodService,
    CreditOverdraftService,
    CustomerAnalyticsService,
    LeadService,
    InteractionNoteService,
    CustomerSupportViewService,
  ],
})
export class CrmModule {}
