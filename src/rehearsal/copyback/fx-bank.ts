/**
 * 09c NGƯỢC (§2): 8 bảng FX + phía ngân hàng. Nghịch đảo của
 * src/rehearsal/etl/fx-bank.ts. Thuần — không I/O, không log bank_account/changes.
 */
import { FX_BANK_SPECS } from '../etl/fx-bank';
import { PgRow, ReverseResult, Rev } from './convert';
import { c, cm } from './pg-image';
import { CopybackSpec } from './spec';

function fwd(model: string) {
  const s = FX_BANK_SPECS.find((x) => x.model === model);
  if (!s) throw new Error(`thiếu spec xuôi ${model}`);
  return s;
}

// ------------------------------------------------------------ tbl_fx_fee_rates §2.3
export const FX_FEE_RATE_PG = [
  c('id', 'id', 'int'), c('fromCur', 'from_cur', 'str'), c('toCur', 'to_cur', 'str'),
  c('feePercent', 'fee_percent', 'dec', 3), c('updatedBy', 'updated_by', 'str'), c('updatedAt', 'updated_at', 'int'),
] as const;

export function reverseFxFeeRate(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({
    id: x.int('id'),
    from_cur: x.str('from_cur'),
    to_cur: x.str('to_cur'),
    fee_percent: x.dec('fee_percent', 6, 3),
    updated_by: x.optStr('updated_by'),
    updated_at: x.optInt('updated_at'),
  });
}

// ------------------------------------------------------------ tbl_fx_transfers §2.1
export const FX_TRANSFER_PG = [
  c('id', 'id', 'int'), c('code', 'code', 'str'), c('fromTk', 'from_tk', 'str'), c('toTk', 'to_tk', 'str'),
  c('fromCurrency', 'from_currency', 'str'), c('toCurrency', 'to_currency', 'str'),
  c('amountOut', 'amount_out', 'dec', 5), c('amountIn', 'amount_in', 'dec', 5), c('rate', 'rate', 'dec', 6),
  c('rateSystem', 'rate_system', 'dec', 6), c('fee', 'fee', 'dec', 2), c('feeCurrency', 'fee_currency', 'str'),
  c('feePercent', 'fee_percent', 'dec', 3), c('poId', 'po_id', 'int'), c('note', 'note', 'str'),
  c('status', 'status', 'str'), c('approvalRequestId', 'approval_request_id', 'int'),
  c('createdBy', 'created_by', 'str'), c('createdAt', 'created_at', 'int'), c('approvedBy', 'approved_by', 'str'),
  c('approvedAt', 'approved_at', 'int'), c('reversedBy', 'reversed_by', 'str'), c('reversedAt', 'reversed_at', 'int'),
  c('reverseOf', 'reverse_of', 'int'), c('bankTranId', 'bank_tran_id', 'bigint'),
  c('agentRate', 'agent_rate', 'dec', 6), c('agentTk', 'agent_tk', 'str'), c('agentAmount', 'agent_amount', 'dec', 5),
] as const;

export function reverseFxTransfer(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({
    id: x.int('id'),
    code: x.str('code'),
    from_tk: x.str('from_tk'),
    to_tk: x.str('to_tk'),
    from_currency: x.str('from_currency'),
    to_currency: x.str('to_currency'),
    amount_out: x.dec('amount_out', 18, 5),
    amount_in: x.dec('amount_in', 18, 5),
    rate: x.dec('rate', 15, 6),
    rate_system: x.dec('rate_system', 15, 6),
    fee: x.dec('fee', 15, 2),
    fee_currency: x.optStr('fee_currency'),
    fee_percent: x.optDec('fee_percent', 6, 3), // NULL ≠ 0 — giữ NULL
    po_id: x.int('po_id'),
    note: x.optStr('note'),
    status: x.str('status'),
    approval_request_id: x.int('approval_request_id'),
    created_by: x.str('created_by'),
    created_at: x.int('created_at'),
    approved_by: x.str('approved_by'),
    approved_at: x.int('approved_at'),
    reversed_by: x.str('reversed_by'),
    reversed_at: x.int('reversed_at'),
    reverse_of: x.int('reverse_of'),
    bank_tran_id: x.bigint('bank_tran_id'), // 0 sentinel "chưa neo" — giữ 0
    agent_rate: x.dec('agent_rate', 18, 6),
    agent_tk: x.str('agent_tk'),
    agent_amount: x.dec('agent_amount', 18, 5),
  });
}

