// 09b đợt 1, Task 3 — `GlMapService.postBiz` biết VÍ (vế tiền theo ví quỹ thực tế).
// Đặc tả: docs/rewrite-spec/09b-so-quy-treasury.md §7.1 (postBiz, `cls.glmap.php:55-66` dữ liệu thử,
//         `:69-76` taiKhoanCuaVi, `:88-95` apDungViVaoCapTK), §7.2 (ánh xạ đo), §7.4 (đảo GL), §10.3.
// Nguồn PHP đối chiếu: F:/01_TBS_GROUP/patch_glmap.py, patch_guard_zz.py, patch_cua_test.py (bản vá
// đã đẩy prod) + glvi_tests.php (GLVI-10..15 — chép nguyên các ca hàm thuần).
import { Prisma } from '@prisma/client';
import { prisma, resetDb, seedMapping } from '../helpers/db';
import { resetTreasury, seedFundAccount, seedTreasuryEntry } from '../helpers/treasury-db';
import { GlService } from '../../src/money/gl.service';
import { GlMapService, apDungViVaoCapTK, laDuLieuThu } from '../../src/money/gl-map.service';
import { TreasuryService } from '../../src/money/treasury.service';

const D = (v: string | number) => new Prisma.Decimal(v);
const gl = new GlService(prisma as any);
const map = new GlMapService(prisma as any, gl);

/** Ánh xạ có `money_side` (seedMapping cũ không có cột này). */
async function seedMappingSide(bizType: string, dr: string, cr: string, moneySide: string, approved = true) {
  await prisma.glMapping.create({
    data: { bizType, bizLabel: bizType, debitAccount: dr, creditAccount: cr, moneySide, isApproved: approved, active: true },
  });
}

async function linesOf(entryId: number) {
  const ls = await prisma.glLine.findMany({ where: { entryId }, orderBy: { lineNo: 'asc' } });
  return ls.map((l) => ({ acc: l.accountCode, dr: l.debit.toFixed(2), cr: l.credit.toFixed(2) }));
}

beforeEach(async () => {
  await resetDb();
  await resetTreasury();
  // Ví đo prod (§3.3 + glvi_tests GLVI-30..32): TK01 ACB → 1121, TK02 RMB agent → 1122 (CNY),
  // TK03 MB cá nhân → 138, TK07 cọc (store) chưa khai TK (''), TK12 tiền mặt → 1111.
  await seedFundAccount('TK01', { currency: 'VND', glAccount: '1121' });
  await seedFundAccount('TK02', { currency: 'CNY', glAccount: '1122' });
  await seedFundAccount('TK03', { currency: 'VND', glAccount: '138' });
  await seedFundAccount('TK07', { currency: 'VND', accGroup: 'store', glAccount: '' });
  await seedFundAccount('TK12', { currency: 'VND', glAccount: ' 1111 ' }); // khoảng trắng: prod trim
});
afterAll(async () => {
  await resetTreasury();
  await prisma.$disconnect();
});

// ───────────────────────── hàm THUẦN apDungViVaoCapTK (`:88-95`) ─────────────────────────
describe('apDungViVaoCapTK — chép glvi_tests GLVI-10..15', () => {
  test('GLVI-10 vế Có là vế tiền ⇒ thay Có bằng TK của ví', () => {
    expect(apDungViVaoCapTK('3311', '1121', 'credit', '1111')).toEqual(['3311', '1111']);
  });
  test('GLVI-11 vế Nợ là vế tiền ⇒ thay Nợ bằng TK của ví', () => {
    expect(apDungViVaoCapTK('1121', '1311', 'debit', '1111')).toEqual(['1111', '1311']);
  });
  test('GLVI-12 money_side rỗng ⇒ KHÔNG thay gì', () => {
    expect(apDungViVaoCapTK('3311', '1121', '', '1111')).toEqual(['3311', '1121']);
  });
  test('GLVI-13 ví chưa khai tài khoản ⇒ giữ nguyên (không ghi vào TK rỗng)', () => {
    expect(apDungViVaoCapTK('3311', '1121', 'credit', '')).toEqual(['3311', '1121']);
    expect(apDungViVaoCapTK('3311', '1121', 'credit', '   ')).toEqual(['3311', '1121']);
  });
  test('GLVI-14 hai vế trùng nhau vẫn thay đúng vế được chỉ định', () => {
    expect(apDungViVaoCapTK('1121', '1121', 'credit', '1111')).toEqual(['1121', '1111']);
  });
  test('GLVI-15 money_side viết hoa không khớp enum ⇒ coi như rỗng, không đoán', () => {
    expect(apDungViVaoCapTK('3311', '1121', 'CREDIT', '1111')).toEqual(['3311', '1121']);
  });
  test('trim dr/cr/gl như prod (`trim((string)…)`)', () => {
    expect(apDungViVaoCapTK(' 331 ', ' 112 ', 'credit', ' 1122 ')).toEqual(['331', '1122']);
    expect(apDungViVaoCapTK(' 331 ', ' 112 ', '', '1122')).toEqual(['331', '112']);
  });
});

