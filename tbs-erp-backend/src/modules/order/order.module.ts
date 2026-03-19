import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { MasterOrderController } from './master-order.controller';
import { ServiceFeeConfigController } from './service-fee-config.controller';
import { OrderService } from './order.service';
import { OrderStatusService } from './order-status.service';
import { OrderCancellationService } from './order-cancellation.service';
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
import { PenaltyCalculatorService } from './domain/penalty-calculator.service';
import { ReturnRequestService } from './domain/return-request.service';
import { PaymentReceivedListener } from './listeners/payment-received.listener';
import { WarehouseUpdatedListener } from './listeners/warehouse-updated.listener';
import { CancelApprovalListener } from './listeners/cancel-approval.listener';
import { ReturnApprovalListener } from './listeners/return-approval.listener';
import { ExtraChargeApprovalListener } from './listeners/extra-charge-approval.listener';
import { MhhIssueResolutionListener } from './listeners/mhh-issue-resolution.listener';
import { CreditCheckGuard } from './guards/credit-check.guard';
import { OrderCompletionSaga } from './sagas/order-completion.saga';
import { ServiceFeeConfigService } from './service-fee-config.service';
import { AccountsReceivableModule } from '@modules/accounts-receivable/accounts-receivable.module';
import { ExchangeRateModule } from '@modules/exchange-rate/exchange-rate.module';
import { CustomsDeclarationModule } from '@modules/customs-declaration/customs-declaration.module';
import { CrmModule } from '@modules/crm/crm.module';
import { ApprovalModule } from '@modules/approval/approval.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { CacheModule } from '@core/cache/cache.module';
import { EventBusModule } from '@core/event-bus/event-bus.module';
import { RbacModule } from '@core/rbac/rbac.module';

@Module({
  imports: [
    CacheModule,
    EventBusModule,
    RbacModule,
    AccountsReceivableModule,
    ExchangeRateModule,
    CustomsDeclarationModule,
    CrmModule,
    ApprovalModule,
    NotificationModule,
  ],
  controllers: [OrderController, MasterOrderController, ServiceFeeConfigController],
  providers: [
    OrderService,
    OrderStatusService,
    OrderCancellationService,
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
    CancelApprovalListener,
    ReturnApprovalListener,
    ExtraChargeApprovalListener,
    MhhIssueResolutionListener,
    PenaltyCalculatorService,
    ReturnRequestService,
    CreditCheckGuard,
    OrderCompletionSaga,
    ServiceFeeConfigService,
  ],
  exports: [
    OrderService,
    OrderStatusService,
    OrderCancellationService,
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
    PenaltyCalculatorService,
    ReturnRequestService,
  ],
})
export class OrderModule {}
