/**
 * Hàm chuyển kiểu THUẦN cho chiều NGƯỢC (L13: Postgres v2 → MySQL prod).
 *
 * Nguồn PG đọc bằng `SELECT "col"::text` ⇒ MỌI giá trị đến dạng CHUỖI (numeric
 * giữ đủ số lẻ theo scale cột PG, bigint không qua số JS, jsonb ra văn bản chuẩn
 * hoá của PG, boolean ra 'true'/'false', timestamp ra 'YYYY-MM-DD HH:MM:SS[.f]').
 * Đích MySQL nhận chuỗi/NULL — tiền không bao giờ đi qua số JS ở cả hai chiều.
 *
 * Ép về cột HẸP hơn (decimal ít số lẻ hơn, datetime không phần giây lẻ): làm
 * tròn như MySQL/MariaDB khi INSERT (DECIMAL: nửa-xa-số-0; datetime(0): MariaDB
 * CẮT phần lẻ) nhưng làm TƯỜNG MINH ở đây và GHI TÊN CỘT vào `coerced` để báo
 * cáo đếm dòng đổi giá trị. Sai kiểu/biên ⇒ throw EtlSafeError (chép DỪNG,
 * giao dịch MySQL lùi) — thông điệp chỉ nêu tên cột/luật, không nêu giá trị.
 */
import { Prisma } from '@prisma/client';
import { EtlSafeError } from '../etl/convert';

/** Dòng PG đọc qua `::text` — khoá = tên cột PG. */
export type PgRow = Record<string, string | null>;
/** Dòng ghi vào MySQL — khoá = tên cột MySQL. */
export type MyRow = Record<string, string | null>;

export interface ReverseResult {
  row: MyRow;
  /** tên cột MySQL bị ĐỔI GIÁ TRỊ do ép kiểu (làm tròn/cắt). */
  coerced: string[];
}

const INTEGER_RE = /^-?\d+$/;
const INT32 = { min: -2147483648n, max: 2147483647n };
const TINYINT = { min: -128n, max: 127n };
const INT64 = { min: -9223372036854775808n, max: 9223372036854775807n };
const PG_TS_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?:\.(\d+))?$/;

function fail(col: string, msg: string): never {
  throw new EtlSafeError(`chép ngược cột ${col}: ${msg}`);
}

export interface RevOptions {
  /** bảng/cột MySQL utf8mb3 — ký tự ngoài BMP (4 byte, vd emoji) không ghi được ⇒ DỪNG. */
  mb3?: boolean;
}

/** Bộ đọc một dòng PG + ghi nhận cột bị ép kiểu. */
export class Rev {
  readonly coerced: string[] = [];

  constructor(
    private readonly r: PgRow,
    private readonly opts: RevOptions = {},
  ) {}

  private get(col: string): string | null {
    if (!(col in this.r)) fail(col, 'thiếu trong dòng PG');
    const v = this.r[col];
    if (v !== null && typeof v !== 'string') fail(col, `cần văn bản (::text), nhận ${typeof v}`);
    return v;
  }

  private text(col: string, v: string): string {
    if (this.opts.mb3) {
      for (const ch of v) {
        if (ch.codePointAt(0)! > 0xffff) fail(col, 'ký tự 4 byte không ghi được vào cột utf8mb3 ⇒ DỪNG');
      }
    }
    return v;
  }

  str(col: string): string {
    const v = this.get(col);
    if (v === null) fail(col, 'cần NOT NULL');
    return this.text(col, v);
  }

  optStr(col: string): string | null {
    const v = this.get(col);
    return v === null ? null : this.text(col, v);
  }

  enumOf(col: string, allowed: readonly string[]): string {
    const v = this.str(col);
    if (!allowed.includes(v)) fail(col, `giá trị ngoài enum MySQL (${allowed.join('/')}) ⇒ DỪNG`);
    return v;
  }

  private integer(col: string, v: string, range: { min: bigint; max: bigint }): string {
    if (!INTEGER_RE.test(v)) fail(col, 'cần số nguyên');
    const n = BigInt(v);
    if (n < range.min || n > range.max) fail(col, 'ngoài biên kiểu nguyên MySQL ⇒ DỪNG');
    return n.toString();
  }

  int(col: string): string {
    const v = this.get(col);
    if (v === null) fail(col, 'cần NOT NULL');
    return this.integer(col, v, INT32);
  }

  optInt(col: string): string | null {
    const v = this.get(col);
    return v === null ? null : this.integer(col, v, INT32);
  }

  tinyint(col: string): string {
    const v = this.get(col);
    if (v === null) fail(col, 'cần NOT NULL');
    return this.integer(col, v, TINYINT);
  }

  optTinyint(col: string): string | null {
    const v = this.get(col);
    return v === null ? null : this.integer(col, v, TINYINT);
  }

  bigint(col: string): string {
    const v = this.get(col);
    if (v === null) fail(col, 'cần NOT NULL');
    return this.integer(col, v, INT64);
  }

  optBigint(col: string): string | null {
    const v = this.get(col);
    return v === null ? null : this.integer(col, v, INT64);
  }

