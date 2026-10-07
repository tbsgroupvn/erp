/**
 * Chuỗi tham số route -> id Int (Postgres `integer`) dương, hoặc `null` nếu không phải.
 *
 * Chỉ nhận chữ số thập phân thuần, không dấu, không số 0 đứng đầu, ≤ 2^31−1. `Number('1e3')`,
 * `Number(' 7')`, `Number('0x10')`, `parseInt('7abc')` đều cho ra số — dùng thẳng chúng là để
 * một chuỗi "lạ" trỏ vào một bản ghi thật. Giá trị vượt Int mà lọt xuống Prisma thì nó NÉM lỗi
 * kiểu (500) thay vì trả rỗng — một kênh phân biệt với 404 của "không tồn tại".
 *
 * Bên gọi PHẢI coi `null` giống hệt "không tồn tại" (cùng 404, cùng thông điệp).
 */
export function parseIntId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= 2147483647 ? n : null;
}
