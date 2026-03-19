import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { ApprovalRepository } from './approval.repository';
import { ApprovalGraphEngine } from './domain/approval-graph-engine';
import { ConditionEvaluator } from './domain/condition-evaluator';
import { ApproverResolver } from './domain/approver-resolver';
import { SlaTracker } from './domain/sla-tracker';
import { ApprovalCompletedListener } from './listeners/approval-completed.listener';
import { ApprovalSlaListener } from './listeners/approval-sla.listener';
import { ApprovalEscalationListener } from './listeners/approval-escalation.listener';
import { FlowDefinitionController } from './flow-definition/flow-definition.controller';
import { FlowDefinitionService } from './flow-definition/flow-definition.service';
import { FlowDefinitionRepository } from './flow-definition/flow-definition.repository';
import { DelegationController } from './delegation/delegation.controller';
import { DelegationService } from './delegation/delegation.service';
import { ApprovalTemplateController } from './template/approval-template.controller';
import { ApprovalTemplateService } from './template/approval-template.service';
import { ApprovalAnalyticsService } from './analytics/approval-analytics.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    ApprovalController,
    FlowDefinitionController,
    DelegationController,
    ApprovalTemplateController,
  ],
  providers: [
    // Core services
    ApprovalService,
    ApprovalRepository,

    // Graph engine (sole engine)
    ApprovalGraphEngine,
    ConditionEvaluator,
    ApproverResolver,
    SlaTracker,

    // Flow definition
    FlowDefinitionService,
    FlowDefinitionRepository,

    // Delegation
    DelegationService,

    // Templates
    ApprovalTemplateService,

    // Analytics
    ApprovalAnalyticsService,

    // Listeners
    ApprovalCompletedListener,
    ApprovalSlaListener,
    ApprovalEscalationListener,
  ],
  exports: [ApprovalService, ApprovalGraphEngine, ApprovalAnalyticsService],
})
export class ApprovalModule {}
