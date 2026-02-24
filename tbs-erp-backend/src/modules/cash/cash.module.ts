import { Module } from '@nestjs/common';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { PaymentVoucherValidator } from './domain/payment-voucher.validator';
import { VoucherStatusMachine } from './domain/voucher-status.machine';
import { ApprovalEventListener } from './listeners/approval-event.listener';

@Module({
  controllers: [CashController],
  providers: [CashService, PaymentVoucherValidator, VoucherStatusMachine, ApprovalEventListener],
  exports: [CashService],
})
export class CashModule {}
