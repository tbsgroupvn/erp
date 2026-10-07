// #09d L11, Task 1 — SAO KÊ tài khoản quỹ (R5): `GET /treasury/accounts/:code/statement`.
// Đặc tả: docs/rewrite-spec/09d-so-quy-doc-bao-cao.md §2.1–2.2 (tbs_sk_loc / tbs_sk_doc :86-161),
//         §2.5 (DTO allow-list — KHÔNG `stk`, Q-DOC-9), §9 (quyền `account.view` + `account.stats`),
//         §11 P-SK1 (không có tk ⇒ ở v2 mã nằm trên path, mã lạ ⇒ 404) / P-SK2 (lọc chiều chồng lấn).
//
// ⛔ Dữ liệu TỰ DỰNG theo công thức đặc tả. Số vàng (a) — 15 ví × 3 kỳ của §2.4 — chạy ở cổng diễn
// tập trên bản dump (L0), KHÔNG chép dòng tiền prod vào repo.
//
// Dựng app qua createApp() — đúng entrypoint production (3 guard toàn cục).
import { INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Scope } from '@prisma/client';
import { createApp } from '../../src/main';
import { PermService } from '../../src/iam/perm.service';
import { TreasuryService } from '../../src/money/treasury.service';
import { TreasuryReportService } from '../../src/treasury/treasury-report.service';
import { tbsSkLoc, vnEpoch, vnYmd } from '../../src/treasury/report-rules';
import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { resetApproval, seedTemplate } from '../helpers/approval-db';
import { resetTreasury, seedFundAccount, seedTreasuryEntry } from '../helpers/treasury-db';

const D = (v: string) => new Prisma.Decimal(v);
const at = (ymd: string, hms = '10:00:00') => vnEpoch(ymd, hms)!;
let app: INestApplication;
let jwtSvc: JwtService;

beforeAll(async () => {
  app = await createApp();
  await app.init();
  jwtSvc = app.get(JwtService);
});
beforeEach(async () => {
  await resetApproval();
  await resetIam();
  app.get(PermService).clearCache();
  await resetTreasury();
});
afterAll(async () => {
  await resetTreasury();
  await resetApproval();
  await app.close();
  await prisma.$disconnect();
});

async function tokenFor(user: { id: number; username: string }) {
  return 'Bearer ' + (await jwtSvc.signAsync({ sub: user.id, username: user.username }));
}
async function seedGranted(username: string, grants: { code: string; scope: Scope }[]) {
  const u = await seedUser({ username });
  if (grants.length) {
    const r = await seedRole('zzsk-' + username, grants);
    await assignRole(u.id, r.id);
  }
  app.get(PermService).clearCache();
  return u;
}
const ketoan = () => seedGranted('ZZSK_ketoan', [
  { code: 'account.view', scope: Scope.all },
  { code: 'account.stats', scope: Scope.all },
]);

/** Id các dòng TK01 theo số thứ tự dựng (r[1]…r[13]). */
type Seeded = { r: Record<number, number>; reqId: number };

