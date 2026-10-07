/**
 * Kiểu dùng chung của ETL diễn tập: mỗi bảng = một TableSpec gồm câu SELECT
 * liệt kê cột TƯỜNG MINH (không `SELECT *` — 09b §2.1 cấm mang `password`),
 * bộ ánh xạ thuần, và tên bảng đích để truncate/setval.
 */
import { Row } from './convert';

export interface EtlContext {
  /** mốc "bây giờ" (unix giây) — để đếm A7 cdate tương lai. */
  nowUnix: number;
  /** id `tbl_approval_steps` ở NGUỒN — 04b A4. */
  approvalStepIds: ReadonlySet<number>;
  /** id `tbl_approval_requests` ở NGUỒN — 04b A1. */
  approvalRequestIds: ReadonlySet<number>;
  /** id đã NẠP theo model (điền bởi runner) — 09a A2, 04b A5. */
  loaded: Record<string, Set<number>>;
  /** id đã LOẠI theo model (spec.trackIds) — vd phiếu rác ZZ, để bảng con gắn đúng lý do. */
  skipped: Record<string, Set<number>>;
}

export type MapResult<T> =
  | { kind: 'row'; data: T; notes: string[] }
  | { kind: 'skip'; reason: string; id?: number };

export type Mapper<T> = (r: Row, ctx: EtlContext) => MapResult<T>;

export function ok<T>(data: T, notes: string[] = []): MapResult<T> {
  return { kind: 'row', data, notes };
}

export function skip<T>(reason: string, id?: number): MapResult<T> {
  return { kind: 'skip', reason, id };
}

export interface TableSpec {
  /** tên model Prisma (dùng làm khoá báo cáo + ctx.loaded). */
  model: string;
  /** tài liệu migration + mục. */
  doc: string;
  sourceTable: string;
  /** cột nguồn liệt kê tường minh. */
  columns: readonly string[];
  targetTable: string;
  map: Mapper<unknown>;
  /** ghi id int của dòng đã nạp vào ctx.loaded[model] và dòng bị loại (có id) vào ctx.skipped[model]. */
  trackIds?: boolean;
  /** ghi bằng SQL thô với cột JSON ép `::jsonb` từ văn bản gốc (không qua createMany/JSON.parse). */
  rawJsonInsert?: boolean;
}
