// 09c L3, Task 1 — BankIngestService: phần chung + chiều `in` có ghi sổ + chống trùng + công tắc
// `chi_ghi_nhan` + `replayFrom()` (port `api/bank-sepay-hook.php:17-85`, KHÔNG HTTP).
// Đặc tả: docs/rewrite-spec/09c-fx-ngan-hang.md §5.5, §7, §8 (F7/F8), §10.3, §11 (L3), §12 (7–11, 13);
//         docs/rewrite-spec/09b-so-quy-treasury.md §5.1 (hasPosted/postEntry), §7 (postBiz theo ví).
// Plan:   docs/rewrite-spec/plans/2026-09-25-09c-L3-bank-ingest-plan.md — Task 1.
//
// ⛔ Số tài khoản ở đây đều GIẢ (`ZZFAKE…`) — không dùng STK thật, không in STK ở bất cứ đâu (§12.13).
import { Logger } from '@nestjs/common';
import { prisma, resetDb } from '../helpers/db';
import { resetTreasury, seedFundAccount } from '../helpers/treasury-db';
import { resetFxBank, seedBankTransaction } from '../helpers/fx-bank-db';
import { GlService } from '../../src/money/gl.service';
import { GlMapService } from '../../src/money/gl-map.service';
import { TreasuryService } from '../../src/money/treasury.service';
import { BankIngestService, SepayPayload } from '../../src/bank/bank-ingest.service';

const treasury = new TreasuryService(prisma as any);
const gl = new GlService(prisma as any);
const glMap = new GlMapService(prisma as any, gl);
const svc = new BankIngestService(prisma as any, treasury, glMap);

const STK1 = 'ZZFAKE001'; // → TK01 (gl 1121)
const STK3 = 'ZZFAKE003'; // → TK03 (gl 138 — ví cá nhân)
const STK_TAT = 'ZZFAKE099'; // → TK99 đang TẮT (is_active=0)

const PREFIX = 'Bank báo có tự động — ';
// replayFrom từ chối mốc ≤ 0 (sửa mang từ review Task 1, Task 2) ⇒ id giao dịch trong spec này bắt đầu
// từ MOC0 + 1 (setval trong beforeEach), `replayFrom(MOC0)` = "mọi giao dịch của ca" như `replayFrom(0)` cũ.
const MOC0 = 1000;
// replayFrom(mốc, trần) — trần BẮT BUỘC (final review M2); ca test dùng trần rất cao = "đến hết".
const DEN = 2_000_000_000;

function pl(over: Partial<SepayPayload> & Record<string, unknown> = {}): SepayPayload {
  return {
    id: 84364901,
    gateway: 'ACB',
    transactionDate: '2026-09-25 14:02:37',
    accountNumber: STK1,
    transferType: 'in',
    transferAmount: 2000000,
    content: 'TBS1234 chuyen tien hang',
    ...over,
  } as SepayPayload;
}

async function counts() {
  return {
    bt: await prisma.bankTransaction.count(),
    so: await prisma.treasuryEntry.count(),
    gl: await prisma.glEntry.count(),
  };
}

async function glLinesOfSource(sourceType: string, sourceId: number) {
  const e = await prisma.glEntry.findUnique({ where: { sourceType_sourceId: { sourceType, sourceId: BigInt(sourceId) } } });
  if (!e) return null;
  const ls = await prisma.glLine.findMany({ where: { entryId: e.id }, orderBy: { lineNo: 'asc' } });
  return { e, lines: ls.map((l) => [l.accountCode, l.debit.toFixed(2), l.credit.toFixed(2)]) };
}

