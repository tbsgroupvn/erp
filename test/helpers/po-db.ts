import { Prisma } from '@prisma/client';
import { prisma } from './db';

export async function resetPo() {
  await prisma.$executeRawUnsafe(
    // ⚠ tbl_po_diff_acceptance PHẢI dọn cùng đợt: không có FK ràng buộc tới
    // tbl_purchase_orders, nhưng RESTART IDENTITY khiến id PO mới trong test
    // SAU trùng số với PO test TRƯỚC — sót bản ghi chấp nhận chênh cũ sẽ
    // "dính" nhầm vào PO mới, canIssueInvoice sai ngay từ khâu isolation.
    // #06 đợt 2 (24/09/2026): tbl_po_suborders/tbl_order dọn CÙNG lý do —
    // không FK, nhưng id PO/suborder test sau có thể trùng id PO/suborder
    // test trước nếu không RESTART IDENTITY đồng bộ.
    `TRUNCATE tbl_po_items, tbl_purchase_orders, tbl_po_receipts, tbl_po_diff_acceptance, tbl_po_suborders, tbl_order RESTART IDENTITY CASCADE`,
  );
}

/** Phụ lục PO với mọi cột bắt buộc điền sẵn giá trị hợp lệ — override khi cần. */
export async function seedPoSuborder(
  poId: number,
  overrides: Partial<Prisma.PoSuborderUncheckedCreateInput> = {},
) {
  return prisma.poSuborder.create({
    data: {
      poId,
      subCode: 'PO-TEST-Đ01',
      cdate: 1,
      ...overrides,
    },
  });
}

/** Đơn hàng sinh từ PO (order_type=1) với cột bắt buộc điền sẵn — override khi cần. */
export async function seedOrder(
  overrides: Partial<Prisma.OrderUncheckedCreateInput> = {},
) {
  return prisma.order.create({
    data: {
      poItemId: 0,
      supplierCostRmb: 0,
      ...overrides,
    },
  });
}

/** Header PO với mọi cột bắt buộc điền sẵn giá trị hợp lệ — override khi cần. */
export async function seedPo(
  poCode: string,
  overrides: Partial<Prisma.PurchaseOrderUncheckedCreateInput> = {},
) {
  return prisma.purchaseOrder.create({
    data: {
      poCode,
      subtotal: 0,
      vatAmount: 0,
      totalAmount: 0,
      advanceAmount: 0,
      status: 0,
      cdate: 1,
      ...overrides,
    },
  });
}

/** Dòng PO với mọi cột bắt buộc điền sẵn giá trị hợp lệ — override khi cần. */
export async function seedPoItem(
  poId: number,
  overrides: Partial<Prisma.PoItemUncheckedCreateInput> = {},
) {
  return prisma.poItem.create({
    data: {
      poId,
      sortOrder: 1,
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      ...overrides,
    },
  });
}

/** Phiếu thu PO (giữ hold #03) với cột bắt buộc điền sẵn — override khi cần. */
export async function seedPoReceipt(
  overrides: Partial<Prisma.PoReceiptUncheckedCreateInput> & {
    customerId: string;
    amount: Prisma.Decimal | number | string;
    method: string;
    status: string;
  },
) {
  return prisma.poReceipt.create({
    data: {
      ...overrides,
    },
  });
}
