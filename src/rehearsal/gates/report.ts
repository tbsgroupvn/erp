/**
 * L0 Task 3 — ghi báo cáo cổng nghiệm thu (JSON + Markdown) ra thư mục NGOÀI repo.
 *
 * ⛔ Chỉ SỐ ĐẾM / TỔNG. `assertCountsOnly` kiểm cứng TRƯỚC khi ghi: mọi giá trị trong source/target/
 * diff/info phải là số, chuỗi số, cờ, NULL hoặc token 'differs'; khoá lệch chỉ được là NHÃN phân loại
 * ngắn (mã ví, source_module, trạng thái…) — chuỗi giống nội dung chuyển khoản / số tài khoản ⇒ ném lỗi.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Agg, GateResult, GateStatus } from './types';

export interface GateRunSummary {
  startedAt: string;
  finishedAt: string;
  targetDatabase: string;
  counts: Record<GateStatus, number>;
  results: GateResult[];
  reportFiles: string[];
}

const NUM_RE = /^-?\d+(\.\d+)?$/;
const AGG_KEY_RE = /^[A-Za-zΣ0-9_'.-]{1,60}$/;
const COL_RE = /^[A-Za-z_][A-Za-z0-9_]{0,59}$/;

function badValue(v: unknown): boolean {
  if (v === null || typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return !(NUM_RE.test(v) || v === 'differs');
  return true;
}

/** Nhãn phân loại: từng đoạn (tách bởi '|') ≤ 40 ký tự, ≤ 3 từ, không có dãy ≥ 7 chữ số (STK). */
export function isLabel(k: string): boolean {
  if (k.length === 0 || k.length > 120) return false;
  return k.split('|').every((seg) => seg.length <= 40 && seg.trim().split(/\s+/).length <= 3 && !/\d{7,}/.test(seg));
}

export function assertCountsOnly(s: GateRunSummary): void {
  for (const r of s.results) {
    for (const part of ['source', 'target', 'diff', 'info'] as const) {
      const a = r[part] as Agg | undefined;
      if (!a) continue;
      for (const [k, v] of Object.entries(a)) {
        if (!AGG_KEY_RE.test(k)) throw new Error(`báo cáo cổng ${r.id}: tên trường "${part}" không hợp lệ — chỉ ghi số đếm/tổng`);
        if (badValue(v)) throw new Error(`báo cáo cổng ${r.id}: ${part}.${k} không phải số đếm/tổng — từ chối ghi`);
      }
    }
    for (const c of r.columns ?? []) {
      if (!COL_RE.test(c)) throw new Error(`báo cáo cổng ${r.id}: tên cột lạ — từ chối ghi`);
    }
    for (const k of r.keys ?? []) {
      if (!isLabel(k)) throw new Error(`báo cáo cổng ${r.id}: khoá lệch không phải nhãn phân loại — từ chối ghi`);
    }
  }
}

function assertOutsideRepo(outDir: string, repoRoot: string): void {
  const rel = path.relative(path.resolve(repoRoot), path.resolve(outDir));
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error(`gates: thư mục báo cáo phải nằm ngoài repo (số tiền thật) — nhận ${outDir}`);
  }
}

function fmt(a: Agg | undefined, max = 6): string {
  if (!a) return '—';
  const e = Object.entries(a);
  if (e.length === 0) return '—';
  const s = e.slice(0, max).map(([k, v]) => `${k}=${v === null ? 'NULL' : String(v)}`).join('; ');
  return e.length > max ? `${s}; …(+${e.length - max})` : s;
}
const esc = (s: string) => s.replace(/\|/g, '\\|');

export function renderGateMarkdown(s: GateRunSummary): string {
  const c = s.counts;
  const L: string[] = [];
  L.push(`# Cổng nghiệm thu diễn tập L0 — ${s.startedAt}`, '');
  L.push(`Đích: \`${s.targetDatabase}\` · nguồn: MariaDB diễn tập (dump 25/09 15:41) · chỉ ĐỌC hai phía`, '');
  L.push(`**Tổng ${s.results.length} cổng: PASS ${c.PASS} · FAIL ${c.FAIL} · SKIPPED ${c.SKIPPED} · ERROR ${c.ERROR}**`, '');
  L.push('| id | loại | kết quả | tài liệu | cổng | nguồn | đích | chênh |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const r of s.results) {
    L.push(`| ${esc(r.id)} | ${r.kind} | ${r.status} | ${esc(r.doc)} | ${esc(r.title)} | ${esc(fmt(r.source))} | ${esc(fmt(r.target))} | ${esc(fmt(r.diff))} |`);
  }
  const fails = s.results.filter((r) => r.status === 'FAIL' || r.status === 'ERROR');
  L.push('', `## FAIL / ERROR (${fails.length})`, '');
  if (fails.length === 0) L.push('- không');
  for (const r of fails) {
    L.push(`### ${r.id} — ${r.status}`, '');
    L.push(`- ${r.title} (${r.doc})`);
    L.push(`- nguồn: ${fmt(r.source, 99)}`);
    L.push(`- đích: ${fmt(r.target, 99)}`);
    L.push(`- chênh: ${fmt(r.diff, 99)}`);
    if (r.columns?.length) L.push(`- cột lệch: ${r.columns.join(', ')}`);
    if (r.keys?.length) L.push(`- nhãn lệch: ${r.keys.join(' · ')}`);
    if (r.info) L.push(`- thông tin: ${fmt(r.info, 99)}`);
    if (r.errorName) L.push(`- lỗi: \`${r.errorName}\` (chỉ tên lớp lỗi)`);
    L.push('');
  }
  const sk = s.results.filter((r) => r.status === 'SKIPPED');
  L.push(`## SKIPPED (${sk.length})`, '');
  for (const r of sk) L.push(`- **${r.id}** — ${r.reason ?? ''}${r.info ? ` · ${fmt(r.info, 99)}` : ''}`);
  const inf = s.results.filter((r) => r.info && r.status === 'PASS');
  if (inf.length) {
    L.push('', '## Thông tin kèm cổng PASS (không quyết định kết quả)', '');
    for (const r of inf) L.push(`- **${r.id}** — ${fmt(r.info, 99)}`);
  }
  L.push('');
  return L.join('\n');
}

export function writeGateReport(s: GateRunSummary, outDir: string, repoRoot: string): string[] {
  assertOutsideRepo(outDir, repoRoot);
  assertCountsOnly(s);
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = s.startedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `gates-${stamp}.json`);
  const mdPath = path.join(outDir, `gates-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify({ ...s, reportFiles: [jsonPath, mdPath] }, null, 2), 'utf8');
  fs.writeFileSync(mdPath, renderGateMarkdown(s), 'utf8');
  return [jsonPath, mdPath];
}
