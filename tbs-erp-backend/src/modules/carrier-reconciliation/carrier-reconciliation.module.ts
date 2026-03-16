import { Module } from '@nestjs/common';
import { CrmModule } from '@modules/crm/crm.module';
import { GeneralLedgerModule } from '@modules/general-ledger/general-ledger.module';
import { CarrierReconciliationController } from './carrier-reconciliation.controller';
import { CarrierReconciliationService } from './carrier-reconciliation.service';
import { ExcelParserService } from './domain/excel-parser.service';
import { CarrierMatcherService } from './domain/carrier-matcher.service';

@Module({
  imports: [CrmModule, GeneralLedgerModule],
  controllers: [CarrierReconciliationController],
  providers: [
    CarrierReconciliationService,
    ExcelParserService,
    CarrierMatcherService,
  ],
  exports: [CarrierReconciliationService],
})
export class CarrierReconciliationModule {}
