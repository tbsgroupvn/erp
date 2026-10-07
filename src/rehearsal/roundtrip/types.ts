/**
 * Kiểu dùng chung của TỔNG DUYỆT KHỨ HỒI L13 (dump MySQL → ETL sang PG → v2 ghi giả lập →
 * chép ngược về MySQL → kiểm ngược chiều). Chỉ id kỹ thuật / tên bảng / tên cột — không giá trị dòng.
 */

export type CheckStatus = 'PASS' | 'FAIL';

export interface CheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  /** số đếm, id kỹ thuật, tên bảng/cột — KHÔNG giá trị dòng, KHÔNG STK, KHÔNG nội dung CK. */
  details: Record<string, unknown>;
}

/** Một mục phải được công cụ chép ngược BÁO (exit 5) — kỳ vọng dựng từ chính các thao tác giả lập. */
export interface ExpectedFlags {
  /** v2 sửa dòng TRƯỚC cutover — phải báo đúng id + đúng TÊN cột MySQL. */
  modified: { table: string; id: string; columns: string[] }[];
  /** v2 xoá cứng dòng TRƯỚC cutover — phải báo đúng id (MySQL giữ nguyên dòng). */
  deleted: { table: string; id: string }[];
  /** dòng mới đổi giá trị khi ép về kiểu MySQL (rate 6→2 số lẻ) — phải báo đúng id. */
  coerced: { table: string; id: string }[];
}

/** Một bước giả lập ghi trên v2 (qua service THẬT) — id kỹ thuật các dòng nó tạo/sửa/xoá. */
export interface SimStep {
  id: string;
  title: string;
  /** service + hàm v2 đã gọi (hoặc "fixture Prisma" khi v2 CHƯA có service tạo — nêu rõ). */
  via: string;
  ok: boolean;
  /** bảng → id kỹ thuật. */
  ids: Record<string, string[]>;
  note?: string;
}

export interface SimulationResult {
  steps: SimStep[];
  expected: ExpectedFlags;
  /** service v2 CẦN mà chưa có ⇒ đã thay bằng gì (báo cáo, không giấu). */
  gaps: string[];
}
