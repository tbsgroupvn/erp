// 09b đợt 1, Task 2 — TreasuryService (sổ quỹ công ty, port CLS_TREASURY).
// Đặc tả: docs/rewrite-spec/09b-so-quy-treasury.md §3, §5.1, §5.2, §5.6, §10.2, §11.1 mục 5, §12;
//         docs/rewrite-spec/09a-thanh-toan-ncc.md §6.1, §11, §12 (L1).
// Plan:   docs/rewrite-spec/plans/2026-09-25-09b-so-quy-dot1-plan.md (Q1, Q3, Q4, Q12).
import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';
import { prisma, resetDb } from '../helpers/db';
import { resetTreasury, seedFundAccount, seedTreasuryEntry } from '../helpers/treasury-db';
import { resetSupplierPayment, seedSupplierPayment } from '../helpers/supplier-payment-db';
import { TreasuryService } from '../../src/money/treasury.service';
import { WalletService } from '../../src/money/wallet.service';
import { HoldService } from '../../src/money/hold.service';
import { GlMapService } from '../../src/money/gl-map.service';
import { GlService } from '../../src/money/gl.service';
import { phpRound } from '../../src/common/money';

const D = (v: string | number) => new Prisma.Decimal(v);
const svc = new TreasuryService(prisma as any);
/** Chạy fn trong MỘT giao dịch riêng (postEntry/postPaymentEntry/daoTheoNguon nhận `tx`). */
const inTx = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn);

const SRC = join(__dirname, '../../src/money/treasury.service.ts');

async function resetExchangeRates() {
  await prisma.$executeRawUnsafe(`TRUNCATE tbl_exchange_rates RESTART IDENTITY`);
}

beforeEach(async () => {
  await resetTreasury();
  await resetSupplierPayment();
  await resetExchangeRates();
});
afterAll(async () => {
  await resetExchangeRates();
  await prisma.$disconnect();
});

// ───────────────────────────── (g) cách ly khỏi ví KHÁCH ─────────────────────────────
describe('(g) cách ly khỏi ví khách', () => {
  test('mã nguồn TreasuryService KHÔNG import/gọi dịch vụ ví khách, KHÔNG nhắc hằng dung sai âm', () => {
    // Chứng minh bằng đọc nguồn (grep): sổ quỹ ĐƯỢC âm (Q12) và không được mượn/đi vòng/nới
    // luật không-âm của ví KHÁCH (#03). Chuỗi dựng ghép để chính tệp test không tự khớp.
    const src = readFileSync(SRC, 'utf8');
    expect(src).not.toMatch(new RegExp('Wallet' + 'Service'));
    expect(src).not.toMatch(new RegExp('wallet' + '\\.service'));
    expect(src).not.toMatch(new RegExp('DUNG_SAI' + '_AM'));
    expect(src).not.toMatch(/applyEntry/);
  });

  test('đối chứng: chốt ví khách không đổi — DUNG_SAI_AM xuất hiện đúng 3 lần trong wallet.service.ts', () => {
    // Tương đương `grep -c DUNG_SAI_AM src/money/wallet.service.ts` = 3 (Global Constraints của plan).
    const w = readFileSync(join(__dirname, '../../src/money/wallet.service.ts'), 'utf8');
    const lines = w.split('\n').filter((l) => l.includes('DUNG_SAI_AM'));
    expect(lines.length).toBe(3);
  });

  test('đối chứng hành vi: ví KHÁCH rỗng vẫn bị WalletService chặn trừ âm', async () => {
    // Cùng lúc ví QUỸ âm được (test Q12 bên dưới) — hai luật khác nhau, không lẫn.
    await resetDb();
    const gl = new GlService(prisma as any);
    const w = new WalletService(prisma as any, new HoldService(prisma as any), new GlMapService(prisma as any, gl));
    const r = await w.applyEntry('TBS09B', -100_000, 1, '', 'kt');
    expect(r.ok).toBe(false);
    expect(await w.getBalanceTrue('TBS09B')).toBe(0n);
  });
});

