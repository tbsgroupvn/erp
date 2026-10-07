/**
 * L13 Task 1 — mapper NGƯỢC (PG v2 → MySQL prod) của 17 bảng lõi tiền.
 * Mọi dòng ở đây TỰ DỰNG — không có dữ liệu thật.
 *
 * Luật khứ hồi: với dòng prod dựng theo từng luật cột,
 *   ngược(ảnhPG(xuôi(dòng_prod))) == dòng_prod   (từng cột)
 * trừ các cột mất CÓ CHỦ ĐÍCH — có ca riêng khẳng định ĐÚNG phần mất đó.
 */
import { EtlSafeError } from '../../src/rehearsal/etl/convert';
import { canonicalJson, compactJson, jsonEquivalent, MyRow, PgRow, Rev } from '../../src/rehearsal/copyback/convert';
import { diffPgColumns, expectedPgImage, myText, permissiveCtx } from '../../src/rehearsal/copyback/expected';
import { mysqlName, pgImage, pgSelectSql } from '../../src/rehearsal/copyback/pg-image';
import { CopybackSpec } from '../../src/rehearsal/copyback/spec';
import { COPYBACK_TABLES } from '../../src/rehearsal/copyback/tables';
import { TABLES } from '../../src/rehearsal/etl/tables';

function spec(model: string): CopybackSpec {
  const s = COPYBACK_TABLES.find((x) => x.model === model);
  if (!s) throw new Error(model);
  return s;
}

function asMy(r: Record<string, unknown>): MyRow {
  const o: MyRow = {};
  for (const [k, v] of Object.entries(r)) o[k] = myText(v);
  return o;
}

/** ảnh PG của dòng prod qua mapper xuôi L0. */
function imageOf(model: string, prod: Record<string, unknown>): PgRow {
  const s = spec(model);
  const f = s.forward!.map(prod, permissiveCtx());
  if (f.kind !== 'row') throw new Error(`xuôi loại dòng: ${f.reason}`);
  return pgImage(f.data as Record<string, unknown>, s.pgColumns);
}

function roundTrip(model: string, prod: Record<string, unknown>) {
  return spec(model).reverse(imageOf(model, prod));
}

function expectExact(model: string, prod: Record<string, unknown>) {
  const rt = roundTrip(model, prod);
  expect(rt.row).toEqual(asMy(prod));
  expect(rt.coerced).toEqual([]);
}

