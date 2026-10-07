/**
 * 09c (migration/09c-fx-ngan-hang.md §2): 8 bảng FX + phía ngân hàng.
 * Ánh xạ THUẦN — không I/O. Không log bank_account / changes (có STK).
 */
import { Prisma } from '@prisma/client';
import {
  EtlSafeError,
  Row,
  enumVal,
  normCode,
  optBigInt,
  optDecimal,
  optInt32,
  optStr,
  reqBigInt,
  reqDecimal,
  reqInt32,
  reqStr,
} from './convert';
import { EtlContext, MapResult, TableSpec, ok } from './spec';

function code(r: Row, col: string, notes: string[]): string {
  const n = normCode(reqStr(r, col));
  if (n.changed) notes.push(`G-DOC-3 ${col} chuẩn hoá`);
  return n.value;
}

// ------------------------------------------------------------ tbl_fx_fee_rates §2.3
export const FX_FEE_RATE_COLUMNS = ['id', 'from_cur', 'to_cur', 'fee_percent', 'updated_by', 'updated_at'] as const;

export function mapFxFeeRate(r: Row, _ctx: EtlContext): MapResult<Prisma.FxFeeRateCreateManyInput> {
  return ok({
    id: reqInt32(r, 'id'),
    fromCur: reqStr(r, 'from_cur'),
    toCur: reqStr(r, 'to_cur'),
    feePercent: reqDecimal(r, 'fee_percent'),
    updatedBy: optStr(r, 'updated_by'),
    updatedAt: optInt32(r, 'updated_at'),
  });
}

// ------------------------------------------------------------ tbl_fx_transfers §2.1
export const FX_TRANSFER_COLUMNS = [
  'id', 'code', 'from_tk', 'to_tk', 'from_currency', 'to_currency', 'amount_out', 'amount_in', 'rate',
  'rate_system', 'fee', 'fee_currency', 'fee_percent', 'po_id', 'note', 'status', 'approval_request_id',
  'created_by', 'created_at', 'approved_by', 'approved_at', 'reversed_by', 'reversed_at', 'reverse_of',
  'bank_tran_id', 'agent_rate', 'agent_tk', 'agent_amount',
] as const;

export function mapFxTransfer(r: Row, _ctx: EtlContext): MapResult<Prisma.FxTransferCreateManyInput> {
  const notes: string[] = [];
  return ok(
    {
      id: reqInt32(r, 'id'),
      code: reqStr(r, 'code'), // byte-nguyên
      fromTk: code(r, 'from_tk', notes),
      toTk: code(r, 'to_tk', notes),
      fromCurrency: reqStr(r, 'from_currency'),
      toCurrency: reqStr(r, 'to_currency'),
      amountOut: reqDecimal(r, 'amount_out', { maxAbs: '1e13' }), // kiểm trước §5
      amountIn: reqDecimal(r, 'amount_in'),
      rate: reqDecimal(r, 'rate'),
      rateSystem: reqDecimal(r, 'rate_system'), // 0 giữ
      fee: reqDecimal(r, 'fee'),
      feeCurrency: optStr(r, 'fee_currency'),
      feePercent: optDecimal(r, 'fee_percent'), // NULL ≠ 0
      poId: reqInt32(r, 'po_id'),
      note: optStr(r, 'note'),
      status: reqStr(r, 'status'),
      approvalRequestId: reqInt32(r, 'approval_request_id'), // KHÔNG FK (C2)
      createdBy: reqStr(r, 'created_by'),
      createdAt: reqInt32(r, 'created_at'),
      approvedBy: reqStr(r, 'approved_by'),
      approvedAt: reqInt32(r, 'approved_at'),
      reversedBy: reqStr(r, 'reversed_by'),
      reversedAt: reqInt32(r, 'reversed_at'),
      reverseOf: reqInt32(r, 'reverse_of'),
      bankTranId: reqBigInt(r, 'bank_tran_id'), // 0 sentinel "chưa neo"
      agentRate: reqDecimal(r, 'agent_rate'),
      agentTk: code(r, 'agent_tk', notes), // '' giữ
      agentAmount: reqDecimal(r, 'agent_amount'),
    },
    notes,
  );
}