// ───────────────────────────── số dư (Q1 / T1) ─────────────────────────────
describe('getBalance / getBalances — opening + Σ status=1 (Q1, T1)', () => {
  test('TK02 đo prod: opening 4.157.885 + Σstatus1 −4.328.821,87 = −170.936,87; dòng 0/9 KHÔNG vào số dư', async () => {
    await seedFundAccount('TK02', { currency: 'CNY', openingBalance: D('4157885') });
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-4328821.87'), status: 1 });
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-999999'), status: 0 });
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-888888'), status: 9 });
    expect((await svc.getBalance('TK02')).toFixed(2)).toBe('-170936.87');
    const all = await svc.getBalances();
    expect(all.get('TK02')!.toFixed(2)).toBe('-170936.87');
  });

  test('ví không có dòng sổ ⇒ số dư = opening (TK13 3.982.236); getBalances liệt kê cả ví 0 dòng', async () => {
    await seedFundAccount('TK13', { openingBalance: D('3982236') });
    await seedFundAccount('TK12');
    expect((await svc.getBalance('TK13')).toFixed(0)).toBe('3982236');
    const all = await svc.getBalances();
    expect(all.get('TK13')!.toFixed(0)).toBe('3982236');
    expect(all.get('TK12')!.toFixed(0)).toBe('0');
  });

  test('CHI-TBS (không có trong danh mục ví, 39 dòng status 9) KHÔNG xuất hiện trong getBalances', async () => {
    await seedFundAccount('TK01');
    await seedTreasuryEntry({ tkCode: 'CHI-TBS', type: 'out', money: D('-1000'), status: 9 });
    const all = await svc.getBalances();
    expect(all.has('CHI-TBS')).toBe(false);
    expect([...all.keys()]).toEqual(['TK01']);
  });

  test('getAccount trả ví theo code (kể cả ví đã ẩn TK07), không có ⇒ null', async () => {
    await seedFundAccount('TK07', { accGroup: 'store', isActive: 0 });
    expect((await svc.getAccount('TK07'))?.accGroup).toBe('store');
    expect(await svc.getAccount('TK99')).toBeNull();
  });
});

