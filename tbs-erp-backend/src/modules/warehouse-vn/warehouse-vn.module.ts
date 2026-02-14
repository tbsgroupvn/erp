import { Module } from '@nestjs/common';
import { WarehouseVNController } from './warehouse-vn.controller';
import { WarehouseVNService } from './warehouse-vn.service';
import { WarehouseVNRepository } from './warehouse-vn.repository';
import { DeliveryDispatchService } from './domain/delivery-dispatch.service';
import { ContainerArrivalListener } from './listeners/container-arrival.listener';

@Module({
  controllers: [WarehouseVNController],
  providers: [
    WarehouseVNService,
    WarehouseVNRepository,
    DeliveryDispatchService,
    ContainerArrivalListener,
  ],
  exports: [WarehouseVNService, DeliveryDispatchService],
})
export class WarehouseVNModule {}
