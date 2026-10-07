/**
 * CHÉP NGƯỢC L13 — Postgres v2 (`*_rehearsal`) → MySQL (CHỈ MariaDB diễn tập cục bộ).
 *
 * ⛔ Nguồn PG lấy từ REHEARSAL_DATABASE_URL (mặc định tbs_rehearsal cổng 5433),
 * qua `assertRehearsalTarget` (cấm DATABASE_URL của .env/.env.test = tbs_test).
 * ⛔ Đích MySQL: 127.0.0.1:3307 / sql_nhpcn — `mysql-target-guard` từ chối mọi máy
 * khác TRƯỚC khi kết nối, rồi sau khi kết nối kiểm @@hostname == hostname container
 * `tbs-mariadb-rehearsal` (đọc bằng `docker inspect`). KHÔNG có cờ nào mở chốt.
 * Báo cáo chỉ số đếm + id kỹ thuật, ra REHEARSAL_OUT_DIR (mặc định
 * F:\01_TBS_GROUP\_dump_20260925\rehearsal-out).
 *
 *   npx ts-node scripts/rehearsal/copyback.ts [--dry-run] [--etl-report=<etl-*.json>]
 *
 * Mã thoát: 0 sạch · 1 lỗi (đã rollback) · 5 = mục cần người xem: dòng ≤ mốc khác, dòng lỗ,
 * v2 xoá cứng, đổi giá trị do ép kiểu (phần mới VẪN chép) · trùng khoá UNIQUE (HUỶ, không ghi
 * gì) · ALTER AUTO_INCREMENT hỏng SAU commit (dữ liệu đã commit).
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as mysql from 'mysql2/promise';
import { collectForbiddenUrls } from '../../src/rehearsal/forbidden-urls';
import { EtlSafeError, Row } from '../../src/rehearsal/etl/convert';
import { PgRow } from '../../src/rehearsal/copyback/convert';
import {
  MysqlTargetConfig,
  REHEARSAL_MYSQL,
  resolveRehearsalContainer,
} from '../../src/rehearsal/copyback/mysql-target-guard';
import {
  CopybackDeps,
  MysqlTarget,
  PgSource,
  copybackExitCode,
  runCopyback,
} from '../../src/rehearsal/copyback/runner';
import { COPYBACK_TABLES } from '../../src/rehearsal/copyback/tables';
import { safeErrorText } from './etl';

const DEFAULT_PG = 'postgresql://postgres:postgres@localhost:5433/tbs_rehearsal?schema=public';
const DEFAULT_OUT = 'F:\\01_TBS_GROUP\\_dump_20260925\\rehearsal-out';

const IDENT = /^[a-z_][a-zA-Z0-9_]*$/;
function ident(t: string): string {
  if (!IDENT.test(t)) throw new EtlSafeError(`định danh lạ: ${t}`);
  return `\`${t}\``;
}

async function openSource(url: string): Promise<PgSource> {
  // PrismaClient dựng với ĐÚNG url đã qua target-guard (runCopyback gọi guard trước hàm này).
  const p = new PrismaClient({ datasources: { db: { url } } });
  await p.$connect();
  return {
    async currentDatabase() {
      const r = await p.$queryRawUnsafe<{ db: string }[]>('SELECT current_database() AS db');
      return r[0].db;
    },
    async query(sql: string) {
      return p.$queryRawUnsafe<PgRow[]>(sql); // mọi cột ::text ⇒ chuỗi/NULL
    },
    async close() {
      await p.$disconnect();
    },
  };
}

async function openTarget(cfg: MysqlTargetConfig): Promise<MysqlTarget> {
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: 'root',
    password: process.env.REHEARSAL_MARIADB_PASSWORD ?? 'rehearsal_local_only', // chỉ cục bộ (lib.sh)
    database: cfg.database,
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: true, // bigint → chuỗi
    decimalNumbers: false, // decimal → chuỗi (không qua float)
    dateStrings: true,
    multipleStatements: false,
  });
  const one = async <T>(sql: string, params: unknown[] = []): Promise<T | null> => {
    const [rows] = await conn.query(sql, params);
    const r = (rows as Record<string, unknown>[])[0];
    return r === undefined ? null : (Object.values(r)[0] as T);
  };
  return {
    async identity() {
      const [rows] = await conn.query(
        'SELECT @@hostname AS hostname, @@version AS version, @@SESSION.sql_mode AS sqlMode, DATABASE() AS db',
      );
      const r = (rows as Record<string, string>[])[0];
      return { hostname: r.hostname, version: r.version, sqlMode: r.sqlMode, database: r.db };
    },
    async begin() {
      await conn.beginTransaction();
    },
    async maxId(table) {
      const v = await one<string | number | null>(`SELECT MAX(\`id\`) FROM ${ident(table)}`);
      return v === null ? null : String(v);
    },
    async selectRows(table, columns) {
      const [rows] = await conn.query(
        `SELECT ${columns.map(ident).join(', ')} FROM ${ident(table)} ORDER BY \`id\``,
      );
      return rows as Row[];
    },
    async selectIds(table) {
      const [rows] = await conn.query(`SELECT \`id\` FROM ${ident(table)}`);
      return (rows as Record<string, unknown>[]).map((r) => String(r.id));
    },
    async uniqueKeys(table) {
      const [rows] = await conn.query(
        'SELECT INDEX_NAME AS name, COLUMN_NAME AS col FROM information_schema.STATISTICS ' +
          "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND NON_UNIQUE = 0 AND INDEX_NAME <> 'PRIMARY' " +
          'ORDER BY INDEX_NAME, SEQ_IN_INDEX',
        [table],
      );
      const keys = new Map<string, string[]>();
      for (const r of rows as { name: string; col: string }[]) keys.set(r.name, [...(keys.get(r.name) ?? []), r.col]);
      return [...keys].map(([name, columns]) => ({ name, columns }));
    },
    async findUniqueConflict(table, columns, values) {
      // so bằng collation THẬT của cột MySQL (tham số hoá, định danh đã kiểm)
      const where = columns.map((c) => `${ident(c)} = ?`).join(' AND ');
      const [rows] = await conn.query(`SELECT 1 AS x FROM ${ident(table)} WHERE ${where} LIMIT 1`, values);
      return (rows as unknown[]).length > 0;
    },
    async insert(table, columns, rows) {
      const [res] = await conn.query(`INSERT INTO ${ident(table)} (${columns.map(ident).join(', ')}) VALUES ?`, [rows]);
      const h = res as mysql.ResultSetHeader;
      return { affected: h.affectedRows, warnings: h.warningStatus };
    },
    async commit() {
      await conn.commit();
    },
    async rollback() {
      await conn.rollback();
    },
    async autoIncrement(table) {
      const v = await one<string | number | null>(
        'SELECT `AUTO_INCREMENT` FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table],
      );
      return v === null ? null : String(v);
    },
    async setAutoIncrement(table, value) {
      if (!/^\d+$/.test(value)) throw new EtlSafeError('AUTO_INCREMENT phải là số nguyên dương');
      await conn.query(`ALTER TABLE ${ident(table)} AUTO_INCREMENT = ${value}`);
    },
    async close() {
      await conn.end();
    },
  };
}

function containerHostname(): string {
  return resolveRehearsalContainer((args) =>
    execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
  );
}

export const COPYBACK_DEPS: CopybackDeps = { openSource, openTarget, containerHostname };

export function mysqlConfigFromEnv(env: Record<string, string | undefined> = process.env): MysqlTargetConfig {
  return {
    host: env.REHEARSAL_MARIADB_HOST ?? '127.0.0.1',
    port: Number(env.REHEARSAL_MARIADB_PORT ?? REHEARSAL_MYSQL.port),
    database: REHEARSAL_MYSQL.database,
  };
}

export interface EtlReportInfo {
  /** CSDL đích của lần ETL — runner so với current_database() (N1). */
  targetDatabase: string;
  /** id ĐẦU TIÊN v2 cấp theo bảng = `setval` của lần ETL (bảng đích). */
  v2IdStart: Record<string, string>;
  /** số dòng ETL đã nạp theo bảng đích (`written`) — khứ hồi đòi bảng có dòng thì mốc không rỗng. */
  loaded: Record<string, number>;
}

