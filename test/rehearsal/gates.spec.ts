/**
 * L0 Task 3 — cổng nghiệm thu diễn tập. KHÔNG đụng CSDL nào: nguồn/đích/service là đồ giả, dữ liệu
 * TỰ DỰNG. Chứng minh:
 *  (1) mỗi hàm so sánh: bằng ⇒ PASS; lệch MỘT dòng ⇒ FAIL với đúng phần chênh (cổng không mù);
 *  (2) TOÀN BỘ sổ cổng khai báo (đếm / theo nhóm / sentinel / tham chiếu chéo): bơm dữ liệu giống nhau
 *      ⇒ PASS, làm lệch một ô ⇒ FAIL — từng cổng một, không cổng nào mù;
 *  (3) cổng tuỳ biến + số vàng (getBalance, luật 8.2 nội bộ, setval, monthlyFlow…) cũng đỏ khi lệch;
 *  (4) runner TỪ CHỐI URL không phải *_rehearsal / trùng CSDL test — không mở kết nối nào; từ chối đích
 *      không read-only; mã thoát 0/4/1;
 *  (5) bộ ghi báo cáo chỉ ra số đếm/tổng — giá trị chữ lọt vào ⇒ ném lỗi; tệp ngoài repo.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import {
  compareCount,
  compareCrossRef,
  compareKeyed,
  compareScalars,
  normVal,
} from '../../src/rehearsal/gates/compare';
import { Gate, GateContext, QueryDb, Row } from '../../src/rehearsal/gates/types';
import { ALL_GATES } from '../../src/rehearsal/gates/registry';
import { GoldenServices } from '../../src/rehearsal/gates/golden';
import { GateDeps, exitCodeForGates, runGates } from '../../src/rehearsal/gates/runner';
import { GateRunSummary, assertCountsOnly, renderGateMarkdown, writeGateReport } from '../../src/rehearsal/gates/report';

const D = (s: string) => new Prisma.Decimal(s);
const REH_URL = 'postgresql://postgres:postgres@localhost:5433/tbs_rehearsal?schema=public';
const TEST_URL = 'postgresql://postgres:postgres@localhost:5433/tbs_test?schema=public';
const OUT_DIR = path.join(os.tmpdir(), 'gates-spec-out');
const REPO = path.resolve(__dirname, '..', '..');

// ───────────────────────────────────────────────────────────── (1) hàm so sánh
describe('normVal — chuẩn hoá giá trị hai phía', () => {
  it('Decimal / chuỗi số / bigint / number cùng giá trị ⇒ cùng chuỗi; NULL ≠ \'\'', () => {
    expect(normVal(D('1.50'))).toBe('1.5');
    expect(normVal('1.50000')).toBe('1.5');
    expect(normVal(BigInt(12345678901234567890n))).toBe('12345678901234567890');
    expect(normVal(3)).toBe('3');
    expect(normVal(true)).toBe('1');
    expect(normVal(null)).toBeNull();
    expect(normVal('')).toBe('');
    expect(normVal(null)).not.toBe(normVal(''));
    expect(normVal('TK01')).toBe('TK01');
  });
});

describe('compareCount — cổng nguồn "sai là DỪNG"', () => {
  it('đếm = kỳ vọng ⇒ PASS, chênh 0', () => {
    const r = compareCount('0', 0);
    expect(r.status).toBe('PASS');
    expect(r.diff).toEqual({ count: 0 });
  });
  it('lệch một dòng ⇒ FAIL, chênh +1', () => {
    const r = compareCount('1', 0);
    expect(r.status).toBe('FAIL');
    expect(r.source).toEqual({ count: 1, expected: 0 });
    expect(r.diff).toEqual({ count: 1 });
  });
});

describe('compareScalars — một dòng tổng', () => {
  it('bằng (khác biểu diễn thập phân) ⇒ PASS', () => {
    expect(compareScalars({ a: '10.50', b: 3n }, { a: D('10.5'), b: 3 }).status).toBe('PASS');
  });
  it('lệch một cột ⇒ FAIL, chênh = đích − nguồn, chỉ tên cột lệch', () => {
    const r = compareScalars({ a: '10.50', b: '3' }, { a: D('10.49'), b: 3 });
    expect(r.status).toBe('FAIL');
    expect(r.diff).toEqual({ a: '-0.01' });
    expect(r.columns).toEqual(['a']);
  });
  it('NULL một phía, 0 phía kia ⇒ FAIL (NULL ≠ 0)', () => {
    const r = compareScalars({ a: null }, { a: 0 });
    expect(r.status).toBe('FAIL');
    expect(r.columns).toEqual(['a']);
  });
});

describe('compareKeyed — theo nhóm, từng ô', () => {
  const src: Row[] = [
    { k: 'TK01', n: '2', s: '100.00' },
    { k: 'TK02', n: '1', s: '-5.5' },
  ];
  it('bằng từng ô ⇒ PASS; tổng Σ theo cột ở hai phía', () => {
    const r = compareKeyed(src, [{ k: 'TK02', n: 1n, s: D('-5.50') }, { k: 'TK01', n: 2, s: D('100') }], {
      key: ['k'],
      values: ['n', 's'],
    });
    expect(r.status).toBe('PASS');
    expect(r.source).toEqual({ rows: 2, 'Σn': '3', 'Σs': '94.5' });
    expect(r.target).toEqual({ rows: 2, 'Σn': '3', 'Σs': '94.5' });
  });
  it('lệch MỘT ô ⇒ FAIL: 1 khoá lệch, cột s, chênh Σ', () => {
    const r = compareKeyed(src, [{ k: 'TK01', n: '2', s: '100' }, { k: 'TK02', n: '1', s: '-5.49' }], {
      key: ['k'],
      values: ['n', 's'],
      keysAreLabels: true,
    });
    expect(r.status).toBe('FAIL');
    expect(r.diff).toMatchObject({ keysMismatched: 1, rowsMissingInTarget: 0, rowsExtraInTarget: 0, 'Σs': '0.01' });
    expect(r.columns).toEqual(['s']);
    expect(r.keys).toEqual(['TK02']);
  });
  it('thiếu MỘT dòng ở đích ⇒ FAIL rowsMissingInTarget=1; khoá không phải nhãn ⇒ không in khoá', () => {
    const r = compareKeyed(src, [{ k: 'TK01', n: '2', s: '100' }], { key: ['k'], values: ['n', 's'] });
    expect(r.status).toBe('FAIL');
    expect(r.diff).toMatchObject({ rowsMissingInTarget: 1, keysMismatched: 0 });
    expect(r.keys).toBeUndefined();
  });
  it('thừa một dòng ở đích / khoá trùng ⇒ FAIL', () => {
    const extra = compareKeyed(src, [...src, { k: 'TK03', n: '0', s: '0' }], { key: ['k'], values: ['n', 's'] });
    expect(extra.diff).toMatchObject({ rowsExtraInTarget: 1 });
    const dup = compareKeyed(src, [...src, src[0]], { key: ['k'], values: ['n', 's'] });
    expect(dup.status).toBe('FAIL');
    expect(dup.diff).toMatchObject({ duplicateKeys: 1 });
  });
  it('khoá NULL và khoá \'\' là HAI nhóm khác nhau', () => {
    const r = compareKeyed([{ k: null, n: '1' }], [{ k: '', n: '1' }], { key: ['k'], values: ['n'] });
    expect(r.status).toBe('FAIL');
    expect(r.diff).toMatchObject({ rowsMissingInTarget: 1, rowsExtraInTarget: 1 });
  });
});

describe('compareCrossRef — tham chiếu chéo trên đích', () => {
  it('đích = nguồn = kỳ vọng ⇒ PASS', () => {
    expect(compareCrossRef('0', 0n, 0).status).toBe('PASS');
  });
  it('đích lệch nguồn một dòng ⇒ FAIL chênh +1', () => {
    const r = compareCrossRef('1', 2, undefined);
    expect(r.status).toBe('FAIL');
    expect(r.diff).toEqual({ count: 1 });
  });
  it('đích = nguồn nhưng ≠ bất biến tài liệu (0) ⇒ FAIL', () => {
    const r = compareCrossRef('3', 3, 0);
    expect(r.status).toBe('FAIL');
    expect(r.diff).toEqual({ count: 0, vsExpected: 3 });
  });
});

// ───────────────────────────────────────────────────────────── (2) sổ cổng khai báo — không cổng nào mù
function fakeDb(fn: (sql: string) => Row[]): QueryDb {
  return { query: async (sql: string) => fn(sql) };
}
function ctxWith(source: QueryDb, target: QueryDb, services: GoldenServices | null = null): GateContext {
  return { source, target, services, now: new Date('2026-09-25T08:41:00Z'), uid: 1 };
}

describe('sổ cổng', () => {
  it('id duy nhất; có đủ nhóm nguồn / đích / số vàng / G-DOC', () => {
    const ids = ALL_GATES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const kinds = new Set(ALL_GATES.map((g) => g.kind));
    expect([...kinds].sort()).toEqual(['gdoc', 'golden', 'source', 'target']);
    for (const p of ['09b-7.', '09c-7.', '09a-7.0', '04b-10.0', '09b-8.1', '09b-8.2', '09b-8.3', '09b-8.4', '09c-8.1',
      '09c-8.2', '09c-8.3', '09c-8.4', '09a-7.1', '09a-7.2', '09a-7.3', '04b-10.1', '09d-a', '09d-b', '09d-c', '09d-d',
      '09d-e', '09d-f', '09d-g', '09d-h', '09d-i', 'G-DOC-1', 'G-DOC-2', 'G-DOC-3']) {
      expect(ids.some((i) => i.startsWith(p))).toBe(true);
    }
  });

  const declared = ALL_GATES.filter((g) => g.spec !== undefined);
  it('có cổng khai báo để kiểm', () => expect(declared.length).toBeGreaterThan(80));

  it.each(declared.map((g) => [g.id, g] as [string, Gate]))('%s: bằng ⇒ PASS, lệch một ô ⇒ FAIL', async (_id, g) => {
    const sp = g.spec!;
    if (sp.type === 'count') {
      const ok = await g.run(ctxWith(fakeDb(() => [{ c: String(sp.expected) }]), fakeDb(() => [])));
      expect(ok.status).toBe('PASS');
      const bad = await g.run(ctxWith(fakeDb(() => [{ c: String(sp.expected + 1) }]), fakeDb(() => [])));
      expect(bad.status).toBe('FAIL');
      expect(bad.diff).toEqual({ count: 1 });
      return;
    }
    if (sp.type === 'crossref') {
      const e = sp.expected ?? 0;
      const ok = await g.run(ctxWith(fakeDb(() => [{ c: String(e) }]), fakeDb(() => [{ c: BigInt(e) }])));
      expect(ok.status).toBe('PASS');
      const bad = await g.run(ctxWith(fakeDb(() => [{ c: String(e) }]), fakeDb(() => [{ c: BigInt(e + 1) }])));
      expect(bad.status).toBe('FAIL');
      expect(bad.diff).toMatchObject({ count: 1 });
      return;
    }
    // keyed / scalar: một dòng tự dựng có đúng các cột khai báo
    const row: Row = {};
    for (const k of sp.key) row[k] = 'K';
    sp.values.forEach((v, i) => (row[v] = String(i + 1)));
    const ok = await g.run(ctxWith(fakeDb(() => [{ ...row }]), fakeDb(() => [{ ...row }])));
    expect(ok.status).toBe('PASS');
    const col = sp.values[sp.values.length - 1];
    const bad = await g.run(
      ctxWith(fakeDb(() => [{ ...row }]), fakeDb(() => [{ ...row, [col]: String(Number(row[col]) + 1) }])),
    );
    expect(bad.status).toBe('FAIL');
    expect(bad.columns).toEqual([col]);
  });

  it('cổng SKIPPED luôn có lý do; cổng khai báo có câu nguồn/đích', () => {
    for (const g of ALL_GATES) {
      if (g.skipReason !== undefined) expect(g.skipReason.length).toBeGreaterThan(10);
      if (g.spec?.type === 'keyed' || g.spec?.type === 'scalar') {
        expect(g.spec.sourceSql).toMatch(/^\s*(\/\*[^*]*\*\/\s*)?SELECT/i);
        expect(g.spec.targetSql).toMatch(/^\s*(\/\*[^*]*\*\/\s*)?SELECT/i);
      }
    }
  });
});

// ───────────────────────────────────────────────────────────── (3) cổng tuỳ biến + số vàng
function byId(id: string): Gate {
  const g = ALL_GATES.find((x) => x.id === id);
  if (!g) throw new Error('không có cổng ' + id);
  return g;
}

describe('09b-8.1c getBalance từng ví (service trên đích) = số dư nguồn', () => {
  const src = fakeDb(() => [
    { code: 'TK01', balance: '100.00' },
    { code: 'TK02', balance: '-5.5' },
  ]);
  const svc = (bal: Record<string, string>) =>
    ({ treasury: { getBalance: async (c: string) => D(bal[c]) } }) as unknown as GoldenServices;
  it('bằng ⇒ PASS', async () => {
    const r = await byId('09b-8.1c').run(ctxWith(src, fakeDb(() => []), svc({ TK01: '100', TK02: '-5.50' })));
    expect(r.status).toBe('PASS');
  });
  it('một ví lệch 0,01 ⇒ FAIL, in mã ví (nhãn)', async () => {
    const r = await byId('09b-8.1c').run(ctxWith(src, fakeDb(() => []), svc({ TK01: '100', TK02: '-5.49' })));
    expect(r.status).toBe('FAIL');
    expect(r.keys).toEqual(['TK02']);
    expect(r.diff).toMatchObject({ keysMismatched: 1 });
  });
});

describe('09c-8.2 luật nội bộ (a).bank_tx = (b), (a).fx = (c) — mỗi phía', () => {
  const g = () => byId('09c-8.2-rules');
  const a = [
    { tk_code: 'TK01', ho: 'bank_tx', n: '2', s: '300' },
    { tk_code: 'TK01', ho: 'fx', n: '1', s: '-50' },
    { tk_code: 'TK01', ho: 'khac', n: '1', s: '-1' },
  ];
  const b = [{ tk: 'TK01', n: '2', s: '300' }];
  const c = [{ tk: 'TK01', s: '-50' }];
  const side = (aa: Row[], bb: Row[], cc: Row[]) =>
    fakeDb((sql) => (sql.includes('/*8.2a*/') ? aa : sql.includes('/*8.2b*/') ? bb : sql.includes('/*8.2c*/') ? cc : []));
  it('khớp cả hai phía ⇒ PASS', async () => {
    expect((await g().run(ctxWith(side(a, b, c), side(a, b, c)))).status).toBe('PASS');
  });
  it('đích (c) lệch một ví ⇒ FAIL, đếm ví lệch phía đích', async () => {
    const r = await g().run(ctxWith(side(a, b, c), side(a, b, [{ tk: 'TK01', s: '-49' }])));
    expect(r.status).toBe('FAIL');
    expect(r.diff).toMatchObject({ fxMismatchSource: 0, fxMismatchTarget: 1 });
  });
});

