import { Module } from '@nestjs/common';
import { CommissionController } from './commission.controller';
import { CommissionService } from './commission.service';
import { CommissionCalculatorService } from './services/commission-calculator.service';
import { OrderCompletedListener } from './listeners/order-completed.listener';
import { ArPaymentListener } from './listeners/ar-payment.listener';

@Module({
  controllers: [CommissionController],
  providers: [
    CommissionService,
    CommissionCalculatorService,
    OrderCompletedListener,
    ArPaymentListener,
  ],
  exports: [CommissionService, CommissionCalculatorService],
})
export class CommissionModule {}
