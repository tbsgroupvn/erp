/**
 * L13 Task 2 — máy tổng duyệt khứ hồi `runRoundtrip` trên đồ giả (không CSDL): chốt an toàn chạy
 * TRƯỚC khi nạp lại dump (phá huỷ), thứ tự các pha, và phán quyết trung thực (FAIL khi dòng cũ đổi,
 * khi ETL hỏng, khi cờ kỳ vọng không được báo).
 */
import * as os from 'os';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { EtlSafeError, Row } from '../../src/rehearsal/etl/convert';
import { PgRow } from '../../src/rehearsal/copyback/convert';
import { permissiveCtx } from '../../src/rehearsal/copyback/expected';
import { pgImage } from '../../src/rehearsal/copyback/pg-image';
import type { CopybackSummary, CopyTableSummary } from '../../src/rehearsal/copyback/runner';
import { COPYBACK_TABLES } from '../../src/rehearsal/copyback/tables';
import { RoundtripDeps, RtMysql, RtPg, runRoundtrip } from '../../src/rehearsal/roundtrip/runner';
import { renderRoundtripMarkdown, verdictLine } from '../../src/rehearsal/roundtrip/report';
import { SimulationResult } from '../../src/rehearsal/roundtrip/types';
import { simulateV2Writes } from '../../src/rehearsal/roundtrip/simulate';

const REH_URL = 'postgresql://postgres:postgres@localhost:5433/tbs_rehearsal?schema=public';
const TEST_URL = 'postgresql://postgres:postgres@localhost:5433/tbs_test?schema=public';
const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(os.tmpdir(), 'roundtrip-runner-spec');
const HOST = 'abcdef012345';
const spec = (m: string) => COPYBACK_TABLES.find((s) => s.model === m)!;

const TREASURY = (id: number, over: Record<string, unknown> = {}) => ({
  id: String(id), tk_code: 'TK01', type: 'in', bank_info: null, gout: '', wallet_detail_id: null, cus_id: null, cdate: '1',
  cuser: 'kt', money: '100.00000', rate: '1.00', approve_user: null, approve_date: null, note: 'n', status: '1',
  tranId: null, trandetailId: null, source_module: '', source_id: '0', reversal_of: '0', reversal_code: '',
  reversal_reason: '', ref_request_id: '0', po_id: '0', container_id: '0', order_code: '', ...over,
});
function pgOf(model: string, prod: Record<string, unknown>): PgRow {
  const s = spec(model);
  const f = s.forward!.map(prod, permissiveCtx());
  if (f.kind !== 'row') throw new Error('skip');
  return pgImage(f.data as Record<string, unknown>, s.pgColumns);
}

interface World {
  my: Record<string, Row[]>;
  pg: Record<string, PgRow[]>;
  opening: Record<string, string>;
}

function world(): World {
  const t1 = TREASURY(1790000000);
  return {
    my: { tbl_account_histories: [t1] },
    pg: { tbl_account_histories: [pgOf('TreasuryEntry', t1)] },
    opening: { TK01: '10.00000' },
  };
}

function tsum(model: string, over: Partial<CopyTableSummary>): CopyTableSummary {
  const s = spec(model);
  return {
    model, doc: s.doc, table: s.table, mark: '0', pgRead: 0, mysqlRead: 0, newRows: 0, gapRows: 0, gapIds: [], copied: 0,
    coercedRows: 0, coercedIds: [], coercedColumns: {}, modifiedOld: 0, modifiedIds: [], modifiedDetails: [], modifiedColumns: {},
    modifiedReasons: {}, mysqlOnlyRows: 0, deletedRows: 0, deletedIds: [], autoIncrementBefore: null, autoIncrementAfter: null,
    lossy: [], durationMs: 0, ...over,
  };
}

