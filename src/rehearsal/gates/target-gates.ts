/**
 * L0 Task 3 — cổng ĐÍCH ở MỨC CỘT (nguồn MariaDB ↔ đích Postgres ra CÙNG bảng):
 * 09b §8.1–8.4 + §6, 09c §8.1–8.4, 09a §7.1–7.3, 04b §10.1–10.2.
 *
 * SQL theo tài liệu; các chỗ chỉnh CÓ CHỦ Ý để hai phía so được (ghi cả trong báo cáo):
 *  - MariaDB `SUM(điều kiện)` trả NULL khi nhóm rỗng/toàn NULL, PG `COUNT(*) FILTER` trả 0 ⇒ bọc
 *    `COALESCE(…,0)` phía MariaDB.
 *  - So `''` phía MariaDB bằng `LENGTH(x)=0` (PAD SPACE: `x=''` khớp cả '  ').
 *  - So chuỗi phía MariaDB bằng `BINARY` (collation _ci).
 *  - Cột enum PG ép `::text`; boolean PG ⇄ tinyint MariaDB so qua 1/0.
 *  - Nguồn LOẠI đúng các dòng ETL đã loại theo tài liệu (09a A2 + rác ZZ, 04b A1/A4/A5).
 * Tham chiếu tới bảng CHƯA nạp ở lô L0 (GL #03, phiếu duyệt #04, ví KH #03) ⇒ SKIPPED có lý do.
 */
import { compareKeyed } from './compare';
import { crossRefGate, keyedGate, scalarGate, skippedGate } from './factory';
import { Gate, GateEval, Row } from './types';
import { nextSeqValue, parseSeqFloor, sourceSeqFloorSql } from '../etl/seq-floor';

const D9B = '09b §8';
const D9C = '09c §8';
const D9A = '09a §7';
const D4B = '04b §10';

const SKIP_GL = 'tbl_gl_entry/tbl_gl_line (#03 GL) không thuộc lô L0 — đích rỗng; đo khi nạp #03';
const SKIP_APPR = 'tbl_approval_requests/steps (#04) không thuộc lô L0 — đích rỗng; đo khi nạp #04';
const SKIP_WD = 'tbl_wallet_detail (#03 ví KH) không thuộc lô L0 — đích rỗng; đo khi nạp #03';

/** SUM(điều kiện) phía MariaDB — 0 khi nhóm không có dòng thoả (khớp COUNT FILTER của PG). */
const cnt = (cond: string) => `COALESCE(SUM(${cond}),0)`;
const fcnt = (cond: string) => `COUNT(*) FILTER (WHERE ${cond})`;

// ───────────────────────────────────────────────────────── 09b §8.1
const WALLET_SRC = `SELECT a.code, a.currency, a.acc_group, a.opening_balance,
  COALESCE(SUM(CASE WHEN h.status=1 THEN h.money END),0) AS hist1,
  a.opening_balance + COALESCE(SUM(CASE WHEN h.status=1 THEN h.money END),0) AS balance,
  COUNT(h.id) AS n, ${cnt('h.status=9')} AS n9
FROM tbl_accounts a LEFT JOIN tbl_account_histories h ON BINARY h.tk_code = BINARY a.code
GROUP BY a.code, a.currency, a.acc_group, a.opening_balance ORDER BY a.code`;
const WALLET_TGT = `SELECT a.code, a.currency::text AS currency, a.acc_group::text AS acc_group, a.opening_balance,
  COALESCE(SUM(h.money) FILTER (WHERE h.status=1),0) AS hist1,
  a.opening_balance + COALESCE(SUM(h.money) FILTER (WHERE h.status=1),0) AS balance,
  COUNT(h.id) AS n, ${fcnt('h.status=9')} AS n9
FROM tbl_accounts a LEFT JOIN tbl_account_histories h ON h.tk_code = a.code
GROUP BY a.code, a.currency, a.acc_group, a.opening_balance ORDER BY a.code`;

/** số dư ví nguồn (09b §8.1) — dùng lại cho 8.1c và số vàng (a). */
export const WALLET_BALANCE_SRC = WALLET_SRC;

const G_8_1: Gate[] = [
  keyedGate({ id: '09b-8.1a', doc: D9B + '.1', title: '⭐ số dư TỪNG VÍ opening + Σmoney status=1 (+ n, n9)',
    sourceSql: WALLET_SRC, targetSql: WALLET_TGT, key: ['code'],
    values: ['currency', 'acc_group', 'opening_balance', 'hist1', 'balance', 'n', 'n9'], keysAreLabels: true }),
  keyedGate({ id: '09b-8.1b', doc: D9B + '.1', title: 'phần sổ quỹ KHÔNG thuộc ví nào (CHI-TBS…) theo tk × status',
    sourceSql: 'SELECT tk_code, status, COUNT(*) AS n, SUM(money) AS s FROM tbl_account_histories h WHERE NOT EXISTS (SELECT 1 FROM tbl_accounts a WHERE BINARY a.code=BINARY h.tk_code) GROUP BY tk_code, status',
    targetSql: 'SELECT tk_code, status, COUNT(*) AS n, SUM(money) AS s FROM tbl_account_histories h WHERE NOT EXISTS (SELECT 1 FROM tbl_accounts a WHERE a.code=h.tk_code) GROUP BY tk_code, status',
    key: ['tk_code', 'status'], values: ['n', 's'], keysAreLabels: true }),
  {
    id: '09b-8.1c', doc: D9B + '.1 / §8.5.5', kind: 'target',
    title: 'TreasuryService.getBalance(code) trên đích = số dư nguồn, TỪNG ví',
    async run(ctx): Promise<GateEval> {
      if (!ctx.services) return { status: 'SKIPPED', reason: 'không có service v2' };
      const src = await ctx.source.query(WALLET_SRC);
      const tgt: Row[] = [];
      for (const r of src) {
        const code = String(r.code);
        tgt.push({ code, balance: await ctx.services.treasury.getBalance(code) });
      }
      return compareKeyed(src.map((r) => ({ code: r.code, balance: r.balance })), tgt, {
        key: ['code'], values: ['balance'], keysAreLabels: true,
      });
    },
  },
];

// ───────────────────────────────────────────────────────── 09b §8.2
const H_VALS = ['n', 's_id', 's_money', 's_rate', 'n_rate_null', 's_cdate', 's_approve_date', 'n_approve_user_null',
  's_source_id', 's_reversal_of', 's_ref_request_id', 's_po_id', 's_container_id', 's_tran_id', 'n_tran_id_null',
  's_trandetail_id', 's_wallet_detail_id', 'n_wallet_detail_null', 'n_cus_null', 'n_cus_empty', 'n_gout_null',
  'n_gout_empty', 'len_note', 'len_order_code', 'len_reversal_reason', 'len_cuser'];
