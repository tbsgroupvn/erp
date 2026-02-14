import { Module } from '@nestjs/common';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { PaymentVoucherValidator } from './domain/payment-voucher.validator';
import { ApprovalEventListener } from './listeners/approval-event.listener';

@Module({
  controllers: [CashController],
  providers: [CashService, PaymentVoucherValidator, ApprovalEventListener],
  exports: [CashService],
})
export class CashModule {}
