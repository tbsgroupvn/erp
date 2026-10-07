import { Module, OnModuleInit } from '@nestjs/common';
import { MoneyModule } from '../money/money.module';
import { TemplateService } from './template.service';
import { BranchEvaluator } from './branch-evaluator';
import { ApproverResolver } from './approver-resolver';
import { RequestService } from './request.service';
import { ApprovalService } from './approval.service';
import { BusinessSyncService } from './business-sync.service';
import { WalletAllocHandler } from './wallet-alloc.handler';
import { WalletWithdrawHandler } from './wallet-withdraw.handler';
import { ApprovalSweepScheduler } from './approval-sweep.scheduler';
import { ReturnService } from './return.service';

// Nối #04 (mẫu/bước/duyệt) với #03 (ví) qua MoneyModule: WalletAllocHandler cần
// WalletService (export sẵn của MoneyModule), không tự khai lại các service ví.
@Module({
  imports: [MoneyModule],
  providers: [
    TemplateService,
    BranchEvaluator,
    ApproverResolver,
    RequestService,
    ApprovalService,
    BusinessSyncService,
    WalletAllocHandler,
    WalletWithdrawHandler,
    ApprovalSweepScheduler, // I-2: lượt quét sau sự cố — khởi động + định kỳ
    ReturnService, // #04b Task 1 — "trả về cho người nộp sửa" (CLS_TRAVE); export để module payment (#09) dùng lại
  ],
  exports: [
    TemplateService,
    BranchEvaluator,
    ApproverResolver,
    RequestService,
    ApprovalService,
    BusinessSyncService,
    ReturnService,
  ],
})
export class ApprovalModule implements OnModuleInit {
  constructor(private sync: BusinessSyncService, private walletAlloc: WalletAllocHandler,
              private walletWithdraw: WalletWithdrawHandler) {}

  // Đăng ký handler nghiệp vụ MỘT LẦN khi module khởi động — trước đây đây là điểm
  // hở: WalletAllocHandler tồn tại nhưng không nơi nào gọi BusinessSyncService.register()
  // nên onApproved() không bao giờ tìm thấy handler cho objectType 'wallet_alloc'.
  onModuleInit() {
    this.sync.register(this.walletAlloc);
    this.sync.register(this.walletWithdraw); // Q7: rút tiền ví qua duyệt (prod rut_tien_vi_kh)
  }
}