async function seedSaoKe(): Promise<Seeded> {
  await seedFundAccount('TK01', { name: 'ACB Công Ty', currency: 'VND', openingBalance: D('1000000'), displayOrder: 1, stk: 'STK-BI-MAT-01', bankCode: 'ACB' });
  await seedFundAccount('TK02', { name: 'RMB AGENT', currency: 'CNY', openingBalance: D('28244.84'), displayOrder: 2, stk: 'STK-BI-MAT-02' });
  await seedFundAccount('TK08', { name: 'USD AGENT', currency: 'USD', displayOrder: 3 });
  await seedFundAccount('TK07', { name: 'TK CỌC (ẩn)', currency: 'VND', accGroup: 'store', isActive: 0, displayOrder: 9 });

  const tpl = await seedTemplate('thu_chi_tbs', { objectType: 'thu_chi_tbs' });
  const req = await prisma.approvalRequest.create({ data: {
    templateId: tpl.id, objectType: 'thu_chi_tbs', objectId: 0, currentStepOrder: 1, status: 2,
    submittedBy: 'zz', submittedAt: at('2026-09-05'), formData: JSON.stringify({ ly_do: 'Mua VPP', nd_thanh_toan: 'khác' }),
  } });

  const r: Record<number, number> = {};
  const e = async (n: number, d: Partial<Prisma.TreasuryEntryUncheckedCreateInput>) => {
    r[n] = (await seedTreasuryEntry({ tkCode: 'TK01', ...d })).id;
  };
  await e(1, { type: 'in', money: D('500000'), status: 1, cdate: at('2026-08-15'), sourceModule: 'bank_tx' });
  await e(2, { type: 'out', money: D('-7777'), status: 0, cdate: at('2026-08-16') });
  await e(3, { type: 'out', money: D('-200000'), status: 1, cdate: at('2026-08-31', '23:59:59'), sourceModule: 'payment' });
  await e(4, { type: 'in', money: D('2000000'), status: 1, cdate: at('2026-09-01', '00:00:00'), sourceModule: 'bank_tx', note: 'Nạp ví (CK) a_b', walletDetailId: 5 });
  await e(5, { type: 'out', money: D('-300000.5'), status: 1, cdate: at('2026-09-02'), sourceModule: 'payment', note: 'Chi (TM) axb', walletDetailId: 6, tranId: 777888n });
  await e(6, { type: 'tranfer', money: D('-100000'), status: 1, cdate: at('2026-09-03'), note: 'chuyển TK02' });
  await e(7, { type: 'in', money: D('400000'), status: 1, cdate: at('2026-09-03', '11:00:00'), sourceModule: 'fx_transfer', sourceId: 31 });
  await e(8, { type: 'in', money: D('999'), status: 0, cdate: at('2026-09-04') });
  await e(9, { type: 'out', money: D('-888'), status: 9, cdate: at('2026-09-04', '11:00:00') });
  await e(10, { type: 'out', money: D('-1234567'), status: 1, cdate: at('2026-09-05'), sourceModule: 'thu_chi_tbs', sourceId: req.id, note: 'Chi phí khác' });
  await e(11, { type: 'in', money: D('1234567'), status: 1, cdate: at('2026-09-06'), sourceModule: 'daoxoa_thu_chi_tbs', sourceId: req.id, reversalOf: r[10], note: 'Đảo phiếu' });
  await e(12, { type: 'out', money: D('-50000'), status: 1, cdate: at('2026-09-15', '23:59:59'), sourceModule: 'fx_fee', bankInfo: 'VCB' });
  await e(13, { type: 'in', money: D('7'), status: 1, cdate: at('2026-09-16', '00:00:00'), sourceModule: 'manual' });

  // Quỹ ÂM (CNY) — có dòng 0/9 xen giữa.
  await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-909243.96'), status: 1, cdate: at('2026-09-02'), sourceModule: 'payment' });
  await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-5'), status: 0, cdate: at('2026-09-02', '11:00:00') });
  await seedTreasuryEntry({ tkCode: 'TK02', type: 'in', money: D('12.5'), status: 1, cdate: at('2026-09-03'), sourceModule: 'fx_transfer' });
  await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-6'), status: 9, cdate: at('2026-09-03', '11:00:00') });
  // Ngoại tệ USD — âm nhỏ lẻ.
  await seedTreasuryEntry({ tkCode: 'TK08', type: 'in', money: D('1000.25'), rate: D('26100'), status: 1, cdate: at('2026-09-02'), sourceModule: 'fx_transfer' });
  await seedTreasuryEntry({ tkCode: 'TK08', type: 'out', money: D('-1000.66'), status: 1, cdate: at('2026-09-03'), sourceModule: 'payment' });
  // Ví ẩn.
  await seedTreasuryEntry({ tkCode: 'TK07', type: 'in', money: D('949'), status: 1, cdate: at('2026-09-05') });
  // Mã gần giống — không được lẫn vào TK01.
  await seedTreasuryEntry({ tkCode: 'TK011', type: 'in', money: D('123456'), status: 1, cdate: at('2026-09-05') });
  return { r, reqId: req.id };
}

function get(token: string, code: string, qs = '') {
  return request(app.getHttpServer()).get(`/treasury/accounts/${code}/statement${qs}`).set('Authorization', token);
}
const TODAY = () => vnYmd();
const ids = (rows: any[]) => rows.map((x) => x.id);

