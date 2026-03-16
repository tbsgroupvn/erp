import { Module } from '@nestjs/common';
import { GeneralLedgerController } from './general-ledger.controller';
import { GeneralLedgerService } from './general-ledger.service';
import { ExchangeRateGLService } from './exchange-rate-gl.service';
import { PeriodClosingService } from './period-closing.service';
import { VasReportService } from './vas-report.service';
import { VasExcelExportService } from './vas-excel-export.service';

@Module({
  controllers: [GeneralLedgerController],
  providers: [
    GeneralLedgerService,
    ExchangeRateGLService,
    PeriodClosingService,
    VasReportService,
    VasExcelExportService,
  ],
  exports: [
    GeneralLedgerService,
    ExchangeRateGLService,
    PeriodClosingService,
    VasReportService,
    VasExcelExportService,
  ],
})
export class GeneralLedgerModule {}
