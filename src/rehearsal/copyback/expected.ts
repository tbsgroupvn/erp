/**
 * Ảnh KỲ VỌNG ở MỨC PG của một dòng MySQL: `ảnhPG(xuôi(dòng MySQL))` — đúng văn bản mà
 * `SELECT ::text` của PG trả cho dòng đó nếu v2 KHÔNG đụng. Máy chép so dòng PG thật với
 * ảnh này ở MỨC PG (độ chính xác của PG, vd rate 6 số lẻ) ⇒ v2 sửa 3500.50 → 3500.501 vẫn
 * bị bắt dù MySQL (2 số lẻ) không biểu diễn được phần sửa. Biến đổi CÓ CHỦ ĐÍCH của chiều
 * xuôi (G-DOC-3, A3, ''→NULL…) nằm sẵn trong ảnh nên không bị báo nhầm.
 *
 * Ngữ cảnh xuôi: runner dựng ngữ cảnh THẬT như ETL (id phiếu duyệt/bước duyệt ở MySQL,
 * loaded/skipped theo từng bảng trackIds) để một dòng MySQL mà ETL đã LOẠI (A1/A2/A4/A5,
 * rác ZZ) cho kết quả `skip` — phân biệt được "ETL loại" với "v2 xoá".
 */
import { Prisma } from '@prisma/client';
import { EtlContext } from '../etl/spec';
import { PgRow, jsonEquivalent } from './convert';
import { PgCol, mysqlName, pgImage } from './pg-image';
import { CopybackSpec } from './spec';

const ALL = { has: () => true } as unknown as Set<number>;
const NONE = { has: () => false } as unknown as Set<number>;

/** Ngữ cảnh xuôi "cho qua" (mọi tham chiếu cha coi như có) — dùng cho test thuần. */
export function permissiveCtx(): EtlContext {
  return {
    nowUnix: Number.MAX_SAFE_INTEGER,
    approvalStepIds: ALL,
    approvalRequestIds: ALL,
    loaded: new Proxy({}, { get: () => ALL }) as Record<string, Set<number>>,
    skipped: new Proxy({}, { get: () => NONE }) as Record<string, Set<number>>,
  };
}

/** Giá trị mysql2 (number/chuỗi/NULL) → chuỗi như cột MySQL hiển thị. */
export function myText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'bigint') return v.toString();
  if (typeof v === 'string') return v;
  throw new Error(`giá trị MySQL kiểu lạ: ${typeof v}`);
}

export type ExpectedImage =
  | { kind: 'row'; image: PgRow }
  | { kind: 'skip'; reason: string }
  | { kind: 'error'; reason: string };

export function expectedPgImage(
  spec: CopybackSpec,
  mysqlRow: Record<string, unknown>,
  ctx: EtlContext,
): ExpectedImage {
  if (spec.forward === null) {
    // không có chiều xuôi (FxAdjustment): cùng tên/kiểu/scale hai phía ⇒ ảnh = văn bản MySQL.
    const image: PgRow = {};
    try {
      for (const x of spec.pgColumns) image[x.col] = myText(mysqlRow[mysqlName(x)]);
    } catch (e) {
      return { kind: 'error', reason: e instanceof Error ? e.name : 'unknown' };
    }
    return { kind: 'row', image };
  }
  try {
    const f = spec.forward.map(mysqlRow, ctx);
    if (f.kind === 'skip') return { kind: 'skip', reason: f.reason };
    return { kind: 'row', image: pgImage(f.data as Record<string, unknown>, spec.pgColumns) };
  } catch (e) {
    return { kind: 'error', reason: e instanceof Error ? e.name : 'unknown' };
  }
}

function sameValue(x: PgCol, a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (x.type === 'dec') {
    try {
      return new Prisma.Decimal(a).eq(new Prisma.Decimal(b));
    } catch {
      return false;
    }
  }
  if (x.type === 'json') {
    try {
      return jsonEquivalent(a, b);
    } catch {
      return false; // JSON hỏng một phía ⇒ khác (báo), không nổ
    }
  }
  return false;
}

/** TÊN CỘT MySQL khác nhau giữa ảnh kỳ vọng và dòng PG thật (so ở MỨC PG). Không trả giá trị. */
export function diffPgColumns(spec: CopybackSpec, expected: PgRow, actual: PgRow): string[] {
  const out: string[] = [];
  for (const x of spec.pgColumns) {
    if (!sameValue(x, expected[x.col] ?? null, actual[x.col] ?? null)) out.push(mysqlName(x));
  }
  return out;
}
