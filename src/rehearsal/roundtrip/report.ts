/**
 * Báo cáo tổng duyệt khứ hồi L13 (JSON + Markdown) ra thư mục NGOÀI repo. Chỉ số đếm, id kỹ thuật,
 * tên bảng/cột — không giá trị dòng, không STK, không nội dung chuyển khoản.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { RoundtripSummary } from './runner';

export function verdictLine(s: Pick<RoundtripSummary, 'verdict' | 'checks'>): string {
  const pass = s.checks.filter((c) => c.status === 'PASS').length;
  return `VERDICT: ${s.verdict} (${pass} PASS / ${s.checks.length - pass} FAIL trên ${s.checks.length} kiểm)`;
}

export function renderRoundtripMarkdown(s: RoundtripSummary): string {
  const L: string[] = [];
  L.push(`# Tổng duyệt khứ hồi L13 — ${s.startedAt}`, '');
  L.push(`**${verdictLine(s)}** · mã thoát ${s.exitCode}`, '');
  L.push(`PG \`${s.pgDatabase}\` · MySQL \`${s.mysqlHost}\` · ETL thoát ${s.etl.exitCode} (\`${path.basename(s.etl.reportFile)}\`)`, '');
  L.push('## Kiểm ngược chiều', '', '| kiểm | kết quả | nội dung |', '|---|---|---|');
  for (const c of s.checks) L.push(`| ${c.id} | ${c.status} | ${c.title} |`);
  for (const c of s.checks.filter((x) => x.status === 'FAIL')) {
    L.push('', `### ⛔ ${c.id}`, '', '```json', JSON.stringify(c.details, null, 2), '```');
  }
  L.push('', '## Giả lập ghi v2 (service thật)', '', '| bước | ok | qua | nội dung | id |', '|---|---|---|---|---|');
  for (const st of s.simulation.steps) {
    const ids = Object.entries(st.ids).map(([t, xs]) => `${t}: ${xs.join(', ') || '—'}`).join('; ');
    L.push(`| ${st.id} | ${st.ok ? '✓' : '✗'} | ${st.via} | ${st.title}${st.note ? ` (${st.note})` : ''} | ${ids} |`);
  }
  L.push('', '### Cờ KỲ VỌNG (phải được chép ngược báo)', '');
  for (const m of s.simulation.expected.modified) L.push(`- sửa dòng cũ ${m.table}#${m.id}: ${m.columns.join(', ')}`);
  for (const d of s.simulation.expected.deleted) L.push(`- xoá cứng ${d.table}#${d.id}`);
  for (const c of s.simulation.expected.coerced) L.push(`- ép kiểu ${c.table}#${c.id}`);
  L.push('', '### Service v2 còn thiếu (đã thay thế — không giả ghi bằng SQL tay)', '');
  for (const g of s.simulation.gaps) L.push(`- ${g}`);
  L.push('', '## Chép ngược', '');
  for (const c of s.copyback) L.push(`- lần ${c.run}: \`${c.outcome}\` (exit ${c.exitCode}) — ${c.reportFiles.map((f) => path.basename(f)).join(', ')}`);
  L.push('', '## Ghi chú', '');
  for (const n of s.notes) L.push(`- ${n}`);
  L.push('');
  return L.join('\n');
}

export function writeRoundtripReport(s: RoundtripSummary, outDir: string): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = s.startedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `roundtrip-${stamp}.json`);
  const mdPath = path.join(outDir, `roundtrip-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify({ ...s, reportFiles: [jsonPath, mdPath] }, null, 2), 'utf8');
  fs.writeFileSync(mdPath, renderRoundtripMarkdown(s), 'utf8');
  return [jsonPath, mdPath];
}
