import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { MasterOrderController } from './master-order.controller';
import { OrderService } from './order.service';
import { MasterOrderService } from './master-order.service';
import { OrderRepository } from './order.repository';
import { MasterOrderRepository } from './master-order.repository';
import { OrderStatusMachine } from './domain/order-status.machine';
import { DepositGateService } from './domain/deposit-gate.service';
import { PaymentPriorityService } from './domain/payment-priority.service';
import { MHHPriceCalculatorService } from './domain/mhh-price-calculator.service';
import { MHHIssueService } from './domain/mhh-issue.service';
import { PaymentReceivedListener } from './listeners/payment-received.listener';
import { WarehouseUpdatedListener } from './listeners/warehouse-updated.listener';
import { CreditCheckGuard } from './guards/credit-check.guard';
import { AccountsReceivableModule } from '@modules/accounts-receivable/accounts-receivable.module';

@Module({
  imports: [AccountsReceivableModule],
  controllers: [OrderController, MasterOrderController],
  providers: [
    OrderService,
    MasterOrderService,
    OrderRepository,
    MasterOrderRepository,
    OrderStatusMachine,
    DepositGateService,
    PaymentPriorityService,
    MHHPriceCalculatorService,
    MHHIssueService,
    PaymentReceivedListener,
    WarehouseUpdatedListener,
    CreditCheckGuard,
  ],
  exports: [
    OrderService,
    MasterOrderService,
    OrderStatusMachine,
    DepositGateService,
    PaymentPriorityService,
    MHHPriceCalculatorService,
    MHHIssueService,
  ],
})
export class OrderModule {}