// ───────────────────────────── postEntry (§5.1) ─────────────────────────────
describe('postEntry (§5.1)', () => {
  test('|money|; out/tranfer lưu ÂM, in lưu DƯƠNG; tranfer giữ nguyên chính tả (§12.1)', async () => {
    const a = await inTx((tx) => svc.postEntry(tx, 'TK01', 'out', D('-1500.5'), { status: 1 }));
    const b = await inTx((tx) => svc.postEntry(tx, 'TK01', 'tranfer', D('200'), { status: 1 }));
    const c = await inTx((tx) => svc.postEntry(tx, 'TK01', 'in', D('-300.12345'), { status: 1 }));
    const rows = await prisma.treasuryEntry.findMany({ where: { id: { in: [a, b, c] } }, orderBy: { id: 'asc' } });
    expect(rows.map((r) => [r.type, r.money!.toFixed(5)])).toEqual([
      ['out', '-1500.50000'], ['tranfer', '-200.00000'], ['in', '300.12345'],
    ]);
  });

  test('money <= 0 ⇒ trả 0, không ghi', async () => {
    expect(await inTx((tx) => svc.postEntry(tx, 'TK01', 'out', D(0), { status: 1 }))).toBe(0);
    expect(await prisma.treasuryEntry.count()).toBe(0);
  });

  test('mặc định prod: status 0, không approve; cus_id NULL khi không truyền; gout "" ; rate 0', async () => {
    const id = await inTx((tx) => svc.postEntry(tx, 'TK01', 'in', D('10'), { cuser: 'kt' }));
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id } });
    expect(r.status).toBe(0);
    expect(r.approveUser).toBeNull();
    expect(r.approveDate).toBeNull();
    expect(r.cusId).toBeNull();
    expect(r.gout).toBe('');
    expect(r.rate!.toFixed(0)).toBe('0');
    expect(r.cuser).toBe('kt');
  });

  test('status 1 ⇒ approveUser = opts.approveUser ?? cuser, approveDate = bây giờ', async () => {
    const t0 = Math.floor(Date.now() / 1000);
    const a = await inTx((tx) => svc.postEntry(tx, 'TK01', 'in', D('1'), { status: 1, cuser: 'sepay' }));
    const b = await inTx((tx) => svc.postEntry(tx, 'TK01', 'in', D('1'), { status: 1, cuser: 'nop', approveUser: 'duyet' }));
    const ra = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: a } });
    const rb = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: b } });
    expect(ra.approveUser).toBe('sepay');
    expect(rb.approveUser).toBe('duyet');
    expect(ra.approveDate!).toBeGreaterThanOrEqual(t0);
  });

  test('id cấp theo SEQUENCE nối tiếp id đã nạp — KHÔNG theo time() của prod (Q2)', async () => {
    // Giả lập ETL: nạp id prod lớn nhất đo được rồi setval (migration §6).
    await seedTreasuryEntry({ id: 1790251005, tkCode: 'TK02', type: 'out', money: D('-1'), status: 1 });
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('tbl_account_histories','id'), (SELECT MAX(id) FROM tbl_account_histories))`,
    );
    const id = await inTx((tx) => svc.postEntry(tx, 'TK02', 'out', D('1'), { status: 1 }));
    expect(id).toBe(1790251006);
  });

  test('cùng (module, sourceId) đã ghi ⇒ trả id CŨ, không ghi thêm', async () => {
    const o = { status: 1, sourceModule: 'payment', sourceId: 7 };
    const a = await inTx((tx) => svc.postEntry(tx, 'TK02', 'out', D('5'), o));
    const b = await inTx((tx) => svc.postEntry(tx, 'TK02', 'out', D('999'), o));
    expect(b).toBe(a);
    expect(await prisma.treasuryEntry.count()).toBe(1);
  });

  test('order_code cắt 50 ký tự, reversal_code 20, reversal_reason 255 (như prod mb_substr)', async () => {
    const id = await inTx((tx) => svc.postEntry(tx, 'TK01', 'in', D('1'), {
      orderCode: 'Đ'.repeat(60), reversalCode: 'x'.repeat(30), reversalReason: 'y'.repeat(300),
    }));
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id } });
    expect(r.orderCode).toBe('Đ'.repeat(50));
    expect(r.reversalCode.length).toBe(20);
    expect(r.reversalReason.length).toBe(255);
  });

  test('(Q12) ví QUỸ ĐƯỢC ÂM: TK02 opening 0, chi 10.000 ¥ ⇒ ghi được, số dư −10.000', async () => {
    // Prod: postPaymentEntry không kiểm số dư ⇒ TK02 −170.936,87 ¥ (P15). Không có chốt âm nào ở đây.
    await seedFundAccount('TK02', { currency: 'CNY' });
    const id = await inTx((tx) => svc.postEntry(tx, 'TK02', 'out', D('10000'), { status: 1 }));
    expect(id).toBeGreaterThan(0);
    expect((await svc.getBalance('TK02')).toFixed(0)).toBe('-10000');
  });
});

// ───────────────────────────── (c) hasPosted (§5.1, §12.2) ─────────────────────────────
describe('(c) hasPosted — KHÔNG lọc status; dòng đã bị đảo = chưa ghi', () => {
  test('dòng status 0 ⇒ đã ghi (chặn ghi lại)', async () => {
    const r = await seedTreasuryEntry({ tkCode: 'TK01', type: 'out', money: D('-1'), status: 0, sourceModule: 'thu_chi_tbs', sourceId: 11 });
    expect(await inTx((tx) => svc.hasPosted(tx, 'thu_chi_tbs', 11))).toBe(r.id);
    // postEntry cũng bị chặn ⇒ trả id dòng 0, không ghi dòng mới (P10 của prod, giữ nguyên — Q4).
    expect(await inTx((tx) => svc.postEntry(tx, 'TK01', 'out', D('1'), { status: 1, sourceModule: 'thu_chi_tbs', sourceId: 11 }))).toBe(r.id);
    expect(await prisma.treasuryEntry.count()).toBe(1);
  });

  test('dòng status 9 (CHI-TBS huỷ) ⇒ đã ghi', async () => {
    const r = await seedTreasuryEntry({ tkCode: 'CHI-TBS', type: 'out', money: D('-1'), status: 9, sourceModule: 'thu_chi_tbs', sourceId: 12 });
    expect(await inTx((tx) => svc.hasPosted(tx, 'thu_chi_tbs', 12))).toBe(r.id);
  });

  test('dòng status 1 bị một dòng khác reversal_of trỏ tới ⇒ CHƯA ghi (0) ⇒ postEntry ghi lại được', async () => {
    const g = await seedTreasuryEntry({ tkCode: 'TK01', type: 'out', money: D('-100'), status: 1, sourceModule: 'payment', sourceId: 13 });
    await seedTreasuryEntry({ tkCode: 'TK01', type: 'in', money: D('100'), status: 1, sourceModule: 'daoxoa_payment', sourceId: g.id, reversalOf: g.id });
    expect(await inTx((tx) => svc.hasPosted(tx, 'payment', 13))).toBe(0);
    const again = await inTx((tx) => svc.postEntry(tx, 'TK01', 'out', D('120'), { status: 1, sourceModule: 'payment', sourceId: 13 }));
    expect(again).not.toBe(g.id);
    expect(again).toBeGreaterThan(0);
  });

  test('khác module hoặc khác sourceId ⇒ 0', async () => {
    await seedTreasuryEntry({ tkCode: 'TK01', type: 'out', money: D('-1'), status: 1, sourceModule: 'payment', sourceId: 14 });
    expect(await inTx((tx) => svc.hasPosted(tx, 'bank_tx', 14))).toBe(0);
    expect(await inTx((tx) => svc.hasPosted(tx, 'payment', 15))).toBe(0);
  });
});

// ───────────────────────────── (d) chống trùng song song (Q3) ─────────────────────────────
describe('(d) postEntry song song cùng (module, sourceId) ⇒ đúng 1 dòng', () => {
  test('5 giao dịch RIÊNG chạy đồng thời, mỗi cái giữ giao dịch mở 300ms sau khi ghi ⇒ 1 dòng, cùng 1 id', async () => {
    // Không có advisory lock: cả 5 đều chạy hasPosted khi CHƯA ai commit (READ COMMITTED) ⇒ 5 dòng
    // (cửa sổ đua P7 của prod). pg_sleep sau khi ghi giữ giao dịch mở để chắc chắn các giao dịch
    // kia đã tới hasPosted trước khi cái đầu commit — làm phép đo xác định, không phụ thuộc may rủi.
    const run = () =>
      prisma.$transaction(
        async (tx) => {
          const id = await svc.postEntry(tx, 'TK02', 'out', D('447.60'), { status: 1, sourceModule: 'payment', sourceId: 22490 });
          await tx.$queryRawUnsafe(`SELECT pg_sleep(0.3)::text`);
          return id;
        },
        { timeout: 20000, maxWait: 20000 },
      );
    const ids = await Promise.all([run(), run(), run(), run(), run()]);
    expect(await prisma.treasuryEntry.count({ where: { sourceModule: 'payment', sourceId: 22490 } })).toBe(1);
    expect(new Set(ids).size).toBe(1);
  });
});

// ───────────────────────────── postPaymentEntry (§5.2 = 09a §6.1) ─────────────────────────────
describe('postPaymentEntry — golden replay 09a §6.1 (ca đo thật)', () => {
  async function wallets() {
    await seedFundAccount('TK02', { currency: 'CNY', glAccount: '1122' });
    await seedFundAccount('TK14', { currency: 'CNY', glAccount: '1122' });
    await seedFundAccount('TK09', { currency: 'VND', glAccount: '1121' });
    await seedFundAccount('TK08', { currency: 'USD', glAccount: '1122' });
  }
  const post = (id: number, approver = 'maigiang_ketoantbs', cdate?: number) =>
    inTx((tx) => svc.postPaymentEntry(tx, id, approver, cdate));

  test('#22490 (L1): ¥447,60 × 3.925, price_payment LỖI THỜI 1.758.596, ví TK02 CNY ⇒ −447,60 ¥, rate 3925', async () => {
    // 09a §12 L1: "sổ quỹ TK02 (¥, dùng price_cyn) ĐÚNG" — ví CNY bỏ qua price_payment.
    await wallets();
    const p = await seedSupplierPayment({ id: 22490, priceCyn: D('447.60'), rateBuy: 3925, pricePayment: D('1758596'), accountCode: 'TK02', codeOrder: 'DH22490', poId: 0 });
    const hid = await post(p.id);
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: hid } });
    expect(r.tkCode).toBe('TK02');
    expect(r.type).toBe('out');
    expect(r.money!.toFixed(5)).toBe('-447.60000');
    expect(r.rate!.toFixed(0)).toBe('3925');
    expect(r.status).toBe(1);
    expect(r.cuser).toBe('maigiang_ketoantbs');
    expect(r.approveUser).toBe('maigiang_ketoantbs');
    expect(r.sourceModule).toBe('payment');
    expect(r.sourceId).toBe(22490);
    expect(r.orderCode).toBe('DH22490');
    expect(r.note).toBe('Phiếu chi NCC #22490 - DH22490');
  });

  test('#30389 (L1): ¥906,60 × 3.925 trên TK14 CNY, có PO ⇒ −906,60 ¥, rate 3925, note có "(PO n)", po_id bám', async () => {
    await wallets();
    const p = await seedSupplierPayment({ id: 30389, priceCyn: D('906.60'), rateBuy: 3925, pricePayment: D('3559975'), accountCode: 'TK14', codeOrder: 'PO001/2026', poId: 812 });
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: await post(p.id) } });
    expect(r.money!.toFixed(2)).toBe('-906.60');
    expect(r.rate!.toFixed(0)).toBe('3925');
    expect(r.poId).toBe(812);
    expect(r.note).toBe('Phiếu chi NCC #30389 (PO 812) - PO001/2026');
  });

  test('#14455 (L1): account_code "" (14.238 phiếu không ví) ⇒ trả 0, không ghi dòng nào', async () => {
    await wallets();
    const p = await seedSupplierPayment({ id: 14455, priceCyn: D('6430.50'), rateBuy: 26099, pricePayment: D('158702310'), accountCode: '' });
    expect(await post(p.id)).toBe(0);
    expect(await prisma.treasuryEntry.count()).toBe(0);
  });

  test('ví VND dùng price_payment khi > 0 — kể cả khi lỗi thời (#14455 nếu gắn TK09: 158.702.310, KHÔNG 167.829.620)', async () => {
    // Suy từ 09a §12 L1 ("Nếu #14455 được duyệt: GL ghi 158.702.310") — cùng công thức price_vnd ở §6.1.
    await wallets();
    const p = await seedSupplierPayment({ id: 14455, priceCyn: D('6430.50'), rateBuy: 26099, pricePayment: D('158702310'), accountCode: 'TK09' });
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: await post(p.id) } });
    expect(r.money!.toFixed(2)).toBe('-158702310.00');
    expect(r.rate!.toFixed(0)).toBe('26099');
  });

  test('price_payment NULL (bình thường, 09a §11.1) trên ví VND ⇒ rơi về price_cyn × rate_buy, KHÔNG làm tròn', async () => {
    // 6.430,50 × 26.099 = 167.829.619,5 (09a §13: round(...) = 167.829.620 là số của process_edit,
    // postPaymentEntry KHÔNG round — lưu nguyên .5 vào decimal(20,5)).
    await wallets();
    const p = await seedSupplierPayment({ id: 14456, priceCyn: D('6430.50'), rateBuy: 26099, pricePayment: null, accountCode: 'TK09' });
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: await post(p.id) } });
    expect(r.money!.toFixed(5)).toBe('-167829619.50000');
  });

  test('price_payment = 0 cũng rơi về price_cyn × rate_buy (PHP `<= 0`)', async () => {
    await wallets();
    const p = await seedSupplierPayment({ priceCyn: D('447.60'), rateBuy: 3925, pricePayment: D('0'), accountCode: 'TK09' });
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: await post(p.id) } });
    expect(r.money!.toFixed(2)).toBe('-1756830.00');
  });

  test('rate_buy = 1 (price_cyn là VND, #685 ¥870.318.505 max) trên ví VND, price_payment NULL ⇒ −870.318.505, rate 1', async () => {
    await wallets();
    const p = await seedSupplierPayment({ id: 685, priceCyn: D('870318505.00'), rateBuy: 1, pricePayment: null, accountCode: 'TK09' });
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: await post(p.id) } });
    expect(r.money!.toFixed(2)).toBe('-870318505.00');
    expect(r.rate!.toFixed(0)).toBe('1');
  });

  test('cờ currency của phiếu KHÔNG đổi nhánh ở ví CNY (276 phiếu "CNY" mang tỷ giá USD) — theo tệ của VÍ', async () => {
    await wallets();
    const p = await seedSupplierPayment({ priceCyn: D('1000'), rateBuy: 25050, currency: 'USD', accountCode: 'TK02' });
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: await post(p.id) } });
    expect(r.money!.toFixed(2)).toBe('-1000.00');
    expect(r.rate!.toFixed(0)).toBe('25050');
  });

  test('ví USD + phiếu không phải USD + bảng tỷ giá RỖNG (prod 0 dòng) ⇒ trả 0, không bịa số (§12.6)', async () => {
    await wallets();
    const p = await seedSupplierPayment({ priceCyn: D('1000'), rateBuy: 3925, currency: 'CNY', accountCode: 'TK08' });
    expect(await post(p.id)).toBe(0);
    expect(await prisma.treasuryEntry.count()).toBe(0);
  });

  test('ví USD + phiếu USD + price_cyn > 0 ⇒ money = price_cyn, rate = rate_buy', async () => {
    await wallets();
    const p = await seedSupplierPayment({ priceCyn: D('120.50'), rateBuy: 26115, currency: 'USD', accountCode: 'TK08' });
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: await post(p.id) } });
    expect(r.money!.toFixed(2)).toBe('-120.50');
    expect(r.rate!.toFixed(0)).toBe('26115');
  });

  test('ví USD + phiếu CNY + có tỷ giá USD (ExchangeRate) ⇒ money = round(price_vnd / usd, 2) nửa-xa-0, rate = usd', async () => {
    await wallets();
    // 1.756.830 / 26.115 = 67,2728...; lấy ca nửa: 1.000.005 / 200 = 5000,025 ⇒ PHP round = 5000,03.
    await prisma.exchangeRate.create({ data: { currency: 'USD', rateVnd: D('200'), rateDate: new Date('2026-01-01T00:00:00Z') } });
    const p = await seedSupplierPayment({ priceCyn: D('1000005'), rateBuy: 1, pricePayment: null, currency: 'CNY', accountCode: 'TK08' });
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: await post(p.id) } });
    expect(phpRound(1000005 / 200, 2)).toBe(5000.03); // đối chiếu quy tắc PHP
    expect(r.money!.toFixed(5)).toBe('-5000.03000');
    expect(r.rate!.toFixed(0)).toBe('200');
  });

  test('tỷ giá USD lấy dòng gần nhất <= hôm nay; dòng ngày tương lai bị bỏ qua', async () => {
    await wallets();
    await prisma.exchangeRate.create({ data: { currency: 'USD', rateVnd: D('25000'), rateDate: new Date('2026-01-01T00:00:00Z') } });
    await prisma.exchangeRate.create({ data: { currency: 'USD', rateVnd: D('26000'), rateDate: new Date('2026-02-01T00:00:00Z') } });
    await prisma.exchangeRate.create({ data: { currency: 'USD', rateVnd: D('99999'), rateDate: new Date('2099-01-01T00:00:00Z') } });
    const p = await seedSupplierPayment({ priceCyn: D('260000'), rateBuy: 1, currency: 'CNY', accountCode: 'TK08' });
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: await post(p.id) } });
    expect(r.money!.toFixed(2)).toBe('-10.00');
    expect(r.rate!.toFixed(0)).toBe('26000');
  });

  test('ví không có trong danh mục ⇒ 0; phiếu không tồn tại ⇒ 0', async () => {
    await wallets();
    const p = await seedSupplierPayment({ priceCyn: D('10'), rateBuy: 3925, accountCode: 'TK77' });
    expect(await post(p.id)).toBe(0);
    expect(await post(999999)).toBe(0);
    expect(await prisma.treasuryEntry.count()).toBe(0);
  });

  test('idempotent: duyệt lại ⇒ trả id cũ, 1 dòng; cdateOverride ⇒ cdate = ngày phiếu (ghi bù)', async () => {
    await wallets();
    const p = await seedSupplierPayment({ id: 34863, priceCyn: D('4000'), rateBuy: 3925, accountCode: 'TK02' });
    const a = await post(p.id, 'ketoantbs', 1757980800);
    const b = await post(p.id, 'dutbs');
    expect(b).toBe(a);
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: a } });
    expect(r.money!.toFixed(0)).toBe('-4000');
    expect(r.cdate).toBe(1757980800);
    expect(r.approveUser).toBe('ketoantbs');
    expect(await prisma.treasuryEntry.count()).toBe(1);
  });

  test('code_order NULL ⇒ note không hậu tố, order_code ""', async () => {
    await wallets();
    const p = await seedSupplierPayment({ priceCyn: D('1'), rateBuy: 3925, accountCode: 'TK02', codeOrder: null });
    const r = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: await post(p.id) } });
    expect(r.note).toBe(`Phiếu chi NCC #${p.id}`);
    expect(r.orderCode).toBe('');
  });
});

