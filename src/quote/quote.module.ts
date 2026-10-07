import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { VatService } from './vat.service';
import { ImportTaxService } from './import-tax.service';
import { QuoteService } from './quote.service';

// Chỉ import IamModule — đọc constructor QuoteService mới thấy đúng cái cần:
// ScopeService (phạm vi xem báo giá theo sale, xem QuoteService.listForUser).
// IamModule đã `exports: [...ScopeService...]` sẵn (xem iam.module.ts) — không
// cần thêm export nào ở đó.
//
// VatService/ImportTaxService: KHÔNG có service nào trong module này inject
// chúng qua DI hiện tại — `quote-calc.ts` (hàm THUẦN, xem file đó) tự dựng
// một `ImportTaxService` module-level singleton bằng `new`, không qua Nest DI,
// để calcItem() giữ được là hàm thuần không cần DI. Vẫn khai báo cả hai ở đây
// làm provider/export theo đúng brief Task 9 (Providers: // VatService, ImportTaxService, QuoteService) — chúng là bề mặt public của
// module #05 mà #06 (PO) hay endpoint tính thuế riêng sẽ cần inject thẳng.
@Module({
  imports: [IamModule],
  providers: [VatService, ImportTaxService, QuoteService],
  exports: [VatService, ImportTaxService, QuoteService],
})
export class QuoteModule {}