const H_SRC = `SELECT source_module, tk_code, type, status,
  COUNT(*) AS n, SUM(id) AS s_id, SUM(money) AS s_money, SUM(IFNULL(rate,0)) AS s_rate, ${cnt('rate IS NULL')} AS n_rate_null,
  SUM(cdate) AS s_cdate, SUM(IFNULL(approve_date,0)) AS s_approve_date, ${cnt('approve_user IS NULL')} AS n_approve_user_null,
  SUM(source_id) AS s_source_id, SUM(reversal_of) AS s_reversal_of, SUM(ref_request_id) AS s_ref_request_id,
  SUM(po_id) AS s_po_id, SUM(container_id) AS s_container_id, SUM(IFNULL(tranId,0)) AS s_tran_id, ${cnt('tranId IS NULL')} AS n_tran_id_null,
  SUM(IFNULL(trandetailId,0)) AS s_trandetail_id, SUM(IFNULL(wallet_detail_id,0)) AS s_wallet_detail_id,
  ${cnt('wallet_detail_id IS NULL')} AS n_wallet_detail_null, ${cnt('cus_id IS NULL')} AS n_cus_null, ${cnt('LENGTH(cus_id)=0')} AS n_cus_empty,
  ${cnt('gout IS NULL')} AS n_gout_null, ${cnt('LENGTH(gout)=0')} AS n_gout_empty, SUM(CHAR_LENGTH(note)) AS len_note,
  SUM(CHAR_LENGTH(order_code)) AS len_order_code, SUM(CHAR_LENGTH(reversal_reason)) AS len_reversal_reason, SUM(CHAR_LENGTH(cuser)) AS len_cuser
FROM tbl_account_histories GROUP BY 1,2,3,4`;
const H_TGT = `SELECT source_module, tk_code, type, status,
  COUNT(*) AS n, SUM(id) AS s_id, SUM(money) AS s_money, SUM(COALESCE(rate,0)) AS s_rate, ${fcnt('rate IS NULL')} AS n_rate_null,
  SUM(cdate) AS s_cdate, SUM(COALESCE(approve_date,0)) AS s_approve_date, ${fcnt('approve_user IS NULL')} AS n_approve_user_null,
  SUM(source_id) AS s_source_id, SUM(reversal_of) AS s_reversal_of, SUM(ref_request_id) AS s_ref_request_id,
  SUM(po_id) AS s_po_id, SUM(container_id) AS s_container_id, SUM(COALESCE(tran_id,0)) AS s_tran_id, ${fcnt('tran_id IS NULL')} AS n_tran_id_null,
  SUM(COALESCE(trandetail_id,0)) AS s_trandetail_id, SUM(COALESCE(wallet_detail_id,0)) AS s_wallet_detail_id,
  ${fcnt('wallet_detail_id IS NULL')} AS n_wallet_detail_null, ${fcnt('cus_id IS NULL')} AS n_cus_null, ${fcnt("cus_id=''")} AS n_cus_empty,
  ${fcnt('gout IS NULL')} AS n_gout_null, ${fcnt("gout=''")} AS n_gout_empty, SUM(char_length(note)) AS len_note,
  SUM(char_length(order_code)) AS len_order_code, SUM(char_length(reversal_reason)) AS len_reversal_reason, SUM(char_length(cuser)) AS len_cuser
FROM tbl_account_histories GROUP BY 1,2,3,4`;

const ACC_VALS = ['currency', 'acc_group', 'has_gout', 'display_order', 'is_active', 'opening_balance', 'len_stk', 'bank_code',
  'wallet_stream', 'custom_label', 'cdate', 'mdate', 'owner_uid', 'gl_account', 'quy_doi_sang', 'len_name', 'len_subname', 'len_note'];
const G_8_2: Gate[] = [
  keyedGate({ id: '09b-8.2a', doc: D9B + '.2', title: 'sổ quỹ theo (module, tk, type, status) — mỗi cột một tổng',
    sourceSql: H_SRC, targetSql: H_TGT, key: ['source_module', 'tk_code', 'type', 'status'], values: H_VALS, keysAreLabels: true }),
  keyedGate({ id: '09b-8.2b', doc: D9B + '.2', title: 'tbl_accounts từng dòng (stk chỉ so ĐỘ DÀI)',
    sourceSql: `SELECT code, currency, acc_group, has_gout, display_order, is_active, opening_balance, CHAR_LENGTH(stk) AS len_stk, bank_code,
      wallet_stream, custom_label, cdate, mdate, owner_uid, gl_account, quy_doi_sang, CHAR_LENGTH(name) AS len_name,
      CHAR_LENGTH(subname) AS len_subname, CHAR_LENGTH(note) AS len_note FROM tbl_accounts`,
    targetSql: `SELECT code, currency::text AS currency, acc_group::text AS acc_group, has_gout, display_order, is_active, opening_balance,
      char_length(stk) AS len_stk, bank_code, wallet_stream, custom_label, cdate, mdate, owner_uid, gl_account, quy_doi_sang,
      char_length(name) AS len_name, char_length(subname) AS len_subname, char_length(note) AS len_note FROM tbl_accounts`,
    key: ['code'], values: ACC_VALS, keysAreLabels: true }),
];

// ───────────────────────────────────────────────────────── 09b §8.3
const S83_VALS = ['bank_info_null', 'bank_info_empty', 'gout_null', 'gout_empty', 'cus_null', 'cus_empty', 'cus_val',
  'wd_null', 'wd_zero', 'wd_val', 'rate_null', 'rate_zero', 'rate_val', 'au_null', 'ad_null', 'tran_null', 'tran_zero',
  'tran_val', 'tdet_null', 'tdet_zero', 'tdet_val', 'rev_zero', 'rev_val', 'sm_empty', 'sm_val', 'st0', 'st1', 'st9',
  'money_frac', 'money_gt2dp'];
const G_8_3: Gate[] = [
  scalarGate({ id: '09b-8.3', doc: D9B + '.3', title: 'sentinel sổ quỹ (NULL / \'\' / 0 / giá trị)',
    sourceSql: `SELECT ${cnt('bank_info IS NULL')} bank_info_null, ${cnt('LENGTH(bank_info)=0')} bank_info_empty,
      ${cnt('gout IS NULL')} gout_null, ${cnt('LENGTH(gout)=0')} gout_empty, ${cnt('cus_id IS NULL')} cus_null,
      ${cnt('LENGTH(cus_id)=0')} cus_empty, ${cnt('LENGTH(cus_id)>0')} cus_val, ${cnt('wallet_detail_id IS NULL')} wd_null,
      ${cnt('wallet_detail_id=0')} wd_zero, ${cnt('wallet_detail_id<>0')} wd_val, ${cnt('rate IS NULL')} rate_null,
      ${cnt('rate=0')} rate_zero, ${cnt('rate<>0')} rate_val, ${cnt('approve_user IS NULL')} au_null, ${cnt('approve_date IS NULL')} ad_null,
      ${cnt('tranId IS NULL')} tran_null, ${cnt('tranId=0')} tran_zero, ${cnt('tranId<>0')} tran_val,
      ${cnt('trandetailId IS NULL')} tdet_null, ${cnt('trandetailId=0')} tdet_zero, ${cnt('trandetailId<>0')} tdet_val,
      ${cnt('reversal_of=0')} rev_zero, ${cnt('reversal_of<>0')} rev_val, ${cnt('LENGTH(source_module)=0')} sm_empty,
      ${cnt('LENGTH(source_module)>0')} sm_val, ${cnt('status=0')} st0, ${cnt('status=1')} st1, ${cnt('status=9')} st9,
      ${cnt('money<>FLOOR(money)')} money_frac, ${cnt('money*100<>FLOOR(money*100)')} money_gt2dp FROM tbl_account_histories`,
    targetSql: `SELECT ${fcnt('bank_info IS NULL')} bank_info_null, ${fcnt("bank_info=''")} bank_info_empty,
      ${fcnt('gout IS NULL')} gout_null, ${fcnt("gout=''")} gout_empty, ${fcnt('cus_id IS NULL')} cus_null,
      ${fcnt("cus_id=''")} cus_empty, ${fcnt("cus_id<>''")} cus_val, ${fcnt('wallet_detail_id IS NULL')} wd_null,
      ${fcnt('wallet_detail_id=0')} wd_zero, ${fcnt('wallet_detail_id<>0')} wd_val, ${fcnt('rate IS NULL')} rate_null,
      ${fcnt('rate=0')} rate_zero, ${fcnt('rate<>0')} rate_val, ${fcnt('approve_user IS NULL')} au_null, ${fcnt('approve_date IS NULL')} ad_null,
      ${fcnt('tran_id IS NULL')} tran_null, ${fcnt('tran_id=0')} tran_zero, ${fcnt('tran_id<>0')} tran_val,
      ${fcnt('trandetail_id IS NULL')} tdet_null, ${fcnt('trandetail_id=0')} tdet_zero, ${fcnt('trandetail_id<>0')} tdet_val,
      ${fcnt('reversal_of=0')} rev_zero, ${fcnt('reversal_of<>0')} rev_val, ${fcnt("source_module=''")} sm_empty,
      ${fcnt("source_module<>''")} sm_val, ${fcnt('status=0')} st0, ${fcnt('status=1')} st1, ${fcnt('status=9')} st9,
      ${fcnt('money<>floor(money)')} money_frac, ${fcnt('money*100<>floor(money*100)')} money_gt2dp FROM tbl_account_histories`,
    values: S83_VALS }),
];

