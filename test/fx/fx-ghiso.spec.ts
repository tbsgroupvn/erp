// 09c L2, Task 2 — TreasuryService.transfer() + fxGhiSoPhieu() (port `CLS_TREASURY::transfer`
// `cls.treasury.php:1039-1145` và `fx_ghi_so_phieu` `libs/fx_ghiso.php:67-121`).
// Đặc tả: docs/rewrite-spec/09c-fx-ngan-hang.md §3.2, §5.1, §5.2, §8 (F1/F2/F13/F14), §10.2, §12;
//         docs/rewrite-spec/09b-so-quy-treasury.md §3.1 (dấu), §5.1 (hasPosted).
// Plan:   docs/rewrite-spec/plans/2026-09-25-09c-L2-fx-core-plan.md — Task 2.
//
// ⛔ KHÔNG có dữ liệu tiền prod nào ở đây: mọi phiếu mẫu dựng từ CÔNG THỨC đặc tả (§5.3:
// amountInTuRate, tinhPhiFxPercent, fxKiemAgent) với số tròn tự chọn. Phép lặp lại vàng
// 65/65 chân / F2 theo 9 ví thật nằm ở cổng diễn tập trên bản dump (L0), KHÔNG ở đây.
import { Prisma } from '@prisma/client';
import { prisma } from '../helpers/db';
import { resetTreasury, seedFundAccount, seedTreasuryEntry } from '../helpers/treasury-db';
import { resetFxBank, seedFxTransfer } from '../helpers/fx-bank-db';
import { TreasuryError, TreasuryService } from '../../src/money/treasury.service';
import { amountInTuRate, fxKiemAgent, tinhPhiFxPercent, viPhiFx } from '../../src/money/fx-rules';

const D = (v: string | number) => new Prisma.Decimal(v);
const svc = new TreasuryService(prisma as any);
const inTx = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
  prisma.$transaction(fn, { timeout: 20000, maxWait: 20000 });

const FX_FAMILY = ['fx_transfer', 'fx_fee', 'fx_quydoi'];

async function legs(module: string, sourceId: number) {
  return prisma.treasuryEntry.findMany({
    where: { sourceModule: module, sourceId },
    orderBy: { id: 'asc' },
  });
}
const shape = (rows: { tkCode: string | null; type: string | null; money: Prisma.Decimal | null }[]) =>
  rows.map((r) => [r.tkCode, r.type, r.money!.toFixed(5)]);

/** Bộ ví mẫu (không phải số dư prod): TK01/TK09 VND, TK08 USD → quy đổi sang TK02 CNY. */
async function seedWallets() {
  await seedFundAccount('TK01', { currency: 'VND', openingBalance: D('1000000000') });
  await seedFundAccount('TK09', { currency: 'VND', openingBalance: D('500000000') });
  await seedFundAccount('TK08', { currency: 'USD', openingBalance: D('1000'), quyDoiSang: 'TK02' });
  await seedFundAccount('TK02', { currency: 'CNY' });
}

beforeEach(async () => {
  await resetTreasury();
  await resetFxBank();
});
afterAll(async () => {
  await resetTreasury();
  await resetFxBank();
  await prisma.$disconnect();
});

// ───────────────────────────── bẫy §0.3 / §12.1 ─────────────────────────────
describe('bẫy §0.3/§12.1 — hai chân cùng khoá (module, sourceId)', () => {
  test('đối chứng SAI: ghi chân 2 bằng postEntry thường mang nhãn fx_transfer ⇒ chân đích BỊ NUỐT', async () => {
    // Chứng minh vì sao transfer() cần `label`: hasPosted khoá theo (module, source_id), KHÔNG
    // theo ví/chiều. "Gắn nhãn ngay khi ghi" bằng postEntry thường thì chân thứ 2 gặp
    // hasPosted('fx_transfer', 77) = id chân 1 và trả id CŨ, không ghi ⇒ phiếu mất chân đích.
    await seedWallets();
    const [a, b] = await inTx(async (tx) => {
      const outId = await svc.postEntry(tx, 'TK01', 'tranfer', D('25400000'), { status: 1, sourceModule: 'fx_transfer', sourceId: 77 });
      const inId = await svc.postEntry(tx, 'TK08', 'in', D('1000'), { status: 1, sourceModule: 'fx_transfer', sourceId: 77 });
      return [outId, inId];
    });
    expect(b).toBe(a); // id CŨ trả về
    const rows = await legs('fx_transfer', 77);
    expect(shape(rows)).toEqual([['TK01', 'tranfer', '-25400000.00000']]); // chỉ 1 chân — SAI
    expect((await svc.getBalance('TK08')).toFixed(2)).toBe('1000.00'); // ví đích không nhận tiền
  });

  test('bản thật: transfer(label fx_transfer/77) ghi ĐỦ 2 chân với đúng nhãn đó', async () => {
    await seedWallets();
    const r = await inTx((tx) =>
      svc.transfer(tx, 'TK01', 'TK08', D('25400000'), D('1000'), D('25400'), 'n', 'nop1', 1790000000, 1, {
        label: { module: 'fx_transfer', sourceId: 77 },
      }),
    );
    const rows = await legs('fx_transfer', 77);
    expect(shape(rows)).toEqual([
      ['TK01', 'tranfer', '-25400000.00000'],
      ['TK08', 'in', '1000.00000'],
    ]);
    expect(rows.map((x) => x.id)).toEqual([r.outId, r.inId]);
    expect(r.feeId).toBe(0);
  });
});