// ───────────────────────────── (e) daoTheoNguon (§5.6) ─────────────────────────────
describe('(e) daoTheoNguon — chỉ đảo status=1, chạy lại không đảo lần 2', () => {
  test('đảo dòng status 1; bỏ qua status 0/9; chạy lần 2 không ghi thêm; trả id gốc', async () => {
    const g1 = await seedTreasuryEntry({ tkCode: 'TK01', type: 'out', money: D('-54847800'), rate: D('1'), status: 1, sourceModule: 'thu_chi_tbs', sourceId: 9337, poId: 5, orderCode: 'DH1', cusId: 'TBS82' });
    const g0 = await seedTreasuryEntry({ tkCode: 'TK01', type: 'out', money: D('-100'), status: 0, sourceModule: 'thu_chi_tbs', sourceId: 9337 });
    const g9 = await seedTreasuryEntry({ tkCode: 'CHI-TBS', type: 'out', money: D('-200'), status: 9, sourceModule: 'thu_chi_tbs', sourceId: 9337 });

    const r1 = await inTx((tx) => svc.daoTheoNguon(tx, 'thu_chi_tbs', 9337, 'Phiếu bị từ chối', 'admin', 'sai_tien', 9337));
    expect(r1.soDong).toBe(1);
    expect(r1.daDao).toBe(1);
    expect(r1.idsGoc).toEqual([g1.id]);
    expect(r1.idsDaDao).toEqual([g1.id]);
    // GL đảo KHÔNG chạy trong tx — trả cho người gọi: thu_chi_tbs ⇒ appr_request theo ID PHIẾU.
    expect(r1.glDao).toEqual([{ sourceType: 'appr_request', sourceId: 9337 }]);

    const dao = await prisma.treasuryEntry.findMany({ where: { reversalOf: g1.id } });
    expect(dao.length).toBe(1);
    const d = dao[0];
    expect(d.tkCode).toBe('TK01');
    expect(d.type).toBe('in');
    expect(d.money!.toFixed(2)).toBe('54847800.00');
    expect(d.sourceModule).toBe('daoxoa_thu_chi_tbs');
    expect(d.sourceId).toBe(g1.id);
    expect(d.status).toBe(1);
    expect(d.cuser).toBe('admin');
    expect(d.approveUser).toBe('admin');
    expect(d.reversalCode).toBe('sai_tien');
    expect(d.reversalReason).toBe('Phiếu bị từ chối');
    expect(d.refRequestId).toBe(9337);
    expect(d.rate!.toFixed(0)).toBe('1');
    expect(d.poId).toBe(5);
    expect(d.orderCode).toBe('DH1');
    expect(d.cusId).toBe('TBS82');
    expect(d.note).toBe(`↩ ĐẢO phiếu #9337 — bút toán #${g1.id}`);

    // status 0/9 KHÔNG bị đảo, money giữ nguyên.
    expect(await prisma.treasuryEntry.count({ where: { reversalOf: { in: [g0.id, g9.id] } } })).toBe(0);

    const before = await prisma.treasuryEntry.count();
    const r2 = await inTx((tx) => svc.daoTheoNguon(tx, 'thu_chi_tbs', 9337, 'lần 2', 'admin'));
    expect(r2.daDao).toBe(0);
    expect(r2.idsDaDao).toEqual([]);
    expect(await prisma.treasuryEntry.count()).toBe(before);
  });

  test('dòng tranfer (âm) đảo thành in; dòng in (dương) đảo thành out; họ FX trả GL theo TỪNG id dòng', async () => {
    const a = await seedTreasuryEntry({ tkCode: 'TK01', type: 'tranfer', money: D('-1000'), status: 1, sourceModule: 'fx_transfer', sourceId: 19 });
    const b = await seedTreasuryEntry({ tkCode: 'TK02', type: 'in', money: D('250.5'), status: 1, sourceModule: 'fx_transfer', sourceId: 19 });
    const r = await inTx((tx) => svc.daoTheoNguon(tx, 'fx_transfer', 19, 'mở lại', 'admin'));
    expect(r.daDao).toBe(2);
    expect(r.glDao).toEqual([{ sourceType: 'fx_transfer', sourceId: a.id }, { sourceType: 'fx_transfer', sourceId: b.id }]);
    const ra = await prisma.treasuryEntry.findFirstOrThrow({ where: { reversalOf: a.id } });
    const rb = await prisma.treasuryEntry.findFirstOrThrow({ where: { reversalOf: b.id } });
    expect([ra.type, ra.money!.toFixed(0)]).toEqual(['in', '1000']);
    expect([rb.type, rb.money!.toFixed(1)]).toEqual(['out', '-250.5']);
    expect(ra.reversalCode).toBe('khac');
    expect(ra.refRequestId).toBe(0);
    expect(ra.note).toBe(`↩ ĐẢO — bút toán #${a.id}`);
    // fx_quydoi ⇒ GL nguồn 'fx_transfer' (prod 24/09); payment/bank_tx ⇒ không đảo GL.
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-3'), status: 1, sourceModule: 'fx_quydoi', sourceId: 20 });
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-3'), status: 1, sourceModule: 'payment', sourceId: 21 });
    const rq = await inTx((tx) => svc.daoTheoNguon(tx, 'fx_quydoi', 20, 'x', 'u'));
    expect(rq.glDao.map((g) => g.sourceType)).toEqual(['fx_transfer']);
    const rp = await inTx((tx) => svc.daoTheoNguon(tx, 'payment', 21, 'x', 'u'));
    expect(rp.glDao).toEqual([]);
  });

  test('sau khi đảo, hasPosted gốc = 0 ⇒ ghi lại được (thiết kế "mở lại → đảo → duyệt lại"); số dư về như cũ', async () => {
    await seedFundAccount('TK02', { currency: 'CNY' });
    const id = await inTx((tx) => svc.postEntry(tx, 'TK02', 'out', D('447.60'), { status: 1, sourceModule: 'payment', sourceId: 1 }));
    expect((await svc.getBalance('TK02')).toFixed(2)).toBe('-447.60');
    await inTx((tx) => svc.daoTheoNguon(tx, 'payment', 1, 'back', 'kt'));
    expect((await svc.getBalance('TK02')).toFixed(2)).toBe('0.00');
    expect(await inTx((tx) => svc.hasPosted(tx, 'payment', 1))).toBe(0);
    const id2 = await inTx((tx) => svc.postEntry(tx, 'TK02', 'out', D('400'), { status: 1, sourceModule: 'payment', sourceId: 1 }));
    expect(id2).not.toBe(id);
    expect((await svc.getBalance('TK02')).toFixed(2)).toBe('-400.00');
  });

  test('module rỗng / sourceId <= 0 / không có dòng ⇒ kết quả rỗng; mod_dao cắt 20 ký tự', async () => {
    expect((await inTx((tx) => svc.daoTheoNguon(tx, '', 1, 'x', 'u'))).soDong).toBe(0);
    expect((await inTx((tx) => svc.daoTheoNguon(tx, 'payment', 0, 'x', 'u'))).soDong).toBe(0);
    expect((await inTx((tx) => svc.daoTheoNguon(tx, 'payment', 5, 'x', 'u'))).soDong).toBe(0);
    const g = await seedTreasuryEntry({ tkCode: 'TK01', type: 'out', money: D('-1'), status: 1, sourceModule: 'fx_transfer_dao', sourceId: 3 });
    await inTx((tx) => svc.daoTheoNguon(tx, 'fx_transfer_dao', 3, 'x', 'u'));
    const d = await prisma.treasuryEntry.findFirstOrThrow({ where: { reversalOf: g.id } });
    expect(d.sourceModule).toBe('daoxoa_fx_transfer_d'); // 'daoxoa_fx_transfer_dao'.slice(0,20)
  });
});
