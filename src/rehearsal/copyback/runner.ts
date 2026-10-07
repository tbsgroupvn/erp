/**
 * Máy CHÉP NGƯỢC L13 — `runCopyback()`: dòng MỚI của 17 bảng lõi tiền từ
 * Postgres v2 (`*_rehearsal`) về MySQL (CHỈ MariaDB diễn tập cục bộ).
 *
 * ⛔ Thứ tự bắt buộc:
 *  (1) `assertRehearsalTarget` trên URL PG + `assertMysqlRehearsalTarget` trên
 *      cấu hình MySQL + thư mục báo cáo ngoài repo — TRƯỚC mọi kết nối;
 *  (2) mở PG, `current_database()` phải đúng CSDL diễn tập;
 *  (3) mở MySQL, `assertMysqlRehearsalServer` (@@hostname == hostname container
 *      diễn tập đọc qua docker, MariaDB 10.11, STRICT) — TRƯỚC begin/ghi;
 *  (4) MỘT transaction MySQL. Ngữ cảnh xuôi THẬT như ETL (id phiếu/bước duyệt ở MySQL,
 *      loaded/skipped theo bảng trackIds). Từng bảng theo thứ tự cha → con: mốc = MAX(id)
 *      MySQL; đọc toàn bộ PG (::text) + MySQL; phân loại:
 *        - PG id > mốc                    ⇒ MỚI, chép;
 *        - PG id ≤ mốc, MySQL không có    ⇒ "LỖ" ⇒ VẪN chép (không mất dòng v2) nhưng exit 5 +
 *                                           liệt kê id — LỆCH câu chữ kế hoạch "chỉ id > mốc"
 *                                           (quyết định controller, fix round 1);
 *        - PG id ≤ mốc, MySQL có          ⇒ so ở MỨC PG với ảnhPG(xuôi(MySQL)); khác ⇒ BÁO tên cột
 *                                           theo id, KHÔNG ghi đè;
 *        - MySQL id ≤ mốc, PG không có    ⇒ xuôi(MySQL) = skip ⇒ ETL đã loại (bình thường);
 *                                           = row ⇒ v2 XOÁ CỨNG ⇒ BÁO id, exit 5, KHÔNG xoá ở MySQL;
 *  (5) kiểm trước khoá UNIQUE (information_schema.STATISTICS, ≠ PRIMARY) cho MỌI dòng sẽ chép —
 *      với MySQL (collation thật của MySQL) và giữa các dòng trong lô ⇒ trùng ⇒ HUỶ TRƯỚC mọi
 *      ghi (outcome unique_conflict, exit 5), báo bảng + id + tên khoá;
 *  (6) INSERT; mapper ngược nổ / INSERT lỗi / cảnh báo MySQL ⇒ ROLLBACK toàn bộ (exit 1);
 *  (7) COMMIT (dry-run ⇒ ROLLBACK); SAU commit mới `ALTER TABLE … AUTO_INCREMENT` (DDL tự
 *      commit), chỉ NÂNG lên MAX(id)+1. ALTER hỏng ⇒ dữ liệu ĐÃ commit ⇒ outcome
 *      ai_raise_failed ("committed; AUTO_INCREMENT raise failed on <bảng>"), exit 5 — KHÔNG phải 1.
 * Nguồn/đích đi qua interface để test không đụng CSDL.
 */
import * as path from 'path';
import { assertRehearsalTarget, extractDatabaseName } from '../target-guard';
import { EtlSafeError, Row } from '../etl/convert';
import { EtlContext } from '../etl/spec';
import { PgRow, jsonEquivalent } from './convert';
import { diffPgColumns, expectedPgImage } from './expected';
import {
  MysqlServerIdentity,
  MysqlTargetConfig,
  assertMysqlRehearsalServer,
  assertMysqlRehearsalTarget,
} from './mysql-target-guard';
import { pgSelectSql } from './pg-image';
import { writeCopybackReport } from './report';
import { CopybackSpec } from './spec';
import { COPYBACK_TABLES } from './tables';

