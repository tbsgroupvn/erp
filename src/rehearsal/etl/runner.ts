/**
 * Cổng vào ETL diễn tập L0 — `runEtl()`.
 *
 * ⛔ Thứ tự bắt buộc:
 *  (1) `assertRehearsalTarget` trên URL đích — TRƯỚC khi mở bất kỳ kết nối nào;
 *  (2) thư mục báo cáo phải NGOÀI repo;
 *  (3) mở đích, `current_database()` phải đúng tên CSDL diễn tập;
 *  (4) cổng DỪNG phía nguồn (tài liệu "≥1 ⇒ DỪNG": 09a A8/A9, 09c §2.2…) — nổ mà
 *      không có `allowStopAnomalies` ⇒ ghi báo cáo, KHÔNG truncate, outcome 'stopped';
 *  (5) đọc + ánh xạ + kiểm TOÀN BỘ vào bộ nhớ (lỗi luật cột ⇒ dừng, đích nguyên vẹn);
 *  (6) truncate + nạp (id tường minh, §5) + setval trong MỘT giao dịch Postgres
 *      (`TargetDb.replaceAll`) — hỏng giữa chừng ⇒ rollback, lần nạp trước còn nguyên.
 * Nguồn/đích đi qua interface để test không đụng CSDL.
 */
import * as path from 'path';
import { assertRehearsalTarget, extractDatabaseName } from '../target-guard';
import { ANOMALY_QUERIES } from './anomalies';
import { EtlSafeError, Row } from './convert';
import { writeEtlReport } from './report';
import { EtlContext, TableSpec } from './spec';
import { TABLES } from './tables';
import { parseSeqFloor, sourceSeqFloorSql } from './seq-floor';

export interface SourceDb {
  query(sql: string): Promise<Row[]>;
  close(): Promise<void>;
}

export interface LoadStep {
  model: string;
  table: string;
  rows: unknown[];
  rawJsonInsert: boolean;
}

export interface LoadPlan {
  truncateTables: string[];
  steps: LoadStep[];
  chunkSize: number;
  /**
   * sàn bộ đếm theo bảng đích = GREATEST(MySQL MAX(id) kể cả dòng loại, MySQL AUTO_INCREMENT−1)
   * đọc trên NGUỒN; setval = GREATEST(PG MAX(id), sàn)+1 (L13 — tránh v2 cấp lại id MySQL còn giữ).
   */
  seqFloor: Record<string, string>;
}

export interface LoadResult {
  written: Record<string, number>;
  /** giá trị setval dạng chuỗi theo bảng đích. */
  setval: Record<string, string>;
}

export interface TargetDb {
  currentDatabase(): Promise<string>;
  /** truncate + nạp + setval trong MỘT giao dịch; lỗi ⇒ rollback toàn bộ. */
  replaceAll(plan: LoadPlan): Promise<LoadResult>;
  close(): Promise<void>;
}

export interface EtlDeps {
  openSource(): Promise<SourceDb>;
  openTarget(url: string): Promise<TargetDb>;
}

export interface EtlOptions {
  targetUrl: string;
  forbiddenUrls: readonly string[];
  outDir: string;
  repoRoot: string;
  /** cờ tường minh `--allow-stop-anomalies` — nạp dù cổng DỪNG nổ (ghi vào báo cáo, exit 3). */
  allowStopAnomalies?: boolean;
  writeReport?: boolean;
  chunkSize?: number;
  now?: Date;
}

export type EtlOutcome = 'clean' | 'stopped' | 'loaded_with_stop_anomalies' | 'failed';

/** Mã thoát CLI: 0 sạch · 1 lỗi · 2 DỪNG trước truncate · 3 đã nạp nhưng có cổng DỪNG (cờ cho phép). */
export function exitCodeFor(outcome: EtlOutcome): number {
  switch (outcome) {
    case 'clean':
      return 0;
    case 'stopped':
      return 2;
    case 'loaded_with_stop_anomalies':
      return 3;
    default:
      return 1;
  }
}

export interface TableSummary {
  model: string;
  doc: string;
  sourceTable: string;
  targetTable: string;
  read: number;
  written: number;
  skipped: Record<string, number>;
  notes: Record<string, number>;
  setval: string | null;
  durationMs: number;
}

export interface AnomalySummary {
  id: string;
  doc: string;
  description: string;
  applied: string;
  count: number | null;
  stopFlag: boolean;
  signOffFlag: boolean;
}

export interface EtlSummary {
  outcome: EtlOutcome;
  allowStopAnomalies: boolean;
  /** id các cổng DỪNG đã nổ (chỉ tên luật). */
  stopRulesFired: string[];
  /** mục cần ký phát sinh từ lần chạy (tên luật + số đếm). */
  signOffItems: string[];
  /** chỉ TÊN lớp lỗi khi outcome='failed' — không in thông điệp (có thể chứa dữ liệu dòng). */
  errorName: string | null;
  startedAt: string;
  finishedAt: string;
  targetDatabase: string;
  tables: TableSummary[];
  anomalies: AnomalySummary[];
  rulesNotApplied: string[];
  totalDurationMs: number;
  reportFiles: string[];
}

