// #09d L11, Task 2 — Dòng tiền (R6), quỹ trong kỳ BGĐ bản SỬA (R9), chi phí theo tham chiếu (R8a/b),
// rà trùng (R10c). Đặc tả: docs/rewrite-spec/09d-so-quy-doc-bao-cao.md §3, §5.1, §6, §7.3, §9, §13
// (Q-DOC-1/2/3/8/12).
//
// ⛔ Dữ liệu TỰ DỰNG theo công thức đặc tả. Số vàng (b)(c)(d)(h) của §9 (354.983.439.973,50 …) chạy ở
// cổng diễn tập trên bản dump (L0) — KHÔNG chép dòng tiền prod vào repo.
import { ForbiddenException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Scope } from '@prisma/client';
import { createApp } from '../../src/main';
import { PermService } from '../../src/iam/perm.service';
import { TreasuryReportService } from '../../src/treasury/treasury-report.service';
import { vnEpoch } from '../../src/treasury/report-rules';
import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { resetCustoms } from '../helpers/customs-db';
import { resetTreasury, seedFundAccount, seedTreasuryEntry } from '../helpers/treasury-db';

const D = (v: string) => new Prisma.Decimal(v);
const at = (ymd: string, hms = '10:00:00') => vnEpoch(ymd, hms)!;
/** Thời điểm "bây giờ" theo giờ VN (UTC+7). */
const vnNow = (ymd: string, hms = '12:00:00') => new Date(at(ymd, hms) * 1000);
let app: INestApplication;
let jwtSvc: JwtService;
let svc: TreasuryReportService;

beforeAll(async () => {
  app = await createApp();
  await app.init();
  jwtSvc = app.get(JwtService);
  svc = app.get(TreasuryReportService);
});
beforeEach(async () => {
  await resetIam();
  app.get(PermService).clearCache();
  await resetTreasury();
  await resetCustoms(); // tbl_exchange_rates rỗng như prod (§3.1 — 0 dòng)
});
afterAll(async () => {
  await resetTreasury();
  await resetCustoms();
  await app.close();
  await prisma.$disconnect();
});

async function tokenFor(user: { id: number; username: string }) {
  return 'Bearer ' + (await jwtSvc.signAsync({ sub: user.id, username: user.username }));
}
async function seedGranted(username: string, grants: { code: string; scope: Scope }[]) {
  const u = await seedUser({ username });
  if (grants.length) {
    const r = await seedRole('zzfl-' + username, grants);
    await assignRole(u.id, r.id);
  }
  app.get(PermService).clearCache();
  return u;
}
const all = (...codes: string[]) => codes.map((code) => ({ code, scope: Scope.all }));
const ketoan = () => seedGranted('ZZFL_ketoan', all('account.view', 'account.stats'));
const bgd = () => seedGranted('ZZFL_bgd', all('report.report_bld'));
const rate = (currency: 'CNY' | 'USD', v: string, ymd = '2026-09-01') =>
  prisma.exchangeRate.create({ data: { currency, rateVnd: D(v), rateDate: new Date(ymd + 'T00:00:00Z') } });

async function seedAccounts() {
  await seedFundAccount('TK01', { name: 'ACB', currency: 'VND', stk: 'STK-BI-MAT-01' });
  await seedFundAccount('TK02', { name: 'RMB', currency: 'CNY' });
  await seedFundAccount('TK08', { name: 'USD', currency: 'USD' });
}
const e = (d: Partial<Prisma.TreasuryEntryUncheckedCreateInput>) => seedTreasuryEntry({ tkCode: 'TK01', status: 1, ...d });

