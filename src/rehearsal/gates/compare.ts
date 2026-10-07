/**
 * L0 Task 3 — hàm so sánh THUẦN của cổng nghiệm thu. Không I/O.
 *
 * Luật so: giá trị hai phía được chuẩn hoá (`normVal`) rồi so CHÍNH XÁC — số (Decimal/chuỗi thập
 * phân/bigint/number) so theo giá trị thập phân (không float, không làm tròn: "10.50" = 10.5,
 * "10.49" ≠ 10.5); NULL ≠ '' ≠ 0; chuỗi khác so byte-nguyên. Đầu ra chỉ có SỐ ĐẾM / TỔNG.
 */
import { Prisma } from '@prisma/client';
import { Agg, GateEval, Row } from './types';

const Decimal = Prisma.Decimal;
type Dec = Prisma.Decimal;

const NUM_RE = /^-?\d+(\.\d+)?$/;

/** Chuẩn hoá một ô để so: số ⇒ chuỗi thập phân chuẩn; boolean ⇒ '1'/'0'; NULL/undefined ⇒ null. */
export function normVal(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number') return Number.isFinite(v) ? new Decimal(v).toFixed() : String(v);
  if (Decimal.isDecimal(v)) return (v as Dec).toFixed();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v !== null && typeof (v as { toFixed?: unknown }).toFixed === 'function') {
    return new Decimal(String((v as { toFixed: () => string }).toFixed())).toFixed();
  }
  const s = String(v);
  return NUM_RE.test(s) ? new Decimal(s).toFixed() : s;
}

export function isNumStr(s: string | null): s is string {
  return s !== null && NUM_RE.test(s);
}

function toCount(v: unknown): number {
  const s = normVal(v);
  if (!isNumStr(s)) return NaN;
  return Number(s);
}

/** Lấy giá trị ô ĐẦU TIÊN của dòng ĐẦU TIÊN (câu COUNT(*)). */
export function firstCell(rows: Row[]): unknown {
  if (rows.length === 0) return null;
  return Object.values(rows[0])[0];
}

/** Cổng nguồn §7: đếm phải = kỳ vọng (thường 0). */
export function compareCount(actual: unknown, expected: number): GateEval {
  const a = toCount(actual);
  const ok = a === expected;
  return {
    status: ok ? 'PASS' : 'FAIL',
    source: { count: Number.isNaN(a) ? null : a, expected },
    diff: { count: Number.isNaN(a) ? null : a - expected },
  };
}

/**
 * Tham chiếu chéo trên ĐÍCH: đếm đích phải = đếm cùng câu trên NGUỒN (ETL không làm hỏng/không tạo
 * tham chiếu), và nếu tài liệu ghi bất biến (vd `-- 0`) thì đích phải = bất biến đó.
 */
export function compareCrossRef(sourceCount: unknown, targetCount: unknown, expected?: number): GateEval {
  const s = sourceCount === undefined ? NaN : toCount(sourceCount);
  const t = toCount(targetCount);
  const hasSrc = sourceCount !== undefined;
  const okSrc = !hasSrc || s === t;
  const okExp = expected === undefined || t === expected;
  const base = hasSrc ? s : expected ?? NaN; // không có câu nguồn ⇒ chênh so với bất biến
  const diff: Agg = { count: !Number.isNaN(base) && !Number.isNaN(t) ? t - base : null };
  if (hasSrc && expected !== undefined && !okExp) diff.vsExpected = Number.isNaN(t) ? null : t - expected;
  const source: Agg = {};
  if (hasSrc) source.count = Number.isNaN(s) ? null : s;
  if (expected !== undefined) source.expected = expected;
  return {
    status: okSrc && okExp && !Number.isNaN(t) ? 'PASS' : 'FAIL',
    source,
    target: { count: Number.isNaN(t) ? null : t },
    diff,
  };
}

function numDiff(a: string | null, b: string | null): string | null {
  if (!isNumStr(a) || !isNumStr(b)) return null;
  return new Decimal(b).minus(a).toFixed();
}

/**
 * Một dòng tổng (sentinel / tổng toàn bảng): so từng cột. Nguồn/đích trong báo cáo chỉ gồm cột SỐ;
 * cột chữ lệch ⇒ diff 'differs'. `cols` mặc định = hợp các cột hai phía.
 */