// ------------------------------------------------------------ tbl_fx_adjustments §2.2
export const FX_ADJUSTMENT_PG = [
  c('id', 'id', 'int'), c('fxId', 'fx_id', 'int'), c('requestId', 'request_id', 'int'),
  c('oldRate', 'old_rate', 'dec', 6), c('oldOut', 'old_out', 'dec', 5), c('oldIn', 'old_in', 'dec', 5),
  c('oldFee', 'old_fee', 'dec', 2), c('oldFeeCur', 'old_fee_cur', 'str'), c('newRate', 'new_rate', 'dec', 6),
  c('newOut', 'new_out', 'dec', 5), c('newIn', 'new_in', 'dec', 5), c('newFee', 'new_fee', 'dec', 2),
  c('newFeeCur', 'new_fee_cur', 'str'), c('deltaOut', 'delta_out', 'dec', 5), c('deltaIn', 'delta_in', 'dec', 5),
  c('deltaFee', 'delta_fee', 'dec', 2), c('histIds', 'hist_ids', 'str'), c('reason', 'reason', 'str'),
  c('cuser', 'cuser', 'str'), c('cdate', 'cdate', 'int'),
] as const;

/** Chiều xuôi DỪNG nếu bảng có dòng (09c §2.2) ⇒ mọi dòng PG là dòng v2 tạo. Cột trùng kiểu/scale với prod. */
export function reverseFxAdjustment(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({
    id: x.int('id'),
    fx_id: x.int('fx_id'),
    request_id: x.int('request_id'),
    old_rate: x.dec('old_rate', 18, 6),
    old_out: x.dec('old_out', 20, 5),
    old_in: x.dec('old_in', 20, 5),
    old_fee: x.dec('old_fee', 20, 2),
    old_fee_cur: x.optStr('old_fee_cur'),
    new_rate: x.dec('new_rate', 18, 6),
    new_out: x.dec('new_out', 20, 5),
    new_in: x.dec('new_in', 20, 5),
    new_fee: x.dec('new_fee', 20, 2),
    new_fee_cur: x.optStr('new_fee_cur'),
    delta_out: x.dec('delta_out', 20, 5),
    delta_in: x.dec('delta_in', 20, 5),
    delta_fee: x.dec('delta_fee', 20, 2),
    hist_ids: x.optStr('hist_ids'),
    reason: x.str('reason'),
    cuser: x.str('cuser'),
    cdate: x.int('cdate'),
  });
}

// ------------------------------------------------------------ tbl_account_changelog §2.4
export const FUND_ACCOUNT_CHANGELOG_PG = [
  c('id', 'id', 'int'), c('accountId', 'account_id', 'int'), c('accountCode', 'account_code', 'str'),
  c('action', 'action', 'str'), c('changes', 'changes', 'str'), c('userId', 'user_id', 'int'),
  c('userName', 'user_name', 'str'), c('createdAt', 'created_at', 'int'),
] as const;

export function reverseFundAccountChangelog(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({
    id: x.int('id'),
    account_id: x.int('account_id'),
    account_code: x.str('account_code'),
    action: x.str('action'),
    changes: x.optStr('changes'), // nguyên văn, KHÔNG log (C7)
    user_id: x.int('user_id'),
    user_name: x.str('user_name'),
    created_at: x.int('created_at'),
  });
}

