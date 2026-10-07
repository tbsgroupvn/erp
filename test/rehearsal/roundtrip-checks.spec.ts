/**
 * L13 Task 2 — các phép KIỂM NGƯỢC CHIỀU của tổng duyệt khứ hồi (hàm THUẦN, không CSDL):
 * số dư quỹ theo công thức prod ↔ getBalances v2, dòng mới MySQL == ảnh ngược của dòng PG
 * từng cột, dòng cũ không đổi (băm), AUTO_INCREMENT > MAX(id), cờ KỲ VỌNG phải được BÁO
 * (không PASS vì im lặng), lần chép 2 ⇒ 0 dòng mới + không cờ mới.
 */
import { Prisma } from '@prisma/client';
import { permissiveCtx } from '../../src/rehearsal/copyback/expected';
import { pgImage } from '../../src/rehearsal/copyback/pg-image';
import type { CopybackSummary, CopyTableSummary } from '../../src/rehearsal/copyback/runner';
import { COPYBACK_TABLES } from '../../src/rehearsal/copyback/tables';
import {
  checkAutoIncrement,
  checkBalances,
  checkChecksums,
  checkFlags,
  checkNewRows,
  checkSecondRun,
  prodBalances,
  roundtripExitCode,
  tableHash,
} from '../../src/rehearsal/roundtrip/checks';
import { ExpectedFlags } from '../../src/rehearsal/roundtrip/types';

const D = (s: string) => new Prisma.Decimal(s);
const spec = (m: string) => COPYBACK_TABLES.find((s) => s.model === m)!;

const TREASURY = (id: number, over: Record<string, unknown> = {}) => ({
  id, tk_code: 'TK01', type: 'in', bank_info: null, gout: '', wallet_detail_id: null, cus_id: null, cdate: 1,
  cuser: 'kt', money: '100.00000', rate: '3500.50', approve_user: null, approve_date: null, note: 'n', status: 1,
  tranId: null, trandetailId: null, source_module: '', source_id: 0, reversal_of: 0, reversal_code: '',
  reversal_reason: '', ref_request_id: 0, po_id: 0, container_id: 0, order_code: '', ...over,
});
function pgOf(model: string, prod: Record<string, unknown>) {
  const s = spec(model);
  const f = s.forward!.map(prod, permissiveCtx());
  if (f.kind !== 'row') throw new Error('skip');
  return pgImage(f.data as Record<string, unknown>, s.pgColumns);
}

function table(model: string, over: Partial<CopyTableSummary> = {}): CopyTableSummary {
  const s = spec(model);
  return {
    model, doc: s.doc, table: s.table, mark: '1', pgRead: 0, mysqlRead: 0, newRows: 0, gapRows: 0, gapIds: [], copied: 0,
    coercedRows: 0, coercedIds: [], coercedColumns: {}, modifiedOld: 0, modifiedIds: [], modifiedDetails: [],
    modifiedColumns: {}, modifiedReasons: {}, mysqlOnlyRows: 0, deletedRows: 0, deletedIds: [],
    autoIncrementBefore: '2', autoIncrementAfter: '2', lossy: [], durationMs: 0, ...over,
  };
}
function summary(tables: CopyTableSummary[], outcome: CopybackSummary['outcome'] = 'flagged'): CopybackSummary {
  return {
    outcome, outcomeMessage: '', dryRun: false, errorName: null, startedAt: '', finishedAt: '', pgDatabase: 'tbs_rehearsal',
    mysqlHost: '', v2IdStartGiven: true, tables, uniqueConflicts: [], notes: [], outOfScope: [], totalDurationMs: 0, reportFiles: [],
  };
}

const EXPECTED: ExpectedFlags = {
  modified: [{ table: 'tbl_payment', id: '53000', columns: ['mdate', 'ncc_bank_note'] }],
  deleted: [{ table: 'tbl_payment', id: '52999' }, { table: 'tbl_payment_orders', id: '7001' }],
  coerced: [{ table: 'tbl_account_histories', id: '1790325305' }],
};
function flaggedRun(): CopybackSummary {
  return summary([
    table('TreasuryEntry', { newRows: 3, copied: 3, coercedRows: 1, coercedIds: ['1790325305'], coercedColumns: { rate: 1 } }),
    table('SupplierPayment', {
      newRows: 1, copied: 1, modifiedOld: 1, modifiedIds: ['53000'],
      modifiedDetails: [{ id: '53000', columns: ['ncc_bank_note', 'mdate'] }], deletedRows: 1, deletedIds: ['52999'],
    }),
    table('SupplierPaymentOrder', { deletedRows: 1, deletedIds: ['7001'] }),
  ]);
}