export interface PgSource {
  currentDatabase(): Promise<string>;
  query(sql: string): Promise<PgRow[]>;
  close(): Promise<void>;
}

export interface UniqueKey {
  name: string;
  columns: string[];
}

export interface MysqlTarget {
  identity(): Promise<MysqlServerIdentity>;
  begin(): Promise<void>;
  /** MAX(id) dạng chuỗi, NULL nếu bảng rỗng. */
  maxId(table: string): Promise<string | null>;
  /** dòng MySQL (cột liệt kê tường minh) — decimal/bigint dạng chuỗi. */
  selectRows(table: string, columns: readonly string[]): Promise<Row[]>;
  /** id của một bảng (dựng ngữ cảnh xuôi: tbl_approval_steps/requests). */
  selectIds(table: string): Promise<string[]>;
  /** khoá UNIQUE ≠ PRIMARY (information_schema.STATISTICS NON_UNIQUE=0), cột theo SEQ_IN_INDEX. */
  uniqueKeys(table: string): Promise<UniqueKey[]>;
  /** có dòng MySQL mang đúng giá trị khoá (so bằng collation của MySQL)? */
  findUniqueConflict(table: string, columns: string[], values: string[]): Promise<boolean>;
  insert(table: string, columns: string[], rows: (string | null)[][]): Promise<{ affected: number; warnings: number }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  autoIncrement(table: string): Promise<string | null>;
  setAutoIncrement(table: string, value: string): Promise<void>;
  close(): Promise<void>;
}

export interface CopybackDeps {
  openSource(url: string): Promise<PgSource>;
  openTarget(cfg: MysqlTargetConfig): Promise<MysqlTarget>;
  /** hostname container diễn tập (docker inspect) — xem mysql-target-guard. */
  containerHostname(): string;
}

export interface CopybackOptions {
  pgUrl: string;
  forbiddenUrls: readonly string[];
  mysql: MysqlTargetConfig;
  outDir: string;
  repoRoot: string;
  /**
   * id ĐẦU TIÊN v2 cấp theo bảng (= `setval` trong báo cáo ETL). Dòng ≤ mốc có id ≥ giá trị này
   * là dòng v2 tạo và ĐÃ chép ngược lần trước ⇒ so ở mức MySQL (phần làm tròn khi chép không
   * bị báo lại). Không có ⇒ mọi dòng ≤ mốc so ở mức PG.
   */
  v2IdStart?: Record<string, string>;
  /**
   * CSDL đích ghi trong báo cáo ETL (`targetDatabase`) đã cho `v2IdStart` (N1): phải BẰNG
   * `current_database()` PG hiện tại, không thì báo cáo thuộc CSDL khác ⇒ TỪ CHỐI.
   */
  etlReportDatabase?: string;
  /** phân loại + báo cáo, KHÔNG ghi (rollback, không ALTER). */
  dryRun?: boolean;
  writeReport?: boolean;
  chunkSize?: number;
  now?: Date;
}

export type CopybackOutcome = 'clean' | 'flagged' | 'unique_conflict' | 'ai_raise_failed' | 'failed';

/**
 * 0 sạch · 1 lỗi (ROLLBACK) · 5 = đã báo mục cần người xem: dòng ≤ mốc bị v2 sửa/xung đột id,
 * dòng lỗ, v2 xoá cứng, đổi giá trị do ép kiểu (phần mới VẪN chép) · trùng khoá UNIQUE (HUỶ,
 * không ghi gì) · ALTER AUTO_INCREMENT hỏng SAU commit (dữ liệu ĐÃ commit).
 */
export function copybackExitCode(o: CopybackOutcome): number {
  return o === 'clean' ? 0 : o === 'failed' ? 1 : 5;
}

export interface ModifiedDetail {
  id: string;
  /** TÊN cột MySQL khác (không giá trị). */
  columns: string[];
}

export interface UniqueConflict {
  table: string;
  id: string;
  key: string;
  /** trùng dòng đang có ở MySQL, hay trùng dòng mới khác trong cùng lô. */
  against: 'mysql' | 'batch';
}