// ------------------------------------------------------------ tbl_bank_transaction §2.5
export const BANK_TRANSACTION_PG = [
  c('id', 'id', 'bigint'), c('bankid', 'bankid', 'str'), c('bankName', 'bank_name', 'str'),
  c('bankAccount', 'bank_account', 'str'), cm('tranType', 'tran_type', 'str', 'tranType'), cm('tranAmount', 'tran_amount', 'bigint', 'tranAmount'),
  cm('tranTime', 'tran_time', 'bigint', 'tranTime'), cm('tranMess', 'tran_mess', 'str', 'tranMess'), cm('originMess', 'origin_mess', 'str', 'originMess'),
  c('cusId', 'cus_id', 'str'), c('type', 'type', 'str'), c('cdate', 'cdate', 'int'), c('mdate', 'mdate', 'int'),
  c('status', 'status', 'str'), c('confirm', 'confirm', 'str'), c('tkCode', 'tk_code', 'str'),
] as const;

export function reverseBankTransaction(r: PgRow): ReverseResult {
  const x = new Rev(r, { mb3: true }); // bảng utf8mb3
  return x.result({
    id: x.bigint('id'),
    bankid: x.str('bankid'), // '' THẬT
    bank_name: x.optStr('bank_name'),
    bank_account: x.optStr('bank_account'), // KHÔNG log
    tranType: x.optStr('tran_type'),
    tranAmount: x.optBigint('tran_amount'), // nguyên đồng
    tranTime: x.optBigint('tran_time'), // mili-giây — giữ nguyên quy ước prod
    tranMess: x.optStr('tran_mess'), // KHÔNG log
    originMess: x.optStr('origin_mess'),
    cus_id: x.optStr('cus_id'),
    type: x.optStr('type'),
    cdate: x.optInt('cdate'),
    mdate: x.optInt('mdate'),
    status: x.optStr('status'),
    confirm: x.optStr('confirm'),
    tk_code: x.str('tk_code'),
  });
}

// ------------------------------------------------------------ tbl_bank_transaction_detail §2.6
export const BANK_TRANSACTION_DETAIL_PG = [
  c('id', 'id', 'bigint'), cm('tranId', 'tran_id', 'bigint', 'tranId'), c('type', 'type', 'str'), c('money', 'money', 'bigint'),
  c('cusId', 'cus_id', 'str'), c('payInfo', 'pay_info', 'str'), c('note', 'note', 'str'), c('author', 'author', 'str'),
  c('cdate', 'cdate', 'int'), c('mdate', 'mdate', 'int'), c('confirm', 'confirm', 'str'), c('poId', 'po_id', 'int'),
  c('walletStream', 'wallet_stream', 'str'),
] as const;

export function reverseBankTransactionDetail(r: PgRow): ReverseResult {
  const x = new Rev(r, { mb3: true });
  return x.result({
    id: x.bigint('id'),
    tranId: x.optBigint('tran_id'),
    type: x.optStr('type'),
    money: x.optBigint('money'),
    cus_id: x.optStr('cus_id'),
    pay_info: x.optStr('pay_info'),
    note: x.optStr('note'),
    author: x.optStr('author'),
    cdate: x.optInt('cdate'),
    mdate: x.optInt('mdate'),
    confirm: x.optStr('confirm'),
    po_id: x.int('po_id'),
    wallet_stream: x.optStr('wallet_stream'), // NULL ≠ 'cty' — giữ NULL
  });
}

// ------------------------------------------------------------ tbl_bank_chi_match §2.7
export const BANK_CHI_MATCH_PG = [
  c('id', 'id', 'int'), c('bankTxId', 'bank_tx_id', 'bigint'), c('requestId', 'request_id', 'int'),
  c('method', 'method', 'str'), c('matchedBy', 'matched_by', 'str'), c('matchedAt', 'matched_at', 'int'),
  c('unmatchedAt', 'unmatched_at', 'int'), c('unmatchedBy', 'unmatched_by', 'str'), c('note', 'note', 'str'),
] as const;

