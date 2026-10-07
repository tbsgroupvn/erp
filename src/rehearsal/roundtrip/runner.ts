/**
 * L13 Task 2 — TỔNG DUYỆT KHỨ HỒI trên hạ tầng L0: `runRoundtrip()`.
 *
 *  (0) chốt TRƯỚC mọi kết nối: PG `assertRehearsalTarget` (cấm tbs_test) + MySQL tĩnh
 *      `assertMysqlRehearsalTarget` + thư mục báo cáo ngoài repo;
 *  (1) mở MySQL, `assertMysqlRehearsalServer` (@@hostname == container diễn tập) — CHỈ SAU ĐÓ mới nạp lại
 *      dump (phá huỷ, nhưng chỉ trên container cục bộ), rồi kiểm lại danh tính máy chủ;
 *  (2) ETL (script L0, `--allow-stop-anomalies`: mã 0 hoặc 3) ⇒ báo cáo ETL (setval + CSDL đích);
 *  (3) mốc MySQL từng bảng: id + băm dòng ≤ MAX(id);
 *  (4) GIẢ LẬP ghi trên v2 bằng service THẬT (simulate.ts) ⇒ cờ KỲ VỌNG;
 *  (5) chép ngược lần 1 (`--etl-report`) ⇒ kiểm cờ, dòng mới từng cột, dòng cũ không đổi, AUTO_INCREMENT,
 *      số dư quỹ prod-formula MariaDB == getBalances() PG;
 *  (6) chép ngược lần 2 ⇒ 0 dòng mới, không cờ mới; dòng cũ + dòng đã chép không đổi; AUTO_INCREMENT.
 *  Báo cáo roundtrip-<t>.{json,md} ra ngoài repo (đếm/tổng/id kỹ thuật). Mã: 0 PASS · 4 FAIL · 1 lỗi.
 */
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { assertRehearsalTarget, extractDatabaseName } from '../target-guard';
import { EtlSafeError, Row } from '../etl/convert';
import { PgRow } from '../copyback/convert';
import {
  MysqlServerIdentity,
  MysqlTargetConfig,
  assertMysqlRehearsalServer,
  assertMysqlRehearsalTarget,
} from '../copyback/mysql-target-guard';
import { CopybackSummary, copybackExitCode } from '../copyback/runner';
import { CopybackSpec } from '../copyback/spec';
import { COPYBACK_TABLES } from '../copyback/tables';
import {
  TableHash,
  checkAutoIncrement,
  checkBalances,
  checkChecksums,
  checkFlags,
  checkNewRows,
  checkSecondRun,
  prodBalances,
  roundtripExitCode,
  tableHash,
} from './checks';
import { writeRoundtripReport } from './report';
import { CheckResult, SimulationResult } from './types';

type Dec = Prisma.Decimal;

export interface RtMysql {
  identity(): Promise<MysqlServerIdentity>;
  /** SELECT * ORDER BY id (mysql2: decimal/bigint dạng chuỗi, ngày dạng chuỗi). */
  selectAll(table: string): Promise<Row[]>;
  maxId(table: string): Promise<string | null>;
  autoIncrement(table: string): Promise<string | null>;
  /** `SELECT code, opening_balance FROM tbl_accounts ORDER BY id` */
  accounts(): Promise<Row[]>;
  /** `SELECT tk_code, SUM(money) AS s FROM tbl_account_histories WHERE status=1 GROUP BY tk_code` */
  treasurySums(): Promise<Row[]>;
  close(): Promise<void>;
}

export interface RtPg {
  currentDatabase(): Promise<string>;
  selectTable(spec: CopybackSpec): Promise<PgRow[]>;
  /** `TreasuryService.getBalances()` v2. */
  getBalances(): Promise<Map<string, Dec>>;
  /** giả lập ghi v2 bằng service thật. */
  simulate(expectedDb: string): Promise<SimulationResult>;
  close(): Promise<void>;
}

export interface EtlRun {
  exitCode: number;
  reportFile: string;
}

export interface RoundtripDeps {
  containerHostname(): string;
  openMysql(cfg: MysqlTargetConfig): Promise<RtMysql>;
  /** nạp lại 4 tệp dump vào container diễn tập (load-dump.sh). */
  reloadDump(): Promise<void>;
  runEtl(): Promise<EtlRun>;
  readEtlReport(file: string): { targetDatabase: string; v2IdStart: Record<string, string>; loaded: Record<string, number> };
  openPg(url: string): Promise<RtPg>;
  copyback(o: { v2IdStart: Record<string, string>; etlReportDatabase: string }): Promise<CopybackSummary>;
}

