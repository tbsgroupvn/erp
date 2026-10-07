// 09a đợt 1, Task 1 — model + migration only (không service/HTTP).
// Giá trị tiền thật lấy từ đặc tả §2.1/§13 (docs/rewrite-spec/09a-thanh-toan-ncc.md)
// để bảo đảm round-trip không mất chữ số qua Decimal(18,2).
import { Prisma } from '@prisma/client';
import { prisma } from '../helpers/db';
import {
  resetSupplierPayment,
  seedSupplierPayment,
  seedSupplierPaymentOrder,
  seedSupplierPaymentLog,
  seedPaymentSource,
} from '../helpers/supplier-payment-db';

beforeEach(resetSupplierPayment);
afterAll(() => prisma.$disconnect());

describe('SupplierPayment schema (09a đợt 1)', () => {
  test('tạo/đọc phiếu — price_cyn 6430.50, rate_buy 26099, price_payment 158702310.00 round-trip đủ chữ số', async () => {
    // Ca thật #14455 (đặc tả §12 L1): price_cyn*rate_buy = 167.829.620 ≠
    // price_payment lưu 158.702.310 — port trung thành KHÔNG tự sửa (§11.1),
    // nên cố ý lưu price_payment KHÁC round(price_cyn*rate_buy) ở đây.
    const p = await seedSupplierPayment({
      priceCyn: new Prisma.Decimal('6430.50'),
      currency: 'CNY',
      rateBuy: 26099,
      pricePayment: new Prisma.Decimal('158702310.00'),
      saler: 'test_saler',
      codeOrder: 'DH-TEST-001',
      orderId: 123,
    });

    const found = await prisma.supplierPayment.findUniqueOrThrow({
      where: { id: p.id },
    });
    // Prisma.Decimal (decimal.js) tự cắt số 0 vô nghĩa ở toString() — so bằng
    // toFixed(2) để khẳng định GIÁ TRỊ không mất chữ số qua Decimal(18,2),
    // không so mặt chữ nguyên văn của cột.
    expect(found.priceCyn?.toFixed(2)).toBe('6430.50');
    expect(found.rateBuy).toBe(26099);
    expect(found.pricePayment?.toFixed(2)).toBe('158702310.00');
    expect(found.currency).toBe('CNY');
    // mặc định port nguyên trạng prod (mục 3.1 / §8): confirm/status/payment mặc định 'no'
    expect(found.confirm).toBe('no');
    expect(found.status).toBe('no');
  });

  test('price_payment NULL là bình thường (14.328/15.517 dòng prod, §11.1) — không backfill', async () => {
    const p = await seedSupplierPayment({
      priceCyn: new Prisma.Decimal('100.00'),
      rateBuy: 3925,
      // pricePayment omitted -> NULL, web tạo không ghi cột này
    });
    const found = await prisma.supplierPayment.findUniqueOrThrow({
      where: { id: p.id },
    });
    expect(found.pricePayment).toBeNull();
  });

  test('order_id=0 hợp lệ cho phiếu gộp (pay_type=supplier, §11.3) — KHÔNG là NULL', async () => {
    const p = await seedSupplierPayment({
      priceCyn: new Prisma.Decimal('50.00'),
      rateBuy: 3900,
      orderId: 0,
      payType: 'supplier',
      codeOrder: 'PO-TEST-001',
    });
    const found = await prisma.supplierPayment.findUniqueOrThrow({
      where: { id: p.id },
    });
    expect(found.orderId).toBe(0);
    expect(found.payType).toBe('supplier');
  });

  test('account_code mặc định chuỗi rỗng, KHÔNG NULL (14.238/15.517 dòng prod, migration §0.4)', async () => {
    const p = await seedSupplierPayment({
      priceCyn: new Prisma.Decimal('10.00'),
      rateBuy: 3900,
    });
    const found = await prisma.supplierPayment.findUniqueOrThrow({
      where: { id: p.id },
    });
    expect(found.accountCode).toBe('');
  });
});

