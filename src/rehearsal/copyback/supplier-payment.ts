/**
 * 09a NGƯỢC (§2): tbl_payment_source, tbl_payment, tbl_payment_orders,
 * tbl_payment_log. Nghịch đảo của src/rehearsal/etl/supplier-payment.ts.
 * Thuần. Không log ncc_bank_account.
 */
import { SUPPLIER_PAYMENT_SPECS } from '../etl/supplier-payment';
import { PgRow, ReverseResult, Rev } from './convert';
import { c } from './pg-image';
import { CopybackSpec } from './spec';

function fwd(model: string) {
  const s = SUPPLIER_PAYMENT_SPECS.find((x) => x.model === model);
  if (!s) throw new Error(`thiếu spec xuôi ${model}`);
  return s;
}

// ------------------------------------------------------------ tbl_payment_source §2.4
export const PAYMENT_SOURCE_PG = [
  c('id', 'id', 'int'), c('name', 'name', 'str'), c('tkCode', 'tk_code', 'str'), c('sortOrder', 'sort_order', 'int'),
  c('isActive', 'is_active', 'int'), c('createdAt', 'created_at', 'ts'),
] as const;

export function reversePaymentSource(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({
    id: x.int('id'),
    name: x.str('name'),
    tk_code: x.optStr('tk_code'), // NULL ('TT quỹ USD') giữ NULL
    sort_order: x.optInt('sort_order'),
    is_active: x.optTinyint('is_active'),
    created_at: x.optDateTime('created_at'), // timestamp(3) → datetime: cắt phần giây lẻ
  });
}

// ------------------------------------------------------------ tbl_payment §2.1
export const SUPPLIER_PAYMENT_PG = [
  c('id', 'id', 'int'), c('cdate', 'cdate', 'int'), c('mdate', 'mdate', 'int'), c('priceCyn', 'price_cyn', 'dec', 2),
  c('currency', 'currency', 'str'), c('rateBuy', 'rate_buy', 'int'), c('saler', 'saler', 'str'), c('from', 'from', 'str'),
  c('source', 'source', 'str'), c('codeOrder', 'code_order', 'str'), c('orderId', 'order_id', 'int'),
  c('note', 'note', 'str'), c('notePayment', 'note_payment', 'str'), c('pricePayment', 'price_payment', 'dec', 2),
  c('payment', 'payment', 'str'), c('pdate', 'pdate', 'int'), c('status', 'status', 'str'),
  c('confirm', 'confirm', 'str'), c('poId', 'po_id', 'int'), c('payType', 'pay_type', 'str'),
  c('billImages', 'bill_images', 'str'), c('accountCode', 'account_code', 'str'),
  c('nccReceiver', 'ncc_receiver', 'str'), c('nccBankName', 'ncc_bank_name', 'str'),
  c('nccBankAccount', 'ncc_bank_account', 'str'), c('nccQrImage', 'ncc_qr_image', 'str'),
  c('nccBankNote', 'ncc_bank_note', 'str'), c('nccPayChannel', 'ncc_pay_channel', 'str'),
  c('nccPlatformOrder', 'ncc_platform_order', 'str'), c('nccInvoiceImages', 'ncc_invoice_images', 'str'),
  c('nccPackingListImages', 'ncc_packing_list_images', 'str'), c('ktNote', 'kt_note', 'str'),
  c('ttNgoaiKieu', 'tt_ngoai_kieu', 'str'),
] as const;

export function reverseSupplierPayment(r: PgRow): ReverseResult {
  const x = new Rev(r, { mb3: true }); // bảng utf8mb3
  return x.result({
    id: x.int('id'),
    cdate: x.optInt('cdate'),
    mdate: x.optInt('mdate'),
    price_cyn: x.optDec('price_cyn', 65, 2), // PG (18,2) → prod (65,2): nới, không mất
    currency: x.enumOf('currency', ['CNY', 'USD']),
    rate_buy: x.optInt('rate_buy'),
    saler: x.optStr('saler'),
    from: x.optStr('from'),
    source: x.optStr('source'),
    code_order: x.optStr('code_order'), // NGUYÊN BYTE
    order_id: x.optInt('order_id'), // 0 THẬT (phiếu gộp)
    note: x.optStr('note'),
    note_payment: x.optStr('note_payment'),
    price_payment: x.optDec('price_payment', 65, 2), // NULL giữ NULL
    payment: x.optStr('payment'), // NULL/no/yes nguyên (M2)
    pdate: x.optInt('pdate'),
    status: x.optStr('status'),
    confirm: x.optStr('confirm'),
    po_id: x.int('po_id'),
    pay_type: x.str('pay_type'),
    bill_images: x.optStr('bill_images'), // chuỗi JSON nguyên (cột text ở PG, không jsonb)
    account_code: x.str('account_code'), // '' THẬT
    ncc_receiver: x.str('ncc_receiver'),
    ncc_bank_name: x.str('ncc_bank_name'),
    ncc_bank_account: x.str('ncc_bank_account'), // KHÔNG log
    ncc_qr_image: x.str('ncc_qr_image'),
    ncc_bank_note: x.optStr('ncc_bank_note'),
    ncc_pay_channel: x.str('ncc_pay_channel'),
    ncc_platform_order: x.str('ncc_platform_order'),
    ncc_invoice_images: x.optStr('ncc_invoice_images'),
    ncc_packing_list_images: x.optStr('ncc_packing_list_images'),
    kt_note: x.optStr('kt_note'),
    tt_ngoai_kieu: x.str('tt_ngoai_kieu'),
  });
}