export interface CopyTableSummary {
  model: string;
  doc: string;
  table: string;
  /** MAX(id) MySQL lúc chạy ('0' nếu rỗng). */
  mark: string;
  pgRead: number;
  mysqlRead: number;
  /** id > mốc. */
  newRows: number;
  /** id ≤ mốc mà MySQL không có — VẪN chép, exit 5. */
  gapRows: number;
  gapIds: string[];
  copied: number;
  coercedRows: number;
  coercedIds: string[];
  coercedColumns: Record<string, number>;
  /** dòng PG ≤ mốc KHÁC ảnh kỳ vọng của dòng MySQL cùng id (không chép, không ghi đè). */
  modifiedOld: number;
  modifiedIds: string[];
  modifiedDetails: ModifiedDetail[];
  modifiedColumns: Record<string, number>;
  modifiedReasons: Record<string, number>;
  /** dòng MySQL ≤ mốc vắng ở PG (gồm cả dòng ETL đã loại). */
  mysqlOnlyRows: number;
  /** trong số trên: xuôi KHÔNG loại ⇒ v2 xoá cứng (không xoá ở MySQL, chỉ báo). */
  deletedRows: number;
  deletedIds: string[];
  autoIncrementBefore: string | null;
  autoIncrementAfter: string | null;
  lossy: string[];
  durationMs: number;
}

export interface CopybackSummary {
  outcome: CopybackOutcome;
  outcomeMessage: string;
  dryRun: boolean;
  errorName: string | null;
  startedAt: string;
  finishedAt: string;
  pgDatabase: string;
  mysqlHost: string;
  v2IdStartGiven: boolean;
  tables: CopyTableSummary[];
  uniqueConflicts: UniqueConflict[];
  notes: string[];
  outOfScope: string[];
  totalDurationMs: number;
  reportFiles: string[];
}

/** Ngoài phạm vi lô L13 — ghi thẳng vào báo cáo (không im lặng). */
export const OUT_OF_SCOPE: readonly string[] = [
  'Chỉ 17 bảng L0 đã nạp. Bảng #01/#03/#04/#06 (ví khách tbl_wallet*, GL, phiếu duyệt tbl_approval_*, đơn) CHƯA nạp sang PG ⇒ chưa chép ngược (cutover §3.7: WalletEntry.ref_key, ApprovalRequest.synced, GlLine dims — chờ các lô đó).',
  'Đích bị KHOÁ vào MariaDB diễn tập cục bộ (mysql-target-guard) — chạy vào prod thật là quyết định Q-CUT-5, không có cờ mở.',
];

/** Ghi chú cố định trong mọi báo cáo. */
export const NOTES: readonly string[] = [
  'Dòng "lỗ" (PG id ≤ mốc mà MySQL không có id đó): công cụ VẪN chép để không mất dòng v2 — lệch câu chữ kế hoạch L13 ("chỉ chép id > mốc"), theo quyết định controller; mỗi dòng lỗ làm mã thoát = 5 và được liệt kê id.',
  'PaymentSource.created_at: v2 hiện KHÔNG có đường ghi bảng này. Nếu thêm, phải ghi giờ đồng hồ VN (lưu như UTC) đúng quy ước chiều xuôi (src/rehearsal/etl/convert.ts optDateTime) — ghi now() theo UTC sẽ lệch 7 giờ khi chép ngược.',
  'Trùng khoá UNIQUE: kiểm với MySQL bằng collation thật của MySQL; kiểm GIỮA các dòng mới trong lô bằng xấp xỉ (không phân biệt hoa/thường + bỏ khoảng trắng cuối — PAD SPACE); utf8mb4_general_ci còn coi một số chữ có dấu = không dấu, phần đó để INSERT tự bắt (exit 1, rollback).',
];

function assertOutsideRepo(outDir: string, repoRoot: string): void {
  const rel = path.relative(path.resolve(repoRoot), path.resolve(outDir));
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new EtlSafeError(`chép ngược: thư mục báo cáo phải nằm ngoài repo (dữ liệu thật) — nhận ${outDir}`);
  }
}