describe('§6 setval — last_value = GREATEST(PG MAX, MySQL MAX kể cả dòng loại, MySQL AI−1)+1, is_called=false', () => {
  // đích: MAX(id) PG = 10; nguồn: sàn f (MAX MySQL / AI−1)
  const tgt = (lastValue: string, called = false) =>
    fakeDb((sql) => {
      if (sql.includes('pg_get_serial_sequence')) return [{ seq: 'public.tbl_x_id_seq' }];
      if (sql.includes('last_value')) return [{ last_value: lastValue, is_called: called }];
      if (sql.includes('MAX(id)')) return [{ pgmax: '10' }];
      return [];
    });
  const src = (f: string) => fakeDb((sql) => (sql.includes('information_schema.TABLES') ? [{ f }] : []));

  it('sàn nguồn ≤ MAX PG ⇒ last_value = MAX PG + 1 ⇒ PASS; is_called=true ⇒ FAIL', async () => {
    expect((await byId('09x-6-setval').run(ctxWith(src('7'), tgt('11')))).status).toBe('PASS');
    const bad = await byId('09x-6-setval').run(ctxWith(src('7'), tgt('11', true)));
    expect(bad.status).toBe('FAIL');
    expect(bad.target).toMatchObject({ ok: 0 });
  });

  it('MySQL MAX/AI−1 cao hơn (dòng đỉnh bị loại) ⇒ bộ đếm theo CÔNG THỨC CŨ (PG MAX+1) phải FAIL', async () => {
    const old = await byId('09x-6-setval').run(ctxWith(src('368'), tgt('11')));
    expect(old.status).toBe('FAIL');
    expect(old.target).toMatchObject({ ok: 0 });
    expect((await byId('09x-6-setval').run(ctxWith(src('368'), tgt('369')))).status).toBe('PASS');
  });

  it('nguồn không trả sàn ⇒ FAIL (không mặc định 0)', async () => {
    expect((await byId('09x-6-setval').run(ctxWith(fakeDb(() => []), tgt('11')))).status).toBe('FAIL');
  });
});

