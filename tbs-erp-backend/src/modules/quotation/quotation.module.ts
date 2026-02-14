import { Module } from '@nestjs/common';
import { QuotationController } from './quotation.controller';
import { QuotationService } from './quotation.service';
import { QuotationExportService } from './quotation-export.service';

@Module({
  controllers: [QuotationController],
  providers: [QuotationService, QuotationExportService],
  exports: [QuotationService],
})
export class QuotationModule {}
