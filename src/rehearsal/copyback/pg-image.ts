/**
 * "Ảnh PG" của một dòng mà ETL xuôi (L0) sinh ra: chuyển đầu ra mapper xuôi
 * (Prisma input: Decimal/bigint/Date/boolean) thành đúng dạng văn bản mà
 * `SELECT "col"::text` của Postgres sẽ trả cho dòng đó.
 *
 * Dùng cho (1) test khứ hồi thuần `ngược(ảnhPG(xuôi(dòng_prod))) == dòng_prod`
 * và (2) máy chép so dòng ≤ mốc: dòng PG thật so với `ngược(ảnhPG(xuôi(dòng MySQL)))`
 * — nhờ vậy các biến đổi CÓ CHỦ ĐÍCH của chiều xuôi (G-DOC-3 TRIM/UPPER, A3,
 * ''→NULL…) không bị báo nhầm là "v2 đã sửa dòng lịch sử".
 *
 * Giới hạn: jsonb của PG chuẩn hoá văn bản JSON (khoảng trắng, thứ tự khoá,
 * escape \uXXXX) — ảnh ở đây giữ văn bản gốc; phía so sánh dùng `jsonEquivalent`.
 */
import { Prisma } from '@prisma/client';
import { EtlSafeError } from '../etl/convert';
import { PgRow } from './convert';

export type PgType = 'int' | 'bigint' | 'dec' | 'str' | 'bool' | 'json' | 'ts';

export interface PgCol {
  /** khoá trong đầu ra mapper xuôi (camelCase Prisma). */
  key: string;
  /** tên cột PG (@map). */
  col: string;
  type: PgType;
  /** scale cột numeric PG (Decimal(p,s)) — numeric::text in đủ s số lẻ. */
  scale?: number;
  /** tên cột MySQL khi KHÁC tên cột PG (vd tran_id → tranId). */
  my?: string;
}

export function c(key: string, col: string, type: PgType, scale?: number): PgCol {
  return { key, col, type, scale };
}

/** cột có tên MySQL khác tên PG. */
export function cm(key: string, col: string, type: PgType, my: string): PgCol {
  return { key, col, type, my };
}

export function mysqlName(x: PgCol): string {
  return x.my ?? x.col;
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

/** Date (giờ đồng hồ lưu như UTC — xem etl/convert optDateTime) → timestamp::text. */
function tsText(d: Date): string {
  const base =
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  const ms = d.getUTCMilliseconds();
  return ms === 0 ? base : `${base}.${pad(ms, 3).replace(/0+$/, '')}`;
}

export function pgImage(data: Record<string, unknown>, cols: readonly PgCol[]): PgRow {
  const out: PgRow = {};
  for (const k of Object.keys(data)) {
    if (!cols.some((x) => x.key === k)) throw new EtlSafeError(`ảnh PG: khoá xuôi "${k}" không có trong danh sách cột PG`);
  }
  for (const x of cols) {
    if (!(x.key in data)) throw new EtlSafeError(`ảnh PG: thiếu khoá xuôi "${x.key}"`);
    const v = data[x.key];
    if (v === null) {
      out[x.col] = null;
      continue;
    }
    switch (x.type) {
      case 'dec':
        if (!(v instanceof Prisma.Decimal) || x.scale === undefined) throw new EtlSafeError(`ảnh PG: ${x.key} cần Decimal + scale`);
        out[x.col] = v.toFixed(x.scale);
        break;
      case 'bigint':
      case 'int':
        if (typeof v !== 'bigint' && typeof v !== 'number') throw new EtlSafeError(`ảnh PG: ${x.key} cần số nguyên`);
        out[x.col] = v.toString();
        break;
      case 'bool':
        if (typeof v !== 'boolean') throw new EtlSafeError(`ảnh PG: ${x.key} cần boolean`);
        out[x.col] = v ? 'true' : 'false';
        break;
      case 'ts':
        if (!(v instanceof Date)) throw new EtlSafeError(`ảnh PG: ${x.key} cần Date`);
        out[x.col] = tsText(v);
        break;
      default:
        if (typeof v !== 'string') throw new EtlSafeError(`ảnh PG: ${x.key} cần chuỗi`);
        out[x.col] = v;
    }
  }
  return out;
}

/** SELECT ... ::text theo danh sách cột PG (định danh đã kiểm, luôn đặt trong ""). */
export function pgSelectSql(table: string, cols: readonly PgCol[], where = ''): string {
  const ident = (s: string) => {
    if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new EtlSafeError(`định danh lạ: ${s}`);
    return `"${s}"`;
  };
  const list = cols.map((x) => `${ident(x.col)}::text AS ${ident(x.col)}`).join(', ');
  return `SELECT ${list} FROM ${ident(table)}${where} ORDER BY "id"`;
}
