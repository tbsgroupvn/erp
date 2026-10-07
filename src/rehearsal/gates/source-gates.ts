/**
 * L0 Task 3 — cổng NGUỒN "sai là DỪNG" (chạy trên MariaDB diễn tập = dump tĩnh). SQL chép NGUYÊN VĂN
 * từ tài liệu migration: 09b §7, 09c §7, 09a §7.0, 04b §10.0; cộng G-DOC-1/3 của kế hoạch cutover
 * (phía nguồn + phía đích). Chỉ trả COUNT(*).
 *
 * Câu trùng hệt giữa hai tài liệu chỉ chạy MỘT lần (id ghép, vd `09b-7.4f/09c-7.1a`).
 */
import { countBothGate, countGate, skippedGate } from './factory';
import { Gate } from './types';

/** `CLS_TREASURY::dieuKienHoFx('h')` (cls.treasury.php:1159-1164) — bản MariaDB, nguyên văn. */
export const FX_FAMILY_MY =
  "(h.source_module IN ('transfer','fx_transfer','fx_quydoi','fx_transfer_dao','fx_transfer_lai','fx_dieuchinh')" +
  " OR h.source_module LIKE 'fx\\_huy%'" +
  " OR (h.source_module LIKE 'daoxoa\\_fx\\_%' AND h.source_module NOT LIKE 'daoxoa\\_fx\\_fee%'))";
/** cùng mệnh đề, Postgres (thoát `_` bằng `\\_` — standard_conforming_strings: '\\' là ký tự thường, LIKE mặc định ESCAPE '\\'). */
export const FX_FAMILY_PG =
  "(h.source_module IN ('transfer','fx_transfer','fx_quydoi','fx_transfer_dao','fx_transfer_lai','fx_dieuchinh')" +
  " OR h.source_module LIKE 'fx\\_huy%'" +
  " OR (h.source_module LIKE 'daoxoa\\_fx\\_%' AND h.source_module NOT LIKE 'daoxoa\\_fx\\_fee%'))";

const D9B = '09b §7';
const D9C = '09c §7';
const D9A = '09a §7.0';
const D4B = '04b §10.0';