// ─────────────────────────────────────────────────────────────────────────────
// R6 — monthlyFlow
// ─────────────────────────────────────────────────────────────────────────────
describe('monthlyFlow (R6) — số prod + trường phụ (Q-DOC-2), mốc ngày 1 (Q-DOC-3)', () => {
  it('P-FL2: ngày 31/10 (sau tháng 9 có 30 ngày) ⇒ ĐỦ 6 tháng khác nhau, dòng tháng 6 và tháng 9 KHÔNG bị vứt', async () => {
    await seedAccounts();
    await e({ type: 'in', money: D('7'), cdate: at('2026-04-30', '23:59:59'), sourceModule: 'bank_tx' }); // trước mốc from
    await e({ type: 'in', money: D('1000000'), cdate: at('2026-05-01', '00:00:00'), sourceModule: 'bank_tx' }); // đúng mốc from
    await e({ type: 'in', money: D('600000'), cdate: at('2026-06-15'), sourceModule: 'bank_tx' });
    await e({ type: 'out', money: D('-300000'), cdate: at('2026-09-30', '23:59:59'), sourceModule: 'payment' });
    await e({ type: 'in', money: D('50000'), cdate: at('2026-10-31', '11:00:00'), sourceModule: '' });
    const f = await svc.monthlyFlow((await ketoan()).id, 6, vnNow('2026-10-31'));
    expect(f.thang.map((x) => x.ym)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(new Set(f.thang.map((x) => x.ym)).size).toBe(6);
    const by = Object.fromEntries(f.thang.map((x) => [x.ym, x]));
    expect(by['2026-05']).toEqual({ ym: '2026-05', in: '1000000', out: '0', net: '1000000' });
    expect(by['2026-06']).toEqual({ ym: '2026-06', in: '600000', out: '0', net: '600000' });
    expect(by['2026-09']).toEqual({ ym: '2026-09', in: '0', out: '300000', net: '-300000' });
    expect(by['2026-10']).toEqual({ ym: '2026-10', in: '50000', out: '0', net: '50000' });
    // 31/03/2027 (prod mất tháng 11 và tháng 2) và 31/12/2026 (prod mất tháng 9 và 11)
    const g = await svc.monthlyFlow((await seedGranted('ZZFL_k2', all('account.view'))).id, 6, vnNow('2027-03-31'));
    expect(g.thang.map((x) => x.ym)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
    const h = await svc.monthlyFlow((await seedGranted('ZZFL_k3', all('account.view'))).id, 6, vnNow('2026-12-31', '23:59:59'));
    expect(h.thang.map((x) => x.ym)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
    expect(h.thang.find((x) => x.ym === '2026-09')!.out).toBe('300000');
  });

  it('mệnh đề prod: status=1, loại `tranfer` + họ FX; GIỮ phí FX (fx_fee / daoxoa_fx_fee) và sổ tay; nhóm tháng theo giờ VN', async () => {
    await seedAccounts();
    await e({ type: 'in', money: D('2000000'), cdate: at('2026-09-01', '00:00:00'), sourceModule: 'bank_tx' }); // 17:00 UTC 31/08 ⇒ vẫn là tháng 9 giờ VN
    await e({ type: 'in', money: D('999'), status: 0, cdate: at('2026-09-02') });
    await e({ type: 'out', money: D('-888'), status: 9, cdate: at('2026-09-02') });
    await e({ type: 'tranfer', money: D('-100000'), cdate: at('2026-09-03') });
    for (const m of ['transfer', 'fx_transfer', 'fx_quydoi', 'fx_transfer_dao', 'fx_transfer_lai', 'fx_dieuchinh', 'fx_huy', 'fx_huy_phi', 'daoxoa_fx_transfer', 'daoxoa_fx_quydoi']) {
      await e({ type: 'in', money: D('11111'), cdate: at('2026-09-04'), sourceModule: m });
    }
    await e({ type: 'out', money: D('-50000'), cdate: at('2026-09-05'), sourceModule: 'fx_fee' });
    await e({ type: 'in', money: D('20000'), cdate: at('2026-09-06'), sourceModule: 'daoxoa_fx_fee' });
    await e({ type: 'out', money: D('-3'), cdate: at('2026-08-31', '23:59:59'), sourceModule: '' }); // tháng 8 giờ VN
    await seedTreasuryEntry({ tkCode: 'CHI-TBS', type: 'out', money: D('-40'), status: 1, cdate: at('2026-09-07') }); // mã ngoài danh mục ⇒ currency NULL ⇒ 'VND'
    const f = await svc.monthlyFlow((await ketoan()).id, 2, vnNow('2026-09-25'));
    expect(f.thang).toEqual([
      { ym: '2026-08', in: '0', out: '3', net: '-3' },
      { ym: '2026-09', in: '2020000', out: '50040', net: '1969960' },
    ]);
    expect(f.boQuaThieuTyGia).toEqual([]);
    expect(f.capDao).toEqual({ in: '0', out: '0', thang: [{ ym: '2026-08', in: '0', out: '0' }, { ym: '2026-09', in: '0', out: '0' }] });
  });

  it('cặp đảo: GIỮ trong in/out như prod NHƯNG hiện riêng ở `capDao` (không im lặng)', async () => {
    await seedAccounts();
    await e({ type: 'in', money: D('65923'), cdate: at('2026-09-02'), sourceModule: 'bank_tx' });
    const goc = await e({ type: 'out', money: D('-1234567'), cdate: at('2026-09-05'), sourceModule: 'thu_chi_tbs', sourceId: 9 });
    await e({ type: 'in', money: D('1234567'), cdate: at('2026-09-06'), sourceModule: 'daoxoa_thu_chi_tbs', sourceId: 9, reversalOf: goc.id });
    // gốc tháng 8, đảo tháng 9 ⇒ mỗi tháng một nửa cặp
    const goc8 = await e({ type: 'out', money: D('-500'), cdate: at('2026-08-20'), sourceModule: 'payment' });
    await e({ type: 'in', money: D('500'), cdate: at('2026-09-01', '08:00:00'), sourceModule: 'daoxoa_payment', reversalOf: goc8.id });
    const f = await svc.monthlyFlow((await ketoan()).id, 2, vnNow('2026-09-25'));
    expect(f.thang).toEqual([
      { ym: '2026-08', in: '0', out: '500', net: '-500' },
      { ym: '2026-09', in: '1300990', out: '1234567', net: '66423' },
    ]);
    expect(f.capDao).toEqual({
      in: '1235067',
      out: '1235067',
      thang: [{ ym: '2026-08', in: '0', out: '500' }, { ym: '2026-09', in: '1235067', out: '1234567' }],
    });
    // Dòng tiền thật tháng 9 (bỏ cặp đảo) = in − capDao.in
    expect(D(f.thang[1].in).minus(f.capDao.thang[1].in).toFixed()).toBe('65923');
  });

  it('CNY/USD KHÔNG cộng như VND: thiếu tỷ giá ⇒ bỏ khỏi in/out (như prod) và HIỆN ở `boQuaThieuTyGia`; có tỷ giá ⇒ quy đổi', async () => {
    await seedAccounts();
    await e({ type: 'in', money: D('100000'), cdate: at('2026-09-02'), sourceModule: 'bank_tx' });
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'in', money: D('1000'), status: 1, cdate: at('2026-09-03'), sourceModule: 'thu_chi_tbs' });
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-250.5'), status: 1, cdate: at('2026-09-04'), sourceModule: 'payment' });
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-4129640.16'), status: 1, cdate: at('2026-08-04'), sourceModule: 'payment' });
    await seedTreasuryEntry({ tkCode: 'TK08', type: 'out', money: D('-280.14'), status: 1, cdate: at('2026-09-05'), sourceModule: 'payment' });
    const u = await ketoan();
    const f = await svc.monthlyFlow(u.id, 2, vnNow('2026-09-25'));
    expect(f.thang).toEqual([
      { ym: '2026-08', in: '0', out: '0', net: '0' }, // P-FL1: tháng 8 thành 0 dù chi 4,13 triệu ¥
      { ym: '2026-09', in: '100000', out: '0', net: '100000' },
    ]);
    expect(f.boQuaThieuTyGia).toEqual([
      { ym: '2026-08', currency: 'CNY', in: '0', out: '4129640.16' },
      { ym: '2026-09', currency: 'CNY', in: '1000', out: '250.5' },
      { ym: '2026-09', currency: 'USD', in: '0', out: '280.14' },
    ]);
    // Có tỷ giá CNY (≤ hôm nay) ⇒ quy đổi; tỷ giá TƯƠNG LAI không dùng; USD vẫn bị bỏ.
    await rate('CNY', '3500', '2026-09-01');
    await rate('CNY', '9999', '2026-10-01');
    const g = await svc.monthlyFlow(u.id, 2, vnNow('2026-09-25'));
    expect(g.thang[1]).toEqual({ ym: '2026-09', in: '3600000', out: '876750', net: '2723250' });
    expect(g.thang[0].out).toBe('14453740560');
    expect(g.boQuaThieuTyGia).toEqual([{ ym: '2026-09', currency: 'USD', in: '0', out: '280.14' }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R9 — quyTrongKy (bản SỬA, Q-DOC-1) vs bản chép prod `bld_data.php:70-78`
// ─────────────────────────────────────────────────────────────────────────────
/** Bản CHÉP prod §6.1 — KPI quỹ: `SELECT type, SUM(money) … WHERE cdate>=from AND cdate<to GROUP BY type`. */
async function bldProd(from: number, to: number) {
  const rows = await prisma.$queryRaw<{ type: string | null; t: Prisma.Decimal }[]>`
    SELECT type, SUM(money) AS t FROM tbl_account_histories WHERE cdate >= ${from} AND cdate < ${to} GROUP BY type`;
  const t = (k: string) => new Prisma.Decimal(rows.find((r) => r.type === k)?.t ?? 0);
  return { quyIn: t('in'), quyOut: t('out').abs(), quyTranfer: t('tranfer').abs() };
}

async function seedBld() {
  await seedAccounts();
  // (A) phần GIỮ ở cả hai bản — VND, status=1, ngoài họ FX, không tranfer
  await e({ type: 'in', money: D('2000000'), cdate: at('2026-09-01', '00:00:00'), sourceModule: 'bank_tx' });
  await e({ type: 'out', money: D('-300000'), cdate: at('2026-09-02'), sourceModule: 'payment' });
  await e({ type: 'out', money: D('-50000'), cdate: at('2026-09-03'), sourceModule: 'fx_fee' }); // phí = tiền ra thật
  const goc = await e({ type: 'out', money: D('-1234567'), cdate: at('2026-09-05'), sourceModule: 'thu_chi_tbs', sourceId: 7 });
  await e({ type: 'in', money: D('1234567'), cdate: at('2026-09-06'), sourceModule: 'daoxoa_thu_chi_tbs', sourceId: 7, reversalOf: goc.id });
  // (B) status ≠ 1
  await e({ type: 'in', money: D('999'), status: 0, cdate: at('2026-09-07') });
  await e({ type: 'out', money: D('-888'), status: 9, cdate: at('2026-09-07') });
  // (C) họ FX, status=1 (mọi tệ)
  await e({ type: 'in', money: D('400000'), cdate: at('2026-09-08'), sourceModule: 'fx_transfer' });
  await e({ type: 'out', money: D('-70000'), cdate: at('2026-09-08'), sourceModule: 'fx_quydoi' });
  await seedTreasuryEntry({ tkCode: 'TK02', type: 'in', money: D('5000'), status: 1, cdate: at('2026-09-08'), sourceModule: 'fx_transfer' });
  // (D) ngoại tệ ngoài họ FX, status=1
  await seedTreasuryEntry({ tkCode: 'TK02', type: 'in', money: D('12.5'), status: 1, cdate: at('2026-09-09'), sourceModule: 'thu_chi_tbs' });
  await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-909.96'), status: 1, cdate: at('2026-09-09'), sourceModule: 'payment' });
  await seedTreasuryEntry({ tkCode: 'TK08', type: 'out', money: D('-10.25'), status: 1, cdate: at('2026-09-09'), sourceModule: 'payment' });
  // (E) luân chuyển `tranfer`
  await e({ type: 'tranfer', money: D('-100000'), cdate: at('2026-09-10') });
  await seedTreasuryEntry({ tkCode: 'TK08', type: 'tranfer', money: D('-1.5'), status: 1, cdate: at('2026-09-10') });
  await e({ type: 'tranfer', money: D('-3'), status: 0, cdate: at('2026-09-10') });
  // Ngoài kỳ [01/09, 26/09): 31/08 23:59:59 và ĐÚNG 26/09 00:00:00 (mốc cuối KHÔNG tính)
  await e({ type: 'in', money: D('777'), cdate: at('2026-08-31', '23:59:59'), sourceModule: 'bank_tx' });
  await e({ type: 'in', money: D('555'), cdate: at('2026-09-26', '00:00:00'), sourceModule: 'bank_tx' });
}

describe('quyTrongKy (R9) — bản SỬA khác bản chép prod ĐÚNG bằng phần status / FX / tranfer / ngoại tệ', () => {
  const F = () => at('2026-09-01', '00:00:00');
  const T = () => at('2026-09-26', '00:00:00');

  it('bản sửa: VND status=1 loại tranfer + họ FX; ngoại tệ tách theo tệ; luân chuyển theo tệ; cặp đảo minh bạch', async () => {
    await seedBld();
    const q = await svc.quyTrongKy((await bgd()).id, F(), T());
    expect(q.thu).toBe('3234567');
    expect(q.chi).toBe('1584567');
    expect(q.theoTe).toEqual({ CNY: { thu: '12.5', chi: '909.96' }, USD: { thu: '0', chi: '10.25' } });
    expect(q.luanChuyenNoiBo).toEqual({
      VND: { vao: '400000', ra: '170000' },
      CNY: { vao: '5000', ra: '0' },
      USD: { vao: '0', ra: '1.5' },
    });
    expect(q.capDao).toEqual({ thu: '1234567', chi: '1234567' });
  });

  it('đối chứng: prod − sửa = Σ các thành phần, TỪNG thành phần khớp (test sẽ ĐỎ nếu quyTrongKy chép prod)', async () => {
    await seedBld();
    const q = await svc.quyTrongKy((await bgd()).id, F(), T());
    const p = await bldProd(F(), T());
    expect(p.quyIn.toFixed()).toBe('3640578.5');
    expect(p.quyOut.toFixed()).toBe('1656375.21');
    expect(p.quyTranfer.toFixed()).toBe('100004.5');

    // THU: prod − sửa = (B) status≠1 + (C) chân FX mọi tệ + (D) ngoại tệ ngoài FX
    const thuStatus = D('999');
    const thuFx = D('400000').plus('5000');
    const thuNgoaiTe = D(q.theoTe.CNY.thu).plus(q.theoTe.USD.thu);
    expect(thuNgoaiTe.toFixed()).toBe('12.5');
    expect(p.quyIn.minus(q.thu).toFixed()).toBe(thuStatus.plus(thuFx).plus(thuNgoaiTe).toFixed());
    // chân FX = đúng phần `vao` của luân chuyển nội bộ status=1
    expect(D(q.luanChuyenNoiBo.VND.vao).plus(q.luanChuyenNoiBo.CNY.vao).plus(q.luanChuyenNoiBo.USD.vao).toFixed()).toBe(thuFx.toFixed());

    // CHI: prod − sửa = (B) status≠1 + (C) chân FX `out` + (D) ngoại tệ ngoài FX
    const chiStatus = D('888');
    const chiFx = D('70000');
    const chiNgoaiTe = D(q.theoTe.CNY.chi).plus(q.theoTe.USD.chi);
    expect(chiNgoaiTe.toFixed()).toBe('920.21');
    expect(p.quyOut.minus(q.chi).toFixed()).toBe(chiStatus.plus(chiFx).plus(chiNgoaiTe).toFixed());

    // TRANFER: prod cộng lẫn mọi tệ + mọi status; bản sửa tách theo tệ, chỉ status=1
    //  prod 100.004,5 = VND 100.000 (status=1) + USD 1,5 (ngoại tệ) + 3 (status 0)
    expect(p.quyTranfer.minus('100000').minus('1.5').toFixed()).toBe('3');
    expect(D(q.luanChuyenNoiBo.VND.ra).minus(chiFx).toFixed()).toBe('100000');
    expect(q.luanChuyenNoiBo.USD.ra).toBe('1.5');

    // Chép prod thì Thu/Chi KHÁC bản sửa (khoá lại: test này đỏ nếu ai "trung thành" nhầm)
    expect(q.thu).not.toBe(p.quyIn.toFixed());
    expect(q.chi).not.toBe(p.quyOut.toFixed());
  });

  it('một nguồn, hai màn: quyTrongKy(cả tháng) == monthlyFlow tháng đó (khi 0 tỷ giá)', async () => {
    await seedBld();
    const u = await seedGranted('ZZFL_both', all('account.view', 'report.report_bld'));
    const q = await svc.quyTrongKy(u.id, F(), at('2026-10-01', '00:00:00'));
    const f = await svc.monthlyFlow(u.id, 1, vnNow('2026-09-30'));
    expect(f.thang).toEqual([{ ym: '2026-09', in: q.thu, out: q.chi, net: D(q.thu).minus(q.chi).toFixed() }]);
    expect(q.thu).toBe('3235122'); // + dòng 555 lúc 26/09 00:00
  });

  it('route: mặc định kỳ = ngày 1 tháng này → NGÀY MAI (không tính ngày `to`), kèm bảng 12 tháng = monthlyFlow(12)', async () => {
    await seedBld();
    const k = await tokenFor(await bgd());
    const r = await request(app.getHttpServer()).get('/treasury/quy-trong-ky?from=2026-09-01&to=2026-09-26').set('Authorization', k).expect(200);
    expect(r.body.thu).toBe('3234567');
    expect(r.body.ky).toEqual({ from: at('2026-09-01', '00:00:00'), toExclusive: at('2026-09-26', '00:00:00') });
    expect(r.body.bang12Thang.thang).toHaveLength(12);
    const d = await request(app.getHttpServer()).get('/treasury/quy-trong-ky').set('Authorization', k).expect(200);
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    expect(d.body.ky.from).toBe(at(today.slice(0, 8) + '01', '00:00:00'));
    expect(d.body.ky.toExclusive).toBe(at(today, '00:00:00') + 86400);
    await request(app.getHttpServer()).get('/treasury/quy-trong-ky?from=2026-13-01').set('Authorization', k).expect(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R8a/b — costSummary / costByRef (+ missingRate, Q-DOC-8)
// ─────────────────────────────────────────────────────────────────────────────
async function seedCost() {
  await seedAccounts();
  await e({ type: 'out', money: D('-500000'), cdate: at('2026-09-02'), poId: 101, sourceModule: 'payment' });
  await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-100'), status: 1, cdate: at('2026-09-03'), poId: 101, sourceModule: 'payment' });
  await e({ type: 'in', money: D('20000'), cdate: at('2026-09-04'), poId: 101, sourceModule: 'thu_chi_tbs' });
  await e({ type: 'out', money: D('-9999'), status: 0, cdate: at('2026-09-04'), poId: 101 }); // status≠1 ⇒ bỏ
  await e({ type: 'out', money: D('-10000'), cdate: at('2026-09-05'), poId: 102, sourceModule: 'payment' });
  await e({ type: 'out', money: D('-1'), cdate: at('2026-08-31', '23:59:59'), poId: 103 }); // ngoài kỳ
  const goc = await e({ type: 'out', money: D('-1000000'), cdate: at('2026-09-06'), containerId: 7, sourceModule: 'thu_chi_tbs' });
  await e({ type: 'in', money: D('1000000'), cdate: at('2026-09-07'), containerId: 7, sourceModule: 'daoxoa_thu_chi_tbs', reversalOf: goc.id });
  await e({ type: 'out', money: D('-3'), cdate: at('2026-09-07') }); // không gắn ref ⇒ bỏ
}

describe('costSummary / costByRef (R8a/b) — missingRate khi thiếu tỷ giá (P-CR1)', () => {
  it('thiếu tỷ giá CNY ⇒ phần ¥ quy về 0 như prod NHƯNG missingRate=true; sắp chi_vnd giảm dần; kỳ from/to (to TÍNH)', async () => {
    await seedCost();
    const u = await ketoan();
    const s = await svc.costSummary(u.id, 'po_id', at('2026-09-01', '00:00:00'), at('2026-09-05', '10:00:00'));
    expect(s).toEqual([
      { ref: 101, chiVnd: '500000', thuVnd: '20000', n: 3, missingRate: true, boQuaThieuTyGia: [{ currency: 'CNY', chi: '100', thu: '0' }] },
      { ref: 102, chiVnd: '10000', thuVnd: '0', n: 1, missingRate: false, boQuaThieuTyGia: [] },
    ]);
    await rate('CNY', '3500');
    const t = await svc.costSummary(u.id, 'po_id', at('2026-09-01', '00:00:00'), at('2026-09-30', '23:59:59'));
    expect(t[0]).toEqual({ ref: 101, chiVnd: '850000', thuVnd: '20000', n: 3, missingRate: false, boQuaThieuTyGia: [] });
    // from/to = 0 ⇒ không giới hạn (gồm PO 103 tháng 8)
    expect((await svc.costSummary(u.id, 'po_id', 0, 0)).map((x) => x.ref)).toEqual([101, 102, 103]);
    const c = await svc.costSummary(u.id, 'container_id', 0, 0);
    expect(c).toEqual([{ ref: 7, chiVnd: '1000000', thuVnd: '1000000', n: 2, missingRate: false, boQuaThieuTyGia: [] }]);
  });

  it('costByRef (hàm nội bộ, không route — Q-DOC-8): chi/thu gốc cộng lẫn tệ như prod, *_vnd + missingRate, dòng theo cdate,id', async () => {
    await seedCost();
    const u = await ketoan();
    const r = await svc.costByRef(u.id, 'po_id', 101);
    expect({ chi: r.chi, thu: r.thu, chiVnd: r.chiVnd, thuVnd: r.thuVnd, missingRate: r.missingRate })
      .toEqual({ chi: '500100', thu: '20000', chiVnd: '500000', thuVnd: '20000', missingRate: true });
    expect(r.rows.map((x) => [x.money, x.currency, x.moneyVnd])).toEqual([
      ['-500000', 'VND', '-500000'], ['-100', 'CNY', '0'], ['20000', 'VND', '20000'],
    ]);
    expect(JSON.stringify(r)).not.toContain('STK-BI-MAT');
    expect((await svc.costByRef(u.id, 'po_id', 0)).rows).toEqual([]);
    expect((await svc.costByRef(u.id, 'order_code', '')).rows).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R10c — suspectDuplicates (chép prod, KHÔNG lọc status) + cờ Q-DOC-12
// ─────────────────────────────────────────────────────────────────────────────
describe('suspectDuplicates (R10c) — cụm chép prod + cờ dòng đảo / status≠1', () => {
  it('gom bắc cầu ≤30 phút theo (tk, số tiền CÓ dấu); cờ daBiDao / laDongDao / chuaLenSo ở dòng và cụm', async () => {
    await seedAccounts();
    const d = '2026-09-10';
    // Cụm 1 (sạch): TK01 −555 ×2 cách 29 phút
    await e({ type: 'out', money: D('-555'), cdate: at(d, '08:00:00') });
    await e({ type: 'out', money: D('-555'), cdate: at(d, '08:29:00') });
    await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-555'), status: 1, cdate: at(d, '08:10:00') }); // khác ví ⇒ không gộp
    await e({ type: 'in', money: D('555'), cdate: at(d, '08:15:00') }); // khác dấu ⇒ không gộp
    // Cụm 2 (status≠1 + bắc cầu): 10:00, 10:20 (status 9), 10:45
    await e({ type: 'out', money: D('-300000'), cdate: at(d, '10:00:00') });
    await e({ type: 'out', money: D('-300000.004'), status: 9, cdate: at(d, '10:20:00') }); // làm tròn 2 số ⇒ cùng khoá
    await e({ type: 'out', money: D('-300000'), cdate: at(d, '10:45:00') });
    await e({ type: 'out', money: D('-300000'), cdate: at(d, '11:16:00') }); // cách 31 phút ⇒ ngoài cụm
    // Cụm 3 (gốc đã bị đảo) + cụm 4 (dòng đảo)
    const goc = await e({ type: 'out', money: D('-777'), cdate: at(d, '09:00:00') });
    await e({ type: 'out', money: D('-777'), cdate: at(d, '09:05:00') });
    await e({ type: 'in', money: D('777'), cdate: at(d, '13:00:00'), reversalOf: goc.id, sourceModule: 'daoxoa_thu_chi_tbs' });
    await e({ type: 'in', money: D('777'), cdate: at(d, '13:01:00') });
    await e({ type: 'in', money: D('0'), cdate: at(d, '13:02:00') }); // money=0 bỏ
    await e({ type: 'in', money: D('0'), cdate: at(d, '13:03:00') });
    await e({ type: 'out', money: D('-555'), cdate: at('2026-09-09', '23:59:00') }); // ngoài kỳ

    const u = await ketoan();
    const c = await svc.suspectDuplicates(u.id, '', at(d, '00:00:00'), at(d, '23:59:59'));
    expect(c.map((x) => [x.tkCode, x.money, x.n, x.canXem])).toEqual([
      // thứ tự cụm = thứ tự GẶP khoá lần đầu trên `ORDER BY tk_code, cdate` (mảng PHP giữ thứ tự chèn)
      ['TK01', '-555.00', 2, false],
      ['TK01', '-777.00', 2, true],
      ['TK01', '-300000.00', 3, true],
      ['TK01', '777.00', 2, true],
    ]);
    expect(c[2].rows.map((x) => [x.status, x.chuaLenSo])).toEqual([[1, false], [9, true], [1, false]]);
    expect(c[1].rows.map((x) => x.daBiDao)).toEqual([true, false]);
    expect(c[3].rows.map((x) => x.laDongDao)).toEqual([true, false]);
    expect(c[0].rows.every((x) => !x.daBiDao && !x.laDongDao && !x.chuaLenSo)).toBe(true);
    // lọc ví
    const t2 = await svc.suspectDuplicates(u.id, 'TK02', 0, 0);
    expect(t2).toEqual([]);
    // cửa sổ 60 phút ⇒ −300000 gom cả 4
    const w = await svc.suspectDuplicates(u.id, 'TK01', at(d, '00:00:00'), at(d, '23:59:59'), 60);
    expect(w.find((x) => x.money === '-300000.00')!.n).toBe(4);
  });

  it('route: tdate +86.399 giây; tham số lạ ⇒ 400', async () => {
    await seedAccounts();
    await e({ type: 'out', money: D('-5'), cdate: at('2026-09-10', '23:50:00') });
    await e({ type: 'out', money: D('-5'), cdate: at('2026-09-10', '23:59:59') });
    const k = await tokenFor(await ketoan());
    const r = await request(app.getHttpServer()).get('/treasury/suspect-duplicates?fdate=2026-09-10&tdate=2026-09-10').set('Authorization', k).expect(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0].rows).toHaveLength(2);
    await request(app.getHttpServer()).get('/treasury/suspect-duplicates?stk=1').set('Authorization', k).expect(400);
  });

  describe('route: kỳ MẶC ĐỊNH chép prod (check_trung.php:13-24) — đồng hồ ĐÓNG BĂNG', () => {
    // 25/09/2026 00:30 giờ VN = 24/09 17:30 UTC ⇒ "hôm nay" phải là 25/09 (giờ VN), không phải 24/09.
    beforeEach(() => {
      jest.useFakeTimers({
        now: at('2026-09-25', '00:30:00') * 1000,
        doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance'],
      });
    });
    afterEach(() => jest.useRealTimers());

    it('fdate = 00:00 VN (hôm nay − 7 ngày lịch) TÍNH; tdate = hôm nay 23:59:59 VN TÍNH; ngày sai định dạng ⇒ về mặc định; tháng 13 ⇒ 400', async () => {
      await seedAccounts();
      // mỗi số tiền một cặp cách nhau vài phút ⇒ cụm chỉ hiện khi CẢ HAI dòng lọt vào kỳ
      await e({ type: 'out', money: D('-11'), cdate: at('2026-09-18', '00:00:00') }); // đúng mốc đầu ⇒ TÍNH
      await e({ type: 'out', money: D('-11'), cdate: at('2026-09-18', '00:10:00') });
      await e({ type: 'out', money: D('-22'), cdate: at('2026-09-17', '23:40:00') }); // trước mốc ⇒ KHÔNG
      await e({ type: 'out', money: D('-22'), cdate: at('2026-09-17', '23:59:59') });
      await e({ type: 'out', money: D('-33'), cdate: at('2026-09-25', '23:50:00') });
      await e({ type: 'out', money: D('-33'), cdate: at('2026-09-25', '23:59:59') }); // đúng mốc cuối ⇒ TÍNH
      await e({ type: 'out', money: D('-44'), cdate: at('2026-09-26', '00:00:00') }); // sau mốc ⇒ KHÔNG
      await e({ type: 'out', money: D('-44'), cdate: at('2026-09-26', '00:05:00') });
      const k = await tokenFor(await ketoan());
      const get = (qs: string) => request(app.getHttpServer()).get('/treasury/suspect-duplicates' + qs).set('Authorization', k);
      const mac = (await get('').expect(200)).body;
      expect(mac.map((c: any) => [c.money, c.n])).toEqual([['-11.00', 2], ['-33.00', 2]]);
      // sai định dạng ⇒ về mặc định (như màn web), KHÔNG lỗi
      expect((await get('?fdate=18/09/2026&tdate=abc').expect(200)).body).toEqual(mac);
      // khớp mẫu nhưng không phải ngày lịch ⇒ 400 (quy ước Task 1)
      await get('?fdate=2026-13-01').expect(400);
      // tường minh vẫn chạy như cũ
      expect((await get('?fdate=2026-09-17&tdate=2026-09-26').expect(200)).body.map((c: any) => c.money))
        .toEqual(['-22.00', '-11.00', '-33.00', '-44.00']);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quyền (§9) — chép prod, fail-closed
// ─────────────────────────────────────────────────────────────────────────────
describe('quyền route (§9)', () => {
  const routes: [string, string[]][] = [
    ['/treasury/monthly-flow', ['account.view']],
    ['/treasury/quy-trong-ky', ['report.report_bld']],
    ['/treasury/cost-summary', ['account.stats']],
    ['/treasury/suspect-duplicates', ['account.stats']],
  ];
  it.each(routes)('%s: có %j ⇒ 200; thiếu ⇒ 403; phạm vi hẹp ⇒ 403; chưa đăng nhập ⇒ 401', async (path, perms) => {
    await seedAccounts();
    const ok = await seedGranted('ZZFL_ok', all(...perms));
    await request(app.getHttpServer()).get(path).set('Authorization', await tokenFor(ok)).expect(200);
    // có các quyền "hàng xóm" nhưng KHÔNG có quyền của route
    const others = ['account.view', 'account.stats', 'report.report_bld', 'report.view'].filter((p) => !perms.includes(p));
    const no = await seedGranted('ZZFL_no', all(...others));
    await request(app.getHttpServer()).get(path).set('Authorization', await tokenFor(no)).expect(403);
    const own = await seedGranted('ZZFL_own', perms.map((code) => ({ code, scope: Scope.own })));
    await request(app.getHttpServer()).get(path).set('Authorization', await tokenFor(own)).expect(403);
    await request(app.getHttpServer()).get(path).expect(401);
  });

  it('service tự chặn khi gọi ngoài HTTP (không dựa riêng vào guard)', async () => {
    const v = await seedGranted('ZZFL_v', all('account.view'));
    await expect(svc.quyTrongKy(v.id, 0, 1)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.costSummary(v.id, 'po_id', 0, 0)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.costByRef(v.id, 'po_id', 1)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.suspectDuplicates(v.id, '', 0, 0)).rejects.toBeInstanceOf(ForbiddenException);
    const b = await bgd();
    await expect(svc.monthlyFlow(b.id, 6)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cost-summary: `by` lạ ⇒ 400; không trả stk', async () => {
    await seedCost();
    const k = await tokenFor(await ketoan());
    await request(app.getHttpServer()).get('/treasury/cost-summary?by=order').set('Authorization', k).expect(400);
    const r = await request(app.getHttpServer()).get('/treasury/cost-summary?by=po&from=2026-09-01&to=2026-09-30').set('Authorization', k).expect(200);
    expect(r.body.map((x: any) => x.ref)).toEqual([101, 102]);
    expect(JSON.stringify(r.body)).not.toContain('STK');
  });
});
