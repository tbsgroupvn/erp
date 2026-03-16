import { Module } from '@nestjs/common';
import { OrderProjectController } from './order-project.controller';
import { OrderProjectService } from './order-project.service';
import { OrderProjectRepository } from './order-project.repository';
import { StageConfigService } from './domain/stage-config.service';
import { AssignmentEngineService } from './domain/assignment-engine.service';
import { AutoTaskEngineService } from './domain/auto-task-engine.service';
import { HandoffTrackerService } from './domain/handoff-tracker.service';
import { SLACheckerService } from './domain/sla-checker.service';
import { OrderStatusChangedListener } from './listeners/order-status-changed.listener';
import { SLABreachListener } from './listeners/sla-breach.listener';

/**
 * OrderProjectModule manages the project-management layer of the order lifecycle.
 *
 * It is independent from OrderModule — it listens to order events via EventEmitter2
 * and uses PrismaService and CacheService from the global providers registered in AppModule.
 *
 * Exported services:
 * - OrderProjectService — consumed by dashboard and reporting modules
 * - StageConfigService — consumed by admin/settings modules that manage stage configs
 * - AssignmentEngineService — may be consumed by custom escalation services
 */
@Module({
  controllers: [OrderProjectController],
  providers: [
    // Domain services
    StageConfigService,
    AssignmentEngineService,
    AutoTaskEngineService,
    HandoffTrackerService,
    SLACheckerService,
    // Repository and service
    OrderProjectRepository,
    OrderProjectService,
    // Event listeners
    OrderStatusChangedListener,
    SLABreachListener,
  ],
  exports: [
    OrderProjectService,
    StageConfigService,
    AssignmentEngineService,
  ],
})
export class OrderProjectModule {}
