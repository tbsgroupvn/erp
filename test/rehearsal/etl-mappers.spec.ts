/**
 * L0 Task 2 — bộ ánh xạ THUẦN của ETL lõi tiền (MariaDB dump → Postgres diễn tập).
 * Mọi dòng ở đây là dòng TỰ DỰNG — không có dữ liệu thật.
 * Luật lấy từ docs/rewrite-spec/migration/09a|09b|09c + 04b §9 (§2 luật cột, §3 bất thường).
 */
import { Prisma } from '@prisma/client';
import {
  normCode,
  reqDecimal,
  optDecimal,
  reqBigInt,
  optBigInt,
  reqInt32,
} from '../../src/rehearsal/etl/convert';
import { mapFundAccount, mapTreasuryEntry } from '../../src/rehearsal/etl/treasury';
import {
  mapFxTransfer,
  mapFxAdjustment,
  mapFxFeeRate,
  mapFundAccountChangelog,
  mapBankTransaction,
  mapBankTransactionDetail,
  mapBankChiMatch,
  mapBankReconcileLink,
} from '../../src/rehearsal/etl/fx-bank';
import {
  mapSupplierPayment,
  mapSupplierPaymentOrder,
  mapSupplierPaymentLog,
  mapPaymentSource,
} from '../../src/rehearsal/etl/supplier-payment';
import {
  mapReturnConfig,
  mapReturnConfigField,
  mapReturnState,
} from '../../src/rehearsal/etl/return-state';
import { EtlContext, MapResult } from '../../src/rehearsal/etl/spec';

function ctx(over: Partial<EtlContext> = {}): EtlContext {
  return {
    nowUnix: 1_790_000_000,
    approvalStepIds: new Set<number>([109, 115]),
    approvalRequestIds: new Set<number>([500, 501]),
    loaded: {},
    skipped: {},
    ...over,
  };
}

function row<T>(r: MapResult<T>): T {
  if (r.kind !== 'row') throw new Error(`expected row, got skip: ${r.reason}`);
  return r.data;
}

function dec(v: unknown): string {
  return (v as Prisma.Decimal).toFixed();
}

// ---------------------------------------------------------------- convert helpers
describe('convert helpers', () => {
  it('reqDecimal giữ nguyên chuỗi thập phân, không qua float', () => {
    const d = reqDecimal({ m: '12345678901234.56789' }, 'm');
    expect(d).toBeInstanceOf(Prisma.Decimal);
    expect(d.toFixed()).toBe('12345678901234.56789');
  });

  it('reqDecimal/optDecimal TỪ CHỐI số JS (chống đi qua float)', () => {
    expect(() => reqDecimal({ m: 1.1 }, 'm')).toThrow(/string/);
    expect(() => optDecimal({ m: 1.1 }, 'm')).toThrow(/string/);
  });

  it('optDecimal: NULL giữ NULL, "0" giữ 0', () => {
    expect(optDecimal({ m: null }, 'm')).toBeNull();
    expect(optDecimal({ m: '0.00' }, 'm')!.toFixed()).toBe('0');
  });

  it('reqDecimal chặn vượt biên maxAbs (kiểm trước §5)', () => {
    expect(() => reqDecimal({ m: '-1000000000000000' }, 'm', { maxAbs: '1e15' })).toThrow(/maxAbs/);
    expect(reqDecimal({ m: '-999999999999999.99999' }, 'm', { maxAbs: '1e15' }).toFixed()).toBe(
      '-999999999999999.99999',
    );
  });

  it('reqBigInt chính xác trên 2^53', () => {
    expect(reqBigInt({ a: '9007199254740993' }, 'a')).toBe(9007199254740993n);
    expect(reqBigInt({ a: '-9223372036854775807' }, 'a')).toBe(-9223372036854775807n);
  });

  it('reqBigInt từ chối số JS không an toàn và chuỗi lẻ', () => {
    expect(() => reqBigInt({ a: 2 ** 53 + 2 }, 'a')).toThrow(/safe/);
    expect(() => reqBigInt({ a: '12.5' }, 'a')).toThrow(/integer/);
    expect(optBigInt({ a: null }, 'a')).toBeNull();
  });

  it('reqInt32 từ chối vượt int4', () => {
    expect(reqInt32({ i: '2147483647' }, 'i')).toBe(2147483647);
    expect(() => reqInt32({ i: '2147483648' }, 'i')).toThrow(/int32/);
  });

  it('normCode = TRIM + UPPER (G-DOC-3), báo đã đổi hay chưa', () => {
    expect(normCode('TK01')).toEqual({ value: 'TK01', changed: false });
    expect(normCode(' tk01 ')).toEqual({ value: 'TK01', changed: true });
    expect(normCode('')).toEqual({ value: '', changed: false });
  });
});

