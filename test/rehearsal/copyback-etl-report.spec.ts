/**
 * L13 Task 2 — N1: `--etl-report=<etl-*.json>` của CLI chép ngược. Đọc CẢ `targetDatabase` (runner
 * so với current_database()) lẫn setval ĐỦ 17 bảng chép ngược; thiếu ⇒ TỪ CHỐI (không đoán).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readEtlReport } from '../../scripts/rehearsal/copyback';
import { COPYBACK_TABLES } from '../../src/rehearsal/copyback/tables';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'etl-report-spec-'));

function write(name: string, body: unknown): string {
  const f = path.join(DIR, name);
  fs.writeFileSync(f, JSON.stringify(body), 'utf8');
  return f;
}

const FULL = COPYBACK_TABLES.map((s, i) => ({ targetTable: s.table, setval: String(100 + i), written: i }));

describe('readEtlReport (--etl-report)', () => {
  it('đọc targetDatabase + setval từng bảng', () => {
    const r = readEtlReport(write('ok.json', { targetDatabase: 'tbs_rehearsal', tables: FULL }));
    expect(r.targetDatabase).toBe('tbs_rehearsal');
    expect(Object.keys(r.v2IdStart)).toHaveLength(COPYBACK_TABLES.length);
    expect(r.v2IdStart[COPYBACK_TABLES[0].table]).toBe('100');
    expect(r.loaded[COPYBACK_TABLES[2].table]).toBe(2);
  });

  it('thiếu targetDatabase ⇒ TỪ CHỐI', () => {
    expect(() => readEtlReport(write('nodb.json', { tables: FULL }))).toThrow(/targetDatabase/);
  });

  it('thiếu setval của một bảng chép ngược ⇒ TỪ CHỐI, nêu tên bảng', () => {
    const missing = COPYBACK_TABLES[3].table;
    const tables = FULL.filter((t) => t.targetTable !== missing);
    expect(() => readEtlReport(write('miss.json', { targetDatabase: 'tbs_rehearsal', tables }))).toThrow(
      new RegExp(`thiếu setval.*${missing}`),
    );
  });

  it('setval không phải số nguyên ⇒ coi như thiếu ⇒ TỪ CHỐI', () => {
    const tables = FULL.map((t, i) => (i === 0 ? { ...t, setval: null } : t));
    expect(() => readEtlReport(write('bad.json', { targetDatabase: 'tbs_rehearsal', tables }))).toThrow(/thiếu setval/);
  });
});