describe('prodBalances + checkBalances (09b §8.1 — công thức prod getBalances)', () => {
  it('opening + Σmoney(status=1) theo tk_code; tk_code ngoài danh mục có dòng status=1 ⇒ khoá riêng', () => {
    const m = prodBalances(
      [{ code: 'TK01', opening_balance: '10.00000' }, { code: 'TK02', opening_balance: '0.00000' }],
      [{ tk_code: 'TK01', s: '5.50000' }, { tk_code: 'CHI-X', s: '-1.00000' }],
    );
    expect([...m.entries()].map(([k, v]) => [k, v.toFixed(5)])).toEqual([
      ['TK01', '15.50000'], ['TK02', '0.00000'], ['CHI-X', '-1.00000'],
    ]);
  });

  it('khớp từng quỹ (so Decimal, không so chuỗi) ⇒ PASS; lệch hoặc thiếu khoá ⇒ FAIL nêu mã quỹ', () => {
    const prod = new Map([['TK01', D('15.5')], ['TK02', D('0')]]);
    expect(checkBalances(prod, new Map([['TK01', D('15.50000')], ['TK02', D('0.00')]])).status).toBe('PASS');
    const bad = checkBalances(prod, new Map([['TK01', D('15.51')], ['TK03', D('0')]]));
    expect(bad.status).toBe('FAIL');
    expect(bad.details).toMatchObject({ mismatched: ['TK01', 'TK02', 'TK03'] });
  });
});

describe('checkNewRows — dòng MySQL mới == ảnh ngược của dòng PG, từng cột', () => {
  const s = spec('TreasuryEntry');
  const baseline = new Set(['1']);
  const pg1 = pgOf('TreasuryEntry', TREASURY(1));
  const pgNew = { ...pgOf('TreasuryEntry', TREASURY(1790325305)), rate: '3612.345678' };
  const myNew = { ...TREASURY(1790325305), rate: '3612.35', cdate: 1, status: 1 }; // mysql2: INT ⇒ number

  it('khớp (rate làm tròn 6→2 là phần mất có chủ đích) ⇒ PASS, đếm phần mất', () => {
    const r = checkNewRows([{ spec: s, baselineIds: baseline, mysqlAfter: [TREASURY(1), myNew], pg: [pg1, pgNew] }]);
    expect(r.status).toBe('PASS');
    expect(r.details).toMatchObject({ checkedRows: 1, allowedLoss: { 'tbl_account_histories.rate': 1 } });
  });

  it('một cột MySQL khác ảnh ngược ⇒ FAIL, nêu bảng + id + TÊN cột (không giá trị)', () => {
    const r = checkNewRows([{ spec: s, baselineIds: baseline, mysqlAfter: [TREASURY(1), { ...myNew, note: 'BI-MAT' }], pg: [pg1, pgNew] }]);
    expect(r.status).toBe('FAIL');
    expect(r.details.mismatches).toEqual([{ table: 'tbl_account_histories', id: '1790325305', columns: ['note'] }]);
    expect(JSON.stringify(r)).not.toContain('BI-MAT');
  });

  it('làm tròn SAI khi chép (3612.345678 → 3612.34) ⇒ FAIL dù cột rate là phần mất được phép ở chiều xuôi', () => {
    const r = checkNewRows([{ spec: s, baselineIds: baseline, mysqlAfter: [TREASURY(1), { ...myNew, rate: '3612.34' }], pg: [pg1, pgNew] }]);
    expect(r.status).toBe('FAIL');
    expect(r.details.mismatches).toEqual([{ table: 'tbl_account_histories', id: '1790325305', columns: ['rate'] }]);
  });

  it('MySQL == ngược(PG) nhưng xuôi(MySQL) ≠ PG ngoài phần mất (v2 ghi mã chưa chuẩn hoá) ⇒ FAIL (khứ hồi không ổn định)', () => {
    const pgOdd = { ...pgNew, source_module: ' rtl13 ' };
    const myOdd = { ...myNew, source_module: ' rtl13 ' };
    const r = checkNewRows([{ spec: s, baselineIds: baseline, mysqlAfter: [TREASURY(1), myOdd], pg: [pg1, pgOdd] }]);
    expect(r.status).toBe('FAIL');
    expect(r.details.mismatches).toEqual([{ table: 'tbl_account_histories', id: '1790325305', columns: ['source_module'] }]);
  });

  it('dòng v2 (PG, ngoài mốc) KHÔNG về MySQL ⇒ FAIL missing; MySQL có dòng mới lạ ⇒ FAIL extra', () => {
    const r1 = checkNewRows([{ spec: s, baselineIds: baseline, mysqlAfter: [TREASURY(1)], pg: [pg1, pgNew] }]);
    expect(r1.status).toBe('FAIL');
    expect(r1.details.missingInMysql).toEqual([{ table: 'tbl_account_histories', id: '1790325305' }]);
    const r2 = checkNewRows([{ spec: s, baselineIds: baseline, mysqlAfter: [TREASURY(1), myNew, TREASURY(9)], pg: [pg1, pgNew] }]);
    expect(r2.details.extraInMysql).toEqual([{ table: 'tbl_account_histories', id: '9' }]);
  });

  it('không có dòng mới nào ⇒ FAIL (khứ hồi rỗng không chứng minh gì)', () => {
    const r = checkNewRows([{ spec: s, baselineIds: baseline, mysqlAfter: [TREASURY(1)], pg: [pg1] }]);
    expect(r.status).toBe('FAIL');
  });
});

