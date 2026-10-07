/**
 * L0 Task 3 — cổng vào chạy cổng nghiệm thu — `runGates()`.
 *
 * ⛔ Thứ tự bắt buộc (không bao giờ GHI vào CSDL nào):
 *  (1) `assertRehearsalTarget` trên URL đích — TRƯỚC khi mở bất kỳ kết nối nào (tbs_test / URL lạ ⇒ từ chối);
 *  (2) thư mục báo cáo phải NGOÀI repo;
 *  (3) mở đích: `current_database()` phải đúng tên CSDL diễn tập VÀ phiên phải read-only;
 *  (4) mở nguồn: phiên MariaDB phải read-only;
 *  (5) chạy từng cổng; lỗi một cổng ⇒ ERROR (chỉ tên lớp lỗi), các cổng khác vẫn chạy;
 *  (6) báo cáo chỉ số đếm/tổng.
 * Mã thoát: 0 mọi cổng PASS/SKIPPED · 4 có FAIL · 1 có ERROR (hoặc lỗi hạ tầng).
 */
import * as path from 'path';
import { assertRehearsalTarget, extractDatabaseName } from '../target-guard';
import { GoldenServices } from './golden';
import { GateRunSummary, writeGateReport } from './report';
import { Gate, GateResult, GateStatus, QueryDb } from './types';

export interface GateSourceDb extends QueryDb {
  readOnly(): Promise<boolean>;
  close(): Promise<void>;
}
export interface GateTargetDb extends QueryDb {
  currentDatabase(): Promise<string>;
  readOnly(): Promise<boolean>;
  services(): GoldenServices | null;
  close(): Promise<void>;
}
export interface GateDeps {
  openSource(): Promise<GateSourceDb>;
  openTarget(url: string): Promise<GateTargetDb>;
}
export interface GateOptions {
  targetUrl: string;
  forbiddenUrls: readonly string[];
  outDir: string;
  repoRoot: string;
  gates: readonly Gate[];
  writeReport?: boolean;
  /** "bây giờ" cố định cho hai phía (mặc định = giờ rút dump 25/09/2026 15:41 +07). */
  now?: Date;
  uid?: number;
}

export const DUMP_NOW = new Date('2026-09-25T08:41:00Z');

export class GateSafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GateSafeError';
  }
}

export function exitCodeForGates(s: Pick<GateRunSummary, 'counts'>): number {
  if (s.counts.ERROR > 0) return 1;
  if (s.counts.FAIL > 0) return 4;
  return 0;
}

function assertOutsideRepo(outDir: string, repoRoot: string): void {
  const rel = path.relative(path.resolve(repoRoot), path.resolve(outDir));
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new GateSafeError(`gates: thư mục báo cáo phải nằm ngoài repo (số tiền thật) — nhận ${outDir}`);
  }
}

export async function runGates(opts: GateOptions, deps: GateDeps): Promise<GateRunSummary> {
  // (1) chốt an toàn — thông điệp gốc có thể chứa URL (mật khẩu) ⇒ chỉ nêu tên CSDL.
  try {
    assertRehearsalTarget(opts.targetUrl, opts.forbiddenUrls);
  } catch {
    throw new GateSafeError(
      `target-guard TỪ CHỐI đích "${String(extractDatabaseName(opts.targetUrl))}" (cần *_rehearsal, khác CSDL test tbs_test).`,
    );
  }
  // (2)
  assertOutsideRepo(opts.outDir, opts.repoRoot);
  const expectedDb = extractDatabaseName(opts.targetUrl);
  const started = new Date();
  const target = await deps.openTarget(opts.targetUrl);
  let source: GateSourceDb | null = null;
  try {
    // (3)
    const actualDb = await target.currentDatabase();
    if (actualDb !== expectedDb || !actualDb.endsWith('_rehearsal')) {
      throw new GateSafeError(`gates: current_database()="${actualDb}" không khớp đích diễn tập "${String(expectedDb)}" — TỪ CHỐI.`);
    }
    if (!(await target.readOnly())) throw new GateSafeError('gates: phiên Postgres đích KHÔNG read-only — TỪ CHỐI.');
    // (4)
    source = await deps.openSource();
    if (!(await source.readOnly())) throw new GateSafeError('gates: phiên MariaDB nguồn KHÔNG read-only — TỪ CHỐI.');

    const ctx = {
      source,
      target,
      services: target.services(),
      now: opts.now ?? DUMP_NOW,
      uid: opts.uid ?? 1,
    };
    const results: GateResult[] = [];
    for (const g of opts.gates) {
      const t0 = Date.now();
      try {
        const e = await g.run(ctx);
        results.push({ id: g.id, doc: g.doc, title: g.title, kind: g.kind, ...e, durationMs: Date.now() - t0 });
      } catch (err) {
        const code = err instanceof Error ? (err as Error & { code?: unknown }).code : undefined;
        results.push({
          id: g.id, doc: g.doc, title: g.title, kind: g.kind, status: 'ERROR', durationMs: Date.now() - t0,
          errorName: err instanceof Error ? `${err.name}${typeof code === 'string' ? ':' + code : ''}` : 'unknown',
        });
      }
    }
    // (5b) đích vẫn read-only sau khi chạy (Prisma có thể mở kết nối mới — options gắn theo URL).
    if (!(await target.readOnly())) throw new GateSafeError('gates: phiên Postgres đích mất read-only giữa chừng — kết quả không tin được.');
    const counts: Record<GateStatus, number> = { PASS: 0, FAIL: 0, SKIPPED: 0, ERROR: 0 };
    for (const r of results) counts[r.status]++;
    const summary: GateRunSummary = {
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
      targetDatabase: actualDb,
      counts,
      results,
      reportFiles: [],
    };
    if (opts.writeReport !== false) summary.reportFiles = writeGateReport(summary, opts.outDir, opts.repoRoot);
    return summary;
  } finally {
    if (source) await source.close();
    await target.close();
  }
}