describe('sao kê — bất biến đầu kỳ + vào − ra = cuối kỳ = số dư chạy dòng mới nhất = getBalance()', () => {
  it.each([
    ['TK01', '3250006.5'],
    ['TK02', '-880986.62'], // quỹ ÂM
    ['TK08', '-0.41'],      // ngoại tệ
    ['TK07', '949'],        // ví ẩn vẫn sao kê được (getAccount không lọc is_active)
  ])('%s: kỳ chạm hôm nay ⇒ mọi đại lượng khớp %s', async (code, bal) => {
    await seedSaoKe();
    const k = await tokenFor(await ketoan());
    const res = await get(k, code, `?fdate=2026-09-01&tdate=${TODAY()}&sort=asc`).expect(200);
    const b = res.body;
    const tinh = D(b.dauKy).plus(b.kyVao).minus(b.kyRa);
    expect(tinh.toFixed()).toBe(b.cuoiKy);
    expect(b.cuoiKy).toBe(bal);
    expect(b.coSoDuChay).toBe(true);
    expect(b.rows[b.rows.length - 1].soDu).toBe(bal);
    expect(b.soDuVi).toBe(bal);
    expect((await app.get(TreasuryService).getBalance(code)).toFixed()).toBe(bal);
  });

  it('TK01 chi tiết: đầu kỳ tính cả dòng 23:59:59 ngày trước; hai đầu kỳ đều TÍNH; 0/9 không vào KPI; cặp đảo vào cả hai cột', async () => {
    const { r } = await seedSaoKe();
    const k = await tokenFor(await ketoan());
    const b = (await get(k, 'TK01', `?fdate=2026-09-01&tdate=${TODAY()}`).expect(200)).body;
    expect(b.dauKy).toBe('1300000');       // 1.000.000 + 500.000 − 200.000 (dòng 0 của 16/08 không tính)
    expect(b.kyVao).toBe('3634574');       // 2.000.000 + 400.000 (chân FX) + 1.234.567 (dòng đảo) + 7
    expect(b.kyNVao).toBe(4);
    expect(b.kyRa).toBe('1684567.5');      // 300.000,5 + 100.000 (tranfer) + 1.234.567 + 50.000
    expect(b.kyNRa).toBe(4);
    // Bảng mặc định (tt=1, desc): đúng 8 dòng status=1 của kỳ, mới nhất trước.
    expect(ids(b.rows)).toEqual([r[13], r[12], r[11], r[10], r[7], r[6], r[5], r[4]]);
    expect(b.locN).toBe(8);
    expect(b.locVao).toBe('3634574');
    expect(b.locRa).toBe('1684567.5');
    expect(b.rows.map((x: any) => x.soDu)).toEqual(['3250006.5', '3249999.5', '3299999.5', '2065432.5', '3299999.5', '2899999.5', '2999999.5', '3300000']);
    expect(b.catBot).toBe(false);
    expect(b).toMatchObject({ trang: 1, soTrang: 1, tuDong: 0, ky: { fdate: '2026-09-01', tdate: TODAY() } });
  });

  it('kỳ trong QUÁ KHỨ: soDuVi = null; cuối kỳ tháng trước = đầu kỳ kỳ sau (nối liền)', async () => {
    await seedSaoKe();
    const k = await tokenFor(await ketoan());
    const a = (await get(k, 'TK01', '?fdate=2026-09-01&tdate=2026-09-15').expect(200)).body;
    expect(a.soDuVi).toBeNull();
    expect(a.kyVao).toBe('3634567');
    expect(a.kyRa).toBe('1684567.5'); // dòng 23:59:59 ngày 15 TÍNH
    expect(a.cuoiKy).toBe('3249999.5');
    const b = (await get(k, 'TK01', `?fdate=2026-09-16&tdate=${TODAY()}`).expect(200)).body;
    expect(b.dauKy).toBe(a.cuoiKy);
    const t8 = (await get(k, 'TK01', '?fdate=2026-08-01&tdate=2026-08-31').expect(200)).body;
    expect(t8.cuoiKy).toBe('1300000');
    expect(t8.cuoiKy).toBe(a.dauKy);
  });
});