// ------------------------------------------------------------ tbl_fx_adjustments §2.2
export const FX_ADJUSTMENT_COLUMNS = ['id'] as const;

/** 09c §2.2: bảng phải RỖNG; có dòng ⇒ DỪNG, đo lại (bảng bật cho_am khi duyệt lại). */
export function mapFxAdjustment(_r: Row, _ctx: EtlContext): MapResult<never> {
  throw new EtlSafeError('ETL 09c §2.2: tbl_fx_adjustments có dòng ⇒ DỪNG, đo lại cho_am trước khi nạp.');
}

// ------------------------------------------------------------ tbl_account_changelog §2.4
export const FUND_ACCOUNT_CHANGELOG_COLUMNS = [
  'id', 'account_id', 'account_code', 'action', 'changes', 'user_id', 'user_name', 'created_at',
] as const;

export function mapFundAccountChangelog(
  r: Row,
  _ctx: EtlContext,
): MapResult<Prisma.FundAccountChangelogCreateManyInput> {
  const notes: string[] = [];
  return ok(
    {
      id: reqInt32(r, 'id'),
      accountId: reqInt32(r, 'account_id'),
      accountCode: code(r, 'account_code', notes),
      action: reqStr(r, 'action'),
      changes: optStr(r, 'changes'), // nguyên văn, KHÔNG log (C7)
      userId: reqInt32(r, 'user_id'), // 0 giữ
      userName: reqStr(r, 'user_name'),
      createdAt: reqInt32(r, 'created_at'),
    },
    notes,
  );
}

// ------------------------------------------------------------ tbl_bank_transaction §2.5
export const BANK_TRANSACTION_COLUMNS = [
  'id', 'bankid', 'bank_name', 'bank_account', 'tranType', 'tranAmount', 'tranTime', 'tranMess',
  'originMess', 'cus_id', 'type', 'cdate', 'mdate', 'status', 'confirm', 'tk_code',
] as const;

export function mapBankTransaction(r: Row, _ctx: EtlContext): MapResult<Prisma.BankTransactionCreateManyInput> {
  const notes: string[] = [];
  return ok(
    {
      id: reqBigInt(r, 'id'),
      bankid: reqStr(r, 'bankid'), // '' THẬT
      bankName: optStr(r, 'bank_name'), // giữ hoa/thường
      bankAccount: optStr(r, 'bank_account'), // KHÔNG log
      tranType: optStr(r, 'tranType'),
      tranAmount: optBigInt(r, 'tranAmount'), // nguyên đồng
      tranTime: optBigInt(r, 'tranTime'), // mili-giây
      tranMess: optStr(r, 'tranMess'),
      originMess: optStr(r, 'originMess'),
      cusId: optStr(r, 'cus_id'), // NULL ≠ '', KHÔNG TRIM
      type: optStr(r, 'type'), // chuỗi '1'..'5'
      cdate: optInt32(r, 'cdate'),
      mdate: optInt32(r, 'mdate'), // NULL giữ
      status: optStr(r, 'status'),
      confirm: optStr(r, 'confirm'),
      tkCode: code(r, 'tk_code', notes), // '' THẬT
    },
    notes,
  );
}

// ------------------------------------------------------------ tbl_bank_transaction_detail §2.6
export const BANK_TRANSACTION_DETAIL_COLUMNS = [
  'id', 'tranId', 'type', 'money', 'cus_id', 'pay_info', 'note', 'author', 'cdate', 'mdate', 'confirm',
  'po_id', 'wallet_stream',
] as const;

export function mapBankTransactionDetail(
  r: Row,
  _ctx: EtlContext,
): MapResult<Prisma.BankTransactionDetailCreateManyInput> {
  return ok({
    id: reqBigInt(r, 'id'),
    tranId: optBigInt(r, 'tranId'),
    type: optStr(r, 'type'),
    money: optBigInt(r, 'money'),
    cusId: optStr(r, 'cus_id'), // NULL giữ
    payInfo: optStr(r, 'pay_info'),
    note: optStr(r, 'note'),
    author: optStr(r, 'author'),
    cdate: optInt32(r, 'cdate'),
    mdate: optInt32(r, 'mdate'),
    confirm: optStr(r, 'confirm'),
    poId: reqInt32(r, 'po_id'),
    walletStream: optStr(r, 'wallet_stream'), // NULL ≠ 'cty' — KHÔNG COALESCE
  });
}

