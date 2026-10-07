// 09a đợt 1, Task 2 — ĐỌC (danh sách/chi tiết có phạm vi) + XOÁ phiếu thanh toán NCC qua HTTP.
// Đặc tả: docs/rewrite-spec/09a-thanh-toan-ncc.md §4, §5.10, §5.16, §9.3 G10, §10 mục 2.
//
// Dựng app qua createApp() (ĐÚNG entrypoint production — helmet/ValidationPipe/3 guard toàn cục),
// cùng lý do test/auth/wallet-endpoints.spec.ts: tự lắp Test.createTestingModule ở đây sẽ xanh
// trong khi production không được gác như test tưởng.
//
// Mô hình "sale chỉ thấy phiếu mình": prod dùng cờ nhóm `issale` ⇒ `saler = $username`
// (`components/com_payment/task/list.php:214-216`). v2 KHÔNG mang cờ nhóm sang làm nguồn phân
// quyền (01-iam.md §5 mục 5) — nó là PHẠM VI của mã quyền: sale = `payment.view` scope `own`
// (ScopeService.buildDocScope ⇒ `saler = username`, đúng nguyên văn mệnh đề prod), kế toán =
// `payment.view` scope `all` (prod: mọi vai phạm vi `all`, §4).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Scope } from '@prisma/client';
import { createApp } from '../../src/main';
import { PermService } from '../../src/iam/perm.service';
import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { resetSupplierPayment, seedSupplierPayment } from '../helpers/supplier-payment-db';

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
  await resetSupplierPayment();
  // Chỉ dọn dòng trạng thái trả về của PHIẾU CHI (object_type='payment') — không đụng dòng của
  // phiếu duyệt mà bộ khác có thể dựa vào.
  await prisma.returnState.deleteMany({ where: { objectType: 'payment' } });
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function tokenFor(user: { id: number; username: string }) {
  return 'Bearer ' + (await jwtSvc.signAsync({ sub: user.id, username: user.username }));
}

async function seedGranted(username: string, grants: { code: string; scope: Scope }[]) {
  const u = await seedUser({ username });
  if (grants.length) {
    const r = await seedRole('zzsp-' + username, grants);
    await assignRole(u.id, r.id);
  }
  app.get(PermService).clearCache();
  return u;
}

const sale = (name = 'ZZSP_sale1') => seedGranted(name, [{ code: 'payment.view', scope: Scope.own }]);
const ketoan = () => seedGranted('ZZSP_ketoan', [
  { code: 'payment.view', scope: Scope.all },
  { code: 'payment.delete', scope: Scope.all },
]);

function phieu(saler: string, o: Partial<Prisma.SupplierPaymentUncheckedCreateInput> = {}) {
  return seedSupplierPayment({
    saler,
    priceCyn: new Prisma.Decimal('447.60'),
    rateBuy: 3925,
    codeOrder: 'DH-ZZSP',
    orderId: 1021546,
    from: '1688',
    source: 'TT RMB Bằng Tường',
    nccBankAccount: 'STK-' + saler,
    ...o,
  });
}

function returnedState(objectId: number, o: Partial<Prisma.ReturnStateUncheckedCreateInput> = {}) {
  return prisma.returnState.create({
    data: {
      objectType: 'payment',
      objectId,
      checkpointType: 'biz',
      checkpointRef: 'payment.duyet_ncc',
      state: 'returned',
      reason: 'Sai số tiền: kiểm lại',
      round: 1,
      fieldsOpened: ['price_cyn', 'rate_buy'],
      dataBefore: { price_cyn: '447.60', rate_buy: '3925' },
      returnedBy: 'ZZSP_ketoan',
      returnedAt: 1758700000,
      ...o,
    },
  });
}

const ids = (res: request.Response) => (res.body.items as { id: number }[]).map((x) => x.id).sort((a, b) => a - b);