describe('tableHash + checkChecksums — dòng ≤ mốc KHÔNG đổi', () => {
  it('băm chỉ dòng id ≤ mốc; đổi một cột dòng cũ ⇒ FAIL; thêm dòng > mốc ⇒ vẫn PASS', () => {
    const rows = [TREASURY(1), TREASURY(2)];
    const before = { tbl_account_histories: tableHash(rows, 2n) };
    expect(checkChecksums('R', 'x', before, { tbl_account_histories: tableHash([...rows, TREASURY(3)], 2n) }).status).toBe('PASS');
    const changed = [TREASURY(1), TREASURY(2, { note: 'x' })];
    const r = checkChecksums('R', 'x', before, { tbl_account_histories: tableHash(changed, 2n) });
    expect(r.status).toBe('FAIL');
    expect(r.details).toMatchObject({ changedTables: ['tbl_account_histories'] });
  });

  it('bảng ETL đã nạp dòng mà băm dòng cũ đếm 0 (mốc rỗng / đọc hụt) ⇒ FAIL, báo số dòng từng bảng', () => {
    const empty = { tbl_account_histories: tableHash([], null), tbl_fx_fee_rates: tableHash([{ id: 1 }], 1n) };
    const r = checkChecksums('R', 'x', empty, empty, { tbl_account_histories: 2688, tbl_fx_fee_rates: 6, tbl_fx_adjustments: 0 });
    expect(r.status).toBe('FAIL');
    expect(r.details).toMatchObject({ emptyTables: ['tbl_account_histories'], perTable: { tbl_account_histories: 0, tbl_fx_fee_rates: 1 } });
    // bảng ETL nạp 0 dòng (FxAdjustment) được phép rỗng
    const ok = { tbl_fx_fee_rates: tableHash([{ id: 1 }], 1n), tbl_fx_adjustments: tableHash([], null) };
    expect(checkChecksums('R', 'x', ok, ok, { tbl_fx_fee_rates: 6, tbl_fx_adjustments: 0 }).status).toBe('PASS');
  });

  it('NULL khác chuỗi rỗng khác "null" trong băm', () => {
    const a = tableHash([{ id: 1, x: null }], 1n).sha;
    expect(tableHash([{ id: 1, x: '' }], 1n).sha).not.toBe(a);
    expect(tableHash([{ id: 1, x: 'null' }], 1n).sha).not.toBe(a);
  });
});

describe('checkAutoIncrement', () => {
  it('AI > MAX(id) mọi bảng ⇒ PASS; AI ≤ MAX ⇒ FAIL nêu bảng', () => {
    expect(checkAutoIncrement('R', [{ table: 'a', max: '5', ai: '6' }, { table: 'b', max: null, ai: '1' }]).status).toBe('PASS');
    const r = checkAutoIncrement('R', [{ table: 'a', max: '5', ai: '5' }]);
    expect(r.status).toBe('FAIL');
    expect(r.details).toMatchObject({ bad: ['a'] });
  });
});

