/**
 * 09b (migration/09b-so-quy-treasury.md §2): tbl_accounts → FundAccount,
 * tbl_account_histories → TreasuryEntry. Ánh xạ THUẦN — không I/O.
 */
import { Prisma } from '@prisma/client';
import {
  Row,
  enumVal,
  normCode,
  optBigInt,
  optDecimal,
  optInt32,
  optStr,
  reqDecimal,
  reqInt32,
  reqStr,
} from './convert';
import { EtlContext, MapResult, TableSpec, ok } from './spec';

const FUND_CURRENCIES = ['VND', 'CNY', 'USD'] as const;
const FUND_GROUPS = ['bank', 'store'] as const;

/** ⛔ KHÔNG có `password` (09b §2.1) — danh sách này là câu SELECT. */
export const FUND_ACCOUNT_COLUMNS = [
  'id', 'code', 'name', 'subname', 'currency', 'acc_group', 'has_gout', 'display_order', 'is_active',
  'note', 'opening_balance', 'stk', 'bank_code', 'wallet_stream', 'custom_label', 'cdate', 'mdate',
  'owner_uid', 'gl_account', 'quy_doi_sang',
] as const;

export function mapFundAccount(r: Row, _ctx: EtlContext): MapResult<Prisma.FundAccountCreateManyInput> {
  const notes: string[] = [];
  const code = normCode(reqStr(r, 'code'));
  if (code.changed) notes.push('G-DOC-3 code chuẩn hoá');
  return ok(
    {
      id: reqInt32(r, 'id'),
      code: code.value,
      name: reqStr(r, 'name'),
      subname: reqStr(r, 'subname'),
      currency: enumVal(r, 'currency', FUND_CURRENCIES),
      accGroup: enumVal(r, 'acc_group', FUND_GROUPS),
      hasGout: reqInt32(r, 'has_gout'),
      displayOrder: reqInt32(r, 'display_order'),
      isActive: reqInt32(r, 'is_active'),
      note: reqStr(r, 'note'),
      // 0 là THẬT — không NULLIF; kiểm trước §5 < 10^15.
      openingBalance: reqDecimal(r, 'opening_balance', { maxAbs: '1e15' }),
      stk: reqStr(r, 'stk'),
      bankCode: reqStr(r, 'bank_code'),
      walletStream: reqStr(r, 'wallet_stream'),
      customLabel: reqStr(r, 'custom_label'),
      cdate: reqInt32(r, 'cdate'),
      mdate: reqInt32(r, 'mdate'),
      ownerUid: optInt32(r, 'owner_uid'), // 0 = không chủ — giữ 0
      glAccount: reqStr(r, 'gl_account'), // '' THẬT (TK07) — KHÔNG NULLIF
      quyDoiSang: reqStr(r, 'quy_doi_sang'),
    },
    notes,
  );
}

export const TREASURY_ENTRY_COLUMNS = [
  'id', 'tk_code', 'type', 'bank_info', 'gout', 'wallet_detail_id', 'cus_id', 'cdate', 'cuser', 'money',
  'rate', 'approve_user', 'approve_date', 'note', 'status', 'tranId', 'trandetailId', 'source_module',
  'source_id', 'reversal_of', 'reversal_code', 'reversal_reason', 'ref_request_id', 'po_id',
  'container_id', 'order_code',
] as const;

export function mapTreasuryEntry(r: Row, _ctx: EtlContext): MapResult<Prisma.TreasuryEntryCreateManyInput> {
  const notes: string[] = [];
  const tkRaw = optStr(r, 'tk_code');
  let tkCode: string | null = tkRaw;
  if (tkRaw !== null) {
    const n = normCode(tkRaw);
    tkCode = n.value;
    if (n.changed) notes.push('G-DOC-3 tk_code chuẩn hoá');
  }
  const smRaw = reqStr(r, 'source_module');
  const sourceModule = smRaw.trim(); // khoá chữ thường — chỉ TRIM (G-DOC-3)
  if (sourceModule !== smRaw) notes.push('G-DOC-3 source_module TRIM');
  return ok(
    {
      id: reqInt32(r, 'id'),
      tkCode,
      type: optStr(r, 'type'), // 'tranfer' giữ nguyên chính tả
      bankInfo: optStr(r, 'bank_info'),
      gout: optStr(r, 'gout'), // NULL ≠ ''
      walletDetailId: optInt32(r, 'wallet_detail_id'),
      cusId: optStr(r, 'cus_id'), // KHÔNG TRIM, NULL ≠ ''
      cdate: optInt32(r, 'cdate'),
      cuser: optStr(r, 'cuser'),
      money: optDecimal(r, 'money', { maxAbs: '1e15' }),
      // prod decimal(12,2) → đích Decimal(18,6) (nới, M3) — NULL ≠ 0.
      rate: optDecimal(r, 'rate'),
      approveUser: optStr(r, 'approve_user'),
      approveDate: optInt32(r, 'approve_date'),
      note: optStr(r, 'note'),
      status: optInt32(r, 'status'), // 9 THẬT
      tranId: optBigInt(r, 'tranId'),
      trandetailId: optBigInt(r, 'trandetailId'),
      sourceModule, // '' THẬT
      sourceId: reqInt32(r, 'source_id'),
      reversalOf: reqInt32(r, 'reversal_of'), // 0 sentinel — giữ
      reversalCode: reqStr(r, 'reversal_code'),
      reversalReason: reqStr(r, 'reversal_reason'),
      refRequestId: reqInt32(r, 'ref_request_id'),
      poId: reqInt32(r, 'po_id'),
      containerId: reqInt32(r, 'container_id'),
      orderCode: reqStr(r, 'order_code'),
    },
    notes,
  );
}

export const TREASURY_SPECS: TableSpec[] = [
  {
    model: 'FundAccount',
    doc: '09b §2.1',
    sourceTable: 'tbl_accounts',
    columns: FUND_ACCOUNT_COLUMNS,
    targetTable: 'tbl_accounts',
    map: mapFundAccount,
  },
  {
    model: 'TreasuryEntry',
    doc: '09b §2.2',
    sourceTable: 'tbl_account_histories',
    columns: TREASURY_ENTRY_COLUMNS,
    targetTable: 'tbl_account_histories',
    map: mapTreasuryEntry,
  },
];
