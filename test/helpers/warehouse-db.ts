import { Prisma } from '@prisma/client';
import { prisma } from './db';

export async function resetWarehouse() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE tbl_khotq_receipts, tbl_po_packing_lot, tbl_po_packing_lot_item,
     tbl_transport_files, tbl_transport_file_items, tbl_transport_file_packages,
     tbl_transport_package_contents, tbl_package_issue RESTART IDENTITY CASCADE`,
  );
}

/** Phiếu nhận kho TQ với mọi cột bắt buộc điền sẵn — override khi cần. */
export async function seedKhoTqReceipt(
  overrides: Partial<Prisma.KhoTqReceiptUncheckedCreateInput> = {},
) {
  return prisma.khoTqReceipt.create({
    data: {
      status: 1,
      ...overrides,
    },
  });
}

/** Lô đóng gói theo PO — override khi cần. */
export async function seedPackingLot(
  poId: number,
  lotNo: number,
  overrides: Partial<Prisma.PackingLotUncheckedCreateInput> = {},
) {
  return prisma.packingLot.create({
    data: {
      poId,
      lotNo,
      ...overrides,
    },
  });
}

/** Hồ sơ vận chuyển (container/chuyến) — override khi cần. */
export async function seedTransportFile(
  overrides: Partial<Prisma.TransportFileUncheckedCreateInput> = {},
) {
  return prisma.transportFile.create({
    data: {
      status: 0,
      ...overrides,
    },
  });
}

/** Sự cố kiện — override khi cần. */
export async function seedPackageIssue(
  packageId: number,
  overrides: Partial<Prisma.PackageIssueUncheckedCreateInput> = {},
) {
  return prisma.packageIssue.create({
    data: {
      packageId,
      ...overrides,
    },
  });
}
