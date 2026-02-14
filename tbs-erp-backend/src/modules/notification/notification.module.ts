import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { OrderEventsListener } from './listeners/order-events.listener';
import { PaymentEventsListener } from './listeners/payment-events.listener';
import { ApprovalEventsListener } from './listeners/approval-events.listener';
import { WarehouseEventsListener } from './listeners/warehouse-events.listener';

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    OrderEventsListener,
    PaymentEventsListener,
    ApprovalEventsListener,
    WarehouseEventsListener,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
