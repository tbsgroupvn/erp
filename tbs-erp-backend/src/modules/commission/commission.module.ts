import { Module } from '@nestjs/common';
import { CommissionController } from './commission.controller';
import { CommissionService } from './commission.service';
import { CommissionCalculatorService } from './services/commission-calculator.service';
import { OrderCompletedListener } from './listeners/order-completed.listener';
import { ArPaymentListener } from './listeners/ar-payment.listener';
import { OrderClawbackListener } from './listeners/order-clawback.listener';
import { OrderAmountAdjustedListener } from './listeners/order-amount-adjusted.listener';

@Module({
  controllers: [CommissionController],
  providers: [
    CommissionService,
    CommissionCalculatorService,
    OrderCompletedListener,
    ArPaymentListener,
    OrderClawbackListener,
    OrderAmountAdjustedListener,
  ],
  exports: [CommissionService, CommissionCalculatorService],
})
export class CommissionModule {}
