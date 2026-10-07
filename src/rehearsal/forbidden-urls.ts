/**
 * Gom danh sách URL CSDL CẤM ghi diễn tập (CSDL test dùng chung `tbs_test`):
 * DATABASE_URL trong `.env`, `.env.test` và biến môi trường hiện hành. Dùng
 * chung bởi `scripts/rehearsal/guard-check.ts` và `scripts/rehearsal/etl.ts`
 * — truyền vào `assertRehearsalTarget()` (một định nghĩa, không chép logic).
 */
import * as fs from 'fs';
import * as path from 'path';

export function readDatabaseUrlFromEnvFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m);
  return match ? match[1] : null;
}

export function collectForbiddenUrls(
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
): string[] {
  return [
    readDatabaseUrlFromEnvFile(path.join(repoRoot, '.env')),
    readDatabaseUrlFromEnvFile(path.join(repoRoot, '.env.test')),
    env.DATABASE_URL ?? null,
  ].filter((u): u is string => u !== null);
}