// ───────────────────────────────────────────────────────── 09b §8.4
const G_8_4: Gate[] = [
  crossRefGate({ id: '09b-8.4a', doc: D9B + '.4', title: "dòng sổ 'payment' trỏ phiếu không có (B4, ảnh chụp tài liệu = 1)",
    sourceSql: "SELECT COUNT(*) FROM tbl_account_histories h LEFT JOIN tbl_payment p ON p.id=h.source_id WHERE h.source_module='payment' AND p.id IS NULL",
    targetSql: "SELECT COUNT(*) AS c FROM tbl_account_histories h LEFT JOIN tbl_payment p ON p.id=h.source_id WHERE h.source_module='payment' AND p.id IS NULL" }),
  crossRefGate({ id: '09b-8.4b/09c-8.4a', doc: D9B + '.4 / ' + D9C + '.4', title: "dòng sổ 'bank_tx' trỏ giao dịch không có",
    sourceSql: "SELECT COUNT(*) FROM tbl_account_histories h LEFT JOIN tbl_bank_transaction b ON b.id=h.source_id WHERE h.source_module='bank_tx' AND b.id IS NULL",
    targetSql: "SELECT COUNT(*) AS c FROM tbl_account_histories h LEFT JOIN tbl_bank_transaction b ON b.id=h.source_id WHERE h.source_module='bank_tx' AND b.id IS NULL",
    expected: 0 }),
  skippedGate({ id: '09b-8.4c', doc: D9B + '.4', title: "dòng sổ 'thu_chi_tbs' trỏ phiếu duyệt không có", reason: SKIP_APPR }),
  skippedGate({ id: '09b-8.4d', doc: D9B + '.4', title: 'GL bank_tx/fx_transfer trỏ dòng sổ không có', reason: SKIP_GL }),
  crossRefGate({ id: '09b-8.4e', doc: D9B + '.4', title: 'dòng đảo trỏ gốc không có (trên đích)',
    sourceSql: 'SELECT COUNT(*) FROM tbl_account_histories h WHERE reversal_of>0 AND NOT EXISTS (SELECT 1 FROM tbl_account_histories o WHERE o.id=h.reversal_of)',
    targetSql: 'SELECT COUNT(*) AS c FROM tbl_account_histories h WHERE reversal_of>0 AND NOT EXISTS (SELECT 1 FROM tbl_account_histories o WHERE o.id=h.reversal_of)',
    expected: 0 }),
  skippedGate({ id: '09b-8.4f', doc: D9B + '.4', title: 'vế tiền GL theo ví (postBiz biết ví)', reason: SKIP_GL }),
];

// ───────────────────────────────────────────────────────── §6 setval (09b/09c/09a/04b)
const SEQ_TABLES = ['tbl_accounts', 'tbl_account_histories', 'tbl_fx_fee_rates', 'tbl_fx_transfers', 'tbl_fx_adjustments',
  'tbl_account_changelog', 'tbl_bank_transaction', 'tbl_bank_transaction_detail', 'tbl_bank_chi_match',
  'tbl_bank_reconcile_link', 'tbl_payment_source', 'tbl_payment', 'tbl_payment_orders', 'tbl_payment_log',
  'tbl_return_config', 'tbl_return_fields', 'tbl_return_state'];
const SEQ_RE = /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/;
const G_6: Gate[] = [
  {
    id: '09x-6-setval', doc: '09b/09c/09a §6 · 04b §9 · L13', kind: 'target',
    title: 'bộ đếm khoá chính: last_value = GREATEST(PG MAX, MySQL MAX kể cả dòng loại, MySQL AUTO_INCREMENT−1)+1, is_called = false (17 bảng)',
    async run(ctx): Promise<GateEval> {
      let ok = 0;
      let oldFormulaWouldCollide = 0;
      for (const t of SEQ_TABLES) {
        let floor: string;
        try {
          floor = parseSeqFloor(t, await ctx.source.query(sourceSeqFloorSql(t)));
        } catch {
          continue; // nguồn không trả sàn ⇒ bảng không đạt
        }
        const [s] = await ctx.target.query(`SELECT pg_get_serial_sequence('${t}','id') AS seq`);
        const seq = String(s?.seq ?? '');
        if (!SEQ_RE.test(seq)) continue;
        const [v] = await ctx.target.query(`SELECT last_value::text AS last_value, is_called FROM ${seq}`);
        const [m] = await ctx.target.query(`SELECT MAX(id)::text AS pgmax FROM ${t}`);
        if (!v || !m) continue;
        const pgMax = m.pgmax === null || m.pgmax === undefined ? null : String(m.pgmax);
        const want = nextSeqValue(pgMax, floor);
        if (want !== nextSeqValue(pgMax, '0')) oldFormulaWouldCollide++;
        if (String(v.last_value) === want && v.is_called === false) ok++;
      }
      return {
        status: ok === SEQ_TABLES.length ? 'PASS' : 'FAIL',
        source: { tables: SEQ_TABLES.length },
        target: { ok },
        diff: { notOk: SEQ_TABLES.length - ok },
        info: { tablesWhereOldFormulaDiffers: oldFormulaWouldCollide },
      };
    },
  },
];

// ───────────────────────────────────────────────────────── 09c §8.1
const FX_VALS = ['n', 's_id', 's_amount_out', 's_amount_in', 's_rate', 's_rate_system', 's_fee', 's_fee_percent', 'n_fee_percent_null',
  'n_fee_currency_null', 's_po_id', 's_approval_request_id', 's_created_at', 's_approved_at', 's_reversed_at', 's_reverse_of',
  's_bank_tran_id', 's_agent_rate', 's_agent_amount', 'len_agent_tk', 'n_note_null', 'len_note', 'len_approved_by', 'len_reversed_by'];
const fxSql = (my: boolean) => `SELECT status, from_currency, to_currency, COUNT(*) AS n, SUM(id) AS s_id, SUM(amount_out) AS s_amount_out,
  SUM(amount_in) AS s_amount_in, SUM(rate) AS s_rate, SUM(rate_system) AS s_rate_system, SUM(fee) AS s_fee,
  SUM(COALESCE(fee_percent,0)) AS s_fee_percent, ${my ? cnt('fee_percent IS NULL') : fcnt('fee_percent IS NULL')} AS n_fee_percent_null,
  ${my ? cnt('fee_currency IS NULL') : fcnt('fee_currency IS NULL')} AS n_fee_currency_null, SUM(po_id) AS s_po_id,
  SUM(approval_request_id) AS s_approval_request_id, SUM(created_at) AS s_created_at, SUM(approved_at) AS s_approved_at,
  SUM(reversed_at) AS s_reversed_at, SUM(reverse_of) AS s_reverse_of, SUM(bank_tran_id) AS s_bank_tran_id, SUM(agent_rate) AS s_agent_rate,
  SUM(agent_amount) AS s_agent_amount, SUM(CHAR_LENGTH(agent_tk)) AS len_agent_tk, ${my ? cnt('note IS NULL') : fcnt('note IS NULL')} AS n_note_null,
  SUM(CHAR_LENGTH(note)) AS len_note, SUM(CHAR_LENGTH(approved_by)) AS len_approved_by, SUM(CHAR_LENGTH(reversed_by)) AS len_reversed_by
FROM tbl_fx_transfers GROUP BY 1,2,3`;

const BTX_VALS = ['n', 's_id', 's_amount', 's_time', 's_cdate', 's_mdate', 'n_mdate_null', 'n_cus_null', 'n_cus_empty', 'len_cus',
  'n_bankid_empty', 'len_bankid', 'len_tran_mess', 'len_origin_mess', 'len_bank_name', 'len_bank_account', 'n_mess_diff'];