// ============================================================ dòng prod tự dựng (dạng mysql2: int → number, bigint/decimal → chuỗi)
const FUND_ACCOUNT = {
  id: 321, code: 'TK07', name: 'Quỹ ẩn', subname: '', currency: 'VND', acc_group: 'store', has_gout: 0,
  display_order: 7, is_active: 0, note: '', opening_balance: '0.00000', stk: '', bank_code: '',
  wallet_stream: 'ca_nhan', custom_label: '', cdate: 1700000000, mdate: 0, owner_uid: 0, gl_account: '',
  quy_doi_sang: '',
};
const TREASURY = {
  id: 1790325303, tk_code: 'TK01', type: 'tranfer', bank_info: null, gout: '', wallet_detail_id: null,
  cus_id: ' TBS01 ', cdate: 1790000000, cuser: 'kt1', money: '-99999999999999.12345', rate: '3500.50',
  approve_user: null, approve_date: null, note: 'n', status: 9, tranId: '9007199254740993', trandetailId: null,
  source_module: '', source_id: 0, reversal_of: 0, reversal_code: '', reversal_reason: '', ref_request_id: 0,
  po_id: 0, container_id: 0, order_code: '',
};
const FX_FEE = { id: 1, from_cur: 'VND', to_cur: 'CNY', fee_percent: '0.150', updated_by: null, updated_at: null };
const FX_TRANSFER = {
  id: 7207, code: 'FX-0001', from_tk: 'TK01', to_tk: 'TK05', from_currency: 'VND', to_currency: 'CNY',
  amount_out: '1000000.00000', amount_in: '285.71000', rate: '3500.000000', rate_system: '0.000000', fee: '0.00',
  fee_currency: null, fee_percent: null, po_id: 0, note: null, status: 'approved', approval_request_id: 500,
  created_by: 'a', created_at: 1, approved_by: '', approved_at: 0, reversed_by: '', reversed_at: 0, reverse_of: 0,
  bank_tran_id: '0', agent_rate: '0.000000', agent_tk: '', agent_amount: '0.00000',
};
const CHANGELOG = {
  id: 28, account_id: 3, account_code: 'TK03', action: 'update', changes: '{"x":1}', user_id: 0, user_name: '',
  created_at: 5,
};
const BANK_TX = {
  id: '17814', bankid: '', bank_name: 'MBBank', bank_account: '0000', tranType: 'I', tranAmount: '5000000',
  tranTime: '1758790000123', tranMess: 'CK thu', originMess: null, cus_id: null, type: '1', cdate: 1, mdate: null,
  status: 'no', confirm: 'no', tk_code: '',
};
const BANK_DETAIL = {
  id: '17149', tranId: '17814', type: '1', money: '5000000', cus_id: 'TBS1', pay_info: null, note: null,
  author: 'x', cdate: 1, mdate: null, confirm: 'no', po_id: 0, wallet_stream: null,
};
const CHI_MATCH = {
  id: 81, bank_tx_id: '17814', request_id: 501, method: 'auto', matched_by: 'sys', matched_at: 1,
  unmatched_at: null, unmatched_by: null, note: '',
};
const RECONCILE = {
  id: 157, bank_tran_id: '17813', doc_module: '', doc_id: 0, match_type: 'fee', note: '', cuser: '', cdate: 0,
};
const PAY_SOURCE = { id: 18, name: 'TT quỹ USD', tk_code: null, sort_order: 0, is_active: 1, created_at: '2026-09-01 08:30:15' };
const PAYMENT = {
  id: '56420', cdate: 1, mdate: null, price_cyn: '1234.50', currency: 'USD', rate_buy: 25000, saler: 'sale1',
  from: 'Taobao', source: '', code_order: ' TBS01-1 ', order_id: '0', note: '', note_payment: null,
  price_payment: null, payment: null, pdate: null, status: 'no', confirm: 'no', po_id: 0, pay_type: '',
  bill_images: '["a.jpg"]', account_code: '', ncc_receiver: '', ncc_bank_name: '', ncc_bank_account: '',
  ncc_qr_image: '', ncc_bank_note: null, ncc_pay_channel: 'bank', ncc_platform_order: '', ncc_invoice_images: '[]',
  ncc_packing_list_images: null, kt_note: null, tt_ngoai_kieu: '',
};
const PAY_ORDER = { id: 17592, payment_id: 56420, order_id: 9, rmb: '0.00', cdate: 0, prev_fund: null, prev_rate: '3500.00' };
const PAY_LOG = {
  id: 8722, payment_id: 99999, action: 'doc_chan_truong', old_data: '', new_data: null, note: null,
  created_by: 'kt', cdate: 1,
};
const RETURN_CONFIG = {
  id: 4330, checkpoint_type: 'approval', checkpoint_ref: '109', edit_mode: 'whitelist', require_reason: 1,
  updated_by: '', updated_at: 0,
};
const RETURN_FIELD = { id: 368, config_id: 4330, field_key: 'amount' };
const RETURN_STATE_RESUB = {
  id: 19528, object_type: 'payment', object_id: '56420', checkpoint_type: 'biz', checkpoint_ref: 'ncc_chungtu',
  state: 'resubmitted', reason: 'thiếu HĐ', round: 2, fields_opened: '["amount","note"]',
  data_before: '{"amount":"1.50","n":12345678901234567890}', data_after: '{"amount":2.50}', returned_by: 'kt',
  returned_at: 10, resubmitted_at: 20,
};
const RETURN_STATE_RET = {
  ...RETURN_STATE_RESUB, id: 19527, object_type: 'approval_request', object_id: '500', state: 'returned',
  data_before: null, data_after: null, resubmitted_at: 0,
};

