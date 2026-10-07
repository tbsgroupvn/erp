/**
 * L13 Task 1 — máy chép ngược `runCopyback` — KHÔNG đụng CSDL nào: nguồn PG và
 * đích MySQL là đồ giả trong bộ nhớ. Chứng minh:
 *  (1) chốt đích PG (target-guard) + chốt tĩnh MySQL chạy TRƯỚC khi mở kết nối;
 *  (2) chốt LÚC CHẠY (@@hostname == container) chạy TRƯỚC begin/ghi;
 *  (3) mốc = MAX(id) MySQL; chỉ chép id > mốc (+ dòng PG ở "lỗ" ≤ mốc mà MySQL không có);
 *  (4) dòng ≤ mốc khác ảnh kỳ vọng ⇒ BÁO (không ghi đè), exit 5; dòng đổi giá trị do ép kiểu ⇒ exit 5;
 *  (5) một transaction: lỗi giữa chừng ⇒ rollback, exit 1, KHÔNG ALTER;
 *  (6) AUTO_INCREMENT nâng SAU commit, không bao giờ hạ; (7) chạy lần 2 ⇒ 0 dòng mới; (8) dry-run không ghi.
 * Fix round 1: xoá cứng trên v2 ⇒ báo; dòng lỗ ⇒ exit 5; trùng khoá UNIQUE ⇒ huỷ trước ghi; so ≤ mốc ở
 * mức PG + tên cột theo id; ALTER AUTO_INCREMENT hỏng sau commit ⇒ ai_raise_failed.
 */
import * as os from 'os';
import * as path from 'path';
import { EtlSafeError } from '../../src/rehearsal/etl/convert';
import { PgRow } from '../../src/rehearsal/copyback/convert';
import { permissiveCtx } from '../../src/rehearsal/copyback/expected';
import { pgImage } from '../../src/rehearsal/copyback/pg-image';
import {
  CopybackDeps,
  MysqlTarget,
  PgSource,
  copybackExitCode,
  runCopyback,
} from '../../src/rehearsal/copyback/runner';
import { COPYBACK_TABLES } from '../../src/rehearsal/copyback/tables';
import { renderCopybackMarkdown } from '../../src/rehearsal/copyback/report';

const REH_URL = 'postgresql://postgres:postgres@localhost:5433/tbs_rehearsal?schema=public';
const TEST_URL = 'postgresql://postgres:postgres@localhost:5433/tbs_test?schema=public';
const OUT_DIR = path.join(os.tmpdir(), 'copyback-runner-spec-out');
const REPO = path.resolve(__dirname, '..', '..');
const HOST = 'abcdef012345';
const MYSQL_OK = { host: '127.0.0.1', port: 3307, database: 'sql_nhpcn' };

/** cặp tiền mặc định RIÊNG theo id (khoá UNIQUE uq_pair) — trùng cặp là ca riêng. */
const FX_FEE = (id: number, fee = '0.150', from = 'VND', to = String(id).padStart(3, '0')) => ({
  id, from_cur: from, to_cur: to, fee_percent: fee, updated_by: null, updated_at: null,
});
const ZZ_PAY = {
  id: '56420', cdate: 1, mdate: null, price_cyn: '1.00', currency: 'CNY', rate_buy: 1, saler: 'zzqa_bot',
  from: '', source: '', code_order: 'ZZ-1', order_id: '0', note: '', note_payment: null, price_payment: null,
  payment: null, pdate: null, status: 'no', confirm: 'no', po_id: 0, pay_type: '', bill_images: null,
  account_code: '', ncc_receiver: '', ncc_bank_name: '', ncc_bank_account: '', ncc_qr_image: '',
  ncc_bank_note: null, ncc_pay_channel: 'bank', ncc_platform_order: '', ncc_invoice_images: null,
  ncc_packing_list_images: null, kt_note: null, tt_ngoai_kieu: '',
};
/** khoá UNIQUE ≠ PRIMARY như information_schema của MariaDB diễn tập (đồ giả). */
const UNIQUE_KEYS: Record<string, { name: string; columns: string[] }[]> = {
  tbl_fx_fee_rates: [{ name: 'uq_pair', columns: ['from_cur', 'to_cur'] }],
  tbl_accounts: [{ name: 'code', columns: ['code'] }],
};
const TREASURY = (id: number, rate: string | null = '3500.50') => ({
  id, tk_code: 'TK01', type: 'in', bank_info: null, gout: '', wallet_detail_id: null, cus_id: null, cdate: 1,
  cuser: 'kt', money: '100.00000', rate, approve_user: null, approve_date: null, note: 'n', status: 1,
  tranId: null, trandetailId: null, source_module: '', source_id: 0, reversal_of: 0, reversal_code: '',
  reversal_reason: '', ref_request_id: 0, po_id: 0, container_id: 0, order_code: '',
});