const BTX_SRC = `SELECT tranType AS tran_type, tk_code, status, confirm, type, COUNT(*) AS n, SUM(id) AS s_id, SUM(tranAmount) AS s_amount,
  SUM(tranTime) AS s_time, SUM(cdate) AS s_cdate, SUM(IFNULL(mdate,0)) AS s_mdate, ${cnt('mdate IS NULL')} AS n_mdate_null,
  ${cnt('cus_id IS NULL')} AS n_cus_null, ${cnt('LENGTH(cus_id)=0')} AS n_cus_empty, SUM(CHAR_LENGTH(cus_id)) AS len_cus,
  ${cnt('LENGTH(bankid)=0')} AS n_bankid_empty, SUM(CHAR_LENGTH(bankid)) AS len_bankid, SUM(CHAR_LENGTH(tranMess)) AS len_tran_mess,
  SUM(CHAR_LENGTH(originMess)) AS len_origin_mess, SUM(CHAR_LENGTH(bank_name)) AS len_bank_name, SUM(CHAR_LENGTH(bank_account)) AS len_bank_account,
  ${cnt('BINARY tranMess<>BINARY originMess')} AS n_mess_diff
FROM tbl_bank_transaction GROUP BY 1,2,3,4,5`;
const BTX_TGT = `SELECT tran_type, tk_code, status, confirm, type, COUNT(*) AS n, SUM(id) AS s_id, SUM(tran_amount) AS s_amount,
  SUM(tran_time) AS s_time, SUM(cdate) AS s_cdate, SUM(COALESCE(mdate,0)) AS s_mdate, ${fcnt('mdate IS NULL')} AS n_mdate_null,
  ${fcnt('cus_id IS NULL')} AS n_cus_null, ${fcnt("cus_id=''")} AS n_cus_empty, SUM(char_length(cus_id)) AS len_cus,
  ${fcnt("bankid=''")} AS n_bankid_empty, SUM(char_length(bankid)) AS len_bankid, SUM(char_length(tran_mess)) AS len_tran_mess,
  SUM(char_length(origin_mess)) AS len_origin_mess, SUM(char_length(bank_name)) AS len_bank_name, SUM(char_length(bank_account)) AS len_bank_account,
  ${fcnt('tran_mess<>origin_mess')} AS n_mess_diff
FROM tbl_bank_transaction GROUP BY 1,2,3,4,5`;

const BDET_VALS = ['n', 's_id', 's_tran_id', 's_money', 's_po_id', 's_cdate', 's_mdate', 'n_mdate_null', 'n_cus_null', 'len_cus',
  'len_note', 'len_author', 'len_pay_info'];
const bdetSql = (my: boolean) => `SELECT type, confirm, COALESCE(wallet_stream,'<NULL>') AS ws, COUNT(*) AS n, SUM(id) AS s_id,
  SUM(${my ? 'tranId' : 'tran_id'}) AS s_tran_id, SUM(money) AS s_money, SUM(po_id) AS s_po_id, SUM(cdate) AS s_cdate,
  SUM(COALESCE(mdate,0)) AS s_mdate, ${my ? cnt('mdate IS NULL') : fcnt('mdate IS NULL')} AS n_mdate_null,
  ${my ? cnt('cus_id IS NULL') : fcnt('cus_id IS NULL')} AS n_cus_null, SUM(CHAR_LENGTH(cus_id)) AS len_cus, SUM(CHAR_LENGTH(note)) AS len_note,
  SUM(CHAR_LENGTH(author)) AS len_author, SUM(CHAR_LENGTH(pay_info)) AS len_pay_info
FROM tbl_bank_transaction_detail GROUP BY 1,2,3`;

const G_9C_8_1: Gate[] = [
  keyedGate({ id: '09c-8.1a', doc: D9C + '.1', title: 'phiếu FX theo (status, từ tệ, sang tệ)',
    sourceSql: fxSql(true), targetSql: fxSql(false), key: ['status', 'from_currency', 'to_currency'], values: FX_VALS, keysAreLabels: true }),
  keyedGate({ id: '09c-8.1b', doc: D9C + '.1', title: 'giao dịch bank theo (tranType, tk, status, confirm, type)',
    sourceSql: BTX_SRC, targetSql: BTX_TGT, key: ['tran_type', 'tk_code', 'status', 'confirm', 'type'], values: BTX_VALS, keysAreLabels: true }),
  keyedGate({ id: '09c-8.1c', doc: D9C + '.1', title: 'chi tiết bank theo (type, confirm, wallet_stream)',
    sourceSql: bdetSql(true), targetSql: bdetSql(false), key: ['type', 'confirm', 'ws'], values: BDET_VALS, keysAreLabels: true }),
  keyedGate({ id: '09c-8.1d', doc: D9C + '.1', title: 'khớp chi bank theo (method, đang hiệu lực)',
    sourceSql: 'SELECT method, (unmatched_at IS NULL) AS active, COUNT(*) AS n, SUM(id) AS s_id, SUM(bank_tx_id) AS s_bank_tx_id, SUM(request_id) AS s_request_id, SUM(matched_at) AS s_matched_at, SUM(CHAR_LENGTH(note)) AS len_note FROM tbl_bank_chi_match GROUP BY 1,2',
    targetSql: 'SELECT method::text AS method, (unmatched_at IS NULL) AS active, COUNT(*) AS n, SUM(id) AS s_id, SUM(bank_tx_id) AS s_bank_tx_id, SUM(request_id) AS s_request_id, SUM(matched_at) AS s_matched_at, SUM(char_length(note)) AS len_note FROM tbl_bank_chi_match GROUP BY 1,2',
    key: ['method', 'active'], values: ['n', 's_id', 's_bank_tx_id', 's_request_id', 's_matched_at', 'len_note'], keysAreLabels: true }),
  keyedGate({ id: '09c-8.1e', doc: D9C + '.1', title: 'link đối soát theo (doc_module, match_type, cuser)',
    sourceSql: 'SELECT doc_module, match_type, cuser, COUNT(*) AS n, SUM(id) AS s_id, SUM(bank_tran_id) AS s_bank_tran_id, SUM(doc_id) AS s_doc_id, SUM(cdate) AS s_cdate, SUM(CHAR_LENGTH(note)) AS len_note FROM tbl_bank_reconcile_link GROUP BY 1,2,3',
    targetSql: 'SELECT doc_module, match_type, cuser, COUNT(*) AS n, SUM(id) AS s_id, SUM(bank_tran_id) AS s_bank_tran_id, SUM(doc_id) AS s_doc_id, SUM(cdate) AS s_cdate, SUM(char_length(note)) AS len_note FROM tbl_bank_reconcile_link GROUP BY 1,2,3',
    key: ['doc_module', 'match_type', 'cuser'], values: ['n', 's_id', 's_bank_tran_id', 's_doc_id', 's_cdate', 'len_note'], keysAreLabels: true }),
  keyedGate({ id: '09c-8.1f', doc: D9C + '.1', title: 'nhật ký sửa ví theo action (changes chỉ so ĐỘ DÀI)',
    sourceSql: 'SELECT action, COUNT(*) AS n, SUM(id) AS s_id, SUM(account_id) AS s_account_id, SUM(user_id) AS s_user_id, SUM(created_at) AS s_created_at, SUM(CHAR_LENGTH(changes)) AS len_changes, SUM(CHAR_LENGTH(user_name)) AS len_user_name FROM tbl_account_changelog GROUP BY 1',
    targetSql: 'SELECT action, COUNT(*) AS n, SUM(id) AS s_id, SUM(account_id) AS s_account_id, SUM(user_id) AS s_user_id, SUM(created_at) AS s_created_at, SUM(char_length(changes)) AS len_changes, SUM(char_length(user_name)) AS len_user_name FROM tbl_account_changelog GROUP BY 1',
    key: ['action'], values: ['n', 's_id', 's_account_id', 's_user_id', 's_created_at', 'len_changes', 'len_user_name'], keysAreLabels: true }),
  keyedGate({ id: '09c-8.1g', doc: D9C + '.1', title: 'biểu phí FX từng dòng',
    sourceSql: 'SELECT id, from_cur, to_cur, fee_percent, (updated_by IS NULL) AS ub_null, updated_at FROM tbl_fx_fee_rates',
    targetSql: 'SELECT id, from_cur, to_cur, fee_percent, (updated_by IS NULL) AS ub_null, updated_at FROM tbl_fx_fee_rates',
    key: ['id'], values: ['from_cur', 'to_cur', 'fee_percent', 'ub_null', 'updated_at'] }),
];

// ───────────────────────────────────────────────────────── 09c §8.2
const HO = `CASE WHEN h.source_module='bank_tx' THEN 'bank_tx'
  WHEN h.source_module IN ('fx_transfer','fx_fee','fx_quydoi','fx_transfer_dao','fx_transfer_lai','fx_dieuchinh','transfer')
    OR h.source_module LIKE 'fx\\_huy%' OR h.source_module LIKE 'daoxoa\\_fx\\_%' THEN 'fx' ELSE 'khac' END`;