// ---------------------------------------------------------------- 09b
const accountRow = {
  id: 321,
  code: 'TK07',
  name: 'Quỹ ẩn',
  subname: '',
  currency: 'VND',
  acc_group: 'store',
  has_gout: 0,
  display_order: 7,
  is_active: 0,
  note: '',
  opening_balance: '0.00000',
  stk: '',
  bank_code: '',
  wallet_stream: 'ca_nhan',
  custom_label: '',
  cdate: 1,
  mdate: 2,
  owner_uid: 0,
  gl_account: '',
  quy_doi_sang: '',
};

describe('09b tbl_accounts → FundAccount', () => {
  it('giữ opening_balance 0, gl_account "" và owner_uid 0 (không NULLIF)', () => {
    const d = row(mapFundAccount(accountRow, ctx()));
    expect(dec(d.openingBalance)).toBe('0');
    expect(d.glAccount).toBe('');
    expect(d.ownerUid).toBe(0);
    expect(d.accGroup).toBe('store');
    expect(d.walletStream).toBe('ca_nhan');
  });

  it('KHÔNG mang cột password dù nguồn có', () => {
    const d = row(mapFundAccount({ ...accountRow, password: 'x' }, ctx()));
    expect(Object.keys(d)).not.toContain('password');
  });

  it('enum currency lạ ⇒ DỪNG', () => {
    expect(() => mapFundAccount({ ...accountRow, currency: 'EUR' }, ctx())).toThrow(/currency/);
  });
});

const histRow = {
  id: 1790251005,
  tk_code: 'CHI-TBS',
  type: 'tranfer',
  bank_info: null,
  gout: '',
  wallet_detail_id: null,
  cus_id: ' free text ',
  cdate: 1790000000,
  cuser: 'u',
  money: '-3379486793.88063',
  rate: null,
  approve_user: null,
  approve_date: null,
  note: 'Ghi chú có dấu',
  status: 9,
  tranId: null,
  trandetailId: '9007199254740993',
  source_module: '',
  source_id: 0,
  reversal_of: 0,
  reversal_code: '',
  reversal_reason: '',
  ref_request_id: 0,
  po_id: 0,
  container_id: 0,
  order_code: '',
};

