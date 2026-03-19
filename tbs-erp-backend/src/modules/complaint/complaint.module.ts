import { Module } from '@nestjs/common';
import { ComplaintController } from './complaint.controller';
import { ComplaintService } from './complaint.service';
import { ComplaintStatusMachine } from './domain/complaint-status.machine';
import { ComplaintResolvedListener } from './listeners/complaint-resolved.listener';
import { EventBusModule } from '@core/event-bus/event-bus.module';
import { CommissionModule } from '@modules/commission/commission.module';
import { RbacModule } from '@core/rbac/rbac.module';

@Module({
  imports: [CommissionModule, EventBusModule, RbacModule],
  controllers: [ComplaintController],
  providers: [ComplaintService, ComplaintStatusMachine, ComplaintResolvedListener],
  exports: [ComplaintService],
})
export class ComplaintModule {}