// ============================================================ khứ hồi chính xác — từng bảng
describe('khứ hồi thuần ngược(ảnhPG(xuôi(dòng_prod))) == dòng_prod', () => {
  const cases: [string, Record<string, unknown>][] = [
    ['FundAccount', FUND_ACCOUNT],
    ['FundAccount', { ...FUND_ACCOUNT, opening_balance: '-123456789012345.12345', owner_uid: null, wallet_stream: 'cty' }],
    ['TreasuryEntry', TREASURY],
    ['TreasuryEntry', { ...TREASURY, money: null, rate: null, status: null, tk_code: null, gout: null, trandetailId: '1' }],
    ['FxFeeRate', FX_FEE],
    ['FxTransfer', FX_TRANSFER],
    ['FxTransfer', { ...FX_TRANSFER, fee_percent: '1.250', fee_currency: 'CNY', note: 'ghi chú', bank_tran_id: '17814', agent_tk: 'TK09', agent_rate: '0.141234', agent_amount: '40.35000' }],
    ['FundAccountChangelog', CHANGELOG],
    ['BankTransaction', BANK_TX],
    ['BankTransaction', { ...BANK_TX, id: '9223372036854775807', tranTime: '9007199254740993', cus_id: '', mdate: 7 }],
    ['BankTransactionDetail', BANK_DETAIL],
    ['BankTransactionDetail', { ...BANK_DETAIL, wallet_stream: 'cty', cus_id: null, money: '-1' }],
    ['BankChiMatch', CHI_MATCH],
    ['BankChiMatch', { ...CHI_MATCH, unmatched_at: 9, unmatched_by: 'kt', method: 'manual' }],
    ['BankReconcileLink', RECONCILE],
    ['PaymentSource', PAY_SOURCE],
    ['PaymentSource', { ...PAY_SOURCE, tk_code: 'TK01', created_at: null, sort_order: null, is_active: null }],
    ['SupplierPayment', PAYMENT],
    ['SupplierPayment', { ...PAYMENT, payment: 'yes', pdate: 5, price_payment: '30862500.00', order_id: '123', note_payment: '' }],
    ['SupplierPaymentOrder', PAY_ORDER],
    ['SupplierPaymentLog', PAY_LOG],
    ['ReturnConfig', RETURN_CONFIG],
    ['ReturnConfig', { ...RETURN_CONFIG, require_reason: 0, updated_by: null, updated_at: null, checkpoint_type: 'biz', checkpoint_ref: 'ncc_chungtu' }],
    ['ReturnConfigField', RETURN_FIELD],
    ['ReturnState', RETURN_STATE_RESUB],
    ['ReturnState', RETURN_STATE_RET],
  ];
  it.each(cases)('%s', (model, prod) => expectExact(model, prod));

  it('mọi bảng có chiều xuôi đều được phủ ít nhất một ca khứ hồi', () => {
    const covered = new Set(cases.map(([m]) => m));
    const withForward = COPYBACK_TABLES.filter((s) => s.forward !== null).map((s) => s.model);
    expect(withForward.filter((m) => !covered.has(m))).toEqual([]);
  });
});

