/**
 * Cổng nghiệm thu diễn tập L0 — MariaDB diễn tập (dump tĩnh) ↔ Postgres `*_rehearsal`. CHỈ ĐỌC.
 *
 *   npx ts-node scripts/rehearsal/gates.ts
 *
 * ⛔ An toàn:
 *  - Đích lấy từ REHEARSAL_DATABASE_URL (mặc định tbs_rehearsal cổng 5433); `runGates()` gọi
 *    `assertRehearsalTarget()` (DATABASE_URL của .env/.env.test là danh sách cấm) TRƯỚC khi mở kết nối.
 *  - Postgres mở với `options=-c default_transaction_read_only=on` + `connection_limit=1`; runner kiểm
 *    `SHOW default_transaction_read_only`='on' trước và sau khi chạy. MariaDB: `SET SESSION TRANSACTION
 *    READ ONLY`, kiểm `@@session.tx_read_only`=1. Cả hai adapter từ chối câu không bắt đầu bằng SELECT/SHOW.
 *  - Service v2 dựng trên PrismaClient read-only đó. Đích KHÔNG có user/vai (#01 chưa nạp) ⇒ cổng quyền
 *    của service được thay bằng stub TRONG tiến trình này (chỉ để gọi hàm ĐỌC); không ghi gì.
 *  - Báo cáo chỉ số đếm/tổng, ra REHEARSAL_OUT_DIR (mặc định F:\01_TBS_GROUP\_dump_20260925\rehearsal-out).
 *
 * Mã thoát: 0 mọi cổng PASS/SKIPPED · 4 có FAIL · 1 lỗi/ERROR.
 */
import 'reflect-metadata';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as mysql from 'mysql2/promise';
import { collectForbiddenUrls } from '../../src/rehearsal/forbidden-urls';
import { ALL_GATES } from '../../src/rehearsal/gates/registry';
import { GateDeps, GateSafeError, GateSourceDb, GateTargetDb, exitCodeForGates, runGates } from '../../src/rehearsal/gates/runner';
import { GoldenServices } from '../../src/rehearsal/gates/golden';
import { Row } from '../../src/rehearsal/gates/types';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PermService } from '../../src/iam/perm.service';
import { ScopeService } from '../../src/iam/scope.service';
import { TreasuryService } from '../../src/money/treasury.service';
import { FxQuyTeReader } from '../../src/money/fx-quyte.reader';
import { TreasuryReportService } from '../../src/treasury/treasury-report.service';
import { BankReconService } from '../../src/bank/bank-recon.service';
import { PoTienNccService } from '../../src/po/po-tien-ncc.service';

const DEFAULT_TARGET = 'postgresql://postgres:postgres@localhost:5433/tbs_rehearsal?schema=public';
const DEFAULT_OUT = 'F:\\01_TBS_GROUP\\_dump_20260925\\rehearsal-out';
const READ_RE = /^\s*(\/\*[^*]*\*\/\s*)?(SELECT|SHOW)\b/i;

function assertRead(sql: string): void {
  if (!READ_RE.test(sql)) throw new GateSafeError('gates: adapter chỉ chạy câu SELECT/SHOW — từ chối.');
}

export async function openSource(): Promise<GateSourceDb> {
  const conn = await mysql.createConnection({
    host: process.env.REHEARSAL_MARIADB_HOST ?? '127.0.0.1',
    port: Number(process.env.REHEARSAL_MARIADB_PORT ?? 3307),
    user: 'root',
    password: process.env.REHEARSAL_MARIADB_PASSWORD ?? 'rehearsal_local_only', // chỉ cục bộ (lib.sh)
    database: 'sql_nhpcn',
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,
    dateStrings: true,
  });
  // Không phải ghi dữ liệu: đặt đặc tính phiên (chỉ đọc + múi giờ prod `SYSTEM`=+07 cho FROM_UNIXTIME).
  await conn.query('SET SESSION TRANSACTION READ ONLY');
  await conn.query("SET SESSION time_zone='+07:00'");
  return {
    async query(sql: string): Promise<Row[]> {
      assertRead(sql);
      const [rows] = await conn.query({ sql, rowsAsArray: false });
      return rows as Row[];
    },
    async readOnly() {
      const [rows] = await conn.query('SELECT @@session.tx_read_only AS ro');
      return String((rows as Row[])[0]?.ro) === '1';
    },
    async close() {
      await conn.end();
    },
  };
}