beforeEach(async () => {
  await resetDb();
  await resetTreasury();
  await resetFxBank();
  await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('tbl_bank_transaction', 'id'), ${MOC0})::text`);
  await seedFundAccount('TK01', { currency: 'VND', stk: STK1, glAccount: '1121' });
  await seedFundAccount('TK03', { currency: 'VND', stk: STK3, glAccount: '138' });
  await seedFundAccount('TK99', { currency: 'VND', stk: STK_TAT, glAccount: '1121', isActive: 0 });
  // Ánh xạ đo prod (09b §7.2): bank_tien_ve 1121/338, money_side=debit, đã duyệt.
  await prisma.glMapping.create({
    data: { bizType: 'bank_tien_ve', bizLabel: 'bank_tien_ve', debitAccount: '1121', creditAccount: '338', moneySide: 'debit', isApproved: true, active: true },
  });
});
// Mọi spy (postBiz/postEntry/Logger) được gỡ sau MỖI ca — một ca đỏ không được rò mock sang ca sau.
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await resetDb();
  await resetTreasury();
  await resetFxBank();
  await prisma.$disconnect();
});

// ───────────────────────────── chiều `in` — §5.5 :42-85 ─────────────────────────────
describe('ingest chiều in — INSERT đúng từng cột + ghi sổ + GL sau commit', () => {
  test('INSERT tbl_bank_transaction đúng từng cột §5.5 (tranType +, tranTime ms, status/confirm chuỗi no, tk_code)', async () => {
    const t0 = Math.floor(Date.now() / 1000);
    const r = await svc.ingest(pl());
    expect(r.status).toBe('posted');
    const bt = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: BigInt(r.bankTxId!) } });
    expect(bt.bankid).toBe('84364901');
    expect(bt.bankName).toBe('ACB'); // = gateway
    expect(bt.bankAccount === STK1).toBe(true); // so sánh, KHÔNG in giá trị
    expect(bt.tranType).toBe('+');
    expect(bt.tranAmount).toBe(BigInt(2000000)); // BigInt nguyên đồng (§12.7)
    // strtotime('2026-09-25 14:02:37') giờ VN (UTC+7) .'000' ⇒ mili-giây (§12.8)
    expect(bt.tranTime).toBe(BigInt(Date.UTC(2026, 8, 25, 7, 2, 37)));
    expect(bt.tranMess).toBe('TBS1234 chuyen tien hang');
    expect(bt.originMess).toBe('TBS1234 chuyen tien hang');
    expect(bt.cdate!).toBeGreaterThanOrEqual(t0); // giây
    expect(bt.cdate!).toBeLessThanOrEqual(t0 + 5);
    expect([bt.status, bt.confirm, bt.type]).toEqual(['no', 'no', '1']); // CHUỖI (§12.9); type = mặc định cột
    expect(bt.tkCode).toBe('TK01');
    expect(bt.cusId).toBeNull(); // prod không đưa cus_id vào INSERT
    expect(bt.mdate).toBeNull();
  });

  test('dòng sổ quỹ bank_tx: TK01 in +tranAmount, status 1, cuser/approveUser sepay, source = id GIAO DỊCH (F7)', async () => {
    const r = await svc.ingest(pl());
    const so = await prisma.treasuryEntry.findMany();
    expect(so).toHaveLength(1);
    const h = so[0];
    expect(h.id).toBe(r.histId);
    expect([h.tkCode, h.type, h.money!.toFixed(2), h.status, h.cuser, h.approveUser]).toEqual([
      'TK01', 'in', '2000000.00', 1, 'sepay', 'sepay',
    ]);
    expect([h.sourceModule, h.sourceId]).toEqual(['bank_tx', r.bankTxId]);
    expect(h.note).toBe(PREFIX + 'TBS1234 chuyen tien hang');
    expect((await treasury.getBalance('TK01')).toFixed(0)).toBe('2000000');
  });

  test('GL bank_tien_ve: nguồn = id DÒNG SỔ; Nợ theo ví (TK01→1121) / Có 338; createdBy sepay; description', async () => {
    const r = await svc.ingest(pl());
    const g = await glLinesOfSource('bank_tx', r.histId!);
    expect(g).not.toBeNull();
    expect(g!.lines).toEqual([['1121', '2000000.00', '0.00'], ['338', '0.00', '2000000.00']]);
    expect(g!.e.createdBy).toBe('sepay');
    expect(g!.e.description).toBe('Tiền về TK01 — TBS1234 chuyen tien hang');
    expect(r.gl).toBe('posted');
    // nguồn GL KHÔNG phải id giao dịch (bẫy nguồn = id DÒNG SỔ): chỉ đúng 1 bút toán
    expect(await prisma.glEntry.count()).toBe(1);
  });

  test('GL vế Nợ đi theo VÍ (tái dùng postBiz tkVi): TK03 → Nợ 138 / Có 338', async () => {
    const r = await svc.ingest(pl({ accountNumber: STK3, id: 'ZZ1' }));
    expect(r.status).toBe('posted');
    const g = await glLinesOfSource('bank_tx', r.histId!);
    expect(g!.lines).toEqual([['138', '2000000.00', '0.00'], ['338', '0.00', '2000000.00']]);
    const h = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r.histId! } });
    expect(h.tkCode).toBe('TK03');
  });

  test('transferAmount dạng chuỗi (SePay/PHP (string)) vẫn BigInt nguyên đồng', async () => {
    const r = await svc.ingest(pl({ transferAmount: '6300000000' }));
    const bt = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: BigInt(r.bankTxId!) } });
    expect(bt.tranAmount).toBe(BigInt('6300000000'));
    const h = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r.histId! } });
    expect(h.money!.toFixed(0)).toBe('6300000000');
  });

  test('tranAmount = 0 ⇒ chỉ lưu giao dịch, KHÔNG ghi sổ (prod :61 floatval(tranAmount)>0)', async () => {
    const r = await svc.ingest(pl({ transferAmount: 0 }));
    expect(r.status).toBe('recorded');
    expect(await counts()).toEqual({ bt: 1, so: 0, gl: 0 });
  });

  test('khoá lạ trong payload bị bỏ qua (§10.3)', async () => {
    const r = await svc.ingest(pl({ referenceCode: 'FT123', accumulated: 99, subAccount: null, description: 'x' }));
    expect(r.status).toBe('posted');
  });
});

// ───────────────────────────── ghi chú cắt 180 KÝ TỰ ─────────────────────────────
describe('ghi chú: mb_substr(content, 0, 180) — theo KÝ TỰ (code point), không byte, không UTF-16', () => {
  test('tiếng Việt có dấu + emoji (ký tự ngoài BMP) ngay sát ranh giới 180', async () => {
    // 178 × 'ệ' (U+1EC7, 3 byte UTF-8) + '😀' (U+1F600, 2 đơn vị UTF-16, 4 byte) + 'ạ' + 'XYZ' = 183 ký tự.
    // mb_substr 180 ⇒ 178 'ệ' + '😀' + 'ạ'. Cắt UTF-16 `.slice(0,180)` sẽ MẤT 'ạ'; cắt byte còn tệ hơn.
    const content = 'ệ'.repeat(178) + '😀' + 'ạ' + 'XYZ';
    const expected = 'ệ'.repeat(178) + '😀' + 'ạ';
    expect(Array.from(expected)).toHaveLength(180);
    expect(content.slice(0, 180)).not.toBe(expected); // đối chứng: cắt UTF-16 cho kết quả KHÁC
    const r = await svc.ingest(pl({ content }));
    const h = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r.histId! } });
    expect(h.note).toBe(PREFIX + expected);
    // giao dịch vẫn lưu NGUYÊN nội dung (tranMess = originMess = content, không cắt)
    const bt = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: BigInt(r.bankTxId!) } });
    expect([bt.tranMess, bt.originMess]).toEqual([content, content]);
    const g = await glLinesOfSource('bank_tx', r.histId!);
    expect(g!.e.description).toBe('Tiền về TK01 — ' + expected);
  });

  test('đúng 180 ký tự ⇒ giữ nguyên; content thiếu ⇒ "" (prod `?? \'\'`)', async () => {
    const c180 = 'Đ'.repeat(180);
    const r1 = await svc.ingest(pl({ id: 'ZZ180', content: c180 }));
    expect((await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r1.histId! } })).note).toBe(PREFIX + c180);
    const r2 = await svc.ingest(pl({ id: 'ZZNOC', content: undefined }));
    expect((await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r2.histId! } })).note).toBe(PREFIX);
    const bt = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: BigInt(r2.bankTxId!) } });
    expect([bt.tranMess, bt.originMess]).toEqual(['', '']);
  });
});