describe('checkFlags — cờ KỲ VỌNG phải được BÁO đúng id + cột (không PASS vì im lặng)', () => {
  it('báo đủ và đúng (thứ tự cột không quan trọng) ⇒ PASS', () => {
    expect(checkFlags('R', EXPECTED, flaggedRun()).status).toBe('PASS');
  });

  it('sửa dòng cũ KHÔNG được báo (công cụ im lặng) ⇒ FAIL', () => {
    const s = flaggedRun();
    const sp = s.tables.find((t) => t.model === 'SupplierPayment')!;
    Object.assign(sp, { modifiedOld: 0, modifiedIds: [], modifiedDetails: [] });
    const r = checkFlags('R', EXPECTED, s);
    expect(r.status).toBe('FAIL');
    expect(r.details.missing).toEqual(expect.arrayContaining(['modified tbl_payment#53000']));
  });

  it('báo SAI cột ⇒ FAIL; xoá cứng không được báo ⇒ FAIL; cờ THỪA ngoài kỳ vọng ⇒ FAIL', () => {
    const s1 = flaggedRun();
    s1.tables.find((t) => t.model === 'SupplierPayment')!.modifiedDetails = [{ id: '53000', columns: ['mdate'] }];
    expect(checkFlags('R', EXPECTED, s1).status).toBe('FAIL');
    const s2 = flaggedRun();
    Object.assign(s2.tables.find((t) => t.model === 'SupplierPaymentOrder')!, { deletedRows: 0, deletedIds: [] });
    expect(checkFlags('R', EXPECTED, s2).details.missing).toEqual(['deleted tbl_payment_orders#7001']);
    const s3 = flaggedRun();
    Object.assign(s3.tables.find((t) => t.model === 'TreasuryEntry')!, { gapRows: 1, gapIds: ['5'] });
    expect(checkFlags('R', EXPECTED, s3).details.unexpected).toEqual(['gap tbl_account_histories#5']);
  });

  it('outcome clean dù có cờ kỳ vọng ⇒ FAIL', () => {
    const s = flaggedRun();
    s.outcome = 'clean';
    expect(checkFlags('R', EXPECTED, s).status).toBe('FAIL');
  });
});

describe('checkSecondRun — lần chép 2 (có --etl-report): 0 dòng mới, không cờ mới', () => {
  const second = () =>
    summary([
      table('TreasuryEntry', { mark: '1790325307' }),
      table('SupplierPayment', {
        modifiedOld: 1, modifiedIds: ['53000'], modifiedDetails: [{ id: '53000', columns: ['mdate', 'ncc_bank_note'] }],
        deletedRows: 1, deletedIds: ['52999'],
      }),
      table('SupplierPaymentOrder', { deletedRows: 1, deletedIds: ['7001'] }),
    ]);
  it('chỉ còn đúng cờ sửa/xoá dòng cũ (vẫn tồn tại), 0 chép, 0 ép kiểu ⇒ PASS', () => {
    expect(checkSecondRun('R', EXPECTED, second()).status).toBe('PASS');
  });
  it('chép thêm dòng / báo lại dòng đã làm tròn ⇒ FAIL', () => {
    const s = second();
    Object.assign(s.tables[0], { newRows: 1, copied: 1 });
    expect(checkSecondRun('R', EXPECTED, s).status).toBe('FAIL');
    const s2 = second();
    s2.tables[0].modifiedDetails = [{ id: '1790325305', columns: ['rate'] }];
    s2.tables[0].modifiedOld = 1;
    expect(checkSecondRun('R', EXPECTED, s2).details.unexpected).toEqual(['modified tbl_account_histories#1790325305']);
  });
});

describe('roundtripExitCode', () => {
  it('mọi kiểm PASS ⇒ 0, có FAIL ⇒ 4', () => {
    const p = { id: 'a', title: '', status: 'PASS' as const, details: {} };
    expect(roundtripExitCode([p])).toBe(0);
    expect(roundtripExitCode([p, { ...p, status: 'FAIL' as const }])).toBe(4);
  });
});
