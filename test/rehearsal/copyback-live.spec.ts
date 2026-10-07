/**
 * L13 Task 1 — kiểm SỐNG (tuỳ chọn) trên hạ tầng diễn tập L0, chế độ DRY-RUN
 * (chỉ đọc; transaction MySQL rollback; không ALTER; không ghi báo cáo).
 *
 * CHỈ chạy khi đặt REHEARSAL_LIVE=1 (cần container tbs-mariadb-rehearsal:3307 +
 * tbs_rehearsal:5433 đã nạp bằng load-dump.sh + etl.ts). Mặc định BỎ QUA — bộ jest
 * thường không đụng CSDL diễn tập. KHÔNG BAO GIỜ dùng DATABASE_URL (tbs_test):
 * nguồn PG cố định tbs_rehearsal và đi qua target-guard với tbs_test trong danh sách cấm.
 *
 *   REHEARSAL_LIVE=1 npx dotenv -e .env.test -- npx jest test/rehearsal/copyback-live.spec.ts
 *
 * Khẳng định: ngay sau ETL (chưa có ghi mới trên v2), mọi dòng PG khớp ảnh kỳ vọng
 * ngược(ảnhPG(xuôi(MySQL))) — 0 dòng mới, 0 dòng ≤ mốc bị báo, 0 đổi do ép kiểu.
 */
import * as os from 'os';
import * as path from 'path';
import { collectForbiddenUrls } from '../../src/rehearsal/forbidden-urls';
import { runCopyback } from '../../src/rehearsal/copyback/runner';
import { COPYBACK_DEPS, mysqlConfigFromEnv } from '../../scripts/rehearsal/copyback';

const LIVE = process.env.REHEARSAL_LIVE === '1';
const REPO = path.resolve(__dirname, '..', '..');
const PG_URL = 'postgresql://postgres:postgres@localhost:5433/tbs_rehearsal?schema=public';

(LIVE ? describe : describe.skip)('chép ngược SỐNG — dry-run trên MariaDB diễn tập + tbs_rehearsal', () => {
  it('ngay sau ETL: 0 mới, 0 ≤ mốc bị sửa, 0 ép kiểu — outcome clean', async () => {
    const forbidden = [...collectForbiddenUrls(REPO), process.env.DATABASE_URL ?? ''].filter((u) => u);
    expect(forbidden.some((u) => u.includes('/tbs_test'))).toBe(true);
    const s = await runCopyback(
      {
        pgUrl: PG_URL,
        forbiddenUrls: forbidden,
        mysql: mysqlConfigFromEnv({}),
        outDir: path.join(os.tmpdir(), 'copyback-live-spec'),
        repoRoot: REPO,
        dryRun: true,
        writeReport: false,
      },
      COPYBACK_DEPS,
    );
    expect(s.pgDatabase).toBe('tbs_rehearsal');
    expect(s.tables).toHaveLength(17);
    expect(s.tables.reduce((a, t) => a + t.newRows + t.gapRows, 0)).toBe(0);
    expect(s.tables.filter((t) => t.modifiedOld > 0).map((t) => t.model)).toEqual([]);
    expect(s.tables.reduce((a, t) => a + t.coercedRows, 0)).toBe(0);
    expect(s.outcome).toBe('clean');
  }, 120_000);
});
