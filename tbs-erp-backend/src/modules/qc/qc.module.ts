import { Module } from '@nestjs/common';
import { QCController } from './qc.controller';
import { QCService } from './qc.service';
import { QCRepository } from './qc.repository';

@Module({
  controllers: [QCController],
  providers: [QCService, QCRepository],
  exports: [QCService],
})
export class QCModule {}
