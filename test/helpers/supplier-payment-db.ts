import { Prisma } from '@prisma/client';
import { prisma } from './db';

export async function resetSupplierPayment() {
  await prisma.$executeRawUnsafe(
    // 09a đợt 1 — model-only. tbl_payment_orders/tbl_payment_log KHÔNG FK
    // tới tbl_payment trên prod (mồ côi thật, xem migration doc A2/A5) nhưng
    // ở v2 SupplierPaymentOrder có FK onDelete:Cascade (§8) — dọn theo TRUNCATE
    // để test không phụ thuộc thứ tự.
    `TRUNCATE tbl_payment, tbl_payment_orders, tbl_payment_log, tbl_payment_source RESTART IDENTITY CASCADE`,
  );
}

/** Phiếu thanh toán NCC với mọi cột bắt buộc điền sẵn giá trị hợp lệ — override khi cần. */
export async function seedSupplierPayment(
  overrides: Partial<Prisma.SupplierPaymentUncheckedCreateInput> = {},
) {
  return prisma.supplierPayment.create({
    data: {
      ...overrides,
    },
  });
}

export async function seedSupplierPaymentOrder(
  paymentId: number,
  overrides: Partial<Prisma.SupplierPaymentOrderUncheckedCreateInput> = {},
) {
  return prisma.supplierPaymentOrder.create({
    data: {
      paymentId,
      orderId: 0,
      ...overrides,
    },
  });
}

export async function seedSupplierPaymentLog(
  paymentId: number,
  overrides: Partial<Prisma.SupplierPaymentLogUncheckedCreateInput> = {},
) {
  return prisma.supplierPaymentLog.create({
    data: {
      paymentId,
      action: 'edit',
      ...overrides,
    },
  });
}

export async function seedPaymentSource(
  name: string,
  overrides: Partial<Prisma.PaymentSourceUncheckedCreateInput> = {},
) {
  return prisma.paymentSource.create({
    data: {
      name,
      ...overrides,
    },
  });
}
