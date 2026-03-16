import { Module } from '@nestjs/common';
import { OKRController } from './okr.controller';
import { OKRService } from './okr.service';
import { OKRRepository } from './okr.repository';

@Module({
  controllers: [OKRController],
  providers: [OKRService, OKRRepository],
  exports: [OKRService],
})
export class OKRModule {}