// ───────────────────────────────────────────────────────── 09b §7
const G09B: Gate[] = [
  countGate({ id: '09b-7.1a', doc: D9B + '.1', title: 'dòng đảo trỏ dòng gốc không tồn tại',
    sql: 'SELECT COUNT(*) FROM tbl_account_histories h WHERE reversal_of>0 AND NOT EXISTS (SELECT 1 FROM tbl_account_histories o WHERE o.id=h.reversal_of)' }),
  countGate({ id: '09b-7.1b', doc: D9B + '.1', title: 'dòng đảo có source_id≠reversal_of hoặc module không daoxoa%',
    sql: "SELECT COUNT(*) FROM tbl_account_histories WHERE reversal_of>0 AND (source_id<>reversal_of OR source_module NOT LIKE 'daoxoa%')" }),
  countGate({ id: '09b-7.1c', doc: D9B + '.1', title: "module daoxoa% mà reversal_of=0",
    sql: "SELECT COUNT(*) FROM tbl_account_histories WHERE source_module LIKE 'daoxoa%' AND reversal_of=0" }),
  countGate({ id: '09b-7.1d', doc: D9B + '.1', title: 'một dòng gốc bị đảo nhiều lần',
    sql: 'SELECT COUNT(*) FROM (SELECT reversal_of FROM tbl_account_histories WHERE reversal_of>0 GROUP BY reversal_of HAVING COUNT(*)>1) x' }),
  countGate({ id: '09b-7.1e', doc: D9B + '.1', title: 'dòng đảo lệch tiền hoặc ví so với gốc',
    sql: 'SELECT COUNT(*) FROM tbl_account_histories r JOIN tbl_account_histories o ON o.id=r.reversal_of WHERE r.money<>-o.money OR BINARY r.tk_code<>BINARY o.tk_code' }),
  countGate({ id: '09b-7.2', doc: D9B + '.2', title: 'khoá (module,source_id,tk,type) còn hiệu lực bị trùng',
    sql: 'SELECT COUNT(*) FROM (SELECT source_module, source_id, tk_code, type FROM tbl_account_histories h WHERE source_id>0 AND NOT EXISTS (SELECT 1 FROM tbl_account_histories r WHERE r.reversal_of=h.id) GROUP BY 1,2,3,4 HAVING COUNT(*)>1) x' }),
  countGate({ id: '09b-7.3a', doc: D9B + '.3', title: 'status ngoài {1,9}',
    sql: 'SELECT COUNT(*) FROM tbl_account_histories WHERE status NOT IN (1,9) OR status IS NULL' }),
  countGate({ id: '09b-7.3b', doc: D9B + '.3', title: "type ngoài {in,out,tranfer}",
    sql: "SELECT COUNT(*) FROM tbl_account_histories WHERE type NOT IN ('in','out','tranfer') OR type IS NULL" }),
  countGate({ id: '09b-7.3c', doc: D9B + '.3', title: 'money NULL hoặc 0',
    sql: 'SELECT COUNT(*) FROM tbl_account_histories WHERE money IS NULL OR money=0' }),
  countGate({ id: '09b-7.3d', doc: D9B + '.3', title: 'dấu money trái type (trừ fx_dieuchinh)',
    sql: "SELECT COUNT(*) FROM tbl_account_histories WHERE (type='in' AND money<0 AND source_module<>'fx_dieuchinh') OR (type IN ('out','tranfer') AND money>0 AND source_module<>'fx_dieuchinh')" }),
  countGate({ id: '09b-7.3e', doc: D9B + '.3', title: 'tk_code có khoảng trắng thừa',
    sql: 'SELECT COUNT(*) FROM tbl_account_histories WHERE LENGTH(tk_code)<>LENGTH(TRIM(tk_code))' }),
  countGate({ id: '09b-7.3f', doc: D9B + '.3', title: "tk_code không có trong tbl_accounts (trừ CHI-TBS)",
    sql: "SELECT COUNT(*) FROM tbl_account_histories h WHERE NOT EXISTS (SELECT 1 FROM tbl_accounts a WHERE a.code=h.tk_code) AND h.tk_code<>'CHI-TBS'" }),
  countGate({ id: '09b-7.3g', doc: D9B + '.3', title: 'dòng status=1 mà ví không tồn tại',
    sql: 'SELECT COUNT(*) FROM tbl_account_histories WHERE status=1 AND NOT EXISTS (SELECT 1 FROM tbl_accounts a WHERE a.code=tk_code)' }),
  countGate({ id: '09b-7.4a', doc: D9B + '.4', title: "dòng sổ 'payment' trỏ phiếu chưa confirm=yes",
    sql: "SELECT COUNT(*) FROM tbl_account_histories h JOIN tbl_payment p ON p.id=h.source_id WHERE h.source_module='payment' AND p.confirm<>'yes'" }),
  countGate({ id: '09b-7.4b', doc: D9B + '.4', title: "dòng sổ 'bank_tx' trỏ giao dịch bank không tồn tại",
    sql: "SELECT COUNT(*) FROM tbl_account_histories h WHERE source_module='bank_tx' AND NOT EXISTS (SELECT 1 FROM tbl_bank_transaction b WHERE b.id=h.source_id)" }),
  countGate({ id: '09b-7.4c', doc: D9B + '.4', title: "dòng sổ 'bank_tx' lệch tiền/ví so với giao dịch bank",
    sql: "SELECT COUNT(*) FROM tbl_account_histories h JOIN tbl_bank_transaction b ON b.id=h.source_id WHERE h.source_module='bank_tx' AND (h.money<>b.tranAmount OR BINARY h.tk_code<>BINARY b.tk_code)" }),
  countGate({ id: '09b-7.4d/09c-7.2a', doc: D9B + '.4 / ' + D9C + '.2', title: "giao dịch '+' có ví sau mốc 02/09 22:46 thiếu dòng sổ",
    sql: "SELECT COUNT(*) FROM tbl_bank_transaction b JOIN tbl_accounts a ON BINARY a.code=BINARY b.tk_code WHERE b.tranType='+' AND b.cdate>=UNIX_TIMESTAMP('2026-09-02 22:46:00') AND NOT EXISTS (SELECT 1 FROM tbl_account_histories h WHERE h.source_module='bank_tx' AND h.source_id=b.id)" }),
  countGate({ id: '09b-7.4e', doc: D9B + '.4', title: "dòng sổ 'thu_chi_tbs' trỏ phiếu duyệt không tồn tại",
    sql: "SELECT COUNT(*) FROM tbl_account_histories h WHERE source_module='thu_chi_tbs' AND NOT EXISTS (SELECT 1 FROM tbl_approval_requests r WHERE r.id=h.source_id)" }),
  countGate({ id: '09b-7.4f/09c-7.1a', doc: D9B + '.4 / ' + D9C + '.1', title: 'FX approved (≠#19) không có đúng 2 chân fx_transfer hiệu lực',
    sql: "SELECT COUNT(*) FROM tbl_fx_transfers f WHERE f.status='approved' AND f.id<>19 AND (SELECT COUNT(*) FROM tbl_account_histories h WHERE h.source_module='fx_transfer' AND h.source_id=f.id AND h.status=1 AND NOT EXISTS (SELECT 1 FROM tbl_account_histories r WHERE r.reversal_of=h.id))<>2" }),
];

