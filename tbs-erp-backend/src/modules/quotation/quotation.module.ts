import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { QuotationController } from './quotation.controller';
import { QuotationService } from './quotation.service';
import { QuotationExportService } from './quotation-export.service';
import { QuotationStatusMachine } from './domain/quotation-status.machine';
import { ContractModule } from '@modules/contract/contract.module';

@Module({
  imports: [ScheduleModule.forRoot(), ContractModule],
  controllers: [QuotationController],
  providers: [QuotationService, QuotationExportService, QuotationStatusMachine],
  exports: [QuotationService],
})
export class QuotationModule {}