// ───────────────────────────── chống trùng bankid (P-B4, F8) ─────────────────────────────
describe('chống trùng theo id SePay — dưới advisory lock', () => {
  test('gửi lại cùng id (tuần tự) ⇒ duplicate, 0 dòng mới ở giao dịch / sổ / GL', async () => {
    const r1 = await svc.ingest(pl());
    expect(r1.status).toBe('posted');
    const before = await counts();
    const r2 = await svc.ingest(pl({ transferAmount: 999 })); // khác tiền vẫn là trùng theo id
    expect(r2.status).toBe('duplicate');
    expect(await counts()).toEqual(before);
    expect(before).toEqual({ bt: 1, so: 1, gl: 1 });
  });

  test('id kiểu số và kiểu chuỗi cùng giá trị là CÙNG giao dịch ((string)$id)', async () => {
    await svc.ingest(pl({ id: 84364901 }));
    expect((await svc.ingest(pl({ id: '84364901' }))).status).toBe('duplicate');
  });

  test('HAI+ lượt ĐỒNG THỜI thật (tx riêng) cùng id ⇒ đúng 1 giao dịch + 1 dòng sổ + 1 GL', async () => {
    // Khép cửa sổ đua P-B4: prod đếm rồi INSERT … WHERE NOT EXISTS, không có UNIQUE bankid.
    // v2: pg_advisory_xact_lock theo id rồi mới SELECT bankid. Gỡ khoá ⇒ ca này ĐỎ (xem báo cáo).
    const rs = await Promise.all(Array.from({ length: 6 }, () => svc.ingest(pl())));
    const st = rs.map((x) => x.status).sort();
    expect(st).toEqual(['duplicate', 'duplicate', 'duplicate', 'duplicate', 'duplicate', 'posted']);
    expect(await counts()).toEqual({ bt: 1, so: 1, gl: 1 });
  });

  test('duplicate được xét TRƯỚC ánh xạ STK (thứ tự prod :21-30)', async () => {
    await svc.ingest(pl());
    expect((await svc.ingest(pl({ accountNumber: 'ZZFAKE_KHONG_CO' }))).status).toBe('duplicate');
  });
});

