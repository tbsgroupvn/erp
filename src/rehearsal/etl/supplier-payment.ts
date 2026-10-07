/**
 * 09a (migration/09a-thanh-toan-ncc.md §2/§3): tbl_payment_source, tbl_payment,
 * tbl_payment_orders, tbl_payment_log. Ánh xạ THUẦN. Không log ncc_bank_account.
 */
import { Prisma } from '@prisma/client';
import {
  Row,
  enumVal,
  normCode,
  optDateTime,
  optDecimal,
  optInt32,
  optStr,
  reqDecimal,
  reqInt32,
  reqStr,
} from './convert';
import { EtlContext, MapResult, TableSpec, ok, skip } from './spec';

// ------------------------------------------------------------ tbl_payment_source §2.4
export const PAYMENT_SOURCE_COLUMNS = ['id', 'name', 'tk_code', 'sort_order', 'is_active', 'created_at'] as const;

export function mapPaymentSource(r: Row, _ctx: EtlContext): MapResult<Prisma.PaymentSourceCreateManyInput> {
  const notes: string[] = [];
  const tkRaw = optStr(r, 'tk_code');
  let tkCode: string | null = tkRaw; // NULL ('TT quỹ USD') giữ NULL
  if (tkRaw !== null) {
    const n = normCode(tkRaw);
    tkCode = n.value;
    if (n.changed) notes.push('G-DOC-3 tk_code chuẩn hoá');
  }
  return ok(
    {
      id: reqInt32(r, 'id'),
      name: reqStr(r, 'name'),
      tkCode,
      sortOrder: optInt32(r, 'sort_order'),
      isActive: optInt32(r, 'is_active'),
      createdAt: optDateTime(r, 'created_at'),
    },
    notes,
  );
}

// ------------------------------------------------------------ tbl_payment §2.1
export const SUPPLIER_PAYMENT_COLUMNS = [
  'id', 'cdate', 'mdate', 'price_cyn', 'currency', 'rate_buy', 'saler', 'from', 'source', 'code_order',
  'order_id', 'note', 'note_payment', 'price_payment', 'payment', 'pdate', 'status', 'confirm', 'po_id',
  'pay_type', 'bill_images', 'account_code', 'ncc_receiver', 'ncc_bank_name', 'ncc_bank_account',
  'ncc_qr_image', 'ncc_bank_note', 'ncc_pay_channel', 'ncc_platform_order', 'ncc_invoice_images',
  'ncc_packing_list_images', 'kt_note', 'tt_ngoai_kieu',
] as const;

/** 09a §3 "Rác bộ test": saler LIKE 'zz%' OR code_order LIKE 'ZZ%' (MariaDB ci ⇒ không phân biệt hoa/thường). */
function isTestJunk(saler: string | null, codeOrder: string | null): boolean {
  return (saler ?? '').toLowerCase().startsWith('zz') || (codeOrder ?? '').toLowerCase().startsWith('zz');
}

export function mapSupplierPayment(r: Row, ctx: EtlContext): MapResult<Prisma.SupplierPaymentCreateManyInput> {
  const notes: string[] = [];
  const salerRaw = optStr(r, 'saler');
  const codeOrder = optStr(r, 'code_order'); // NGUYÊN BYTE — đừng TRIM
  if (isTestJunk(salerRaw, codeOrder)) {
    return skip('09a §3 rác test ZZ (saler zz%/code_order ZZ%)', reqInt32(r, 'id'));
  }
  const saler = salerRaw === null ? null : salerRaw.trim(); // 09a bổ sung 25/09: TRIM saler
  if (salerRaw !== null && saler !== salerRaw) notes.push('09a saler TRIM');
  const cdate = optInt32(r, 'cdate');
  if (cdate !== null && cdate > ctx.nowUnix) notes.push('A7 cdate tương lai');
  const acc = normCode(reqStr(r, 'account_code')); // '' THẬT — KHÔNG NULLIF
  if (acc.changed) notes.push('G-DOC-3 account_code chuẩn hoá');
  return ok(
    {
      id: reqInt32(r, 'id'), // prod bigint, MAX < 2³¹ — int32 kiểm
      cdate,
      mdate: optInt32(r, 'mdate'), // NULL giữ
      priceCyn: optDecimal(r, 'price_cyn', { maxAbs: '1e16' }), // decimal(65,2) → (18,2)
      currency: enumVal(r, 'currency', ['CNY', 'USD'] as const),
      rateBuy: optInt32(r, 'rate_buy'),
      saler,
      from: optStr(r, 'from'),
      source: optStr(r, 'source'),
      codeOrder,
      orderId: optInt32(r, 'order_id'), // 0 THẬT (phiếu gộp) — KHÔNG NULLIF
      note: optStr(r, 'note'),
      notePayment: optStr(r, 'note_payment'), // NULL ≠ ''
      pricePayment: optDecimal(r, 'price_payment', { maxAbs: '1e16' }), // NULL giữ — KHÔNG backfill
      payment: optStr(r, 'payment'), // NULL/no/yes nguyên (M2)
      pdate: optInt32(r, 'pdate'),
      status: optStr(r, 'status'),
      confirm: optStr(r, 'confirm'),
      poId: reqInt32(r, 'po_id'), // 0 THẬT
      payType: reqStr(r, 'pay_type'), // '' THẬT
      billImages: optStr(r, 'bill_images'), // chuỗi JSON nguyên
      accountCode: acc.value,
      nccReceiver: reqStr(r, 'ncc_receiver'),
      nccBankName: reqStr(r, 'ncc_bank_name'),
      nccBankAccount: reqStr(r, 'ncc_bank_account'), // KHÔNG log
      nccQrImage: reqStr(r, 'ncc_qr_image'),
      nccBankNote: optStr(r, 'ncc_bank_note'),
      nccPayChannel: reqStr(r, 'ncc_pay_channel'),
      nccPlatformOrder: reqStr(r, 'ncc_platform_order'),
      nccInvoiceImages: optStr(r, 'ncc_invoice_images'), // chuỗi nguyên — KHÔNG Json
      nccPackingListImages: optStr(r, 'ncc_packing_list_images'),
      ktNote: optStr(r, 'kt_note'),
      ttNgoaiKieu: reqStr(r, 'tt_ngoai_kieu'),
    },
    notes,
  );
}