const A_SQL = `/*8.2a*/ SELECT h.tk_code, ${HO} AS ho, COUNT(*) AS n, SUM(h.money) AS s FROM tbl_account_histories h WHERE h.status=1 GROUP BY 1,2`;
const B_SRC = "/*8.2b*/ SELECT b.tk_code AS tk, COUNT(*) AS n, SUM(b.tranAmount) AS s FROM tbl_bank_transaction b WHERE EXISTS (SELECT 1 FROM tbl_account_histories h WHERE h.source_module='bank_tx' AND h.source_id=b.id) GROUP BY 1";
const B_TGT = "/*8.2b*/ SELECT b.tk_code AS tk, COUNT(*) AS n, SUM(b.tran_amount) AS s FROM tbl_bank_transaction b WHERE EXISTS (SELECT 1 FROM tbl_account_histories h WHERE h.source_module='bank_tx' AND h.source_id=b.id) GROUP BY 1";
const C_SQL = `/*8.2c*/ SELECT tk, SUM(m) AS s FROM (
  SELECT from_tk AS tk, -amount_out AS m FROM tbl_fx_transfers WHERE status='approved'
  UNION ALL SELECT to_tk, amount_in FROM tbl_fx_transfers WHERE status='approved'
  UNION ALL SELECT CASE WHEN UPPER(TRIM(COALESCE(fee_currency,'')))<>'' AND UPPER(TRIM(fee_currency))=UPPER(TRIM(to_currency))
                         AND UPPER(TRIM(from_currency))<>UPPER(TRIM(to_currency)) THEN to_tk ELSE from_tk END, -fee
            FROM tbl_fx_transfers WHERE status='approved' AND fee>0
  UNION ALL SELECT to_tk, -amount_in FROM tbl_fx_transfers WHERE status='approved' AND agent_tk<>'' AND agent_rate>0
  UNION ALL SELECT agent_tk, agent_amount FROM tbl_fx_transfers WHERE status='approved' AND agent_tk<>'' AND agent_rate>0
) x GROUP BY tk`;

/** Luật 09c §8.2 TRONG một phía: (a).bank_tx = (b) và (a).fx = (c), từng ví. */
async function rules82(db: { query(s: string): Promise<Row[]> }, bSql: string) {
  const a = await db.query(A_SQL);
  const pick = (ho: string) => a.filter((r) => r.ho === ho).map((r) => ({ tk: r.tk_code, n: r.n, s: r.s }));
  const bank = compareKeyed(pick('bank_tx'), await db.query(bSql), { key: ['tk'], values: ['n', 's'], keysAreLabels: true });
  const fx = compareKeyed(pick('fx').map((r) => ({ tk: r.tk, s: r.s })), await db.query(C_SQL), { key: ['tk'], values: ['s'], keysAreLabels: true });
  const bad = (e: GateEval) => Number(e.diff?.rowsMissingInTarget ?? 0) + Number(e.diff?.rowsExtraInTarget ?? 0) + Number(e.diff?.keysMismatched ?? 0);
  return { bank, fx, bankBad: bad(bank), fxBad: bad(fx) };
}

const G_9C_8_2: Gate[] = [
  keyedGate({ id: '09c-8.2a', doc: D9C + '.2', title: '⭐ sổ quỹ status=1 theo ví × họ (bank_tx / fx / khác)',
    sourceSql: A_SQL, targetSql: A_SQL, key: ['tk_code', 'ho'], values: ['n', 's'], keysAreLabels: true }),
  keyedGate({ id: '09c-8.2b', doc: D9C + '.2', title: '(b) dựng lại họ bank_tx từ giao dịch ngân hàng, theo ví',
    sourceSql: B_SRC, targetSql: B_TGT, key: ['tk'], values: ['n', 's'], keysAreLabels: true }),
  keyedGate({ id: '09c-8.2c', doc: D9C + '.2', title: '(c) dựng lại họ fx từ phiếu FX approved, theo ví',
    sourceSql: C_SQL, targetSql: C_SQL, key: ['tk'], values: ['s'], keysAreLabels: true }),
  {
    id: '09c-8.2-rules', doc: D9C + '.2 (luật)', kind: 'target',
    title: 'luật (a).bank_tx = (b), (a).fx = (c) TỪNG ví — ở nguồn và ở đích',
    async run(ctx): Promise<GateEval> {
      const s = await rules82(ctx.source, B_SRC);
      const t = await rules82(ctx.target, B_TGT);
      const pass = s.bankBad + s.fxBad + t.bankBad + t.fxBad === 0;
      const keys = [...(s.bank.keys ?? []).map((k) => 'src bank_tx ' + k), ...(s.fx.keys ?? []).map((k) => 'src fx ' + k),
        ...(t.bank.keys ?? []).map((k) => 'tgt bank_tx ' + k), ...(t.fx.keys ?? []).map((k) => 'tgt fx ' + k)];
      return {
        status: pass ? 'PASS' : 'FAIL',
        source: { walletsBankTx: Number(s.bank.source?.rows ?? 0), walletsFx: Number(s.fx.source?.rows ?? 0) },
        target: { walletsBankTx: Number(t.bank.source?.rows ?? 0), walletsFx: Number(t.fx.source?.rows ?? 0) },
        diff: { bankTxMismatchSource: s.bankBad, fxMismatchSource: s.fxBad, bankTxMismatchTarget: t.bankBad, fxMismatchTarget: t.fxBad },
        ...(keys.length ? { keys: keys.slice(0, 20) } : {}),
      };
    },
  },
];

// ───────────────────────────────────────────────────────── 09c §8.3
const S9C_VALS = ['fx_fp_null', 'fx_fp_val', 'fx_fc_null', 'fx_note_empty', 'fx_note_val', 'fx_btid_zero', 'fx_btid_val',
  'fx_agtk_empty', 'fx_agrate_zero', 'fx_agamt_zero', 'fx_rs_zero', 'fx_po_zero', 'fx_rev_zero', 'fx_apby_empty', 'fx_apat_zero',
  'chg_uid_zero', 'btx_bankid_empty', 'btx_cus_null', 'btx_cus_empty', 'btx_mdate_null', 'btx_tk_empty', 'btx_mess_diff',
  'bdet_cus_null', 'bdet_mdate_null', 'bdet_ws_null', 'bdet_ws_ca_nhan', 'bdet_ws_cty', 'bdet_po_zero', 'match_unm_null',
  'link_dm_empty', 'link_doc_zero'];