function spec(model: string) {
  return COPYBACK_TABLES.find((s) => s.model === model)!;
}

/** ảnh PG của một dòng prod (như ETL L0 đã nạp). */
function pg(model: string, prod: Record<string, unknown>): PgRow {
  const s = spec(model);
  const f = s.forward!.map(prod, permissiveCtx());
  if (f.kind !== 'row') throw new Error('skip');
  return pgImage(f.data as Record<string, unknown>, s.pgColumns);
}

interface World {
  pg: Record<string, PgRow[]>;
  my: Record<string, Record<string, unknown>[]>;
  autoInc: Record<string, bigint>;
}

function fakes(
  w: World,
  opts: { hostname?: string; pgDb?: string; failInsertOn?: string; failAlterOn?: string } = {},
) {
  const calls: string[] = [];
  const inserted: Record<string, (string | null)[][]> = {};
  let inTx = false;
  let pending: { table: string; cols: string[]; rows: (string | null)[][] }[] = [];
  const source: PgSource = {
    async currentDatabase() {
      return opts.pgDb ?? 'tbs_rehearsal';
    },
    async query(sql: string) {
      const m = /FROM "([a-z_]+)"/.exec(sql)!;
      calls.push(`pg:${m[1]}`);
      return (w.pg[m[1]] ?? []).map((r) => ({ ...r }));
    },
    async close() {
      calls.push('pg:close');
    },
  };
  const maxOf = (t: string) => {
    const ids = (w.my[t] ?? []).map((r) => BigInt(String(r.id)));
    return ids.length ? ids.reduce((a, b) => (b > a ? b : a)).toString() : null;
  };
  const target: MysqlTarget = {
    async identity() {
      calls.push('my:identity');
      return {
        hostname: opts.hostname ?? HOST,
        version: '10.11.19-MariaDB-ubu2204',
        sqlMode: 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION',
        database: 'sql_nhpcn',
      };
    },
    async begin() {
      calls.push('my:begin');
      inTx = true;
      pending = [];
    },
    async maxId(t) {
      return maxOf(t);
    },
    async selectRows(t) {
      return (w.my[t] ?? []).map((r) => ({ ...r }));
    },
    async selectIds(t) {
      calls.push(`my:ids:${t}`);
      return (w.my[t] ?? []).map((r) => String(r.id));
    },
    async uniqueKeys(t) {
      return UNIQUE_KEYS[t] ?? [];
    },
    async findUniqueConflict(t, cols, values) {
      const ci = (v: unknown) => String(v).toLowerCase().replace(/ +$/, '');
      return (w.my[t] ?? []).some((r) => cols.every((c, i) => r[c] !== null && ci(r[c]) === ci(values[i])));
    },
    async insert(t, cols, rows) {
      if (!inTx) throw new Error('insert ngoài transaction');
      calls.push(`my:insert:${t}:${rows.length}`);
      if (opts.failInsertOn === t) throw new Error('Duplicate entry 7 for key PRIMARY');
      pending.push({ table: t, cols, rows });
      return { affected: rows.length, warnings: 0 };
    },
    async commit() {
      calls.push('my:commit');
      for (const p of pending) {
        inserted[p.table] = [...(inserted[p.table] ?? []), ...p.rows];
        for (const r of p.rows) {
          const o: Record<string, unknown> = {};
          p.cols.forEach((c, i) => (o[c] = r[i]));
          (w.my[p.table] ??= []).push(o);
          const id = BigInt(String(o.id));
          if (id >= (w.autoInc[p.table] ?? 1n)) w.autoInc[p.table] = id + 1n;
        }
      }
      inTx = false;
    },
    async rollback() {
      calls.push('my:rollback');
      pending = [];
      inTx = false;
    },
    async autoIncrement(t) {
      return (w.autoInc[t] ?? 1n).toString();
    },
    async setAutoIncrement(t, v) {
      calls.push(`my:alter:${t}:${v}`);
      if (opts.failAlterOn === t) throw new Error('ALTER lỗi');
      w.autoInc[t] = BigInt(v);
    },
    async close() {
      calls.push('my:close');
    },
  };
  let opened = 0;
  const deps: CopybackDeps = {
    async openSource() {
      opened++;
      calls.push('open:pg');
      return source;
    },
    async openTarget() {
      opened++;
      calls.push('open:my');
      return target;
    },
    containerHostname() {
      calls.push('docker:inspect');
      return HOST;
    },
  };
  return { deps, calls, inserted, opened: () => opened };
}

function baseWorld(): World {
  const fee1 = FX_FEE(1);
  const fee2 = FX_FEE(2);
  const t1 = TREASURY(1790000000);
  return {
    my: { tbl_fx_fee_rates: [fee1, fee2], tbl_account_histories: [t1] },
    pg: {
      tbl_fx_fee_rates: [pg('FxFeeRate', fee1), pg('FxFeeRate', fee2)],
      tbl_account_histories: [pg('TreasuryEntry', t1)],
    },
    autoInc: { tbl_fx_fee_rates: 27n, tbl_account_histories: 1790325304n },
  };
}