// ───────────────────────────── transfer() §5.2 ─────────────────────────────
describe('transfer() — §5.2 + §10.2', () => {
  test('KHÔNG label: chép prod — out source_module "" / in "transfer"+outId; status/cuser/approve_user/rate/cdate', async () => {
    // Bẫy §12.3: approve_user = cuser (người NỘP do người gọi truyền); bẫy §12.4: rate giữ đủ 6 lẻ ở v2.
    await seedWallets();
    const r = await inTx((tx) =>
      svc.transfer(tx, 'TK01', 'TK09', D('-3000000'), D('3000000'), D('1.123456'), 'luân chuyển', 'nop1', 1790000123, 1),
    );
    const out = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r.outId } });
    const inn = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r.inId } });
    expect([out.sourceModule, out.sourceId, out.type, out.money!.toFixed(2)]).toEqual(['', 0, 'tranfer', '-3000000.00']);
    expect([inn.sourceModule, inn.sourceId, inn.type, inn.money!.toFixed(2)]).toEqual(['transfer', r.outId, 'in', '3000000.00']);
    for (const x of [out, inn]) {
      expect([x.status, x.cuser, x.approveUser, x.cdate, x.note, x.rate!.toFixed(6)]).toEqual([
        1, 'nop1', 'nop1', 1790000123, 'luân chuyển', '1.123456',
      ]);
    }
    // glTodo: VND→VND ⇒ chuyenVi theo out_id (bẫy §12.2 — nguồn GL = id dòng sổ chân nguồn)
    expect(r.glTodo).toEqual([{ kind: 'chuyenVi', outId: r.outId, from: 'TK01', to: 'TK09', outVnd: D('3000000'), inVnd: D('3000000') }]);
  });

  test('from==to ⇒ ném; amountOut/amountIn <= 0 ⇒ ném; không ghi dòng nào', async () => {
    await seedWallets();
    await expect(inTx((tx) => svc.transfer(tx, 'TK01', 'TK01', D(1), D(1), D(1), '', 'u', 0, 1))).rejects.toBeInstanceOf(TreasuryError);
    await expect(inTx((tx) => svc.transfer(tx, 'TK01', 'TK09', D(0), D(1), D(1), '', 'u', 0, 1))).rejects.toBeInstanceOf(TreasuryError);
    await expect(inTx((tx) => svc.transfer(tx, 'TK01', 'TK09', D(1), D(0), D(1), '', 'u', 0, 1))).rejects.toBeInstanceOf(TreasuryError);
    expect(await prisma.treasuryEntry.count()).toBe(0);
  });

  test('cdate <= 0 ⇒ time()', async () => {
    await seedWallets();
    const t0 = Math.floor(Date.now() / 1000);
    const r = await inTx((tx) => svc.transfer(tx, 'TK01', 'TK09', D(5), D(5), D(1), '', 'u', 0, 1));
    const out = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r.outId } });
    expect(out.cdate!).toBeGreaterThanOrEqual(t0);
  });

  test('phí ở ví NGUỒN: canTru = out + fee ⇒ đủ out nhưng thiếu phí ⇒ "Số dư TK nguồn không đủ"', async () => {
    // TK09 opening 500.000.000; out 499.990.000 + phí 20.000 = 500.010.000 > số dư ⇒ lỗi.
    await seedWallets();
    await expect(
      inTx((tx) => svc.transfer(tx, 'TK09', 'TK01', D('499990000'), D('499990000'), D(1), '', 'u', 0, 1, {
        fee: D('20000'), feeTk: 'TK09', feeModule: 'fx_fee', feeSourceId: 5,
      })),
    ).rejects.toThrow('Số dư TK nguồn không đủ');
    expect(await prisma.treasuryEntry.count()).toBe(0);
    // Vừa đủ ⇒ ghi out, in, phí ở ví nguồn mang nhãn fx_fee/5
    const r = await inTx((tx) => svc.transfer(tx, 'TK09', 'TK01', D('499980000'), D('499980000'), D(1), '', 'u', 0, 1, {
      fee: D('20000'), feeTk: 'TK09', feeNote: 'phí', feeModule: 'fx_fee', feeSourceId: 5,
    }));
    const fee = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r.feeId } });
    expect([fee.tkCode, fee.type, fee.money!.toFixed(2), fee.sourceModule, fee.sourceId, fee.note]).toEqual([
      'TK09', 'out', '-20000.00', 'fx_fee', 5, 'phí',
    ]);
    expect((await svc.getBalance('TK09')).toFixed(2)).toBe('0.00');
    expect(r.glTodo).toContainEqual({ kind: 'fxPhi', feeId: r.feeId, feeTk: 'TK09', feeVnd: D('20000'), cur: 'VND', amountCcy: D('20000') });
  });

  test('feeTk ngoài {from,to} ⇒ phí ở ví NGUỒN (from)', async () => {
    await seedWallets();
    const r = await inTx((tx) => svc.transfer(tx, 'TK01', 'TK09', D(100), D(100), D(1), '', 'u', 0, 1, { fee: D(7), feeTk: 'TK02' }));
    const fee = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r.feeId } });
    expect(fee.tkCode).toBe('TK01');
  });

  test('phí ở ví ĐÍCH không tính vào canTru nguồn; ghi phí ở ví đích', async () => {
    // TK08 opening 1000: out 1000 (đủ đúng bằng số dư) + phí 10 USD ở ví ĐÍCH TK01 ⇒ không chặn nguồn.
    await seedWallets();
    const r = await inTx((tx) => svc.transfer(tx, 'TK08', 'TK01', D(1000), D('25400000'), D('25400'), '', 'u', 0, 1, {
      fee: D('254000'), feeTk: 'TK01', feeModule: 'fx_fee', feeSourceId: 6,
    }));
    const fee = await prisma.treasuryEntry.findUniqueOrThrow({ where: { id: r.feeId } });
    expect([fee.tkCode, fee.money!.toFixed(2)]).toEqual(['TK01', '-254000.00']);
    expect((await svc.getBalance('TK08')).toFixed(2)).toBe('0.00');
    // TK08 là USD ⇒ không có chuyenVi (Q11: GL FX ngoại tệ không làm ở lô này); phí VND ⇒ có fxPhi
    expect(r.glTodo).toEqual([{ kind: 'fxPhi', feeId: r.feeId, feeTk: 'TK01', feeVnd: D('254000'), cur: 'VND', amountCcy: D('254000') }]);
  });

  test('choAm BỎ chốt số dư nguồn (ví quỹ được âm — F14)', async () => {
    await seedWallets();
    await expect(inTx((tx) => svc.transfer(tx, 'TK02', 'TK08', D(710), D(100), D('7.1'), '', 'u', 0, 1))).rejects.toThrow('Số dư TK nguồn không đủ');
    await inTx((tx) => svc.transfer(tx, 'TK02', 'TK08', D(710), D(100), D('7.1'), '', 'u', 0, 1, { choAm: true }));
    expect((await svc.getBalance('TK02')).toFixed(2)).toBe('-710.00');
  });

  test('choAm KHÔNG bỏ chốt phí-ở-ví-đích (F13): ví đích ≥0 mà phí làm nó âm ⇒ ném, 0 dòng', async () => {
    // TK02 opening 0; nhận in 100 ⇒ balTo = 100 ≥ 0 và < phí 150 ⇒ lỗi DÙ choAm=true. Tx lùi hết
    // (thay DELETE out,in của prod :1095).
    await seedWallets();
    await expect(
      inTx((tx) => svc.transfer(tx, 'TK08', 'TK02', D(10), D(100), D('10'), '', 'u', 0, 1, { fee: D(150), feeTk: 'TK02', choAm: true })),
    ).rejects.toBeInstanceOf(TreasuryError);
    expect(await prisma.treasuryEntry.count()).toBe(0);
  });

  test('phí-ở-ví-đích: ví đích đã ÂM trước ⇒ không chặn (chỉ chặn khi balTo ≥ 0) — F13', async () => {
    await seedWallets();
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-1000'), status: 1 });
    const r = await inTx((tx) => svc.transfer(tx, 'TK08', 'TK02', D(10), D(100), D('10'), '', 'u', 0, 1, { fee: D(150), feeTk: 'TK02' }));
    expect(r.feeId).toBeGreaterThan(0);
    expect((await svc.getBalance('TK02')).toFixed(2)).toBe('-1050.00');
  });

  test('feeDaGhi: phí đã ghi từ trước ⇒ canTru bỏ phí, KHÔNG ghi phí lần 2, feeId = id cũ', async () => {
    await seedWallets();
    const cu = await seedTreasuryEntry({ tkCode: 'TK09', type: 'out', money: D('-20000'), status: 1, sourceModule: 'fx_fee', sourceId: 9 });
    // Số dư TK09 còn 499.980.000; out 499.980.000 + phí 20.000 sẽ thiếu nếu còn tính phí — nhưng phí đã ghi.
    const r = await inTx((tx) => svc.transfer(tx, 'TK09', 'TK01', D('499980000'), D('499980000'), D(1), '', 'u', 0, 1, {
      fee: D('20000'), feeTk: 'TK09', feeModule: 'fx_fee', feeSourceId: 9,
    }));
    expect(r.feeId).toBe(cu.id);
    expect(await prisma.treasuryEntry.count({ where: { sourceModule: 'fx_fee', sourceId: 9 } })).toBe(1);
  });
});