const s9c = (my: boolean) => {
  const c = my ? cnt : fcnt;
  const e = (col: string) => (my ? `LENGTH(${col})=0` : `${col}=''`);
  const ne = (col: string) => (my ? `LENGTH(${col})>0` : `${col}<>''`);
  return `SELECT
  (SELECT ${c('fee_percent IS NULL')} FROM tbl_fx_transfers) AS fx_fp_null,
  (SELECT ${c('fee_percent IS NOT NULL')} FROM tbl_fx_transfers) AS fx_fp_val,
  (SELECT ${c('fee_currency IS NULL')} FROM tbl_fx_transfers) AS fx_fc_null,
  (SELECT ${c(e('note'))} FROM tbl_fx_transfers) AS fx_note_empty,
  (SELECT ${c(ne('note'))} FROM tbl_fx_transfers) AS fx_note_val,
  (SELECT ${c('bank_tran_id=0')} FROM tbl_fx_transfers) AS fx_btid_zero,
  (SELECT ${c('bank_tran_id<>0')} FROM tbl_fx_transfers) AS fx_btid_val,
  (SELECT ${c(e('agent_tk'))} FROM tbl_fx_transfers) AS fx_agtk_empty,
  (SELECT ${c('agent_rate=0')} FROM tbl_fx_transfers) AS fx_agrate_zero,
  (SELECT ${c('agent_amount=0')} FROM tbl_fx_transfers) AS fx_agamt_zero,
  (SELECT ${c('rate_system=0')} FROM tbl_fx_transfers) AS fx_rs_zero,
  (SELECT ${c('po_id=0')} FROM tbl_fx_transfers) AS fx_po_zero,
  (SELECT ${c('reverse_of=0')} FROM tbl_fx_transfers) AS fx_rev_zero,
  (SELECT ${c(e('approved_by'))} FROM tbl_fx_transfers) AS fx_apby_empty,
  (SELECT ${c('approved_at=0')} FROM tbl_fx_transfers) AS fx_apat_zero,
  (SELECT ${c('user_id=0')} FROM tbl_account_changelog) AS chg_uid_zero,
  (SELECT ${c(e('bankid'))} FROM tbl_bank_transaction) AS btx_bankid_empty,
  (SELECT ${c('cus_id IS NULL')} FROM tbl_bank_transaction) AS btx_cus_null,
  (SELECT ${c(e('cus_id'))} FROM tbl_bank_transaction) AS btx_cus_empty,
  (SELECT ${c('mdate IS NULL')} FROM tbl_bank_transaction) AS btx_mdate_null,
  (SELECT ${c(e('tk_code'))} FROM tbl_bank_transaction) AS btx_tk_empty,
  (SELECT ${c(my ? 'BINARY tranMess<>BINARY originMess' : 'tran_mess<>origin_mess')} FROM tbl_bank_transaction) AS btx_mess_diff,
  (SELECT ${c('cus_id IS NULL')} FROM tbl_bank_transaction_detail) AS bdet_cus_null,
  (SELECT ${c('mdate IS NULL')} FROM tbl_bank_transaction_detail) AS bdet_mdate_null,
  (SELECT ${c('wallet_stream IS NULL')} FROM tbl_bank_transaction_detail) AS bdet_ws_null,
  (SELECT ${c(my ? "BINARY wallet_stream='ca_nhan'" : "wallet_stream='ca_nhan'")} FROM tbl_bank_transaction_detail) AS bdet_ws_ca_nhan,
  (SELECT ${c(my ? "BINARY wallet_stream='cty'" : "wallet_stream='cty'")} FROM tbl_bank_transaction_detail) AS bdet_ws_cty,
  (SELECT ${c('po_id=0')} FROM tbl_bank_transaction_detail) AS bdet_po_zero,
  (SELECT ${c('unmatched_at IS NULL')} FROM tbl_bank_chi_match) AS match_unm_null,
  (SELECT ${c(e('doc_module'))} FROM tbl_bank_reconcile_link) AS link_dm_empty,
  (SELECT ${c('doc_id=0')} FROM tbl_bank_reconcile_link) AS link_doc_zero`;
};
const G_9C_8_3: Gate[] = [
  scalarGate({ id: '09c-8.3', doc: D9C + '.3', title: "sentinel FX / bank / khớp chi / link (NULL / '' / 0)",
    sourceSql: s9c(true), targetSql: s9c(false), values: S9C_VALS }),
];

// ───────────────────────────────────────────────────────── 09c §8.4
const FXFAM_LIST = "(h.source_module IN ('fx_transfer','fx_fee','fx_quydoi','fx_transfer_dao','fx_transfer_lai','fx_dieuchinh') OR h.source_module LIKE 'fx\\_huy%')";
const G_9C_8_4: Gate[] = [
  crossRefGate({ id: '09c-8.4b', doc: D9C + '.4', title: 'dòng sổ họ FX trỏ phiếu FX không có',
    sourceSql: `SELECT COUNT(*) FROM tbl_account_histories h LEFT JOIN tbl_fx_transfers f ON f.id=h.source_id WHERE ${FXFAM_LIST} AND f.id IS NULL`,
    targetSql: `SELECT COUNT(*) AS c FROM tbl_account_histories h LEFT JOIN tbl_fx_transfers f ON f.id=h.source_id WHERE ${FXFAM_LIST} AND f.id IS NULL`,
    expected: 0 }),
  crossRefGate({ id: '09c-8.4c', doc: D9C + '.4', title: 'dòng sổ tran_id>0 trỏ giao dịch không có',
    sourceSql: 'SELECT COUNT(*) FROM tbl_account_histories h LEFT JOIN tbl_bank_transaction b ON b.id=h.tranId WHERE h.tranId>0 AND b.id IS NULL',
    targetSql: 'SELECT COUNT(*) AS c FROM tbl_account_histories h LEFT JOIN tbl_bank_transaction b ON b.id=h.tran_id WHERE h.tran_id>0 AND b.id IS NULL',
    expected: 0 }),
  skippedGate({ id: '09c-8.4d', doc: D9C + '.4', title: 'tbl_wallet_detail.tran_id trỏ giao dịch không có', reason: SKIP_WD }),
  crossRefGate({ id: '09c-8.4e', doc: D9C + '.4', title: 'chi tiết bank mồ côi (trên đích)',
    sourceSql: 'SELECT COUNT(*) FROM tbl_bank_transaction_detail d LEFT JOIN tbl_bank_transaction b ON b.id=d.tranId WHERE b.id IS NULL',
    targetSql: 'SELECT COUNT(*) AS c FROM tbl_bank_transaction_detail d LEFT JOIN tbl_bank_transaction b ON b.id=d.tran_id WHERE b.id IS NULL',
    expected: 0 }),
  crossRefGate({ id: '09c-8.4f', doc: D9C + '.4', title: 'link đối soát trỏ giao dịch không có (trên đích)',
    sourceSql: 'SELECT COUNT(*) FROM tbl_bank_reconcile_link l LEFT JOIN tbl_bank_transaction b ON b.id=l.bank_tran_id WHERE b.id IS NULL',
    targetSql: 'SELECT COUNT(*) AS c FROM tbl_bank_reconcile_link l LEFT JOIN tbl_bank_transaction b ON b.id=l.bank_tran_id WHERE b.id IS NULL',
    expected: 0 }),
  skippedGate({ id: '09c-8.4g', doc: D9C + '.4', title: 'FX trỏ phiếu duyệt không có (C2, tài liệu = 4)', reason: SKIP_APPR }),
  skippedGate({ id: '09c-8.4h', doc: D9C + '.4', title: 'GL bank_tx/fx_transfer/fx_fee trỏ dòng sổ không có', reason: SKIP_GL }),
  crossRefGate({ id: '09c-8.4i', doc: D9C + '.4', title: 'neo FX nhất quán giữa phiếu và dòng sổ',
    sourceSql: "SELECT COUNT(*) FROM tbl_account_histories h JOIN tbl_fx_transfers f ON f.id=h.source_id WHERE h.source_module='fx_transfer' AND h.tranId>0 AND h.tranId<>f.bank_tran_id",
    targetSql: "SELECT COUNT(*) AS c FROM tbl_account_histories h JOIN tbl_fx_transfers f ON f.id=h.source_id WHERE h.source_module='fx_transfer' AND h.tran_id>0 AND h.tran_id<>f.bank_tran_id",
    expected: 0 }),
  skippedGate({ id: '09c-8.4j', doc: D9C + '.4', title: 'GL bank theo ví (vế Nợ = gl_account ví)', reason: SKIP_GL }),
];

// ───────────────────────────────────────────────────────── 09a §7.1
const NOT_ZZ = "NOT (COALESCE(saler,'') LIKE 'zz%' OR COALESCE(code_order,'') LIKE 'ZZ%')";
const PAY_VALS = ['n', 's_id', 's_price_cyn', 's_price_payment', 'n_price_payment_null', 's_rate_buy', 's_cdate', 's_mdate',
  'n_mdate_null', 's_pdate', 's_po_id', 's_order_id', 'len_code_order', 'len_ncc_bank_account', 'len_note_payment', 'len_ncc_invoice_images'];