function fakes(
  w: World,
  o: { hostname?: string; etlExit?: number; tamperOld?: boolean; silentCopyback?: boolean; loaded?: Record<string, number> } = {},
) {
  const calls: string[] = [];
  const maxOf = (t: string) => {
    const ids = (w.my[t] ?? []).map((r) => BigInt(String(r.id)));
    return ids.length ? ids.reduce((a, b) => (b > a ? b : a)).toString() : null;
  };
  const my: RtMysql = {
    async identity() {
      calls.push('my:identity');
      return { hostname: o.hostname ?? HOST, version: '10.11.19-MariaDB', sqlMode: 'STRICT_TRANS_TABLES', database: 'sql_nhpcn' };
    },
    async selectAll(t) {
      return (w.my[t] ?? []).map((r) => ({ ...r }));
    },
    async maxId(t) {
      return maxOf(t);
    },
    async autoIncrement(t) {
      const m = maxOf(t);
      return m === null ? '1' : (BigInt(m) + 1n).toString();
    },
    async accounts() {
      return Object.entries(w.opening).map(([code, opening_balance]) => ({ code, opening_balance }));
    },
    async treasurySums() {
      const m = new Map<string, Prisma.Decimal>();
      for (const r of w.my.tbl_account_histories ?? []) {
        if (String(r.status) !== '1') continue;
        const k = String(r.tk_code);
        m.set(k, (m.get(k) ?? new Prisma.Decimal(0)).plus(String(r.money)));
      }
      return [...m].map(([tk_code, s]) => ({ tk_code, s: s.toFixed(5) }));
    },
    async close() {
      calls.push('my:close');
    },
  };
  const sim: SimulationResult = {
    steps: [{ id: 'S1', title: 'x', via: 'TreasuryService.postEntry', ok: true, ids: { tbl_account_histories: ['1790325305'] } }],
    expected: { modified: [], deleted: [], coerced: [{ table: 'tbl_account_histories', id: '1790325305' }] },
    gaps: [],
  };
  const pg: RtPg = {
    async currentDatabase() {
      return 'tbs_rehearsal';
    },
    async selectTable(s) {
      return (w.pg[s.table] ?? []).map((r) => ({ ...r }));
    },
    async getBalances() {
      const m = new Map<string, Prisma.Decimal>(Object.entries(w.opening).map(([k, v]) => [k, new Prisma.Decimal(v)]));
      for (const r of w.pg.tbl_account_histories ?? []) {
        if (r.status !== '1') continue;
        const k = String(r.tk_code);
        m.set(k, (m.get(k) ?? new Prisma.Decimal(0)).plus(String(r.money)));
      }
      return m;
    },
    async simulate() {
      calls.push('simulate');
      w.pg.tbl_account_histories.push({ ...pgOf('TreasuryEntry', TREASURY(1790325305, { money: '5.00000' })), rate: '3612.345678' });
      return sim;
    },
    async close() {
      calls.push('pg:close');
    },
  };
  let runs = 0;
  const deps: RoundtripDeps = {
    containerHostname: () => HOST,
    async openMysql() {
      calls.push('open:my');
      return my;
    },
    async reloadDump() {
      calls.push('reload');
    },
    async runEtl() {
      calls.push('etl');
      return { exitCode: o.etlExit ?? 3, reportFile: 'etl-x.json' };
    },
    readEtlReport: () => ({
      targetDatabase: 'tbs_rehearsal', v2IdStart: { tbl_account_histories: '1790325304' },
      loaded: o.loaded ?? { tbl_account_histories: 1 },
    }),
    async openPg() {
      calls.push('open:pg');
      return pg;
    },
    async copyback(c) {
      runs++;
      calls.push(`copyback:${runs}`);
      expect(c.etlReportDatabase).toBe('tbs_rehearsal');
      const tables: CopyTableSummary[] = [];
      for (const s of COPYBACK_TABLES) {
        const have = new Set((w.my[s.table] ?? []).map((r) => String(r.id)));
        const coercedIds: string[] = [];
        let copied = 0;
        for (const pr of w.pg[s.table] ?? []) {
          if (have.has(String(pr.id))) continue;
          const rev = s.reverse(pr);
          (w.my[s.table] ??= []).push(rev.row);
          copied++;
          if (rev.coerced.length) coercedIds.push(String(pr.id));
        }
        if (o.tamperOld && s.table === 'tbl_account_histories') w.my[s.table][0] = { ...w.my[s.table][0], note: 'doi' };
        tables.push(tsum(s.model, {
          newRows: copied, copied, coercedRows: o.silentCopyback ? 0 : coercedIds.length, coercedIds: o.silentCopyback ? [] : coercedIds,
        }));
      }
      const flagged = tables.some((t) => t.coercedRows > 0);
      return {
        outcome: flagged ? 'flagged' : 'clean', outcomeMessage: '', dryRun: false, errorName: null, startedAt: '', finishedAt: '',
        pgDatabase: 'tbs_rehearsal', mysqlHost: '', v2IdStartGiven: true, tables, uniqueConflicts: [], notes: [], outOfScope: [],
        totalDurationMs: 0, reportFiles: [`copyback-${runs}.json`],
      } satisfies CopybackSummary;
    },
  };
  return { deps, calls };
}

const opts = (over: Record<string, unknown> = {}) => ({
  pgUrl: REH_URL, forbiddenUrls: [TEST_URL], mysql: { host: '127.0.0.1', port: 3307, database: 'sql_nhpcn' },
  outDir: OUT, repoRoot: REPO, writeReport: false, ...over,
});