// ───────────────────────────── fxGhiSoPhieu() §5.1 ─────────────────────────────
/** Phiếu mẫu VND→USD 2 chặng, phí % ở ví đích — số dựng từ công thức §5.3, không phải phiếu prod. */
async function seedSlip2Chang(over: Partial<Prisma.FxTransferUncheckedCreateInput> = {}) {
  const amountOut = D('254000000');
  const rate = D('25400');
  const amountIn = amountInTuRate('VND', 'USD', amountOut, rate); // 10.000,00
  const fee = tinhPhiFxPercent(amountIn, D('0.1'), 'USD'); // 10,00 USD (fee_cur dst)
  const ag = fxKiemAgent({ tk: 'TK08', currency: 'USD', quyDoiSang: 'TK02' }, { tk: 'TK02', currency: 'CNY', isActive: true }, D('7.1'), amountIn);
  return seedFxTransfer({
    code: 'FX-2609-101', fromTk: 'TK01', toTk: 'TK08', fromCurrency: 'VND', toCurrency: 'USD',
    amountOut, amountIn, rate, fee, feeCurrency: 'USD', feePercent: D('0.1'),
    agentTk: 'TK02', agentRate: D('7.1'), agentAmount: ag.agentAmount!, status: 'pending', note: 'mẫu',
    ...over,
  });
}