// ───────────────────────────────────────────────────────── 09c §7
const NOT_REV = 'NOT EXISTS (SELECT 1 FROM tbl_account_histories r WHERE r.reversal_of=h.id)';
const G09C: Gate[] = [
  skippedGate({ id: '09c-7.0', doc: D9C + '.0', title: 'chụp lặng yên 2 lần cách ≥5 phút', kind: 'source',
    reason: 'dump tĩnh (không có luồng ghi) — hai lần chụp giống nhau theo định nghĩa; chỉ có nghĩa lúc rút thật trên prod' }),
  countGate({ id: '09c-7.1b', doc: D9C + '.1', title: 'FX approved có phí mà thiếu dòng fx_fee hiệu lực',
    sql: `SELECT COUNT(*) FROM tbl_fx_transfers f WHERE f.status='approved' AND f.fee>0 AND NOT EXISTS (SELECT 1 FROM tbl_account_histories h WHERE h.source_module='fx_fee' AND h.source_id=f.id AND h.status=1 AND ${NOT_REV})` }),
  countGate({ id: '09c-7.1c', doc: D9C + '.1', title: 'FX approved 2 chặng không có đúng 2 dòng fx_quydoi',
    sql: `SELECT COUNT(*) FROM tbl_fx_transfers f WHERE f.status='approved' AND f.agent_tk<>'' AND (SELECT COUNT(*) FROM tbl_account_histories h WHERE h.source_module='fx_quydoi' AND h.source_id=f.id AND h.status=1 AND ${NOT_REV})<>2` }),
  countGate({ id: '09c-7.1d', doc: D9C + '.1', title: 'FX chưa approved (≠#19) mà có dòng sổ họ FX hiệu lực',
    sql: `SELECT COUNT(*) FROM tbl_fx_transfers f WHERE f.status<>'approved' AND f.id<>19 AND EXISTS (SELECT 1 FROM tbl_account_histories h WHERE h.source_module IN ('fx_transfer','fx_fee','fx_quydoi') AND h.source_id=f.id AND h.status=1 AND ${NOT_REV})` }),
  countGate({ id: '09c-7.1e', doc: D9C + '.1', title: 'agent_amount ≠ ROUND(amount_in×agent_rate,2)',
    sql: "SELECT COUNT(*) FROM tbl_fx_transfers WHERE agent_tk<>'' AND ROUND(amount_in*agent_rate,2)<>agent_amount" }),
  countGate({ id: '09c-7.1f', doc: D9C + '.1', title: 'chân ra fx_transfer lệch tiền/ví/tỷ giá so với phiếu',
    sql: "SELECT COUNT(*) FROM tbl_fx_transfers f JOIN tbl_account_histories o ON o.source_module='fx_transfer' AND o.source_id=f.id AND o.type='tranfer' WHERE f.status='approved' AND f.id<>19 AND (o.money<>-f.amount_out OR BINARY o.tk_code<>BINARY f.from_tk OR o.rate<>ROUND(f.rate,2))" }),
  countGate({ id: '09c-7.1g', doc: D9C + '.1', title: 'chân vào fx_transfer lệch tiền/ví so với phiếu',
    sql: "SELECT COUNT(*) FROM tbl_fx_transfers f JOIN tbl_account_histories i ON i.source_module='fx_transfer' AND i.source_id=f.id AND i.type='in' WHERE f.status='approved' AND f.id<>19 AND (i.money<>f.amount_in OR BINARY i.tk_code<>BINARY f.to_tk)" }),
  countGate({ id: '09c-7.2b', doc: D9C + '.2', title: "dòng sổ bank_tx lệch tiền/ví hoặc giao dịch không phải '+'",
    sql: "SELECT COUNT(*) FROM tbl_account_histories h JOIN tbl_bank_transaction b ON b.id=h.source_id WHERE h.source_module='bank_tx' AND (h.money<>b.tranAmount OR BINARY h.tk_code<>BINARY b.tk_code OR b.tranType<>'+')" }),
  countGate({ id: '09c-7.2c', doc: D9C + '.2', title: 'bankid (≠\'\') trùng',
    sql: "SELECT COUNT(*) FROM (SELECT bankid FROM tbl_bank_transaction WHERE bankid<>'' GROUP BY BINARY bankid HAVING COUNT(*)>1) x" }),
  countGate({ id: '09c-7.2d', doc: D9C + '.2', title: 'tranType/tranAmount ngoài miền',
    sql: "SELECT COUNT(*) FROM tbl_bank_transaction WHERE tranType NOT IN ('+','-') OR tranType IS NULL OR tranAmount IS NULL OR tranAmount<=0" }),
  countGate({ id: '09c-7.2e', doc: D9C + '.2', title: 'status/confirm/type ngoài miền',
    sql: "SELECT COUNT(*) FROM tbl_bank_transaction WHERE status NOT IN ('yes','no','huy') OR confirm NOT IN ('yes','no') OR type NOT IN ('1','2','3','4','5')" }),
  countGate({ id: '09c-7.2f', doc: D9C + '.2', title: 'tk_code/cus_id có khoảng trắng thừa',
    sql: 'SELECT COUNT(*) FROM tbl_bank_transaction WHERE LENGTH(tk_code)<>LENGTH(TRIM(tk_code)) OR LENGTH(cus_id)<>LENGTH(TRIM(cus_id))' }),
  countGate({ id: '09c-7.2g', doc: D9C + '.2', title: 'chi tiết bank mồ côi',
    sql: 'SELECT COUNT(*) FROM tbl_bank_transaction_detail d WHERE NOT EXISTS (SELECT 1 FROM tbl_bank_transaction b WHERE b.id=d.tranId)' }),
  countGate({ id: '09c-7.2h', doc: D9C + '.2', title: 'giao dịch confirm=yes mà chi tiết chưa yes',
    sql: "SELECT COUNT(*) FROM tbl_bank_transaction_detail d JOIN tbl_bank_transaction b ON b.id=d.tranId WHERE b.confirm='yes' AND d.confirm<>'yes'" }),
  countGate({ id: '09c-7.3a', doc: D9C + '.3', title: 'link đối soát trỏ giao dịch không tồn tại',
    sql: 'SELECT COUNT(*) FROM tbl_bank_reconcile_link l WHERE NOT EXISTS (SELECT 1 FROM tbl_bank_transaction b WHERE b.id=l.bank_tran_id)' }),
  countGate({ id: '09c-7.3b', doc: D9C + '.3', title: 'link fx_transfer trỏ phiếu FX không tồn tại',
    sql: "SELECT COUNT(*) FROM tbl_bank_reconcile_link l WHERE l.doc_module='fx_transfer' AND NOT EXISTS (SELECT 1 FROM tbl_fx_transfers f WHERE f.id=l.doc_id)" }),
  countGate({ id: '09c-7.3c', doc: D9C + '.3', title: 'link thu_chi_tbs trỏ phiếu duyệt không tồn tại',
    sql: "SELECT COUNT(*) FROM tbl_bank_reconcile_link l WHERE l.doc_module='thu_chi_tbs' AND NOT EXISTS (SELECT 1 FROM tbl_approval_requests r WHERE r.id=l.doc_id)" }),
  countGate({ id: '09c-7.3d', doc: D9C + '.3', title: 'khớp chi trỏ giao dịch/phiếu duyệt không tồn tại',
    sql: 'SELECT COUNT(*) FROM tbl_bank_chi_match m WHERE NOT EXISTS (SELECT 1 FROM tbl_bank_transaction b WHERE b.id=m.bank_tx_id) OR NOT EXISTS (SELECT 1 FROM tbl_approval_requests r WHERE r.id=m.request_id)' }),
  countGate({ id: '09c-7.3e', doc: D9C + '.3', title: 'một giao dịch có >1 khớp chi đang hiệu lực',
    sql: 'SELECT COUNT(*) FROM (SELECT bank_tx_id FROM tbl_bank_chi_match WHERE unmatched_at IS NULL GROUP BY 1 HAVING COUNT(*)>1) x' }),
  countGate({ id: '09c-7.3f', doc: D9C + '.3', title: 'neo FX: tiền giao dịch ≠ amount_out',
    sql: 'SELECT COUNT(*) FROM tbl_fx_transfers f JOIN tbl_bank_transaction b ON b.id=f.bank_tran_id WHERE b.tranAmount<>f.amount_out' }),
  countGate({ id: '09c-7.3g', doc: D9C + '.3', title: 'một giao dịch neo >1 phiếu FX',
    sql: 'SELECT COUNT(*) FROM (SELECT bank_tran_id FROM tbl_fx_transfers WHERE bank_tran_id>0 GROUP BY 1 HAVING COUNT(*)>1) x' }),
  countGate({ id: '09c-7.3h', doc: D9C + '.3', title: 'dòng sổ fx_transfer có tranId ≠ neo của phiếu',
    sql: "SELECT COUNT(*) FROM tbl_account_histories h JOIN tbl_fx_transfers f ON f.id=h.source_id WHERE h.source_module='fx_transfer' AND h.tranId>0 AND h.tranId<>f.bank_tran_id" }),
  countGate({ id: '09c-7.3i', doc: D9C + '.3', title: 'rác test ZZ trong phiếu FX',
    sql: "SELECT COUNT(*) FROM tbl_fx_transfers WHERE from_tk LIKE 'ZZ%' OR to_tk LIKE 'ZZ%'" }),
  countGate({ id: '09c-7.3j', doc: D9C + '.3', title: 'tbl_fx_adjustments có dòng',
    sql: 'SELECT COUNT(*) FROM tbl_fx_adjustments' }),
];

