import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { AccountsReceivableService } from './accounts-receivable.service';
import { AccountsReceivableRepository } from './accounts-receivable.repository';
import { OrderEventListener } from './listeners/order-event.listener';
import { AutoClearArListener } from './listeners/auto-clear-ar.listener';
import { AutoClearArService } from './auto-clear-ar.service';
import { ARAgingCalculatorService } from './ar-aging-calculator.service';
import { ARAgingSnapshotService } from './ar-aging-snapshot.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AccountsReceivableController],
  providers: [
    AccountsReceivableService,
    AccountsReceivableRepository,
    OrderEventListener,
    AutoClearArListener,
    AutoClearArService,
    ARAgingCalculatorService,
    ARAgingSnapshotService,
  ],
  exports: [AccountsReceivableService, AccountsReceivableRepository, AutoClearArService],
})
export class AccountsReceivableModule {}