function bump(m: Record<string, number>, k: string): void {
  m[k] = (m[k] ?? 0) + 1;
}

function mysqlColumnsOf(spec: CopybackSpec): readonly string[] {
  return spec.forward ? spec.forward.columns : spec.pgColumns.map((c) => c.my ?? c.col);
}

const REASON_COLLISION = 'xung đột: xuôi đã loại dòng MySQL cùng id';
const REASON_EXPECT_ERR = 'ảnh kỳ vọng lỗi (dòng MySQL không qua được chiều xuôi)';
const REASON_EDIT = 'v2 sửa dòng lịch sử';
const REASON_EDIT_COPIED = 'v2 sửa dòng đã chép ngược trước';
const REASON_SUBPREC = 'khác dưới độ chính xác MySQL (đã làm tròn khi chép trước, hoặc v2 sửa phần lẻ)';

async function baseCtx(target: MysqlTarget): Promise<EtlContext> {
  const ids = async (t: string) => new Set((await target.selectIds(t)).map((x) => Number(x)));
  return {
    nowUnix: Number.MAX_SAFE_INTEGER,
    approvalStepIds: await ids('tbl_approval_steps'),
    approvalRequestIds: await ids('tbl_approval_requests'),
    loaded: {},
    skipped: {},
  };
}

/** Như ETL mapTable: bảng trackIds ghi id đã nạp/đã loại vào ngữ cảnh cho bảng con. */
function trackForward(spec: CopybackSpec, myRows: Row[], ctx: EtlContext): void {
  const fwd = spec.forward;
  if (!fwd?.trackIds) return;
  const loaded = new Set<number>();
  const skipped = new Set<number>();
  for (const r of myRows) {
    try {
      const f = fwd.map(r, ctx);
      if (f.kind === 'row') loaded.add((f.data as { id: number }).id);
      else if (f.id !== undefined) skipped.add(f.id);
    } catch {
      /* dòng ETL đã DỪNG — không nạp */
    }
  }
  ctx.loaded[fwd.model] = loaded;
  ctx.skipped[fwd.model] = skipped;
}

/**
 * N1 — `v2Start` (setval ETL) so với SÀN NGUỒN HIỆN TẠI = GREATEST(MySQL MAX(id), AUTO_INCREMENT−1)+1 đọc NGAY
 * LÚC chạy, KHÔNG tính phần do chính v2 đẩy lên:
 *  - dòng MySQL id ≥ v2Start chỉ được coi là "dòng v2 đã chép ở lần trước" khi PG có cùng id VÀ dòng MySQL
 *    BẰNG ảnh ngược của dòng PG ở mức MySQL (cùng phép so runner dùng cho dòng đã chép). Cùng id mà KHÁC ⇒
 *    VA CHẠM id (MySQL tự ghi dòng sau ETL rồi v2 cấp lại đúng id đó — dòng v2 sẽ không bao giờ về được) hoặc
 *    v2 sửa dòng sau khi đã chép — hai trường hợp không phân biệt được bằng dữ liệu ⇒ TỪ CHỐI, nêu bảng + id;
 *  - AUTO_INCREMENT−1 ≤ id lớn nhất của các dòng v2 đó = do lần chép trước nâng ⇒ bỏ qua.
 * Chưa có dòng v2 nào ở MySQL ⇒ v2Start phải BẰNG sàn (đúng công thức setval của ETL; lớn hơn = báo cáo cũ).
 * Đã có ⇒ v2Start ≥ sàn. Sai ⇒ lỗi, rollback, exit 1.
 */
