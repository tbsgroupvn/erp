// DTO phiếu thanh toán NCC (09a, `tbl_payment`) — ALLOW-LIST như customer.dto.ts/user.dto.ts:
// liệt kê ĐÚNG trường được ra, cột mới thêm vào model mặc định bị GIỮ LẠI chứ không mặc định RÒ.
//
// ⚠ Tiền là `Decimal(18,2)` — ra CHUỖI `toFixed(2)` (giữ đủ chữ số, không làm tròn qua Number).
// `pricePayment` NULL giữ `null`: NULL là bình thường ở prod (web không ghi cột này, 14.328 dòng —
// đặc tả §11 bẫy 1); DTO KHÔNG tự dẫn xuất `price_cyn*rate_buy` — việc đó của người đọc VND.
import { Prisma, ReturnState, SupplierPayment } from '@prisma/client';

export const SUPPLIER_PAYMENT_DTO_KEYS = [
  'id', 'cdate', 'mdate', 'priceCyn', 'currency', 'rateBuy', 'saler', 'from', 'source',
  'codeOrder', 'orderId', 'note', 'notePayment', 'pricePayment', 'payment', 'pdate', 'status',
  'confirm', 'poId', 'payType', 'billImages', 'accountCode', 'nccReceiver', 'nccBankName',
  'nccBankAccount', 'nccQrImage', 'nccBankNote', 'nccPayChannel', 'nccPlatformOrder',
  'nccInvoiceImages', 'nccPackingListImages', 'ktNote', 'ttNgoaiKieu',
] as const;

export type SupplierPaymentDto = Record<(typeof SUPPLIER_PAYMENT_DTO_KEYS)[number], unknown>;

function money(d: Prisma.Decimal | null | undefined): string | null {
  return d === null || d === undefined ? null : d.toFixed(2);
}

export function toSupplierPaymentDto(r: SupplierPayment | null | undefined): SupplierPaymentDto | null {
  if (!r) return null;
  return {
    id: r.id,
    cdate: r.cdate,
    mdate: r.mdate,
    priceCyn: money(r.priceCyn),
    currency: r.currency,
    rateBuy: r.rateBuy,
    saler: r.saler,
    from: r.from,
    source: r.source,
    codeOrder: r.codeOrder,
    orderId: r.orderId,
    note: r.note,
    notePayment: r.notePayment,
    pricePayment: money(r.pricePayment),
    payment: r.payment,
    pdate: r.pdate,
    status: r.status,
    confirm: r.confirm,
    poId: r.poId,
    payType: r.payType,
    billImages: r.billImages,
    accountCode: r.accountCode,
    nccReceiver: r.nccReceiver,
    nccBankName: r.nccBankName,
    nccBankAccount: r.nccBankAccount,
    nccQrImage: r.nccQrImage,
    nccBankNote: r.nccBankNote,
    nccPayChannel: r.nccPayChannel,
    nccPlatformOrder: r.nccPlatformOrder,
    nccInvoiceImages: r.nccInvoiceImages,
    nccPackingListImages: r.nccPackingListImages,
    ktNote: r.ktNote,
    ttNgoaiKieu: r.ttNgoaiKieu,
  };
}

export const RETURN_STATE_DTO_KEYS = [
  'state', 'round', 'reason', 'fieldsOpened', 'returnedBy', 'returnedAt', 'resubmittedAt',
] as const;

/** Trạng thái trả về hiển thị cho màn chi tiết. KHÔNG gồm `dataBefore`/`dataAfter` (ảnh chụp
 *  nguyên dòng) — phần người duyệt cần xem đã có ở `changedFields`. */
export function toReturnStateDto(st: ReturnState | null | undefined) {
  if (!st) return null;
  return {
    state: st.state,
    round: st.round,
    reason: st.reason,
    fieldsOpened: st.fieldsOpened,
    returnedBy: st.returnedBy,
    returnedAt: st.returnedAt,
    resubmittedAt: st.resubmittedAt,
  };
}