describe('09d-b monthlyFlow — công thức prod trên nguồn vs service v2 trên đích', () => {
  const srcRows = [
    { ym: '2026-09', currency: 'VND', money_in: '1000', money_out: '400' },
    { ym: '2026-09', currency: 'CNY', money_in: '7', money_out: '9' }, // thiếu tỷ giá ⇒ bỏ như prod
    { ym: '2026-08', currency: null, money_in: '5', money_out: '0' },
  ];
  const src = fakeDb((sql) => (sql.includes('tbl_exchange_rates') ? [] : srcRows));
  const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const svc = (sepOut: string) =>
    ({
      report: {
        monthlyFlow: async () => ({
          thang: months.map((ym) => ({
            ym,
            in: ym === '2026-09' ? '1000' : ym === '2026-08' ? '5' : '0',
            out: ym === '2026-09' ? sepOut : '0',
          })),
        }),
      },
    }) as unknown as GoldenServices;
  it('bằng ⇒ PASS', async () => {
    expect((await byId('09d-b').run(ctxWith(src, fakeDb(() => []), svc('400')))).status).toBe('PASS');
  });
  it('tháng 9 "ra" lệch 1 đồng ⇒ FAIL', async () => {
    const r = await byId('09d-b').run(ctxWith(src, fakeDb(() => []), svc('401')));
    expect(r.status).toBe('FAIL');
    expect(r.columns).toEqual(['out']);
  });
});