// ───────────────────────────────────────────────────────── 09a §7.0
const G09A: Gate[] = [
  countGate({ id: '09a-7.0a', doc: D9A, title: 'status ≠ confirm (A8)', sql: 'SELECT COUNT(*) FROM tbl_payment WHERE status<>confirm' }),
  countGate({ id: '09a-7.0b', doc: D9A, title: 'confirm ngoài {yes,no} hoặc có khoảng trắng',
    sql: "SELECT COUNT(*) FROM tbl_payment WHERE confirm NOT IN ('yes','no') OR LENGTH(confirm)<>CHAR_LENGTH(TRIM(confirm))" }),
  countGate({ id: '09a-7.0c', doc: D9A, title: 'payment ngoài {NULL,yes,no}',
    sql: "SELECT COUNT(*) FROM tbl_payment WHERE payment IS NOT NULL AND payment NOT IN ('yes','no')" }),
  countGate({ id: '09a-7.0d', doc: D9A, title: 'pdate có ⇔ payment=yes bị vi phạm',
    sql: "SELECT COUNT(*) FROM tbl_payment WHERE (pdate IS NOT NULL) <> (IFNULL(payment,'')='yes')" }),
  countGate({ id: '09a-7.0e', doc: D9A, title: 'price_cyn NULL/âm hoặc rate_buy NULL/≤0',
    sql: 'SELECT COUNT(*) FROM tbl_payment WHERE price_cyn IS NULL OR price_cyn<0 OR rate_buy IS NULL OR rate_buy<=0' }),
  countGate({ id: '09a-7.0f', doc: D9A, title: "pay_type ngoài {'',supplier}",
    sql: "SELECT COUNT(*) FROM tbl_payment WHERE pay_type NOT IN ('','supplier')" }),
  countGate({ id: '09a-7.0g', doc: D9A, title: 'phiếu confirm=no mà có GL/sổ quỹ (A9)',
    sql: "SELECT COUNT(*) FROM tbl_payment p WHERE p.confirm='no' AND (EXISTS(SELECT 1 FROM tbl_gl_entry e WHERE e.source_type='payment' AND e.source_id=p.id) OR EXISTS(SELECT 1 FROM tbl_account_histories h WHERE h.source_module='payment' AND h.source_id=p.id))" }),
  countGate({ id: '09a-7.0h', doc: D9A, title: 'JSON ảnh đính kèm hỏng',
    sql: "SELECT COUNT(*) FROM tbl_payment WHERE (bill_images<>'' AND JSON_VALID(bill_images)=0) OR (ncc_invoice_images<>'' AND JSON_VALID(ncc_invoice_images)=0) OR (ncc_packing_list_images<>'' AND JSON_VALID(ncc_packing_list_images)=0)" }),
  countGate({ id: '09a-7.0i', doc: D9A, title: 'rác test ZZ',
    sql: "SELECT COUNT(*) FROM tbl_payment WHERE saler LIKE 'zz%' OR code_order LIKE 'ZZ%'" }),
];