// ============================================================ độ phủ cột
describe('độ phủ cột', () => {
  it('17 bảng, cùng thứ tự cha → con với ETL xuôi', () => {
    expect(COPYBACK_TABLES.map((s) => s.model)).toEqual(TABLES.map((t) => t.model));
    expect(COPYBACK_TABLES.map((s) => s.table)).toEqual(TABLES.map((t) => t.targetTable));
  });

  it('cột MySQL do mapper ngược ghi == đúng cột mapper xuôi đọc (không thiếu, không thừa)', () => {
    const samples: Record<string, Record<string, unknown>> = {
      FundAccount: FUND_ACCOUNT, TreasuryEntry: TREASURY, FxFeeRate: FX_FEE, FxTransfer: FX_TRANSFER,
      FundAccountChangelog: CHANGELOG, BankTransaction: BANK_TX, BankTransactionDetail: BANK_DETAIL,
      BankChiMatch: CHI_MATCH, BankReconcileLink: RECONCILE, PaymentSource: PAY_SOURCE, SupplierPayment: PAYMENT,
      SupplierPaymentOrder: PAY_ORDER, SupplierPaymentLog: PAY_LOG, ReturnConfig: RETURN_CONFIG,
      ReturnConfigField: RETURN_FIELD, ReturnState: RETURN_STATE_RESUB,
    };
    for (const s of COPYBACK_TABLES.filter((x) => x.forward !== null)) {
      const out = Object.keys(roundTrip(s.model, samples[s.model]).row).sort();
      expect({ model: s.model, cols: out }).toEqual({ model: s.model, cols: [...s.forward!.columns].sort() });
    }
  });

  it('FxAdjustment (chiều xuôi DỪNG nếu có dòng): mapper ngược ghi đủ 20 cột prod', () => {
    const pg: PgRow = {
      id: '1', fx_id: '7207', request_id: '0', old_rate: '3500.000000', old_out: '1.00000', old_in: '2.00000',
      old_fee: '0.00', old_fee_cur: null, new_rate: '3510.123456', new_out: '1.00000', new_in: '2.10000',
      new_fee: '0.50', new_fee_cur: 'CNY', delta_out: '0.00000', delta_in: '0.10000', delta_fee: '0.50',
      hist_ids: '[1,2]', reason: 'sửa tỷ giá', cuser: 'kt', cdate: '1790000000',
    };
    const r = spec('FxAdjustment').reverse(pg);
    expect(r.row).toEqual(pg); // cùng tên/kiểu/scale ở hai phía ⇒ nguyên văn
    expect(r.coerced).toEqual([]);
    expect(spec('FxAdjustment').forward).toBeNull();
  });

  it('SELECT PG liệt kê cột tường minh ::text (không SELECT *), cột "from" được đặt trong ""', () => {
    const sql = pgSelectSql('tbl_payment', spec('SupplierPayment').pgColumns, ' WHERE "id" > 5');
    expect(sql).toContain('"from"::text AS "from"');
    expect(sql).toContain('"ncc_bank_account"::text');
    expect(sql).not.toContain('*');
    expect(sql.endsWith(' WHERE "id" > 5 ORDER BY "id"')).toBe(true);
    expect(() => pgSelectSql('tbl_payment; DROP', spec('SupplierPayment').pgColumns)).toThrow(EtlSafeError);
  });
});