// ───────────────────────────── bỏ qua / không ánh xạ ─────────────────────────────
describe('ignored / unmapped ⇒ KHÔNG ghi gì', () => {
  test.each([
    ['transferType lạ', { transferType: 'x' }],
    ['transferType HOA (in_array strict)', { transferType: 'IN' }],
    ['transferType thiếu', { transferType: undefined }],
    ['id rỗng', { id: '' }],
    ['id thiếu', { id: undefined }],
    ['id null', { id: null }],
  ])('%s ⇒ ignored', async (_n, over) => {
    const r = await svc.ingest(pl(over as any));
    expect(r.status).toBe('ignored');
    expect(await counts()).toEqual({ bt: 0, so: 0, gl: 0 });
  });

  test.each([
    ['STK không có ví', { accountNumber: 'ZZFAKE_KHONG_CO' }],
    ['ví có STK nhưng đang TẮT', { accountNumber: STK_TAT }],
    ['accountNumber rỗng (findBySTK("") = null)', { accountNumber: '' }],
    ['accountNumber thiếu', { accountNumber: undefined }],
  ])('%s ⇒ unmapped, 0 dòng giao dịch/sổ/GL', async (_n, over) => {
    const r = await svc.ingest(pl(over as any));
    expect(r.status).toBe('unmapped');
    expect(await counts()).toEqual({ bt: 0, so: 0, gl: 0 });
  });

  test('ví STK rỗng không bị khớp bởi accountNumber rỗng', async () => {
    await seedFundAccount('TK02', { currency: 'CNY', stk: '' }); // đa số ví prod có stk=''
    expect((await svc.ingest(pl({ accountNumber: '' }))).status).toBe('unmapped');
  });
});