describe('GET /supplier-payments — phạm vi sale (prod: issale ⇒ saler = me)', () => {
  it('sale chỉ thấy phiếu CỦA MÌNH — không thấy phiếu (và STK NCC) của sale khác', async () => {
    const s = await sale();
    const mine = await phieu('ZZSP_sale1');
    await phieu('ZZSP_sale2');
    const res = await request(app.getHttpServer()).get('/supplier-payments').set('Authorization', await tokenFor(s)).expect(200);
    expect(ids(res)).toEqual([mine.id]);
    expect(JSON.stringify(res.body)).not.toContain('STK-ZZSP_sale2');
  });

  it('ĐỐI CHỨNG: kế toán (payment.view=all) thấy MỌI phiếu — không có ca này thì một bộ lọc '
    + 'chặn-sạch cũng làm ca trên xanh', async () => {
    const k = await ketoan();
    const a = await phieu('ZZSP_sale1');
    const b = await phieu('ZZSP_sale2');
    const res = await request(app.getHttpServer()).get('/supplier-payments').set('Authorization', await tokenFor(k)).expect(200);
    expect(ids(res)).toEqual([a.id, b.id]);
    expect(res.body.total).toBe(2);
  });

  it('tiền ra CHUỖI giữ đủ chữ số (Decimal(18,2)), price_payment NULL giữ null — không tự dẫn xuất', async () => {
    const k = await ketoan();
    await phieu('ZZSP_sale1', { priceCyn: new Prisma.Decimal('6430.50'), rateBuy: 26099, pricePayment: new Prisma.Decimal('158702310.00') });
    await phieu('ZZSP_sale2', { pricePayment: null });
    const res = await request(app.getHttpServer()).get('/supplier-payments').set('Authorization', await tokenFor(k)).expect(200);
    const byS = Object.fromEntries((res.body.items as any[]).map((x) => [x.saler, x]));
    expect(byS.ZZSP_sale1.priceCyn).toBe('6430.50');
    expect(byS.ZZSP_sale1.pricePayment).toBe('158702310.00');
    expect(byS.ZZSP_sale2.pricePayment).toBeNull();
  });

  it('bộ lọc confirm=no chỉ trả phiếu chưa duyệt (đối chứng: confirm=yes trả phần còn lại)', async () => {
    const k = await ketoan();
    const cho = await phieu('ZZSP_sale1', { confirm: 'no', status: 'no' });
    const da = await phieu('ZZSP_sale1', { confirm: 'yes', status: 'yes' });
    const t = await tokenFor(k);
    const r1 = await request(app.getHttpServer()).get('/supplier-payments?confirm=no').set('Authorization', t).expect(200);
    const r2 = await request(app.getHttpServer()).get('/supplier-payments?confirm=yes').set('Authorization', t).expect(200);
    expect(ids(r1)).toEqual([cho.id]);
    expect(ids(r2)).toEqual([da.id]);
  });

  it('tham số lọc lạ ⇒ 400 (forbidNonWhitelisted), không lặng lẽ bỏ qua', async () => {
    const k = await ketoan();
    await request(app.getHttpServer()).get('/supplier-payments?saler=ZZSP_sale2').set('Authorization', await tokenFor(k)).expect(400);
  });
});

describe('GET /supplier-payments — phiếu đang bị TRẢ VỀ (§10 mục 2, 04b §5.2 dòng app)', () => {
  it('phiếu `returned` của NGƯỜI KHÁC không có trong danh sách của kế toán', async () => {
    const k = await ketoan();
    const tra = await phieu('ZZSP_sale1');
    const thuong = await phieu('ZZSP_sale1');
    await returnedState(tra.id);
    const res = await request(app.getHttpServer()).get('/supplier-payments').set('Authorization', await tokenFor(k)).expect(200);
    expect(ids(res)).toEqual([thuong.id]);
    expect(res.body.total).toBe(1);
  });

  it('CHỦ phiếu (saler) VẪN thấy phiếu `returned` của chính mình — phải thấy để sửa & nộp lại', async () => {
    const s = await sale();
    const tra = await phieu('ZZSP_sale1');
    await returnedState(tra.id);
    const res = await request(app.getHttpServer()).get('/supplier-payments').set('Authorization', await tokenFor(s)).expect(200);
    expect(ids(res)).toEqual([tra.id]);
  });

  it('ĐỐI CHỨNG: phiếu `resubmitted` (đã nộp lại) KHÔNG bị ẩn — chỉ `returned` bị loại', async () => {
    const k = await ketoan();
    const nop = await phieu('ZZSP_sale1');
    await returnedState(nop.id, { state: 'resubmitted', resubmittedAt: 1758710000 });
    const res = await request(app.getHttpServer()).get('/supplier-payments').set('Authorization', await tokenFor(k)).expect(200);
    expect(ids(res)).toEqual([nop.id]);
  });
});