// ───────────────────────── hàm THUẦN laDuLieuThu (`:55-66`) ─────────────────────────
describe('laDuLieuThu — 3 dấu hiệu', () => {
  test.each([
    ['cusId ZZ (hoa/thường, có trắng đầu)', 'payment', { cusId: ' zzqa_1' }],
    ['createdBy tiền tố zz', 'payment', { createdBy: 'ZZREG_kt' }],
    ["createdBy = 'reg'", 'payment', { createdBy: ' REG ' }],
    ["createdBy = 'regression'", 'payment', { createdBy: 'Regression' }],
    ['sourceType tiền tố zz', 'zzreg_glmap', {}],
  ])('%s ⇒ true', (_n, st, o) => {
    expect(laDuLieuThu(st as string, o as any)).toBe(true);
  });
  test.each([
    ['khách thật', 'payment', { cusId: 'TBS1', createdBy: 'ketoan1' }],
    ["createdBy chứa 'reg' nhưng không bằng", 'payment', { createdBy: 'regina' }],
    ['cusId có zz ở giữa', 'payment', { cusId: 'TBSZZ1' }],
    ['rỗng hết', '', {}],
  ])('%s ⇒ false', (_n, st, o) => {
    expect(laDuLieuThu(st as string, o as any)).toBe(false);
  });
});

// ───────────────────────── postBiz + tkVi — ánh xạ đo §7.2 ─────────────────────────
describe('postBiz biết ví — payment_ncc (331 / 112, money_side=credit, duyệt=1)', () => {
  beforeEach(() => seedMappingSide('payment_ncc', '331', '112', 'credit'));

  test('tkVi ví CNY (TK02) ⇒ Có = gl_account của ví = 1122; Nợ giữ 331', async () => {
    const r = await map.postBiz('payment_ncc', 'payment', 9001, D('1756830'), { tkVi: 'TK02', createdBy: 'ketoan1' });
    expect(r.status).toBe('posted');
    expect(await linesOf(r.entryId!)).toEqual([
      { acc: '331', dr: '1756830.00', cr: '0.00' },
      { acc: '1122', dr: '0.00', cr: '1756830.00' },
    ]);
  });

  test('tkVi ví VND (TK01) ⇒ Có 1121', async () => {
    const r = await map.postBiz('payment_ncc', 'payment', 9002, '500000', { tkVi: 'TK01' });
    expect(r.status).toBe('posted');
    expect((await linesOf(r.entryId!)).map((l) => l.acc)).toEqual(['331', '1121']);
  });

  test('tkVi ví cá nhân (TK03) ⇒ Có 138 — không suy theo tiền tố 112', async () => {
    const r = await map.postBiz('payment_ncc', 'payment', 9003, 1000, { tkVi: 'TK03' });
    expect((await linesOf(r.entryId!)).map((l) => l.acc)).toEqual(['331', '138']);
  });

  test('gl_account của ví có khoảng trắng ⇒ trim (TK12 → 1111)', async () => {
    const r = await map.postBiz('payment_ncc', 'payment', 9004, 1000, { tkVi: ' TK12 ' });
    expect((await linesOf(r.entryId!)).map((l) => l.acc)).toEqual(['331', '1111']);
  });

  test('ĐỐI CHỨNG: không truyền tkVi ⇒ Có 112 của ánh xạ như cũ', async () => {
    const r = await map.postBiz('payment_ncc', 'payment', 9005, 1000, { createdBy: 'ketoan1' });
    expect(r.status).toBe('posted');
    expect((await linesOf(r.entryId!)).map((l) => l.acc)).toEqual(['331', '112']);
  });

  test('tkVi ví chưa khai TK (TK07, gl_account rỗng) ⇒ GIỮ 112', async () => {
    const r = await map.postBiz('payment_ncc', 'payment', 9006, 1000, { tkVi: 'TK07' });
    expect((await linesOf(r.entryId!)).map((l) => l.acc)).toEqual(['331', '112']);
  });

  test('tkVi không có trong danh mục ⇒ GIỮ 112 (taiKhoanCuaVi trả rỗng, không nổ)', async () => {
    const r = await map.postBiz('payment_ncc', 'payment', 9007, 1000, { tkVi: 'KHONG_CO' });
    expect(r.status).toBe('posted');
    expect((await linesOf(r.entryId!)).map((l) => l.acc)).toEqual(['331', '112']);
  });
});

