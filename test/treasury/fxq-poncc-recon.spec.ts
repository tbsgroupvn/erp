// #09d L11, Task 3 — Quỹ ngoại tệ FIFO (R8d), tiền NCC của PO (R8c), đối soát bank (R10a/b).
// Đặc tả: docs/rewrite-spec/09d-so-quy-doc-bao-cao.md §5.2, §5.3, §7.1, §7.2, §9, §13 (Q-DOC-7, Q-DOC-12).
// Nguồn nguyên văn: prod @1894f76 `libs/fx_quyte.php`, `libs/po_tien_ncc.php`, `libs/bank_recon.php`,
// `ajaxs/bank/recon_list.php`, `ajaxs/account/fx_unaccounted.php` (bản chép ở .superpowers/sdd/…/prod-src/).
//
// ⛔ Dữ liệu TỰ DỰNG. Số vàng (e)(f)(g) của §9 (4.178.685,52 ¥; 3 kỳ FIFO; 53/125/9 …) chạy ở cổng diễn
// tập trên bản dump (L0) — KHÔNG chép dòng tiền prod vào repo.
import { ForbiddenException, INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Scope } from '@prisma/client';
import { createApp } from '../../src/main';
import { PermService } from '../../src/iam/perm.service';
import { vnEpoch } from '../../src/treasury/report-rules';
import { TreasuryReportService } from '../../src/treasury/treasury-report.service';
import { FxqInput, fxqDai, fxqTieu, fxqTinh, FxqLot } from '../../src/money/fx-quyte';
import {
  bankReconBoDau,
  bankReconCompat,
  bankReconDebitCat,
  bankReconMatch,
  bankReconSubsetSum,
  ReconLink,
  vnMidnight,
} from '../../src/bank/bank-recon.rules';
import { poTienNccTinh, ptnViCurrency, LY_DO_CHUA_GHI, LY_DO_KHONG_TIEN } from '../../src/po/po-tien-ncc.rules';
import { PoTienNccService } from '../../src/po/po-tien-ncc.service';
import { BankReconService } from '../../src/bank/bank-recon.service';
import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { resetTreasury, seedFundAccount, seedTreasuryEntry } from '../helpers/treasury-db';
import { resetFxBank, seedBankTransaction, seedBankReconcileLink, seedFxTransfer } from '../helpers/fx-bank-db';
import { resetSupplierPayment, seedSupplierPayment } from '../helpers/supplier-payment-db';
import { resetPo, seedPo, seedOrder } from '../helpers/po-db';
import { resetApproval, seedTemplate } from '../helpers/approval-db';

const D = (v: string | number) => new Prisma.Decimal(v);
const S = (d: Prisma.Decimal | null) => (d === null ? null : d.toFixed());
const at = (ymd: string, hms = '10:00:00') => vnEpoch(ymd, hms)!;
const DAY = 86400;

// ═════════════════════════════════════════════════════════════════════════════
// R8d — fxq* (HÀM THUẦN)
// ═════════════════════════════════════════════════════════════════════════════
const emptyIn = (o: Partial<FxqInput> = {}): FxqInput => ({
  from: 0, to: 10_000, usdLots: [], quydoi: [], cnyLots: [], cnyMoDau: 0, cnyVaoKhac: [], cnyRa: [], usdThang: [],
  usdKhac: 0, soDuCny: 0, soDuUsd: 0, ...o,
});

describe('fxqDai — dải tỷ giá (biên đóng hai đầu)', () => {
  it.each([
    ['3000', 'cny'], ['6000', 'cny'], ['2999.99', ''], ['6000.01', ''],
    ['20000', 'usd'], ['30000', 'usd'], ['19999.9', ''], ['30000.1', ''],
    [null, ''], ['', ''], ['abc', ''],
  ])('%s ⇒ %j', (r, want) => expect(fxqDai(r as any)).toBe(want));
});

describe('fxqTieu — FIFO tại chỗ', () => {
  it('tiêu qua nhiều lô khác giá; lô không rõ bật cờ và KHÔNG đổi tỷ giá lô cuối; lô còn ≤ 0,0001 bị bỏ', () => {
    const lots: FxqLot[] = [
      { qty: D(10), rate: D(3500) },
      { qty: D(5), rate: null },
      { qty: D('20.00005'), rate: D(3600) },
      { qty: D(7), rate: D(3700) },
    ];
    const [cost, khongRo, last] = fxqTieu(lots, D(35));
    // 10×3500 + 5×(không rõ) + 20×3600 = 35.000 + 72.000
    expect(S(cost)).toBe('107000');
    expect(khongRo).toBe(true);
    expect(S(last)).toBe('3600');
    // lô 3 còn 0,00005 ≤ 0,0001 ⇒ bị shift; lô 4 còn nguyên
    expect(lots.map((l) => [S(l.qty), S(l.rate)])).toEqual([['7', '3700']]);
  });
  it('cần ≤ 0,0001 ⇒ không tiêu gì', () => {
    const lots: FxqLot[] = [{ qty: D(1), rate: D(1) }];
    expect(fxqTieu(lots, D('0.0001')).map((x: any) => (typeof x === 'boolean' ? x : S(x)))).toEqual(['0', false, null]);
    expect(S(lots[0].qty)).toBe('1');
  });
});

