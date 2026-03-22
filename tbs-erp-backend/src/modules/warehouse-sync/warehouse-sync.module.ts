import { Module } from '@nestjs/common';
import { NotificationModule } from '@modules/notification/notification.module';
import { WarehouseSyncService } from './warehouse-sync.service';

@Module({
  imports: [NotificationModule],
  providers: [WarehouseSyncService],
  exports: [WarehouseSyncService],
})
export class WarehouseSyncModule {}