describe('runRoundtrip — chốt an toàn TRƯỚC khi nạp lại dump', () => {
  it('PG tbs_test ⇒ TỪ CHỐI trước mọi kết nối / nạp lại', async () => {
    const f = fakes(world());
    await expect(runRoundtrip(opts({ pgUrl: TEST_URL }), f.deps)).rejects.toThrow(EtlSafeError);
    expect(f.calls).toEqual([]);
  });

  it('MySQL prod (103.142.27.124) ⇒ TỪ CHỐI trước mọi kết nối', async () => {
    const f = fakes(world());
    await expect(runRoundtrip(opts({ mysql: { host: '103.142.27.124', port: 3307, database: 'sql_nhpcn' } }), f.deps)).rejects.toThrow(
      /mysql-target-guard/,
    );
    expect(f.calls).toEqual([]);
  });

  it('@@hostname ≠ container diễn tập ⇒ TỪ CHỐI, KHÔNG nạp lại dump (phá huỷ)', async () => {
    const f = fakes(world(), { hostname: 'prod-db-01' });
    await expect(runRoundtrip(opts(), f.deps)).rejects.toThrow(/hostname/);
    expect(f.calls).not.toContain('reload');
    expect(f.calls).not.toContain('etl');
  });

  it('ETL thoát 2 (DỪNG) ⇒ lỗi, không giả lập, không chép ngược', async () => {
    const f = fakes(world(), { etlExit: 2 });
    await expect(runRoundtrip(opts(), f.deps)).rejects.toThrow(/ETL thoát 2/);
    expect(f.calls).not.toContain('simulate');
  });
});

describe('runRoundtrip — phán quyết', () => {
  it('khứ hồi sạch: thứ tự reload → ETL → giả lập → chép 1 → chép 2; mọi kiểm PASS, exit 0', async () => {
    const f = fakes(world());
    const s = await runRoundtrip(opts(), f.deps);
    const order = ['reload', 'etl', 'simulate', 'copyback:1', 'copyback:2'].map((c) => f.calls.indexOf(c));
    expect(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1]))).toBe(true);
    expect(s.checks.filter((c) => c.status === 'FAIL').map((c) => c.id)).toEqual([]);
    expect(s.verdict).toBe('PASS');
    expect(s.exitCode).toBe(0);
    expect(s.checks.map((c) => c.id)).toEqual([
      'R-mo-phong', 'R-co-lan-1', 'R-dong-moi', 'R-dong-cu-lan-1', 'R-ai-lan-1', 'R-so-du', 'R-lan-2', 'R-dong-cu-lan-2', 'R-ai-lan-2',
    ]);
    expect(verdictLine(s)).toBe('VERDICT: PASS (9 PASS / 0 FAIL trên 9 kiểm)');
    expect(f.calls).toContain('my:close');
    expect(f.calls).toContain('pg:close');
  });

  it('chép ngược làm ĐỔI một dòng cũ ⇒ R-dong-cu FAIL, exit 4 (không che)', async () => {
    const s = await runRoundtrip(opts(), fakes(world(), { tamperOld: true }).deps);
    expect(s.checks.find((c) => c.id === 'R-dong-cu-lan-1')!.status).toBe('FAIL');
    expect(s.verdict).toBe('FAIL');
    expect(s.exitCode).toBe(4);
    expect(renderRoundtripMarkdown(s)).toMatch(/⛔ R-dong-cu-lan-1/);
  });

  it('ETL báo đã nạp dòng cho một bảng mà mốc MySQL của bảng đó RỖNG ⇒ R-dong-cu FAIL (không PASS vì rỗng)', async () => {
    const s = await runRoundtrip(opts(), fakes(world(), { loaded: { tbl_account_histories: 1, tbl_payment: 15534 } }).deps);
    const c = s.checks.find((x) => x.id === 'R-dong-cu-lan-1')!;
    expect(c.status).toBe('FAIL');
    expect(c.details.emptyTables).toEqual(['tbl_payment']);
    expect(s.exitCode).toBe(4);
  });

  it('chép ngược IM LẶNG về dòng ép kiểu kỳ vọng ⇒ R-co-lan-1 FAIL (không PASS vì im lặng)', async () => {
    const s = await runRoundtrip(opts(), fakes(world(), { silentCopyback: true }).deps);
    const c = s.checks.find((x) => x.id === 'R-co-lan-1')!;
    expect(c.status).toBe('FAIL');
    expect(c.details.missing).toEqual(['coerced tbl_account_histories#1790325305']);
    expect(s.exitCode).toBe(4);
  });
});

describe('simulateV2Writes — chốt CSDL trước mọi ghi', () => {
  it('current_database() không phải *_rehearsal (vd tbs_test) ⇒ TỪ CHỐI, không gọi ghi nào', async () => {
    const touched: string[] = [];
    const p = new Proxy(
      { $queryRawUnsafe: async () => [{ db: 'tbs_test' }] },
      { get: (t, k) => (k in t ? (t as Record<string | symbol, unknown>)[k] : (touched.push(String(k)), undefined)) },
    );
    await expect(simulateV2Writes(p as never, 'tbs_test')).rejects.toThrow(/không phải CSDL diễn tập/);
    await expect(simulateV2Writes(p as never, 'tbs_rehearsal')).rejects.toThrow(/TỪ CHỐI ghi/);
    expect(touched).toEqual([]);
  });
});