// ------------------------------------------------------------ tbl_payment_orders §2.2
export const SUPPLIER_PAYMENT_ORDER_PG = [
  c('id', 'id', 'int'), c('paymentId', 'payment_id', 'int'), c('orderId', 'order_id', 'int'), c('rmb', 'rmb', 'dec', 2),
  c('cdate', 'cdate', 'int'), c('prevFund', 'prev_fund', 'dec', 2), c('prevRate', 'prev_rate', 'dec', 2),
] as const;

export function reverseSupplierPaymentOrder(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({
    id: x.int('id'),
    payment_id: x.int('payment_id'),
    order_id: x.int('order_id'),
    rmb: x.dec('rmb', 16, 2),
    cdate: x.int('cdate'),
    prev_fund: x.optDec('prev_fund', 18, 2), // NULL = "không có ảnh chụp" — giữ NULL
    prev_rate: x.optDec('prev_rate', 18, 2),
  });
}

// ------------------------------------------------------------ tbl_payment_log §2.3
export const SUPPLIER_PAYMENT_LOG_PG = [
  c('id', 'id', 'int'), c('paymentId', 'payment_id', 'int'), c('action', 'action', 'str'),
  c('oldData', 'old_data', 'str'), c('newData', 'new_data', 'str'), c('note', 'note', 'str'),
  c('createdBy', 'created_by', 'str'), c('cdate', 'cdate', 'int'),
] as const;

export function reverseSupplierPaymentLog(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({
    id: x.int('id'),
    payment_id: x.int('payment_id'),
    action: x.enumOf('action', ['rollback', 'edit', 'delete', 'doc_return', 'doc_resubmit', 'doc_chan_truong']),
    old_data: x.optStr('old_data'), // TEXT nguyên (PG text, không jsonb)
    new_data: x.optStr('new_data'),
    note: x.optStr('note'),
    created_by: x.optStr('created_by'),
    cdate: x.optInt('cdate'),
  });
}

export const COPYBACK_SUPPLIER_PAYMENT: CopybackSpec[] = [
  {
    model: 'PaymentSource', doc: '09a §2.4', table: 'tbl_payment_source', pgColumns: PAYMENT_SOURCE_PG,
    reverse: reversePaymentSource, forward: fwd('PaymentSource'),
    lossy: [
      'created_at: PG timestamp(3) → MySQL datetime(0) — phần giây lẻ bị CẮT (dòng đổi giá trị được ĐẾM).',
      'tk_code: chiều xuôi TRIM+UPPER (G-DOC-3).',
    ],
  },
  {
    model: 'SupplierPayment', doc: '09a §2.1', table: 'tbl_payment', pgColumns: SUPPLIER_PAYMENT_PG,
    reverse: reverseSupplierPayment, forward: fwd('SupplierPayment'),
    lossy: [
      'saler: chiều xuôi TRIM (09a bổ sung 25/09); account_code: TRIM+UPPER (G-DOC-3).',
      'dòng rác test ZZ (09a §3) không nạp sang PG ⇒ không bao giờ chép ngược (vẫn nằm nguyên ở MySQL).',
    ],
  },
  { model: 'SupplierPaymentOrder', doc: '09a §2.2', table: 'tbl_payment_orders', pgColumns: SUPPLIER_PAYMENT_ORDER_PG, reverse: reverseSupplierPaymentOrder, forward: fwd('SupplierPaymentOrder'), lossy: [] },
  { model: 'SupplierPaymentLog', doc: '09a §2.3', table: 'tbl_payment_log', pgColumns: SUPPLIER_PAYMENT_LOG_PG, reverse: reverseSupplierPaymentLog, forward: fwd('SupplierPaymentLog'), lossy: [] },
];
