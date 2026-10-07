/**
 * ETL diễn tập L0 — MariaDB diễn tập (dump tĩnh) → Postgres `*_rehearsal`.
 *
 * ⛔ Đích lấy từ REHEARSAL_DATABASE_URL (mặc định tbs_rehearsal cổng 5433);
 * `runEtl()` gọi `assertRehearsalTarget()` với DATABASE_URL của .env/.env.test
 * làm danh sách cấm TRƯỚC khi mở kết nối, rồi kiểm lại `current_database()`.
 * Ghi thẳng bằng Prisma (không qua service nghiệp vụ), truncate + nạp + setval
 * trong MỘT giao dịch. Báo cáo chỉ số đếm, ra REHEARSAL_OUT_DIR (mặc định
 * F:\01_TBS_GROUP\_dump_20260925\rehearsal-out).
 *
 *   npx ts-node scripts/rehearsal/etl.ts [--allow-stop-anomalies]
 *   (hoặc REHEARSAL_ALLOW_STOP_ANOMALIES=1)
 *
 * Mã thoát: 0 sạch · 1 lỗi · 2 cổng DỪNG nổ, KHÔNG truncate · 3 đã nạp nhờ cờ
 * --allow-stop-anomalies nhưng cổng DỪNG có nổ (không phải lần nạp sạch).
 */
import * as path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import * as mysql from 'mysql2/promise';
import { collectForbiddenUrls } from '../../src/rehearsal/forbidden-urls';
import {
  EtlDeps,
  LoadPlan,
  LoadResult,
  SourceDb,
  TargetDb,
  exitCodeFor,
  runEtl,
} from '../../src/rehearsal/etl/runner';
import { EtlSafeError, Row } from '../../src/rehearsal/etl/convert';
import type { ReturnStateRow } from '../../src/rehearsal/etl/return-state';

const DEFAULT_TARGET = 'postgresql://postgres:postgres@localhost:5433/tbs_rehearsal?schema=public';
const DEFAULT_OUT = 'F:\\01_TBS_GROUP\\_dump_20260925\\rehearsal-out';
/** giao dịch nạp ~57k dòng mất ~10 s — để rộng. */
const TX_TIMEOUT_MS = 30 * 60 * 1000;

async function openSource(): Promise<SourceDb> {
  const conn = await mysql.createConnection({
    host: process.env.REHEARSAL_MARIADB_HOST ?? '127.0.0.1',
    port: Number(process.env.REHEARSAL_MARIADB_PORT ?? 3307),
    user: 'root',
    password: process.env.REHEARSAL_MARIADB_PASSWORD ?? 'rehearsal_local_only', // chỉ cục bộ (lib.sh)
    database: 'sql_nhpcn',
    charset: 'utf8mb4', // bảng utf8mb3 — đọc utf8mb4 để không hỏng dấu (09a §5/09b §2.2)
    supportBigNumbers: true,
    bigNumberStrings: true, // bigint → chuỗi (chính xác trên 2^53)
    decimalNumbers: false, // decimal → chuỗi (không qua float)
    dateStrings: true,
  });
  return {
    async query(sql: string): Promise<Row[]> {
      const [rows] = await conn.query({ sql, rowsAsArray: false });
      return rows as Row[];
    },
    async close() {
      await conn.end();
    },
  };
}

type Tx = Prisma.TransactionClient;

