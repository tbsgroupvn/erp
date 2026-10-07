import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { PoService } from './po.service';
import { PoReceiptService } from './po-receipt.service';
import { QuotePoDiffService } from './quote-po-diff.service';
import { SuborderService } from './suborder.service';
import { OrderGenService } from './order-gen.service';
import { PoTienNccService } from './po-tien-ncc.service';
import { PoTienNccController } from './po-tien-ncc.controller';

// Chỉ import IamModule — đọc constructor từng service mới thấy đúng cái cần:
// `PoService` cần `ScopeService` (phạm vi xem PO theo sale, xem
// `PoService.listForUser`); `PoReceiptService`/`QuotePoDiffService` chỉ cần
// `PrismaService`, không đụng IAM. Cùng lối wiring với `QuoteModule`
// (src/quote/quote.module.ts) — IamModule đã `exports: [...ScopeService...]`
// sẵn, không cần thêm export nào ở đó.
//
// KHÔNG import `QuoteModule` ở đây dù `QuotePoDiffService` đọc bảng
// `tbl_quotes`/`tbl_quote_items`: nó đọc THẲNG qua `PrismaService`
// (không inject `QuoteService`), nên không có phụ thuộc DI nào tới module
// #05 — hai module độc lập nhau ở tầng Nest, chỉ chung CSDL.
//
// #06 đợt 2 (Task 4): `SuborderService`/`OrderGenService` (Task 2-3) cũng
// chỉ cần `PrismaService`, không đụng IAM — thêm vào CÙNG danh sách
// providers/exports, không cần import module nào mới. Task 2-3 để việc wiring
// này lại cho Task 4 có chủ đích (xem task-2-report.md/task-3-report.md mục
// "Did not touch po.module.ts" / phần Files touched).
//
// Review cuối (I-2): `OrderGenService` nay inject thêm `SuborderService` (cùng
// module) và CHỈ lộ `generateOrdersForPo` — điểm vào có cổng của
// process_gen_orders.php. Hàm lõi không cổng nằm ở order-gen.core.ts, KHÔNG
// phải provider, KHÔNG export (lưới test/po/order-gen-surface.spec.ts).
@Module({
  imports: [IamModule],
  // #09d L11 Task 3: PoTienNccService (CHỈ ĐỌC, cần ScopeService) + route GET /po/:id/tien-ncc.
  providers: [PoService, PoReceiptService, QuotePoDiffService, SuborderService, OrderGenService, PoTienNccService],
  controllers: [PoTienNccController],
  exports: [PoService, PoReceiptService, QuotePoDiffService, SuborderService, OrderGenService],
})
export class PoModule {}