describe('SupplierPaymentOrder schema', () => {
  test('tạo/đọc phân bổ phiếu→đơn, rmb round-trip 2 chữ số thập phân', async () => {
    const p = await seedSupplierPayment({
      priceCyn: new Prisma.Decimal('907.00'),
      rateBuy: 3925,
      payType: 'supplier',
      orderId: 0,
    });
    const link = await seedSupplierPaymentOrder(p.id, {
      orderId: 1044634,
      rmb: new Prisma.Decimal('906.60'),
      prevFund: new Prisma.Decimal('907.00'),
      prevRate: new Prisma.Decimal('3925'),
    });
    const found = await prisma.supplierPaymentOrder.findUniqueOrThrow({
      where: { id: link.id },
    });
    expect(found.rmb.toFixed(2)).toBe('906.60');
    expect(found.prevFund?.toFixed(2)).toBe('907.00');
  });

  test('unique (payment_id, order_id) như uq_pay_order prod', async () => {
    const p = await seedSupplierPayment({
      priceCyn: new Prisma.Decimal('10.00'),
      rateBuy: 3900,
    });
    await seedSupplierPaymentOrder(p.id, { orderId: 5 });
    await expect(seedSupplierPaymentOrder(p.id, { orderId: 5 })).rejects.toThrow();
  });

  test('xoá phiếu cascade xoá dòng phân bổ (v2 siết FK — prod để mồ côi, migration §3 A2)', async () => {
    const p = await seedSupplierPayment({
      priceCyn: new Prisma.Decimal('10.00'),
      rateBuy: 3900,
    });
    await seedSupplierPaymentOrder(p.id, { orderId: 7 });
    await prisma.supplierPayment.delete({ where: { id: p.id } });
    expect(
      await prisma.supplierPaymentOrder.count({ where: { paymentId: p.id } }),
    ).toBe(0);
  });
});

describe('SupplierPaymentLog schema', () => {
  test('tạo/đọc log, action đủ 6 giá trị enum prod (đặc tả §2.2)', async () => {
    const p = await seedSupplierPayment({
      priceCyn: new Prisma.Decimal('10.00'),
      rateBuy: 3900,
    });
    for (const action of [
      'rollback',
      'edit',
      'delete',
      'doc_return',
      'doc_resubmit',
      'doc_chan_truong',
    ] as const) {
      await seedSupplierPaymentLog(p.id, { action });
    }
    expect(
      await prisma.supplierPaymentLog.count({ where: { paymentId: p.id } }),
    ).toBe(6);
  });

  test('log KHÔNG FK tới payment — sống sau khi phiếu bị xoá (240 dòng prod, migration A5)', async () => {
    const p = await seedSupplierPayment({
      priceCyn: new Prisma.Decimal('10.00'),
      rateBuy: 3900,
    });
    await seedSupplierPaymentLog(p.id, { action: 'delete' });
    await prisma.supplierPayment.delete({ where: { id: p.id } });
    expect(
      await prisma.supplierPaymentLog.count({ where: { paymentId: p.id } }),
    ).toBe(1);
  });
});

describe('PaymentSource schema', () => {
  test('tạo/đọc nguồn tệ, tk_code NULL hợp lệ (TT quỹ USD, migration §2.4)', async () => {
    const s = await seedPaymentSource('TT quỹ USD', { tkCode: null });
    const found = await prisma.paymentSource.findUniqueOrThrow({
      where: { id: s.id },
    });
    expect(found.tkCode).toBeNull();
  });

  test('tạo/đọc nguồn tệ có tk_code', async () => {
    const s = await seedPaymentSource('TT RMB Bằng Tường', { tkCode: 'TK02' });
    const found = await prisma.paymentSource.findUniqueOrThrow({
      where: { id: s.id },
    });
    expect(found.tkCode).toBe('TK02');
  });
});