/**
 * `--etl-report=<etl-*.json>`: CSDL đích + setval ĐỦ 17 bảng chép ngược. Dòng có id ≥ setval là dòng
 * v2 tạo — lần chép thứ hai so chúng ở mức MySQL. Thiếu CSDL/bảng/setval ⇒ TỪ CHỐI (không đoán);
 * runner còn kiểm CSDL = current_database() và setval ≥ sàn nguồn hiện tại (N1).
 */
export function readEtlReport(file: string): EtlReportInfo {
  const j = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    targetDatabase?: unknown;
    tables?: { targetTable?: unknown; setval?: unknown; written?: unknown }[];
  };
  if (typeof j.targetDatabase !== 'string' || j.targetDatabase === '') {
    throw new EtlSafeError('--etl-report: báo cáo không có targetDatabase — TỪ CHỐI');
  }
  const v2IdStart: Record<string, string> = {};
  const loaded: Record<string, number> = {};
  for (const t of j.tables ?? []) {
    if (typeof t.targetTable === 'string' && typeof t.written === 'number') loaded[t.targetTable] = t.written;
    if (typeof t.targetTable === 'string' && typeof t.setval === 'string' && /^\d+$/.test(t.setval)) {
      v2IdStart[t.targetTable] = t.setval;
    }
  }
  const missing = COPYBACK_TABLES.map((s) => s.table).filter((t) => v2IdStart[t] === undefined);
  if (missing.length > 0) throw new EtlSafeError(`--etl-report: thiếu setval của bảng ${missing.join(', ')} — TỪ CHỐI`);
  return { targetDatabase: j.targetDatabase, v2IdStart, loaded };
}

