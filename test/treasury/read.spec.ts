// 09b đợt 1, Task 3 — ĐỌC sổ quỹ qua HTTP: `GET /treasury/accounts`, `GET /treasury/accounts/:code/entries`.
// Đặc tả: docs/rewrite-spec/09b-so-quy-treasury.md §3.3 (số dư = opening + Σstatus=1, Q1/T1),
//         §4 (quyền `account.view` — app `mobile-api/v1/treasury/overview.php`, `tx.php`),
//         §6 + `cls.treasury.php::getOverview` (:351-391: chỉ ví is_active=1, tách acc_group='store').
//
// Dựng app qua createApp() — ĐÚNG entrypoint production (3 guard toàn cục), cùng lý do
// test/supplier-payment/read-delete.spec.ts.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Scope } from '@prisma/client';
import { createApp } from '../../src/main';
import { PermService } from '../../src/iam/perm.service';
import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { resetTreasury, seedFundAccount, seedTreasuryEntry } from '../helpers/treasury-db';

const D = (v: string) => new Prisma.Decimal(v);
let app: INestApplication;
let jwtSvc: JwtService;

beforeAll(async () => {
  app = await createApp();
  await app.init();
  jwtSvc = app.get(JwtService);
});
beforeEach(async () => {
  await resetIam();
  app.get(PermService).clearCache();
  await resetTreasury();
});
afterAll(async () => {
  await resetTreasury();
  await app.close();
  await prisma.$disconnect();
});

async function tokenFor(user: { id: number; username: string }) {
  return 'Bearer ' + (await jwtSvc.signAsync({ sub: user.id, username: user.username }));
}
async function seedGranted(username: string, grants: { code: string; scope: Scope }[]) {
  const u = await seedUser({ username });
  if (grants.length) {
    const r = await seedRole('zztq-' + username, grants);
    await assignRole(u.id, r.id);
  }
  app.get(PermService).clearCache();
  return u;
}
const ketoan = () => seedGranted('ZZTQ_ketoan', [{ code: 'account.view', scope: Scope.all }]);

/** Bộ ví theo số đo prod §3.3 (rút gọn) + các ca biên. */
async function seedSoQuy() {
  await seedFundAccount('TK02', { name: 'RMB AGENT BẰNG TƯỜNG', currency: 'CNY', openingBalance: D('4157885'), displayOrder: 2, glAccount: '1122', stk: 'STK-BI-MAT-02' });
  await seedFundAccount('TK01', { name: 'ACB Công Ty', currency: 'VND', displayOrder: 1, glAccount: '1121', stk: 'STK-BI-MAT-01' });
  await seedFundAccount('TK16', { name: 'BIDV', currency: 'VND', openingBalance: D('34695720'), displayOrder: 3 });
  await seedFundAccount('TK13', { name: 'TECHCOMBANK', currency: 'VND', openingBalance: D('3982236'), displayOrder: 4 }); // 0 dòng
  await seedFundAccount('TK07', { name: 'TK CỌC', currency: 'VND', accGroup: 'store', displayOrder: 9 });
  await seedFundAccount('TK99', { name: 'VÍ ẨN', currency: 'VND', isActive: 0, openingBalance: D('777') });

  // TK02: −170.936,87 (đo prod); dòng 0/9 KHÔNG vào số dư.
  await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-4328821.87'), status: 1 });
  await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-999999'), status: 0 });
  await seedTreasuryEntry({ tkCode: 'TK02', type: 'out', money: D('-888888'), status: 9 });
  // TK01: 2 dòng status 1.
  await seedTreasuryEntry({ tkCode: 'TK01', type: 'in', money: D('3000000000'), status: 1, note: 'thu' });
  await seedTreasuryEntry({ tkCode: 'TK01', type: 'out', money: D('-888072866'), status: 1, note: 'chi' });
  // TK16: 34.695.720 − 11.627.242 = 23.068.478.
  await seedTreasuryEntry({ tkCode: 'TK16', type: 'out', money: D('-11627242'), status: 1 });
  // TK07 (store): 949.343.942.
  await seedTreasuryEntry({ tkCode: 'TK07', type: 'in', money: D('949343942'), status: 1 });
  // Mã KHÔNG có trong danh mục nhưng có dòng status=1 — getBalances trả khoá này; endpoint phải LỌC.
  await seedTreasuryEntry({ tkCode: 'CHI-TBS', type: 'out', money: D('-5000'), status: 1 });
  await seedTreasuryEntry({ tkCode: 'THU-TBS', type: 'in', money: D('7000'), status: 9 });
}