// ───────────────────────────── lỗi ⇒ NÉM (khác prod có chủ đích, P-B4) ─────────────────────────────
describe('lỗi ghi ⇒ NÉM, không để lại dòng nào', () => {
  test('INSERT giao dịch hỏng (bankid > varchar(10)) ⇒ ném; 0 giao dịch, 0 dòng sổ, 0 GL; lỗi không chứa STK', async () => {
    let caught: unknown;
    try {
      await svc.ingest(pl({ id: '12345678901' }));
    } catch (x) {
      caught = x;
    }
    expect(caught).toBeDefined();
    const dump = String(caught) + JSON.stringify(caught, Object.getOwnPropertyNames(caught as object));
    expect(dump.includes(STK1)).toBe(false);
    expect(await counts()).toEqual({ bt: 0, so: 0, gl: 0 });
  });

  test('postEntry hỏng trong tx ⇒ ném; giao dịch LÙI theo (0 dòng); GL KHÔNG ghi', async () => {
    const spy = jest.spyOn(treasury, 'postEntry').mockRejectedValueOnce(new Error('zz hỏng giả'));
    try {
      await expect(svc.ingest(pl())).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect(await counts()).toEqual({ bt: 0, so: 0, gl: 0 });
  });

  test('transferAmount có phần lẻ khác 0 ⇒ ném (BigInt nguyên đồng, §12.7), 0 dòng', async () => {
    await expect(svc.ingest(pl({ transferAmount: '2000000.5' }))).rejects.toThrow();
    expect(await counts()).toEqual({ bt: 0, so: 0, gl: 0 });
  });
});

// ───────────────────────────── Fix round 1: lỗi GL KHÔNG chặn tiền về ─────────────────────────────
describe('lỗi GL sau commit ⇒ KHÔNG ném (prod try/catch + error_log: tiền đã về tài khoản thật rồi)', () => {
  test('postBiz NÉM ⇒ ingest vẫn trả posted, dòng giao dịch + dòng sổ còn nguyên, log chỉ có id (không nội dung/STK)', async () => {
    const spy = jest.spyOn(glMap, 'postBiz').mockRejectedValueOnce(new Error('zz GL hỏng giả'));
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    let r;
    try {
      r = await svc.ingest(pl({ content: 'ZZNOIDUNG bí mật' }));
    } finally {
      spy.mockRestore();
    }
    expect(r.status).toBe('posted');
    expect(r.gl).toBe('error');
    expect(await counts()).toEqual({ bt: 1, so: 1, gl: 0 });
    expect((await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r.histId! } })).sourceId).toBe(r.bankTxId);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const msg = String(logSpy.mock.calls[0][0]);
    logSpy.mockRestore();
    expect(msg).toContain(`bankTxId=${r.bankTxId}`);
    expect(msg).toContain(`histId=${r.histId}`);
    expect(msg).toContain('tk=TK01');
    expect(msg.includes(STK1) || msg.includes('ZZNOIDUNG') || msg.includes('zz GL hỏng giả')).toBe(false);
  });

  test("postBiz trả status 'error' ⇒ ingest vẫn posted, có log", async () => {
    const spy = jest.spyOn(glMap, 'postBiz').mockResolvedValueOnce({ status: 'error', reason: 'x' });
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const r = await svc.ingest(pl());
      expect([r.status, r.gl]).toEqual(['posted', 'error']);
      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
      logSpy.mockRestore();
    }
  });

  test('replayFrom: postBiz NÉM ⇒ vẫn đếm dòng sổ, không ném; lần sau = 0 (không ghi đôi sổ)', async () => {
    await svc.ingest(pl({ id: 'ZZG1' }), { mode: 'chi_ghi_nhan' });
    const spy = jest.spyOn(glMap, 'postBiz').mockRejectedValueOnce(new Error('zz GL hỏng giả'));
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      expect((await svc.replayFrom(MOC0, DEN)).posted).toBe(1);
      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
      logSpy.mockRestore();
    }
    expect(await counts()).toEqual({ bt: 1, so: 1, gl: 0 });
    expect((await svc.replayFrom(MOC0, DEN)).posted).toBe(0);
  });
});

describe("replayFrom chỉ ghi dòng từ SePay (bankid <> '')", () => {
  test("dòng nhập tay (bankid '') có tk_code ví thật, '+', tiền > 0 ⇒ BỎ QUA, không ghi 'sepay'", async () => {
    await seedBankTransaction({ bankid: '', tranType: '+', tranAmount: BigInt(5000), tkCode: 'TK01', tranMess: 'nhap tay' });
    await svc.ingest(pl({ id: 'ZZS1', transferAmount: 7000 }), { mode: 'chi_ghi_nhan' });
    expect((await svc.replayFrom(MOC0, DEN)).posted).toBe(1);
    const so = await prisma.treasuryEntry.findMany();
    expect(so.map((h) => [h.money!.toFixed(0), h.cuser])).toEqual([['7000', 'sepay']]);
  });
});

// ───────────────────────────── chiều `out` (phần chung, Task 1) ─────────────────────────────
describe('chiều out (phần chung) — chỉ lưu giao dịch, KHÔNG ghi sổ', () => {
  test("out ⇒ tranType '-', recorded, 0 dòng sổ, 0 GL", async () => {
    const r = await svc.ingest(pl({ transferType: 'out' }));
    expect(r.status).toBe('recorded');
    const bt = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: BigInt(r.bankTxId!) } });
    expect([bt.tranType, bt.tkCode, bt.status, bt.confirm]).toEqual(['-', 'TK01', 'yes', 'no']);
    // status 'yes' từ Task 2: prod :179-199 ẩn MỌI giao dịch out khỏi hàng chờ /bank (detail type 2 auto) — test/bank/ingest-out.spec.ts.
    expect(await counts()).toEqual({ bt: 1, so: 0, gl: 0 });
  });
});