export function reverseBankChiMatch(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({
    id: x.int('id'),
    bank_tx_id: x.bigint('bank_tx_id'),
    request_id: x.int('request_id'),
    method: x.enumOf('method', ['auto', 'manual']),
    matched_by: x.str('matched_by'),
    matched_at: x.int('matched_at'),
    unmatched_at: x.optInt('unmatched_at'), // NULL = đang hiệu lực
    unmatched_by: x.optStr('unmatched_by'),
    note: x.str('note'),
  });
}

// ------------------------------------------------------------ tbl_bank_reconcile_link §2.8
export const BANK_RECONCILE_LINK_PG = [
  c('id', 'id', 'int'), c('bankTranId', 'bank_tran_id', 'bigint'), c('docModule', 'doc_module', 'str'),
  c('docId', 'doc_id', 'int'), c('matchType', 'match_type', 'str'), c('note', 'note', 'str'),
  c('cuser', 'cuser', 'str'), c('cdate', 'cdate', 'int'),
] as const;

export function reverseBankReconcileLink(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({
    id: x.int('id'),
    bank_tran_id: x.bigint('bank_tran_id'),
    doc_module: x.str('doc_module'),
    doc_id: x.int('doc_id'),
    match_type: x.str('match_type'),
    note: x.str('note'),
    cuser: x.str('cuser'),
    cdate: x.int('cdate'),
  });
}

const CODE_LOSS = 'mã quỹ/ví: chiều xuôi TRIM+UPPER (G-DOC-3) — giá trị gốc có khoảng trắng/chữ thường không khôi phục được.';

/** Thứ tự cha → con như chiều xuôi (09c §5.2–§5.3). */
export const COPYBACK_FX_BANK: CopybackSpec[] = [
  { model: 'FxFeeRate', doc: '09c §2.3', table: 'tbl_fx_fee_rates', pgColumns: FX_FEE_RATE_PG, reverse: reverseFxFeeRate, forward: fwd('FxFeeRate'), lossy: [] },
  { model: 'FxTransfer', doc: '09c §2.1', table: 'tbl_fx_transfers', pgColumns: FX_TRANSFER_PG, reverse: reverseFxTransfer, forward: fwd('FxTransfer'), lossy: [`from_tk/to_tk/agent_tk: ${CODE_LOSS}`] },
  {
    model: 'FxAdjustment', doc: '09c §2.2', table: 'tbl_fx_adjustments', pgColumns: FX_ADJUSTMENT_PG, reverse: reverseFxAdjustment,
    forward: null, // chiều xuôi DỪNG khi có dòng ⇒ không có ảnh kỳ vọng; dòng ≤ mốc so trực tiếp với MySQL
    lossy: [],
  },
  { model: 'FundAccountChangelog', doc: '09c §2.4', table: 'tbl_account_changelog', pgColumns: FUND_ACCOUNT_CHANGELOG_PG, reverse: reverseFundAccountChangelog, forward: fwd('FundAccountChangelog'), lossy: [`account_code: ${CODE_LOSS}`] },
  { model: 'BankTransaction', doc: '09c §2.5', table: 'tbl_bank_transaction', pgColumns: BANK_TRANSACTION_PG, reverse: reverseBankTransaction, forward: fwd('BankTransaction'), lossy: [`tk_code: ${CODE_LOSS}`] },
  { model: 'BankTransactionDetail', doc: '09c §2.6', table: 'tbl_bank_transaction_detail', pgColumns: BANK_TRANSACTION_DETAIL_PG, reverse: reverseBankTransactionDetail, forward: fwd('BankTransactionDetail'), lossy: [] },
  { model: 'BankChiMatch', doc: '09c §2.7', table: 'tbl_bank_chi_match', pgColumns: BANK_CHI_MATCH_PG, reverse: reverseBankChiMatch, forward: fwd('BankChiMatch'), lossy: [] },
  { model: 'BankReconcileLink', doc: '09c §2.8', table: 'tbl_bank_reconcile_link', pgColumns: BANK_RECONCILE_LINK_PG, reverse: reverseBankReconcileLink, forward: fwd('BankReconcileLink'), lossy: [] },
];
