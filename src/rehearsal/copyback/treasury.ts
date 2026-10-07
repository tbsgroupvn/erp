/**
 * 09b NGƯỢC: FundAccount → tbl_accounts, TreasuryEntry → tbl_account_histories.
 * Nghịch đảo của src/rehearsal/etl/treasury.ts. Thuần — không I/O.
 */
import { TREASURY_SPECS } from '../etl/treasury';
import { PgRow, ReverseResult, Rev } from './convert';
import { c, cm } from './pg-image';
import { CopybackSpec } from './spec';

export const FUND_ACCOUNT_PG = [
  c('id', 'id', 'int'), c('code', 'code', 'str'), c('name', 'name', 'str'), c('subname', 'subname', 'str'),
  c('currency', 'currency', 'str'), c('accGroup', 'acc_group', 'str'), c('hasGout', 'has_gout', 'int'),
  c('displayOrder', 'display_order', 'int'), c('isActive', 'is_active', 'int'), c('note', 'note', 'str'),
  c('openingBalance', 'opening_balance', 'dec', 5), c('stk', 'stk', 'str'), c('bankCode', 'bank_code', 'str'),
  c('walletStream', 'wallet_stream', 'str'), c('customLabel', 'custom_label', 'str'), c('cdate', 'cdate', 'int'),
  c('mdate', 'mdate', 'int'), c('ownerUid', 'owner_uid', 'int'), c('glAccount', 'gl_account', 'str'),
  c('quyDoiSang', 'quy_doi_sang', 'str'),
] as const;

export function reverseFundAccount(r: PgRow): ReverseResult {
  const x = new Rev(r);
  return x.result({
    id: x.int('id'),
    code: x.str('code'),
    name: x.str('name'),
    subname: x.str('subname'),
    currency: x.enumOf('currency', ['VND', 'CNY', 'USD']),
    acc_group: x.enumOf('acc_group', ['bank', 'store']),
    has_gout: x.tinyint('has_gout'),
    // ⛔ `password` KHÔNG có ở PG (09b §2.1 cấm mang) ⇒ không ghi; MySQL lấy DEFAULT ''.
    display_order: x.int('display_order'),
    is_active: x.tinyint('is_active'),
    note: x.str('note'),
    opening_balance: x.dec('opening_balance', 20, 5),
    stk: x.str('stk'),
    bank_code: x.str('bank_code'),
    wallet_stream: x.enumOf('wallet_stream', ['cty', 'ca_nhan']), // MySQL enum, PG varchar
    custom_label: x.str('custom_label'),
    cdate: x.int('cdate'),
    mdate: x.int('mdate'),
    owner_uid: x.optInt('owner_uid'),
    gl_account: x.str('gl_account'),
    quy_doi_sang: x.str('quy_doi_sang'),
  });
}

export const TREASURY_ENTRY_PG = [
  c('id', 'id', 'int'), c('tkCode', 'tk_code', 'str'), c('type', 'type', 'str'), c('bankInfo', 'bank_info', 'str'),
  c('gout', 'gout', 'str'), c('walletDetailId', 'wallet_detail_id', 'int'), c('cusId', 'cus_id', 'str'),
  c('cdate', 'cdate', 'int'), c('cuser', 'cuser', 'str'), c('money', 'money', 'dec', 5), c('rate', 'rate', 'dec', 6),
  c('approveUser', 'approve_user', 'str'), c('approveDate', 'approve_date', 'int'), c('note', 'note', 'str'),
  c('status', 'status', 'int'), cm('tranId', 'tran_id', 'bigint', 'tranId'), cm('trandetailId', 'trandetail_id', 'bigint', 'trandetailId'),
  c('sourceModule', 'source_module', 'str'), c('sourceId', 'source_id', 'int'), c('reversalOf', 'reversal_of', 'int'),
  c('reversalCode', 'reversal_code', 'str'), c('reversalReason', 'reversal_reason', 'str'),
  c('refRequestId', 'ref_request_id', 'int'), c('poId', 'po_id', 'int'), c('containerId', 'container_id', 'int'),
  c('orderCode', 'order_code', 'str'),
] as const;

export function reverseTreasuryEntry(r: PgRow): ReverseResult {
  const x = new Rev(r, { mb3: true }); // bảng utf8mb3
  return x.result({
    id: x.int('id'),
    tk_code: x.optStr('tk_code'),
    type: x.optStr('type'),
    bank_info: x.optStr('bank_info'),
    gout: x.optStr('gout'),
    wallet_detail_id: x.optInt('wallet_detail_id'),
    cus_id: x.optStr('cus_id'),
    cdate: x.optInt('cdate'),
    cuser: x.optStr('cuser'),
    money: x.optDec('money', 20, 5),
    // §3.7 R1: v2 Decimal(18,6) → prod decimal(12,2) — làm tròn 2 số lẻ, ĐẾM dòng đổi giá trị.
    rate: x.optDec('rate', 12, 2),
    approve_user: x.optStr('approve_user'),
    approve_date: x.optInt('approve_date'),
    note: x.optStr('note'),
    status: x.optTinyint('status'),
    tranId: x.optBigint('tran_id'),
    trandetailId: x.optBigint('trandetail_id'),
    source_module: x.str('source_module'),
    source_id: x.int('source_id'),
    reversal_of: x.int('reversal_of'),
    reversal_code: x.str('reversal_code'),
    reversal_reason: x.str('reversal_reason'),
    ref_request_id: x.int('ref_request_id'),
    po_id: x.int('po_id'),
    container_id: x.int('container_id'),
    order_code: x.str('order_code'),
  });
}

export const COPYBACK_TREASURY: CopybackSpec[] = [
  {
    model: 'FundAccount',
    doc: '09b §2.1',
    table: 'tbl_accounts',
    pgColumns: FUND_ACCOUNT_PG,
    reverse: reverseFundAccount,
    forward: TREASURY_SPECS[0],
    mysqlOnlyColumns: ['password'],
    lossy: [
      'password: không có ở PG (09b §2.1) — dòng v2 tạo mới nhận DEFAULT \'\' của MySQL.',
      'code: chiều xuôi TRIM+UPPER (G-DOC-3) — giá trị gốc có khoảng trắng/chữ thường không khôi phục được.',
    ],
  },
  {
    model: 'TreasuryEntry',
    doc: '09b §2.2',
    table: 'tbl_account_histories',
    pgColumns: TREASURY_ENTRY_PG,
    reverse: reverseTreasuryEntry,
    forward: TREASURY_SPECS[1],
    lossy: [
      'rate: v2 Decimal(18,6) → prod decimal(12,2) — làm tròn nửa-xa-số-0 về 2 số lẻ (cutover §3.7 R1, lặp lại P9); dòng đổi giá trị được ĐẾM.',
      'tk_code: chiều xuôi TRIM+UPPER; source_module: chiều xuôi TRIM (G-DOC-3).',
    ],
  },
];
