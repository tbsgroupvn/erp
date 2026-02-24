import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { MasterOrderController } from './master-order.controller';
import { ServiceFeeConfigController } from './service-fee-config.controller';
import { OrderService } from './order.service';
import { MasterOrderService } from './master-order.service';
import { OrderRepository } from './order.repository';
import { MasterOrderRepository } from './master-order.repository';
import { OrderReadService } from './order-read.service';
import { OrderStatusMachine } from './domain/order-status.machine';
import { DepositGateService } from './domain/deposit-gate.service';
import { PaymentPriorityService } from './domain/payment-priority.service';
import { MHHPriceCalculatorService } from './domain/mhh-price-calculator.service';
import { MHHIssueService } from './domain/mhh-issue.service';
import { ExtraChargeService } from './domain/extra-charge.service';
import { ThreeWayMatchingService } from './domain/three-way-matching.service';
import { PaymentReceivedListener } from './listeners/payment-received.listener';
import { WarehouseUpdatedListener } from './listeners/warehouse-updated.listener';
import { CreditCheckGuard } from './guards/credit-check.guard';
import { OrderCompletionSaga } from './sagas/order-completion.saga';
import { ServiceFeeConfigService } from './service-fee-config.service';
import { AccountsReceivableModule } from '@modules/accounts-receivable/accounts-receivable.module';
import { ExchangeRateModule } from '@modules/exchange-rate/exchange-rate.module';

@Module({
  imports: [AccountsReceivableModule, ExchangeRateModule],
  controllers: [OrderController, MasterOrderController, ServiceFeeConfigController],
  providers: [
    OrderService,
    MasterOrderService,
    OrderRepository,
    MasterOrderRepository,
    OrderReadService,
    OrderStatusMachine,
    DepositGateService,
    PaymentPriorityService,
    MHHPriceCalculatorService,
    MHHIssueService,
    ExtraChargeService,
    ThreeWayMatchingService,
    PaymentReceivedListener,
    WarehouseUpdatedListener,
    CreditCheckGuard,
    OrderCompletionSaga,
    ServiceFeeConfigService,
  ],
  exports: [
    OrderService,
    MasterOrderService,
    OrderReadService,
    OrderStatusMachine,
    DepositGateService,
    PaymentPriorityService,
    MHHPriceCalculatorService,
    MHHIssueService,
    ExtraChargeService,
    ThreeWayMatchingService,
    OrderCompletionSaga,
    ServiceFeeConfigService,
  ],
})
export class OrderModule {}
