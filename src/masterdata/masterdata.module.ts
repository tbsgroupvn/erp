import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { CustomerCodeService } from './customer-code.service';
import { CustomerService } from './customer.service';
import { CustomerPortalService } from './customer-portal.service';
import { CatalogService } from './catalog.service';
import { SupplierService } from './supplier.service';

// Chỉ import IamModule — đọc constructor của TỪNG service ở đây mới thấy
// đúng cái cần: CustomerService cần ScopeService (phạm vi xem theo sale),
// CustomerPortalService cần AuthService (bcrypt hash dùng chung, tránh cài
// lại). CustomerCodeService/CatalogService/SupplierService chỉ cần Prisma.
//
// KHÔNG import MoneyModule: dù bản đặc tả ban đầu giả định CustomerService
// gọi WalletService của #03 khi tạo KH, code thật (customer.service.ts) ghi
// thẳng bảng ví qua `tx.wallet.create()` trong CÙNG transaction Prisma với
// tbl_customer — không có dependency-injection nào vào WalletService. Khoá
// nối giữa 2 module vẫn là Customer.code == Wallet.cusId (chuỗi), không phải
// DI. e2e (test/masterdata/e2e.spec.ts) chứng minh khoá nối này bằng cách tự
// import MoneyModule riêng và gọi WalletService.applyEntry() từ NGOÀI.
@Module({
  imports: [IamModule],
  providers: [CustomerCodeService, CustomerService, CustomerPortalService, CatalogService, SupplierService],
  exports: [CustomerCodeService, CustomerService, CustomerPortalService, CatalogService, SupplierService],
})
export class MasterDataModule {}