// ============================================================ phần mất CÓ CHỦ ĐÍCH — khẳng định đúng phần mất
describe('phần mất có chủ đích', () => {
  it('TreasuryEntry.rate: v2 Decimal(18,6) → decimal(12,2) làm tròn nửa-xa-số-0 + ĐẾM (§3.7 R1)', () => {
    const img = { ...imageOf('TreasuryEntry', TREASURY), rate: '3500.125000' };
    const r = spec('TreasuryEntry').reverse(img);
    expect(r.row.rate).toBe('3500.13');
    expect(r.coerced).toEqual(['rate']);
    expect(spec('TreasuryEntry').reverse({ ...img, rate: '-3500.125000' }).row.rate).toBe('-3500.13');
    expect(spec('TreasuryEntry').reverse({ ...img, rate: '3500.124999' }).row.rate).toBe('3500.12');
    // cùng giá trị, chỉ khác số 0 đuôi ⇒ KHÔNG tính là đổi giá trị
    const same = spec('TreasuryEntry').reverse({ ...img, rate: '3500.500000' });
    expect(same.row.rate).toBe('3500.50');
    expect(same.coerced).toEqual([]);
  });

  it('TreasuryEntry.rate vượt decimal(12,2) ⇒ DỪNG (không để MySQL cắt/nổ giữa chừng)', () => {
    const img = { ...imageOf('TreasuryEntry', TREASURY), rate: '10000000000.000000' };
    expect(() => spec('TreasuryEntry').reverse(img)).toThrow(/decimal\(12,2\)/);
    expect(spec('TreasuryEntry').reverse({ ...img, rate: '9999999999.994999' }).row.rate).toBe('9999999999.99');
    expect(() => spec('TreasuryEntry').reverse({ ...img, rate: '9999999999.995000' })).toThrow(/decimal/);
  });

  it('G-DOC-3: mã quỹ gốc có khoảng trắng/chữ thường trở về dạng TRIM+UPPER', () => {
    const rt = roundTrip('TreasuryEntry', { ...TREASURY, tk_code: ' tk01 ', source_module: ' fx ' });
    expect(rt.row.tk_code).toBe('TK01');
    expect(rt.row.source_module).toBe('fx');
    expect(roundTrip('FxTransfer', { ...FX_TRANSFER, from_tk: 'tk01' }).row.from_tk).toBe('TK01');
    expect(roundTrip('SupplierPayment', { ...PAYMENT, saler: ' sale1 ', account_code: 'tk05' }).row).toMatchObject({
      saler: 'sale1',
      account_code: 'TK05',
    });
    // cus_id/code_order KHÔNG bị chuẩn hoá (tài liệu cấm TRIM)
    expect(roundTrip('TreasuryEntry', TREASURY).row.cus_id).toBe(' TBS01 ');
    expect(roundTrip('SupplierPayment', PAYMENT).row.code_order).toBe(' TBS01-1 ');
  });

  it("FundAccount: cột `password` không có ở PG ⇒ không ghi (MySQL lấy DEFAULT '')", () => {
    const r = roundTrip('FundAccount', FUND_ACCOUNT);
    expect('password' in r.row).toBe(false);
    expect(spec('FundAccount').mysqlOnlyColumns).toEqual(['password']);
  });

  it('ReturnConfig.require_reason: tinyint 2 → Boolean → 1', () => {
    expect(roundTrip('ReturnConfig', { ...RETURN_CONFIG, require_reason: 2 }).row.require_reason).toBe('1');
  });

  it("ReturnState: data_before/data_after '' ⇒ NULL; returned mang data_after cũ (A3) ⇒ NULL", () => {
    expect(roundTrip('ReturnState', { ...RETURN_STATE_RESUB, data_before: '', data_after: '' }).row).toMatchObject({
      data_before: null,
      data_after: null,
    });
    expect(roundTrip('ReturnState', { ...RETURN_STATE_RET, data_after: '{"old":1}' }).row.data_after).toBeNull();
  });

  it('ReturnState: resubmitted_at NULL (v2) ⇒ 0 (sentinel prod) — khứ hồi chính xác', () => {
    const img = imageOf('ReturnState', RETURN_STATE_RET);
    expect(img.resubmitted_at).toBeNull();
    expect(spec('ReturnState').reverse(img).row.resubmitted_at).toBe('0');
  });

  it('jsonb::text → JSON GỌN: bằng NGỮ NGHĨA với văn bản gốc PHP nhưng khác từng byte', () => {
    const phpOriginal = '{"note":"Ti\\u1ec1n","amount":1.50,"url":"a\\/b"}';
    const jsonbText = '{"url": "a/b", "note": "Tiền", "amount": 1.50}'; // PG sắp khoá + giải escape + chèn khoảng trắng
    const img = { ...imageOf('ReturnState', RETURN_STATE_RESUB), data_before: jsonbText };
    const out = spec('ReturnState').reverse(img).row.data_before!;
    expect(out).toBe('{"url":"a/b","note":"Tiền","amount":1.50}');
    expect(out).not.toBe(phpOriginal); // MẤT: thứ tự khoá, escape \u / \/
    expect(jsonEquivalent(out, phpOriginal)).toBe(true); // GIỮ: ngữ nghĩa, số 1.50 không qua double
  });

  it('PaymentSource.created_at: timestamp(3) → datetime(0) CẮT phần giây lẻ + ĐẾM', () => {
    const img = { ...imageOf('PaymentSource', PAY_SOURCE), created_at: '2026-09-25 10:11:12.789' };
    const r = spec('PaymentSource').reverse(img);
    expect(r.row.created_at).toBe('2026-09-25 10:11:12');
    expect(r.coerced).toEqual(['created_at']);
  });
});

