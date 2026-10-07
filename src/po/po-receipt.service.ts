// src/po/po-receipt.service.ts — Task 6 #06: thu tiền khách theo PO, theo
// từng đợt (`dot`), giữ NGUYÊN ngữ nghĩa "tiền GIỮ" mà #03 (HoldService) đã
// định nghĩa cho `tbl_po_receipts`.
//
// ⚠⚠⚠ MẤU CHỐT — KHÔNG được đọc lệch ở đây: `method = 'wallet'` VÀ
// `status = 'no'` nghĩa là tiền đang GIỮ (đã trừ khỏi khả dụng của khách
// nhưng CHƯA thật sự chi/ghi sổ). `HoldService.holdAmount()` (src/money/
// hold.service.ts) đã đọc THẲNG hình dạng này — 5 cột `method`/`status`/
// `customerId`/`amount`/`allocRequestId` là "đường sống" của #03, xem
// comment ngay trên model `PoReceipt` trong schema.prisma. Việc CỦA FILE
// NÀY là tạo đúng hình dạng đó, KHÔNG phải tự tính/tự trừ ví — #06 không
// viết lại logic giữ tiền, chỉ SINH RA dòng mà #03 đọc.
//
// ⚠ Đo prod 23/09/2026 (xem plan §"Sự thật đã ĐO"): `po_receipts` hiện có
// `bank/yes` 196 · `wallet/yes` 26 · `bank/no` 1 — KHÔNG CÓ dòng `wallet/no`
// nào. Đường "tiền GIỮ" hoàn toàn CHƯA được dữ liệu thật đi qua; nó chỉ được
// bộ `test/po/po-receipt.spec.ts` của Task 6 tự dựng và chứng minh. Đừng
// tưởng nhầm là đã có sản xuất phủ.
//
// ⛔⛔⛔ KHÔNG CÓ `approve()` Ở ĐÂY — VÁ FINDING F1 (review cuối #06, 23/09/2026).
// Bản trước có `approve(receiptId)` tự đổi `status` 'no' -> 'yes' bằng tay,
// KHÔNG đụng ví — nghĩa là tiền vừa được coi là ĐÃ THU trên PO (mọi nơi đọc
// `status='yes'` thấy PO đã thanh toán) MÀ khách vẫn giữ nguyên số dư ví,
// vì không có `WalletService.applyEntry` nào chạy. Tiền bị đếm HAI LẦN: khách
// giữ tiền thật VÀ PO coi như đã được thanh toán bằng đúng số đó — sinh tiền
// từ không khí. Production đã tự bịt chính lỗ hổng này: `ajaxs/po/
// process_approve_receipt.php` bị vô hiệu hoá HOÀN TOÀN bằng một `return`
// lỗi ngay đầu file, thêm ngày 31/08/2026, với comment nói rõ duyệt tay ghi
// tiền vào PO "mà không trừ ví — tiền sinh ra từ không khí". Production chỉ
// cho một phiếu thu đạt `status='yes'` qua ĐÚNG HAI đường: (a) một giao dịch
// ngân hàng THẬT được kế toán đối soát rồi duyệt khớp, hoặc (b) luồng phân
// bổ ví (wallet-allocation), luồng này TRỪ VÍ NGUYÊN TỬ TRƯỚC rồi mới ghi
// `status='yes'` — không bao giờ ngược lại.
//
// Cả hai đường (a) và (b) CHƯA được port sang nhánh này. Vì vậy file này CỐ
// TÌNH không có cách nào đưa một phiếu thu tới `status='yes'` — mọi phiếu
// tạo qua `addReceipt()` đều dừng ở `'no'` (giữ/chưa chốt). Một `approve()`
// trong tương lai (khi (a) hoặc (b) được port) BẮT BUỘC phải gọi
// `WalletService.applyEntry` để trừ ví NGUYÊN TỬ TRƯỚC, rồi mới ghi
// `status='yes'` — đúng thứ tự production đang dùng. Đừng thêm lại một
// đường duyệt tay không trừ ví — đó chính là lỗ hổng vừa vá, chỉ là một
// cửa khác.
import { Injectable } from '@nestjs/common';
import { Prisma, PoReceipt } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { idOrNull, nowSec } from '../common/money';
import { PoStatus } from './po.constants';

/** Decimal (hoặc number/string/null) đọc từ DB -> number thuần. Cùng quy ước
 *  `d2n` của `quote.service.ts`/`quote-po-diff.service.ts`: Prisma trả về
 *  `Prisma.Decimal`, không tự ép kiểu khi đưa vào phép toán số học. */