describe('sao kê — bộ lọc bảng dòng (KPI KHÔNG đổi theo bộ lọc phụ)', () => {
  it('P-SK2 GHIM hành vi prod: chân FX `in` nằm ở CẢ "vao" lẫn "chuyen" ⇒ tổng ba chiều > số dòng', async () => {
    // ⚠ Chồng lấn này là HÀNH VI PROD (account_statement.php:121-123 — `vao` = money>0 AND type<>'tranfer',
    // `chuyen` = type='tranfer' OR dieuKienHoFx). Đặc tả §11 P-SK2 ghi nhận, KHÔNG sửa ở L11. Ai muốn
    // tách thì phải đổi đặc tả trước rồi mới sửa ca này.
    const { r } = await seedSaoKe();
    const k = await tokenFor(await ketoan());
    const q = `?fdate=2026-09-01&tdate=${TODAY()}&sort=asc`;
    const all = (await get(k, 'TK01', q).expect(200)).body;
    const vao = (await get(k, 'TK01', q + '&chieu=vao').expect(200)).body;
    const ra = (await get(k, 'TK01', q + '&chieu=ra').expect(200)).body;
    const chuyen = (await get(k, 'TK01', q + '&chieu=chuyen').expect(200)).body;
    expect(ids(vao.rows)).toEqual([r[4], r[7], r[11], r[13]]);
    expect(ids(ra.rows)).toEqual([r[5], r[10], r[12]]);       // tranfer (r6) KHÔNG ở "ra"
    expect(ids(chuyen.rows)).toEqual([r[6], r[7]]);           // r7 = chân FX, cũng ở "vao"
    expect(vao.locN + ra.locN + chuyen.locN).toBe(9);
    expect(all.locN).toBe(8);
    // Lọc phụ ⇒ tắt số dư chạy; KPI giữ nguyên.
    for (const x of [vao, ra, chuyen]) {
      expect(x.coSoDuChay).toBe(false);
      expect(x.rows.every((row: any) => row.soDu === null)).toBe(true);
      expect([x.dauKy, x.kyVao, x.kyRa, x.cuoiKy]).toEqual([all.dauKy, all.kyVao, all.kyRa, all.cuoiKy]);
    }
    expect(vao.locVao).toBe('3634574');
    expect(vao.locRa).toBe('0');
    expect(chuyen.locVao).toBe('400000');
    expect(chuyen.locRa).toBe('100000');
  });

  it('tt=all/0/9: dòng treo/huỷ hiện ra với soDu=null và không đổi KPI', async () => {
    const { r } = await seedSaoKe();
    const k = await tokenFor(await ketoan());
    const q = `?fdate=2026-09-01&tdate=${TODAY()}&sort=asc`;
    const all = (await get(k, 'TK01', q + '&tt=all').expect(200)).body;
    expect(ids(all.rows)).toEqual([r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12], r[13]]);
    expect(all.coSoDuChay).toBe(false);
    expect(all.locVao).toBe('3635573'); // loc_* cộng trên dòng ĐÃ LỌC (kể cả status 0)
    expect(all.locRa).toBe('1685455.5');
    expect(all.kyVao).toBe('3634574');
    const t0 = (await get(k, 'TK01', q + '&tt=0').expect(200)).body;
    expect(ids(t0.rows)).toEqual([r[8]]);
    expect(t0.rows[0]).toMatchObject({ status: 0, trangThai: 'Chờ ghi sổ', soDu: null });
    const t9 = (await get(k, 'TK01', q + '&tt=9').expect(200)).body;
    expect(ids(t9.rows)).toEqual([r[9]]);
    expect(t9.rows[0].trangThai).toBe('Đã huỷ');
  });

  it('q: LIKE thoát `_` (a_b ≠ axb), không phân biệt hoa/thường; chuỗi số khớp id / tranId / sourceId', async () => {
    const { r, reqId } = await seedSaoKe();
    const k = await tokenFor(await ketoan());
    const q = `?fdate=2026-09-01&tdate=${TODAY()}&sort=asc&tt=all`;
    expect(ids((await get(k, 'TK01', q + '&q=a_b').expect(200)).body.rows)).toEqual([r[4]]);
    expect(ids((await get(k, 'TK01', q + '&q=A_B').expect(200)).body.rows)).toEqual([r[4]]);
    expect(ids((await get(k, 'TK01', q + '&q=' + encodeURIComponent('%')).expect(200)).body.rows)).toEqual([]);
    expect(ids((await get(k, 'TK01', q + '&q=777888').expect(200)).body.rows)).toEqual([r[5]]);   // tranId
    expect(ids((await get(k, 'TK01', q + '&q=' + r[9]).expect(200)).body.rows)).toEqual([r[9]]);  // id
    expect(ids((await get(k, 'TK01', q + '&q=31').expect(200)).body.rows)).toEqual([r[7]]);       // sourceId
    expect(reqId).toBe(1);
  });

  it('min/max theo |money| với số kiểu VN; loai TM/CK; bank; nguon (kể cả nguồn rỗng)', async () => {
    const { r } = await seedSaoKe();
    const k = await tokenFor(await ketoan());
    const q = `?fdate=2026-09-01&tdate=${TODAY()}&sort=asc`;
    expect(ids((await get(k, 'TK01', q + '&min=1.000.000').expect(200)).body.rows)).toEqual([r[4], r[10], r[11]]);
    expect(ids((await get(k, 'TK01', q + '&max=' + encodeURIComponent('100.000,5')).expect(200)).body.rows)).toEqual([r[6], r[12], r[13]]);
    expect(ids((await get(k, 'TK01', q + '&min=300000,5&max=300000,5').expect(200)).body.rows)).toEqual([r[5]]);
    expect(ids((await get(k, 'TK01', q + '&loai=TM').expect(200)).body.rows)).toEqual([r[5]]);
    expect(ids((await get(k, 'TK01', q + '&loai=CK').expect(200)).body.rows)).toEqual([r[4]]);
    expect(ids((await get(k, 'TK01', q + '&bank=VCB').expect(200)).body.rows)).toEqual([r[12]]);
    expect(ids((await get(k, 'TK01', q + '&nguon=payment').expect(200)).body.rows)).toEqual([r[5]]);
    expect(ids((await get(k, 'TK01', q + '&nguon=').expect(200)).body.rows)).toEqual([r[6]]);
  });

  it('danh sách cho bộ lọc: nguonList (mọi dòng của ví, sắp theo số dòng), coLoai, bankList', async () => {
    await seedSaoKe();
    const k = await tokenFor(await ketoan());
    const b = (await get(k, 'TK01', '?fdate=2026-09-01&tdate=2026-09-01').expect(200)).body;
    expect(b.nguonList).toEqual([
      { ma: '', nhan: 'SỔ QUỸ', mau: '#64748b', n: 4 },
      { ma: 'bank_tx', nhan: 'BANK', mau: '#177a4e', n: 2 },
      { ma: 'payment', nhan: 'PHIẾU CHI', mau: '#b3441f', n: 2 },
      { ma: 'daoxoa_thu_chi_tbs', nhan: 'ĐẢO/XOÁ THU CHI', mau: '#7c3aed', n: 1 },
      { ma: 'fx_fee', nhan: 'PHÍ LUÂN CHUYỂN', mau: '#8a6414', n: 1 },
      { ma: 'fx_transfer', nhan: 'LC NGOẠI TỆ', mau: '#1e40af', n: 1 },
      { ma: 'manual', nhan: 'SỔ QUỸ', mau: '#64748b', n: 1 },
      { ma: 'thu_chi_tbs', nhan: 'THU/CHI TBS', mau: '#0f766e', n: 1 },
    ]);
    expect(b.coLoai).toBe(true);
    expect(b.bankList).toEqual(['VCB']);
    const b2 = (await get(k, 'TK02', '?fdate=2026-09-01&tdate=2026-09-01').expect(200)).body;
    expect(b2.coLoai).toBe(false);
    expect(b2.bankList).toEqual([]);
  });

  it('nội dung + nhãn dòng: thu_chi_tbs lấy lý do từ phiếu duyệt; chieu/nguon/trangThai', async () => {
    const { r, reqId } = await seedSaoKe();
    const k = await tokenFor(await ketoan());
    const rows = (await get(k, 'TK01', `?fdate=2026-09-01&tdate=${TODAY()}&sort=asc`).expect(200)).body.rows;
    const by = (id: number) => rows.find((x: any) => x.id === id);
    expect(by(r[10])).toMatchObject({ noiDung: `Phiếu chi TBS — Mua VPP — phiếu duyệt #${reqId}`, chieu: 'Tiền ra', nguon: { ma: 'thu_chi_tbs', nhan: 'THU/CHI TBS', mau: '#0f766e' } });
    expect(by(r[11])).toMatchObject({ noiDung: 'Đảo phiếu', chieu: 'Tiền vào', reversalOf: r[10] });
    expect(by(r[6])).toMatchObject({ chieu: 'Chuyển đi', type: 'tranfer', nguon: { ma: '', nhan: 'SỔ QUỸ' } });
    expect(by(r[5])).toMatchObject({ money: '-300000.5', tranId: '777888', trangThai: 'Đã ghi sổ', status: 1 });
    expect(by(r[12])).toMatchObject({ bankInfo: 'VCB' });
  });
});

