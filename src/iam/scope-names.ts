/**
 * Chuẩn hoá tên người dùng trước khi dựng `where` phạm vi (D5, fix round 1 review 7ea9277).
 * Một chỗ duy nhất cho `ScopeService` (own/team) và `TeamScopeService` — đừng chép logic này đi nơi khác.
 */

/** Tên hợp lệ để đưa vào `in`/`contains`: chuỗi, không rỗng sau khi bỏ khoảng trắng. */
export function tenHopLe(n: unknown): n is string {
  return typeof n === 'string' && n.trim() !== '';
}

/**
 * Tên đã chuẩn hoá, hoặc `null` nếu không hợp lệ (bên gọi bỏ qua / DENY).
 *
 * ⚠ CHỈ bỏ khoảng trắng CUỐI (`trimEnd`), KHÔNG bỏ khoảng trắng đầu. Lý do: prod MariaDB so sánh
 * theo PAD SPACE ⇒ `'lead' = 'lead '` (khoảng trắng cuối không tính) nhưng `' lead' <> 'lead'`.
 * `trim()` hai đầu sẽ biến `' lead'` thành `'lead'` và NỚI phạm vi sang khách của người khác —
 * fail-open. `trimEnd` tái hiện đúng phía TÊN của PAD SPACE. Phía CỘT (`saler = 'lead '` trong
 * CSDL) Postgres vẫn so từng byte ⇒ dòng như vậy KHÔNG khớp — fail-closed, việc chuẩn hoá dữ liệu
 * thuộc ETL (D4/Q6 `migration/01-iam.md`).
 */
export function chuanTen(n: unknown): string | null {
  if (!tenHopLe(n)) return null;
  return n.trimEnd();
}

/**
 * Thoát chuỗi để dùng làm LITERAL trong Prisma `contains` / `startsWith` / `endsWith`.
 *
 * ⚠⚠ Prisma 6 (đo trên 6.19.3 + Postgres) KHÔNG thoát ký tự đại diện: `{contains:'a_b%'}` sinh
 * `LIKE $1` với `$1 = '%a_b%%'`. Postgres LIKE mặc định dùng `\` làm ký tự thoát, nên phải thoát
 * `\` TRƯỚC rồi mới tới `%`, `_`. Không thoát thì username `sale_hn` khớp `saleXhn`, còn một thành
 * viên `SalerTeam` tên `%` khớp MỌI khách có `saler_other` — lỗ nới phạm vi.
 * (Chỉ đúng với LIKE phân biệt hoa-thường mặc định; `mode:'insensitive'` → ILIKE cùng luật thoát.)
 */
export function likeLiteral(s: string): string {
  return s.replace(/[\\%_]/g, (c) => '\\' + c);
}
