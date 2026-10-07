/**
 * Báo cáo chép ngược (JSON + Markdown) ra thư mục NGOÀI repo. Chỉ SỐ ĐẾM, id kỹ thuật và TÊN
 * cột/khoá (id dòng không phải dữ liệu tiền — kế hoạch L13) — không giá trị dòng, không STK,
 * không nội dung chuyển khoản.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { CopybackSummary } from './runner';

const MAX_IDS_MD = 50;

function fmtMap(m: Record<string, number>): string {
  const e = Object.entries(m);
  return e.length === 0 ? '—' : e.map(([k, v]) => `${k}: ${v}`).join('; ');
}

function ids(list: string[]): string {
  if (list.length === 0) return '—';
  const head = list.slice(0, MAX_IDS_MD).join(', ');
  return list.length > MAX_IDS_MD ? `${head} … (+${list.length - MAX_IDS_MD}, đủ trong JSON)` : head;
}

export function renderCopybackMarkdown(s: CopybackSummary): string {
  const L: string[] = [];
  L.push(`# Chép ngược L13 (PG → MySQL) — ${s.startedAt}`, '');
  L.push(`Nguồn PG: \`${s.pgDatabase}\` · đích MySQL: \`${s.mysqlHost}\` · tổng ${(s.totalDurationMs / 1000).toFixed(1)} s`, '');
  L.push(`**Kết quả: \`${s.outcome}\`** — ${s.outcomeMessage}${s.dryRun ? ' · DRY-RUN (không ghi, đã rollback)' : ''}`, '');
  L.push(`v2IdStart (từ báo cáo ETL): ${s.v2IdStartGiven ? 'có' : 'KHÔNG — mọi dòng ≤ mốc so ở mức PG'}`, '');
  if (s.errorName) L.push(`Lỗi: \`${s.errorName}\``, '');
  L.push('| # | model | bảng | mốc | đọc PG | mới (>mốc) | lỗ (≤mốc) | đã chép | đổi do ép kiểu | ≤mốc khác | MySQL-không-ở-PG | v2 xoá cứng | AI trước → sau |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  s.tables.forEach((t, i) => {
    L.push(
      `| ${i + 1} | ${t.model} | ${t.table} | ${t.mark} | ${t.pgRead} | ${t.newRows} | ${t.gapRows} | ${t.copied} | ${t.coercedRows} | ${t.modifiedOld} | ${t.mysqlOnlyRows} | ${t.deletedRows} | ${t.autoIncrementBefore ?? '—'} → ${t.autoIncrementAfter ?? '—'} |`,
    );
  });
  if (s.uniqueConflicts.length > 0) {
    L.push('', '## ⛔ Trùng khoá UNIQUE — đã HUỶ trước mọi ghi', '');
    for (const c of s.uniqueConflicts) L.push(`- ${c.table} id ${c.id} — khoá \`${c.key}\` (trùng ${c.against === 'mysql' ? 'dòng MySQL' : 'dòng mới khác trong lô'})`);
  }
  const flagged = s.tables.filter((t) => t.coercedRows > 0 || t.modifiedOld > 0 || t.gapRows > 0 || t.deletedRows > 0);
  if (flagged.length > 0) {
    L.push('', '## Dòng cần xem (id kỹ thuật + tên cột, không giá trị)', '');
    for (const t of flagged) {
      if (t.coercedRows > 0) L.push(`- **${t.model}** đổi giá trị do ép kiểu — cột: ${fmtMap(t.coercedColumns)} · id: ${ids(t.coercedIds)}`);
      if (t.gapRows > 0) L.push(`- **${t.model}** dòng LỖ (≤ mốc, MySQL không có) — ĐÃ chép · id: ${ids(t.gapIds)}`);
      if (t.deletedRows > 0) L.push(`- **${t.model}** v2 XOÁ CỨNG (còn ở MySQL, KHÔNG xoá) · id: ${ids(t.deletedIds)}`);
      if (t.modifiedOld > 0) {
        L.push(`- **${t.model}** dòng ≤ mốc KHÁC (không chép, không ghi đè) — lý do: ${fmtMap(t.modifiedReasons)}`);
        for (const d of t.modifiedDetails.slice(0, MAX_IDS_MD)) {
          L.push(`  - id ${d.id}: ${d.columns.length ? d.columns.join(', ') : '(cả dòng)'}`);
        }
        if (t.modifiedDetails.length > MAX_IDS_MD) L.push(`  - … +${t.modifiedDetails.length - MAX_IDS_MD} (đủ trong JSON)`);
      }
    }
  }
  L.push('', '## Ghi chú', '');
  for (const n of s.notes) L.push(`- ${n}`);
  L.push('', '## Phần mất có chủ đích (theo bảng)', '');
  for (const t of s.tables) for (const l of t.lossy) L.push(`- ${t.model}: ${l}`);
  L.push('', '## Ngoài phạm vi', '');
  for (const o of s.outOfScope) L.push(`- ${o}`);
  L.push('');
  return L.join('\n');
}

export function writeCopybackReport(s: CopybackSummary, outDir: string): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = s.startedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `copyback-${stamp}.json`);
  const mdPath = path.join(outDir, `copyback-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify({ ...s, reportFiles: [jsonPath, mdPath] }, null, 2), 'utf8');
  fs.writeFileSync(mdPath, renderCopybackMarkdown(s), 'utf8');
  return [jsonPath, mdPath];
}