// ============================================================ chặn giá trị MySQL không nhận
describe('giá trị MySQL không nhận ⇒ DỪNG (EtlSafeError, không giá trị trong thông điệp)', () => {
  it('wallet_stream ngoài enum prod (cty/ca_nhan) — PG là varchar tự do', () => {
    const img = { ...imageOf('FundAccount', FUND_ACCOUNT), wallet_stream: 'khac' };
    expect(() => spec('FundAccount').reverse(img)).toThrow(/enum/);
  });

  it('SmallInt PG vượt tinyint prod (round, status, has_gout)', () => {
    const img = { ...imageOf('ReturnState', RETURN_STATE_RESUB), round: '200' };
    expect(() => spec('ReturnState').reverse(img)).toThrow(/biên/);
    const te = { ...imageOf('TreasuryEntry', TREASURY), status: '-129' };
    expect(() => spec('TreasuryEntry').reverse(te)).toThrow(/biên/);
  });

  it('ký tự 4 byte vào bảng utf8mb3 (tbl_payment) ⇒ DỪNG; bảng utf8mb4 (tbl_payment_log) thì ghi được', () => {
    const img = { ...imageOf('SupplierPayment', PAYMENT), note: 'ok 😀' };
    expect(() => spec('SupplierPayment').reverse(img)).toThrow(/utf8mb3/);
    const log = { ...imageOf('SupplierPaymentLog', PAY_LOG), note: 'ok 😀' };
    expect(spec('SupplierPaymentLog').reverse(log).row.note).toBe('ok 😀');
  });

  it('bigint chính xác trên 2^53 (tranTime/tranId), ngoài int64 ⇒ DỪNG', () => {
    const img = { ...imageOf('BankTransaction', BANK_TX), tran_time: '9007199254740993' };
    expect(spec('BankTransaction').reverse(img).row.tranTime).toBe('9007199254740993');
    expect(() => spec('BankTransaction').reverse({ ...img, tran_time: '9223372036854775808' })).toThrow(/biên/);
  });

  it('thiếu cột / giá trị không phải văn bản ⇒ DỪNG (đọc PG phải qua ::text)', () => {
    const img = imageOf('FxFeeRate', FX_FEE);
    const { fee_percent: _drop, ...missing } = img;
    expect(() => spec('FxFeeRate').reverse(missing)).toThrow(/thiếu/);
    expect(() => spec('FxFeeRate').reverse({ ...img, fee_percent: 0.15 as unknown as string })).toThrow(/text/);
  });

  it('thông điệp lỗi không chứa giá trị dòng', () => {
    const img = { ...imageOf('SupplierPayment', PAYMENT), ncc_bank_account: 'STK-9999-😀' };
    try {
      spec('SupplierPayment').reverse(img);
      throw new Error('không ném');
    } catch (e) {
      expect(e).toBeInstanceOf(EtlSafeError);
      expect((e as Error).message).not.toContain('9999');
    }
  });
});

