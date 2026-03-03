import { Module } from '@nestjs/common';
import { CrmModule } from '../../crm/crm.module';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { BankWebhookController } from './bank-webhook.controller';
import { BankWebhookService } from './bank-webhook.service';

@Module({
  imports: [CrmModule],
  controllers: [BankingController, BankWebhookController],
  providers: [BankingService, BankWebhookService],
  exports: [BankingService, BankWebhookService],
})
export class BankingIntegrationModule {}
