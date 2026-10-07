/**
 * L13 Task 2 — phép KIỂM NGƯỢC CHIỀU của tổng duyệt khứ hồi. Hàm THUẦN (không I/O) — runner đọc
 * MariaDB/PG rồi đưa dữ liệu vào đây; test dùng dữ liệu tự dựng.
 *
 *  R-so-du      số dư TỪNG quỹ theo CÔNG THỨC PROD (`CLS_TREASURY::getBalances`, cls.treasury.php:163-171:
 *               opening_balance + Σmoney status=1 theo tk_code) trên MariaDB == `TreasuryService.getBalances()`
 *               trên PG — so Decimal.
 *  R-dong-moi   mỗi dòng MySQL MỚI (id không có ở mốc) == ảnh NGƯỢC của dòng PG cùng id, TỪNG cột (JSON so
 *               ngữ nghĩa); và xuôi(dòng MySQL) khác dòng PG CHỈ ở phần mất có chủ đích (Task 1: rate 6→2,
 *               created_at cắt giây lẻ). Dòng v2 không về MySQL / MySQL có dòng lạ ⇒ FAIL.
 *  R-dong-cu    băm SHA-256 mọi cột của dòng id ≤ mốc TRƯỚC và SAU ⇒ phải bằng.
 *  R-ai         AUTO_INCREMENT > MAX(id).
 *  R-co         cờ KỲ VỌNG (sửa/xoá dòng cũ, ép kiểu) phải được BÁO đúng id + cột; cờ thừa ⇒ FAIL.
 *               Công cụ im lặng KHÔNG được tính là PASS.
 *  R-lan-2      chép lần 2 (--etl-report): 0 dòng mới/lỗ/ép kiểu, chỉ còn đúng cờ sửa/xoá dòng cũ.
 */
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { Row } from '../etl/convert';
import { PgRow, jsonEquivalent } from '../copyback/convert';
import { diffPgColumns, expectedPgImage, myText, permissiveCtx } from '../copyback/expected';
import type { CopybackSummary } from '../copyback/runner';
import { CopybackSpec } from '../copyback/spec';
import { CheckResult, ExpectedFlags } from './types';

type Dec = Prisma.Decimal;
const Decimal = Prisma.Decimal;

/**
 * Phần mất CÓ CHỦ ĐÍCH khi PG → MySQL (Task 1 §"Phần mất") ở MỨC CỘT — cột MySQL mà xuôi(MySQL) được
 * phép khác dòng PG. JSON của tbl_return_state đã so ngữ nghĩa nên không cần liệt kê.
 */
export const ALLOWED_LOSS: Readonly<Record<string, readonly string[]>> = {
  tbl_account_histories: ['rate'], // decimal(18,6) → (12,2) làm tròn nửa-xa-0
  tbl_payment_source: ['created_at'], // timestamp(3) → datetime cắt giây lẻ
};