describe('09b tbl_account_histories → TreasuryEntry', () => {
  it('money chuỗi 5 lẻ chính xác; rate NULL giữ NULL (≠ 0)', () => {
    const d = row(mapTreasuryEntry(histRow, ctx()));
    expect(dec(d.money)).toBe('-3379486793.88063');
    expect(d.rate).toBeNull();
  });

  it('rate: ánh xạ không cắt về 2 lẻ (cột đích Decimal(18,6) giữ 6 lẻ)', () => {
    const d = row(mapTreasuryEntry({ ...histRow, rate: '3.456789' }, ctx()));
    expect(dec(d.rate)).toBe('3.456789');
    const z = row(mapTreasuryEntry({ ...histRow, rate: '0.00' }, ctx()));
    expect(dec(z.rate)).toBe('0');
  });

  it('status 9, source_module "", reversal_of 0, type "tranfer" giữ nguyên', () => {
    const d = row(mapTreasuryEntry(histRow, ctx()));
    expect(d.status).toBe(9);
    expect(d.sourceModule).toBe('');
    expect(d.reversalOf).toBe(0);
    expect(d.type).toBe('tranfer');
  });

  it('cus_id KHÔNG TRIM; gout "" ≠ NULL; bank_info NULL giữ', () => {
    const d = row(mapTreasuryEntry(histRow, ctx()));
    expect(d.cusId).toBe(' free text ');
    expect(d.gout).toBe('');
    expect(d.bankInfo).toBeNull();
    const n = row(mapTreasuryEntry({ ...histRow, gout: null, cus_id: null }, ctx()));
    expect(n.gout).toBeNull();
    expect(n.cusId).toBeNull();
  });

  it('tranId NULL giữ NULL; trandetailId BigInt chính xác trên 2^53', () => {
    const d = row(mapTreasuryEntry(histRow, ctx()));
    expect(d.tranId).toBeNull();
    expect(d.trandetailId).toBe(9007199254740993n);
  });

  it('tk_code chuẩn hoá TRIM+UPPER (G-DOC-3) và ghi chú đếm', () => {
    const r = mapTreasuryEntry({ ...histRow, tk_code: 'tk01 ' }, ctx());
    expect(row(r).tkCode).toBe('TK01');
    expect(r.kind === 'row' && r.notes).toContain('G-DOC-3 tk_code chuẩn hoá');
  });

  it('money vượt 10^15 ⇒ DỪNG', () => {
    expect(() => mapTreasuryEntry({ ...histRow, money: '1000000000000000.00000' }, ctx())).toThrow(
      /maxAbs/,
    );
  });
});

// ---------------------------------------------------------------- 09c
const fxRow = {
  id: 19,
  code: 'FX-2609-004',
  from_tk: 'TK01',
  to_tk: 'TK09',
  from_currency: 'VND',
  to_currency: 'CNY',
  amount_out: '6300000000.00000',
  amount_in: '1750000.12345',
  rate: '3600.123456',
  rate_system: '0.000000',
  fee: '0.00',
  fee_currency: 'VND',
  fee_percent: null,
  po_id: 0,
  note: '',
  status: 'cancelled',
  approval_request_id: 246,
  created_by: 'a',
  created_at: 1,
  approved_by: '',
  approved_at: 0,
  reversed_by: '',
  reversed_at: 0,
  reverse_of: 0,
  bank_tran_id: '0',
  agent_rate: '0.000000',
  agent_tk: '',
  agent_amount: '0.00000',
};

describe('09c tbl_fx_transfers → FxTransfer', () => {
  it('fee_percent NULL ≠ 0; rate 6 lẻ; bank_tran_id 0 sentinel BigInt', () => {
    const d = row(mapFxTransfer(fxRow, ctx()));
    expect(d.feePercent).toBeNull();
    expect(dec(d.rate)).toBe('3600.123456');
    expect(dec(d.rateSystem)).toBe('0');
    expect(d.bankTranId).toBe(0n);
    expect(d.agentTk).toBe('');
    expect(d.note).toBe('');
    const z = row(mapFxTransfer({ ...fxRow, fee_percent: '0.000' }, ctx()));
    expect(dec(z.feePercent)).toBe('0');
  });

  it('amount_out vượt 10^13 ⇒ DỪNG', () => {
    expect(() => mapFxTransfer({ ...fxRow, amount_out: '10000000000000.00000' }, ctx())).toThrow(
      /maxAbs/,
    );
  });

  it('tbl_fx_adjustments có dòng ⇒ DỪNG (09c §2.2)', () => {
    expect(() => mapFxAdjustment({ id: 1 }, ctx())).toThrow(/DỪNG/);
  });

  it('fx_fee_rates: fee_percent 0.000 giữ, updated_by nullable', () => {
    const d = row(
      mapFxFeeRate(
        { id: 1, from_cur: 'VND', to_cur: 'CNY', fee_percent: '0.000', updated_by: null, updated_at: null },
        ctx(),
      ),
    );
    expect(dec(d.feePercent)).toBe('0');
    expect(d.updatedBy).toBeNull();
  });

  it('account_changelog: changes giữ nguyên văn, user_id 0 giữ', () => {
    const changes = '{"stk":["x","y"]}';
    const d = row(
      mapFundAccountChangelog(
        { id: 7, account_id: 1, account_code: 'TK01', action: 'update', changes, user_id: 0, user_name: 'n', created_at: 1 },
        ctx(),
      ),
    );
    expect(d.changes).toBe(changes);
    expect(d.userId).toBe(0);
  });
});

