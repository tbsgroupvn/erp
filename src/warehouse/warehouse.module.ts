import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { KhoTqReceiptService } from './khotq-receipt.service';
import { PackingLotService } from './packing-lot.service';
import { TransportFileService } from './transport-file.service';
import { PackageIssueService } from './package-issue.service';

// Chỉ import IamModule — đọc constructor từng service mới thấy đúng cái cần
// (cùng lối wiring QuoteModule/PoModule): `KhoTqReceiptService` cần
// `ScopeService` (phạm vi xem theo kho — nhánh `warehouse` của
// `ScopeService.buildDocScope`, xem khotq-receipt.service.ts). Ba service
// còn lại (`PackingLotService`, `TransportFileService`, `PackageIssueService`)
// chỉ cần `PrismaService`, không đụng IAM — IamModule đã `exports:
// [...ScopeService...]` sẵn, không cần thêm export nào ở đó.
@Module({
  imports: [IamModule],
  providers: [KhoTqReceiptService, PackingLotService, TransportFileService, PackageIssueService],
  exports: [KhoTqReceiptService, PackingLotService, TransportFileService, PackageIssueService],
})
export class WarehouseModule {}