const codes = (xs: { code: string }[]) => xs.map((x) => x.code);

describe('GET /treasury/accounts — số dư = opening + Σ status=1, tách bank/store', () => {
  it('kế toán (account.view=all) thấy số dư đúng từng ví, thứ tự display_order', async () => {
    await seedSoQuy();
    const k = await ketoan();
    const res = await request(app.getHttpServer()).get('/treasury/accounts').set('Authorization', await tokenFor(k)).expect(200);

    expect(codes(res.body.bank)).toEqual(['TK01', 'TK02', 'TK16', 'TK13']);
    expect(codes(res.body.store)).toEqual(['TK07']);
    const bal = Object.fromEntries([...res.body.bank, ...res.body.store].map((a: any) => [a.code, a.balance]));
    expect(bal).toEqual({
      TK01: '2111927134',
      TK02: '-170936.87',
      TK16: '23068478',
      TK13: '3982236',
      TK07: '949343942',
    });
    // Tổng theo tệ CHỈ khối tiền (bank) — TK07 (store) không cộng vào tiền (§12.11).
    expect(res.body.byCurrency.VND).toEqual({ total: '2138977848', count: 3 });
    expect(res.body.byCurrency.CNY).toEqual({ total: '-170936.87', count: 1 });
    expect(res.body.byCurrency.USD).toEqual({ total: '0', count: 0 });
    expect(res.body.storeByCurrency.VND).toEqual({ total: '949343942', count: 1 });
  });

  it('mã KHÔNG có trong danh mục (CHI-TBS có dòng status=1) KHÔNG xuất hiện; ví ẩn (is_active=0) không xuất hiện', async () => {
    await seedSoQuy();
    const k = await ketoan();
    const res = await request(app.getHttpServer()).get('/treasury/accounts').set('Authorization', await tokenFor(k)).expect(200);
    const all = [...codes(res.body.bank), ...codes(res.body.store)];
    expect(all).not.toContain('CHI-TBS');
    expect(all).not.toContain('THU-TBS');
    expect(all).not.toContain('TK99');
    expect(JSON.stringify(res.body)).not.toContain('CHI-TBS');
  });

  it('không lộ STK (khoá ánh xạ SePay) hay khái niệm password; khoá ví khớp TUYỆT ĐỐI allow-list', async () => {
    await seedSoQuy();
    const k = await ketoan();
    const res = await request(app.getHttpServer()).get('/treasury/accounts').set('Authorization', await tokenFor(k)).expect(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('STK-BI-MAT');
    expect(body.toLowerCase()).not.toContain('password');
    expect(Object.keys(res.body.bank[0]).sort()).toEqual(
      ['accGroup', 'balance', 'code', 'currency', 'displayOrder', 'glAccount', 'name', 'openingBalance', 'subname'].sort(),
    );
  });

  it('không có account.view ⇒ 403', async () => {
    await seedSoQuy();
    const u = await seedGranted('ZZTQ_sale', [{ code: 'payment.view', scope: Scope.all }]);
    await request(app.getHttpServer()).get('/treasury/accounts').set('Authorization', await tokenFor(u)).expect(403);
  });

  it('chưa đăng nhập ⇒ 401', async () => {
    await request(app.getHttpServer()).get('/treasury/accounts').expect(401);
  });

  it('account.view phạm vi HẸP (own) ⇒ fail-closed: không thấy ví nào (sổ quỹ chỉ có phạm vi toàn công ty)', async () => {
    await seedSoQuy();
    const u = await seedGranted('ZZTQ_own', [{ code: 'account.view', scope: Scope.own }]);
    const res = await request(app.getHttpServer()).get('/treasury/accounts').set('Authorization', await tokenFor(u)).expect(200);
    expect(res.body.bank).toEqual([]);
    expect(res.body.store).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('TK01');
  });
});

describe('GET /treasury/accounts/:code/entries', () => {
  it('kế toán đọc sổ một ví: mọi dòng (kể cả 0/9), mới nhất trước; số dư = opening + Σstatus=1', async () => {
    await seedSoQuy();
    const k = await ketoan();
    const res = await request(app.getHttpServer()).get('/treasury/accounts/TK02/entries').set('Authorization', await tokenFor(k)).expect(200);
    expect(res.body.account).toEqual({ code: 'TK02', name: 'RMB AGENT BẰNG TƯỜNG', currency: 'CNY', accGroup: 'bank' });
    expect(res.body.balance).toBe('-170936.87');
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((x: any) => [x.money, x.status])).toEqual([
      ['-888888', 9], ['-999999', 0], ['-4328821.87', 1],
    ]);
    expect(JSON.stringify(res.body)).not.toContain('STK-BI-MAT');
  });

  it('lọc status=1 + phân trang', async () => {
    await seedSoQuy();
    const k = await ketoan();
    const res = await request(app.getHttpServer())
      .get('/treasury/accounts/TK01/entries?status=1&perPage=1&page=2').set('Authorization', await tokenFor(k)).expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((x: any) => x.note)).toEqual(['thu']);
  });

  it('mã ví không tồn tại ⇒ 404', async () => {
    await seedSoQuy();
    const k = await ketoan();
    await request(app.getHttpServer()).get('/treasury/accounts/TK404/entries').set('Authorization', await tokenFor(k)).expect(404);
  });

  it('mã theo dõi KHÔNG phải ví (CHI-TBS, có dòng sổ) ⇒ 404 — không đọc được qua endpoint ví', async () => {
    await seedSoQuy();
    const k = await ketoan();
    await request(app.getHttpServer()).get('/treasury/accounts/CHI-TBS/entries').set('Authorization', await tokenFor(k)).expect(404);
  });

  it('không có account.view ⇒ 403', async () => {
    await seedSoQuy();
    const u = await seedGranted('ZZTQ_sale', [{ code: 'payment.view', scope: Scope.all }]);
    await request(app.getHttpServer()).get('/treasury/accounts/TK01/entries').set('Authorization', await tokenFor(u)).expect(403);
  });

  it('account.view phạm vi own ⇒ 404 (giống không tồn tại, không lộ ví nào có thật)', async () => {
    await seedSoQuy();
    const u = await seedGranted('ZZTQ_own', [{ code: 'account.view', scope: Scope.own }]);
    const a = await request(app.getHttpServer()).get('/treasury/accounts/TK01/entries').set('Authorization', await tokenFor(u)).expect(404);
    const b = await request(app.getHttpServer()).get('/treasury/accounts/TK404/entries').set('Authorization', await tokenFor(u)).expect(404);
    expect(a.body).toEqual(b.body);
  });

  it('tham số lạ ⇒ 400 (forbidNonWhitelisted)', async () => {
    await seedSoQuy();
    const k = await ketoan();
    await request(app.getHttpServer()).get('/treasury/accounts/TK01/entries?tkCode=TK02').set('Authorization', await tokenFor(k)).expect(400);
  });
});

