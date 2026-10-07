// #09c L1, Task 1 — 8 model Prisma cho FX transfer + phía ngân hàng của sổ quỹ.
// Đặc tả: docs/rewrite-spec/09c-fx-ngan-hang.md §2 (dữ liệu đo prod 24/09), §9 (model đề xuất),
//         §12 (bẫy: BigInt nguyên đồng, tranTime mili-giây, type/status/confirm là CHUỖI).
// Plan:   docs/rewrite-spec/plans/2026-09-25-09c-L1-models-plan.md (Q-BANK-1/2: index THƯỜNG,
//         chép prod — KHÔNG UNIQUE một phần).
// Model-only ở lô này — không service/HTTP/ETL. Test round-trip giá trị thật đo trong §2 và
// chứng minh UNIQUE(from_cur,to_cur) chặn trùng còn index Q-BANK KHÔNG chặn trùng.
import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '../helpers/db';
import {
  resetFxBank,
  seedFxTransfer,
  seedFxAdjustment,
  seedFxFeeRate,
  seedFundAccountChangelog,
  seedBankTransaction,
  seedBankTransactionDetail,
  seedBankChiMatch,
  seedBankReconcileLink,
} from '../helpers/fx-bank-db';

const D = (v: string | number) => new Prisma.Decimal(v);

beforeEach(async () => {
  await resetFxBank();
});
afterAll(async () => {
  await prisma.$disconnect();
});

// ───────────────────────────── (a) không đụng chốt chặn ví khách ─────────────────────────────
describe('(a) không đụng wallet.service / money.ts', () => {
  test('DUNG_SAI_AM vẫn = 3 trong wallet.service.ts (lô này không sửa file tiền)', () => {
    const src = readFileSync(
      join(__dirname, '../../src/money/wallet.service.ts'),
      'utf8',
    );
    const count = (src.match(new RegExp('DUNG_SAI' + '_AM', 'g')) || []).length;
    expect(count).toBe(3);
  });
});

// ───────────────────────────── (b) FxTransfer — round-trip giá trị thật đo §2.1 ─────────────
describe('(b) FxTransfer', () => {
  test('round-trip amount_out lớn nhất đo được (6.300.000.000), rate >4 lẻ, sentinel & NULL đúng §2.1', async () => {
    const row = await seedFxTransfer({
      code: 'FX-2609-089',
      fromTk: 'TK01',
      toTk: 'TK09',
      fromCurrency: 'VND',
      toCurrency: 'USD',
      amountOut: D('6300000000.00000'), // max đo được §2.1
      amountIn: D('247500.00000'),
      rate: D('25.454545'), // 10 dòng > 4 số lẻ (suy ngược suaTruocGhiSoFx)
      rateSystem: D('0'), // 89/89 = 0 — KHÔNG NULLIF
      fee: D('1500000.75'), // 11 dòng có phần lẻ
      feeCurrency: null, // NULL hợp lệ theo §9 dù 0 dòng hiện tại
      feePercent: null, // NULL = phí nhập tay (61 dòng) ≠ 0
      note: '', // NULL ≠ '' — 8 dòng ''
      status: 'approved',
      approvedBy: 'nguoi_nop', // bẫy §12.3: approved_by = người NỘP
      bankTranId: BigInt(0), // sentinel "chưa neo"
    });

    expect(row.amountOut.toFixed(5)).toBe('6300000000.00000');
    expect(row.rate.toString()).toBe('25.454545');
    expect(row.feePercent).toBeNull();
    expect(row.feeCurrency).toBeNull();
    expect(row.note).toBe('');
    expect(row.bankTranId).toBe(BigInt(0));

    const got = await prisma.fxTransfer.findUniqueOrThrow({ where: { id: row.id } });
    expect(got.code).toBe('FX-2609-089');
  });

  test('note NULL khác note rỗng — không được coalesce', async () => {
    const withNull = await seedFxTransfer({ code: 'FX-2609-001', note: null });
    const withEmpty = await seedFxTransfer({ code: 'FX-2609-002', note: '' });
    expect(withNull.note).toBeNull();
    expect(withEmpty.note).toBe('');
  });

  test('code UNIQUE — trùng bị chặn (chống cửa sổ đua sinh mã theo MAX tiền tố tháng)', async () => {
    await seedFxTransfer({ code: 'FX-2609-050' });
    await expect(seedFxTransfer({ code: 'FX-2609-050' })).rejects.toThrow();
  });

  test('bankTranId neo 1:1 — nhận BigInt lớn như id giao dịch bank thật', async () => {
    const row = await seedFxTransfer({ code: 'FX-2609-051', bankTranId: BigInt(17323) });
    expect(row.bankTranId).toBe(BigInt(17323));
  });
});

