/**
 * Chốt an toàn cho công cụ diễn tập cutover (L0).
 *
 * ⛔ Mọi script ETL/cổng nghiệm thu PHẢI gọi `assertRehearsalTarget()` trước
 * khi mở kết nối ghi tới CSDL Postgres đích. Hàm này THUẦN (không I/O): nó
 * không tự đọc `.env`/`.env.test` — nơi gọi (script) đọc các URL đó rồi
 * truyền vào làm `forbiddenUrls`, để hàm dễ test và không có tác dụng phụ.
 *
 * Luật chấp nhận:
 *   1. `candidateUrl` phải parse được là URL hợp lệ với scheme `postgres:`
 *      hoặc `postgresql:`.
 *   2. Tên CSDL (path sau dấu `/`, bỏ query string) phải kết thúc bằng
 *      `_rehearsal`.
 *   3. Tên CSDL đó KHÔNG được trùng tên CSDL rút ra từ bất kỳ URL nào trong
 *      `forbiddenUrls` (điển hình: `DATABASE_URL` của `.env` và `.env.test`,
 *      tức CSDL test dùng chung `tbs_test`).
 * Sai bất kỳ điều nào ⇒ throw Error mô tả rõ lý do.
 */

const POSTGRES_SCHEMES = new Set(['postgres:', 'postgresql:']);

/**
 * Rút tên CSDL từ một Postgres connection URL. Trả về `null` nếu URL sai
 * định dạng hoặc không có tên CSDL trong path (không throw — dùng để dò-thử
 * các URL "cấm" mà không muốn văng lỗi giữa chừng).
 */
export function extractDatabaseName(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const name = parsed.pathname.replace(/^\/+/, '');
  return name.length > 0 ? name : null;
}

/**
 * Chấp nhận (không throw) chỉ khi `candidateUrl` là URL Postgres hợp lệ,
 * tên CSDL kết thúc bằng `_rehearsal`, và khác tên CSDL của mọi URL trong
 * `forbiddenUrls`. Ngược lại throw Error.
 */
export function assertRehearsalTarget(
  candidateUrl: string,
  forbiddenUrls: readonly string[],
): void {
  let parsed: URL;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    throw new Error(
      `target-guard: URL đích sai định dạng, từ chối chạy: ${JSON.stringify(candidateUrl)}`,
    );
  }

  if (!POSTGRES_SCHEMES.has(parsed.protocol)) {
    throw new Error(
      `target-guard: URL đích phải là postgres(ql):// — nhận scheme "${parsed.protocol}", từ chối chạy.`,
    );
  }

  const dbName = extractDatabaseName(candidateUrl);
  if (!dbName) {
    throw new Error('target-guard: URL đích thiếu tên CSDL, từ chối chạy.');
  }

  if (!dbName.endsWith('_rehearsal')) {
    throw new Error(
      `target-guard: tên CSDL "${dbName}" không kết thúc bằng "_rehearsal", từ chối chạy.`,
    );
  }

  for (const forbidden of forbiddenUrls) {
    const forbiddenName = extractDatabaseName(forbidden);
    if (forbiddenName !== null && forbiddenName === dbName) {
      throw new Error(
        `target-guard: tên CSDL "${dbName}" trùng với CSDL test dùng chung — TỪ CHỐI để tránh ghi nhầm vào tbs_test.`,
      );
    }
  }
}
