import { Module } from '@nestjs/common';
import { LarkSuiteController } from './larksuite.controller';
import { LarkSuiteService } from './larksuite.service';

@Module({
  controllers: [LarkSuiteController],
  providers: [LarkSuiteService],
  exports: [LarkSuiteService],
})
export class LarkSuiteModule {}
