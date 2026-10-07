/**
 * Ghi báo cáo ETL (JSON + Markdown) ra thư mục NGOÀI repo. Chỉ SỐ ĐẾM — không
 * dòng dữ liệu, không STK, không nội dung chuyển khoản.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { EtlSummary } from './runner';

function fmtMap(m: Record<string, number>): string {
  const e = Object.entries(m);
  return e.length === 0 ? '—' : e.map(([k, v]) => `${k}: ${v}`).join('; ');
}

export function renderEtlMarkdown(s: EtlSummary): string {
  const lines: string[] = [];
  lines.push(`# ETL diễn tập L0 — ${s.startedAt}`, '');
  lines.push(`Đích: \`${s.targetDatabase}\` · tổng ${(s.totalDurationMs / 1000).toFixed(1)} s`, '');
  lines.push(`**Kết quả: \`${s.outcome}\`** · cờ --allow-stop-anomalies: ${s.allowStopAnomalies ? 'CÓ' : 'không'}`, '');
  lines.push(`Cổng DỪNG đã nổ: ${s.stopRulesFired.length ? s.stopRulesFired.join(', ') : 'không'}`, '');
  if (s.outcome === 'stopped') lines.push('⛔ DỪNG TRƯỚC TRUNCATE — CSDL đích KHÔNG bị đụng.', '');
  if (s.errorName) lines.push(`Lỗi: \`${s.errorName}\` (chỉ tên lớp lỗi; giao dịch đã rollback nếu lỗi ở bước nạp)`, '');
  lines.push('## Mục cần ký phát sinh từ lần chạy', '');
  if (s.signOffItems.length === 0) lines.push('- không');
  for (const it of s.signOffItems) lines.push(`- ${it}`);
  lines.push('');
  lines.push('| # | model | nguồn | đọc | ghi | loại (lý do) | ghi chú (đếm) | setval | ms |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  s.tables.forEach((t, i) => {
    lines.push(
      `| ${i + 1} | ${t.model} | ${t.sourceTable} | ${t.read} | ${t.written} | ${fmtMap(t.skipped)} | ${fmtMap(t.notes)} | ${t.setval ?? '—'} | ${t.durationMs} |`,
    );
  });
  lines.push('', '## Bất thường §3 (đếm trên nguồn, nạp theo mặc định tài liệu)', '');
  lines.push('| id | tài liệu | mô tả | đếm | đã áp | cờ DỪNG |');
  lines.push('|---|---|---|---|---|---|');
  for (const a of s.anomalies) {
    lines.push(`| ${a.id} | ${a.doc} | ${a.description} | ${a.count ?? '—'} | ${a.applied} | ${a.stopFlag ? '⛔' : ''} |`);
  }
  lines.push('', '## Luật không áp ở lô này', '');
  for (const r of s.rulesNotApplied) lines.push(`- ${r}`);
  lines.push('');
  return lines.join('\n');
}

export function writeEtlReport(s: EtlSummary, outDir: string): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = s.startedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `etl-${stamp}.json`);
  const mdPath = path.join(outDir, `etl-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify({ ...s, reportFiles: [jsonPath, mdPath] }, null, 2), 'utf8');
  fs.writeFileSync(mdPath, renderEtlMarkdown(s), 'utf8');
  return [jsonPath, mdPath];
}
