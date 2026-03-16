import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceGpsController } from './attendance-gps.controller';
import { AttendanceGpsService } from './attendance-gps.service';

@Module({
  controllers: [AttendanceController, AttendanceGpsController],
  providers: [AttendanceService, AttendanceGpsService],
  exports: [AttendanceService, AttendanceGpsService],
})
export class AttendanceModule {}
