import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../money/wallet.service';
import { IBusinessSyncHandler, assertTemplateType } from './business-sync.service';
import { approvalRefKey, effectApplied } from './approval-ref-key';
import { walletDebitOfForm } from '../money/pending-approval-hold';

// #03 — phân bổ ví KH cho PO. objectType 'wallet_alloc' khớp seedTemplate mặc định
// trong test/helpers/approval-db.ts.
// I-1: chạy TRƯỚC khi phiếu đổi trạng thái, có thể bị gọi lại ⇒ an toàn khi chạy lại nhờ refKey,
// cộng tra lại sổ khi applyEntry báo lỗi (lượt đua thua ở bước kiểm số dư — xem wallet-withdraw.handler.ts).
@Injectable()
export class WalletAllocHandler implements IBusinessSyncHandler {
  objectType = 'wallet_alloc';
  constructor(private wallet: WalletService, private prisma: PrismaService) {}

  /** M-4: khoá mang loại hiệu ứng — xem approval-ref-key.ts (khoá cũ `approval:<id>` chỉ còn đọc). */
  private refKey(request: { id: number }) { return approvalRefKey(request.id, this.objectType); }

  // Không tra dấu note của prod: handler prod phan_bo_vi_kh ghi luồng khác (PO + đổi tệ) và prod có
  // 0 phiếu phan_bo_vi_kh thật (đo 24/09/2026) — không có bút toán prod nào để nhận ra.
  async isApplied(request: { id: number }): Promise<boolean> {
    return effectApplied(this.prisma, request.id, this.objectType, 4);
  }

  async sync(request: any): Promise<void> {
    await assertTemplateType(this.prisma, request, this.objectType); // I-2: mẫu quyết, không phải người gửi
    JSON.parse(request.formData || '{}'); // JSON hỏng phải NỔ (fail-visible), như trước
    // Đọc khách + số tiền qua walletDebitOfForm() — CÙNG hàm HoldService dùng để GIỮ tiền của
    // phiếu đang chờ (Q7). Hai bản parse riêng thì giữ một số, trừ một số khác.
    const d = walletDebitOfForm(request.formData);
    const cus = d?.cus ?? '';
    const soTien = d?.amount ?? 0n;
    // Dữ liệu hỏng (thiếu KH / số tiền <=0) PHẢI nổ, không được lặng lẽ return —
    // return im lặng từng làm phiếu APPROVED mà không ghi ví, không ai biết (fail-visible).
    if (!cus || soTien <= 0n) throw new Error('wallet_alloc form_data hỏng: thiếu cus hoặc so_tien<=0 (cus=' + cus + ', so_tien=' + soTien + ')');
    if (await this.isApplied(request)) return; // đã ghi (khoá mới hoặc khoá cũ cùng loại) ⇒ không trừ lần hai
    // refKey neo bút toán vào ĐÚNG phiếu này ⇒ chạy lại bao nhiêu lần cũng chỉ trừ tiền MỘT lần;
    // sổ tự phân biệt "đã ghi" với "chưa ghi" nên lượt quét sau sự cố chạy lại được an toàn.
    const r = await this.wallet.applyEntry(cus, -soTien, 4, 'Phân bổ ví (phiếu #' + request.id + ')', 'approval', 0, {
      holdExcludeRequest: request.id,
      refKey: this.refKey(request),
    });
    if (!r.ok && !(await this.isApplied(request)))
      throw new Error('applyEntry thất bại: ' + r.msg); // nổi để phiếu KHÔNG thành APPROVED
  }
}