const btxRow = {
  id: '17323',
  bankid: '',
  bank_name: 'acb',
  bank_account: '000',
  tranType: '+',
  tranAmount: '9007199254740993',
  tranTime: '1790325301000',
  tranMess: 'a',
  originMess: 'b',
  cus_id: '',
  type: '1',
  cdate: 1,
  mdate: null,
  status: 'huy',
  confirm: 'no',
  tk_code: '',
};

describe('09c tbl_bank_transaction(+_detail) → BankTransaction(+Detail)', () => {
  it('id/tranAmount/tranTime BigInt chính xác; bankid "" và tk_code "" giữ; cus_id "" ≠ NULL', () => {
    const d = row(mapBankTransaction(btxRow, ctx()));
    expect(d.id).toBe(17323n);
    expect(d.tranAmount).toBe(9007199254740993n);
    expect(d.tranTime).toBe(1790325301000n);
    expect(d.bankid).toBe('');
    expect(d.tkCode).toBe('');
    expect(d.cusId).toBe('');
    expect(d.mdate).toBeNull();
    expect(d.type).toBe('1');
    expect(d.bankName).toBe('acb');
    const n = row(mapBankTransaction({ ...btxRow, cus_id: null }, ctx()));
    expect(n.cusId).toBeNull();
  });

  it('detail: wallet_stream NULL KHÔNG COALESCE; cus_id NULL giữ; money BigInt', () => {
    const d = row(
      mapBankTransactionDetail(
        {
          id: '17128',
          tranId: '17323',
          type: '2',
          money: '6300000000',
          cus_id: null,
          pay_info: '',
          note: '',
          author: 'auto',
          cdate: 1,
          mdate: null,
          confirm: 'no',
          po_id: 0,
          wallet_stream: null,
        },
        ctx(),
      ),
    );
    expect(d.walletStream).toBeNull();
    expect(d.cusId).toBeNull();
    expect(d.money).toBe(6300000000n);
    expect(d.tranId).toBe(17323n);
  });

  it('chi_match: method enum, unmatched_at NULL giữ; enum lạ ⇒ DỪNG', () => {
    const base = {
      id: 3,
      bank_tx_id: '16616',
      request_id: 9,
      method: 'auto',
      matched_by: 'x',
      matched_at: 1,
      unmatched_at: null,
      unmatched_by: null,
      note: '',
    };
    const d = row(mapBankChiMatch(base, ctx()));
    expect(d.method).toBe('auto');
    expect(d.unmatchedAt).toBeNull();
    expect(d.bankTxId).toBe(16616n);
    expect(() => mapBankChiMatch({ ...base, method: 'robot' }, ctx())).toThrow(/method/);
  });

  it('reconcile_link: doc_module "" và doc_id 0 giữ', () => {
    const d = row(
      mapBankReconcileLink(
        { id: 2, bank_tran_id: '17000', doc_module: '', doc_id: 0, match_type: 'fee', note: '', cuser: 'system', cdate: 1 },
        ctx(),
      ),
    );
    expect(d.docModule).toBe('');
    expect(d.docId).toBe(0);
    expect(d.bankTranId).toBe(17000n);
  });
});

