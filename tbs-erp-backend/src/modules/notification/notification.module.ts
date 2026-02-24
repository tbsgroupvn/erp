import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { OrderEventsListener } from './listeners/order-events.listener';
import { PaymentEventsListener } from './listeners/payment-events.listener';
import { ApprovalEventsListener } from './listeners/approval-events.listener';
import { WarehouseEventsListener } from './listeners/warehouse-events.listener';
import { MHHEventsListener } from './listeners/mhh-events.listener';
import { QuotationEventsListener } from './listeners/quotation-events.listener';
import { ContractEventsListener } from './listeners/contract-events.listener';
import { ContainerHoldBorderListener } from './listeners/container-hold-border.listener';
import { WeightVarianceListener } from './listeners/weight-variance.listener';

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    OrderEventsListener,
    PaymentEventsListener,
    ApprovalEventsListener,
    WarehouseEventsListener,
    MHHEventsListener,
    QuotationEventsListener,
    ContractEventsListener,
    ContainerHoldBorderListener,
    WeightVarianceListener,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
