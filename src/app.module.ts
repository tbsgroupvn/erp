import { Module } from '@nestjs/common';
import { MoneyModule } from './money/money.module';
import { IamModule } from './iam/iam.module';
import { ApprovalModule } from './approval/approval.module';
import { MasterDataModule } from './masterdata/masterdata.module';
import { QuoteModule } from './quote/quote.module';
import { PoModule } from './po/po.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { CustomsModule } from './customs/customs.module';
import { AuthModule } from './auth/auth.module';
import { SupplierPaymentModule } from './supplier-payment/supplier-payment.module';
import { TreasuryModule } from './treasury/treasury.module';
import { BankModule } from './bank/bank.module';

// ⚠ `AppController`/`AppService` (route `GET /` trả 'Hello World!' — mã khung do
// `nest new` sinh ra) ĐÃ BỊ XOÁ 23/09/2026. Lý do: nó là route DUY NHẤT của app
// không mang `@Public()` lẫn `@RequirePerm` ⇒ lọt qua `PermGuard` nhờ nhánh
// `if (!need) return true` (F-3 của review cuối nhánh feat/api-dot1). Hai lối
// thoát khả dĩ đều tệ hơn: gắn `@Public()` là MỞ RỘNG bề mặt công khai cho một
// route không có giá trị nghiệp vụ; bịa một mã quyền cho 'Hello World!' là rác.
// Route không tồn tại thì không thể hở. Lưới `test/auth/route-inventory.spec.ts`
// canh để không ai thêm lại một route không khai quyền.
import { PrismaModule } from './prisma/prisma.module';

@Module({
  // AuthModule đăng ký 2 guard toàn cục (JwtAuthGuard rồi PermGuard) qua APP_GUARD
  // ⇒ TOÀN BỘ endpoint dưới đây mặc định ĐÓNG, trừ khi có @Public().
  imports: [PrismaModule, MoneyModule, IamModule, ApprovalModule, MasterDataModule, QuoteModule, PoModule, WarehouseModule, CustomsModule, SupplierPaymentModule, TreasuryModule, BankModule, AuthModule],
})
export class AppModule {}