describe('sao kê — cắt bớt và phân trang (tính TRƯỚC rồi mới cắt trang)', () => {
  it('phân trang sau khi tính: trang vượt ⇒ kẹp về trang cuối; số dư chạy vẫn tính trên toàn bộ', async () => {
    const { r } = await seedSaoKe();
    const svc = app.get(TreasuryReportService);
    const u = await ketoan();
    const L = { ...tbsSkLoc({ fdate: '2026-09-01', tdate: TODAY() }), moiTrang: 3, trang: 99 };
    const b = await svc.statement(u.id, 'TK01', L, { phanTrang: true });
    expect(b).toMatchObject({ trang: 3, soTrang: 3, tuDong: 6, locN: 8 });
    expect(ids(b.rows)).toEqual([r[5], r[4]]);
    expect(b.rows.map((x) => x.soDu)).toEqual(['2999999.5', '3300000']);
    const p1 = await svc.statement(u.id, 'TK01', { ...L, trang: 1 }, { phanTrang: true });
    expect(ids(p1.rows)).toEqual([r[13], r[12], r[11]]);
    // phanTrang=false (file tải về) ⇒ trả hết.
    const full = await svc.statement(u.id, 'TK01', L);
    expect(full.rows.length).toBe(8);
    expect(full).toMatchObject({ trang: 1, soTrang: 1, tuDong: 0 });
  });

  it('quá gioiHan ⇒ catBot, bỏ dòng thứ gioiHan+1, tắt số dư chạy', async () => {
    const { r } = await seedSaoKe();
    const svc = app.get(TreasuryReportService);
    const u = await ketoan();
    const L = { ...tbsSkLoc({ fdate: '2026-09-01', tdate: TODAY(), sort: 'asc' }) };
    const b = await svc.statement(u.id, 'TK01', L, { gioiHan: 5 });
    expect(b.catBot).toBe(true);
    expect(b.coSoDuChay).toBe(false);
    expect(ids(b.rows)).toEqual([r[4], r[5], r[6], r[7], r[10]]);
    expect(b.rows.every((x) => x.soDu === null)).toBe(true);
    expect(b.locN).toBe(5);
    // Đúng bằng trần ⇒ KHÔNG cắt.
    const c = await svc.statement(u.id, 'TK01', L, { gioiHan: 8 });
    expect(c.catBot).toBe(false);
    expect(c.coSoDuChay).toBe(true);
  });
});

