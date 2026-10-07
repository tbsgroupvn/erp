import { Module } from '@nestjs/common';
import { MoneyModule } from '../money/money.module';
import { BankIngestService } from './bank-ingest.service';
import { BankReconService } from './bank-recon.service';
import { BankReconController } from './bank-recon.controller';

// 09c L3 — nhận giao dịch SePay dạng SERVICE. ⛔ KHÔNG có route webhook: chờ Q9 (xác thực fail-closed).
// #09d L11 Task 3 — route CHỈ ĐỌC đối soát bank (`GET /bank/recon`, `GET /bank/fx-unaccounted`); không
// route ghi nào. Lưới test/auth/route-inventory.spec.ts canh mọi route có @RequirePerm.
@Module({
  imports: [MoneyModule],
  providers: [BankIngestService, BankReconService],
  controllers: [BankReconController],
  exports: [BankIngestService],
})
export class BankModule {}