describe('postBiz biết ví — bank_tien_ve (1121 / 338, money_side=debit)', () => {
  beforeEach(() => seedMappingSide('bank_tien_ve', '1121', '338', 'debit'));

  test('tkVi TK03 ⇒ Nợ 138 (vế tiền là Nợ), Có 338 giữ', async () => {
    const r = await map.postBiz('bank_tien_ve', 'bank_tx', 7001, 2000, { tkVi: 'TK03' });
    expect((await linesOf(r.entryId!)).map((l) => l.acc)).toEqual(['138', '338']);
  });
  test('đo prod: TK07 → 1121 (gl_account rỗng ⇒ giữ 1121)', async () => {
    const r = await map.postBiz('bank_tien_ve', 'bank_tx', 7002, 2000, { tkVi: 'TK07' });
    expect((await linesOf(r.entryId!)).map((l) => l.acc)).toEqual(['1121', '338']);
  });
});

test('ánh xạ money_side rỗng + tkVi ⇒ KHÔNG thay (giữ cặp cũ)', async () => {
  await seedMappingSide('chiphi_x', '642', '112', '');
  const r = await map.postBiz('chiphi_x', 'chiphi', 1, 1000, { tkVi: 'TK01' });
  expect((await linesOf(r.entryId!)).map((l) => l.acc)).toEqual(['642', '112']);
});

// ───────────────────────── dữ liệu thử ⇒ skipped (và cửa choPhepDuLieuThu) ─────────────────────────
describe('dữ liệu thử bị bỏ qua theo TỪNG dấu hiệu', () => {
  beforeEach(() => seedMappingSide('payment_ncc', '331', '112', 'credit'));

  test.each([
    ['cusId ZZ', 'payment', { cusId: 'ZZQA_1' }],
    ['createdBy zz', 'payment', { createdBy: 'zzreg_kt' }],
    ["createdBy 'reg'", 'payment', { createdBy: 'reg' }],
    ["createdBy 'regression'", 'payment', { createdBy: 'regression' }],
    ['sourceType zz', 'zzreg_glmap', {}],
  ])('%s ⇒ skipped, không có bút toán', async (_n, st, o) => {
    const r = await map.postBiz('payment_ncc', st as string, 5001, 1000, { tkVi: 'TK01', ...(o as any) });
    expect(r.status).toBe('skipped');
    expect(await prisma.glEntry.count()).toBe(0);
  });

  test.each([
    ['cusId ZZ', 'payment', { cusId: 'ZZQA_1' }],
    ['createdBy zz', 'payment', { createdBy: 'zzreg_kt' }],
    ['sourceType zz', 'zzreg_glmap', {}],
  ])('choPhepDuLieuThu vượt dấu hiệu %s ⇒ posted', async (_n, st, o) => {
    const r = await map.postBiz('payment_ncc', st as string, 5002, 1000, { tkVi: 'TK01', choPhepDuLieuThu: true, ...(o as any) });
    expect(r.status).toBe('posted');
    expect((await linesOf(r.entryId!)).map((l) => l.acc)).toEqual(['331', '1121']);
  });
});