function opts(over: Partial<Parameters<typeof runCopyback>[0]> = {}) {
  return {
    pgUrl: REH_URL,
    forbiddenUrls: [TEST_URL],
    mysql: MYSQL_OK,
    outDir: OUT_DIR,
    repoRoot: REPO,
    writeReport: false,
    ...over,
  };
}

describe('runCopyback — chốt an toàn', () => {
  it('đích PG tbs_test ⇒ TỪ CHỐI trước khi mở bất kỳ kết nối nào', async () => {
    const f = fakes(baseWorld());
    await expect(runCopyback(opts({ pgUrl: TEST_URL }), f.deps)).rejects.toThrow(EtlSafeError);
    expect(f.opened()).toBe(0);
  });

  it('đích MySQL prod 103.142.27.124 / cổng 3306 ⇒ TỪ CHỐI trước khi mở kết nối', async () => {
    for (const mysql of [{ ...MYSQL_OK, host: '103.142.27.124' }, { ...MYSQL_OK, port: 3306 }]) {
      const f = fakes(baseWorld());
      await expect(runCopyback(opts({ mysql }), f.deps)).rejects.toThrow(/mysql-target-guard/);
      expect(f.opened()).toBe(0);
    }
  });

  it('thư mục báo cáo trong repo ⇒ TỪ CHỐI (dữ liệu thật phải ngoài repo)', async () => {
    const f = fakes(baseWorld());
    await expect(runCopyback(opts({ outDir: path.join(REPO, 'out') }), f.deps)).rejects.toThrow(/ngoài repo/);
    expect(f.opened()).toBe(0);
  });

  it('@@hostname ≠ container (vd đường hầm tới máy khác) ⇒ TỪ CHỐI trước begin, không ghi', async () => {
    const f = fakes(baseWorld(), { hostname: 'prod-db-01' });
    await expect(runCopyback(opts(), f.deps)).rejects.toThrow(/hostname/);
    expect(f.calls).not.toContain('my:begin');
    expect(f.calls.some((c) => c.startsWith('my:insert'))).toBe(false);
    expect(f.calls).toContain('my:close');
  });

  it('PG current_database() khác tbs_rehearsal ⇒ TỪ CHỐI, không mở MySQL', async () => {
    const f = fakes(baseWorld(), { pgDb: 'tbs_test' });
    await expect(runCopyback(opts(), f.deps)).rejects.toThrow(/current_database/);
    expect(f.calls).not.toContain('open:my');
  });
});