describe('GET /supplier-payments/:id — ngoài phạm vi ≡ không tồn tại', () => {
  it('sale GET phiếu của sale khác ⇒ 404, GIỐNG HỆT (status + body) id không tồn tại', async () => {
    const s = await sale();
    const other = await phieu('ZZSP_sale2');
    const t = await tokenFor(s);
    const ngoai = await request(app.getHttpServer()).get(`/supplier-payments/${other.id}`).set('Authorization', t);
    const khong = await request(app.getHttpServer()).get('/supplier-payments/987654').set('Authorization', t);
    expect(ngoai.status).toBe(404);
    expect(ngoai.status).toBe(khong.status);
    expect(ngoai.body).toEqual(khong.body);
    expect(JSON.stringify(ngoai.body)).not.toContain('STK-ZZSP_sale2');
  });

  it('ĐỐI CHỨNG: sale GET phiếu CỦA MÌNH ⇒ 200', async () => {
    const s = await sale();
    const mine = await phieu('ZZSP_sale1');
    const res = await request(app.getHttpServer()).get(`/supplier-payments/${mine.id}`).set('Authorization', await tokenFor(s)).expect(200);
    expect(res.body.id).toBe(mine.id);
    expect(res.body.nccBankAccount).toBe('STK-ZZSP_sale1');
  });

  it('id không phải số nguyên dương (abc / 0 / -1 / vượt Int) ⇒ 404 như mọi 404 khác, không 400/500', async () => {
    const k = await ketoan();
    const t = await tokenFor(k);
    const chuan = await request(app.getHttpServer()).get('/supplier-payments/987654').set('Authorization', t);
    for (const bad of ['abc', '0', '-1', '99999999999', '1.5']) {
      const r = await request(app.getHttpServer()).get(`/supplier-payments/${bad}`).set('Authorization', t);
      expect({ bad, status: r.status, body: r.body }).toEqual({ bad, status: 404, body: chuan.body });
    }
  });

  it('chi tiết kèm returnState + changedFields (phiếu đã nộp lại, price_cyn đổi)', async () => {
    const k = await ketoan();
    const p = await phieu('ZZSP_sale1');
    await returnedState(p.id, {
      state: 'resubmitted', round: 2, resubmittedAt: 1758710000,
      dataAfter: { price_cyn: '447.00', rate_buy: '3925' },
    });
    const res = await request(app.getHttpServer()).get(`/supplier-payments/${p.id}`).set('Authorization', await tokenFor(k)).expect(200);
    expect(res.body.returnState).toMatchObject({ state: 'resubmitted', round: 2, reason: 'Sai số tiền: kiểm lại', returnedBy: 'ZZSP_ketoan' });
    expect(res.body.changedFields).toEqual({ price_cyn: { cu: '447.60', moi: '447.00' } });
  });

  it('chi tiết phiếu KHÔNG bị trả: returnState null, changedFields {}', async () => {
    const k = await ketoan();
    const p = await phieu('ZZSP_sale1');
    const res = await request(app.getHttpServer()).get(`/supplier-payments/${p.id}`).set('Authorization', await tokenFor(k)).expect(200);
    expect(res.body.returnState).toBeNull();
    expect(res.body.changedFields).toEqual({});
  });
});

