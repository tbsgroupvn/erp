import { prisma } from './db';

export async function resetMasterdata() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE tbl_customer, tbl_customer_group, tbl_kho, tbl_chiphi_group,
     tbl_crm_categories, tbl_ncc, tbl_ncc_pay_info, tbl_ncc_vn RESTART IDENTITY CASCADE`,
  );
}

export async function seedWarehouses() {
  await prisma.warehouse.createMany({
    data: [
      { ma: 'VN_HN', ten: 'Kho Hà Nội', loai: 'VN', sort: 1 },
      { ma: 'VN_HCM', ten: 'Kho Hồ Chí Minh', loai: 'VN', sort: 2 },
      { ma: 'TQ_BANGTUONG', ten: 'Kho Bằng Tường', loai: 'TQ', sort: 3 },
      { ma: 'TQ_NGHIAO', ten: 'Kho Nghĩa Ô', loai: 'TQ', sort: 4 },
    ],
  });
}

export async function seedCustomer(code: string, saler = 'sale1', salerOther?: string[]) {
  return prisma.customer.create({
    data: { code, name: 'KH ' + code, saler,
            salerOther: salerOther ? JSON.stringify(salerOther) : null,
            cdate: 1, mdate: 1 },
  });
}
