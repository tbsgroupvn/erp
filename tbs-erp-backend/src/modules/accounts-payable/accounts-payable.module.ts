import { Module } from '@nestjs/common';
import { AccountsPayableController } from './accounts-payable.controller';
import { AccountsPayableService } from './accounts-payable.service';
import { AccountsPayableRepository } from './accounts-payable.repository';
import { PurchaseEventListener } from './listeners/purchase-event.listener';

@Module({
  controllers: [AccountsPayableController],
  providers: [
    AccountsPayableService,
    AccountsPayableRepository,
    PurchaseEventListener,
  ],
  exports: [AccountsPayableService, AccountsPayableRepository],
})
export class AccountsPayableModule {}
