import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OperationCostController } from './operation-cost.controller';
import { OperationCostService } from './operation-cost.service';
import { CostAllocationService } from './domain/cost-allocation.service';
import { CostEnteredListener } from './listeners/cost-entered.listener';

@Module({
  imports: [BullModule.registerQueue({ name: 'finance-events' })],
  controllers: [OperationCostController],
  providers: [OperationCostService, CostAllocationService, CostEnteredListener],
  exports: [OperationCostService, CostAllocationService],
})
export class OperationCostModule {}
