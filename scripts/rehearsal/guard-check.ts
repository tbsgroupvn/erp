/**
 * Cổng gác dòng lệnh: đọc DATABASE_URL của `.env` và `.env.test` (CSDL test
 * dùng chung, KHÔNG BAO GIỜ được ghi diễn tập vào đó), rồi gọi
 * `assertRehearsalTarget()` trên URL đích truyền vào qua biến môi trường
 * `REHEARSAL_DATABASE_URL` (hoặc đối số dòng lệnh đầu tiên).
 *
 * Exit code 0 nếu URL đích an toàn để ETL/cổng nghiệm thu ghi vào; exit code
 * 1 (kèm thông điệp lỗi) nếu bị từ chối. Không tự kết nối CSDL nào — chỉ
 * kiểm chuỗi URL.
 *
 * Dùng:
 *   REHEARSAL_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/tbs_rehearsal" \
 *     npx ts-node scripts/rehearsal/guard-check.ts
 */
import * as path from 'path';
import { assertRehearsalTarget } from '../../src/rehearsal/target-guard';
import { collectForbiddenUrls } from '../../src/rehearsal/forbidden-urls';

function main(): void {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const candidate = process.argv[2] ?? process.env.REHEARSAL_DATABASE_URL;

  if (!candidate) {
    console.error(
      'guard-check: thiếu URL đích. Truyền qua tham số dòng lệnh hoặc biến REHEARSAL_DATABASE_URL.',
    );
    process.exit(1);
  }

  const forbiddenUrls = collectForbiddenUrls(repoRoot);

  try {
    assertRehearsalTarget(candidate, forbiddenUrls);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  console.log(`guard-check: OK — "${candidate}" là đích diễn tập hợp lệ.`);
}

main();
