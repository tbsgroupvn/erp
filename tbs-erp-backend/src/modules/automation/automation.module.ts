import { Module } from '@nestjs/common';
import { EmailModule } from '@core/email/email.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { AutomationEngineService } from './automation-engine.service';

@Module({
  imports: [EmailModule],
  controllers: [AutomationController],
  providers: [AutomationService, AutomationEngineService],
  exports: [AutomationEngineService],
})
export class AutomationModule {}