// ───────────────────────── amount: Decimal | string | number, round2 nửa-lên ─────────────────────────
describe('amount — PHP round(x, 2)', () => {
  beforeEach(() => seedMappingSide('payment_ncc', '331', '112', 'credit'));

  test.each([
    ['Decimal 1000.005 ⇒ 1000.01', D('1000.005'), '1000.01'],
    ['Decimal 1000.004 ⇒ 1000.00', D('1000.004'), '1000.00'],
    // Mép Decimal: float 0.285*100 = 28.4999… ⇒ Math.round cho 0.28; PHP round(0.285,2) = 0.29.
    ['Decimal 0.285 ⇒ 0.29 (float sẽ ra 0.28)', D('0.285'), '0.29'],
    ['chuỗi "1.005" ⇒ 1.01', '1.005', '1.01'],
    ['number 1.005 ⇒ 1.01 (PHP pre-rounding)', 1.005, '1.01'],
    ['Decimal lớn 123456789012.345 ⇒ …012.35', D('123456789012.345'), '123456789012.35'],
  ])('%s', async (_n, amt, want) => {
    const r = await map.postBiz('payment_ncc', 'payment', 6001, amt as any, { tkVi: 'TK01' });
    expect(r.status).toBe('posted');
    const ls = await linesOf(r.entryId!);
    expect(ls[0].dr).toBe(want);
    expect(ls[1].cr).toBe(want);
    const e = await prisma.glEntry.findUnique({ where: { id: r.entryId! } });
    expect(e!.totalDebit.toFixed(2)).toBe(want);
  });

  test.each([
    ['0.004 làm tròn về 0', D('0.004')],
    ['0', 0],
    ['âm', D('-5')],
    ['chuỗi rác', 'abc'],
  ])('%s ⇒ skipped', async (_n, amt) => {
    const r = await map.postBiz('payment_ncc', 'payment', 6002, amt as any, {});
    expect(r.status).toBe('skipped');
    expect(await prisma.glEntry.count()).toBe(0);
  });
});

// ───────────────────────── dr/cr rỗng ⇒ skipped ─────────────────────────
describe("dr === '' || cr === '' ⇒ skipped", () => {
  test('Có rỗng, không tkVi ⇒ skipped', async () => {
    await seedMappingSide('thieu_co', '331', '', 'credit');
    const r = await map.postBiz('thieu_co', 'payment', 1, 1000, {});
    expect(r.status).toBe('skipped');
    expect(await prisma.glEntry.count()).toBe(0);
  });
  test('Nợ chỉ có khoảng trắng ⇒ skipped', async () => {
    await seedMappingSide('thieu_no', '  ', '112', 'credit');
    const r = await map.postBiz('thieu_no', 'payment', 2, 1000, { tkVi: 'TK01' });
    expect(r.status).toBe('skipped');
  });
  test('Có rỗng nhưng vế tiền = Có và ví có TK ⇒ ví lấp vào, posted (đúng thứ tự prod: thay TRƯỚC, kiểm rỗng SAU)', async () => {
    await seedMappingSide('thieu_co2', '331', '', 'credit');
    const r = await map.postBiz('thieu_co2', 'payment', 3, 1000, { tkVi: 'TK01' });
    expect(r.status).toBe('posted');
    expect((await linesOf(r.entryId!)).map((l) => l.acc)).toEqual(['331', '1121']);
  });
});

