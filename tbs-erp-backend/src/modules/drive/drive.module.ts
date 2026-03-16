import { Module } from '@nestjs/common';
import { DriveController } from './drive.controller';
import { DriveService } from './drive.service';
import { DriveRepository } from './drive.repository';

@Module({
  controllers: [DriveController],
  providers: [DriveService, DriveRepository],
  exports: [DriveService],
})
export class DriveModule {}
