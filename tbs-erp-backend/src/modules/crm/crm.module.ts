import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CrmRepository } from './crm.repository';
import { CustomerTierService } from './domain/customer-tier.service';
import { WalletService } from './domain/wallet.service';
import { OrderCompletedListener } from './listeners/order-completed.listener';

@Module({
  controllers: [CrmController],
  providers: [
    CrmService,
    CrmRepository,
    CustomerTierService,
    WalletService,
    OrderCompletedListener,
  ],
  exports: [CrmService, CrmRepository, WalletService, CustomerTierService],
})
export class CrmModule {}
