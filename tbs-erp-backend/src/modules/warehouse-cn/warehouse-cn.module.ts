import { Module } from '@nestjs/common';
import { WarehouseCNController } from './warehouse-cn.controller';
import { WarehouseCNService } from './warehouse-cn.service';
import { WarehouseCNRepository } from './warehouse-cn.repository';
import { ChargeableWeightService } from './domain/chargeable-weight.service';
import { PreAlertMatchingService } from './domain/pre-alert-matching.service';
import { WarehouseCNStatusMachine } from './domain/warehouse-cn-status.machine';
import { ContainerEventListener } from './listeners/container-event.listener';
import { BarcodeValidatorService } from './domain/barcode-validator.service';

@Module({
  controllers: [WarehouseCNController],
  providers: [
    WarehouseCNService,
    WarehouseCNRepository,
    ChargeableWeightService,
    PreAlertMatchingService,
    WarehouseCNStatusMachine,
    ContainerEventListener,
    BarcodeValidatorService,
  ],
  exports: [WarehouseCNService, ChargeableWeightService, BarcodeValidatorService],
})
export class WarehouseCNModule {}
