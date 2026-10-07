/**
 * TỔNG DUYỆT KHỨ HỒI L13 — dump MySQL → ETL sang Postgres diễn tập → v2 ghi giả lập (service THẬT) →
 * chép ngược về MariaDB diễn tập → kiểm ngược chiều.
 *
 *   npx ts-node scripts/rehearsal/roundtrip.ts
 *
 * ⛔ PHÁ HUỶ — nhưng CHỈ trên hạ tầng diễn tập cục bộ: nạp lại dump vào container `tbs-mariadb-rehearsal`
 *    (load-dump.sh, DROP TABLE IF EXISTS có sẵn trong dump) và ETL lại `tbs_rehearsal` (TRUNCATE). Trước khi
 *    nạp lại: `assertMysqlRehearsalTarget` (127.0.0.1:3307/sql_nhpcn) + `assertMysqlRehearsalServer`
 *    (@@hostname == hostname container đọc bằng docker inspect). PG qua `assertRehearsalTarget` (cấm tbs_test)
 *    + `current_database()`. Không SSH, không kết nối prod. Không có cờ mở chốt.
 * Báo cáo roundtrip-<t>.{json,md} (+ etl-*, copyback-*) ra REHEARSAL_OUT_DIR (ngoài repo) — đếm/id/tên cột.
 *
 * Mã thoát: 0 mọi kiểm PASS · 4 có kiểm FAIL · 1 lỗi.
 */
import 'reflect-metadata';
import { spawnSync } from 'child_process';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as mysql from 'mysql2/promise';
import { collectForbiddenUrls } from '../../src/rehearsal/forbidden-urls';
import { EtlSafeError, Row } from '../../src/rehearsal/etl/convert';
import { PgRow } from '../../src/rehearsal/copyback/convert';
import { pgSelectSql } from '../../src/rehearsal/copyback/pg-image';
import { MysqlTargetConfig } from '../../src/rehearsal/copyback/mysql-target-guard';
import { runCopyback } from '../../src/rehearsal/copyback/runner';
import { RoundtripDeps, RtMysql, RtPg, runRoundtrip } from '../../src/rehearsal/roundtrip/runner';
import { simulateV2Writes } from '../../src/rehearsal/roundtrip/simulate';
import { verdictLine } from '../../src/rehearsal/roundtrip/report';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TreasuryService } from '../../src/money/treasury.service';
import { COPYBACK_DEPS, mysqlConfigFromEnv, readEtlReport } from './copyback';
import { safeErrorText } from './etl';

const DEFAULT_PG = 'postgresql://postgres:postgres@localhost:5433/tbs_rehearsal?schema=public';
const DEFAULT_OUT = 'F:\\01_TBS_GROUP\\_dump_20260925\\rehearsal-out';
const IDENT = /^[a-z_][a-zA-Z0-9_]*$/;

function ident(t: string): string {
  if (!IDENT.test(t)) throw new EtlSafeError(`định danh lạ: ${t}`);
  return `\`${t}\``;
}

async function openMysql(cfg: MysqlTargetConfig): Promise<RtMysql> {
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: 'root',
    password: process.env.REHEARSAL_MARIADB_PASSWORD ?? 'rehearsal_local_only', // chỉ cục bộ (lib.sh)
    database: cfg.database,
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,
    dateStrings: true,
  });
  // Phiên KIỂM chỉ đọc (chép ngược ghi bằng kết nối riêng của copyback).
  await conn.query('SET SESSION TRANSACTION READ ONLY');
  const one = async (sql: string, params: unknown[] = []): Promise<string | null> => {
    const [rows] = await conn.query(sql, params);
    const r = (rows as Record<string, unknown>[])[0];
    const v = r === undefined ? null : Object.values(r)[0];
    return v === null || v === undefined ? null : String(v);
  };
  return {
    async identity() {
      const [rows] = await conn.query(
        'SELECT @@hostname AS hostname, @@version AS version, @@SESSION.sql_mode AS sqlMode, DATABASE() AS db',
      );
      const r = (rows as Record<string, string>[])[0];
      return { hostname: r.hostname, version: r.version, sqlMode: r.sqlMode, database: r.db };
    },
    async selectAll(t) {
      const [rows] = await conn.query(`SELECT * FROM ${ident(t)} ORDER BY \`id\``);
      return rows as Row[];
    },
    maxId: (t) => one(`SELECT MAX(\`id\`) FROM ${ident(t)}`),
    autoIncrement: (t) =>
      one('SELECT `AUTO_INCREMENT` FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [t]),
    async accounts() {
      const [rows] = await conn.query('SELECT code, opening_balance FROM tbl_accounts ORDER BY id');
      return rows as Row[];
    },
    async treasurySums() {
      // cls.treasury.php getBalances(): SELECT tk_code, SUM(money) … WHERE status=1 GROUP BY tk_code
      const [rows] = await conn.query('SELECT tk_code, SUM(money) AS s FROM tbl_account_histories WHERE status=1 GROUP BY tk_code');
      return rows as Row[];
    },
    async close() {
      await conn.end();
    },
  };
}