describe('09d-i monthlyFlow ngày 31/10 — v2 phải ra 6 tháng khác nhau (Q-DOC-3)', () => {
  const svc = (yms: string[]) =>
    ({ report: { monthlyFlow: async () => ({ thang: yms.map((ym) => ({ ym, in: '0', out: '0' })) }) } }) as unknown as GoldenServices;
  it('6 tháng khác nhau ⇒ PASS; nhãn prod (lỗi P-FL2) chỉ 4 ⇒ ghi ở info', async () => {
    const r = await byId('09d-i').run(
      ctxWith(fakeDb(() => []), fakeDb(() => []), svc(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])),
    );
    expect(r.status).toBe('PASS');
    expect(r.info).toMatchObject({ prodDistinctMonths: 4 });
  });
  it('trùng nhãn ⇒ FAIL', async () => {
    const r = await byId('09d-i').run(
      ctxWith(fakeDb(() => []), fakeDb(() => []), svc(['2026-05', '2026-07', '2026-07', '2026-08', '2026-10', '2026-10'])),
    );
    expect(r.status).toBe('FAIL');
  });
});

// ───────────────────────────────────────────────────────────── (4) runner
function deps(opts: { db?: string; readOnly?: boolean; srcReadOnly?: boolean } = {}) {
  const calls: string[] = [];
  const d: GateDeps = {
    async openSource() {
      calls.push('openSource');
      return { query: async () => [{ c: '0' }], readOnly: async () => opts.srcReadOnly ?? true, close: async () => undefined };
    },
    async openTarget(url: string) {
      calls.push('openTarget:' + url.includes('_rehearsal'));
      return {
        query: async () => [{ c: 0n }],
        currentDatabase: async () => opts.db ?? 'tbs_rehearsal',
        readOnly: async () => opts.readOnly ?? true,
        services: () => null,
        close: async () => undefined,
      };
    },
  };
  return { d, calls };
}
const oneGate: Gate[] = [
  {
    id: 'T-1', doc: 't', title: 't', kind: 'source',
    run: async (c) => compareCount((await c.source.query('SELECT 1'))[0].c, 0),
  },
];