// ---------------------------------------------------------------- 09a
const payRow = {
  id: '53736',
  cdate: 1790000000,
  mdate: null,
  price_cyn: '870318505.00',
  currency: 'CNY',
  rate_buy: 3600,
  saler: ' sale01 ',
  from: '1688',
  source: '',
  code_order: ' ORD1 ',
  order_id: '0',
  note: '',
  note_payment: null,
  price_payment: null,
  payment: null,
  pdate: null,
  status: 'no',
  confirm: 'no',
  po_id: 0,
  pay_type: '',
  bill_images: null,
  account_code: '',
  ncc_receiver: '',
  ncc_bank_name: '',
  ncc_bank_account: '',
  ncc_qr_image: '',
  ncc_bank_note: null,
  ncc_pay_channel: 'bank',
  ncc_platform_order: '',
  ncc_invoice_images: '[]',
  ncc_packing_list_images: null,
  kt_note: null,
  tt_ngoai_kieu: '',
};

describe('09a tbl_payment → SupplierPayment', () => {
  it('price_payment NULL giữ NULL (không backfill); payment NULL giữ NULL; mdate NULL giữ', () => {
    const d = row(mapSupplierPayment(payRow, ctx()));
    expect(d.pricePayment).toBeNull();
    expect(d.payment).toBeNull();
    expect(d.mdate).toBeNull();
    expect(dec(d.priceCyn)).toBe('870318505');
  });

  it('account_code "" THẬT, order_id 0 THẬT, po_id 0, pay_type ""', () => {
    const d = row(mapSupplierPayment(payRow, ctx()));
    expect(d.accountCode).toBe('');
    expect(d.orderId).toBe(0);
    expect(d.poId).toBe(0);
    expect(d.payType).toBe('');
  });

  it('code_order giữ nguyên byte (KHÔNG TRIM); saler TRIM (09a bổ sung 25/09)', () => {
    const d = row(mapSupplierPayment(payRow, ctx()));
    expect(d.codeOrder).toBe(' ORD1 ');
    expect(d.saler).toBe('sale01');
  });

  it('ảnh JSON giữ CHUỖI nguyên (không parse)', () => {
    const d = row(mapSupplierPayment(payRow, ctx()));
    expect(d.nccInvoiceImages).toBe('[]');
    expect(d.nccPackingListImages).toBeNull();
  });

  it('price_cyn ≥ 10^16 ⇒ DỪNG; id bigint > int4 ⇒ DỪNG', () => {
    expect(() => mapSupplierPayment({ ...payRow, price_cyn: '10000000000000000.00' }, ctx())).toThrow(
      /maxAbs/,
    );
    expect(() => mapSupplierPayment({ ...payRow, id: '2147483648' }, ctx())).toThrow(/int32/);
  });

  it('rác test ZZ (saler zz% / code_order ZZ%) ⇒ loại, có lý do', () => {
    const r = mapSupplierPayment({ ...payRow, saler: 'ZZREG_1' }, ctx());
    expect(r.kind).toBe('skip');
    const r2 = mapSupplierPayment({ ...payRow, code_order: 'zz-1' }, ctx());
    expect(r2.kind).toBe('skip');
  });

  it('cdate tương lai ⇒ nạp nguyên + ghi chú (A7)', () => {
    const r = mapSupplierPayment({ ...payRow, cdate: 1_800_000_000 }, ctx());
    expect(row(r).cdate).toBe(1_800_000_000);
    expect(r.kind === 'row' && r.notes).toContain('A7 cdate tương lai');
  });
});