describe('fxGhiSoPhieu() — §5.1 + §10.2', () => {
  test('phiếu 2 chặng, phí ở ví ĐÍCH: đúng 5 chân theo bảng §3.2; không đổi status phiếu', async () => {
    await seedWallets();
    const fx = await seedSlip2Chang();
    const r = await inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1', { cdate: 1790000500 }));
    expect([r.chang1, r.chang2, r.agentAmount!.toFixed(2)]).toEqual(['moi', 'moi', '71000.00']);
    expect(shape(await legs('fx_transfer', fx.id))).toEqual([
      ['TK01', 'tranfer', '-254000000.00000'],
      ['TK08', 'in', '10000.00000'],
    ]);
    expect(shape(await legs('fx_fee', fx.id))).toEqual([['TK08', 'out', '-10.00000']]); // viPhiFx ⇒ ví đích
    expect(shape(await legs('fx_quydoi', fx.id))).toEqual([
      ['TK08', 'tranfer', '-10000.00000'],
      ['TK02', 'in', '71000.00000'],
    ]);
    const all = await prisma.treasuryEntry.findMany({ where: { sourceModule: { in: FX_FAMILY } } });
    for (const x of all) expect([x.status, x.cuser, x.approveUser, x.cdate]).toEqual([1, 'nop1', 'nop1', 1790000500]);
    const q = await legs('fx_quydoi', fx.id);
    expect(q.map((x) => x.rate!.toFixed(6))).toEqual(['7.100000', '7.100000']); // chặng 2 rate = agent_rate
    const c1 = await legs('fx_transfer', fx.id);
    expect(c1.map((x) => x.rate!.toFixed(6))).toEqual(['25400.000000', '25400.000000']);
    expect((await prisma.fxTransfer.findUniqueOrThrow({ where: { id: fx.id } })).status).toBe('pending');
  });

  test('phí ở ví NGUỒN (fee_currency = from_currency) ⇒ phí ghi ở from_tk', async () => {
    await seedWallets();
    const fx = await seedFxTransfer({
      code: 'FX-2609-102', fromTk: 'TK09', toTk: 'TK01', fromCurrency: 'VND', toCurrency: 'VND',
      amountOut: D('3000000'), amountIn: D('3000000'), rate: D(1), fee: D('11000'), feeCurrency: 'VND', status: 'pending',
    });
    const r = await inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop2'));
    expect([r.chang1, r.chang2, r.agentAmount]).toEqual(['moi', 'khong', null]);
    expect(shape(await legs('fx_fee', fx.id))).toEqual([['TK09', 'out', '-11000.00000']]);
    expect(await prisma.treasuryEntry.count({ where: { sourceModule: 'fx_quydoi' } })).toBe(0);
  });

  test('gọi lại khi đã ghi ⇒ da_co/da_co, KHÔNG ghi thêm dòng nào', async () => {
    await seedWallets();
    const fx = await seedSlip2Chang();
    await inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1'));
    const n = await prisma.treasuryEntry.count();
    const r2 = await inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1'));
    expect([r2.chang1, r2.chang2]).toEqual(['da_co', 'da_co']);
    expect(r2.glTodo).toEqual([]);
    expect(await prisma.treasuryEntry.count()).toBe(n);
    expect(n).toBe(5);
  });

  test('agent_amount lệch > 0,005 ⇒ UPDATE về round(amount_in×agent_rate,2); lệch ≤ 0,005 ⇒ giữ nguyên', async () => {
    await seedWallets();
    const fx = await seedSlip2Chang({ agentAmount: D('70999.99') });
    await inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1'));
    expect((await prisma.fxTransfer.findUniqueOrThrow({ where: { id: fx.id } })).agentAmount.toFixed(5)).toBe('71000.00000');
    const fx2 = await seedSlip2Chang({ code: 'FX-2609-103', agentAmount: D('71000.004') });
    await inTx((tx) => svc.fxGhiSoPhieu(tx, fx2.id, 'nop1', { choAm: true }));
    expect((await prisma.fxTransfer.findUniqueOrThrow({ where: { id: fx2.id } })).agentAmount.toFixed(5)).toBe('71000.00400');
    // chân 2-đích luôn dùng agentAmt tính lại (71.000,00), không phải cột đã lưu
    expect(shape(await legs('fx_quydoi', fx2.id))[1]).toEqual(['TK02', 'in', '71000.00000']);
  });

  test('chặng 1 thiếu số dư nguồn ⇒ ném (không choAm); có choAm ⇒ ghi, ví nguồn âm', async () => {
    await seedWallets();
    const fx = await seedSlip2Chang({ amountOut: D('2000000000'), amountIn: D('78740.16'), agentAmount: D('559055.14') });
    await expect(inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1'))).rejects.toThrow('Số dư TK nguồn không đủ');
    expect(await prisma.treasuryEntry.count()).toBe(0);
    await inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1', { choAm: true }));
    expect((await svc.getBalance('TK01')).toFixed(2)).toBe('-1000000000.00');
  });

  test('chặng 2 luôn choAm: ví đích chặng 1 (nguồn chặng 2) không cần đủ tiền cho chặng 2', async () => {
    // Bẫy §12.5: chặng 2 LUÔN choAm, kể cả khi người gọi không truyền choAm. TK08 opening −20.000
    // ⇒ sau chặng 1 (+10.000, phí −10 không bị chặn vì ví đích đang âm) còn −10.010 < 10.000 cần trừ;
    // không có choAm thì chặng 2 sẽ ném "Số dư TK nguồn không đủ".
    await seedFundAccount('TK01', { currency: 'VND', openingBalance: D('1000000000') });
    await seedFundAccount('TK08', { currency: 'USD', openingBalance: D('-20000'), quyDoiSang: 'TK02' });
    await seedFundAccount('TK02', { currency: 'CNY' });
    const fx = await seedSlip2Chang();
    const r = await inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1'));
    expect(r.chang2).toBe('moi');
    expect((await svc.getBalance('TK08')).toFixed(2)).toBe('-20010.00');
  });

  test('chặng 2 LỖI ⇒ cả tx lùi, kể cả chặng 1 vừa ghi: 0 dòng, agent_amount không đổi', async () => {
    // ⚠ KHÁC PROD có chủ đích (Q-FX-3, plan): prod để lại chặng 1 rồi daoTheoNguon ra cặp đảo; v2 ném
    // ⇒ tx của người gọi lùi toàn bộ, không có dòng nào (kể cả dòng đảo). Gây lỗi chặng 2 bằng
    // agent_tk = to_tk (transfer from==to ⇒ ném).
    await seedWallets();
    const fx = await seedSlip2Chang({ agentTk: 'TK08', agentAmount: D('1') });
    await expect(inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1'))).rejects.toBeInstanceOf(TreasuryError);
    expect(await prisma.treasuryEntry.count()).toBe(0);
    const after = await prisma.fxTransfer.findUniqueOrThrow({ where: { id: fx.id } });
    expect([after.agentAmount.toFixed(5), after.status]).toEqual(['1.00000', 'pending']);
  });

  test('phiếu không tồn tại ⇒ ném TreasuryError', async () => {
    await expect(inTx((tx) => svc.fxGhiSoPhieu(tx, 999999, 'u'))).rejects.toBeInstanceOf(TreasuryError);
  });

  test('không đổi status phiếu ở mọi trạng thái đầu vào (pending/failed/approved)', async () => {
    await seedWallets();
    for (const [i, st] of ['pending', 'failed', 'approved'].entries()) {
      const fx = await seedSlip2Chang({ code: `FX-2609-2${i}0`, status: st });
      await inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1', { choAm: true }));
      expect((await prisma.fxTransfer.findUniqueOrThrow({ where: { id: fx.id } })).status).toBe(st);
    }
  });
});

// ───────────────────────────── đồng thời thật ─────────────────────────────
describe('hai fxGhiSoPhieu song song cùng fxId ⇒ đúng MỘT bộ chân', () => {
  test('2 giao dịch RIÊNG, mỗi cái giữ tx mở 300ms sau khi ghi ⇒ 2 fx_transfer + 1 fx_fee + 2 fx_quydoi', async () => {
    // Chứng minh FOR UPDATE + advisory lock ('treasury:fx_transfer', fxId) khép cửa sổ đua mà prod
    // để hở (prod không khoá: hai người duyệt cùng lúc ⇒ 2 bộ chân). pg_sleep giữ tx đầu mở để tx sau
    // chắc chắn tới bước kiểm hasPosted trước khi tx đầu commit (READ COMMITTED).
    await seedWallets();
    const fx = await seedSlip2Chang();
    const run = () =>
      prisma.$transaction(
        async (tx) => {
          const r = await svc.fxGhiSoPhieu(tx, fx.id, 'nop1', { choAm: true });
          await tx.$queryRawUnsafe(`SELECT pg_sleep(0.3)::text`);
          return r;
        },
        { timeout: 20000, maxWait: 20000 },
      );
    const rs = await Promise.all([run(), run()]);
    const byModule = await prisma.treasuryEntry.groupBy({ by: ['sourceModule'], where: { sourceId: fx.id }, _count: { _all: true }, orderBy: { sourceModule: 'asc' } });
    expect(byModule.map((g) => `${g.sourceModule}:${g._count._all}`)).toEqual(['fx_fee:1', 'fx_quydoi:2', 'fx_transfer:2']);
    expect(await prisma.treasuryEntry.count()).toBe(5);
    expect(rs.map((r) => r.chang1).sort()).toEqual(['da_co', 'moi']);
    expect(rs.map((r) => r.chang2).sort()).toEqual(['da_co', 'moi']);
    expect(await prisma.treasuryEntry.count({ where: { sourceModule: 'fx_transfer', sourceId: fx.id } })).toBe(2);
    expect(await prisma.treasuryEntry.count({ where: { sourceModule: 'fx_fee', sourceId: fx.id } })).toBe(1);
    expect(await prisma.treasuryEntry.count({ where: { sourceModule: 'fx_quydoi', sourceId: fx.id } })).toBe(2);
  });
});

// ───────────────────────────── F2 thu nhỏ ─────────────────────────────
describe('F2 thu nhỏ — Σ sổ quỹ họ FX theo TỪNG ví = dựng lại từ phiếu', () => {
  test('4 phiếu mẫu (1 chặng/2 chặng, phí nguồn/đích/0, VND↔USD, VND↔VND) ⇒ lệch 0 ở mọi ví', async () => {
    // Phép nghiệm thu F2 (§8) chạy trên dữ liệu MẪU dựng từ công thức §5.3 — bản vàng 9/9 ví thật
    // nằm ở cổng diễn tập dump. Dựng lại: −out ở from, +in ở to, −fee ở viPhiFx(fx),
    // và nếu có agent: −in ở to, +agent_amount (sau ghi sổ) ở agent_tk.
    await seedWallets();
    const specs: Partial<Prisma.FxTransferUncheckedCreateInput>[] = [];
    // S1 VND→VND cùng tệ, không phí
    specs.push({ code: 'FX-2609-301', fromTk: 'TK01', toTk: 'TK09', fromCurrency: 'VND', toCurrency: 'VND',
      amountOut: D('50000000'), amountIn: amountInTuRate('VND', 'VND', D('50000000'), D(1)), rate: D(1), fee: D(0), feeCurrency: 'VND' });
    // S2 VND→USD 2 chặng, phí % ở ví đích
    {
      const out = D('254000000'); const rate = D('25400');
      const inn = amountInTuRate('VND', 'USD', out, rate);
      specs.push({ code: 'FX-2609-302', fromTk: 'TK01', toTk: 'TK08', fromCurrency: 'VND', toCurrency: 'USD',
        amountOut: out, amountIn: inn, rate, fee: tinhPhiFxPercent(inn, D('0.1'), 'USD'), feeCurrency: 'USD',
        agentTk: 'TK02', agentRate: D('7.1'), agentAmount: D(0) });
    }
    // S3 VND→USD 2 chặng, phí VND ở ví nguồn, amount_in có làm tròn nửa (÷ rate)
    {
      const out = D('100000000'); const rate = D('25350');
      const inn = amountInTuRate('VND', 'USD', out, rate); // 3.944,77
      const ag = fxKiemAgent({ tk: 'TK08', currency: 'USD', quyDoiSang: 'TK02' }, { tk: 'TK02', currency: 'CNY', isActive: true }, D('7.123456'), inn);
      specs.push({ code: 'FX-2609-303', fromTk: 'TK09', toTk: 'TK08', fromCurrency: 'VND', toCurrency: 'USD',
        amountOut: out, amountIn: inn, rate, fee: D('20000'), feeCurrency: 'VND',
        agentTk: 'TK02', agentRate: D('7.123456'), agentAmount: ag.agentAmount! });
    }
    // S4 USD→VND, phí USD ở ví nguồn
    {
      const out = D('500'); const rate = D('25410');
      specs.push({ code: 'FX-2609-304', fromTk: 'TK08', toTk: 'TK01', fromCurrency: 'USD', toCurrency: 'VND',
        amountOut: out, amountIn: amountInTuRate('USD', 'VND', out, rate), rate, fee: tinhPhiFxPercent(out, D('1'), 'USD'), feeCurrency: 'USD' });
    }
    expect(specs[2].amountIn!.toString()).toBe('3944.77');
    expect(specs[3].amountIn!.toString()).toBe('12705000');
    const ids: number[] = [];
    for (const s of specs) {
      const fx = await seedFxTransfer({ status: 'pending', ...s });
      await inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1'));
      ids.push(fx.id);
    }

    const want = new Map<string, Prisma.Decimal>();
    const add = (tk: string, v: Prisma.Decimal) => want.set(tk, (want.get(tk) ?? D(0)).plus(v));
    for (const fx of await prisma.fxTransfer.findMany({ where: { id: { in: ids } } })) {
      add(fx.fromTk, fx.amountOut.neg());
      add(fx.toTk, fx.amountIn);
      if (fx.fee.gt(0)) add(viPhiFx({ fromTk: fx.fromTk, toTk: fx.toTk, fromCurrency: fx.fromCurrency, toCurrency: fx.toCurrency, feeCurrency: fx.feeCurrency ?? '' }).feeTk, fx.fee.neg());
      if (fx.agentTk !== '' && fx.agentRate.gt(0)) {
        add(fx.toTk, fx.amountIn.neg());
        add(fx.agentTk, fx.agentAmount);
      }
    }
    const got = await prisma.treasuryEntry.groupBy({ by: ['tkCode'], where: { status: 1, sourceModule: { in: FX_FAMILY } }, _sum: { money: true } });
    const gotMap = new Map(got.map((g) => [g.tkCode!, D(g._sum.money!.toString())]));
    expect([...gotMap.keys()].sort()).toEqual([...want.keys()].sort());
    for (const [tk, v] of want) expect(`${tk} ${gotMap.get(tk)!.minus(v).toFixed(5)}`).toBe(`${tk} 0.00000`);
    // F1: đếm dòng theo phiếu
    expect(await prisma.treasuryEntry.count({ where: { sourceModule: 'fx_transfer' } })).toBe(8);
    expect(await prisma.treasuryEntry.count({ where: { sourceModule: 'fx_fee' } })).toBe(3);
    expect(await prisma.treasuryEntry.count({ where: { sourceModule: 'fx_quydoi' } })).toBe(4);
  });
});

// ───────────────────────────── Fix round 1 — chuỗi NGUYÊN VĂN prod ─────────────────────────────
// Coordinator đọc prod HEAD (`libs/fx_ghiso.php`, `cls.treasury.php:1039-1145`, `gffunc.php:745`).
// Ghi chú nằm trong sổ quỹ và sẽ bị so khi migration ⇒ assert TỪNG chuỗi chính xác.
const errOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return [(e as Error).name, (e as Error).message];
  }
  return ['không ném', ''];
};