function assertV2StartFresh(
  spec: CopybackSpec,
  v2Start: bigint,
  aiBefore: string | null,
  myById: Map<string, Row>,
  pgRows: PgRow[],
  ctx: EtlContext,
): void {
  const table = spec.table;
  const pgById = new Map(pgRows.map((r) => [String(r.id), r]));
  const json = new Set(spec.jsonColumns ?? []);
  const sameAtMysql = (my: Row, pr: PgRow): boolean => {
    const exp = expectedPgImage(spec, my, ctx);
    if (exp.kind !== 'row') return false;
    try {
      const a = spec.reverse(exp.image).row;
      const b = spec.reverse(pr).row;
      return Object.keys(b).every((c) => (json.has(c) ? jsonEquivalent(a[c] ?? null, b[c] ?? null) : a[c] === b[c]));
    } catch {
      return false;
    }
  };
  let nonV2Max = 0n;
  let v2Max = -1n;
  for (const [id, my] of myById) {
    const b = BigInt(id);
    if (b < v2Start) {
      if (b > nonV2Max) nonV2Max = b;
      continue;
    }
    const pr = pgById.get(id);
    if (pr !== undefined && !sameAtMysql(my, pr)) {
      throw new EtlSafeError(
        `chép ngược: va chạm id / báo cáo ETL cũ — ${table} id ${id} (≥ v2Start=${v2Start}) có ở CẢ MySQL lẫn PG nhưng KHÁC ` +
          'nội dung: MySQL tự ghi dòng này sau ETL rồi v2 cấp lại cùng id, hoặc v2 sửa dòng sau khi đã chép ngược ⇒ TỪ CHỐI ' +
          '(xử lý tay theo README "Quay lui R1").' +
          ' Dùng ĐÚNG báo cáo ETL của lần cutover. ⛔ Quay lui R1: KHÔNG chạy lại ETL (ETL TRUNCATE PG ⇒ mất dữ liệu v2 cần chép về); kiểm lẻ bằng --dry-run.',
      );
    }
    if (pr !== undefined) {
      if (b > v2Max) v2Max = b;
    } else if (b > nonV2Max) nonV2Max = b;
  }
  const aiM1 = aiBefore === null ? 0n : BigInt(aiBefore) - 1n;
  const aiPart = aiM1 > v2Max ? aiM1 : 0n;
  const floor = (nonV2Max > aiPart ? nonV2Max : aiPart) + 1n;
  const ok = v2Max < 0n ? v2Start === floor : v2Start >= floor;
  if (!ok) {
    throw new EtlSafeError(
      `chép ngược: --etl-report KHÔNG khớp nguồn hiện tại — ${table} v2Start=${v2Start} ${v2Max < 0n ? '≠' : '<'} sàn nguồn hiện tại ${floor} ` +
        '(GREATEST(MySQL MAX không do v2 chép, AUTO_INCREMENT−1)+1' +
        (v2Max < 0n ? '; chưa có dòng v2 nào ở MySQL ⇒ phải BẰNG' : '') +
        '). Báo cáo ETL cũ / của lần nạp khác, hoặc MySQL có dòng mới sau ETL ⇒ TỪ CHỐI.' +
        ' Dùng ĐÚNG báo cáo ETL của lần cutover. ⛔ Quay lui R1: KHÔNG chạy lại ETL (ETL TRUNCATE PG ⇒ mất dữ liệu v2 cần chép về); kiểm lẻ bằng --dry-run.',
    );
  }
}

interface Planned {
  spec: CopybackSpec;
  summary: CopyTableSummary;
  columns: string[];
  rows: (string | null)[][];
  ids: string[];
}