// ScopeGuard canh RIÊNG (không qua service): service cũng tự chặn phạm vi hẹp, nên ca HTTP ở trên
// không phân biệt được tầng nào chặn. Ca này khoá nhánh `allOnly` của entity `fundAccount`.
describe('ScopeGuard entity fundAccount — chỉ phạm vi all', () => {
  const { ScopeGuard } = require('../../src/iam/scope.guard');
  const { SCOPED_BY } = require('../../src/iam/scoped-by.decorator');
  const meta = { entity: 'fundAccount', param: 'code', field: 'code' };
  function mk(scope: string, hit: unknown) {
    const reflector = { getAllAndOverride: (key: string) => (key === SCOPED_BY ? meta : ['account.view']) } as any;
    const scopeSvc = { buildDocScope: jest.fn() } as any;
    const permSvc = { scopeOf: jest.fn().mockResolvedValue(scope) } as any;
    const prismaStub = { fundAccount: { findFirst: jest.fn().mockResolvedValue(hit) } } as any;
    const ctx = {
      getHandler: () => ({}), getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ params: { code: 'TK01' }, user: { sub: 7 } }) }),
    } as any;
    return { guard: new ScopeGuard(reflector, scopeSvc, permSvc, prismaStub), prismaStub, scopeSvc, ctx };
  }
  it.each(['own', 'team', 'dept', 'dept_tree', 'warehouse', ''])('phạm vi "%s" ⇒ vế DENY {id:-1} trong CÙNG một truy vấn', async (sc) => {
    const { guard, prismaStub, scopeSvc, ctx } = mk(sc, null);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Không tìm thấy');
    expect(prismaStub.fundAccount.findFirst).toHaveBeenCalledWith({ where: { AND: [{ code: 'TK01' }, { id: -1 }] }, select: { id: true } });
    expect(scopeSvc.buildDocScope).not.toHaveBeenCalled(); // không dựng vế trên cột saler không tồn tại
  });
  it('phạm vi all + ví có thật ⇒ cho qua', async () => {
    const { guard, prismaStub, ctx } = mk('all', { id: 1 });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prismaStub.fundAccount.findFirst).toHaveBeenCalledWith({ where: { AND: [{ code: 'TK01' }, {}] }, select: { id: true } });
  });
});