// ───────────────────────────────────────────────────────── 04b §10.0
const G04B: Gate[] = [
  countGate({ id: '04b-10.0a', doc: D4B, title: 'state ngoài {returned,resubmitted}',
    sql: "SELECT COUNT(*) FROM tbl_return_state WHERE state NOT IN ('returned','resubmitted')" }),
  countGate({ id: '04b-10.0b', doc: D4B, title: 'object_type ngoài {approval_request,payment}',
    sql: "SELECT COUNT(*) FROM tbl_return_state WHERE object_type NOT IN ('approval_request','payment')" }),
  countGate({ id: '04b-10.0c', doc: D4B, title: "(state='returned') ≠ (resubmitted_at=0)",
    sql: "SELECT COUNT(*) FROM tbl_return_state WHERE (state='returned') <> (resubmitted_at=0)" }),
  countGate({ id: '04b-10.0d', doc: D4B, title: 'object_type/state có khoảng trắng (PAD SPACE: đo LENGTH)',
    sql: 'SELECT COUNT(*) FROM tbl_return_state WHERE LENGTH(object_type)<>CHAR_LENGTH(TRIM(object_type)) OR LENGTH(state)<>CHAR_LENGTH(TRIM(state))' }),
  countGate({ id: '04b-10.0e', doc: D4B, title: 'edit_mode ngoài {off,all,whitelist}',
    sql: "SELECT COUNT(*) FROM tbl_return_config WHERE edit_mode NOT IN ('off','all','whitelist')" }),
  countGate({ id: '04b-10.0f', doc: D4B, title: 'fields_opened không phải JSON mảng',
    sql: "SELECT COUNT(*) FROM tbl_return_state WHERE JSON_VALID(fields_opened)=0 OR JSON_TYPE(fields_opened)<>'ARRAY'" }),
];