/** Luật tài liệu KHÔNG áp ở lô này — ghi thẳng vào báo cáo (không im lặng). */
export const RULES_NOT_APPLIED: readonly string[] = [
  '09c §5.1: "sau #04 (ApprovalRequest)" — lô này không nạp tbl_approval_requests/steps vào Postgres; ReturnState/FxTransfer/BankChiMatch trỏ phiếu duyệt không có FK nên nạp được, nhưng nghiệm thu tham chiếu (09c §8.4, 04b §10.2) phải chờ #04.',
  '09c §5.4: 2 index một phần Q-BANK-1/2 (UNIQUE bankid<>\'\', chi_match hiệu lực) — schema v2 chốt KHÔNG tạo (comment BankTransaction/BankChiMatch trong prisma/schema.prisma); ETL không tạo index ngoài migration.',
  '09c §5.5 / cutover §3.3: phát lại SePay id > X1 — không áp (dump tĩnh, không có luồng sống).',
  '09b §3 B6: 2 dòng container_id trỏ hồ sơ cont không còn — bảng container không có trong dump ⇒ không đếm được; vẫn nạp nguyên (giữ 0/giá trị).',
  '09b §3 B7: 54 cus_id chữ tự do — tài liệu không định nghĩa "mã KH" để đếm; nạp nguyên (KHÔNG TRIM, không FK), không đếm.',
  '09c §3.2 C1/C6/C8: thuộc #03/#04 (ví/bình luận/GL ví) — không có model đích ở lô này; không đếm.',
  '09b §8.5 / 09c §8.5 / 09a §7.4 / 04b §10.3: test hành vi trên đích — thuộc Task 3 (cổng nghiệm thu), không phải ETL.',
  '09a §7.0 / 09b §7 / 09c §7 / 04b §10.0: bộ cổng nguồn đầy đủ "sai là DỪNG" — thuộc Task 3; ETL chỉ tự DỪNG ở các luật §2 (enum lạ, biên số, JSON hỏng) và các mục §3 tài liệu ghi "≥1 ⇒ DỪNG" (09a A8/A9, 09c §2.2) trước khi truncate.',
];

function assertOutsideRepo(outDir: string, repoRoot: string): void {
  const rel = path.relative(path.resolve(repoRoot), path.resolve(outDir));
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new EtlSafeError(`ETL: thư mục báo cáo phải nằm ngoài repo (dữ liệu thật) — nhận ${outDir}`);
  }
}

function countOf(rows: Row[]): number | null {
  if (rows.length === 0) return null;
  const v = Object.values(rows[0])[0];
  if (v === null || v === undefined) return null;
  return Number(String(v));
}

function selectSql(spec: TableSpec): string {
  const cols = spec.columns.map((c) => `\`${c}\``).join(', ');
  return `SELECT ${cols} FROM \`${spec.sourceTable}\` ORDER BY \`id\``;
}

function bump(m: Record<string, number>, k: string): void {
  m[k] = (m[k] ?? 0) + 1;
}

interface Mapped {
  summary: TableSummary;
  rows: unknown[];
}

/** Đọc + ánh xạ + kiểm một bảng vào bộ nhớ — KHÔNG ghi gì. */
async function mapTable(spec: TableSpec, source: SourceDb, ctx: EtlContext): Promise<Mapped> {
  const t0 = Date.now();
  const src = await source.query(selectSql(spec));
  const out: unknown[] = [];
  const skipped: Record<string, number> = {};
  const notes: Record<string, number> = {};
  const ids = new Set<number>();
  const skippedIds = new Set<number>();
  for (const r of src) {
    const res = spec.map(r, ctx);
    if (res.kind === 'skip') {
      bump(skipped, res.reason);
      if (res.id !== undefined) skippedIds.add(res.id);
      continue;
    }
    for (const n of res.notes) bump(notes, n);
    out.push(res.data);
    if (spec.trackIds) ids.add((res.data as { id: number }).id);
  }
  if (spec.trackIds) {
    ctx.loaded[spec.model] = ids;
    ctx.skipped[spec.model] = skippedIds;
  }
  return {
    rows: out,
    summary: {
      model: spec.model,
      doc: spec.doc,
      sourceTable: spec.sourceTable,
      targetTable: spec.targetTable,
      read: src.length,
      written: 0,
      skipped,
      notes,
      setval: null,
      durationMs: Date.now() - t0,
    },
  };
}