  private decimal(col: string, my: string, v: string, precision: number, scale: number): string {
    let d: Prisma.Decimal;
    try {
      d = new Prisma.Decimal(v);
    } catch {
      fail(col, 'numeric không hợp lệ');
    }
    if (!d.isFinite()) fail(col, 'numeric không hữu hạn');
    const rounded = d.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP); // nửa-xa-số-0, như MySQL
    if (rounded.abs().gte(new Prisma.Decimal(10).pow(precision - scale))) {
      fail(col, `vượt decimal(${precision},${scale}) MySQL ⇒ DỪNG`);
    }
    if (!rounded.eq(d)) this.coerced.push(my);
    const out = rounded.toFixed(scale);
    return out === `-${(0).toFixed(scale)}` ? out.slice(1) : out;
  }

  /** `my` = tên cột MySQL (để ghi `coerced`); mặc định trùng tên cột PG. */
  dec(col: string, precision: number, scale: number, my: string = col): string {
    const v = this.get(col);
    if (v === null) fail(col, 'cần NOT NULL');
    return this.decimal(col, my, v, precision, scale);
  }

  optDec(col: string, precision: number, scale: number, my: string = col): string | null {
    const v = this.get(col);
    return v === null ? null : this.decimal(col, my, v, precision, scale);
  }

  /** PG boolean → tinyint 1/0. */
  bool(col: string): string {
    const v = this.get(col);
    if (v === 'true' || v === 't') return '1';
    if (v === 'false' || v === 'f') return '0';
    fail(col, 'cần boolean');
  }

  /** jsonb::text → văn bản JSON gọn (bỏ khoảng trắng PG chèn ngoài chuỗi). */
  optJson(col: string): string | null {
    const v = this.get(col);
    if (v === null) return null;
    return this.text(col, compactJson(col, v));
  }

  json(col: string): string {
    const v = this.optJson(col);
    if (v === null) fail(col, 'cần NOT NULL');
    return v;
  }

  /** timestamp(3) PG → datetime(0) MySQL: CẮT phần giây lẻ (như MariaDB), khác 0 ⇒ ghi `coerced`. */
  optDateTime(col: string, my: string = col): string | null {
    const v = this.get(col);
    if (v === null) return null;
    const m = PG_TS_RE.exec(v);
    if (!m) fail(col, 'timestamp không hợp lệ ⇒ DỪNG');
    if (m[2] !== undefined && /[1-9]/.test(m[2])) this.coerced.push(my);
    return m[1];
  }

  result(row: MyRow): ReverseResult {
    return { row, coerced: [...new Set(this.coerced)] };
  }
}

// ------------------------------------------------------------------ JSON

const JSON_WS = new Set([' ', '\t', '\n', '\r']);

/** Bỏ khoảng trắng NGOÀI chuỗi của văn bản JSON (jsonb::text chèn ', ' và ': '). Kiểm hợp lệ. */
export function compactJson(col: string, s: string): string {
  let out = '';
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
      out += ch;
    } else if (!JSON_WS.has(ch)) {
      out += ch;
    }
  }
  canonicalJson(col, out); // kiểm hợp lệ — ném nếu hỏng
  return out;
}

/**
 * Dạng CHUẨN của một văn bản JSON để so NGỮ NGHĨA (như jsonb so): khoá object
 * sắp xếp + trùng khoá lấy giá trị SAU CÙNG, chuỗi giải mã escape, số so bằng
 * Decimal (không qua double — 1.50 == 1.5, số 20 chữ số không mất).
 */
export function canonicalJson(col: string, s: string): string {
  let i = 0;
  const bad = (): never => fail(col, 'JSON không hợp lệ ⇒ DỪNG');
  const ws = () => {
    while (i < s.length && JSON_WS.has(s[i])) i++;
  };
  const strTok = (): string => {
    const start = i;
    i++; // "
    while (i < s.length) {
      const c = s[i];
      if (c === '\\') i += 2;
      else if (c === '"') {
        i++;
        try {
          return JSON.parse(s.slice(start, i)) as string;
        } catch {
          return bad();
        }
      } else i++;
    }
    return bad();
  };
  const value = (): string => {
    ws();
    const c = s[i];
    if (c === '{') {
      i++;
      const m = new Map<string, string>();
      ws();
      if (s[i] === '}') {
        i++;
        return '{}';
      }
      for (;;) {
        ws();
        if (s[i] !== '"') bad();
        const k = strTok();
        ws();
        if (s[i] !== ':') bad();
        i++;
        m.set(k, value());
        ws();
        if (s[i] === ',') {
          i++;
          continue;
        }
        if (s[i] === '}') {
          i++;
          break;
        }
        bad();
      }
      const keys = [...m.keys()].sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${m.get(k)}`).join(',')}}`;
    }
    if (c === '[') {
      i++;
      const items: string[] = [];
      ws();
      if (s[i] === ']') {
        i++;
        return '[]';
      }
      for (;;) {
        items.push(value());
        ws();
        if (s[i] === ',') {
          i++;
          continue;
        }
        if (s[i] === ']') {
          i++;
          break;
        }
        bad();
      }
      return `[${items.join(',')}]`;
    }
    if (c === '"') return JSON.stringify(strTok());
    for (const lit of ['true', 'false', 'null']) {
      if (s.startsWith(lit, i)) {
        i += lit.length;
        return lit;
      }
    }
    const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(s.slice(i));
    if (!m) return bad();
    i += m[0].length;
    const d = new Prisma.Decimal(m[0]);
    return d.isZero() ? '0' : d.toString();
  };
  const out = value();
  ws();
  if (i !== s.length) bad();
  return out;
}

export function jsonEquivalent(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return canonicalJson('json', a) === canonicalJson('json', b);
}
