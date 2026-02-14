import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { AccountsReceivableService } from './accounts-receivable.service';
import { AccountsReceivableRepository } from './accounts-receivable.repository';
import { OrderEventListener } from './listeners/order-event.listener';
import { ARAgingCalculatorService } from './ar-aging-calculator.service';
import { ARAgingSnapshotService } from './ar-aging-snapshot.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AccountsReceivableController],
  providers: [
    AccountsReceivableService,
    AccountsReceivableRepository,
    OrderEventListener,
    ARAgingCalculatorService,
    ARAgingSnapshotService,
  ],
  exports: [AccountsReceivableService, AccountsReceivableRepository],
})
export class AccountsReceivableModule {}
