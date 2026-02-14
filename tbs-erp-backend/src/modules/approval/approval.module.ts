import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { ApprovalRepository } from './approval.repository';
import { ApprovalEngine } from './domain/approval-engine';
import { ApprovalGraphEngine } from './domain/approval-graph-engine';
import { ConditionEvaluator } from './domain/condition-evaluator';
import { ApproverResolver } from './domain/approver-resolver';
import { SlaTracker } from './domain/sla-tracker';
import { DiscountApprovalFlow } from './domain/approval-flows/discount.flow';
import { PaymentApprovalFlow } from './domain/approval-flows/payment.flow';
import { CancelOrderApprovalFlow } from './domain/approval-flows/cancel-order.flow';
import { ApprovalCompletedListener } from './listeners/approval-completed.listener';
import { ApprovalSlaListener } from './listeners/approval-sla.listener';
import { FlowDefinitionController } from './flow-definition/flow-definition.controller';
import { FlowDefinitionService } from './flow-definition/flow-definition.service';
import { FlowDefinitionRepository } from './flow-definition/flow-definition.repository';
import { DelegationController } from './delegation/delegation.controller';
import { DelegationService } from './delegation/delegation.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    ApprovalController,
    FlowDefinitionController,
    DelegationController,
  ],
  providers: [
    // Core services
    ApprovalService,
    ApprovalRepository,

    // Legacy engine
    ApprovalEngine,
    DiscountApprovalFlow,
    PaymentApprovalFlow,
    CancelOrderApprovalFlow,

    // Graph engine
    ApprovalGraphEngine,
    ConditionEvaluator,
    ApproverResolver,
    SlaTracker,

    // Flow definition
    FlowDefinitionService,
    FlowDefinitionRepository,

    // Delegation
    DelegationService,

    // Listeners
    ApprovalCompletedListener,
    ApprovalSlaListener,
  ],
  exports: [ApprovalService, ApprovalEngine, ApprovalGraphEngine],
})
export class ApprovalModule {}