describe('runGates — chốt an toàn', () => {
  const base = { forbiddenUrls: [TEST_URL], outDir: OUT_DIR, repoRoot: REPO, writeReport: false, gates: oneGate };
  it('URL tbs_test ⇒ TỪ CHỐI, không mở kết nối nào', async () => {
    const { d, calls } = deps();
    await expect(runGates({ ...base, targetUrl: TEST_URL }, d)).rejects.toThrow(/target-guard/);
    expect(calls).toEqual([]);
  });
  it('URL không có hậu tố _rehearsal ⇒ TỪ CHỐI, không mở kết nối', async () => {
    const { d, calls } = deps();
    await expect(
      runGates({ ...base, targetUrl: 'postgresql://u:p@localhost:5433/tbs_prod?schema=public' }, d),
    ).rejects.toThrow(/target-guard/);
    expect(calls).toEqual([]);
  });
  it('URL MariaDB/lạ ⇒ TỪ CHỐI', async () => {
    const { d, calls } = deps();
    await expect(runGates({ ...base, targetUrl: 'mysql://root@127.0.0.1:3307/x_rehearsal' }, d)).rejects.toThrow();
    expect(calls).toEqual([]);
  });
  it('current_database() khác ⇒ TỪ CHỐI, không mở nguồn', async () => {
    const { d, calls } = deps({ db: 'tbs_test' });
    await expect(runGates({ ...base, targetUrl: REH_URL }, d)).rejects.toThrow(/current_database/);
    expect(calls).not.toContain('openSource');
  });
  it('đích KHÔNG read-only ⇒ TỪ CHỐI; nguồn không read-only ⇒ TỪ CHỐI', async () => {
    const a = deps({ readOnly: false });
    await expect(runGates({ ...base, targetUrl: REH_URL }, a.d)).rejects.toThrow(/read-only/);
    expect(a.calls).not.toContain('openSource');
    const b = deps({ srcReadOnly: false });
    await expect(runGates({ ...base, targetUrl: REH_URL }, b.d)).rejects.toThrow(/read-only/);
  });
  it('thư mục báo cáo trong repo ⇒ TỪ CHỐI trước khi mở kết nối', async () => {
    const { d, calls } = deps();
    await expect(runGates({ ...base, targetUrl: REH_URL, outDir: path.join(REPO, 'x') }, d)).rejects.toThrow(/ngoài repo/);
    expect(calls).toEqual([]);
  });
  it('rehearsal hợp lệ ⇒ chạy; mã thoát 0 PASS · 4 FAIL · 1 ERROR', async () => {
    const { d } = deps();
    const s = await runGates({ ...base, targetUrl: REH_URL }, d);
    expect(s.counts).toMatchObject({ PASS: 1, FAIL: 0 });
    expect(exitCodeForGates(s)).toBe(0);
    const failing: Gate[] = [{ ...oneGate[0], run: async () => compareCount('2', 0) }];
    expect(exitCodeForGates(await runGates({ ...base, targetUrl: REH_URL, gates: failing }, d))).toBe(4);
    const erroring: Gate[] = [{ ...oneGate[0], run: async () => { throw new Error('SELECT lộ dữ liệu 0123456789'); } }];
    const se = await runGates({ ...base, targetUrl: REH_URL, gates: erroring }, d);
    expect(exitCodeForGates(se)).toBe(1);
    expect(se.results[0].status).toBe('ERROR');
    expect(JSON.stringify(se)).not.toContain('0123456789'); // chỉ tên lớp lỗi
  });
});