function result(id: string, title: string, ok: boolean, details: Record<string, unknown>): CheckResult {
  return { id, title, status: ok ? 'PASS' : 'FAIL', details };
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

// ───────────────────────────────────────────────────────── số dư quỹ
/** Công thức prod `getBalances()`: khởi tạo từ tbl_accounts (thứ tự id), CỘNG Σ(status=1) theo tk_code. */
export function prodBalances(accounts: Row[], sums: Row[]): Map<string, Dec> {
  const m = new Map<string, Dec>();
  for (const a of accounts) m.set(s(a.code), new Decimal(s(a.opening_balance) || '0'));
  for (const r of sums) {
    const k = s(r.tk_code);
    m.set(k, (m.get(k) ?? new Decimal(0)).plus(new Decimal(s(r.s) || '0')));
  }
  return m;
}

export function checkBalances(prod: Map<string, Dec | string>, v2: Map<string, Dec | string>): CheckResult {
  const keys = [...new Set([...prod.keys(), ...v2.keys()])].sort();
  const mismatched: string[] = [];
  for (const k of keys) {
    const a = prod.get(k);
    const b = v2.get(k);
    if (a === undefined || b === undefined || !new Decimal(a).eq(new Decimal(b))) mismatched.push(k);
  }
  return result(
    'R-so-du',
    'số dư từng quỹ: công thức PROD getBalances trên MariaDB == TreasuryService.getBalances() trên PG',
    mismatched.length === 0 && keys.length > 0,
    { compared: keys.length, mismatched },
  );
}

// ───────────────────────────────────────────────────────── dòng mới
export interface NewRowsInput {
  spec: CopybackSpec;
  /** id MySQL TRƯỚC khi chép ngược (mốc). */
  baselineIds: Set<string>;
  /** dòng MySQL SAU khi chép (SELECT * — mysql2 decimal/bigint dạng chuỗi). */
  mysqlAfter: Row[];
  /** dòng PG (`::text`). */
  pg: PgRow[];
}

interface TableRef {
  table: string;
  id: string;
}

export function checkNewRows(input: NewRowsInput[]): CheckResult {
  const mismatches: { table: string; id: string; columns: string[] }[] = [];
  const missingInMysql: TableRef[] = [];
  const extraInMysql: TableRef[] = [];
  const allowedLoss: Record<string, number> = {};
  const perTable: Record<string, number> = {};
  let checkedRows = 0;
  for (const x of input) {
    const t = x.spec.table;
    const json = new Set(x.spec.jsonColumns ?? []);
    const allowed = new Set(ALLOWED_LOSS[t] ?? []);
    const myNew = new Map<string, Row>();
    for (const r of x.mysqlAfter) if (!x.baselineIds.has(String(r.id))) myNew.set(String(r.id), r);
    const pgNew = x.pg.filter((r) => !x.baselineIds.has(String(r.id)));
    const seen = new Set<string>();
    for (const pr of pgNew) {
      const id = String(pr.id);
      seen.add(id);
      const my = myNew.get(id);
      if (!my) {
        missingInMysql.push({ table: t, id });
        continue;
      }
      checkedRows++;
      perTable[t] = (perTable[t] ?? 0) + 1;
      const cols = new Set<string>();
      // (1) MySQL == ngược(PG) từng cột đã ghi.
      const rev = x.spec.reverse(pr).row;
      for (const [c, want] of Object.entries(rev)) {
        const got = myText(my[c]);
        const same = json.has(c) ? jsonEquivalent(want, got) : want === got;
        if (!same) cols.add(c);
      }
      // (2) xuôi(MySQL) == PG, trừ phần mất có chủ đích.
      const exp = expectedPgImage(x.spec, my, permissiveCtx());
      if (exp.kind !== 'row') cols.add(`(xuôi: ${exp.kind})`);
      else {
        for (const c of diffPgColumns(x.spec, exp.image, pr)) {
          if (allowed.has(c)) allowedLoss[`${t}.${c}`] = (allowedLoss[`${t}.${c}`] ?? 0) + 1;
          else cols.add(c);
        }
      }
      if (cols.size > 0) mismatches.push({ table: t, id, columns: [...cols].sort() });
    }
    for (const id of myNew.keys()) if (!seen.has(id)) extraInMysql.push({ table: t, id });
  }
  const ok = checkedRows > 0 && mismatches.length === 0 && missingInMysql.length === 0 && extraInMysql.length === 0;
  return result('R-dong-moi', 'mỗi dòng MySQL mới == ảnh ngược của dòng PG từng cột (trừ phần mất có chủ đích)', ok, {
    checkedRows, perTable, allowedLoss, mismatches, missingInMysql, extraInMysql,
  });
}

// ───────────────────────────────────────────────────────── dòng cũ không đổi
export interface TableHash {
  n: number;
  sha: string;
}

function enc(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return { b: v.toString('hex') };
  if (v instanceof Date) return { d: v.toISOString() };
  return `s:${String(v)}`;
}

/** SHA-256 của MỌI cột (khoá sắp xếp) các dòng id ≤ `maxId`, theo thứ tự id. */
export function tableHash(rows: Row[], maxId: bigint | null): TableHash {
  const sel = maxId === null ? [] : rows.filter((r) => BigInt(String(r.id)) <= maxId);
  sel.sort((a, b) => {
    const x = BigInt(String(a.id));
    const y = BigInt(String(b.id));
    return x < y ? -1 : x > y ? 1 : 0;
  });
  const h = createHash('sha256');
  for (const r of sel) {
    h.update(JSON.stringify(Object.keys(r).sort().map((k) => [k, enc(r[k])])));
    h.update('\n');
  }
  return { n: sel.length, sha: h.digest('hex') };
}

export function checkChecksums(
  id: string,
  title: string,
  before: Record<string, TableHash>,
  after: Record<string, TableHash>,
  /** số dòng ETL đã nạp từng bảng: > 0 mà băm dòng cũ đếm 0 ⇒ mốc rỗng/đọc hụt ⇒ FAIL (không PASS vì rỗng). */
  etlLoaded: Record<string, number> = {},
): CheckResult {
  const tables = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changedTables = tables.filter((t) => before[t]?.sha !== after[t]?.sha || before[t]?.n !== after[t]?.n);
  const perTable: Record<string, number> = {};
  for (const t of tables) perTable[t] = before[t]?.n ?? 0;
  const emptyTables = Object.entries(etlLoaded)
    .filter(([t, n]) => n > 0 && (before[t]?.n ?? 0) === 0)
    .map(([t]) => t)
    .sort();
  const rows = tables.reduce((a, t) => a + (before[t]?.n ?? 0), 0);
  const ok = changedTables.length === 0 && emptyTables.length === 0 && tables.length > 0;
  return result(id, title, ok, { tables: tables.length, rows, perTable, changedTables, emptyTables });
}

// ───────────────────────────────────────────────────────── AUTO_INCREMENT
export function checkAutoIncrement(id: string, rows: { table: string; max: string | null; ai: string | null }[]): CheckResult {
  const bad = rows
    .filter((r) => r.ai === null || (r.max !== null && BigInt(r.ai) <= BigInt(r.max)))
    .map((r) => r.table);
  return result(id, 'AUTO_INCREMENT > MAX(id) mọi bảng', bad.length === 0 && rows.length > 0, { tables: rows.length, bad });
}

// ───────────────────────────────────────────────────────── cờ kỳ vọng
interface FlagCompare {
  missing: string[];
  unexpected: string[];
  columnsMismatch: string[];
}

function compareFlags(expected: ExpectedFlags, s: CopybackSummary): FlagCompare {
  const want = new Map<string, string[] | null>();
  for (const m of expected.modified) want.set(`modified ${m.table}#${m.id}`, [...m.columns].sort());
  for (const d of expected.deleted) want.set(`deleted ${d.table}#${d.id}`, null);
  for (const c of expected.coerced) want.set(`coerced ${c.table}#${c.id}`, null);
  const got = new Map<string, string[] | null>();
  for (const t of s.tables) {
    for (const d of t.modifiedDetails) got.set(`modified ${t.table}#${d.id}`, [...d.columns].sort());
    for (const id of t.deletedIds) got.set(`deleted ${t.table}#${id}`, null);
    for (const id of t.coercedIds) got.set(`coerced ${t.table}#${id}`, null);
    for (const id of t.gapIds) got.set(`gap ${t.table}#${id}`, null);
  }
  for (const u of s.uniqueConflicts) got.set(`unique ${u.table}#${u.id}`, null);
  const missing = [...want.keys()].filter((k) => !got.has(k));
  const unexpected = [...got.keys()].filter((k) => !want.has(k));
  const columnsMismatch: string[] = [];
  for (const [k, cols] of want) {
    const g = got.get(k);
    if (cols !== null && g !== undefined && g !== null && cols.join(',') !== g.join(',')) {
      columnsMismatch.push(`${k}: kỳ vọng [${cols.join(', ')}] — báo [${g.join(', ')}]`);
    }
  }
  return { missing, unexpected, columnsMismatch };
}

const nExpected = (e: ExpectedFlags) => e.modified.length + e.deleted.length + e.coerced.length;

export function checkFlags(id: string, expected: ExpectedFlags, s: CopybackSummary): CheckResult {
  const c = compareFlags(expected, s);
  const wantOutcome = nExpected(expected) > 0 ? 'flagged' : 'clean';
  const ok = s.outcome === wantOutcome && c.missing.length === 0 && c.unexpected.length === 0 && c.columnsMismatch.length === 0;
  return result(id, 'chép ngược lần 1: MỌI cờ kỳ vọng được BÁO đúng id + tên cột, không cờ thừa (exit 5 có chủ đích)', ok, {
    outcome: s.outcome, wantOutcome, expected: nExpected(expected), ...c,
  });
}

export function checkSecondRun(id: string, expected: ExpectedFlags, s: CopybackSummary): CheckResult {
  const still: ExpectedFlags = { modified: expected.modified, deleted: expected.deleted, coerced: [] };
  const c = compareFlags(still, s);
  const sum = (f: (t: CopybackSummary['tables'][number]) => number) => s.tables.reduce((a, t) => a + f(t), 0);
  const counts = {
    newRows: sum((t) => t.newRows), gapRows: sum((t) => t.gapRows), copied: sum((t) => t.copied),
    coercedRows: sum((t) => t.coercedRows), uniqueConflicts: s.uniqueConflicts.length,
  };
  const wantOutcome = nExpected(still) > 0 ? 'flagged' : 'clean';
  const ok =
    Object.values(counts).every((n) => n === 0) && s.outcome === wantOutcome && s.v2IdStartGiven &&
    c.missing.length === 0 && c.unexpected.length === 0 && c.columnsMismatch.length === 0;
  return result(id, 'chép ngược lần 2 (--etl-report): 0 dòng mới, không cờ mới (chỉ còn đúng cờ sửa/xoá dòng cũ)', ok, {
    outcome: s.outcome, wantOutcome, ...counts, ...c,
  });
}

/** 0 mọi kiểm PASS · 4 có FAIL (1 = lỗi, do CLI trả khi runner ném). */
export function roundtripExitCode(checks: CheckResult[]): number {
  return checks.some((c) => c.status !== 'PASS') ? 4 : 0;
}