describe('fxqTinh — hàng đợi USD (quy đổi agent)', () => {
  const inp = emptyIn({
    from: 300, to: 700,
    usdLots: [
      { ts: 200, qty: D(100), rate: D(26000) }, // nạp NGƯỢC thứ tự thời gian — fxqTinh tự sắp
      { ts: 100, qty: D(100), rate: D(25000) },
      { ts: 600, qty: D(20), rate: D(27000) },
    ],
    quydoi: [
      { ts: 300, fxId: 1, code: 'FX-1', usd: D(150), cny: D(1000), agentRate: D('6.6') }, // span 2 lô
      { ts: 400, fxId: 2, code: 'FX-2', usd: D('50.5'), cny: D(325) }, // thiếu 0,5 ≤ 1 ⇒ bù bằng tỷ giá lô cuối
      { ts: 500, fxId: 3, code: 'FX-3', usd: D(10), cny: D(70) }, // thiếu 10 > 1 ⇒ không giá vốn, KHÔNG tiêu
      { ts: 700, fxId: 4, code: 'FX-4', usd: D(5), cny: D(35) }, // ts = to ⇒ ngoài kỳ
    ],
    usdKhac: D(3),
    soDuUsd: D('7.5'),
  });
  const r = fxqTinh(inp);

  it('giá vốn FIFO từng lần quy đổi — đúng từng chặng', () => {
    const all = [...r.usd.rows];
    expect(all.map((x) => [x.fxId, S(x.costVnd), S(x.vndCny), S(x.thieuUsd), x.coGiaVon])).toEqual([
      [1, '3800000', '3800', '0', true], // 100×25.000 + 50×26.000
      [2, '1313000', '4040', '0.5', true], // 50×26.000 + 0,5×26.000
      [3, null, null, '10', false],
    ]);
    expect(S(r.usd.rows[0].vndUsd)).toBe('25333.333333333333333');
  });
  it('kỳ [from, to): ts = to bị loại khỏi rows nhưng FIFO vẫn chạy; cảnh báo lấy CẢ lịch sử', () => {
    expect(r.usd.rows.map((x) => x.ts)).toEqual([300, 400, 500]);
    expect(S(r.usd.kyUsd)).toBe('210.5');
    expect(S(r.usd.kyCny)).toBe('1395');
    expect(S(r.usd.kyVon)).toBe('5113000');
    expect(r.usd.canhBao.map((x) => x.fxId)).toEqual([3]);
  });
  it('thiếu > 1 USD không tiêu lô: FX-4 (sau lô 3) lấy 5 USD từ lô 27.000 (lô cũ đã cạn ở FX-2)', () => {
    const r2 = fxqTinh({ ...inp, to: 10_000 });
    const fx4 = r2.usd.rows.find((x) => x.fxId === 4)!;
    expect(S(fx4.costVnd)).toBe('135000');
  });
  it('thiếu > 1 USD khi CÒN lô: lô giữ nguyên cho lần sau (không tiêu một phần)', () => {
    const r3 = fxqTinh(emptyIn({
      usdLots: [{ ts: 1, qty: D(3), rate: D(25000) }],
      quydoi: [{ ts: 2, fxId: 7, usd: D(10), cny: D(70) }, { ts: 3, fxId: 8, usd: D(3), cny: D(21) }],
    }));
    expect(r3.usd.rows.map((x) => [x.fxId, S(x.costVnd)])).toEqual([[7, null], [8, '75000']]);
  });
  it('tồn = mua − đã quy đổi + khác; lệch = tồn − số dư', () => {
    expect(S(r.usd.muaVao)).toBe('220');
    expect(S(r.usd.daQuyDoi)).toBe('215.5');
    expect(S(r.usd.ton)).toBe('7.5');
    expect(S(r.usd.lech)).toBe('0');
  });
  it('lô tệ sinh từ quy đổi mang giá vốn/¥ (hoặc null khi không có giá vốn) sang hàng đợi tệ', () => {
    const r4 = fxqTinh({ ...inp, to: 10_000, cnyRa: [
      { ts: 450, qty: D(1100), ok: true, rateSell: D(4100), codeOrder: 'DH1' }, // 1000×3800 + 100×4040
      { ts: 550, qty: D(250), ok: true, rateSell: D(4100), codeOrder: 'DH2' }, // 225×4040 + 25×(lô FX-3 không rõ)
    ] });
    expect(r4.cny.rows.map((x) => [x.codeOrder, S(x.giaVon)])).toEqual([['DH1', '4204000']]);
    expect(r4.cny.khongRo.map((x) => x.codeOrder)).toEqual(['DH2']);
  });
});

describe('fxqTinh — hàng đợi tệ (FIFO, lô về sau TRẢ NỢ trước, kỳ hiển thị)', () => {
  const base = emptyIn({
    from: 300, to: 701,
    cnyLots: [
      { ts: 100, qty: D(1000), rate: D(3500) },
      { ts: 200, qty: D(500), rate: D(3600) },
      { ts: 500, qty: D(100), rate: D(3800) },
      { ts: 600, qty: D(200), rate: D(3900) },
    ],
    cnyRa: [
      { ts: 300, qty: D(1250), ok: true, rateSell: D(3700), codeOrder: 'R1', pid: 11 }, // span lô 1+2
      { ts: 400, qty: D(400), ok: true, rateSell: D(3700), codeOrder: 'R2', pid: 12 }, // vượt lô còn ⇒ nợ, trả bằng lô 500 + 600
      { ts: 700, qty: D(1000), ok: true, rateSell: D(3700), codeOrder: 'R3', pid: 13 }, // vượt, không lô nào về sau
    ],
    soDuCny: D(-850),
  });

  it('chi span nhiều lô + chi vượt lô còn được lô về SAU trả (vay=true) — giá vốn đúng từng lô', () => {
    const r = fxqTinh(base);
    expect(r.cny.rows.map((x) => [x.codeOrder, S(x.qty), S(x.giaVon), S(x.rateMua), S(x.baoKhach), S(x.lai), x.vay])).toEqual([
      ['R1', '1250', '4400000', '3520', '4625000', '225000', false], // 1000×3500 + 250×3600
      ['R2', '400', '1475000', '3687.5', '1480000', '5000', true], // 250×3600 + 100×3800 + 50×3900
    ]);
    expect(S(r.cny.tongLai)).toBe('230000');
  });
  it('chi vượt lô còn mà KHÔNG có lô nào về sau bù đủ ⇒ `khongDu` (cả dòng, chép prod) — không tính lãi', () => {
    const r = fxqTinh(base);
    expect(r.cny.khongDu.map((x) => x.codeOrder)).toEqual(['R3']);
    expect(S(r.cny.tongQty)).toBe('1650');
    // tồn tệ = Σ lô − Σ chi (âm thật) ; lệch với số dư
    expect(S(r.cny.ton)).toBe('-850');
    expect(S(r.cny.lech)).toBe('0');
  });
  it('biên kỳ: ts = from tính, ts = to KHÔNG tính; FIFO vẫn chạy trên dòng ngoài kỳ', () => {
    const r = fxqTinh({ ...base, from: 301, to: 700 });
    expect(r.cny.rows.map((x) => x.codeOrder)).toEqual(['R2']); // R1 (300) < from; R3 (700) = to
    expect(S(r.cny.rows[0].giaVon)).toBe('1475000'); // vẫn dựa trên FIFO sau R1
    expect(r.cny.khongDu).toEqual([]);
  });
  it('chỉ hiện dòng `ok` và rate_sell trong dải CNY; dòng ẩn VẪN tiêu FIFO', () => {
    const r = fxqTinh(emptyIn({
      cnyLots: [{ ts: 1, qty: D(100), rate: D(3500) }, { ts: 1, qty: D(100), rate: D(3600) }],
      cnyRa: [
        { ts: 2, qty: D(100), ok: false, rateSell: D(3700), codeOrder: 'CHUA_DUYET' },
        { ts: 3, qty: D(10), ok: true, rateSell: D(25000), codeOrder: 'DAI_USD' },
        { ts: 4, qty: D(10), ok: true, rateSell: null, codeOrder: 'KHONG_DON' },
        { ts: 5, qty: D(10), ok: true, rateSell: D(3700), codeOrder: 'HIEN' },
      ],
    }));
    expect(r.cny.rows.map((x) => [x.codeOrder, S(x.giaVon)])).toEqual([['HIEN', '36000']]);
  });
  it('tồn đầu kỳ và tệ vào ngoài phiếu FX là lô KHÔNG rõ ⇒ `khongRo`; nợ trả bằng lô không rõ cũng ⇒ `khongRo`', () => {
    const r = fxqTinh(emptyIn({
      cnyMoDau: D(50),
      cnyLots: [{ ts: 10, qty: D(100), rate: D(3500) }],
      cnyVaoKhac: [{ ts: 30, qty: D(40) }],
      cnyRa: [
        { ts: 5, qty: D(60), ok: true, rateSell: D(3700), codeOrder: 'A' }, // 50 mở đầu + nợ 10 ⇒ lô 10 trả
        { ts: 20, qty: D(120), ok: true, rateSell: D(3700), codeOrder: 'B' }, // 90 lô 3500 + nợ 30 ⇒ lô vào-khác trả
        { ts: 40, qty: D(10), ok: true, rateSell: D(3700), codeOrder: 'C' }, // lô vào-khác còn 10
      ],
    }));
    expect(r.cny.khongRo.map((x) => x.codeOrder)).toEqual(['A', 'B', 'C']);
    expect(r.cny.rows).toEqual([]);
    expect(S(r.cny.ton)).toBe('0');
  });
  it('tồn mở đầu ÂM vẫn cộng vào tồn (nhưng không thành lô)', () => {
    const r = fxqTinh(emptyIn({ cnyMoDau: D(-5), cnyRa: [{ ts: 1, qty: D(1), ok: true, rateSell: D(3700) }] }));
    expect(S(r.cny.ton)).toBe('-6');
    expect(r.cny.khongDu.length).toBe(1);
  });
});

