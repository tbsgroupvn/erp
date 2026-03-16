import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationRulesController } from './notification-rules.controller';
import { NotificationService } from './notification.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationRulesSeedService } from './notification-rules-seed.service';
import { RtoAgingReminderService } from './rto-aging-reminder.service';
import { EscalationService } from './escalation.service';
import { OrderEventsListener } from './listeners/order-events.listener';
import { OrderNotificationListener } from './listeners/order-notification.listener';
import { PaymentEventsListener } from './listeners/payment-events.listener';
import { ApprovalEventsListener } from './listeners/approval-events.listener';
import { WarehouseEventsListener } from './listeners/warehouse-events.listener';
import { MHHEventsListener } from './listeners/mhh-events.listener';
import { QuotationEventsListener } from './listeners/quotation-events.listener';
import { ContractEventsListener } from './listeners/contract-events.listener';
import { ContainerHoldBorderListener } from './listeners/container-hold-border.listener';
import { WeightVarianceListener } from './listeners/weight-variance.listener';
import { CashFlowListener } from './listeners/cash-flow.listener';
import { CustomsSplitListener } from './listeners/customs-split.listener';
import { ExtraChargeNotificationListener } from './listeners/extra-charge-notification.listener';
import { BulkyCwAlertListener } from './listeners/bulky-cw-alert.listener';
import { QcMhhBridgeListener } from './listeners/qc-mhh-bridge.listener';

@Module({
  controllers: [NotificationController, NotificationRulesController],
  providers: [
    NotificationService,
    NotificationRulesService,
    NotificationRulesSeedService,
    RtoAgingReminderService,
    EscalationService,
    OrderEventsListener,
    OrderNotificationListener,
    PaymentEventsListener,
    ApprovalEventsListener,
    WarehouseEventsListener,
    MHHEventsListener,
    QuotationEventsListener,
    ContractEventsListener,
    ContainerHoldBorderListener,
    WeightVarianceListener,
    CashFlowListener,
    CustomsSplitListener,
    ExtraChargeNotificationListener,
    BulkyCwAlertListener,
    QcMhhBridgeListener,
  ],
  exports: [NotificationService, NotificationRulesService],
})
export class NotificationModule {}