// ───────────────────────────────────────────────────────── G-DOC (kế hoạch cutover, bổ sung 25/09)
/** mã quỹ khác bản TRIM+UPPER của chính nó (MariaDB: so BINARY + LENGTH vì PAD SPACE/_ci). */
const my = (col: string) => `(LENGTH(${col})<>LENGTH(TRIM(${col})) OR BINARY ${col}<>BINARY UPPER(${col}))`;
const pg = (col: string) => `(${col} <> upper(btrim(${col})))`;
/** source_module là khoá CHỮ THƯỜNG ⇒ chỉ đo TRIM (cùng diễn giải với ETL Task 2). */
const myTrim = (col: string) => `(LENGTH(${col})<>LENGTH(TRIM(${col})))`;
const pgTrim = (col: string) => `(${col} <> btrim(${col}))`;
function gdoc3(f: (c: string) => string, t: (c: string) => string): string {
  return [
    `SELECT (SELECT COUNT(*) FROM tbl_account_histories WHERE ${f('tk_code')} OR ${t('source_module')})`,
    `+ (SELECT COUNT(*) FROM tbl_accounts WHERE ${f('code')})`,
    `+ (SELECT COUNT(*) FROM tbl_payment WHERE ${f('account_code')})`,
    `+ (SELECT COUNT(*) FROM tbl_fx_transfers WHERE ${f('from_tk')} OR ${f('to_tk')} OR ${f('agent_tk')})`,
    `+ (SELECT COUNT(*) FROM tbl_bank_transaction WHERE ${f('tk_code')})`,
    `+ (SELECT COUNT(*) FROM tbl_payment_source WHERE ${f('tk_code')})`,
    `+ (SELECT COUNT(*) FROM tbl_account_changelog WHERE ${f('account_code')}) AS c`,
  ].join(' ');
}

