import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { ApprovalModule } from '../approval/approval.module';
import { SupplierPaymentService } from './supplier-payment.service';
import { SupplierPaymentController } from './supplier-payment.controller';

// 09a — phiếu thanh toán NCC (`tbl_payment`). Đợt 1 Task 2: đọc + xoá, KHÔNG hiệu ứng tiền.
// ApprovalModule cho ReturnService (cơ chế "trả về cho người nộp sửa", #04b).
@Module({
  imports: [IamModule, ApprovalModule],
  providers: [SupplierPaymentService],
  controllers: [SupplierPaymentController],
  exports: [SupplierPaymentService],
})
export class SupplierPaymentModule {}