async function main(): Promise<number> {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const etlArg = process.argv.find((a) => a.startsWith('--etl-report='));
  const etl = etlArg ? readEtlReport(etlArg.slice('--etl-report='.length)) : undefined;
  const summary = await runCopyback(
    {
      pgUrl: process.env.REHEARSAL_DATABASE_URL ?? DEFAULT_PG,
      forbiddenUrls: collectForbiddenUrls(repoRoot),
      mysql: mysqlConfigFromEnv(),
      outDir: process.env.REHEARSAL_OUT_DIR ?? DEFAULT_OUT,
      repoRoot,
      dryRun: process.argv.includes('--dry-run'),
      v2IdStart: etl?.v2IdStart,
      etlReportDatabase: etl?.targetDatabase,
    },
    COPYBACK_DEPS,
  );
  // Chỉ số đếm ra console.
  for (const t of summary.tables) {
    console.log(
      `${t.model.padEnd(22)} mốc=${t.mark} pg=${t.pgRead} mới=${t.newRows} lỗ=${t.gapRows} chép=${t.copied} ` +
        `ép=${t.coercedRows} khác≤mốc=${t.modifiedOld} mysqlOnly=${t.mysqlOnlyRows} xoá=${t.deletedRows} ` +
        `AI=${t.autoIncrementBefore}→${t.autoIncrementAfter}`,
    );
  }
  if (summary.uniqueConflicts.length > 0) console.log(`uniqueConflicts=${summary.uniqueConflicts.length}`);
  console.log(`outcome=${summary.outcome} dryRun=${summary.dryRun} — ${summary.outcomeMessage}`);
  console.log(`report: ${summary.reportFiles.join(' , ')}`);
  return copybackExitCode(summary.outcome);
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((e: unknown) => {
      console.error(safeErrorText(e));
      process.exit(1);
    });
}