function readOnlyUrl(url: string): string {
  const u = new URL(url);
  u.searchParams.set('connection_limit', '1');
  u.searchParams.set('options', '-c default_transaction_read_only=on');
  return u.toString();
}

function buildServices(p: PrismaService): GoldenServices {
  const treasury = new TreasuryService(p);
  const fxq = new FxQuyTeReader(p, treasury);
  // Đích diễn tập không có user/vai ⇒ mọi quyền = phạm vi 'all' CHỈ trong tiến trình diễn tập (hàm đọc).
  const perm = { scopeOf: async () => 'all' } as unknown as PermService;
  const report = new TreasuryReportService(p, perm, treasury, fxq);
  const recon = new BankReconService(p);
  (recon as unknown as { canKeToan: () => Promise<void> }).canKeToan = async () => undefined;
  const ptn = new PoTienNccService(p, {} as ScopeService);
  (ptn as unknown as { canXemPo: () => Promise<void> }).canXemPo = async () => undefined;
  return {
    treasury,
    report: report as unknown as GoldenServices['report'],
    poTienNcc: (poId: number) => ptn.poTienNcc(1, poId),
    recon: recon as unknown as GoldenServices['recon'],
  };
}

export async function openTarget(url: string): Promise<GateTargetDb> {
  // PrismaClient dựng với ĐÚNG url đã qua target-guard (runGates gọi guard trước hàm này).
  const p = new PrismaClient({ datasources: { db: { url: readOnlyUrl(url) } } }) as unknown as PrismaService;
  await p.$connect();
  const services = buildServices(p);
  return {
    async query(sql: string): Promise<Row[]> {
      assertRead(sql);
      return p.$queryRawUnsafe<Row[]>(sql);
    },
    async currentDatabase() {
      const r = await p.$queryRawUnsafe<{ db: string }[]>('SELECT current_database() AS db');
      return r[0].db;
    },
    async readOnly() {
      const r = await p.$queryRawUnsafe<{ ro: string }[]>('SHOW default_transaction_read_only');
      const r2 = await p.$queryRawUnsafe<{ t: string }[]>('SHOW transaction_read_only');
      return Object.values(r[0])[0] === 'on' && Object.values(r2[0])[0] === 'on';
    },
    services: () => services,
    async close() {
      await p.$disconnect();
    },
  };
}

async function main(): Promise<number> {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const deps: GateDeps = { openSource, openTarget };
  const s = await runGates(
    {
      targetUrl: process.env.REHEARSAL_DATABASE_URL ?? DEFAULT_TARGET,
      forbiddenUrls: collectForbiddenUrls(repoRoot),
      outDir: process.env.REHEARSAL_OUT_DIR ?? DEFAULT_OUT,
      repoRoot,
      gates: ALL_GATES,
    },
    deps,
  );
  // Console: chỉ id + trạng thái (không số tiền).
  for (const r of s.results) console.log(`${r.status.padEnd(7)} ${r.id}`);
  console.log(`gates=${s.results.length} PASS=${s.counts.PASS} FAIL=${s.counts.FAIL} SKIPPED=${s.counts.SKIPPED} ERROR=${s.counts.ERROR}`);
  console.log(`report: ${s.reportFiles.join(' , ')}`);
  return exitCodeForGates(s);
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((e: unknown) => {
      console.error(e instanceof GateSafeError ? e.message : e instanceof Error ? e.name : 'unknown error');
      process.exit(1);
    });
}