// ------------------------------------------------------------ tbl_bank_chi_match §2.7
export const BANK_CHI_MATCH_COLUMNS = [
  'id', 'bank_tx_id', 'request_id', 'method', 'matched_by', 'matched_at', 'unmatched_at', 'unmatched_by', 'note',
] as const;

export function mapBankChiMatch(r: Row, _ctx: EtlContext): MapResult<Prisma.BankChiMatchCreateManyInput> {
  return ok({
    id: reqInt32(r, 'id'),
    bankTxId: reqBigInt(r, 'bank_tx_id'),
    requestId: reqInt32(r, 'request_id'),
    method: enumVal(r, 'method', ['auto', 'manual'] as const),
    matchedBy: reqStr(r, 'matched_by'),
    matchedAt: reqInt32(r, 'matched_at'),
    unmatchedAt: optInt32(r, 'unmatched_at'), // NULL = đang hiệu lực
    unmatchedBy: optStr(r, 'unmatched_by'),
    note: reqStr(r, 'note'),
  });
}

// ------------------------------------------------------------ tbl_bank_reconcile_link §2.8
export const BANK_RECONCILE_LINK_COLUMNS = [
  'id', 'bank_tran_id', 'doc_module', 'doc_id', 'match_type', 'note', 'cuser', 'cdate',
] as const;

export function mapBankReconcileLink(
  r: Row,
  _ctx: EtlContext,
): MapResult<Prisma.BankReconcileLinkCreateManyInput> {
  return ok({
    id: reqInt32(r, 'id'),
    bankTranId: reqBigInt(r, 'bank_tran_id'),
    docModule: reqStr(r, 'doc_module'), // '' giữ (fee)
    docId: reqInt32(r, 'doc_id'), // 0 giữ
    matchType: reqStr(r, 'match_type'),
    note: reqStr(r, 'note'),
    cuser: reqStr(r, 'cuser'),
    cdate: reqInt32(r, 'cdate'),
  });
}

/** Thứ tự 09c §5.2–§5.3. */
export const FX_BANK_SPECS: TableSpec[] = [
  { model: 'FxFeeRate', doc: '09c §2.3', sourceTable: 'tbl_fx_fee_rates', columns: FX_FEE_RATE_COLUMNS, targetTable: 'tbl_fx_fee_rates', map: mapFxFeeRate },
  { model: 'FxTransfer', doc: '09c §2.1', sourceTable: 'tbl_fx_transfers', columns: FX_TRANSFER_COLUMNS, targetTable: 'tbl_fx_transfers', map: mapFxTransfer },
  { model: 'FxAdjustment', doc: '09c §2.2', sourceTable: 'tbl_fx_adjustments', columns: FX_ADJUSTMENT_COLUMNS, targetTable: 'tbl_fx_adjustments', map: mapFxAdjustment },
  { model: 'FundAccountChangelog', doc: '09c §2.4', sourceTable: 'tbl_account_changelog', columns: FUND_ACCOUNT_CHANGELOG_COLUMNS, targetTable: 'tbl_account_changelog', map: mapFundAccountChangelog },
  { model: 'BankTransaction', doc: '09c §2.5', sourceTable: 'tbl_bank_transaction', columns: BANK_TRANSACTION_COLUMNS, targetTable: 'tbl_bank_transaction', map: mapBankTransaction },
  { model: 'BankTransactionDetail', doc: '09c §2.6', sourceTable: 'tbl_bank_transaction_detail', columns: BANK_TRANSACTION_DETAIL_COLUMNS, targetTable: 'tbl_bank_transaction_detail', map: mapBankTransactionDetail },
  { model: 'BankChiMatch', doc: '09c §2.7', sourceTable: 'tbl_bank_chi_match', columns: BANK_CHI_MATCH_COLUMNS, targetTable: 'tbl_bank_chi_match', map: mapBankChiMatch },
  { model: 'BankReconcileLink', doc: '09c §2.8', sourceTable: 'tbl_bank_reconcile_link', columns: BANK_RECONCILE_LINK_COLUMNS, targetTable: 'tbl_bank_reconcile_link', map: mapBankReconcileLink },
];
