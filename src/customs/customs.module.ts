import { Module } from '@nestjs/common';
import { QuoteModule } from '../quote/quote.module';
import { DeclSourceService } from './decl-source.service';
import { CustomsDeclarationService } from './customs-declaration.service';
import { ImportGoodsService } from './import-goods.service';
import { HsTariffService } from './hs-tariff.service';

// ⚠ KHÁC WarehouseModule/PoModule (chỉ import IamModule cho ScopeService,
// mọi truy cập bảng module khác đều đọc THẲNG qua Prisma, không qua DI):
// `CustomsDeclarationService` inject `ImportTaxService` của #05 QUA
// CONSTRUCTOR THẬT (xem customs-declaration.service.ts — ràng buộc cứng
// "CẤM cài lại công thức 5 sắc thuế", gọi thẳng `ImportTaxService.calc5`).
// Đây là phụ thuộc DI thật, không phải chỉ chung CSDL — nên PHẢI import
// `QuoteModule` để lấy đúng MỘT instance `ImportTaxService` mà module #05
// đã export sẵn (`quote.module.ts`), thay vì tự khai một provider
// `ImportTaxService` riêng ở đây (dù service đó không có state nên về mặt
// kỹ thuật "new hai bản" vẫn cho cùng kết quả — nhưng khai hai provider
// cho cùng một class dễ gây hiểu lầm "có hai cách tính thuế" khi đọc lại
// sau này, đúng đúng lớp lỗi lịch sử mà chính ràng buộc cứng ở trên cảnh
// báo tránh).
@Module({
  imports: [QuoteModule],
  providers: [DeclSourceService, CustomsDeclarationService, ImportGoodsService, HsTariffService],
  exports: [DeclSourceService, CustomsDeclarationService, ImportGoodsService, HsTariffService],
})
export class CustomsModule {}
