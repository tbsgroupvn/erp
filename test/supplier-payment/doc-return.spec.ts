// 09a đợt 1, Task 3 — TRẢ CHỨNG TỪ / NỘP LẠI phiếu thanh toán NCC (G8b, G11).
// Đặc tả: docs/rewrite-spec/09a-thanh-toan-ncc.md §5.12, §9.3 (G8b, G11), §12 (L1/L1b);
//         docs/rewrite-spec/04b-tra-ve-nguoi-nop-sua.md §2.2 T2/T4, §2.4, §4, §6.
// Plan: docs/rewrite-spec/plans/2026-09-25-09a-thanh-toan-ncc-dot1-plan.md — L1 SỬA có chủ đích.
//
// Mô hình quyền giống read-delete.spec.ts: prod `Permission('payment')` (bit nhóm cũ) ≡ v2
// `payment.view`; "sale" (prod cờ nhóm `issale`) ≡ `payment.view` phạm vi KHÁC `all` (v2 không
// mang cờ nhóm sang); `gid == 1` (nhóm Super Admin CŨ, KHÔNG phải laSuperAdmin) ≡ `tbl_user.gid = 1`.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Scope } from '@prisma/client';
import { createApp } from '../../src/main';
import { PermService } from '../../src/iam/perm.service';
import { SupplierPaymentService } from '../../src/supplier-payment/supplier-payment.service';
import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { resetSupplierPayment, seedSupplierPayment, seedSupplierPaymentOrder } from '../helpers/supplier-payment-db';
import { resetPo, seedPo, seedPoItem, seedOrder } from '../helpers/po-db';

let app: INestApplication;
let jwtSvc: JwtService;
let svc: SupplierPaymentService;

const CP = { checkpointType: 'biz' as const, checkpointRef: 'payment.duyet_ncc' };

async function configOn(editMode: 'all' | 'off' = 'all') {
  return prisma.returnConfig.create({ data: { ...CP, editMode, requireReason: true } });
}

beforeAll(async () => {
  app = await createApp();
  await app.init();
  jwtSvc = app.get(JwtService);
  svc = app.get(SupplierPaymentService);
});
beforeEach(async () => {
  await resetIam();
  app.get(PermService).clearCache();
  await resetSupplierPayment();
  await prisma.returnState.deleteMany({ where: { objectType: 'payment' } });
  // Chỉ dọn cấu hình của ĐÚNG điểm duyệt này (tbl_return_fields đi theo FK Cascade).
  await prisma.returnConfig.deleteMany({ where: CP });
  await configOn('all');
});
afterAll(async () => {
  await prisma.returnConfig.deleteMany({ where: CP });
  await app.close();
  await prisma.$disconnect();
});

async function tokenFor(user: { id: number; username: string }) {
  return 'Bearer ' + (await jwtSvc.signAsync({ sub: user.id, username: user.username }));
}

async function seedGranted(username: string, grants: { code: string; scope: Scope }[], gid: number | null = null) {
  const u = await seedUser({ username });
  if (gid !== null) await prisma.user.update({ where: { id: u.id }, data: { gid } });
  if (grants.length) {
    const r = await seedRole('zzdr-' + username, grants);
    await assignRole(u.id, r.id);
  }
  app.get(PermService).clearCache();
  return u;
}

const sale = (name = 'ZZDR_sale1', gid: number | null = null) =>
  seedGranted(name, [{ code: 'payment.view', scope: Scope.own }], gid);
const ketoan = (name = 'ZZDR_ketoan', gid: number | null = null) =>
  seedGranted(name, [{ code: 'payment.view', scope: Scope.all }, { code: 'payment.delete', scope: Scope.all }], gid);

function phieu(saler: string, o: Partial<Prisma.SupplierPaymentUncheckedCreateInput> = {}) {
  return seedSupplierPayment({
    saler,
    cdate: 1758600000,
    priceCyn: new Prisma.Decimal('447.60'),
    rateBuy: 3925,
    codeOrder: 'DH-ZZDR',
    orderId: 1021546,
    from: '1688',
    source: 'TT RMB Bằng Tường',
    accountCode: 'TK02',
    nccReceiver: 'Nguoi nhan cu',
    nccBankName: 'ICBC',
    nccBankAccount: 'STK-' + saler,
    nccInvoiceImages: '[]',
    nccPackingListImages: null,
    ...o,
  });
}

const EIGHT = [
  'ncc_invoice_images', 'ncc_packing_list_images', 'ncc_receiver', 'ncc_bank_name',
  'ncc_bank_account', 'ncc_bank_note', 'price_cyn', 'rate_buy',
];

