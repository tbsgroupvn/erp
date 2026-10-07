// D5 Task 2 — áp phạm vi sale vào các đường đọc v2, đo trên app THẬT (createApp → DI thật, HTTP thật).
// Nguồn: docs/rewrite-spec/D5-pham-vi-sale-de-xuat.md §2/§5.4 + QUYẾT ĐỊNH chủ DN 25/09/2026:
//  Q-D5-1/2 leader+phó thấy team, sale phụ tính là sở hữu · Q-D5-3 phiếu TT NCC = TEAM (cột saler)
//  Q-D5-5 PO THEO KHÁCH (buyerId) · Q-D5-9 khách ngừng hoạt động vẫn thấy · Q-D5-10 SALE ADMIN thấy hết.
//
// Thế giới: team T1 (leader `lead`, phó `dep`, thành viên m1, m2); `m3` sale ngoài team; `kt` kế toán
// (`all`); `sadm` SALE ADMIN (`all`). Vai `sale` mang `team` trên mọi mã (sau D5-T, Task 3).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Scope } from '@prisma/client';
import { createApp } from '../../src/main';
import { PermService } from '../../src/iam/perm.service';
import { CustomerService } from '../../src/masterdata/customer.service';
import { QuoteService } from '../../src/quote/quote.service';
import { PoService } from '../../src/po/po.service';
import { SupplierPaymentService } from '../../src/supplier-payment/supplier-payment.service';
import { prisma, resetIam, seedRole, assignRole } from '../helpers/iam-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';
import { resetQuote, seedQuote } from '../helpers/quote-db';
import { resetPo, seedPo } from '../helpers/po-db';
import { resetSupplierPayment, seedSupplierPayment } from '../helpers/supplier-payment-db';

