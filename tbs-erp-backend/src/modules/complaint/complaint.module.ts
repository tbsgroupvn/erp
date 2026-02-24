import { Module } from '@nestjs/common';
import { ComplaintController } from './complaint.controller';
import { ComplaintService } from './complaint.service';
import { ComplaintStatusMachine } from './domain/complaint-status.machine';
import { ComplaintResolvedListener } from './listeners/complaint-resolved.listener';
import { CommissionModule } from '@modules/commission/commission.module';

@Module({
  imports: [CommissionModule],
  controllers: [ComplaintController],
  providers: [ComplaintService, ComplaintStatusMachine, ComplaintResolvedListener],
  exports: [ComplaintService],
})
export class ComplaintModule {}