// ------------------------------------------------------------ tbl_payment_orders §2.2
export const SUPPLIER_PAYMENT_ORDER_COLUMNS = [
  'id', 'payment_id', 'order_id', 'rmb', 'cdate', 'prev_fund', 'prev_rate',
] as const;

export function mapSupplierPaymentOrder(
  r: Row,
  ctx: EtlContext,
): MapResult<Prisma.SupplierPaymentOrderCreateManyInput> {
  const paymentId = reqInt32(r, 'payment_id');
  if (ctx.skipped.SupplierPayment?.has(paymentId)) return skip('09a §3 thuộc phiếu rác test ZZ đã loại');
  // A2 (M1 mặc định "Loại, log"): FK đích onDelete Cascade — phiếu cha không có ⇒ không nạp.
  if (!ctx.loaded.SupplierPayment?.has(paymentId)) return skip('09a A2 phiếu cha không có/không nạp');
  return ok({
    id: reqInt32(r, 'id'),
    paymentId,
    orderId: reqInt32(r, 'order_id'),
    rmb: reqDecimal(r, 'rmb'), // 0 giữ
    cdate: reqInt32(r, 'cdate'),
    prevFund: optDecimal(r, 'prev_fund'), // NULL = "không có ảnh chụp"
    prevRate: optDecimal(r, 'prev_rate'),
  });
}

// ------------------------------------------------------------ tbl_payment_log §2.3
export const SUPPLIER_PAYMENT_LOG_COLUMNS = [
  'id', 'payment_id', 'action', 'old_data', 'new_data', 'note', 'created_by', 'cdate',
] as const;

const LOG_ACTIONS = ['rollback', 'edit', 'delete', 'doc_return', 'doc_resubmit', 'doc_chan_truong'] as const;

export function mapSupplierPaymentLog(
  r: Row,
  ctx: EtlContext,
): MapResult<Prisma.SupplierPaymentLogCreateManyInput> {
  const notes: string[] = [];
  const paymentId = reqInt32(r, 'payment_id');
  // A5: trỏ phiếu đã xoá vẫn NẠP (vết xoá phải sống) — chỉ đếm.
  if (ctx.skipped.SupplierPayment?.has(paymentId)) notes.push('09a §3 thuộc phiếu rác test ZZ đã loại');
  else if (ctx.loaded.SupplierPayment && !ctx.loaded.SupplierPayment.has(paymentId)) notes.push('A5 trỏ phiếu không có');
  return ok(
    {
      id: reqInt32(r, 'id'),
      paymentId,
      action: enumVal(r, 'action', LOG_ACTIONS),
      oldData: optStr(r, 'old_data'), // NULL ≠ '' — TEXT nguyên
      newData: optStr(r, 'new_data'),
      note: optStr(r, 'note'),
      createdBy: optStr(r, 'created_by'),
      cdate: optInt32(r, 'cdate'),
    },
    notes,
  );
}

/** Thứ tự 09a §5 (ReturnState payment nạp ở return-state.ts, ngay sau). */
export const SUPPLIER_PAYMENT_SPECS: TableSpec[] = [
  { model: 'PaymentSource', doc: '09a §2.4', sourceTable: 'tbl_payment_source', columns: PAYMENT_SOURCE_COLUMNS, targetTable: 'tbl_payment_source', map: mapPaymentSource },
  { model: 'SupplierPayment', doc: '09a §2.1', sourceTable: 'tbl_payment', columns: SUPPLIER_PAYMENT_COLUMNS, targetTable: 'tbl_payment', map: mapSupplierPayment, trackIds: true },
  { model: 'SupplierPaymentOrder', doc: '09a §2.2', sourceTable: 'tbl_payment_orders', columns: SUPPLIER_PAYMENT_ORDER_COLUMNS, targetTable: 'tbl_payment_orders', map: mapSupplierPaymentOrder },
  { model: 'SupplierPaymentLog', doc: '09a §2.3', sourceTable: 'tbl_payment_log', columns: SUPPLIER_PAYMENT_LOG_COLUMNS, targetTable: 'tbl_payment_log', map: mapSupplierPaymentLog },
];