export async function runEtl(opts: EtlOptions, deps: EtlDeps): Promise<EtlSummary> {
  // (1) chốt an toàn — TRƯỚC mọi kết nối. Thông điệp gốc có thể chứa URL (mật khẩu)
  // ⇒ bọc lại bằng thông điệp an toàn chỉ nêu tên CSDL.
  try {
    assertRehearsalTarget(opts.targetUrl, opts.forbiddenUrls);
  } catch {
    throw new EtlSafeError(
      `target-guard TỪ CHỐI đích "${String(extractDatabaseName(opts.targetUrl))}" (cần *_rehearsal, khác CSDL test tbs_test).`,
    );
  }
  // (2) báo cáo chứa số thật ⇒ ngoài repo.
  assertOutsideRepo(opts.outDir, opts.repoRoot);

  const expectedDb = extractDatabaseName(opts.targetUrl);
  const started = opts.now ?? new Date();
  const t0 = Date.now();
  const allow = opts.allowStopAnomalies === true;
  const target = await deps.openTarget(opts.targetUrl);
  let source: SourceDb | null = null;
  try {
    // (3) kiểm lại trên chính kết nối.
    const actualDb = await target.currentDatabase();
    if (actualDb !== expectedDb || !actualDb.endsWith('_rehearsal')) {
      throw new EtlSafeError(
        `ETL: current_database()="${actualDb}" không khớp đích diễn tập "${String(expectedDb)}" — TỪ CHỐI ghi.`,
      );
    }

    source = await deps.openSource();
    const ctx: EtlContext = {
      nowUnix: Math.floor(started.getTime() / 1000),
      approvalStepIds: new Set(
        (await source.query('SELECT `id` FROM `tbl_approval_steps`')).map((r) => Number(r.id)),
      ),
      approvalRequestIds: new Set(
        (await source.query('SELECT `id` FROM `tbl_approval_requests`')).map((r) => Number(r.id)),
      ),
      loaded: {},
      skipped: {},
    };

    // (4) cổng DỪNG phía nguồn — trước MỌI thao tác ghi.
    const anomalies: AnomalySummary[] = [];
    for (const a of ANOMALY_QUERIES) {
      const count = countOf(await source.query(a.sql));
      anomalies.push({
        id: a.id,
        doc: a.doc,
        description: a.description,
        applied: a.applied,
        count,
        stopFlag: !!a.stopIfNonZero && (count ?? 0) > 0,
        signOffFlag: !!a.signOffIfNonZero && (count ?? 0) > 0,
      });
    }
    const stopRulesFired = anomalies.filter((a) => a.stopFlag).map((a) => a.id);
    const summary: EtlSummary = {
      outcome: 'clean',
      allowStopAnomalies: allow,
      stopRulesFired,
      signOffItems: anomalies.filter((a) => a.signOffFlag).map((a) => `${a.id}: ${a.count}`),
      errorName: null,
      startedAt: started.toISOString(),
      finishedAt: '',
      targetDatabase: actualDb,
      tables: [],
      anomalies,
      rulesNotApplied: [...RULES_NOT_APPLIED],
      totalDurationMs: 0,
      reportFiles: [],
    };
    const finish = (outcome: EtlOutcome): EtlSummary => {
      summary.outcome = outcome;
      summary.finishedAt = new Date().toISOString();
      summary.totalDurationMs = Date.now() - t0;
      if (opts.writeReport !== false) summary.reportFiles = writeEtlReport(summary, opts.outDir);
      return summary;
    };

    if (stopRulesFired.length > 0 && !allow) return finish('stopped');

    try {
      // (5) kiểm trước: đọc + ánh xạ TOÀN BỘ, chưa ghi gì.
      const mapped: Mapped[] = [];
      for (const spec of TABLES) {
        const m = await mapTable(spec, source, ctx);
        mapped.push(m);
        summary.tables.push(m.summary);
      }
      // G-DOC-3: giá trị bị chuẩn hoá khi ánh xạ ⇒ mục cần ký.
      for (const m of mapped) {
        for (const [k, v] of Object.entries(m.summary.notes)) {
          if (k.startsWith('G-DOC-3')) summary.signOffItems.push(`${m.summary.model} ${k}: ${v}`);
        }
      }

      // sàn bộ đếm đọc trên nguồn (vẫn TRƯỚC mọi ghi).
      const seqFloor: Record<string, string> = {};
      for (const spec of TABLES) {
        seqFloor[spec.targetTable] = parseSeqFloor(
          spec.sourceTable,
          await source.query(sourceSeqFloorSql(spec.sourceTable)),
        );
      }

      // (6) truncate + nạp + setval — MỘT giao dịch.
      const res = await target.replaceAll({
        seqFloor,
        truncateTables: TABLES.map((t) => t.targetTable),
        steps: TABLES.map((spec, i) => ({
          model: spec.model,
          table: spec.targetTable,
          rows: mapped[i].rows,
          rawJsonInsert: spec.rawJsonInsert === true,
        })),
        chunkSize: opts.chunkSize ?? 500,
      });
      TABLES.forEach((spec, i) => {
        const t = summary.tables[i];
        t.written = res.written[spec.model] ?? 0;
        t.setval = res.setval[spec.targetTable] ?? null;
      });
    } catch (e) {
      summary.errorName = e instanceof Error ? e.name : 'unknown';
      finish('failed');
      throw e;
    }
    return finish(stopRulesFired.length > 0 ? 'loaded_with_stop_anomalies' : 'clean');
  } finally {
    if (source) await source.close();
    await target.close();
  }
}