describe('DELETE /supplier-payments/:id (§5.10, G10)', () => {
  it('xoá phiếu ĐÃ DUYỆT ⇒ từ chối (409), phiếu còn nguyên, không ghi log', async () => {
    const k = await ketoan();
    const p = await phieu('ZZSP_sale1', { confirm: 'yes', status: 'yes' });
    const before = await prisma.supplierPayment.findUnique({ where: { id: p.id } });
    await request(app.getHttpServer()).delete(`/supplier-payments/${p.id}`).set('Authorization', await tokenFor(k)).expect(409);
    expect(await prisma.supplierPayment.findUnique({ where: { id: p.id } })).toEqual(before);
    expect(await prisma.supplierPaymentLog.count()).toBe(0);
  });

  it('xoá phiếu đang bị TRẢ (confirm=no) ⇒ xoá, dòng trạng thái trả về bị dọn, log `delete` 8 cột như prod', async () => {
    const k = await ketoan();
    const p = await phieu('ZZSP_sale1', {
      cdate: 1758600000, note: 'ghi chú', codeOrder: 'PO001/2026-TBS4256', orderId: 0,
    });
    await returnedState(p.id);
    await request(app.getHttpServer()).delete(`/supplier-payments/${p.id}`).set('Authorization', await tokenFor(k)).expect(200);
    expect(await prisma.supplierPayment.findUnique({ where: { id: p.id } })).toBeNull();
    expect(await prisma.returnState.count({ where: { objectType: 'payment', objectId: p.id } })).toBe(0);
    const logs = await prisma.supplierPaymentLog.findMany({ where: { paymentId: p.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'delete', createdBy: 'ZZSP_ketoan', newData: null });
    // Nguyên văn json_encode(JSON_UNESCAPED_UNICODE) của prod trên dòng mysqli (mọi giá trị là CHUỖI,
    // '/' bị thoát thành '\/' vì prod không bật JSON_UNESCAPED_SLASHES).
    expect(logs[0].oldData).toBe(
      '{"cdate":"1758600000","price_cyn":"447.60","rate_buy":"3925","from":"1688","source":"TT RMB Bằng Tường",'
      + '"code_order":"PO001\\/2026-TBS4256","order_id":"0","note":"ghi chú"}',
    );
  });

  it('ĐỐI CHỨNG: xoá phiếu đã duyệt KHÔNG dọn dòng trạng thái trả về của nó', async () => {
    const k = await ketoan();
    const p = await phieu('ZZSP_sale1', { confirm: 'yes', status: 'yes' });
    await returnedState(p.id, { state: 'resubmitted', resubmittedAt: 1758710000 });
    await request(app.getHttpServer()).delete(`/supplier-payments/${p.id}`).set('Authorization', await tokenFor(k)).expect(409);
    expect(await prisma.returnState.count({ where: { objectType: 'payment', objectId: p.id } })).toBe(1);
  });

  it('xoá phiếu ngoài phạm vi payment.delete ⇒ 404 như id không tồn tại, phiếu còn nguyên', async () => {
    const u = await seedGranted('ZZSP_xoaown', [{ code: 'payment.delete', scope: Scope.own }]);
    const other = await phieu('ZZSP_sale2');
    const t = await tokenFor(u);
    const ngoai = await request(app.getHttpServer()).delete(`/supplier-payments/${other.id}`).set('Authorization', t);
    const khong = await request(app.getHttpServer()).delete('/supplier-payments/987654').set('Authorization', t);
    expect(ngoai.status).toBe(404);
    expect(ngoai.body).toEqual(khong.body);
    expect(await prisma.supplierPayment.count({ where: { id: other.id } })).toBe(1);
  });
});

// Tầng SERVICE tự fail-closed với danh tính — không dựa vào việc guard đã chặn trước. Lý do: Prisma
// XOÁ key `undefined` khỏi `where`; một bộ lọc dựng từ username `undefined` sẽ biến mất và khớp
// TẤT CẢ (fail-OPEN). Ca dưới gọi service với uid KHÔNG có user / user đã khoá trong khi CSDL có
// phiếu thật: phải ra rỗng / 404 / không xoá gì.
describe('SupplierPaymentService — danh tính không xác định ⇒ không thấy gì (fail-closed)', () => {
  it('uid không tồn tại hoặc user bị khoá: list rỗng, get/delete 404, phiếu còn nguyên', async () => {
    const { SupplierPaymentService } = await import('../../src/supplier-payment/supplier-payment.service');
    const svc = app.get(SupplierPaymentService);
    await ketoan();
    const khoa = await seedGranted('ZZSP_khoa', [
      { code: 'payment.view', scope: Scope.all },
      { code: 'payment.delete', scope: Scope.all },
    ]);
    await prisma.user.update({ where: { id: khoa.id }, data: { isActive: false } });
    const p = await phieu('ZZSP_sale1');
    for (const uid of [987654, khoa.id, 0, NaN]) {
      expect(await svc.list(uid, {})).toEqual({ items: [], page: 1, perPage: 20, total: 0 });
      await expect(svc.get(uid, p.id)).rejects.toMatchObject({ status: 404 });
      await expect(svc.delete(uid, p.id)).rejects.toMatchObject({ status: 404 });
    }
    expect(await prisma.supplierPayment.count({ where: { id: p.id } })).toBe(1);
  });
});

describe('Gác cửa — chưa đăng nhập / thiếu quyền', () => {
  it('không token ⇒ 401 ở cả 3 route', async () => {
    const p = await phieu('ZZSP_sale1');
    await request(app.getHttpServer()).get('/supplier-payments').expect(401);
    await request(app.getHttpServer()).get(`/supplier-payments/${p.id}`).expect(401);
    await request(app.getHttpServer()).delete(`/supplier-payments/${p.id}`).expect(401);
    expect(await prisma.supplierPayment.count()).toBe(1);
  });

  it('đăng nhập nhưng KHÔNG có quyền gì ⇒ 403 ở cả 3 route', async () => {
    const u = await seedGranted('ZZSP_khongquyen', []);
    const p = await phieu('ZZSP_khongquyen');
    const t = await tokenFor(u);
    await request(app.getHttpServer()).get('/supplier-payments').set('Authorization', t).expect(403);
    await request(app.getHttpServer()).get(`/supplier-payments/${p.id}`).set('Authorization', t).expect(403);
    await request(app.getHttpServer()).delete(`/supplier-payments/${p.id}`).set('Authorization', t).expect(403);
    expect(await prisma.supplierPayment.count()).toBe(1);
  });

  it('có payment.view (all) nhưng KHÔNG có payment.delete ⇒ xoá bị 403, phiếu còn', async () => {
    const u = await seedGranted('ZZSP_chixem', [{ code: 'payment.view', scope: Scope.all }]);
    const p = await phieu('ZZSP_sale1');
    await request(app.getHttpServer()).delete(`/supplier-payments/${p.id}`).set('Authorization', await tokenFor(u)).expect(403);
    expect(await prisma.supplierPayment.count()).toBe(1);
  });
});