describe('Fix round 1 — thông điệp lỗi transfer()/fxGhiSoPhieu() nguyên văn prod', () => {
  test('from==to ⇒ "TK nguồn và đích trùng nhau"; ≤0 ⇒ "Số tiền không hợp lệ"', async () => {
    await seedWallets();
    expect(await errOf(inTx((tx) => svc.transfer(tx, 'TK01', 'TK01', D(1), D(1), D(1), '', 'u', 0, 1)))).toEqual(['TreasuryError', 'TK nguồn và đích trùng nhau']);
    expect(await errOf(inTx((tx) => svc.transfer(tx, 'TK01', 'TK09', D(0), D(1), D(1), '', 'u', 0, 1)))).toEqual(['TreasuryError', 'Số tiền không hợp lệ']);
    expect(await errOf(inTx((tx) => svc.transfer(tx, 'TK01', 'TK09', D(1), D(0), D(1), '', 'u', 0, 1)))).toEqual(['TreasuryError', 'Số tiền không hợp lệ']);
  });

  test('số dư nguồn KHÔNG phí ⇒ không có đuôi; tbs_money 0 lẻ, chấm nghìn, nửa xa 0 kể cả số âm', async () => {
    await seedWallets();
    expect(await errOf(inTx((tx) => svc.transfer(tx, 'TK02', 'TK08', D(710), D(100), D('7.1'), '', 'u', 0, 1)))).toEqual(['TreasuryError', 'Số dư TK nguồn không đủ (0)']);
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-1234.5'), status: 1 });
    expect(await errOf(inTx((tx) => svc.transfer(tx, 'TK02', 'TK08', D(1), D(1), D('7.1'), '', 'u', 0, 1)))).toEqual(['TreasuryError', 'Số dư TK nguồn không đủ (-1.235)']);
  });

  test('số dư nguồn âm dưới 0,5 ⇒ "(0)" không phải "(-0)" (PHP 8 number_format không trả -0)', async () => {
    await seedWallets();
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-0.4'), status: 1 });
    expect(await errOf(inTx((tx) => svc.transfer(tx, 'TK02', 'TK08', D(1), D(1), D('7.1'), '', 'u', 0, 1)))).toEqual(['TreasuryError', 'Số dư TK nguồn không đủ (0)']);
  });

  test('số dư nguồn CÓ phí chưa ghi ⇒ đuôi " — cần <canTru> gồm cả phí chuyển <fee>"', async () => {
    await seedWallets();
    expect(await errOf(inTx((tx) => svc.transfer(tx, 'TK09', 'TK01', D('499990000'), D('499990000'), D(1), '', 'u', 0, 1, {
      fee: D('20000'), feeTk: 'TK09', feeModule: 'fx_fee', feeSourceId: 5,
    })))).toEqual(['TreasuryError', 'Số dư TK nguồn không đủ (500.000.000) — cần 500.010.000 gồm cả phí chuyển 20.000']);
    // Phí ở ví ĐÍCH: đuôi vẫn in (điều kiện prod là fee>0 && !feeDaGhi), canTru KHÔNG gồm phí.
    expect(await errOf(inTx((tx) => svc.transfer(tx, 'TK02', 'TK08', D(710), D(100), D('7.1'), '', 'u', 0, 1, { fee: D(5), feeTk: 'TK08' }))))
      .toEqual(['TreasuryError', 'Số dư TK nguồn không đủ (0) — cần 710 gồm cả phí chuyển 5']);
  });

  test('phí đã ghi (feeDaGhi) ⇒ KHÔNG có đuôi phí', async () => {
    await seedWallets();
    await seedTreasuryEntry({ tkCode: 'TK09', type: 'out', money: D('-20000'), status: 1, sourceModule: 'fx_fee', sourceId: 9 });
    expect(await errOf(inTx((tx) => svc.transfer(tx, 'TK09', 'TK01', D('499990000'), D('499990000'), D(1), '', 'u', 0, 1, {
      fee: D('20000'), feeTk: 'TK09', feeModule: 'fx_fee', feeSourceId: 9,
    })))).toEqual(['TreasuryError', 'Số dư TK nguồn không đủ (499.980.000)']);
  });

  test('phí ở ví đích làm ví âm ⇒ "Phí 150,00 sẽ làm ví đích âm (hiện có 100,00) — đã huỷ cả phiếu"', async () => {
    await seedWallets();
    expect(await errOf(inTx((tx) => svc.transfer(tx, 'TK08', 'TK02', D(10), D(100), D('10'), '', 'u', 0, 1, { fee: D(150), feeTk: 'TK02', choAm: true }))))
      .toEqual(['TreasuryError', 'Phí 150,00 sẽ làm ví đích âm (hiện có 100,00) — đã huỷ cả phiếu']);
  });

  test('fxGhiSoPhieu: không thấy phiếu ⇒ "Không tìm thấy phiếu FX #<id>"; số dư chặng 1 ⇒ thông điệp transfer có đuôi phí', async () => {
    expect(await errOf(inTx((tx) => svc.fxGhiSoPhieu(tx, 999999, 'u')))).toEqual(['TreasuryError', 'Không tìm thấy phiếu FX #999999']);
    await seedWallets();
    const fx = await seedSlip2Chang({ amountOut: D('2000000000'), amountIn: D('78740.16'), agentAmount: D('559055.14') });
    expect(await errOf(inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1'))))
      .toEqual(['TreasuryError', 'Số dư TK nguồn không đủ (1.000.000.000) — cần 2.000.000.000 gồm cả phí chuyển 10']);
  });

  test('fxGhiSoPhieu: chặng 1 lỗi KHÔNG phải TreasuryError ⇒ "Không ghi được chặng chuyển" (giữ cause), 0 dòng', async () => {
    await seedWallets();
    const fx = await seedSlip2Chang();
    const s2 = new TreasuryService(prisma as any);
    const boom = new Error('');
    jest.spyOn(s2, 'transfer').mockRejectedValueOnce(boom);
    let caught: any;
    try {
      await inTx((tx) => s2.fxGhiSoPhieu(tx, fx.id, 'nop1'));
    } catch (e) {
      caught = e;
    }
    expect([caught?.name, caught?.message, caught?.cause]).toEqual(['TreasuryError', 'Không ghi được chặng chuyển', boom]);
    expect(await prisma.treasuryEntry.count()).toBe(0);
  });
});

describe('Fix round 1 — ghi chú chân sổ nguyên văn prod', () => {
  const notes = async (m: string, id: number) => (await legs(m, id)).map((x) => x.note);

  test('có note + fee_currency: chặng 1 "FX #code — note", phí "Phí chuyển FX #code (USD)", chặng 2 "FX #code — quy đổi tại agent"', async () => {
    await seedWallets();
    const fx = await seedSlip2Chang();
    await inTx((tx) => svc.fxGhiSoPhieu(tx, fx.id, 'nop1'));
    expect(await notes('fx_transfer', fx.id)).toEqual(['FX #FX-2609-101 — mẫu', 'FX #FX-2609-101 — mẫu']);
    expect(await notes('fx_fee', fx.id)).toEqual(['Phí chuyển FX #FX-2609-101 (USD)']);
    expect(await notes('fx_quydoi', fx.id)).toEqual(['FX #FX-2609-101 — quy đổi tại agent', 'FX #FX-2609-101 — quy đổi tại agent']);
  });

  test('note rỗng / NULL / "0" (PHP falsy) ⇒ "FX #code" không có " — "; fee_currency rỗng ⇒ "Phí chuyển FX #code"', async () => {
    await seedWallets();
    const base = { fromTk: 'TK09', toTk: 'TK01', fromCurrency: 'VND', toCurrency: 'VND', amountOut: D(1000), amountIn: D(1000), rate: D(1), fee: D(10), status: 'pending' };
    const a = await seedFxTransfer({ ...base, code: 'FX-2609-401', note: '', feeCurrency: '' });
    const b = await seedFxTransfer({ ...base, code: 'FX-2609-402', note: null, feeCurrency: 'VND' });
    const c = await seedFxTransfer({ ...base, code: 'FX-2609-403', note: '0', feeCurrency: 'VND' });
    for (const f of [a, b, c]) await inTx((tx) => svc.fxGhiSoPhieu(tx, f.id, 'nop1'));
    expect(await notes('fx_transfer', a.id)).toEqual(['FX #FX-2609-401', 'FX #FX-2609-401']);
    expect(await notes('fx_fee', a.id)).toEqual(['Phí chuyển FX #FX-2609-401']);
    expect(await notes('fx_transfer', b.id)).toEqual(['FX #FX-2609-402', 'FX #FX-2609-402']);
    expect(await notes('fx_fee', b.id)).toEqual(['Phí chuyển FX #FX-2609-402 (VND)']);
    expect(await notes('fx_transfer', c.id)).toEqual(['FX #FX-2609-403', 'FX #FX-2609-403']);
  });
});