async function planTable(
  spec: CopybackSpec,
  source: PgSource,
  target: MysqlTarget,
  ctx: EtlContext,
  v2Start: bigint | null,
): Promise<Planned> {
  const t0 = Date.now();
  const aiBefore = await target.autoIncrement(spec.table);
  const markRaw = await target.maxId(spec.table);
  const mark = BigInt(markRaw ?? '0');
  const pgRows = await source.query(pgSelectSql(spec.table, spec.pgColumns));
  const myRows = await target.selectRows(spec.table, mysqlColumnsOf(spec));
  const myById = new Map<string, Row>();
  for (const r of myRows) myById.set(String(r.id), r);
  trackForward(spec, myRows, ctx);
  if (v2Start !== null) assertV2StartFresh(spec, v2Start, aiBefore, myById, pgRows, ctx);
  const json = new Set(spec.jsonColumns ?? []);

  const s: CopyTableSummary = {
    model: spec.model,
    doc: spec.doc,
    table: spec.table,
    mark: mark.toString(),
    pgRead: pgRows.length,
    mysqlRead: myRows.length,
    newRows: 0,
    gapRows: 0,
    gapIds: [],
    copied: 0,
    coercedRows: 0,
    coercedIds: [],
    coercedColumns: {},
    modifiedOld: 0,
    modifiedIds: [],
    modifiedDetails: [],
    modifiedColumns: {},
    modifiedReasons: {},
    mysqlOnlyRows: 0,
    deletedRows: 0,
    deletedIds: [],
    autoIncrementBefore: aiBefore,
    autoIncrementAfter: aiBefore,
    lossy: [...spec.lossy],
    durationMs: 0,
  };
  const flag = (id: string, reason: string, cols: string[]) => {
    s.modifiedOld++;
    s.modifiedIds.push(id);
    s.modifiedDetails.push({ id, columns: cols });
    bump(s.modifiedReasons, reason);
    for (const c of cols) bump(s.modifiedColumns, c);
  };

  let columns: string[] | null = null;
  const rows: (string | null)[][] = [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const pr of pgRows) {
    const rev = spec.reverse(pr); // nổ ⇒ rollback toàn bộ
    const id = rev.row.id;
    if (id === null) throw new EtlSafeError(`chép ngược ${spec.model}: id NULL`);
    seen.add(id);
    const my = myById.get(id);
    if (BigInt(id) <= mark && my !== undefined) {
      const exp = expectedPgImage(spec, my, ctx);
      if (exp.kind === 'skip') flag(id, REASON_COLLISION, []);
      else if (exp.kind === 'error') flag(id, REASON_EXPECT_ERR, []);
      else {
        const pgCols = diffPgColumns(spec, exp.image, pr);
        if (pgCols.length > 0) {
          // khác CHỈ dưới độ chính xác MySQL? (ở mức MySQL hai phía như nhau)
          let expMy: Record<string, string | null> | null = null;
          try {
            expMy = spec.reverse(exp.image).row;
          } catch {
            expMy = null;
          }
          const subPrecOnly = expMy !== null && pgCols.every((c) => !json.has(c) && expMy![c] === rev.row[c]);
          const copiedBefore = v2Start !== null && BigInt(id) >= v2Start;
          if (copiedBefore) {
            if (!subPrecOnly) flag(id, REASON_EDIT_COPIED, pgCols);
          } else if (subPrecOnly && v2Start === null) flag(id, REASON_SUBPREC, pgCols);
          else flag(id, REASON_EDIT, pgCols);
        }
      }
      continue;
    }
    if (BigInt(id) > mark) s.newRows++;
    else {
      s.gapRows++;
      s.gapIds.push(id);
    }
    if (rev.coerced.length > 0) {
      s.coercedRows++;
      s.coercedIds.push(id);
      for (const c of rev.coerced) bump(s.coercedColumns, c);
    }
    const keys = Object.keys(rev.row);
    if (columns === null) columns = keys;
    else if (keys.join(',') !== columns.join(',')) throw new EtlSafeError(`chép ngược ${spec.model}: cột không đồng nhất`);
    rows.push(keys.map((k) => rev.row[k]));
    ids.push(id);
  }
  for (const [id, r] of myById) {
    if (seen.has(id) || BigInt(id) > mark) continue;
    s.mysqlOnlyRows++;
    if (expectedPgImage(spec, r, ctx).kind !== 'skip') {
      s.deletedRows++;
      s.deletedIds.push(id);
    }
  }
  s.durationMs = Date.now() - t0;
  return { spec, summary: s, columns: columns ?? [], rows, ids };
}

/** so khoá trong lô: xấp xỉ collation _ci + PAD SPACE (xem NOTES). */
function batchKey(values: string[]): string {
  return values.map((v) => v.toLowerCase().replace(/ +$/, '')).join('\u0000');
}