function d2n(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

// Dung sai 1đ khi so tổng đã thu với `totalAmount` của PO — khớp production
// (làm tròn/số lẻ tích luỹ qua nhiều đợt có thể lệch 1đ, không phải lỗi).
const OVER_COLLECT_TOLERANCE = 1;

export type AddReceiptInput = {
  customerId: string;
  amount: number | string | Prisma.Decimal;
  method: string;
  /** Đợt thanh toán. Không bắt buộc — một số phiếu thu cũ không gắn đợt. */
  dot?: number | null;
  // ⛔ KHÔNG có `status` ở đây (vá F1) — `addReceipt` LUÔN tạo phiếu ở
  // trạng thái GIỮ/chưa chốt (`'no'`). Đưa `status` vào input là mở lại
  // đúng cửa "tự phong status='yes' bằng tay" mà production đã bịt; xem
  // comment lớn ở đầu file.
  receiptCode?: string | null;
  orderId?: number | null;
  bankRef?: string | null;
  // ⚠ F3 (review cuối #06): prod `receipt_date` là DATE, đổi theo — bên gọi
  // chịu trách nhiệm parse chuỗi/epoch -> Date trước khi tới đây.
  receiptDate?: Date | null;
  allocRequestId?: number | null;
  note?: string | null;
};

export type AddReceiptResult =
  | { ok: true; msg: string; receipt: PoReceipt }
  | { ok: false; msg: string };

@Injectable()
export class PoReceiptService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo một phiếu thu cho PO `poId`, đợt `dot`. KHÔNG đụng gì tới ví/hold —
   * chỉ ghi đúng hình dạng mà `HoldService`/`WalletService` (#03) đọc lại.
   * Phiếu luôn tạo ở `status='no'` (xem comment đầu file) — không có tham
   * số nào lật nó sang `'yes'` từ hàm này.
   *
   * Ba chốt chặn (đều có ở production, đều rẻ để thêm ở đây):
   * 1. PO phải đã duyệt đủ 2 cấp (`status >= PoStatus.DA_DUYET`) — production
   *    từ chối với "chưa duyệt đủ 2 cấp — chưa thu tiền được".
   * 2. `customerId` (mã khách) trên phiếu PHẢI khớp người mua thật của PO
   *    (`PurchaseOrder.buyerId` -> `Customer.id` -> `Customer.code`). Thiếu
   *    chốt này thì phiếu thu của khách B có thể giữ/ghi nhận vào PO của
   *    khách A.
   * 3. Không cho thu vượt tổng PO: Σ đã CHỐT (`status='yes'`) + khoản này
   *    không được vượt `totalAmount`, dung sai 1đ (khớp production).
   */
  async addReceipt(poId: number, input: AddReceiptInput, by: string): Promise<AddReceiptResult> {
    const customerId = (input.customerId ?? '').trim();
    if (!customerId) return { ok: false, msg: 'Thiếu mã khách hàng' };

    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) return { ok: false, msg: 'Không tìm thấy PO' };

    // Chốt 1: PO phải đã duyệt đủ 2 cấp.
    if (po.status < PoStatus.DA_DUYET) {
      return { ok: false, msg: 'PO chưa duyệt đủ 2 cấp — chưa thu tiền được' };
    }

    // Chốt 2: mã khách trên phiếu phải khớp đúng người mua của PO.
    if (!po.buyerId) {
      return { ok: false, msg: 'PO chưa gắn khách mua — không xác định được người phải thu' };
    }
    const buyer = await this.prisma.customer.findUnique({ where: { id: po.buyerId } });
    if (!buyer || buyer.code !== customerId) {
      return { ok: false, msg: 'Khách trên phiếu thu không khớp người mua của PO' };
    }

    // Chốt 3: không cho thu vượt tổng PO (dung sai 1đ).
    const already = await this.sumCollected(poId);
    const amt = d2n(input.amount as Prisma.Decimal | number | string);
    const totalAmount = d2n(po.totalAmount);
    if (already + amt > totalAmount + OVER_COLLECT_TOLERANCE) {
      return {
        ok: false,
        msg: `Thu vượt tổng PO (đã thu ${already}, tổng ${totalAmount}, khoản này ${amt})`,
      };
    }

    const receipt = await this.prisma.poReceipt.create({
      data: {
        poId,
        customerId,
        amount: input.amount,
        method: input.method,
        status: 'no',
        dot: input.dot ?? null,
        receiptCode: input.receiptCode ?? null,
        orderId: idOrNull(input.orderId),
        bankRef: input.bankRef ?? null,
        receiptDate: input.receiptDate ?? null,
        allocRequestId: idOrNull(input.allocRequestId),
        note: input.note ?? null,
        createdBy: by ?? null,
        cdate: nowSec(),
      },
    });
    return { ok: true, msg: 'OK', receipt };
  }

  /** Σ tiền đã CHỐT (`status='yes'`) của một PO. Dùng cho chốt chặn 3 ở
   *  trên, và là phép đọc "tiến độ thu" mà trước Task này KHÔNG có ai đọc —
   *  màn hình công nợ PO và job tự tất toán (chưa port sang nhánh này) đều
   *  cần con số này ở production. */
  async sumCollected(poId: number): Promise<number> {
    const r = await this.prisma.poReceipt.aggregate({
      _sum: { amount: true },
      where: { poId, status: 'yes' },
    });
    return d2n(r._sum.amount);
  }

  /** Σ tiền đang GIỮ/chờ chốt (`status='no'`) của một PO — nửa còn lại của
   *  phép đọc "tiến độ thu" ở trên. */
  async sumPending(poId: number): Promise<number> {
    const r = await this.prisma.poReceipt.aggregate({
      _sum: { amount: true },
      where: { poId, status: 'no' },
    });
    return d2n(r._sum.amount);
  }

  /** Danh sách phiếu thu của một PO, theo thứ tự tạo. */
  async listByPo(poId: number): Promise<PoReceipt[]> {
    return this.prisma.poReceipt.findMany({ where: { poId }, orderBy: { id: 'asc' } });
  }
}
