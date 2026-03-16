import { Module } from '@nestjs/common';
import { GeneralLedgerModule } from '@modules/general-ledger/general-ledger.module';
import { CommissionModule } from '@modules/commission/commission.module';
import { CostAdjustmentController } from './cost-adjustment.controller';
import { CostAdjustmentService } from './cost-adjustment.service';

@Module({
  imports: [GeneralLedgerModule, CommissionModule],
  controllers: [CostAdjustmentController],
  providers: [CostAdjustmentService],
  exports: [CostAdjustmentService],
})
export class CostAdjustmentModule {}
