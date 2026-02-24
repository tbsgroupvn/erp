import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CrmRepository } from './crm.repository';
import { CustomerTierService } from './domain/customer-tier.service';
import { WalletService } from './domain/wallet.service';
import { GracePeriodService } from './domain/grace-period.service';
import { CreditOverdraftService } from './domain/credit-overdraft.service';
import { OrderCompletedListener } from './listeners/order-completed.listener';
import { GracePeriodApprovalListener } from './listeners/grace-period-approval.listener';

@Module({
  controllers: [CrmController],
  providers: [
    CrmService,
    CrmRepository,
    CustomerTierService,
    WalletService,
    GracePeriodService,
    CreditOverdraftService,
    OrderCompletedListener,
    GracePeriodApprovalListener,
  ],
  exports: [CrmService, CrmRepository, WalletService, CustomerTierService, GracePeriodService, CreditOverdraftService],
})
export class CrmModule {}
