import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { InvoiceTaxService } from './invoice-tax.service';

@Module({
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceTaxService],
  exports: [InvoiceService, InvoiceTaxService],
})
export class InvoiceModule {}