describe('09a tbl_payment_orders/_log/_source', () => {
  const po = { id: 1, payment_id: 10, order_id: 20, rmb: '0.00', cdate: 1, prev_fund: null, prev_rate: null };

  it('orders: phiếu cha không nạp (A2 mồ côi) ⇒ loại', () => {
    const r = mapSupplierPaymentOrder(po, ctx({ loaded: { SupplierPayment: new Set([11]) } }));
    expect(r.kind).toBe('skip');
  });

  it('orders/log của phiếu rác ZZ đã loại ⇒ lý do/ghi chú riêng (không nhầm A2/A5)', () => {
    const c = ctx({ loaded: { SupplierPayment: new Set() }, skipped: { SupplierPayment: new Set([10]) } });
    const r = mapSupplierPaymentOrder(po, c);
    expect(r.kind === 'skip' && r.reason).toMatch(/ZZ/);
    const l = mapSupplierPaymentLog(
      { id: 1, payment_id: 10, action: 'edit', old_data: '', new_data: '', note: null, created_by: 'u', cdate: 1 },
      c,
    );
    expect(l.kind === 'row' && l.notes.join()).toMatch(/ZZ/);
    expect(l.kind === 'row' && l.notes.join()).not.toMatch(/A5/);
  });

  it('phiếu rác ZZ bị loại mang id (để bảng con nhận biết)', () => {
    const r = mapSupplierPayment({ ...payRow, saler: 'zzqa' }, ctx());
    expect(r.kind === 'skip' && r.id).toBe(53736);
  });

  it('orders: rmb 0 giữ, prev_fund/prev_rate NULL giữ NULL', () => {
    const d = row(mapSupplierPaymentOrder(po, ctx({ loaded: { SupplierPayment: new Set([10]) } })));
    expect(dec(d.rmb)).toBe('0');
    expect(d.prevFund).toBeNull();
    expect(d.prevRate).toBeNull();
  });

  it('log: trỏ phiếu đã xoá vẫn NẠP (A5); new_data NULL ≠ ""', () => {
    const base = { id: 1, payment_id: 999, action: 'delete', old_data: '', new_data: null, note: null, created_by: 'u', cdate: 1 };
    const d = row(mapSupplierPaymentLog(base, ctx({ loaded: { SupplierPayment: new Set() } })));
    expect(d.newData).toBeNull();
    expect(d.oldData).toBe('');
    expect(() => mapSupplierPaymentLog({ ...base, action: 'nuke' }, ctx())).toThrow(/action/);
  });

  it('source: tk_code NULL giữ NULL; created_at giữ giờ đồng hồ', () => {
    const d = row(
      mapPaymentSource(
        { id: 18, name: 'TT quỹ USD', tk_code: null, sort_order: 0, is_active: 1, created_at: '2026-09-03 13:37:58' },
        ctx(),
      ),
    );
    expect(d.tkCode).toBeNull();
    expect((d.createdAt as Date).toISOString()).toBe('2026-09-03T13:37:58.000Z');
  });
});

// ---------------------------------------------------------------- 04b §9
describe('04b tbl_return_config/_fields', () => {
  const cfg = {
    id: 20,
    checkpoint_type: 'approval',
    checkpoint_ref: '115',
    edit_mode: 'whitelist',
    require_reason: 0,
    updated_by: '',
    updated_at: 0,
  };

  it('require_reason tinyint → Boolean; updated_by "" giữ', () => {
    const d = row(mapReturnConfig(cfg, ctx()));
    expect(d.requireReason).toBe(false);
    expect(row(mapReturnConfig({ ...cfg, require_reason: 1 }, ctx())).requireReason).toBe(true);
    expect(d.updatedBy).toBe('');
  });

  it('A4: approval trỏ bước không tồn tại ⇒ loại', () => {
    expect(mapReturnConfig({ ...cfg, checkpoint_ref: '17224' }, ctx()).kind).toBe('skip');
  });

  it('edit_mode lạ ⇒ DỪNG', () => {
    expect(() => mapReturnConfig({ ...cfg, edit_mode: 'some' }, ctx())).toThrow(/edit_mode/);
  });

  it('A5: field mồ côi (config không nạp) ⇒ loại', () => {
    const r = mapReturnConfigField(
      { id: 1, config_id: 768, field_key: 'so_cont' },
      ctx({ loaded: { ReturnConfig: new Set([20]) } }),
    );
    expect(r.kind).toBe('skip');
  });
});

