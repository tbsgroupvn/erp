import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { QuotationController } from './quotation.controller';
import { QuotationService } from './quotation.service';
import { QuotationExportService } from './quotation-export.service';
import { QuotationStatusMachine } from './domain/quotation-status.machine';
import { ContractModule } from '@modules/contract/contract.module';
import { RateCardModule } from '@modules/rate-card/rate-card.module';
import { ExchangeRateModule } from '@modules/exchange-rate/exchange-rate.module';

@Module({
  imports: [ScheduleModule.forRoot(), ContractModule, RateCardModule, ExchangeRateModule],
  controllers: [QuotationController],
  providers: [QuotationService, QuotationExportService, QuotationStatusMachine],
  exports: [QuotationService],
})
export class QuotationModule {}
