/**
 * Bộ đếm khoá chính PG sau ETL (L13 fix round 1 — thay công thức §6 cũ MAX(id đã nạp)+1).
 *
 *   next = GREATEST(PG MAX(id), MySQL MAX(id) KỂ CẢ dòng ETL đã loại, MySQL AUTO_INCREMENT − 1) + 1
 *
 * Lý do: khi dòng đỉnh MySQL bị ETL loại (A2/A4/A5/rác ZZ) hoặc MySQL từng cấp id rồi xoá
 * (AUTO_INCREMENT > MAX+1), công thức cũ để v2 cấp lại id ≤ MAX MySQL ⇒ khi chép ngược (R1)
 * trùng khoá chính với dòng MySQL còn đó. "Sàn" phía nguồn = GREATEST(MAX(id), AUTO_INCREMENT−1)
 * đọc trên MariaDB NGUỒN (information_schema.TABLES).
 */
import { EtlSafeError } from './convert';

const TABLE_RE = /^[a-z_][a-z0-9_]*$/;

/** SQL MariaDB (nguồn) trả cột `f` = GREATEST(COALESCE(MAX(id),0), COALESCE(AUTO_INCREMENT,1) − 1). */
export function sourceSeqFloorSql(table: string): string {
  if (!TABLE_RE.test(table)) throw new EtlSafeError(`tên bảng lạ: ${table}`);
  return (
    `SELECT GREATEST(COALESCE(MAX(\`id\`),0), COALESCE((SELECT \`AUTO_INCREMENT\` FROM information_schema.TABLES ` +
    `WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'),1) - 1) AS f FROM \`${table}\``
  );
}

/** Đọc giá trị `f` (chuỗi số nguyên ≥ 0) từ kết quả `sourceSeqFloorSql`. Thiếu/lạ ⇒ DỪNG. */
export function parseSeqFloor(table: string, rows: Record<string, unknown>[]): string {
  const v = rows[0]?.f;
  const s = v === null || v === undefined ? '' : String(v);
  if (!/^\d+$/.test(s)) throw new EtlSafeError(`sàn bộ đếm ${table}: nguồn không trả số nguyên`);
  return s;
}

/** next = GREATEST(pgMax, floor) + 1 (chuỗi, BigInt). */
export function nextSeqValue(pgMax: string | null, floor: string): string {
  const a = BigInt(pgMax ?? '0');
  const b = BigInt(floor);
  return ((a > b ? a : b) + 1n).toString();
}