async function uniquePrecheck(plans: Planned[], target: MysqlTarget): Promise<UniqueConflict[]> {
  const out: UniqueConflict[] = [];
  for (const p of plans) {
    if (p.rows.length === 0) continue;
    for (const key of await target.uniqueKeys(p.spec.table)) {
      const idx = key.columns.map((c) => p.columns.indexOf(c));
      if (idx.some((i) => i < 0)) {
        throw new EtlSafeError(`chép ngược ${p.spec.model}: khoá UNIQUE ${key.name} có cột không nằm trong dòng chép`);
      }
      const inBatch = new Set<string>();
      for (let r = 0; r < p.rows.length; r++) {
        const vals = idx.map((i) => p.rows[r][i]);
        if (vals.some((v) => v === null)) continue; // NULL không bao giờ trùng khoá UNIQUE ở MySQL
        const v = vals as string[];
        const bk = batchKey(v);
        if (inBatch.has(bk)) out.push({ table: p.spec.table, id: p.ids[r], key: key.name, against: 'batch' });
        else if (await target.findUniqueConflict(p.spec.table, key.columns, v)) {
          out.push({ table: p.spec.table, id: p.ids[r], key: key.name, against: 'mysql' });
        }
        inBatch.add(bk);
      }
    }
  }
  return out;
}

const MSG: Record<Exclude<CopybackOutcome, 'ai_raise_failed'>, string> = {
  clean: 'sạch — không có mục cần xem',
  flagged: 'đã chép phần mới (hoặc dry-run); CÓ mục cần người xem (dòng ≤ mốc khác, lỗ, v2 xoá cứng, ép kiểu) — exit 5',
  unique_conflict:
    'HUỶ TRƯỚC MỌI GHI: dòng mới trùng khoá UNIQUE của MySQL — không ghi gì, exit 5 (không phải lỗi hệ thống exit 1)',
  failed: 'lỗi — transaction MySQL đã ROLLBACK, không ALTER — exit 1',
};

