import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { ShippingCarrierService } from './shipping.service';

@Module({
  controllers: [ShippingController],
  providers: [ShippingCarrierService],
  exports: [ShippingCarrierService],
})
export class ShippingIntegrationModule {}