const PAY_SRC = `SELECT confirm, IFNULL(payment,'<null>') AS payment, pay_type, account_code, currency,
  COUNT(*) AS n, SUM(id) AS s_id, SUM(price_cyn) AS s_price_cyn, SUM(IFNULL(price_payment,0)) AS s_price_payment,
  ${cnt('price_payment IS NULL')} AS n_price_payment_null, SUM(rate_buy) AS s_rate_buy, SUM(cdate) AS s_cdate,
  SUM(IFNULL(mdate,0)) AS s_mdate, ${cnt('mdate IS NULL')} AS n_mdate_null, SUM(IFNULL(pdate,0)) AS s_pdate,
  SUM(po_id) AS s_po_id, SUM(order_id) AS s_order_id, SUM(CHAR_LENGTH(code_order)) AS len_code_order,
  SUM(LENGTH(ncc_bank_account)) AS len_ncc_bank_account, SUM(IFNULL(CHAR_LENGTH(note_payment),-1)) AS len_note_payment,
  SUM(IFNULL(CHAR_LENGTH(ncc_invoice_images),-1)) AS len_ncc_invoice_images
FROM tbl_payment WHERE ${NOT_ZZ} GROUP BY 1,2,3,4,5`;
const PAY_TGT = `SELECT confirm, COALESCE(payment,'<null>') AS payment, pay_type, account_code, currency::text AS currency,
  COUNT(*) AS n, SUM(id) AS s_id, SUM(price_cyn) AS s_price_cyn, SUM(COALESCE(price_payment,0)) AS s_price_payment,
  ${fcnt('price_payment IS NULL')} AS n_price_payment_null, SUM(rate_buy) AS s_rate_buy, SUM(cdate) AS s_cdate,
  SUM(COALESCE(mdate,0)) AS s_mdate, ${fcnt('mdate IS NULL')} AS n_mdate_null, SUM(COALESCE(pdate,0)) AS s_pdate,
  SUM(po_id) AS s_po_id, SUM(order_id) AS s_order_id, SUM(char_length(code_order)) AS len_code_order,
  SUM(octet_length(ncc_bank_account)) AS len_ncc_bank_account, SUM(COALESCE(char_length(note_payment),-1)) AS len_note_payment,
  SUM(COALESCE(char_length(ncc_invoice_images),-1)) AS len_ncc_invoice_images
FROM tbl_payment GROUP BY 1,2,3,4,5`;
const ORD_SRC = `SELECT payment_id, COUNT(*) AS n, SUM(rmb) AS s_rmb, SUM(IFNULL(prev_fund,0)) AS s_prev_fund, ${cnt('prev_fund IS NULL')} AS n_prev_fund_null,
  SUM(IFNULL(prev_rate,0)) AS s_prev_rate, SUM(order_id) AS s_order_id, SUM(cdate) AS s_cdate
FROM tbl_payment_orders x WHERE EXISTS (SELECT 1 FROM tbl_payment p WHERE p.id=x.payment_id AND ${NOT_ZZ.replace(/saler|code_order/g, (m) => 'p.' + m)}) GROUP BY payment_id`;
const ORD_TGT = `SELECT payment_id, COUNT(*) AS n, SUM(rmb) AS s_rmb, SUM(COALESCE(prev_fund,0)) AS s_prev_fund, ${fcnt('prev_fund IS NULL')} AS n_prev_fund_null,
  SUM(COALESCE(prev_rate,0)) AS s_prev_rate, SUM(order_id) AS s_order_id, SUM(cdate) AS s_cdate
FROM tbl_payment_orders GROUP BY payment_id`;
const logSql = (my: boolean) => `SELECT ${my ? 'action' : 'action::text AS action'}, COUNT(*) AS n, SUM(payment_id) AS s_payment_id, SUM(cdate) AS s_cdate,
  ${my ? cnt('old_data IS NULL') : fcnt('old_data IS NULL')} AS n_old_null, ${my ? cnt('LENGTH(old_data)=0') : fcnt("old_data=''")} AS n_old_empty,
  ${my ? cnt('new_data IS NULL') : fcnt('new_data IS NULL')} AS n_new_null, ${my ? cnt('LENGTH(new_data)=0') : fcnt("new_data=''")} AS n_new_empty,
  SUM(COALESCE(CHAR_LENGTH(old_data),0)) AS len_old, SUM(COALESCE(CHAR_LENGTH(new_data),0)) AS len_new,
  SUM(COALESCE(CHAR_LENGTH(note),-1)) AS len_note, SUM(COALESCE(CHAR_LENGTH(created_by),-1)) AS len_created_by
FROM tbl_payment_log GROUP BY 1`;
const G_9A_7_1: Gate[] = [
  keyedGate({ id: '09a-7.1a', doc: D9A + '.1', title: 'phiếu NCC theo (confirm, payment, pay_type, ví, tệ)',
    sourceSql: PAY_SRC, targetSql: PAY_TGT, key: ['confirm', 'payment', 'pay_type', 'account_code', 'currency'], values: PAY_VALS, keysAreLabels: true }),
  keyedGate({ id: '09a-7.1b', doc: D9A + '.1', title: 'liên kết đơn theo payment_id (nguồn trừ A2 mồ côi + rác ZZ)',
    sourceSql: ORD_SRC, targetSql: ORD_TGT, key: ['payment_id'],
    values: ['n', 's_rmb', 's_prev_fund', 'n_prev_fund_null', 's_prev_rate', 's_order_id', 's_cdate'] }),
  keyedGate({ id: '09a-7.1c', doc: D9A + '.1', title: 'nhật ký phiếu theo action (dữ liệu cũ/mới chỉ so ĐỘ DÀI)',
    sourceSql: logSql(true), targetSql: logSql(false), key: ['action'],
    values: ['n', 's_payment_id', 's_cdate', 'n_old_null', 'n_old_empty', 'n_new_null', 'n_new_empty', 'len_old', 'len_new', 'len_note', 'len_created_by'],
    keysAreLabels: true }),
];

// ───────────────────────────────────────────────────────── 09a §7.2
const G_9A_7_2: Gate[] = [
  crossRefGate({ id: '09a-7.2a', doc: D9A + '.2', title: "dòng sổ 'payment' trỏ phiếu không có/chưa duyệt (A6, ảnh chụp tài liệu = 1)",
    sourceSql: "SELECT COUNT(*) FROM tbl_account_histories h LEFT JOIN tbl_payment p ON p.id=h.source_id WHERE h.source_module='payment' AND (p.id IS NULL OR p.confirm<>'yes')",
    targetSql: "SELECT COUNT(*) AS c FROM tbl_account_histories h LEFT JOIN tbl_payment p ON p.id=h.source_id WHERE h.source_module='payment' AND (p.id IS NULL OR p.confirm<>'yes')" }),
  skippedGate({ id: '09a-7.2b', doc: D9A + '.2', title: "GL 'payment' trỏ phiếu đã duyệt, số tiền = công thức prod", reason: SKIP_GL }),
  crossRefGate({ id: '09a-7.2c', doc: D9A + '.2', title: 'dòng sổ = công thức postPaymentEntry (CNY: price_cyn; VND: price_payment|price×rate)',
    sourceSql: "SELECT COUNT(*) FROM tbl_account_histories h JOIN tbl_payment p ON p.id=h.source_id JOIN tbl_accounts a ON a.code=h.tk_code WHERE h.source_module='payment' AND h.status=1 AND ABS(h.money + CASE WHEN a.currency='CNY' THEN p.price_cyn ELSE COALESCE(NULLIF(p.price_payment,0), p.price_cyn*p.rate_buy) END) > 0.5",
    targetSql: "SELECT COUNT(*) AS c FROM tbl_account_histories h JOIN tbl_payment p ON p.id=h.source_id JOIN tbl_accounts a ON a.code=h.tk_code WHERE h.source_module='payment' AND h.status=1 AND ABS(h.money + CASE WHEN a.currency='CNY' THEN p.price_cyn ELSE COALESCE(NULLIF(p.price_payment,0), p.price_cyn*p.rate_buy) END) > 0.5",
    expected: 0 }),
  crossRefGate({ id: '09a-7.2d', doc: D9A + '.2', title: 'phiếu đã duyệt có ví mà thiếu dòng quỹ',
    sourceSql: "SELECT COUNT(*) FROM tbl_payment p WHERE p.confirm='yes' AND p.account_code<>'' AND NOT EXISTS (SELECT 1 FROM tbl_account_histories h WHERE h.source_module='payment' AND h.source_id=p.id)",
    targetSql: "SELECT COUNT(*) AS c FROM tbl_payment p WHERE p.confirm='yes' AND p.account_code<>'' AND NOT EXISTS (SELECT 1 FROM tbl_account_histories h WHERE h.source_module='payment' AND h.source_id=p.id)",
    expected: 0 }),
  crossRefGate({ id: '09a-7.2e', doc: D9A + '.2', title: "trạng thái trả về trỏ phiếu có thật; returned ⇒ confirm='no'",
    sourceSql: "SELECT COUNT(*) FROM tbl_return_state rs LEFT JOIN tbl_payment p ON p.id=rs.object_id WHERE rs.object_type='payment' AND (p.id IS NULL OR (rs.state='returned' AND p.confirm<>'no'))",
    targetSql: "SELECT COUNT(*) AS c FROM tbl_return_state rs LEFT JOIN tbl_payment p ON p.id=rs.object_id WHERE rs.object_type='payment' AND (p.id IS NULL OR (rs.state::text='returned' AND p.confirm<>'no'))",
    expected: 0 }),
  crossRefGate({ id: '09a-7.2f', doc: D9A + '.2', title: 'liên kết đơn mồ côi (A2 đã loại ⇒ 0 trên đích)',
    sourceSql: null,
    targetSql: 'SELECT COUNT(*) AS c FROM tbl_payment_orders x LEFT JOIN tbl_payment p ON p.id=x.payment_id WHERE p.id IS NULL',
    expected: 0 }),
  crossRefGate({ id: '09a-7.2g', doc: D9A + '.2', title: "phiếu gộp 'supplier' không có liên kết đơn nào",
    sourceSql: "SELECT COUNT(*) FROM tbl_payment p WHERE p.pay_type='supplier' AND NOT EXISTS (SELECT 1 FROM tbl_payment_orders x WHERE x.payment_id=p.id)",
    targetSql: "SELECT COUNT(*) AS c FROM tbl_payment p WHERE p.pay_type='supplier' AND NOT EXISTS (SELECT 1 FROM tbl_payment_orders x WHERE x.payment_id=p.id)",
    expected: 0 }),
];

