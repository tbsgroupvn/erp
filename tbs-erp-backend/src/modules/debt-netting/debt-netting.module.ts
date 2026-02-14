import { Module } from '@nestjs/common';
import { DebtNettingController } from './debt-netting.controller';
import { DebtNettingService } from './debt-netting.service';

@Module({
  controllers: [DebtNettingController],
  providers: [DebtNettingService],
  exports: [DebtNettingService],
})
export class DebtNettingModule {}
