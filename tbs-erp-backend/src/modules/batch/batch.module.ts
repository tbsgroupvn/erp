import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationModule } from '@modules/notification/notification.module';
import { BatchController } from './batch.controller';
import { BatchJobProcessor } from './batch-job.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'batch-jobs' }),
    NotificationModule,
  ],
  controllers: [BatchController],
  providers: [BatchJobProcessor],
  exports: [],
})
export class BatchModule {}