// ───────────────────────────────────────────────────────────── (5) báo cáo
describe('báo cáo — chỉ số đếm/tổng, ngoài repo', () => {
  const summary = (): GateRunSummary => ({
    startedAt: '2026-09-25T10:00:00.000Z',
    finishedAt: '2026-09-25T10:00:01.000Z',
    targetDatabase: 'tbs_rehearsal',
    counts: { PASS: 1, FAIL: 1, SKIPPED: 1, ERROR: 0 },
    results: [
      { id: 'A', doc: 'd', title: 't', kind: 'source' as const, status: 'PASS' as const, source: { count: 0, expected: 0 }, diff: { count: 0 }, durationMs: 1 },
      { id: 'B', doc: 'd', title: 't', kind: 'target' as const, status: 'FAIL' as const, source: { rows: 2, 'Σs': '10.5' }, target: { rows: 2, 'Σs': '10.4' }, diff: { keysMismatched: 1 }, columns: ['s'], keys: ['TK02'], durationMs: 1 },
      { id: 'C', doc: 'd', title: 't', kind: 'target' as const, status: 'SKIPPED' as const, reason: 'bảng #04 chưa nạp ở L0', durationMs: 0 },
    ],
    reportFiles: [],
  });
  it('markdown có bảng + tóm tắt số FAIL', () => {
    const md = renderGateMarkdown(summary());
    expect(md).toMatch(/PASS 1 · FAIL 1 · SKIPPED 1/);
    expect(md).toContain('| B |');
    expect(md).toContain('bảng #04 chưa nạp ở L0');
  });
  it('giá trị CHỮ trong source/target/diff ⇒ ném lỗi (không để lọt dòng dữ liệu / STK / nội dung CK)', () => {
    const s = summary();
    (s.results[1].target as Record<string, unknown>).note = 'CK cho Nguyen Van A 0123456789';
    expect(() => assertCountsOnly(s)).toThrow(/số đếm/);
    const s2 = summary();
    s2.results[1].keys = ['chuyen khoan tien hang 12345'];
    expect(() => assertCountsOnly(s2)).toThrow(/nhãn/);
  });
  it('ghi JSON + MD ra thư mục ngoài repo; nội dung chỉ số', () => {
    const files = writeGateReport(summary(), OUT_DIR, REPO);
    expect(files).toHaveLength(2);
    for (const f of files) {
      const rel = path.relative(REPO, f);
      expect(rel.startsWith('..') || path.isAbsolute(rel)).toBe(true);
      expect(fs.readFileSync(f, 'utf8')).not.toMatch(/Nguyen|0123456789/);
    }
    const j = JSON.parse(fs.readFileSync(files.find((f) => f.endsWith('.json'))!, 'utf8'));
    expect(j.counts.FAIL).toBe(1);
  });
  it('thư mục báo cáo trong repo ⇒ từ chối', () => {
    expect(() => writeGateReport(summary(), path.join(REPO, 'tmp-out'), REPO)).toThrow(/ngoài repo/);
  });
});