// ─────────────────────────────── TRẢ CHỨNG TỪ (T2, G8b) ───────────────────────────────

describe('returnDoc — trả chứng từ (04b T2, 09a §5.12, G8b)', () => {
  it('kế toán trả phiếu chờ duyệt: trạng thái returned vòng 1, lý do = nhãn + ": " + ghi chú, '
    + 'data_before 12 cột như prod, log doc_return, KHÔNG đụng tbl_payment', async () => {
    const k = await ketoan();
    const p = await phieu('ZZDR_sale1', { nccBankNote: null });
    const before = await prisma.supplierPayment.findUnique({ where: { id: p.id } });

    await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/doc-return`)
      .set('Authorization', await tokenFor(k)).send({ reasonCode: 'sai_so_tien', note: 'kiểm lại' }).expect(201);

    const st = await prisma.returnState.findUnique({ where: { objectType_objectId: { objectType: 'payment', objectId: p.id } } });
    expect(st).toMatchObject({
      checkpointType: 'biz', checkpointRef: 'payment.duyet_ncc', state: 'returned', round: 1,
      reason: 'Sai số tiền: kiểm lại', returnedBy: 'ZZDR_ketoan', resubmittedAt: null,
    });
    expect(st!.fieldsOpened).toEqual(EIGHT);
    // 04b §4.2: ĐÚNG 12 cột, giá trị như dòng mysqli (chuỗi; NULL giữ null).
    expect(st!.dataBefore).toEqual({
      id: String(p.id), code_order: 'DH-ZZDR', saler: 'ZZDR_sale1', price_cyn: '447.60', rate_buy: '3925',
      currency: 'CNY', ncc_invoice_images: '[]', ncc_packing_list_images: null, ncc_receiver: 'Nguoi nhan cu',
      ncc_bank_name: 'ICBC', ncc_bank_account: 'STK-ZZDR_sale1', ncc_bank_note: null,
    });
    // (Thứ tự khoá KHÔNG kiểm được: cột `data_before` là jsonb — Postgres tự sắp lại khoá.)
    expect(Object.keys(st!.dataBefore as object)).toHaveLength(12);
    const logs = await prisma.supplierPaymentLog.findMany({ where: { paymentId: p.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'doc_return', note: 'Sai số tiền: kiểm lại', oldData: '', newData: '', createdBy: 'ZZDR_ketoan' });
    expect(await prisma.supplierPayment.findUnique({ where: { id: p.id } })).toEqual(before);
  });

  it('trả phiếu ĐÃ DUYỆT ⇒ từ chối "Phiếu đã duyệt, không trả về được", không trạng thái, không log', async () => {
    const k = await ketoan();
    const p = await phieu('ZZDR_sale1', { confirm: 'yes', status: 'yes' });
    const res = await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/doc-return`)
      .set('Authorization', await tokenFor(k)).send({ reasonCode: 'thieu_invoice', note: 'x' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Phiếu đã duyệt, không trả về được');
    expect(await prisma.returnState.count({ where: { objectType: 'payment', objectId: p.id } })).toBe(0);
    expect(await prisma.supplierPaymentLog.count()).toBe(0);
  });

  it('cấu hình biz:payment.duyet_ncc TẮT (off) hoặc KHÔNG CÓ ⇒ từ chối, không ghi gì', async () => {
    const k = await ketoan();
    const p = await phieu('ZZDR_sale1');
    const t = await tokenFor(k);
    await prisma.returnConfig.updateMany({ where: CP, data: { editMode: 'off' } });
    const r1 = await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/doc-return`).set('Authorization', t).send({ reasonCode: 'khac', note: 'x' });
    await prisma.returnConfig.deleteMany({ where: CP });
    const r2 = await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/doc-return`).set('Authorization', t).send({ reasonCode: 'khac', note: 'x' });
    for (const r of [r1, r2]) {
      expect(r.status).toBe(409);
      expect(r.body.message).toBe('Điểm duyệt này không bật trả về.');
    }
    expect(await prisma.returnState.count({ where: { objectType: 'payment' } })).toBe(0);
    expect(await prisma.supplierPaymentLog.count()).toBe(0);
  });

  it('SALE (payment.view phạm vi own) trả phiếu của chính mình ⇒ 403 "Sale không được trả chứng từ"; '
    + 'ĐỐI CHỨNG: sale thuộc gid 1 thì được', async () => {
    const s = await sale('ZZDR_sale1');
    const p = await phieu('ZZDR_sale1');
    const r = await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/doc-return`)
      .set('Authorization', await tokenFor(s)).send({ reasonCode: 'khac', note: 'x' });
    expect(r.status).toBe(403);
    expect(r.body.message).toBe('Sale không được trả chứng từ');
    expect(await prisma.returnState.count({ where: { objectType: 'payment' } })).toBe(0);

    const g1 = await sale('ZZDR_sale9', 1);
    const q = await phieu('ZZDR_sale9');
    await request(app.getHttpServer()).post(`/supplier-payments/${q.id}/doc-return`)
      .set('Authorization', await tokenFor(g1)).send({ reasonCode: 'khac', note: 'x' }).expect(201);
    expect(await prisma.returnState.count({ where: { objectType: 'payment', objectId: q.id, state: 'returned' } })).toBe(1);
  });

  it('reason_code ngoài tập prod ⇒ 400, không ghi gì', async () => {
    const k = await ketoan();
    const p = await phieu('ZZDR_sale1');
    await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/doc-return`)
      .set('Authorization', await tokenFor(k)).send({ reasonCode: 'bay_ba', note: 'x' }).expect(400);
    expect(await prisma.returnState.count({ where: { objectType: 'payment' } })).toBe(0);
  });

  it('mọi nhãn lý do đúng bảng prod', async () => {
    const k = await ketoan();
    const nhan: Record<string, string> = {
      thieu_invoice: 'Thiếu invoice', sai_so_tien: 'Sai số tiền', sai_stk: 'Sai tên/STK người nhận',
      file_mo: 'File mờ không đọc được', khac: 'Khác',
    };
    for (const [code, label] of Object.entries(nhan)) {
      const p = await phieu('ZZDR_sale1');
      await svc.returnDoc(k.id, p.id, code, 'n');
      const st = await prisma.returnState.findUniqueOrThrow({ where: { objectType_objectId: { objectType: 'payment', objectId: p.id } } });
      expect(st.reason).toBe(label + ': n');
    }
  });
});

