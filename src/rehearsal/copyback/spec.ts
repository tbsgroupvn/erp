/**
 * Kiểu dùng chung của chép ngược L13: mỗi bảng = một CopybackSpec gồm danh sách
 * cột PG (đọc `::text`), mapper NGƯỢC thuần (dòng PG → dòng MySQL), mapper XUÔI
 * L0 tương ứng (để dựng ảnh kỳ vọng của dòng ≤ mốc) và mô tả phần mất có chủ đích.
 */
import { TableSpec } from '../etl/spec';
import { PgRow, ReverseResult } from './convert';
import { PgCol } from './pg-image';

export interface CopybackSpec {
  model: string;
  /** tài liệu migration chiều xuôi (luật cột được đảo lại). */
  doc: string;
  /** tên bảng — TRÙNG ở MySQL và PG (@@map). */
  table: string;
  pgColumns: readonly PgCol[];
  reverse(r: PgRow): ReverseResult;
  /** spec xuôi L0 (cột MySQL + mapper) — null nếu chiều xuôi không nạp dòng nào (FxAdjustment). */
  forward: TableSpec | null;
  /** cột MySQL kiểu JSON-văn-bản: so NGỮ NGHĨA (jsonb chuẩn hoá khoảng trắng/thứ tự khoá). */
  jsonColumns?: readonly string[];
  /** cột MySQL KHÔNG có ở PG — INSERT bỏ qua, MySQL tự lấy DEFAULT. */
  mysqlOnlyColumns?: readonly string[];
  /** phần mất CÓ CHỦ ĐÍCH khi đi PG → MySQL (ghi vào báo cáo; test khẳng định đúng phần mất). */
  lossy: readonly string[];
}