// ============================================================ JSON helpers + so dòng
describe('JSON + so dòng ≤ mốc', () => {
  it('compactJson giữ nguyên khoảng trắng TRONG chuỗi', () => {
    expect(compactJson('c', '{"a": "x  y", "b": [1, 2]}')).toBe('{"a":"x  y","b":[1,2]}');
    expect(() => compactJson('c', '{"a": ')).toThrow(EtlSafeError);
  });

  it('canonicalJson: sắp khoá, trùng khoá lấy SAU CÙNG (như jsonb), số so bằng Decimal', () => {
    expect(canonicalJson('c', '{"b":1,"a":2,"b":3}')).toBe('{"a":2,"b":3}');
    expect(canonicalJson('c', '[12345678901234567890.10]')).toBe('[12345678901234567890.1]');
    expect(jsonEquivalent('[1.50]', '[1.5]')).toBe(true);
    expect(jsonEquivalent('[12345678901234567891]', '[12345678901234567890]')).toBe(false);
  });

  it('expectedPgImage: dòng MySQL không đổi ⇒ khớp dòng PG thật (0 cột khác), kể cả JSON jsonb', () => {
    const s = spec('ReturnState');
    const exp = expectedPgImage(s, RETURN_STATE_RESUB, permissiveCtx());
    if (exp.kind !== 'row') throw new Error('expected row');
    const pgActual = {
      ...imageOf('ReturnState', RETURN_STATE_RESUB),
      data_before: '{"n": 12345678901234567890, "amount": "1.50"}',
    };
    expect(diffPgColumns(s, exp.image, pgActual)).toEqual([]);
    // v2 sửa dòng lịch sử ⇒ đúng TÊN cột bị báo
    expect(diffPgColumns(s, exp.image, { ...pgActual, reason: 'khác' })).toEqual(['reason']);
  });

  it('so ở MỨC PG: v2 sửa rate 3500.50 → 3500.501 bị BẮT dù MySQL 2 số lẻ không thấy', () => {
    const s = spec('TreasuryEntry');
    const exp = expectedPgImage(s, TREASURY, permissiveCtx());
    if (exp.kind !== 'row') throw new Error('expected row');
    const actual = { ...imageOf('TreasuryEntry', TREASURY), rate: '3500.501000' };
    expect(s.reverse(actual).row.rate).toBe(s.reverse(exp.image).row.rate); // mức MySQL: MÙ
    expect(diffPgColumns(s, exp.image, actual)).toEqual(['rate']); // mức PG: bắt được
    // cùng giá trị, khác số 0 đuôi ⇒ không báo
    expect(diffPgColumns(s, exp.image, { ...actual, rate: '3500.5' })).toEqual([]);
  });

  it('cột khác tên hai phía báo bằng TÊN MySQL (tran_time → tranTime)', () => {
    const s = spec('BankTransaction');
    const exp = expectedPgImage(s, BANK_TX, permissiveCtx());
    if (exp.kind !== 'row') throw new Error('expected row');
    expect(diffPgColumns(s, exp.image, { ...exp.image, tran_time: '1' })).toEqual(['tranTime']);
  });

  it('expectedPgImage: biến đổi CÓ CHỦ ĐÍCH của chiều xuôi không bị báo là "v2 đã sửa"', () => {
    const s = spec('TreasuryEntry');
    const prod = { ...TREASURY, tk_code: ' tk01 ' };
    const exp = expectedPgImage(s, prod, permissiveCtx());
    if (exp.kind !== 'row') throw new Error('expected row');
    expect(diffPgColumns(s, exp.image, imageOf('TreasuryEntry', prod))).toEqual([]);
  });

  it('expectedPgImage: dòng xuôi LOẠI (rác ZZ) ⇒ skip; FxAdjustment ⇒ ảnh = văn bản MySQL', () => {
    expect(expectedPgImage(spec('SupplierPayment'), { ...PAYMENT, saler: 'zzqa_x' }, permissiveCtx()).kind).toBe('skip');
    const adj = expectedPgImage(spec('FxAdjustment'), { id: 1, fx_id: 2, old_rate: '1.000000' }, permissiveCtx());
    if (adj.kind !== 'row') throw new Error('expected row');
    expect(adj.image).toMatchObject({ id: '1', fx_id: '2', old_rate: '1.000000', reason: null });
  });

  it('mọi bảng: tên cột MySQL khai báo trên PgCol == đúng khoá dòng mapper ngược ghi', () => {
    const pgNull = (s: CopybackSpec) => Object.fromEntries(s.pgColumns.map((x) => [x.col, '1']));
    for (const s of COPYBACK_TABLES) {
      let keys: string[];
      try {
        keys = Object.keys(s.reverse(pgNull(s)).row);
      } catch {
        keys = []; // enum/json/ts không nhận '1' ⇒ dùng ca khứ hồi bên dưới
      }
      if (keys.length > 0) expect({ m: s.model, k: keys.sort() }).toEqual({ m: s.model, k: s.pgColumns.map(mysqlName).sort() });
    }
    for (const [m, prod] of [['BankTransaction', BANK_TX], ['TreasuryEntry', TREASURY], ['ReturnState', RETURN_STATE_RESUB],
      ['FundAccount', FUND_ACCOUNT], ['PaymentSource', PAY_SOURCE], ['SupplierPayment', PAYMENT]] as const) {
      expect(Object.keys(roundTrip(m, prod)).length).toBeGreaterThan(0);
      expect(Object.keys(roundTrip(m, prod).row).sort()).toEqual(spec(m).pgColumns.map(mysqlName).sort());
    }
  });

  it('Rev.bool nhận true/false của PG, từ chối giá trị khác', () => {
    expect(new Rev({ b: 'true' }).bool('b')).toBe('1');
    expect(new Rev({ b: 'false' }).bool('b')).toBe('0');
    expect(() => new Rev({ b: '1' }).bool('b')).toThrow(/boolean/);
  });
});