describe('04b tbl_return_state', () => {
  const st = {
    id: 161,
    object_type: 'payment',
    object_id: '14455',
    checkpoint_type: 'biz',
    checkpoint_ref: 'payment.duyet_ncc',
    state: 'returned',
    reason: 'sai',
    round: 2,
    fields_opened: '["price_cyn","rate_buy"]',
    data_before: '{"price_cyn":"1.00"}',
    data_after: '',
    returned_by: 'kt',
    returned_at: 1790000000,
    resubmitted_at: 0,
  };

  it('returned: resubmitted_at 0 ⇒ NULL; data_after "" ⇒ NULL; JSON parse', () => {
    const d = row(mapReturnState(st, ctx()));
    expect(d.resubmittedAt).toBeNull();
    expect(d.dataAfter).toBeNull();
    expect(d.fieldsOpened).toBe('["price_cyn","rate_buy"]');
    expect(d.dataBefore).toBe('{"price_cyn":"1.00"}');
    expect(d.objectId).toBe(14455);
  });

  it('A3: returned mang data_after cũ ⇒ đặt NULL + ghi chú', () => {
    const r = mapReturnState({ ...st, data_after: '{"price_cyn":"2.00"}' }, ctx());
    expect(row(r).dataAfter).toBeNull();
    expect(r.kind === 'row' && r.notes).toContain('A3 data_after của vòng trước đặt NULL');
  });

  it('resubmitted: data_after giữ (parse), resubmitted_at > 0 giữ', () => {
    const d = row(
      mapReturnState({ ...st, state: 'resubmitted', data_after: '{"a":1}', resubmitted_at: 1790000100 }, ctx()),
    );
    expect(d.dataAfter).toBe('{"a":1}');
    expect(d.resubmittedAt).toBe(1790000100);
  });

  it('JSON giữ VĂN BẢN GỐC — số 1.50 và số 20 chữ số không qua double', () => {
    const raw = '{"price_cyn":1.50,"big":12345678901234567890,"rate_buy":3600}';
    const d = row(mapReturnState({ ...st, state: 'resubmitted', data_before: raw, data_after: raw, resubmitted_at: 5 }, ctx()));
    expect(d.dataBefore).toBe(raw);
    expect(d.dataAfter).toBe(raw);
    // đối chứng: JSON.parse (cách cũ) làm mất cả hai
    expect(JSON.stringify(JSON.parse(raw))).not.toBe(raw);
  });

  it('data_before JSON hỏng ⇒ DỪNG', () => {
    expect(() => mapReturnState({ ...st, data_before: '{bad' }, ctx())).toThrow(/data_before/);
  });

  it('trạng thái của phiếu rác ZZ đã loại ⇒ loại theo', () => {
    const r = mapReturnState(st, ctx({ skipped: { SupplierPayment: new Set([14455]) } }));
    expect(r.kind === 'skip' && r.reason).toMatch(/ZZ/);
  });

  it('fields_opened không phải mảng chuỗi ⇒ DỪNG', () => {
    expect(() => mapReturnState({ ...st, fields_opened: '{"a":1}' }, ctx())).toThrow(/fields_opened/);
    expect(() => mapReturnState({ ...st, fields_opened: 'not json' }, ctx())).toThrow(/fields_opened/);
  });

  it('A1: approval_request trỏ phiếu không tồn tại ⇒ loại; tồn tại ⇒ nạp', () => {
    const a = { ...st, object_type: 'approval_request', checkpoint_type: 'approval', checkpoint_ref: '115' };
    expect(mapReturnState({ ...a, object_id: '20225' }, ctx()).kind).toBe('skip');
    expect(mapReturnState({ ...a, object_id: '500' }, ctx()).kind).toBe('row');
  });

  it('state / object_type lạ ⇒ DỪNG', () => {
    expect(() => mapReturnState({ ...st, state: 'draft' }, ctx())).toThrow(/state/);
    expect(() => mapReturnState({ ...st, object_type: 'order' }, ctx())).toThrow(/object_type/);
  });
});