export async function runCopyback(opts: CopybackOptions, deps: CopybackDeps): Promise<CopybackSummary> {
  // (1) chốt TRƯỚC mọi kết nối — thông điệp gốc có thể chứa URL (mật khẩu) ⇒ bọc lại.
  try {
    assertRehearsalTarget(opts.pgUrl, opts.forbiddenUrls);
  } catch {
    throw new EtlSafeError(
      `target-guard TỪ CHỐI nguồn PG "${String(extractDatabaseName(opts.pgUrl))}" (cần *_rehearsal, khác CSDL test tbs_test).`,
    );
  }
  assertMysqlRehearsalTarget(opts.mysql);
  assertOutsideRepo(opts.outDir, opts.repoRoot);
  for (const [t, v] of Object.entries(opts.v2IdStart ?? {})) {
    if (!/^\d+$/.test(v)) throw new EtlSafeError(`v2IdStart ${t}: cần số nguyên dương`);
  }

  const started = opts.now ?? new Date();
  const t0 = Date.now();
  const dryRun = opts.dryRun === true;
  const expectedPg = extractDatabaseName(opts.pgUrl);

  const source = await deps.openSource(opts.pgUrl);
  let target: MysqlTarget | null = null;
  try {
    // (2)
    const pgDb = await source.currentDatabase();
    if (pgDb !== expectedPg || !pgDb.endsWith('_rehearsal')) {
      throw new EtlSafeError(`chép ngược: PG current_database()="${pgDb}" không khớp "${String(expectedPg)}" — TỪ CHỐI.`);
    }
    if (opts.etlReportDatabase !== undefined && opts.etlReportDatabase !== pgDb) {
      throw new EtlSafeError(
        `chép ngược: báo cáo ETL (--etl-report) ghi CSDL đích "${opts.etlReportDatabase}" ≠ current_database() "${pgDb}" — TỪ CHỐI.`,
      );
    }
    // (3)
    target = await deps.openTarget(opts.mysql);
    assertMysqlRehearsalServer(await target.identity(), deps.containerHostname());
    const tgt = target;

    const summary: CopybackSummary = {
      outcome: 'clean',
      outcomeMessage: '',
      dryRun,
      errorName: null,
      startedAt: started.toISOString(),
      finishedAt: '',
      pgDatabase: pgDb,
      mysqlHost: `${opts.mysql.host}:${opts.mysql.port}/${opts.mysql.database}`,
      v2IdStartGiven: opts.v2IdStart !== undefined,
      tables: [],
      uniqueConflicts: [],
      notes: [...NOTES],
      outOfScope: [...OUT_OF_SCOPE],
      totalDurationMs: 0,
      reportFiles: [],
    };
    const finish = (outcome: CopybackOutcome, message?: string): CopybackSummary => {
      summary.outcome = outcome;
      summary.outcomeMessage = message ?? MSG[outcome as keyof typeof MSG];
      summary.finishedAt = new Date().toISOString();
      summary.totalDurationMs = Date.now() - t0;
      if (opts.writeReport !== false) summary.reportFiles = writeCopybackReport(summary, opts.outDir);
      return summary;
    };

    // (4)–(7) MỘT transaction.
    await tgt.begin();
    try {
      const ctx = await baseCtx(tgt);
      const plans: Planned[] = [];
      for (const spec of COPYBACK_TABLES) {
        const start = opts.v2IdStart?.[spec.table];
        const p = await planTable(spec, source, tgt, ctx, start === undefined ? null : BigInt(start));
        plans.push(p);
        summary.tables.push(p.summary);
      }
      // (5) khoá UNIQUE — TRƯỚC mọi INSERT.
      summary.uniqueConflicts = await uniquePrecheck(plans, tgt);
      if (summary.uniqueConflicts.length > 0) {
        await tgt.rollback();
        return finish('unique_conflict');
      }
      // (6)
      const chunk = opts.chunkSize ?? 500;
      if (!dryRun) {
        for (const p of plans) {
          for (let i = 0; i < p.rows.length; i += chunk) {
            const part = p.rows.slice(i, i + chunk);
            const res = await tgt.insert(p.spec.table, p.columns, part);
            if (res.affected !== part.length) {
              throw new EtlSafeError(`chép ngược ${p.spec.model}: ghi ${res.affected} ≠ ${part.length} ⇒ rollback`);
            }
            if (res.warnings > 0) {
              throw new EtlSafeError(`chép ngược ${p.spec.model}: MySQL cảnh báo ${res.warnings} (cắt/ép im lặng) ⇒ rollback`);
            }
          }
          p.summary.copied = p.rows.length;
        }
      }
      if (dryRun) await tgt.rollback();
      else await tgt.commit();
    } catch (e) {
      await tgt.rollback();
      summary.errorName = e instanceof Error ? e.name : 'unknown';
      for (const t of summary.tables) t.copied = 0;
      finish('failed');
      throw e;
    }

    // (7) AUTO_INCREMENT — SAU commit, chỉ nâng. Hỏng ⇒ dữ liệu ĐÃ commit ⇒ exit 5, không phải 1.
    if (!dryRun) {
      for (const t of summary.tables) {
        try {
          const current = await tgt.autoIncrement(t.table);
          const max = await tgt.maxId(t.table);
          if (max !== null) {
            const want = BigInt(max) + 1n;
            if (current === null || want > BigInt(current)) await tgt.setAutoIncrement(t.table, want.toString());
          }
          t.autoIncrementAfter = await tgt.autoIncrement(t.table);
        } catch (e) {
          summary.errorName = e instanceof Error ? e.name : 'unknown';
          return finish('ai_raise_failed', `committed; AUTO_INCREMENT raise failed on ${t.table}`);
        }
      }
    }

    const flagged = summary.tables.some(
      (t) => t.modifiedOld > 0 || t.coercedRows > 0 || t.gapRows > 0 || t.deletedRows > 0,
    );
    return finish(flagged ? 'flagged' : 'clean');
  } finally {
    await source.close();
    if (target) await target.close();
  }
}