export function compareScalars(src: Row, tgt: Row, cols?: string[]): GateEval {
  const names = cols ?? [...new Set([...Object.keys(src), ...Object.keys(tgt)])];
  const source: Agg = {};
  const target: Agg = {};
  const diff: Agg = {};
  const columns: string[] = [];
  for (const c of names) {
    const a = normVal(src[c]);
    const b = normVal(tgt[c]);
    if (a === null || isNumStr(a)) source[c] = a;
    if (b === null || isNumStr(b)) target[c] = b;
    if (a !== b) {
      columns.push(c);
      diff[c] = numDiff(a, b) ?? 'differs';
    }
  }
  return { status: columns.length === 0 ? 'PASS' : 'FAIL', source, target, diff, ...(columns.length ? { columns } : {}) };
}

export interface KeyedOpts {
  key: string[];
  values: string[];
  /** khoá là nhãn phân loại (mã ví, module, trạng thái…) ⇒ được in khoá lệch (tối đa 20). */
  keysAreLabels?: boolean;
}

const MAX_KEYS = 20;

function keyOf(r: Row, key: string[]): string {
  return key.map((k) => {
    const v = normVal(r[k]);
    return v === null ? '<NULL>' : JSON.stringify(v);
  }).join('|');
}

function labelOf(r: Row, key: string[]): string {
  return key.map((k) => {
    const v = normVal(r[k]);
    return v === null ? '<NULL>' : v === '' ? "''" : v;
  }).join('|');
}

function sums(rows: Row[], values: string[]): Record<string, Dec | null> {
  const out: Record<string, Dec | null> = {};
  for (const v of values) {
    let acc: Dec | null = new Decimal(0);
    for (const r of rows) {
      const x = normVal(r[v]);
      if (x === null) continue;
      if (!isNumStr(x)) {
        acc = null;
        break;
      }
      acc = acc.plus(x);
    }
    out[v] = acc;
  }
  return out;
}

/**
 * Theo nhóm: hai tập dòng khoá theo `key`, so TỪNG Ô của `values`. Báo cáo: số dòng + Σ mỗi cột số ở
 * hai phía; chênh = số khoá thiếu/thừa/lệch/trùng + chênh Σ; tên cột lệch.
 */
export function compareKeyed(src: Row[], tgt: Row[], opts: KeyedOpts): GateEval {
  const idx = (rows: Row[]) => {
    const m = new Map<string, Row>();
    let dup = 0;
    for (const r of rows) {
      const k = keyOf(r, opts.key);
      if (m.has(k)) dup++;
      else m.set(k, r);
    }
    return { m, dup };
  };
  const S = idx(src);
  const T = idx(tgt);
  let missing = 0;
  let extra = 0;
  let mismatched = 0;
  const cols = new Set<string>();
  const bad: string[] = [];
  for (const [k, r] of S.m) {
    const t = T.m.get(k);
    if (!t) {
      missing++;
      bad.push(labelOf(r, opts.key));
      continue;
    }
    let off = false;
    for (const v of opts.values) {
      if (normVal(r[v]) !== normVal(t[v])) {
        off = true;
        cols.add(v);
      }
    }
    if (off) {
      mismatched++;
      bad.push(labelOf(r, opts.key));
    }
  }
  for (const [k, r] of T.m) {
    if (!S.m.has(k)) {
      extra++;
      bad.push(labelOf(r, opts.key));
    }
  }
  const ss = sums(src, opts.values);
  const ts = sums(tgt, opts.values);
  const source: Agg = { rows: src.length };
  const target: Agg = { rows: tgt.length };
  const diff: Agg = {
    rowsMissingInTarget: missing,
    rowsExtraInTarget: extra,
    keysMismatched: mismatched,
    duplicateKeys: S.dup + T.dup,
  };
  for (const v of opts.values) {
    const a = ss[v];
    const b = ts[v];
    if (a !== null) source['Σ' + v] = a.toFixed();
    if (b !== null) target['Σ' + v] = b.toFixed();
    if (a !== null && b !== null && !a.eq(b)) diff['Σ' + v] = b.minus(a).toFixed();
  }
  const pass = missing === 0 && extra === 0 && mismatched === 0 && S.dup + T.dup === 0;
  const res: GateEval = { status: pass ? 'PASS' : 'FAIL', source, target, diff };
  if (cols.size) res.columns = opts.values.filter((v) => cols.has(v));
  if (!pass && opts.keysAreLabels) res.keys = bad.slice(0, MAX_KEYS);
  return res;
}
