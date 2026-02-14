import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TrackingProviderService } from './domain/tracking-provider.service';

@Module({
  controllers: [TrackingController],
  providers: [TrackingService, TrackingProviderService],
  exports: [TrackingService, TrackingProviderService],
})
export class TrackingModule {}
