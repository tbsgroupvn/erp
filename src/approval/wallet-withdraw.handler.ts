import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../money/wallet.service';
import { walletDebitOfForm } from '../money/pending-approval-hold';
import { IBusinessSyncHandler, assertTemplateType } from './business-sync.service';
import { approvalRefKey, effectApplied } from './approval-ref-key';

// #03/Q7 — RÚT TIỀN ví KH qua duyệt (prod: mẫu rut_tien_vi_kh, object_type 'wallet_withdraw').
// Chép prod libs/cls.approval.php viRutTienDuyetXong() (đọc 24/09/2026):
//   applyEntry(cus, -tien, -3, "Rut tien theo phieu duyet #id", submitted_by, 0,
//              trim(chu_tk+' '+so_tk_nhan+' '+ngan_hang), '', {account_type: loai_tk})
// Trước bản này hệ mới KHÔNG có handler cho 'wallet_withdraw' ⇒ BusinessSyncService coi phiếu
// là "xong" mà không trừ ví, trong khi tiền giữ đã nhả (status rời PENDING).
// Số tiền đọc qua walletDebitOfForm() — CÙNG hàm HoldService dùng để GIỮ, nên giữ = trừ.
//
// I-1: handler chạy TRƯỚC khi phiếu đổi trạng thái và có thể bị gọi lại (lượt quét sau sự cố) ⇒
// phải an toàn khi chạy lại. refKey làm việc đó cho lần gọi TUẦN TỰ; nhưng hai lần gọi ĐUA nhau trên
// số dư vừa đủ thì bên thua bị applyEntry chặn ở bước KIỂM SỐ DƯ (trước khi chạm UNIQUE) và nhận
// "Số dư ví không đủ" chứ không phải alreadyApplied ⇒ khi applyEntry báo lỗi, tra lại sổ theo refKey.
@Injectable()
export class WalletWithdrawHandler implements IBusinessSyncHandler {
  objectType = 'wallet_withdraw';
  constructor(private wallet: WalletService, private prisma: PrismaService) {}

  /** M-4: khoá mang loại hiệu ứng — xem approval-ref-key.ts (khoá cũ `approval:<id>` chỉ còn đọc). */
  private refKey(request: { id: number }) { return approvalRefKey(request.id, this.objectType); }

  async isApplied(request: { id: number; formData?: string | null }): Promise<boolean> {
    const d = walletDebitOfForm(request.formData);
    return effectApplied(this.prisma, request.id, this.objectType, -3,
      // prod viRutTienDuyetXong() ghi "[PHIEU-RUT#<id>]" vào note và tự tra nó để khỏi trừ hai lần
      d && d.cus && d.amount > 0n ? { noteMarker: '[PHIEU-RUT#' + request.id + ']', cus: d.cus, money: -d.amount } : undefined);
  }

  async sync(request: any): Promise<void> {
    await assertTemplateType(this.prisma, request, this.objectType); // I-2: mẫu quyết, không phải người gửi
    const d = walletDebitOfForm(request.formData);
    if (!d || !d.cus || d.amount <= 0n)
      throw new Error('wallet_withdraw form_data hỏng: thiếu cus hoặc so_tien<=0 (phiếu #' + request.id + ')');
    const fd = JSON.parse(request.formData) as Record<string, unknown>;
    const s = (k: string) => String(fd[k] ?? '').trim();
    const payInfo = [s('chu_tk'), s('so_tk_nhan'), s('ngan_hang')].join(' ').trim();
    // prod: loai_tk === "Cá nhân (hàng mẫu)" ⇒ ca_nhan, còn lại (kể cả phiếu cũ thiếu ô) ⇒ cty
    const accountType = String(fd.loai_tk ?? '') === 'Cá nhân (hàng mẫu)' ? 'ca_nhan' : 'cty';
    // Đã ghi (khoá mới / khoá cũ cùng loại / dấu prod) ⇒ không trừ lần hai.
    if (await this.isApplied(request)) return;
    // note NGUYÊN VĂN prod viRutTienDuyetXong() (không dấu tiếng Việt, kèm dấu [PHIEU-RUT#id]): PHP chống trừ
    // lần hai bằng `note LIKE '%[PHIEU-RUT#id]%'` ⇒ dòng v2 chép ngược về MySQL (cutover L13) phải mang dấu này.
    const r = await this.wallet.applyEntry(d.cus, -d.amount, -3,
      'Rut tien theo phieu duyet #' + request.id + ' [PHIEU-RUT#' + request.id + ']',
      String(request.submittedBy ?? ''), 0, {
        accountType, payInfo,
        holdExcludeRequest: request.id,   // phiếu còn PENDING lúc trừ — không để tiền giữ của CHÍNH nó chặn nó
        refKey: this.refKey(request),     // chạy lại bao nhiêu lần cũng chỉ trừ MỘT lần
      });
    if (!r.ok && !(await this.isApplied(request)))
      throw new Error('applyEntry thất bại: ' + r.msg); // nổi để phiếu KHÔNG thành APPROVED
  }
}