let app: INestApplication;
let jwt: JwtService;
beforeAll(async () => {
  app = await createApp();
  await app.init();
  jwt = app.get(JwtService);
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const PERMS = ['customer.view', 'quote.view', 'po.view', 'payment.view', 'wallet.view'];
type U = { id: number; username: string };
let W: Awaited<ReturnType<typeof seedWorld>>;

async function mkUser(username: string): Promise<U> {
  return prisma.user.create({ data: { username, password: 'x' } });
}
async function seedWorld() {
  const sale = await seedRole('sale', PERMS.map((code) => ({ code, scope: Scope.team })));
  const keToan = await seedRole('ke_toan', PERMS.map((code) => ({ code, scope: Scope.all })));
  const saleAdmin = await seedRole('sale_admin', PERMS.map((code) => ({ code, scope: Scope.all })));
  const lead = await mkUser('lead');
  const dep = await mkUser('dep');
  const m1 = await mkUser('m1');
  const m2 = await mkUser('m2');
  const m3 = await mkUser('m3');
  const kt = await mkUser('kt');
  const sadm = await mkUser('sadm');
  for (const u of [lead, dep, m1, m2, m3]) await assignRole(u.id, sale.id);
  await assignRole(kt.id, keToan.id);
  await assignRole(sadm.id, saleAdmin.id);
  const t = await prisma.team.create({ data: { name: 'T1', leaderId: lead.id, deputyId: dep.id } });
  for (const m of ['m1', 'm2']) await prisma.salerTeam.create({ data: { saler: m, teamName: 'T1', teamId: t.id } });

  const kLead = await seedCustomer('K_LEAD', 'lead');
  const kM1 = await seedCustomer('K_M1', 'm1');
  const kPhu = await seedCustomer('K_M2_PHU', 'm3', ['m2']); // m2 là sale PHỤ, m3 sale chính
  const kM3 = await seedCustomer('K_M3', 'm3');
  const kOff = await seedCustomer('K_M1_OFF', 'm1');
  await prisma.customer.update({ where: { id: kOff.id }, data: { isactive: 0 } });

  await seedQuote('Q_LEAD', { createdBy: 'lead' });
  await seedQuote('Q_M1', { createdBy: 'm1' });
  await seedQuote('Q_M3', { createdBy: 'm3' });

  const poM1 = await seedPo('PO_M1', { buyerId: kM1.id, createdBy: 'm3' }); // khách m1, người khác tạo
  const poM3 = await seedPo('PO_M3', { buyerId: kM3.id, createdBy: 'm1' }); // m1 TẠO, khách của m3
  const poPhu = await seedPo('PO_PHU', { buyerId: kPhu.id });
  const poOff = await seedPo('PO_OFF', { buyerId: kOff.id });
  const poLead = await seedPo('PO_LEAD', { buyerId: kLead.id });
  await seedPo('PO_NULL', { buyerId: null, createdBy: 'm1' });

  const spLead = await seedSupplierPayment({ saler: 'lead', note: 'SP_LEAD', confirm: 'no' });
  const spM1 = await seedSupplierPayment({ saler: 'm1', note: 'SP_M1', confirm: 'no' });
  const spM3 = await seedSupplierPayment({ saler: 'm3', note: 'SP_M3', confirm: 'no' });
  app.get(PermService).clearCache();
  return { lead, dep, m1, m2, m3, kt, sadm, poM1, poM3, poPhu, poOff, poLead, spLead, spM1, spM3 };
}

beforeEach(async () => {
  await resetIam(); await resetMasterdata(); await resetQuote(); await resetPo(); await resetSupplierPayment();
  W = await seedWorld();
});

const tok = (u: U) => jwt.signAsync({ sub: u.id, username: u.username });
async function get(path: string, u: U, status: number) {
  return request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${await tok(u)}`).expect(status);
}

describe('Khách — CustomerService.listForUser (customer.view)', () => {
  const codes = async (u: U) => (await app.get(CustomerService).listForUser('customer.view', u.id)).map((c: any) => c.code).sort();
  test('sale thường chỉ thấy khách của mình (kể cả khách ngừng hoạt động — Q-D5-9)', async () => {
    expect(await codes(W.m1)).toEqual(['K_M1', 'K_M1_OFF']);
  });
  test('sale PHỤ thấy khách mình đứng phụ (Q-D5-2)', async () => {
    expect(await codes(W.m2)).toEqual(['K_M2_PHU']);
  });
  test('leader thấy cả team (Q-D5-1); phó thấy team + leader', async () => {
    expect(await codes(W.lead)).toEqual(['K_LEAD', 'K_M1', 'K_M1_OFF', 'K_M2_PHU']);
    expect(await codes(W.dep)).toEqual(['K_LEAD', 'K_M1', 'K_M1_OFF', 'K_M2_PHU']);
  });
  test('sale ngoài team không thấy khách của team', async () => {
    expect(await codes(W.m3)).toEqual(['K_M2_PHU', 'K_M3']);
  });
  test('kế toán / SALE ADMIN (all) thấy hết — không đổi (Q-D5-6/10)', async () => {
    const all = ['K_LEAD', 'K_M1', 'K_M1_OFF', 'K_M2_PHU', 'K_M3'];
    expect(await codes(W.kt)).toEqual(all);
    expect(await codes(W.sadm)).toEqual(all);
  });
});

describe('Báo giá — QuoteService.listForUser (quote.view, chủ = createdBy)', () => {
  const codes = async (u: U) => (await app.get(QuoteService).listForUser('quote.view', u.id)).map((q) => q.quoteCode).sort();
  test('sale thường chỉ thấy báo giá mình lập; leader thấy của team; ngoài team không thấy', async () => {
    expect(await codes(W.m1)).toEqual(['Q_M1']);
    expect(await codes(W.m2)).toEqual([]);
    expect(await codes(W.lead)).toEqual(['Q_LEAD', 'Q_M1']);
    expect(await codes(W.m3)).toEqual(['Q_M3']);
  });
  test('kế toán / SALE ADMIN thấy hết', async () => {
    expect(await codes(W.kt)).toEqual(['Q_LEAD', 'Q_M1', 'Q_M3']);
    expect(await codes(W.sadm)).toEqual(['Q_LEAD', 'Q_M1', 'Q_M3']);
  });
});

describe('PO — theo KHÁCH mua (Q-D5-5), không theo người tạo', () => {
  const codes = async (u: U) => (await app.get(PoService).listForUser('po.view', u.id)).map((p) => p.poCode).sort();
  test('sale thường: PO của khách mình (kể cả khách ngừng hoạt động); PO mình TẠO cho khách người khác KHÔNG hiện', async () => {
    expect(await codes(W.m1)).toEqual(['PO_M1', 'PO_OFF']);
  });
  test('sale phụ thấy PO của khách mình đứng phụ; leader thấy PO của cả team', async () => {
    expect(await codes(W.m2)).toEqual(['PO_PHU']);
    expect(await codes(W.lead)).toEqual(['PO_LEAD', 'PO_M1', 'PO_OFF', 'PO_PHU']);
  });
  test('kế toán / SALE ADMIN thấy hết, kể cả PO chưa gắn khách', async () => {
    const all = ['PO_LEAD', 'PO_M1', 'PO_M3', 'PO_NULL', 'PO_OFF', 'PO_PHU'];
    expect(await codes(W.kt)).toEqual(all);
    expect(await codes(W.sadm)).toEqual(all);
  });
  test('HTTP /po/:id/tien-ncc: ngoài phạm vi ≡ không tồn tại (cùng 404); leader thấy PO khách team', async () => {
    await get(`/po/${W.poM1.id}/tien-ncc`, W.m1, 200);
    const a = await get(`/po/${W.poM3.id}/tien-ncc`, W.m1, 404); // m1 tạo nhưng khách của m3
    const b = await get('/po/99999/tien-ncc', W.m1, 404);
    expect(a.body).toEqual(b.body);
    await get(`/po/${W.poPhu.id}/tien-ncc`, W.lead, 200);
    await get(`/po/${W.poOff.id}/tien-ncc`, W.m1, 200);
    await get(`/po/${W.poM3.id}/tien-ncc`, W.kt, 200);
  });
});

describe('Phiếu TT NCC — TEAM theo cột saler (Q-D5-3)', () => {
  const notes = async (u: U) => (await app.get(SupplierPaymentService).list(u.id)).items.map((x: any) => x.note).sort();
  test('sale thường chỉ thấy phiếu của mình; leader thấy phiếu của cả team; ngoài team không thấy', async () => {
    expect(await notes(W.m1)).toEqual(['SP_M1']);
    expect(await notes(W.m2)).toEqual([]);
    expect(await notes(W.lead)).toEqual(['SP_LEAD', 'SP_M1']);
    expect(await notes(W.m3)).toEqual(['SP_M3']);
  });
  test('kế toán / SALE ADMIN thấy hết', async () => {
    expect(await notes(W.kt)).toEqual(['SP_LEAD', 'SP_M1', 'SP_M3']);
    expect(await notes(W.sadm)).toEqual(['SP_LEAD', 'SP_M1', 'SP_M3']);
  });
  test('HTTP GET /supplier-payments/:id: leader 200 phiếu thành viên; sale 404 phiếu leader (cùng body với id không tồn tại)', async () => {
    await get(`/supplier-payments/${W.spM1.id}`, W.lead, 200);
    const a = await get(`/supplier-payments/${W.spLead.id}`, W.m1, 404);
    const b = await get('/supplier-payments/99999', W.m1, 404);
    expect(a.body).toEqual(b.body);
    await get(`/supplier-payments/${W.spM3.id}`, W.lead, 404);
  });
  test('sale (team) trả chứng từ phiếu của mình ⇒ 403 "Sale không được trả chứng từ" (laSale vẫn đúng)', async () => {
    const r = await request(app.getHttpServer())
      .post(`/supplier-payments/${W.spM1.id}/doc-return`)
      .set('Authorization', `Bearer ${await tok(W.m1)}`)
      .send({ reasonCode: 'khac', note: 'x' });
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).toContain('Sale không được trả chứng từ');
  });
});

describe('Ví /wallets/:cusId/available — ScopeGuard customer (wallet.view)', () => {
  test('sale: khách người khác ≡ khách không tồn tại (cùng 404); khách mình 200, kể cả ngừng hoạt động', async () => {
    const a = await get('/wallets/K_M3/available', W.m1, 404);
    const b = await get('/wallets/K_KHONG_CO/available', W.m1, 404);
    expect(a.body).toEqual(b.body);
    await get('/wallets/K_M1/available', W.m1, 200);
    await get('/wallets/K_M1_OFF/available', W.m1, 200);
  });
  test('leader: khách của thành viên, kể cả khách thành viên đứng sale PHỤ ⇒ 200; khách ngoài team ⇒ 404', async () => {
    await get('/wallets/K_M1/available', W.lead, 200);
    await get('/wallets/K_M2_PHU/available', W.lead, 200);
    await get('/wallets/K_M3/available', W.lead, 404);
  });
  test('kế toán / SALE ADMIN: mọi khách ⇒ 200', async () => {
    await get('/wallets/K_M3/available', W.kt, 200);
    await get('/wallets/K_M3/available', W.sadm, 200);
  });
});
