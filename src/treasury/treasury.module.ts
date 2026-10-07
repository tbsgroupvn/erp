import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { MoneyModule } from '../money/money.module';
import { TreasuryController } from './treasury.controller';
import { TreasuryReadService } from './treasury-read.service';
import { TreasuryReportService } from './treasury-report.service';
import { FxQuyTeReader } from '../money/fx-quyte.reader';

// 09b đợt 1 Task 3 — ĐỌC sổ quỹ công ty qua HTTP. #09d L11 — báo cáo đọc (TreasuryReportService). TreasuryService (ghi) nằm ở MoneyModule và KHÔNG
// được nối vào bất kỳ route nào ở đợt 1.
@Module({
  imports: [IamModule, MoneyModule],
  providers: [TreasuryReadService, TreasuryReportService, FxQuyTeReader], // FxQuyTeReader: CHỈ ĐỌC (#09d L11 R8d)
  controllers: [TreasuryController],
})
export class TreasuryModule {}