// ───────────────────────────────────────────────────────── 09a §7.3
const S9A_VALS = ['pp_null', 'mdate_null', 'payment_null', 'pdate_null', 'np_null', 'np_empty', 'acc_empty', 'order_zero', 'po_zero',
  'pt_empty', 'nbn_null', 'nbn_empty', 'bill_null', 'inv_null', 'kt_null', 'kt_empty', 'saler_trim'];
const s9a = (my: boolean) => {
  const c = my ? cnt : fcnt;
  const e = (col: string) => (my ? `LENGTH(${col})=0` : `${col}=''`);
  return `SELECT ${c('price_payment IS NULL')} pp_null, ${c('mdate IS NULL')} mdate_null, ${c('payment IS NULL')} payment_null,
  ${c('pdate IS NULL')} pdate_null, ${c('note_payment IS NULL')} np_null, ${c(e('note_payment'))} np_empty, ${c(e('account_code'))} acc_empty,
  ${c('order_id=0')} order_zero, ${c('po_id=0')} po_zero, ${c(e('pay_type'))} pt_empty, ${c('ncc_bank_note IS NULL')} nbn_null,
  ${c(e('ncc_bank_note'))} nbn_empty, ${c('bill_images IS NULL')} bill_null, ${c('ncc_invoice_images IS NULL')} inv_null,
  ${c('kt_note IS NULL')} kt_null, ${c(e('kt_note'))} kt_empty,
  ${c(my ? 'LENGTH(saler)<>LENGTH(TRIM(saler))' : 'saler<>btrim(saler)')} saler_trim
  FROM tbl_payment${my ? ' WHERE ' + NOT_ZZ : ''}`;
};
const G_9A_7_3: Gate[] = [
  scalarGate({ id: '09a-7.3', doc: D9A + '.3', title: "sentinel phiếu NCC (NULL / '' / 0) + saler có khoảng trắng (bổ sung 25/09)",
    sourceSql: s9a(true), targetSql: s9a(false), values: S9A_VALS }),
];

// ───────────────────────────────────────────────────────── 04b §10.1–10.2
const RS_EXCL = "NOT (rs.object_type='approval_request' AND NOT EXISTS (SELECT 1 FROM tbl_approval_requests r WHERE r.id=rs.object_id))";
const G_04B: Gate[] = [
  keyedGate({ id: '04b-10.1a', doc: D4B + '.1', title: 'trạng thái trả về theo (object_type, checkpoint, state) — nguồn trừ A1',
    sourceSql: `SELECT rs.object_type, rs.checkpoint_type, rs.checkpoint_ref, rs.state, COUNT(*) AS n, SUM(rs.round) AS s_round,
      SUM(rs.object_id) AS s_object_id, SUM(rs.returned_at) AS s_returned_at, SUM(IFNULL(NULLIF(rs.resubmitted_at,0),0)) AS s_resubmitted_at,
      SUM(CHAR_LENGTH(rs.reason)) AS len_reason FROM tbl_return_state rs WHERE ${RS_EXCL} GROUP BY 1,2,3,4`,
    targetSql: `SELECT object_type, checkpoint_type::text AS checkpoint_type, checkpoint_ref, state::text AS state, COUNT(*) AS n, SUM(round) AS s_round,
      SUM(object_id) AS s_object_id, SUM(returned_at) AS s_returned_at, SUM(COALESCE(NULLIF(resubmitted_at,0),0)) AS s_resubmitted_at,
      SUM(char_length(reason)) AS len_reason FROM tbl_return_state GROUP BY 1,2,3,4`,
    key: ['object_type', 'checkpoint_type', 'checkpoint_ref', 'state'],
    values: ['n', 's_round', 's_object_id', 's_returned_at', 's_resubmitted_at', 'len_reason'] }),
  keyedGate({ id: '04b-10.1b', doc: D4B + '.1', title: 'cấu hình trả về + số trường mở, từng cấu hình — nguồn trừ A4/A5',
    sourceSql: `SELECT c.id, c.checkpoint_type, c.checkpoint_ref, c.edit_mode, (c.require_reason<>0) AS require_reason, COUNT(f.id) AS n_fields
      FROM tbl_return_config c LEFT JOIN tbl_return_fields f ON f.config_id=c.id
      WHERE NOT (c.checkpoint_type='approval' AND NOT EXISTS (SELECT 1 FROM tbl_approval_steps s WHERE CAST(s.id AS CHAR)=c.checkpoint_ref))
      GROUP BY c.id, c.checkpoint_type, c.checkpoint_ref, c.edit_mode, c.require_reason`,
    targetSql: `SELECT c.id, c.checkpoint_type::text AS checkpoint_type, c.checkpoint_ref, c.edit_mode::text AS edit_mode, c.require_reason, COUNT(f.id) AS n_fields
      FROM tbl_return_config c LEFT JOIN tbl_return_fields f ON f.config_id=c.id
      GROUP BY c.id, c.checkpoint_type, c.checkpoint_ref, c.edit_mode, c.require_reason`,
    key: ['id'], values: ['checkpoint_type', 'checkpoint_ref', 'edit_mode', 'require_reason', 'n_fields'] }),
  keyedGate({ id: '04b-10.1c', doc: D4B + '.1 (bổ sung)', title: 'JSON trạng thái trả về: số dòng có data_before/data_after (A3 đặt NULL)',
    sourceSql: `SELECT rs.state, COUNT(*) AS n, ${cnt("rs.data_before IS NOT NULL AND LENGTH(rs.data_before)>0")} AS n_before,
      ${cnt("rs.data_after IS NOT NULL AND LENGTH(rs.data_after)>0 AND rs.state<>'returned'")} AS n_after,
      ${cnt('JSON_LENGTH(rs.fields_opened)')} AS s_fields_opened
      FROM tbl_return_state rs WHERE ${RS_EXCL} GROUP BY 1`,
    targetSql: `SELECT state::text AS state, COUNT(*) AS n, ${fcnt('data_before IS NOT NULL')} AS n_before,
      ${fcnt('data_after IS NOT NULL')} AS n_after, COALESCE(SUM(jsonb_array_length(fields_opened)),0) AS s_fields_opened
      FROM tbl_return_state GROUP BY 1`,
    key: ['state'], values: ['n', 'n_before', 'n_after', 's_fields_opened'], keysAreLabels: true }),
  skippedGate({ id: '04b-10.2a', doc: D4B + '.2', title: 'mọi cấu hình approval trỏ bước có thật (trên đích)', reason: SKIP_APPR }),
  skippedGate({ id: '04b-10.2b', doc: D4B + '.2', title: 'returned approval_request trỏ phiếu có thật + đúng bước hiện hành', reason: SKIP_APPR }),
];

export const TARGET_GATES: readonly Gate[] = [
  ...G_8_1, ...G_8_2, ...G_8_3, ...G_8_4, ...G_6,
  ...G_9C_8_1, ...G_9C_8_2, ...G_9C_8_3, ...G_9C_8_4,
  ...G_9A_7_1, ...G_9A_7_2, ...G_9A_7_3,
  ...G_04B,
];