function inserters(p: Tx): Record<string, (rows: unknown[]) => Promise<{ count: number }>> {
  return {
    FundAccount: (d) => p.fundAccount.createMany({ data: d as Prisma.FundAccountCreateManyInput[] }),
    TreasuryEntry: (d) => p.treasuryEntry.createMany({ data: d as Prisma.TreasuryEntryCreateManyInput[] }),
    FxFeeRate: (d) => p.fxFeeRate.createMany({ data: d as Prisma.FxFeeRateCreateManyInput[] }),
    FxTransfer: (d) => p.fxTransfer.createMany({ data: d as Prisma.FxTransferCreateManyInput[] }),
    FxAdjustment: (d) => p.fxAdjustment.createMany({ data: d as Prisma.FxAdjustmentCreateManyInput[] }),
    FundAccountChangelog: (d) =>
      p.fundAccountChangelog.createMany({ data: d as Prisma.FundAccountChangelogCreateManyInput[] }),
    BankTransaction: (d) => p.bankTransaction.createMany({ data: d as Prisma.BankTransactionCreateManyInput[] }),
    BankTransactionDetail: (d) =>
      p.bankTransactionDetail.createMany({ data: d as Prisma.BankTransactionDetailCreateManyInput[] }),
    BankChiMatch: (d) => p.bankChiMatch.createMany({ data: d as Prisma.BankChiMatchCreateManyInput[] }),
    BankReconcileLink: (d) =>
      p.bankReconcileLink.createMany({ data: d as Prisma.BankReconcileLinkCreateManyInput[] }),
    PaymentSource: (d) => p.paymentSource.createMany({ data: d as Prisma.PaymentSourceCreateManyInput[] }),
    SupplierPayment: (d) => p.supplierPayment.createMany({ data: d as Prisma.SupplierPaymentCreateManyInput[] }),
    SupplierPaymentOrder: (d) =>
      p.supplierPaymentOrder.createMany({ data: d as Prisma.SupplierPaymentOrderCreateManyInput[] }),
    SupplierPaymentLog: (d) =>
      p.supplierPaymentLog.createMany({ data: d as Prisma.SupplierPaymentLogCreateManyInput[] }),
    ReturnConfig: (d) => p.returnConfig.createMany({ data: d as Prisma.ReturnConfigCreateManyInput[] }),
    ReturnConfigField: (d) =>
      p.returnConfigField.createMany({ data: d as Prisma.ReturnConfigFieldCreateManyInput[] }),
  };
}

/**
 * ReturnState: JSON nạp từ VĂN BẢN GỐC ép `::jsonb` (jsonb giữ numeric chính xác) —
 * không qua JSON.parse/createMany. Tham số hoá hoàn toàn ($n), không nối chuỗi dữ liệu.
 */