describe('fxqTinh — NCC nhận thẳng USD + phí NH', () => {
  it('rate_buy trong dải USD ⇒ lãi = báo khách − giá vốn; rate_buy ≤ 1 là phí (VND) trừ vào lãi; rate_sell dải CNY ⇒ lệch đơn vị', () => {
    const r = fxqTinh(emptyIn({ usdThang: [
      { ts: 1, qty: D(100), rateBuy: D(25000), rateSell: D(25500), codeOrder: 'U1' },
      { ts: 2, qty: D(20000), rateBuy: D(1), rateSell: D(25500), codeOrder: 'PHI' },
      { ts: 3, qty: D(10), rateBuy: D(25000), rateSell: D(3600), codeOrder: 'LECH' },
      { ts: 4, qty: D(99), rateBuy: D(1), rateSell: D(3600), codeOrder: 'PHI_LECH' }, // phí nhưng đơn dải CNY ⇒ lệch đơn vị
      { ts: 5, qty: D(10), rateBuy: D(3500), rateSell: D(25500), codeOrder: 'BO_RB_CNY' },
      { ts: 6, qty: D(10), rateBuy: D(25000), rateSell: null, codeOrder: 'BO_KHONG_DON' },
    ] }));
    expect(r.usdThang.rows.map((x) => [x.codeOrder, S(x.baoKhach), S(x.giaVon), S(x.lai)])).toEqual([['U1', '2550000', '2500000', '50000']]);
    expect(r.usdThang.phi.map((x) => x.codeOrder)).toEqual(['PHI']);
    expect(r.usdThang.lechDonVi.map((x) => x.codeOrder)).toEqual(['LECH', 'PHI_LECH']);
    expect(S(r.usdThang.tongPhi)).toBe('20000');
    expect(S(r.usdThang.tongLai)).toBe('30000');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R10 — bankRecon* (HÀM THUẦN)
// ═════════════════════════════════════════════════════════════════════════════
describe('bankReconDebitCat / compat', () => {
  it.each([
    ['RUT QUY TIEN MAT', 'cash'],
    ['rut quy tien mat ve quy', 'cash'],
    ['CHUYEN NOI BO TK08', 'transfer'],
    ['Chuyển tiền NỘI BỘ', 'transfer'],
    ['Luân chuyển vốn', 'transfer'],
    ['TT tien hang NCC', 'other'],
    [null, 'other'],
  ])('%j ⇒ %s', (c, want) => expect(bankReconDebitCat(c as any)).toBe(want));

  it('GHIM lỗi lệch mảng của prod: "quỹ tiền mặt" CÓ DẤU ⇒ "qud tien mat" ⇒ KHÔNG phải cash', () => {
    expect(bankReconBoDau('Rút quỹ tiền mặt')).toBe('rut qud tien mat'); // 'ỹ' → 'd' do lệch mảng
    expect(bankReconDebitCat('Rút quỹ tiền mặt')).toBe('other');
    expect(bankReconBoDau('ẵõẽũĩỹđ')).toBe('oeuiyd');
  });

  it('compat: cash không khớp gì; fx_transfer chỉ nhận transfer; thu_chi_tbs chỉ nhận other; module lạ nhận mọi thứ trừ transfer', () => {
    const t = (c: any, m: string) => bankReconCompat(c, m);
    expect([t('cash', 'fx_transfer'), t('cash', 'thu_chi_tbs'), t('cash', 'payment')]).toEqual([false, false, false]);
    expect([t('transfer', 'fx_transfer'), t('other', 'fx_transfer')]).toEqual([true, false]);
    expect([t('other', 'thu_chi_tbs'), t('transfer', 'thu_chi_tbs')]).toEqual([true, false]);
    expect([t('other', 'payment'), t('transfer', 'payment'), t('other', '')]).toEqual([true, false, true]);
  });
});

describe('bankReconSubsetSum — biên và tie-break của prod (mask nhỏ nhất)', () => {
  const it_ = (id: number, a: string) => ({ id, amount: D(a) });
  it('nhiều tổ hợp cùng khớp ⇒ lấy mask NHỎ nhất: {0,1} (mask 3) thắng {2} (mask 4)', () => {
    const g = bankReconSubsetSum([it_(1, '100'), it_(2, '200'), it_(3, '300')], D(300));
    expect(g!.map((x) => x.id)).toEqual([1, 2]);
  });
  it('{1} (mask 2) thắng {0,…} lớn hơn; phần tử giữ thứ tự chỉ số', () => {
    expect(bankReconSubsetSum([it_(1, '5'), it_(2, '7')], D(7))!.map((x) => x.id)).toEqual([2]);
    expect(bankReconSubsetSum([it_(1, '100'), it_(2, '200'), it_(3, '300')], D(500))!.map((x) => x.id)).toEqual([2, 3]);
  });
  it('dung sai NGHIÊM < 0,001: lệch 0,0009 nhận, lệch đúng 0,001 loại', () => {
    expect(bankReconSubsetSum([it_(1, '1'), it_(2, '1.0009')], D('2'))).not.toBeNull();
    expect(bankReconSubsetSum([it_(1, '1'), it_(2, '1.001')], D('3.002'))).toBeNull();
    expect(bankReconSubsetSum([it_(1, '1'), it_(2, '2')], D('2.999'))).toBeNull();
  });
  it('12 phần tử — chỉ mask cuối (4095) khớp ⇒ trả đủ 12; rỗng ⇒ null', () => {
    const items = Array.from({ length: 12 }, (_, i) => it_(i + 1, '1'));
    expect(bankReconSubsetSum(items, D(12))!.length).toBe(12);
    expect(bankReconSubsetSum([], D(0))).toBeNull();
    expect(bankReconSubsetSum(items, D(13))).toBeNull();
  });
});

describe('bankReconMatch — luật prod', () => {
  const d0 = at('2026-09-10', '00:00:00');
  const deb = (id: number, a: string, day = 0, content = 'TT NCC') => ({ id, amount: D(a), date: d0 + day * DAY, content });
  const doc = (module: string, id: number, a: string, day = 0) => ({ module, id, amount: D(a), date: d0 + day * DAY });

  it('1-1: gần ngày nhất; hoà ⇒ chứng từ ĐẦU; cửa sổ ≤ 3 ngày (đúng 3 nhận, 4 loại); tiền ±0,001 (đúng 0,001 nhận)', () => {
    const r = bankReconMatch(
      [deb(1, '100'), deb(2, '200'), deb(3, '300'), deb(4, '400')],
      [
        doc('thu_chi_tbs', 11, '100', -2), doc('thu_chi_tbs', 12, '100', 1), // 12 gần hơn
        doc('payment', 21, '200', -1), doc('payment', 22, '200', 1), // hoà ⇒ 21
        doc('thu_chi_tbs', 31, '300.001', 3), // đúng biên cả hai
        doc('thu_chi_tbs', 41, '400', 4), doc('thu_chi_tbs', 42, '400.0011', 0), // ngoài cửa sổ / lệch > 0,001
      ],
    );
    expect(r.rows.map((x) => [x.bank.id, x.status, x.doc?.id ?? null, x.matchType])).toEqual([
      [1, 'matched', 12, 'auto'], [2, 'matched', 21, 'auto'], [3, 'matched', 31, 'auto'], [4, 'unmatched', null, ''],
    ]);
    expect(r.orphanDocs.map((x) => x.id)).toEqual([11, 22, 41, 42]);
    expect([S(r.totals.bank), S(r.totals.matched), S(r.totals.unmatched)]).toEqual(['1000', '600', '400']);
  });

  it('compat chặn khớp chéo: rút quỹ không khớp; lệnh nội bộ chỉ khớp fx_transfer', () => {
    const r = bankReconMatch(
      [deb(1, '500', 0, 'RUT QUY TIEN MAT'), deb(2, '600', 0, 'chuyen noi bo'), deb(3, '600', 0, 'TT NCC')],
      [doc('thu_chi_tbs', 1, '500'), doc('thu_chi_tbs', 2, '600'), doc('fx_transfer', 3, '600')],
    );
    expect(r.rows.map((x) => [x.bank.id, x.status, x.doc?.id ?? null])).toEqual([[1, 'unmatched', null], [2, 'matched', 3], [3, 'matched', 2]]);
  });

  it('link: ignore ⇒ ignore (không cộng matched/unmatched); manual/auto/fee ⇒ manual; doc trùng khoá ⇒ bản nạp SAU; doc không nạp ⇒ null', () => {
    const links = new Map<number, ReconLink>([
      [1, { matchType: 'ignore', docModule: '', docId: 0, note: 'phí' }],
      [2, { matchType: 'auto', docModule: 'thu_chi_tbs', docId: 7, note: '' }],
      [3, { matchType: 'fee', docModule: 'khong_co', docId: 9, note: 'x' }],
    ]);
    const docs = [doc('thu_chi_tbs', 7, '1', 5), doc('thu_chi_tbs', 7, '2', 6), doc('thu_chi_tbs', 8, '30')];
    const r = bankReconMatch([deb(1, '10'), deb(2, '20'), deb(3, '30'), deb(4, '30')], docs, links);
    expect(r.rows.map((x) => [x.bank.id, x.status, x.matchType, x.doc ? S(x.doc.amount) : null, x.note])).toEqual([
      [1, 'ignore', 'ignore', null, 'phí'], [2, 'manual', 'manual', '2', ''], [3, 'manual', 'manual', null, 'x'], [4, 'matched', 'auto', '30', ''],
    ]);
    // doc #7 bản đầu (không được link trỏ tới) còn mồ côi
    expect(r.orphanDocs.map((x) => S(x.amount))).toEqual(['1']);
    expect([S(r.totals.bank), S(r.totals.matched), S(r.totals.unmatched)]).toEqual(['90', '80', '0']);
  });

  it('gộp N-1: chỉ lệnh CÙNG NGÀY, 2–12 ứng viên, tổ hợp mask nhỏ nhất; lệnh khác ngày không vào nhóm', () => {
    const r = bankReconMatch(
      [deb(1, '100'), deb(2, '200'), deb(3, '300'), deb(4, '200', 1)],
      [doc('thu_chi_tbs', 9, '500')],
    );
    expect(r.rows.map((x) => [x.bank.id, x.status, x.doc?.id ?? null])).toEqual([[1, 'unmatched', null], [2, 'matched', 9], [3, 'matched', 9], [4, 'unmatched', null]]);
  });

  it('gộp: 1 ứng viên hoặc > 12 ứng viên ⇒ không gộp', () => {
    const many = Array.from({ length: 13 }, (_, i) => deb(i + 1, '1'));
    expect(bankReconMatch(many, [doc('x', 1, '2')]).rows.every((x) => x.status === 'unmatched')).toBe(true);
    const twelve = many.slice(0, 12);
    expect(bankReconMatch(twelve, [doc('x', 1, '2')]).rows.filter((x) => x.status === 'matched').map((x) => x.bank.id)).toEqual([1, 2]);
  });

  it('vnMidnight = nửa đêm giờ VN', () => {
    expect(vnMidnight(at('2026-09-10', '23:59:59'))).toBe(at('2026-09-10', '00:00:00'));
    expect(vnMidnight(at('2026-09-10', '00:00:00'))).toBe(at('2026-09-10', '00:00:00'));
    expect(vnMidnight(null)).toBe(-7 * 3600);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R8c — poTienNccTinh (HÀM THUẦN)
// ═════════════════════════════════════════════════════════════════════════════
describe('poTienNccTinh / ptnViCurrency', () => {
  const acc = new Map([['TK02', 'CNY'], ['TK08', 'USD']]);
  it('ptnViCurrency bóc mã khỏi nhãn cũ, không phân biệt hoa/thường, không tra được ⇒ ""', () => {
    expect(ptnViCurrency(' tk02 ', acc)).toBe('CNY');
    expect(ptnViCurrency('TK08 · VPBANK USD', acc)).toBe('USD');
    expect(ptnViCurrency('TK99', acc)).toBe('');
    expect(ptnViCurrency(null, acc)).toBe('');
  });
  it('po_id ≤ 0 ⇒ rỗng; formData hỏng/không phải mảng bị bỏ; intval("1abc") = 1', () => {
    expect(poTienNccTinh(0, [{ currency: 'CNY', priceCyn: '1', status: 'yes', confirm: 'yes' }], [], () => undefined, acc).chi).toEqual({});
    const r = poTienNccTinh(1, [], [
      { id: 3, objectCode: 'A', formData: '{hỏng', submittedBy: 'x' },
      { id: 2, objectCode: 'B', formData: '5', submittedBy: 'x' },
      { id: 1, objectCode: 'C', formData: '{"po_lien_quan":"1abc"}', submittedBy: 'x' },
    ], () => undefined, acc);
    expect(r.moHo.map((x) => [x.ma, x.lyDo])).toEqual([['C', LY_DO_CHUA_GHI]]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Tích hợp (CSDL + HTTP)
// ═════════════════════════════════════════════════════════════════════════════
describe('tích hợp (CSDL + HTTP)', () => {
  let app: INestApplication;
  let jwtSvc: JwtService;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    jwtSvc = app.get(JwtService);
  });
  beforeEach(async () => {
    await resetApproval(); // TRUNCATE cả tbl_user — chạy TRƯỚC resetIam
    await resetIam();
    app.get(PermService).clearCache();
    await resetTreasury();
    await resetFxBank();
    await resetSupplierPayment();
    await resetPo();
    for (const g of [
      { id: 46, name: 'KẾ TOÁN LOGISTICS', isAccountant: true, isActive: true },
      { id: 50, name: 'HÀNH CHÍNH NHÂN SỰ', isAccountant: false, isActive: true },
    ]) await prisma.legacyGroup.upsert({ where: { id: g.id }, create: g, update: g });
  });
  afterAll(async () => {
    await prisma.legacyGroup.update({ where: { id: 46 }, data: { isActive: true } });
    await resetTreasury();
    await resetFxBank();
    await resetSupplierPayment();
    await resetPo();
    await resetApproval();
    await app.close();
    await prisma.$disconnect();
  });

  async function seedGranted(username: string, grants: { code: string; scope: Scope }[], gid?: number) {
    const u = await seedUser({ username });
    if (gid !== undefined) await prisma.user.update({ where: { id: u.id }, data: { gid } });
    if (grants.length) {
      const r = await seedRole('zzfq-' + username, grants);
      await assignRole(u.id, r.id);
    }
    app.get(PermService).clearCache();
    return u;
  }
  const all = (...codes: string[]) => codes.map((code) => ({ code, scope: Scope.all }));
  const get = (path: string, u: { id: number; username: string }) =>
    request(app.getHttpServer()).get(path).set('Authorization', 'Bearer ' + jwtSvc.sign({ sub: u.id, username: u.username }));

  // ─────────────────────────────────────────────────────────────────────────────
  // R8d — /treasury/quy-te
  // ─────────────────────────────────────────────────────────────────────────────
  describe('quy-te (R8d) — đọc CSDL → fxqTinh', () => {
    async function seedQuyTe() {
      await seedFundAccount('TK01', { currency: 'VND', stk: 'STK-BI-MAT-01' });
      await seedFundAccount('TK02', { currency: 'CNY', openingBalance: D(0), isActive: 0 }); // không lọc is_active
      await seedFundAccount('TK08', { currency: 'USD', openingBalance: D(2) });
      const sep = at('2026-09-05');
      await seedFxTransfer({ code: 'FX-A', status: 'approved', fromCurrency: 'VND', toCurrency: 'USD', amountIn: D(100), rate: D(25000), createdAt: sep });
      await seedFxTransfer({ code: 'FX-B', status: 'draft', fromCurrency: 'VND', toCurrency: 'USD', amountIn: D(999), rate: D(1), createdAt: sep }); // chưa duyệt ⇒ bỏ
      // quy đổi agent (chặng 2): 100 USD → 700 ¥ ⇒ 3.571,428…/¥ ; và USD→CNY độc lập
      await seedFxTransfer({ code: 'FX-C', status: 'approved', agentTk: 'TK02', agentRate: D(7), amountIn: D(80), agentAmount: D(560), createdAt: sep + 60 });
      await seedFxTransfer({ code: 'FX-D', status: 'approved', fromCurrency: 'USD', toCurrency: 'CNY', amountOut: D(20), amountIn: D(140), rate: D(7), createdAt: sep + 120 });
      // lô VND→CNY trực tiếp
      await seedFxTransfer({ code: 'FX-E', status: 'approved', fromCurrency: 'VND', toCurrency: 'CNY', amountIn: D(100), rate: D(3600), createdAt: sep + 180 });
      // sổ quỹ: dòng họ FX bị loại khỏi "khác"; '' cũng loại; payment chi ¥ join đơn
      await seedTreasuryEntry({ tkCode: 'TK02', status: 1, money: D(700), sourceModule: 'fx_quydoi', cdate: sep + 60 });
      await seedTreasuryEntry({ tkCode: 'TK02', status: 1, money: D(100), sourceModule: '', cdate: sep + 180 });
      await seedTreasuryEntry({ tkCode: 'TK02', status: 1, money: D(10), sourceModule: 'thu_chi_tbs', cdate: sep + 200 }); // vào-khác, không rõ
      const o = await seedOrder({ oid: 'DH-1', rateSell: 3800, cusId: 'TBS1', saler: 'sale1' });
      const p = await seedSupplierPayment({ orderId: Number(o.id), status: 'yes', payment: 'yes', confirm: 'yes', codeOrder: 'DH-1', cdate: sep + 300 });
      await seedTreasuryEntry({ tkCode: 'TK02', status: 1, money: D(-700), sourceModule: 'payment', sourceId: p.id, cdate: sep + 300 });
      await seedTreasuryEntry({ tkCode: 'TK02', status: 0, money: D(-5), sourceModule: 'payment', sourceId: p.id, cdate: sep + 301 }); // treo ⇒ bỏ
      await seedTreasuryEntry({ tkCode: 'TK08', status: 1, money: D(-100), sourceModule: 'fx_transfer', cdate: sep + 60 }); // họ FX ⇒ bỏ khỏi usd_khac
      await seedTreasuryEntry({ tkCode: 'TK08', status: 1, money: D(-1), sourceModule: 'fx_fee', cdate: sep + 61 }); // phí KHÔNG thuộc họ FX
      // NCC nhận thẳng USD (phiếu ngoài ví CNY, trong kỳ)
      const o2 = await seedOrder({ oid: 'DH-2', rateSell: 25500 });
      await seedSupplierPayment({ orderId: Number(o2.id), status: 'yes', payment: 'yes', confirm: 'yes', priceCyn: D(10), rateBuy: 25000, accountCode: 'TK08', codeOrder: 'DH-2', cdate: sep + 400 });
      await seedSupplierPayment({ orderId: Number(o2.id), status: 'yes', payment: 'yes', confirm: 'yes', priceCyn: D(10), rateBuy: 25000, accountCode: 'TK02', codeOrder: 'DH-3', cdate: sep + 400 }); // ví CNY ⇒ bỏ
    }

    it('số đúng từ dữ liệu tự dựng; Decimal chuỗi; kỳ mặc định/biên theo tham số', async () => {
      await seedQuyTe();
      const u = await seedGranted('ZZFQ_fx', all('report.report_fxquyte'));
      const r = await get('/treasury/quy-te?from=2026-09-01&to=2026-09-30', u).expect(200);
      const b = r.body;
      expect(b.usd.rows.map((x: any) => [x.code, x.usd, x.cny, x.costVnd])).toEqual([
        ['FX-C', '80', '560', '2000000'], ['FX-D', '20', '140', '500000'],
      ]);
      expect([b.usd.muaVao, b.usd.daQuyDoi]).toEqual(['100', '100']);
      // usd_khac = opening 2 + (−1 phí) ; số dư TK08 = 2 − 100 − 1
      expect([b.usd.ton, b.usd.soDu, b.usd.lech]).toEqual(['1', '-99', '100']);
      // chi 700 ¥: FIFO 560 @3.571,43 (FX-C) + 140 @3.571,43 (FX-D) = 2.500.000; báo 700×3.800
      expect(b.cny.rows.map((x: any) => [x.codeOrder, x.oid, x.qty, x.giaVon, x.baoKhach, x.lai])).toEqual([
        ['DH-1', 'DH-1', '700', '2500000', '2660000', '160000'],
      ]);
      expect(b.cny.ton).toBe('110'); // 560 + 140 + 100 + 10 − 700
      expect(b.cny.soDu).toBe('110');
      expect(b.usdThang.rows.map((x: any) => [x.codeOrder, x.lai])).toEqual([['DH-2', '5000']]);
      expect(JSON.stringify(b)).not.toContain('STK-BI-MAT');
      // kỳ tháng 8 ⇒ không dòng hiện (FIFO vẫn chạy)
      const r8 = await get('/treasury/quy-te?from=2026-08-01&to=2026-08-31', u).expect(200);
      expect([r8.body.usd.rows.length, r8.body.cny.rows.length, r8.body.usdThang.rows.length]).toEqual([0, 0, 0]);
      await get('/treasury/quy-te?from=2026-13-01', u).expect(400);
    });

    it('không có ví CNY ⇒ trả sớm như prod (usd_thang cũng rỗng)', async () => {
      await seedFundAccount('TK08', { currency: 'USD' });
      const o2 = await seedOrder({ oid: 'DH-2', rateSell: 25500 });
      await seedSupplierPayment({ orderId: Number(o2.id), status: 'yes', payment: 'yes', confirm: 'yes', priceCyn: D(10), rateBuy: 25000, cdate: at('2026-09-10') });
      const svc = app.get(TreasuryReportService);
      const u = await seedGranted('ZZFQ_fx', all('report.report_fxquyte'));
      const r = await svc.quyTe(u.id, at('2026-09-01', '00:00:00'), at('2026-10-01', '00:00:00'));
      expect(r.usdThang.rows).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // R8c — /po/:id/tien-ncc
  // ─────────────────────────────────────────────────────────────────────────────
  describe('poTienNcc (R8c) — số prod + tách duyệt (Q-DOC-7), vế thu (P-PT2/P-PT3), phạm vi PO fail-closed', () => {
    async function seedPoNcc() {
      await seedFundAccount('TK02', { currency: 'CNY' });
      await seedFundAccount('TK08', { currency: 'USD' });
      const po = await seedPo('PO-ZZ-1', { createdBy: 'sale1' });
      const po2 = await seedPo('PO-ZZ-2', { createdBy: 'sale2' });
      const pay = (o: Partial<Prisma.SupplierPaymentUncheckedCreateInput>) => seedSupplierPayment({ poId: po.id, payType: 'supplier', ...o });
      await pay({ currency: 'CNY', priceCyn: D('1000'), status: 'yes', confirm: 'yes' });
      await pay({ currency: 'CNY', priceCyn: D('200.50'), status: 'no', confirm: 'no' }); // chưa duyệt — P-PT1: VẪN cộng
      await pay({ currency: 'CNY', priceCyn: D('30'), status: 'yes', confirm: 'no' }); // quá độ
      await pay({ currency: 'CNY', priceCyn: null, status: 'yes', confirm: 'yes' }); // NULL ⇒ 0
      await pay({ currency: 'USD', priceCyn: D('50'), status: 'yes', confirm: 'yes' });
      await pay({ currency: 'CNY', priceCyn: D('999'), payType: '' }); // luồng cũ ⇒ không phải phiếu chi NCC
      await pay({ currency: 'CNY', priceCyn: D('777'), poId: po2.id });

      const tpl = await seedTemplate('thu_ncc_hoan_tien', { objectType: 'thu_chi_tbs' });
      const khac = await seedTemplate('thu_chi_khac', { objectType: 'thu_chi_tbs' });
      const req = (o: { fd: any; status?: number; isDeleted?: boolean; templateId?: number; code: string }) =>
        prisma.approvalRequest.create({ data: {
          templateId: o.templateId ?? tpl.id, objectType: 'thu_chi_tbs', objectId: 0, objectCode: o.code, currentStepOrder: 1,
          status: o.status ?? 2, submittedBy: 'kt1', submittedAt: 1, isDeleted: o.isDeleted ?? false,
          formData: typeof o.fd === 'string' ? o.fd : JSON.stringify(o.fd),
        } });
      const thu = (rid: number, tk: string, money: string, status = 1) =>
        seedTreasuryEntry({ tkCode: tk, type: 'in', money: D(money), status, sourceModule: 'thu_chi_tbs', sourceId: rid });

      const r1 = await req({ code: 'R1', fd: { po_lien_quan: String(po.id), tk_vi_thu: ' TK02 ', ngay_hoan: ' 2026-09-10 ' } });
      await thu(r1.id, 'TK02', '100');
      await req({ code: 'R2', fd: { po_lien_quan: po.id } }); // duyệt mà chưa có bút toán ⇒ mo_ho
      const r3 = await req({ code: 'R3', fd: { tk_vi_thu: 'TK02' } }); // P-PT2: không gắn PO
      await thu(r3.id, 'TK02', '5000');
      await req({ code: 'R4', status: 1, fd: { po_lien_quan: po.id } }); // chờ duyệt ⇒ bỏ
      const r5 = await req({ code: 'R5', isDeleted: true, fd: { po_lien_quan: po.id } });
      await thu(r5.id, 'TK02', '1');
      const r6 = await req({ code: 'R6', fd: { po_lien_quan: `${po.id}abc` } }); // intval ⇒ po.id
      await thu(r6.id, 'TK99', '9'); // ví lạ ⇒ mo_ho
      const r7 = await req({ code: 'R7', fd: { po_lien_quan: po.id } });
      const e7 = await thu(r7.id, 'TK02', '40');
      await seedTreasuryEntry({ tkCode: 'TK02', money: D('-40'), status: 1, sourceModule: 'daoxoa_thu_chi_tbs', sourceId: r7.id, reversalOf: e7.id }); // P-PT3
      const r8 = await req({ code: 'R8', fd: { po_lien_quan: po.id } });
      await thu(r8.id, 'TK02', '8', 0); // treo ⇒ không phải status=1 ⇒ mo_ho
      const r9 = await req({ code: 'R9', templateId: khac.id, fd: { po_lien_quan: po.id } });
      await thu(r9.id, 'TK02', '3');
      const r10 = await req({ code: 'R10', fd: { po_lien_quan: po.id } });
      await thu(r10.id, 'TK08', '-2'); // tệ ví nhận = USD; |money|
      return { po, po2 };
    }

    it('chi = số prod (gồm phiếu CHƯA duyệt) + tách chiDaDuyet/chiChoDuyet; thu/moHo/con như prod', async () => {
      const { po, po2 } = await seedPoNcc();
      const u = await seedGranted('ZZFQ_po', all('po.view'));
      const b = (await get(`/po/${po.id}/tien-ncc`, u).expect(200)).body;
      expect(b.chi).toEqual({ CNY: '1230.5', USD: '50' });
      expect(b.chiDaDuyet).toEqual({ CNY: '1000', USD: '50' });
      expect(b.chiChoDuyet).toEqual({ CNY: '230.5' });
      expect(b.soPhieuChi).toEqual({ daDuyet: 3, choDuyet: 2, quaDo: 1 });
      // phiếu theo id DESC: R10, R7, R1 — R7 đã bị đảo VẪN tính (P-PT3), chỉ gắn cờ
      expect(b.phieu.map((x: any) => [x.ma, x.tien, x.tienTe, x.vi, x.daBiDao])).toEqual([
        ['R10', '2', 'USD', 'TK08', false], ['R7', '40', 'CNY', 'TK02', true], ['R1', '100', 'CNY', 'TK02', false],
      ]);
      expect(b.phieu[2].ngay).toBe('2026-09-10');
      expect(b.thu).toEqual({ CNY: '140', USD: '2' });
      expect(b.con).toEqual({ CNY: '1090.5', USD: '48' });
      expect(b.moHo.map((x: any) => [x.ma, x.lyDo])).toEqual([
        ['R8', LY_DO_CHUA_GHI], ['R6', LY_DO_KHONG_TIEN], ['R2', LY_DO_CHUA_GHI],
      ]);
      // P-PT2: 5.000 ¥ hoàn của R3 không thuộc PO nào
      expect(b.coPhieuThu).toBe(true);
      const b2 = (await get(`/po/${po2.id}/tien-ncc`, u).expect(200)).body;
      expect(b2).toMatchObject({ chi: { CNY: '777' }, thu: {}, con: { CNY: '777' }, phieu: [], moHo: [], coPhieuThu: false });
    });

    it('phạm vi PO fail-closed: own chỉ thấy PO mình tạo; ngoài phạm vi = không tồn tại = id rác (cùng 404); thiếu quyền 403; chưa đăng nhập 401', async () => {
      const { po, po2 } = await seedPoNcc();
      const own = await seedGranted('sale1', [{ code: 'po.view', scope: Scope.own }]);
      await get(`/po/${po.id}/tien-ncc`, own).expect(200);
      const a = await get(`/po/${po2.id}/tien-ncc`, own).expect(404);
      const b = await get('/po/99999/tien-ncc', own).expect(404);
      const c = await get('/po/abc/tien-ncc', own).expect(404);
      expect(a.body).toEqual(b.body);
      expect(b.body).toEqual(c.body);
      const wh = await seedGranted('ZZFQ_wh', [{ code: 'po.view', scope: Scope.warehouse }]);
      await get(`/po/${po.id}/tien-ncc`, wh).expect(404); // PO không có cột kho ⇒ DENY
      const no = await seedGranted('ZZFQ_no', all('account.view', 'payment.view', 'report.report_fxquyte'));
      await get(`/po/${po.id}/tien-ncc`, no).expect(403);
      await request(app.getHttpServer()).get(`/po/${po.id}/tien-ncc`).expect(401);
      // service tự chặn khi gọi ngoài HTTP
      const svc = app.get(PoTienNccService);
      await expect(svc.poTienNcc(own.id, po2.id)).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.poTienNcc(no.id, po.id)).rejects.toBeInstanceOf(NotFoundException);
      expect(await svc.poCoPhieuThuNcc(own.id, po.id)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // R10a — /bank/recon  ·  R10b — /bank/fx-unaccounted
  // ─────────────────────────────────────────────────────────────────────────────
  describe('reconList (R10a) — chép prod + gắn cờ ứng viên đảo/status≠1 (Q-DOC-12)', () => {
    const debit = (o: Partial<Prisma.BankTransactionUncheckedCreateInput>) =>
      seedBankTransaction({ tkCode: 'TK01', tranType: '-', status: 'no', bankid: 'SEPAY1', bankAccount: '0123456789', ...o });
    const docE = (o: Partial<Prisma.TreasuryEntryUncheckedCreateInput>) => seedTreasuryEntry({ tkCode: 'TK01', type: 'out', status: 1, ...o });

    it('ứng viên đã bị ĐẢO vẫn khớp như prod NHƯNG mang cờ daBiDao/canXem — không bị bỏ im lặng; nội dung CK/số TK không lộ', async () => {
      const t = at('2026-09-10', '09:00:00');
      const b1 = await debit({ tranAmount: BigInt(1_000_000), cdate: t, tranMess: 'TT NCC BI MAT NOI DUNG' });
      const b2 = await debit({ tranAmount: BigInt(250_000), cdate: t + 60, tranMess: 'TT NCC 2' });
      const b3 = await debit({ tranAmount: BigInt(300_000), cdate: t + 120, tranMess: 'TT NCC 3' });
      await debit({ tranAmount: BigInt(9), cdate: t, status: 'huy' }); // huỷ ⇒ bỏ
      await debit({ tranAmount: BigInt(9), cdate: t, status: null }); // NULL <> 'huy' ⇒ bỏ (như MariaDB)
      await debit({ tranAmount: BigInt(9), cdate: t, tranType: '+' });
      await debit({ tranAmount: BigInt(9), cdate: t, tkCode: 'TK02' });
      const bOut = await debit({ tranAmount: BigInt(9), cdate: at('2026-10-01', '00:00:00') }); // ngoài kỳ
      const g = await docE({ money: D(-1_000_000), cdate: t - DAY, sourceModule: 'thu_chi_tbs', sourceId: 5, note: 'Phiếu 5' });
      await seedTreasuryEntry({ tkCode: 'TK01', type: 'in', status: 1, money: D(1_000_000), cdate: t, sourceModule: 'daoxoa_thu_chi_tbs', sourceId: 5, reversalOf: g.id });
      await docE({ money: D(-250_000), cdate: t, status: 0, sourceModule: 'payment', sourceId: 6 }); // status≠1 ⇒ vẫn ứng viên
      await docE({ money: D(-777), cdate: t, type: 'tranfer', sourceModule: 'fx_transfer', sourceId: 7 }); // mồ côi
      await docE({ money: D(-300_000), cdate: at('2026-08-01'), sourceModule: 'thu_chi_tbs', sourceId: 8 }); // ngoài cửa sổ — nạp nhờ link manual
      await seedBankReconcileLink({ bankTranId: b3.id, matchType: 'manual', docModule: 'thu_chi_tbs', docId: 8, note: 'KT gán tay' });
      await seedBankReconcileLink({ bankTranId: bOut.id, matchType: 'ignore' }); // link của lệnh ngoài kỳ ⇒ không quan tâm

      const svc = app.get(BankReconService);
      const su = await seedUser({ username: 'ZZFQ_admin', isSuperAdmin: true });
      const r = await svc.reconList(su.id, at('2026-09-01', '00:00:00'), at('2026-09-30', '23:59:59'), 3);
      expect(r.rows.map((x) => [x.bank.id, x.status, x.matchType, x.doc?.id ?? null, x.doc?.daBiDao ?? null, x.doc?.chuaLenSo ?? null, x.doc?.canXem ?? null])).toEqual([
        [Number(b1.id), 'matched', 'auto', 5, true, false, true],
        [Number(b2.id), 'matched', 'auto', 6, false, true, true],
        [Number(b3.id), 'manual', 'manual', 8, false, false, false],
      ]);
      expect(r.orphanDocs.map((x) => [x.module, x.id, x.amount])).toEqual([['fx_transfer', 7, '777']]);
      expect(r.totals).toEqual({ bank: '1550000', matched: '1550000', unmatched: '0' });
      expect(r.ungVienCanXem).toBe(2);
      expect(r.rows[0].bank).toEqual({ id: Number(b1.id), amount: '1000000', date: at('2026-09-10', '00:00:00'), cdate: t, cat: 'other' });
      const js = JSON.stringify(r);
      expect(js).not.toContain('BI MAT');
      expect(js).not.toContain('0123456789');
      expect(js).not.toContain('SEPAY1');
    });

    it('HTTP: tham số fdate/tdate/window; sai định dạng ⇒ mặc định; ngày không có thật ⇒ 400', async () => {
      const t = at('2026-09-10', '09:00:00');
      await debit({ tranAmount: BigInt(100), cdate: t, tranMess: 'x' });
      await docE({ money: D(-100), cdate: t + 5 * DAY, sourceModule: 'thu_chi_tbs', sourceId: 1 });
      const su = await seedUser({ username: 'ZZFQ_admin', isSuperAdmin: true });
      const q = (s: string) => get('/bank/recon' + s, su);
      expect((await q('?fdate=2026-09-01&tdate=2026-09-30').expect(200)).body.rows[0].status).toBe('unmatched');
      expect((await q('?fdate=2026-09-01&tdate=2026-09-30&window=5').expect(200)).body.rows[0].status).toBe('matched');
      expect((await q('?fdate=2026-09-01&tdate=2026-09-30&window=0').expect(200)).body.rows[0].status).toBe('unmatched');
      await q('?fdate=2026-13-01').expect(400);
      await q('?window=-1').expect(400);
    });
  });

  describe('fxUnaccounted (R10b) — 60 ngày, chứng từ ±3 ngày', () => {
    it('rút quỹ liệt kê; nội bộ chỉ so NET với fx_transfer trong ±3 ngày (biên đóng); other chưa link/chưa neo ⇒ chờ soát; cờ Q-DOC-12', async () => {
      const now = at('2026-09-25', '12:00:00');
      const fd = now - 60 * DAY;
      const debit = (o: Partial<Prisma.BankTransactionUncheckedCreateInput>) =>
        seedBankTransaction({ tkCode: 'TK01', tranType: '-', status: 'no', ...o });
      const c1 = await debit({ tranAmount: BigInt(500_000_000), cdate: now - DAY, tranMess: 'RUT QUY TIEN MAT' });
      await debit({ tranAmount: BigInt(600_000_000), cdate: fd, tranMess: 'rut quy tien mat' }); // đúng biên fd
      await debit({ tranAmount: BigInt(1), cdate: fd - 1, tranMess: 'RUT QUY TIEN MAT' }); // ngoài 60 ngày
      await debit({ tranAmount: BigInt(3_000_000_000), cdate: now - 2 * DAY, tranMess: 'chuyen noi bo TK08' });
      const rv = await debit({ tranAmount: BigInt(199_200), cdate: now - 3 * DAY, tranMess: 'phi dich vu' });
      const lk = await debit({ tranAmount: BigInt(5), cdate: now - 3 * DAY, tranMess: 'da link' });
      const an = await debit({ tranAmount: BigInt(6), cdate: now - 3 * DAY, tranMess: 'da neo' });
      await seedBankReconcileLink({ bankTranId: lk.id, matchType: 'auto' });
      await seedFxTransfer({ code: 'FX-N', bankTranId: an.id });
      const fx = (money: number, cdate: number, o: Partial<Prisma.TreasuryEntryUncheckedCreateInput> = {}) =>
        seedTreasuryEntry({ tkCode: 'TK01', type: 'tranfer', status: 1, money: D(-money), cdate, sourceModule: 'fx_transfer', ...o });
      const g = await fx(1_000_000_000, fd - 3 * DAY); // đúng biên dưới (BETWEEN)
      await seedTreasuryEntry({ tkCode: 'TK01', type: 'in', status: 1, money: D(1_000_000_000), cdate: now, sourceModule: 'fx_transfer_dao', reversalOf: g.id });
      await fx(9_000_000_000, fd - 3 * DAY - 1); // ngoài
      await fx(500_000_000, now + 3 * DAY); // đúng biên trên
      await fx(7_000_000_000, now + 3 * DAY + 1); // ngoài
      await fx(100_000_000, now, { type: 'in' }); // type in ⇒ không phải chứng từ chi

      const svc = app.get(BankReconService);
      const su = await seedUser({ username: 'ZZFQ_admin', isSuperAdmin: true });
      const r = await svc.fxUnaccounted(su.id, new Date(now * 1000));
      expect(r.ok).toBe(1);
      expect([r.cashCount, r.cashTotal]).toEqual([2, '1100000000']);
      expect(r.cashRows.map((x) => [x.id, x.amount])).toEqual([[Number(c1.id), '500000000'], [expect.any(Number), '600000000']]);
      expect(r.transferShort).toBe('1500000000'); // 3 tỷ − (1 tỷ + 0,5 tỷ)
      expect([r.reviewCount, r.reviewTotal, r.reviewRows.map((x) => x.id)]).toEqual([1, '199200', [Number(rv.id)]]);
      expect(r.transferDocCanXem).toEqual({ n: 1, amount: '1000000000' }); // 1 tỷ của chứng từ đã bị đảo vẫn trừ như prod
      const js = JSON.stringify(r);
      expect(js).not.toContain('RUT QUY');
      expect(js).not.toContain('phi dich vu');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Quyền (§9)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('quyền route (§9)', () => {
    it('quy-te: report.report_fxquyte (all) ⇒ 200; thiếu ⇒ 403; phạm vi hẹp ⇒ 403; chưa đăng nhập ⇒ 401', async () => {
      const ok = await seedGranted('ZZFQ_ok', all('report.report_fxquyte'));
      await get('/treasury/quy-te', ok).expect(200);
      const no = await seedGranted('ZZFQ_no', all('account.view', 'account.stats', 'report.report_bld', 'po.view'));
      await get('/treasury/quy-te', no).expect(403);
      const own = await seedGranted('ZZFQ_own', [{ code: 'report.report_fxquyte', scope: Scope.own }]);
      await get('/treasury/quy-te', own).expect(403);
      await request(app.getHttpServer()).get('/treasury/quy-te').expect(401);
      await expect(app.get(TreasuryReportService).quyTe(no.id, 0, 1)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(['/bank/recon', '/bank/fx-unaccounted'])('%s: super admin hoặc nhóm kế toán (gid isaccountant, isactive) — còn lại 403', async (path) => {
      const su = await seedUser({ username: 'ZZFQ_su', isSuperAdmin: true });
      await get(path, su).expect(200);
      const kt = await seedGranted('ZZFQ_kt', all('account.view'), 46);
      await get(path, kt).expect(200);
      const khong = await seedGranted('ZZFQ_hcns', all('account.view', 'account.stats', 'report.report_fxquyte'), 50);
      await get(path, khong).expect(403);
      const khongGid = await seedGranted('ZZFQ_nogid', all('account.view'));
      await get(path, khongGid).expect(403);
      const ktKhongQuyen = await seedGranted('ZZFQ_kt2', [], 46);
      await get(path, ktKhongQuyen).expect(403);
      await prisma.legacyGroup.update({ where: { id: 46 }, data: { isActive: false } });
      await get(path, kt).expect(403);
      await request(app.getHttpServer()).get(path).expect(401);
    });

    it('service bank tự chặn khi gọi ngoài HTTP; user bị khoá ⇒ chặn', async () => {
      const svc = app.get(BankReconService);
      const khong = await seedGranted('ZZFQ_hcns', all('account.view'), 50);
      await expect(svc.reconList(khong.id, 0, 1, 3)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.fxUnaccounted(khong.id)).rejects.toBeInstanceOf(ForbiddenException);
      const kt = await seedGranted('ZZFQ_kt', all('account.view'), 46);
      await prisma.user.update({ where: { id: kt.id }, data: { isActive: false } });
      await expect(svc.fxUnaccounted(kt.id)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.fxUnaccounted(0)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
