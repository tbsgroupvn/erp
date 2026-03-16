import { Module } from '@nestjs/common';
import { NotificationModule } from '@modules/notification/notification.module';
import { OrderModule } from '@modules/order/order.module';
import { WarehouseVNController } from './warehouse-vn.controller';
import { WarehouseVNService } from './warehouse-vn.service';
import { WarehouseVNRepository } from './warehouse-vn.repository';
import { DeliveryDispatchService } from './domain/delivery-dispatch.service';
import { WarehouseVNStatusMachine } from './domain/warehouse-vn-status.machine';
import { ContainerArrivalListener } from './listeners/container-arrival.listener';
import { RtoNotificationListener } from './listeners/rto-notification.listener';
import { WarehouseVNStorageService } from './warehouse-vn-storage.service';
import { WarehouseVNInventoryService } from './warehouse-vn-inventory.service';

@Module({
  imports: [NotificationModule, OrderModule],
  controllers: [WarehouseVNController],
  providers: [
    WarehouseVNService,
    WarehouseVNRepository,
    DeliveryDispatchService,
    WarehouseVNStatusMachine,
    ContainerArrivalListener,
    RtoNotificationListener,
    WarehouseVNStorageService,
    WarehouseVNInventoryService,
  ],
  exports: [
    WarehouseVNService,
    DeliveryDispatchService,
    WarehouseVNStorageService,
    WarehouseVNInventoryService,
  ],
})
export class WarehouseVNModule {}
