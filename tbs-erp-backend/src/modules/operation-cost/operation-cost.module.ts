import { Module } from '@nestjs/common';
import { OperationCostController } from './operation-cost.controller';
import { OperationCostService } from './operation-cost.service';
import { CostAllocationService } from './domain/cost-allocation.service';

@Module({
  controllers: [OperationCostController],
  providers: [OperationCostService, CostAllocationService],
  exports: [OperationCostService, CostAllocationService],
})
export class OperationCostModule {}