// ───────────────────────────── (c) FxAdjustment — bảng rỗng prod, chỉ tạo cấu trúc ───────────
describe('(c) FxAdjustment', () => {
  test('round-trip đủ cột decimal + hist_ids JSON dạng chuỗi', async () => {
    const row = await seedFxAdjustment({
      fxId: 1,
      requestId: 246,
      oldRate: D('25.454500'),
      newRate: D('25.454545'),
      oldOut: D('6300000000.00000'),
      newOut: D('6300000100.00000'),
      deltaOut: D('100.00000'),
      histIds: '[1788363983,1788363984]',
      reason: 'sửa trước ghi sổ FX',
      cuser: 'ketoan01',
      cdate: 1758798000,
    });
    expect(row.histIds).toBe('[1788363983,1788363984]');
    expect(row.oldRate.toFixed(6)).toBe('25.454500');
  });
});

// ───────────────────────────── (d) FxFeeRate — UNIQUE(from_cur,to_cur) prod CÓ ───────────────
describe('(d) FxFeeRate', () => {
  test('round-trip 6 cặp đo được, đều 0,000%', async () => {
    const row = await seedFxFeeRate({ fromCur: 'VND', toCur: 'CNY', feePercent: D('0.000') });
    expect(row.feePercent.toFixed(3)).toBe('0.000');
  });

  test('UNIQUE(from_cur,to_cur) CHẶN trùng — prod thật có ràng buộc này', async () => {
    await seedFxFeeRate({ fromCur: 'VND', toCur: 'USD' });
    await expect(seedFxFeeRate({ fromCur: 'VND', toCur: 'USD' })).rejects.toThrow(
      /Unique constraint|uq_pair/i,
    );
  });

  test('cặp khác chiều (to_cur,from_cur đảo) KHÔNG bị chặn — là cặp khác', async () => {
    await seedFxFeeRate({ fromCur: 'VND', toCur: 'USD' });
    await expect(seedFxFeeRate({ fromCur: 'USD', toCur: 'VND' })).resolves.toBeDefined();
  });
});

// ───────────────────────────── (e) FundAccountChangelog — changes CÓ THỂ chứa STK ────────────
describe('(e) FundAccountChangelog', () => {
  // ⚠ KHÔNG console.log/in giá trị `changes` — có thể chứa STK dạng rõ (đặc tả §12.13).
  // Test dùng giá trị GIẢ (không phải STK thật) để tránh lộ dữ liệu nhạy cảm dù chỉ là test.
  test('changes JSON round-trip nguyên văn, user_id=0 là THẬT (không NULLIF)', async () => {
    const fakeChanges = JSON.stringify({ action: 'create', stk: 'ZZ-FAKE-0000000000' });
    const row = await seedFundAccountChangelog({
      accountId: 16,
      accountCode: 'TK16',
      action: 'create',
      changes: fakeChanges,
      userId: 0, // 5/22 dòng ghi trước khi có id người dùng — giữ 0
      userName: '',
      createdAt: 1758798000,
    });
    // So bằng độ dài + hash-ish (chứa key 'stk') mà KHÔNG in nguyên giá trị ra output test.
    expect(typeof row.changes).toBe('string');
    expect(row.changes!.length).toBe(fakeChanges.length);
    expect(JSON.parse(row.changes!)).toHaveProperty('stk');
    expect(row.userId).toBe(0);
  });
});

// ───────────────────────────── (f) BankTransaction — BigInt, ms, chuỗi type/status/confirm ──
describe('(f) BankTransaction', () => {
  test('round-trip tranAmount BigInt lớn nhất đo được, tranTime mili-giây, type/status/confirm là CHUỖI', async () => {
    const row = await seedBankTransaction({
      bankid: '84364837', // đầu dải id SePay đo được (8 chữ số)
      bankName: 'ACB',
      tranType: '+',
      tranAmount: BigInt('6300000000'), // max đo được, nguyên đồng
      tranTime: BigInt('1758798123000'), // mili-giây — 13 chữ số
      cdate: 1758798123, // giây — KHÁC đơn vị với tranTime
      type: '1', // chuỗi '1'..'5', không phải số
      status: 'yes',
      confirm: 'no',
      tkCode: 'TK01',
    });
    expect(row.tranAmount).toBe(BigInt('6300000000'));
    expect(row.tranTime).toBe(BigInt('1758798123000'));
    expect(row.cdate).toBe(1758798123);
    expect(typeof row.type).toBe('string');
    expect(row.type).toBe('1');
    expect(row.status).toBe('yes');
    expect(row.confirm).toBe('no');
  });

  test('bankid rỗng là THẬT (nhập tay/SMS/cũ) — không NULLIF, tk_code rỗng = trước cutover', async () => {
    const row = await seedBankTransaction({ bankid: '', tkCode: '' });
    expect(row.bankid).toBe('');
    expect(row.tkCode).toBe('');
  });

  test('cus_id NULL khác cus_id rỗng — giữ phân biệt, không TRIM', async () => {
    const withNull = await seedBankTransaction({ bankid: '11111111', cusId: null });
    const withEmpty = await seedBankTransaction({ bankid: '22222222', cusId: '' });
    expect(withNull.cusId).toBeNull();
    expect(withEmpty.cusId).toBe('');
  });

  // Q-BANK-1: prod KHÔNG có index/UNIQUE trên `bankid` (P-B4, cửa sổ đua thật đo được) ⇒ v2
  // chép nguyên trạng: index THƯỜNG không chặn trùng.
  test('index bankid KHÔNG chặn trùng — chép nguyên hành vi prod (Q-BANK-1, P-B4)', async () => {
    const a = await seedBankTransaction({ bankid: '84364837', tranAmount: BigInt(1000) });
    const b = await seedBankTransaction({ bankid: '84364837', tranAmount: BigInt(2000) });
    expect(a.bankid).toBe(b.bankid);
    const count = await prisma.bankTransaction.count({ where: { bankid: '84364837' } });
    expect(count).toBe(2);
  });

  // KHÔNG in bank_account trong output test — chỉ kiểm ĐỘ DÀI/round-trip, không assert-literal
  // vào thông điệp lỗi có thể lộ ra console khi fail.
  test('bank_account round-trip — không in giá trị', async () => {
    const fakeStk = 'ZZFAKE0099887766';
    const row = await seedBankTransaction({ bankid: '33333333', bankAccount: fakeStk });
    expect(row.bankAccount?.length).toBe(fakeStk.length);
  });
});