export interface RoundtripOptions {
  pgUrl: string;
  forbiddenUrls: readonly string[];
  mysql: MysqlTargetConfig;
  outDir: string;
  repoRoot: string;
  writeReport?: boolean;
  now?: Date;
}

export interface RoundtripSummary {
  verdict: 'PASS' | 'FAIL';
  exitCode: number;
  startedAt: string;
  finishedAt: string;
  pgDatabase: string;
  mysqlHost: string;
  etl: { exitCode: number; reportFile: string };
  simulation: SimulationResult;
  copyback: { run: number; outcome: string; exitCode: number; reportFiles: string[] }[];
  checks: CheckResult[];
  notes: string[];
  reportFiles: string[];
}

/** ETL L0 trên dump 25/09: 0 = sạch, 3 = nạp nhờ --allow-stop-anomalies (A8/A9 đã biết). */
const ETL_OK = new Set([0, 3]);

export const ROUNDTRIP_NOTES: readonly string[] = [
  'Mã thoát chép ngược 5 ở CẢ hai lần là CÓ CHỦ ĐÍCH: giả lập cố ý sửa + xoá cứng dòng trước cutover và ghi rate 6 số lẻ; phép kiểm R-co/R-lan-2 đòi công cụ BÁO đúng các mục đó (im lặng = FAIL).',
  'Dòng trước cutover bị v2 sửa/xoá KHÔNG được công cụ ghi đè/xoá ở MySQL — xử lý tay theo README "Quay lui R1 — xử lý dòng bị gắn cờ".',
  'Cổng quyền/danh tính service thay bằng stub trong tiến trình (đích diễn tập chưa có user/vai #01); GL stub (#03 chưa nạp).',
];

function assertOutsideRepo(outDir: string, repoRoot: string): void {
  const rel = path.relative(path.resolve(repoRoot), path.resolve(outDir));
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new EtlSafeError(`khứ hồi: thư mục báo cáo phải nằm ngoài repo (dữ liệu thật) — nhận ${outDir}`);
  }
}

interface Snapshot {
  rows: Record<string, Row[]>;
  max: Record<string, string | null>;
  ai: Record<string, string | null>;
}

async function snapshot(my: RtMysql): Promise<Snapshot> {
  const s: Snapshot = { rows: {}, max: {}, ai: {} };
  for (const spec of COPYBACK_TABLES) {
    s.rows[spec.table] = await my.selectAll(spec.table);
    s.max[spec.table] = await my.maxId(spec.table);
    s.ai[spec.table] = await my.autoIncrement(spec.table);
  }
  return s;
}

function hashes(s: Snapshot, marks: Record<string, string | null>): Record<string, TableHash> {
  const out: Record<string, TableHash> = {};
  for (const spec of COPYBACK_TABLES) {
    const m = marks[spec.table];
    out[spec.table] = tableHash(s.rows[spec.table], m === null ? null : BigInt(m));
  }
  return out;
}

const aiRows = (s: Snapshot) => COPYBACK_TABLES.map((t) => ({ table: t.table, max: s.max[t.table], ai: s.ai[t.table] }));

