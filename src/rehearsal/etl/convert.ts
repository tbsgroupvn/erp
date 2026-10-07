/**
 * Hàm chuyển kiểu THUẦN cho ETL diễn tập (L0). Nguồn đọc bằng mysql2 với
 * `supportBigNumbers + bigNumberStrings + dateStrings` (decimal/bigint đến dạng
 * CHUỖI) ⇒ tiền không bao giờ đi qua số JS. Sai kiểu/biên ⇒ throw (ETL DỪNG).
 */
import { Prisma } from '@prisma/client';

export type Row = Record<string, unknown>;

/**
 * Lỗi có thông điệp AN TOÀN để in (chỉ tên cột/luật/tên CSDL — không giá trị dòng,
 * không STK, không URL có mật khẩu). CLI chỉ in `message` cho lớp này; lỗi khác
 * (vd Prisma — có thể lặp lại dữ liệu dòng) chỉ in name/code/khoá meta.
 */
export class EtlSafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EtlSafeError';
  }
}

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const INTEGER_RE = /^-?\d+$/;

function fail(col: string, msg: string): never {
  throw new EtlSafeError(`ETL cột ${col}: ${msg}`);
}

function get(r: Row, col: string): unknown {
  if (!(col in r)) fail(col, 'thiếu trong dòng nguồn');
  return r[col];
}

export function reqStr(r: Row, col: string): string {
  const v = get(r, col);
  if (typeof v !== 'string') fail(col, `cần string NOT NULL, nhận ${v === null ? 'NULL' : typeof v}`);
  return v;
}

export function optStr(r: Row, col: string): string | null {
  const v = get(r, col);
  if (v === null) return null;
  if (typeof v !== 'string') fail(col, `cần string|NULL, nhận ${typeof v}`);
  return v;
}

function toInt32(col: string, v: unknown): number {
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && INTEGER_RE.test(v)) n = Number(v);
  else fail(col, `cần số nguyên, nhận ${typeof v}`);
  if (!Number.isInteger(n) || n < INT32_MIN || n > INT32_MAX) fail(col, 'ngoài int32');
  return n;
}

export function reqInt32(r: Row, col: string): number {
  const v = get(r, col);
  if (v === null) fail(col, 'cần NOT NULL');
  return toInt32(col, v);
}

export function optInt32(r: Row, col: string): number | null {
  const v = get(r, col);
  return v === null ? null : toInt32(col, v);
}

function toBigInt(col: string, v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v)) fail(col, 'số JS không safe-integer — phải đọc bigint dạng chuỗi');
    return BigInt(v);
  }
  if (typeof v === 'string' && INTEGER_RE.test(v)) return BigInt(v);
  fail(col, `cần integer (chuỗi), nhận ${typeof v}`);
}

export function reqBigInt(r: Row, col: string): bigint {
  const v = get(r, col);
  if (v === null) fail(col, 'cần NOT NULL');
  return toBigInt(col, v);
}

export function optBigInt(r: Row, col: string): bigint | null {
  const v = get(r, col);
  return v === null ? null : toBigInt(col, v);
}

export interface DecimalOpts {
  /** biên TUYỆT ĐỐI loại trừ (kiểm trước §5 của tài liệu migration), vd '1e15'. */
  maxAbs?: string;
}

function toDecimal(col: string, v: unknown, opts: DecimalOpts): Prisma.Decimal {
  if (typeof v !== 'string') fail(col, `decimal phải đến dạng string (không qua float), nhận ${typeof v}`);
  const d = new Prisma.Decimal(v);
  if (opts.maxAbs !== undefined && d.abs().gte(new Prisma.Decimal(opts.maxAbs))) {
    fail(col, `vượt maxAbs ${opts.maxAbs} ⇒ DỪNG`);
  }
  return d;
}

export function reqDecimal(r: Row, col: string, opts: DecimalOpts = {}): Prisma.Decimal {
  const v = get(r, col);
  if (v === null) fail(col, 'cần NOT NULL');
  return toDecimal(col, v, opts);
}

export function optDecimal(r: Row, col: string, opts: DecimalOpts = {}): Prisma.Decimal | null {
  const v = get(r, col);
  return v === null ? null : toDecimal(col, v, opts);
}

export function enumVal<T extends string>(r: Row, col: string, allowed: readonly T[]): T {
  const v = get(r, col);
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    fail(col, `giá trị enum lạ ⇒ DỪNG (cho phép: ${allowed.join('/')})`);
  }
  return v as T;
}

/**
 * G-DOC-3: Postgres so chuỗi phân biệt hoa/thường và không bỏ khoảng trắng cuối
 * (MariaDB prod thì có) ⇒ mã quỹ/mã ví chuẩn hoá TRIM+UPPER khi ETL. Chỉ dùng
 * cho cột MÃ (tk_code, account_code, from_tk/to_tk/agent_tk, code ví) — KHÔNG
 * dùng cho cus_id/code_order (tài liệu cấm TRIM).
 */
export function normCode(v: string): { value: string; changed: boolean } {
  const value = v.trim().toUpperCase();
  return { value, changed: value !== v };
}

/** 'YYYY-MM-DD HH:MM:SS' (mysql2 dateStrings) → Date giữ nguyên GIỜ ĐỒNG HỒ (ghi như UTC vào timestamp không múi giờ). */
export function optDateTime(r: Row, col: string): Date | null {
  const v = get(r, col);
  if (v === null) return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(v)) {
    fail(col, 'datetime không hợp lệ ⇒ DỪNG');
  }
  const d = new Date(`${v.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) fail(col, 'datetime không hợp lệ ⇒ DỪNG');
  return d;
}