describe('runCopyback — chép phần chênh', () => {
  it('không có dòng mới ⇒ 0 chép, outcome clean, exit 0', async () => {
    const f = fakes(baseWorld());
    const s = await runCopyback(opts(), f.deps);
    expect(s.outcome).toBe('clean');
    expect(copybackExitCode(s.outcome)).toBe(0);
    expect(s.tables.reduce((a, t) => a + t.copied, 0)).toBe(0);
    expect(s.tables.find((t) => t.model === 'FxFeeRate')).toMatchObject({ mark: '2', pgRead: 2, modifiedOld: 0 });
  });

  it('chỉ chép id > mốc, thứ tự cha → con, một transaction, AUTO_INCREMENT nâng SAU commit', async () => {
    const w = baseWorld();
    w.pg.tbl_fx_fee_rates.push(pg('FxFeeRate', FX_FEE(30)));
    w.pg.tbl_account_histories.push(pg('TreasuryEntry', TREASURY(1790400000)));
    const f = fakes(w);
    const s = await runCopyback(opts(), f.deps);
    expect(s.outcome).toBe('clean');
    const ins = f.calls.filter((c) => c.startsWith('my:insert'));
    expect(ins).toEqual(['my:insert:tbl_account_histories:1', 'my:insert:tbl_fx_fee_rates:1']); // 09b trước 09c
    const iBegin = f.calls.indexOf('my:begin');
    const iCommit = f.calls.indexOf('my:commit');
    expect(f.calls.filter((c) => c === 'my:begin')).toHaveLength(1);
    expect(iBegin).toBeLessThan(f.calls.indexOf(ins[0]));
    expect(iCommit).toBeGreaterThan(f.calls.indexOf(ins[1]));
    // fee: AI 27, chép id 30 ⇒ counter đã tự nhảy 31 ⇒ không cần ALTER
    expect(s.tables.find((t) => t.model === 'FxFeeRate')).toMatchObject({
      copied: 1, newRows: 1, autoIncrementBefore: '27', autoIncrementAfter: '31',
    });
    // sổ quỹ: AI 1790325304 cao hơn MAX+1 của dòng mới? 1790400000+1 > ⇒ counter tự nhảy
    expect(s.tables.find((t) => t.model === 'TreasuryEntry')!.autoIncrementAfter).toBe('1790400001');
    expect(f.inserted.tbl_fx_fee_rates[0][0]).toBe('30');
  });

  it('AUTO_INCREMENT thấp hơn MAX(id)+1 sau commit ⇒ ALTER = MAX+1; KHÔNG BAO GIỜ hạ', async () => {
    const w = baseWorld();
    w.autoInc.tbl_fx_fee_rates = 2n; // lệch giả: counter thấp hơn MAX(id)=2
    const f = fakes(w);
    const s = await runCopyback(opts(), f.deps);
    expect(f.calls).toContain('my:alter:tbl_fx_fee_rates:3');
    expect(f.calls.indexOf('my:alter:tbl_fx_fee_rates:3')).toBeGreaterThan(f.calls.indexOf('my:commit'));
    expect(s.tables.find((t) => t.model === 'FxFeeRate')!.autoIncrementAfter).toBe('3');
    // sổ quỹ AI 1790325304 > MAX+1 ⇒ giữ nguyên, không ALTER hạ xuống
    expect(f.calls.some((c) => c.startsWith('my:alter:tbl_account_histories'))).toBe(false);
  });

  it('dòng mới đổi giá trị do ép kiểu (rate 6→2 lẻ) ⇒ VẪN chép, đếm + id, exit 5', async () => {
    const w = baseWorld();
    w.pg.tbl_account_histories.push({ ...pg('TreasuryEntry', TREASURY(1790400000)), rate: '3500.123456' });
    const f = fakes(w);
    const s = await runCopyback(opts(), f.deps);
    const t = s.tables.find((x) => x.model === 'TreasuryEntry')!;
    expect(t).toMatchObject({ copied: 1, coercedRows: 1, coercedIds: ['1790400000'], coercedColumns: { rate: 1 } });
    expect(s.outcome).toBe('flagged');
    expect(copybackExitCode(s.outcome)).toBe(5);
    const cols = Object.keys(spec('TreasuryEntry').reverse(w.pg.tbl_account_histories[1]).row);
    expect(f.inserted.tbl_account_histories[0][cols.indexOf('rate')]).toBe('3500.12');
  });

  it('dòng ≤ mốc bị v2 SỬA ⇒ KHÔNG ghi đè MySQL, báo id + cột, exit 5; phần mới vẫn chép', async () => {
    const w = baseWorld();
    w.pg.tbl_fx_fee_rates[1] = { ...w.pg.tbl_fx_fee_rates[1], fee_percent: '0.200' };
    w.pg.tbl_fx_fee_rates.push(pg('FxFeeRate', FX_FEE(3)));
    const f = fakes(w);
    const s = await runCopyback(opts(), f.deps);
    const t = s.tables.find((x) => x.model === 'FxFeeRate')!;
    expect(t).toMatchObject({ modifiedOld: 1, modifiedIds: ['2'], modifiedColumns: { fee_percent: 1 }, copied: 1 });
    expect(t.modifiedDetails).toEqual([{ id: '2', columns: ['fee_percent'] }]);
    expect(f.inserted.tbl_fx_fee_rates.map((r) => r[0])).toEqual(['3']);
    expect(w.my.tbl_fx_fee_rates.find((r) => String(r.id) === '2')!.fee_percent).toBe('0.150'); // không ghi đè
    expect(s.outcome).toBe('flagged');
  });

  it('dòng PG ≤ mốc ở "lỗ" (MySQL không có id đó) ⇒ VẪN chép, nhưng exit 5 + liệt kê id (quyết định controller)', async () => {
    const w = baseWorld();
    // dòng đỉnh MySQL là rác ZZ ⇒ ETL loại ⇒ mốc 56420 cao hơn MAX PG
    w.my.tbl_payment = [ZZ_PAY];
    w.pg.tbl_payment = [pg('SupplierPayment', { ...ZZ_PAY, id: '56000', saler: 'kt1', code_order: 'TBS9' })];
    const s = await runCopyback(opts(), fakes(w).deps);
    expect(s.tables.find((x) => x.model === 'SupplierPayment')).toMatchObject({
      mark: '56420', newRows: 0, gapRows: 1, gapIds: ['56000'], copied: 1, mysqlOnlyRows: 1, deletedRows: 0,
    });
    expect(s.outcome).toBe('flagged');
    expect(copybackExitCode(s.outcome)).toBe(5);
  });

  it('XOÁ CỨNG trên v2: dòng MySQL ≤ mốc vắng ở PG mà xuôi KHÔNG loại ⇒ báo id, exit 5, KHÔNG xoá ở MySQL', async () => {
    const w = baseWorld();
    w.pg.tbl_fx_fee_rates = [w.pg.tbl_fx_fee_rates[0]]; // v2 xoá fee id 2
    const f = fakes(w);
    const s = await runCopyback(opts(), f.deps);
    expect(s.tables.find((x) => x.model === 'FxFeeRate')).toMatchObject({
      deletedRows: 1, deletedIds: ['2'], mysqlOnlyRows: 1,
    });
    expect(s.outcome).toBe('flagged');
    expect(w.my.tbl_fx_fee_rates).toHaveLength(2);
    expect(f.calls.some((c) => /delete/i.test(c))).toBe(false);
  });

  it('dòng MySQL vắng ở PG mà ETL đã LOẠI (rác ZZ, phiếu con mồ côi A2) ⇒ KHÔNG báo xoá (ngữ cảnh xuôi THẬT)', async () => {
    const w = baseWorld();
    w.my.tbl_payment = [ZZ_PAY];
    w.my.tbl_payment_orders = [
      { id: 5, payment_id: 999, order_id: 1, rmb: '1.00', cdate: 1, prev_fund: null, prev_rate: null }, // cha không có
      { id: 6, payment_id: 56420, order_id: 1, rmb: '1.00', cdate: 1, prev_fund: null, prev_rate: null }, // cha rác ZZ
    ];
    const s = await runCopyback(opts(), fakes(w).deps);
    for (const m of ['SupplierPayment', 'SupplierPaymentOrder']) {
      expect(s.tables.find((x) => x.model === m)).toMatchObject({ deletedRows: 0 });
    }
    expect(s.tables.find((x) => x.model === 'SupplierPaymentOrder')!.mysqlOnlyRows).toBe(2);
    expect(s.outcome).toBe('clean');
  });

  it('ReturnState trỏ phiếu duyệt không tồn tại (A1) vắng ở PG ⇒ KHÔNG báo xoá (id phiếu duyệt đọc từ MySQL)', async () => {
    const w = baseWorld();
    w.my.tbl_approval_requests = [{ id: 500 }];
    const st = (id: number, obj: string) => ({
      id, object_type: 'approval_request', object_id: obj, checkpoint_type: 'biz', checkpoint_ref: 'x',
      state: 'resubmitted', reason: '', round: 1, fields_opened: '[]', data_before: null, data_after: null,
      returned_by: 'a', returned_at: 1, resubmitted_at: 2,
    });
    w.my.tbl_return_state = [st(1, '500'), st(2, '777')];
    w.pg.tbl_return_state = [pg('ReturnState', st(1, '500'))];
    const f = fakes(w);
    const s = await runCopyback(opts(), f.deps);
    expect(f.calls).toContain('my:ids:tbl_approval_requests');
    expect(s.tables.find((x) => x.model === 'ReturnState')).toMatchObject({ deletedRows: 0, mysqlOnlyRows: 1 });
  });

  it('trùng khoá UNIQUE với dòng MySQL (uq_pair, không phân biệt hoa/thường) ⇒ HUỶ TRƯỚC mọi ghi, exit 5', async () => {
    const w = baseWorld();
    w.pg.tbl_account_histories.push(pg('TreasuryEntry', TREASURY(1790400000))); // bảng khác, hợp lệ
    w.pg.tbl_fx_fee_rates.push(pg('FxFeeRate', FX_FEE(30, '0.150', 'vnd', '001'))); // trùng cặp của id 1
    const f = fakes(w);
    const s = await runCopyback(opts(), f.deps);
    expect(s.outcome).toBe('unique_conflict');
    expect(copybackExitCode(s.outcome)).toBe(5);
    expect(s.outcomeMessage).toMatch(/UNIQUE/);
    expect(s.uniqueConflicts).toEqual([{ table: 'tbl_fx_fee_rates', id: '30', key: 'uq_pair', against: 'mysql' }]);
    expect(f.calls.some((c) => c.startsWith('my:insert'))).toBe(false); // sổ quỹ cũng KHÔNG ghi
    expect(f.calls).toContain('my:rollback');
    expect(f.calls.some((c) => c.startsWith('my:alter'))).toBe(false);
    expect(JSON.stringify(s)).not.toContain('vnd');
  });

  it('trùng khoá UNIQUE GIỮA các dòng mới trong cùng lô ⇒ HUỶ, against=batch', async () => {
    const w = baseWorld();
    w.pg.tbl_fx_fee_rates.push(
      pg('FxFeeRate', FX_FEE(30, '0.1', 'USD', 'CNY')),
      pg('FxFeeRate', FX_FEE(31, '0.2', 'usd', 'cny')),
    );
    const s = await runCopyback(opts(), fakes(w).deps);
    expect(s.outcome).toBe('unique_conflict');
    expect(s.uniqueConflicts).toEqual([{ table: 'tbl_fx_fee_rates', id: '31', key: 'uq_pair', against: 'batch' }]);
  });

  it('ALTER AUTO_INCREMENT hỏng SAU commit ⇒ outcome ai_raise_failed (đã commit), exit 5, nêu bảng', async () => {
    const w = baseWorld();
    w.autoInc.tbl_fx_fee_rates = 2n;
    const f = fakes(w, { failAlterOn: 'tbl_fx_fee_rates' });
    const s = await runCopyback(opts(), f.deps);
    expect(f.calls).toContain('my:commit');
    expect(s.outcome).toBe('ai_raise_failed');
    expect(s.outcomeMessage).toMatch(/committed; AUTO_INCREMENT raise failed on tbl_fx_fee_rates/);
    expect(copybackExitCode(s.outcome)).toBe(5);
  });

  it('dòng PG ≤ mốc TRÙNG id một dòng MySQL mà chiều xuôi đã LOẠI (rác ZZ) ⇒ xung đột, báo, không chép', async () => {
    const w = baseWorld();
    const pay = ZZ_PAY;
    w.my.tbl_payment = [pay];
    w.pg.tbl_payment = [pgImageOfPayment({ ...pay, saler: 'kt1', code_order: 'TBS9' })];
    const f = fakes(w);
    const s = await runCopyback(opts(), f.deps);
    expect(s.tables.find((x) => x.model === 'SupplierPayment')).toMatchObject({
      modifiedOld: 1, modifiedIds: ['56420'], modifiedReasons: { 'xung đột: xuôi đã loại dòng MySQL cùng id': 1 }, copied: 0,
    });
    expect(s.outcome).toBe('flagged');
  });

  it('lỗi ghi giữa chừng ⇒ ROLLBACK toàn bộ, không commit, không ALTER, outcome failed', async () => {
    const w = baseWorld();
    w.pg.tbl_account_histories.push(pg('TreasuryEntry', TREASURY(1790400000)));
    w.pg.tbl_fx_fee_rates.push(pg('FxFeeRate', FX_FEE(30)));
    const f = fakes(w, { failInsertOn: 'tbl_fx_fee_rates' });
    await expect(runCopyback(opts(), f.deps)).rejects.toThrow();
    expect(f.calls).toContain('my:rollback');
    expect(f.calls).not.toContain('my:commit');
    expect(f.calls.some((c) => c.startsWith('my:alter'))).toBe(false);
    expect(w.my.tbl_account_histories).toHaveLength(1); // dòng sổ quỹ đã "ghi" cũng bị lùi
  });

  it('mapper ngược nổ (giá trị MySQL không nhận) ⇒ rollback TRƯỚC mọi insert', async () => {
    const w = baseWorld();
    w.pg.tbl_account_histories.push({ ...pg('TreasuryEntry', TREASURY(1790400000)), status: '300' });
    const f = fakes(w);
    await expect(runCopyback(opts(), f.deps)).rejects.toThrow(/biên/);
    expect(f.calls.some((c) => c.startsWith('my:insert'))).toBe(false);
    expect(f.calls).toContain('my:rollback');
  });

  it('chạy lần 2 (có v2IdStart từ báo cáo ETL) ⇒ 0 dòng mới, 0 dòng bị báo (kể cả dòng đã làm tròn rate)', async () => {
    const w = baseWorld();
    w.pg.tbl_account_histories.push({ ...pg('TreasuryEntry', TREASURY(1790400000)), rate: '3500.123456' });
    w.pg.tbl_fx_fee_rates.push(pg('FxFeeRate', FX_FEE(30)));
    const v2IdStart = { tbl_account_histories: '1790325304', tbl_fx_fee_rates: '27' };
    await runCopyback(opts({ v2IdStart }), fakes(w).deps);
    const s2 = await runCopyback(opts({ v2IdStart }), fakes(w).deps);
    expect(s2.tables.reduce((a, t) => a + t.copied, 0)).toBe(0);
    expect(s2.tables.reduce((a, t) => a + t.modifiedOld, 0)).toBe(0);
    expect(s2.outcome).toBe('clean');
  });

  it('chạy lần 2 KHÔNG có v2IdStart ⇒ dòng đã làm tròn bị báo "khác dưới độ chính xác MySQL" (không phân biệt được với v2 sửa)', async () => {
    const w = baseWorld();
    w.pg.tbl_account_histories.push({ ...pg('TreasuryEntry', TREASURY(1790400000)), rate: '3500.123456' });
    await runCopyback(opts(), fakes(w).deps);
    const s2 = await runCopyback(opts(), fakes(w).deps);
    expect(s2.tables.find((t) => t.model === 'TreasuryEntry')).toMatchObject({
      modifiedOld: 1,
      modifiedReasons: { 'khác dưới độ chính xác MySQL (đã làm tròn khi chép trước, hoặc v2 sửa phần lẻ)': 1 },
    });
  });

  it('dòng lịch sử (< v2IdStart) v2 sửa rate 3500.50 → 3500.501 ⇒ BÁO (so mức PG), liệt kê tên cột theo id', async () => {
    const w = baseWorld();
    w.pg.tbl_account_histories[0] = { ...w.pg.tbl_account_histories[0], rate: '3500.501000' };
    const s = await runCopyback(opts({ v2IdStart: { tbl_account_histories: '1790325304' } }), fakes(w).deps);
    const t = s.tables.find((x) => x.model === 'TreasuryEntry')!;
    expect(t.modifiedDetails).toEqual([{ id: '1790000000', columns: ['rate'] }]);
    expect(s.outcome).toBe('flagged');
  });

  it('--dry-run: phân loại đủ nhưng KHÔNG insert, rollback, không ALTER', async () => {
    const w = baseWorld();
    w.pg.tbl_fx_fee_rates.push(pg('FxFeeRate', FX_FEE(30)));
    w.autoInc.tbl_fx_fee_rates = 2n;
    const f = fakes(w);
    const s = await runCopyback(opts({ dryRun: true }), f.deps);
    expect(s.dryRun).toBe(true);
    expect(s.tables.find((t) => t.model === 'FxFeeRate')).toMatchObject({ newRows: 1, copied: 0 });
    expect(f.calls.some((c) => c.startsWith('my:insert') || c.startsWith('my:alter'))).toBe(false);
    expect(f.calls).toContain('my:rollback');
    expect(f.calls).not.toContain('my:commit');
  });

  it('báo cáo: có danh sách bảng ngoài phạm vi + phần mất có chủ đích; KHÔNG chứa giá trị dòng', async () => {
    const w = baseWorld();
    w.pg.tbl_account_histories.push({ ...pg('TreasuryEntry', TREASURY(1790400000)), note: 'BI-MAT-NOTE' });
    const s = await runCopyback(opts(), fakes(w).deps);
    const json = JSON.stringify(s);
    expect(json).not.toContain('BI-MAT-NOTE');
    expect(s.outOfScope.join(' ')).toMatch(/#03/);
    expect(s.tables.find((t) => t.model === 'TreasuryEntry')!.lossy.join(' ')).toMatch(/rate/);
  });

  it('mã thoát: clean 0 · failed 1 · flagged / unique_conflict / ai_raise_failed 5', () => {
    expect(copybackExitCode('clean')).toBe(0);
    expect(copybackExitCode('failed')).toBe(1);
    expect(copybackExitCode('flagged')).toBe(5);
    expect(copybackExitCode('unique_conflict')).toBe(5);
    expect(copybackExitCode('ai_raise_failed')).toBe(5);
  });

  it('báo cáo MD nêu rõ: chép dòng "lỗ" lệch câu chữ kế hoạch; created_at theo giờ VN', async () => {
    const w = baseWorld();
    const s = await runCopyback(opts(), fakes(w).deps);
    const md = renderCopybackMarkdown(s);
    expect(md).toMatch(/lỗ.*lệch câu chữ kế hoạch/);
    expect(md).toMatch(/created_at.*giờ đồng hồ VN/);
  });
});

function pgImageOfPayment(prod: Record<string, unknown>): PgRow {
  return pg('SupplierPayment', prod);
}

// ───────────────────────────────────────────── L13 Task 2 — N1: --etl-report phải KHỚP CSDL + sàn nguồn hiện tại
describe('runCopyback — kiểm báo cáo ETL (--etl-report, N1)', () => {
  it('CSDL đích ghi trong báo cáo ETL ≠ current_database() ⇒ TỪ CHỐI trước begin, không ghi', async () => {
    const f = fakes(baseWorld());
    await expect(
      runCopyback(opts({ v2IdStart: { tbl_fx_fee_rates: '27' }, etlReportDatabase: 'khac_rehearsal' }), f.deps),
    ).rejects.toThrow(/báo cáo ETL.*khac_rehearsal.*tbs_rehearsal/);
    expect(f.calls).not.toContain('my:begin');
    expect(f.calls.some((c) => c.startsWith('my:insert'))).toBe(false);
  });

  it('v2Start < sàn nguồn HIỆN TẠI (AUTO_INCREMENT−1 cao hơn — báo cáo ETL cũ/công thức cũ) ⇒ TỪ CHỐI, rollback, không ghi', async () => {
    const w = baseWorld();
    w.pg.tbl_fx_fee_rates.push(pg('FxFeeRate', FX_FEE(3)));
    const f = fakes(w);
    // AI 27 ⇒ sàn = GREATEST(MAX 2, 27−1)+1 = 27; báo cáo cũ ghi setval 3 (MAX đã nạp + 1)
    await expect(
      runCopyback(opts({ v2IdStart: { tbl_fx_fee_rates: '3' }, etlReportDatabase: 'tbs_rehearsal' }), f.deps),
    ).rejects.toThrow(/tbl_fx_fee_rates.*v2Start=3.*sàn nguồn hiện tại 27/);
    expect(f.calls.some((c) => c.startsWith('my:insert'))).toBe(false);
    expect(f.calls).toContain('my:rollback');
    expect(f.calls).not.toContain('my:commit');
  });

  it('MySQL có dòng id ≥ v2Start mà PG KHÔNG có (MySQL ghi thêm sau ETL) ⇒ TỪ CHỐI', async () => {
    const w = baseWorld();
    w.my.tbl_fx_fee_rates.push(FX_FEE(40));
    w.autoInc.tbl_fx_fee_rates = 41n;
    const f = fakes(w);
    await expect(
      runCopyback(opts({ v2IdStart: { tbl_fx_fee_rates: '27' }, etlReportDatabase: 'tbs_rehearsal' }), f.deps),
    ).rejects.toThrow(/tbl_fx_fee_rates.*sàn nguồn hiện tại 41/);
    expect(f.calls.some((c) => c.startsWith('my:insert'))).toBe(false);
  });

  it('VA CHẠM id: MySQL tự ghi dòng id = v2Start SAU ETL, v2 cũng cấp id đó (nội dung khác) ⇒ TỪ CHỐI nêu bảng + id', async () => {
    const w = baseWorld();
    w.my.tbl_fx_fee_rates.push(FX_FEE(27, '0.200')); // dòng MySQL-sinh sau ETL
    w.autoInc.tbl_fx_fee_rates = 28n;
    w.pg.tbl_fx_fee_rates.push(pg('FxFeeRate', FX_FEE(27, '0.150'))); // dòng v2 cùng id
    const f = fakes(w);
    await expect(
      runCopyback(opts({ v2IdStart: { tbl_fx_fee_rates: '27' }, etlReportDatabase: 'tbs_rehearsal' }), f.deps),
    ).rejects.toThrow(/va chạm id.*tbl_fx_fee_rates.*id 27/);
    expect(f.calls.some((c) => c.startsWith('my:insert'))).toBe(false);
    expect(f.calls).not.toContain('my:commit');
  });

  it('chưa có dòng v2 nào về MySQL mà v2Start > sàn hiện tại (báo cáo cũ, setval LỚN hơn) ⇒ TỪ CHỐI (phải BẰNG)', async () => {
    const f = fakes(baseWorld());
    await expect(
      runCopyback(opts({ v2IdStart: { tbl_fx_fee_rates: '40' }, etlReportDatabase: 'tbs_rehearsal' }), f.deps),
    ).rejects.toThrow(/tbl_fx_fee_rates v2Start=40 ≠ sàn nguồn hiện tại 27/);
    expect(f.calls.some((c) => c.startsWith('my:insert'))).toBe(false);
  });

  it('thông điệp từ chối N1 KHÔNG xúi chạy lại ETL (R1 thật: ETL TRUNCATE PG ⇒ mất dữ liệu v2) — chỉ --dry-run', async () => {
    const msgs: string[] = [];
    const cases: [World, Record<string, string>][] = [];
    const w1 = baseWorld();
    cases.push([w1, { tbl_fx_fee_rates: '40' }]);
    const w2 = baseWorld();
    w2.my.tbl_fx_fee_rates.push(FX_FEE(27, '0.200'));
    w2.autoInc.tbl_fx_fee_rates = 28n;
    w2.pg.tbl_fx_fee_rates.push(pg('FxFeeRate', FX_FEE(27, '0.150')));
    cases.push([w2, { tbl_fx_fee_rates: '27' }]);
    for (const [w, v2IdStart] of cases) {
      await runCopyback(opts({ v2IdStart, etlReportDatabase: 'tbs_rehearsal' }), fakes(w).deps).catch((e: Error) => msgs.push(e.message));
    }
    expect(msgs).toHaveLength(2);
    for (const m of msgs) {
      // mọi lần nhắc "chạy lại ETL" đều phải là lời CẤM
      expect(m.replace(/KHÔNG chạy lại ETL/g, '')).not.toMatch(/chạy lại ETL|re-?run ETL|báo cáo mới/i);
      expect(m).toMatch(/KHÔNG chạy lại ETL/);
      expect(m).toMatch(/--dry-run/);
    }
  });

  it('báo cáo khớp: lần 1 và lần 2 (dòng v2 đã chép nằm ≥ v2Start, AI đã nâng theo chúng) đều CHẤP NHẬN', async () => {
    const w = baseWorld();
    w.pg.tbl_fx_fee_rates.push(pg('FxFeeRate', FX_FEE(27)), pg('FxFeeRate', FX_FEE(28)));
    const o = opts({ v2IdStart: { tbl_fx_fee_rates: '27', tbl_account_histories: '1790325304' }, etlReportDatabase: 'tbs_rehearsal' });
    const s1 = await runCopyback(o, fakes(w).deps);
    expect(s1.tables.find((t) => t.model === 'FxFeeRate')).toMatchObject({ copied: 2 });
    const s2 = await runCopyback(o, fakes(w).deps);
    expect(s2.outcome).toBe('clean');
    expect(s2.tables.reduce((a, t) => a + t.copied, 0)).toBe(0);
  });
});