// ───────────────────────── đảo GL theo nguồn — idempotent ─────────────────────────
describe('đảo GL theo nguồn chạy HAI lần ⇒ chỉ đảo MỘT lần (glDao của daoTheoNguon khi chạy lại)', () => {
  test('GlService.reverse(findBySource) lần 2 trả exists, chỉ có 1 bút toán đảo', async () => {
    await seedMappingSide('payment_ncc', '331', '112', 'credit');
    const p = await map.postBiz('payment_ncc', 'payment', 8001, 1000, { tkVi: 'TK01' });
    expect(p.status).toBe('posted');

    const dao = async () => {
      const e = await gl.findBySource('payment', 8001);
      return gl.reverse(e!.id, 'kt', 'đảo thử');
    };
    const r1 = await dao();
    const r2 = await dao();
    expect(r1.status).toBe('posted');
    expect(r2).toEqual({ status: 'exists', entryId: r1.entryId });
    expect(await prisma.glEntry.count({ where: { reversalOf: p.entryId! } })).toBe(1);
    expect(await prisma.glEntry.count()).toBe(2);
    // Đảo đúng chiều: vế Có ví 1121 thành Nợ.
    expect(await linesOf(r1.entryId!)).toEqual([
      { acc: '331', dr: '0.00', cr: '1000.00' },
      { acc: '1121', dr: '1000.00', cr: '0.00' },
    ]);
  });

  test('daoTheoNguon(thu_chi_tbs) chạy lại vẫn trả glDao — người gọi đảo GL theo glDao cả hai lần ⇒ vẫn 1 bút toán đảo', async () => {
    await seedMappingSide('appr_phieu_chi_tbs_master', '642', '1121', 'credit', true);
    const p = await map.postBiz('appr_phieu_chi_tbs_master', 'appr_request', 57001, 250000, { tkVi: 'TK01' });
    expect(p.status).toBe('posted');
    await seedTreasuryEntry({ tkCode: 'TK01', type: 'out', money: D('-250000'), status: 1, sourceModule: 'thu_chi_tbs', sourceId: 57001 });

    const treasury = new TreasuryService(prisma as any);
    const chayDao = async () => {
      const kq = await prisma.$transaction((tx) => treasury.daoTheoNguon(tx, 'thu_chi_tbs', 57001, 'mở lại phiếu', 'kt'));
      // Sau commit, người gọi chạy GL đảo theo glDao (T10).
      const out = [];
      for (const g of kq.glDao) {
        const e = await gl.findBySource(g.sourceType, g.sourceId);
        if (e) out.push(await gl.reverse(e.id, 'kt', 'mở lại phiếu'));
      }
      return { kq, out };
    };
    const a = await chayDao();
    const b = await chayDao();
    expect(a.kq.daDao).toBe(1);
    expect(b.kq.daDao).toBe(0); // sổ quỹ không đảo lần 2
    expect(b.kq.glDao).toEqual([{ sourceType: 'appr_request', sourceId: 57001 }]); // …nhưng vẫn trả glDao
    expect(a.out.map((x) => x.status)).toEqual(['posted']);
    expect(b.out).toEqual([{ status: 'exists', entryId: a.out[0].entryId }]);
    expect(await prisma.glEntry.count({ where: { reversalOf: p.entryId! } })).toBe(1);
  });
});

// ───────────────────────── dấu hiệu createdBy (lý do đổi tên tác giả 25/09 ở 2 spec cũ) ─────────────────────────
describe('dấu hiệu createdBy zz*/reg trên CÙNG một bút toán ví (wallet_nap 111/131, khách thật)', () => {
  beforeEach(() => seedMapping('wallet_nap', '111', '131', true));
  const post = (sid: number, o: Record<string, unknown>) =>
    map.postBiz('wallet_nap', 'wallet_detail', sid, 500000, { cusId: 'TBS_GLVI_1', ...o });

  test("đối chứng: createdBy 'kt_gl_test' ⇒ posted", async () => {
    expect((await post(1, { createdBy: 'kt_gl_test' })).status).toBe('posted');
  });
  test("createdBy 'ZZGL_kt' ⇒ skipped", async () => {
    expect((await post(2, { createdBy: 'ZZGL_kt' })).status).toBe('skipped');
    expect(await prisma.glEntry.count()).toBe(0);
  });
  test("createdBy 'reg' ⇒ skipped", async () => {
    expect((await post(3, { createdBy: 'reg' })).status).toBe('skipped');
    expect(await prisma.glEntry.count()).toBe(0);
  });
  test("createdBy 'ZZGL_kt' + choPhepDuLieuThu ⇒ posted", async () => {
    expect((await post(4, { createdBy: 'ZZGL_kt', choPhepDuLieuThu: true })).status).toBe('posted');
  });
  test('đường thật applyEntry → postWallet: tác giả zz* ⇒ ví vẫn ghi, GL KHÔNG ghi', async () => {
    const { WalletService } = require('../../src/money/wallet.service');
    const { HoldService } = require('../../src/money/hold.service');
    const w = new WalletService(prisma as any, new HoldService(prisma as any), map);
    const r = await w.applyEntry('TBS_GLVI_2', 500_000, 0, 'nạp', 'zzappr_sale_nop');
    expect(r.ok).toBe(true);
    expect(await prisma.glEntry.count()).toBe(0);
  });
});
