import { Module } from '@nestjs/common';
import { ContainerController } from './container.controller';
import { ContainerService } from './container.service';
import { ContainerRepository } from './container.repository';
import { ConsolidationService } from './domain/consolidation.service';
import { ContainerStatusMachine } from './domain/container-status.machine';
import { CustomsSplitService } from './domain/customs-split.service';
import { PackageEventListener } from './listeners/package-event.listener';

@Module({
  controllers: [ContainerController],
  providers: [
    ContainerService,
    ContainerRepository,
    ConsolidationService,
    ContainerStatusMachine,
    CustomsSplitService,
    PackageEventListener,
  ],
  exports: [ContainerService, ConsolidationService],
})
export class ContainerModule {}
