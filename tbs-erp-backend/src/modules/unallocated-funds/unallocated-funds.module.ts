import { Module } from '@nestjs/common';
import { UnallocatedFundsController } from './unallocated-funds.controller';
import { UnallocatedFundsService } from './unallocated-funds.service';

@Module({
  controllers: [UnallocatedFundsController],
  providers: [UnallocatedFundsService],
  exports: [UnallocatedFundsService],
})
export class UnallocatedFundsModule {}