const GDOC: Gate[] = [
  countBothGate({
    id: 'G-DOC-1', doc: 'cutover-so-quy-ke-hoach §bổ sung 25/09',
    title: 'dòng status=1, ≠tranfer, ngoài họ FX mà dấu money trái type hoặc type ∉ {in,out}',
    sourceSql: `SELECT COUNT(*) AS c FROM tbl_account_histories h WHERE h.status=1 AND h.type<>'tranfer' AND NOT ${FX_FAMILY_MY} AND ((h.type='in' AND h.money<0) OR (h.type='out' AND h.money>0) OR h.type NOT IN ('in','out'))`,
    targetSql: `SELECT COUNT(*) AS c FROM tbl_account_histories h WHERE h.status=1 AND h.type<>'tranfer' AND NOT ${FX_FAMILY_PG} AND ((h.type='in' AND h.money<0) OR (h.type='out' AND h.money>0) OR h.type NOT IN ('in','out'))`,
  }),
  skippedGate({
    id: 'G-DOC-2', doc: 'cutover-so-quy-ke-hoach §bổ sung 25/09', kind: 'gdoc',
    title: 'mọi user bật thuộc nhóm kế toán có account.view sau ETL vai #01',
    reason: 'dump KHÔNG có tbl_user (không nối được user → nhóm isaccountant) và ETL vai #01 không thuộc lô L0 — đo ở lô #01',
  }),
  countBothGate({
    id: 'G-DOC-3', doc: 'cutover-so-quy-ke-hoach §bổ sung 25/09',
    title: 'mã quỹ (tk_code/account_code/agent_tk/code…) khác bản TRIM+UPPER; source_module khác bản TRIM',
    sourceSql: gdoc3(my, myTrim),
    targetSql: gdoc3(pg, pgTrim),
  }),
];

export const SOURCE_GATES: readonly Gate[] = [...G09B, ...G09C, ...G09A, ...G04B];
export const GDOC_GATES: readonly Gate[] = GDOC;
