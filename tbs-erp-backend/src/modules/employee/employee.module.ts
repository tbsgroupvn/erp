import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeStatusListener } from './listeners/employee-status.listener';
import { TrainingCertExpiryService } from './training-cert-expiry.service';
import { NotificationModule } from '@modules/notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [EmployeeController],
  providers: [EmployeeService, EmployeeStatusListener, TrainingCertExpiryService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