async function openPg(url: string): Promise<RtPg> {
  // url đã qua assertRehearsalTarget trong runRoundtrip; runner kiểm current_database() ngay sau khi mở.
  const p = new PrismaClient({ datasources: { db: { url } } });
  await p.$connect();
  const svc = p as unknown as PrismaService;
  return {
    async currentDatabase() {
      return (await p.$queryRawUnsafe<{ db: string }[]>('SELECT current_database() AS db'))[0].db;
    },
    selectTable: (spec) => p.$queryRawUnsafe<PgRow[]>(pgSelectSql(spec.table, spec.pgColumns)),
    getBalances: () => new TreasuryService(svc).getBalances(),
    simulate: (db) => simulateV2Writes(svc, db),
    async close() {
      await p.$disconnect();
    },
  };
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv, capture: boolean): { status: number; out: string } {
  const r = spawnSync(cmd, args, {
    cwd: path.resolve(__dirname, '..', '..'),
    env,
    encoding: 'utf8',
    shell: false, // không qua shell: tham số không bị ghép chuỗi (DEP0190)
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw new EtlSafeError(`không chạy được ${cmd}: ${r.error.name}`);
  if (capture && r.stdout) process.stdout.write(r.stdout); // ETL chỉ in số đếm
  return { status: r.status ?? 1, out: r.stdout ?? '' };
}

async function main(): Promise<number> {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const pgUrl = process.env.REHEARSAL_DATABASE_URL ?? DEFAULT_PG;
  const outDir = process.env.REHEARSAL_OUT_DIR ?? DEFAULT_OUT;
  const forbiddenUrls = collectForbiddenUrls(repoRoot);
  const cfg = mysqlConfigFromEnv();
  const env = { ...process.env, REHEARSAL_DATABASE_URL: pgUrl, REHEARSAL_OUT_DIR: outDir };

  const deps: RoundtripDeps = {
    containerHostname: COPYBACK_DEPS.containerHostname,
    openMysql,
    async reloadDump() {
      const r = run('bash', ['scripts/rehearsal/load-dump.sh'], env, false);
      if (r.status !== 0) throw new EtlSafeError(`load-dump.sh thoát ${r.status} — DỪNG`);
    },
    async runEtl() {
      // node + ts-node trực tiếp (không npx.cmd ⇒ không cần shell trên Windows).
      const tsNode = require.resolve('ts-node/dist/bin.js');
      const r = run(process.execPath, [tsNode, 'scripts/rehearsal/etl.ts', '--allow-stop-anomalies'], env, true);
      const m = /report: (\S+\.json)/.exec(r.out);
      if (!m) throw new EtlSafeError(`ETL thoát ${r.status} và không in đường dẫn báo cáo — DỪNG`);
      return { exitCode: r.status, reportFile: m[1] };
    },
    readEtlReport,
    openPg,
    copyback: (o) =>
      runCopyback(
        { pgUrl, forbiddenUrls, mysql: cfg, outDir, repoRoot, v2IdStart: o.v2IdStart, etlReportDatabase: o.etlReportDatabase },
        COPYBACK_DEPS,
      ),
  };

  const s = await runRoundtrip({ pgUrl, forbiddenUrls, mysql: cfg, outDir, repoRoot }, deps);
  for (const st of s.simulation.steps) console.log(`sim ${st.id} ${st.ok ? 'ok ' : 'LỖI'} ${st.via}`);
  for (const c of s.copyback) console.log(`copyback lần ${c.run}: ${c.outcome} (exit ${c.exitCode})`);
  for (const c of s.checks) console.log(`${c.status.padEnd(4)} ${c.id} — ${c.title}`);
  console.log(verdictLine(s));
  console.log(`report: ${s.reportFiles.join(' , ')}`);
  return s.exitCode;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((e: unknown) => {
      console.error(safeErrorText(e));
      process.exit(1);
    });
}
