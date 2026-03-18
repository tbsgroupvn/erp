import { Module } from '@nestjs/common';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { CashFlowGuardService } from './domain/cash-flow-guard.service';
import { PaymentVoucherValidator } from './domain/payment-voucher.validator';
import { VoucherStatusMachine } from './domain/voucher-status.machine';
import { ApprovalEventListener } from './listeners/approval-event.listener';
import { EventBusModule } from '@core/event-bus/event-bus.module';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';
import { GeneralLedgerModule } from '../general-ledger/general-ledger.module';

@Module({
  imports: [ExchangeRateModule, GeneralLedgerModule, EventBusModule],
  controllers: [CashController],
  providers: [
    CashService,
    CashFlowGuardService,
    PaymentVoucherValidator,
    VoucherStatusMachine,
    ApprovalEventListener,
  ],
  exports: [CashService, CashFlowGuardService],
})
export class CashModule {}