// ───────────────────────────── công tắc chi_ghi_nhan + replayFrom ─────────────────────────────
describe("công tắc 'chi_ghi_nhan' + replayFrom(bankTxIdExclusive)", () => {
  test('chi_ghi_nhan ⇒ chỉ INSERT giao dịch (recorded), 0 sổ, 0 GL; replayFrom ghi đủ; lần 2 = 0', async () => {
    const m = { mode: 'chi_ghi_nhan' as const };
    const a = await svc.ingest(pl({ id: 'ZZA', transferAmount: 1000000 }), m);
    const b = await svc.ingest(pl({ id: 'ZZB', transferAmount: 2500000, accountNumber: STK3, content: 'Nạp tiền ệ' }), m);
    const o = await svc.ingest(pl({ id: 'ZZO', transferType: 'out' }), m);
    const c = await svc.ingest(pl({ id: 'ZZC', transferAmount: 700000 }), m);
    expect([a, b, o, c].map((x) => x.status)).toEqual(['recorded', 'recorded', 'recorded', 'recorded']);
    expect(await counts()).toEqual({ bt: 4, so: 0, gl: 0 });
    // trùng vẫn chặn khi đóng băng
    expect((await svc.ingest(pl({ id: 'ZZA' }), m)).status).toBe('duplicate');

    // mốc LOẠI TRỪ: chỉ giao dịch id > a ⇒ b, c (o là chiều '-' ⇒ bỏ)
    expect((await svc.replayFrom(a.bankTxId!, DEN)).posted).toBe(2);
    expect((await svc.replayFrom(MOC0, DEN)).posted).toBe(1); // còn a
    expect((await svc.replayFrom(MOC0, DEN)).posted).toBe(0); // chạy lại ⇒ 0 (T2/F7)

    const so = await prisma.treasuryEntry.findMany({ orderBy: { sourceId: 'asc' } });
    expect(so.map((h) => [h.sourceModule, h.sourceId, h.tkCode, h.type, h.money!.toFixed(0), h.status, h.cuser, h.approveUser])).toEqual([
      ['bank_tx', a.bankTxId, 'TK01', 'in', '1000000', 1, 'sepay', 'sepay'],
      ['bank_tx', b.bankTxId, 'TK03', 'in', '2500000', 1, 'sepay', 'sepay'],
      ['bank_tx', c.bankTxId, 'TK01', 'in', '700000', 1, 'sepay', 'sepay'],
    ]);
    expect(so[1].note).toBe(PREFIX + 'Nạp tiền ệ');
    // GL theo ví, nguồn = id dòng sổ
    const gb = await glLinesOfSource('bank_tx', so[1].id);
    expect(gb!.lines).toEqual([['138', '2500000.00', '0.00'], ['338', '0.00', '2500000.00']]);
    expect(gb!.e.description).toBe('Tiền về TK03 — Nạp tiền ệ');
    expect(await prisma.glEntry.count()).toBe(3);
  });

  test('replayFrom sau ingest bình thường ⇒ 0 (hasPosted đã có), không ghi đôi', async () => {
    await svc.ingest(pl());
    expect((await svc.replayFrom(MOC0, DEN)).posted).toBe(0);
    expect(await counts()).toEqual({ bt: 1, so: 1, gl: 1 });
  });

  test("replayFrom KHÔNG ghi sổ: tk_code '' (không ví), tiền 0, chiều '-' (dòng '-' vẫn được phân loại như ingest)", async () => {
    await seedBankTransaction({ bankid: 'ZZ1', tranType: '+', tranAmount: BigInt(5000), tkCode: '' });
    await seedBankTransaction({ bankid: 'ZZ2', tranType: '+', tranAmount: BigInt(0), tkCode: 'TK01' });
    await seedBankTransaction({ bankid: 'ZZ3', tranType: '-', tranAmount: BigInt(5000), tkCode: 'TK01' });
    expect((await svc.replayFrom(MOC0, DEN)).posted).toBe(0);
    expect(await counts()).toEqual({ bt: 3, so: 0, gl: 0 });
  });

  test('replayFrom chạy ĐỒNG THỜI hai lượt ⇒ tổng ghi mới = số giao dịch, mỗi giao dịch 1 dòng sổ', async () => {
    const m = { mode: 'chi_ghi_nhan' as const };
    for (const id of ['ZZR1', 'ZZR2', 'ZZR3']) await svc.ingest(pl({ id }), m);
    const [x, y] = await Promise.all([svc.replayFrom(MOC0, DEN), svc.replayFrom(MOC0, DEN)]);
    expect(x.posted + y.posted).toBe(3);
    expect(await counts()).toEqual({ bt: 3, so: 3, gl: 3 });
  });
});