// ───────────────────────────── (g) BankTransactionDetail — BigInt money, KHÔNG COALESCE ─────
describe('(g) BankTransactionDetail', () => {
  test('money BigInt nguyên đồng, wallet_stream NULL ≠ cty, không FK tới tranId mồ côi', async () => {
    const orphan = await seedBankTransactionDetail({
      tranId: BigInt(999999999), // không tồn tại BankTransaction nào — KHÔNG FK, phải cho phép
      type: '3',
      money: BigInt('4845906000'), // tổng dư đo được ở 11 giao dịch nạp nội bộ vượt tiền
      walletStream: null, // NULL = dòng cũ (16.649) — KHÔNG COALESCE thành 'cty'
    });
    expect(orphan.money).toBe(BigInt('4845906000'));
    expect(orphan.walletStream).toBeNull();

    const cty = await seedBankTransactionDetail({ walletStream: 'cty' });
    expect(cty.walletStream).toBe('cty');
  });

  test('mdate NULL giữ nguyên (10/16.943 dòng không có mdate)', async () => {
    const row = await seedBankTransactionDetail({ mdate: null });
    expect(row.mdate).toBeNull();
  });
});

// ───────────────────────────── (h) BankChiMatch — enum method + UNIQUE lệch (P-B5) ───────────
describe('(h) BankChiMatch', () => {
  test('enum method auto/manual round-trip', async () => {
    const a = await seedBankChiMatch({ bankTxId: BigInt(1), requestId: 1, method: 'auto' });
    const m = await seedBankChiMatch({ bankTxId: BigInt(2), requestId: 2, method: 'manual' });
    expect(a.method).toBe('auto');
    expect(m.method).toBe('manual');
  });

  test('UNIQUE(bank_tx_id, unmatched_at) chặn trùng khi CÙNG unmatched_at khác NULL', async () => {
    await seedBankChiMatch({ bankTxId: BigInt(5), requestId: 5, unmatchedAt: 1758798000 });
    await expect(
      seedBankChiMatch({ bankTxId: BigInt(5), requestId: 6, unmatchedAt: 1758798000 }),
    ).rejects.toThrow(/Unique constraint|uq_banktx_active/i);
  });

  // P-B5 (đã ghi nhận trong đặc tả, KHÔNG sửa ở lô này): NULL ≠ NULL trong UNIQUE Postgres
  // (giống MySQL) ⇒ hai dòng "đang hiệu lực" (unmatched_at NULL) trên CÙNG bank_tx_id KHÔNG
  // bị chặn — chép đúng bất thường prod, không tự ý siết chặt.
  test('UNIQUE KHÔNG chặn hai dòng đang hiệu lực (unmatched_at NULL) trên cùng bank_tx_id — chép P-B5', async () => {
    const first = await seedBankChiMatch({ bankTxId: BigInt(9), requestId: 9 });
    const second = await seedBankChiMatch({ bankTxId: BigInt(9), requestId: 10 });
    expect(first.unmatchedAt).toBeNull();
    expect(second.unmatchedAt).toBeNull();
    const count = await prisma.bankChiMatch.count({ where: { bankTxId: BigInt(9) } });
    expect(count).toBe(2);
  });
});

// ───────────────────────────── (i) BankReconcileLink — UNIQUE bank_tran_id prod CÓ ───────────
describe('(i) BankReconcileLink', () => {
  test('round-trip docModule rỗng (fee) và match_type', async () => {
    const row = await seedBankReconcileLink({
      bankTranId: BigInt(17300),
      docModule: '',
      matchType: 'fee',
      cuser: 'system',
    });
    expect(row.docModule).toBe('');
    expect(row.matchType).toBe('fee');
  });

  test('UNIQUE(bank_tran_id) chặn trùng — prod thật 0 trùng đo được', async () => {
    await seedBankReconcileLink({ bankTranId: BigInt(500) });
    await expect(seedBankReconcileLink({ bankTranId: BigInt(500) })).rejects.toThrow(
      /Unique constraint|uq_bank/i,
    );
  });
});