async function insertReturnStates(tx: Tx, rows: ReturnStateRow[]): Promise<number> {
  let n = 0;
  for (const r of rows) {
    n += await tx.$executeRawUnsafe(
      `INSERT INTO "tbl_return_state" ("id","object_type","object_id","checkpoint_type","checkpoint_ref","state",` +
        `"reason","round","fields_opened","data_before","data_after","returned_by","returned_at","resubmitted_at") ` +
        `VALUES ($1,$2,$3,$4::"ReturnCheckpointType",$5,$6::"ReturnStateValue",$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14)`,
      r.id,
      r.objectType,
      r.objectId,
      r.checkpointType,
      r.checkpointRef,
      r.state,
      r.reason,
      r.round,
      r.fieldsOpened,
      r.dataBefore,
      r.dataAfter,
      r.returnedBy,
      r.returnedAt,
      r.resubmittedAt,
    );
  }
  return n;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(t: string): string {
  if (!IDENT.test(t)) throw new EtlSafeError(`tên bảng lạ: ${t}`);
  return `"${t}"`;
}

async function openTarget(url: string): Promise<TargetDb> {
  // PrismaClient dựng với ĐÚNG url đã qua target-guard (runEtl gọi guard trước hàm này).
  const p = new PrismaClient({ datasources: { db: { url } } });
  await p.$connect();
  return {
    async currentDatabase() {
      const r = await p.$queryRawUnsafe<{ db: string }[]>('SELECT current_database() AS db');
      return r[0].db;
    },
    async replaceAll(plan: LoadPlan): Promise<LoadResult> {
      return p.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(
            `TRUNCATE TABLE ${plan.truncateTables.map(ident).join(', ')} RESTART IDENTITY`,
          );
          const ins = inserters(tx);
          const written: Record<string, number> = {};
          for (const step of plan.steps) {
            let n = 0;
            if (step.rawJsonInsert) {
              n = await insertReturnStates(tx, step.rows as ReturnStateRow[]);
            } else {
              const f = ins[step.model];
              if (!f) throw new EtlSafeError(`không có bộ nạp cho model ${step.model}`);
              for (let i = 0; i < step.rows.length; i += plan.chunkSize) {
                n += (await f(step.rows.slice(i, i + plan.chunkSize))).count;
              }
            }
            if (n !== step.rows.length) {
              throw new EtlSafeError(`ETL ${step.model}: ghi ${n} ≠ ánh xạ ${step.rows.length} ⇒ rollback`);
            }
            written[step.model] = n;
          }
          const setval: Record<string, string> = {};
          for (const step of plan.steps) {
            const t = ident(step.table);
            const floor = plan.seqFloor[step.table];
            if (floor === undefined || !/^\d+$/.test(floor)) {
              throw new EtlSafeError(`thiếu sàn bộ đếm cho ${step.table}`);
            }
            // L13: GREATEST(PG MAX, MySQL MAX kể cả dòng loại, MySQL AUTO_INCREMENT−1) + 1
            const r = await tx.$queryRawUnsafe<{ v: string }[]>(
              `SELECT setval(pg_get_serial_sequence('${t}','id'), GREATEST(COALESCE(MAX(id),0), ${floor}::bigint)+1, false)::text AS v FROM ${t}`,
            );
            setval[step.table] = r[0].v;
          }
          return { written, setval };
        },
        { timeout: TX_TIMEOUT_MS, maxWait: 60_000 },
      );
    },
    async close() {
      await p.$disconnect();
    },
  };
}

/** Chỉ in thông tin AN TOÀN: thông điệp của EtlSafeError; lỗi khác chỉ name/code/khoá meta. */
export function safeErrorText(e: unknown): string {
  if (e instanceof EtlSafeError) return e.message;
  if (e instanceof Error) {
    const x = e as Error & { code?: unknown; meta?: unknown };
    const code = typeof x.code === 'string' ? ` code=${x.code}` : '';
    const meta =
      x.meta && typeof x.meta === 'object' ? ` metaKeys=${Object.keys(x.meta as object).join(',')}` : '';
    return `${e.name}${code}${meta}`;
  }
  return 'unknown error';
}

async function main(): Promise<number> {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const deps: EtlDeps = { openSource, openTarget };
  const allowStopAnomalies =
    process.argv.includes('--allow-stop-anomalies') || process.env.REHEARSAL_ALLOW_STOP_ANOMALIES === '1';
  const summary = await runEtl(
    {
      targetUrl: process.env.REHEARSAL_DATABASE_URL ?? DEFAULT_TARGET,
      forbiddenUrls: collectForbiddenUrls(repoRoot),
      outDir: process.env.REHEARSAL_OUT_DIR ?? DEFAULT_OUT,
      repoRoot,
      allowStopAnomalies,
    },
    deps,
  );
  // Chỉ số đếm ra console.
  for (const t of summary.tables) {
    const sk = Object.values(t.skipped).reduce((a, b) => a + b, 0);
    console.log(`${t.model.padEnd(22)} read=${t.read} written=${t.written} skipped=${sk} setval=${t.setval} ${t.durationMs}ms`);
  }
  console.log(
    `outcome=${summary.outcome} allowStopAnomalies=${summary.allowStopAnomalies} stopRulesFired=${summary.stopRulesFired.join(',') || 'none'} signOff=${summary.signOffItems.length}`,
  );
  console.log(`report: ${summary.reportFiles.join(' , ')}`);
  return exitCodeFor(summary.outcome);
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((e: unknown) => {
      console.error(safeErrorText(e));
      process.exit(1);
    });
}