// ─────────────────────────────── NỘP LẠI (T4, G11) ───────────────────────────────

async function traVe(k: { id: number }, id: number, code = 'sai_so_tien') {
  await svc.returnDoc(k.id, id, code, 'sửa đi');
}

describe('resubmitDoc — nộp lại (04b T4, G11)', () => {
  it('NGƯỜI KHÁC (không phải saler, không gid 1) nộp lại ⇒ 403, phiếu + trạng thái giữ nguyên', async () => {
    const k = await ketoan();
    const p = await phieu('ZZDR_sale1');
    await traVe(k, p.id);
    const before = await prisma.supplierPayment.findUnique({ where: { id: p.id } });
    const r = await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/doc-resubmit`)
      .set('Authorization', await tokenFor(k)).send({ fields: { price_cyn: '400.00' } });
    expect(r.status).toBe(403);
    expect(r.body.message).toBe('Chỉ người tạo phiếu mới nộp lại được');
    expect(await prisma.supplierPayment.findUnique({ where: { id: p.id } })).toEqual(before);
    expect((await prisma.returnState.findFirstOrThrow({ where: { objectType: 'payment', objectId: p.id } })).state).toBe('returned');
  });

  it('ĐỐI CHỨNG: chủ phiếu (saler có khoảng trắng thừa — so trim như prod) và người gid 1 nộp lại được', async () => {
    const k = await ketoan();
    const s = await sale('ZZDR_sale1');
    const a = await phieu('ZZDR_sale1');
    await traVe(k, a.id);
    await request(app.getHttpServer()).post(`/supplier-payments/${a.id}/doc-resubmit`)
      .set('Authorization', await tokenFor(s)).send({ fields: { ncc_receiver: 'Moi' } }).expect(201);
    expect((await prisma.supplierPayment.findUniqueOrThrow({ where: { id: a.id } })).nccReceiver).toBe('Moi');

    // chủ = trim(saler) === actor (process_doc_resubmit.php:35-36). Người này phạm vi `all` vì
    // phạm vi `own` (buildDocScope) so saler KHỚP BYTE — xem báo cáo Task 3, mục lưu ý.
    const padUser = await seedGranted('ZZDR_pad', [{ code: 'payment.view', scope: Scope.all }]);
    const pad = await phieu('ZZDR_pad ');
    await traVe(k, pad.id);
    await svc.resubmitDoc(padUser.id, pad.id, { fields: { ncc_receiver: 'Pad sua' } });
    expect((await prisma.supplierPayment.findUniqueOrThrow({ where: { id: pad.id } })).nccReceiver).toBe('Pad sua');

    const g1 = await ketoan('ZZDR_admin1', 1);
    const b = await phieu('ZZDR_sale1');
    await traVe(k, b.id);
    await request(app.getHttpServer()).post(`/supplier-payments/${b.id}/doc-resubmit`)
      .set('Authorization', await tokenFor(g1)).send({ fields: { ncc_receiver: 'Admin sua' } }).expect(201);
    expect((await prisma.returnState.findFirstOrThrow({ where: { objectType: 'payment', objectId: b.id } })).state).toBe('resubmitted');
  });

  it('gửi `saler`/`account_code` ⇒ GIỮ giá trị cũ, trường hợp lệ vẫn ghi, log doc_resubmit + doc_chan_truong', async () => {
    const k = await ketoan();
    const s = await sale('ZZDR_sale1');
    const p = await phieu('ZZDR_sale1');
    await traVe(k, p.id);
    await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/doc-resubmit`)
      .set('Authorization', await tokenFor(s))
      .send({ fields: { saler: 'ZZDR_keKhac', account_code: 'TK01', ncc_bank_name: 'BOC', confirm: 'no' }, note: 'đã sửa' })
      .expect(201);
    const after = await prisma.supplierPayment.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.saler).toBe('ZZDR_sale1');
    expect(after.accountCode).toBe('TK02');
    expect(after.nccBankName).toBe('BOC');
    expect(after.mdate).toBeGreaterThan(0);
    const logs = await prisma.supplierPaymentLog.findMany({ where: { paymentId: p.id }, orderBy: { id: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['doc_return', 'doc_resubmit', 'doc_chan_truong']);
    expect(JSON.parse(logs[1].oldData!)).toEqual({ ncc_bank_name: { cu: 'ICBC', moi: 'BOC' } });
    expect(JSON.parse(logs[1].newData!)).toEqual(['ncc_bank_name']);
    expect(logs[1].note).toBe('đã sửa');
    // `confirm` gửi đúng giá trị cũ ('no') ⇒ KHÔNG bị tính là cố đổi (prod chỉ ghi khi THỰC SỰ đổi).
    expect(JSON.parse(logs[2].newData!)).toEqual(['saler', 'account_code']);
    expect(logs[2].note).toBe('Người gửi cố đổi trường ngoài phạm vi cho phép');
    expect(logs[2].createdBy).toBe('ZZDR_sale1');
  });

  it('phiếu KHÔNG đang bị trả ⇒ từ chối, không ghi gì', async () => {
    const s = await sale('ZZDR_sale1');
    const p = await phieu('ZZDR_sale1');
    const before = await prisma.supplierPayment.findUnique({ where: { id: p.id } });
    const r = await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/doc-resubmit`)
      .set('Authorization', await tokenFor(s)).send({ fields: { ncc_receiver: 'X' } });
    expect(r.status).toBe(409);
    expect(await prisma.supplierPayment.findUnique({ where: { id: p.id } })).toEqual(before);
    expect(await prisma.supplierPaymentLog.count()).toBe(0);
  });

  it('L1 (SỬA có chủ đích): price_payment KHÁC NULL + đổi price_cyn ⇒ price_payment = phpRound(price_cyn*rate_buy) MỚI', async () => {
    const k = await ketoan();
    const s = await sale('ZZDR_sale1');
    // #14455 prod: 6.430,50 × 26.099 lưu 158.702.310 (số cũ) thay vì 167.829.620.
    const p = await phieu('ZZDR_sale1', {
      priceCyn: new Prisma.Decimal('6080.85'), rateBuy: 26099, pricePayment: new Prisma.Decimal('158702105.00'),
    });
    await traVe(k, p.id);
    await svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '6430.50' } });
    const after = await prisma.supplierPayment.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.priceCyn!.toFixed(2)).toBe('6430.50');
    expect(after.pricePayment!.toFixed(2)).toBe('167829620.00');
  });

  it('L1: đổi rate_buy cũng tính lại (447,60 × 3.930)', async () => {
    const k = await ketoan();
    const s = await sale('ZZDR_sale1');
    const p = await phieu('ZZDR_sale1', { pricePayment: new Prisma.Decimal('1756830.00') });
    await traVe(k, p.id);
    await svc.resubmitDoc(s.id, p.id, { fields: { rate_buy: '3930' } });
    const after = await prisma.supplierPayment.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.rateBuy).toBe(3930);
    expect(after.pricePayment!.toFixed(2)).toBe('1759068.00');
  });

  it('ĐỐI CHỨNG L1: price_payment NULL giữ NULL, bằng 0 giữ 0 (người đọc tự rơi về price_cyn*rate_buy)', async () => {
    const k = await ketoan();
    const s = await sale('ZZDR_sale1');
    const a = await phieu('ZZDR_sale1', { pricePayment: null });
    const b = await phieu('ZZDR_sale1', { pricePayment: new Prisma.Decimal('0') });
    for (const p of [a, b]) {
      await traVe(k, p.id);
      await svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '500.00' } });
    }
    expect((await prisma.supplierPayment.findUniqueOrThrow({ where: { id: a.id } })).pricePayment).toBeNull();
    expect((await prisma.supplierPayment.findUniqueOrThrow({ where: { id: b.id } })).pricePayment!.toFixed(2)).toBe('0.00');
  });

  it('ĐỐI CHỨNG L1: không đổi price_cyn/rate_buy ⇒ price_payment giữ NGUYÊN (kể cả khi đang lệch)', async () => {
    const k = await ketoan();
    const s = await sale('ZZDR_sale1');
    const p = await phieu('ZZDR_sale1', { pricePayment: new Prisma.Decimal('1758596.00') });
    await traVe(k, p.id);
    await svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '447.60', ncc_receiver: 'Y' } });
    expect((await prisma.supplierPayment.findUniqueOrThrow({ where: { id: p.id } })).pricePayment!.toFixed(2)).toBe('1758596.00');
  });

  it('hai vòng trả→nộp→trả→nộp ⇒ round=2, resubmitted, data_after = cả dòng SAU vòng 2', async () => {
    const k = await ketoan();
    const s = await sale('ZZDR_sale1');
    const p = await phieu('ZZDR_sale1');
    await traVe(k, p.id);
    await svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '447.00' } });
    await traVe(k, p.id, 'sai_stk');
    await svc.resubmitDoc(s.id, p.id, { fields: { ncc_bank_account: 'STK-MOI' } });
    const st = await prisma.returnState.findFirstOrThrow({ where: { objectType: 'payment', objectId: p.id } });
    expect(st.state).toBe('resubmitted');
    expect(st.round).toBe(2);
    expect(st.reason).toBe('Sai tên/STK người nhận: sửa đi');
    const da = st.dataAfter as Record<string, unknown>;
    expect(Object.keys(da)).toHaveLength(33);
    expect(da).toMatchObject({ id: String(p.id), price_cyn: '447.00', ncc_bank_account: 'STK-MOI', saler: 'ZZDR_sale1', account_code: 'TK02' });
    // changedFields (vòng cuối): data_before vòng 2 đã có price_cyn 447.00 ⇒ chỉ STK đổi.
    const k2 = await request(app.getHttpServer()).get(`/supplier-payments/${p.id}`).set('Authorization', await tokenFor(k)).expect(200);
    expect(k2.body.changedFields).toEqual({ ncc_bank_account: { cu: 'STK-ZZDR_sale1', moi: 'STK-MOI' } });
  });

  it('giá trị tiền sai định dạng (VN "447,60") ⇒ 400, không ghi gì, phiếu vẫn returned', async () => {
    const k = await ketoan();
    const s = await sale('ZZDR_sale1');
    const p = await phieu('ZZDR_sale1');
    await traVe(k, p.id);
    const before = await prisma.supplierPayment.findUnique({ where: { id: p.id } });
    for (const f of [{ price_cyn: '447,60' }, { rate_buy: '3925.5' }, { ncc_receiver: ['a'] }]) {
      await expect(svc.resubmitDoc(s.id, p.id, { fields: f })).rejects.toMatchObject({ status: 400 });
    }
    expect(await prisma.supplierPayment.findUnique({ where: { id: p.id } })).toEqual(before);
    expect((await prisma.returnState.findFirstOrThrow({ where: { objectType: 'payment', objectId: p.id } })).state).toBe('returned');
  });

  it('phiếu gắn PO nhưng KHÔNG có đơn liên kết (tbl_payment_orders) ⇒ KHÔNG kiểm trần (khớp prod); '
    + 'giảm tiền luôn được', async () => {
    const k = await ketoan();
    const s = await sale('ZZDR_sale1');
    const p = await phieu('ZZDR_sale1', { poId: 77, payType: 'supplier', orderId: 0 });
    await traVe(k, p.id);
    await svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '99999.00' } });
    expect((await prisma.supplierPayment.findUniqueOrThrow({ where: { id: p.id } })).priceCyn!.toFixed(2)).toBe('99999.00');
    const q = await phieu('ZZDR_sale1', { poId: 77, payType: 'supplier', orderId: 0 });
    await traVe(k, q.id);
    await svc.resubmitDoc(s.id, q.id, { fields: { price_cyn: '447.00' } });
    expect((await prisma.supplierPayment.findUniqueOrThrow({ where: { id: q.id } })).priceCyn!.toFixed(2)).toBe('447.00');
  });

  it('body lạ ở cấp ngoài ⇒ 400 (forbidNonWhitelisted); fields không phải object ⇒ 400', async () => {
    const k = await ketoan();
    const s = await sale('ZZDR_sale1');
    const p = await phieu('ZZDR_sale1');
    await traVe(k, p.id);
    const t = await tokenFor(s);
    await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/doc-resubmit`).set('Authorization', t).send({ fields: {}, saler: 'x' }).expect(400);
    await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/doc-resubmit`).set('Authorization', t).send({ fields: 'abc' }).expect(400);
  });
});

// ─────────────────────────────── Gác cửa HTTP ───────────────────────────────

describe('doc-return / doc-resubmit — gác cửa HTTP', () => {
  it('không token ⇒ 401; không quyền ⇒ 403; ngoài phạm vi ⇒ 404 GIỐNG id không tồn tại', async () => {
    const p = await phieu('ZZDR_sale2');
    for (const path of ['doc-return', 'doc-resubmit']) {
      await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/${path}`).send({}).expect(401);
    }
    const none = await seedGranted('ZZDR_none', []);
    const s = await sale('ZZDR_sale1');
    for (const path of ['doc-return', 'doc-resubmit']) {
      await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/${path}`).set('Authorization', await tokenFor(none)).send({}).expect(403);
      const ngoai = await request(app.getHttpServer()).post(`/supplier-payments/${p.id}/${path}`).set('Authorization', await tokenFor(s)).send({ reasonCode: 'khac', fields: {} });
      const khong = await request(app.getHttpServer()).post(`/supplier-payments/987654/${path}`).set('Authorization', await tokenFor(s)).send({ reasonCode: 'khac', fields: {} });
      expect(ngoai.status).toBe(404);
      expect(ngoai.body).toEqual(khong.body);
    }
    expect(await prisma.returnState.count({ where: { objectType: 'payment' } })).toBe(0);
  });
});

// ─────────────────────────────── Danh sách: MỘT luật chủ phiếu ───────────────────────────────

describe('laChuPhieu — trim KIỂU PHP, so chặt', () => {
  it('chỉ gỡ " \\t\\n\\r\\0\\x0B"; không gỡ NBSP/full-width; phân biệt hoa thường; actor rỗng ⇒ không là chủ', async () => {
    const { laChuPhieu } = await import('../../src/supplier-payment/supplier-payment.service');
    expect(laChuPhieu(' bob\t\n', 'bob')).toBe(true);
    expect(laChuPhieu('bob　', 'bob')).toBe(false);
    expect(laChuPhieu('bob ', 'bob')).toBe(false);
    expect(laChuPhieu('Bob', 'bob')).toBe(false);
    expect(laChuPhieu('', '')).toBe(false);
    expect(laChuPhieu(null, 'bob')).toBe(false);
  });
});

describe('list — phiếu returned: chủ phiếu = trim(saler) === actor (cùng hàm với resubmitDoc)', () => {
  it('saler có khoảng trắng thừa vẫn là CHỦ ⇒ thấy phiếu returned của mình; phiếu returned người khác vẫn ẩn', async () => {
    const u = await seedGranted('ZZDR_sale1', [{ code: 'payment.view', scope: Scope.all }]);
    const k = await ketoan();
    const mine = await phieu('ZZDR_sale1 ');
    const other = await phieu('ZZDR_sale2');
    await traVe(k, mine.id);
    await traVe(k, other.id);
    const res = await request(app.getHttpServer()).get('/supplier-payments').set('Authorization', await tokenFor(u)).expect(200);
    expect((res.body.items as { id: number }[]).map((x) => x.id)).toEqual([mine.id]);
  });
});

// ─────────────────────────────── Xoá: phạm vi kiểm lại DƯỚI khoá ───────────────────────────────

describe('delete — phiếu bị chuyển chủ giữa lúc kiểm phạm vi và lúc khoá dòng', () => {
  it('người xoá phạm vi `own`: phiếu bị gán cho sale khác khi đang chờ khoá ⇒ 404, phiếu còn nguyên', async () => {
    const u = await seedGranted('ZZDR_xoaown', [{ code: 'payment.delete', scope: Scope.own }]);
    const p = await phieu('ZZDR_xoaown');

    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let locked!: () => void;
    const holding = new Promise<void>((r) => { locked = r; });
    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tbl_payment WHERE id = ${p.id} FOR UPDATE`;
      await tx.supplierPayment.update({ where: { id: p.id }, data: { saler: 'ZZDR_sale2' } });
      locked();
      await gate;
    }, { timeout: 30000 });
    await holding;

    const del = svc.delete(u.id, p.id).then(() => 'ok', (e) => e);
    // Chờ tới khi lệnh xoá ĐANG ĐỢI khoá dòng (đã qua bước kiểm phạm vi trước khoá).
    for (let i = 0; i < 200; i++) {
      const w = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*)::bigint AS n FROM pg_stat_activity
        WHERE wait_event_type = 'Lock' AND query ILIKE '%FOR UPDATE%' AND query ILIKE '%tbl_payment%'`;
      if (Number(w[0].n) > 0) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    release();
    await holder;
    const out = await del;
    expect(out).toMatchObject({ status: 404 });
    expect(await prisma.supplierPayment.count({ where: { id: p.id } })).toBe(1);
    expect(await prisma.supplierPaymentLog.count({ where: { paymentId: p.id } })).toBe(0);
  });
});

// ─────────────────────────────── Trần PO khi price_cyn TĂNG (Fix round 1) ───────────────────────────────
// Nguyên văn prod `process_doc_resubmit.php:45-64` + `libs/cls.po.php:1462-1513` (điều phối viên đọc
// HEAD prod, chép logic vào brief Fix round 1):
//   tong = Σ po_ncc_gia_tri_don(đơn liên kết)  (dòng PO `supplier_cost_rmb` > 0 ưu tiên, không thì
//          `tbl_order.supplier_cost_rmb`; đơn không còn ⇒ bỏ qua)
//   da   = Σ po_ncc_da_yeu_cau (Σ rmb các phiếu pay_type='supplier', KỂ CẢ chưa duyệt) − price_cyn CŨ
//   con  = tong − da;  price_cyn mới > con + 0,01 ⇒ 'Vượt trần còn lại của PO (' + number_format(con,2,',','.') + ')'

describe('resubmitDoc — trần còn lại của PO khi price_cyn tăng (prod :45-64)', () => {
  beforeEach(async () => { await resetPo(); });

  /** PO 7: đơn o1 nối dòng PO giá NCC `itemCost`, snapshot đơn `orderCost`; phiếu P (của sale)
   *  liên kết o1 rmb 447,60; phiếu Q (supplier) khác liên kết o1 rmb 300. */
  async function dung(itemCost: string, orderCost: string, pPayType: '' | 'supplier' = 'supplier') {
    const k = await ketoan();
    const s = await sale('ZZDR_sale1');
    const po = await seedPo('PO-ZZDR');
    const item = await seedPoItem(po.id, { supplierCostRmb: new Prisma.Decimal(itemCost) });
    const o1 = await seedOrder({ poId: po.id, poItemId: item.id, supplierCostRmb: new Prisma.Decimal(orderCost) });
    const p = await phieu('ZZDR_sale1', { poId: po.id, payType: pPayType, orderId: 0 });
    await seedSupplierPaymentOrder(p.id, { orderId: Number(o1.id), rmb: new Prisma.Decimal('447.60') });
    const q = await phieu('ZZDR_sale2', { poId: po.id, payType: 'supplier', orderId: 0 });
    await seedSupplierPaymentOrder(q.id, { orderId: Number(o1.id), rmb: new Prisma.Decimal('300.00') });
    await traVe(k, p.id);
    return { k, s, p, o1, po };
  }
  const cyn = async (id: number) => (await prisma.supplierPayment.findUniqueOrThrow({ where: { id } })).priceCyn!.toFixed(2);

  it('tăng DƯỚI trần ⇒ được. Chỉ phiếu pay_type=supplier được đếm; đơn liên kết không còn ⇒ bỏ qua', async () => {
    const { s, p, o1 } = await dung('1000.00', '5.00');
    // Phiếu luồng cũ (pay_type='') liên kết cùng đơn: KHÔNG được đếm vào "đã yêu cầu".
    const r = await phieu('ZZDR_sale3', { payType: '', orderId: 0 });
    await seedSupplierPaymentOrder(r.id, { orderId: Number(o1.id), rmb: new Prisma.Decimal('9999.00') });
    // Liên kết tới đơn KHÔNG tồn tại: tong bỏ qua, da cộng 0.
    await seedSupplierPaymentOrder(p.id, { orderId: 987654, rmb: new Prisma.Decimal('0') });
    // tong = 1000 (dòng PO, KHÔNG phải snapshot 5); da = 447,60 + 300 − 447,60 = 300; con = 700.
    await svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '699.99' } });
    expect(await cyn(p.id)).toBe('699.99');
  });

  it('liên kết order_id=0 KHÔNG cộng vào "đã yêu cầu" (prod po_ncc_da_yeu_cau lọc id>0)', async () => {
    // Review Task 3 Minor 1: prod giữ 0 trong $oids (kiểm vẫn chạy), đơn 0 không tồn tại ⇒ tong bỏ qua,
    // và po_ncc_da_yeu_cau() chỉ nhận id > 0 ⇒ rmb của MỌI phiếu supplier nối đơn 0 KHÔNG được đếm.
    const { s, p } = await dung('1000.00', '5.00');
    await seedSupplierPaymentOrder(p.id, { orderId: 0, rmb: new Prisma.Decimal('0') });
    const z = await phieu('ZZDR_sale4', { payType: 'supplier', orderId: 0 });
    await seedSupplierPaymentOrder(z.id, { orderId: 0, rmb: new Prisma.Decimal('500.00') });
    // Như ca gốc: con = 700 (đơn 0 không làm hẹp trần).
    await svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '700.01' } });
    expect(await cyn(p.id)).toBe('700.01');
  });

  it('biên 0,01: đúng con + 0,01 ⇒ được', async () => {
    const a = await dung('1000.00', '5.00');
    await svc.resubmitDoc(a.s.id, a.p.id, { fields: { price_cyn: '700.01' } });
    expect(await cyn(a.p.id)).toBe('700.01');
  });

  it('biên 0,01: con + 0,02 ⇒ từ chối "Vượt trần còn lại của PO (700,00)", không ghi gì', async () => {
    const b = await dung('1000.00', '5.00');
    await expect(svc.resubmitDoc(b.s.id, b.p.id, { fields: { price_cyn: '700.02' } }))
      .rejects.toMatchObject({ status: 409, message: 'Vượt trần còn lại của PO (700,00)' });
    expect(await cyn(b.p.id)).toBe('447.60');
    expect((await prisma.returnState.findFirstOrThrow({ where: { objectType: 'payment', objectId: b.p.id } })).state).toBe('returned');
  });

  it('vượt trần ⇒ thông điệp number_format(con, 2, ",", ".") — chấm nghìn, phẩy thập phân', async () => {
    const { s, p } = await dung('1234567.89', '5.00');
    // con = 1.234.567,89 − 300 = 1.234.267,89
    await expect(svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '1234267.91' } }))
      .rejects.toMatchObject({ status: 409, message: 'Vượt trần còn lại của PO (1.234.267,89)' });
  });

  it('giá NCC dòng PO = 0 ⇒ rơi về snapshot tbl_order.supplier_cost_rmb', async () => {
    const { s, p } = await dung('0', '800.00');
    // tong = 800; con = 500
    await expect(svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '500.02' } }))
      .rejects.toMatchObject({ status: 409, message: 'Vượt trần còn lại của PO (500,00)' });
    await svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '500.01' } });
    expect(await cyn(p.id)).toBe('500.01');
  });

  it('khớp prod — quirk ghi nhận, xem báo cáo: phiếu pay_type="" vẫn bị TRỪ price_cyn cũ khỏi "đã yêu cầu" '
    + 'dù chưa từng được đếm ⇒ trần bị THỔI lên đúng 447,60', async () => {
    const { s, p } = await dung('1000.00', '5.00', '');
    // daArr[o1] = 300 (chỉ Q); da = 300 − 447,60 = −147,60; con = 1.147,60 (đúng ra phải là 700).
    await expect(svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '1147.62' } }))
      .rejects.toMatchObject({ status: 409, message: 'Vượt trần còn lại của PO (1.147,60)' });
    await svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '1147.61' } });
    expect(await cyn(p.id)).toBe('1147.61');
  });

  it('không TĂNG (giữ nguyên hoặc giảm) ⇒ không kiểm trần, kể cả khi đang vượt', async () => {
    const { s, p } = await dung('100.00', '5.00'); // con = 100 − 300 = −200: đang vượt
    await svc.resubmitDoc(s.id, p.id, { fields: { price_cyn: '447.60', ncc_receiver: 'Z' } });
    expect(await cyn(p.id)).toBe('447.60');
  });
});
