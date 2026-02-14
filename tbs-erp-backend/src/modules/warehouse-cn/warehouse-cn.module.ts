import { Module } from '@nestjs/common';
import { WarehouseCNController } from './warehouse-cn.controller';
import { WarehouseCNService } from './warehouse-cn.service';
import { WarehouseCNRepository } from './warehouse-cn.repository';
import { ChargeableWeightService } from './domain/chargeable-weight.service';
import { PreAlertMatchingService } from './domain/pre-alert-matching.service';
import { ContainerEventListener } from './listeners/container-event.listener';

@Module({
  controllers: [WarehouseCNController],
  providers: [
    WarehouseCNService,
    WarehouseCNRepository,
    ChargeableWeightService,
    PreAlertMatchingService,
    ContainerEventListener,
  ],
  exports: [WarehouseCNService, ChargeableWeightService],
})
export class WarehouseCNModule {}
