/**
 * L0 Task 3 — kiểu dùng chung của cổng nghiệm thu diễn tập.
 *
 * Mỗi cổng = (câu NGUỒN MariaDB và/hoặc câu ĐÍCH Postgres, hoặc lời gọi service ĐỌC v2) + MỘT hàm so
 * sánh THUẦN trên kết quả. Kết quả chỉ mang SỐ ĐẾM / TỔNG (`Agg`) — không dòng dữ liệu, không STK, không
 * nội dung chuyển khoản (`report.ts` kiểm cứng trước khi ghi).
 */
import type { GoldenServices } from './golden';

export type Row = Record<string, unknown>;

export type GateStatus = 'PASS' | 'FAIL' | 'SKIPPED' | 'ERROR';
/** source = §7 nguồn "sai là DỪNG" · target = §8 đích mức cột · golden = số vàng 09d §9 · gdoc = G-DOC-1..3 */
export type GateKind = 'source' | 'target' | 'golden' | 'gdoc';

/** Giá trị được phép trong báo cáo: số / chuỗi số / cờ / NULL (hoặc token 'differs'). */
export type AggValue = string | number | boolean | null;
export type Agg = Record<string, AggValue>;

export interface GateEval {
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  source?: Agg;
  target?: Agg;
  diff?: Agg;
  /** số thông tin (không quyết định PASS/FAIL) — vd số của công thức prod khi độ lệch đã được quyết (Q-DOC-1). */
  info?: Agg;
  /** TÊN cột lệch (tên schema, không phải dữ liệu). */
  columns?: string[];
  /** khoá lệch — CHỈ khi khoá là nhãn phân loại (mã ví, source_module, status…), không bao giờ id/nội dung. */
  keys?: string[];
  /** lý do SKIPPED (chuỗi tĩnh do mã viết). */
  reason?: string;
}

export interface GateResult extends Omit<GateEval, 'status'> {
  id: string;
  doc: string;
  title: string;
  kind: GateKind;
  status: GateStatus;
  durationMs: number;
  /** ERROR: chỉ TÊN lớp lỗi (thông điệp có thể chứa dữ liệu). */
  errorName?: string;
}

export interface QueryDb {
  query(sql: string): Promise<Row[]>;
}

export interface GateContext {
  source: QueryDb;
  target: QueryDb;
  /** service ĐỌC v2 dựng trên PrismaClient diễn tập (null trong test không cần). */
  services: GoldenServices | null;
  /** mốc "bây giờ" cố định = giờ rút dump (25/09 15:41 +07) — dùng chung hai phía. */
  now: Date;
  /** uid dùng cho lời gọi service (quyền đã được thay bằng stub đọc — xem scripts/rehearsal/gates.ts). */
  uid: number;
}

/** Khai báo của cổng dạng SQL — để test chứng minh từng cổng không mù. */
export type GateSpec =
  | { type: 'count'; sql: string; expected: number }
  | { type: 'crossref'; sourceSql: string | null; targetSql: string; expected?: number }
  | { type: 'keyed'; sourceSql: string; targetSql: string; key: string[]; values: string[]; keysAreLabels?: boolean }
  | { type: 'scalar'; sourceSql: string; targetSql: string; key: string[]; values: string[] };

export interface Gate {
  id: string;
  doc: string;
  title: string;
  kind: GateKind;
  spec?: GateSpec;
  /** cổng luôn SKIPPED ở lô này — lý do. */
  skipReason?: string;
  run(ctx: GateContext): Promise<GateEval>;
}