export async function runRoundtrip(opts: RoundtripOptions, deps: RoundtripDeps): Promise<RoundtripSummary> {
  // (0)
  try {
    assertRehearsalTarget(opts.pgUrl, opts.forbiddenUrls);
  } catch {
    throw new EtlSafeError(
      `target-guard TỪ CHỐI PG "${String(extractDatabaseName(opts.pgUrl))}" (cần *_rehearsal, khác CSDL test tbs_test).`,
    );
  }
  assertMysqlRehearsalTarget(opts.mysql);
  assertOutsideRepo(opts.outDir, opts.repoRoot);
  const expectedPg = String(extractDatabaseName(opts.pgUrl));
  const started = opts.now ?? new Date();

  // (1) xác nhận ĐÚNG container diễn tập TRƯỚC khi nạp lại (phá huỷ).
  const probe = await deps.openMysql(opts.mysql);
  try {
    assertMysqlRehearsalServer(await probe.identity(), deps.containerHostname());
  } finally {
    await probe.close();
  }
  await deps.reloadDump();

  // (2)
  const etl = await deps.runEtl();
  if (!ETL_OK.has(etl.exitCode)) throw new EtlSafeError(`khứ hồi: ETL thoát ${etl.exitCode} (cần 0 hoặc 3) — DỪNG`);
  const etlInfo = deps.readEtlReport(etl.reportFile);
  if (etlInfo.targetDatabase !== expectedPg) {
    throw new EtlSafeError(`khứ hồi: báo cáo ETL ghi CSDL "${etlInfo.targetDatabase}" ≠ "${expectedPg}" — DỪNG`);
  }

  const my = await deps.openMysql(opts.mysql);
  let pg: RtPg | null = null;
  try {
    assertMysqlRehearsalServer(await my.identity(), deps.containerHostname());
    pg = await deps.openPg(opts.pgUrl);
    const pgDb = await pg.currentDatabase();
    if (pgDb !== expectedPg || !pgDb.endsWith('_rehearsal')) {
      throw new EtlSafeError(`khứ hồi: PG current_database()="${pgDb}" không khớp "${expectedPg}" — TỪ CHỐI.`);
    }

    // (3) mốc
    const base = await snapshot(my);
    const baseHash = hashes(base, base.max);
    const baseIds: Record<string, Set<string>> = {};
    for (const t of COPYBACK_TABLES) baseIds[t.table] = new Set(base.rows[t.table].map((r) => String(r.id)));

    // (4)
    const sim = await pg.simulate(expectedPg);
    const checks: CheckResult[] = [];
    const failedSteps = sim.steps.filter((x) => !x.ok).map((x) => x.id);
    checks.push({
      id: 'R-mo-phong', title: 'mọi bước giả lập ghi v2 (service thật) chạy đúng kết quả mong đợi',
      status: failedSteps.length === 0 && sim.steps.length > 0 ? 'PASS' : 'FAIL',
      details: { steps: sim.steps.length, failedSteps, expectedFlags: sim.expected },
    });

    // (5) chép ngược lần 1
    const cb1 = await deps.copyback({ v2IdStart: etlInfo.v2IdStart, etlReportDatabase: etlInfo.targetDatabase });
    const after1 = await snapshot(my);
    checks.push(checkFlags('R-co-lan-1', sim.expected, cb1));
    const input = [];
    for (const spec of COPYBACK_TABLES) {
      input.push({ spec, baselineIds: baseIds[spec.table], mysqlAfter: after1.rows[spec.table], pg: await pg.selectTable(spec) });
    }
    checks.push(checkNewRows(input));
    checks.push(checkChecksums('R-dong-cu-lan-1', 'dòng ≤ mốc ở MySQL KHÔNG đổi sau chép lần 1 (băm mọi cột)', baseHash, hashes(after1, base.max), etlInfo.loaded));
    checks.push(checkAutoIncrement('R-ai-lan-1', aiRows(after1)));
    const prod = prodBalances(await my.accounts(), await my.treasurySums());
    checks.push(checkBalances(prod, await pg.getBalances()));

    // (6) chép ngược lần 2
    const cb2 = await deps.copyback({ v2IdStart: etlInfo.v2IdStart, etlReportDatabase: etlInfo.targetDatabase });
    const after2 = await snapshot(my);
    checks.push(checkSecondRun('R-lan-2', sim.expected, cb2));
    checks.push(
      checkChecksums('R-dong-cu-lan-2', 'sau chép lần 2: dòng ≤ mốc VÀ dòng đã chép ở lần 1 KHÔNG đổi', hashes(after1, after1.max), hashes(after2, after1.max), etlInfo.loaded),
    );
    checks.push(checkAutoIncrement('R-ai-lan-2', aiRows(after2)));

    const exitCode = roundtripExitCode(checks);
    const summary: RoundtripSummary = {
      verdict: exitCode === 0 ? 'PASS' : 'FAIL',
      exitCode,
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
      pgDatabase: pgDb,
      mysqlHost: `${opts.mysql.host}:${opts.mysql.port}/${opts.mysql.database}`,
      etl: { exitCode: etl.exitCode, reportFile: etl.reportFile },
      simulation: sim,
      copyback: [cb1, cb2].map((c, i) => ({
        run: i + 1, outcome: c.outcome, exitCode: copybackExitCode(c.outcome), reportFiles: c.reportFiles,
      })),
      checks,
      notes: [...ROUNDTRIP_NOTES],
      reportFiles: [],
    };
    if (opts.writeReport !== false) summary.reportFiles = writeRoundtripReport(summary, opts.outDir);
    return summary;
  } finally {
    if (pg) await pg.close();
    await my.close();
  }
}