describe('sao kê — quyền, phạm vi, lộ dữ liệu', () => {
  it('không trả `stk`/mã ngân hàng; khoá account/row khớp TUYỆT ĐỐI allow-list §2.5', async () => {
    await seedSaoKe();
    const k = await tokenFor(await ketoan());
    const b = (await get(k, 'TK01', `?fdate=2026-09-01&tdate=${TODAY()}`).expect(200)).body;
    const body = JSON.stringify(b);
    expect(body).not.toContain('STK-BI-MAT');
    expect(body).not.toMatch(/"stk"|bankCode|"ACB"|password/i);
    expect(Object.keys(b).sort()).toEqual([
      'account', 'bankList', 'catBot', 'coLoai', 'coSoDuChay', 'cuoiKy', 'dauKy', 'ky', 'kyNRa', 'kyNVao', 'kyRa', 'kyVao',
      'locN', 'locRa', 'locVao', 'nguonList', 'rows', 'soDuVi', 'soTrang', 'trang', 'tuDong',
    ].sort());
    expect(b.account).toEqual({ code: 'TK01', name: 'ACB Công Ty', currency: 'VND', accGroup: 'bank', isActive: 1 });
    expect(Object.keys(b.rows[0]).sort()).toEqual([
      'approveDate', 'approveUser', 'bankInfo', 'cdate', 'chieu', 'cuser', 'id', 'money', 'noiDung', 'nguon', 'orderCode',
      'poId', 'rate', 'reversalOf', 'soDu', 'status', 'tranId', 'trangThai', 'type',
    ].sort());
  });

  it('có account.view nhưng THIẾU account.stats ⇒ 403; thiếu account.view ⇒ 403; chưa đăng nhập ⇒ 401', async () => {
    await seedSaoKe();
    const a = await seedGranted('ZZSK_view', [{ code: 'account.view', scope: Scope.all }]);
    await get(await tokenFor(a), 'TK01').expect(403);
    const b = await seedGranted('ZZSK_stats', [{ code: 'account.stats', scope: Scope.all }]);
    await get(await tokenFor(b), 'TK01').expect(403);
    await request(app.getHttpServer()).get('/treasury/accounts/TK01/statement').expect(401);
  });

  it('phạm vi hẹp ở MỘT trong hai quyền ⇒ 404 giống hệt mã không tồn tại (fail-closed, không dò được mã)', async () => {
    await seedSaoKe();
    const u = await seedGranted('ZZSK_own', [
      { code: 'account.view', scope: Scope.all },
      { code: 'account.stats', scope: Scope.own },
    ]);
    const t = await tokenFor(u);
    const a = await get(t, 'TK01').expect(404);
    const b = await get(t, 'TK404').expect(404);
    expect(a.body).toEqual(b.body);
    expect(JSON.stringify(a.body)).not.toContain('TK01');
  });

  it('service tự chặn khi bị gọi ngoài HTTP (không dựa riêng vào ScopeGuard)', async () => {
    await seedSaoKe();
    const u = await seedGranted('ZZSK_none', [{ code: 'account.view', scope: Scope.all }]);
    await expect(app.get(TreasuryReportService).statement(u.id, 'TK01', tbsSkLoc({}))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mã quỹ lạ / mã theo dõi không phải ví ⇒ 404; mã có ký tự lạ ⇒ 404', async () => {
    await seedSaoKe();
    await seedTreasuryEntry({ tkCode: 'CHI-TBS', type: 'out', money: D('-5'), status: 1, cdate: at('2026-09-05') });
    const u = await ketoan();
    const k = await tokenFor(u);
    await get(k, 'TK404').expect(404);
    await get(k, 'CHI-TBS').expect(404);
    await get(k, encodeURIComponent("TK01'--")).expect(404);
    // service: mã rỗng (P-SK1 — prod ra trang trống "0 đ") ⇒ 404, không trả khung rỗng
    await expect(app.get(TreasuryReportService).statement(u.id, '', tbsSkLoc({}))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('tham số lạ ⇒ 400; ngày khớp mẫu nhưng không phải lịch (tháng 13) ⇒ 400 thay vì SQL hỏng như prod', async () => {
    await seedSaoKe();
    const k = await tokenFor(await ketoan());
    await get(k, 'TK01', '?stk=1').expect(400);
    await get(k, 'TK01', '?tk=TK02').expect(400);
    await get(k, 'TK01', '?fdate=2026-13-01').expect(400);
    // sai định dạng ⇒ về mặc định như prod (không lỗi)
    const b = (await get(k, 'TK01', '?fdate=01-09-2026&chieu=xyz&tt=7&moiTrang=37').expect(200)).body;
    expect(b.ky.fdate).toBe(TODAY().slice(0, 8) + '01');
  });
});
